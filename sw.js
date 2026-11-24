/* LingOrm Music Archive - Service Worker
 * Purpose: cache the app shell, and cache mp3 files as they are played,
 * so background playback does not have to re-fetch from GitHub Pages
 * every time the screen locks.
 *
 * IMPORTANT: audio uses Range requests for seeking / streaming.
 * A Range request must NEVER be served from, or stored in, the cache.
 * Those requests are passed straight through to the network.
 */

const CACHE_NAME = 'lingorm-music-v1';
const CORE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './1127.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_FILES))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests from this site.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  // Range requests (audio seeking / streaming): always go to network.
  // Caching a 206 partial response would break playback.
  if (request.headers.has('range')) {
    event.respondWith(fetch(request));
    return;
  }

  const isAudio =
    request.destination === 'audio' ||
    request.url.toLowerCase().endsWith('.mp3');

  if (isAudio) {
    // Audio: serve from cache if already played before,
    // otherwise fetch from network and store the full (200) response.
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, copy).catch(() => {});
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // App shell / images: cache-first, fall back to network.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy).catch(() => {});
          });
        }
        return response;
      });
    })
  );
});
