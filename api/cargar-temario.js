// api/cargar-temario.js — Función serverless de Vercel (runtime Node)
// Carga el TEMARIO OFICIAL de referencia (temario-oficial.mjs) en la tabla
// public.curriculo de Supabase. Es una herramienta de administración: protegido
// por CAPTURA_SECRET. No usa IA ni Moodle; solo hace UPSERT de filas.
//
// Uso (POST JSON): { "secret":"…" }
// Reejecutable: hace upsert por (grado, materia_id), así correrlo de nuevo
// simplemente actualiza. Si luego se captura el temario REAL del colegio para
// esos grados, ese upsert reemplaza estas filas (mismo grado + materia_id).

import { TEMARIO } from "../temario-oficial.mjs";
import { CUMBRE_CURRICULO } from "../cumbre-curriculo.mjs";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }

async function upsert(cfg, row) {
  const r = await fetch(`${cfg.url}/rest/v1/curriculo`, {
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

  // Con { secret, cumbre:true } carga el ÁRBOL de Cumbre (currículo de élite) en vez del
  // temario del aula. Reusa el mismo upsert (curriculo, PK grado+materia_id).
  if (req.body && req.body.cumbre) {
    try {
      const ahora = new Date().toISOString();
      const { materias } = CUMBRE_CURRICULO;
      const out = [];
      for (const m of materias) {
        const totalTemas = (m.grupos || []).reduce((s, g) => s + ((g.temas || []).length), 0);
        await upsert(cfg, {
          grado: m.grado, materia_id: m.id, materia: m.materia, nombre_corto: m.nombre_corto,
          temas: { fuente: "cumbre", grupos: m.grupos || [] }, actualizado: ahora,
        });
        out.push({ materia: m.materia, grado: m.grado, dominios: (m.grupos || []).length, temas: totalTemas });
      }
      return res.status(200).json({ ok: true, cumbre: true, materias: out });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  try {
    const ahora = new Date().toISOString();
    const porGrado = {};
    const materias = [];
    let n = 0;
    for (const [grado, lista] of Object.entries(TEMARIO)) {
      for (const m of lista) {
        const totalTemas = (m.grupos || []).reduce((s, g) => s + ((g.temas || []).length), 0);
        // Los temas pueden ser string (formato viejo) o {t,d} (con enfoque para la IA);
        // se guardan tal cual — el front acepta ambos y usa "d" como contexto.
        await upsert(cfg, {
          grado,
          materia_id: m.id,
          materia: m.materia,
          nombre_corto: m.nombre_corto,
          temas: { fuente: "oficial", grupos: m.grupos || [] },
          actualizado: ahora,
        });
        n++;
        porGrado[grado] = (porGrado[grado] || 0) + 1;
        materias.push({ grado, materia: m.materia, temas: totalTemas });
      }
    }

    // Confirmación: cuántas filas hay ahora en la tabla, por grado.
    let enTabla = null;
    try {
      const q = await fetch(`${cfg.url}/rest/v1/curriculo?select=grado`, { headers: hdr(cfg) });
      if (q.ok) {
        const rows = await q.json();
        enTabla = {};
        for (const r of rows) enTabla[r.grado] = (enTabla[r.grado] || 0) + 1;
      }
    } catch (e) { /* opcional */ }

    return res.status(200).json({ ok: true, cargadas: n, porGrado, enTabla, materias });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
