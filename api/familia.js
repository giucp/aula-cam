// api/familia.js — Panel de familia (padres): acceso de SOLO LECTURA a lo que hizo un niño.
//
// Modelo de vinculación (como emparejar un control con la tele):
//   1) El niño (logueado en su aula) genera una invitación → accion "invitar", autenticado
//      con su token de Moodle (así solo puede invitar PARA SÍ MISMO; no se puede forjar un
//      usuario_id ajeno). Devuelve un código corto + un link.
//   2) El padre abre el link (familia.html?c=CODIGO) → accion "canjear" cambia el código por
//      un TOKEN persistente que el dispositivo del padre guarda. El código se borra (1 solo uso).
//   3) De ahí en más el padre ve el panel → accion "panel" (con su token), sin depender del niño.
//   4) El niño puede ver/revocar accesos → acciones "vinculos"/"revocar".
//
// Seguridad: RLS on en familia_vinculos (solo service_role). El token del padre mapea a UN
// solo usuario_id; el panel es de solo lectura (el padre NO puede escribir nada del niño).

import crypto from "crypto";

const BASE = "https://aulacam.uearzobispomendez.edu.ve";
const ORIGIN = "https://aula-cam.vercel.app";
// Dominio donde vive el panel del padre (para el link de invitación): app propia, aparte
// del aula del niño. Se puede mover con la env FAMILIA_ORIGIN (proyecto aula-cam).
const FAMILIA_ORIGIN = process.env.FAMILIA_ORIGIN || "https://chispa-familia.vercel.app";
// CORS: el panel del padre puede estar en otro *.vercel.app y llama a esta API. Reflejamos
// el origen si es aula-cam o cualquier *.vercel.app (los tokens/códigos son el verdadero
// candado; CORS solo dice qué webs pueden llamar desde el navegador).
function corsOrigin(req) {
  const o = (req.headers && req.headers.origin) || "";
  return (o === ORIGIN || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(o)) ? o : ORIGIN;
}

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg, extra) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, ...(extra || {}) }; }
async function sbGet(cfg, path) {
  const r = await fetch(`${cfg.url}/rest/v1/${path}`, { headers: hdr(cfg) });
  return r.ok ? await r.json() : [];
}

// Verifica un token de Moodle y devuelve el userid real del niño (prueba de identidad).
async function useridDeToken(token) {
  if (!token) return null;
  try {
    const body = new URLSearchParams({ wstoken: token, wsfunction: "core_webservice_get_site_info", moodlewsrestformat: "json" });
    const r = await fetch(`${BASE}/webservice/rest/server.php`, { method: "POST", body });
    const d = await r.json().catch(() => null);
    if (!d || d.exception || d.userid == null) return null;
    return d.userid;
  } catch (e) { return null; }
}

const ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I: legible y sin ambigüedad
function codigoCorto(n = 8) {
  const b = crypto.randomBytes(n); let s = "";
  for (let i = 0; i < n; i++) s += ALFA[b[i] % ALFA.length];
  return s;
}
function tokenLargo() { return crypto.randomBytes(24).toString("base64url"); }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", corsOrigin(req));
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(500).json({ error: "Sin configuración" });

  const b = req.body || {};
  const accion = b.accion;

  // telemetría mínima (fire-and-forget): registra que el request LLEGÓ, con qué acción y
  // desde qué navegador — para diagnosticar remoto si los teléfonos llegan al servidor o no.
  try {
    fetch(`${cfg.url}/rest/v1/familia_log`, {
      method: "POST", headers: hdr(cfg, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        accion: String(accion || "?").slice(0, 24),
        ua: String((req.headers && req.headers["user-agent"]) || "").slice(0, 140),
        origen: String((req.headers && (req.headers.origin || req.headers.referer)) || "").slice(0, 80),
      }),
    }).catch(() => {});
  } catch (e) {}

  try {
    // ── NIÑO: genera una invitación (código corto, válido 24 h, 1 solo uso) ──
    if (accion === "invitar") {
      const uid = await useridDeToken(b.token);
      if (!uid) return res.status(401).json({ error: "Sesión inválida" });
      // higiene: borrar invitaciones vencidas de este niño (filas con code y sin token = invitación)
      fetch(`${cfg.url}/rest/v1/familia_vinculos?usuario_id=eq.${uid}&token=is.null&code_expira=lt.${encodeURIComponent(new Date().toISOString())}`, { method: "DELETE", headers: hdr(cfg) }).catch(() => {});
      const code = codigoCorto(8);
      const expira = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const alias = String(b.alias || "").trim().slice(0, 24) || null;
      const r = await fetch(`${cfg.url}/rest/v1/familia_vinculos`, {
        method: "POST",
        headers: hdr(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify({ usuario_id: uid, code, code_expira: expira, alias }),
      });
      if (!r.ok) throw new Error(`invitar: ${r.status} ${await r.text()}`);
      return res.status(200).json({ ok: true, code, link: `${FAMILIA_ORIGIN}/familia.html?c=${code}` });
    }

    // ── NIÑO: lista sus accesos otorgados (para verlos / revocarlos) ──
    if (accion === "vinculos") {
      const uid = await useridDeToken(b.token);
      if (!uid) return res.status(401).json({ error: "Sesión inválida" });
      const rows = await sbGet(cfg, `familia_vinculos?usuario_id=eq.${uid}&order=creado.desc&select=id,alias,activo,creado,ultimo_acceso,token,code,code_expira`);
      const vinculos = (Array.isArray(rows) ? rows : []).map((v) => ({
        id: v.id, alias: v.alias, activo: v.activo, creado: v.creado, ultimo_acceso: v.ultimo_acceso,
        estado: !v.activo ? "revocado" : v.token ? "activo" : (v.code_expira && Date.parse(v.code_expira) > Date.now() ? "pendiente" : "vencido"),
      }));
      return res.status(200).json({ ok: true, vinculos });
    }

    // ── NIÑO: revoca un acceso propio ──
    if (accion === "revocar") {
      const uid = await useridDeToken(b.token);
      if (!uid) return res.status(401).json({ error: "Sesión inválida" });
      const id = parseInt(b.id, 10);
      if (!id) return res.status(400).json({ error: "Falta id" });
      const r = await fetch(`${cfg.url}/rest/v1/familia_vinculos?id=eq.${id}&usuario_id=eq.${uid}`, {
        method: "PATCH",
        headers: hdr(cfg, { "Content-Type": "application/json" }),
        body: JSON.stringify({ activo: false, token: null }),
      });
      if (!r.ok) throw new Error(`revocar: ${r.status}`);
      return res.status(200).json({ ok: true });
    }

    // ── PADRE: canjea el código por un token persistente ──
    // El código sirve durante 24 h y VARIAS veces (crea un vínculo nuevo cada vez, no se
    // consume): imprescindible en iOS, donde Safari y el ícono de "Agregar a inicio" tienen
    // almacenamiento SEPARADO (hay que vincular cada uno); además sirve para mamá Y papá.
    if (accion === "canjear") {
      const code = String(b.code || "").trim().toUpperCase();
      if (!code) return res.status(400).json({ error: "Falta código" });
      const nowISO = new Date().toISOString();
      // La invitación es la fila con ese code aún vigente (token null la identifica como invitación).
      const rows = await sbGet(cfg, `familia_vinculos?code=eq.${encodeURIComponent(code)}&token=is.null&code_expira=gt.${encodeURIComponent(nowISO)}&select=usuario_id,alias&limit=1`);
      const inv = Array.isArray(rows) && rows[0];
      if (!inv) return res.status(404).json({ error: "Código inválido o vencido. Pídele a tu hijo un código nuevo." });
      const token = tokenLargo();
      const r = await fetch(`${cfg.url}/rest/v1/familia_vinculos`, {
        method: "POST",
        headers: hdr(cfg, { "Content-Type": "application/json", Prefer: "return=representation" }),
        body: JSON.stringify({ usuario_id: inv.usuario_id, token, alias: inv.alias || null, activo: true, ultimo_acceso: nowISO }),
      });
      if (!r.ok) throw new Error(`canjear: ${r.status} ${await r.text()}`);
      const u = await sbGet(cfg, `usuarios?id=eq.${inv.usuario_id}&select=nombre,grado`);
      const nino = (Array.isArray(u) && u[0]) || {};
      return res.status(200).json({ ok: true, token, nino: { nombre: nino.nombre || null, grado: nino.grado || null } });
    }

    // ── PADRE: el panel (SOLO LECTURA) ──
    if (accion === "panel") {
      const ptoken = String(b.ptoken || "").trim();
      if (!ptoken) return res.status(400).json({ error: "Falta token" });
      const vs = await sbGet(cfg, `familia_vinculos?token=eq.${encodeURIComponent(ptoken)}&activo=is.true&select=id,usuario_id&limit=1`);
      const v = Array.isArray(vs) && vs[0];
      if (!v) return res.status(401).json({ error: "Acceso no válido. Pídele a tu hijo un enlace nuevo." });
      const uid = v.usuario_id;
      fetch(`${cfg.url}/rest/v1/familia_vinculos?id=eq.${v.id}`, {
        method: "PATCH", headers: hdr(cfg, { "Content-Type": "application/json" }),
        body: JSON.stringify({ ultimo_acceso: new Date().toISOString() }),
      }).catch(() => {});

      const [perfilR, actividad, notas, tareas, horario, errores, reportes] = await Promise.all([
        sbGet(cfg, `usuarios?id=eq.${uid}&select=nombre,grado,racha_dias,ultimo_acceso,accesos,ia_gasto_dia_usd,ia_limite_dia_usd,ia_ilimitado,ia_dia,reportes_ia_dia`),
        sbGet(cfg, `actividad?usuario_id=eq.${uid}&select=materia,tema,modo,aciertos,total,creado&order=creado.desc&limit=300`),
        sbGet(cfg, `notas?usuario_id=eq.${uid}&select=materia,descripcion,nota,fecha,creado&order=fecha.desc.nullslast,id.desc`),
        sbGet(cfg, `tareas?usuario_id=eq.${uid}&select=materia,descripcion,tipo,fecha,hecha,creado&order=hecha.asc,fecha.asc.nullslast,id.desc&limit=200`),
        sbGet(cfg, `horario?usuario_id=eq.${uid}&select=dia,materia,orden&order=dia.asc,orden.asc`),
        sbGet(cfg, `errores?usuario_id=eq.${uid}&select=materia,tema,pregunta,creado&order=creado.desc&limit=100`),
        sbGet(cfg, `reportes_contenido?usuario_id=eq.${uid}&select=materia,tema,modo,creado&order=creado.desc&limit=50`),
      ]);
      const perfil = (Array.isArray(perfilR) && perfilR[0]) || {};
      return res.status(200).json({
        ok: true, perfil,
        actividad: Array.isArray(actividad) ? actividad : [],
        notas: Array.isArray(notas) ? notas : [],
        tareas: Array.isArray(tareas) ? tareas : [],
        horario: Array.isArray(horario) ? horario : [],
        errores: Array.isArray(errores) ? errores : [],
        reportes: Array.isArray(reportes) ? reportes : [],
      });
    }

    return res.status(400).json({ error: "Acción desconocida" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
