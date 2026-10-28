// familia.js — Panel de familia (padres). SOLO LECTURA. Soporta VARIOS hijos por dispositivo
// (un padre con 2+ hijos en el cole): cada hijo aporta su propio token; arriba hay un selector.
// Flujo: ?c=CODIGO se canjea por un token persistente que se agrega a la lista de hijos de este
// dispositivo; de ahí en más se pide el panel del hijo activo. Todo contra /api/familia.

// El panel llama a la API de SU MISMO dominio (chispa-familia tiene sus propias llaves de
// Supabase). Relativo = MISMO ORIGEN → sin CORS, sin preflight, lo más robusto (clave en la
// app instalada de Android). Sirve igual si la página se abre en aula-cam (su /api/familia).
const API = "/api/familia";
const KEY_NINOS = "familia_ninos";       // [{token, nombre, grado}]
const KEY_ACTIVO = "familia_activo";     // índice del hijo que se está viendo
const KEY_TOKEN_VIEJO = "familia_ptoken"; // migración desde la versión de 1 solo hijo
const app = document.getElementById("app");
// ⚠️ Declaradas ARRIBA del arranque: boot llama a cargarYrender SÍNCRONO cuando no hay ?c=
// en la URL, y estas variables se usan en ese primer tramo. Tenerlas más abajo causaba
// "Cannot access 'PANEL_CACHE' before initialization" → página muerta al recargar/reabrir
// (el bug que colgó el panel desde el día 1 en todos los dispositivos).
const PANEL_CACHE = {}; // token -> data del panel (en memoria, esta sesión)
let ACT_DIAS = [];      // actividad del hijo activo, agrupada por día (para el selector)

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

