// herramientas/moodle-leer.mjs — HERRAMIENTA LOCAL (no se despliega a Vercel)
// Lee el aula virtual de las cuentas de lectura para la fábrica de contenido curado.
// Reutiliza la lógica de api/moodle.js (login/token + moodle_mobile_app) y la de
// api/generar.js para bajar PDFs (resource con token; page → Google Drive).
//
// Secretos en .env.local: MOODLE_USER_A/PASS_A (cuenta "5to grado"), MOODLE_USER_B/
// PASS_B (cuenta "1er año"), SUPABASE_URL, SUPABASE_SERVICE_KEY.
//
// Comandos:
//   node herramientas/moodle-leer.mjs estado --cuenta=A [--grado="5to grado"]
//   node herramientas/moodle-leer.mjs bajar  --cuenta=A --materia="Matemática" --tema="Fracciones" [--grado="..."]
//
// NUNCA imprime contraseñas ni tokens.

import fs from "node:fs";
import path from "node:path";
import { cargarEnvLocal } from "./env.mjs";
import { normCurado } from "./normcurado.mjs";

cargarEnvLocal();

const BASE = "https://aulacam.uearzobispomendez.edu.ve";
const DL_TIMEOUT_MS = 12000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;

// ───────── args ─────────
function parseArgs() {
  const out = { _: [] };
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
    else if (a.startsWith("--")) out[a.slice(2)] = true;
    else out._.push(a);
  }
  return out;
}

// ───────── Moodle ─────────
async function getToken(username, password) {
  const body = new URLSearchParams({ username, password, service: "moodle_mobile_app" });
  const r = await fetch(`${BASE}/login/token.php`, { method: "POST", body });
  const data = await r.json();
  if (data.error) throw new Error(data.error);
  return data.token;
}
async function callWS(token, wsfunction, params = {}) {
  const body = new URLSearchParams({ wstoken: token, wsfunction, moodlewsrestformat: "json" });
  for (const [k, v] of Object.entries(params)) body.append(k, v);
  const r = await fetch(`${BASE}/webservice/rest/server.php`, { method: "POST", body });
  const data = await r.json();
  if (data && data.exception) throw new Error(`${wsfunction}: ${data.errorcode} — ${data.message}`);
  return data;
}
function stripHtml(s) {
  return String(s == null ? "" : s)
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}
const ORD_G = { 1: "1er grado", 2: "2do grado", 3: "3er grado", 4: "4to grado", 5: "5to grado", 6: "6to grado" };
const ORD_A = { 1: "1er año", 2: "2do año", 3: "3er año", 4: "4to año", 5: "5to año" };
function gradoDeCursos(courses) {
  for (const c of courses || []) {
    const m = String(c.shortname || c.fullname || "").match(/([1-6])\s*([GA])\b/i);
    if (m) { const n = +m[1], t = m[2].toUpperCase(); return (t === "A" ? ORD_A : ORD_G)[n] || null; }
  }
  return null;
}

// Carga materias con temas+módulos (misma forma que api/moodle.js).
async function entrar(cuenta) {
  const suf = String(cuenta || "A").toUpperCase();
  const user = process.env[`MOODLE_USER_${suf}`];
  const pass = process.env[`MOODLE_PASS_${suf}`];
  if (!user || !pass) throw new Error(`Faltan MOODLE_USER_${suf}/MOODLE_PASS_${suf} en .env.local`);
  const token = await getToken(user, pass);
  const info = await callWS(token, "core_webservice_get_site_info");
  const courses = await callWS(token, "core_enrol_get_users_courses", { userid: info.userid });
  const contenidos = await Promise.all(courses.map((c) => callWS(token, "core_course_get_contents", { courseid: c.id })));
  const materias = courses.map((c, i) => ({
    id: c.id, nombre: c.fullname, nombreCorto: c.shortname,
    temas: (contenidos[i] || []).map((s) => ({
      seccion: s.name, resumenHtml: s.summary || null,
      modulos: (s.modules || []).map((m) => {
        const archivos = (m.contents || []).filter((f) => f.type === "file");
        return {
          nombre: m.name, tipo: m.modname, descripcion: stripHtml(m.description || ""),
          archivoUrl: (archivos[0] && archivos[0].fileurl) || null,
          modificado: (archivos[0] && archivos[0].timemodified) || null,
          archivos: archivos.map((f) => ({ modificado: f.timemodified || 0 })),
        };
      }),
    })),
  }));
  return { token, nombre: info.fullname, courses, materias, grado: gradoDeCursos(courses) };
}

