// herramientas/cargar-curriculo.mjs — HERRAMIENTA LOCAL (no se despliega a Vercel)
// Carga esqueletos de currículo (materias → dominios → temas) en la tabla public.curriculo
// de Supabase. Es el equivalente LOCAL de api/cargar-temario.js, necesario porque el Bot
// Filter de Vercel bloquea llamar el endpoint por curl. Lee SUPABASE_URL / SUPABASE_SERVICE_KEY
// de .env.local. Hace UPSERT por (grado, materia_id) → reejecutable sin duplicar.
//
// Uso:
//   node herramientas/cargar-curriculo.mjs                 → sube TODO el árbol Cumbre
//   node herramientas/cargar-curriculo.mjs --solo=9499     → sube solo esa materia (por id)
//   node herramientas/cargar-curriculo.mjs --aula          → sube el temario oficial del aula
//
// NO usa IA ni Moodle; solo copia la estructura tal cual (igual que el endpoint).

import { cargarEnvLocal } from "./env.mjs";
import { CUMBRE_CURRICULO, nivelCognitivoDeGrado } from "../cumbre-curriculo.mjs";
import { TEMARIO } from "../temario-oficial.mjs";

cargarEnvLocal();

function cfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    console.error("✖ Faltan SUPABASE_URL / SUPABASE_SERVICE_KEY en .env.local");
    process.exit(1);
  }
  return { url: url.replace(/\/+$/, ""), key };
}
function hdr(c) { return { apikey: c.key, Authorization: `Bearer ${c.key}` }; }

async function upsert(c, row) {
  const r = await fetch(`${c.url}/rest/v1/curriculo`, {
    method: "POST",
    headers: { ...hdr(c), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`upsert ${row.grado}/${row.materia_id}: HTTP ${r.status} ${await r.text()}`);
}

async function main() {
  const c = cfg();
  const args = process.argv.slice(2);
  const aula = args.includes("--aula");
  const soloArg = args.find((a) => a.startsWith("--solo="));
  const solo = soloArg ? Number(soloArg.slice("--solo=".length)) : null;
  const ahora = new Date().toISOString();

  // Arma la lista {grado, id, materia, nombre_corto, temas} desde la fuente elegida.
  let filas = [];
  if (aula) {
    for (const [grado, lista] of Object.entries(TEMARIO)) {
      for (const m of lista) {
        filas.push({ grado, materia_id: m.id, materia: m.materia, nombre_corto: m.nombre_corto,
          temas: { fuente: "oficial", grupos: m.grupos || [] } });
      }
    }
  } else {
    for (const m of CUMBRE_CURRICULO.materias) {
      const nivel_cognitivo = m.nivel_cognitivo || nivelCognitivoDeGrado(m.grado);
      filas.push({ grado: m.grado, materia_id: m.id, materia: m.materia, nombre_corto: m.nombre_corto,
        temas: { fuente: "cumbre", nivel_cognitivo, grupos: m.grupos || [] } });
    }
  }
  if (solo != null) filas = filas.filter((f) => f.materia_id === solo);
  if (!filas.length) { console.log("No hay materias que subir (¿--solo con id inexistente?)."); return; }

  let ok = 0;
  for (const f of filas) {
    const nTemas = (f.temas.grupos || []).reduce((s, g) => s + ((g.temas || []).length), 0);
    try {
      await upsert(c, { ...f, actualizado: ahora });
      ok++;
      console.log(`✔ ${f.grado} (id ${f.materia_id}) — ${(f.temas.grupos || []).length} dominios, ${nTemas} temas`);
    } catch (e) {
      console.error(`✖ ${f.grado}: ${e.message}`);
    }
  }
  console.log(`\nListo: ${ok}/${filas.length} materia(s) subida(s).`);
}

main().catch((e) => { console.error("Error fatal:", e.message || e); process.exit(1); });
