const CACHE = 'atlas-v7';
const ASSETS = [
  './',
  './index.html',
  './systems_static.json',
  './sde_data.json',
  './mission_hubs.json',
  './types_names.json',
  './station_names.json',
  './agent_types.json',
  './agent_divisions.json',
  './missions_data.json',
  './lp_offers_cache.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
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
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});