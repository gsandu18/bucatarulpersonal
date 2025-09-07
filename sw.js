// /sw.js
const CACHE = "bp-v1";
const ASSETS = [
  "/bucatarulpersonal/",
  "/bucatarulpersonal/index.html",
  "/bucatarulpersonal/manifest.webmanifest",
  "/bucatarulpersonal/img/icon-192.png",
  "/bucatarulpersonal/img/icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const { request } = e;
  e.respondWith(
    caches.match(request).then(res =>
      res ||
      fetch(request).then(net => {
        // cache-on-the-fly (doar GET)
        if (request.method === "GET") {
          const copy = net.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return net;
      }).catch(() => caches.match("/bucatarulpersonal/index.html"))
    )
  );
});
