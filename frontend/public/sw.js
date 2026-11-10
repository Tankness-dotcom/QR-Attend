/* ═══════════════════════════════════════════════════════
   QR-Attend Service Worker  v2 — Offline-first
   ───────────────────────────────────────────────────────
   Strategy:
   • App shell (HTML/JS/CSS/icons) → Cache-first
   • API GETs                      → Network-first, IndexedDB fallback
                                      (IndexedDB fallback handled in app code)
   • API POSTs                     → Network only
                                      (offline POSTs queued in app code)
════════════════════════════════════════════════════════ */

const CACHE_NAME  = 'qrattend-v2';
const API_PREFIX  = '/api/';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/qrattend-logo.png',
  '/apple-touch-icon.png',
  '/favicon-32x32.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/* ── Install: pre-cache app shell ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean up old caches ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── Fetch ── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-http(s) and cross-origin
  if (!url.protocol.startsWith('http')) return;
  if (url.origin !== self.location.origin) return;

  const isAPI    = url.pathname.startsWith(API_PREFIX);
  const isStatic = url.pathname.startsWith('/static/');
  const isGET    = request.method === 'GET';

  /* ── 1. Non-GET API calls (POST/DELETE/PUT) → network only ── */
  if (isAPI && !isGET) {
    event.respondWith(fetch(request));
    return;
  }

  /* ── 2. Static JS/CSS bundles → cache-first ── */
  if (isStatic) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          if (res.ok) caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
          return res;
        });
      })
    );
    return;
  }

  /* ── 3. API GETs → network first; on failure return offline JSON ── */
  if (isAPI && isGET) {
    event.respondWith(
      fetch(request)
        .then(res => {
          // Let the app's IndexedDB layer handle caching
          return res;
        })
        .catch(() => {
          // Service worker level fallback — the app's offlineApi.js handles
          // reading from IndexedDB, so we just need to let the fetch fail so
          // offlineGet() catches it
          return new Response(
            JSON.stringify({ error: 'offline', _sw: true }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  /* ── 4. Everything else (HTML nav) → network first, fall back to cached /index.html ── */
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          caches.open(CACHE_NAME).then(c => c.put(request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(request).then(cached =>
          cached || caches.match('/index.html')
        )
      )
  );
});

/* ── Background sync (fires when connectivity is restored) ── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-attendance') {
    // Notify all open clients to trigger the sync queue
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
      })
    );
  }
});

/* ── Push notifications ── */
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
