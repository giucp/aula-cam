// api/lab.js — Función serverless de Vercel (runtime Node)
// CUARTO DE PRUEBAS (solo admin). Un único endpoint con "accion" para no gastar cuota de
// funciones serverless (el plan Hobby permite máx. 12). Todo exige la clave admin
// (ADMIN_KEY, validada server-side) y es SOLO LECTURA de contenido de Cumbre.
//
// POST { accion, clave, ... }:
//   accion "check"    → { ok:true } si la clave es correcta (401 si no).
//   accion "materias" → mapa: por materia, dominios y temas, con estado curado/pendiente.
//   accion "tema" {materia,tema} → { modos: { resumen, retos, quiz, examen } } de ese tema.

import { normCurado } from "../herramientas/normcurado.mjs";

const GRADO_CUMBRE = "Cumbre Matemática 1er año";

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }

async function materias(cfg) {
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
  const mapaCurado = {};
  for (const row of Array.isArray(curadas) ? curadas : []) {
    const k = `${row.materia_norm}||${row.tema_norm}`;
    (mapaCurado[k] || (mapaCurado[k] = new Set())).add(row.modo);
  }
  return (Array.isArray(cursos) ? cursos : []).map((c) => {
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
}

async function tema(cfg, materia, tm) {
  const q =
    `programa=eq.cumbre` +
    `&grado=eq.${encodeURIComponent(GRADO_CUMBRE)}` +
    `&materia_norm=eq.${encodeURIComponent(normCurado(materia))}` +
    `&tema_norm=eq.${encodeURIComponent(normCurado(tm))}` +
    `&select=modo,contenido`;
  const r = await fetch(`${cfg.url}/rest/v1/contenido_curado?${q}`, { headers: hdr(cfg) });
  const rows = r.ok ? await r.json() : [];
  const modos = {};
  for (const row of Array.isArray(rows) ? rows : []) modos[row.modo] = row.contenido;
  return modos;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const { accion, clave } = req.body || {};
  if (!process.env.ADMIN_KEY || clave !== process.env.ADMIN_KEY) return res.status(401).json({ ok: false });
  if (accion === "check") return res.status(200).json({ ok: true });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(200).json({ materias: [], modos: {} });
  try {
    if (accion === "materias") return res.status(200).json({ materias: await materias(cfg) });
    if (accion === "tema") {
      const { materia, tema: tm } = req.body || {};
      if (!materia || !tm) return res.status(400).json({ error: "Falta materia o tema" });
      return res.status(200).json({ modos: await tema(cfg, materia, tm) });
    }
    return res.status(400).json({ error: "accion inválida" });
  } catch (e) {
    return res.status(200).json({ materias: [], modos: {}, error: String(e.message || e) });
  }
}
