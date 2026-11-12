// herramientas/avisos.mjs — notificaciones al teléfono (MEJORAS 2, 18 y 19, 2026-11-12).
//
// UNA vez al día (cron de Vercel, ~4:30 pm de Caracas; ver vercel.json) se revisa a cada niño
// con avisos activos y se manda:
//   - al NIÑO: UN solo aviso, el más importante (examen mañana o pasado → algo para mañana →
//     tareas atrasadas → "hoy no has estudiado"). Al tocarlo abre la misión o la agenda.
//   - al ADULTO (panel de familia): un aviso por motivo, sin repetirlo cada día (examen en 2 días
//     sin practicar, 3+ días sin abrir la app, 3+ tareas atrasadas) y los domingos el resumen de
//     la semana.
// La tabla `push_enviados` (clave única por suscripción + motivo) evita repetir: si el cron corre
// dos veces (dos proyectos de Vercel con el mismo repo) el segundo no manda nada.
// Sin VAPID_PRIVATE_KEY no se envía nada (así el proyecto chispa-familia, que no la tiene, no hace nada).
import webpush from "web-push";

export const VAPID_PUBLICA = "BGmaLBol9IU95zJpvzqhMvU8OWyRjGFRZNNUI5fpcXmaZOb8lIwqmEkFBlQj2EobmopDaaPxn1xgO5hfuqKDUa4";

// ── fechas en hora de Caracas (UTC-4, sin horario de verano) ──
const OFFSET_MS = -4 * 3600 * 1000;
export function fechaCaracas(d = new Date()) { return new Date(d.getTime() + OFFSET_MS).toISOString().slice(0, 10); }
export function diaSemanaCaracas(d = new Date()) { return new Date(d.getTime() + OFFSET_MS).getUTCDay(); }   // 0 = domingo
export function diasEntre(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5); }
function sumarDias(f, n) { return new Date(Date.parse(f + "T12:00:00Z") + n * 864e5).toISOString().slice(0, 10); }

