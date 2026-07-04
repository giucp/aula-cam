// api/lab-tema.js — Función serverless de Vercel (runtime Node)
// CUARTO DE PRUEBAS (solo admin, exige ADMIN_KEY). Devuelve el contenido curado de un
// tema de Cumbre para renderizarlo tal cual lo verá la alumna. Solo lectura.
//
// POST { clave, materia, tema } → { modos: { resumen:<doc>, retos:<{items}>, quiz:<{items}> } }
// (materia/tema son los nombres del árbol; se normalizan para buscar. grado fijo Cumbre.)

import { normCurado } from "../herramientas/normcurado.mjs";

const GRADO_CUMBRE = "Cumbre Matemática 1er año";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { clave, materia, tema } = req.body || {};
  if (!process.env.ADMIN_KEY || clave !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false });
  if (!materia || !tema) return res.status(400).json({ error: "Falta materia o tema" });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(200).json({ modos: {} });

  try {
    const q =
      `programa=eq.cumbre` +
      `&grado=eq.${encodeURIComponent(GRADO_CUMBRE)}` +
      `&materia_norm=eq.${encodeURIComponent(normCurado(materia))}` +
      `&tema_norm=eq.${encodeURIComponent(normCurado(tema))}` +
      `&select=modo,contenido`;
    const r = await fetch(`${cfg.url}/rest/v1/contenido_curado?${q}`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    const rows = r.ok ? await r.json() : [];
    const modos = {};
    for (const row of Array.isArray(rows) ? rows : []) modos[row.modo] = row.contenido;
    return res.status(200).json({ modos });
  } catch (e) {
    return res.status(200).json({ modos: {}, error: String(e.message || e) });
  }
}
