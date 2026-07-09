// familia.js — Panel de familia (padres). SOLO LECTURA. Soporta VARIOS hijos por dispositivo
// (un padre con 2+ hijos en el cole): cada hijo aporta su propio token; arriba hay un selector.
// Flujo: ?c=CODIGO se canjea por un token persistente que se agrega a la lista de hijos de este
// dispositivo; de ahí en más se pide el panel del hijo activo. Todo contra /api/familia.

const API = "/api/familia";
const KEY_NINOS = "familia_ninos";       // [{token, nombre, grado}]
const KEY_ACTIVO = "familia_activo";     // índice del hijo que se está viendo
const KEY_TOKEN_VIEJO = "familia_ptoken"; // migración desde la versión de 1 solo hijo
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
  resumen: { ic: "📖", l: "Aprendió" }, retos: { ic: "💪", l: "Practicó" },
  quiz: { ic: "✅", l: "Quiz" }, examen: { ic: "📝", l: "Examen" },
};

// ───────── hijos de este dispositivo ─────────
function getNinos() { try { return JSON.parse(localStorage.getItem(KEY_NINOS) || "[]"); } catch (e) { return []; } }
function setNinos(a) { localStorage.setItem(KEY_NINOS, JSON.stringify(a)); }
function migrar() {
  if (localStorage.getItem(KEY_NINOS)) return;
  const t = localStorage.getItem(KEY_TOKEN_VIEJO);
  if (t) {
    let nino = {}; try { nino = JSON.parse(localStorage.getItem("familia_nino") || "{}"); } catch (e) {}
    setNinos([{ token: t, nombre: nino.nombre || null, grado: nino.grado || null }]);
    localStorage.removeItem(KEY_TOKEN_VIEJO); localStorage.removeItem("familia_nino");
  }
}
function addNino(token, nino) {
  const a = getNinos();
  const nombre = (nino && nino.nombre) || null;
  const entry = { token, nombre, grado: (nino && nino.grado) || null };
  const i = a.findIndex((x) => nombre && x.nombre === nombre); // re-vincular al mismo hijo reemplaza su token
  if (i >= 0) a[i] = entry; else a.push(entry);
  setNinos(a);
  return Math.max(0, a.findIndex((x) => x.token === token));
}
function getActivo() { const n = getNinos(); let i = parseInt(localStorage.getItem(KEY_ACTIVO), 10); if (!(i >= 0 && i < n.length)) i = 0; return i; }
function setActivo(i) { localStorage.setItem(KEY_ACTIVO, String(i)); }

// ───────── arranque ─────────
(async function boot() {
  migrar();
  const code = (new URLSearchParams(location.search).get("c") || "").trim();
  if (code) {
    const { d } = await api({ accion: "canjear", code });
    if (d && d.ok && d.token) {
      setActivo(addNino(d.token, d.nino));
      history.replaceState(null, "", location.pathname);
    } else if (!getNinos().length) {
      return estadoError("Enlace no válido", (d && d.error) || "Pedile a tu hijo un enlace nuevo desde Chispa → Familia.", true);
    }
  }
  if (!getNinos().length) {
    return estadoError("Aún no estás vinculado", "Pedile a tu hijo que abra Chispa, entre a «Familia» y toque «Invitar». Se te dará un enlace o un código para entrar acá.", false);
  }
  cargarYrender();
})();

const PANEL_CACHE = {}; // token -> data del panel
let ACT_DIAS = [];      // actividad del hijo activo, agrupada por día (para el selector)

async function cargarYrender(recargar) {
  const ninos = getNinos();
  const i = getActivo();
  const nino = ninos[i];
  app.innerHTML = tabsHijos(ninos, i) + '<div class="skel"></div>';
  wireTabs(ninos);
  if (recargar) delete PANEL_CACHE[nino.token];
  let d = PANEL_CACHE[nino.token];
  if (!d) {
    const res = await api({ accion: "panel", ptoken: nino.token });
    if (res.status === 401 || !(res.d && res.d.ok)) {
      const arr = getNinos().filter((x) => x.token !== nino.token); setNinos(arr); setActivo(0);
      if (!arr.length) return estadoError("El acceso caducó", (res.d && res.d.error) || "Pedile a tu hijo un enlace nuevo.", false);
      return cargarYrender();
    }
    d = res.d; PANEL_CACHE[nino.token] = d;
    // refrescar nombre/grado guardados con lo que dice el servidor
    if (d.perfil) { const a = getNinos(); if (a[i]) { a[i].nombre = d.perfil.nombre || a[i].nombre; a[i].grado = d.perfil.grado || a[i].grado; setNinos(a); } }
  }
  render(d, getNinos(), getActivo());
}

