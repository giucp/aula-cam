// herramientas/sesion.mjs — firma de sesión compartida por los endpoints de la app del niño.
//
// ★ POR QUÉ EXISTE (2026-10-20): agenda, actividad, errores y generar le CREÍAN al teléfono el
//   usuario_id que mandaba en el body, sin verificar nada. Los ids son números chicos y
//   consecutivos, así que cualquiera con curl podía leer y modificar el horario, las tareas y
//   las notas de una niña poniendo "usuario_id: 118", y usar la IA (pagada) con ids inventados
//   — /api/generar no limitaba a un usuario que no existe. Se comprobó en vivo, no es teórico.
//
// Ahora el servidor firma la sesión al hacer login y cada endpoint exige esa firma en el header
// x-chispa-sesion, y que corresponda al MISMO usuario_id que viene en el body.
//
// El formato y la clave son EXACTAMENTE los de firmarToken() de api/cuenta.js (cuentas nativas):
// `${uid}.${emitido}.${hmac}`. Así el token que ya tienen las cuentas nativas sirve tal cual, y
// las cuentas del aula (Moodle) reciben uno igual desde api/moodle.js.
import crypto from "node:crypto";

const VIGENCIA_S = 365 * 24 * 3600;   // igual que api/cuenta.js

function clave() {
  const base = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_KEY || "chispa-dev";
  return crypto.createHash("sha256").update(base + "|chispa-auth-v1").digest();
}

export function firmarSesion(uid) {
  const payload = `${uid}.${Math.floor(Date.now() / 1000)}`;
  const sig = crypto.createHmac("sha256", clave()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

// Devuelve el uid (número) si la firma es válida y vigente; si no, null.
export function uidDeSesion(token) {
  if (typeof token !== "string") return null;
  const p = token.split(".");
  if (p.length !== 3) return null;
  const esperado = crypto.createHmac("sha256", clave()).update(`${p[0]}.${p[1]}`).digest("base64url");
  const a = Buffer.from(p[2]), b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  if (Date.now() / 1000 - Number(p[1]) > VIGENCIA_S) return null;
  const id = Number(p[0]);
  return Number.isInteger(id) ? id : null;
}

export const HEADER_SESION = "x-chispa-sesion";

// Para los handlers: la firma del header tiene que ser válida Y del mismo usuario que el body.
// Devuelve el uid verificado, o null (el handler responde 401 con code "sesion").
export function sesionDe(req, usuarioIdBody) {
  const h = (req && req.headers && (req.headers[HEADER_SESION] || req.headers[HEADER_SESION.toUpperCase()])) || "";
  const uid = uidDeSesion(Array.isArray(h) ? h[0] : h);
  if (uid == null) return null;
  return uid === parseInt(usuarioIdBody, 10) ? uid : null;
}

// Respuesta estándar. El front reconoce code "sesion": renueva la firma y reintenta UNA vez.
export const NO_AUTORIZADO = { error: "Tu sesión necesita renovarse. Vuelve a abrir Chispa.", code: "sesion" };
