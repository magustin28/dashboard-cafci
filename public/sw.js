// public/sw.js — service worker del dashboard (PWA, escrito a mano, sin dependencias).
//
// QUÉ HACE
//   Cachea el "app shell" (HTML + CSS + JS + íconos del build) para que la app abra al instante y
//   pueda abrirse sin red. El precache lo inyecta scripts/pwa-precache.mjs después de `vite build`:
//   reemplaza los valores de PRECACHE/CACHE de acá abajo. Si el script no corriera, quedan los
//   defaults (sólo el HTML) y el SW igual funciona: la PWA es una mejora, no un requisito.
//
// QUÉ NO HACE (a propósito)
//   - No cachea /api/*: los datos son intradiarios y una respuesta guardada se vería como actual
//     (el semáforo del header se basa en la fecha del payload). El snapshot lo maneja la app con su
//     propia caché de sesión, que sí sabe de qué fecha es.
//   - No cachea recursos de otro origen (las fuentes de Google): sin red se cae al font-family de
//     sistema, que ya está declarado en base.css.
//   - No usa Background Sync: las escrituras (suscripciones, rescates, favoritos) van a Supabase por
//     el SDK, con su token y en transacciones de varios pasos. Encolarlas acá las partiría y podría
//     dejar datos a medias; si alguna vez hace falta, el reintento va en la app, no en el SW.
//
// ESTRATEGIAS
//   - Navegación (incluye ?fecha=…): red primero. Si no hay red, el index.html cacheado; así la app
//     abre y muestra su propio error de API en vez de la pantalla de "sin conexión" del navegador.
//   - Assets del build (llevan hash en el nombre) e íconos: caché primero, porque un archivo con hash
//     nunca cambia de contenido.

const PRECACHE = /* __PRECACHE__ */ ["./index.html"];
const CACHE = /* __CACHE__ */ "cafci-dev";

// El SW vive en la raíz del scope (/dashboard-cafci/sw.js), así que el prefijo de la app se deriva
// de su propia URL: no hay que hardcodear el base de Vite acá.
const BASE = self.location.pathname.replace(/sw\.js$/, "");
const INDEX = new URL("index.html", self.location.origin + BASE).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new URL(p, self.location.origin + BASE).href)))
      .then(() => self.skipWaiting()), // no esperar a que se cierren las pestañas para activar
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()), // controlar también las pestañas ya abiertas
  );
});

// Navegación: red primero, caché como red de seguridad.
async function navegacion(request) {
  try {
    const res = await fetch(request);
    if (res.ok) return res;
    return (await caches.match(INDEX)) || res; // 404/500 de Pages: mejor el shell que el error
  } catch {
    return (await caches.match(INDEX)) || Response.error();
  }
}

// Assets propios: caché primero (tienen hash) y si no está, red.
async function asset(request) {
  const hit = await caches.match(request);
  return hit || fetch(request);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return; // POST/PATCH/DELETE (Supabase): derecho a la red

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API y fuentes de Google: sin tocar

  event.respondWith(request.mode === "navigate" ? navegacion(request) : asset(request));
});
