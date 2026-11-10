/**
 * offline/sync.js
 * Replays the sync queue when connectivity is restored.
 * Also provides the online/offline status hook.
 */

import { queueGetAll, queueDelete, cacheSet } from './db';

const BASE = '/api';

function getToken() {
  return localStorage.getItem('token');
}

/**
 * Replay all queued actions in order.
 * Removes each entry from the queue after a successful server response.
 * Returns { synced, failed } counts.
 */
export async function replayQueue(onProgress) {
  const queue = await queueGetAll();
  if (!queue.length) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(`${BASE}${item.url}`, {
        method:  item.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${getToken()}`,
        },
        body: item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok || res.status === 409) {
        // 409 = already marked (duplicate scan) — still counts as resolved
        await queueDelete(item.id);
        synced++;
        onProgress && onProgress({ synced, failed, total: queue.length, item });
      } else {
        failed++;
      }
    } catch {
      // Network still unavailable for this item
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Cache a successful GET response so it's available offline.
 * Key is the URL path + query string.
 */
export async function cacheResponse(urlPath, data) {
  try {
    await cacheSet(urlPath, data);
  } catch {
    // Non-fatal — cache write failures are silently ignored
  }
}
