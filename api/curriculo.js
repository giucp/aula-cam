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

// Texto de presentación del espacio Cumbre. Default incrustado: la app funciona aunque
// no exista la tabla `config` ni la fila. Si el admin edita la fila 'cumbre_intro' en
// Supabase, esos campos pisan al default (merge). No expone contenido de materias.
const CUMBRE_INTRO_DEFAULT = {
  titulo: "Cumbre 🏔️",
  bajada: "La mejor educación del mundo, para ti.",
  texto_nino:
    "Cumbre es un lugar para aprender más y llegar más alto. Aquí cada materia está pensada como la enseñan los mejores colegios del mundo: aprenderás no solo QUÉ cosas son, sino POR QUÉ funcionan, cómo se conectan entre sí y cómo pensar como lo hacen los que más saben. No es tarea del colegio ni tiene nota: es tuyo, para cuando quieras retarte y descubrir de qué eres capaz.",
  texto_padre:
    "El contenido de Cumbre se construye tomando lo mejor de los sistemas educativos con mejores resultados del mundo —como Singapur, el Bachillerato Internacional (IB) y Japón, entre otros— y adaptándolo con cuidado a la edad de cada niño. Cada tema se organiza como lo hacen esos sistemas (por grandes ideas conectadas, no por temas sueltos) y crece en profundidad grado a grado, de modo que volver a una materia el año siguiente siempre ofrece un nivel más alto. Todo el material es revisado por una persona antes de estar disponible.",
  cierre: "Empieza por donde quieras. En Cumbre no se trata de correr, sino de llegar alto. ✨",
};

async function leerCumbreIntro() {
  const cfg = supabaseCfg();
  if (!cfg) return CUMBRE_INTRO_DEFAULT;
  try {
    const q = `${cfg.url}/rest/v1/config?clave=eq.cumbre_intro&select=valor&limit=1`;
    const r = await fetch(q, { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } });
    const rows = r.ok ? await r.json() : [];
    const val = rows[0] && rows[0].valor;
    return val && typeof val === "object" ? { ...CUMBRE_INTRO_DEFAULT, ...val } : CUMBRE_INTRO_DEFAULT;
  } catch (e) {
    return CUMBRE_INTRO_DEFAULT;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  // Presentación de Cumbre (texto editable; NO contenido de materias).
  if (req.body && req.body.accion === "cumbre_intro") {
    return res.status(200).json({ ok: true, intro: await leerCumbreIntro() });
  }

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
