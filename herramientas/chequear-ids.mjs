// herramientas/chequear-ids.mjs — ¿todo elemento que app.js toca existe en el HTML?
//
//   node herramientas/chequear-ids.mjs
//
// Por qué: app.js hace `$("#algo").onclick = ...` y `.classList...` sin comprobar que el elemento
// exista (más de 170 veces). Si uno falta, ese TypeError MATA el script entero: la app no abre.
// Ya pasó dos veces: el demo estuvo muerto 6 semanas (2026-07/09) porque le faltaban #tabCumbre y
// #btnIA, y en julio un index nuevo + app.js viejo dejó la app sin abrir en todos los teléfonos.
// Correr esto antes de cada deploy que toque index.html, app.js o el demo. Sale con código 1 si
// algún id usado SIN guarda falta en index.html.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const leer = (f) => fs.readFileSync(path.join(RAIZ, f), "utf8");
const app = leer("app.js");

// ids en el HTML (estáticos)
const idsDe = (html) => new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
// ids que app.js crea dinámicamente (innerHTML / createElement con id) también cuentan como existentes
const dinamicos = new Set([...app.matchAll(/\bid=\\?"([A-Za-z][\w-]*)\\?"/g)].map((m) => m[1]));

// usos de $("#id"): con guarda (`$("#x") &&`, `if(!$("#x"))`, `const x=$("#x"); if(x)`) no rompen
const usos = new Map();   // id -> { sinGuarda: n, total: n }
for (const m of app.matchAll(/\$\("#([\w-]+)"\)(\s*(&&|\?\.|\)\s*\{|\)\s*return))?/g)) {
  const id = m[1];
  const u = usos.get(id) || { sinGuarda: 0, total: 0 };
  u.total++;
  const directo = /^\$\("#[\w-]+"\)\s*\.(onclick|classList|innerHTML|textContent|value|disabled|style|appendChild|addEventListener|querySelector|scrollIntoView|setAttribute|focus|checked|src|dataset|onsubmit|oninput|onchange)/.test(
    app.slice(m.index, m.index + m[0].length + 40));
  // `$("#x") && $("#x").algo` y `($("#x") && ($("#x").algo...))` estan protegidos por el && de antes
  const antes = app.slice(Math.max(0, m.index - 40), m.index);
  const protegido = antes.replace(/\s+/g, "").endsWith(`$("#${id}")&&`) || antes.replace(/\s+/g, "").endsWith(`$("#${id}")&&(`);
  if (directo && !protegido) u.sinGuarda++;
  usos.set(id, u);
}

let fallo = false;
for (const [archivo, obligatorio] of [["index.html", true], ["demo-inicio.html", false]]) {
  let html; try { html = leer(archivo); } catch { continue; }
  const ids = idsDe(html);
  const faltan = [...usos].filter(([id, u]) => u.sinGuarda > 0 && !ids.has(id) && !dinamicos.has(id));
  console.log(`\n${archivo}: ${ids.size} ids · app.js usa ${usos.size} distintos`);
  if (!faltan.length) console.log("  ✓ ningún id usado sin guarda falta");
  for (const [id, u] of faltan) console.log(`  ✗ #${id}  (${u.sinGuarda} uso(s) sin guarda → TypeError al cargar)`);
  if (faltan.length && obligatorio) fallo = true;
}
process.exit(fallo ? 1 : 0);
