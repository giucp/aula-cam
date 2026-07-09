// sw.js — Service Worker de Aula CAM
// Objetivo: que la app sea instalable (PWA) y abra rápido/offline el cascarón,
// SIN cachear nunca las APIs (/api/*), que deben ir siempre a la red (datos en vivo).
// Subir VERSION cuando cambie el cascarón para forzar la actualización a todos.
const VERSION = "aulacam-v56"; // v56: activate solo limpia caches aulacam-* (no pisar el cache familia-* del panel de padres)
const SHELL = [
  "/",
  "/index.html",
  "/app.js",
  "/estilos.css",
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
    caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      // SOLO limpiar cachés propios ("aulacam-*"): el panel de familia tiene su propio SW
      // y caché ("familia-*") en el mismo origen — no tocarlo.
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("aulacam-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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