function estadoError(titulo, msg, reintentar) {
  app.innerHTML =
    `<div class="estado"><div class="em">👋</div><h2>${esc(titulo)}</h2><p>${esc(msg)}</p>
      ${reintentar ? '<button class="btn" onclick="location.reload()">Reintentar</button>' : ""}</div>
    <p class="foot">Chispa · Panel de familia</p>`;
}

// ───────── selector de hijos (solo si hay 2+) ─────────
function tabsHijos(ninos, activo) {
  if (ninos.length < 2) return "";
  const tabs = ninos.map((n, i) =>
    `<button class="ninoTab${i === activo ? " on" : ""}" data-i="${i}">${esc(primerNombre(n.nombre || "Hijo"))}</button>`).join("");
  return `<div class="ninoTabs">${tabs}</div>`;
}
function wireTabs(ninos) {
  document.querySelectorAll(".ninoTab").forEach((b) => b.onclick = () => {
    const i = +b.dataset.i; if (i === getActivo()) return; setActivo(i); cargarYrender();
  });
}

// ───────── render principal ─────────
function render(d, ninos, i) {
  const p = d.perfil || {};
  const nombre = p.nombre || (ninos[i] && ninos[i].nombre) || "tu hijo";
  const chips = [];
  if (p.grado) chips.push(`<span class="hchip">🎓 ${esc(p.grado)}</span>`);
  if (p.racha_dias >= 2) chips.push(`<span class="hchip">🔥 ${p.racha_dias} días seguidos</span>`);
  if (p.ultimo_acceso) chips.push(`<span class="hchip">🕒 Última vez: ${esc(tituloDia(p.ultimo_acceso).toLowerCase())}</span>`);

  const html = [
    tabsHijos(ninos, i),
    `<div class="hdr">
      <p class="hi" style="color:rgba(255,255,255,.85)">Panel de familia</p>
      <h1>${esc(primerNombre(nombre))}</h1>
      <p class="sub">Esto es todo lo que hizo en Chispa. Solo podés mirar; no se cambia nada.</p>
      ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
    </div>`,
    seccionResumen(d),
    seccionActividad(d.actividad || []),
    seccionNotas(d.notas || []),
    seccionTareas(d.tareas || []),
    seccionHorario(d.horario || []),
    seccionRefuerzo(d.errores || [], d.reportes || []),
    `<div class="center" style="margin-top:8px">
      <button class="btn ghost" id="btnRecargar">↻ Actualizar</button>
      <button class="btn ghost" id="btnSalir" style="margin-left:8px">Desvincular</button>
    </div>
    <p class="foot">Chispa · Panel de familia · solo lectura<br>Tu hijo puede quitarte el acceso cuando quiera desde su aula.</p>`,
  ];
  app.innerHTML = html.join("");
  wireTabs(ninos);
  wireActividad();
  document.getElementById("btnRecargar").onclick = () => cargarYrender(true);
  document.getElementById("btnSalir").onclick = desvincularActivo;
}

function primerNombre(n) { const p = String(n || "").trim().split(/\s+/); return p.slice(0, 2).join(" ") || "tu hijo"; }

function desvincularActivo() {
  const ninos = getNinos(), i = getActivo();
  const nom = primerNombre((ninos[i] && ninos[i].nombre) || "este hijo");
  if (!confirm(`¿Desvincular a ${nom} de este dispositivo? Vas a necesitar un enlace nuevo para volver a verlo.`)) return;
  const arr = ninos.filter((_, idx) => idx !== i); setNinos(arr); setActivo(0);
  if (!arr.length) { location.href = location.pathname; return; }
  cargarYrender();
}

