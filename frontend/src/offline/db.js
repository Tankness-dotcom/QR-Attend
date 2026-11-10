/**
 * offline/db.js
 * IndexedDB wrapper for QR-Attend offline cache + sync queue.
 *
 * Stores:
 *   cache      — key/value store for API GET responses
 *   syncQueue  — pending POST/DELETE actions to replay when online
 */

const DB_NAME    = 'qrattend-offline';
const DB_VERSION = 1;

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
