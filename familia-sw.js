// familia-sw.js — Service Worker del PANEL DE FAMILIA (padres). Scope "/familia".
// ESTRATEGIA: network-first para el cascarón. Antes era cache-first (SWR) y servía código
// VIEJO cacheado (los arreglos no llegaban al usuario hasta 2 aperturas después). Ahora:
// si hay red, SIEMPRE la última versión; la caché es solo respaldo OFFLINE. El cascarón es
// chico y las fuentes no bloquean, así que abrir sigue siendo rápido. /api/* nunca se cachea.
const VERSION = "familia-v3";
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
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // API de aula-cam / fuentes: las maneja el navegador
  if (url.pathname.startsWith("/api/")) return;       // API: siempre red
  const esNav = req.mode === "navigate";
  if (!esNav && !SHELL.includes(url.pathname)) return; // otros assets: navegador
  const key = esNav ? "/familia.html" : url.pathname;
  // network-first: red primero, caché de respaldo si no hay red.
  e.respondWith(
    fetch(req).then((r) => {
      if (r && r.ok) { const copia = r.clone(); caches.open(VERSION).then((c) => c.put(key, copia)); }
      return r;
    }).catch(() => caches.match(key))
  );
});
