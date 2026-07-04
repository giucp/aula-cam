// api/lab-materias.js — Función serverless de Vercel (runtime Node)
// CUARTO DE PRUEBAS (solo admin, exige ADMIN_KEY). Devuelve el mapa de Cumbre para el
// visor: por materia, sus dominios y temas, cruzando el ÁRBOL (curriculo, grado
// "Cumbre …") con lo CURADO (contenido_curado programa='cumbre') para marcar cada tema
// como ✅ curado (con qué modos) o ⬜ pendiente. Solo lectura; no escribe nada.
//
// POST { clave } → { materias: [{ materia, grado, curados, total, dominios:[{ dominio,
//   intl, temas:[{ tema, curado, modos }] }] }] }

import { normCurado } from "../herramientas/normcurado.mjs";

const GRADO_CUMBRE = "Cumbre Matemática 1er año";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const clave = req.body && req.body.clave;
  if (!process.env.ADMIN_KEY || clave !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(200).json({ materias: [] });

  try {
    // 1) árbol de Cumbre (dominios → temas) desde el currículo
    const rc = await fetch(
      `${cfg.url}/rest/v1/curriculo?grado=eq.${encodeURIComponent(GRADO_CUMBRE)}&select=materia,temas,materia_id&order=materia_id`,
      { headers: hdr(cfg) }
    );
    const cursos = rc.ok ? await rc.json() : [];

    // 2) qué (materia_norm, tema_norm) están curados y en qué modos (solo programa='cumbre')
    const rk = await fetch(
      `${cfg.url}/rest/v1/contenido_curado?programa=eq.cumbre&grado=eq.${encodeURIComponent(GRADO_CUMBRE)}&select=materia_norm,tema_norm,modo`,
      { headers: hdr(cfg) }
    );
    const curadas = rk.ok ? await rk.json() : [];
    const mapaCurado = {}; // "materia_norm||tema_norm" -> Set(modos)
    for (const row of Array.isArray(curadas) ? curadas : []) {
      const k = `${row.materia_norm}||${row.tema_norm}`;
      (mapaCurado[k] || (mapaCurado[k] = new Set())).add(row.modo);
    }

    const materias = (Array.isArray(cursos) ? cursos : []).map((c) => {
      const mnorm = normCurado(c.materia || "");
      const grupos = (c.temas && Array.isArray(c.temas.grupos)) ? c.temas.grupos : [];
      let curados = 0, total = 0;
      const dominios = grupos.map((g) => {
        const temas = (g.temas || []).map((t) => {
          const titulo = t && typeof t === "object" ? t.t : t;
          const modos = mapaCurado[`${mnorm}||${normCurado(titulo)}`];
          total++;
          if (modos) curados++;
          return { tema: titulo, curado: !!modos, modos: modos ? [...modos] : [] };
        });
        return { dominio: g.lapso || "", intl: g.intl || "", temas };
      });
      return { materia: c.materia, grado: GRADO_CUMBRE, curados, total, dominios };
    });

    return res.status(200).json({ materias });
  } catch (e) {
    return res.status(200).json({ materias: [], error: String(e.message || e) });
  }
}
