// api/curado-info.js — Función serverless de Vercel (runtime Node)
// Le dice a la app qué (materia, tema) tienen contenido curado para un grado, y en
// qué modos. La app lo llama al entrar (una vez por grado) para mostrar el sello
// "revisado" y ofrecer el botón "Guía revisada" solo donde existe. Solo lectura.
//
// POST { grado } → { temas: { "materia_norm||tema_norm": ["resumen","quiz",...] } }
// La app cruza con normCurado(materia)+"||"+normCurado(tema).

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

  const cfg = supabaseCfg();
  if (!cfg) return res.status(200).json({ temas: {} }); // sin Supabase → no hay curado, no rompe

  try {
    const { grado } = req.body || {};
    const filtro = grado ? `grado=eq.${encodeURIComponent(grado)}&` : "";
    const r = await fetch(`${cfg.url}/rest/v1/contenido_curado?${filtro}select=materia_norm,tema_norm,modo`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!r.ok) return res.status(200).json({ temas: {} });
    const rows = await r.json();
    const temas = {};
    for (const row of Array.isArray(rows) ? rows : []) {
      const k = `${row.materia_norm}||${row.tema_norm}`;
      if (!temas[k]) temas[k] = [];
      if (!temas[k].includes(row.modo)) temas[k].push(row.modo);
    }
    return res.status(200).json({ temas });
  } catch (e) {
    return res.status(200).json({ temas: {} }); // nunca rompe: sin curado la app usa IA
  }
}