// Temas "practicables": secciones con módulos page/resource/url, sin General ni lapsos.
function temasPracticables(m) {
  return (m.temas || []).filter((t) => {
    if (!t.seccion || /^general$/i.test(t.seccion.trim())) return false;
    if (/\blapso\b/i.test(t.seccion)) return false;
    return (t.modulos || []).some((mod) => ["page", "resource", "url"].includes(mod.tipo));
  });
}
function maxModificado(tema) {
  let mx = 0;
  for (const mod of tema.modulos || []) for (const f of mod.archivos || []) if ((f.modificado || 0) > mx) mx = f.modificado;
  return mx; // epoch en segundos (0 si no hay archivos)
}

// ───────── Supabase (solo lectura del estado curado) ─────────
function supaCfg() {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
// Mapa "materia_norm||tema_norm" → { modos:Set, actualizadoMin:epoch }
async function estadoCurado(grado) {
  const c = supaCfg();
  if (!c) return { map: new Map(), aviso: "sin SUPABASE_* en .env.local (no cruzo con lo curado)" };
  try {
    const q = `grado=eq.${encodeURIComponent(grado)}&select=materia_norm,tema_norm,modo,actualizado`;
    const r = await fetch(`${c.url}/rest/v1/contenido_curado?${q}`, { headers: { apikey: c.key, Authorization: `Bearer ${c.key}` } });
    if (!r.ok) return { map: new Map(), aviso: `Supabase HTTP ${r.status}` };
    const rows = await r.json();
    const map = new Map();
    for (const row of rows) {
      const k = `${row.materia_norm}||${row.tema_norm}`;
      const e = map.get(k) || { modos: new Set(), actualizadoMin: Infinity };
      e.modos.add(row.modo);
      const t = row.actualizado ? new Date(row.actualizado).getTime() / 1000 : 0;
      if (t && t < e.actualizadoMin) e.actualizadoMin = t;
      map.set(k, e);
    }
    return { map, aviso: null };
  } catch (e) {
    return { map: new Map(), aviso: `error leyendo Supabase: ${e.message}` };
  }
}

// ───────── comando: estado ─────────
async function cmdEstado(args) {
  const ses = await entrar(args.cuenta);
  const grado = args.grado || ses.grado || "(desconocido)";
  console.log(`\nCuenta ${String(args.cuenta || "A").toUpperCase()} — ${ses.nombre} — grado activo para curar: ${grado}\n`);
  const { map, aviso } = await estadoCurado(grado);
  if (aviso) console.log(`  (${aviso})\n`);

  const ORDEN = ["resumen", "retos", "quiz", "examen"];
  for (const m of ses.materias) {
    const temas = temasPracticables(m);
    if (!temas.length) continue;
    console.log(`■ ${m.nombre}`);
    for (const t of temas) {
      const k = `${normCurado(m.nombre)}||${normCurado(t.seccion)}`;
      const e = map.get(k);
      let marca;
      if (!e || !e.modos.size) marca = "❌ sin curar";
      else {
        const tiene = ORDEN.filter((x) => e.modos.has(x));
        marca = tiene.length === 4 ? `✅ curado (${tiene.join(",")})` : `⚠️ parcial (solo ${tiene.join(",")})`;
      }
      let fresco = "";
      if (e && e.modos.size && e.actualizadoMin !== Infinity && maxModificado(t) > e.actualizadoMin) {
        fresco = "  🔄 material más nuevo que el banco";
      }
      console.log(`   • ${t.seccion}  →  ${marca}${fresco}`);
    }
    console.log("");
  }
}

// ───────── descarga de PDFs (misma lógica que api/generar.js) ─────────
function conToken(url, token) {
  if (!token) return url;
  return url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}
async function bajar(url) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), DL_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch (e) { return null; } finally { clearTimeout(id); }
}
function esPdf(buf) {
  return buf && buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46;
}
function idDeDrive(html) {
  const m = String(html || "").match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}
