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
const FAMILIA_V = "v21";                   // versión visible (footer y errores) para saber qué código corre
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
// examen = tipo "examen" O una tarea que lo dice ("Evaluación de polígonos" anotada como tarea). Misma regla que app.js.
const RE_EXAMEN = /(ex[aá]men(es)?|evaluaci[oó]n(es)?|prueba|parcial|quiz)/i;
const esExamen = (t) => !!t && (t.tipo === "examen" || RE_EXAMEN.test(String(t.descripcion || "")));
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
  campana: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
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
  chispa: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>',
  puntos: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  inicio: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.8"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.8"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.8"/>',
  pulso: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  sube: '<path d="m6 15 6-6 6 6"/>',
  baja: '<path d="m6 9 6 6 6-6"/>',
  graf: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
  diana: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  bandera: '<path d="M5 21V4M5 4h12l-2.5 4.5L17 13H5"/>',
  ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
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
      <div class="marca"><span class="logo" aria-hidden="true">${ico("chispa")}</span><span>Chispa <b>Familia</b></span></div>
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
      <div class="marca"><span class="logo" aria-hidden="true">${ico("chispa")}</span><span>Chispa <b>Familia</b></span></div>
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
  // Sesiones sueltas (sin actividad registrada). Se ignoran las que no dicen nada: menos de 20 s sin
  // ninguna respuesta, y los pedazos de un quiz que SÍ terminó poco después (hasta el 12-nov-2026 la
  // app partía un quiz en varias filas al apagarse la pantalla; su tiempo igual se suma al total).
  const terminados = eventos.filter((x) => x.modo === "quiz" && x.total > 0);
  est.forEach((e, idx) => {
    if (usados.has(idx)) return;
    const hizoAlgo = (e.respondidas || 0) + (e.revelados || 0) + (e.pistas || 0) > 0;
    if ((e.segundos || 0) < 20 && !hizoAlgo) return;
    if (e.modo === "quiz" && !(e.total > 0)) {
      const t = Date.parse(e.creado);
      const pedazo = terminados.some((q) => clave(q) === clave(e) && Date.parse(q.creado) >= t && Date.parse(q.creado) - t < 45 * 60000);
      if (pedazo) return;
    }
    eventos.push({ materia: e.materia, tema: e.tema, modo: e.modo, creado: e.creado, aciertos: e.aciertos, total: e.total, est: e, soloSesion: true });
  });
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
    if (e.modo === "quiz" && e.total > 0) { const v = e.aciertos / e.total; if (T.quizMejor == null || v > T.quizMejor) T.quizMejor = v; if (T.quizUlt == null) T.quizUlt = v; if (e.total >= 5 && v >= 0.8) T.dominado = true; }
  }
  // por día (para el gráfico)
  const porDia = {};
  for (const e of eventos) { const k = claveDia(e.creado); const D = (porDia[k] = porDia[k] || { n: 0, seg: 0 }); D.n++; if (e.est) D.seg += e.est.segundos || 0; }
  // estudio superficial: práctica/simulacro con TODAS las respuestas vistas a menos de 20 s por ejercicio
  const rapidas = est.filter((e) => (e.modo === "retos" || e.modo === "examen") && e.items > 0 && e.revelados >= e.items && e.segundos < e.items * 20);
  return { P, act, est, ape, eventos, quizzes, segundos, diasActivos, midiendo, promQuiz, mats, porDia, rapidas };
}

// ═════════════════════════════ RENDER ═════════════════════════════
// 2026-11-16 · REDISEÑO 2 ("más profesional"). Antes: una sola página larguísima con 11 tarjetas
// iguales y un índice de enlaces. Ahora:
//   · Encabezado con avatar, estado ("Estudió hoy" / "Lleva 4 días sin estudiar") y periodo.
//   · Pestañas fijas: Resumen · Materias · Actividad · Agenda (con contadores).
//   · Resumen: lectura en una frase, 4 indicadores con comparación contra el periodo anterior,
//     lo que requiere atención, gráfico con promedio, misión y lo próximo de la agenda.
//   · Gráficos propios en SVG: barras con línea de promedio, evolución de los quiz, mapa de horas.
//   · Agenda agrupada por urgencia con bloque de fecha; notas con barras por materia; horario con hoy marcado.
//   · Dos columnas en pantallas anchas; modo oscuro según el teléfono.
// analizar() y todo lo de red/vinculación no cambian.
const KEY_TAB = "familia_tab";
const TABS = [["resumen", "Resumen", "inicio"], ["materias", "Materias", "libro"], ["actividad", "Actividad", "pulso"], ["agenda", "Agenda", "cal"]];
function getTab() { const t = localStorage.getItem(KEY_TAB); return TABS.some((x) => x[0] === t) ? t : "resumen"; }
const INICIO_MEDICION = "2026-10-29";   // desde aquí hay tiempo de estudio medido

// mismo cálculo que analizar(), pero para el periodo ANTERIOR del mismo largo (para comparar)
function periodoPrevio(d, periodo) {
  if (periodo === "anio") return null;
  const P = periodoInfo(periodo, d.anioDesde);
  const hasta = P.desde, desde = sumarDias(P.desde, -P.dias);
  if (d.anioDesde && desde < d.anioDesde) return null;            // antes del año escolar no hay datos
  const en = (iso) => { const k = claveDia(iso); return k >= desde && k < hasta; };
  const act = (d.actividad || []).filter((a) => en(a.creado)), est = (d.estudio || []).filter((e) => en(e.creado));
  const q = act.filter((a) => a.modo === "quiz" && a.total > 0 && Number.isFinite(a.aciertos));
  return {
    tiempo: desde >= INICIO_MEDICION,
    segundos: est.reduce((s, e) => s + (e.segundos || 0), 0),
    dias: new Set([...act.map((a) => claveDia(a.creado)), ...est.map((e) => claveDia(e.creado))]).size,
    promQuiz: q.length ? Math.round(q.reduce((s, x) => s + x.aciertos / x.total, 0) / q.length * 100) : null,
  };
}
function vencidas(d) { return (d.tareas || []).filter((x) => !x.hecha && diasHasta(x.fecha) != null && diasHasta(x.fecha) < 0); }
function iniciales(n) { const p = String(n || "").trim().split(/\s+/).filter(Boolean); return ((p[0] || "?")[0] + (p[1] ? p[1][0] : "")).toUpperCase(); }
function plural(n, s, p) { return `${n} ${n === 1 ? s : (p || s + "s")}`; }
function matTag(m) { return `<span class="mTag" style="--m:${colorMateria(m)}"><i></i>${esc(m)}</span>`; }