// ───────── resumen (tiles) ─────────
function seccionResumen(d) {
  const act = d.actividad || [];
  const desde = Date.now() - 7 * 86400000;
  const sem = act.filter((a) => Date.parse(a.creado) >= desde);
  const quizzes = act.filter((a) => a.modo === "quiz" && a.total > 0);
  const prom = quizzes.length ? Math.round(quizzes.reduce((s, q) => s + q.aciertos / q.total, 0) / quizzes.length * 100) : null;
  const tiles = [tile(sem.length, "actividades esta semana")];
  if (prom != null) tiles.push(tile(prom + "%", "promedio en quiz"));
  tiles.push(tile((d.perfil && d.perfil.racha_dias) || 0, "días de racha"));
  tiles.push(tile((d.notas || []).length, "notas anotadas"));
  return `<div class="card"><p class="secTit"><span class="ic">📊</span> Resumen</p><div class="tiles">${tiles.join("")}</div></div>`;
}
function tile(n, l) { return `<div class="tile"><div class="n">${esc(String(n))}</div><div class="l">${esc(l)}</div></div>`; }

// ───────── actividad: UN día a la vez, con selector desplegable + flechas ─────────
function seccionActividad(act) {
  if (!act.length) return card("🗂️", "Actividad", vacio("Todavía no hay actividad registrada."));
  ACT_DIAS = []; const idx = {};
  for (const a of act) { const k = claveDia(a.creado); if (!(k in idx)) { idx[k] = ACT_DIAS.length; ACT_DIAS.push({ k, iso: a.creado, items: [] }); } ACT_DIAS[idx[k]].items.push(a); }
  const opts = ACT_DIAS.map((g, i) => `<option value="${i}">${esc(tituloDia(g.iso))}</option>`).join("");
  const nav = `<div class="actNav">
      <button class="actArrow" id="actPrev" aria-label="Día anterior">‹</button>
      <div class="actSelWrap"><select id="actSel">${opts}</select></div>
      <button class="actArrow" id="actNext" aria-label="Día siguiente">›</button>
    </div><div id="actDia"></div>`;
  return card("🗂️", "Actividad por día", nav);
}
function wireActividad() {
  const sel = document.getElementById("actSel"); if (!sel) return;
  const prev = document.getElementById("actPrev"), next = document.getElementById("actNext");
  const pintar = (i) => {
    i = Math.max(0, Math.min(ACT_DIAS.length - 1, i));
    sel.value = String(i); pintarDiaAct(i);
    prev.disabled = i >= ACT_DIAS.length - 1; // más viejo
    next.disabled = i <= 0;                   // más nuevo
  };
  sel.onchange = () => pintar(+sel.value);
  prev.onclick = () => pintar(+sel.value + 1);
  next.onclick = () => pintar(+sel.value - 1);
  pintar(0); // arranca en el día más reciente
}
function pintarDiaAct(i) {
  const g = ACT_DIAS[i], box = document.getElementById("actDia"); if (!g || !box) return;
  const resumen = resumenDia(g.items);
  const filas = g.items.map((a) => {
    const m = MODO[a.modo] || { ic: "•", l: a.modo || "" };
    const l2 = [a.materia && limpiaMateria(a.materia), a.tema].filter(Boolean).map(esc).join(" · ");
    const res = a.modo === "quiz" ? resultBadge(a.aciertos, a.total) : `<span class="r-hora">${esc(hora(a.creado))}</span>`;
    return `<div class="act"><span class="ai">${m.ic}</span><div class="ab"><div class="am">${esc(m.l)}</div><div class="at">${l2}</div></div>${res}</div>`;
  }).join("");
  box.innerHTML = (resumen ? `<p class="actResumen">${esc(resumen)}</p>` : "") + filas;
}
function resumenDia(items) {
  const c = {}; for (const a of items) c[a.modo] = (c[a.modo] || 0) + 1;
  const partes = [];
  if (c.retos) partes.push(`${c.retos} práctica${c.retos > 1 ? "s" : ""}`);
  if (c.quiz) partes.push(`${c.quiz} quiz`);
  if (c.examen) partes.push(`${c.examen} examen${c.examen > 1 ? "es" : ""}`);
  if (c.resumen) partes.push(`${c.resumen} resumen${c.resumen > 1 ? "es" : ""}`);
  return partes.join(" · ");
}
function resultBadge(a, t) {
  if (!(Number.isFinite(a) && Number.isFinite(t) && t > 0)) return "";
  const pct = a / t, cls = pct >= 0.8 ? "r-ok" : pct >= 0.6 ? "r-med" : "r-low";
  return `<span class="ar ${cls}">${a}/${t}</span>`;
}

