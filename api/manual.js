// api/manual.js — Función serverless de Vercel (runtime Node)
// CAMINO B (F2 del PLAN-CHISPA-UNIVERSAL): materias manuales + apuntes (fotos/texto) para los niños
// SIN aula virtual. A diferencia de agenda/actividad (que confían en usuario_id), acá exigimos el
// TOKEN de sesión nativo (api/cuenta) y sacamos el usuario_id de ahí → un niño solo toca lo suyo.
//
// POST { accion, token, ... }:
//   "materias"        → lista de materias manuales del niño (no archivadas).
//   "materia_guardar" {materia:{id?,nombre,emoji,color}} → crea o edita.
//   "materia_borrar"  {id} → borra una materia del niño.
//   "temas"           {materia?} → temas detectados (alimenta la generación; se llena con apuntes).
//   "apunte_subir"    {materia?, foto:{data,mime} | texto} → PREMIUM: lee el apunte con Gemini Vision,
//                     guarda lo extraído (tema/conceptos/OCR) y detecta el tema. Free → 403 premium.
//   "apuntes"         {materia?} → lista de apuntes procesados del niño.
//   "apunte_borrar"   {id} → borra un apunte.

import crypto from "node:crypto";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg, extra) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, ...extra }; }

// ───────── validación del token de sesión (misma firma que api/cuenta.js) ─────────
function authKey() {
  const base = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_KEY || "chispa-dev";
  return crypto.createHash("sha256").update(base + "|chispa-auth-v1").digest();
}
function uidDeToken(token) {
  if (typeof token !== "string") return null;
  const p = token.split(".");
  if (p.length !== 3) return null;
  const esperado = crypto.createHmac("sha256", authKey()).update(`${p[0]}.${p[1]}`).digest("base64url");
  const a = Buffer.from(p[2]), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() / 1000 - Number(p[1]) > 365 * 24 * 3600) return null;
  const id = Number(p[0]);
  return Number.isInteger(id) ? id : null;
}

// ───────── acciones ─────────
async function materias(cfg, uid) {
  const r = await fetch(`${cfg.url}/rest/v1/materias_manuales?usuario_id=eq.${uid}&archivada=eq.false&select=id,nombre,emoji,color&order=id.asc`, { headers: hdr(cfg) });
  const rows = r.ok ? await r.json() : [];
  return { ok: true, materias: Array.isArray(rows) ? rows : [] };
}

async function materiaGuardar(cfg, uid, m) {
  m = m || {};
  const nombre = String(m.nombre || "").trim().slice(0, 60);
  if (!nombre) return { ok: false, error: "Falta el nombre de la materia." };
  const fila = {
    nombre,
    emoji: m.emoji ? String(m.emoji).trim().slice(0, 8) : null,
    color: m.color ? String(m.color).trim().slice(0, 16) : null,
  };
  let r;
  if (m.id != null) {
    // editar: solo si la materia es del niño (usuario_id en el filtro)
    r = await fetch(`${cfg.url}/rest/v1/materias_manuales?id=eq.${encodeURIComponent(m.id)}&usuario_id=eq.${uid}`, {
      method: "PATCH", headers: hdr(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }), body: JSON.stringify(fila),
    });
  } else {
    r = await fetch(`${cfg.url}/rest/v1/materias_manuales`, {
      method: "POST", headers: hdr(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }), body: JSON.stringify({ ...fila, usuario_id: uid }),
    });
  }
  if (!r.ok) return { ok: false, error: `No se pudo guardar (HTTP ${r.status}).` };
  const out = await r.json();
  return { ok: true, materia: Array.isArray(out) ? out[0] : out };
}

async function materiaBorrar(cfg, uid, id) {
  if (id == null) return { ok: false, error: "Falta el id." };
  const r = await fetch(`${cfg.url}/rest/v1/materias_manuales?id=eq.${encodeURIComponent(id)}&usuario_id=eq.${uid}`, {
    method: "DELETE", headers: hdr(cfg),
  });
  if (!r.ok) return { ok: false, error: `No se pudo borrar (HTTP ${r.status}).` };
  return { ok: true };
}

// perfil mínimo del niño (plan + grado) para el gate y para calibrar la lectura
async function usuarioPerfil(cfg, uid) {
  try {
    const r = await fetch(`${cfg.url}/rest/v1/usuarios?id=eq.${uid}&select=plan,grado`, { headers: hdr(cfg) });
    if (!r.ok) return {};
    const u = (await r.json())[0];
    return u || {};
  } catch (e) { return {}; }
}

