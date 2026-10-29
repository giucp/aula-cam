// familia.js — Panel de padres de Chispa. SOLO LECTURA. Varios hijos por dispositivo (cada hijo
// aporta su propio token; arriba hay un selector). Flujo: ?c=CODIGO (o el código escrito / el QR)
// se canjea por un token persistente; de ahí en más se pide el panel del hijo activo a /api/familia.
//
// 2026-10-29 · REDISEÑO PROFESIONAL. El panel nació con la estética infantil de la primera Chispa y
// solo decía cosas generales ("entró hoy"). Ahora es una herramienta para adultos: estética neutra
// (no la de Chispa), periodo elegible (7 días / 30 días / año escolar) y análisis real:
// tiempo de estudio medido, días activos, resultados por materia y por tema, cada pregunta que
// falló con su respuesta y la correcta, historial con hora y detalle (ejercicios vistos, pistas,
// guía o IA), uso de la app por franja horaria, alertas y agenda completa.
//
// ★ ARRANQUE AL FINAL DEL ARCHIVO (boot() en la última línea). Antes el arranque estaba arriba y el
//   primer render (desde la copia guardada) corría antes de que existieran constantes declaradas más
//   abajo → "Cannot access X before initialization" y página muerta. Con boot() al final, todo lo
//   que el render usa ya existe.

// El panel llama a la API de SU MISMO dominio (chispa-familia tiene sus propias llaves). Relativo =
// mismo origen → sin CORS, lo más robusto en la app instalada. Sirve igual abierto en aula-cam.
const API = "/api/familia";
const KEY_NINOS = "familia_ninos";        // [{token, nombre, grado}]
const KEY_ACTIVO = "familia_activo";      // índice del hijo que se está viendo
const KEY_TOKEN_VIEJO = "familia_ptoken"; // migración desde la versión de 1 solo hijo
const KEY_PERIODO = "familia_periodo";    // "7" | "30" | "anio"
const FAMILIA_V = "v15";                   // versión visible (footer y errores) para saber qué código corre
const app = document.getElementById("app");
const PANEL_CACHE = {};                   // token -> data del panel (en memoria, esta sesión)
let PANEL_ACTUAL = null;                  // { d, ninos, i, staleTs, detalle } para re-pintar al cambiar filtros
let FILTRO_HIST = "";                     // materia elegida en el historial