// mismo criterio que app.js / familia.js
const RE_EXAMEN = /\b(ex[aá]men(es)?|evaluaci[oó]n(es)?|prueba|parcial|quiz)\b/i;
const esExamen = (t) => !!t && (t.tipo === "examen" || RE_EXAMEN.test(String(t.descripcion || "")));
// "MATEMÁTICAS 5G" → "Matemáticas"
export function nombreMateria(m) {
  const s = String(m || "").replace(/\s+\d+\s*[A-Za-z]{1,2}$/, "").trim().toLowerCase();
  return s ? s.replace(/(^|\s)\S/g, (x) => x.toUpperCase()).replace(/\b(De|Del|La|Las|El|Los|Y)\b/g, (x) => x.toLowerCase()) : "tu materia";
}
const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "Tu hijo";
const recorta = (s, n) => { s = String(s || "").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const cuandoTxt = (d) => (d === 0 ? "hoy" : d === 1 ? "mañana" : d === 2 ? "pasado mañana" : `en ${d} días`);
function fmtMin(seg) { const m = Math.round((seg || 0) / 60); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? (m % 60) + " min" : ""}`.trim(); }

// ── qué decirle al NIÑO hoy (o null) ──
// d = { hoy, tareas, estudioHoy:boolean }
export function avisoNino(d) {
  const pend = (d.tareas || []).filter((t) => !t.hecha && t.fecha);
  const dias = (t) => diasEntre(d.hoy, t.fecha);
  const clave = `nino:${d.hoy}`;
  const examenes = pend.filter((t) => esExamen(t) && dias(t) >= 1 && dias(t) <= 2).sort((a, b) => dias(a) - dias(b));
  if (examenes.length) {
    const t = examenes[0], n = dias(t);
    return { clave, url: "/?ir=mision", titulo: `${n === 1 ? "Mañana" : "Pasado mañana"} tienes examen de ${nombreMateria(t.materia)}`,
      cuerpo: "Repasa unos minutos hoy: tu misión ya tiene el tema listo." };
  }
  const manana = pend.filter((t) => !esExamen(t) && dias(t) === 1);
  if (manana.length) {
    return { clave, url: "/?ir=agenda", titulo: manana.length === 1 ? `Para mañana: ${recorta(manana[0].descripcion || "una tarea", 60)}` : `Tienes ${manana.length} cosas para mañana`,
      cuerpo: manana.length === 1 ? nombreMateria(manana[0].materia) : manana.slice(0, 3).map((t) => nombreMateria(t.materia)).join(", ") };
  }
  const venc = pend.filter((t) => dias(t) < 0);
  if (venc.length) {
    return { clave, url: "/?ir=agenda", titulo: venc.length === 1 ? "Tienes una tarea atrasada" : `Tienes ${venc.length} tareas atrasadas`,
      cuerpo: venc.length === 1 ? "Márcala si ya la entregaste o cámbiale la fecha." : "Márcalas si ya las entregaste o cámbiales la fecha." };
  }
  if (!d.estudioHoy) {
    return { clave, url: "/?ir=mision", titulo: "Hoy todavía no has estudiado", cuerpo: "Con 10 minutos alcanza. Tu misión de hoy te está esperando." };
  }
  return null;
}

// ── qué decirle al ADULTO (lista, puede estar vacía) ──
// d = { hoy, dow, nombre, tareas, actividad7 (últimos 7 días), estudio7, ultimaApertura (ISO|null) }
export function avisosAdulto(d) {
  const out = [], nom = primerNombre(d.nombre);
  const pend = (d.tareas || []).filter((t) => !t.hecha && t.fecha);
  const dias = (t) => diasEntre(d.hoy, t.fecha);
  const practico = (mat) => [...(d.actividad7 || []), ...(d.estudio7 || [])].some((a) => nombreMateria(a.materia) === nombreMateria(mat));
  // examen en 0-2 días y SIN práctica de esa materia en la semana (un aviso por examen)
  pend.filter((t) => esExamen(t) && dias(t) >= 0 && dias(t) <= 2 && !practico(t.materia)).slice(0, 2).forEach((t) => {
    out.push({ clave: `examen:${t.id || t.fecha + t.materia}`, url: "/familia.html", titulo: `${nom}: examen de ${nombreMateria(t.materia)} ${cuandoTxt(dias(t))}`,
      cuerpo: "No ha practicado esa materia en Chispa esta semana." });
  });
  // 3+ días sin abrir (un aviso por racha: la clave es la fecha de la última apertura)
  if (d.ultimaApertura) {
    const ult = fechaCaracas(new Date(d.ultimaApertura)), n = diasEntre(ult, d.hoy);
    if (n >= 3) out.push({ clave: `inactivo:${ult}`, url: "/familia.html", titulo: `${nom} lleva ${n} días sin abrir Chispa`, cuerpo: "Quizás valga la pena recordarle su misión de hoy." });
  }
  // 3+ tareas atrasadas (como mucho una vez por semana)
  const venc = pend.filter((t) => dias(t) < 0);
  if (venc.length >= 3) out.push({ clave: `vencidas:${sumarDias(d.hoy, -d.dow)}`, url: "/familia.html", titulo: `${nom} tiene ${venc.length} tareas atrasadas`, cuerpo: venc.slice(0, 2).map((t) => recorta(t.descripcion || nombreMateria(t.materia), 40)).join(" · ") });
  // domingo: resumen de la semana (va primero)
  if (d.dow === 0) {
    const est = d.estudio7 || [], act = d.actividad7 || [];
    const diasCon = new Set([...est, ...act].map((x) => fechaCaracas(new Date(x.creado)))).size;
    const seg = est.reduce((s, e) => s + (e.segundos || 0), 0);
    const quiz = act.filter((a) => a.modo === "quiz" && a.total > 0);
    const pct = quiz.length ? Math.round(quiz.reduce((s, q) => s + q.aciertos / q.total, 0) / quiz.length * 100) : null;
    const prox = pend.filter((t) => esExamen(t) && dias(t) >= 1 && dias(t) <= 7).length;
    const partes = [`estudió ${diasCon} de 7 días`];
    if (seg) partes.push(fmtMin(seg));
    if (pct != null) partes.push(`quiz ${pct}%`);
    if (venc.length) partes.push(`${venc.length} atrasada${venc.length > 1 ? "s" : ""}`);
    out.unshift({ clave: `semana:${d.hoy}`,   // el resumen va primero: es lo que más le sirve al adulto
 url: "/familia.html", titulo: `La semana de ${nom}`,
      cuerpo: partes.join(" · ") + (prox ? `. Próxima semana: ${prox} examen${prox > 1 ? "es" : ""}.` : ".") });
  }
  return out.slice(0, 3);
}

// ── el envío diario (lo llama el cron) ──
function hdr(cfg, extra) { return { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, ...(extra || {}) }; }
async function sbGet(cfg, path) { const r = await fetch(`${cfg.url}/rest/v1/${path}`, { headers: hdr(cfg) }); return r.ok ? await r.json() : []; }

export async function enviarAvisosDelDia(cfg, ahora = new Date()) {
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) return { ok: false, motivo: "sin VAPID_PRIVATE_KEY" };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://aula-cam.vercel.app", process.env.VAPID_PUBLIC_KEY || VAPID_PUBLICA, priv);
  const hoy = fechaCaracas(ahora), dow = diaSemanaCaracas(ahora);
  const subs = await sbGet(cfg, "push_subs?activo=is.true&select=id,usuario_id,vinculo_id,endpoint,p256dh,auth");
  if (!Array.isArray(subs) || !subs.length) return { ok: true, enviados: 0 };
  // vínculos de adultos todavía activos (si el niño quitó el acceso, ese adulto ya no recibe nada)
  const vIds = [...new Set(subs.filter((s) => s.vinculo_id).map((s) => s.vinculo_id))];
  const vivos = new Set(vIds.length ? (await sbGet(cfg, `familia_vinculos?id=in.(${vIds.join(",")})&activo=is.true&select=id`)).map((v) => v.id) : []);
  const desde7 = new Date(ahora.getTime() - 7 * 864e5).toISOString();
  const inicioHoy = new Date(Date.parse(hoy + "T04:00:00Z")).toISOString();   // 00:00 de Caracas
  const porNino = new Map();
  subs.forEach((s) => { if (!porNino.has(s.usuario_id)) porNino.set(s.usuario_id, []); porNino.get(s.usuario_id).push(s); });
  let enviados = 0, fallidos = 0;
  for (const [uid, lista] of porNino) {
    const [u, tareas, act7, est7, ape] = await Promise.all([
      sbGet(cfg, `usuarios?id=eq.${uid}&select=nombre`),
      sbGet(cfg, `tareas?usuario_id=eq.${uid}&hecha=is.false&fecha=gte.${sumarDias(hoy, -45)}&select=id,materia,descripcion,tipo,fecha,hecha`),
      sbGet(cfg, `actividad?usuario_id=eq.${uid}&creado=gte.${encodeURIComponent(desde7)}&select=materia,modo,aciertos,total,creado`),
      sbGet(cfg, `estudio?usuario_id=eq.${uid}&creado=gte.${encodeURIComponent(desde7)}&select=materia,segundos,creado`),
      sbGet(cfg, `aperturas?usuario_id=eq.${uid}&order=creado.desc&limit=1&select=creado`),
    ]);
    const nombre = (u[0] && u[0].nombre) || "";
    const estudioHoy = [...act7, ...est7].some((x) => x.creado >= inicioHoy);
    for (const s of lista) {
      let avisos;
      if (!s.vinculo_id) { const a = avisoNino({ hoy, tareas, estudioHoy }); avisos = a ? [a] : []; }
      else if (vivos.has(s.vinculo_id)) avisos = avisosAdulto({ hoy, dow, nombre, tareas, actividad7: act7, estudio7: est7, ultimaApertura: ape[0] && ape[0].creado });
      else avisos = [];
      for (const a of avisos) {
        // marca primero (clave única): si ya se mandó este motivo, no se repite
        const r = await fetch(`${cfg.url}/rest/v1/push_enviados?on_conflict=sub_id,clave`, {
          method: "POST", headers: hdr(cfg, { "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" }),
          body: JSON.stringify({ sub_id: s.id, clave: a.clave }),
        });
        const filas = r.ok ? await r.json().catch(() => []) : [];
        if (!Array.isArray(filas) || !filas.length) continue;
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ titulo: a.titulo, cuerpo: a.cuerpo, url: a.url, tag: a.clave.split(":")[0] }), { TTL: 6 * 3600 });
          enviados++;
        } catch (e) {
          fallidos++;
          // suscripción muerta (desinstaló la app o quitó el permiso): se apaga
          if (e && (e.statusCode === 404 || e.statusCode === 410)) {
            await fetch(`${cfg.url}/rest/v1/push_subs?id=eq.${s.id}`, { method: "PATCH", headers: hdr(cfg, { "Content-Type": "application/json" }), body: JSON.stringify({ activo: false }) }).catch(() => {});
          }
        }
      }
    }
  }
  return { ok: true, enviados, fallidos };
}

// Aviso inmediato a los teléfonos del NIÑO (p. ej. "tienes una misión nueva"). Sin clave VAPID, no hace nada.
export async function avisarNino(cfg, usuarioId, a) {
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!priv) return 0;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://aula-cam.vercel.app", process.env.VAPID_PUBLIC_KEY || VAPID_PUBLICA, priv);
  const subs = await sbGet(cfg, `push_subs?usuario_id=eq.${usuarioId}&vinculo_id=is.null&activo=is.true&select=id,endpoint,p256dh,auth`);
  let n = 0;
  for (const s of Array.isArray(subs) ? subs : []) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(a), { TTL: 12 * 3600 }); n++; }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await fetch(`${cfg.url}/rest/v1/push_subs?id=eq.${s.id}`, { method: "PATCH", headers: hdr(cfg, { "Content-Type": "application/json" }), body: JSON.stringify({ activo: false }) }).catch(() => {}); }
  }
  return n;
}

// Guarda (o apaga) la suscripción de un teléfono. vinculoId null = el niño; si no, el adulto.
export async function guardarSuscripcion(cfg, usuarioId, vinculoId, sub, activo) {
  const ep = sub && String(sub.endpoint || "");
  const k = (sub && sub.keys) || {};
  if (!/^https:\/\//.test(ep) || !k.p256dh || !k.auth) return false;
  const r = await fetch(`${cfg.url}/rest/v1/push_subs?on_conflict=endpoint,usuario_id`, {
    method: "POST", headers: hdr(cfg, { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify({ usuario_id: usuarioId, vinculo_id: vinculoId || null, endpoint: ep.slice(0, 1000), p256dh: String(k.p256dh).slice(0, 200), auth: String(k.auth).slice(0, 100), activo: !!activo }),
  });
  return r.ok;
}