const FAMILIA_V = "v9"; // versión visible del panel (carga + footer + errores) para saber qué código corre
// fetch con TIMEOUT (25 s): en redes lentas un fetch sin límite puede colgarse minutos
// y dejar la página "en blanco". Si falla la red devuelve status 0 (NUNCA lanza): el que
// llama decide qué mostrar, y un fallo de red JAMÁS se confunde con "token inválido".
// Las LECTURAS (panel/vinculos) se reintentan solas 1 vez si la primera llamada muere
// (p. ej. un service worker que se actualiza puede matar el request en vuelo al abrir).
async function apiUna(body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
    const d = await r.json().catch(() => null);
    return { status: r.status, d };
  } catch (e) {
    return { status: 0, d: null };
  } finally { clearTimeout(t); }
}
async function api(body) {
  const res = await apiUna(body);
  const esLectura = body && (body.accion === "panel" || body.accion === "vinculos");
  if (res.status === 0 && esLectura) {
    await new Promise((ok) => setTimeout(ok, 900));
    return apiUna(body);
  }
  return res;
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
// Blindado: pase lo que pase (error de red, excepción inesperada) el padre SIEMPRE ve
// algo accionable — nunca una página en blanco ni un esqueleto eterno.
(async function boot() {
  try {
    migrar();
    const code = (new URLSearchParams(location.search).get("c") || "").trim();
    if (code) {
      const { status, d } = await api({ accion: "canjear", code });
      if (d && d.ok && d.token) {
        setActivo(addNino(d.token, d.nino));
        history.replaceState(null, "", location.pathname);
      } else if (status === 0 && !getNinos().length) {
        return estadoRed(() => location.reload(), "sin respuesta de red al canjear");
      } else if (!getNinos().length) {
        return mostrarVincular(false, (d && d.error) || "Ese enlace no es válido o venció. Escribe el código o pide uno nuevo.");
      }
      if (getNinos().length) history.replaceState(null, "", location.pathname);
    }
    if (!getNinos().length) return mostrarVincular(false);
    await cargarYrender();   // await: si algo revienta adentro, cae al catch y SE VE en pantalla
  } catch (e) { estadoRed(() => location.reload(), "error interno: " + (e && e.message || e)); }
})();
// Guardián final: si una promesa muere sin capturar mientras la pantalla sigue en "cargando",
// mostramos el ERROR REAL (con versión) en vez de dejar la página clavada en silencio.
window.addEventListener("unhandledrejection", (ev) => {
  const r = ev && ev.reason;
  if (document.querySelector(".skel") || document.querySelector(".cargando"))
    estadoRed(() => location.reload(), "error interno: " + ((r && r.message) || r));
});

// ───────── vincular con código (pantalla + canje) ─────────
// Necesario para iOS: el ícono de "Agregar a inicio" tiene su propio almacenamiento, así que
// hay que vincularlo escribiendo el código DENTRO de la app (el código sirve 24 h y varias veces).
function hayCamara() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
function mostrarVincular(volver, errMsg) {
  app.innerHTML =
    `<div class="estado vincular">
      <div class="em">🔗</div>
      <h2>Vincula tu acceso</h2>
      <p>Usa el código que te dio tu hijo (Chispa → Familia → Invitar): escanea el QR o escríbelo.</p>
      ${errMsg ? `<p class="vincErr">${esc(errMsg)}</p>` : ""}
      ${hayCamara() ? `<button class="btn" id="scanGo">📷 Escanear QR con la cámara</button><p class="scanSub">o escribe el código:</p>` : ""}
      <input id="codeInput" class="codeIn" autocapitalize="characters" autocomplete="off" spellcheck="false" maxlength="8" placeholder="Ej: ABCD2345" />
      <button class="btn ${hayCamara() ? "ghost" : ""}" id="codeGo">Entrar con el código</button>
      <p class="foot" style="margin-top:20px">📱 <b>En iPhone</b>, para que quede en el ícono: primero "Agregar a inicio", después abre el ícono y vincula aquí. El mismo código sirve por 24 horas.</p>
      ${volver ? '<button class="btn ghost" id="codeBack" style="margin-top:10px">← Volver</button>' : ""}
    </div>`;
  const inp = document.getElementById("codeInput"), go = document.getElementById("codeGo");
  go.onclick = () => vincularConCodigo(inp.value);
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") vincularConCodigo(inp.value); });
  const scan = document.getElementById("scanGo"); if (scan) scan.onclick = escanearQR;
  const back = document.getElementById("codeBack"); if (back) back.onclick = () => cargarYrender();
}
async function vincularConCodigo(code) {
  code = String(code || "").trim().toUpperCase();
  if (code.length < 6) return mostrarVincular(getNinos().length > 0, "El código tiene 8 letras y números. Revísalo.");
  const go = document.getElementById("codeGo"); if (go) { go.disabled = true; go.textContent = "Entrando…"; }
  const { status, d } = await api({ accion: "canjear", code });
  if (d && d.ok && d.token) { setActivo(addNino(d.token, d.nino)); cargarYrender(); }
  else if (status === 0) mostrarVincular(getNinos().length > 0, "Parece un problema de conexión. Prueba de nuevo en un momento.");
  else mostrarVincular(getNinos().length > 0, (d && d.error) || "No pudimos entrar. Prueba de nuevo.");
}

// ───────── escanear el QR con la cámara (jsQR, se carga perezosamente) ─────────
let SCAN_STREAM = null, SCAN_RAF = null;
function pararScan() {
  if (SCAN_RAF) { cancelAnimationFrame(SCAN_RAF); SCAN_RAF = null; }
  if (SCAN_STREAM) { SCAN_STREAM.getTracks().forEach((t) => t.stop()); SCAN_STREAM = null; }
}
function cargarJsQR() {
  if (window.jsQR) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "jsQR.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
function codeDeTexto(txt) {
  try { const u = new URL(txt); const c = u.searchParams.get("c"); if (c) return c.toUpperCase(); } catch (e) {}
  const m = String(txt).match(/[A-Za-z2-9]{6,8}/); return m ? m[0].toUpperCase() : null;
}
async function escanearQR() {
  app.innerHTML =
    `<div class="estado scanWrap">
      <video id="scanVid" playsinline muted></video>
      <p class="scanMsg">Apunta la cámara al código QR</p>
      <button class="btn ghost" id="scanCancel">Cancelar</button>
    </div>`;
  document.getElementById("scanCancel").onclick = () => { pararScan(); mostrarVincular(getNinos().length > 0); };
  try {
    await cargarJsQR();
    if (!window.jsQR) throw new Error("qr");
    SCAN_STREAM = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    const vid = document.getElementById("scanVid");
    if (!vid) { pararScan(); return; }
    vid.srcObject = SCAN_STREAM; await vid.play();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const tick = () => {
      if (!SCAN_STREAM) return;
      if (vid.readyState >= vid.HAVE_CURRENT_DATA && vid.videoWidth) {
        canvas.width = vid.videoWidth; canvas.height = vid.videoHeight;
        ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
        let img = null; try { img = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (e) {}
        if (img) {
          const res = window.jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (res && res.data) { const code = codeDeTexto(res.data); if (code) { pararScan(); return vincularConCodigo(code); } }
        }
      }
      SCAN_RAF = requestAnimationFrame(tick);
    };
    SCAN_RAF = requestAnimationFrame(tick);
  } catch (e) {
    pararScan();
    mostrarVincular(getNinos().length > 0, "No pudimos usar la cámara. Escribe el código a mano.");
  }
}

// Copia local persistente del último panel (por token): si la red falla, mostramos ESTO
// (con aviso) en vez de un error, así el padre SIEMPRE ve algo útil. Nunca desvincula.
function panelKey(token) { return "familia_panel_" + token; }
function guardarPanel(token, d) { try { localStorage.setItem(panelKey(token), JSON.stringify({ ts: Date.now(), d })); } catch (e) {} }
function leerPanel(token) { try { const o = JSON.parse(localStorage.getItem(panelKey(token)) || "null"); return o && o.d ? o : null; } catch (e) { return null; } }
function staleTxt(ts) { try { const iso = new Date(ts).toISOString(); return ` (${tituloDia(iso).toLowerCase()} ${hora(iso)})`; } catch (e) { return ""; } }
// borra TODO el estado local de este dispositivo (para volver a un estado limpio)
function limpiarTodo() {
  try { getNinos().forEach((n) => localStorage.removeItem(panelKey(n.token))); } catch (e) {}
  localStorage.removeItem(KEY_NINOS); localStorage.removeItem(KEY_ACTIVO); localStorage.removeItem(KEY_TOKEN_VIEJO); localStorage.removeItem("familia_nino");
}
// al recuperar conexión, si estamos en la pantalla "sin conexión", reintentar solo
window.addEventListener("online", () => { if (document.getElementById("estadoRed") && getNinos().length) cargarYrender(true); });

// Regla de oro: si alguna vez vimos el panel de este hijo, ABRIR NO DEPENDE DE LA RED.
// Se pinta lo guardado AL INSTANTE y la red solo actualiza en segundo plano. Un fallo de
// red jamás tapa el panel ni desvincula; solo un 401 real (revocado) desvincula.
async function cargarYrender(recargar) {
  const ninos = getNinos();
  const i = getActivo();
  const nino = ninos[i];
  if (!nino) return mostrarVincular(false);
  const cacheMem = PANEL_CACHE[nino.token];
  const cacheDisco = cacheMem ? null : leerPanel(nino.token);
  const cacheD = cacheMem || (cacheDisco && cacheDisco.d) || null;
  // 1) pintar YA lo que tengamos; si no hay nada, esqueleto de carga
  try {
    if (cacheD) render(cacheD, ninos, i);
    else { app.innerHTML = tabsHijos(ninos, i) + '<div class="skel"></div><p class="cargando">Cargando el panel… · ' + FAMILIA_V + "</p>"; wireTabs(ninos); }
  } catch (e) { app.innerHTML = '<div class="skel"></div>'; }
  // 2) actualizar de la red (en segundo plano si ya se pintó algo)
  const res = await api({ accion: "panel", ptoken: nino.token });
  if (getActivo() !== i || getNinos().length !== ninos.length) return; // cambió de hijo mientras cargaba
  if (res.status === 401) {
    const arr = getNinos().filter((x) => x.token !== nino.token); setNinos(arr); setActivo(0);
    if (!arr.length) return estadoError("El acceso caducó", (res.d && res.d.error) || "Pídele a tu hijo un enlace nuevo.", false);
    return cargarYrender();
  }
  try {
    if (res.d && res.d.ok) {
      PANEL_CACHE[nino.token] = res.d; guardarPanel(nino.token, res.d);
      const a = getNinos(); if (res.d.perfil && a[i]) { a[i].nombre = res.d.perfil.nombre || a[i].nombre; a[i].grado = res.d.perfil.grado || a[i].grado; setNinos(a); }
      render(res.d, getNinos(), getActivo());
    } else if (cacheD) {
      // no se pudo actualizar: dejamos el panel guardado en pantalla, con aviso arriba
      render(cacheD, ninos, i, (cacheDisco && cacheDisco.ts) || Date.now(), detalleRes(res));
    } else {
      estadoRed(() => cargarYrender(true), detalleRes(res));
    }
  } catch (e) { estadoRed(() => cargarYrender(true), "error interno: " + (e && e.message || e)); }
}
// resumen técnico corto de una respuesta fallida (para diagnosticar de una captura)
function detalleRes(res) {
  if (!res) return "sin respuesta";
  if (res.status === 0) return "sin respuesta de red (timeout o corte)";
  return "HTTP " + res.status + (res.d && res.d.error ? " · " + String(res.d.error).slice(0, 90) : (res.d ? "" : " · respuesta no válida"));
}

function estadoError(titulo, msg, reintentar) {
  app.innerHTML =
    `<div class="estado"><div class="em">👋</div><h2>${esc(titulo)}</h2><p>${esc(msg)}</p>
      ${reintentar ? '<button class="btn" onclick="location.reload()">Reintentar</button>' : ""}</div>
    <p class="foot">Chispa · Panel de familia</p>`;
}
// problema de conexión (NO borra ningún vínculo): mensaje amable + salidas.
// `detalle` muestra el error técnico real (status + versión) para diagnosticar de una captura.
function estadoRed(onRetry, detalle) {
  app.innerHTML =
    `<div class="estado" id="estadoRed"><div class="em">📶</div><h2>No pudimos cargar</h2>
      <p>Parece un problema de conexión. Tus accesos siguen guardados: prueba de nuevo.</p>
      <button class="btn" id="btnRetry">Reintentar</button>
      <button class="btn ghost" id="btnRedCodigo" style="margin-top:10px">Entrar con un código</button>
      <p class="foot" style="margin-top:16px"><span id="btnReset" style="text-decoration:underline;cursor:pointer">Empezar de cero</span></p>
      <p class="foot" style="margin-top:10px;opacity:.7">${FAMILIA_V}${detalle ? " · " + esc(detalle) : ""}</p></div>`;
  const b = document.getElementById("btnRetry"); if (b) b.onclick = onRetry || (() => location.reload());
  const c = document.getElementById("btnRedCodigo"); if (c) c.onclick = () => mostrarVincular(getNinos().length > 0);
  const r = document.getElementById("btnReset"); if (r) r.onclick = () => { if (confirm("¿Borrar todo de este dispositivo y empezar de cero? Tendrás que vincular de nuevo.")) { limpiarTodo(); mostrarVincular(false); } };
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
function render(d, ninos, i, staleTs, detalle) {
  const p = d.perfil || {};
  const nombre = p.nombre || (ninos[i] && ninos[i].nombre) || "tu hijo";
  const chips = [];
  if (p.grado) chips.push(`<span class="hchip">🎓 ${esc(p.grado)}</span>`);
  if (p.racha_dias >= 2) chips.push(`<span class="hchip">🔥 ${p.racha_dias} días seguidos</span>`);
  if (p.ultimo_acceso) chips.push(`<span class="hchip">🕒 Última vez: ${esc(tituloDia(p.ultimo_acceso).toLowerCase())}</span>`);

  const html = [
    tabsHijos(ninos, i),
    staleTs ? `<div class="staleBanner">📶 No pudimos actualizar — te mostramos lo último guardado${staleTxt(staleTs)}. <span class="staleRetry" id="staleRetry">Reintentar</span>${detalle ? `<br><small style="opacity:.75">${esc(detalle)}</small>` : ""}</div>` : "",
    `<div class="hdr">
      <p class="hi" style="color:rgba(255,255,255,.85)">Panel de familia</p>
      <h1>${esc(primerNombre(nombre))}</h1>
      <p class="sub">Lo que tiene pendiente y lo que estudió en Chispa.</p>
      ${chips.length ? `<div class="chips">${chips.join("")}</div>` : ""}
    </div>`,
    // 2026-10-28: ORDEN POR LO QUE UN PADRE QUIERE SABER PRIMERO. Antes arrancaba con una guía
    // y un resumen, y lo urgente (tareas vencidas, el examen del jueves) quedaba al fondo, con
    // fechas en crudo ("2026-10-27"). Ahora: pendiente → semana → actividad → notas → resto.
    seccionPendiente(d.tareas || []),
    seccionResumen(d),
    seccionActividad(d.actividad || []),
    seccionNotas(d.notas || []),
    seccionTareas(d.tareas || []),
    seccionRefuerzo(d.errores || [], d.reportes || []),
    seccionHorario(d.horario || []),
    `<details class="card guiaPadres">
      <summary class="guiaSum">👋 ¿Qué veo en este panel?</summary>
      <div class="guiaBody">
        <p>Aquí ves, <b>solo para mirar</b>, lo que ${esc(primerNombre(nombre))} hace en Chispa:</p>
        <p>⏰ lo que tiene <b>pendiente</b> (tareas vencidas, exámenes de la semana)<br>
           📚 su <b>actividad</b> (resúmenes, prácticas y quiz, con resultados)<br>
           📝 sus <b>notas</b> de examen, su agenda y en qué le conviene <b>reforzar</b></p>
        <p class="muted">No puedes escribir ni cambiar nada. Es privado: solo con el enlace que te compartió tu hijo, y él puede quitarte el acceso cuando quiera.</p>
      </div>
    </details>`,
    `<div class="center" style="margin-top:8px">
      <button class="btn ghost" id="btnAgregarHijo">＋ Agregar otro hijo</button>
    </div>
    <div class="center" style="margin-top:8px">
      <button class="btn ghost" id="btnRecargar">↻ Actualizar</button>
      <button class="btn ghost" id="btnSalir" style="margin-left:8px">Desvincular</button>
    </div>
    <p class="foot">Chispa · Panel de familia · solo lectura · ${FAMILIA_V}<br>Tu hijo puede quitarte el acceso cuando quiera desde su aula.</p>`,
  ];
  app.innerHTML = html.join("");
  wireTabs(ninos);
  wireActividad();
  // texto largo de una tarea: cortado a 2 líneas, tocar lo abre completo
  document.querySelectorAll(".tarea .tt").forEach((t) => t.onclick = () => t.classList.toggle("abierta"));
  document.getElementById("btnAgregarHijo").onclick = () => mostrarVincular(true);
  document.getElementById("btnRecargar").onclick = () => cargarYrender(true);
  document.getElementById("btnSalir").onclick = desvincularActivo;
  const sr = document.getElementById("staleRetry"); if (sr) sr.onclick = () => cargarYrender(true);
}

function primerNombre(n) { const p = String(n || "").trim().split(/\s+/); return p.slice(0, 2).join(" ") || "tu hijo"; }

function desvincularActivo() {
  const ninos = getNinos(), i = getActivo();
  const nom = primerNombre((ninos[i] && ninos[i].nombre) || "este hijo");
  if (!confirm(`¿Desvincular a ${nom} de este dispositivo? Necesitarás un enlace nuevo para volver a verlo.`)) return;
  const arr = ninos.filter((_, idx) => idx !== i); setNinos(arr); setActivo(0);
  if (!arr.length) { location.href = location.pathname; return; }
  cargarYrender();
}

// ───────── resumen (tiles) ─────────
function seccionResumen(d) {
  const act = d.actividad || [];
  const desde = Date.now() - 7 * 86400000;
  const sem = act.filter((a) => Date.parse(a.creado) >= desde);
  // "días que estudió" dice más que la racha (que ya va en el encabezado) o cuántas notas anotó
  const dias = new Set(sem.map((a) => claveDia(a.creado))).size;
  const quizzes = sem.filter((a) => a.modo === "quiz" && a.total > 0);
  const prom = quizzes.length ? Math.round(quizzes.reduce((s, q) => s + q.aciertos / q.total, 0) / quizzes.length * 100) : null;
  const tiles = [tile(`${dias} de 7`, "días que estudió"), tile(sem.length, "actividades")];
  tiles.push(tile(prom != null ? prom + "%" : "—", prom != null ? "promedio en quiz" : "sin quiz esta semana"));
  return `<div class="card"><p class="secTit"><span class="ic">📊</span> Últimos 7 días</p><div class="tiles tiles3">${tiles.join("")}</div></div>`;
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
      <div class="at" style="color:var(--muted);font-size:.82rem">${esc(n.descripcion || "Examen")}${n.fecha ? " · " + esc(fechaCorta(n.fecha)) : ""}</div></div></div>`;
  }).join("");
  // promedios por materia: solo aportan si alguna materia tiene 2+ notas (si no, repiten la lista)
  const conProm = Object.values(acc).some((a) => a.n > 1);
  return card("🎓", "Notas de exámenes", `${conProm ? `<div style="margin-bottom:10px">${chips}</div>` : ""}${filas}`);
}
function colorNota(n) { return n >= 16 ? "nb-buena" : n >= 14 ? "nb-media" : "nb-floja"; }
function notaBg(n) { return n >= 16 ? "#E5F7EF" : n >= 14 ? "#FFF3DA" : "#FDE7ED"; }
function notaFg(n) { return n >= 16 ? "#1FA86A" : n >= 14 ? "#B8770A" : "#EF476F"; }

// ───────── fechas legibles ("mar 27 oct", "venció hace 2 días") ─────────
const DIAS_C = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function diasHasta(ymd) {   // "YYYY-MM-DD" → días desde hoy en Caracas (0 hoy, <0 pasado), o null
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(ymd || ""))) return null;
  const a = Date.UTC(...String(ymd).slice(0, 10).split("-").map((n, i) => +n - (i === 1 ? 1 : 0)));
  const b = Date.UTC(...hoyYMD().split("-").map((n, i) => +n - (i === 1 ? 1 : 0)));
  return Math.round((a - b) / 86400000);
}
function fechaCorta(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(ymd || ""))) return "";
  const [y, m, d] = String(ymd).slice(0, 10).split("-").map(Number);
  return `${DIAS_C[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MESES_C[m - 1]}`;
}
function cuandoTarea(t) {   // → {txt, cls}
  const n = diasHasta(t.fecha);
  if (n === null) return { txt: "sin fecha", cls: "" };
  if (n < 0) return { txt: n === -1 ? "venció ayer" : `venció hace ${-n} días`, cls: "w-bad" };
  if (n === 0) return { txt: "hoy", cls: "w-hoy" };
  if (n === 1) return { txt: "mañana", cls: "w-hoy" };
  return { txt: n <= 6 ? `en ${n} días · ${fechaCorta(t.fecha)}` : fechaCorta(t.fecha), cls: "" };
}
const TIPO_T = { tarea: "Tarea", trabajo: "Trabajo", examen: "Examen" };
function filaTarea(t) {
  const c = t.hecha ? { txt: "hecha", cls: "w-ok" } : cuandoTarea(t);
  if (!t.hecha && t.tipo === "examen" && c.cls !== "w-bad") c.cls = "w-exam";   // el examen se distingue
  const meta = [TIPO_T[t.tipo] || "Tarea", t.materia && limpiaMateria(t.materia)].filter(Boolean).map(esc).join(" · ");
  return `<div class="tarea${t.hecha ? " hecha" : ""}"><div class="tb"><div class="tt">${esc(t.descripcion || TIPO_T[t.tipo] || "Tarea")}</div>
    <div class="tm">${meta}</div></div><span class="tw ${c.cls}">${esc(c.txt)}</span></div>`;
}

// ───────── lo pendiente: lo PRIMERO que ve el padre ─────────
// Tareas vencidas sin hacer, exámenes de los próximos 7 días y lo que hay para hoy/mañana.
function esUrgente(t) {
  if (t.hecha) return false;
  const n = diasHasta(t.fecha);
  if (n === null) return false;
  return n < 0 || n <= 1 || (t.tipo === "examen" && n <= 7);
}
function seccionPendiente(tareas) {
  const urg = tareas.filter(esUrgente).sort((a, b) => diasHasta(a.fecha) - diasHasta(b.fecha));
  if (!urg.length) return `<div class="card alDia"><p class="secTit" style="margin:0"><span class="ic">✅</span> Todo al día</p>
    <p class="muted" style="margin:6px 0 0;font-size:.9rem">No tiene tareas vencidas ni exámenes esta semana.</p></div>`;
  const venc = urg.filter((t) => diasHasta(t.fecha) < 0).length;
  const sub = venc ? `<p class="pendSub">${venc} ${venc === 1 ? "tarea vencida sin marcar como hecha" : "tareas vencidas sin marcar como hechas"}</p>` : "";
  return `<div class="card pend"><p class="secTit"><span class="ic">⏰</span> Para estar pendiente</p>${sub}${urg.map(filaTarea).join("")}</div>`;
}

// ───────── tareas: lo que viene más adelante + las hechas (plegadas) ─────────
function seccionTareas(tareas) {
  if (!tareas.length) return card("📝", "Tareas", vacio("Todavía no ha anotado tareas en su agenda."));
  const resto = tareas.filter((t) => !t.hecha && !esUrgente(t));
  const hechas = tareas.filter((t) => t.hecha);
  if (!resto.length && !hechas.length) return "";
  let body = resto.map(filaTarea).join("");
  if (hechas.length) body += `<details class="plegable"${resto.length ? "" : ` style="margin-top:0"`}><summary>Ver ${hechas.length} ${hechas.length === 1 ? "tarea hecha" : "tareas hechas"}</summary>${hechas.slice(0, 15).map(filaTarea).join("")}</details>`;
  return card("📝", resto.length ? "Más adelante" : "Tareas", body);
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
  // se consulta poco: plegado, para que no empuje lo importante
  return `<details class="card plegCard"><summary class="secTit"><span class="ic">📅</span> Horario de la semana</summary><div style="margin-top:12px">${body}</div></details>`;
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
