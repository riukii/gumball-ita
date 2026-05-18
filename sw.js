// Service Worker per PWA - cache minimale
const CACHE_NAME = 'gumball-v1';

// Risorse da cachare per funzionare offline
const PRECACHE_URLS = [
    './',
'./index.html',
'./episodes.json',
'./Gumball.png',
'./Gumball2.png',
'./manifest.json'
];

// Install: precache risorse essenziali
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(PRECACHE_URLS);
        })
    );
    self.skipWaiting();
});

// Activate: pulisci vecchie cache
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first, fallback a cache
self.addEventListener('fetch', (event) => {
    // Skip non-GET e richieste cross-origin (vixsrc, proxy, ecc.)
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
        .then((response) => {
            // Cache la risposta aggiornata
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, clone);
            });
            return response;
        })
        .catch(() => {
            // Fallback alla cache se offline
            return caches.match(event.request);
        })
    );
});
