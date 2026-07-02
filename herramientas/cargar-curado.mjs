// herramientas/cargar-curado.mjs — HERRAMIENTA LOCAL (no se despliega a Vercel)
// Sube bancos de contenido curado a la tabla contenido_curado de Supabase.
// Alternativa al endpoint api/cargar-curado.js: este corre local y necesita el
// service key en .env.local; el endpoint usa las llaves que ya están en Vercel.
//
// Uso:
//   node herramientas/cargar-curado.mjs                 → sube todos los curado/*.json
//   node herramientas/cargar-curado.mjs --solo=archivo  → sube solo ese banco
//
// Lee SUPABASE_URL y SUPABASE_SERVICE_KEY de .env.local. Valida con la MISMA lógica
// que el endpoint (curado-lib.mjs). Hace UPSERT por (materia_norm, tema_norm, modo,
// grado), así re-correrlo con un JSON corregido actualiza sin duplicar. Al terminar
// imprime la clave normalizada con la que quedó cada banco.
//
// Formato de cada curado/<archivo>.json (todas las claves de modo son OPCIONALES):
//   { "materia","tema","grado","fuentes":[], "resumen":{…}, "retos":[…], "quiz":[…], "examen":[…] }
// Tamaños recomendados: quiz y retos 12–16, examen 10, para que el muestreo dé variedad.

import fs from "node:fs";
import path from "node:path";
import { cargarEnvLocal } from "./env.mjs";
import { filasDeBanco } from "./curado-lib.mjs";

cargarEnvLocal();

const DIR = path.resolve(process.cwd(), "curado");

function cfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env.local");
    console.error("  (o subí por el endpoint: POST /api/cargar-curado con el secret)");
    process.exit(1);
  }
  return { url: url.replace(/\/+$/, ""), key };
}

async function upsert(c, fila) {
  const r = await fetch(`${c.url}/rest/v1/contenido_curado`, {
    method: "POST",
    headers: {
      apikey: c.key, Authorization: `Bearer ${c.key}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(fila),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
}

// Lee y valida un archivo; devuelve lo que produce filasDeBanco (o lanza).
function leerBanco(nombre) {
  const p = path.isAbsolute(nombre) || nombre.includes(path.sep) ? path.resolve(nombre) : path.join(DIR, nombre);
  let doc;
  try { doc = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { throw new Error(`no se pudo leer/parsear: ${e.message}`); }
  return filasDeBanco(doc, new Date().toISOString());
}

async function main() {
  const c = cfg();
  const soloArg = process.argv.find((a) => a.startsWith("--solo="));
  let archivos;
  if (soloArg) {
    archivos = [soloArg.slice("--solo=".length)];
  } else {
    if (!fs.existsSync(DIR)) { console.error(`✖ No existe la carpeta ${DIR}`); process.exit(1); }
    archivos = fs.readdirSync(DIR).filter((f) => f.toLowerCase().endsWith(".json")).sort();
  }
  if (!archivos.length) { console.log("No hay .json para subir en curado/."); return; }

  let subidas = 0, saltados = 0;
  for (const arch of archivos) {
    const base = path.basename(arch);
    let info;
    try { info = leerBanco(arch); }
    catch (e) { console.error(`✖ ${base}: ${e.message} — se salta`); saltados++; continue; }

    for (const av of info.avisos) console.warn(`  ⚠ ${base}: ${av}`);
    let ok = 0;
    for (const fila of info.filas) {
      try { await upsert(c, fila); subidas++; ok++; }
      catch (e) { console.error(`  ✖ ${base} [${fila.modo}]: ${e.message}`); }
    }
    if (ok) console.log(`✔ ${base}: ${ok} modo(s) [${info.filas.map((f) => f.modo).join(",")}] → clave "${info.materia_norm} | ${info.tema_norm} | ${info.grado}"`);
  }
  console.log(`\nListo: ${subidas} fila(s) subida(s)${saltados ? `, ${saltados} archivo(s) saltado(s)` : ""}.`);
}

main().catch((e) => { console.error("Error fatal:", e.message || e); process.exit(1); });
