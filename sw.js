// Service Worker de Mi Planning.
//
// Estrategia deliberada, pensada para que las actualizaciones se vean siempre
// que haya conexión, y la app siga funcionando (con la última versión que se
// pudo cargar) si no la hay:
//
//   - Documento HTML (la app en sí): red primero. Si hay conexión, el usuario
//     SIEMPRE ve el código más reciente al recargar — nunca se queda atascado
//     viendo una versión vieja por culpa de la caché. Si no hay conexión, se
//     sirve la última copia buena que se guardó en caché.
//   - Assets estáticos (iconos, manifest): caché primero, con la red como
//     respaldo. Cambian poco, así que priorizar velocidad es correcto aquí.
//
// El Service Worker SOLO intercepta peticiones de red (fetch). Nunca toca
// localStorage, que es donde vive de verdad el estado de la app — no hay
// ninguna vía por la que este archivo pueda borrar o corromper datos.
//
// Para forzar que los navegadores recojan cambios en este propio archivo,
// sube CACHE_VERSION cada vez que cambies la estrategia de caché.
const CACHE_VERSION = 1;
const CACHE_NAME = `mi-planning-v${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;

  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  try {
    const fresh = await fetch(req);
    const cache = await caches.open(CACHE_NAME);
    cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const fallback = await caches.match("./index.html");
    if (fallback) return fallback;
    throw err;
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const fresh = await fetch(req);
  const cache = await caches.open(CACHE_NAME);
  cache.put(req, fresh.clone());
  return fresh;
}
