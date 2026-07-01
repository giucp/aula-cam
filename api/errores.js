// api/errores.js — Función serverless de Vercel (runtime Node)
// "Repasar mis errores": guarda/lista/borra las preguntas de quiz que un alumno
// falló, para que las repase con la explicación. La tabla tiene RLS (solo backend),
// así que la app pasa por aquí. Se identifica al alumno por su usuario_id (userid
// de Moodle). CORS cerrado al dominio de la app.
//
// Uso (POST JSON):
//   { "accion":"guardar", "usuario_id":118, "errores":[ {materia,tema,grado,pregunta,opciones,correcta,elegida,explicacion,figura,numerica} ] }
//   { "accion":"listar",  "usuario_id":118 }
//   { "accion":"resolver","usuario_id":118, "id":42 }

import crypto from "node:crypto";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }
const rec = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) : s; };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(200).json({ ok: true, errores: [] });

  const b = req.body || {};
  const uid = parseInt(b.usuario_id, 10);
  if (!uid) return res.status(400).json({ error: "Falta usuario_id" });

  try {
    if (b.accion === "listar") {
      const q = `${cfg.url}/rest/v1/errores?usuario_id=eq.${uid}&select=id,materia,tema,grado,pregunta,opciones,correcta,elegida,explicacion,figura,numerica,creado&order=creado.desc`;
      const r = await fetch(q, { headers: hdr(cfg) });
      const rows = r.ok ? await r.json() : [];
      return res.status(200).json({ ok: true, errores: Array.isArray(rows) ? rows : [] });
    }

    if (b.accion === "resolver") {
      const id = parseInt(b.id, 10);
      if (!id) return res.status(400).json({ error: "Falta id" });
      await fetch(`${cfg.url}/rest/v1/errores?id=eq.${id}&usuario_id=eq.${uid}`, { method: "DELETE", headers: hdr(cfg) });
      return res.status(200).json({ ok: true });
    }

    if (b.accion === "guardar") {
      const arr = Array.isArray(b.errores) ? b.errores.slice(0, 10) : [];
      const filas = arr
        .filter((e) => e && e.pregunta)
        .map((e) => ({
          usuario_id: uid,
          clave: crypto.createHash("sha1").update(`${uid}|${e.pregunta}`).digest("hex"),
          materia: rec(e.materia, 120) || null,
          tema: rec(e.tema, 200) || null,
          grado: rec(e.grado, 40) || null,
          pregunta: rec(e.pregunta, 1000),
          opciones: Array.isArray(e.opciones) ? e.opciones.slice(0, 6).map((o) => rec(o, 400)) : null,
          correcta: Number.isInteger(e.correcta) ? e.correcta : null,
          elegida: Number.isInteger(e.elegida) ? e.elegida : null,
          explicacion: rec(e.explicacion, 3000) || null,
          figura: typeof e.figura === "string" ? rec(e.figura, 20000) : null,
          numerica: !!e.numerica,
        }));
      if (filas.length) {
        await fetch(`${cfg.url}/rest/v1/errores`, {
          method: "POST",
          headers: { ...hdr(cfg), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify(filas),
        });
      }
      return res.status(200).json({ ok: true, guardados: filas.length });
    }

    return res.status(400).json({ error: "acción inválida" });
  } catch (e) {
    return res.status(200).json({ ok: true, errores: [], error: String(e.message || e) });
  }
}
