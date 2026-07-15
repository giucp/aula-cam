  // ───────── PWA: registrar el service worker (instalar como app) ─────────
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
  }

  // ───────── config ─────────
  const API_MOODLE   = "https://aula-cam.vercel.app/api/moodle";
  const API_GENERAR  = "https://aula-cam.vercel.app/api/generar";
  const API_CURRICULO = "https://aula-cam.vercel.app/api/curriculo";
  const API_ERRORES  = "https://aula-cam.vercel.app/api/errores";
  const API_ACTIVIDAD = "https://aula-cam.vercel.app/api/actividad";
  const API_CURADO_INFO = "https://aula-cam.vercel.app/api/curado-info";
  const API_AGENDA = "https://aula-cam.vercel.app/api/agenda";
  const API_CUENTA = "https://aula-cam.vercel.app/api/cuenta";   // auth propia (cuenta nativa, beta)
  const API_MANUAL = "https://aula-cam.vercel.app/api/manual";   // Camino B: materias manuales + apuntes

  // modos de salida
  // Ruta de aprendizaje: los 4 pasos EN ORDEN (ids internos intactos; solo cambia lo visible).
  const MODOS = [
    { id:"resumen", icon:"📝", nombre:"Aprende",          desc:"Lee un resumen que te explica el tema paso a paso",        verbo:"📝 Hacer resumen",     carga:"Armando tu resumen",   conteo:false },
    { id:"retos",   icon:"🎯", nombre:"Practica",         desc:"Ejercicios con pistas y sin nota, para agarrar confianza", verbo:"✨ Crear mis retos",    carga:"Inventando retos",     conteo:true  },
    { id:"quiz",    icon:"🎮", nombre:"Demuestra",        desc:"Un quiz con nota: mira cuánto dominas ya",                 verbo:"🎮 Crear quiz",        carga:"Armando tu quiz",      conteo:true  },
    { id:"examen",  icon:"📋", nombre:"Simula tu examen", desc:"Preguntas como las que te pueden poner en clase",          verbo:"📋 Crear examen",      carga:"Preparando preguntas", conteo:true  },
  ];

  // almacenamiento seguro: localStorage si existe, si no, memoria
  const store = {
    mem:{},
    get(k){ try{ const v=localStorage.getItem(k); return v==null?null:JSON.parse(v);}catch(e){ return (k in this.mem)?this.mem[k]:null; } },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ this.mem[k]=v; } },
    del(k){ try{ localStorage.removeItem(k);}catch(e){} delete this.mem[k]; }
  };

  const $ = (s)=>document.querySelector(s);
  let SESION = null;
  let BETA = false;        // flujo de cuenta propia (nativa), solo con ?beta=1 — NO toca el login de aula
  let RESCATE_SIGUE = null; // qué hacer tras mostrar el código de rescate
  let origen = "actual";   // "actual" = materias del grado; "proximo" = adelantar próximo año
  let proximoGrado = "";
  let materiaSel = null;
  let lapsoMap = {};
  let temaSel = null;
  let cantidad = 5;
  let modoSel = "retos";
  let MODO_LAB = false;   // true dentro del "cuarto de pruebas" (admin): no escribe nada, sin botones de generar
  let ultimoContexto = null;
  let fotos = [];          // fotos del cuaderno (apuntes), solo del momento
  const MAX_FOTOS = 5;
  let MIS_ERRORES = [];    // preguntas de quiz falladas (para "repasar mis errores")
  let PROGRESO = new Map();// clave norm(materia)+"|"+norm(tema) → {modos:Set, quizMejor:number|null}

  // (el arranque corre al FINAL del script, cuando todas las consts/funciones ya existen)

  // ───────── LOGIN ─────────
  $("#btnLogin").onclick = hacerLogin;
  $("#pass").addEventListener("keydown", e=>{ if(e.key==="Enter") hacerLogin(); });

  async function hacerLogin(){
    const user = $("#user").value.trim();
    const pass = $("#pass").value;
    const msg = $("#loginMsg");
    if(!user || !pass){ msg.innerHTML = errBox("Escribe tu usuario y tu clave."); return; }
    const btn = $("#btnLogin");
    btn.disabled = true; const txt = btn.textContent; btn.textContent = "Entrando…";
    msg.innerHTML = "";
    try{
      const r = await fetch(API_MOODLE,{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ username:user, password:pass })});
      const d = await r.json();
      if(d.error) throw new Error(d.error);
      // logueó bien, pero el admin aún no lo habilitó → pantalla "acceso en revisión"
      if(d.pendiente){
        tokenPendiente = d.token || null;
        nombrePendiente = (d.usuario && d.usuario.nombre) || user;
        $("#user").value=""; $("#pass").value="";
        verPendiente(nombrePendiente);
        return;
      }
      SESION = {
        id: (d.usuario && d.usuario.id!=null) ? d.usuario.id : ("u_"+user.toLowerCase()),
        nombre:(d.usuario&&d.usuario.nombre)||user, token:d.token, materias:d.materias||[],
        racha:(d.usuario&&d.usuario.racha)||0, fetched: Date.now()
      };
      store.set("sesion", SESION);
      $("#user").value=""; $("#pass").value="";
      entrarHome();
    }catch(e){
      const txtErr = /invalid|inválid|incorrect/i.test(String(e.message))
        ? "Usuario o clave incorrectos. Revisa e intenta de nuevo."
        : "No pudimos entrar. Revisa tu internet e intenta otra vez.";
      msg.innerHTML = errBox(txtErr, String(e.message||e));
    }finally{ btn.disabled=false; btn.textContent=txt; }
  }

  // ───────── HOME ─────────
  // pinta el chip de racha desde SESION.racha (reutilizable: login y refresco al reabrir)
  function pintarRacha(){
    const racha = (SESION && SESION.racha) || 0, rc = $("#rachaChip");
    if(!rc) return;
    if(racha>=2){ rc.innerHTML = `🔥 <b>${racha}</b> <small>días</small>`; rc.classList.remove("hidden"); }
    else { rc.classList.add("hidden"); rc.innerHTML=""; }
  }
  function entrarHome(){
    $("#vLanding").classList.add("hidden");
    $("#vLogin").classList.add("hidden");
    $("#vPendiente").classList.add("hidden");
    ["#vBeta","#vRegistro","#vRescate","#vLoginNat","#vRecuperar","#vSolicitud"].forEach(id=>{const e=$(id); if(e) e.classList.add("hidden");});
    $("#vHome").classList.remove("hidden");
    // Familia YA funciona para cuentas nativas (Camino B): el niño invita con su token de Chispa y
    // api/familia lo valida (useridDeNino). El muro social sigue siendo por grado del aula → oculto
    // para nativas hasta F5.2 (segmentar por colegio+grado; decisión de producto pendiente).
    const nativa=!!(SESION && SESION.fuente==="manual");
    const wfam=$("#familiaWrap"); if(wfam) wfam.classList.remove("hidden");
    const bmuro=[...document.querySelectorAll("#navbar .navBtn")].find(b=>b.dataset.tab==="muro");
    if(bmuro) bmuro.classList.toggle("hidden", nativa);
    origen = "actual";
    const primer = (SESION.nombre||"").split(" ")[0] || "";
    $("#avatar").textContent = (primer[0]||"?").toUpperCase();
    $("#avatar").style.setProperty("--c", colorCuenta(SESION.nombre||primer));
    $("#saludo").innerHTML = `¡Hola, ${escapeHtml(primer)}! 👋`;
    // racha de días seguidos (se muestra desde el 2º día, para que se sienta ganada)
    pintarRacha();
    // muro: una racha de 3+ días es un logro para celebrar (el server dedup 1/día)
    if(((SESION&&SESION.racha)||0)>=3) publicarMuro("racha", {meta:{dias:SESION.racha}});
    const g = gradoDeSesion();
    $("#gradoBadge").innerHTML = g ? `🎓 ${escapeHtml(g)}` : "";
    $("#gradoBadge").classList.toggle("hidden", !g);
    // tarjeta "adelantar próximo año" (solo si hay grado siguiente)
    const prox = siguienteGradoLabel();
    const wrap = $("#destacadaWrap");
    if(prox){ $("#proxSub").textContent = `Practica ${prox}`; wrap.classList.remove("hidden"); }
    else wrap.classList.add("hidden");
    // 🆕 novedades del aula: cargar la foto del usuario (servidor) y luego detectar + repintar
    cargarAulaSnap().then(()=>{
      detectarNovedades();
      pintarNovedadesInicio();
      if(origen==="actual" && SESION && SESION.materias) gridMaterias(SESION.materias);
    });
    pintarMaterias();
    verMaterias();
    cargarErrores();
    cargarProgreso();
    cargarCuradoInfo(gradoDeSesion());   // qué temas tienen guía revisada (sello 📗 + botón)
    cargarAgenda();                      // horario + tareas + notas para el escritorio
    verTab("inicio");                    // el día arranca en el escritorio
    // F4: tutorial de bienvenida — SOLO cuentas nativas (Camino B) que aún no lo vieron.
    // Las cuentas de aula (fuente=moodle, las niñas) nunca lo ven. Se muestra una vez (persistido).
    if(nativa && SESION && !SESION.onboarding){ setTimeout(mostrarOnboarding, 500); }
  }

  // ───────── pestañas (barra de navegación inferior) ─────────
  function verTab(id){
    $("#tabInicio").classList.toggle("hidden", id!=="inicio");
    $("#tabMaterias").classList.toggle("hidden", id!=="materias");
    $("#tabMuro").classList.toggle("hidden", id!=="muro");
    $("#tabAgenda").classList.toggle("hidden", id!=="agenda");
    $("#vHome").classList.toggle("home-v2-active", id==="inicio");
    document.body.classList.toggle("home-v2-page", id==="inicio");
    // Materias 2.0 trae su propio encabezado (título protagonista), así que la .topbar vieja
    // —saludo + grado + racha + Salir— sobra ahí: duplicaba el saludo del Inicio y competía
    // con el título. Salir sigue estando en el Inicio (#btnSalirHome). Agenda y Amigos aún
    // NO están migradas: conservan la topbar hasta que les toque.
    document.body.classList.toggle("materias-v2-page", id==="materias");
    document.querySelectorAll("#navbar .navBtn").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.tab===id)));
    if(id==="inicio") pintarEscritorio();
    if(id==="muro") cargarMuro();
    if(id==="agenda"){ pintarTareas(); pintarNotas(); pintarHorarioSemana(); }
    window.scrollTo({top:0});
  }
  document.querySelectorAll("#navbar .navBtn").forEach(b=>b.onclick=()=>verTab(b.dataset.tab));

  // ───────── agenda: datos (horario + tareas en Supabase) ─────────
  let HORARIO=[], TAREAS=[], NOTAS=[], IA_ESTADO=null;
  async function apiAgenda(body){
    const r=await fetch(API_AGENDA,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({...body, usuario_id:(SESION&&SESION.id)||null})});
    return r.json();
  }
  async function cargarAgenda(){
    try{ const d=await apiAgenda({accion:"todo"}); HORARIO=d.horario||[]; TAREAS=d.tareas||[]; NOTAS=d.notas||[]; IA_ESTADO=d.ia||IA_ESTADO; }
    catch(_){ HORARIO=[]; TAREAS=[]; NOTAS=[]; }
    if(!$("#tabInicio").classList.contains("hidden")) pintarEscritorio();
  }

  // fechas locales sin sorpresas de zona horaria
  const DIAS_NOM=["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
  const MESES=["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  function diasHasta(fecha){            // "YYYY-MM-DD" → días desde hoy (0=hoy, <0=vencida)
    if(!fecha || !/^\d{4}-\d{2}-\d{2}/.test(fecha)) return null;
    const [y,m,dd]=fecha.slice(0,10).split("-").map(Number);
    const a=new Date(y,m-1,dd); const b=new Date(); b.setHours(0,0,0,0);
    return Math.round((a-b)/86400000);
  }
  function fechaBonita(fecha){
    const n=diasHasta(fecha);
    if(n===null) return "";
    if(n===0) return "hoy";
    if(n===1) return "mañana";
    if(n<0) return "venció";
    const [y,m,dd]=fecha.slice(0,10).split("-").map(Number);
    return `${DIAS_NOM[new Date(y,m-1,dd).getDay()]} ${dd}`;
  }

  // ───────── escritorio (pestaña Inicio) ─────────
  function proximoDiaEscolar(){          // → {dia:1..5, titulo}
    const hoy=new Date().getDay();       // 0=dom … 6=sáb
    if(hoy>=1 && hoy<=4) return {dia:hoy+1, titulo:"Mañana toca"};
    if(hoy===0) return {dia:1, titulo:"Mañana toca"};   // domingo → lunes
    return {dia:1, titulo:"El lunes toca"};              // viernes y sábado → lunes
  }
  // ───────── CHISPA 2.0 · INICIO (solo presentación de la pestaña Inicio) ─────────
  function homeMaterias(){ return (SESION&&Array.isArray(SESION.materias)) ? SESION.materias : []; }
  function homeEnergiaPct(){
    if((SESION&&SESION.plan==="gratis") || !IA_ESTADO || IA_ESTADO.ilimitado || !IA_ESTADO.limite) return null;
    return Math.max(0,Math.min(100,Math.round((IA_ESTADO.restante/IA_ESTADO.limite)*100)));
  }
  function homeTareaKey(t){
    return t&&t.id!=null?`id:${t.id}`:[t&&t.fecha,t&&t.materia,t&&t.tipo,t&&t.descripcion].map(x=>norm(x||"")).join("|");
  }
  function homePendientesHoy(){
    return TAREAS.filter(t=>!t.hecha&&t.fecha&&diasHasta(t.fecha)===0);
  }
  // Identidad visual centralizada de materias para toda la Home (color de acento + ícono PNG).
  // Los PNG (estilo claymorphism de Codex) viven en assets/materias/. El ORDEN importa:
  // lo más específico primero (sociales antes que ciencias; ed. física antes que física;
  // química/física/biología antes que "ciencias" genérico).
  function homeMateriaVisual(nombre){
    const n=norm(limpiaNombreMateria(nombre||""));
    // Acentos alineados a CHISPA_2.0_DESIGN_SPECIFICATION.md §8 (tabla de materias).
    const visuales=[
      {key:"sociales",match:/social|historia|geograf|ciudadan/,color:"#4F83D8",img:"ciencias-sociales"},
      {key:"edfisica",match:/deporte|educaci[oó]n f[ií]sic|ed\.? ?f[ií]sic/,color:"#FF795F",img:"educacion-fisica"},
      {key:"quimica",match:/qu[ií]m/,color:"#2EAF69",img:"quimica"},
      {key:"fisica",match:/f[ií]sic/,color:"#2EAF69",img:"fisica"},
      {key:"biologia",match:/biolog|ambient/,color:"#2EAF69",img:"biologia"},
      {key:"ciencias",match:/cienc|natural/,color:"#2EAF69",img:"ciencias-naturales"},
      {key:"matematica",match:/matem|l[oó]gic|algebra|álgebra/,color:"#6753E8",img:"matematica"},
      {key:"ingles",match:/ingl|idioma|franc/,color:"#9A62D5",img:"ingles"},
      {key:"lenguaje",match:/lengua|castell|literat|comunic|lider/,color:"#F06F58",img:"lenguaje"},
      {key:"informatica",match:/inform|comput|tecnolog|program|digital/,color:"#19B8B0",img:"informatica"},
      {key:"robotica",match:/robot|electr[oó]n/,color:"#19B8B0",img:"robotica"},
      {key:"musica",match:/m[uú]sic/,color:"#E987AA",img:"musica"},
      {key:"arte",match:/est[eé]tic|arte|dibujo|pl[aá]st/,color:"#E987AA",img:"educacion-estetica"},
      {key:"religion",match:/religi/,color:"#9A62D5",img:"religion"},
      {key:"pensar",match:/pensar|orient|metodolog|filos|acert|razon|convivencia/,color:"#E4A91B",img:"como-pensar"}
    ];
    // OJO: el fallback NO puede llamar a colorMateria() — colorMateria delega en esta función,
    // así que sería recursión infinita para cualquier materia que no matchee (stack overflow que
    // rompía el forEach de la grilla y dejaba materias sin pintar). Color literal por defecto.
    return visuales.find(v=>v.match.test(n))||{key:"general",color:"#6753E8",img:"como-pensar"};
  }
  function homeMarcaMateria(nombre,clase){
    const v=homeMateriaVisual(nombre);
    return `<span class="${clase} h2SubjectVisual h2SubjectVisual--${v.key}"><img src="assets/materias/${v.img}.png" alt="" aria-hidden="true"></span>`;
  }
  function homeIcono(tipo){
    const paths={
      racha:'<path d="M12 2c1 4-1 5-1 8 0 2 1 3 3 3 2 0 3-2 3-4 3 3 4 6 3 9-1 4-4 6-8 6s-8-3-8-8c0-4 3-7 6-10 0 3 1 5 3 5 2 0 3-3 2-9z"/>',
      energia:'<path d="m13 2-8 12h6l-1 8 9-13h-6z"/>',
      tarea:'<path d="M7 4h10a2 2 0 0 1 2 2v14H5V6a2 2 0 0 1 2-2z"/><path d="M9 4V2h6v2M8 10h8M8 14h5"/>',
      flecha:'<path d="M5 12h13M14 7l5 5-5 5"/>',
      chispa:'<path d="M12 3c.7 4.7 2.3 6.3 7 7-4.7.7-6.3 2.3-7 7-.7-4.7-2.3-6.3-7-7 4.7-.7 6.3-2.3 7-7z"/>',
      // ── íconos de "Más para ti" (Chispa 2.0: SVG, nunca emojis) ──
      juego:'<path d="M10 4.5A2.5 2.5 0 0 0 5.6 6 2.5 2.5 0 0 0 4.5 10a2.5 2.5 0 0 0 .6 4.4V17a2.5 2.5 0 0 0 4.9.6z"/><path d="M14 4.5A2.5 2.5 0 0 1 18.4 6a2.5 2.5 0 0 1 1.1 4 2.5 2.5 0 0 1-.6 4.4V17a2.5 2.5 0 0 1-4.9.6z"/>',
      calendario:'<rect x="4" y="5.5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10.5h16"/>',
      nota:'<path d="M12 4 2.8 8.5 12 13l9.2-4.5z"/><path d="M6.5 10.8V15c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3v-4.2"/>',
      familia:'<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5a6 6 0 0 1 12 0"/><path d="M16.5 6.4a2.8 2.8 0 0 1 0 5.6M17 19.5a5 5 0 0 0-1.8-3.8"/>',
      novedad:'<path d="M12 3.5a5 5 0 0 0-5 5c0 4-1.8 4.8-1.8 6.8h13.6c0-2-1.8-2.8-1.8-6.8a5 5 0 0 0-5-5z"/><path d="M10.2 18.5a1.9 1.9 0 0 0 3.6 0"/>',
      refuerzo:'<path d="M12 19.5V6.5"/><path d="M6.5 12 12 6.5l5.5 5.5"/>',
      lapiz:'<path d="M14.8 5.2 18.8 9.2M4.5 19.5l4.4-.9 9.4-9.4a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L5 14.6z"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[tipo]||paths.tarea}</svg>`;
  }
  // ───────── Chispa (mascota) — config CENTRAL (spec §13: una sola fuente, fallback seguro) ─────────
  // Los 5 estados oficiales (§9) viven en assets/chispa-3d/; las 15 poses adicionales en poses/png/.
  const CHISPA_ESTADOS=["saludando","pensando","animando","celebrando","descansando"];
  function chispaSrc(estado){
    const e=CHISPA_ESTADOS.includes(estado)?estado:"saludando";  // fallback seguro a saludando
    return `assets/chispa-3d/chispa-3d-${e}.png`;
  }
  const CHISPA_POSES={
    reposo:"01-reposo",brazosAbiertos:"02-brazos-abiertos",senalaDerecha:"03-senala-derecha",
    senalaIzquierda:"04-senala-izquierda",pulgarArriba:"05-pulgar-arriba",escuchando:"06-escuchando",
    leyendo:"07-leyendo",escribiendo:"08-escribiendo",estrella:"09-estrella",explicando:"10-explicando",
    sorprendido:"11-sorprendido",caminando:"12-caminando",saltando:"13-saltando",estirando:"14-estirando",
    parpadeando:"15-parpadeando"
  };
  function chispaPoseSrc(nombre){
    const f=CHISPA_POSES[nombre]||CHISPA_POSES.reposo;   // fallback seguro a reposo
    return `assets/chispa-3d/poses/png/chispa-3d-${f}.png`;
  }
  // Nombre de materia en caso título ("CIENCIAS NATURALES" → "Ciencias Naturales"): evita las
  // MAYÚSCULAS gritonas en la Home (spec §4 voz calmada / §3 evitar caps sostenidas).
  function capMateria(s){
    return String(s||"").toLowerCase().replace(/(^|[\s(¿"'\-/])([a-záéíóúñü])/g,(m,p,c)=>p+c.toUpperCase());
  }
  // Capitaliza solo la primera letra (para chips de fecha: "hoy"→"Hoy", "vie 16"→"Vie 16").
  function capPrimera(s){ s=String(s||""); return s?s.charAt(0).toUpperCase()+s.slice(1):s; }
  function pintarHomeEncabezado(){
    const primer=((SESION&&SESION.nombre)||"").trim().split(/\s+/)[0]||"";
    const h=new Date().getHours();
    $("#homeSaludo").innerHTML=primer?`¡Hola, <span class="h2Name">${escapeHtml(primer)}</span>!`:"¡Hola!";
    $("#homeDaypart").textContent=h<12?"Buenos días":(h<19?"Buenas tardes":"Buenas noches");
    const grado=gradoDeSesion();
    $("#homeGrade").textContent=grado||"";
    $("#homeGrade").classList.toggle("hidden",!grado);
  }
  function pintarHomeStats(){
    const box=$("#homeStats"); if(!box) return;
    const racha=Number((SESION&&SESION.racha)||0);
    const energia=homeEnergiaPct();
    const pendientes=TAREAS.filter(t=>!t.hecha).length;
    const items=[{icon:"racha",value:racha,label:racha===1?"día de racha":"días de racha"}];
    if(energia!==null) items.push({icon:"energia",value:`${energia}%`,label:"energía"});
    items.push({icon:"tarea",value:pendientes,label:pendientes===1?"meta activa":"metas activas"});
    const STAT_IMG={racha:"racha",energia:"energia",tarea:"metas"};   // íconos 3D en assets/stats/
    box.dataset.count=String(items.length);
    box.innerHTML=items.map(x=>`<div class="h2Stat h2Stat--${x.icon}"><span class="h2StatIcon"><img src="assets/stats/${STAT_IMG[x.icon]||"metas"}.png" alt="" aria-hidden="true"></span><span class="h2StatMeta"><span class="h2StatValue">${x.value}</span><span class="h2StatLabel">${x.label}</span></span></div>`).join("");
  }
  function pintarHomeMore(){
    const more=$("#homeMore"); if(!more) return;
    const body=more.querySelector(".h2MoreBody");
    const tieneContenido=body&&Array.from(body.children).some(el=>{
      if(el.hidden||el.classList.contains("hidden")) return false;
      if(el.id==="novedadesWrap"||el.id==="notasInicio"||el.id==="efemeride") return el.childElementCount>0;
      return !!el.querySelector("button:not(.hidden),a:not(.hidden)")||el.childElementCount>0||el.textContent.trim().length>0;
    });
    more.classList.toggle("hidden",!tieneContenido);
    if(!tieneContenido) more.open=false;
  }
  function pintarHomeContinue(){
    const cont=$("#homeContinue"); if(!cont) return; cont.innerHTML="";
    const materias=homeMaterias(), hoy=new Date().getDay(), diaHorario=(hoy>=1&&hoy<=5)?hoy:proximoDiaEscolar().dia;
    const elegidas=[], vistas=new Set();
    const agregar=m=>{ if(!m) return; const k=norm(m.nombre); if(vistas.has(k)||elegidas.length>=3) return; vistas.add(k); elegidas.push(m); };
    materias.map(m=>({m,p:progresoMateria(m)})).filter(x=>x.p&&x.p.done>0&&x.p.done<x.p.total)
      .sort((a,b)=>b.p.pct-a.p.pct).forEach(x=>agregar(x.m));
    HORARIO.filter(h=>h.dia===diaHorario&&esMateriaAula(h.materia)).sort((a,b)=>(a.orden||0)-(b.orden||0))
      .forEach(h=>agregar(materias.find(m=>norm(m.nombre)===norm(h.materia))));
    materias.forEach(agregar);
    if(!elegidas.length){
      const p=document.createElement("p"); p.className="h2Empty"; p.textContent="Tus materias aparecerán aquí cuando estén disponibles.";
      cont.appendChild(p);
      return;
    }
    const principal=elegidas[0], progreso=progresoMateria(principal), nombre=capMateria(limpiaNombreMateria(principal.nombre)), visual=homeMateriaVisual(principal.nombre);
    const destacado=document.createElement("button"); destacado.type="button"; destacado.className="h3ContinuePrimary";
    destacado.style.setProperty("--subject",visual.color); destacado.dataset.subjectKind=visual.key;
    destacado.innerHTML=`${homeMarcaMateria(principal.nombre,"h3ContinueIcon")}<span class="h3ContinueCopy"><small>Para continuar</small><b>${escapeHtml(nombre)}</b><span>${progreso?`${progreso.done} de ${progreso.total} temas practicados`:"Materia disponible"}</span>${progreso?`<i><em style="width:${progreso.pct}%"></em></i>`:""}</span><span class="h3ContinueAction">Continuar ${homeIcono("flecha")}</span>`;
    destacado.onclick=()=>irAPractica(principal.nombre); cont.appendChild(destacado);
    if(elegidas.length>1){
      const secundarios=document.createElement("div"); secundarios.className="h3ContinueSecondary";
      elegidas.slice(1,3).forEach(m=>{
        const p=progresoMateria(m), v=homeMateriaVisual(m.nombre), b=document.createElement("button"); b.type="button"; b.className="h3ContinueMini";
        b.style.setProperty("--subject",v.color); b.dataset.subjectKind=v.key;
        b.innerHTML=`${homeMarcaMateria(m.nombre,"h3ContinueMiniIcon")}<span><b>${escapeHtml(capMateria(limpiaNombreMateria(m.nombre)))}</b><small>${p?`${p.done} de ${p.total} temas`:"Materia disponible"}</small></span>${homeIcono("flecha")}`;
        b.onclick=()=>irAPractica(m.nombre); secundarios.appendChild(b);
      });
      cont.appendChild(secundarios);
    }
  }
  function homeFilaTarea(t){
    const row=document.createElement("div"); row.className="h2TodayRow h2TodayRow--task"+(t.hecha?" is-done":"");
    const materia=capMateria(limpiaNombreMateria(t.materia||""))||"General";
    const visual=homeMateriaVisual(materia); row.style.setProperty("--subject",visual.color);
    row.dataset.subjectKind=visual.key;
    row.innerHTML=`${homeMarcaMateria(materia,"h2SubjectMark")}<span class="h2TodayText"><b>${escapeHtml(t.descripcion||"Tarea")}</b><small>${escapeHtml(materia)}${t.fecha?` · ${escapeHtml(capPrimera(fechaBonita(t.fecha)))}`:""}</small></span><button class="h2TaskCheck" type="button" aria-label="${t.hecha?"Marcar como pendiente":"Marcar como completada"}"><span class="h2TaskBox">${t.hecha?"✓":""}</span></button>`;
    row.querySelector(".h2TaskCheck").onclick=async()=>{
      t.hecha=!t.hecha; pintarTareas(); pintarEscritorio();
      try{ await apiAgenda({accion:"tarea_hecha",id:t.id,hecha:t.hecha}); }catch(_){}
    };
    return row;
  }
  function pintarHomeUpcoming(){
    const box=$("#homeUpcoming"); if(!box) return; box.innerHTML="";
    const visiblesHoy=new Set(homePendientesHoy().slice(0,2).map(homeTareaKey));
    const items=TAREAS.filter(t=>!t.hecha&&t.fecha&&!visiblesHoy.has(homeTareaKey(t))).map(t=>({t,n:diasHasta(t.fecha)}))
      .filter(x=>x.n!==null&&x.n>0).sort((a,b)=>a.n-b.n);
    const verAgenda=$("#btnHomeVerAgenda"); if(verAgenda) verAgenda.classList.toggle("hidden",items.length<=2);
    if(!items.length){
      box.innerHTML='<div class="h2UpcomingEmpty"><b>No tienes entregas próximas</b><span>Tu agenda está tranquila por ahora.</span></div>';
      return;
    }
    items.slice(0,2).forEach(({t})=>{
      const [y,m,d]=t.fecha.slice(0,10).split("-").map(Number);
      const card=document.createElement("button"), visual=homeMateriaVisual(t.materia||t.tipo||""); card.type="button"; card.className="h2UpcomingCard";
      card.style.setProperty("--subject",visual.color); card.dataset.subjectKind=visual.key;
      card.innerHTML=`<span class="h2DateTile"><small>${escapeHtml(MESES[m-1].slice(0,3))}</small><b>${d}</b></span>${homeMarcaMateria(t.materia||t.tipo||"","h2UpcomingMark")}<span class="h2UpcomingText"><b>${escapeHtml(t.descripcion||"Entrega")}</b><small>${escapeHtml(capMateria(limpiaNombreMateria(t.materia||""))||"General")} · ${escapeHtml(capPrimera(fechaBonita(t.fecha)))}</small></span>`;
      card.onclick=()=>verTab("agenda");
      box.appendChild(card);
    });
  }
  function pintarHomeProgreso(){
    const box=$("#homeProgress"); if(!box) return;
    let total=0; homeMaterias().forEach(m=>{ total+=temasPracticables(m).length; });
    let dominados=0; PROGRESO.forEach(p=>{ if(p&&typeof p.quizMejor==="number"&&p.quizMejor>=.8) dominados++; });
    if(total) dominados=Math.min(dominados,total);
    const pct=total?Math.round(dominados/total*100):0;
    box.innerHTML=`<div class="h2ProgressHead"><h2 id="homeProgresoTit">Tu progreso</h2><span>Progreso académico</span></div><div class="h3AcademicProgress"><div><b>${dominados}</b><small>temas dominados</small></div><div><b>${total}</b><small>temas disponibles</small></div><div><b>${pct}%</b><small>del recorrido</small></div></div><span class="h3AcademicBar"><i style="width:${pct}%"></i></span>`;
  }
  function pintarHomeMaterias(){
    const box=$("#homeSubjects"); if(!box) return; box.innerHTML="";
    const materias=homeMaterias().slice(0,6);
    if(!materias.length){ box.innerHTML='<p class="h2Empty">Tus materias aparecerán aquí cuando estén disponibles.</p>'; return; }
    materias.forEach(m=>{
      const p=progresoMateria(m), v=homeMateriaVisual(m.nombre);
      const card=document.createElement("button"); card.type="button"; card.className="h2SubjectCard";
      card.style.setProperty("--subject",v.color); card.dataset.subjectKind=v.key;
      card.innerHTML=`<span class="h2SubjectIcon"><img src="assets/materias/${v.img}.png" alt="" aria-hidden="true"></span><b>${escapeHtml(capMateria(limpiaNombreMateria(m.nombre)))}</b><small>${p?`${p.done} de ${p.total} temas`:"Disponible"}</small>${p?`<span class="h2SubjectBar"><i style="width:${p.pct}%"></i></span>`:""}`;
      card.onclick=()=>abrirMateria(m);
      box.appendChild(card);
    });
  }
  function pintarEscritorio(){
    const d=new Date();
    const f=`${DIAS_NOM[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
    $("#fechaHoy").textContent=f[0].toUpperCase()+f.slice(1);
    pintarHomeEncabezado();
    pintarEnergiaIA();
    pintarHomeStats();
    cargarEfemerides().then(()=>{ pintarEfemeride(); pintarHomeMore(); });
    pintarExamenBanner();
    pintarNovedadesInicio();
    pintarHorarioInicio();
    pintarTareasResumen();
    pintarHomeContinue();
    pintarHomeUpcoming();
    pintarNotasInicio();
    pintarHomeProgreso();
    pintarHomeMaterias();
    pintarHomeMore();
  }

  // "Un día como hoy": efeméride del día (archivo estático curado, cacheado offline por el SW).
  let EFEMERIDES=null;
  async function cargarEfemerides(){
    if(EFEMERIDES) return EFEMERIDES;
    try{ const r=await fetch("/un-dia-como-hoy.json"); EFEMERIDES=await r.json(); }
    catch(_){ EFEMERIDES={}; }
    return EFEMERIDES;
  }

  // Batería de "energía de IA": muestra cuánto del cupo diario de IA le queda al alumno.
  // Se oculta si es ilimitado (hijas/elegidos) o si no se conoce el presupuesto.
  function pintarEnergiaIA(){
    const box=$("#energiaIA"); if(!box) return;
    // cuenta gratis: no genera con IA → el medidor de energía no aplica
    if(SESION && SESION.plan==="gratis"){ box.classList.add("hidden"); box.innerHTML=""; return; }
    const e=IA_ESTADO;
    if(!e || e.ilimitado || !e.limite){ box.classList.add("hidden"); box.innerHTML=""; return; }
    const pct=Math.max(0, Math.min(100, Math.round((e.restante/e.limite)*100)));
    const nivel = pct<=0 ? "vacio" : pct<=20 ? "bajo" : pct<=50 ? "medio" : "alto";
    const estado = pct<=0 ? "agotada" : pct<=20 ? "poca" : pct<=50 ? "a mitad" : "con energía";
    const msg = pct<=0 ? "Se agotó por hoy 🌙 ¡Mañana se recarga! Mientras, tienes las guías 📗 y lo ya practicado."
      : pct<=20 ? "Te queda poca energía de IA por hoy" : "Energía de IA para practicar hoy";
    box.innerHTML=`<div class="enIn en-${nivel}"><div class="enIco">⚡</div>`+
      `<div class="enBody"><div class="enTop"><span class="enTit">Tu energía de IA</span><span class="enState">${estado}</span></div>`+
      `<div class="enMeter"><i style="width:${pct}%"></i></div><p class="enMsg">${msg}</p></div></div>`;
    box.classList.remove("hidden");
  }
  function pintarEfemeride(){
    const box=$("#efemeride"); if(!box) return;
    const d=new Date();
    const key=String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const e=EFEMERIDES&&EFEMERIDES[key];
    if(!e||!e.texto){ box.classList.add("hidden"); box.innerHTML=""; return; }
    const anio=e.anio?`En ${escapeHtml(String(e.anio))}, `:"";
    // Chispa 2.0: tarjeta blanca + placa de ilustración. El emoji viene del DATO del día
    // (no es iconografía de UI), por eso se presenta dentro de una placa tintada.
    box.innerHTML=`<div class="h3MoreCard"><div class="h3Efe"><span class="h3EfeArt">${escapeHtml(e.emoji||"✨")}</span><span class="h3EfeTx"><small>Un día como hoy</small><p>${anio}${escapeHtml(e.texto)}</p></span></div></div>`;
    box.classList.remove("hidden");
  }
  // Misión principal de Inicio: resume una acción real (no copia el título de agenda).
  // Prioriza un examen, luego una entrega y por último una materia real de la sesión.
  // Un examen de HOY se oculta a partir de CORTE_MANANA (1 PM, hora del aparato):
  // pasada la mañana escolar se asume presentado y se pasa a mostrar el día siguiente.
  const CORTE_MANANA = 13; // hora local a partir de la cual un examen de hoy ya no se recuerda
  function pintarExamenBanner(){
    const box=$("#examenBanner"); if(!box) return; box.innerHTML="";
    const horaLocal=new Date().getHours();
    const examenes=TAREAS.filter(t=>t.tipo==="examen" && !t.hecha && t.fecha)
      .map(t=>({t,n:diasHasta(t.fecha)}))
      .filter(x=>x.n!==null && x.n>=0 && x.n<=3 && (x.n>0 || horaLocal<CORTE_MANANA))
      .sort((a,b)=>a.n-b.n);
    const entregas=TAREAS.filter(t=>t.tipo!=="examen" && !t.hecha && t.fecha)
      .map(t=>({t,n:diasHasta(t.fecha)})).filter(x=>x.n!==null && x.n>=0).sort((a,b)=>a.n-b.n);
    const materias=homeMaterias();
    const materiaSugerida=materias.find(m=>{ const p=progresoMateria(m); return p&&p.done>0&&p.done<p.total; })||materias[0]||null;

    let titulo="Todo está tranquilo por ahora.";
    let texto="Puedes revisar tu agenda cuando quieras.";
    let accionTexto="Ver agenda";
    let accion=()=>verTab("materias");

    if(examenes.length){
      const min=examenes[0].n, dia=examenes.filter(x=>x.n===min);
      const cuando=min===0?"hoy":(min===1?"mañana":`en ${min} días`);
      const primera=dia[0].t, materia=capMateria(limpiaNombreMateria(primera.materia||""))||"tu materia";
      titulo=dia.length===1?`Prepárate para ${materia}`:`Prepárate para ${dia.length} exámenes`;
      texto=dia.length===1?`El examen es ${cuando}.`:`Los exámenes son ${cuando}.`;
      accionTexto="Practicar";
      accion=()=>irAPractica(primera.materia,"examen");
    }else if(entregas.length){
      const proxima=entregas[0].t, cuando=fechaBonita(proxima.fecha);
      const materia=capMateria(limpiaNombreMateria(proxima.materia||""));
      titulo=materia?`Revisa tu pendiente de ${materia}`:"Revisa tu próximo pendiente";
      texto=cuando?`Está previsto para ${cuando}.`:"Está guardado en tu agenda.";
      accionTexto="Ver agenda";
      accion=()=>verTab("agenda");
    }else if(materiaSugerida){
      const p=progresoMateria(materiaSugerida), nombre=capMateria(limpiaNombreMateria(materiaSugerida.nombre));
      titulo=p&&p.done>0?`Continúa avanzando con ${nombre}`:`Empieza hoy con ${nombre}`;
      texto=p?`Ya recorriste ${p.done} de ${p.total} temas.`:"Tu materia está lista para practicar.";
      accionTexto=p&&p.done>0?"Continuar":"Empezar";
      accion=()=>irAPractica(materiaSugerida.nombre);
    }else{
      accion=()=>verTab("agenda");
    }

    const card=document.createElement("article"); card.className="h2Mission";
    card.innerHTML=`<div class="h2MissionContent"><p class="h2MissionEyebrow">Tu misión de hoy</p><h2>${escapeHtml(titulo)}</h2><p>${escapeHtml(texto)}</p><button class="h2MissionAction" type="button">${escapeHtml(accionTexto)} ${homeIcono("flecha")}</button></div><img class="h2MissionArt" src="assets/hero/libro.png" alt="" aria-hidden="true">`;
    card.querySelector(".h2MissionAction").onclick=accion;
    box.appendChild(card);
  }
  function pintarHorarioInicio(){
    const {dia,titulo}=proximoDiaEscolar();
    $("#horarioTit").textContent=titulo;
    const cont=$("#horarioChips"); cont.innerHTML="";
    const del=HORARIO.filter(h=>h.dia===dia).sort((a,b)=>(a.orden||0)-(b.orden||0));
    if(!del.length){
      const p=document.createElement("p"); p.className="h3MoreEmpty";
      p.textContent=HORARIO.length ? "No anotaste materias para ese día." : "Configura tu horario una sola vez y te diré qué toca cada día.";
      cont.appendChild(p);
      if(!HORARIO.length){
        const b=document.createElement("button"); b.type="button"; b.className="h2TextAction"; b.style.padding="8px 0";
        b.textContent="Configurar mi horario";
        b.onclick=()=>{ verTab("agenda"); abrirEditorHorario(); };
        cont.appendChild(b);
      }
      return;
    }
    const chips=cont;   // Chispa 2.0: los chips van directo en .h3MoreChips
    del.forEach(h=>{
      const enAula=esMateriaAula(h.materia);
      // materia del aula → botón que lleva a practicar; propia (caligrafía…) → chip simple
      const v=homeMateriaVisual(h.materia);
      const b=document.createElement(enAula?"button":"span");
      b.className="h3Chip"+(enAula?" h3Chip--go":""); b.style.setProperty("--tone",v.color);
      if(enAula) b.type="button";
      b.innerHTML=`<i></i><span>${escapeHtml(capMateria(limpiaNombreMateria(h.materia)))}</span>`;
      if(enAula) b.onclick=()=>irAPractica(h.materia);
      chips.appendChild(b);
    });
    if(del.some(h=>esMateriaAula(h.materia))){
      const hint=document.createElement("p"); hint.className="h3MoreEmpty"; hint.style.width="100%"; hint.style.marginTop="2px";
      hint.textContent="Toca una materia para repasarla.";
      cont.appendChild(hint);
    }
  }
  function pintarTareasResumen(){
    const cont=$("#tareasResumen"); cont.innerHTML="";
    const tareasHoy=homePendientesHoy();
    tareasHoy.slice(0,2).forEach(t=>cont.appendChild(homeFilaTarea(t)));
    const verAgenda=$("#btnVerAgenda"); if(verAgenda) verAgenda.classList.toggle("hidden",tareasHoy.length<=2);
    cont.classList.toggle("is-empty", !tareasHoy.length);   // vacío = fila ligera, no card grande (#4)
    if(!cont.children.length){
      const p=document.createElement("p"); p.className="h2Empty h2Empty--positive"; p.textContent="Todo al día por ahora.";
      cont.appendChild(p);
    }
  }
  // ir a practicar una materia (desde el horario o el aviso de examen)
  function irAPractica(nombreMateria, modo){
    const m=((SESION&&SESION.materias)||[]).find(x=>norm(x.nombre)===norm(nombreMateria||""));
    verTab("materias");
    if(m){ abrirMateria(m); if(modo) setModo(modo); }
  }
  $("#btnVerAgenda").onclick=()=>verTab("agenda");
  $("#btnNuevaTareaHome").onclick=()=>{ verTab("agenda"); abrirFormTarea(); };
  $("#btnHomeVerAgenda").onclick=()=>verTab("agenda");
  $("#btnHomeVerMaterias").onclick=()=>verTab("materias");

  // ───────── tareas (pestaña Agenda) ─────────
  const TIPO_ICON={tarea:"📝",trabajo:"📚",examen:"📋"};
  function filaTarea(t, mini){
    const div=document.createElement("div"); div.className="tarea"+(t.hecha?" hecha":"");
    const n=diasHasta(t.fecha);
    const vencida=!t.hecha && n!==null && n<0;
    const fecha=t.fecha?`<span class="tFechaBadge${vencida?" vencida":""}">${vencida?"⏰ venció":escapeHtml(fechaBonita(t.fecha))}</span>`:"";
    div.innerHTML=`<button class="tCheck" aria-label="Marcar como hecha">${t.hecha?"✅":"⬜"}</button>
      <div class="tBody"><p class="tDescTxt">${escapeHtml(t.descripcion)}</p>
      <p class="tMeta">${TIPO_ICON[t.tipo]||"📝"} ${escapeHtml(limpiaNombreMateria(t.materia||"")||"General")} ${fecha}</p></div>
      ${mini?"":`<button class="tBorrar" aria-label="Borrar">×</button>`}`;
    div.querySelector(".tCheck").onclick=async()=>{
      t.hecha=!t.hecha; pintarTareas(); pintarEscritorio();
      try{ await apiAgenda({accion:"tarea_hecha", id:t.id, hecha:t.hecha}); }catch(_){}
    };
    const del=div.querySelector(".tBorrar");
    if(del) del.onclick=async()=>{
      TAREAS=TAREAS.filter(x=>x!==t); pintarTareas(); pintarEscritorio();
      try{ await apiAgenda({accion:"tarea_borrar", id:t.id}); }catch(_){}
    };
    return div;
  }
  function pintarTareas(){
    const cont=$("#tareasList"); if(!cont) return; cont.innerHTML="";
    if(!TAREAS.length){
      cont.innerHTML=`<p class="wVacio">Anota aquí lo que te manden: tareas, trabajos y fechas de exámenes. Te lo recordamos en Inicio. 📌</p>`;
      return;
    }
    const pend=TAREAS.filter(t=>!t.hecha), listas=TAREAS.filter(t=>t.hecha);
    pend.forEach(t=>cont.appendChild(filaTarea(t)));
    if(listas.length){
      const h=document.createElement("p"); h.className="lblMini"; h.textContent=`Hechas (${listas.length})`; cont.appendChild(h);
      listas.slice(0,10).forEach(t=>cont.appendChild(filaTarea(t)));
    }
  }
  let tipoSel="tarea", tMatSel="";
  function abrirFormTarea(){
    $("#formTarea").classList.remove("hidden");
    $("#tDesc").value=""; $("#tFecha").value=""; tipoSel="tarea"; tMatSel=""; $("#tMsg").innerHTML="";
    montarSelectorMateria($("#tMaterias"), ()=>tMatSel, v=>{ tMatSel=v; });
    document.querySelectorAll("#tTipos .chip").forEach(c=>c.setAttribute("aria-pressed", String(c.dataset.tipo==="tarea")));
    $("#tDesc").focus();
  }
  $("#btnNuevaTarea").onclick=abrirFormTarea;
  $("#btnCancelarTarea").onclick=()=>$("#formTarea").classList.add("hidden");
  document.querySelectorAll("#tTipos .chip").forEach(b=>{
    b.onclick=()=>{ tipoSel=b.dataset.tipo;
      document.querySelectorAll("#tTipos .chip").forEach(c=>c.setAttribute("aria-pressed", String(c===b))); };
  });
  $("#btnGuardarTarea").onclick=async()=>{
    const desc=$("#tDesc").value.trim(); if(!desc){ $("#tDesc").focus(); return; }
    const btn=$("#btnGuardarTarea"); btn.disabled=true; $("#tMsg").innerHTML="";
    try{
      const d=await apiAgenda({accion:"tarea_guardar", tarea:{descripcion:desc, materia:tMatSel, tipo:tipoSel, fecha:$("#tFecha").value||null}});
      if(!d || !d.ok || !d.tarea) throw new Error((d&&d.error)||"no se pudo guardar");
      TAREAS.unshift(d.tarea);
      $("#formTarea").classList.add("hidden");
      pintarTareas(); pintarEscritorio();
    }catch(e){
      $("#tMsg").innerHTML=`<p class="wVacio" style="color:var(--bad)">No se pudo guardar. Revisa tu conexión e intenta de nuevo.</p>`;
    }finally{ btn.disabled=false; }
  };

  // ───────── horario: vista semanal + editor ─────────
  const DIAS_CORT=["","Lunes","Martes","Miércoles","Jueves","Viernes"];
  function pintarHorarioSemana(){
    const cont=$("#horarioSemana"); if(!cont) return; cont.innerHTML="";
    if(!HORARIO.length){
      cont.innerHTML=`<p class="wVacio">Aún no configuraste tu horario. Toca "Editar" y lo armas en 2 minutos (una sola vez).</p>`;
      return;
    }
    for(let d=1; d<=5; d++){
      const del=HORARIO.filter(h=>h.dia===d).sort((a,b)=>(a.orden||0)-(b.orden||0));
      const row=document.createElement("div"); row.className="hsRow";
      row.innerHTML=`<span class="hsDia">${DIAS_CORT[d]}</span><span class="hsMats">${del.length?del.map(h=>escapeHtml(limpiaNombreMateria(h.materia))).join(" · "):"—"}</span>`;
      cont.appendChild(row);
    }
  }
  // materias base (del aula) + las "propias" que el niño agregó (caligrafía, lectura…)
  function materiasBase(){ return ((SESION&&SESION.materias)||[]).map(m=>m.nombre); }
  function esMateriaAula(nombre){ return materiasBase().some(x=>norm(x)===norm(nombre)); }
  function unicasPorNombre(lista){
    const seen=new Set(), out=[];
    lista.forEach(n=>{ const k=norm(n); if(n && !seen.has(k)){ seen.add(k); out.push(n); } });
    return out;
  }
  // materias propias ya guardadas (aparecen en el horario pero no vienen del aula)
  function materiasExtraGuardadas(){
    const base=materiasBase().map(norm);
    return unicasPorNombre(HORARIO.map(h=>h.materia).filter(m=>m && !base.includes(norm(m))));
  }
  // pool completo de materias para los formularios (aula + propias)
  function materiasParaFormularios(){ return unicasPorNombre([...materiasBase(), ...materiasExtraGuardadas()]); }

  // Selector de materia compacto (elige UNA): por defecto un solo botón; al tocarlo
  // abre los chips (con ícono/color); al elegir se cierra mostrando la materia elegida.
  // getSel/setSel leen y escriben la variable de selección del formulario que lo use.
  function montarSelectorMateria(cont, getSel, setSel){
    if(!cont) return;
    cont.innerHTML=""; cont.className="selMat";
    const toggle=document.createElement("button"); toggle.type="button"; toggle.className="selMatBtn";
    const panel=document.createElement("div"); panel.className="selMatPanel hidden";
    function pintarToggle(){
      const sel=getSel(), abierto=!panel.classList.contains("hidden");
      const etiqueta = sel
        ? `<span class="selMatCur" style="--c:${homeMateriaVisual(sel).color}"><i class="matDot"></i>${escapeHtml(capMateria(limpiaNombreMateria(sel)))}</span>`
        : `<span class="selMatPh">📚 Elegir materia</span>`;
      toggle.innerHTML = etiqueta + `<span class="selMatCar" aria-hidden="true"></span>`;
      toggle.classList.toggle("abierto", abierto);
      toggle.setAttribute("aria-expanded", String(abierto));
    }
    function abrir(v){ panel.classList.toggle("hidden", !v); pintarToggle(); }
    toggle.onclick=()=>abrir(panel.classList.contains("hidden"));
    materiasParaFormularios().forEach(nombre=>{
      const b=document.createElement("button"); b.type="button"; b.className="chip";
      b.style.setProperty("--c", homeMateriaVisual(nombre).color);
      b.innerHTML=`<i class="matDot"></i>${escapeHtml(capMateria(limpiaNombreMateria(nombre)))}`;
      b.setAttribute("aria-pressed", String(getSel()===nombre));
      b.onclick=()=>{
        const nuevo = getSel()===nombre ? "" : nombre; setSel(nuevo);
        panel.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed", String(c===b && !!nuevo)));
        pintarToggle(); abrir(false);
      };
      panel.appendChild(b);
    });
    cont.appendChild(toggle); cont.appendChild(panel);
    pintarToggle();
  }

  let EDIT_HORARIO=null, EDIT_DIA=1, EDIT_EXTRAS=[];   // {1:[nombres],…5:[…]} + día activo + propias nuevas
  function poolEditor(){ return unicasPorNombre([...materiasBase(), ...materiasExtraGuardadas(), ...EDIT_EXTRAS]); }
  function abrirEditorHorario(){
    EDIT_HORARIO={};
    for(let d=1; d<=5; d++) EDIT_HORARIO[d]=HORARIO.filter(h=>h.dia===d).sort((a,b)=>(a.orden||0)-(b.orden||0)).map(h=>h.materia);
    EDIT_DIA=1; EDIT_EXTRAS=[];
    $("#horarioEditor").classList.remove("hidden");
    renderEditorHorario();
    $("#horarioEditor").scrollIntoView({behavior:"smooth", block:"start"});
  }
  function renderEditorHorario(){
    const cont=$("#horarioEditorDias"); cont.innerHTML="";
    // 1) selector de día (pills) — se ve UN día a la vez, con contador de materias
    const sel=document.createElement("div"); sel.className="heDiaSel";
    for(let d=1; d<=5; d++){
      const cnt=(EDIT_HORARIO[d]||[]).length;
      const b=document.createElement("button"); b.className="heDiaPill"+(d===EDIT_DIA?" on":"");
      b.innerHTML=`${DIAS_CORT[d].slice(0,3)}${cnt?`<span class="hePillN">${cnt}</span>`:""}`;
      b.onclick=()=>{ EDIT_DIA=d; renderEditorHorario(); };
      sel.appendChild(b);
    }
    cont.appendChild(sel);
    // 2) guía del día
    const sub=document.createElement("p"); sub.className="ayuda";
    sub.textContent=`Toca las materias del ${DIAS_CORT[EDIT_DIA].toLowerCase()}, en el orden en que las tienes. Toca de nuevo para quitarla.`;
    cont.appendChild(sub);
    // 3) chips SOLO del día elegido
    const chips=document.createElement("div"); chips.className="chips heChips";
    poolEditor().forEach(nombre=>{
      const dia=EDIT_HORARIO[EDIT_DIA];
      const i=dia.indexOf(nombre);
      const b=document.createElement("button"); b.className="chip";
      b.setAttribute("aria-pressed", String(i>=0));
      b.style.setProperty("--c", homeMateriaVisual(nombre).color);
      b.innerHTML=`${i>=0?`<span class="chipN">${i+1}º</span>`:""}<i class="matDot"></i>${escapeHtml(capMateria(limpiaNombreMateria(nombre)))}`;
      b.onclick=()=>{ const j=dia.indexOf(nombre); if(j>=0) dia.splice(j,1); else dia.push(nombre); renderEditorHorario(); };
      chips.appendChild(b);
    });
    cont.appendChild(chips);
    // 4) agregar una materia propia (no está en el aula: caligrafía, lectura…)
    const addLbl=document.createElement("p"); addLbl.className="heAddLbl";
    addLbl.textContent="¿Falta una materia? (caligrafía, lectura…)";
    cont.appendChild(addLbl);
    const add=document.createElement("div"); add.className="heAdd";
    const inp=document.createElement("input"); inp.type="text"; inp.maxLength=40;
    inp.placeholder="Escribe el nombre"; inp.autocapitalize="characters";
    const btn=document.createElement("button"); btn.className="heAddBtn"; btn.textContent="＋ Agregar";
    const agregar=()=>{
      const v=inp.value.trim(); if(!v) return;
      const V=v.toUpperCase();                        // en MAYÚSCULAS, como las demás
      if(!poolEditor().some(x=>norm(x)===norm(V))) EDIT_EXTRAS.push(V);
      const dia=EDIT_HORARIO[EDIT_DIA];
      if(!dia.some(x=>norm(x)===norm(V))) dia.push(V); // la suma directo al día actual
      inp.value=""; renderEditorHorario();
    };
    btn.onclick=agregar;
    inp.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); agregar(); } });
    add.appendChild(inp); add.appendChild(btn); cont.appendChild(add);
  }
  $("#btnEditarHorario").onclick=()=>{ verTab("agenda"); abrirEditorHorario(); };
  $("#btnEditarHorario2").onclick=abrirEditorHorario;
  $("#btnCancelarHorario").onclick=()=>$("#horarioEditor").classList.add("hidden");
  $("#btnGuardarHorario").onclick=async()=>{
    const items=[];
    for(let d=1; d<=5; d++) (EDIT_HORARIO && EDIT_HORARIO[d] || []).forEach((m,i)=>items.push({dia:d, materia:m, orden:i+1}));
    const btn=$("#btnGuardarHorario"); btn.disabled=true; const txt=btn.textContent; btn.textContent="Guardando…";
    try{
      const d=await apiAgenda({accion:"horario_set", items});
      if(!d || !d.ok) throw new Error((d&&d.error)||"no se pudo");
      HORARIO=items.map(x=>({...x}));
      $("#horarioEditor").classList.add("hidden");
      btn.textContent=txt;
      pintarHorarioSemana(); pintarEscritorio();
    }catch(e){
      btn.textContent="No se pudo 😕 Reintenta";
      setTimeout(()=>{ btn.textContent=txt; }, 2500);
    }finally{ btn.disabled=false; }
  };

  // ───────── novedades del aula (🆕, sin servidor) ─────────
  // Compara los módulos del aula contra el último snapshot visto en este aparato:
  // módulo nuevo o archivo más reciente → 🆕 en la materia y lista en el escritorio.
  // La "foto" de lo último visto vive POR USUARIO en el servidor (usuarios.aula_snap), no por
  // aparato: así la alerta 🆕 es igual en PC y celular y se apaga en TODOS lados al abrir la
  // materia. Además solo cuentan novedades de los últimos NOV_MAX_DIAS (por fecha del aula),
  // para que ninguna quede pegada indefinidamente. Se marca visto al ABRIR la materia.
  let NOVEDADES={};                       // materiaId → [{tema, nombre}]
  let AULA_SNAP={};                       // { materiaId: { moduloId: ts } } — cargado del servidor
  const NOV_MAX_DIAS=7;
  function snapDeMateria(m){
    const out={};
    (m.temas||[]).forEach(t=>(t.modulos||[]).forEach(mod=>{
      let mx=0; (mod.archivos||[]).forEach(f=>{ if((f.modificado||0)>mx) mx=f.modificado; });
      out[mod.id]=mx;
    }));
    return out;
  }
  async function cargarAulaSnap(){
    AULA_SNAP={};
    if(!SESION || SESION.id==null) return;
    try{
      const r=await fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"aula_snap_get",usuario_id:SESION.id})});
      const d=await r.json().catch(()=>null);
      AULA_SNAP=(d && d.snap && typeof d.snap==="object" && !Array.isArray(d.snap)) ? d.snap : {};
    }catch(_){ AULA_SNAP={}; }
  }
  function guardarAulaSnap(){
    if(!SESION || SESION.id==null) return;
    try{ fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"aula_snap_set",usuario_id:SESION.id,snap:AULA_SNAP})}); }catch(_){}
  }
  function detectarNovedades(){
    if(!SESION || !Array.isArray(SESION.materias)) return;
    NOVEDADES={};
    let base=false;
    const corte=(Date.now()/1000)-NOV_MAX_DIAS*86400;   // las fechas del aula (Moodle) van en segundos
    SESION.materias.forEach(m=>{
      if(m.id==null) return;
      const nuevo=snapDeMateria(m);
      const viejo=AULA_SNAP[m.id];
      if(!viejo){ AULA_SNAP[m.id]=nuevo; base=true; return; }   // primera vez: base silenciosa
      const items=[];
      (m.temas||[]).forEach(t=>(t.modulos||[]).forEach(mod=>{
        if(mod.tipo==="label"||mod.tipo==="subsection") return;
        const ts=nuevo[mod.id]||0;
        const cambio=!(mod.id in viejo) || ts>(viejo[mod.id]||0);
        const reciente=ts===0 ? true : ts>=corte;   // sin fecha (módulo sin archivo) → cuenta como nuevo
        if(cambio && reciente) items.push({tema:t.seccion||"", nombre:mod.nombre||""});
      }));
      if(items.length) NOVEDADES[m.id]=items;
    });
    if(base) guardarAulaSnap();   // primera vez / materia nueva → guarda la base en el servidor
  }
  function marcarAulaVista(m){
    if(!m || m.id==null || !NOVEDADES[m.id]) return;
    AULA_SNAP[m.id]=snapDeMateria(m);
    guardarAulaSnap();                             // se apaga en todos los aparatos
    delete NOVEDADES[m.id];
    gridMaterias((SESION&&SESION.materias)||[]);   // quita el 🆕 para cuando vuelva
  }
  function pintarNovedadesInicio(){
    const box=$("#novedadesWrap"); if(!box) return; box.innerHTML="";
    const ids=Object.keys(NOVEDADES); if(!ids.length) return;
    const w=document.createElement("div"); w.className="h3MoreCard";
    w.innerHTML=`<div class="h3MoreHead"><span class="h3MoreMark">${homeIcono("novedad")}</span><h3>Nuevo en tu aula</h3></div>`;
    ids.forEach(id=>{
      const m=((SESION&&SESION.materias)||[]).find(x=>String(x.id)===String(id)); if(!m) return;
      const items=NOVEDADES[id];
      const v=homeMateriaVisual(m.nombre);
      const b=document.createElement("button"); b.type="button"; b.className="h3MoreRow h3MoreRow--inCard";
      b.style.setProperty("--tone",v.color);
      const detalle=items.slice(0,2).map(i=>escapeHtml(i.nombre)).join(" · ")+(items.length>2?` · y ${items.length-2} más`:"");
      b.innerHTML=`${homeMarcaMateria(m.nombre,"h3MoreRowIcon")}<span class="h3MoreRowTx"><b>${escapeHtml(capMateria(limpiaNombreMateria(m.nombre)))} · ${items.length} ${items.length===1?"novedad":"novedades"}</b><small>${detalle}</small></span>${homeIcono("flecha")}`;
      b.onclick=()=>{ verTab("materias"); abrirMateria(m); };
      w.appendChild(b);
    });
    box.appendChild(w);
  }

  // ───────── notas de exámenes (registro manual sobre 20) ─────────
  const NOTA_REFUERZO=14;                 // por debajo de esto sugerimos reforzar
  function colorNota(n){ return n>=16?"buena":(n>=NOTA_REFUERZO?"media":"floja"); }
  // promedio por materia: [{materia, prom, n, ultima}] ordenado de peor a mejor
  function promediosPorMateria(){
    const acc={};
    NOTAS.forEach(t=>{
      if(!t.materia) return;
      const k=norm(t.materia);
      if(!acc[k]) acc[k]={materia:t.materia, suma:0, n:0, ultima:Number(t.nota)}; // NOTAS viene fecha desc → la 1ª es la última
      acc[k].suma+=Number(t.nota); acc[k].n++;
    });
    return Object.values(acc)
      .map(a=>({materia:a.materia, prom:Math.round((a.suma/a.n)*10)/10, n:a.n, ultima:a.ultima}))
      .sort((a,b)=>a.prom-b.prom);
  }
  function chipPromedio(p){
    const s=document.createElement("span"); s.className=`chip notaChip ${colorNota(p.prom)}`;
    s.textContent=`${limpiaNombreMateria(p.materia)||"General"}: ${p.prom}${p.n>1?` (${p.n})`:""}`;
    return s;
  }
  // resumen de promedios arriba de la lista de notas (pestaña Agenda)
  function pintarPromedios(){
    const box=$("#notasProm"); if(!box) return; box.innerHTML="";
    const proms=promediosPorMateria(); if(!proms.length) return;
    const tit=document.createElement("p"); tit.className="lblMini"; tit.textContent="Promedio por materia";
    box.appendChild(tit);
    const chips=document.createElement("div"); chips.className="chips";
    proms.forEach(p=>chips.appendChild(chipPromedio(p)));
    box.appendChild(chips);
  }
  function filaNota(t){
    const div=document.createElement("div"); div.className="tarea";
    const fecha=t.fecha?`<span class="tFechaBadge">${escapeHtml(t.fecha.slice(0,10))}</span>`:"";
    div.innerHTML=`<span class="notaBadge ${colorNota(Number(t.nota))}">${escapeHtml(String(t.nota))}</span>
      <div class="tBody"><p class="tDescTxt">${escapeHtml(t.descripcion||"Examen")}</p>
      <p class="tMeta">${escapeHtml(limpiaNombreMateria(t.materia||"")||"General")} ${fecha}</p></div>
      <button class="tBorrar" aria-label="Borrar">×</button>`;
    if(Number(t.nota)<NOTA_REFUERZO && t.materia){
      const ref=document.createElement("button"); ref.className="otros refuerzo"; ref.textContent="💪 Reforzar →";
      ref.onclick=()=>irARefuerzo(t);
      div.querySelector(".tBody").appendChild(ref);
    }
    div.querySelector(".tBorrar").onclick=async()=>{
      NOTAS=NOTAS.filter(x=>x!==t); pintarNotas(); pintarEscritorio();
      try{ await apiAgenda({accion:"nota_borrar", id:t.id}); }catch(_){}
    };
    return div;
  }
  function pintarNotas(){
    pintarPromedios();
    const cont=$("#notasList"); if(!cont) return; cont.innerHTML="";
    if(!NOTAS.length){
      cont.innerHTML=`<p class="wVacio">Cuando te entreguen un examen, anota aquí la nota. Así ves cómo vas en cada materia y te decimos qué reforzar. 🎓</p>`;
      return;
    }
    NOTAS.forEach(t=>cont.appendChild(filaNota(t)));
  }
  // escritorio: PROMEDIO por materia + sugerencia de refuerzo (solo si hay notas)
  function pintarNotasInicio(){
    const box=$("#notasInicio"); if(!box) return; box.innerHTML="";
    if(!NOTAS.length) return;
    const w=document.createElement("div"); w.className="h3MoreCard"; w.style.setProperty("--tone","#2DAE68");
    w.innerHTML=`<div class="h3MoreHead"><span class="h3MoreMark">${homeIcono("nota")}</span><h3>Mis notas</h3><button class="h2TextAction" id="btnVerNotas" type="button">Ver todas</button></div>`;
    const chips=document.createElement("div"); chips.className="h3MoreChips";
    const proms=promediosPorMateria();
    proms.slice(0,4).forEach(p=>{                       // chip 2.0: punto del color de la materia + promedio
      const v=homeMateriaVisual(p.materia);
      const s=document.createElement("span"); s.className="h3Chip"; s.style.setProperty("--tone",v.color);
      s.innerHTML=`<i></i><span>${escapeHtml(capMateria(limpiaNombreMateria(p.materia))||"General")}</span><b>${escapeHtml(String(p.prom))}</b>`;
      chips.appendChild(s);
    });
    w.appendChild(chips);
    // la nota más reciente floja → empuje a reforzar (con fotos del examen)
    const floja=NOTAS.find(t=>Number(t.nota)<NOTA_REFUERZO && t.materia);
    if(floja){
      const v=homeMateriaVisual(floja.materia);
      const b=document.createElement("button"); b.type="button"; b.className="h3MoreRow h3MoreRow--inCard";
      b.style.setProperty("--tone",v.color);
      b.innerHTML=`<span class="h3MoreRowIcon">${homeIcono("refuerzo")}</span><span class="h3MoreRowTx"><b>${escapeHtml(capMateria(limpiaNombreMateria(floja.materia)))} se puede reforzar</b><small>Practicá justo lo que salió mal</small></span>${homeIcono("flecha")}`;
      b.onclick=()=>irARefuerzo(floja);
      w.appendChild(b);
    }
    box.appendChild(w);
    const link=w.querySelector("#btnVerNotas"); if(link) link.onclick=()=>verTab("agenda");
  }
  // ───────── refuerzo desde una nota floja (con fotos del examen corregido) ─────────
  // Al tocar "Reforzar" en una nota, se abre la materia en modo refuerzo: un banner
  // invita a subir fotos del EXAMEN CORREGIDO (van a la IA al momento, NO se guardan)
  // y la generación ataca justo las preguntas que salieron mal.
  let REFUERZO=null;   // {materia, desc}
  function irARefuerzo(t){
    REFUERZO={ materia:t.materia, desc:(t.descripcion||"tu examen") };
    irAPractica(t.materia, "retos");   // reforzar = practicar
    pintarRefuerzoBanner();
  }
  function pintarRefuerzoBanner(){
    const b=$("#refuerzoBanner"); if(!b) return;
    if(!REFUERZO){ b.classList.add("hidden"); b.innerHTML=""; return; }
    b.innerHTML=`<p class="refTit">💪 Reforzando: ${escapeHtml(REFUERZO.desc)}</p>
      <p class="refTxt">Escoge el tema del examen y, si puedes, 📸 súbele fotos del examen corregido en "Mis apuntes": la práctica atacará justo lo que salió mal. Las fotos no se guardan.</p>`;
    b.classList.remove("hidden");
  }
  function limpiarRefuerzo(){ REFUERZO=null; pintarRefuerzoBanner(); }

  let nMatSel="";
  function abrirFormNota(){
    $("#formNota").classList.remove("hidden");
    $("#nDesc").value=""; $("#nNota").value=""; $("#nFecha").value=""; nMatSel=""; $("#nMsg").innerHTML="";
    montarSelectorMateria($("#nMaterias"), ()=>nMatSel, v=>{ nMatSel=v; });
    $("#nDesc").focus();
  }
  $("#btnNuevaNota").onclick=abrirFormNota;
  $("#btnCancelarNota").onclick=()=>$("#formNota").classList.add("hidden");
  $("#btnGuardarNota").onclick=async()=>{
    const valor=Number($("#nNota").value);
    if(!Number.isFinite(valor) || valor<0 || valor>20){ $("#nMsg").innerHTML=`<p class="wVacio" style="color:var(--bad)">La nota va de 0 a 20.</p>`; return; }
    const btn=$("#btnGuardarNota"); btn.disabled=true; $("#nMsg").innerHTML="";
    try{
      const d=await apiAgenda({accion:"nota_guardar", nota:{descripcion:$("#nDesc").value.trim(), materia:nMatSel, nota:valor, fecha:$("#nFecha").value||null}});
      if(!d || !d.ok || !d.nota) throw new Error((d&&d.error)||"no se pudo guardar");
      NOTAS.unshift(d.nota);
      $("#formNota").classList.add("hidden");
      pintarNotas(); pintarEscritorio();
    }catch(e){
      $("#nMsg").innerHTML=`<p class="wVacio" style="color:var(--bad)">No se pudo guardar. Revisa tu conexión e intenta de nuevo.</p>`;
    }finally{ btn.disabled=false; }
  };

  // navegación landing ↔ login ↔ "acceso en revisión"
  function ocultarVistas(){ ["#vLanding","#vLogin","#vHome","#vPendiente"].forEach(id=>$(id).classList.add("hidden")); }
  function verLanding(){ ocultarVistas(); $("#vLanding").classList.remove("hidden"); window.scrollTo({top:0}); }
  function verLogin(){ ocultarVistas(); $("#vLogin").classList.remove("hidden"); window.scrollTo({top:0}); }
  // pantalla cuando logueó bien pero el admin todavía no lo habilitó
  let tokenPendiente=null, nombrePendiente="";
  function verPendiente(nombre){
    ocultarVistas();
    const primer=(nombre||"").split(" ")[0]||"";
    $("#pendNombre").textContent = primer ? `¡Hola, ${primer}!` : "¡Hola!";
    $("#vPendiente").classList.remove("hidden"); window.scrollTo({top:0});
  }
  $("#btnReintentar").onclick = async ()=>{
    if(!tokenPendiente){ verLogin(); return; }
    const btn=$("#btnReintentar"); btn.disabled=true; const txt=btn.textContent; btn.textContent="Revisando…";
    try{
      const r = await fetch(API_MOODLE,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ token: tokenPendiente })});
      const d = await r.json();
      if(d.error) throw new Error(d.error);
      if(d.pendiente){ btn.textContent="Todavía no 😅 Prueba en un rato"; setTimeout(()=>{btn.textContent=txt;btn.disabled=false;},2600); return; }
      SESION = { id:(d.usuario&&d.usuario.id!=null)?d.usuario.id:("u_"+(nombrePendiente||"x").toLowerCase()),
        nombre:(d.usuario&&d.usuario.nombre)||nombrePendiente, token:d.token, materias:d.materias||[],
        racha:(d.usuario&&d.usuario.racha)||0, fetched:Date.now() };
      store.set("sesion", SESION); tokenPendiente=null; entrarHome();
    }catch(e){ btn.textContent="No se pudo, reintenta"; setTimeout(()=>{btn.textContent=txt;btn.disabled=false;},2600); }
  };
  $("#btnSalirPend").onclick = ()=>{ tokenPendiente=null; verLanding(); };
  $("#btnEntrarLanding").onclick = ()=>{ $("#loginMsg").innerHTML=""; verLogin(); };
  $("#btnVolverLanding").onclick = ()=>{ $("#user").value=""; $("#pass").value=""; verLanding(); };

  // ═══════════ CUENTA PROPIA (nativa, beta con ?beta=1) — via api/cuenta ═══════════
  function ocultarBeta(){ ["#vBeta","#vRegistro","#vRescate","#vLoginNat","#vRecuperar","#vSolicitud"].forEach(id=>{const e=$(id); if(e) e.classList.add("hidden");}); }
  function verBeta(){ ocultarVistas(); ocultarBeta(); $("#vBeta").classList.remove("hidden"); window.scrollTo({top:0}); }
  function verSolicitud(){ ocultarVistas(); ocultarBeta(); const m=$("#solMsg"); if(m) m.innerHTML=""; $("#vSolicitud").classList.remove("hidden"); window.scrollTo({top:0}); }
  function verRegistro(){ ocultarVistas(); ocultarBeta(); $("#regMsg").innerHTML=""; $("#vRegistro").classList.remove("hidden"); window.scrollTo({top:0}); }
  function verLoginNat(){ ocultarVistas(); ocultarBeta(); $("#natMsg").innerHTML=""; $("#vLoginNat").classList.remove("hidden"); window.scrollTo({top:0}); }
  function verRecuperar(){ ocultarVistas(); ocultarBeta(); $("#recMsg").innerHTML=""; $("#vRecuperar").classList.remove("hidden"); window.scrollTo({top:0}); }
  function verRescate(codigo){ ocultarVistas(); ocultarBeta(); $("#rescateCode").textContent=codigo||"--------"; $("#vRescate").classList.remove("hidden"); window.scrollTo({top:0}); }

  // aviso cuando una cuenta gratis toca algo premium (generación con IA / Cumbre / curado)
  function avisoPremium(){
    return `<div class="avisoPremium"><p class="apTit">✨ Esto es parte de Chispa Premium</p>`
      + `<p class="apTxt">Con tu cuenta gratis podés usar tu agenda, tus tareas, tu horario y tus notas. Para desbloquear los resúmenes, quiz y práctica con IA, pedile acceso al administrador de Chispa.</p></div>`;
  }

  // arma la SESION de una cuenta nativa a partir de la respuesta de api/cuenta
  function sesionNativa(d){
    const u=d.usuario||{};
    return { id:u.id, nombre:u.nombre||"", grado:u.grado||"", plan:u.plan||"gratis",
      token:d.token, fuente:"manual", materias:[], racha:(typeof u.racha==="number"?u.racha:0),
      onboarding:!!u.onboarding, fetched:Date.now() };
  }

  async function hacerRegistro(){
    const nombre=$("#regNombre").value.trim(), grado=$("#regGrado").value,
      usuario=$("#regUsuario").value.trim(), clave=$("#regClave").value, msg=$("#regMsg");
    if(!nombre){ msg.innerHTML=errBox("Escribí tu nombre."); return; }
    if(!grado){ msg.innerHTML=errBox("Elegí tu grado."); return; }
    if(!/^[a-zA-Z0-9._]{3,20}$/.test(usuario)){ msg.innerHTML=errBox("El usuario: 3 a 20 letras o números, sin espacios."); return; }
    if(clave.length<6){ msg.innerHTML=errBox("La clave debe tener al menos 6 caracteres."); return; }
    if(!($("#regConsent")&&$("#regConsent").checked)){ msg.innerHTML=errBox("Marcá la casilla de permiso para crear tu cuenta."); return; }
    const btn=$("#btnRegistrar"); btn.disabled=true; const t=btn.textContent; btn.textContent="Creando…"; msg.innerHTML="";
    try{
      const r=await fetch(API_CUENTA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"registrar",usuario,clave,nombre,grado})});
      const d=await r.json();
      if(!d.ok){ msg.innerHTML=errBox(d.error||"No se pudo crear la cuenta."); return; }
      SESION=sesionNativa(d); store.set("sesion",SESION);
      $("#regNombre").value=$("#regUsuario").value=$("#regClave").value="";
      RESCATE_SIGUE=entrarHome;
      verRescate(d.codigoRescate);
    }catch(e){ msg.innerHTML=errBox("No pudimos crear la cuenta. Revisá tu internet."); }
    finally{ btn.disabled=false; btn.textContent=t; }
  }

  // F3: enviar una solicitud "agreguen mi colegio" (público; api/cuenta accion solicitar_colegio)
  async function enviarSolicitud(){
    const colegio=$("#solColegio").value.trim(), msg=$("#solMsg");
    if(!colegio){ msg.innerHTML=errBox("Escribí el nombre de tu colegio."); return; }
    const tv=$("#solTieneAula").value;
    const cuerpo={
      accion:"solicitar_colegio", colegio,
      ciudad:$("#solCiudad").value.trim(), estado:$("#solEstado").value.trim(),
      tiene_aula: tv==="si" ? true : (tv==="no" ? false : null),
      moodle_url:$("#solUrl").value.trim(), contacto:$("#solContacto").value.trim(),
      token:(SESION&&SESION.token)||null
    };
    const btn=$("#btnEnviarSolicitud"); btn.disabled=true; const t=btn.textContent; btn.textContent="Enviando…"; msg.innerHTML="";
    try{
      const r=await fetch(API_CUENTA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(cuerpo)});
      const d=await r.json();
      if(!d.ok){ msg.innerHTML=errBox(d.error||"No se pudo enviar la solicitud."); return; }
      $("#solColegio").value=$("#solCiudad").value=$("#solEstado").value=$("#solUrl").value=$("#solContacto").value=""; $("#solTieneAula").value="";
      msg.innerHTML=`<div class="aviso"><span class="ico">✅</span><div>¡Gracias! Recibimos tu colegio. Lo revisamos y, si tiene aula virtual, lo conectamos pronto.</div></div>`;
    }catch(e){ msg.innerHTML=errBox("No pudimos enviar la solicitud. Revisá tu internet."); }
    finally{ btn.disabled=false; btn.textContent=t; }
  }

  // ═══════════ F4: onboarding de bienvenida (solo cuentas nativas / Camino B) ═══════════
  const ONB_STEPS = [
    { emoji:"👋", tit:"¡Bienvenido a Chispa!", txt:"Este es tu lugar para organizarte y aprender más, a tu manera. Te mostramos lo básico en 30 segundos." },
    { emoji:"🗓️", tit:"Tu agenda, siempre a mano", txt:"Anotá tus tareas, tus notas de examen y tu horario. Es gratis y te ayuda a no perderte de nada." },
    { emoji:"📸", tit:"Aprendé con tus propios apuntes", txt:"Creá una materia, sacale una foto a tu cuaderno o escribí el tema, y Chispa te arma un resumen y un quiz para practicar." },
    { emoji:"🔥", tit:"Sumá días y energía", txt:"Entrá todos los días para subir tu racha. Cada resumen o quiz que pedís usa un poquito de energía." },
    { emoji:"📲", tit:"Llevá Chispa en tu teléfono", txt:"Abrí el menú de tu navegador y elegí “Agregar a inicio”. Así la abrís como una app, sin buscarla cada vez." },
  ];
  let ONB_I = 0;
  function mostrarOnboarding(){
    if(!(SESION && SESION.fuente==="manual")) return;   // salvaguarda: nunca a cuentas de aula
    ONB_I = 0; renderOnbStep();
    $("#onbOverlay").classList.remove("hidden");
  }
  function renderOnbStep(){
    const s = ONB_STEPS[ONB_I]; if(!s) return;
    $("#onbBody").innerHTML = `<div class="onbEmoji">${s.emoji}</div>`+
      `<p class="onbTit">${escapeHtml(s.tit)}</p>`+
      `<p class="onbTxt">${escapeHtml(s.txt)}</p>`;
    const dots = $("#onbDots"); dots.innerHTML="";
    ONB_STEPS.forEach((_,k)=>{ const d=document.createElement("span"); d.className="onbDot"+(k===ONB_I?" on":""); dots.appendChild(d); });
    const ultimo = ONB_I===ONB_STEPS.length-1;
    $("#onbSiguiente").textContent = ultimo ? "¡Empezar! ✨" : "Siguiente";
    $("#onbSaltar").style.visibility = ultimo ? "hidden" : "visible";
  }
  function onbSiguiente(){
    if(ONB_I < ONB_STEPS.length-1){ ONB_I++; renderOnbStep(); }
    else onbTerminar();
  }
  function onbTerminar(){
    $("#onbOverlay").classList.add("hidden");
    if(SESION){ SESION.onboarding=true; try{ store.set("sesion",SESION); }catch(_){} }
    // persistir en el server (fire-and-forget; si falla, el flag local ya evita repetirlo en este aparato)
    if(SESION && SESION.token){
      fetch(API_CUENTA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"onboarding_visto",token:SESION.token})}).catch(()=>{});
    }
  }
  $("#onbSiguiente") && ($("#onbSiguiente").onclick=onbSiguiente);
  $("#onbSaltar") && ($("#onbSaltar").onclick=onbTerminar);

  async function hacerLoginNat(){
    const usuario=$("#natUser").value.trim(), clave=$("#natPass").value, msg=$("#natMsg");
    if(!usuario||!clave){ msg.innerHTML=errBox("Escribí tu usuario y tu clave."); return; }
    const btn=$("#btnLoginNat"); btn.disabled=true; const t=btn.textContent; btn.textContent="Entrando…"; msg.innerHTML="";
    try{
      const r=await fetch(API_CUENTA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"login",usuario,clave})});
      const d=await r.json();
      if(!d.ok){ msg.innerHTML=errBox(d.error||"Usuario o clave incorrectos."); return; }
      SESION=sesionNativa(d); store.set("sesion",SESION);
      $("#natUser").value=$("#natPass").value="";
      entrarHome();
    }catch(e){ msg.innerHTML=errBox("No pudimos entrar. Revisá tu internet."); }
    finally{ btn.disabled=false; btn.textContent=t; }
  }

  async function hacerRecuperar(){
    const usuario=$("#recUser").value.trim(), codigoRescate=$("#recCodigo").value.trim(), claveNueva=$("#recClave").value, msg=$("#recMsg");
    if(!usuario||!codigoRescate){ msg.innerHTML=errBox("Escribí tu usuario y el código de rescate."); return; }
    if(claveNueva.length<6){ msg.innerHTML=errBox("La nueva clave debe tener al menos 6 caracteres."); return; }
    const btn=$("#btnRecuperar"); btn.disabled=true; const t=btn.textContent; btn.textContent="Cambiando…"; msg.innerHTML="";
    try{
      const r=await fetch(API_CUENTA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"recuperar",usuario,codigoRescate,claveNueva})});
      const d=await r.json();
      if(!d.ok){ msg.innerHTML=errBox(d.error||"Usuario o código incorrectos."); return; }
      SESION=sesionNativa(d); store.set("sesion",SESION);
      $("#recUser").value=$("#recCodigo").value=$("#recClave").value="";
      RESCATE_SIGUE=entrarHome;
      verRescate(d.codigoRescate);   // recuperar rota el código → mostrar el nuevo
    }catch(e){ msg.innerHTML=errBox("No pudimos recuperar la cuenta. Revisá tu internet."); }
    finally{ btn.disabled=false; btn.textContent=t; }
  }

  // refresco/reapertura de una cuenta nativa: valida el token y actualiza racha/plan
  async function refrescarNativa(){
    try{
      const r=await fetch(API_CUENTA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"sesion",token:SESION.token})});
      const d=await r.json().catch(()=>null);
      if(d && d.code===401){ sesionVencidaNat(); return; }
      if(d && d.ok && d.usuario){
        const planViejo=SESION.plan;
        SESION.nombre=d.usuario.nombre||SESION.nombre; SESION.grado=d.usuario.grado||SESION.grado;
        SESION.plan=d.usuario.plan||SESION.plan;
        if(typeof d.usuario.racha==="number") SESION.racha=d.usuario.racha;
        if(typeof d.usuario.onboarding==="boolean") SESION.onboarding=d.usuario.onboarding;
        if(d.token) SESION.token=d.token;
        SESION.fetched=Date.now(); store.set("sesion",SESION); pintarRacha();
        // si el admin cambió el plan (p.ej. upgrade a premium), refrescar la UI que depende de él
        // sin esperar a un re-login: el medidor de energía y el aviso premium dejan de aplicar.
        if(SESION.plan!==planViejo) pintarEnergiaIA();
      }
    }catch(e){ /* sin conexión: seguimos con lo cacheado */ }
  }
  function sesionVencidaNat(){
    store.del("sesion"); SESION=null; origen="actual"; materiaSel=null; temaSel=null;
    $("#results").innerHTML=""; MIS_ERRORES=[]; PROGRESO=new Map();
    verLoginNat(); $("#natMsg").innerHTML=errBox("Tu sesión venció. Entrá de nuevo, por favor.");
  }

  $("#btnIrRegistro") && ($("#btnIrRegistro").onclick=verRegistro);
  $("#btnIrLoginNat") && ($("#btnIrLoginNat").onclick=verLoginNat);
  $("#btnIrMoodle") && ($("#btnIrMoodle").onclick=()=>{ $("#loginMsg").innerHTML=""; verLogin(); });
  $("#btnIrSolicitud") && ($("#btnIrSolicitud").onclick=verSolicitud);
  $("#btnSolVolver") && ($("#btnSolVolver").onclick=verBeta);
  $("#btnEnviarSolicitud") && ($("#btnEnviarSolicitud").onclick=enviarSolicitud);
  $("#btnRegVolver") && ($("#btnRegVolver").onclick=verBeta);
  $("#btnRegistrar") && ($("#btnRegistrar").onclick=hacerRegistro);
  $("#btnRescateSeguir") && ($("#btnRescateSeguir").onclick=()=>{ const f=RESCATE_SIGUE; RESCATE_SIGUE=null; (f||verBeta)(); });
  $("#btnLoginNatVolver") && ($("#btnLoginNatVolver").onclick=verBeta);
  $("#btnLoginNat") && ($("#btnLoginNat").onclick=hacerLoginNat);
  $("#natPass") && $("#natPass").addEventListener("keydown",e=>{ if(e.key==="Enter") hacerLoginNat(); });
  $("#btnIrRecuperar") && ($("#btnIrRecuperar").onclick=verRecuperar);
  $("#btnRecVolver") && ($("#btnRecVolver").onclick=verLoginNat);
  $("#btnRecuperar") && ($("#btnRecuperar").onclick=hacerRecuperar);

  // ── Sinapsis (juego): liga privada del cole. Se abre embebido, con el nombre e id
  //    del niño; el iframe se crea SOLO al abrir (no pesa hasta que juega) y se descarta al cerrar.
  const JUEGO_URL = "https://sinapsis-mocha.vercel.app";
  function nombreJuego(){
    const p = ((SESION&&SESION.nombre)||"").trim().split(/\s+/).filter(Boolean);
    return p[0] ? (p[0] + (p[1] ? " "+p[1].charAt(0).toUpperCase()+"." : "")) : "jugador";
  }
  function juegoOnbKey(){ return "sxOnb:" + (SESION ? SESION.id : ""); }
  function abrirJuego(){
    if(!SESION) return;
    // El iframe de Sinapsis es de otro dominio → su localStorage no persiste (iOS/ITP).
    // Chispa (first-party) recuerda si este niño ya vio el tutorial y se lo pasa (?onb).
    let onb = ""; try{ const o = store.get(juegoOnbKey()); if(o) onb = "&onb=" + encodeURIComponent(JSON.stringify(o)); }catch(e){}
    const url = JUEGO_URL + "/?grupo=chispa&nombre=" + encodeURIComponent(nombreJuego()) + "&uid=" + encodeURIComponent(String(SESION.id)) + onb;
    $("#juegoFrameWrap").innerHTML = '<iframe id="juegoFrame" title="Sinapsis" src="'+url+'" allow="autoplay; fullscreen"></iframe>';
    $("#juegoOverlay").classList.remove("hidden");
    document.body.classList.add("juegoAbierto");
  }
  function cerrarJuego(){
    $("#juegoOverlay").classList.add("hidden");
    $("#juegoFrameWrap").innerHTML = "";   // descarga el juego: libera memoria y detiene sonido/timers
    document.body.classList.remove("juegoAbierto");
  }
  $("#btnJuego").onclick = abrirJuego;
  $("#btnCerrarJuego").onclick = cerrarJuego;

  // ── Familia (padres): el niño genera un enlace/QR para dar acceso de SOLO LECTURA a un
  //    adulto. La generación va autenticada con su token de Moodle (api/familia). El QR se
  //    carga perezosamente (solo al invitar) para no pesar el arranque.
  const API_FAMILIA = "https://aula-cam.vercel.app/api/familia";
  let qrLibProm = null;
  function cargarQR(){
    if(window.qrcode) return Promise.resolve();
    if(!qrLibProm) qrLibProm = new Promise((res,rej)=>{ const s=document.createElement("script"); s.src="qrcode.min.js"; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
    return qrLibProm;
  }
  function qrDataURL(texto){ try{ const qr=window.qrcode(0,"M"); qr.addData(texto); qr.make(); return qr.createDataURL(6,12); }catch(e){ return null; } }
  function abrirFamilia(){
    if(!SESION) return;
    $("#familiaModal").classList.remove("hidden"); document.body.classList.add("modalAbierto");
    $("#famBody").innerHTML =
      `<p class="famEyebrow">👨‍👩‍👧 Para tu familia</p>
       <h2 class="famTit">Dar acceso a un adulto</h2>
       <p class="famTxt">Crea un enlace para que tu mamá o papá vea lo que hacés en Chispa: prácticas, quiz, exámenes, notas y agenda. <b>Solo pueden mirar</b>, no cambian nada.</p>
       <button class="go" id="btnCrearInvite">Crear enlace de invitación</button>
       <div id="famInviteBox"></div>
       <div id="famVinculos"></div>`;
    $("#btnCrearInvite").onclick = crearInvite;
    cargarVinculos();
  }
  function cerrarFamilia(){ $("#familiaModal").classList.add("hidden"); document.body.classList.remove("modalAbierto"); }
  async function crearInvite(){
    const btn=$("#btnCrearInvite"); if(btn){ btn.disabled=true; btn.textContent="Creando…"; }
    try{
      const r=await fetch(API_FAMILIA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"invitar", token:SESION.token})});
      const d=await r.json().catch(()=>null);
      if(!d||!d.ok||!d.link) throw new Error();
      await mostrarInvite(d.link, d.code);
      if(btn){ btn.disabled=false; btn.textContent="Crear otro enlace"; }
      cargarVinculos();
    }catch(e){ if(btn){ btn.disabled=false; btn.textContent="Reintentar"; } }
  }
  async function mostrarInvite(link, code){
    const box=$("#famInviteBox"); if(!box) return;
    await cargarQR().catch(()=>{});
    const img = window.qrcode ? qrDataURL(link) : null;
    let donde="el enlace"; try{ donde=new URL(link).host+"/familia"; }catch(_){}
    box.innerHTML =
      `<div class="famCard">
        <p class="famMini">Mostráselo a tu adulto o compartilo</p>
        ${img?`<img class="famQR" src="${img}" alt="Código QR" />`:""}
        <div class="famCode">${escapeHtml(code)}</div>
        <p class="famHint">Que abra <b>${escapeHtml(donde)}</b> y escriba el código, o que escanee el QR.</p>
        <div class="famBtns"><button class="otros" id="btnCompartir">📤 Compartir</button><button class="otros" id="btnCopiar">📋 Copiar</button></div>
        <p class="famHint">Vale 24 horas y sirve en más de un teléfono (mamá, papá, o el ícono de inicio del iPhone).</p>
      </div>`;
    const share=$("#btnCompartir"), copy=$("#btnCopiar");
    if(share) share.onclick=async()=>{ try{ if(navigator.share){ await navigator.share({title:"Chispa · Familia", text:"Mirá lo que hago en Chispa:", url:link}); } else { copiar(link,copy); } }catch(_){} };
    if(copy) copy.onclick=()=>copiar(link,copy);
  }
  function copiar(txt, btn){
    const ok=()=>{ if(btn){ const t=btn.textContent; btn.textContent="✓ Copiado"; setTimeout(()=>btn.textContent=t,1800); } };
    if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok).catch(()=>fallbackCopy(txt,ok));
    else fallbackCopy(txt, ok);
  }
  function fallbackCopy(txt, ok){ try{ const ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); ok&&ok(); }catch(_){} }
  async function cargarVinculos(){
    const box=$("#famVinculos"); if(!box) return;
    try{
      const r=await fetch(API_FAMILIA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"vinculos", token:SESION.token})});
      const d=await r.json().catch(()=>null);
      const activos=((d&&d.vinculos)||[]).filter(v=>v.estado==="activo");
      if(!activos.length){ box.innerHTML=""; return; }
      box.innerHTML=`<p class="famMini" style="margin-top:18px">Adultos con acceso</p>` + activos.map(v=>
        `<div class="famVin"><span class="famVinNom">👤 ${escapeHtml(v.alias||"Adulto")}</span><button class="famQuitar" data-id="${v.id}">Quitar</button></div>`).join("");
      box.querySelectorAll(".famQuitar").forEach(b=>b.onclick=()=>revocarVinculo(+b.dataset.id, b));
    }catch(e){ box.innerHTML=""; }
  }
  async function revocarVinculo(id, btn){
    if(!confirm("¿Quitarle el acceso a este adulto?")) return;
    if(btn){ btn.disabled=true; btn.textContent="…"; }
    try{ await fetch(API_FAMILIA,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"revocar", token:SESION.token, id})}); }catch(_){}
    cargarVinculos();
  }
  $("#btnFamilia").onclick = abrirFamilia;
  $("#btnCerrarFamilia").onclick = cerrarFamilia;
  $("#familiaModal").onclick = (e)=>{ if(e.target===$("#familiaModal")) cerrarFamilia(); };

  $("#btnSalir").onclick = ()=>{
    const eraNativa = !!(SESION && SESION.fuente==="manual");
    store.del("sesion"); SESION=null; origen="actual";
    materiaSel=null; temaSel=null; $("#results").innerHTML="";
    MIS_ERRORES=[]; PROGRESO=new Map();
    $("#user").value=""; $("#loginMsg").innerHTML="";
    (eraNativa || BETA) ? verBeta() : verLanding();
  };
  $("#btnSalirHome").onclick=()=>$("#btnSalir").click();

  // sesión vencida (token expirado): cerrar y volver al login con aviso amable
  function sesionVencida(mensaje){
    store.del("sesion"); SESION=null; origen="actual"; materiaSel=null; temaSel=null;
    $("#results").innerHTML=""; MIS_ERRORES=[]; PROGRESO=new Map();
    verLogin();
    $("#loginMsg").innerHTML = errBox(mensaje || "Tu sesión venció. Entra de nuevo, por favor.");
  }
  // refresca las materias en segundo plano (por si la maestra subió algo nuevo),
  // usando el token guardado. Si el token venció → vuelve al login. No bloquea la app.
  async function refrescarMaterias(){
    if(!SESION || !SESION.token) return;
    if(SESION.fuente==="manual") return refrescarNativa();   // cuenta propia: valida por api/cuenta
    try{
      const r = await fetch(API_MOODLE,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ token: SESION.token })});
      const d = await r.json().catch(()=>null);
      if(d && d.code===401){ sesionVencida(); return; }
      if(d && d.pendiente){ sesionVencida("Tu acceso fue pausado. Habla con el administrador."); return; }
      if(d && Array.isArray(d.materias) && d.materias.length){
        SESION.materias = d.materias;
        if(d.token) SESION.token = d.token;
        if(d.usuario && typeof d.usuario.racha === "number") SESION.racha = d.usuario.racha;
        SESION.fetched = Date.now();
        store.set("sesion", SESION);
        pintarRacha();         // la racha pudo subir hoy → refrescar el chip sin re-loguear
        detectarNovedades();   // el material fresco puede traer 🆕
        if(origen==="actual" && !$("#paneMaterias").classList.contains("hidden")) pintarMaterias();
        if(!$("#tabInicio").classList.contains("hidden")) pintarEscritorio();
      }
    }catch(e){ /* sin conexión: seguimos con lo cacheado */ }
  }

  // Refresco al volver al frente. En iOS la PWA standalone no tiene "deslizar para
  // refrescar" (es gesto del navegador) y al reabrir REANUDA la app congelada en vez
  // de recargarla → sin esto los datos quedan viejos hasta cerrar sesión. visibilitychange
  // (y pageshow, por el bfcache) sí disparan al reanudar; con throttle de 60s para no spamear.
  function refrescarAlVolver(){
    if(!SESION || !SESION.token || MODO_LAB) return;
    if(Date.now() - (SESION.fetched || 0) < 60000) return;
    refrescarMaterias();
  }
  document.addEventListener("visibilitychange", ()=>{ if(!document.hidden) refrescarAlVolver(); });
  window.addEventListener("pageshow", (e)=>{ if(e.persisted) refrescarAlVolver(); });

  // ───────── repasar mis errores ─────────
  async function cargarErrores(){
    const wrap=$("#erroresWrap"); if(!wrap) return;
    wrap.classList.add("hidden"); MIS_ERRORES=[];
    if(!SESION || SESION.id==null) return;
    try{
      const r=await fetch(API_ERRORES,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"listar",usuario_id:SESION.id})});
      const d=await r.json().catch(()=>null);
      MIS_ERRORES=(d&&Array.isArray(d.errores))?d.errores:[];
    }catch(e){ MIS_ERRORES=[]; }
    if(MIS_ERRORES.length){ actualizarErrSub(); wrap.classList.remove("hidden"); }
  }
  function actualizarErrSub(){
    const n=MIS_ERRORES.length;
    $("#errSub").textContent = `${n} ${n===1?"pregunta":"preguntas"} para repasar`;
  }
  $("#btnErrores").onclick = ()=>{
    renderErrores();
    $("#paneMaterias").classList.add("hidden"); $("#paneTemas").classList.add("hidden");
    $("#paneErrores").classList.remove("hidden"); window.scrollTo({top:0,behavior:"smooth"});
  };
  $("#btnBackErr").onclick = ()=>{ $("#paneErrores").classList.add("hidden"); verMaterias(); };

  function renderErrores(){
    const cont=$("#erroresList"); cont.innerHTML="";
    if(!MIS_ERRORES.length){ cont.appendChild(vacio("¡No tienes errores para repasar! 🎉")); return; }
    MIS_ERRORES.forEach(e=>{
      const opciones=Array.isArray(e.opciones)?e.opciones:[];
      const correcta=(Number.isInteger(e.correcta)&&opciones[e.correcta]!=null)?opciones[e.correcta]:"";
      const card=document.createElement("div"); card.className="errItem";
      const meta=[e.materia,e.tema].filter(Boolean).map(escapeHtml).join(" · ");
      card.innerHTML=`${meta?`<p class="errMeta">${meta}</p>`:``}
        <p class="errQ">${escapeHtml(e.pregunta||"")}</p>
        ${figuraHTML(e.figura)}
        ${correcta?`<div class="errOk"><b>✅ Respuesta correcta:</b> ${escapeHtml(correcta)}</div>`:``}
        ${e.explicacion?`<div class="errExp"><b>${e.numerica?"✏️ Cómo se resuelve:":"💡 Para recordar:"}</b> ${escapeHtml(e.explicacion)}</div>`:``}
        <button class="errListo">✅ Ya lo entendí</button>`;
      card.querySelector(".errListo").onclick=()=>resolverError(e, card);
      cont.appendChild(card);
    });
  }
  async function resolverError(e, card){
    card.style.opacity=".5";
    try{ await fetch(API_ERRORES,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"resolver",usuario_id:SESION.id,id:e.id})}); }catch(_){}
    MIS_ERRORES=MIS_ERRORES.filter(x=>x.id!==e.id); card.remove();
    if(!MIS_ERRORES.length){
      $("#erroresList").innerHTML=""; $("#erroresList").appendChild(vacio("¡Repasaste todos tus errores! 🎉"));
      $("#erroresWrap").classList.add("hidden");
    }else actualizarErrSub();
  }
  // guarda las preguntas que la niña falló en un quiz (para repasarlas luego).
  // Incluye Cumbre: repasar un error NO gasta IA (solo muestra la pregunta + la
  // explicación ya guardadas), y así el error también aparece en la alerta "repasar
  // mis errores" del aula y en el panel de Familia ("para reforzar").
  async function guardarErrores(fallidas, meta){
    if(!SESION || SESION.id==null || !fallidas.length) return;
    const matBase = (meta&&meta.materia)||null;
    const materia = (origen==="cumbre" && matBase) ? `Cumbre · ${matBase}` : matBase;
    const numerica = esNumerica(matBase||"") || esNumerica((meta&&meta.tema)||"");
    const errores = fallidas.map(f=>({
      materia, tema:(meta&&meta.tema)||null, grado:(meta&&meta.grado)||null,
      pregunta:f.pregunta, opciones:f.opciones, correcta:f.correcta, elegida:f.elegida,
      explicacion:f.explicacion||"", figura:f.figura||"", numerica
    }));
    try{ await fetch(API_ERRORES,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"guardar",usuario_id:SESION.id,errores})}); }catch(_){}
  }

  // ───────── progreso por tema (ruta de aprendizaje) ─────────
  async function cargarProgreso(){
    PROGRESO = new Map();
    if(!SESION || SESION.id==null){ return; }
    try{
      const r=await fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"resumen",usuario_id:SESION.id})});
      const d=await r.json().catch(()=>null);
      const prog=(d&&Array.isArray(d.progreso))?d.progreso:[];
      prog.forEach(row=>{
        PROGRESO.set(norm(row.materia||"")+"|"+norm(row.tema||""),
          { modos:new Set(row.modos||[]), quizMejor:(typeof row.quizMejor==="number"?row.quizMejor:null) });
      });
    }catch(e){ PROGRESO=new Map(); }
    repintarProgreso();
  }
  // registra que el niño hizo una actividad; actualiza PROGRESO al instante + guarda (fire-and-forget)
  // ───────── MURO: logros del grado + reacciones (mini red social sana) ─────────
  // Segmentado por el grado REAL del niño (a uno de 1er año no le interesa 3er grado).
  // Solo publica LO QUE HIZO (nunca notas). Reacciones = set curado y positivo.
  const MURO_REACS = ["👏","🔥","💪","🎉","⭐"];
  let MURO_POSTS = [];
  function nombreMuro(){                       // "Ana B." (primer nombre + inicial), amable y sin exponer
    const p = ((SESION&&SESION.nombre)||"").trim().split(/\s+/).filter(Boolean);
    return p[0] ? (p[0] + (p[1] ? " "+p[1].charAt(0).toUpperCase()+"." : "")) : "Alguien";
  }
  // publica un logro (fire-and-forget; el server dedup 1/día y COMPONE el texto — el front no manda texto libre)
  function publicarMuro(tipo, opt){
    opt = opt || {};
    if(!SESION || SESION.id==null) return;
    const grado = gradoDeSesion(); if(!grado) return;
    try{ fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      accion:"muro_publicar", usuario_id:SESION.id, nombre:nombreMuro(), grado, tipo,
      materia:opt.materia||null, tema:opt.tema||null, meta:opt.meta||null })}); }catch(_){}
  }
  async function cargarMuro(){
    const cont=$("#tabMuro"); if(!cont) return;
    if(!SESION || SESION.id==null){ cont.innerHTML=""; return; }
    const grado = gradoDeSesion();
    cont.innerHTML = muroHead(grado) + `<div class="muroSkel">Cargando…</div>`;
    try{
      const r=await fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"muro_feed",usuario_id:SESION.id,grado})});
      const d=await r.json().catch(()=>null);
      MURO_POSTS = (d&&Array.isArray(d.posts))?d.posts:[];
    }catch(_){ MURO_POSTS=[]; }
    pintarMuro();
  }
  function muroHead(grado){
    return `<div class="muroHead"><h2>🎉 Amigos de ${escapeHtml(grado||"tu grado")}</h2>`+
      `<p>Lo que lograron tú y tus compañeros. ¡Reacciona para animarlos!</p></div>`;
  }
  function pintarMuro(){
    const cont=$("#tabMuro"); if(!cont) return;
    let html = muroHead(gradoDeSesion());
    if(!MURO_POSTS.length){
      html += `<div class="muroVacio"><div class="mvIco">🌱</div>`+
        `<p><b>Todavía no hay logros por aquí.</b></p>`+
        `<p>Practica una materia, juega el reto de Sinapsis o avanza en Cumbre: tu primer logro aparecerá acá. Cuando entren más compañeros de tu grado, verás también los suyos.</p></div>`;
      cont.innerHTML = html; return;
    }
    html += `<div class="muroList">` + MURO_POSTS.map(tarjetaMuro).join("") + `</div>`;
    cont.innerHTML = html;
    cont.querySelectorAll("[data-reac]").forEach(b=>{ b.onclick=()=>reaccionar(b.dataset.id, b.dataset.reac); });
  }
  function tarjetaMuro(p){
    const quien = p.mio ? "Tú" : escapeHtml(p.nombre||"Alguien");
    const base = p.mio ? (SESION.nombre||"T") : (p.nombre||"?");
    const ini = (base[0]||"?").toUpperCase();
    const color = colorCuenta(base);
    const filaReac = MURO_REACS.map(e=>{
      const n = (p.reacciones && p.reacciones[e]) || 0;
      const on = p.miReaccion===e ? " on" : "";
      return `<button class="reacBtn${on}" data-reac="${e}" data-id="${p.id}">${e}${n?`<b>${n}</b>`:""}</button>`;
    }).join("");
    return `<div class="muroCard${p.mio?" mio":""}">`+
      `<div class="mcTop"><span class="mcAv" style="--c:${color}">${escapeHtml(ini)}</span>`+
      `<span class="mcTxt"><b>${quien}</b> ${escapeHtml(p.texto||"")}</span>`+
      `<span class="mcTime">${haceCuanto(p.creado)}</span></div>`+
      `<div class="mcReac">${filaReac}</div></div>`;
  }
  async function reaccionar(muroId, emoji){
    const p = MURO_POSTS.find(x=>String(x.id)===String(muroId)); if(!p) return;
    const quitar = p.miReaccion===emoji;   // tocar mi emoji actual = quitarlo (toggle, estilo WhatsApp)
    p.reacciones = p.reacciones || {};
    if(p.miReaccion){ p.reacciones[p.miReaccion]=Math.max(0,(p.reacciones[p.miReaccion]||1)-1); if(!p.reacciones[p.miReaccion]) delete p.reacciones[p.miReaccion]; }
    if(!quitar){ p.reacciones[emoji]=(p.reacciones[emoji]||0)+1; p.miReaccion=emoji; } else { p.miReaccion=null; }
    pintarMuro();   // optimista
    try{ fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"muro_reaccion",usuario_id:SESION.id,muro_id:muroId,emoji:quitar?null:emoji})}); }catch(_){}
  }
  function haceCuanto(iso){
    const t = Date.parse(iso); if(!t) return "";
    const s = Math.max(0, (Date.now()-t)/1000);
    if(s<60) return "ahora";
    const min=Math.floor(s/60); if(min<60) return `hace ${min} min`;
    const h=Math.floor(min/60); if(h<24) return `hace ${h} h`;
    const d=Math.floor(h/24); if(d===1) return "ayer";
    if(d<7) return `hace ${d} días`;
    const sem=Math.floor(d/7); return sem<5?`hace ${sem} sem`:"hace tiempo";
  }
  // Sinapsis (iframe, otro dominio) nos habla por postMessage.
  window.addEventListener("message", (ev)=>{
    if(!/sinapsis/i.test(ev.origin||"")) return;
    const m = ev.data;
    if(!m) return;
    // score del RETO DIARIO → lo publicamos en el muro.
    if(m.tipo==="sinapsis_diario" && Number.isFinite(+m.score)) publicarMuro("sinapsis", {meta:{score:+m.score}});
    // estado del tutorial → lo guardamos por niño (persistimos por él, ver abrirJuego).
    if(m.tipo==="sinapsis_onb" && SESION){
      try{ const t = Array.isArray(m.t) ? m.t.filter(x=>typeof x==="string").slice(0,12) : []; store.set(juegoOnbKey(), {i: m.i?1:0, t}); }catch(e){}
    }
  });

  function registrarActividad(meta, modo, extra){
    if(origen==="cumbre"){          // Cumbre no se mezcla con el progreso del aula, pero SÍ guarda la nota del quiz (local)
      if(modo==="quiz" && extra && Number.isInteger(extra.total) && extra.total>0 && Number.isInteger(extra.aciertos))
        guardarNotaCumbre(meta, extra.aciertos, extra.total);
      return;
    }
    if(!SESION || SESION.id==null) return;
    const mat=(meta&&meta.materia)||null, tema=(meta&&meta.tema)||null;
    if(!tema) return;
    const key=norm(mat||"")+"|"+norm(tema);
    let p=PROGRESO.get(key); if(!p){ p={modos:new Set(),quizMejor:null}; PROGRESO.set(key,p); }
    p.modos.add(modo);
    if(modo==="quiz" && extra && Number.isInteger(extra.total) && extra.total>0 && Number.isInteger(extra.aciertos)){
      const v=extra.aciertos/extra.total; if(p.quizMejor==null || v>p.quizMejor) p.quizMejor=v;
    }
    repintarProgreso();
    const body={accion:"guardar",usuario_id:SESION.id,materia:mat,tema,grado:(meta&&meta.grado)||gradoActivo(),modo};
    if(modo==="quiz" && extra){ body.aciertos=extra.aciertos; body.total=extra.total; }
    try{ fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); }catch(_){}
    // muro: publica el logro (solo lo que hizo; resumen no cuenta). Usa el grado REAL, no el "adelanta".
    if(modo==="retos"||modo==="quiz"||modo==="examen") publicarMuro(modo==="retos"?"practica":modo, {materia:mat, tema});
  }
  // Nota del "Demuestra" (quiz) de Cumbre: se guarda en Supabase por niño (tabla cumbre_notas
  // vía api/actividad), así SIGUE al niño en cualquier dispositivo. Se muestra la MEJOR.
  async function cargarNotasCumbre(){
    CUMBRE_NOTAS = new Map();
    if(!SESION || SESION.id==null) return;
    try{
      const r=await fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"cumbre_resumen",usuario_id:SESION.id})});
      const d=await r.json().catch(()=>null);
      (d&&Array.isArray(d.notas)?d.notas:[]).forEach(row=>{ if(typeof row.quizMejor==="number") CUMBRE_NOTAS.set(norm(row.materia||"")+"|"+norm(row.tema||""), row.quizMejor); });
    }catch(e){}
  }
  function guardarNotaCumbre(meta,aciertos,total){
    const mat=(meta&&meta.materia)||"", tema=(meta&&meta.tema)||""; if(!tema) return;
    const frac=aciertos/total, key=norm(mat)+"|"+norm(tema), prev=CUMBRE_NOTAS.get(key);
    if(prev==null || frac>prev) CUMBRE_NOTAS.set(key, frac);   // instantáneo (para verlo al volver)
    if(SESION && SESION.id!=null){
      try{ fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"cumbre_guardar",usuario_id:SESION.id,materia:mat,tema,aciertos,total})}); }catch(_){}
    }
  }
  function notaCumbre(mat,tema){ const v=CUMBRE_NOTAS.get(norm(mat||"")+"|"+norm(tema||"")); return (typeof v==="number")?v:null; }

  // marca ✓ (hecho) / ⭐ (dominado ≥80%) en los chips del panel abierto
  function marcarChips(){
    const mat=(materiaSel&&materiaSel.nombre)||"";
    $("#grupos").querySelectorAll(".chip").forEach(c=>{
      const tema=c.dataset.tema||"";
      const pr=PROGRESO.get(norm(mat)+"|"+norm(tema));
      const marca = pr ? ((pr.quizMejor!=null && pr.quizMejor>=0.8) ? " ⭐" : " ✓") : "";
      const guia = temaTieneGuia(mat, tema) ? " 📗" : "";
      c.textContent = tema + marca + guia;
    });
  }
  function repintarProgreso(){
    if($("#paneTemas") && !$("#paneTemas").classList.contains("hidden")){ pintarModos(); marcarChips(); pintarAcciones(); }
    // refresca la barra de progreso de las tarjetas de materia (materias actuales)
    if(origen==="actual" && $("#gridMaterias") && SESION && SESION.materias && SESION.materias.length) gridMaterias(SESION.materias);
  }

  // grilla de materias (sirve para las actuales y para las del próximo año)
  // progreso REAL de una materia actual: temas practicados / temas practicables.
  // Devuelve null si no aplica (próximo año / Cumbre no tienen temas practicables acá).
  function progresoMateria(m){
    const total = temasPracticables(m).length;
    if(!total) return null;
    const pref = norm(m.nombre)+"|";
    let done=0;
    PROGRESO.forEach((p,k)=>{ if(k.indexOf(pref)===0 && p.modos && p.modos.size>0) done++; });
    done = Math.min(done, total);
    return { done, total, pct: Math.round(done/total*100) };
  }
  // Tarjeta de materia (Chispa 2.0): placa de ícono 3D tintada + nombre en caso
  // título (NUNCA a los gritos: limpiaNombreMateria devuelve MAYÚSCULAS) + progreso real.
  function gridMaterias(lista){
    const g = $("#gridMaterias"); g.innerHTML="";
    lista.forEach(m=>{
      const vis = homeMateriaVisual(m.nombre);
      const b=document.createElement("button"); b.className="m2Card";
      b.style.setProperty("--c", vis.color);
      const nuevo = (m.id!=null && NOVEDADES[m.id]) ? `<span class="m2New">Nuevo</span>` : "";
      const pr = progresoMateria(m);
      const dato = pr ? `<small>${pr.done} de ${pr.total} temas</small>` : "";
      const barra = pr ? `<span class="m2CardBar" title="${pr.done} de ${pr.total} temas"><i style="width:${pr.pct}%"></i></span>` : "";
      b.innerHTML=`${nuevo}<span class="m2CardIcon"><img src="assets/materias/${vis.img}.png" alt="" aria-hidden="true"></span>`
        + `<b>${escapeHtml(capMateria(limpiaNombreMateria(m.nombre)))}</b>${dato}${barra}`;
      b.onclick=()=>abrirMateria(m);
      g.appendChild(b);
    });
  }
  // Línea de contexto del encabezado: dato real y tranquilo, nunca un badge decorativo.
  function resumenMaterias(lista){
    const n = lista.length;
    if(!n) return "";
    const conProgreso = lista.filter(m=>{ const p=progresoMateria(m); return p && p.done>0; }).length;
    const base = `${n} ${n===1?"materia":"materias"}`;
    return conProgreso ? `${base} · ${conProgreso} ${conProgreso===1?"empezada":"empezadas"}` : base;
  }
  function pintarMaterias(){
    origen = "actual";
    $("#volverActual").classList.add("hidden");
    // Cumbre es el "adelanta en vacaciones" cuando hay track (5to/1er año). Si no hay
    // track de Cumbre para el próximo grado, se muestra el adelántate viejo como respaldo.
    const track = cumbreTrack();
    $("#cumbreWrap").classList.toggle("hidden", !track);
    $("#destacadaWrap").classList.toggle("hidden", !!track || !siguienteGradoLabel());
    $("#erroresWrap").classList.toggle("hidden", !MIS_ERRORES.length);
    if(SESION && SESION.fuente==="manual"){ pintarMateriasManuales(); return; }  // Camino B
    $("#materiasHead").textContent = "Tus materias";
    const lista = SESION.materias||[];
    $("#materiasSub").textContent = resumenMaterias(lista);
    gridMaterias(lista);
  }

  // ───────── Camino B: materias creadas a mano (cuentas nativas) ─────────
  const MAT_EMOJIS = ["📐","🔢","📖","🔬","🌎","🎨","🎵","💻","🏃","⚗️","🧮","🗣️"];
  let MAT_EMOJI_SEL = MAT_EMOJIS[0];
  async function pintarMateriasManuales(){
    $("#materiasHead").textContent = "Mis materias";
    $("#materiasSub").textContent = "";
    const g=$("#gridMaterias"); g.innerHTML=`<p class="m2Empty">Cargando…</p>`;
    let mats=[];
    try{
      const r=await fetch(API_MANUAL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"materias",token:SESION.token})});
      const d=await r.json(); mats=Array.isArray(d.materias)?d.materias:[];
    }catch(_){}
    g.innerHTML="";
    if(!mats.length){ const e=document.createElement("p"); e.className="m2Empty"; e.textContent="Todavía no tenés materias. Creá la primera y estudiá con tus propios apuntes."; g.appendChild(e); }
    else $("#materiasSub").textContent = resumenMaterias(mats);
    mats.forEach(m=>{
      const mo={ nombre:m.nombre, nombreCorto:"", temas:[], _manual:true, _id:m.id, emoji:m.emoji };
      const b=document.createElement("button"); b.className="m2Card"; b.style.setProperty("--c", m.color||colorMateria(m.nombre));
      // El emoji acá es elección del niño y vive en la BD (no es iconografía nuestra); si no eligió, va la placa 3D.
      b.innerHTML=`<span class="m2CardIcon">${m.emoji?escapeHtml(m.emoji):`<img src="assets/materias/${homeMateriaVisual(m.nombre).img}.png" alt="" aria-hidden="true">`}</span>`
        + `<b>${escapeHtml(capMateria(m.nombre))}</b>`;
      b.onclick=()=>abrirMateria(mo);
      g.appendChild(b);
    });
    const add=document.createElement("button"); add.className="m2Card m2Card--nueva";
    add.innerHTML=`<span class="m2CardIcon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg></span><b>Nueva materia</b>`;
    add.onclick=abrirMatModal;
    g.appendChild(add);
  }
  function abrirMatModal(){
    MAT_EMOJI_SEL = MAT_EMOJIS[0];
    $("#matNombre").value=""; $("#matMsg").innerHTML="";
    const cont=$("#matEmojis"); cont.innerHTML="";
    MAT_EMOJIS.forEach(e=>{
      const b=document.createElement("button"); b.type="button"; b.className="matEmojiBtn"+(e===MAT_EMOJI_SEL?" sel":""); b.textContent=e;
      b.onclick=()=>{ MAT_EMOJI_SEL=e; cont.querySelectorAll(".matEmojiBtn").forEach(x=>x.classList.toggle("sel", x.textContent===e)); };
      cont.appendChild(b);
    });
    $("#matModal").classList.remove("hidden");
    setTimeout(()=>{ try{ $("#matNombre").focus(); }catch(_){} }, 60);
  }
  function cerrarMatModal(){ $("#matModal").classList.add("hidden"); }
  async function guardarMateriaManual(){
    const nombre=($("#matNombre").value||"").trim(); const msg=$("#matMsg");
    if(!nombre){ msg.innerHTML=errBox("Escribí el nombre de la materia."); return; }
    const btn=$("#btnGuardarMat"); btn.disabled=true; const t=btn.textContent; btn.textContent="Creando…";
    try{
      const r=await fetch(API_MANUAL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"materia_guardar",token:SESION.token,materia:{nombre,emoji:MAT_EMOJI_SEL}})});
      const d=await r.json();
      if(d && d.ok){ cerrarMatModal(); pintarMateriasManuales(); }
      else { msg.innerHTML=errBox((d&&d.error)||"No se pudo crear."); }
    }catch(_){ msg.innerHTML=errBox("Error de red. Reintentá."); }
    finally{ btn.disabled=false; btn.textContent=t; }
  }
  $("#btnCerrarMat") && ($("#btnCerrarMat").onclick=cerrarMatModal);
  $("#matModal") && ($("#matModal").onclick=(e)=>{ if(e.target===$("#matModal")) cerrarMatModal(); });
  $("#btnGuardarMat") && ($("#btnGuardarMat").onclick=guardarMateriaManual);
  $("#matNombre") && $("#matNombre").addEventListener("keydown",(e)=>{ if(e.key==="Enter") guardarMateriaManual(); });

  // ───────── adelantar próximo año (lee el currículo guardado) ─────────
  $("#btnProximo").onclick = entrarProximo;
  // El "volver" del modo próximo año ahora vive en el HTML (antes se inyectaba con el
  // encabezado): se cablea una sola vez y pintarMaterias() lo vuelve a ocultar.
  $("#volverActual") && ($("#volverActual").onclick = ()=>{ pintarMaterias(); window.scrollTo({top:0,behavior:"smooth"}); });
  async function entrarProximo(){
    const grado = siguienteGradoLabel();
    if(!grado) return;
    const btn = $("#btnProximo"); btn.disabled = true;
    try{
      const r = await fetch(API_CURRICULO,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ grado })});
      const d = await r.json();
      const mats = (d.materias||[]).map(m=>({ nombre:m.materia, nombreCorto:m.nombre_corto, grupos:(m.temas&&m.temas.grupos)||[], _proximo:true }));
      // El "Puente" (refuerzo del salto de grado) va PRIMERO: es lo primero que
      // conviene que hagan los niños. Orden estable → el resto queda como venía.
      const esPuente = m=>/puente/i.test(m.nombre||"") ? 0 : 1;
      mats.sort((a,b)=>esPuente(a)-esPuente(b));
      origen = "proximo"; proximoGrado = grado;
      cargarCuradoInfo(grado);   // guía revisada del próximo grado (si la hubiera)
      $("#destacadaWrap").classList.add("hidden");
      $("#cumbreWrap").classList.add("hidden");
      $("#erroresWrap").classList.add("hidden");
      $("#volverActual").classList.remove("hidden");
      $("#materiasHead").textContent = grado;
      $("#materiasSub").textContent = "Próximo año · adelántate en vacaciones";
      if(!mats.length){ $("#gridMaterias").innerHTML = `<p class="m2Empty">Todavía no tenemos ${escapeHtml(grado)} cargado. ¡Pronto!</p>`; }
      else gridMaterias(mats);
      window.scrollTo({top:0,behavior:"smooth"});
    }catch(e){
      $("#gridMaterias").innerHTML = errBox("No pudimos cargar el próximo año. Intenta otra vez.", String(e.message||e));
    }finally{ btn.disabled=false; }
  }

  function verMaterias(){ $("#paneTemas").classList.add("hidden"); $("#paneErrores").classList.add("hidden"); $("#paneCumbre").classList.add("hidden"); $("#paneMaterias").classList.remove("hidden"); }

  // ───────── Cumbre: "adelanta en vacaciones" (SOLO contenido curado; Gemini nunca toca Cumbre) ─────────
  $("#btnCumbre").onclick = entrarCumbre;
  // volver al Inicio desde Cumbre: repinta materias (resetea origen="actual" para no dejar
  // el flujo en modo cumbre) y muestra la grilla del aula.
  $("#btnBackCumbre").onclick = ()=>{ pintarMaterias(); verMaterias(); };
  let CUMBRE_MATERIAS = [];     // materias del track (para el render y los clicks)
  let cumbreModosTema = [];     // modos disponibles del tema abierto en Cumbre
  let CUMBRE_OPEN_MI = null;    // índice de la materia abierta (para reabrirla al volver y ver la nota)
  let CUMBRE_NOTAS = new Map(); // notas del Demuestra por (materia|tema) del niño; sincroniza por cuenta (server)
  // Cumbre es SOLO curado: los botones NO dicen "crear/inventar" (eso es IA), sino "leer/empezar".
  const CUMBRE_VERBO = { resumen:"📖 Leer el resumen", retos:"🎯 Empezar a practicar", quiz:"🎮 Empezar el quiz", examen:"📋 Empezar el examen" };
  const CUMBRE_CARGA = { resumen:"Abriendo tu resumen", retos:"Abriendo tu práctica", quiz:"Abriendo tu quiz", examen:"Abriendo tu examen" };
  async function entrarCumbre(){
    $("#paneMaterias").classList.add("hidden");
    $("#paneErrores").classList.add("hidden");
    $("#paneTemas").classList.add("hidden");
    $("#paneCumbre").classList.remove("hidden");
    $("#cumbreIntro").innerHTML = `<p class="labLoad">Cargando…</p>`;
    $("#cumbreMaterias").innerHTML = "";
    window.scrollTo({top:0,behavior:"smooth"});
    const track = cumbreTrack();
    try{
      const [ri, rt] = await Promise.all([
        fetch(API_CURRICULO,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ accion:"cumbre_intro" })}),
        track ? fetch(API_CURRICULO,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ accion:"cumbre_track", track })}) : Promise.resolve(null),
        cargarNotasCumbre(),   // notas del niño para el badge por tema (sincroniza por cuenta)
      ]);
      const di = await ri.json();
      const dt = rt ? await rt.json() : { materias:[] };
      renderCumbreIntro(di.intro||{});
      CUMBRE_MATERIAS = (dt && dt.materias) || [];
      renderCumbreMaterias(CUMBRE_MATERIAS);
    }catch(e){ renderCumbreIntro({}); renderCumbreMaterias([]); }
  }
  function renderCumbreIntro(x){
    // el ícono de montaña grande (cumMonte) ya está arriba → quitamos la 🏔️ del título para no repetir.
    const titulo = ((x.titulo || "Cumbre").replace(/[\u{1F3D4}\u{FE0F}]/gu, "").trim()) || "Cumbre";
    const bajada = x.bajada || "La mejor educación del mundo, para ti.";
    const track = cumbreTrack();
    const badge = track ? `<span class="cumGrado">🎓 Materias de ${escapeHtml(track)}</span>` : "";
    let html = `<div class="cumHero"><div class="cumMonte">🏔️</div><h2 class="cumTit">${escapeHtml(titulo)}</h2><p class="cumBaj">${escapeHtml(bajada)}</p>${badge}</div>`;
    if(x.texto_nino) html += `<p class="cumPar">${escapeHtml(x.texto_nino)}</p>`;
    if(x.cierre) html += `<p class="cumCierre">${escapeHtml(x.cierre)}</p>`;
    if(x.texto_padre){
      html += `<details class="cumMas"><summary>Para los padres</summary><p class="cumPar">${escapeHtml(x.texto_padre)}</p></details>`;
    }
    $("#cumbreIntro").innerHTML = html;
  }
  // materias del track de Cumbre con sus dominios/temas. Curados = practicables (📗);
  // sin curar = "Próximamente" (Gemini nunca los genera). Índices para evitar comillas en atributos.
  function renderCumbreMaterias(materias, openMi){
    const cont = $("#cumbreMaterias"); cont.innerHTML = "";
    if(!materias.length){ cont.innerHTML = `<div class="empty">Tus materias de Cumbre están en camino. ¡Pronto! ✨</div>`; return; }
    materias.forEach((m, mi)=>{
      const card = document.createElement("div"); card.className = "cMat";  // plegada por defecto
      const prog = `${m.curados||0} de ${m.total||0} listo${(m.total===1)?"":"s"}`;
      const head = document.createElement("button"); head.type="button"; head.className="cMatHead";
      head.setAttribute("aria-expanded","false");
      head.innerHTML = `<span class="em"><img src="assets/materias/${homeMateriaVisual(m.materia).img}.png" alt="" aria-hidden="true"></span><span class="cMatNom">${escapeHtml(m.materia)}</span><span class="cMatProg">${prog}</span><span class="cMatChevron">▾</span>`;
      const body = document.createElement("div"); body.className="cMatBody";
      let html = "";
      (m.dominios||[]).forEach((dom, di)=>{
        const temas = dom.temas||[]; if(!temas.length) return;
        html += `<div class="cDom">${escapeHtml(dom.dominio||"")}</div>`;
        temas.forEach((t, ti)=>{
          if(t.curado){
            const nf = notaCumbre(m.materia, t.tema);
            const notaHtml = (nf!=null) ? `<span class="cNota ${colorNota(Math.round(nf*20))}">${Math.round(nf*20)}/20</span>` : "";
            html += `<button class="cTema ok" data-mi="${mi}" data-di="${di}" data-ti="${ti}"><span class="cBadge">📗</span><span class="cNom">${escapeHtml(t.tema)}</span><span class="cTemaR">${notaHtml}<span class="cGo">Practicar ›</span></span></button>`;
          }
          else html += `<div class="cTema no"><span class="cNom">${escapeHtml(t.tema)}</span><span class="cSoon">Próximamente</span></div>`;
        });
      });
      body.innerHTML = html;
      head.onclick = ()=>{ const op=card.classList.toggle("open"); head.setAttribute("aria-expanded", String(op)); };
      body.querySelectorAll(".cTema.ok").forEach(btn=>{
        btn.onclick = ()=>{
          const mm = CUMBRE_MATERIAS[+btn.dataset.mi]; if(!mm) return;
          const tt = ((mm.dominios[+btn.dataset.di]||{}).temas||[])[+btn.dataset.ti]; if(!tt) return;
          CUMBRE_OPEN_MI = +btn.dataset.mi;
          abrirTemaCumbre(mm.materia, mm.grado, tt.tema, tt.modos||[]);
        };
      });
      card.appendChild(head); card.appendChild(body);
      cont.appendChild(card);
    });
    // reabrir la materia en la que veníamos (al volver de un tema) para ver la nota recién sacada
    if(openMi!=null){ const c=cont.querySelectorAll(".cMat")[openMi]; if(c){ c.classList.add("open"); const h=c.querySelector(".cMatHead"); if(h) h.setAttribute("aria-expanded","true"); c.scrollIntoView({behavior:"smooth",block:"nearest"}); } }
  }
  // abrir un tema curado de Cumbre para practicar (reusa el panel de tema, en modo "cumbre")
  function abrirTemaCumbre(mat, grado, tema, modos){
    origen = "cumbre";
    materiaSel = { nombre:mat, grado, _cumbre:true };
    temaSel = tema; clearOtro();
    cumbreModosTema = (modos && modos.length) ? modos : ["resumen"];
    fotos = []; $("#results").innerHTML = "";
    $("#paneCumbre").classList.add("hidden");
    const pt = $("#paneTemas"); pt.classList.add("cumbre"); pt.classList.remove("hidden");
    $("#tituloMateria").innerHTML = `🏔️ ${escapeHtml(mat)} · ${escapeHtml(tema)}`;
    const first = ["resumen","retos","quiz","examen"].find(id=>cumbreModosTema.includes(id)) || cumbreModosTema[0];
    setModoCumbre(first);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function pintarModosCumbre(){
    const cont = $("#modos"); cont.innerHTML="";
    MODOS.filter(mo=>cumbreModosTema.includes(mo.id)).forEach((mo, idx)=>{
      const b=document.createElement("button");
      b.className="modo"; b.dataset.modo=mo.id; b.setAttribute("aria-pressed", String(mo.id===modoSel));
      b.innerHTML=`<span class="pmNum">${idx+1}</span><span class="pmIcon">${mo.icon}</span>`+
        `<span class="pmTxt"><span class="pmNom">${mo.nombre}</span><span class="pmDesc">${mo.desc}</span></span><span class="pmEstado"></span>`;
      b.onclick=()=>setModoCumbre(mo.id);
      cont.appendChild(b);
    });
  }
  function setModoCumbre(id){
    modoSel = id;
    const mo = MODOS.find(m=>m.id===id) || MODOS[0];
    $("#pasoCantidad").classList.toggle("hidden", !mo.conteo);
    pintarModosCumbre();
    const btnGen=$("#btnGen"); if(btnGen){ btnGen.textContent = CUMBRE_VERBO[id] || mo.verbo; btnGen.disabled=false; }
  }
  // generar contenido de Cumbre: SOLO curado (programa=cumbre); reusa render(). Nunca IA/caché.
  async function generarCumbre(){
    const mat=(materiaSel&&materiaSel.nombre)||"", tema=temaSel, gr=(materiaSel&&materiaSel.grado)||"";
    if(!tema) return;
    const mo = MODOS.find(m=>m.id===modoSel) || MODOS[0];
    const res=$("#results"), btnGen=$("#btnGen");
    if(btnGen) btnGen.disabled=true;
    res.innerHTML = vistaCargando(tema, { ...mo, carga: CUMBRE_CARGA[modoSel] || "Abriendo" }, false);
    try{
      const body = { materia:mat, tema, grado:gr, cantidad, modo:modoSel, programa:"cumbre", usuario_id:(SESION&&SESION.id)||null };
      const r = await fetch(API_GENERAR,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      let d; try{ d = await r.json(); }catch(_){ throw new Error("El servidor tardó demasiado. Prueba de nuevo."); }
      if(r.status===403 && d && d.premium){ res.innerHTML = avisoPremium(); return; }
      if(d.error){ throw new Error(d.error); }
      if(d.sinItems || d.sinBanco){ res.innerHTML = `<div class="empty">Este tema todavía no está listo en este modo. ¡Pronto! ✨</div>`; return; }
      render(d);
      // muro: avanzar en un tema de Cumbre (practica/quiz/examen, no el resumen) es un logro
      if(modoSel!=="resumen") publicarMuro("cumbre", {materia:mat, tema});
    }catch(e){
      res.innerHTML = errBox("No pudimos cargar esto. Intenta de nuevo.", String(e.message||e));
    }finally{ if(btnGen) btnGen.disabled=false; }
  }
  $("#btnBack").onclick = ()=>{
    if(origen==="cumbre"){                 // del tema de Cumbre → volver a la lista de materias de Cumbre
      const pt=$("#paneTemas"); pt.classList.remove("cumbre"); pt.classList.add("hidden");
      temaSel=null; $("#results").innerHTML="";
      renderCumbreMaterias(CUMBRE_MATERIAS, CUMBRE_OPEN_MI);   // repinta para mostrar la nota recién sacada, reabriendo la materia
      $("#paneCumbre").classList.remove("hidden");
      window.scrollTo({top:0,behavior:"smooth"});
      return;
    }
    temaSel=null; $("#results").innerHTML=""; fotos=[]; pintarFotos(); limpiarRefuerzo(); verMaterias();
  };

  function abrirMateria(m){
    $("#paneTemas").classList.remove("cumbre");   // por si veníamos de un tema de Cumbre
    materiaSel=m; temaSel=null; clearOtro(); $("#results").innerHTML="";
    fotos=[]; pintarFotos();
    const esProx = origen==="proximo";
    if(!esProx) marcarAulaVista(m);   // abrirla marca las novedades 🆕 como vistas
    // banner de refuerzo: solo si esta materia es la de la nota floja
    if(REFUERZO && norm(m.nombre)!==norm(REFUERZO.materia||"")) limpiarRefuerzo();
    else pintarRefuerzoBanner();
    $("#tituloMateria").innerHTML = `${homeMarcaMateria(m.nombre,"em")}<span>${escapeHtml(capMateria(limpiaNombreMateria(m.nombre)))}</span>`;
    $("#tituloMateria").style.setProperty("--c", homeMateriaVisual(m.nombre).color);
    // las fotos del cuaderno solo aplican a las materias actuales
    $("#pasoFotos").classList.toggle("hidden", esProx);
    if(esProx){
      lapsoMap = {};
      const grupos = m.grupos||[];
      pintarGruposProximo(grupos);
      const hay = grupos.some(g=>(g.temas||[]).length);
      $("#sinTemas").classList.toggle("hidden", hay);
    }else{
      lapsoMap = construirLapsoMap(m);
      const temas = temasPracticables(m);
      $("#sinTemas").classList.toggle("hidden", temas.length>0);
      pintarGrupos(temas);
    }
    setModo("resumen");   // al abrir (sin tema) se preselecciona "Aprende"
    checkReady();
    $("#paneMaterias").classList.add("hidden"); $("#paneTemas").classList.remove("hidden");
    window.scrollTo({top:0,behavior:"smooth"});
  }

  // temas del próximo año (currículo guardado: grupos por lapso) — acordeón.
  // Cada tema puede ser un string (temario viejo) o {t:"título", d:"enfoque"}: el
  // "enfoque" (subtemas, nivel, errores típicos) se guarda en PROX_DESC y se manda
  // como contexto a la IA para que genere ESPECÍFICO y no genérico.
  let PROX_DESC = {};
  function pintarGruposProximo(grupos){
    const cont = $("#grupos"); cont.innerHTML="";
    PROX_DESC = {};
    const varios = grupos.length>1;
    const mkChip=(x)=>{
      const t = (x && typeof x==="object") ? x.t : x;
      if(x && typeof x==="object" && x.d) PROX_DESC[norm(t)] = x.d;
      const b=document.createElement("button"); b.className="chip"; b.setAttribute("aria-pressed","false");
      b.textContent=t; b.dataset.tema=t;
      b.onclick=()=>{ temaSel=(temaSel===t)?null:t; clearOtro(); alSeleccionarTema(); };
      return b;
    };
    grupos.forEach((g,idx)=>{
      const temas=g.temas||[];
      if(varios && g.lapso){
        const chips=crearLapso(cont, g.lapso, temas.length, false);
        temas.forEach(t=>chips.appendChild(mkChip(t)));
      }else{
        const chips=document.createElement("div"); chips.className="chips";
        temas.forEach(t=>chips.appendChild(mkChip(t)));
        cont.appendChild(chips);
      }
    });
    marcarChips();
  }

  // crea un lapso desplegable (acordeón) y devuelve el contenedor donde poner los chips
  function crearLapso(cont, titulo, n, abierto){
    const wrap=document.createElement("div"); wrap.className="lapso"+(abierto?" open":"");
    const head=document.createElement("button"); head.type="button"; head.className="lapHead";
    head.setAttribute("aria-expanded", String(!!abierto));
    head.innerHTML=`<span>${escapeHtml(titulo)}</span><span class="lapRight">${n} ${n===1?"tema":"temas"} <span class="lapChevron">▾</span></span>`;
    const chips=document.createElement("div"); chips.className="chips";
    head.onclick=()=>{ const op=wrap.classList.toggle("open"); head.setAttribute("aria-expanded", String(op)); };
    wrap.appendChild(head); wrap.appendChild(chips); cont.appendChild(wrap);
    return chips;
  }

  // temas agrupados por lapso (cada lapso es un menú desplegable; todos cerrados al inicio)
  function pintarGrupos(temas){
    const cont = $("#grupos"); cont.innerHTML="";
    const grupos = new Map();
    temas.forEach(t=>{
      const lap = lapsoMap[norm(t.seccion)] || "Otros temas";
      if(!grupos.has(lap)) grupos.set(lap, []);
      grupos.get(lap).push(t);
    });
    const orden = [...grupos.keys()].sort((a,b)=>ordenLapso(a)-ordenLapso(b));
    const varios = orden.length>1;
    const mkChip=(t)=>{
      const b=document.createElement("button");
      b.className="chip"; b.setAttribute("aria-pressed","false");
      b.textContent=t.seccion; b.dataset.tema=t.seccion;
      b.onclick=()=>{ temaSel=(temaSel===t.seccion)?null:t.seccion; clearOtro(); alSeleccionarTema(); };
      return b;
    };
    orden.forEach((lap,idx)=>{
      const items=grupos.get(lap);
      if(varios){
        const chips=crearLapso(cont, lap, items.length, false);
        items.forEach(t=>chips.appendChild(mkChip(t)));
      }else{
        const chips=document.createElement("div"); chips.className="chips";
        items.forEach(t=>chips.appendChild(mkChip(t)));
        cont.appendChild(chips);
      }
    });
    marcarChips();
  }
  function pintarChips(){ $("#grupos").querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed", String(c.dataset.tema===temaSel))); }

  // ───────── ruta de aprendizaje ─────────
  // Devuelve {modo, motivo} — motivo es el texto corto del badge.
  function pasoSugerido(materia, tema){
    const p = PROGRESO.get(norm(materia)+"|"+norm(tema));
    if(!p || !p.modos.size)        return { modo:"resumen", motivo:"Empieza aquí" };
    if(!p.modos.has("retos"))      return { modo:"retos",   motivo:"Te toca practicar" };
    if(!p.modos.has("quiz"))       return { modo:"quiz",    motivo:"Ponte a prueba" };
    if((p.quizMejor ?? 0) < 0.8)   return { modo:"quiz",    motivo:"Repite y sube tu nota" };
    if(!p.modos.has("examen"))     return { modo:"examen",  motivo:"¡Listo para el examen!" };
    return { modo:"examen", motivo:"Tema dominado ⭐" };
  }
  function pintarModos(){
    const cont = $("#modos"); cont.innerHTML="";
    const mat=(materiaSel&&materiaSel.nombre)||"";
    const tema=temaActual();
    const p = tema ? PROGRESO.get(norm(mat)+"|"+norm(tema)) : null;
    const sug = tema ? pasoSugerido(mat, tema) : null;
    MODOS.forEach((mo,idx)=>{
      const hecho = p && p.modos.has(mo.id);
      const esSug = sug && sug.modo===mo.id;
      const b=document.createElement("button");
      b.className="modo"; b.dataset.modo=mo.id; b.setAttribute("aria-pressed", String(mo.id===modoSel));
      b.innerHTML=`<span class="pmNum">${idx+1}</span><span class="pmIcon">${mo.icon}</span>`+
        `<span class="pmTxt"><span class="pmNom">${mo.nombre}</span><span class="pmDesc">${mo.desc}</span></span>`+
        `<span class="pmEstado">${esSug?`<span class="pmRec">✨ ${escapeHtml(sug.motivo)}</span>`:``}${hecho?`<span class="pmCheck">✓</span>`:``}</span>`;
      b.onclick=()=>setModo(mo.id);
      cont.appendChild(b);
    });
  }
  function setModo(id){
    modoSel = id;
    const mo = MODOS.find(m=>m.id===id) || MODOS[0];
    $("#pasoCantidad").classList.toggle("hidden", !mo.conteo);   // el resumen no lleva cantidad
    pintarModos();
    pintarAcciones();   // ajusta los botones "Guía revisada" / "Con IA" según el tema+modo
  }
  // al elegir un tema, recalcula el paso sugerido y lo preselecciona (chips)
  function alSeleccionarTema(){
    pintarChips(); checkReady();
    const tema=temaActual();
    if(tema) setModo(pasoSugerido((materiaSel&&materiaSel.nombre)||"", tema).modo);
    else pintarModos();
  }

  // el campo "datos clave" solo aparece cuando hay un tema libre escrito
  function toggleOtroDatos(){ const w=$("#otroDatosWrap"); if(w) w.classList.toggle("hidden", !$("#otro").value.trim()); }
  // limpia el tema libre y sus datos clave (al elegir un chip o cambiar de materia)
  function clearOtro(){ const o=$("#otro"); if(o) o.value=""; const d=$("#otroDatos"); if(d) d.value=""; toggleOtroDatos(); }
  $("#otro").addEventListener("input", ()=>{ if($("#otro").value.trim()){ temaSel=null; } toggleOtroDatos(); pintarChips(); checkReady(); pintarModos(); });
  $("#count").querySelectorAll("button").forEach(btn=>{
    btn.onclick=()=>{ cantidad=Number(btn.dataset.n); $("#count").querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b===btn))); };
  });

  function temaActual(){ return $("#otro").value.trim() || temaSel; }
  function checkReady(){ pintarAcciones(); }

  // ───────── caché local (en el teléfono) ─────────
  // ───────── contenido curado (guía revisada por nosotros) ─────────
  // normaliza IGUAL que el servidor (herramientas/normcurado.mjs) para casar temas.
  function normCurado(s){
    return String(s||"").replace(/\b[1-6]\s*[GA]\b/gi," ")
      .normalize("NFD").replace(/[̀-ͯ]/g,"")
      .replace(/\s+/g," ").trim().toLowerCase();
  }
  let CURADO_INFO = {};              // grado -> { "mnorm||tnorm": [modos] }
  async function cargarCuradoInfo(grado){
    if(!grado || CURADO_INFO[grado]!==undefined) return;
    CURADO_INFO[grado] = {};         // marca "en curso" para no pedirlo dos veces
    try{
      const r = await fetch(API_CURADO_INFO,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({grado})});
      const d = await r.json(); CURADO_INFO[grado] = d.temas||{};
    }catch(_){ CURADO_INFO[grado] = {}; }
    repintarProgreso();              // repinta chips para mostrar el sello 📗
  }
  function modosCurados(mat, tema){
    const map = CURADO_INFO[gradoActivo()]||{};
    return map[`${normCurado(mat)}||${normCurado(tema)}`] || [];
  }
  function temaTieneGuia(mat, tema){ return modosCurados(mat, tema).length>0; }
  function temaModoCurado(){
    const mat=(materiaSel&&materiaSel.nombre)||""; const tema=temaActual();
    return !!tema && modosCurados(mat, tema).includes(modoSel);
  }
  // "vistos": firmas de items de la guía ya mostrados, para NO repetir (por tema+modo).
  const VISTOS_KEY = "curado_vistos_v1";
  function vistosKey(mat,tema,modo,grado){ return [normCurado(mat),normCurado(tema),modo,grado].join("|"); }
  function vistosDe(mat,tema,modo,grado){ const all=store.get(VISTOS_KEY)||{}; return all[vistosKey(mat,tema,modo,grado)]||[]; }
  function acumularVistos(mat,tema,modo,grado,d){
    const sigs=(d.preguntas||d.ejercicios||[]).map(x=>x&&x._sig).filter(Boolean);
    if(!sigs.length) return;
    const all=store.get(VISTOS_KEY)||{}; const k=vistosKey(mat,tema,modo,grado);
    const set=new Set(all[k]||[]); sigs.forEach(s=>set.add(s)); all[k]=[...set];
    store.set(VISTOS_KEY, all);
  }
  // "recientes": textos de los ejercicios/preguntas que la niña ACABA de ver (por
  // tema+modo, en memoria de la sesión). Se mandan a la IA en la próxima tanda para
  // que NO los repita — Gemini no recuerda entre llamadas: sin esto, pedir 5 y luego
  // 3 del mismo tema repetía ejercicios.
  const RECIENTES = new Map();
  function recKey(mat,tema,modo){ return [norm(mat),norm(tema),modo].join("|"); }
  function recientesDe(mat,tema,modo){ return RECIENTES.get(recKey(mat,tema,modo))||[]; }
  function acumularRecientes(mat,tema,modo,d){
    const items=(d.ejercicios||d.preguntas||[]).map(x=>x&&(x.enunciado||x.pregunta)).filter(Boolean);
    if(!items.length) return;
    const k=recKey(mat,tema,modo); const arr=RECIENTES.get(k)||[];
    for(const it of items) if(!arr.includes(it)) arr.push(it);
    RECIENTES.set(k, arr.slice(-20));   // solo lo más reciente
  }
  // muestra/oculta el botón "Guía revisada" y ajusta el de "Con IA" según el tema+modo
  function pintarAcciones(){
    const tema=temaActual();
    const btnGuia=$("#btnGuia"), btnGen=$("#btnGen"); if(!btnGen) return;
    const mo=MODOS.find(m=>m.id===modoSel)||MODOS[0];
    const hayGuia = temaModoCurado() && !(fotos.length>0);
    if(btnGuia){ btnGuia.classList.toggle("hidden", !hayGuia); btnGuia.disabled = !tema; }
    btnGen.textContent = hayGuia ? "✨ Con IA" : mo.verbo;
    btnGen.disabled = !tema;
    // la explicación "¿cuál elijo?" solo tiene sentido cuando hay las dos opciones
    const info=$("#accInfo"); if(info){ info.classList.toggle("hidden", !hayGuia); if(!hayGuia) info.open=false; }
  }

  // ───────── GENERAR ─────────
  $("#btnGuia").onclick = ()=>generar({via:"guia"});
  // en modo Cumbre el botón usa el flujo aislado (solo curado); en el aula, el de siempre.
  $("#btnGen").onclick  = ()=> origen==="cumbre" ? generarCumbre() : generar({via:"ia"});
  async function generar(opts){
    opts = opts||{};
    const tema = temaActual(); if(!tema) return;
    const mo = MODOS.find(m=>m.id===modoSel) || MODOS[0];
    const esProx = origen==="proximo";
    const esLibre = !!$("#otro").value.trim();
    const usaFotos = !esProx && fotos.length>0;
    // dos caminos: "guia" (soloCurado, sin repetir) o "ia" (sinCurado, Gemini).
    // Con fotos del cuaderno → siempre IA (son apuntes personales de la niña).
    let via = opts.via || (temaModoCurado() ? "guia" : "ia");
    if(usaFotos) via = "ia";
    const mat=(materiaSel&&materiaSel.nombre)||"General"; const gr=gradoActivo();
    // tema libre: pasamos "datos clave" como contexto para la IA (más fotos).
    const datosClave = ($("#otroDatos") && $("#otroDatos").value.trim()) || "";
    // próximo año: el "enfoque" del tema (subtemas, nivel, errores típicos del
    // temario) va como contexto para que la IA genere específico, no genérico.
    const descProx = esProx ? (PROX_DESC[norm(tema)] || "") : "";
    const contexto = esProx ? (descProx ? { materia:mat, tema, resumen:descProx, datosClave:descProx } : null)
      : esLibre ? { materia:mat, tema, resumen:datosClave, datosClave }
      : construirContexto(tema);
    ultimoContexto = contexto;

    const res=$("#results"); const btnGuia=$("#btnGuia"), btnGen=$("#btnGen");
    if(btnGuia) btnGuia.disabled=true; btnGen.disabled=true;
    let cool=0;
    res.innerHTML = vistaCargando(tema, mo, usaFotos);
    try{
      const body = { materia:mat, tema, grado:gr, cantidad, contexto, modo:modoSel,
        token:(!esProx && SESION && SESION.token)||null, fotos: esProx?[]:fotos,
        usuario_id:(SESION&&SESION.id)||null };
      if(via==="guia"){ body.soloCurado=true; body.vistos=vistosDe(mat,tema,modoSel,gr); }
      else {
        body.sinCurado=true; body.nocache=!!opts.nocache;
        // lo que acaba de ver en este tema+modo → la IA no lo repite (el server además
        // salta la lectura del caché para no servirle una tanda vieja con los mismos)
        if(modoSel!=="resumen"){
          const rec = recientesDe(mat,tema,modoSel);
          if(rec.length) body.recientes = rec.slice(-12);
        }
      }
      // refuerzo activo + fotos = son fotos del EXAMEN CORREGIDO (la IA ataca lo que falló)
      if(REFUERZO && usaFotos) body.examenFoto=true;
      const r = await fetch(API_GENERAR,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      let d;
      try { d = await r.json(); }
      catch(_){ throw new Error("El servidor tardó demasiado o se cayó. Prueba de nuevo en un momentico."); }
      if(r.status===403 && d && d.premium){ res.innerHTML = avisoPremium(); return; }
      if(d.error){ const er=new Error(d.error); er.code=d.code; er.retryAfter=d.retryAfter; throw er; }
      // el alumno ya gastó su presupuesto de IA del mes → seguir con guías/lo cacheado
      if(d.ia){ IA_ESTADO=d.ia; pintarEnergiaIA(); }   // refresca la batería de energía IA
      if(d.limiteIA){ renderLimite(res); return; }
      // guía agotada, o el tema no tiene guía → ofrecer seguir con IA
      if(d.sinItems || d.sinBanco){ renderHandoff(res, d); return; }
      if(via==="guia" && d.curado) acumularVistos(mat,tema,modoSel,gr,d);
      if(modoSel!=="resumen") acumularRecientes(mat,tema,modoSel,d);   // para que la próxima tanda no repita
      render(d);
    }catch(e){
      if(e.code===503 && !opts._retry){
        cool = -1;
        await new Promise(r=>setTimeout(r,1500));
        return generar({...opts,_retry:true});   // saturación transitoria: reintenta una vez
      }
      if(e.code===429){
        cool = Math.min(Math.max(e.retryAfter||10, 5), 60);
        res.innerHTML = errBox(`Llegaste al límite gratis del momento. Espera ${cool} segundos y vuelve a intentar. ⏳`);
      }else{
        res.innerHTML = errBox("Uy, no llegó. Intenta otra vez en un momentico.", String(e.message||e));
      }
    }finally{ if(cool>0){ enfriar(btnGen, cool); } else if(cool===0){ pintarAcciones(); } }
  }
  // el alumno llegó a su tope diario de práctica con IA: mensaje amable (no queda
  // bloqueado — sigue teniendo las guías revisadas 📗 y todo lo que ya practicó; mañana
  // se le reinicia el cupo).
  function renderLimite(res){
    res.innerHTML="";
    const box=document.createElement("div"); box.className="handoff";
    box.innerHTML=`<p class="hoTit">Por hoy ya practicaste bastante con IA 🎈</p><p class="hoSub">¡Mañana tienes más! Mientras tanto puedes seguir con las Guías revisadas 📗 y con todo lo que ya practicaste.</p>`;
    res.appendChild(box);
    res.scrollIntoView({behavior:"smooth",block:"nearest"});
  }
  // guía agotada o tema sin guía: mensaje + botón para seguir con IA
  function renderHandoff(res, d){
    res.innerHTML="";
    const box=document.createElement("div"); box.className="handoff";
    const tit = d.sinBanco ? "Este tema todavía no tiene guía revisada 📗" : "¡Completaste toda la guía revisada! 🎉";
    const sub = d.sinBanco ? "¿Quieres practicar con ejercicios generados por IA?" : "¿Quieres seguir practicando con ejercicios nuevos hechos por IA?";
    box.innerHTML=`<p class="hoTit">${tit}</p><p class="hoSub">${sub}</p>`;
    const b=document.createElement("button"); b.className="go"; b.textContent="✨ Seguir con IA";
    b.onclick=()=>generar({via:"ia", nocache:true});
    box.appendChild(b); res.appendChild(box);
    res.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  // contexto real del tema (lo que la alumna está viendo)
  function construirContexto(tema){
    const t = (materiaSel.temas||[]).find(x=>x.seccion===tema);
    if(!t) return { materia:materiaSel.nombre, tema };
    const ignorar = new Set(["subsection","forum","label"]);
    const actividades = (t.modulos||[])
      .filter(m=>!ignorar.has(m.tipo))
      .map(m=>({
        nombre:m.nombre, tipo:m.tipo, descripcion:stripHtml(m.descripcionHtml),
        archivoUrl:(m.archivos && m.archivos[0] && m.archivos[0].url) || null,
        modificado:(m.archivos && m.archivos[0] && m.archivos[0].modificado) || null
      }));
    return {
      materia: materiaSel.nombre,
      lapso: lapsoMap[norm(tema)] || null,
      tema,
      resumen: stripHtml(t.resumenHtml),
      actividades
    };
  }

  // ───────── RENDER (despacha según el modo) ─────────
  let ultimoCurado=false, ultimoAgotado=false;   // para el botón "otros" (guía vs IA)
  function render(d){
    ultimoCurado = !!d.curado; ultimoAgotado = !!d.agotado;
    const res=$("#results"); res.innerHTML="";
    const modo = d.modo || modoSel;
    renderBanner(res, d.fuentes, d.basadoEnMaterial, d.apuntes, d.curado, modo);
    const meta = { materia:d.materia, tema:d.tema, grado:gradoActivo() };
    if(modo==="resumen"){      renderResumen(res, d); registrarActividad(meta, "resumen"); }
    else if(modo==="examen"){  renderExamen(res, d.preguntas||[], meta); renderOtros(res); }
    else if(modo==="quiz")     renderQuiz(res, d.preguntas||[], meta);   // "otros" se agrega al terminar
    else {                     renderRetos(res, d.ejercicios||[], meta); renderOtros(res); }
    if(modo!=="quiz") renderFooter(res);   // el quiz cierra con su nota + mensaje
    res.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function renderBanner(res, fuentes, basado, apuntes, curado, modo){
    const pdfs = Array.isArray(fuentes) ? fuentes : [];
    const acts = (ultimoContexto && ultimoContexto.actividades) ? ultimoContexto.actividades : [];
    const apunte = apuntes ? `<li>📓 + tus apuntes del cuaderno</li>` : "";
    let html = "", esIA = !curado;
    if(curado){
      // banco preparado y revisado por nosotros: se aclara su origen (base sólida) como señal de confianza
      const items = pdfs.slice(0,4).map(f=>`<li>${escapeHtml(f)}</li>`).join("");
      html = `<p class="t">✅ Guía de estudio revisada</p><p class="sub">La preparamos nosotros con una IA más avanzada y la revisamos para que sea correcta y completa: es tu base sólida del tema.</p>${items?`<ul>${items}</ul>`:""}`;
    }else if(pdfs.length){
      const items = pdfs.slice(0,4).map(f=>`<li>${escapeHtml(f)}</li>`).join("");
      html = `<p class="t">📄 Basado en tus guías de clase</p><ul>${items}${apunte}</ul>`;
    }else if(apuntes){
      const items = acts.slice(0,4).map(a=>`<li>${escapeHtml(a.nombre)}</li>`).join("");
      html = `<p class="t">📓 Basado en tus apuntes del cuaderno</p>${items?`<ul>${items}</ul>`:""}`;
    }else if(basado && acts.length){
      const items = acts.slice(0,4).map(a=>`<li>${escapeHtml(a.nombre)}</li>`).join("");
      const extra = acts.length>4 ? `<li>…y ${acts.length-4} más</li>` : "";
      html = `<p class="t">🔗 Basado en tu clase</p><ul>${items}${extra}</ul>`;
    }else{
      // IA pura (tema del próximo año por título, o tema sin guía): que quede claro que es al momento
      html = `<p class="t">✨ Creado con IA en el momento</p><p class="sub">Contenido nuevo hecho por inteligencia artificial, distinto cada vez. Ideal para practicar más.</p>`;
    }
    // cuando es IA con material real, se agrega la aclaración de que la actividad se generó al momento
    if(esIA && (pdfs.length || apuntes || (basado && acts.length))) html += `<p class="sub ia">✨ Ejercicios creados con IA en el momento.</p>`;
    // explicación breve del botón Reportar (solo donde aparece: práctica/quiz/examen, con sesión, no Cumbre)
    if(puedeReportar() && (modo==="retos"||modo==="quiz"||modo==="examen"))
      html += `<p class="sub rep">🚩 ¿Un ejercicio salió mal o no se entiende? Toca <b>Reportar</b> (dos toques para confirmar) y te damos otro en su lugar.</p>`;
    if(html){ const b=document.createElement("div"); b.className="basado"+(esIA?" ia":""); b.innerHTML=html; res.appendChild(b); }
  }
  function renderFooter(res){
    const f=document.createElement("p"); f.className="footer";
    f.textContent=`¡Tú puedes, ${(SESION.nombre||"").split(" ")[0]||""}! 🌟`;
    res.appendChild(f);
  }

  // ───────── reportar contenido malo (retos / quiz / examen) ─────────
  // Si un ejercicio o pregunta está malo (mal redactado, incorrecto, lo que sea),
  // cualquiera lo reporta con la banderita: el reporte queda en Supabase (tabla
  // reportes_contenido, la revisamos aparte) y ESE ítem —solo ese— se regenera con
  // IA (cantidad 1 + "recientes" para no repetir lo de pantalla) y se reemplaza al
  // momento. Excluidos: resúmenes y Cumbre (la IA no la toca).
  function puedeReportar(){ return origen!=="cumbre" && !MODO_LAB && SESION && SESION.id!=null; }
  function enviarReporte(item, meta, modo){
    try{ fetch(API_ACTIVIDAD,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({
      accion:"reportar_item", usuario_id:SESION.id, materia:(meta&&meta.materia)||null,
      tema:(meta&&meta.tema)||null, grado:(meta&&meta.grado)||gradoActivo(), modo,
      origen: ultimoCurado?"guia":"ia", item })}); }catch(_){}
  }
  async function regenerarItem(meta, modo){
    const mat=(meta&&meta.materia)||"General", tema=(meta&&meta.tema)||"", gr=(meta&&meta.grado)||gradoActivo();
    const body={ materia:mat, tema, grado:gr, cantidad:1, contexto:ultimoContexto, modo,
      token:(SESION&&SESION.token)||null, fotos:[], usuario_id:(SESION&&SESION.id)||null,
      sinCurado:true, nocache:true, recientes:recientesDe(mat,tema,modo).slice(-12), porReporte:true };
    try{
      const r=await fetch(API_GENERAR,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const d=await r.json().catch(()=>null);
      if(!d || d.error || d.limiteIA) return null;
      if(d.ia){ IA_ESTADO=d.ia; pintarEnergiaIA(); }
      const nuevo=(Array.isArray(d.ejercicios)&&d.ejercicios[0])||(Array.isArray(d.preguntas)&&d.preguntas[0])||null;
      if(nuevo) acumularRecientes(mat,tema,modo,d);   // que el próximo cambio tampoco lo repita
      return nuevo;
    }catch(_){ return null; }
  }
  // Banderita por tarjeta. getItem() da el ítem vigente; alReemplazar(nuevo) lo repinta.
  // Si soloReporte() da true (quiz ya terminado, la nota ya quedó), guarda el reporte
  // sin regenerar. Doble toque = confirmación (evita reportes por toques accidentales).
  function zonaReporte(getItem, meta, modo, alReemplazar, soloReporte){
    if(!puedeReportar()) return null;
    const b=document.createElement("button"); b.type="button"; b.className="repBtn";
    b.textContent="🚩 Reportar"; b.title="¿Está malo este ejercicio? Repórtalo y te doy otro";
    b.onclick=async ()=>{
      if(b.dataset.busy) return;
      if(!b.dataset.arm){
        b.dataset.arm="1"; b.classList.add("arm"); b.textContent="¿Cambiarlo por otro? Toca de nuevo";
        setTimeout(()=>{ if(!b.dataset.busy){ delete b.dataset.arm; b.classList.remove("arm"); b.textContent="🚩 Reportar"; } }, 4500);
        return;
      }
      b.dataset.busy="1"; b.disabled=true;
      enviarReporte(getItem(), meta, modo);   // el reporte se guarda SIEMPRE (aunque el cambio falle)
      if(soloReporte && soloReporte()){ b.textContent="¡Gracias! Quedó reportado ✔"; return; }
      b.textContent="Cambiándolo…";
      const nuevo=await regenerarItem(meta, modo);
      if(nuevo){ alReemplazar(nuevo); }
      else{
        delete b.dataset.busy; delete b.dataset.arm; b.classList.remove("arm"); b.disabled=false;
        b.textContent="Reportado ✔ · no pude cambiarlo, prueba luego";
        setTimeout(()=>{ b.textContent="🚩 Reportar"; }, 3400);
      }
    };
    return b;
  }

  function renderRetos(res, ejercicios, meta){
    if(!ejercicios.length){ res.appendChild(vacio("No llegaron retos. Intenta otra vez.")); return; }
    let registrado=false;
    ejercicios.forEach((e,i)=>{
      const c=tarjeta(i);
      const llenar=(e)=>{
        c.innerHTML=`<div class="cardTop"><span class="tag">🎯 Reto ${i+1}</span></div>
          <p class="q">${escapeHtml(e.enunciado||"")}</p>
          ${figuraHTML(e.figura)}
          <div class="reveals">
            ${e.pista?`<button class="mini hint">💡 Pista</button>`:``}
            <button class="mini ans">✅ Ver respuesta</button>
          </div>
          ${e.pista?`<div class="reveal hint"><b>💡 Pista:</b> ${escapeHtml(e.pista)}</div>`:``}
          <div class="reveal ans"><b>Respuesta:</b> ${escapeHtml(e.solucion||"")}</div>`;
        const h=c.querySelector(".mini.hint"), a=c.querySelector(".mini.ans");
        if(h) h.onclick=()=>{ c.querySelector(".reveal.hint").classList.add("show"); h.disabled=true; };
        a.onclick=()=>{ c.querySelector(".reveal.ans").classList.add("show"); a.disabled=true;
          if(!registrado){ registrado=true; registrarActividad(meta, "retos"); } };
        const z=zonaReporte(()=>ejercicios[i], meta, "retos", (nuevo)=>{ ejercicios[i]=nuevo; llenar(nuevo); });
        if(z) c.querySelector(".cardTop").appendChild(z);
      };
      llenar(e);
      res.appendChild(c);
    });
  }

  function renderExamen(res, preguntas, meta){
    let registrado=false;
    if(!preguntas.length){ res.appendChild(vacio("No llegaron preguntas. Intenta otra vez.")); return; }
    preguntas.forEach((p,i)=>{
      const c=tarjeta(i);
      const llenar=(p)=>{
        c.innerHTML=`<div class="cardTop"><span class="tag t2">📋 Pregunta ${i+1}</span></div>
          <p class="q">${escapeHtml(p.pregunta||"")}</p>
          <div class="reveals"><button class="mini ans">✅ Ver respuesta</button></div>
          <div class="reveal ans"><b>Respuesta:</b> ${escapeHtml(p.respuesta||"")}${p.explicacion?`<div class="comoRes"><b>✏️ Cómo se resuelve:</b> ${escapeHtml(p.explicacion)}</div>`:``}</div>`;
        const a=c.querySelector(".mini.ans");
        a.onclick=()=>{ c.querySelector(".reveal.ans").classList.add("show"); a.disabled=true;
          if(!registrado){ registrado=true; registrarActividad(meta, "examen"); } };
        const z=zonaReporte(()=>preguntas[i], meta, "examen", (nuevo)=>{ preguntas[i]=nuevo; llenar(nuevo); });
        if(z) c.querySelector(".cardTop").appendChild(z);
      };
      llenar(p);
      res.appendChild(c);
    });
  }

  function renderResumen(res, d){
    const c=document.createElement("div"); c.className="sumCard";
    // Chispa "leyendo" acompaña el resumen (compañera de estudio; presencia única en esta vista).
    let html=`<div class="sumHead"><img class="sumChispa" src="${chispaPoseSrc('leyendo')}" alt="" aria-hidden="true"><span class="tag t2">📝 Resumen</span></div>`;
    if(d.titulo) html+=`<h2>${escapeHtml(d.titulo)}</h2>`;
    if(d.intro)  html+=`<p class="sumIntro">${escapeHtml(d.intro)}</p>`;
    const secciones = Array.isArray(d.secciones) ? d.secciones : [];
    if(secciones.length){
      html+=secciones.map(s=>{
        const pasos = Array.isArray(s.pasos) ? s.pasos : [];
        return `<div class="sumSec">
          ${s.titulo?`<h3>${escapeHtml(s.titulo)}</h3>`:``}
          ${s.explicacion?`<p>${escapeHtml(s.explicacion)}</p>`:``}
          ${figuraHTML(s.figura)}
          ${pasos.length?`<ol class="sumPasos">${pasos.map(p=>`<li>${escapeHtml(p)}</li>`).join("")}</ol>`:``}
          ${s.ejemplo?`<div class="sumEj"><b>✏️ Ejemplo:</b> ${escapeHtml(s.ejemplo)}</div>`:``}
        </div>`;
      }).join("");
    }
    // compat: resúmenes viejos (cacheados) traen "puntos" en vez de "secciones"
    const puntos = Array.isArray(d.puntos) ? d.puntos : [];
    if(!secciones.length && puntos.length){
      html+=`<ul class="sumPts">${puntos.map(p=>`<li>${escapeHtml(p)}</li>`).join("")}</ul>`;
    }
    if(d.idea_clave) html+=`<div class="sumKey"><b>💡 Lo más importante:</b> ${escapeHtml(d.idea_clave)}</div>`;
    c.innerHTML=html;
    res.appendChild(c);
  }

  function renderQuiz(res, preguntas, meta){
    if(!preguntas.length){ res.appendChild(vacio("No llegó el quiz. Intenta otra vez.")); return; }
    const estado = { resp:0, ok:0, total:preguntas.length, fallidas:[], done:false };
    const score=document.createElement("div"); score.className="score";
    score.textContent=`Puntaje: 0/${estado.total}`;
    res.appendChild(score);

    preguntas.forEach((p,i)=>{
      const c=tarjeta(i);
      const llenar=(p)=>{
        const opciones = Array.isArray(p.opciones) ? p.opciones : [];
        const correcta = Number(p.correcta);
        delete c.dataset.done;
        const letras="ABCDE";
        c.innerHTML=`<div class="cardTop"><span class="tag t3">🎮 Pregunta ${i+1}</span></div>
          <p class="q">${escapeHtml(p.pregunta||"")}</p>
          ${figuraHTML(p.figura)}
          <div class="opts">${opciones.map((o,j)=>`<button class="opt"><span class="letra">${letras[j]||"•"}</span><span>${escapeHtml(o)}</span></button>`).join("")}</div>
          ${p.explicacion?`<div class="qexp"><b>¿Por qué?</b> ${escapeHtml(p.explicacion)}</div>`:``}`;
        const btns=[...c.querySelectorAll(".opt")];
        btns.forEach((b,j)=>{
          b.onclick=()=>{
            if(c.dataset.done) return;
            c.dataset.done="1";
            btns.forEach((x,k)=>{ x.disabled=true; if(k===correcta) x.classList.add("ok"); });
            if(j!==correcta){
              b.classList.add("bad");
              estado.fallidas.push({ i, pregunta:p.pregunta, opciones, correcta, elegida:j, explicacion:p.explicacion, figura:p.figura });
            }
            const exp=c.querySelector(".qexp"); if(exp) exp.classList.add("show");
            estado.resp++; if(j===correcta) estado.ok++;
            score.textContent=`Puntaje: ${estado.ok}/${estado.total}`;
            if(estado.resp===estado.total){ estado.done=true; mostrarResultadoQuiz(res, estado, meta); }
          };
        });
        // banderita: si el quiz YA terminó solo guarda el reporte (la nota ya quedó);
        // si no, cambia la pregunta y, si ya estaba respondida, descuenta su aporte.
        const z=zonaReporte(()=>preguntas[i], meta, "quiz", (nuevo)=>{
          if(c.dataset.done){
            estado.resp--;
            const fIdx=estado.fallidas.findIndex(f=>f.i===i);
            if(fIdx>=0) estado.fallidas.splice(fIdx,1); else estado.ok--;
            score.textContent=`Puntaje: ${estado.ok}/${estado.total}`;
          }
          preguntas[i]=nuevo; llenar(nuevo);
        }, ()=>estado.done);
        if(z) c.querySelector(".cardTop").appendChild(z);
      };
      llenar(p);
      res.appendChild(c);
    });
  }

  // nota (sobre 20) + mensaje de motivación al terminar el quiz
  function mostrarResultadoQuiz(res, estado, meta){
    // guarda lo que falló para "repasar mis errores" y refresca el contador
    if(estado.fallidas && estado.fallidas.length){ guardarErrores(estado.fallidas, meta).then(cargarErrores); }
    // registra el quiz con su nota (alimenta la ruta de aprendizaje y las marcas ⭐)
    registrarActividad(meta, "quiz", { aciertos:estado.ok, total:estado.total });
    const pct = estado.total ? estado.ok/estado.total : 0;
    const nota = Math.max(1, Math.round(pct*20));
    let msg;
    if(pct>=0.9)      msg="¡Excelente! 🌟 Dominaste el tema.";
    else if(pct>=0.7) msg="¡Muy bien! 💪 Vas por buen camino.";
    else if(pct>=0.5) msg="¡Bien! 📚 Sigue practicando un poquito más.";
    else              msg="¡No te rindas! 🙌 Repasa y vuelve a intentarlo.";
    const emo = pct>=0.7 ? "celebrando" : "animando";
    const c=document.createElement("div"); c.className="card quizFin";
    c.style.animationDelay="0.05s";
    c.innerHTML=`<img class="chispaFin" src="${chispaSrc(emo)}" alt="" aria-hidden="true">
      <span class="tag t3">🎉 ¡Terminaste!</span>
      <p class="q">Nota: ${nota}/20 · acertaste ${estado.ok} de ${estado.total}</p>
      <div class="sumKey"><b>${escapeHtml(msg)}</b></div>`;
    res.appendChild(c);
    if(!MODO_LAB) renderOtros(res);   // en el cuarto no hay "generar otros"
    c.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  // ───────── vistas auxiliares ─────────
  function tarjeta(i){ const c=document.createElement("div"); c.className="card"; c.style.animationDelay=(i*0.08)+"s"; return c; }
  function vacio(t){ const d=document.createElement("div"); d.className="empty"; d.textContent=t; return d; }
  function vistaCargando(tema, mo, conFotos){
    const extra = conFotos ? " y leyendo tus apuntes" : "";
    return `<div class="loading"><img class="chispaThinking" src="${chispaSrc('pensando')}" alt="" aria-hidden="true">
      <div>${escapeHtml(mo.carga)} de <b>${escapeHtml(tema)}</b>${extra}…</div>
      <div class="dots"><span></span><span></span><span></span></div></div>
      ${[0,1,2].map(()=>`<div class="skel"><div class="bar s"></div><div class="bar m"></div><div class="bar l"></div></div>`).join("")}`;
  }

  // ───────── fotos del cuaderno (apuntes) ─────────
  // Comprime la imagen en el teléfono (más liviana = más rápido y barato) y la deja en base64.
  function comprimirImagen(file, maxLado=1600, calidad=0.82){
    return new Promise((resolve,reject)=>{
      const img=new Image(); const url=URL.createObjectURL(file);
      img.onload=()=>{
        URL.revokeObjectURL(url);
        let w=img.naturalWidth||img.width, h=img.naturalHeight||img.height;
        const m=Math.max(w,h); if(m>maxLado){ const r=maxLado/m; w=Math.round(w*r); h=Math.round(h*r); }
        const c=document.createElement("canvas"); c.width=w; c.height=h;
        c.getContext("2d").drawImage(img,0,0,w,h);
        const dataUrl=c.toDataURL("image/jpeg", calidad);
        resolve({ mime:"image/jpeg", data:dataUrl.split(",")[1] });
      };
      img.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("no se pudo leer la imagen")); };
      img.src=url;
    });
  }
  function pintarFotos(){
    const cont=$("#fotos"); if(!cont) return; cont.innerHTML="";
    fotos.forEach((f,i)=>{
      const d=document.createElement("div"); d.className="thumb";
      d.innerHTML=`<img src="data:${f.mime};base64,${f.data}" alt="apunte ${i+1}"><button title="Quitar" aria-label="Quitar foto">×</button>`;
      d.querySelector("button").onclick=()=>{ fotos.splice(i,1); pintarFotos(); };
      cont.appendChild(d);
    });
    const add=$("#addFoto"); if(add) add.classList.toggle("hidden", fotos.length>=MAX_FOTOS);
    pintarAcciones();   // con fotos → solo "Con IA" (los apuntes son personales)
  }
  $("#fotoInput").addEventListener("change", async (e)=>{
    const files=[...(e.target.files||[])];
    for(const f of files){
      if(fotos.length>=MAX_FOTOS) break;
      if(!/^image\//.test(f.type||"")) continue;
      try{ fotos.push(await comprimirImagen(f)); }catch(_){}
    }
    e.target.value="";
    pintarFotos();
  });
  function errBox(titulo, detalle){
    return `<div class="err"><span class="ico">😅</span><div>${escapeHtml(titulo)}${detalle?`<small>${escapeHtml(detalle)}</small>`:""}</div></div>`;
  }
  function avisoBox(titulo){
    return `<div class="aviso"><span class="ico">🔑</span><div>${escapeHtml(titulo)}</div></div>`;
  }
  // tras un 429 (límite por minuto), bloquea el botón con cuenta regresiva para no empeorar el límite
  function enfriar(btn, segs){
    const txt = (MODOS.find(m=>m.id===modoSel)||MODOS[0]).verbo;
    let s = segs; btn.disabled=true; btn.textContent=`⏳ Espera ${s}s…`;
    const id=setInterval(()=>{
      s--;
      if(s<=0){ clearInterval(id); btn.textContent=txt; btn.disabled = !temaActual(); }
      else btn.textContent=`⏳ Espera ${s}s…`;
    },1000);
  }
  // botón para regenerar SIN caché — variedad bajo demanda (retos/examen/quiz)
  function botonOtros(txt, fn, alt){
    const b=document.createElement("button"); b.className="otros"+(alt?" ia":"");
    b.textContent=txt; b.onclick=fn; return b;
  }
  function renderOtros(res){
    if(origen==="cumbre") return;   // Cumbre es SOLO curado: nada de "otra de la guía" ni "con IA"
    const wrap=document.createElement("div"); wrap.className="otrosWrap";
    if(ultimoCurado){
      // lo mostrado vino de nuestra guía: "otra de la guía" (sin repetir) o pasar a IA
      wrap.appendChild(botonOtros("📗 Otra de la guía", ()=>generar({via:"guia"})));
      wrap.appendChild(botonOtros("✨ Con IA", ()=>generar({via:"ia", nocache:true}), true));
    }else{
      wrap.appendChild(botonOtros("✨ Otros con IA", ()=>generar({via:"ia", nocache:true})));
    }
    res.appendChild(wrap);
  }
  // figura SVG segura: se rendea como imagen (data URI) → los scripts del SVG NO se ejecutan así
  function figuraHTML(svg){
    if(!svg || typeof svg!=="string") return "";
    const s=svg.trim();
    if(!/^<svg[\s>]/i.test(s) || s.length>20000) return "";
    const limpio=s.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi,"");
    return `<div class="figura"><img src="data:image/svg+xml;utf8,${encodeURIComponent(limpio)}" alt="figura del ejercicio" loading="lazy"></div>`;
  }

  // ───────── helpers de datos ─────────
  function temasPracticables(m){
    return (m.temas||[]).filter(t=>{
      if(!t.seccion || /^general$/i.test(t.seccion.trim())) return false;
      if(/\blapso\b/i.test(t.seccion)) return false;
      return (t.modulos||[]).some(mod=>["page","resource","url"].includes(mod.tipo));
    });
  }
  function construirLapsoMap(m){
    const map={};
    (m.temas||[]).forEach(sec=>{
      if(!/\blapso\b/i.test(sec.seccion||"")) return;
      (sec.modulos||[]).forEach(mod=>{ if(mod.tipo==="subsection" && mod.nombre) map[norm(mod.nombre)]=sec.seccion.trim(); });
    });
    return map;
  }
  function ordenLapso(s){ s=(s||"").toLowerCase();
    if(s.includes("primer")) return 1; if(s.includes("segundo")) return 2; if(s.includes("tercer")) return 3; return 9; }

  function esNumerica(nombre){ return /matemát|matemat|lógic|logic|olimpiad/i.test(nombre||""); }

  // grado de la sesión: G = grado (primaria), A = año (bachillerato)
  const ORDN={1:"1er",2:"2do",3:"3er",4:"4to",5:"5to",6:"6to"};
  function infoGrado(){
    for(const m of (SESION&&SESION.materias)||[]){
      const mm=`${m.nombreCorto||""} ${m.nombre||""}`.match(/\b([1-6])\s*([GA])\b/i);
      if(mm) return { n:+mm[1], tipo:mm[2].toUpperCase() };
    }
    // cuenta nativa: el grado viene como string en SESION.grado ("5to grado" / "1er año")
    const g = (SESION && SESION.grado) || "";
    const ma = g.match(/([1-6])\D*(grado|a[nñ]o)/i);
    if(ma) return { n:+ma[1], tipo: /a[nñ]o/i.test(ma[2]) ? "A" : "G" };
    return null;
  }
  function gradoDeSesion(){
    const g=infoGrado(); if(!g) return "";
    return g.tipo==="A" ? `${ORDN[g.n]} año` : `${ORDN[g.n]} grado`;
  }
  // el grado que le toca el próximo año (6to grado → 1er año; 5to año no tiene siguiente)
  function siguienteGradoLabel(){
    const g=infoGrado(); if(!g) return null;
    if(g.tipo==="G") return g.n<6 ? `${ORDN[g.n+1]} grado` : "1er año";
    return g.n<5 ? `${ORDN[g.n+1]} año` : null;
  }
  // Tracks de Cumbre que existen hoy (2 pistas). El "adelanta en vacaciones" es Cumbre
  // cuando el próximo grado tiene track; si no, cae al temario oficial viejo (respaldo).
  const CUMBRE_TRACKS = new Set(["5to grado", "1er año"]);
  function cumbreTrack(){ const g = siguienteGradoLabel(); return (g && CUMBRE_TRACKS.has(g)) ? g : null; }
  // grado con el que se genera/cachea según el modo (actual vs próximo año)
  function gradoActivo(){ return origen==="proximo" ? (proximoGrado||"") : (gradoDeSesion()||"4to grado"); }

  // ───────── helpers de texto / estilo ─────────
  function norm(s){ return String(s||"").replace(/\s+/g," ").trim().toLowerCase(); }
  function stripHtml(s){ return String(s==null?"":s).replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&[a-z]+;/g," ").replace(/\s+/g," ").trim(); }
  // nombre de materia para mostrar: sin el sufijo de grado y en MAYÚSCULAS (uniforme
  // con las del aula, que ya vienen así). Solo display — el matching usa norm().
  function limpiaNombreMateria(s){ return (String(s||"").replace(/\s*\b[1-6]\s*[GA]\b\s*$/i,"").trim() || String(s||"")).toUpperCase(); }

  function iconMateria(nombre){
    const n=(nombre||"").toLowerCase();
    const map=[["pensar","🧠"],["lógic","🧠"],["logic","🧠"],["matemát","🔢"],["matemat","🔢"],["lenguaje","📖"],["castellano","📖"],
      ["lengua","📖"],["inglés","🔤"],["ingles","🔤"],["natural","🔬"],["social","🌎"],["cienc","🔬"],
      ["educación f","⚽"],["educacion f","⚽"],["físic","🧲"],["fisic","🧲"],["químic","⚗️"],["quimic","⚗️"],
      ["biolog","🌱"],["geograf","🗺️"],["historia","🗺️"],["metodolog","🔍"],["orientac","🧭"],
      ["electrón","⚡"],["electron","⚡"],["puente","🌉"],
      ["estétic","🎨"],["estetic","🎨"],["arte","🎨"],["músic","🎵"],["music","🎵"],["religi","✝️"],
      ["informát","💻"],["informat","💻"],["robót","🤖"],["robot","🤖"],["emocional","💗"],
      ["lideraz","🎤"],["comunic","🎤"],["olimpiad","🏅"],
      ["caligraf","✍️"],["lectura","📚"],["escritura","✏️"],["dibujo","🖍️"],["valores","💛"]];
    for(const [k,e] of map){ if(n.includes(k)) return e; }
    return "📘";
  }
  function colorMateria(nombre){
    // Chispa 2.0: una sola fuente de verdad para el color de materia (§8 de la spec).
    return homeMateriaVisual(nombre).color;
  }
  // Color por perfil (según el nombre) para que las cuentas se distingan.
  function colorCuenta(nombre){
    const pal=["#12B5A4","#7C4DFF","#FF6B3D","#3A8DFF","#E84CA0","#1FA86A","#F4A300"];
    const s=(nombre||"").toLowerCase(); let h=0;
    for(let i=0;i<s.length;i++) h=(h*31+s.charCodeAt(i))>>>0;
    return pal[h%pal.length];
  }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

  // ───────── CUARTO DE PRUEBAS (admin, oculto en #lab) ─────────
  // Panel de administración privado (oculto en la ruta #lab): aprobar el acceso de cada
  // alumno y ver/ajustar su consumo de IA. La clave se valida server-side (api/lab) y vive
  // solo en memoria (se re-pide al recargar; no se guarda en el aparato).
  const API_LAB = "https://aula-cam.vercel.app/api/lab";   // endpoint único (accion: check/usuarios/usuario_set)
  let LAB_CLAVE = "";
  let LAB_USUARIOS = [];

  function entrarLab(){
    MODO_LAB = true;
    ["#vLanding","#vLogin","#vHome","#vPendiente"].forEach(id=>{ const e=$(id); if(e) e.classList.add("hidden"); });
    $("#vLab").classList.remove("hidden");
    $("#labApp").classList.add("hidden"); $("#labLogin").classList.remove("hidden");
    $("#labErr").classList.add("hidden");
    setTimeout(()=>{ try{ $("#labClave").focus(); }catch(_){} }, 60);
  }
  async function labLogin(){
    const clave=($("#labClave").value||"").trim(); if(!clave) return;
    const btn=$("#labEntrar"); btn.disabled=true; $("#labErr").classList.add("hidden");
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"check",clave})});
      if(!r.ok){ $("#labErr").classList.remove("hidden"); return; }
      LAB_CLAVE=clave;
      $("#labLogin").classList.add("hidden"); $("#labApp").classList.remove("hidden");
      labTab("usuarios");
    }catch(_){ $("#labErr").classList.remove("hidden"); }
    finally{ btn.disabled=false; }
  }
  // ───────── panel de USUARIOS (aprobar acceso + consumo de IA) ─────────
  async function labCargarUsuarios(){
    const body=$("#labBody"); body.innerHTML=`<p class="labLoad">Cargando…</p>`;
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"usuarios",clave:LAB_CLAVE})});
      if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
      const d=await r.json(); LAB_USUARIOS=Array.isArray(d.usuarios)?d.usuarios:[]; labPintarUsuarios();
    }catch(_){ body.innerHTML=errBox("No se pudieron cargar los usuarios. Reintenta."); }
  }
  function labFecha(iso){
    if(!iso) return "—";
    try{ const d=new Date(iso); return d.toLocaleDateString("es-VE",{day:"2-digit",month:"short"})+" "+d.toLocaleTimeString("es-VE",{hour:"2-digit",minute:"2-digit"}); }
    catch(_){ return "—"; }
  }
  function labPintarUsuarios(){
    const body=$("#labBody"); body.innerHTML="";
    // los "en revisión" primero (para aprobarlos rápido), luego por acceso más reciente
    const us=LAB_USUARIOS.slice().sort((a,b)=> (a.autorizado?1:0)-(b.autorizado?1:0));
    const pend=us.filter(u=>!u.autorizado).length;
    const head=document.createElement("p"); head.className="labNota";
    head.textContent=`${us.length} usuario(s) · ${pend} en revisión`;
    body.appendChild(head);
    if(!us.length){ const e=document.createElement("div"); e.className="empty"; e.textContent="Aún no hay usuarios. Aparecen al iniciar sesión."; body.appendChild(e); return; }
    us.forEach(u=>body.appendChild(labCardUsuario(u)));
  }
  function labCardUsuario(u){
    const card=document.createElement("div"); card.className="labUser"+(u.autorizado?"":" pend");
    const ini=((u.nombre||"?").trim().charAt(0)||"?").toUpperCase();
    const top=document.createElement("div"); top.className="labUserTop";
    top.innerHTML=`<span class="labUserAv">${escapeHtml(ini)}</span>`
      +`<span class="labUserInfo"><span class="labUserNom">${escapeHtml(u.nombre||"(sin nombre)")}</span>`
      +`<span class="labUserMeta">${u.accesos} acceso(s) · ${labFecha(u.ultimo_acceso)} · id ${u.id}</span></span>`
      +`<span class="labUserGrado${u.grado?"":" sin"}">${escapeHtml(u.grado||"grado ?")}</span>`;
    card.appendChild(top);

    // acceso
    const rowA=document.createElement("div"); rowA.className="labUserRow";
    const lblA=document.createElement("span"); lblA.className="labUserK"; lblA.textContent="Acceso";
    const btnA=document.createElement("button"); btnA.className="labToggle"+(u.autorizado?" si":" no");
    btnA.textContent=u.autorizado?"✅ Habilitado":"⬜ En revisión";
    btnA.onclick=()=>labSetUsuario(u,{autorizado:!u.autorizado},card);
    rowA.appendChild(lblA); rowA.appendChild(btnA); card.appendChild(rowA);

    // consumo de IA de hoy
    const rowB=document.createElement("div"); rowB.className="labUserRow";
    const lblB=document.createElement("span"); lblB.className="labUserK"; lblB.textContent="IA hoy";
    const gasto=document.createElement("span"); gasto.className="labUserGasto";
    gasto.innerHTML=u.ia_ilimitado
      ? `<span class="labIlim">ilimitada</span>`
      : `$${(u.gasto_hoy||0).toFixed(3)} <span class="labUserMuted">/ $${(u.ia_limite_dia_usd||0).toFixed(2)} día</span>`;
    rowB.appendChild(lblB); rowB.appendChild(gasto); card.appendChild(rowB);

    // editar tope diario + poner/quitar ilimitado
    const rowC=document.createElement("div"); rowC.className="labUserRow labUserEdit";
    const lblC=document.createElement("span"); lblC.className="labUserK"; lblC.textContent="Límite";
    const inp=document.createElement("input"); inp.type="number"; inp.step="0.01"; inp.min="0"; inp.max="5";
    inp.className="labLimInp"; inp.value=(u.ia_limite_dia_usd||0).toFixed(2); inp.disabled=!!u.ia_ilimitado;
    const save=document.createElement("button"); save.className="labLimSave"; save.textContent="Guardar"; save.disabled=!!u.ia_ilimitado;
    save.onclick=()=>{ const v=parseFloat(inp.value); if(!isFinite(v)) return; labSetUsuario(u,{ia_limite_dia_usd:v},card); };
    const ilim=document.createElement("button"); ilim.className="labToggle small"+(u.ia_ilimitado?" si":" no");
    ilim.textContent=u.ia_ilimitado?"∞ ilimitada":"poner ∞";
    ilim.onclick=()=>labSetUsuario(u,{ia_ilimitado:!u.ia_ilimitado},card);
    rowC.appendChild(lblC); rowC.appendChild(inp); rowC.appendChild(save); rowC.appendChild(ilim);
    card.appendChild(rowC);
    return card;
  }
  async function labSetUsuario(u,campos,card){
    card.classList.add("saving");
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"usuario_set", clave:LAB_CLAVE, id:u.id, campos})});
      if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
      const d=await r.json();
      if(d && d.ok){
        Object.assign(u, campos);                 // optimista
        if(d.usuario){                             // y sincroniza con lo que confirmó el server
          u.autorizado=!!d.usuario.autorizado;
          u.ia_ilimitado=!!d.usuario.ia_ilimitado;
          u.ia_limite_dia_usd=Number(d.usuario.ia_limite_dia_usd||0);
        }
        card.replaceWith(labCardUsuario(u));
      }else{ card.classList.remove("saving"); alert("No se pudo guardar. Reintenta."); }
    }catch(_){ card.classList.remove("saving"); alert("Error de red. Reintenta."); }
  }

  // ───────── panel de COLEGIOS (alta/edición de aulas virtuales) ─────────
  let LAB_COLEGIOS=[], LAB_SOLICITUDES=[];
  function labTab(which){
    const tabs={usuarios:"#labTabUsuarios",colegios:"#labTabColegios",solicitudes:"#labTabSolicitudes"};
    const panes={usuarios:"#labBody",colegios:"#labColegios",solicitudes:"#labSolicitudes"};
    Object.keys(tabs).forEach(k=>{
      const tb=$(tabs[k]); if(tb) tb.classList.toggle("on",k===which);
      const pn=$(panes[k]); if(pn) pn.classList.toggle("hidden",k!==which);
    });
    if(which==="usuarios") labCargarUsuarios();
    else if(which==="colegios") labCargarColegios();
    else if(which==="solicitudes") labCargarSolicitudes();
  }
  async function labCargarColegios(){
    const cont=$("#labColegios"); cont.innerHTML=`<p class="labLoad">Cargando…</p>`;
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"colegios",clave:LAB_CLAVE})});
      if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
      const d=await r.json(); LAB_COLEGIOS=Array.isArray(d.colegios)?d.colegios:[]; labPintarColegios();
    }catch(_){ cont.innerHTML=errBox("No se pudieron cargar los colegios. Reintenta."); }
  }
  function labPintarColegios(){
    const cont=$("#labColegios"); cont.innerHTML="";
    const head=document.createElement("div"); head.className="labColHead";
    const t=document.createElement("p"); t.className="labNota"; t.textContent=`${LAB_COLEGIOS.length} colegio(s)`;
    const add=document.createElement("button"); add.className="labNuevoCol"; add.textContent="＋ Nuevo colegio";
    add.onclick=()=>labEditorColegio(null);
    head.appendChild(t); head.appendChild(add); cont.appendChild(head);
    if(!LAB_COLEGIOS.length){ const e=document.createElement("div"); e.className="empty"; e.textContent="Aún no hay colegios. Agregá el primero."; cont.appendChild(e); return; }
    LAB_COLEGIOS.forEach(c=>cont.appendChild(labCardColegio(c)));
  }
  function labCardColegio(c){
    const card=document.createElement("div"); card.className="labCol";
    const badges=[
      c.tiene_moodle?`<span class="labColBadge moodle">Aula Moodle</span>`:`<span class="labColBadge manual">Sin aula</span>`,
      c.verificado?`<span class="labColBadge ok">Verificado</span>`:`<span class="labColBadge pend">Sin verificar</span>`,
    ].join("");
    const lugar=[c.ciudad,c.estado].filter(Boolean).map(escapeHtml).join(", ");
    card.innerHTML=`<div class="labColTop"><span class="labColNom">${escapeHtml(c.nombre||"(sin nombre)")}</span><span class="labColId">id ${c.id}</span></div>`
      +`<div class="labColBadges">${badges}</div>`
      +(lugar?`<div class="labColMeta">${lugar}</div>`:"")
      +(c.moodle_url?`<div class="labColMeta labColUrl">${escapeHtml(c.moodle_url)}</div>`:"");
    const btn=document.createElement("button"); btn.className="labColEdit"; btn.textContent="Editar";
    btn.onclick=()=>labEditorColegio(c);
    card.appendChild(btn);
    return card;
  }
  function labEditorColegio(c){
    const cont=$("#labColegios"); const editing=!!(c&&c.id!=null); c=c||{};
    const mp=(c.mapeo_grados&&typeof c.mapeo_grados==="object")?c.mapeo_grados:{patron:"([1-6])\\s*([GA])\\b",sufijos:{G:"grado",A:"año"}};
    const suf=mp.sufijos||{G:"grado",A:"año"}; const esc=escapeHtml;
    cont.innerHTML="";
    const f=document.createElement("div"); f.className="labColForm";
    f.innerHTML=
       `<h3 class="labColFormH">${editing?"Editar colegio":"Nuevo colegio"}</h3>`
      +`<label class="labF">Nombre<input id="cfNombre" class="labInput2" value="${esc(c.nombre||"")}" placeholder="U.E. ..."></label>`
      +`<div class="labFrow"><label class="labF">Ciudad<input id="cfCiudad" class="labInput2" value="${esc(c.ciudad||"")}"></label>`
      +`<label class="labF">Estado<input id="cfEstado" class="labInput2" value="${esc(c.estado||"")}"></label></div>`
      +`<label class="labFchk"><input id="cfTiene" type="checkbox" ${c.tiene_moodle?"checked":""}> Tiene aula virtual Moodle</label>`
      +`<div id="cfMoodleBox">`
      +  `<label class="labF">URL del aula<input id="cfUrl" class="labInput2" value="${esc(c.moodle_url||"")}" placeholder="https://aula.colegio.edu.ve"></label>`
      +  `<button id="cfProbar" class="labColProbar" type="button">Probar conexión</button>`
      +  `<p id="cfProbeMsg" class="labColProbe hidden"></p>`
      +  `<label class="labF">Patrón de grado (regex)<input id="cfPatron" class="labInput2 mono" value="${esc(mp.patron||"")}"></label>`
      +  `<div class="labFrow"><label class="labF">Sufijo G →<input id="cfSufG" class="labInput2" value="${esc(suf.G||"grado")}"></label>`
      +  `<label class="labF">Sufijo A →<input id="cfSufA" class="labInput2" value="${esc(suf.A||"año")}"></label></div>`
      +`</div>`
      +`<label class="labFchk"><input id="cfVerif" type="checkbox" ${c.verificado?"checked":""}> Verificado (habilita la conexión real)</label>`
      +`<div class="labColFormBtns"><button id="cfGuardar" class="go">Guardar</button><button id="cfCancelar" class="labColCancel" type="button">Cancelar</button></div>`
      +`<p id="cfErr" class="labErr hidden"></p>`
      +(editing?`<button id="cfBorrar" class="labColBorrar" type="button">Eliminar colegio</button>`:"");
    cont.appendChild(f);
    const q=(s)=>f.querySelector(s);
    const syncBox=()=>{ q("#cfMoodleBox").style.display=q("#cfTiene").checked?"":"none"; };
    q("#cfTiene").onchange=syncBox; syncBox();
    q("#cfCancelar").onclick=()=>labPintarColegios();
    q("#cfProbar").onclick=async()=>{
      const url=(q("#cfUrl").value||"").trim(); const msg=q("#cfProbeMsg");
      msg.className="labColProbe"; msg.textContent="Probando…";
      try{
        const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"colegio_probar",clave:LAB_CLAVE,moodle_url:url})});
        if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
        const d=await r.json(); msg.textContent=(d.ok?"✅ ":"⚠️ ")+(d.motivo||""); msg.classList.add(d.ok?"ok":"bad");
      }catch(_){ msg.textContent="No se pudo probar."; msg.classList.add("bad"); }
    };
    q("#cfGuardar").onclick=async()=>{
      const err=q("#cfErr"); err.classList.add("hidden");
      const tiene=q("#cfTiene").checked;
      const colegio={
        nombre:(q("#cfNombre").value||"").trim(),
        ciudad:(q("#cfCiudad").value||"").trim()||null,
        estado:(q("#cfEstado").value||"").trim()||null,
        tiene_moodle:tiene,
        moodle_url:tiene?((q("#cfUrl").value||"").trim()||null):null,
        verificado:q("#cfVerif").checked,
        mapeo_grados:tiene?{patron:(q("#cfPatron").value||"").trim(),sufijos:{G:(q("#cfSufG").value||"grado").trim(),A:(q("#cfSufA").value||"año").trim()}}:null,
      };
      if(editing) colegio.id=c.id;
      if(!colegio.nombre){ err.textContent="Falta el nombre."; err.classList.remove("hidden"); return; }
      const btn=q("#cfGuardar"); btn.disabled=true;
      try{
        const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"colegio_guardar",clave:LAB_CLAVE,colegio})});
        if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
        const d=await r.json();
        if(d&&d.ok){ await labCargarColegios(); }
        else{ err.textContent=(d&&d.error)||"No se pudo guardar."; err.classList.remove("hidden"); btn.disabled=false; }
      }catch(_){ err.textContent="Error de red."; err.classList.remove("hidden"); btn.disabled=false; }
    };
    if(editing) q("#cfBorrar").onclick=async()=>{
      if(!confirm("¿Borrar este colegio? No se puede deshacer.")) return;
      const err=q("#cfErr"); err.classList.add("hidden");
      const btn=q("#cfBorrar"); btn.disabled=true;
      try{
        const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"colegio_borrar",clave:LAB_CLAVE,id:c.id})});
        if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
        const d=await r.json();
        if(d&&d.ok){ await labCargarColegios(); }
        else{ err.textContent=(d&&d.error)||"No se pudo borrar."; err.classList.remove("hidden"); btn.disabled=false; }
      }catch(_){ err.textContent="Error de red."; err.classList.remove("hidden"); btn.disabled=false; }
    };
  }

  // ───────── panel de SOLICITUDES (F3: "agreguen mi colegio") ─────────
  async function labCargarSolicitudes(){
    const cont=$("#labSolicitudes"); cont.innerHTML=`<p class="labLoad">Cargando…</p>`;
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"solicitudes",clave:LAB_CLAVE})});
      if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
      const d=await r.json(); LAB_SOLICITUDES=Array.isArray(d.solicitudes)?d.solicitudes:[]; labPintarSolicitudes();
    }catch(_){ cont.innerHTML=errBox("No se pudieron cargar las solicitudes. Reintenta."); }
  }
  function labPintarSolicitudes(){
    const cont=$("#labSolicitudes"); cont.innerHTML="";
    const pend=LAB_SOLICITUDES.filter(s=>!s.atendida).length;
    const head=document.createElement("p"); head.className="labNota";
    head.textContent=`${LAB_SOLICITUDES.length} solicitud(es) · ${pend} sin atender`;
    cont.appendChild(head);
    if(!LAB_SOLICITUDES.length){ const e=document.createElement("div"); e.className="empty"; e.textContent="Todavía no hay solicitudes de colegio."; cont.appendChild(e); return; }
    // sin atender primero, luego por fecha desc
    LAB_SOLICITUDES.slice().sort((a,b)=>(a.atendida?1:0)-(b.atendida?1:0)).forEach(s=>cont.appendChild(labCardSolicitud(s)));
  }
  function labCardSolicitud(s){
    const card=document.createElement("div"); card.className="labUser"+(s.atendida?"":" pend");
    const top=document.createElement("div"); top.className="labUserTop";
    const aula = s.tiene_aula===true?"🖥️ con aula":(s.tiene_aula===false?"sin aula":"aula ?");
    top.innerHTML=`<span class="labUserInfo"><span class="labUserNom">${escapeHtml(s.colegio||"(sin nombre)")}</span>`
      +`<span class="labUserMeta">${escapeHtml([s.ciudad,s.estado].filter(Boolean).join(", ")||"—")} · ${labFecha(s.creado)}</span></span>`
      +`<span class="labUserGrado${s.tiene_aula==null?" sin":""}">${escapeHtml(aula)}</span>`;
    card.appendChild(top);
    const det=[];
    if(s.moodle_url) det.push(`Aula: ${escapeHtml(s.moodle_url)}`);
    if(s.contacto)   det.push(`Contacto: ${escapeHtml(s.contacto)}`);
    if(s.nota)       det.push(escapeHtml(s.nota));
    if(s.origen_uid) det.push(`(de la cuenta id ${s.origen_uid})`);
    if(det.length){ const p=document.createElement("p"); p.className="labUserMeta"; p.style.padding="0 14px 4px"; p.innerHTML=det.join("<br>"); card.appendChild(p); }
    const row=document.createElement("div"); row.className="labUserRow";
    const at=document.createElement("button"); at.className="labToggle"+(s.atendida?" si":" no");
    at.textContent=s.atendida?"✅ Atendida":"⬜ Marcar atendida";
    at.onclick=()=>labSolicitudSet(s,{atendida:!s.atendida},card);
    const del=document.createElement("button"); del.className="labToggle small no"; del.textContent="🗑 Borrar";
    del.onclick=()=>{ if(confirm("¿Borrar esta solicitud?")) labSolicitudBorrar(s,card); };
    row.appendChild(at); row.appendChild(del); card.appendChild(row);
    return card;
  }
  async function labSolicitudSet(s,campos,card){
    card.classList.add("saving");
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"solicitud_atender",clave:LAB_CLAVE,id:s.id,atendida:campos.atendida})});
      if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
      const d=await r.json();
      if(d&&d.ok){ Object.assign(s,campos); card.replaceWith(labCardSolicitud(s)); }
      else{ card.classList.remove("saving"); alert("No se pudo guardar. Reintenta."); }
    }catch(_){ card.classList.remove("saving"); alert("Error de red. Reintenta."); }
  }
  async function labSolicitudBorrar(s,card){
    card.classList.add("saving");
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"solicitud_borrar",clave:LAB_CLAVE,id:s.id})});
      if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
      const d=await r.json();
      if(d&&d.ok){ LAB_SOLICITUDES=LAB_SOLICITUDES.filter(x=>x.id!==s.id); labPintarSolicitudes(); }
      else{ card.classList.remove("saving"); alert("No se pudo borrar. Reintenta."); }
    }catch(_){ card.classList.remove("saving"); alert("Error de red. Reintenta."); }
  }

  $("#labEntrar").onclick=labLogin;
  $("#labClave").addEventListener("keydown",(e)=>{ if(e.key==="Enter") labLogin(); });
  $("#labTabUsuarios").onclick=()=>labTab("usuarios");
  $("#labTabColegios").onclick=()=>labTab("colegios");
  $("#labTabSolicitudes") && ($("#labTabSolicitudes").onclick=()=>labTab("solicitudes"));
  window.addEventListener("hashchange",()=>{ if(location.hash==="#lab" && !MODO_LAB) entrarLab(); });

  // ───────── arranque (al final: todas las consts/funciones ya están definidas) ─────────
  (function arrancar(){
    // cuarto de pruebas (admin), oculto: si se entra por #lab, no seguir el flujo normal
    if(location.hash === "#lab"){ entrarLab(); return; }
    // flag de cuenta propia (beta): ?beta=1 lo enciende y queda guardado (sobrevive a la PWA)
    if(/[?&]beta=1/.test(location.search)){ try{ store.set("beta", 1); }catch(_){} }
    BETA = store.get("beta") === 1;
    try{
      let s = store.get("sesion");
      if(!(s && s.materias)){
        // migración desde la versión multi-perfil (cuentas/activa)
        const cuentas = store.get("cuentas"); const activa = store.get("activa");
        if(Array.isArray(cuentas) && cuentas.length){
          s = cuentas.find(c=>String(c.id)===String(activa)) || cuentas[0];
          if(s && s.materias) store.set("sesion", s);
        }
        store.del("cuentas"); store.del("activa");
      }
      if(s && s.materias){
        SESION = s; entrarHome();
        // refresco en 2º plano. Nativo (Camino B): SIEMPRE — es liviano (api/cuenta sesion) y toma al
        // instante los cambios que hace el admin (p.ej. subir a premium). Aula (Moodle): solo si la
        // sesión ya tiene sus horas, porque su refresh pega al Moodle lento del colegio.
        const viejo = !s.fetched || (Date.now() - s.fetched > 4*3600*1000);
        if(s.fuente==="manual" || viejo) refrescarMaterias();
        return;
      }
      if(BETA) verBeta();   // sin sesión + flujo nativo → pantalla crear/entrar
    }catch(e){
      // si algo falla al restaurar la sesión, NO congelar: mostrar la landing
      SESION=null; try{ store.del("sesion"); }catch(_){}
      $("#vHome").classList.add("hidden"); $("#vLogin").classList.add("hidden");
      $("#vLanding").classList.remove("hidden");
    }
  })();
