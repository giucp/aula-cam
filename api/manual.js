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
// (apuntes/foto + Gemini Vision = próximo incremento)

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
    return res.status(400).json({ error: "acción inválida" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
