// familia.js — Panel de familia (padres). Página aparte, SOLO LECTURA.
// Flujo: si llega ?c=CODIGO se canjea por un token persistente (guardado en este
// dispositivo); de ahí en más se pide el panel con ese token. Todo contra /api/familia.

const API = "/api/familia";
const KEY_TOKEN = "familia_ptoken";
const KEY_NINO = "familia_nino";
const app = document.getElementById("app");

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const FMT_DIA = new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Caracas" });
const FMT_HORA = new Intl.DateTimeFormat("es", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Caracas" });
const FMT_YMD = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Caracas" });
function claveDia(iso) { try { return FMT_YMD.format(new Date(iso)); } catch (e) { return ""; } }
function hoyYMD() { return FMT_YMD.format(new Date()); }
function ayerYMD() { return FMT_YMD.format(new Date(Date.now() - 86400000)); }
function tituloDia(iso) {
  const k = claveDia(iso);
  if (k === hoyYMD()) return "Hoy";
  if (k === ayerYMD()) return "Ayer";
  const t = FMT_DIA.format(new Date(iso));
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function hora(iso) { try { return FMT_HORA.format(new Date(iso)).replace(/\s?[.]?\s?m[.]?/i, (m) => m.trim()); } catch (e) { return ""; } }

async function api(body) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, d };
}

const MODO = {
  resumen: { ic: "📖", l: "Aprendió" },
  retos: { ic: "💪", l: "Practicó" },
  quiz: { ic: "✅", l: "Quiz" },
  examen: { ic: "📝", l: "Examen" },
};

// ───────── arranque ─────────
(async function boot() {
  const params = new URLSearchParams(location.search);
  const code = (params.get("c") || "").trim();
  let token = localStorage.getItem(KEY_TOKEN);

  if (code) {
    const { status, d } = await api({ accion: "canjear", code });
    if (d && d.ok && d.token) {
      token = d.token;
      localStorage.setItem(KEY_TOKEN, token);
      if (d.nino) localStorage.setItem(KEY_NINO, JSON.stringify(d.nino));
      history.replaceState(null, "", location.pathname); // limpiar el código de la URL
    } else if (!token) {
      return estadoError("Enlace no válido", (d && d.error) || "Pedile a tu hijo un enlace nuevo desde Chispa → Familia.", true);
    }
  }

  if (!token) {
    return estadoError("Aún no estás vinculado", "Pedile a tu hijo que abra Chispa, entre a «Familia» y toque «Invitar». Se te dará un enlace o un código para entrar acá.", false);
  }
  cargarPanel(token);
})();

async function cargarPanel(token) {
  app.innerHTML = '<div class="skel"></div>';
  const { status, d } = await api({ accion: "panel", ptoken: token });
  if (status === 401 || !(d && d.ok)) {
    localStorage.removeItem(KEY_TOKEN);
    return estadoError("El acceso caducó", (d && d.error) || "Pedile a tu hijo un enlace nuevo.", false);
  }
  render(d);
}

function estadoError(titulo, msg, reintentar) {
  app.innerHTML =
    `<div class="estado">
      <div class="em">👋</div>
      <h2>${esc(titulo)}</h2>
      <p>${esc(msg)}</p>
      ${reintentar ? '<button class="btn" onclick="location.reload()">Reintentar</button>' : ""}
    </div>
    <p class="foot">Chispa · Panel de familia</p>`;
}

// ───────── render principal ─────────
function render(d) {
  const p = d.perfil || {};
  const nombre = p.nombre || (JSON.parse(localStorage.getItem(KEY_NINO) || "{}").nombre) || "tu hijo";
  const html = [];

  // header
  const chips = [];
  if (p.grado) chips.push(`<span class="hchip">🎓 ${esc(p.grado)}</span>`);
  if (p.racha_dias >= 2) chips.push(`<span class="hchip">🔥 ${p.racha_dias} días seguidos</span>`);
  if (p.ultimo_acceso) chips.push(`<span class="hchip">🕒 Última vez: ${esc(tituloDia(p.ultimo_acceso).toLowerCase())}</span>`);
  html.push(
    `<div class="hdr">
      <p class="hi" style="color:rgba(255,255,255,.85)">Panel de familia</p>
      <h1>${esc(primerNombre(nombre))}</h1>
      <p class="sub">Esto es todo lo que hizo en Chispa. Solo podés mirar; no se cambia nada.</p>
      ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
    </div>`
  );

  html.push(seccionResumen(d));
  html.push(seccionActividad(d.actividad || []));
  html.push(seccionNotas(d.notas || []));
  html.push(seccionAgenda(d.tareas || [], d.horario || []));
  html.push(seccionRefuerzo(d.errores || [], d.reportes || []));

  html.push(
    `<div class="center" style="margin-top:8px">
      <button class="btn ghost" onclick="location.reload()">↻ Actualizar</button>
      <button class="btn ghost" id="btnSalir" style="margin-left:8px">Desvincular</button>
    </div>
    <p class="foot">Chispa · Panel de familia · solo lectura<br>Tu hijo puede quitarte el acceso cuando quiera desde su aula.</p>`
  );

  app.innerHTML = html.join("");
  const bs = document.getElementById("btnSalir");
  if (bs) bs.onclick = () => { if (confirm("¿Desvincular este dispositivo? Vas a necesitar un enlace nuevo para volver a entrar.")) { localStorage.removeItem(KEY_TOKEN); localStorage.removeItem(KEY_NINO); location.href = location.pathname; } };
}

