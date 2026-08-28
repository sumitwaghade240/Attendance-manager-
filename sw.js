const CACHE_NAME = 'attendease-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css?v=1.0.7',
    './app.js?v=1.0.7',
    './manifest.json',
    './icon.png',
    './icon-192.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