function render(d, ninos, i, staleTs, detalle) {
  PANEL_ACTUAL = { d, ninos, i, staleTs, detalle };
  const periodo = getPeriodo(), tab = getTab();
  const A = analizar(d, periodo);
  const prev = periodoPrevio(d, periodo);
  const p = d.perfil || {};
  const nombre = primerNombre(p.nombre || (ninos[i] && ninos[i].nombre) || "tu hijo");
  const ultEstudio = [...(d.actividad || []), ...(d.estudio || [])].reduce((m, x) => (!m || x.creado > m ? x.creado : m), null);
  // la última apertura registrada es más precisa que usuarios.ultimo_acceso (ese solo se mueve cuando
  // la app refresca las materias con el aula, cada ~4 horas)
  const ultApertura = [p.ultimo_acceso, (d.aperturas || [])[0]].filter(Boolean).sort().pop() || null;
  const alertas = alertasDe(A, d);
  let cuerpo;
  if (tab === "materias") cuerpo = cols([seccionMaterias(A), seccionErrores(d.errores || [])], [seccionQuiz(A), seccionReportes(d.reportes || [])]);
  else if (tab === "actividad") cuerpo = cols([seccionHistorial(A)], [seccionUso(A, d)]);
  else if (tab === "agenda") cuerpo = cols([seccionTareas(d), seccionHorario(d)], [seccionNotas(d)]);
  else cuerpo = seccionLectura(A, prev, nombre) + seccionKpis(A, prev, d) + cols([seccionAtencion(A, alertas), seccionGrafico(A)], [seccionMision(d, nombre), seccionProximo(d)]);

  app.innerHTML = [
    barraSuperior(ninos, i),
    staleTs ? `<div class="aviso warn">${ico("alerta")}<span>No pudimos actualizar; se muestra lo último guardado (${esc(haceTxt(new Date(staleTs).toISOString()))}). <button class="lnk" id="staleRetry" type="button">Reintentar</button>${detalle ? `<br><small>${esc(detalle)}</small>` : ""}</span></div>` : "",
    encabezado(nombre, p, ultEstudio, ultApertura, periodo),
    pestanas(tab, d, alertas),
    `<main class="panelTab" id="tab-${tab}" role="tabpanel">${cuerpo}</main>`,
    `<footer class="pie">
      <p>Panel de solo lectura: aquí no se puede cambiar nada de la cuenta de ${esc(nombre)}. ${esc(nombre)} puede quitar este acceso cuando quiera desde su Chispa.</p>
      <p>${A.midiendo ? "El tiempo de estudio cuenta solo los minutos con la app abierta y en uso (sin contar la pantalla quieta)." : "El tiempo de estudio, los ejercicios vistos y el uso por hora se registran desde el 29 de octubre de 2026."}</p>
      <p class="ver">Chispa Familia · ${FAMILIA_V}</p>
    </footer>`,
  ].join("");
  conectar();
}
function cols(izq, der) { return `<div class="cols"><div class="col">${izq.join("")}</div><div class="col">${der.join("")}</div></div>`; }

function barraSuperior(ninos, activo) {
  const tabs = ninos.length > 1
    ? `<div class="hijos" role="tablist" aria-label="Hijos">${ninos.map((n, k) => `<button type="button" role="tab" class="hijo" data-i="${k}" aria-selected="${k === activo}"><span class="hAv">${esc(iniciales(n.nombre || "H"))}</span>${esc(primerNombre(n.nombre || "Hijo").split(" ")[0])}</button>`).join("")}</div>`
    : "";
  return `<div class="top">
    <div class="marca"><span class="logo" aria-hidden="true">${ico("chispa")}</span><span>Chispa <b>Familia</b></span></div>
    ${tabs}
    <div class="acciones">
      <button class="icoBtn" id="btnRecargar" type="button" title="Actualizar" aria-label="Actualizar">${ico("recargar")}</button>
      <details class="menu"><summary class="icoBtn" aria-label="Más opciones">${ico("puntos")}</summary>
        <div class="menuPop">
          <button type="button" id="btnAvisos">${ico("campana")} ${avisosActivos() ? "Avisos: activados" : "Activar avisos"}</button>
          <button type="button" id="btnAgregarHijo">${ico("mas")} Agregar otro hijo</button>
          <button type="button" id="btnSalir" class="peligro">${ico("salir")} Quitar de este dispositivo</button>
        </div>
      </details>
    </div>
  </div>`;
}

function encabezado(nombre, p, ultEstudio, ultApertura, periodo) {
  const sin = ultEstudio ? diasEntre(claveDia(ultEstudio), hoyYMD()) : null;
  const est = sin == null ? ["neu", "Todavía no estudia en Chispa"] : sin <= 0 ? ["ok", "Estudió hoy"] : sin === 1 ? ["ok", "Estudió ayer"]
    : sin < 3 ? ["neu", `Estudió hace ${sin} días`] : [sin >= 7 ? "bad" : "med", `Lleva ${sin} días sin estudiar`];
  const meta = [ultApertura ? `Abrió Chispa ${haceTxt(ultApertura)}` : "Todavía no abrió Chispa", p.racha_dias > 1 ? `racha de ${p.racha_dias} días` : ""].filter(Boolean).join(" · ");
  return `<header class="hero">
    <div class="heroId">
      <span class="avatar" aria-hidden="true">${esc(iniciales(p.nombre || nombre))}</span>
      <div class="heroTx">
        <h1>${esc(nombre)}</h1>
        <p class="heroSub">${p.grado ? `<span>${esc(p.grado)}</span>` : ""}<span class="estado ${est[0]}"><i></i>${esc(est[1])}</span></p>
        <p class="heroMeta">${esc(meta)}</p>
      </div>
    </div>
    <div class="seg" role="group" aria-label="Periodo">
      ${[["7", "7 días"], ["30", "30 días"], ["anio", "Año escolar"]].map(([v, l]) => `<button type="button" data-p="${v}" aria-pressed="${periodo === v}">${l}</button>`).join("")}
    </div>
  </header>`;
}

function pestanas(tab, d, alertas) {
  const venc = vencidas(d).length, pend = (d.tareas || []).filter((t) => !t.hecha).length, errs = (d.errores || []).length;
  const badge = {
    resumen: alertas.length ? [alertas.some((a) => a.cls === "bad") ? "bad" : "med", alertas.length] : null,
    materias: errs ? ["neu", errs] : null, actividad: null,
    agenda: venc ? ["bad", venc] : pend ? ["neu", pend] : null,
  };
  return `<nav class="tabs" role="tablist" aria-label="Secciones">${TABS.map(([k, l, ic]) =>
    `<button type="button" role="tab" class="tab" data-tab="${k}" aria-selected="${k === tab}">${ico(ic)}<span>${l}</span>${badge[k] ? `<em class="tBadge ${badge[k][0]}">${badge[k][1]}</em>` : ""}</button>`).join("")}</nav>`;
}

// ───────── Resumen ─────────
function seccionLectura(A, prev, nombre) {
  const n = esc(nombre);
  let txt;
  if (!A.eventos.length) txt = `${n} no estudió en Chispa ${esc(A.P.etiqueta)}.`;
  else {
    txt = `${n} estudió <b>${A.diasActivos.size} de ${A.P.dias} días</b>${A.midiendo && A.segundos ? `, <b>${esc(fmtDur(A.segundos))}</b> en total` : ""}`;
    if (prev && prev.tiempo && A.midiendo) {
      const dif = A.segundos - prev.segundos;
      txt += Math.abs(dif) < 300 ? ", parecido al periodo anterior" : dif > 0 ? (prev.segundos ? `, más que el periodo anterior (${esc(fmtDur(prev.segundos))})` : ", y en el periodo anterior no había estudiado") : `, menos que el periodo anterior (${esc(fmtDur(prev.segundos))})`;
    }
    txt += ". ";
    const ms = Object.values(A.mats).sort((a, b) => (b.segundos - a.segundos) || (b.eventos - a.eventos));
    if (ms.length > 1) txt += `Trabajó ${ms.length} materias; la que más, <b>${esc(ms[0].materia)}</b>. `;
    else if (ms.length) txt += `Todo fue de <b>${esc(ms[0].materia)}</b>. `;
    if (A.promQuiz != null) {
      txt += `En los quiz promedió <b>${A.promQuiz}%</b>`;
      if (prev && prev.promQuiz != null && prev.promQuiz !== A.promQuiz) txt += ` (antes ${prev.promQuiz}%)`;
      txt += ".";
    } else txt += "No hizo quiz en este periodo.";
  }
  return `<section class="lectura"><span class="lLbl">${ico("chispa")} Resumen · ${esc(A.P.corto === "Año escolar" ? "año escolar" : "últimos " + A.P.corto)}</span><p>${txt}</p></section>`;
}