// ───────── Gemini Vision: lee un apunte (foto/texto) y saca tema + conceptos + OCR ─────────
function geminiKeys() {
  const limpiar = (s) => String(s || "").split(",").map((k) => k.trim()).filter(Boolean);
  const pagas = [...new Set(limpiar(process.env.GEMINI_API_KEY_PAGA))];
  const gratis = [...new Set([...limpiar(process.env.GEMINI_API_KEY), ...limpiar(process.env.GEMINI_API_KEYS)])].filter((k) => !pagas.includes(k));
  return { gratis, pagas };
}
async function procesarConGemini({ foto, texto, grado }) {
  const { gratis, pagas } = geminiKeys();
  const keys = [...gratis, ...pagas]; // lectura simple → gratis primero
  if (!keys.length) return null;
  const prompt =
    `Sos un asistente que lee apuntes escolares de un niño de ${grado || "primaria"} en Venezuela. ` +
    `Leé el apunte (foto y/o texto) y devolvé SOLO un JSON con esta forma exacta: ` +
    `{"tema":"título corto y claro del tema principal, máximo 8 palabras","conceptos":["3 a 6 palabras clave o conceptos"],"resumen_ocr":"lo que dice el apunte en texto plano, lo más fiel posible"}. ` +
    `Si algo es ilegible, poné lo que puedas con razonable seguridad y NO inventes. Español neutro, sin markdown.`;
  const parts = [{ text: prompt }];
  if (foto && foto.data) parts.push({ inline_data: { mime_type: foto.mime || "image/jpeg", data: foto.data } });
  if (texto) parts.push({ text: "\n\nApunte (texto del alumno):\n" + texto });
  const payload = { contents: [{ parts }], generationConfig: { temperature: 0.2, responseMimeType: "application/json" } };
  for (const key of keys) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(45000),
      });
      if (r.status === 429 || r.status === 503) continue;
      const data = await r.json();
      if (!data || data.error) continue;
      const txt = (((data.candidates || [])[0] || {}).content || {}).parts ? data.candidates[0].content.parts.map((p) => p.text || "").join("") : "";
      if (!txt) continue;
      let j = null;
      try { j = JSON.parse(txt); } catch { const m = txt.match(/\{[\s\S]*\}/); if (m) { try { j = JSON.parse(m[0]); } catch {} } }
      if (j && (j.tema || j.resumen_ocr)) {
        return { tema: j.tema || null, conceptos: Array.isArray(j.conceptos) ? j.conceptos.slice(0, 8).map(String) : [], resumen_ocr: String(j.resumen_ocr || "") };
      }
    } catch (e) { /* próxima key */ }
  }
  return null;
}

// Sube un apunte (foto o texto), lo procesa con IA (premium) y detecta el tema.
async function apunteSubir(cfg, uid, body) {
  const perfil = await usuarioPerfil(cfg, uid);
  if (perfil.plan !== "premium") return { status: 403, json: { error: "Procesar apuntes con IA es una función premium de Chispa.", premium: true } };
  const materia = String(body.materia || "").trim().slice(0, 60) || null;
  const foto = body.foto && body.foto.data ? { data: String(body.foto.data), mime: body.foto.mime } : null;
  const texto = body.texto ? String(body.texto).slice(0, 8000) : null;
  if (!foto && !texto) return { status: 400, json: { error: "Mandá una foto de tu cuaderno o escribí el tema." } };

  const extraido = await procesarConGemini({ foto, texto, grado: perfil.grado });
  if (!extraido) return { status: 502, json: { error: "No pudimos leer el apunte. Probá con otra foto más clara o escribí el tema." } };

  const ins = await fetch(`${cfg.url}/rest/v1/apuntes`, {
    method: "POST", headers: hdr(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ usuario_id: uid, materia, tipo: foto ? "foto" : "texto", texto, extraido, estado: "procesado" }),
  });
  const apunte = ins.ok ? (await ins.json())[0] : null;
  if (extraido.tema && apunte) {
    await fetch(`${cfg.url}/rest/v1/temas_detectados`, {
      method: "POST", headers: hdr(cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({ usuario_id: uid, materia, tema: extraido.tema, origen: "apunte", apunte_ids: [apunte.id] }),
    });
  }
  return { status: 200, json: { ok: true, apunte, tema: extraido.tema, conceptos: extraido.conceptos } };
}

async function apuntes(cfg, uid, materia) {
  let q = `${cfg.url}/rest/v1/apuntes?usuario_id=eq.${uid}&select=id,materia,tipo,extraido,estado,creado&order=id.desc&limit=100`;
  if (materia) q += `&materia=eq.${encodeURIComponent(String(materia))}`;
  const r = await fetch(q, { headers: hdr(cfg) });
  const rows = r.ok ? await r.json() : [];
  return { ok: true, apuntes: Array.isArray(rows) ? rows : [] };
}
async function apunteBorrar(cfg, uid, id) {
  if (id == null) return { ok: false, error: "Falta el id." };
  const r = await fetch(`${cfg.url}/rest/v1/apuntes?id=eq.${encodeURIComponent(id)}&usuario_id=eq.${uid}`, { method: "DELETE", headers: hdr(cfg) });
  if (!r.ok) return { ok: false, error: `No se pudo borrar (HTTP ${r.status}).` };
  return { ok: true };
}

async function temas(cfg, uid, materia) {
  let q = `${cfg.url}/rest/v1/temas_detectados?usuario_id=eq.${uid}&select=id,materia,tema,origen&order=id.desc&limit=200`;
  if (materia) q += `&materia=eq.${encodeURIComponent(String(materia))}`;
  const r = await fetch(q, { headers: hdr(cfg) });
  const rows = r.ok ? await r.json() : [];
  return { ok: true, temas: Array.isArray(rows) ? rows : [] };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(500).json({ error: "Sin configuración" });
  const body = req.body || {};
  const uid = uidDeToken(body.token);
  if (uid == null) return res.status(401).json({ error: "Sesión inválida.", code: 401 });

  try {
    if (body.accion === "materias") return res.status(200).json(await materias(cfg, uid));
    if (body.accion === "materia_guardar") return res.status(200).json(await materiaGuardar(cfg, uid, body.materia));
    if (body.accion === "materia_borrar") return res.status(200).json(await materiaBorrar(cfg, uid, body.id));
    if (body.accion === "temas") return res.status(200).json(await temas(cfg, uid, body.materia));
    if (body.accion === "apunte_subir") { const o = await apunteSubir(cfg, uid, body); return res.status(o.status).json(o.json); }
    if (body.accion === "apuntes") return res.status(200).json(await apuntes(cfg, uid, body.materia));
    if (body.accion === "apunte_borrar") return res.status(200).json(await apunteBorrar(cfg, uid, body.id));
    return res.status(400).json({ error: "acción inválida" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
