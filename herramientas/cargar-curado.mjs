// herramientas/cargar-curado.mjs — HERRAMIENTA LOCAL (no se despliega a Vercel)
// Sube bancos de contenido curado a la tabla contenido_curado de Supabase.
//
// Uso:
//   node herramientas/cargar-curado.mjs                 → sube todos los curado/*.json
//   node herramientas/cargar-curado.mjs --solo=archivo  → sube solo ese banco
//
// Lee SUPABASE_URL y SUPABASE_SERVICE_KEY de .env.local. Hace UPSERT por
// (materia_norm, tema_norm, modo, grado) con Prefer: resolution=merge-duplicates,
// así re-correrlo con un JSON corregido actualiza sin duplicar.
//
// Formato de cada curado/<archivo>.json (todas las claves de modo son OPCIONALES;
// se sube una fila por cada modo presente):
//   {
//     "materia": "Matemática", "tema": "Fracciones equivalentes", "grado": "5to grado",
//     "fuentes": ["Guía de fracciones - 2do lapso.pdf"],
//     "resumen": { "titulo","intro","secciones":[{titulo,explicacion,pasos[],ejemplo}],"idea_clave" },
//     "retos":  [ { "enunciado","pista","solucion","figura":"" } ],          // 12–15 recomendado
//     "quiz":   [ { "pregunta","opciones":["..."],"correcta":0,"explicacion","figura":"" } ], // 12–15
//     "examen": [ { "pregunta","respuesta","explicacion" } ]                 // 10 recomendado
//   }
// Tamaños recomendados (para que el muestreo dé variedad real): quiz y retos 12–15,
// examen 10.

import fs from "node:fs";
import path from "node:path";
import { cargarEnvLocal } from "./env.mjs";
import { normCurado } from "./normcurado.mjs";

cargarEnvLocal();

const DIR = path.resolve(process.cwd(), "curado");
const GRADOS_CONOCIDOS = new Set(["5to grado", "1er año"]);

function cfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env.local");
    process.exit(1);
  }
  return { url: url.replace(/\/+$/, ""), key };
}

const esStr = (s) => typeof s === "string" && s.trim().length > 0;

// Valida un modo del banco. Devuelve { ok:true, contenido } o { ok:false, motivo }.
function validarModo(modo, valor) {
  if (modo === "resumen") {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { ok: false, motivo: "resumen debe ser un objeto" };
    if (!esStr(valor.titulo)) return { ok: false, motivo: "resumen sin 'titulo'" };
    if (!Array.isArray(valor.secciones) || valor.secciones.length < 2) return { ok: false, motivo: "resumen con menos de 2 secciones" };
    for (const [i, s] of valor.secciones.entries()) {
      if (!s || !esStr(s.titulo) || !esStr(s.explicacion)) return { ok: false, motivo: `sección ${i + 1} sin titulo/explicacion` };
    }
    return { ok: true, contenido: valor }; // documento completo
  }
  if (!Array.isArray(valor) || !valor.length) return { ok: false, motivo: `${modo} debe ser un arreglo no vacío` };
  if (modo === "retos") {
    for (const [i, e] of valor.entries()) {
      if (!e || !esStr(e.enunciado)) return { ok: false, motivo: `reto ${i + 1} sin 'enunciado'` };
      if (!esStr(e.solucion)) return { ok: false, motivo: `reto ${i + 1} sin 'solucion'` };
    }
  } else if (modo === "examen") {
    for (const [i, p] of valor.entries()) {
      if (!p || !esStr(p.pregunta)) return { ok: false, motivo: `examen ${i + 1} sin 'pregunta'` };
      if (!esStr(p.respuesta)) return { ok: false, motivo: `examen ${i + 1} sin 'respuesta'` };
    }
  } else if (modo === "quiz") {
    for (const [i, p] of valor.entries()) {
      if (!p || !esStr(p.pregunta)) return { ok: false, motivo: `quiz ${i + 1} sin 'pregunta'` };
      if (!Array.isArray(p.opciones) || p.opciones.length < 2) return { ok: false, motivo: `quiz ${i + 1} con menos de 2 opciones` };
      if (!Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta >= p.opciones.length) return { ok: false, motivo: `quiz ${i + 1}: 'correcta' fuera de rango` };
    }
  }
  return { ok: true, contenido: { items: valor } }; // demás: { items: [...] }
}

// Filas a subir desde un archivo. Devuelve { filas:[], avisos:[] } o lanza si el banco es inválido.
function filasDeArchivo(nombre) {
  const p = path.isAbsolute(nombre) || nombre.includes(path.sep) ? path.resolve(nombre) : path.join(DIR, nombre);
  const raw = fs.readFileSync(p, "utf8");
  let doc;
  try { doc = JSON.parse(raw); } catch (e) { throw new Error(`JSON inválido: ${e.message}`); }
  if (!esStr(doc.materia)) throw new Error("falta 'materia'");
  if (!esStr(doc.tema)) throw new Error("falta 'tema'");
  if (!esStr(doc.grado)) throw new Error("falta 'grado'");

  const avisos = [];
  if (!GRADOS_CONOCIDOS.has(doc.grado)) {
    avisos.push(`grado "${doc.grado}" no es de los activos (${[...GRADOS_CONOCIDOS].join(" / ")}) — se sube igual`);
  }
  const materia_norm = normCurado(doc.materia);
  const tema_norm = normCurado(doc.tema);
  const fuentes = Array.isArray(doc.fuentes) ? doc.fuentes.filter(esStr) : null;
  const ahora = new Date().toISOString();

  const filas = [];
  let algun = false;
  for (const modo of ["resumen", "retos", "quiz", "examen"]) {
    if (!(modo in doc) || doc[modo] == null) continue;
    algun = true;
    const v = validarModo(modo, doc[modo]);
    if (!v.ok) { avisos.push(`modo ${modo} omitido: ${v.motivo}`); continue; }
    filas.push({
      materia_norm, tema_norm, modo, grado: doc.grado,
      contenido: v.contenido,
      fuentes: fuentes && fuentes.length ? fuentes : null,
      actualizado: ahora,
    });
  }
  if (!algun) throw new Error("no trae ningún modo (resumen/retos/quiz/examen)");
  return { filas, avisos, materia_norm, tema_norm };
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
    try { info = filasDeArchivo(arch); }
    catch (e) { console.error(`✖ ${base}: ${e.message} — se salta`); saltados++; continue; }

    for (const av of info.avisos) console.warn(`  ⚠ ${base}: ${av}`);
    let okArch = 0;
    for (const fila of info.filas) {
      try { await upsert(c, fila); subidas++; okArch++; }
      catch (e) { console.error(`  ✖ ${base} [${fila.modo}]: ${e.message}`); }
    }
    if (okArch) {
      console.log(`✔ ${base}: ${okArch} modo(s) → clave "${info.materia_norm} | ${info.tema_norm} | ${info.filas.map((f) => f.modo).join(",")} | ${info.filas[0].grado}"`);
    }
  }
  console.log(`\nListo: ${subidas} fila(s) subida(s)${saltados ? `, ${saltados} archivo(s) saltado(s)` : ""}.`);
}

main().catch((e) => { console.error("Error fatal:", e.message || e); process.exit(1); });
