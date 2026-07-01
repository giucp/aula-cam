// api/capturar.js — Función serverless de Vercel (runtime Node)
// Captura el CURRÍCULO real (materias, temas, actividades y PDFs) desde el Moodle
// y lo guarda en Supabase para que repose ANTES de que reinicien el aula virtual.
// NO usa la IA: guarda el material tal cual (estructura + PDFs en base64).
//
// Protegido por CAPTURA_SECRET (variable de entorno en Vercel). NO es para los
// niños: es una herramienta de administración. 403 si el secreto no coincide.
//
// Como capturar un grado entero no entra en el límite de 60s de Vercel, trabaja
// POR TANDAS (paginado): cada llamada captura unas pocas materias y devuelve
// "siguiente" (el índice desde donde seguir) o null si ya terminó. El cliente
// repite en un bucle hasta que "siguiente" sea null.
//
// Uso (POST JSON):
//   Capturar (paginado):
//     { "secret":"…", "username":"…", "password":"…", "desde":0, "max":2 }   (o "token":"…")
//   Descubrir (solo reporte, sin guardar): qué otros cursos/grados ve la cuenta:
//     { "secret":"…", "username":"…", "password":"…", "descubrir":true }
//
// Reejecutable sin costo extra: los PDFs se deduplican por sha1 y las materias se
// hacen upsert.

import crypto from "node:crypto";

const BASE = "https://aulacam.uearzobispomendez.edu.ve";
const DL_TIMEOUT_MS = 7000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const PDF_BUDGET_MS = 50000;   // no empezar a bajar PDFs pasado esto (margen bajo los 60s)
const DISC_BUDGET_MS = 50000;  // tope de tiempo para el modo "descubrir"
const MAX_POR_TANDA = 5;       // tope duro de materias por llamada

// ───────── Moodle Web Services ─────────
async function callWS(token, wsfunction, params = {}) {
  const body = new URLSearchParams({ wstoken: token, wsfunction, moodlewsrestformat: "json" });
  for (const [k, v] of Object.entries(params)) body.append(k, v);
  const res = await fetch(`${BASE}/webservice/rest/server.php`, { method: "POST", body });
  const data = await res.json();
  if (data && data.exception) throw new Error(`${wsfunction}: ${data.errorcode} — ${data.message}`);
  return data;
}
async function getToken(username, password) {
  const body = new URLSearchParams({ username, password, service: "moodle_mobile_app" });
  const res = await fetch(`${BASE}/login/token.php`, { method: "POST", body });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.token;
}
async function listarCursosSitio(token) {
  // Mejor esfuerzo: qué cursos ve la cuenta en todo el sitio (puede estar bloqueado).
  try { const all = await callWS(token, "core_course_get_courses"); if (Array.isArray(all)) return all; } catch (e) {}
  try { const r = await callWS(token, "core_course_search_courses", { criterianame: "search", criteriavalue: "" }); return (r && r.courses) || []; } catch (e) {}
  return [];
}

// ───────── grado desde el shortname (ej "4G" → "4to grado") ─────────
const ORD = { 1: "1er grado", 2: "2do grado", 3: "3er grado", 4: "4to grado", 5: "5to grado", 6: "6to grado" };
function gradoDe(shortname, fullname) {
  const m = String(shortname || fullname || "").match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : null;
  return n && ORD[n] ? ORD[n] : (shortname || "otro");
}

// ───────── descarga de PDFs (mismo criterio que generar.js) ─────────
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
  } catch (e) {
    return null;
  } finally {
    clearTimeout(id);
  }
}
function esPdf(b) { return b && b.length > 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; }
function idDeDrive(html) { const m = String(html || "").match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/); return m ? m[1] : null; }
async function pdfDeModulo(tipo, url, token) {
  if (!url) return null;
  if (tipo === "resource") {
    const buf = await bajar(conToken(url, token));
    return esPdf(buf) && buf.length <= MAX_PDF_BYTES ? buf : null;
  }
  if (tipo === "page") {
    const htmlBuf = await bajar(conToken(url, token));
    if (!htmlBuf) return null;
    const gid = idDeDrive(htmlBuf.toString("utf8"));
    if (!gid) return null;
    const buf = await bajar(`https://drive.google.com/uc?export=download&id=${gid}`);
    return esPdf(buf) && buf.length <= MAX_PDF_BYTES ? buf : null;
  }
  return null;
}

