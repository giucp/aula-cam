// api/agenda.js — Función serverless de Vercel (runtime Node)
// Escritorio diario del alumno: horario semanal + tareas (con tipo tarea/trabajo/
// examen). Identificado por usuario_id (userid de Moodle), mismo patrón de riesgo
// aceptado que errores/actividad (app familiar; futuro: validar token).
//
// Acciones (POST JSON):
//   { accion:"todo",        usuario_id }                        → { horario:[], tareas:[] }
//   { accion:"horario_set", usuario_id, items:[{dia,materia,orden}] } → reemplaza el horario
//   { accion:"tarea_guardar", usuario_id, tarea:{materia,descripcion,tipo,fecha} } → crea
//   { accion:"tarea_hecha",  usuario_id, id, hecha }            → marca hecha / pendiente
//   { accion:"tarea_borrar", usuario_id, id }                   → borra
// Si las tablas no existen aún (falta correr supabase-agenda.sql), degrada:
// devuelve listas vacías / ok:false sin romper la app.

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg, extra) {
  return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", ...extra };
}

const TIPOS = new Set(["tarea", "trabajo", "examen"]);
const LIMITE_DIA_USD = 0.20;
function diaIA() { return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10); } // día civil de Caracas
// Estado de IA (batería) del alumno para el home. Degrada a {ilimitado:true} si faltan
// columnas/fila → la app oculta el gauge (mismo criterio que generar.js).
async function estadoIA(cfg, uid) {
  try {
    const r = await fetch(`${cfg.url}/rest/v1/usuarios?id=eq.${uid}&select=ia_ilimitado,ia_limite_dia_usd,ia_gasto_dia_usd,ia_dia`, { headers: hdr(cfg) });
    const u = r.ok ? (await r.json())[0] : null;
    if (!u || u.ia_ilimitado) return { ilimitado: true };
    const limite = u.ia_limite_dia_usd == null ? LIMITE_DIA_USD : Number(u.ia_limite_dia_usd);
    const gasto = u.ia_dia === diaIA() ? Number(u.ia_gasto_dia_usd || 0) : 0;
    return { ilimitado: false, limite, gasto, restante: Math.max(0, limite - gasto) };
  } catch (e) {
    return { ilimitado: true };
  }
}
// fecha "YYYY-MM-DD" o null (evita basura en la columna date)
function fechaValida(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const cfg = supabaseCfg();
  const { accion, usuario_id } = req.body || {};
  const uid = parseInt(usuario_id, 10);
  if (!cfg || !Number.isInteger(uid)) {
    return res.status(200).json({ ok: false, horario: [], tareas: [] }); // degrada sin romper
  }

  try {
    if (accion === "todo") {
      const [h, t, n, ia] = await Promise.all([
        fetch(`${cfg.url}/rest/v1/horario?usuario_id=eq.${uid}&select=dia,materia,orden&order=dia,orden`, { headers: hdr(cfg) }),
        fetch(`${cfg.url}/rest/v1/tareas?usuario_id=eq.${uid}&select=id,materia,descripcion,tipo,fecha,hecha&order=hecha,fecha.asc.nullslast,id.desc&limit=200`, { headers: hdr(cfg) }),
        fetch(`${cfg.url}/rest/v1/notas?usuario_id=eq.${uid}&select=id,materia,descripcion,nota,fecha&order=fecha.desc.nullslast,id.desc&limit=100`, { headers: hdr(cfg) }),
        estadoIA(cfg, uid),
      ]);
      return res.status(200).json({
        ok: true,
        horario: h.ok ? await h.json() : [],
        tareas: t.ok ? await t.json() : [],
        notas: n.ok ? await n.json() : [],
        ia,
      });
    }

    if (accion === "horario_set") {
      const items = (Array.isArray(req.body.items) ? req.body.items : [])
        .map((x) => ({
          usuario_id: uid,
          dia: parseInt(x && x.dia, 10),
          materia: String((x && x.materia) || "").trim().slice(0, 80),
          orden: parseInt(x && x.orden, 10) || 1,
        }))
        .filter((x) => Number.isInteger(x.dia) && x.dia >= 1 && x.dia <= 7 && x.materia);
      // reemplazo completo: borrar lo del usuario e insertar lo nuevo
      const del = await fetch(`${cfg.url}/rest/v1/horario?usuario_id=eq.${uid}`, { method: "DELETE", headers: hdr(cfg) });
      if (!del.ok) throw new Error(`delete horario: HTTP ${del.status}`);
      if (items.length) {
        const ins = await fetch(`${cfg.url}/rest/v1/horario`, { method: "POST", headers: hdr(cfg), body: JSON.stringify(items) });
        if (!ins.ok) throw new Error(`insert horario: HTTP ${ins.status} ${await ins.text()}`);
      }
      return res.status(200).json({ ok: true, guardadas: items.length });
    }

    if (accion === "tarea_guardar") {
      const t = req.body.tarea || {};
      const fila = {
        usuario_id: uid,
        materia: String(t.materia || "").trim().slice(0, 80) || null,
        descripcion: String(t.descripcion || "").trim().slice(0, 300),
        tipo: TIPOS.has(t.tipo) ? t.tipo : "tarea",
        fecha: fechaValida(t.fecha),
      };
      // descripción OPCIONAL: se puede anotar solo materia + tipo (la fila usa el tipo como título)
      const r = await fetch(`${cfg.url}/rest/v1/tareas`, {
        method: "POST", headers: hdr(cfg, { Prefer: "return=representation" }), body: JSON.stringify(fila),
      });
      if (!r.ok) throw new Error(`insert tarea: HTTP ${r.status} ${await r.text()}`);
      const rows = await r.json();
      return res.status(200).json({ ok: true, tarea: rows[0] || null });
    }

    if (accion === "tarea_hecha") {
      const id = parseInt(req.body.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "Falta id" });
      const r = await fetch(`${cfg.url}/rest/v1/tareas?id=eq.${id}&usuario_id=eq.${uid}`, {
        method: "PATCH", headers: hdr(cfg), body: JSON.stringify({ hecha: !!req.body.hecha }),
      });
      if (!r.ok) throw new Error(`patch tarea: HTTP ${r.status}`);
      return res.status(200).json({ ok: true });
    }

    if (accion === "nota_guardar") {
      const t = req.body.nota || {};
      const valor = Number(t.nota);
      if (!Number.isFinite(valor) || valor < 0 || valor > 20) {
        return res.status(400).json({ error: "La nota debe ser un número entre 0 y 20" });
      }
      const fila = {
        usuario_id: uid,
        materia: String(t.materia || "").trim().slice(0, 80) || null,
        descripcion: String(t.descripcion || "").trim().slice(0, 120) || null,
        nota: Math.round(valor * 10) / 10,
        fecha: fechaValida(t.fecha),
      };
      const r = await fetch(`${cfg.url}/rest/v1/notas`, {
        method: "POST", headers: hdr(cfg, { Prefer: "return=representation" }), body: JSON.stringify(fila),
      });
      if (!r.ok) throw new Error(`insert nota: HTTP ${r.status} ${await r.text()}`);
      const rows = await r.json();
      return res.status(200).json({ ok: true, nota: rows[0] || null });
    }

    if (accion === "nota_borrar") {
      const id = parseInt(req.body.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "Falta id" });
      const r = await fetch(`${cfg.url}/rest/v1/notas?id=eq.${id}&usuario_id=eq.${uid}`, {
        method: "DELETE", headers: hdr(cfg),
      });
      if (!r.ok) throw new Error(`delete nota: HTTP ${r.status}`);
      return res.status(200).json({ ok: true });
    }

    if (accion === "tarea_borrar") {
      const id = parseInt(req.body.id, 10);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "Falta id" });
      const r = await fetch(`${cfg.url}/rest/v1/tareas?id=eq.${id}&usuario_id=eq.${uid}`, {
        method: "DELETE", headers: hdr(cfg),
      });
      if (!r.ok) throw new Error(`delete tarea: HTTP ${r.status}`);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acción inválida" });
  } catch (e) {
    // tablas sin crear u otro fallo → no romper la app
    return res.status(200).json({ ok: false, error: String(e.message || e), horario: [], tareas: [] });
  }
}
