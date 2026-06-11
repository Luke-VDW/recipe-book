/* ══════════════════════════════════════
   RECIPE BOOK PWA — Service Worker
   Caches app shell for offline use.
   ══════════════════════════════════════ */

const CACHE = 'recipebook-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/data.js',
  './js/recipes.js',
  './js/planner.js',
  './js/shopping.js',
  './js/spoonacular.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Network-first for Drive API calls; cache-first for app shell.
  if (e.request.url.includes('googleapis.com') || e.request.url.includes('spoonacular.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {headers:{'Content-Type':'application/json'}})));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
