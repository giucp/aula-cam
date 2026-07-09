// familia-sw.js — Service Worker del PANEL DE FAMILIA (padres). Registrado con scope
// "/familia" (NO pisa el sw.js del aula del niño, que vive en scope "/" y además ignora
// /familia*). Estrategia igual a la del aula: cascarón stale-while-revalidate (abre
// INSTANTÁNEO desde caché aunque la red esté lenta, y se actualiza en segundo plano);
// las APIs (/api/*) SIEMPRE van a la red (datos en vivo, nunca se cachean).
const VERSION = "familia-v1";
const SHELL = ["/familia.html", "/familia.js", "/jsQR.js"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k.startsWith("familia-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                       // POST /api/familia: siempre red
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;         // fuentes de Google etc.: que decida el navegador
  if (url.pathname.startsWith("/api/")) return;            // API: siempre a la red

  // Navegación (abrir la página): caché al instante + revalidar en segundo plano.
  if (req.mode === "navigate") {
    e.respondWith(
      caches.match("/familia.html").then((cached) => {
        const fresco = fetch(req).then((r) => {
          if (r && r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put("/familia.html", copia)); }
          return r;
        }).catch(() => cached);
        return cached || fresco;
      })
    );
    return;
  }
  // Assets del panel (familia.js, jsQR.js): mismo trato.
  if (SHELL.includes(url.pathname)) {
    e.respondWith(
      caches.match(url.pathname).then((cached) => {
        const fresco = fetch(req).then((r) => {
          if (r && r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(url.pathname, copia)); }
          return r;
        }).catch(() => cached);
        return cached || fresco;
      })
    );
  }
});
