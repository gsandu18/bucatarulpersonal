const PATH_PREFIX = "/bucatarulpersonal";
const CACHE = "bp-v1";
const ASSETS = [
  `${PATH_PREFIX}/`,
  `${PATH_PREFIX}/index.html`,
  `${PATH_PREFIX}/manifest.webmanifest`
];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e=>{
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res=>{
      const copy = res.clone();
      caches.open(CACHE).then(cache=>cache.put(e.request, copy)).catch(()=>{});
      return res;
    }).catch(()=> caches.match(`${PATH_PREFIX}/index.html`)))
  );
});