async function pdfDeActividad(a, token) {
  if (!a || !a.archivoUrl) return null;
  if (a.tipo === "resource") {
    const buf = await bajar(conToken(a.archivoUrl, token));
    return esPdf(buf) && buf.length <= MAX_PDF_BYTES ? buf : null;
  }
  if (a.tipo === "page") {
    const htmlBuf = await bajar(conToken(a.archivoUrl, token));
    if (!htmlBuf) return null;
    const id = idDeDrive(htmlBuf.toString("utf8"));
    if (!id) return null;
    const buf = await bajar(`https://drive.google.com/uc?export=download&id=${id}`);
    return esPdf(buf) && buf.length <= MAX_PDF_BYTES ? buf : null;
  }
  return null;
}
function slug(s) {
  return normCurado(s).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "tema";
}
function nombreArchivo(a, i) {
  const base = slug(a.nombre || `guia-${i + 1}`);
  return `${String(i + 1).padStart(2, "0")}-${base}.pdf`;
}

// ───────── comando: bajar ─────────
function elegir(candidatos, etiqueta) {
  if (!candidatos.length) { console.error(`✖ No encontré ${etiqueta}.`); process.exit(1); }
  if (candidatos.length > 1) {
    console.error(`✖ Hay varias coincidencias de ${etiqueta}; precisá más:`);
    for (const c of candidatos) console.error(`   - ${c}`);
    process.exit(1);
  }
  return candidatos[0];
}
async function cmdBajar(args) {
  if (!args.materia || !args.tema) { console.error("✖ Uso: bajar --cuenta=A --materia=\"...\" --tema=\"...\""); process.exit(1); }
  const ses = await entrar(args.cuenta);

  const qm = normCurado(args.materia);
  const materiasCand = ses.materias.filter((m) => normCurado(m.nombre).includes(qm));
  const materia = elegir(materiasCand.map((m) => m.nombre), `la materia "${args.materia}"`);
  const mObj = ses.materias.find((m) => m.nombre === materia);

  const qt = normCurado(args.tema);
  const temas = temasPracticables(mObj);
  const temasCand = temas.filter((t) => normCurado(t.seccion).includes(qt));
  const tema = elegir(temasCand.map((t) => t.seccion), `el tema "${args.tema}"`);
  const tObj = temas.find((t) => t.seccion === tema);

  const grado = args.grado || ses.grado || "(desconocido)";
  console.log(`\n${materia}  ·  ${tema}  ·  grado: ${grado}\n`);

  // Texto del tema (enfoque del docente) para orientar la curaduría.
  const resumen = stripHtml(tObj.resumenHtml);
  if (resumen) console.log(`Resumen de la sección:\n  ${resumen}\n`);
  console.log("Actividades del tema:");
  for (const mod of tObj.modulos || []) {
    if (mod.tipo === "label") continue;
    const desc = mod.descripcion ? ` — ${mod.descripcion}` : "";
    console.log(`  · [${mod.tipo}] ${mod.nombre}${desc}`);
  }

  // Descargar PDFs a curado/material/<slug>/
  const destino = path.resolve(process.cwd(), "curado", "material", slug(tema));
  fs.mkdirSync(destino, { recursive: true });
  const candidatas = (tObj.modulos || []).filter((a) => a.archivoUrl && (a.tipo === "resource" || a.tipo === "page"));
  console.log(`\nDescargando PDFs a ${path.relative(process.cwd(), destino)}/ …`);
  let ok = 0, fail = 0;
  for (let i = 0; i < candidatas.length; i++) {
    const a = candidatas[i];
    const buf = await pdfDeActividad(a, ses.token);
    if (buf) {
      const fn = nombreArchivo(a, i);
      fs.writeFileSync(path.join(destino, fn), buf);
      console.log(`  ✔ ${fn}  (${(buf.length / 1024).toFixed(0)} KB)  ← ${a.nombre}`);
      ok++;
    } else {
      console.log(`  ✖ sin PDF: ${a.nombre} [${a.tipo}]`);
      fail++;
    }
  }
  console.log(`\nListo: ${ok} PDF(s) bajado(s)${fail ? `, ${fail} sin PDF (probablemente video/enlace)` : ""}.`);
  if (!ok) console.log("Nota: si el tema solo tiene videos/enlaces, curá con las fotos del cuaderno + el texto de arriba.");
}

// ───────── main ─────────
async function main() {
  const args = parseArgs();
  const cmd = args._[0];
  if (cmd === "estado") return cmdEstado(args);
  if (cmd === "bajar") return cmdBajar(args);
  console.log("Comandos:\n  estado --cuenta=A|B [--grado=\"5to grado\"]\n  bajar  --cuenta=A --materia=\"...\" --tema=\"...\" [--grado=\"...\"]");
}
main().catch((e) => { console.error("Error:", e.message || e); process.exit(1); });
