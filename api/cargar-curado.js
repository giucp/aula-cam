// api/cargar-curado.js — Función serverless de Vercel (runtime Node)
// Endpoint de ADMINISTRACIÓN: sube bancos de contenido curado a la tabla
// contenido_curado usando las llaves de Supabase que YA están en Vercel (así el
// administrador no necesita el service key localmente). Protegido por CAPTURA_SECRET.
//
// Uso (POST JSON):
//   { "secret":"…", "banco": { …un banco… } }
//   { "secret":"…", "bancos": [ {…}, {…} ] }
// Cada banco: { materia, tema, grado, fuentes?, resumen?, retos?, quiz?, examen? }
// (mismo formato que curado/*.json). Reejecutable: upsert por (materia_norm,
// tema_norm, modo, grado). Devuelve la clave normalizada con la que quedó cada uno
// (para confirmar que casa con lo que manda la app).

import { filasDeBanco } from "../herramientas/curado-lib.mjs";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
async function upsert(cfg, fila) {
  // on_conflict apunta al índice único del banco: sin él, merge-duplicates solo
  // resuelve por la PK (id) y RE-subir un banco existente daba 409 duplicate key.
  const r = await fetch(`${cfg.url}/rest/v1/contenido_curado?on_conflict=materia_norm,tema_norm,modo,grado`, {
    method: "POST",
    headers: {
      apikey: cfg.key, Authorization: `Bearer ${cfg.key}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(fila),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { secret, banco, bancos } = req.body || {};
  if (!process.env.CAPTURA_SECRET || secret !== process.env.CAPTURA_SECRET) {
    return res.status(403).json({ error: "No autorizado" });
  }
  const cfg = supabaseCfg();
  if (!cfg) return res.status(500).json({ error: "Falta configurar SUPABASE_URL / SUPABASE_SERVICE_KEY" });

  const lista = Array.isArray(bancos) ? bancos : banco ? [banco] : [];
  if (!lista.length) return res.status(400).json({ error: "Falta 'banco' o 'bancos'" });

  const ahora = new Date().toISOString();
  const resultados = [];
  let subidas = 0;
  for (const doc of lista) {
    let info;
    try {
      info = filasDeBanco(doc, ahora);
    } catch (e) {
      resultados.push({ tema: doc && doc.tema, error: e.message });
      continue;
    }
    const errores = [];
    let ok = 0;
    for (const fila of info.filas) {
      try { await upsert(cfg, fila); ok++; subidas++; }
      catch (e) { errores.push(`${fila.modo}: ${e.message}`); }
    }
    resultados.push({
      materia_norm: info.materia_norm,
      tema_norm: info.tema_norm,
      grado: info.grado,
      modos: info.filas.map((f) => f.modo),
      subidas: ok,
      clave: `${info.materia_norm} | ${info.tema_norm} | ${info.grado}`,
      avisos: info.avisos.length ? info.avisos : undefined,
      errores: errores.length ? errores : undefined,
    });
  }
  return res.status(200).json({ ok: true, subidas, resultados });
}
