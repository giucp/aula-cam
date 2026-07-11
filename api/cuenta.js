// api/cuenta.js — Función serverless de Vercel (runtime Node)
// AUTH PROPIA de Chispa (cuenta nativa, sin email): registro/login con usuario+contraseña y
// recuperación por CÓDIGO DE RESCATE. NO toca el login por Moodle (api/moodle.js) — es un
// camino aparte para niños que crean su cuenta propia (F1 del PLAN-CHISPA-UNIVERSAL).
//
// POST { accion, ... }:
//   "registrar" {usuario,clave,nombre,grado,colegioId?} → crea cuenta gratis. Devuelve token de
//               sesión + el CÓDIGO DE RESCATE (se muestra UNA sola vez).
//   "login"     {usuario,clave} → token de sesión.
//   "sesion"    {token} → valida el token y devuelve el perfil (para reabrir la app).
//   "recuperar" {usuario,codigoRescate,claveNueva} → cambia la clave usando el código; devuelve
//               token + un código de rescate NUEVO.
//   "solicitar_colegio" {colegio,ciudad?,estado?,tiene_aula?,moodle_url?,contacto?,nota?,token?}
//               → guarda una solicitud "agreguen mi colegio" (F3). Público; sin cuenta obligatoria.
//   "onboarding_visto" {token} → marca usuarios.onboarding=true tras ver el tutorial (F4).
//
// Seguridad: contraseña y código con scrypt (sal por usuario, comparación timing-safe). El token de
// sesión es HMAC-firmado (sin estado): payload "uid.iat" + firma; la clave HMAC se deriva del
// service key (o de AUTH_SECRET si está). Todo por HTTPS. RLS on → solo el backend toca la BD.

import crypto from "node:crypto";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }

// ───────── hashing de contraseña / código (scrypt) ─────────
function hashScrypt(secreto) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(secreto), salt, 64);
  return `scrypt$${salt.toString("hex")}$${h.toString("hex")}`;
}
function verificarScrypt(secreto, guardado) {
  const partes = String(guardado || "").split("$");
  if (partes.length !== 3 || partes[0] !== "scrypt") return false;
  const salt = Buffer.from(partes[1], "hex");
  const esperado = Buffer.from(partes[2], "hex");
  if (!salt.length || !esperado.length) return false;
  const h = crypto.scryptSync(String(secreto), salt, 64);
  return h.length === esperado.length && crypto.timingSafeEqual(h, esperado);
}
const HASH_DUMMY = hashScrypt("__dummy__"); // para igualar el tiempo cuando el usuario no existe

// ───────── código de rescate (8 chars, sin caracteres ambiguos) ─────────
const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0 O 1 I L
function generarCodigoRescate() {
  const b = crypto.randomBytes(8);
  let s = "";
  for (let i = 0; i < 8; i++) s += ALFA[b[i] % ALFA.length];
  return s;
}
const normCodigo = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

