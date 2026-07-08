// api/actividad.js — Función serverless de Vercel (runtime Node)
// Registro de actividad por niño para la RUTA DE APRENDIZAJE y el PROGRESO por tema.
// Mismo patrón que api/errores.js (CORS cerrado, service key desde env, nunca romper
// por errores de Supabase). La tabla `actividad` tiene RLS (solo backend).
//
// Uso (POST JSON):
//   { "accion":"guardar", "usuario_id":118, "materia":"Matemática", "tema":"Fracciones",
//     "grado":"5to grado", "modo":"quiz", "aciertos":8, "total":10 }
//   { "accion":"resumen", "usuario_id":118 }  → { progreso:[{materia,tema,modos[],quizMejor}] }

const MODOS_VALIDOS = new Set(["resumen", "retos", "quiz", "examen"]);
const norm = (s) => String(s == null ? "" : s).replace(/\s+/g, " ").trim().toLowerCase();
const rec = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n) : s; };

function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}
function hdr(cfg) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }; }

// ── MURO (mini red social sana) ────────────────────────────────────────────────
// Set de reacciones CURADO y positivo (no se puede usar para molestar). El texto del
// anuncio lo compone el SERVIDOR a partir de datos estructurados (nunca texto libre del
// cliente), y NUNCA incluye notas de examen — solo lo que el niño HIZO.
const MURO_EMOJIS = new Set(["👏", "🔥", "💪", "🎉", "⭐"]);
const MURO_TIPOS  = new Set(["practica", "quiz", "examen", "cumbre", "racha", "sinapsis"]);
function textoMuro(tipo, materia, tema, meta) {
  const m = materia ? String(materia) : "";
  const t = tema ? String(tema) : "";
  const conTema = t ? `: ${t}` : "";
  switch (tipo) {
    case "practica": return `practicó ${m}${conTema} 💪`;
    case "quiz":     return `resolvió un quiz de ${m}${conTema} ✅`;
    case "examen":   return `hizo un examen de ${m}${conTema} 📝`;
    case "cumbre":   return `avanzó en «${t || m}» de ${m} en Cumbre 🏔️`;
    case "racha":    return `lleva una racha de ${(meta && meta.dias) || ""} días seguidos 🔥`;
    case "sinapsis": return `jugó el reto diario de Sinapsis: ${(meta && meta.score) || 0} puntos 🧠`;
    default: return "";
  }
}
// Inicio del día civil de Venezuela (UTC-4) en ISO UTC, para el dedup "1 por día".
function inicioHoyCaracasISO() {
  const car = new Date(Date.now() - 4 * 3600 * 1000);
  return `${car.toISOString().slice(0, 10)}T04:00:00.000Z`; // 00:00 Caracas = 04:00 UTC
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  const cfg = supabaseCfg();
  if (!cfg) return res.status(200).json({ ok: true, progreso: [] });

  const b = req.body || {};
  const uid = parseInt(b.usuario_id, 10);
  if (!uid) return res.status(400).json({ error: "Falta usuario_id" });

  try {
    if (b.accion === "guardar") {
      const modo = b.modo;
      const tema = rec(b.tema, 200);
      if (!MODOS_VALIDOS.has(modo) || !tema) return res.status(400).json({ error: "modo o tema inválido" });
      let aciertos = null, total = null;
      if (modo === "quiz" && Number.isInteger(b.aciertos) && Number.isInteger(b.total) &&
          b.total > 0 && b.aciertos >= 0 && b.aciertos <= b.total) {
        aciertos = b.aciertos; total = b.total;
      }
      await fetch(`${cfg.url}/rest/v1/actividad`, {
        method: "POST",
        headers: { ...hdr(cfg), "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: uid, materia: rec(b.materia, 120) || null, tema,
          grado: rec(b.grado, 40) || null, modo, aciertos, total,
        }),
      });
      return res.status(200).json({ ok: true });
    }

    if (b.accion === "resumen") {
      const q = `${cfg.url}/rest/v1/actividad?usuario_id=eq.${uid}` +
        `&select=materia,tema,modo,aciertos,total&order=creado.desc&limit=2000`;
      const r = await fetch(q, { headers: hdr(cfg) });
      const rows = r.ok ? await r.json() : [];
      // Agregar por (materia,tema) normalizado; conservar los textos de la fila más
      // reciente (las filas vienen en orden descendente, así que la 1ª es la más nueva).
      const map = new Map();
      for (const row of Array.isArray(rows) ? rows : []) {
        const key = norm(row.materia) + "|" + norm(row.tema);
        let e = map.get(key);
        if (!e) { e = { materia: row.materia, tema: row.tema, modos: new Set(), quizMejor: null }; map.set(key, e); }
        if (row.modo) e.modos.add(row.modo);
        if (row.modo === "quiz" && Number.isInteger(row.total) && row.total > 0 && Number.isInteger(row.aciertos)) {
          const v = row.aciertos / row.total;
          if (e.quizMejor == null || v > e.quizMejor) e.quizMejor = v;
        }
      }
      const progreso = [...map.values()].map((e) => ({
        materia: e.materia, tema: e.tema, modos: [...e.modos], quizMejor: e.quizMejor,
      }));
      return res.status(200).json({ ok: true, progreso });
    }

    // ── Notas del "Demuestra" (quiz) de CUMBRE — tabla aparte cumbre_notas, no se mezcla
    //    con el progreso del aula. Se guarda cada intento; la MEJOR se agrega al leer.
    if (b.accion === "cumbre_guardar") {
      const tema = rec(b.tema, 200);
      if (!tema || !Number.isInteger(b.aciertos) || !Number.isInteger(b.total) ||
          b.total <= 0 || b.aciertos < 0 || b.aciertos > b.total) {
        return res.status(400).json({ error: "datos inválidos" });
      }
      await fetch(`${cfg.url}/rest/v1/cumbre_notas`, {
        method: "POST",
        headers: { ...hdr(cfg), "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: uid, materia: rec(b.materia, 120) || null, tema,
          aciertos: b.aciertos, total: b.total,
        }),
      });
      return res.status(200).json({ ok: true });
    }

    if (b.accion === "cumbre_resumen") {
      const q = `${cfg.url}/rest/v1/cumbre_notas?usuario_id=eq.${uid}` +
        `&select=materia,tema,aciertos,total&order=creado.desc&limit=3000`;
      const r = await fetch(q, { headers: hdr(cfg) });
      const rows = r.ok ? await r.json() : [];
      const map = new Map();
      for (const row of Array.isArray(rows) ? rows : []) {
        if (!Number.isInteger(row.total) || row.total <= 0 || !Number.isInteger(row.aciertos)) continue;
        const key = norm(row.materia) + "|" + norm(row.tema);
        const v = row.aciertos / row.total;
        const e = map.get(key);
        if (!e) map.set(key, { materia: row.materia, tema: row.tema, quizMejor: v });
        else if (v > e.quizMejor) e.quizMejor = v;
      }
      return res.status(200).json({ ok: true, notas: [...map.values()] });
    }

    // ── Reporte de contenido malo: cualquier usuario marca un ejercicio/pregunta de
    //    Practica/Demuestra/Examen como malo. Queda en reportes_contenido (lo revisamos
    //    a mano) y el front regenera SOLO ese ítem. Resumen y Cumbre quedan fuera.
    if (b.accion === "reportar_item") {
      const modo = String(b.modo || "");
      const item = b.item;
      if (!["retos", "quiz", "examen"].includes(modo) || !item || typeof item !== "object" || Array.isArray(item)) {
        return res.status(400).json({ error: "reporte inválido" });
      }
      await fetch(`${cfg.url}/rest/v1/reportes_contenido`, {
        method: "POST",
        headers: { ...hdr(cfg), "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario_id: uid, materia: rec(b.materia, 120) || null, tema: rec(b.tema, 200) || null,
          grado: rec(b.grado, 40) || null, modo, origen: b.origen === "guia" ? "guia" : "ia",
          item,
        }),
      });
      return res.status(200).json({ ok: true });
    }

    // ── Novedades del aula: "foto" de lo último que vio el alumno, guardada POR USUARIO
    //    (no por aparato) en usuarios.aula_snap (jsonb). Así la alerta 🆕 es consistente
    //    entre PC y celular y se apaga en todos lados al abrir la materia.
    if (b.accion === "aula_snap_get") {
      const r = await fetch(`${cfg.url}/rest/v1/usuarios?id=eq.${uid}&select=aula_snap`, { headers: hdr(cfg) });
      const rows = r.ok ? await r.json() : [];
      const snap = (Array.isArray(rows) && rows[0] && rows[0].aula_snap) || {};
      return res.status(200).json({ ok: true, snap });
    }
    if (b.accion === "aula_snap_set") {
      const snap = (b.snap && typeof b.snap === "object" && !Array.isArray(b.snap)) ? b.snap : {};
      await fetch(`${cfg.url}/rest/v1/usuarios?id=eq.${uid}`, {
        method: "PATCH",
        headers: { ...hdr(cfg), "Content-Type": "application/json" },
        body: JSON.stringify({ aula_snap: snap }),
      });
      return res.status(200).json({ ok: true });
    }

    // ── MURO: publicar un logro (server compone el texto; dedup 1/día por tipo+materia+tema).
    if (b.accion === "muro_publicar") {
      const tipo = String(b.tipo || "");
      if (!MURO_TIPOS.has(tipo)) return res.status(400).json({ error: "tipo inválido" });
      const grado = rec(b.grado, 40);
      if (!grado) return res.status(400).json({ error: "falta grado" });
      const materia = rec(b.materia, 120) || null;
      const tema = rec(b.tema, 200) || null;
      const nombre = rec(b.nombre, 40) || null;
      // meta saneada: SOLO score (sinapsis) y dias (racha). Nunca notas ni campos libres.
      let meta = null;
      if (b.meta && typeof b.meta === "object" && !Array.isArray(b.meta)) {
        meta = {};
        if (Number.isFinite(+b.meta.score)) meta.score = Math.max(0, Math.min(9999999, Math.round(+b.meta.score)));
        if (Number.isInteger(b.meta.dias)) meta.dias = Math.max(0, Math.min(3650, b.meta.dias));
        if (!Object.keys(meta).length) meta = null;
      }
      // dedup: mismo niño + mismo tipo (+materia+tema) el MISMO día → no republicar. EXCEPCIÓN:
      // si el evento trae un score MAYOR que el ya publicado (ej. mejor de los 3 intentos del
      // reto diario de Sinapsis), se actualiza la fila a ese máximo y sube al tope del feed.
      const desde = inicioHoyCaracasISO();
      const qd = `${cfg.url}/rest/v1/muro?usuario_id=eq.${uid}&tipo=eq.${encodeURIComponent(tipo)}` +
        `&creado=gte.${encodeURIComponent(desde)}&select=id,materia,tema,meta`;
      const rd = await fetch(qd, { headers: hdr(cfg) });
      const prev = rd.ok ? await rd.json() : [];
      const dupRow = (Array.isArray(prev) ? prev : []).find((r) => norm(r.materia) === norm(materia) && norm(r.tema) === norm(tema));
      if (dupRow) {
        const nuevoScore = meta && Number.isFinite(meta.score) ? meta.score : null;
        const viejoScore = dupRow.meta && Number.isFinite(dupRow.meta.score) ? dupRow.meta.score : null;
        if (nuevoScore != null && (viejoScore == null || nuevoScore > viejoScore)) {
          await fetch(`${cfg.url}/rest/v1/muro?id=eq.${dupRow.id}`, {
            method: "PATCH",
            headers: { ...hdr(cfg), "Content-Type": "application/json" },
            body: JSON.stringify({ meta, creado: new Date().toISOString() }),
          });
          return res.status(200).json({ ok: true, actualizado: true });
        }
        return res.status(200).json({ ok: true, dedup: true });
      }
      await fetch(`${cfg.url}/rest/v1/muro`, {
        method: "POST",
        headers: { ...hdr(cfg), "Content-Type": "application/json" },
        body: JSON.stringify({ usuario_id: uid, nombre, grado, tipo, materia, tema, meta }),
      });
      return res.status(200).json({ ok: true });
    }

    // ── MURO: feed del grado (últimos 40) con reacciones agregadas + la mía.
    if (b.accion === "muro_feed") {
      const grado = rec(b.grado, 40);
      if (!grado) return res.status(200).json({ ok: true, posts: [] });
      const q = `${cfg.url}/rest/v1/muro?grado=eq.${encodeURIComponent(grado)}` +
        `&select=id,usuario_id,nombre,tipo,materia,tema,meta,creado,muro_reacciones(usuario_id,emoji)` +
        `&order=creado.desc&limit=40`;
      const r = await fetch(q, { headers: hdr(cfg) });
      const rows = r.ok ? await r.json() : [];
      const posts = (Array.isArray(rows) ? rows : []).map((row) => {
        const reac = {}; let miReaccion = null;
        for (const x of row.muro_reacciones || []) {
          if (!MURO_EMOJIS.has(x.emoji)) continue;
          reac[x.emoji] = (reac[x.emoji] || 0) + 1;
          if (String(x.usuario_id) === String(uid)) miReaccion = x.emoji;
        }
        return {
          id: row.id, mio: String(row.usuario_id) === String(uid),
          nombre: row.nombre || null, tipo: row.tipo,
          texto: textoMuro(row.tipo, row.materia, row.tema, row.meta),
          creado: row.creado, reacciones: reac, miReaccion,
        };
      });
      return res.status(200).json({ ok: true, posts });
    }

    // ── MURO: reaccionar (emoji del set seguro) o quitar la reacción (emoji null).
    if (b.accion === "muro_reaccion") {
      const muroId = parseInt(b.muro_id, 10);
      if (!muroId) return res.status(400).json({ error: "falta muro_id" });
      const emoji = b.emoji == null ? null : String(b.emoji);
      if (emoji && !MURO_EMOJIS.has(emoji)) return res.status(400).json({ error: "emoji inválido" });
      if (!emoji) {
        await fetch(`${cfg.url}/rest/v1/muro_reacciones?muro_id=eq.${muroId}&usuario_id=eq.${uid}`,
          { method: "DELETE", headers: hdr(cfg) });
        return res.status(200).json({ ok: true });
      }
      // una reacción por (muro, usuario): upsert reemplaza el emoji si ya había
      await fetch(`${cfg.url}/rest/v1/muro_reacciones?on_conflict=muro_id,usuario_id`, {
        method: "POST",
        headers: { ...hdr(cfg), "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
        body: JSON.stringify({ muro_id: muroId, usuario_id: uid, emoji }),
      });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "acción inválida" });
  } catch (e) {
    return res.status(200).json({ ok: true, progreso: [], error: String(e.message || e) });
  }
}
