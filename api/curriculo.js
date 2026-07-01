// api/curriculo.js — Función serverless de Vercel (runtime Node)
// Devuelve el CURRÍCULO guardado (materias + temas) de un grado, para que la app
// pueda ofrecer "adelantar materias en vacaciones" con el temario ya reposado en
// Supabase. Lectura pública (los temas no son secretos); usa la service key solo
// del lado del servidor porque la tabla tiene RLS.
//
// Uso (POST JSON): { "grado": "5to grado" }

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const grado = req.body && req.body.grado;
  if (!grado) return res.status(400).json({ error: "Falta el campo 'grado'" });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(200).json({ ok: true, grado, materias: [] });

  try {
    const q = `${cfg.url}/rest/v1/curriculo?grado=eq.${encodeURIComponent(grado)}` +
      `&select=materia,nombre_corto,temas,materia_id&order=materia_id`;
    const r = await fetch(q, { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } });
    const rows = r.ok ? await r.json() : [];
    return res.status(200).json({ ok: true, grado, materias: Array.isArray(rows) ? rows : [] });
  } catch (e) {
    return res.status(200).json({ ok: true, grado, materias: [], error: String(e.message || e) });
  }
}