function delta(act, ant, fmt) {
  if (act == null || ant == null) return "";
  const dif = act - ant;
  if (!dif) return `<span class="delta eq">igual</span>`;
  return `<span class="delta ${dif > 0 ? "up" : "down"}">${ico(dif > 0 ? "sube" : "baja")}${esc(fmt(Math.abs(dif)))}</span>`;
}
function durHtml(seg) {
  const t = fmtDur(seg);
  return esc(t).replace(/(\d+)\s*(h|min)/g, "$1<small>$2</small>").replace(/&lt;1/, "&lt;1");
}
function kpi(label, valor, pie, cls, tono, icono) {
  return `<div class="kpi${cls ? " " + cls : ""}" style="--k:var(--t-${tono})"><div class="kHead"><span class="kIco">${ico(icono)}</span><span class="kLbl">${esc(label)}</span></div><div class="kVal">${valor}</div><div class="kPie">${pie || ""}</div></div>`;
}
function seccionKpis(A, prev, d) {
  const vs = prev ? `<span class="kVs">vs. ${esc(A.P.corto)} anteriores</span>` : "";
  const tareas = d.tareas || [];
  const venc = vencidas(d).length, pend = tareas.filter((x) => !x.hecha).length;
  const dAct = A.diasActivos.size;
  const best = A.quizzes.length ? Math.max(...A.quizzes.map((q) => pct(q.aciertos, q.total))) : null;
  const dT = prev && prev.tiempo && A.midiendo ? delta(A.segundos, prev.segundos, fmtDur) : "";
  const dD = prev ? delta(dAct, prev.dias, (v) => plural(v, "día")) : "";
  const dQ = prev ? delta(A.promQuiz, prev.promQuiz, (v) => `${v} pts`) : "";
  return `<section class="kpis" aria-label="Indicadores ${esc(A.P.etiqueta)}">
    ${kpi("Tiempo de estudio", A.midiendo ? durHtml(A.segundos) : "—", dT ? dT + vs : `<span class="kVs">${A.midiendo ? (dAct ? esc(fmtDur(A.segundos / dAct)) + " por día con estudio" : "sin estudio") : "se mide desde el 29 oct"}</span>`, "", "ind", "reloj")}
    ${kpi("Días con estudio", `${dAct}<small>/${A.P.dias}</small>`, dD ? dD + vs : `<span class="kVs">${esc(A.P.etiqueta)}</span>`, "", "tea", "cal")}
    ${kpi("Promedio en quiz", A.promQuiz == null ? "—" : `${A.promQuiz}<small>%</small>`, dQ ? dQ + vs : `<span class="kVs">${A.quizzes.length ? `${plural(A.quizzes.length, "quiz", "quiz")} · mejor ${best}%` : "sin quiz en el periodo"}</span>`, A.promQuiz == null ? "" : claseNota(A.promQuiz), "vio", "check")}
    ${kpi("Tareas pendientes", String(pend), venc ? `<span class="delta down">${plural(venc, "vencida")}</span>` : `<span class="kVs">ninguna vencida</span>`, venc ? "bad" : "", "amb", "lista")}
  </section>`;
}

