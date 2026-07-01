// api/capturar.js — Función serverless de Vercel (runtime Node)
// Captura el CURRÍCULO real (materias, temas, actividades y PDFs) desde el Moodle
// y lo guarda en Supabase para que repose ANTES de que reinicien el aula virtual.
// NO usa la IA: guarda el material tal cual (estructura + PDFs en base64).
//
// Protegido por CAPTURA_SECRET (variable de entorno en Vercel). NO es para los
// niños: es una herramienta de administración. Devuelve 403 si el secreto no
// coincide, y también si Supabase no está configurado.
//
// Uso (POST JSON):
//   { "secret":"…", "username":"…", "password":"…" }        (o "token":"…")
//   opcional: { "descubrir": true }  → además REPORTA (sin descargar) qué otros
//   cursos/grados ve la cuenta, para saber si se pueden capturar más adelante.
//
// Reejecutable sin costo extra: los PDFs se deduplican por sha1 y las materias
// se hacen upsert, así correrlo de nuevo solo completa lo que falte.

import crypto from "node:crypto";

const BASE = "https://aulacam.uearzobispomendez.edu.ve";
const DL_TIMEOUT_MS = 9000;
const MAX_PDF_BYTES = 8 * 1024 * 1024;
const TIME_BUDGET_MS = 55000; // dejamos margen bajo el maxDuration:60 de Vercel

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
async function capturarCurso(c, token, cfg, r, hastaMs) {
  const contenido = await callWS(token, "core_course_get_contents", { courseid: c.id });
  const grado = gradoDe(c.shortname, c.fullname);
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
      // Guardar el PDF (si es resource/page con PDF) mientras quede presupuesto de tiempo.
      if ((m.modname === "resource" || m.modname === "page") && Date.now() < hastaMs) {
        const src = (archivos[0] && archivos[0].url) || m.url;
        const buf = await pdfDeModulo(m.modname, src, token);
        if (buf) {
          const sha1 = crypto.createHash("sha1").update(buf).digest("hex");
          if (await archivoExiste(cfg, sha1)) {
            r.pdfsExistentes++;
          } else {
            await guardarArchivo(cfg, sha1, m.name, buf);
            r.pdfsNuevos++;
          }
          mod.pdf = sha1;
          r.pdfs++;
        }
      } else if (m.modname === "resource" || m.modname === "page") {
        r.pdfsOmitidos++; // se acabó el tiempo: quedó sin bajar (re-correr lo completa)
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
  r.cursos.push({ id: c.id, materia: c.fullname, grado, secciones: temas.length });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { username, password, token: tokenIn, secret, descubrir } = req.body || {};
  if (!process.env.CAPTURA_SECRET || secret !== process.env.CAPTURA_SECRET) {
    return res.status(403).json({ error: "No autorizado" });
  }
  const cfg = supabaseCfg();
  if (!cfg) return res.status(500).json({ error: "Falta configurar SUPABASE_URL / SUPABASE_SERVICE_KEY" });

  const hastaMs = Date.now() + TIME_BUDGET_MS;
  try {
    const token = tokenIn || (await getToken(username, password));
    const info = await callWS(token, "core_webservice_get_site_info");
    const userid = info.userid;
    const mios = await callWS(token, "core_enrol_get_users_courses", { userid });

    const r = { grados: {}, materias: 0, secciones: 0, pdfs: 0, pdfsNuevos: 0, pdfsExistentes: 0, pdfsOmitidos: 0, cursos: [], errores: [] };
    for (const c of mios) {
      if (Date.now() > hastaMs) { r.errores.push(`Sin tiempo para "${c.fullname}" (re-correr lo completa)`); continue; }
      try { await capturarCurso(c, token, cfg, r, hastaMs); }
      catch (e) { r.errores.push(`"${c.fullname}": ${String(e.message || e)}`); }
    }

    // Reporte (sin descargar) de otros cursos/grados que vería la cuenta.
    let descubiertos = null;
    if (descubrir) {
      descubiertos = [];
      try {
        const all = await listarCursosSitio(token);
        const otros = all.filter((c) => !mios.some((m) => m.id === c.id));
        for (const c of otros) {
          const base = { id: c.id, materia: c.fullname || c.displayname, shortname: c.shortname, grado: gradoDe(c.shortname, c.fullname) };
          try {
            const cont = await callWS(token, "core_course_get_contents", { courseid: c.id });
            descubiertos.push({ ...base, accesible: true, secciones: (cont || []).length });
          } catch (e) {
            descubiertos.push({ ...base, accesible: false });
          }
        }
      } catch (e) {
        descubiertos = [{ error: String(e.message || e) }];
      }
    }

    return res.status(200).json({
      ok: true,
      usuario: { id: userid, nombre: info.fullname, sitio: info.sitename },
      resumen: r,
      descubiertos,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
