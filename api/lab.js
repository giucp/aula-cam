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
//   accion "colegios"        → lista de colegios (catálogo de aulas virtuales).
//   accion "colegio_probar" {moodle_url} → prueba si esa URL es un Moodle conectable (app móvil).
//   accion "colegio_guardar" {colegio}   → crea o edita un colegio (upsert). Whitelist estricta.

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

// ───────── COLEGIOS: catálogo de aulas virtuales (alta/edición) ─────────
async function colegios(cfg) {
  const cols = "id,nombre,ciudad,estado,tiene_moodle,moodle_url,mapeo_grados,verificado,creado";
  const r = await fetch(`${cfg.url}/rest/v1/colegios?select=${cols}&order=id.asc`, { headers: hdr(cfg) });
  const rows = r.ok ? await r.json() : [];
  return Array.isArray(rows) ? rows : [];
}

// Prueba (sin credenciales) si una URL es un Moodle con la app móvil habilitada: pega a
// login/token.php con usuario/clave dummy → un Moodle conectable responde JSON con
// "invalidlogin" (las credenciales están mal, pero el servicio existe). Si el servicio móvil
// está apagado, responde otro errorcode; si no es Moodle, no responde JSON.
async function colegioProbar(moodle_url) {
  const base = String(moodle_url || "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(base)) return { ok: false, motivo: "La URL debe empezar con http:// o https://" };
  try {
    const body = new URLSearchParams({ username: "__chispa_probe__", password: "__chispa_probe__", service: "moodle_mobile_app" });
    const r = await fetch(`${base}/login/token.php`, { method: "POST", body, signal: AbortSignal.timeout(12000) });
    const txt = await r.text();
    let j = null; try { j = JSON.parse(txt); } catch {}
    if (!j) return { ok: false, motivo: "No respondió como Moodle (no es JSON). Revisá la URL." };
    if (j.token) return { ok: true, motivo: "Moodle conectable (respondió token)." };
    const code = String(j.errorcode || "");
    const err = String(j.error || "");
    if (/invalidlogin/i.test(code) || /invalid login|nombre de usuario/i.test(err)) {
      return { ok: true, motivo: "Es un Moodle con app móvil habilitada: el login va a funcionar con credenciales reales." };
    }
    return { ok: false, motivo: err || `Moodle respondió pero no es conectable (${code || "sin código"}).`, errorcode: code };
  } catch (e) {
    const m = String(e && e.message || e);
    return { ok: false, motivo: /timeout|abort/i.test(m) ? "No respondió a tiempo (¿URL o servidor caído?)." : "No se pudo contactar la URL: " + m };
  }
}

// Crea o edita un colegio (upsert). Whitelist estricta de columnas; valida coherencia
// (si tiene Moodle exige URL válida) y que el patrón de grados sea un regex válido.
async function colegioGuardar(cfg, c) {
  c = c || {};
  const nombre = String(c.nombre || "").trim();
  if (!nombre) return { ok: false, error: "Falta el nombre del colegio." };
  const tiene = !!c.tiene_moodle;
  const url = tiene ? String(c.moodle_url || "").trim().replace(/\/+$/, "") : null;
  if (tiene && !url) return { ok: false, error: "Si tiene aula Moodle, indicá la URL." };
  if (url && !/^https?:\/\//i.test(url)) return { ok: false, error: "La URL debe empezar con http:// o https://" };
  const row = {
    nombre,
    ciudad: c.ciudad ? String(c.ciudad).trim() : null,
    estado: c.estado ? String(c.estado).trim() : null,
    tiene_moodle: tiene,
    moodle_url: url,
    verificado: !!c.verificado,
    mapeo_grados: null,
  };
  if (tiene && c.mapeo_grados && typeof c.mapeo_grados === "object") {
    const patron = String(c.mapeo_grados.patron || "").trim();
    if (patron) { try { new RegExp(patron); } catch { return { ok: false, error: "El patrón de grados no es un regex válido." }; } }
    const suf = c.mapeo_grados.sufijos || {};
    row.mapeo_grados = { patron: patron || "([1-6])\\s*([GA])\\b", sufijos: { G: String(suf.G || "grado").trim(), A: String(suf.A || "año").trim() } };
  }
  const editing = c.id != null;
  const r = await fetch(
    editing ? `${cfg.url}/rest/v1/colegios?id=eq.${encodeURIComponent(c.id)}` : `${cfg.url}/rest/v1/colegios`,
    { method: editing ? "PATCH" : "POST", headers: { ...hdr(cfg), "Content-Type": "application/json", Prefer: "return=representation" }, body: JSON.stringify(row) }
  );
  if (!r.ok) return { ok: false, error: `No se pudo guardar (HTTP ${r.status}).` };
  const out = await r.json();
  return { ok: true, colegio: Array.isArray(out) ? out[0] : out };
}

// Borra un colegio. Protegido por la FK usuarios.colegio_id: si algún alumno lo tiene
// asignado (p.ej. el CAM), Postgres rechaza el DELETE → devolvemos mensaje claro.
async function colegioBorrar(cfg, id) {
  if (id == null) return { ok: false, error: "Falta el id." };
  const r = await fetch(`${cfg.url}/rest/v1/colegios?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { ...hdr(cfg), Prefer: "return=representation" },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    if (/foreign key|violates|23503/i.test(t)) return { ok: false, error: "No se puede borrar: tiene alumnos vinculados." };
    return { ok: false, error: `No se pudo borrar (HTTP ${r.status}).` };
  }
  const out = await r.json().catch(() => []);
  if (Array.isArray(out) && out.length === 0) return { ok: false, error: "Ese colegio ya no existe." };
  return { ok: true };
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
    if (accion === "colegios") return res.status(200).json({ colegios: await colegios(cfg) });
    if (accion === "colegio_probar") return res.status(200).json(await colegioProbar((req.body || {}).moodle_url));
    if (accion === "colegio_guardar") return res.status(200).json(await colegioGuardar(cfg, (req.body || {}).colegio));
    if (accion === "colegio_borrar") return res.status(200).json(await colegioBorrar(cfg, (req.body || {}).id));
    return res.status(400).json({ error: "accion inválida" });
  } catch (e) {
    return res.status(200).json({ usuarios: [], error: String(e.message || e) });
  }
}
