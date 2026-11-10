/**
 * offline/offlineAuth.js
 *
 * Offline-aware login flow:
 *
 *  1. Try the real network login.
 *  2. On success → hash the password with bcrypt and save the session
 *     to IndexedDB for future offline use.
 *  3. On network failure (offline) → look up the cached session and
 *     verify the entered password against the stored hash.
 *     If it matches → return the cached user + token.
 *
 * Security notes:
 *  - We NEVER store plaintext passwords.
 *  - We use bcryptjs (cost 10) to hash the password in the browser.
 *  - The stored token is reused offline. It may be expired; when the
 *    user comes back online the first real API call will get a 401
 *    and they'll be asked to log in again online.
 */

import bcrypt from 'bcryptjs';
import { sessionSave, sessionGet } from './db';

const BASE = '/api';
const BCRYPT_ROUNDS = 10;

/* ── helpers ── */
function isOfflineError(err) {
  return (
    !navigator.onLine ||
    err?.name === 'AbortError' ||
    err?.name === 'TypeError' ||      // "Failed to fetch"
    err?.message?.includes('fetch') ||
    err?.message?.includes('network') ||
    err?.message?.includes('offline')
  );
}

/* ────────────────────────────────────────
   Teacher offline-aware login
──────────────────────────────────────── */
export async function offlineTeacherLogin(email, password) {
  // 1. Try online first
  try {
    const res = await fetch(`${BASE}/auth/teacher/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid credentials');

    // 2. Online success — hash password and save session for offline use
    const pwHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await sessionSave('teacher', email, pwHash, data.token, data.user);

    return { ...data, _source: 'online' };
  } catch (err) {
    if (!isOfflineError(err)) throw err; // wrong password etc — rethrow

    // 3. Offline fallback — check cached session
    return _offlineFallback('teacher', email, password);
  }
}

/* ────────────────────────────────────────
   Student offline-aware login
──────────────────────────────────────── */
export async function offlineStudentLogin(username, password) {
  // 1. Try online first
  try {
    const res = await fetch(`${BASE}/auth/student/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid credentials');

    // 2. Online success — cache session
    const pwHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await sessionSave('student', username, pwHash, data.token, data.user);

    return { ...data, _source: 'online' };
  } catch (err) {
    if (!isOfflineError(err)) throw err;

    return _offlineFallback('student', username, password);
  }
}

/* ────────────────────────────────────────
   Shared offline fallback
──────────────────────────────────────── */
async function _offlineFallback(accountType, identifier, password) {
  const session = await sessionGet(accountType, identifier);

  if (!session) {
    throw new Error(
      "You're offline and no saved session was found for this account.\n" +
      'Please connect to the internet to log in for the first time.'
    );
  }

  // Verify password against stored hash
  const match = await bcrypt.compare(password, session.pwHash);
  if (!match) {
    throw new Error('Incorrect password.');
  }

  // Return the cached session data
  return {
    token:   session.token,
    user:    session.user,
    _source: 'offline',
    _offline: true,
  };
}
