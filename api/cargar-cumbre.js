// api/cargar-cumbre.js — Función serverless de Vercel (runtime Node)
// Endpoint de ADMINISTRACIÓN: carga el ÁRBOL de Cumbre (cumbre-curriculo.mjs) en la
// tabla `curriculo`, reusando el mismo sistema del "próximo año". Guarda solo la
// estructura (dominios → temas); NO carga contenido curado (eso va por cargar-curado).
// Protegido por CAPTURA_SECRET. Reejecutable: upsert por (grado, materia_id).
//
// El grado "Cumbre Matemática 1er año" es propio y NO lo pide el flujo de las alumnas
// (siguienteGradoLabel nunca lo devuelve), así que queda guardado pero invisible para
// ellas hasta que se construya la entrada a Cumbre.
//
// Uso (POST JSON): { "secret":"…" }

import { CUMBRE_CURRICULO } from "../cumbre-curriculo.mjs";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }

async function upsert(cfg, row) {
  const r = await fetch(`${cfg.url}/rest/v1/curriculo?on_conflict=grado,materia_id`, {
    method: "POST",
    headers: { ...hdr(cfg), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`upsert ${row.grado}/${row.materia_id}: HTTP ${r.status} ${await r.text()}`);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { secret } = req.body || {};
  if (!process.env.CAPTURA_SECRET || secret !== process.env.CAPTURA_SECRET) {
    return res.status(403).json({ error: "No autorizado" });
  }
  const cfg = supabaseCfg();
  if (!cfg) return res.status(500).json({ error: "Falta configurar SUPABASE_URL / SUPABASE_SERVICE_KEY" });

  try {
    const ahora = new Date().toISOString();
    const { grado, materias } = CUMBRE_CURRICULO;
    const resumen = [];
    for (const m of materias) {
      const totalTemas = (m.grupos || []).reduce((s, g) => s + ((g.temas || []).length), 0);
      await upsert(cfg, {
        grado,
        materia_id: m.id,
        materia: m.materia,
        nombre_corto: m.nombre_corto,
        temas: { fuente: "cumbre", grupos: m.grupos || [] },
        actualizado: ahora,
      });
      resumen.push({ materia: m.materia, dominios: (m.grupos || []).length, temas: totalTemas });
    }
    return res.status(200).json({ ok: true, grado, materias: resumen });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