function primerNombre(n) { const p = String(n || "").trim().split(/\s+/); return p.slice(0, 2).join(" ") || "tu hijo"; }

// ───────── resumen (tiles) ─────────
function seccionResumen(d) {
  const act = d.actividad || [];
  const desde = Date.now() - 7 * 86400000;
  const sem = act.filter((a) => Date.parse(a.creado) >= desde);
  const quizzes = act.filter((a) => a.modo === "quiz" && a.total > 0);
  const prom = quizzes.length ? Math.round(quizzes.reduce((s, q) => s + q.aciertos / q.total, 0) / quizzes.length * 100) : null;
  const tiles = [];
  tiles.push(tile(sem.length, "actividades esta semana"));
  if (prom != null) tiles.push(tile(prom + "%", "promedio en quiz"));
  tiles.push(tile(d.perfil && d.perfil.racha_dias || 0, "días de racha"));
  tiles.push(tile((d.notas || []).length, "notas anotadas"));
  return `<div class="card"><p class="secTit"><span class="ic">📊</span> Resumen</p><div class="tiles">${tiles.join("")}</div></div>`;
}
function tile(n, l) { return `<div class="tile"><div class="n">${esc(String(n))}</div><div class="l">${esc(l)}</div></div>`; }

// ───────── actividad (agrupada por día) ─────────
function seccionActividad(act) {
  if (!act.length) return card("🗂️", "Actividad", vacio("Todavía no hay actividad registrada."));
  const grupos = [];
  let actual = null;
  for (const a of act) {
    const k = claveDia(a.creado);
    if (!actual || actual.k !== k) { actual = { k, iso: a.creado, items: [] }; grupos.push(actual); }
    actual.items.push(a);
  }
  const body = grupos.slice(0, 30).map((g) => {
    const filas = g.items.map((a) => {
      const m = MODO[a.modo] || { ic: "•", l: a.modo || "" };
      const linea2 = [a.materia && limpiaMateria(a.materia), a.tema].filter(Boolean).map(esc).join(" · ");
      const res = a.modo === "quiz" ? resultBadge(a.aciertos, a.total) : "";
      return `<div class="act">
        <span class="ai">${m.ic}</span>
        <div class="ab"><div class="am">${esc(m.l)}</div><div class="at">${linea2}</div></div>
        ${res || `<span class="r-hora">${esc(hora(a.creado))}</span>`}
      </div>`;
    }).join("");
    const cuenta = resumenDia(g.items);
    return `<div class="dia"><p class="diaTit">${esc(tituloDia(g.iso))}${cuenta ? ` · <span class="muted" style="font-weight:600;text-transform:none">${esc(cuenta)}</span>` : ""}</p>${filas}</div>`;
  }).join("");
  return card("🗂️", "Actividad reciente", body);
}
function resumenDia(items) {
  const c = {};
  for (const a of items) c[a.modo] = (c[a.modo] || 0) + 1;
  const partes = [];
  if (c.retos) partes.push(`${c.retos} práctica${c.retos > 1 ? "s" : ""}`);
  if (c.quiz) partes.push(`${c.quiz} quiz`);
  if (c.examen) partes.push(`${c.examen} examen${c.examen > 1 ? "es" : ""}`);
  if (c.resumen) partes.push(`${c.resumen} resumen${c.resumen > 1 ? "es" : ""}`);
  return partes.join(", ");
}
function resultBadge(a, t) {
  if (!(Number.isFinite(a) && Number.isFinite(t) && t > 0)) return "";
  const pct = a / t, cls = pct >= 0.8 ? "r-ok" : pct >= 0.6 ? "r-med" : "r-low";
  return `<span class="ar ${cls}">${a}/${t}</span>`;
}

