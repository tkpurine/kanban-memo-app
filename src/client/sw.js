const CACHE_NAME = 'kanban-memo-v3';
const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/js/app.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/sortablejs@1.15.6/Sortable.min.js'
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for all requests (fall back to cache when offline)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API requests: always go to network, no cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Static assets: network-first, fall back to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
