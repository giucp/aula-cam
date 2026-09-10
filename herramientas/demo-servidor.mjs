// herramientas/demo-servidor.mjs — servidor estático mínimo para abrir demo-inicio.html
// (y el index real) sin backend. `node herramientas/demo-servidor.mjs` → http://localhost:4321
//
// Por qué existe: demo-inicio.html carga el app.js REAL. Abrirlo con file:// no sirve
// (rutas y fetch), y el pane del navegador necesita un http:// al que apuntar. Con esto,
// verificar el demo antes de dar una pantalla por buena (ESTETICA.md §B.9) es un comando.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url)).split(path.sep).join("/").replace(/\/herramientas$/, "");
const PUERTO = Number(process.env.PORT) || 4321;
const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".webp": "image/webp",
  ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json",
};

http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split("?")[0]);
  if (ruta === "/") ruta = "/demo-inicio.html";
  const f = path.join(ROOT, ruta).split(path.sep).join("/");
  // no salir de la raíz del repo
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("404");
  }
  // no-store SIEMPRE: un servidor de desarrollo que cachea hace perder horas verificando
  // una version vieja del archivo que acabas de editar (paso el 2026-09-10 con las efemerides).
  res.writeHead(200, {
    "Content-Type": MIME[path.extname(f).toLowerCase()] || "application/octet-stream",
    "Cache-Control": "no-store, must-revalidate",
  });
  fs.createReadStream(f).pipe(res);
}).listen(PUERTO, () => console.log(`demo en http://localhost:${PUERTO}  (raiz: ${ROOT})`));