// ───────── token de sesión (HMAC firmado, sin estado) ─────────
function authKey() {
  const base = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_KEY || "chispa-dev";
  return crypto.createHash("sha256").update(base + "|chispa-auth-v1").digest();
}
function firmarToken(uid) {
  const payload = `${uid}.${Math.floor(Date.now() / 1000)}`;
  const sig = crypto.createHmac("sha256", authKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
function validarToken(token) {
  if (typeof token !== "string") return null;
  const p = token.split(".");
  if (p.length !== 3) return null;
  const payload = `${p[0]}.${p[1]}`;
  const esperado = crypto.createHmac("sha256", authKey()).update(payload).digest("base64url");
  const a = Buffer.from(p[2]), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() / 1000 - Number(p[1]) > 365 * 24 * 3600) return null; // 1 año
  const id = Number(p[0]);
  return Number.isInteger(id) ? id : null;
}

// ───────── acciones ─────────
async function registrar(cfg, body) {
  const usuario = String(body.usuario || "").trim().toLowerCase();
  const clave = String(body.clave || "");
  const nombre = String(body.nombre || "").trim();
  const grado = String(body.grado || "").trim();
  const colegioId = body.colegioId != null && isFinite(Number(body.colegioId)) ? Number(body.colegioId) : null;
  if (!/^[a-z0-9._]{3,20}$/.test(usuario)) return { status: 400, json: { error: "El usuario debe tener de 3 a 20 letras o números, sin espacios." } };
  if (clave.length < 6) return { status: 400, json: { error: "La contraseña debe tener al menos 6 caracteres." } };
  if (!nombre) return { status: 400, json: { error: "Falta tu nombre." } };
  if (!grado) return { status: 400, json: { error: "Falta tu grado." } };

  const codigo = generarCodigoRescate();
  const r = await fetch(`${cfg.url}/rest/v1/rpc/crear_cuenta_nativa`, {
    method: "POST",
    headers: { ...hdr(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({
      p_usuario: usuario, p_nombre: nombre, p_grado: grado,
      p_pass_hash: hashScrypt(clave), p_codigo_hash: hashScrypt(normCodigo(codigo)), p_colegio_id: colegioId,
    }),
  });
  if (!r.ok) return { status: 500, json: { error: "No se pudo crear la cuenta. Reintentá." } };
  const id = await r.json(); // bigint o null
  if (id == null) return { status: 409, json: { error: "Ese nombre de usuario ya está tomado. Probá otro." } };
  return { status: 200, json: { ok: true, token: firmarToken(id), usuario: { id, nombre, grado, plan: "gratis", onboarding: false }, codigoRescate: codigo } };
}

async function login(cfg, body) {
  const usuario = String(body.usuario || "").trim().toLowerCase();
  const clave = String(body.clave || "");
  if (!usuario || !clave) return { status: 400, json: { error: "Faltan usuario o contraseña." } };
  const r = await fetch(`${cfg.url}/rest/v1/usuarios?usuario=eq.${encodeURIComponent(usuario)}&select=id,nombre,grado,plan,onboarding,pass_hash&limit=1`, { headers: hdr(cfg) });
  const rows = r.ok ? await r.json() : [];
  const u = Array.isArray(rows) && rows[0];
  if (!u || !verificarScrypt(clave, u.pass_hash)) {
    if (!u) verificarScrypt(clave, HASH_DUMMY); // iguala el tiempo (no revela si el usuario existe)
    return { status: 401, json: { error: "Usuario o contraseña incorrectos." } };
  }
  const racha = await tocarAcceso(cfg, u.id);
  return { status: 200, json: { ok: true, token: firmarToken(u.id), usuario: { id: u.id, nombre: u.nombre, grado: u.grado, plan: u.plan, onboarding: !!u.onboarding, racha } } };
}

async function sesion(cfg, body) {
  const id = validarToken(body.token);
  if (id == null) return { status: 401, json: { error: "Tu sesión venció. Entrá de nuevo.", code: 401 } };
  const r = await fetch(`${cfg.url}/rest/v1/usuarios?id=eq.${id}&select=id,nombre,grado,plan,onboarding&limit=1`, { headers: hdr(cfg) });
  const rows = r.ok ? await r.json() : [];
  const u = Array.isArray(rows) && rows[0];
  if (!u) return { status: 401, json: { error: "Cuenta no encontrada.", code: 401 } };
  const racha = await tocarAcceso(cfg, u.id);
  return { status: 200, json: { ok: true, token: firmarToken(u.id), usuario: { id: u.id, nombre: u.nombre, grado: u.grado, plan: u.plan, onboarding: !!u.onboarding, racha } } };
}

// F4: marca el onboarding como visto (una vez que el niño lo completa/salta). Requiere token de sesión.
async function onboardingVisto(cfg, body) {
  const id = validarToken(body.token);
  if (id == null) return { status: 401, json: { error: "Tu sesión venció. Entrá de nuevo.", code: 401 } };
  const r = await fetch(`${cfg.url}/rest/v1/usuarios?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...hdr(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({ onboarding: true }),
  });
  if (!r.ok) return { status: 500, json: { error: "No se pudo guardar." } };
  return { status: 200, json: { ok: true } };
}

async function recuperar(cfg, body) {
  const usuario = String(body.usuario || "").trim().toLowerCase();
  const codigo = normCodigo(body.codigoRescate);
  const claveNueva = String(body.claveNueva || "");
  if (!usuario || !codigo) return { status: 400, json: { error: "Faltan el usuario y el código de rescate." } };
  if (claveNueva.length < 6) return { status: 400, json: { error: "La nueva contraseña debe tener al menos 6 caracteres." } };
  const r = await fetch(`${cfg.url}/rest/v1/usuarios?usuario=eq.${encodeURIComponent(usuario)}&select=id,nombre,grado,plan,onboarding,codigo_rescate_hash&limit=1`, { headers: hdr(cfg) });
  const rows = r.ok ? await r.json() : [];
  const u = Array.isArray(rows) && rows[0];
  if (!u || !verificarScrypt(codigo, u.codigo_rescate_hash)) {
    if (!u) verificarScrypt(codigo, HASH_DUMMY);
    return { status: 401, json: { error: "Usuario o código de rescate incorrectos." } };
  }
  const nuevoCodigo = generarCodigoRescate();
  const pr = await fetch(`${cfg.url}/rest/v1/usuarios?id=eq.${u.id}`, {
    method: "PATCH",
    headers: { ...hdr(cfg), "Content-Type": "application/json" },
    body: JSON.stringify({ pass_hash: hashScrypt(claveNueva), codigo_rescate_hash: hashScrypt(normCodigo(nuevoCodigo)) }),
  });
  if (!pr.ok) return { status: 500, json: { error: "No se pudo actualizar la contraseña." } };
  return { status: 200, json: { ok: true, token: firmarToken(u.id), usuario: { id: u.id, nombre: u.nombre, grado: u.grado, plan: u.plan, onboarding: !!u.onboarding }, codigoRescate: nuevoCodigo } };
}

// ───────── F3: solicitud "agreguen mi colegio" (público, sin cuenta obligatoria) ─────────
// Un niño/representante cuyo colegio no está en Chispa pide que lo agreguemos. Se guarda en
// solicitudes_colegio para revisarla desde #lab. Validación mínima + topes de longitud (el
// rate-limit fuerte es F6). Si viene un token de sesión válido, guarda el usuario_id de origen.
const recorta = (s, n) => { s = String(s == null ? "" : s).trim(); return s.length > n ? s.slice(0, n) : s; };
async function solicitarColegio(cfg, body) {
  const colegio = recorta(body.colegio, 120);
  if (!colegio) return { status: 400, json: { error: "Escribí el nombre de tu colegio." } };
  const url = recorta(body.moodle_url, 300);
  const fila = {
    colegio,
    ciudad: recorta(body.ciudad, 80) || null,
    estado: recorta(body.estado, 80) || null,
    tiene_aula: typeof body.tiene_aula === "boolean" ? body.tiene_aula : null,
    moodle_url: url && /^https?:\/\//i.test(url) ? url : (url ? "http://" + url.replace(/^\/+/, "") : null),
    contacto: recorta(body.contacto, 120) || null,
    nota: recorta(body.nota, 500) || null,
    origen_uid: validarToken(body.token) ?? null,
  };
  const r = await fetch(`${cfg.url}/rest/v1/solicitudes_colegio`, {
    method: "POST",
    headers: { ...hdr(cfg), "Content-Type": "application/json" },
    body: JSON.stringify(fila),
  });
  if (!r.ok) return { status: 500, json: { error: "No se pudo enviar la solicitud. Reintentá." } };
  return { status: 200, json: { ok: true } };
}

async function tocarAcceso(cfg, id) {
  try {
    const r = await fetch(`${cfg.url}/rest/v1/rpc/tocar_acceso`, {
      method: "POST", headers: { ...hdr(cfg), "Content-Type": "application/json" }, body: JSON.stringify({ p_id: id }),
    });
    if (!r.ok) return 0;
    const n = await r.json();
    return Number.isInteger(n) ? n : 0;
  } catch (e) { return 0; }
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
  try {
    let out;
    if (body.accion === "registrar") out = await registrar(cfg, body);
    else if (body.accion === "login") out = await login(cfg, body);
    else if (body.accion === "sesion") out = await sesion(cfg, body);
    else if (body.accion === "recuperar") out = await recuperar(cfg, body);
    else if (body.accion === "solicitar_colegio") out = await solicitarColegio(cfg, body);
    else if (body.accion === "onboarding_visto") out = await onboardingVisto(cfg, body);
    else return res.status(400).json({ error: "acción inválida" });
    return res.status(out.status).json(out.json);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
