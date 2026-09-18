/* Molecular CAD service worker: offline app shell.
   Strategy: precache the entry and the RDKit engine on install; cache-first for same-origin GET
   requests with a network fallback (hashed Vite assets are immutable, so cache-first is safe).
   Bump CACHE when the caching strategy changes; asset hashes change on every build anyway. */
const CACHE = "molecular-cad-v1";
const PRECACHE = ["./", "./index.html", "./manifest.webmanifest", "./rdkit/RDKit_minimal.js", "./rdkit/RDKit_minimal.wasm"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
