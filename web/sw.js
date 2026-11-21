/**
 * Server-Monitor PWA Service Worker
 * - HTML & API: Network-First with cache fallback
 * - Static assets (CSS/JS/Icons): Stale-While-Revalidate
 */

const CACHE_VERSION = 'v1.0.0';
const SHELL_CACHE = `sm-shell-${CACHE_VERSION}`;
const API_CACHE = `sm-api-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/server',
  '/agents',
  '/settings',
  '/css/themes.css?v=1',
  '/css/app.css?v=1',
  '/manifest.webmanifest',
  '/icons/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      for (const url of PRECACHE_URLS) {
        try {
          await cache.add(url);
        } catch {
          // Ignore individual precache error
        }
      }
    })
  );
});

self.addEventListener('activate', (event) => {
  const allowed = new Set([SHELL_CACHE, API_CACHE]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (!allowed.has(k) ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 1. API: Network-First
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(API_CACHE);
        try {
          const netResp = await fetch(request);
          if (netResp && netResp.ok) {
            cache.put(request, netResp.clone());
          }
          return netResp;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ online: false, containers: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })()
    );
    return;
  }

  // 2. HTML Navigation: Network-First
  if (
    request.mode === 'navigate' ||
    ['/', '/server', '/agents', '/settings'].includes(url.pathname)
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        try {
          const netResp = await fetch(request);
          if (netResp && netResp.ok) {
            cache.put(request, netResp.clone());
          }
          return netResp;
        } catch {
          return (await cache.match(request)) || (await cache.match('/')) || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // 3. Static Assets: Stale-While-Revalidate
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);
      const netPromise = fetch(request)
        .then((resp) => {
          if (resp && resp.ok) cache.put(request, resp.clone());
          return resp;
        })
        .catch(() => null);
      return cached || (await netPromise) || new Response('', { status: 504 });
    })()
  );
});