// ───────── notas de exámenes ─────────
function seccionNotas(notas) {
  if (!notas.length) return card("🎓", "Notas de exámenes", vacio("Todavía no anotó ninguna nota de examen."));
  // promedio por materia
  const acc = {};
  for (const n of notas) {
    const k = limpiaMateria(n.materia || "General");
    if (!acc[k]) acc[k] = { suma: 0, n: 0 };
    acc[k].suma += Number(n.nota) || 0; acc[k].n++;
  }
  const chips = Object.entries(acc).map(([mat, a]) => {
    const prom = Math.round(a.suma / a.n * 10) / 10;
    return `<span class="badge" style="background:${notaBg(prom)};color:${notaFg(prom)}">${esc(mat)}: ${prom}${a.n > 1 ? ` (${a.n})` : ""}</span>`;
  }).join(" ");
  const filas = notas.map((n) => {
    const val = Number(n.nota);
    return `<div class="notaRow">
      <span class="notaBadge ${colorNota(val)}">${esc(String(n.nota).replace(/\.0$/, ""))}</span>
      <div style="min-width:0"><div style="font-weight:800">${esc(limpiaMateria(n.materia || "General"))}</div>
      <div class="at" style="color:var(--muted);font-size:.82rem">${esc(n.descripcion || "Examen")}${n.fecha ? " · " + esc(String(n.fecha).slice(0, 10)) : ""}</div></div>
    </div>`;
  }).join("");
  return card("🎓", "Notas de exámenes", `<div style="margin-bottom:10px">${chips}</div>${filas}`);
}
function colorNota(n) { return n >= 16 ? "nb-buena" : n >= 14 ? "nb-media" : "nb-floja"; }
function notaBg(n) { return n >= 16 ? "#E5F7EF" : n >= 14 ? "#FFF3DA" : "#FDE7ED"; }
function notaFg(n) { return n >= 16 ? "#1FA86A" : n >= 14 ? "#B8770A" : "#EF476F"; }

// ───────── agenda: tareas + horario ─────────
function seccionAgenda(tareas, horario) {
  const bloques = [];
  // tareas
  if (tareas.length) {
    const pend = tareas.filter((t) => !t.hecha), hechas = tareas.filter((t) => t.hecha);
    const filaT = (t, done) => `<div class="li"><span class="lic">${done ? "☑️" : "⬜"}</span><span class="${done ? "tacha" : ""}">${esc(t.descripcion || "Tarea")}${t.materia ? ` · <span class="muted">${esc(limpiaMateria(t.materia))}</span>` : ""}${t.fecha ? ` <span class="muted">(${esc(String(t.fecha).slice(0, 10))})</span>` : ""}</span></div>`;
    let t = `<p class="lblMini">Tareas</p>`;
    t += pend.length ? pend.map((x) => filaT(x, false)).join("") : `<p class="muted" style="font-size:.86rem;margin:0 0 6px">Sin tareas pendientes 🎉</p>`;
    if (hechas.length) t += hechas.slice(0, 8).map((x) => filaT(x, true)).join("");
    bloques.push(t);
  }
  // horario
  if (horario.length) {
    const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
    const porDia = {};
    for (const h of horario) { (porDia[h.dia] = porDia[h.dia] || []).push(h); }
    let hh = `<p class="lblMini" style="margin-top:${tareas.length ? "14px" : "0"}">Horario semanal</p>`;
    for (let d = 1; d <= 5; d++) {
      const ms = (porDia[d] || []).sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((x) => limpiaMateria(x.materia));
      if (ms.length) hh += `<div class="hday"><div class="hd">${DIAS[d]}</div><div class="hm">${esc(ms.join(" · "))}</div></div>`;
    }
    bloques.push(hh);
  }
  if (!bloques.length) return card("📅", "Agenda", vacio("Todavía no cargó tareas ni horario."));
  return card("📅", "Agenda", bloques.join(""));
}

// ───────── refuerzo: errores + reportes ─────────
function seccionRefuerzo(errores, reportes) {
  const partes = [];
  if (errores.length) {
    const temas = [...new Set(errores.map((e) => [limpiaMateria(e.materia || ""), e.tema].filter(Boolean).join(" · ")).filter(Boolean))];
    partes.push(`<p style="margin:0 0 8px"><b>${errores.length}</b> ${errores.length === 1 ? "pregunta guardada" : "preguntas guardadas"} para repasar sus errores.</p>`);
    if (temas.length) partes.push(`<div>${temas.slice(0, 12).map((t) => `<span class="badge">${esc(t)}</span>`).join(" ")}</div>`);
  } else {
    partes.push(`<p class="muted" style="margin:0">No tiene errores pendientes de repasar. 👍</p>`);
  }
  if (reportes.length) {
    partes.push(`<p style="margin:12px 0 0"><b>${reportes.length}</b> ${reportes.length === 1 ? "ejercicio reportado" : "ejercicios reportados"} por no entenderse o estar mal. Ya le regeneramos otro en su lugar.</p>`);
  }
  return card("💪", "Para reforzar", partes.join(""));
}

// ───────── helpers de UI ─────────
function card(ic, tit, body) {
  return `<div class="card"><p class="secTit"><span class="ic">${ic}</span> ${esc(tit)}</p>${body}</div>`;
}
function vacio(msg) { return `<p class="muted" style="font-size:.88rem;margin:0">${esc(msg)}</p>`; }
// quita el sufijo de grado ("MATEMÁTICAS 6G" → "Matemáticas") y capitaliza suave
function limpiaMateria(m) {
  let s = String(m || "").replace(/\s*\b[1-6][GA]\b\s*$/i, "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
