/**
 * offline/offlineApi.js
 *
 * Drop-in replacements for the network API calls in api.js.
 * - GET calls: try network first, fall back to IndexedDB cache.
 * - scanQR:    try network first; if offline, queue the scan locally
 *              and return a fake "success" so the UI moves on.
 */

import { cacheGet, cacheSet, queueAdd } from './db';

const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getToken()}`,
  };
}

/** Fetch with a short timeout so we detect "offline" quickly */
async function fetchWithTimeout(url, options, ms = 8000) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(tid);
  }
}

/**
 * Offline-aware GET.
 * On success → cache the response.
 * On failure (offline / timeout) → serve from IndexedDB cache.
 */
export async function offlineGet(path) {
  const url = `${BASE}${path}`;
  try {
    const res = await fetchWithTimeout(url, { headers: authHeaders() });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    await cacheSet(path, data);       // update cache with fresh data
    return data;
  } catch {
    // Network unavailable — serve stale cache
    const cached = await cacheGet(path);
    if (cached !== null) return cached;
    throw new Error('No internet connection and no cached data available.');
  }
}

/**
 * Offline-aware QR scan.
 * Online  → POST to server as normal.
 * Offline → save to sync queue, return a local success response so the
 *           teacher knows the scan was recorded and will sync later.
 */
export async function offlineScanQR(qr_token, class_id) {
  // Try network first
  try {
    const res = await fetchWithTimeout(`${BASE}/attendance/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_token, class_id }),
    });
    const data = await res.json();
    return { ...data, _source: 'online' };
  } catch {
    // Offline path — look up student name from cache
    let studentName  = 'Student';
    let studentId    = '';

    try {
      // Try to find the student in any cached class list
      const allStudents = await cacheGet('/students');
      if (allStudents) {
        const found = allStudents.find(s => s.qr_token === qr_token);
        if (found) { studentName = found.name; studentId = found.student_id; }
      }
    } catch {}

    // Queue for later sync
    await queueAdd({
      url:         '/attendance/scan',
      method:      'POST',
      body:        { qr_token, class_id },
      description: `Scan: ${studentName} (class ${class_id})`,
      created_at:  Date.now(),
    });

    return {
      success:      true,
      alreadyMarked: false,
      offline:      true,
      _source:      'offline',
      message:      `📵 ${studentName} — saved offline, will sync when connected`,
      student:      { name: studentName, student_id: studentId },
      scanned_at:   new Date().toLocaleTimeString('en-PH', {
        hour: 'numeric', minute: '2-digit', second: '2-digit',
        hour12: true, timeZone: 'Asia/Manila',
      }),
    };
  }
}

/**
 * Pre-warm the cache for a given class so offline works immediately.
 * Call this when a teacher selects a class while online.
 */
export async function prewarmClassCache(class_id) {
  try {
    // Cache students for QR token lookup
    const studentsPath = `/students?class_id=${class_id}`;
    const res = await fetchWithTimeout(`${BASE}${studentsPath}`, { headers: authHeaders() });
    if (res.ok) {
      const data = await res.json();
      await cacheSet(studentsPath, data);
      // Also store a flat list of all students (for QR token lookup)
      const existing = await cacheGet('/students') || [];
      const merged = [...existing.filter(s => s.class_id !== Number(class_id)), ...data];
      await cacheSet('/students', merged);
    }
  } catch {}

  // Cache attendance data
  for (const path of [
    `/attendance/today?class_id=${class_id}`,
    `/attendance/summary?class_id=${class_id}`,
    `/attendance/dates?class_id=${class_id}`,
  ]) {
    try {
      const res = await fetchWithTimeout(`${BASE}${path}`, { headers: authHeaders() });
      if (res.ok) await cacheSet(path, await res.json());
    } catch {}
  }
}