// ───────── notas de exámenes ─────────
function seccionNotas(notas) {
  if (!notas.length) return card("🎓", "Notas de exámenes", vacio("Todavía no anotó ninguna nota de examen."));
  const acc = {};
  for (const n of notas) { const k = limpiaMateria(n.materia || "General"); if (!acc[k]) acc[k] = { suma: 0, n: 0 }; acc[k].suma += Number(n.nota) || 0; acc[k].n++; }
  const chips = Object.entries(acc).map(([mat, a]) => {
    const prom = Math.round(a.suma / a.n * 10) / 10;
    return `<span class="badge" style="background:${notaBg(prom)};color:${notaFg(prom)}">${esc(mat)}: ${prom}${a.n > 1 ? ` (${a.n})` : ""}</span>`;
  }).join(" ");
  const filas = notas.map((n) => {
    const val = Number(n.nota);
    return `<div class="notaRow"><span class="notaBadge ${colorNota(val)}">${esc(String(n.nota).replace(/\.0$/, ""))}</span>
      <div style="min-width:0"><div style="font-weight:800">${esc(limpiaMateria(n.materia || "General"))}</div>
      <div class="at" style="color:var(--muted);font-size:.82rem">${esc(n.descripcion || "Examen")}${n.fecha ? " · " + esc(String(n.fecha).slice(0, 10)) : ""}</div></div></div>`;
  }).join("");
  return card("🎓", "Notas de exámenes", `<div style="margin-bottom:10px">${chips}</div>${filas}`);
}
function colorNota(n) { return n >= 16 ? "nb-buena" : n >= 14 ? "nb-media" : "nb-floja"; }
function notaBg(n) { return n >= 16 ? "#E5F7EF" : n >= 14 ? "#FFF3DA" : "#FDE7ED"; }
function notaFg(n) { return n >= 16 ? "#1FA86A" : n >= 14 ? "#B8770A" : "#EF476F"; }

// ───────── tareas ─────────
function seccionTareas(tareas) {
  if (!tareas.length) return card("📝", "Tareas", vacio("Todavía no cargó tareas."));
  const pend = tareas.filter((t) => !t.hecha), hechas = tareas.filter((t) => t.hecha);
  const filaT = (t, done) => `<div class="li"><span class="lic">${done ? "☑️" : "⬜"}</span><span class="${done ? "tacha" : ""}">${esc(t.descripcion || "Tarea")}${t.materia ? ` · <span class="muted">${esc(limpiaMateria(t.materia))}</span>` : ""}${t.fecha ? ` <span class="muted">(${esc(String(t.fecha).slice(0, 10))})</span>` : ""}</span></div>`;
  let body = pend.length ? pend.map((x) => filaT(x, false)).join("") : `<p class="muted" style="font-size:.88rem;margin:0 0 4px">Sin tareas pendientes 🎉</p>`;
  if (hechas.length) { body += `<p class="lblMini" style="margin:12px 0 6px">Hechas</p>` + hechas.slice(0, 8).map((x) => filaT(x, true)).join(""); }
  return card("📝", "Tareas", body);
}

// ───────── horario semanal ─────────
function seccionHorario(horario) {
  if (!horario.length) return card("📅", "Horario", vacio("Todavía no cargó su horario semanal."));
  const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const porDia = {};
  for (const h of horario) { (porDia[h.dia] = porDia[h.dia] || []).push(h); }
  let body = "";
  for (let d = 1; d <= 5; d++) {
    const ms = (porDia[d] || []).sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((x) => limpiaMateria(x.materia));
    if (ms.length) body += `<div class="hday"><div class="hd">${DIAS[d]}</div><div class="hm">${esc(ms.join(" · "))}</div></div>`;
  }
  return card("📅", "Horario", body);
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
  if (reportes.length) partes.push(`<p style="margin:12px 0 0"><b>${reportes.length}</b> ${reportes.length === 1 ? "ejercicio reportado" : "ejercicios reportados"} por no entenderse o estar mal. Ya le regeneramos otro en su lugar.</p>`);
  return card("💪", "Para reforzar", partes.join(""));
}

// ───────── helpers de UI ─────────
function card(ic, tit, body) { return `<div class="card"><p class="secTit"><span class="ic">${ic}</span> ${esc(tit)}</p>${body}</div>`; }
function vacio(msg) { return `<p class="muted" style="font-size:.88rem;margin:0">${esc(msg)}</p>`; }
function limpiaMateria(m) {
  let s = String(m || "").replace(/\s*\b[1-6][GA]\b\s*$/i, "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