// ───────── Supabase (PostgREST, igual que generar.js) ─────────
function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }
async function archivoExiste(cfg, sha1) {
  try {
    const r = await fetch(`${cfg.url}/rest/v1/curriculo_archivos?sha1=eq.${sha1}&select=sha1`, { headers: hdr(cfg) });
    if (!r.ok) return false;
    const rows = await r.json();
    return Array.isArray(rows) && !!rows[0];
  } catch (e) { return false; }
}
async function guardarArchivo(cfg, sha1, nombre, buf) {
  await fetch(`${cfg.url}/rest/v1/curriculo_archivos`, {
    method: "POST",
    headers: { ...hdr(cfg), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ sha1, nombre, mime: "application/pdf", bytes: buf.length, datos: buf.toString("base64") }),
  });
}
async function guardarCurriculo(cfg, row) {
  await fetch(`${cfg.url}/rest/v1/curriculo`, {
    method: "POST",
    headers: { ...hdr(cfg), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
}

// ───────── captura de un curso (materia) ─────────
async function capturarCurso(c, token, cfg, r, pdfDeadline) {
  const contenido = await callWS(token, "core_course_get_contents", { courseid: c.id });
  const grado = gradoDe(c.shortname, c.fullname);
  let omitidos = 0;
  const temas = [];
  for (const s of contenido || []) {
    const modulos = [];
    for (const m of s.modules || []) {
      const archivos = (m.contents || [])
        .filter((f) => f.type === "file")
        .map((f) => ({ nombre: f.filename, url: f.fileurl, modificado: f.timemodified }));
      const mod = {
        id: m.id, nombre: m.name, tipo: m.modname,
        descripcionHtml: m.description || null, url: m.url || null,
        archivos: archivos.map((a) => ({ nombre: a.nombre, modificado: a.modificado })),
      };
      if (m.modname === "resource" || m.modname === "page") {
        if (Date.now() < pdfDeadline) {
          const src = (archivos[0] && archivos[0].url) || m.url;
          const buf = await pdfDeModulo(m.modname, src, token);
          if (buf) {
            const sha1 = crypto.createHash("sha1").update(buf).digest("hex");
            if (await archivoExiste(cfg, sha1)) { r.pdfsExistentes++; }
            else { await guardarArchivo(cfg, sha1, m.name, buf); r.pdfsNuevos++; }
            mod.pdf = sha1;
            r.pdfs++;
          }
        } else {
          omitidos++; // se acabó el tiempo: re-correr esta tanda con max=1 lo completa
        }
      }
      modulos.push(mod);
    }
    temas.push({ seccion: s.name, resumenHtml: s.summary || null, modulos });
  }
  await guardarCurriculo(cfg, {
    grado, materia_id: c.id, materia: c.fullname, nombre_corto: c.shortname,
    temas, actualizado: new Date().toISOString(),
  });
  r.materias++;
  r.secciones += temas.length;
  r.grados[grado] = (r.grados[grado] || 0) + 1;
  r.cursos.push({ id: c.id, materia: c.fullname, grado, secciones: temas.length, pdfOmitidos: omitidos });
  if (omitidos) r.pdfsOmitidos += omitidos;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { username, password, token: tokenIn, secret, descubrir, desde = 0, max = 2 } = req.body || {};
  if (!process.env.CAPTURA_SECRET || secret !== process.env.CAPTURA_SECRET) {
    return res.status(403).json({ error: "No autorizado" });
  }
  const cfg = supabaseCfg();
  if (!cfg) return res.status(500).json({ error: "Falta configurar SUPABASE_URL / SUPABASE_SERVICE_KEY" });

  const inicio = Date.now();
  try {
    const token = tokenIn || (await getToken(username, password));
    const info = await callWS(token, "core_webservice_get_site_info");
    const userid = info.userid;
    const mios = (await callWS(token, "core_enrol_get_users_courses", { userid })).slice()
      .sort((a, b) => a.id - b.id); // orden estable para paginar

    // ── modo DESCUBRIR: solo reporta qué otros cursos/grados ve la cuenta ──
    if (descubrir) {
      const descubiertos = [];
      let deTotal = 0, revisados = 0, cortado = false;
      try {
        const all = await listarCursosSitio(token);
        const otros = all.filter((c) => !mios.some((m) => m.id === c.id));
        deTotal = otros.length;
        for (const c of otros) {
          if (Date.now() - inicio > DISC_BUDGET_MS) { cortado = true; break; }
          revisados++;
          const b = { id: c.id, materia: c.fullname || c.displayname, shortname: c.shortname, grado: gradoDe(c.shortname, c.fullname) };
          try { const cont = await callWS(token, "core_course_get_contents", { courseid: c.id }); descubiertos.push({ ...b, accesible: true, secciones: (cont || []).length }); }
          catch (e) { descubiertos.push({ ...b, accesible: false }); }
        }
      } catch (e) {
        return res.status(200).json({ ok: true, usuario: { id: userid, nombre: info.fullname }, descubrirError: String(e.message || e) });
      }
      return res.status(200).json({
        ok: true, usuario: { id: userid, nombre: info.fullname, sitio: info.sitename },
        misCursos: mios.length, otrosVistos: deTotal, revisados, cortadoPorTiempo: cortado,
        accesibles: descubiertos.filter((d) => d.accesible).length, descubiertos,
      });
    }

    // ── modo CAPTURA paginada ──
    const desdeN = Math.max(0, parseInt(desde, 10) || 0);
    const maxN = Math.min(Math.max(parseInt(max, 10) || 2, 1), MAX_POR_TANDA);
    const tanda = mios.slice(desdeN, desdeN + maxN);
    const pdfDeadline = inicio + PDF_BUDGET_MS;
    const r = { grados: {}, materias: 0, secciones: 0, pdfs: 0, pdfsNuevos: 0, pdfsExistentes: 0, pdfsOmitidos: 0, cursos: [], errores: [] };
    for (const c of tanda) {
      try { await capturarCurso(c, token, cfg, r, pdfDeadline); }
      catch (e) { r.errores.push(`"${c.fullname}": ${String(e.message || e)}`); }
    }
    const siguiente = desdeN + tanda.length;
    return res.status(200).json({
      ok: true,
      usuario: { id: userid, nombre: info.fullname, sitio: info.sitename },
      total: mios.length,
      desde: desdeN,
      capturadas: tanda.length,
      siguiente: siguiente < mios.length ? siguiente : null, // null = ya terminó este grado
      resumen: r,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
