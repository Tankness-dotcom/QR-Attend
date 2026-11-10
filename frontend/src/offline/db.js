/**
 * offline/db.js
 * IndexedDB wrapper for QR-Attend offline cache + sync queue + sessions.
 *
 * Stores:
 *   cache      — key/value store for API GET responses
 *   syncQueue  — pending POST/DELETE actions to replay when online
 *   sessions   — cached user credentials for offline login
 */

const DB_NAME    = 'qrattend-offline';
const DB_VERSION = 2;   // bumped to add sessions store

let _db = null;

export function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('syncQueue')) {
        const qs = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        qs.createIndex('by_created', 'created_at');
      }
      // sessions store — keyed by "accountType:identifier" e.g. "teacher:admin@rnhs.edu.ph"
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'sessionKey' });
      }
    };

    req.onsuccess  = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror    = (e) => reject(e.target.error);
  });
}

/* ── Cache store helpers ── */

export async function cacheSet(key, data) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx   = db.transaction('cache', 'readwrite');
    const store = tx.objectStore('cache');
    store.put({ key, data, updated_at: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

export async function cacheGet(key) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('cache', 'readonly');
    const store = tx.objectStore('cache');
    const req   = store.get(key);
    req.onsuccess = (e) => resolve(e.target.result?.data ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function cacheClear() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('cache', 'readwrite');
    tx.objectStore('cache').clear();
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/* ── Sync queue helpers ── */

export async function queueAdd(action) {
  // action: { type, url, body, description }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    const req   = store.add({ ...action, created_at: Date.now() });
    req.onsuccess = (e) => resolve(e.target.result); // returns new id
    tx.onerror    = (e) => reject(e.target.error);
  });
}

export async function queueGetAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('syncQueue', 'readonly');
    const store = tx.objectStore('syncQueue');
    const req   = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

export async function queueDelete(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');
    store.delete(id);
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

export async function queueCount() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('syncQueue', 'readonly');
    const req   = tx.objectStore('syncQueue').count();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ── Sessions store helpers ── */

/**
 * Save a session after a successful online login.
 * Stores the bcrypt hash of the password so we can verify offline.
 *
 * @param {string} accountType  'teacher' | 'student'
 * @param {string} identifier   email (teacher) or username (student)
 * @param {string} pwHash       bcrypt hash of the password
 * @param {string} token        JWT token from the server
 * @param {object} user         user object from the server
 */
export async function sessionSave(accountType, identifier, pwHash, token, user) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    store.put({
      sessionKey:  `${accountType}:${identifier.toLowerCase()}`,
      accountType,
      identifier:  identifier.toLowerCase(),
      pwHash,
      token,
      user,
      saved_at:    Date.now(),
    });
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/**
 * Retrieve a cached session by account type + identifier.
 */
export async function sessionGet(accountType, identifier) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    const req   = store.get(`${accountType}:${identifier.toLowerCase()}`);
    req.onsuccess = (e) => resolve(e.target.result ?? null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Update the token for an existing session (e.g. after re-login online).
 */
export async function sessionUpdateToken(accountType, identifier, token, user) {
  const db = await openDb();
  const existing = await sessionGet(accountType, identifier);
  if (!existing) return;
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    store.put({ ...existing, token, user, saved_at: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/**
 * List all saved sessions (for showing "quick login" options).
 */
export async function sessionList() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('sessions', 'readonly');
    const req   = tx.objectStore('sessions').getAll();
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/**
 * Remove a saved session.
 */
export async function sessionDelete(accountType, identifier) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('sessions', 'readwrite');
    tx.objectStore('sessions').delete(`${accountType}:${identifier.toLowerCase()}`);
    tx.oncomplete = resolve;
    tx.onerror    = (e) => reject(e.target.error);
  });
}