function alertasDe(A, d) {
  const items = [];
  const tareas = d.tareas || [];
  vencidas(d).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .forEach((t) => items.push({ cls: "bad", ic: "alerta", tit: `Tarea vencida: ${t.descripcion || TIPO_T[t.tipo] || "Tarea"}`, sub: `${limpiaMateria(t.materia)} · venció ${fechaCorta(t.fecha)} (hace ${plural(-diasHasta(t.fecha), "día")}) · sin marcar como hecha` }));
  tareas.filter((x) => !x.hecha && esExamen(x) && diasHasta(x.fecha) != null && diasHasta(x.fecha) >= 0 && diasHasta(x.fecha) <= 7)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))
    .forEach((t) => {
      const n = diasHasta(t.fecha), mat = limpiaMateria(t.materia);
      const prep = (d.actividad || []).filter((a) => limpiaMateria(a.materia) === mat && diasEntre(claveDia(a.creado), hoyYMD()) <= 7).length;
      items.push({ cls: "med", ic: "cal", tit: `Examen de ${mat} ${n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`} (${fechaCorta(t.fecha)})`, sub: `${t.descripcion ? t.descripcion + " · " : ""}${prep ? `${plural(prep, "actividad", "actividades")} de ${mat} esta semana` : `no ha practicado ${mat} esta semana`}` });
    });
  tareas.filter((x) => !x.hecha && !esExamen(x) && (diasHasta(x.fecha) === 0 || diasHasta(x.fecha) === 1))
    .forEach((t) => items.push({ cls: "med", ic: "lista", tit: `Para ${diasHasta(t.fecha) === 0 ? "hoy" : "mañana"}: ${t.descripcion || TIPO_T[t.tipo] || "Tarea"}`, sub: limpiaMateria(t.materia) }));
  A.quizzes.filter((q) => pct(q.aciertos, q.total) < 60).slice(0, 4)
    .forEach((q) => items.push({ cls: "med", ic: "x", tit: `Quiz bajo: ${pct(q.aciertos, q.total)}% en ${limpiaMateria(q.materia)}`, sub: `${limpiaTema(q.tema)} · ${q.aciertos}/${q.total} · ${tituloDia(claveDia(q.creado))}` }));
  if (A.rapidas.length) items.push({ cls: "med", ic: "reloj", tit: `Vio respuestas muy rápido ${A.rapidas.length} ${A.rapidas.length === 1 ? "vez" : "veces"}`, sub: "Abrió todas las respuestas de una práctica o simulacro en menos de 20 segundos por ejercicio: puede estar mirando sin resolver." });
  const ult = [...(d.actividad || []), ...(d.estudio || [])].reduce((m, x) => (!m || x.creado > m ? x.creado : m), null);
  const sinEst = ult ? diasEntre(claveDia(ult), hoyYMD()) : null;
  if (sinEst != null && sinEst >= 3) items.push({ cls: sinEst >= 7 ? "bad" : "med", ic: "reloj", tit: `Lleva ${sinEst} días sin estudiar en Chispa`, sub: `Última actividad: ${haceTxt(ult)}` });
  (d.notas || []).filter((n) => Number(n.nota) < 14 && diasHasta(n.fecha) != null && diasHasta(n.fecha) >= -21)
    .forEach((n) => items.push({ cls: "med", ic: "libro", tit: `Nota baja: ${String(n.nota).replace(/\.0$/, "")}/20 en ${limpiaMateria(n.materia)}`, sub: `${n.descripcion || "Examen"} · ${fechaCorta(n.fecha)}` }));
  return items;
}
function seccionAtencion(A, items) {
  const li = (x) => `<li class="${x.cls}"><span class="aIco">${ico(x.ic)}</span><div><b>${esc(x.tit)}</b><span>${esc(x.sub)}</span></div></li>`;
  const VER = 4;   // las más urgentes primero; el resto plegado para no tapar el resumen
  const cuerpo = items.length
    ? `<ul class="alertas">${items.slice(0, VER).map(li).join("")}</ul>${items.length > VER ? `<details class="plieg"><summary>${ico("flecha", "chev")} Ver ${items.length - VER} más</summary><ul class="alertas">${items.slice(VER).map(li).join("")}</ul></details>` : ""}`
    : `<div class="todoOk">${ico("check")}<div><b>Todo en orden</b><span>Sin tareas vencidas, sin exámenes esta semana y sin resultados bajos ${esc(A.P.etiqueta)}.</span></div></div>`;
  return card("sAtencion", "Requiere atención", cuerpo, items.length ? String(items.length) : "");
}

function seccionGrafico(A) {
  // 7/30 días → barras por día; año escolar → por semana (lunes)
  const semanal = A.P.dias > 31;
  const barras = [];
  if (!semanal) {
    for (let k = A.P.dias - 1; k >= 0; k--) {
      const ymd = sumarDias(hoyYMD(), -k), D = A.porDia[ymd] || { n: 0, seg: 0 };
      const [, , dd] = ymd.split("-").map(Number);
      barras.push({ lbl: A.P.dias <= 7 ? DIAS_C[diaSemana(ymd)] : String(dd), tip: tituloDia(ymd), hoy: k === 0, ...D });
    }
  } else {
    let ini = A.P.desde; ini = sumarDias(ini, -((diaSemana(ini) + 6) % 7));
    for (let s = ini; s <= hoyYMD(); s = sumarDias(s, 7)) {
      let n = 0, seg = 0;
      for (let k = 0; k < 7; k++) { const D = A.porDia[sumarDias(s, k)]; if (D) { n += D.n; seg += D.seg; } }
      const [, m, dd] = s.split("-").map(Number);
      barras.push({ lbl: `${dd} ${MESES_C[m - 1]}`, tip: `Semana del ${dd} ${MESES_C[m - 1]}`, n, seg, hoy: sumarDias(s, 7) > hoyYMD() });
    }
  }
  const usarTiempo = A.midiendo && barras.some((b) => b.seg > 0);
  const val = (b) => (usarTiempo ? b.seg / 60 : b.n);
  const crudo = Math.max(1, ...barras.map(val));
  const paso = crudo <= 5 ? 1 : crudo <= 20 ? 5 : crudo <= 60 ? 10 : crudo <= 180 ? 30 : 60;
  const max = Math.ceil(crudo / paso) * paso;
  const activos = barras.filter((b) => val(b) > 0);
  const prom = activos.length ? activos.reduce((s, b) => s + val(b), 0) / activos.length : 0;
  // el viewBox mide lo mismo que la columna en pantalla: así el texto queda a su tamaño real
  const ancho = app.clientWidth || 360;
  const colW = ancho >= 1000 ? (ancho - 20) * 1.5 / 2.5 : ancho;
  const W = Math.max(280, Math.min(900, Math.round(colW - 36))), H = 150, top = 16, pad = 28, bw = (W - pad) / barras.length;
  const y = (v) => H - (H - top) * v / max;
  const cada = Math.max(1, Math.ceil(barras.length / Math.floor(W / 36)));
  const conValor = bw >= 26;
  const bar = (x, w, h) => { const r = Math.min(4, w / 2, h); return `M${x.toFixed(1)},${H}v${-(h - r).toFixed(1)}q0,${-r} ${r},${-r}h${(w - 2 * r).toFixed(1)}q${r},0 ${r},${r}v${(h - r).toFixed(1)}z`; };
  const svg = `<svg class="graf" viewBox="0 0 ${W} ${H + 24}" role="img" aria-label="${usarTiempo ? "Minutos de estudio" : "Actividades"} por ${semanal ? "semana" : "día"}">
    ${[0.5, 1].map((f) => `<line x1="${pad}" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}" class="gl"/><text x="${pad - 6}" y="${y(max * f) + 4}" class="gt">${Math.round(max * f)}</text>`).join("")}
    <text x="${pad - 6}" y="${H + 4}" class="gt">0</text>
    <line x1="${pad}" x2="${W}" y1="${H}" y2="${H}" class="gb"/>
    ${barras.map((b, k) => {
      const v = val(b), h = v ? Math.max(3, (H - top) * v / max) : 0, w = bw * 0.62, x = pad + k * bw + (bw - w) / 2;
      return `<g><title>${esc(b.tip)}: ${usarTiempo ? fmtDur(b.seg) : plural(b.n, "actividad", "actividades")}</title>
        <rect x="${(pad + k * bw).toFixed(1)}" y="${top}" width="${bw.toFixed(1)}" height="${H - top}" class="hit"/>
        ${h ? `<path d="${bar(x, w, h)}" class="bar${b.hoy ? " hoy" : ""}"/>` : `<rect x="${x.toFixed(1)}" y="${H - 2}" width="${w.toFixed(1)}" height="2" rx="1" class="cero"/>`}
        ${h && conValor ? `<text x="${(x + w / 2).toFixed(1)}" y="${(H - h - 5).toFixed(1)}" class="gv">${Math.round(v)}</text>` : ""}
        ${k % cada === 0 || b.hoy ? `<text x="${(x + w / 2).toFixed(1)}" y="${H + 17}" class="gx${b.hoy ? " hoy" : ""}">${esc(b.hoy && !semanal ? "hoy" : b.lbl)}</text>` : ""}</g>`;
    }).join("")}
    ${prom && activos.length > 1 ? `<line x1="${pad}" x2="${W}" y1="${y(prom).toFixed(1)}" y2="${y(prom).toFixed(1)}" class="prom"/>` : ""}
  </svg>`;
  const mejor = activos.slice().sort((a, b) => val(b) - val(a))[0];
  const unidad = (v) => usarTiempo ? fmtDur(v * 60) : plural(Math.round(v), "actividad", "actividades");
  const ley = [
    `<span><i class="lg bar"></i>Total: <b>${esc(usarTiempo ? fmtDur(A.segundos) : plural(A.eventos.length, "actividad", "actividades"))}</b></span>`,
    prom && activos.length > 1 ? `<span><i class="lg prom"></i>Promedio por ${semanal ? "semana" : "día"} con estudio: <b>${esc(unidad(prom))}</b></span>` : "",
    mejor && activos.length > 1 ? `<span>Mejor ${semanal ? "semana" : "día"}: <b>${esc(mejor.tip)}</b></span>` : "",
  ].filter(Boolean).join("");
  return card("sGrafico", usarTiempo ? `Minutos de estudio por ${semanal ? "semana" : "día"}` : `Actividades por ${semanal ? "semana" : "día"}`, svg + `<div class="leyenda">${ley}</div>`);
}

// ── Misión para hoy (MEJORAS 20, 2026-11-12) ──
// El adulto sugiere qué estudiar: materia + tema con sus palabras ("fracciones") + tipo de actividad.
// En la app del niño aparece como "Tu misión de hoy" (encima de las automáticas) y, si tiene los
// avisos activos, le llega al teléfono. Se marca cumplida cuando estudia esa materia.
const MODO_MISION = [["", "Lo que le toque"], ["resumen", "Entender el tema"], ["retos", "Practicar"], ["quiz", "Hacer un quiz"], ["examen", "Simulacro de examen"]];
function seccionMision(d, nombre) {
  const ms = d.misiones || [];
  const pend = ms.find((m) => m.activa && !m.hecha_en);
  const ult = ms.find((m) => m.hecha_en);
  const modoTxt = (m) => m.modo && (MODO_MISION.find((x) => x[0] === m.modo) || [])[1];
  const bloque = (m, cls, etiqueta, cuando, extra) => `<div class="misionEst ${cls}">
      <div class="meHead"><span class="estado ${cls === "pend" ? "ind" : "ok"}"><i></i>${etiqueta}</span><small>${esc(cuando)}</small></div>
      <b>${esc(limpiaMateria(m.materia))}${m.tema ? ` · ${esc(m.tema)}` : ""}</b>
      ${modoTxt(m) || m.nota ? `<span>${esc([modoTxt(m), m.nota].filter(Boolean).join(" — "))}</span>` : ""}${extra || ""}
    </div>`;
  let estado = "";
  if (pend) estado += bloque(pend, "pend", "Pendiente", "enviada " + haceTxt(pend.creada), `<button type="button" class="btn link mini" id="misionCancelar" data-id="${pend.id}">Cancelar misión</button>`);
  if (ult) estado += bloque(ult, "ok", "Cumplida", haceTxt(ult.hecha_en));
  // materias que conoce el panel (horario, actividad, tareas); temas sugeridos de lo que ya estudió
  const crudas = [...(d.horario || []), ...(d.actividad || []), ...(d.tareas || [])].map((x) => x.materia).filter(Boolean);
  const mats = []; const vistas = new Set();
  crudas.forEach((m) => { const k = limpiaMateria(m); if (!vistas.has(k)) { vistas.add(k); mats.push([m, k]); } });
  mats.sort((a, b) => a[1].localeCompare(b[1], "es"));
  const temas = [...new Set((d.actividad || []).map((a) => limpiaTema(a.tema)).filter(Boolean))].slice(0, 40);
  const campos = `<form class="misionForm" id="misionForm">
      <div class="fila2">
        <label>Materia<select id="misionMateria" required>${mats.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label>
        <label>Qué hacer<select id="misionModo">${MODO_MISION.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select></label>
      </div>
      <label><span>Tema <span class="opc">como lo dicen en clase · opcional</span></span><input id="misionTema" list="misionTemas" maxlength="120" placeholder="ej: fracciones"><datalist id="misionTemas">${temas.map((t) => `<option value="${esc(t)}">`).join("")}</datalist></label>
      <label><span>Nota <span class="opc">opcional</span></span><input id="misionNota" maxlength="140" placeholder="ej: el viernes es el examen"></label>
      <button class="btn" type="submit" id="misionEnviar">${pend ? "Reemplazar la misión" : "Enviar misión"}</button>
      <p class="misionMsg" id="misionMsg" role="status"></p>
    </form>`;
  const form = !mats.length ? vacio("Cuando tenga horario o actividad en Chispa podrás mandarle una misión.")
    : pend ? `<details class="plieg"><summary>${ico("mas")} Mandar otra misión</summary>${campos}</details>` : campos;
  return card("sMision", `Misión para ${primerNombre(nombre).split(" ")[0]}`, `<p class="ayuda">Le aparece en Chispa como "Tu misión de hoy", antes que las sugerencias automáticas.</p>${estado}${form}`);
}
async function enviarMision(e) {
  e.preventDefault();
  const nino = getNinos()[getActivo()]; if (!nino) return;
  const btn = document.getElementById("misionEnviar"), msg = document.getElementById("misionMsg");
  btn.disabled = true; msg.textContent = "Enviando…";
  const { d } = await apiUna({ accion: "mision_set", ptoken: nino.token, materia: document.getElementById("misionMateria").value,
    tema: document.getElementById("misionTema").value, modo: document.getElementById("misionModo").value, nota: document.getElementById("misionNota").value });
  if (d && d.ok) { msg.textContent = "Listo, ya la tiene en su app."; setTimeout(() => cargarYrender(true), 700); }
  else { msg.textContent = (d && d.error) || "No se pudo enviar. Intenta de nuevo."; btn.disabled = false; }
}
async function cancelarMision(id) {
  const nino = getNinos()[getActivo()]; if (!nino) return;
  await apiUna({ accion: "mision_cancelar", ptoken: nino.token, id });
  cargarYrender(true);
}

function seccionProximo(d) {
  const pend = (d.tareas || []).filter((t) => !t.hecha).sort((a, b) => String(a.fecha || "9").localeCompare(String(b.fecha || "9")));
  const cuerpo = pend.length
    ? `<div class="tareas">${pend.slice(0, 4).map(filaTarea).join("")}</div>${pend.length > 4 ? `<button type="button" class="btn sec2 full" data-ir="agenda">Ver las ${pend.length} pendientes</button>` : ""}`
    : vacio("Sin tareas pendientes.");
  return card("sProximo", "Próximo en la agenda", cuerpo);
}

// ───────── Materias ─────────
function estadoTemaP(T) {
  if (T.dominado) return ["ok", "Dominado"];
  if (T.modos.has("retos") || T.modos.has("quiz") || T.modos.has("examen")) return ["ind", "Practicado"];
  return ["neu", "Empezado"];
}
function pasos(T) {
  const p = [["resumen", "Resumen"], ["retos", "Práctica"], ["quiz", "Quiz"], ["examen", "Simulacro"]];
  return `<span class="pasos">${p.map(([k, l]) => `<span class="paso${T.modos.has(k) ? " on" : ""}">${T.modos.has(k) ? ico("ok") : ""}${l}</span>`).join("")}</span>`;
}
function seccionMaterias(A) {
  const mats = Object.values(A.mats).sort((a, b) => (b.segundos - a.segundos) || (b.eventos - a.eventos));
  if (!mats.length) return card("sMaterias", "Por materia", vacio(`Sin actividad ${A.P.etiqueta}.`));
  const porTiempo = A.midiendo && mats.some((m) => m.segundos > 0);
  const maxV = Math.max(1, ...mats.map((m) => (porTiempo ? m.segundos : m.eventos)));
  const filas = mats.map((M, k) => {
    const prom = M.quiz.length ? Math.round(M.quiz.reduce((s, v) => s + v, 0) / M.quiz.length * 100) : null;
    const temas = Object.values(M.temas).sort((a, b) => (b.ultimo || "").localeCompare(a.ultimo || ""));
    const dom = temas.filter((T) => T.dominado).length;
    const det = temas.map((T) => {
      const [ec, el] = estadoTemaP(T);
      const q = T.quizMejor == null ? "" : `<span class="pill ${claseNota(Math.round(T.quizMejor * 100))}">mejor quiz ${Math.round(T.quizMejor * 100)}%</span>`;
      return `<div class="tema"><div class="temaTop"><b>${esc(T.tema)}</b><span class="estado ${ec}"><i></i>${el}</span></div>
        <div class="temaBot">${pasos(T)}<span class="temaMeta">${q}<span>${A.midiendo && T.segundos ? esc(fmtDur(T.segundos)) + " · " : ""}${esc(fechaCorta(claveDia(T.ultimo)))}</span></span></div></div>`;
    }).join("");
    const v = porTiempo ? M.segundos : M.eventos;
    return `<details class="mat" style="--m:${colorMateria(M.materia)}"${k === 0 ? " open" : ""}>
      <summary>
        <span class="mIni" aria-hidden="true">${esc(M.materia.charAt(0))}</span>
        <span class="mMain"><span class="mNom">${esc(M.materia)}</span>
          <span class="mSub">${plural(temas.length, "tema")} · ${plural(M.eventos, "actividad", "actividades")}${dom ? ` · ${dom} dominado${dom > 1 ? "s" : ""}` : ""}</span>
          <span class="mBar" title="${porTiempo ? "Tiempo de estudio" : "Actividades"}"><i style="width:${Math.max(3, Math.round(v / maxV * 100))}%"></i></span></span>
        <span class="mStat"><b>${porTiempo ? esc(fmtDur(M.segundos)) : M.eventos}</b><small>${porTiempo ? "tiempo" : "activ."}</small></span>
        <span class="mStat"><b class="${claseNota(prom)}">${prom == null ? "—" : prom + "%"}</b><small>quiz</small></span>
        ${ico("flecha", "chev")}
      </summary>
      <div class="temas">${det}</div>
    </details>`;
  }).join("");
  return card("sMaterias", "Por materia", `<p class="ayuda">Ordenadas por ${porTiempo ? "tiempo de estudio" : "actividad"}. Toca una para ver sus temas: qué pasos hizo y si ya lo domina (quiz de 5 o más preguntas con 80% o más).</p><div class="mats">${filas}</div>`);
}

function seccionQuiz(A) {
  if (!A.quizzes.length) return card("sQuiz", "Resultados de quiz", vacio(`Sin quiz ${A.P.etiqueta}.`));
  const qs = A.quizzes.slice().sort((a, b) => Date.parse(a.creado) - Date.parse(b.creado));
  let graf = "";
  if (qs.length >= 2) {
    const ancho = app.clientWidth || 360;
    const colW = ancho >= 1000 ? (ancho - 20) / 2.5 : ancho;
    const W = Math.max(260, Math.min(640, Math.round(colW - 36))), H = 120, top = 10, pad = 30, padR = 12;
    const x = (k) => pad + (qs.length === 1 ? 0 : k * (W - pad - padR) / (qs.length - 1));
    const y = (v) => top + (H - top) * (1 - v / 100);
    const pts = qs.map((q, k) => [x(k), y(pct(q.aciertos, q.total)), q]);
    graf = `<svg class="graf" viewBox="0 0 ${W} ${H + 8}" role="img" aria-label="Evolución de los quiz">
      <rect x="${pad}" y="${y(100)}" width="${W - pad}" height="${y(80) - y(100)}" class="zona ok"/>
      <rect x="${pad}" y="${y(80)}" width="${W - pad}" height="${y(60) - y(80)}" class="zona med"/>
      ${[0, 60, 80, 100].map((v) => `<text x="${pad - 6}" y="${y(v) + 4}" class="gt">${v}%</text>`).join("")}
      <line x1="${pad}" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="gb"/>
      <polyline points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(" ")}" class="linea"/>
      ${pts.map(([a, b, q]) => `<circle cx="${a.toFixed(1)}" cy="${b.toFixed(1)}" r="4.5" class="pt ${claseNota(pct(q.aciertos, q.total))}"><title>${esc(fechaCorta(claveDia(q.creado)))} · ${esc(limpiaMateria(q.materia))} · ${q.aciertos}/${q.total}</title></circle>`).join("")}
    </svg><div class="leyenda"><span><i class="lg zOk"></i>80% o más</span><span><i class="lg zMed"></i>60–79%</span><span>Del más antiguo al más reciente</span></div>`;
  }
  const filas = A.quizzes.map((q) => {
    const p = pct(q.aciertos, q.total), c = claseNota(p);
    return `<div class="qFila"><div class="qTx">${matTag(limpiaMateria(q.materia))}<b>${esc(limpiaTema(q.tema))}</b><small>${esc(fechaCorta(claveDia(q.creado)))} · ${esc(hora(q.creado))}</small></div>
      <div class="qNota"><b class="${c}">${q.aciertos}/${q.total}</b><span class="barra ${c}"><i style="width:${p}%"></i></span><small>${p}%</small></div></div>`;
  }).join("");
  return card("sQuiz", "Resultados de quiz", graf + `<div class="qLista">${filas}</div>`, String(A.quizzes.length));
}

function seccionErrores(errores) {
  if (!errores.length) return card("sErrores", "Preguntas que falló", `<div class="todoOk">${ico("check")}<div><b>Nada pendiente</b><span>No tiene preguntas falladas por repasar.</span></div></div>`);
  const grupos = {};
  errores.forEach((e) => { const k = `${limpiaMateria(e.materia)}|${limpiaTema(e.tema)}`; (grupos[k] = grupos[k] || []).push(e); });
  const html = Object.entries(grupos).map(([k, arr]) => {
    const [mat, tema] = k.split("|");
    return `<details class="errGrupo" style="--m:${colorMateria(mat)}"><summary><span class="egTx">${matTag(mat)}<b>${esc(tema)}</b></span><span class="pill bad">${arr.length}</span>${ico("flecha", "chev")}</summary>
    ${arr.map((e) => {
      const ops = Array.isArray(e.opciones) ? e.opciones : [];
      const eleg = Number.isInteger(e.elegida) ? ops[e.elegida] : null, corr = Number.isInteger(e.correcta) ? ops[e.correcta] : null;
      return `<div class="err">
        <p class="errQ">${esc(e.pregunta)}</p>
        <div class="resps">
        ${eleg != null ? `<p class="resp bad">${ico("x")}<span><small>Respondió</small>${esc(eleg)}</span></p>` : ""}
        ${corr != null ? `<p class="resp ok">${ico("check")}<span><small>Correcta</small>${esc(corr)}</span></p>` : ""}
        </div>
        <div class="errPie">${e.explicacion ? `<details class="expl"><summary>Ver la explicación</summary><p>${esc(e.explicacion)}</p></details>` : "<span></span>"}<small>${esc(fechaCorta(claveDia(e.creado)))}</small></div>
      </div>`;
    }).join("")}
  </details>`;
  }).join("");
  return card("sErrores", "Preguntas que falló", `<p class="ayuda">Cada pregunta de quiz que contestó mal, con su respuesta y la correcta. Salen de aquí cuando las repasa en Chispa.</p>${html}`, String(errores.length));
}

function seccionReportes(reportes) {
  if (!reportes.length) return "";
  return card("sReportes", "Contenido que reportó", `<p class="ayuda">Ejercicios que marcó como incorrectos o confusos. Chispa los reemplazó por otros al momento; nosotros los revisamos.</p>
    <ul class="lista">${reportes.slice(0, 20).map((r) => `<li><span>${matTag(limpiaMateria(r.materia))} ${esc(limpiaTema(r.tema))}</span><b>${esc(fechaCorta(claveDia(r.creado)))}</b></li>`).join("")}</ul>`, String(reportes.length));
}

// ───────── Actividad ─────────
function detalleEvento(e) {
  const s = e.est, partes = [];
  if (e.modo === "quiz" && e.total > 0) partes.push(`${e.aciertos} de ${e.total} correctas`);
  else if (e.modo === "quiz" && s && s.items) partes.push(`contestó ${s.respondidas || 0} de ${s.items}`);
  if (s) {
    partes.push(fmtDur(s.segundos));
    if ((e.modo === "retos" || e.modo === "examen") && s.items) partes.push(`vio ${s.revelados || 0} de ${s.items} respuestas`);
    // autoevaluación (desde 2026-11-12): después de ver cada respuesta marca si le salió
    if ((e.modo === "retos" || e.modo === "examen") && s.total > 0) partes.push(`le salieron ${s.aciertos || 0} de ${s.total}`);
    if (e.modo === "retos" && s.pistas) partes.push(plural(s.pistas, "pista"));
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
  const mats = [...new Set(A.eventos.map((e) => limpiaMateria(e.materia)))].sort((a, b) => a.localeCompare(b, "es"));
  if (FILTRO_HIST && !mats.includes(FILTRO_HIST)) FILTRO_HIST = "";
  const ev = A.eventos.filter((e) => !FILTRO_HIST || limpiaMateria(e.materia) === FILTRO_HIST);
  const porDia = []; const idx = {};
  ev.forEach((e) => { const k = claveDia(e.creado); if (!(k in idx)) { idx[k] = porDia.length; porDia.push({ k, items: [] }); } porDia[idx[k]].items.push(e); });
  const LIM = 12;
  const dias = porDia.map((g, n) => {
    const seg = g.items.reduce((s, e) => s + (e.est ? e.est.segundos || 0 : 0), 0);
    return `<div class="hDia${n >= LIM ? " oculto" : ""}">
      <div class="hDiaTit"><b>${esc(tituloDia(g.k))}</b><span>${plural(g.items.length, "actividad", "actividades")}${seg ? " · " + esc(fmtDur(seg)) : ""}</span></div>
      <div class="linea">
      ${g.items.map((e) => {
        const det = detalleEvento(e);
        const p = e.modo === "quiz" && e.total > 0 ? pct(e.aciertos, e.total) : null;
        const flojo = e.soloSesion && !(e.total > 0) && !(e.est && e.est.revelados);
        return `<div class="ev${flojo ? " flojo" : ""}" style="--m:${colorMateria(limpiaMateria(e.materia))}">
          <span class="evH">${esc(hora(e.creado))}</span><span class="evDot" aria-hidden="true"></span>
          <div class="evTx"><div class="evTop"><span class="tipo t-${esc(e.modo)}">${esc((MODO[e.modo] || { l: e.modo }).l)}</span><b>${esc(tituloEvento(e))}</b>${p != null ? `<span class="pill ${claseNota(p)}">${p}%</span>` : ""}</div>
            <span class="evMat"><b>${esc(limpiaMateria(e.materia))}</b> · ${esc(limpiaTema(e.tema))}</span>
            ${det.length ? `<span class="evDet">${det.map((x) => `<span>${esc(x)}</span>`).join("")}</span>` : ""}</div>
        </div>`;
      }).join("")}
      </div>
    </div>`;
  }).join("");
  const filtro = mats.length > 1 ? `<div class="chips" role="group" aria-label="Filtrar por materia">${["", ...mats].map((m) => `<button type="button" class="chip" data-f="${esc(m)}" aria-pressed="${m === FILTRO_HIST}">${m ? `<i style="--m:${colorMateria(m)}"></i>` : ""}${esc(m || "Todas")}</button>`).join("")}</div>` : "";
  const mas = porDia.length > LIM ? `<button class="btn sec2 full" id="histMas" type="button">Ver ${porDia.length - LIM} días más</button>` : "";
  return card("sHistorial", "Historial", filtro + (dias || vacio("Nada con ese filtro.")) + mas, String(ev.length));
}

function seccionUso(A, d) {
  const p = d.perfil || {};
  const ape = A.ape;
  let cuerpo = `<div class="mini3">
    <div><span>Aperturas</span><b>${ape.length || (A.midiendo ? 0 : "—")}</b></div>
    <div><span>Días con uso</span><b>${ape.length ? new Set(ape.map(claveDia)).size : "—"}</b></div>
    <div><span>Racha</span><b>${plural(p.racha_dias || 0, "día")}</b></div>
  </div>`;
  if (ape.length) {
    const porHora = Array(24).fill(0); ape.forEach((x) => { porHora[hora24(x)]++; });
    const max = Math.max(1, ...porHora);
    const fr = [["la madrugada", 0, 6], ["la mañana", 6, 12], ["la tarde", 12, 18], ["la noche", 18, 24]].map(([l, a, b]) => ({ l, a, b, n: porHora.slice(a, b).reduce((s, v) => s + v, 0) }));
    const top = fr.slice().sort((a, b) => b.n - a.n)[0];
    cuerpo += `<h3>A qué hora abre Chispa</h3>
      <p class="ayuda">Sobre todo en ${top.l} (${top.a}–${top.b} h): ${Math.round(top.n / ape.length * 100)}% de las aperturas.</p>
      <div class="horas">${porHora.map((n, h) => `<i style="--p:${n ? Math.round(18 + 82 * n / max) : 0}%" title="${h}:00–${h + 1}:00 · ${plural(n, "apertura")}"></i>`).join("")}</div>
      <div class="horasEje"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>`;
    const tarde = ape.filter((x) => { const h = hora24(x); return h >= 22 || h < 5; }).length;
    if (tarde) cuerpo += `<p class="aviso warn">${ico("reloj")}<span>${plural(tarde, "apertura")} entre las 10 p. m. y las 5 a. m. ${esc(A.P.etiqueta)}.</span></p>`;
    cuerpo += `<details class="plieg"><summary>${ico("flecha", "chev")} Últimas aperturas</summary><ul class="lista">${ape.slice(0, 25).map((x) => `<li><span>${esc(tituloDia(claveDia(x)))}</span><b>${esc(hora(x))}</b></li>`).join("")}</ul></details>`;
  } else {
    cuerpo += `<p class="ayuda">${A.midiendo ? `No abrió la app ${esc(A.P.etiqueta)}.` : "Las horas de uso se registran desde el 29 de octubre de 2026."} Total de ingresos desde que usa Chispa: <b>${p.accesos || 0}</b>.</p>`;
  }
  return card("sUso", "Uso de la app", cuerpo);
}

// ───────── Agenda ─────────
function filaTarea(t) {
  const n = diasHasta(t.fecha);
  const cls = t.hecha ? "ok" : n != null && n < 0 ? "bad" : n != null && n <= 1 ? "med" : esExamen(t) ? "ind" : "neu";
  const rel = t.hecha ? "Hecha" : n == null ? "Sin fecha" : n < 0 ? `Hace ${plural(-n, "día")}` : n === 0 ? "Hoy" : n === 1 ? "Mañana" : `En ${n} días`;
  let fecha = `<span class="fecha neu"><b>—</b></span>`;
  if (/^\d{4}-\d{2}-\d{2}/.test(String(t.fecha || ""))) {
    const k = String(t.fecha).slice(0, 10), [, m, dd] = k.split("-").map(Number);
    fecha = `<span class="fecha ${cls}"><small>${DIAS_C[diaSemana(k)]}</small><b>${dd}</b><small>${MESES_C[m - 1]}</small></span>`;
  }
  const tipo = esExamen(t) ? `<span class="tipo t-examen">Examen</span>` : `<span class="tTipo">${esc(TIPO_T[t.tipo] || "Tarea")}</span>`;
  return `<div class="tarea${t.hecha ? " hecha" : ""}">${fecha}<div class="tTx"><b class="clamp">${esc(t.descripcion || TIPO_T[t.tipo] || "Tarea")}</b><span class="tMeta">${matTag(limpiaMateria(t.materia))}${tipo}</span></div><span class="tRel ${cls}">${esc(rel)}</span></div>`;
}
function seccionTareas(d) {
  const tareas = d.tareas || [];
  const pend = tareas.filter((t) => !t.hecha).sort((a, b) => String(a.fecha || "9").localeCompare(String(b.fecha || "9")));
  const hechas = tareas.filter((t) => t.hecha);
  const grupos = [
    ["Vencidas", "bad", (n) => n != null && n < 0], ["Hoy y mañana", "med", (n) => n === 0 || n === 1],
    ["Próximos 7 días", "", (n) => n != null && n >= 2 && n <= 7], ["Más adelante", "", (n) => n != null && n > 7], ["Sin fecha", "", (n) => n == null],
  ];
  let html = pend.length ? grupos.map(([tit, c, f]) => {
    const arr = pend.filter((t) => f(diasHasta(t.fecha)));
    return arr.length ? `<div class="tGrupo"><h3 class="${c}">${tit}<span class="cnt">${arr.length}</span></h3><div class="tareas">${arr.map(filaTarea).join("")}</div></div>` : "";
  }).join("") : `<div class="todoOk">${ico("check")}<div><b>Al día</b><span>Sin tareas pendientes.</span></div></div>`;
  if (hechas.length) html += `<details class="plieg"><summary>${ico("flecha", "chev")} ${plural(hechas.length, "hecha")}</summary><div class="tareas">${hechas.slice(0, 30).map(filaTarea).join("")}</div></details>`;
  return card("sAgenda", "Tareas y exámenes", html, pend.length ? `${pend.length} pendiente${pend.length > 1 ? "s" : ""}` : "");
}
function seccionNotas(d) {
  const notas = d.notas || [];
  if (!notas.length) return card("sNotas", "Notas de exámenes", vacio("Todavía no ha anotado notas de examen en su agenda."));
  const cl = (v) => (v >= 16 ? "ok" : v >= 14 ? "med" : "bad");
  const acc = {};
  notas.forEach((n) => { const k = limpiaMateria(n.materia); (acc[k] = acc[k] || []).push(Number(n.nota) || 0); });
  const todas = notas.map((n) => Number(n.nota) || 0), general = Math.round(todas.reduce((s, v) => s + v, 0) / todas.length * 10) / 10;
  const porMat = Object.entries(acc).map(([m, v]) => [m, Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10, v.length]).sort((a, b) => b[1] - a[1]);
  return card("sNotas", "Notas de exámenes", `<div class="notaTop">
      <div class="notaProm"><b class="${cl(general)}">${String(general).replace(".", ",")}</b><small>/20</small><span>Promedio general · ${plural(notas.length, "nota")}</span></div>
      <div class="notaMats">${porMat.map(([m, v, c]) => `<div class="nm"><span>${matTag(m)}<small>${plural(c, "nota")}</small></span><span class="barra ${cl(v)}"><i style="width:${Math.round(v / 20 * 100)}%"></i></span><b>${String(v).replace(".", ",")}</b></div>`).join("")}</div>
    </div>
    <ul class="lista notas">${notas.map((n) => { const v = Number(n.nota); return `<li><span><b>${esc(n.descripcion || "Examen")}</b><small>${esc(limpiaMateria(n.materia))} · ${esc(fechaCorta(n.fecha))}</small></span><span class="pill ${cl(v)}">${esc(String(n.nota).replace(/\.0$/, ""))}/20</span></li>`; }).join("")}</ul>`);
}
function seccionHorario(d) {
  const hor = d.horario || [];
  if (!hor.length) return "";
  const hoy = diaSemana(hoyYMD());
  const cols = [1, 2, 3, 4, 5].map((dia) => hor.filter((h) => h.dia === dia).sort((a, b) => (a.orden || 0) - (b.orden || 0)).map((h) => limpiaMateria(h.materia)));
  return card("sHorario", "Horario de la semana", `<div class="horario">${["Lun", "Mar", "Mié", "Jue", "Vie"].map((l, k) => `<div class="${k + 1 === hoy ? "hoy" : ""}"><b>${l}</b>${cols[k].map((m) => `<span style="--m:${colorMateria(m)}">${esc(m)}</span>`).join("") || "<span class='mut'>—</span>"}</div>`).join("")}</div>`);
}

const SECCION = {
  sMision: ["tea", "diana"], sAtencion: ["amb", "alerta"], sGrafico: ["ind", "graf"], sMaterias: ["blu", "libro"], sQuiz: ["vio", "check"],
  sErrores: ["ros", "x"], sHistorial: ["tea", "lista"], sAgenda: ["amb", "cal"], sNotas: ["vio", "libro"], sHorario: ["blu", "reloj"],
  sUso: ["ind", "cel"], sReportes: ["gri", "bandera"], sProximo: ["amb", "cal"],
};
function card(id, titulo, cuerpo, badge) {
  const [tono, icono] = SECCION[id] || ["acc", "lista"];
  return `<section class="card" id="${id}" style="--k:var(--t-${tono})"><h2><span class="hIco">${ico(icono)}</span><span class="hTit">${esc(titulo)}</span>${badge ? `<span class="cnt">${esc(badge)}</span>` : ""}</h2>${cuerpo}</section>`;
}
// color estable por materia (mismas familias que la app de las niñas, en tonos sobrios)
function colorMateria(m) {
  const n = String(m || "").toLowerCase();
  const t = [[/social|historia|geograf/, "#2563EB"], [/f[ií]sica.*educ|educ.*f[ií]sica|deporte/, "#EA580C"], [/natural|biolog|qu[ií]m|ciencia/, "#059669"],
    [/matem|l[oó]gic/, "#4F46E5"], [/ingl/, "#7C3AED"], [/lengua|lider|comunic|castell/, "#DC2626"], [/inform|rob[oó]t|tecnol/, "#0891B2"],
    [/m[uú]sic|est[eé]tic|arte/, "#DB2777"], [/relig|emocional|proyecto/, "#CA8A04"]];
  const f = t.find(([re]) => re.test(n));
  return f ? f[1] : "#64748B";
}
function vacio(msg) { return `<p class="vacio">${esc(msg)}</p>`; }

function irTab(t) {
  localStorage.setItem(KEY_TAB, t);
  repintar();
  // si ya había bajado, la pestaña nueva empieza arriba (justo debajo de las pestañas fijas)
  const panel = document.querySelector(".panelTab"), tabs = document.querySelector(".tabs");
  if (panel && tabs) { const y = panel.getBoundingClientRect().top + window.scrollY - tabs.offsetHeight - 8; if (window.scrollY > y) window.scrollTo(0, Math.max(0, y)); }
}
function conectar() {
  document.querySelectorAll(".hijo").forEach((b) => b.onclick = () => { const k = +b.dataset.i; if (k === getActivo()) return; setActivo(k); FILTRO_HIST = ""; cargarYrender(); });
  document.querySelectorAll(".seg button").forEach((b) => b.onclick = () => { localStorage.setItem(KEY_PERIODO, b.dataset.p); repintar(); });
  document.querySelectorAll(".tab").forEach((b) => b.onclick = () => irTab(b.dataset.tab));
  document.querySelectorAll("[data-ir]").forEach((b) => b.onclick = () => irTab(b.dataset.ir));
  document.querySelectorAll(".chip[data-f]").forEach((b) => b.onclick = () => { FILTRO_HIST = b.dataset.f; repintar(); });
  const mas = document.getElementById("histMas"); if (mas) mas.onclick = () => { document.querySelectorAll(".hDia.oculto").forEach((x) => x.classList.remove("oculto")); mas.remove(); };
  document.querySelectorAll(".clamp").forEach((t) => t.onclick = () => t.classList.toggle("abierto"));
  document.getElementById("btnRecargar").onclick = () => cargarYrender(true);
  document.getElementById("btnAgregarHijo").onclick = () => mostrarVincular(true);
  const ba = document.getElementById("btnAvisos"); if (ba) ba.onclick = alternarAvisos;
  const mf = document.getElementById("misionForm"); if (mf) mf.onsubmit = enviarMision;
  const mc = document.getElementById("misionCancelar"); if (mc) mc.onclick = () => cancelarMision(+mc.dataset.id);
  document.getElementById("btnSalir").onclick = desvincularActivo;
  const sr = document.getElementById("staleRetry"); if (sr) sr.onclick = () => cargarYrender(true);
}
// re-pinta con los datos que ya tenemos (cambio de periodo, pestaña o filtro), sin perder la posición
function repintar(anclaId) {
  if (!PANEL_ACTUAL) return;
  const y = window.scrollY;
  const { d, ninos, i, staleTs, detalle } = PANEL_ACTUAL;
  render(d, ninos, i, staleTs, detalle);
  const a = anclaId && document.getElementById(anclaId);
  if (a) a.scrollIntoView({ block: "start" }); else window.scrollTo(0, y);
}
// el menú ⋯ se cierra al tocar fuera (un solo listener para toda la vida de la página)
document.addEventListener("click", (e) => { const menu = document.querySelector("details.menu"); if (menu && menu.open && !menu.contains(e.target)) menu.open = false; }, true);

// ───────── avisos al teléfono del adulto (MEJORAS 18 y 19, 2026-11-12) ─────────
// Los domingos, el resumen de la semana; cualquier día, lo importante (examen en 2 días sin
// practicar, 3+ días sin abrir Chispa, 3+ tareas atrasadas), sin repetir el mismo motivo.
// Lo decide y lo manda el servidor (herramientas/avisos.mjs). Una suscripción por hijo vinculado.
const VAPID_PUBLICA = "BGmaLBol9IU95zJpvzqhMvU8OWyRjGFRZNNUI5fpcXmaZOb8lIwqmEkFBlQj2EobmopDaaPxn1xgO5hfuqKDUa4";
const KEY_AVISOS = "familia_avisos";
const esIOSf = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function instaladaF() { try { return matchMedia("(display-mode: standalone)").matches || navigator.standalone === true; } catch (e) { return false; } }
function avisosPosibles() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
function avisosActivos() { return avisosPosibles() && Notification.permission === "granted" && localStorage.getItem(KEY_AVISOS) === "1"; }
function claveB64(b64) { const p = "=".repeat((4 - b64.length % 4) % 4); const x = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...x].map((c) => c.charCodeAt(0))); }
async function suscripcion(crear) {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub && crear) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: claveB64(VAPID_PUBLICA) });
  return sub;
}
async function enviarSub(sub, activo) {
  const ninos = getNinos(); let ok = false;
  for (const n of ninos) { const r = await apiUna({ accion: "push_sub", ptoken: n.token, sub: sub.toJSON(), activo }); if (r.d && r.d.ok) ok = true; }
  return ok;
}
async function alternarAvisos() {
  const m = document.querySelector("details.menu"); if (m) m.open = false;
  if (avisosActivos()) {
    localStorage.setItem(KEY_AVISOS, "0");
    try { const sub = await suscripcion(false); if (sub) { await enviarSub(sub, false); await sub.unsubscribe(); } } catch (e) {}
    aviso("Avisos apagados en este teléfono."); return repintar();
  }
  if (esIOSf && !instaladaF()) return aviso("En iPhone los avisos funcionan con el panel instalado: toca Compartir → \"Agregar a inicio\", ábrelo desde ese ícono y actívalos ahí.");
  if (!avisosPosibles()) return aviso("Este navegador no permite avisos.");
  const p = await Notification.requestPermission();
  if (p !== "granted") return aviso("Los avisos están bloqueados para este sitio. Puedes permitirlos en los ajustes del navegador.");
  try {
    const sub = await suscripcion(true);
    if (!(await enviarSub(sub, true))) throw new Error("no se guardó");
    localStorage.setItem(KEY_AVISOS, "1");
    aviso("Listo. Te avisaremos de lo importante y cada domingo te llegará el resumen de la semana.");
  } catch (e) { aviso("No se pudieron activar los avisos. Intenta de nuevo más tarde."); }
  repintar();
}
// mensaje breve arriba del panel (se va solo)
function aviso(txt) {
  let el = document.getElementById("avisoFlotante");
  if (!el) { el = document.createElement("div"); el.id = "avisoFlotante"; el.setAttribute("role", "status"); document.body.appendChild(el); }
  el.textContent = txt; el.className = "visible";
  clearTimeout(aviso.t); aviso.t = setTimeout(() => { el.className = ""; }, 6000);
}
// al tocar un aviso con el panel ya abierto: traerlo al frente y actualizar los datos
if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.chispa === "ir") cargarYrender(true); });

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
        // con avisos ya activos en este teléfono, el hijo nuevo también los manda
        if (avisosActivos()) suscripcion(false).then((sub) => sub && enviarSub(sub, true)).catch(() => {});
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
