/* ═══════════════════════════════════════════════
   QR-Attend Service Worker
   Caches the app shell for fast loads and offline
═══════════════════════════════════════════════ */

const CACHE_NAME  = 'qrattend-v1';
const API_PREFIX  = '/api/';

// App shell assets to cache on install
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/qrattend-logo.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/* ── Install: cache the shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Fetch strategy ──
   - API calls:        Network only (always fresh data)
   - JS/CSS bundles:   Cache first, then network (versioned filenames)
   - Everything else:  Network first, fall back to cache, then /index.html
*/
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and non-http(s)
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // API calls — always network, never cache
  if (url.pathname.startsWith(API_PREFIX)) {
    event.respondWith(fetch(request));
    return;
  }

  // Static JS/CSS bundles (have content hash in filename) — cache first
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // Everything else — network first, fall back to cache, then index.html (SPA)
  event.respondWith(
    fetch(request)
      .then(response => {
        // Cache successful responses for the shell
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match('/index.html')
        )
      )
  );
});

/* ── Push notifications (future use) ── */
self.addEventListener('push', event => {
  const data = event.data?.json() || { title: 'QR-Attend', body: 'New notification' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:  data.body,
      icon:  '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
    })
  );
});
