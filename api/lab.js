// api/lab.js — Función serverless de Vercel (runtime Node)
// PANEL DE ADMINISTRACIÓN (solo admin), oculto en la ruta #lab. Un único endpoint con
// "accion" para no gastar cuota de funciones serverless (el plan Hobby permite máx. 12).
// Todo exige la clave admin (ADMIN_KEY, validada server-side).
//
// POST { accion, clave, ... }:
//   accion "check"       → { ok:true } si la clave es correcta (401 si no).
//   accion "usuarios"    → lista de alumnos con estado de acceso y consumo de IA de HOY.
//   accion "usuario_set" {id,campos} → habilita/pausa (autorizado), pone ilimitado (ia_ilimitado)
//                          o cambia el tope diario (ia_limite_dia_usd). Whitelist estricta.

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }

// día civil de Venezuela (UTC-4, sin horario de verano) como "YYYY-MM-DD".
function diaCaracas() {
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

// Lista de alumnos con su estado de acceso y su consumo de IA. El "gasto de hoy" es
// EFECTIVO: si la fila quedó en un día anterior, muestra 0 (el backend lo reinicia al
// próximo gasto real vía RPC sumar_gasto_ia).
async function usuarios(cfg) {
  const cols =
    "id,nombre,grado,nombre_corto,ultimo_acceso,accesos,autorizado," +
    "ia_ilimitado,ia_limite_dia_usd,ia_gasto_dia_usd,ia_dia";
  const r = await fetch(
    `${cfg.url}/rest/v1/usuarios?select=${cols}&order=ultimo_acceso.desc`,
    { headers: hdr(cfg) }
  );
  const rows = r.ok ? await r.json() : [];
  const hoy = diaCaracas();
  return (Array.isArray(rows) ? rows : []).map((u) => ({
    id: u.id,
    nombre: u.nombre || "",
    grado: u.grado || "",
    nombre_corto: u.nombre_corto || "",
    ultimo_acceso: u.ultimo_acceso || null,
    accesos: u.accesos || 0,
    autorizado: !!u.autorizado,
    ia_ilimitado: !!u.ia_ilimitado,
    ia_limite_dia_usd: Number(u.ia_limite_dia_usd || 0),
    gasto_hoy: u.ia_dia === hoy ? Number(u.ia_gasto_dia_usd || 0) : 0,
    ia_dia: u.ia_dia || null,
  }));
}

// Cambia SOLO campos de administración (whitelist): habilitar/pausar acceso, poner
// ilimitado, o el tope diario en USD (acotado 0..5 por seguridad). Ignora cualquier
// otra columna que venga en el body.
async function usuarioSet(cfg, id, campos) {
  const patch = {};
  if (typeof campos.autorizado === "boolean") patch.autorizado = campos.autorizado;
  if (typeof campos.ia_ilimitado === "boolean") patch.ia_ilimitado = campos.ia_ilimitado;
  if (campos.ia_limite_dia_usd != null && isFinite(Number(campos.ia_limite_dia_usd))) {
    patch.ia_limite_dia_usd = Math.max(0, Math.min(5, Number(campos.ia_limite_dia_usd)));
  }
  if (!Object.keys(patch).length) return { ok: false, error: "Sin cambios válidos" };
  const r = await fetch(
    `${cfg.url}/rest/v1/usuarios?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { ...hdr(cfg), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patch),
    }
  );
  if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
  const out = await r.json();
  return { ok: true, usuario: Array.isArray(out) ? out[0] : null };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { accion, clave } = req.body || {};
  if (!process.env.ADMIN_KEY || clave !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false });
  if (accion === "check") return res.status(200).json({ ok: true });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(200).json({ usuarios: [] });
  try {
    if (accion === "usuarios") return res.status(200).json({ usuarios: await usuarios(cfg) });
    if (accion === "usuario_set") {
      const { id, campos } = req.body || {};
      if (id == null || !campos || typeof campos !== "object")
        return res.status(400).json({ ok: false, error: "Falta id o campos" });
      return res.status(200).json(await usuarioSet(cfg, id, campos));
    }
    return res.status(400).json({ error: "accion inválida" });
  } catch (e) {
    return res.status(200).json({ usuarios: [], error: String(e.message || e) });
  }
}
