// Impact Hub Egypt - Resilient Service Worker (v2.1)
const CACHE_NAME = 'impact-hub-v2.1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/parent-app.html',
  '/teacher-app.html',
  '/nursery-admin.html',
  '/super-admin.html',
  '/colors.css',
  '/typography.css',
  '/notifications.css',
  '/notifications.js',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/apple-touch-icon.png',
  '/pwa-512x512.png'
];

// Install: Cache critical shell assets safely
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Non-fatal precache notice:', err);
      });
    }).catch(() => {})
  );
});

// Activate: Immediately purge all old versions of cache
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()).catch(() => {})
  );
});

// Fetch: Network-First with safe offline cache fallback
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Only handle same-origin requests; leave CDNs, Firebase, Daily.co to native browser networking
  try {
    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin) {
      return;
    }

    // Bypass API routes
    if (requestUrl.pathname.startsWith('/api/')) {
      return;
    }
  } catch (e) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, responseToCache))
            .catch(() => {});
        }
        return networkResponse;
      })
      .catch(async () => {
        // Network failed (Offline mode) -> retrieve from cache
        try {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // If navigation, fallback to index
          if (event.request.mode === 'navigate') {
            const indexFallback = await caches.match('/index.html');
            if (indexFallback) return indexFallback;
          }
        } catch (e) {
          // ignore cache read errors
        }

        // Return a valid Response object (NEVER return undefined)
        return new Response('Offline - No connection', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      })
  );
});
