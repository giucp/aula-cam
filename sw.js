// sw.js — Service Worker de Aula CAM
// Objetivo: que la app sea instalable (PWA) y abra rápido/offline el cascarón,
// SIN cachear nunca las APIs (/api/*), que deben ir siempre a la red (datos en vivo).
// Subir V cuando cambie el cascarón para forzar la actualización a todos.
//
// ★★ POR QUÉ app.js Y estilos.css VAN CON `?v=` — NO QUITARLO (roto en prod 2026-07-16) ★★
// El index.html se sirve NETWORK-FIRST (siempre fresco) pero los assets van CACHE-FIRST.
// Sin el `?v=`, la 1ª apertura tras un deploy mezclaba **index.html NUEVO + app.js VIEJO**
// (del caché de la versión anterior). Si el index nuevo borró un elemento que el app.js viejo
// toca sin guarda (fue `$("#btnHomeVerAgenda").onclick`), eso es un TypeError que MATA el
// script entero: la app no abría desde el ícono, en todos los teléfonos ya instalados.
// Con el `?v=`, el SW VIEJO busca "/app.js?v=NN" en su caché, NO lo encuentra, y cae a la red
// → recibe el app.js nuevo → el par index+app.js SIEMPRE viaja junto, ya en la 1ª apertura.
// Los `?v=` de index.html y este V tienen que subir JUNTOS.
const V = "123";
const VERSION = `aulacam-v${V}`; // v117: "Siguiente paso" al terminar cada actividad
const SHELL = [
  "/",
  "/index.html",
  `/app.js?v=${V}`,
  `/estilos.css?v=${V}`,
  "/un-dia-como-hoy.json",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/favicon-32.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    // SIN skipWaiting() ni clients.claim() (regla 6.5 del plan; ya corregido en familia-sw.js):
    // tomaban el control de la pagina abierta a mitad de un fetch y lo mataban en cada deploy.
    // No hacen falta: el index es network-first y app.js/estilos.css van con ?v= apareado, asi
    // que el codigo nuevo llega aunque el SW viejo siga activo hasta que se cierre la app.
    caches.open(VERSION).then((c) => c.addAll(SHELL))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      // SOLO limpiar cachés propios ("aulacam-*"): el panel de familia tiene su propio SW
      // y caché ("familia-*") en el mismo origen — no tocarlo.
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("aulacam-") && k !== VERSION).map((k) => caches.delete(k))))
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                 // POST /api no se cachea
  const url = new URL(req.url);
  if (url.pathname.startsWith("/api/")) return;      // API: siempre a la red
  if (url.pathname.startsWith("/familia")) return;   // panel del padre: app aparte, el SW del niño no la toca

  // HTML (navegación): red primero (para recibir cambios), cache de respaldo offline.
  // Solo el MISMO origen: nunca tocar el iframe cross-origin del juego (no cachearlo como index).
  if (req.mode === "navigate" && url.origin === self.location.origin) {
    e.respondWith(
      fetch(req)
        .then((r) => {
          const copia = r.clone();
          caches.open(VERSION).then((c) => c.put("/index.html", copia));
          return r;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Assets propios (iconos, manifest): cache primero, si no, red.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});