const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ───────── fechas (todo en hora de Caracas) ─────────
const DIAS_L = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DIAS_C = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_C = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const TIPO_T = { tarea: "Tarea", trabajo: "Trabajo", examen: "Examen" };
const MODO = {
  resumen: { l: "Resumen", v: "Leyó el resumen" },
  retos: { l: "Práctica", v: "Practicó" },
  quiz: { l: "Quiz", v: "Hizo un quiz" },
  examen: { l: "Simulacro", v: "Simulacro de examen" },
};
const FUENTE = { guia: "Guía revisada", ia: "Generado con IA", cumbre: "Cumbre" };
const FMT_YMD = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Caracas" });
const FMT_HORA = new Intl.DateTimeFormat("es", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/Caracas" });
const FMT_H24 = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "America/Caracas" });
function claveDia(iso) { try { return FMT_YMD.format(new Date(iso)); } catch (e) { return ""; } }
function hoyYMD() { return FMT_YMD.format(new Date()); }
function sumarDias(ymd, n) { const [y, m, d] = ymd.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.toISOString().slice(0, 10); }
function diasEntre(a, b) { const f = (s) => Date.UTC(...s.split("-").map((n, i) => +n - (i === 1 ? 1 : 0))); return Math.round((f(b) - f(a)) / 86400000); }
function diaSemana(ymd) { const [y, m, d] = ymd.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
function fechaCorta(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(ymd || ""))) return "";
  const k = String(ymd).slice(0, 10), [, m, d] = k.split("-").map(Number);
  return `${DIAS_C[diaSemana(k)]} ${d} ${MESES_C[m - 1]}`;
}
function tituloDia(ymd) {
  const hoy = hoyYMD();
  if (ymd === hoy) return "Hoy";
  if (ymd === sumarDias(hoy, -1)) return "Ayer";
  const [, m, d] = ymd.split("-").map(Number);
  return `${DIAS_L[diaSemana(ymd)]} ${d} ${MESES_C[m - 1]}`;
}
function hora(iso) { try { return FMT_HORA.format(new Date(iso)).replace(/\s?([ap])\.?\s?m\.?/i, " $1. m.").replace(/\s+/g, " "); } catch (e) { return ""; } }
function hora24(iso) { try { return parseInt(FMT_H24.format(new Date(iso)), 10) % 24; } catch (e) { return 0; } }
function haceTxt(iso) {
  if (!iso) return "nunca";
  const n = diasEntre(claveDia(iso), hoyYMD());
  if (n <= 0) return `hoy, ${hora(iso)}`;
  if (n === 1) return `ayer, ${hora(iso)}`;
  return `hace ${n} días (${fechaCorta(claveDia(iso))})`;
}
function diasHasta(ymd) { return /^\d{4}-\d{2}-\d{2}/.test(String(ymd || "")) ? diasEntre(hoyYMD(), String(ymd).slice(0, 10)) : null; }
function fmtDur(seg) {
  seg = Math.round(seg || 0);
  if (seg < 60) return seg > 0 ? "<1 min" : "0 min";
  const m = Math.round(seg / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")} min`;
}
const pct = (a, t) => (t > 0 ? Math.round((a / t) * 100) : null);
function claseNota(p) { return p == null ? "" : p >= 80 ? "ok" : p >= 60 ? "med" : "bad"; }
function limpiaMateria(m) {
  let s = String(m || "").replace(/^Cumbre\s*·\s*/i, "").replace(/\s*\b[1-6]\s*[GA]\b\s*$/i, "").trim();
  if (!s) return "General";
  s = s.toLowerCase().replace(/(^|[\s(¿"'\-/])([a-záéíóúñü])/g, (x, p, c) => p + c.toUpperCase());
  return s.replace(/(?!^)\b(De|Del|La|Las|Los|El|Y|E|En|Para|Con)\b/g, (w) => w.toLowerCase());
}
function limpiaTema(t) {
  // "TEMA 2. Clima y vegetación." → "Tema 2 · Clima y vegetación" (así lo escriben los profes en el aula)
  let s = String(t || "").trim().replace(/^TEMA\s*(\d+)\s*[.:·-]?\s*/i, "Tema $1 · ").replace(/\.\s*$/, "");
  return s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}
function primerNombre(n) { const p = String(n || "").trim().split(/\s+/); return p.slice(0, 2).join(" ") || "tu hijo"; }

// íconos de línea (sin emojis: es una herramienta para adultos)
const ICO = {
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  lista: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
  check: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.6 2.6L16 9.5"/>',
  alerta: '<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
  cel: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  libro: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5"/>',
  flecha: '<path d="m9 6 6 6-6 6"/>',
  recargar: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  salir: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 16l-4-4 4-4M6 12h10"/>',
};
const ico = (n, c) => `<svg class="ico${c ? " " + c : ""}" viewBox="0 0 24 24" aria-hidden="true">${ICO[n] || ""}</svg>`;

// ───────── red ─────────
// fetch con timeout (10 s); si falla la red devuelve status 0 (nunca lanza): un fallo de red
// JAMÁS se confunde con "token inválido". Las lecturas se reintentan solas una vez.
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
  if (res.status === 0 && body && body.accion === "panel") {
    await new Promise((ok) => setTimeout(ok, 900));
    return apiUna(body);
  }
  return res;
}

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
function getPeriodo() { const p = localStorage.getItem(KEY_PERIODO); return p === "30" || p === "anio" ? p : "7"; }

// ───────── vincular con código (pantalla + canje) ─────────
// iOS: el ícono de "Agregar a inicio" tiene su propio almacenamiento, así que hay que vincularlo
// escribiendo el código DENTRO de la app (el código sirve 24 h y varias veces).
function hayCamara() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
function mostrarVincular(volver, errMsg) {
  app.innerHTML =
    `<div class="pantalla">
      <div class="marca">Chispa <span>· Panel familiar</span></div>
      <h1>Vincular un acceso</h1>
      <p class="sec">Pide a tu hijo el código de acceso. En su Chispa: menú <b>⋮</b> → <b>Dar acceso a un adulto</b>. Escanea el QR o escribe el código.</p>
      ${errMsg ? `<p class="aviso bad">${esc(errMsg)}</p>` : ""}
      <label class="lbl" for="codeInput">Código de acceso</label>
      <input id="codeInput" class="codeIn" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="ABCD2345" />
      <button class="btn" id="codeGo" type="button">Entrar</button>
      ${hayCamara() ? `<button class="btn sec2" id="scanGo" type="button">Escanear el código QR</button>` : ""}
      ${volver ? '<button class="btn link" id="codeBack" type="button">Volver al panel</button>' : ""}
      <p class="nota">En iPhone, para que quede en la pantalla de inicio: primero "Agregar a inicio" y después vincula desde ese ícono. El mismo código sirve 24 horas y en varios teléfonos.</p>
    </div>`;
  const inp = document.getElementById("codeInput"), go = document.getElementById("codeGo");
  go.onclick = () => vincularConCodigo(inp.value);
  inp.addEventListener("input", () => {
    const v = inp.value;
    if (v.length > 8 || /\s|-/.test(v)) { const c = codeDeTexto(v); if (c) inp.value = c; }
  });
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") vincularConCodigo(inp.value); });
  const scan = document.getElementById("scanGo"); if (scan) scan.onclick = escanearQR;
  const back = document.getElementById("codeBack"); if (back) back.onclick = () => cargarYrender();
}
async function vincularConCodigo(code) {
  code = codeDeTexto(code) || String(code || "").trim().replace(/[\s-]/g, "").toUpperCase();
  if (code.length < 6) return mostrarVincular(getNinos().length > 0, "El código tiene 8 letras y números. Revísalo.");
  const go = document.getElementById("codeGo"); if (go) { go.disabled = true; go.textContent = "Entrando…"; }
  const { status, d } = await api({ accion: "canjear", code });
  if (d && d.ok && d.token) { setActivo(addNino(d.token, d.nino)); cargarYrender(); }
  else if (status === 0) mostrarVincular(getNinos().length > 0, "Parece un problema de conexión. Prueba de nuevo en un momento.");
  else mostrarVincular(getNinos().length > 0, (d && d.error) || "No pudimos entrar. Prueba de nuevo.");
}
// Saca el código de lo que sea que pegue el adulto: el código solo, el enlace o el mensaje entero
// de "Compartir". Exactamente 8 del alfabeto del servidor (sin 0/O/1/I): una casilla de una línea
// BORRA los saltos al pegar, y "…?c=PQRS2345⏎O entra…" quedaba "…?c=PQRS2345O entra…".
function codeDeTexto(txt) {
  const ALFA_CODE = "A-HJ-NP-Z2-9";
  const t = String(txt || "");
  const c = t.match(new RegExp("[?&]c=([" + ALFA_CODE + "]{8})", "i")); if (c) return c[1].toUpperCase();
  const solo = t.trim().replace(/[\s-]/g, "").toUpperCase();
  if (new RegExp("^[" + ALFA_CODE + "]{8}$").test(solo)) return solo;
  const m = t.toUpperCase().match(new RegExp("(?:^|[^A-Z0-9])([" + ALFA_CODE + "]{8})(?![A-Z0-9])"));
  return m ? m[1] : null;
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
async function escanearQR() {
  app.innerHTML =
    `<div class="pantalla scanWrap">
      <video id="scanVid" playsinline muted></video>
      <p class="sec">Apunta la cámara al código QR</p>
      <button class="btn sec2" id="scanCancel" type="button">Cancelar</button>
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

// ───────── copia guardada + carga ─────────
// Si alguna vez vimos el panel de este hijo, ABRIR NO DEPENDE DE LA RED: se pinta lo guardado al
// instante y la red actualiza detrás. Un fallo de red jamás desvincula; solo un 401 real (acceso
// quitado) lo hace.
function panelKey(token) { return "familia_panel_" + token; }
function guardarPanel(token, d) { try { localStorage.setItem(panelKey(token), JSON.stringify({ ts: Date.now(), d })); } catch (e) {} }
function leerPanel(token) { try { const o = JSON.parse(localStorage.getItem(panelKey(token)) || "null"); return o && o.d ? o : null; } catch (e) { return null; } }
function limpiarTodo() {
  try { getNinos().forEach((n) => localStorage.removeItem(panelKey(n.token))); } catch (e) {}
  [KEY_NINOS, KEY_ACTIVO, KEY_TOKEN_VIEJO, "familia_nino"].forEach((k) => localStorage.removeItem(k));
}
window.addEventListener("online", () => { if (document.getElementById("estadoRed") && getNinos().length) cargarYrender(true); });

async function cargarYrender() {
  const ninos = getNinos();
  const i = getActivo();
  const nino = ninos[i];
  if (!nino) return mostrarVincular(false);
  const cacheMem = PANEL_CACHE[nino.token];
  const cacheDisco = cacheMem ? null : leerPanel(nino.token);
  const cacheD = cacheMem || (cacheDisco && cacheDisco.d) || null;
  try {
    if (cacheD) render(cacheD, ninos, i);
    else app.innerHTML = `<div class="cargando"><div class="spin"></div><p>Cargando el panel · ${FAMILIA_V}</p></div>`;
  } catch (e) { app.innerHTML = `<div class="cargando"><div class="spin"></div></div>`; }
  const res = await api({ accion: "panel", ptoken: nino.token });
  if (getActivo() !== i || getNinos().length !== ninos.length) return; // cambió de hijo mientras cargaba
  if (res.status === 401) {
    const arr = getNinos().filter((x) => x.token !== nino.token); setNinos(arr); setActivo(0);
    if (!arr.length) return mostrarVincular(false, "Tu acceso a " + primerNombre(nino.nombre || "tu hijo") + " ya no está activo (pudo quitarlo desde su Chispa). Pídele un código nuevo.");
    return cargarYrender();
  }
  try {
    if (res.d && res.d.ok) {
      PANEL_CACHE[nino.token] = res.d; guardarPanel(nino.token, res.d);
      const a = getNinos(); if (res.d.perfil && a[i]) { a[i].nombre = res.d.perfil.nombre || a[i].nombre; a[i].grado = res.d.perfil.grado || a[i].grado; setNinos(a); }
      render(res.d, getNinos(), getActivo());
    } else if (cacheD) {
      render(cacheD, ninos, i, (cacheDisco && cacheDisco.ts) || Date.now(), detalleRes(res));
    } else {
      estadoRed(() => cargarYrender(true), detalleRes(res));
    }
  } catch (e) { estadoRed(() => cargarYrender(true), "error interno: " + (e && e.message || e)); }
}
function detalleRes(res) {
  if (!res) return "sin respuesta";
  if (res.status === 0) return "sin respuesta de red (timeout o corte)";
  return "HTTP " + res.status + (res.d && res.d.error ? " · " + String(res.d.error).slice(0, 90) : (res.d ? "" : " · respuesta no válida"));
}
function estadoRed(onRetry, detalle) {
  app.innerHTML =
    `<div class="pantalla" id="estadoRed">
      <div class="marca">Chispa <span>· Panel familiar</span></div>
      <h1>No pudimos cargar el panel</h1>
      <p class="sec">Parece un problema de conexión. Tus accesos siguen guardados.</p>
      <button class="btn" id="btnRetry" type="button">Reintentar</button>
      <button class="btn sec2" id="btnRedCodigo" type="button">Entrar con un código</button>
      <button class="btn link" id="btnReset" type="button">Empezar de cero en este dispositivo</button>
      <p class="nota">${FAMILIA_V}${detalle ? " · " + esc(detalle) : ""}</p>
    </div>`;
  document.getElementById("btnRetry").onclick = onRetry || (() => location.reload());
  document.getElementById("btnRedCodigo").onclick = () => mostrarVincular(getNinos().length > 0);
  document.getElementById("btnReset").onclick = () => { if (confirm("¿Borrar todo de este dispositivo y empezar de cero? Tendrás que vincular de nuevo.")) { limpiarTodo(); mostrarVincular(false); } };
}
function desvincularActivo() {
  const ninos = getNinos(), i = getActivo();
  const nom = primerNombre((ninos[i] && ninos[i].nombre) || "este hijo");
  if (!confirm(`¿Quitar a ${nom} de este dispositivo? Necesitarás un código nuevo para volver a verlo.`)) return;
  const arr = ninos.filter((_, idx) => idx !== i); setNinos(arr); setActivo(0);
  if (!arr.length) { location.href = location.pathname; return; }
  cargarYrender();
}

// ═════════════════════════════ ANÁLISIS ═════════════════════════════
// Todo se calcula en el teléfono a partir de lo que manda /api/familia (año escolar en curso).
function periodoInfo(p, anioDesde) {
  const hoy = hoyYMD();
  if (p === "anio") {
    const desde = anioDesde || sumarDias(hoy, -60);
    return { desde, dias: diasEntre(desde, hoy) + 1, etiqueta: "en el año escolar", corto: "Año escolar" };
  }
  const n = p === "30" ? 30 : 7;
  return { desde: sumarDias(hoy, -(n - 1)), dias: n, etiqueta: `en los últimos ${n} días`, corto: `${n} días` };
}
// Une cada registro de `actividad` con su sesión de `estudio` (mismo tema y tipo, cercanas en el
// tiempo) y agrega las sesiones SIN actividad (p. ej. abrió una práctica y no vio ninguna respuesta).
function construirEventos(act, est) {
  const usados = new Set();
  const clave = (x) => `${limpiaMateria(x.materia)}|${String(x.tema || "").trim().toLowerCase()}|${x.modo}`;
  const porClave = {};
  est.forEach((e, idx) => { (porClave[clave(e)] = porClave[clave(e)] || []).push(idx); });
  const eventos = act.map((a) => {
    const t = Date.parse(a.creado);
    let mejor = -1, dist = Infinity;
    for (const idx of porClave[clave(a)] || []) {
      if (usados.has(idx)) continue;
      const te = Date.parse(est[idx].creado), dd = te - t;   // la sesión se cierra DESPUÉS de registrar la actividad
      if (dd > -15 * 60000 && dd < 4 * 3600000 && Math.abs(dd) < dist) { dist = Math.abs(dd); mejor = idx; }
    }
    if (mejor >= 0) usados.add(mejor);
    return { ...a, est: mejor >= 0 ? est[mejor] : null };
  });
  est.forEach((e, idx) => { if (!usados.has(idx)) eventos.push({ materia: e.materia, tema: e.tema, modo: e.modo, creado: e.creado, aciertos: e.aciertos, total: e.total, est: e, soloSesion: true }); });
  eventos.sort((a, b) => Date.parse(b.creado) - Date.parse(a.creado));
  return eventos;
}
function analizar(d, periodo) {
  const P = periodoInfo(periodo, d.anioDesde);
  const enP = (iso) => claveDia(iso) >= P.desde;
  const act = (d.actividad || []).filter((a) => enP(a.creado));
  const est = (d.estudio || []).filter((e) => enP(e.creado));
  const ape = (d.aperturas || []).filter(enP);
  const eventos = construirEventos(act, est);
  const quizzes = eventos.filter((e) => e.modo === "quiz" && e.total > 0 && Number.isFinite(e.aciertos));
  const segundos = est.reduce((s, e) => s + (e.segundos || 0), 0);
  const diasActivos = new Set([...act.map((a) => claveDia(a.creado)), ...est.map((e) => claveDia(e.creado))]);
  const midiendo = (d.estudio || []).length > 0;   // ¿ya hay datos de tiempo? (tablas nuevas, 29-oct-2026)
  const promQuiz = quizzes.length ? Math.round(quizzes.reduce((s, q) => s + q.aciertos / q.total, 0) / quizzes.length * 100) : null;
  // por materia
  const mats = {};
  for (const e of eventos) {
    const m = limpiaMateria(e.materia);
    const M = (mats[m] = mats[m] || { materia: m, eventos: 0, segundos: 0, quiz: [], temas: {}, ultimo: null });
    M.eventos++; if (e.est) M.segundos += e.est.segundos || 0;
    if (!M.ultimo || e.creado > M.ultimo) M.ultimo = e.creado;
    if (e.modo === "quiz" && e.total > 0) M.quiz.push(e.aciertos / e.total);
    const tk = limpiaTema(e.tema) || "Sin tema";
    const T = (M.temas[tk] = M.temas[tk] || { tema: tk, modos: new Set(), quizMejor: null, quizUlt: null, segundos: 0, ultimo: null });
    T.modos.add(e.modo); if (e.est) T.segundos += e.est.segundos || 0;
    if (!T.ultimo || e.creado > T.ultimo) T.ultimo = e.creado;
    if (e.modo === "quiz" && e.total > 0) { const v = e.aciertos / e.total; if (T.quizMejor == null || v > T.quizMejor) T.quizMejor = v; if (T.quizUlt == null) T.quizUlt = v; }
  }
  // por día (para el gráfico)
  const porDia = {};
  for (const e of eventos) { const k = claveDia(e.creado); const D = (porDia[k] = porDia[k] || { n: 0, seg: 0 }); D.n++; if (e.est) D.seg += e.est.segundos || 0; }
  // estudio superficial: práctica/simulacro con TODAS las respuestas vistas a menos de 20 s por ejercicio
  const rapidas = est.filter((e) => (e.modo === "retos" || e.modo === "examen") && e.items > 0 && e.revelados >= e.items && e.segundos < e.items * 20);
  return { P, act, est, ape, eventos, quizzes, segundos, diasActivos, midiendo, promQuiz, mats, porDia, rapidas };
}

// ═════════════════════════════ RENDER ═════════════════════════════
function render(d, ninos, i, staleTs, detalle) {
  PANEL_ACTUAL = { d, ninos, i, staleTs, detalle };
  const periodo = getPeriodo();
  const A = analizar(d, periodo);
  const p = d.perfil || {};
  const nombre = primerNombre(p.nombre || (ninos[i] && ninos[i].nombre) || "tu hijo");
  const ultEstudio = [...(d.actividad || []), ...(d.estudio || [])].reduce((m, x) => (!m || x.creado > m ? x.creado : m), null);
  // la última apertura registrada es más precisa que usuarios.ultimo_acceso (ese solo se mueve cuando
  // la app refresca las materias con el aula, cada ~4 horas)
  const ultApertura = [p.ultimo_acceso, (d.aperturas || [])[0]].filter(Boolean).sort().pop() || null;

  app.innerHTML = [
    barraSuperior(ninos, i),
    staleTs ? `<div class="aviso warn">No pudimos actualizar; se muestra lo último guardado (${esc(haceTxt(new Date(staleTs).toISOString()))}). <button class="lnk" id="staleRetry" type="button">Reintentar</button>${detalle ? `<br><small>${esc(detalle)}</small>` : ""}</div>` : "",
    `<header class="perfil">
      <div>
        <h1>${esc(nombre)}</h1>
        <p class="sec">${esc([p.grado, "Último estudio: " + haceTxt(ultEstudio), "Abrió Chispa: " + haceTxt(ultApertura)].filter(Boolean).join(" · "))}</p>
      </div>
      <div class="seg" role="group" aria-label="Periodo">
        ${[["7", "7 días"], ["30", "30 días"], ["anio", "Año escolar"]].map(([v, l]) => `<button type="button" data-p="${v}" aria-pressed="${periodo === v}">${l}</button>`).join("")}
      </div>
    </header>`,
    `<nav class="indice" aria-label="Secciones">
      ${[["sAtencion", "Atención"], ["sMaterias", "Materias"], ["sQuiz", "Quiz"], ["sErrores", "Errores"], ["sHistorial", "Historial"], ["sAgenda", "Agenda"], ["sUso", "Uso de la app"]].map(([id, l]) => `<a href="#${id}">${l}</a>`).join("")}
    </nav>`,
    seccionKpis(A, d),
    seccionAtencion(A, d),
    seccionGrafico(A),
    seccionMaterias(A),
    seccionQuiz(A),
    seccionErrores(d.errores || []),
    seccionHistorial(A),
    seccionAgenda(d),
    seccionUso(A, d),
    seccionReportes(d.reportes || []),
    `<footer class="pie">
      <p>Panel de solo lectura: aquí no se puede cambiar nada de la cuenta de ${esc(nombre)}. ${esc(nombre)} puede quitar este acceso cuando quiera desde su Chispa.</p>
      <p>${A.midiendo ? "El tiempo de estudio cuenta solo los minutos con la app abierta y en uso (sin contar la pantalla quieta)." : "El tiempo de estudio, los ejercicios vistos y el uso por hora se registran desde el 29 de octubre de 2026."}</p>
      <p class="ver">Chispa · Panel familiar · ${FAMILIA_V}</p>
    </footer>`,
  ].join("");
  conectar();
}

function barraSuperior(ninos, activo) {
  const tabs = ninos.length > 1
    ? `<div class="hijos" role="tablist">${ninos.map((n, k) => `<button type="button" role="tab" class="hijo" data-i="${k}" aria-selected="${k === activo}">${esc(primerNombre(n.nombre || "Hijo"))}</button>`).join("")}</div>`
    : "";
  return `<div class="top">
    <div class="marca">Chispa <span>· Panel familiar</span></div>
    <div class="acciones">
      <button class="icoBtn" id="btnRecargar" type="button" title="Actualizar" aria-label="Actualizar">${ico("recargar")}</button>
      <details class="menu"><summary class="icoBtn" aria-label="Más opciones">⋯</summary>
        <div class="menuPop">
          <button type="button" id="btnAgregarHijo">${ico("mas")} Agregar otro hijo</button>
          <button type="button" id="btnSalir">${ico("salir")} Quitar de este dispositivo</button>
        </div>
      </details>
    </div>
  </div>${tabs}`;
}

function kpi(label, valor, sub, cls) {
  return `<div class="kpi${cls ? " " + cls : ""}"><span class="kLbl">${esc(label)}</span><span class="kVal">${valor}</span>${sub ? `<span class="kSub">${sub}</span>` : ""}</div>`;
}
function seccionKpis(A, d) {
  const t = A.act;
  const c = { resumen: 0, retos: 0, quiz: 0, examen: 0 }; t.forEach((a) => { if (a.modo in c) c[a.modo]++; });
  const desglose = [c.resumen && `${c.resumen} res.`, c.retos && `${c.retos} práct.`, c.quiz && `${c.quiz} quiz`, c.examen && `${c.examen} simul.`].filter(Boolean).join(" · ");
  const tareas = d.tareas || [];
  const venc = tareas.filter((x) => !x.hecha && diasHasta(x.fecha) != null && diasHasta(x.fecha) < 0).length;
  const pend = tareas.filter((x) => !x.hecha).length;
  const dAct = A.diasActivos.size;
  const promDia = dAct ? fmtDur(A.segundos / dAct) : null;
  const errs = (d.errores || []).length;
  const temasErr = new Set((d.errores || []).map((e) => (e.materia || "") + "|" + (e.tema || ""))).size;
  return `<section class="kpis" aria-label="Indicadores ${esc(A.P.etiqueta)}">
    ${kpi("Tiempo de estudio", A.midiendo ? esc(fmtDur(A.segundos)) : "—", A.midiendo ? (promDia ? `${esc(promDia)} por día con estudio` : "sin estudio en el periodo") : "se mide desde el 29 oct")}
    ${kpi("Días con estudio", `${dAct}<small>/${A.P.dias}</small>`, esc(A.P.etiqueta))}
    ${kpi("Actividades", String(t.length), desglose ? esc(desglose) : "ninguna en el periodo")}
    ${kpi("Promedio en quiz", A.promQuiz == null ? "—" : `${A.promQuiz}%`, A.quizzes.length ? `${A.quizzes.length} quiz · mejor ${Math.max(...A.quizzes.map((q) => pct(q.aciertos, q.total)))}%` : "sin quiz en el periodo", A.promQuiz == null ? "" : claseNota(A.promQuiz))}
    ${kpi("Tareas pendientes", String(pend), venc ? `<b class="t-bad">${venc} vencida${venc > 1 ? "s" : ""}</b>` : "ninguna vencida", venc ? "bad" : "")}
    ${kpi("Preguntas falladas", String(errs), errs ? `en ${temasErr} tema${temasErr > 1 ? "s" : ""} · para repasar` : "ninguna pendiente")}
  </section>`;
}

function seccionAtencion(A, d) {
  const items = [];
  const tareas = d.tareas || [];
  const venc = tareas.filter((x) => !x.hecha && diasHasta(x.fecha) != null && diasHasta(x.fecha) < 0).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  venc.forEach((t) => items.push({ cls: "bad", ic: "alerta", tit: `Tarea vencida: ${t.descripcion || TIPO_T[t.tipo] || "Tarea"}`, sub: `${limpiaMateria(t.materia)} · venció ${fechaCorta(t.fecha)} (hace ${-diasHasta(t.fecha)} día${-diasHasta(t.fecha) > 1 ? "s" : ""}) · sin marcar como hecha` }));
  tareas.filter((x) => !x.hecha && x.tipo === "examen" && diasHasta(x.fecha) != null && diasHasta(x.fecha) >= 0 && diasHasta(x.fecha) <= 7)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .forEach((t) => {
      const n = diasHasta(t.fecha), mat = limpiaMateria(t.materia);
      const prep = (d.actividad || []).filter((a) => limpiaMateria(a.materia) === mat && diasEntre(claveDia(a.creado), hoyYMD()) <= 7).length;
      items.push({ cls: "warn", ic: "cal", tit: `Examen de ${mat} ${n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`} (${fechaCorta(t.fecha)})`, sub: `${t.descripcion ? t.descripcion + " · " : ""}${prep ? `${prep} actividad${prep > 1 ? "es" : ""} de ${mat} esta semana` : `no ha practicado ${mat} esta semana`}` });
    });
  tareas.filter((x) => !x.hecha && x.tipo !== "examen" && (diasHasta(x.fecha) === 0 || diasHasta(x.fecha) === 1))
    .forEach((t) => items.push({ cls: "warn", ic: "lista", tit: `Para ${diasHasta(t.fecha) === 0 ? "hoy" : "mañana"}: ${t.descripcion || TIPO_T[t.tipo] || "Tarea"}`, sub: limpiaMateria(t.materia) }));
  A.quizzes.filter((q) => pct(q.aciertos, q.total) < 60).slice(0, 4)
    .forEach((q) => items.push({ cls: "warn", ic: "x", tit: `Quiz bajo: ${pct(q.aciertos, q.total)}% en ${limpiaMateria(q.materia)}`, sub: `${limpiaTema(q.tema)} · ${q.aciertos}/${q.total} · ${tituloDia(claveDia(q.creado))}` }));
  if (A.rapidas.length) items.push({ cls: "warn", ic: "reloj", tit: `Vio respuestas muy rápido ${A.rapidas.length} ${A.rapidas.length === 1 ? "vez" : "veces"}`, sub: "Abrió todas las respuestas de una práctica o simulacro en menos de 20 segundos por ejercicio: puede estar mirando sin resolver." });
  const ult = [...(d.actividad || []), ...(d.estudio || [])].reduce((m, x) => (!m || x.creado > m ? x.creado : m), null);
  const sinEst = ult ? diasEntre(claveDia(ult), hoyYMD()) : null;
  if (sinEst != null && sinEst >= 3) items.push({ cls: "warn", ic: "reloj", tit: `Lleva ${sinEst} días sin estudiar en Chispa`, sub: `Última actividad: ${haceTxt(ult)}` });
  (d.notas || []).filter((n) => Number(n.nota) < 14 && diasHasta(n.fecha) != null && diasHasta(n.fecha) >= -21)
    .forEach((n) => items.push({ cls: "warn", ic: "libro", tit: `Nota baja: ${String(n.nota).replace(/\.0$/, "")}/20 en ${limpiaMateria(n.materia)}`, sub: `${n.descripcion || "Examen"} · ${fechaCorta(n.fecha)}` }));
  const cuerpo = items.length
    ? `<ul class="alertas">${items.map((x) => `<li class="${x.cls}">${ico(x.ic)}<div><b>${esc(x.tit)}</b><span>${esc(x.sub)}</span></div></li>`).join("")}</ul>`
    : `<p class="ok-line">${ico("check")} Todo en orden: sin tareas vencidas, sin exámenes esta semana y sin resultados bajos ${esc(A.P.etiqueta)}.</p>`;
  return card("sAtencion", "Requiere atención", cuerpo, items.length ? `${items.length}` : "");
}

function seccionGrafico(A) {
  // 7/30 días → barras por día; año escolar → por semana (lunes)
  const semanal = A.P.dias > 31;
  const barras = [];
  if (!semanal) {
    for (let k = A.P.dias - 1; k >= 0; k--) {
      const ymd = sumarDias(hoyYMD(), -k), D = A.porDia[ymd] || { n: 0, seg: 0 };
      const [, , dd] = ymd.split("-").map(Number);
      barras.push({ lbl: A.P.dias <= 7 ? DIAS_C[diaSemana(ymd)] : String(dd), tip: tituloDia(ymd), ...D });
    }
  } else {
    let ini = A.P.desde; ini = sumarDias(ini, -((diaSemana(ini) + 6) % 7));
    for (let s = ini; s <= hoyYMD(); s = sumarDias(s, 7)) {
      let n = 0, seg = 0;
      for (let k = 0; k < 7; k++) { const D = A.porDia[sumarDias(s, k)]; if (D) { n += D.n; seg += D.seg; } }
      const [, m, dd] = s.split("-").map(Number);
      barras.push({ lbl: `${dd} ${MESES_C[m - 1]}`, tip: `Semana del ${dd} ${MESES_C[m - 1]}`, n, seg });
    }
  }
  const usarTiempo = A.midiendo && barras.some((b) => b.seg > 0);
  const val = (b) => (usarTiempo ? b.seg / 60 : b.n);
  const max = Math.max(1, ...barras.map(val));
  // el viewBox mide lo mismo que la tarjeta en pantalla: así el texto queda a su tamaño real
  // (con un ancho fijo de 640, en el teléfono las etiquetas salían a la mitad, ilegibles)
  const W = Math.max(280, Math.min(960, (app.clientWidth || 360) - 34)), H = 150, pad = 24, bw = (W - pad) / barras.length;
  const cada = Math.max(1, Math.ceil(barras.length / Math.floor(W / 34)));
  const conValor = bw >= 26;
  const svg = `<svg class="graf" viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="${usarTiempo ? "Minutos de estudio" : "Actividades"} por ${semanal ? "semana" : "día"}">
    ${[0.5, 1].map((f) => `<line x1="${pad}" x2="${W}" y1="${H - (H - 14) * f}" y2="${H - (H - 14) * f}" class="gl"/><text x="0" y="${H - (H - 14) * f + 4}" class="gt">${Math.round(max * f)}</text>`).join("")}
    <line x1="${pad}" x2="${W}" y1="${H}" y2="${H}" class="gb"/>
    ${barras.map((b, k) => {
      const v = val(b), h = v ? Math.max(3, (H - 14) * v / max) : 0, x = pad + k * bw + bw * 0.18;
      return `<g><title>${esc(b.tip)}: ${usarTiempo ? fmtDur(b.seg) : b.n + " actividades"}</title>
        ${h ? `<rect x="${x.toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="3" class="bar"/>` : ""}
        ${h && conValor ? `<text x="${(x + bw * 0.32).toFixed(1)}" y="${(H - h - 4).toFixed(1)}" class="gv">${Math.round(v)}</text>` : ""}
        ${k % cada === 0 ? `<text x="${(x + bw * 0.32).toFixed(1)}" y="${H + 16}" class="gx">${esc(b.lbl)}</text>` : ""}</g>`;
    }).join("")}
  </svg>`;
  const total = usarTiempo ? fmtDur(A.segundos) : `${A.eventos.length} actividades`;
  return card("sGrafico", usarTiempo ? `Minutos de estudio por ${semanal ? "semana" : "día"}` : `Actividades por ${semanal ? "semana" : "día"}`, svg + `<p class="leyenda">Total ${esc(A.P.etiqueta)}: <b>${esc(total)}</b></p>`);
}

function pasos(T) {
  const p = [["resumen", "Resumen"], ["retos", "Práctica"], ["quiz", "Quiz"], ["examen", "Simulacro"]];
  return `<span class="pasos">${p.map(([k, l]) => `<span class="paso${T.modos.has(k) ? " on" : ""}" title="${l}">${l}</span>`).join("")}</span>`;
}
function seccionMaterias(A) {
  const mats = Object.values(A.mats).sort((a, b) => (b.ultimo || "").localeCompare(a.ultimo || ""));
  if (!mats.length) return card("sMaterias", "Por materia", vacio(`Sin actividad ${A.P.etiqueta}.`));
  const filas = mats.map((M, k) => {
    const prom = M.quiz.length ? Math.round(M.quiz.reduce((s, v) => s + v, 0) / M.quiz.length * 100) : null;
    const temas = Object.values(M.temas).sort((a, b) => (b.ultimo || "").localeCompare(a.ultimo || ""));
    const det = temas.map((T) => {
      const q = T.quizMejor == null ? "" : `<span class="pill ${claseNota(Math.round(T.quizMejor * 100))}">quiz ${Math.round(T.quizMejor * 100)}%</span>`;
      return `<div class="tema"><div class="temaTx"><b>${esc(T.tema)}</b><span>${pasos(T)}</span></div><div class="temaMeta">${q}<span>${A.midiendo && T.segundos ? esc(fmtDur(T.segundos)) + " · " : ""}${esc(fechaCorta(claveDia(T.ultimo)))}</span></div></div>`;
    }).join("");
    return `<details class="mat"${k === 0 ? " open" : ""}>
      <summary>
        <span class="mNom">${esc(M.materia)}</span>
        <span class="mCel"><b>${temas.length}</b><small>tema${temas.length > 1 ? "s" : ""}</small></span>
        <span class="mCel"><b>${M.eventos}</b><small>activ.</small></span>
        ${A.midiendo ? `<span class="mCel"><b>${esc(fmtDur(M.segundos))}</b><small>tiempo</small></span>` : ""}
        <span class="mCel"><b class="${claseNota(prom)}">${prom == null ? "—" : prom + "%"}</b><small>quiz</small></span>
        ${ico("flecha", "chev")}
      </summary>
      <div class="temas">${det}</div>
    </details>`;
  }).join("");
  return card("sMaterias", "Por materia", `<p class="ayuda">Toca una materia para ver cada tema: qué pasos hizo (resumen, práctica, quiz, simulacro), su mejor quiz y cuándo lo estudió.</p>${filas}`);
}

function seccionQuiz(A) {
  if (!A.quizzes.length) return card("sQuiz", "Resultados de quiz", vacio(`Sin quiz ${A.P.etiqueta}.`));
  const filas = A.quizzes.map((q) => {
    const p = pct(q.aciertos, q.total);
    return `<tr><td class="nw">${esc(fechaCorta(claveDia(q.creado)))}<small>${esc(hora(q.creado))}</small></td>
      <td><b>${esc(limpiaMateria(q.materia))}</b><small>${esc(limpiaTema(q.tema))}</small></td>
      <td class="r"><span class="pill ${claseNota(p)}">${q.aciertos}/${q.total}</span><small>${p}%</small></td></tr>`;
  }).join("");
  return card("sQuiz", "Resultados de quiz", `<div class="tabla"><table><thead><tr><th>Fecha</th><th>Materia y tema</th><th class="r">Puntaje</th></tr></thead><tbody>${filas}</tbody></table></div>`, `${A.quizzes.length}`);
}

function seccionErrores(errores) {
  if (!errores.length) return card("sErrores", "Preguntas que falló", vacio("No tiene preguntas falladas pendientes de repasar."));
  const grupos = {};
  errores.forEach((e) => { const k = `${limpiaMateria(e.materia)} · ${limpiaTema(e.tema)}`; (grupos[k] = grupos[k] || []).push(e); });
  const html = Object.entries(grupos).map(([k, arr]) => `<details class="errGrupo"><summary><span>${esc(k)}</span><span class="pill bad">${arr.length}</span>${ico("flecha", "chev")}</summary>
    ${arr.map((e) => {
      const ops = Array.isArray(e.opciones) ? e.opciones : [];
      const eleg = Number.isInteger(e.elegida) ? ops[e.elegida] : null, corr = Number.isInteger(e.correcta) ? ops[e.correcta] : null;
      return `<div class="err">
        <p class="errQ">${esc(e.pregunta)}</p>
        ${eleg != null ? `<p class="resp bad">${ico("x")}<span><small>Respondió</small>${esc(eleg)}</span></p>` : ""}
        ${corr != null ? `<p class="resp ok">${ico("check")}<span><small>Correcta</small>${esc(corr)}</span></p>` : ""}
        ${e.explicacion ? `<details class="expl"><summary>Ver la explicación</summary><p>${esc(e.explicacion)}</p></details>` : ""}
        <p class="errF">${esc(fechaCorta(claveDia(e.creado)))}</p>
      </div>`;
    }).join("")}
  </details>`).join("");
  return card("sErrores", "Preguntas que falló", `<p class="ayuda">Cada pregunta de quiz que contestó mal, con lo que respondió y la respuesta correcta. Desaparecen de aquí cuando las repasa en Chispa.</p>${html}`, `${errores.length}`);
}

function detalleEvento(e) {
  const s = e.est, partes = [];
  if (e.modo === "quiz" && e.total > 0) partes.push(`${e.aciertos} de ${e.total} correctas`);
  else if (e.modo === "quiz" && s && s.items) partes.push(`contestó ${s.respondidas || 0} de ${s.items}`);
  if (s) {
    partes.push(fmtDur(s.segundos));
    if ((e.modo === "retos" || e.modo === "examen") && s.items) partes.push(`vio ${s.revelados || 0} de ${s.items} respuestas`);
    if (e.modo === "retos" && s.pistas) partes.push(`${s.pistas} pista${s.pistas > 1 ? "s" : ""}`);
    if (s.fuente && FUENTE[s.fuente]) partes.push(FUENTE[s.fuente]);
  }
  return partes;
}
// una sesión sin registro de actividad = la abrió pero no avanzó (no reveló respuestas / no terminó el quiz)
function tituloEvento(e) {
  if (e.soloSesion && e.modo === "retos" && !(e.est && e.est.revelados)) return "Abrió una práctica sin ver respuestas";
  if (e.soloSesion && e.modo === "examen" && !(e.est && e.est.revelados)) return "Abrió un simulacro sin ver respuestas";
  if (e.soloSesion && e.modo === "quiz" && !(e.total > 0)) return "Empezó un quiz y no lo terminó";
  return (MODO[e.modo] || { v: e.modo }).v;
}
function seccionHistorial(A) {
  if (!A.eventos.length) return card("sHistorial", "Historial", vacio(`Sin actividad ${A.P.etiqueta}.`));
  const mats = [...new Set(A.eventos.map((e) => limpiaMateria(e.materia)))].sort();
  if (FILTRO_HIST && !mats.includes(FILTRO_HIST)) FILTRO_HIST = "";
  const ev = A.eventos.filter((e) => !FILTRO_HIST || limpiaMateria(e.materia) === FILTRO_HIST);
  const porDia = []; const idx = {};
  ev.forEach((e) => { const k = claveDia(e.creado); if (!(k in idx)) { idx[k] = porDia.length; porDia.push({ k, items: [] }); } porDia[idx[k]].items.push(e); });
  const LIM = 12;
  const dias = porDia.map((g, n) => {
    const seg = g.items.reduce((s, e) => s + (e.est ? e.est.segundos || 0 : 0), 0);
    return `<div class="hDia${n >= LIM ? " oculto" : ""}">
      <div class="hDiaTit"><b>${esc(tituloDia(g.k))}</b><span>${g.items.length} actividad${g.items.length > 1 ? "es" : ""}${seg ? " · " + esc(fmtDur(seg)) : ""}</span></div>
      ${g.items.map((e) => {
        const det = detalleEvento(e);
        const p = e.modo === "quiz" && e.total > 0 ? pct(e.aciertos, e.total) : null;
        return `<div class="ev">
          <span class="evH">${esc(hora(e.creado))}</span>
          <div class="evTx"><b>${esc(tituloEvento(e))}${p != null ? ` <span class="pill ${claseNota(p)}">${p}%</span>` : ""}</b>
            <span>${esc(limpiaMateria(e.materia))} · ${esc(limpiaTema(e.tema))}</span>
            ${det.length ? `<small>${esc(det.join(" · "))}</small>` : ""}</div>
        </div>`;
      }).join("")}
    </div>`;
  }).join("");
  const filtro = mats.length > 1 ? `<select id="histFiltro" class="sel" aria-label="Filtrar por materia"><option value="">Todas las materias</option>${mats.map((m) => `<option${m === FILTRO_HIST ? " selected" : ""}>${esc(m)}</option>`).join("")}</select>` : "";
  const mas = porDia.length > LIM ? `<button class="btn sec2 full" id="histMas" type="button">Ver ${porDia.length - LIM} días más</button>` : "";
  return card("sHistorial", "Historial", filtro + (dias || vacio("Nada con ese filtro.")) + mas);
}

function filaTarea(t) {
  const n = diasHasta(t.fecha);
  let cuando = n == null ? "sin fecha" : n < 0 ? `venció ${fechaCorta(t.fecha)}` : n === 0 ? "hoy" : n === 1 ? "mañana" : fechaCorta(t.fecha);
  const cls = t.hecha ? "ok" : n != null && n < 0 ? "bad" : n != null && n <= 1 ? "warn" : t.tipo === "examen" ? "ind" : "";
  if (t.hecha) cuando = "hecha";
  return `<div class="tarea${t.hecha ? " hecha" : ""}"><div class="tTx"><b class="clamp">${esc(t.descripcion || TIPO_T[t.tipo] || "Tarea")}</b><span>${esc(TIPO_T[t.tipo] || "Tarea")} · ${esc(limpiaMateria(t.materia))}${t.fecha && !t.hecha ? "" : t.fecha ? " · " + esc(fechaCorta(t.fecha)) : ""}</span></div><span class="pill ${cls}">${esc(cuando)}</span></div>`;
}
function seccionAgenda(d) {
  const tareas = d.tareas || [];
  const pend = tareas.filter((t) => !t.hecha).sort((a, b) => String(a.fecha || "9").localeCompare(String(b.fecha || "9")));
  const hechas = tareas.filter((t) => t.hecha);
  const tareasHtml = `<h3>Tareas <span class="cnt">${pend.length} pendiente${pend.length === 1 ? "" : "s"}</span></h3>
    ${pend.length ? pend.map(filaTarea).join("") : vacio("Sin tareas pendientes.")}
    ${hechas.length ? `<details class="plieg"><summary>${hechas.length} hecha${hechas.length > 1 ? "s" : ""}</summary>${hechas.slice(0, 30).map(filaTarea).join("")}</details>` : ""}`;
  const notas = d.notas || [];
  let notasHtml = `<h3>Notas de exámenes</h3>`;
  if (!notas.length) notasHtml += vacio("Todavía no ha anotado notas de examen en su agenda.");
  else {
    const acc = {};
    notas.forEach((n) => { const k = limpiaMateria(n.materia); (acc[k] = acc[k] || []).push(Number(n.nota) || 0); });
    const todas = notas.map((n) => Number(n.nota) || 0), general = Math.round(todas.reduce((s, v) => s + v, 0) / todas.length * 10) / 10;
    notasHtml += `<p class="leyenda">Promedio general: <b class="${general >= 16 ? "ok" : general >= 14 ? "med" : "bad"}">${general}/20</b> · ${notas.length} nota${notas.length > 1 ? "s" : ""}</p>
      <div class="tabla"><table><thead><tr><th>Materia</th><th>Examen</th><th class="r">Nota</th></tr></thead><tbody>
      ${notas.map((n) => { const v = Number(n.nota); return `<tr><td><b>${esc(limpiaMateria(n.materia))}</b><small>${esc(fechaCorta(n.fecha))}</small></td><td>${esc(n.descripcion || "Examen")}</td><td class="r"><span class="pill ${v >= 16 ? "ok" : v >= 14 ? "med" : "bad"}">${esc(String(n.nota).replace(/\.0$/, ""))}</span></td></tr>`; }).join("")}
      </tbody></table></div>
      ${Object.keys(acc).length > 1 ? `<p class="leyenda">Por materia: ${Object.entries(acc).map(([m, v]) => `${esc(m)} <b>${Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10}</b>`).join(" · ")}</p>` : ""}`;
  }
  const hor = d.horario || [];
  let horHtml = "";
  if (hor.length) {
    const cols = [1, 2, 3, 4, 5].map((dia) => hor.filter((h) => h.dia === dia).sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((h) => limpiaMateria(h.materia)));
    horHtml = `<details class="plieg"><summary>Horario de la semana</summary><div class="horario">${["Lun", "Mar", "Mié", "Jue", "Vie"].map((l, k) => `<div><b>${l}</b>${cols[k].map((m) => `<span>${esc(m)}</span>`).join("") || "<span class='mut'>—</span>"}</div>`).join("")}</div></details>`;
  }
  return card("sAgenda", "Agenda", tareasHtml + `<div class="sep"></div>` + notasHtml + horHtml);
}

function seccionUso(A, d) {
  const p = d.perfil || {};
  const ape = A.ape;
  let cuerpo = `<div class="mini3">
    <div><span>Aperturas</span><b>${ape.length || (A.midiendo ? 0 : "—")}</b></div>
    <div><span>Días con uso</span><b>${ape.length ? new Set(ape.map(claveDia)).size : "—"}</b></div>
    <div><span>Racha</span><b>${p.racha_dias || 0} día${p.racha_dias === 1 ? "" : "s"}</b></div>
  </div>`;
  if (ape.length) {
    const fr = [["Madrugada", 0, 6], ["Mañana", 6, 12], ["Tarde", 12, 18], ["Noche", 18, 24]].map(([l, a, b]) => ({ l, a, b, n: ape.filter((x) => { const h = hora24(x); return h >= a && h < b; }).length }));
    const max = Math.max(1, ...fr.map((f) => f.n));
    cuerpo += `<h3>A qué hora usa Chispa</h3><div class="franjas">${fr.map((f) => `<div class="fr"><span>${f.l}<small>${f.a}–${f.b} h</small></span><i><em style="width:${Math.round(f.n / max * 100)}%"></em></i><b>${f.n}</b></div>`).join("")}</div>`;
    const tarde = ape.filter((x) => { const h = hora24(x); return h >= 22 || h < 5; }).length;
    if (tarde) cuerpo += `<p class="aviso warn">${tarde} apertura${tarde > 1 ? "s" : ""} entre las 10 p. m. y las 5 a. m. ${esc(A.P.etiqueta)}.</p>`;
    cuerpo += `<details class="plieg"><summary>Últimas aperturas</summary><ul class="lista">${ape.slice(0, 25).map((x) => `<li><span>${esc(tituloDia(claveDia(x)))}</span><b>${esc(hora(x))}</b></li>`).join("")}</ul></details>`;
  } else {
    cuerpo += `<p class="ayuda">${A.midiendo ? `No abrió la app ${esc(A.P.etiqueta)}.` : "Las horas de uso se registran desde el 29 de octubre de 2026."} Total de ingresos desde que usa Chispa: <b>${p.accesos || 0}</b>.</p>`;
  }
  return card("sUso", "Uso de la app", cuerpo);
}

function seccionReportes(reportes) {
  if (!reportes.length) return "";
  return card("sReportes", "Contenido que reportó", `<p class="ayuda">Ejercicios que marcó como incorrectos o confusos. Chispa los reemplazó por otros al momento; nosotros los revisamos.</p>
    <ul class="lista">${reportes.slice(0, 20).map((r) => `<li><span>${esc(limpiaMateria(r.materia))} · ${esc(limpiaTema(r.tema))}</span><b>${esc(fechaCorta(claveDia(r.creado)))}</b></li>`).join("")}</ul>`, `${reportes.length}`);
}

function card(id, titulo, cuerpo, badge) {
  return `<section class="card" id="${id}"><h2>${esc(titulo)}${badge ? `<span class="cnt">${esc(badge)}</span>` : ""}</h2>${cuerpo}</section>`;
}
function vacio(msg) { return `<p class="vacio">${esc(msg)}</p>`; }

function conectar() {
  document.querySelectorAll(".hijo").forEach((b) => b.onclick = () => { const k = +b.dataset.i; if (k === getActivo()) return; setActivo(k); FILTRO_HIST = ""; cargarYrender(); });
  document.querySelectorAll(".seg button").forEach((b) => b.onclick = () => { localStorage.setItem(KEY_PERIODO, b.dataset.p); repintar(); });
  const f = document.getElementById("histFiltro"); if (f) f.onchange = () => { FILTRO_HIST = f.value; repintar("sHistorial"); };
  const mas = document.getElementById("histMas"); if (mas) mas.onclick = () => { document.querySelectorAll(".hDia.oculto").forEach((x) => x.classList.remove("oculto")); mas.remove(); };
  document.querySelectorAll(".clamp").forEach((t) => t.onclick = () => t.classList.toggle("abierto"));
  document.getElementById("btnRecargar").onclick = () => cargarYrender(true);
  document.getElementById("btnAgregarHijo").onclick = () => mostrarVincular(true);
  document.getElementById("btnSalir").onclick = desvincularActivo;
  const sr = document.getElementById("staleRetry"); if (sr) sr.onclick = () => cargarYrender(true);
}
// re-pinta con los datos que ya tenemos (cambio de periodo o filtro), sin perder la posición
function repintar(anclaId) {
  if (!PANEL_ACTUAL) return;
  const y = window.scrollY;
  const { d, ninos, i, staleTs, detalle } = PANEL_ACTUAL;
  render(d, ninos, i, staleTs, detalle);
  const a = anclaId && document.getElementById(anclaId);
  if (a) a.scrollIntoView({ block: "start" }); else window.scrollTo(0, y);
}

// ───────── arranque (AL FINAL: todo lo de arriba ya existe) ─────────
// Blindado: pase lo que pase el padre ve algo accionable, nunca una página en blanco.
async function boot() {
  try {
    migrar();
    const code = (new URLSearchParams(location.search).get("c") || "").trim();
    if (code) {
      const { status, d } = await api({ accion: "canjear", code });
      if (d && d.ok && d.token) {
        setActivo(addNino(d.token, d.nino));
      } else if (status === 0 && !getNinos().length) {
        return estadoRed(() => location.reload(), "sin respuesta de red al canjear");
      } else if (!getNinos().length) {
        history.replaceState(null, "", location.pathname);
        return mostrarVincular(false, (d && d.error) || "Ese enlace no es válido o venció. Escribe el código o pide uno nuevo.");
      }
      history.replaceState(null, "", location.pathname);
    }
    if (!getNinos().length) return mostrarVincular(false);
    await cargarYrender();
  } catch (e) { estadoRed(() => location.reload(), "error interno: " + (e && e.message || e)); }
}
window.addEventListener("unhandledrejection", (ev) => {
  const r = ev && ev.reason;
  if (document.querySelector(".cargando")) estadoRed(() => location.reload(), "error interno: " + ((r && r.message) || r));
});
boot();
