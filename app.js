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
  const MAX_FOTOS = 3;
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
        fetched: Date.now()
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
  function entrarHome(){
    $("#vLanding").classList.add("hidden");
    $("#vLogin").classList.add("hidden");
    $("#vPendiente").classList.add("hidden");
    $("#vHome").classList.remove("hidden");
    origen = "actual";
    const primer = (SESION.nombre||"").split(" ")[0] || "";
    $("#avatar").textContent = (primer[0]||"?").toUpperCase();
    $("#avatar").style.setProperty("--c", colorCuenta(SESION.nombre||primer));
    $("#saludo").innerHTML = `¡Hola, ${escapeHtml(primer)}! 👋`;
    const g = gradoDeSesion();
    $("#gradoBadge").innerHTML = g ? `🎓 ${escapeHtml(g)}` : "";
    $("#gradoBadge").classList.toggle("hidden", !g);
    // tarjeta "adelantar próximo año" (solo si hay grado siguiente)
    const prox = siguienteGradoLabel();
    const wrap = $("#destacadaWrap");
    if(prox){ $("#proxSub").textContent = `Practica ${prox}`; wrap.classList.remove("hidden"); }
    else wrap.classList.add("hidden");
    detectarNovedades();                 // 🆕 módulos nuevos vs. lo último visto acá (antes de pintar)
    pintarMaterias();
    verMaterias();
    cargarErrores();
    cargarProgreso();
    cargarCuradoInfo(gradoDeSesion());   // qué temas tienen guía revisada (sello 📗 + botón)
    cargarAgenda();                      // horario + tareas + notas para el escritorio
    verTab("inicio");                    // el día arranca en el escritorio
  }

  // ───────── pestañas (barra de navegación inferior) ─────────
  function verTab(id){
    $("#tabInicio").classList.toggle("hidden", id!=="inicio");
    $("#tabMaterias").classList.toggle("hidden", id!=="materias");
    $("#tabAgenda").classList.toggle("hidden", id!=="agenda");
    document.querySelectorAll("#navbar .navBtn").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.tab===id)));
    if(id==="inicio") pintarEscritorio();
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
    if(n===0) return "¡hoy!";
    if(n===1) return "mañana";
    if(n<0) return "venció";
    const [y,m,dd]=fecha.slice(0,10).split("-").map(Number);
    return `${DIAS_NOM[new Date(y,m-1,dd).getDay()]} ${dd}`;
  }

  // ───────── escritorio (pestaña Inicio) ─────────
  function proximoDiaEscolar(){          // → {dia:1..5, titulo}
    const hoy=new Date().getDay();       // 0=dom … 6=sáb
    if(hoy>=1 && hoy<=4) return {dia:hoy+1, titulo:"📅 Mañana toca"};
    if(hoy===0) return {dia:1, titulo:"📅 Mañana toca"};   // domingo → lunes
    return {dia:1, titulo:"📅 El lunes toca"};              // viernes y sábado → lunes
  }
  function pintarEscritorio(){
    const d=new Date();
    const f=`${DIAS_NOM[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
    $("#fechaHoy").textContent=f[0].toUpperCase()+f.slice(1);
    pintarEnergiaIA();
    cargarEfemerides().then(pintarEfemeride);
    pintarExamenBanner();
    pintarNovedadesInicio();
    pintarHorarioInicio();
    pintarTareasResumen();
    pintarNotasInicio();
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
    const e=IA_ESTADO;
    if(!e || e.ilimitado || !e.limite){ box.classList.add("hidden"); box.innerHTML=""; return; }
    const pct=Math.max(0, Math.min(100, Math.round((e.restante/e.limite)*100)));
    const nivel = pct<=0 ? "vacio" : pct<=20 ? "bajo" : pct<=50 ? "medio" : "alto";
    const msg = pct<=0 ? "Se agotó por hoy 🌙 ¡Mañana se recarga! Mientras, tienes las guías 📗 y lo ya practicado."
      : pct<=20 ? "Te queda poca energía de IA por hoy" : "Energía de IA para practicar hoy";
    const R=30, C=2*Math.PI*R, off=C*(1-pct/100);
    box.innerHTML=`<div class="enIn en-${nivel}"><svg class="enRing" viewBox="0 0 72 72" width="64" height="64" aria-hidden="true">`+
      `<circle class="enBg" cx="36" cy="36" r="${R}"></circle>`+
      `<circle class="enFg" cx="36" cy="36" r="${R}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"></circle>`+
      `<text x="36" y="42" text-anchor="middle" class="enPct">${pct}%</text></svg>`+
      `<div class="enTx"><span class="enTit">🔋 Tu energía de IA</span><p class="enMsg">${msg}</p></div></div>`;
    box.classList.remove("hidden");
  }
  function pintarEfemeride(){
    const box=$("#efemeride"); if(!box) return;
    const d=new Date();
    const key=String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const e=EFEMERIDES&&EFEMERIDES[key];
    if(!e||!e.texto){ box.classList.add("hidden"); box.innerHTML=""; return; }
    const anio=e.anio?`En ${escapeHtml(String(e.anio))}, `:"";
    box.innerHTML=`<div class="efeIn"><span class="efeEmoji">${escapeHtml(e.emoji||"📅")}</span><div class="efeTx"><span class="efeTit">Un día como hoy</span><p class="efePar">${anio}${escapeHtml(e.texto)}</p></div></div>`;
    box.classList.remove("hidden");
  }
  // pegamento examen→simulacro. Muestra SOLO el día más próximo con examen (no
  // los de 2-3 días después, para no llenar el inicio). Si ese día tiene 1 examen,
  // es el banner de siempre; si tiene 2 o más, se juntan en UNA tarjeta compacta
  // (una fila por materia), no varios banners apilados.
  // Un examen de HOY se oculta a partir de CORTE_MANANA (1 PM, hora del aparato):
  // pasada la mañana escolar se asume presentado y se pasa a mostrar el día siguiente.
  const CORTE_MANANA = 13; // hora local a partir de la cual un examen de hoy ya no se recuerda
  function pintarExamenBanner(){
    const box=$("#examenBanner"); box.innerHTML="";
    const horaLocal=new Date().getHours();
    const todos=TAREAS.filter(t=>t.tipo==="examen" && !t.hecha && t.fecha)
      .map(t=>({t,n:diasHasta(t.fecha)}))
      .filter(x=>x.n!==null && x.n>=0 && x.n<=3 && (x.n>0 || horaLocal<CORTE_MANANA))
      .sort((a,b)=>a.n-b.n);
    if(!todos.length) return;
    const minN=todos[0].n;                                   // día más próximo con examen
    const dia=todos.filter(x=>x.n===minN).slice(0,6);        // solo ese día
    const cuando = minN===0?"¡es hoy!":(minN===1?"es mañana":`en ${minN} días`);
    const cuandoCorto = minN===0?"hoy":(minN===1?"mañana":`en ${minN} días`);
    if(dia.length===1){
      const ex=dia[0];
      const b=document.createElement("button"); b.className="examenAviso";
      b.innerHTML=`<span class="dIcon">📋</span><span class="dTxt"><b>Examen de ${escapeHtml(limpiaNombreMateria(ex.t.materia||"")||"…")} ${cuando}</b><small>¿Simulamos uno para practicar? →</small></span><span class="dArrow">›</span>`;
      b.onclick=()=>irAPractica(ex.t.materia, "examen");
      box.appendChild(b);
      return;
    }
    // 2+ exámenes el mismo día → una sola tarjeta con una fila por materia
    const card=document.createElement("div"); card.className="examenCard";
    const head=document.createElement("div"); head.className="ecHead";
    head.innerHTML=`<span class="ecIcon">📋</span><span class="ecHeadTxt"><b>Tienes ${dia.length} exámenes ${cuandoCorto}</b><small>Toca uno para simularlo y practicar</small></span>`;
    card.appendChild(head);
    dia.forEach(ex=>{
      const row=document.createElement("button"); row.className="ecRow";
      row.innerHTML=`<span class="ecMat">${iconMateria(ex.t.materia)} ${escapeHtml(limpiaNombreMateria(ex.t.materia||"")||"…")}</span><span class="ecGo">Practicar ›</span>`;
      row.onclick=()=>irAPractica(ex.t.materia, "examen");
      card.appendChild(row);
    });
    box.appendChild(card);
  }
  function pintarHorarioInicio(){
    const {dia,titulo}=proximoDiaEscolar();
    $("#horarioTit").textContent=titulo;
    const cont=$("#horarioChips"); cont.innerHTML="";
    const del=HORARIO.filter(h=>h.dia===dia).sort((a,b)=>(a.orden||0)-(b.orden||0));
    if(!del.length){
      const p=document.createElement("p"); p.className="wVacio";
      p.textContent=HORARIO.length ? "No anotaste materias para ese día." : "Configura tu horario una sola vez y te diré qué toca cada día. 👇";
      cont.appendChild(p);
      if(!HORARIO.length){
        const b=document.createElement("button"); b.className="otros"; b.textContent="✏️ Configurar mi horario";
        b.onclick=()=>{ verTab("agenda"); abrirEditorHorario(); };
        cont.appendChild(b);
      }
      return;
    }
    const chips=document.createElement("div"); chips.className="chips";
    del.forEach(h=>{
      const enAula=esMateriaAula(h.materia);
      // materia del aula → botón que lleva a practicar; propia (caligrafía…) → chip simple
      const b=document.createElement(enAula?"button":"span"); b.className="chip"+(enAula?"":" propia");
      b.innerHTML=`${iconMateria(h.materia)} ${escapeHtml(limpiaNombreMateria(h.materia))}`;
      if(enAula) b.onclick=()=>irAPractica(h.materia);
      chips.appendChild(b);
    });
    cont.appendChild(chips);
    if(del.some(h=>esMateriaAula(h.materia))){
      const hint=document.createElement("p"); hint.className="wHint"; hint.textContent="Toca una materia para repasarla ✨";
      cont.appendChild(hint);
    }
  }
  function pintarTareasResumen(){
    const cont=$("#tareasResumen"); cont.innerHTML="";
    const pend=TAREAS.filter(t=>!t.hecha);
    if(!pend.length){
      const p=document.createElement("p"); p.className="wVacio"; p.textContent="Sin tareas pendientes 🎉 ¿Anotas las de hoy?";
      cont.appendChild(p);
    }else{
      pend.slice(0,4).forEach(t=>cont.appendChild(filaTarea(t,true)));
      if(pend.length>4){ const p=document.createElement("p"); p.className="wHint"; p.textContent=`…y ${pend.length-4} más en tu agenda`; cont.appendChild(p); }
    }
    const b=document.createElement("button"); b.className="otros"; b.textContent="＋ Anotar tarea";
    b.onclick=()=>{ verTab("agenda"); abrirFormTarea(); };
    cont.appendChild(b);
  }
  // ir a practicar una materia (desde el horario o el aviso de examen)
  function irAPractica(nombreMateria, modo){
    const m=((SESION&&SESION.materias)||[]).find(x=>norm(x.nombre)===norm(nombreMateria||""));
    verTab("materias");
    if(m){ abrirMateria(m); if(modo) setModo(modo); }
  }
  $("#btnVerAgenda").onclick=()=>verTab("agenda");

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
    const cont=$("#tMaterias"); cont.innerHTML="";
    materiasParaFormularios().forEach(nombre=>{
      const b=document.createElement("button"); b.className="chip"; b.setAttribute("aria-pressed","false");
      b.textContent=`${iconMateria(nombre)} ${limpiaNombreMateria(nombre)}`;
      b.onclick=()=>{ tMatSel=(tMatSel===nombre)?"":nombre;
        cont.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed", String(c===b && !!tMatSel))); };
      cont.appendChild(b);
    });
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
    const chips=document.createElement("div"); chips.className="chips";
    poolEditor().forEach(nombre=>{
      const dia=EDIT_HORARIO[EDIT_DIA];
      const i=dia.indexOf(nombre);
      const b=document.createElement("button"); b.className="chip";
      b.setAttribute("aria-pressed", String(i>=0));
      b.innerHTML=`${i>=0?`<span class="chipN">${i+1}º</span>`:""}${iconMateria(nombre)} ${escapeHtml(limpiaNombreMateria(nombre))}`;
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
  // Se marca visto al ABRIR la materia. La primera vez solo guarda la base (sin 🆕).
  const SNAP_KEY="aula_snap_v1";
  let NOVEDADES={};                       // materiaId → [{tema, nombre}]
  function snapDeMateria(m){
    const out={};
    (m.temas||[]).forEach(t=>(t.modulos||[]).forEach(mod=>{
      let mx=0; (mod.archivos||[]).forEach(f=>{ if((f.modificado||0)>mx) mx=f.modificado; });
      out[mod.id]=mx;
    }));
    return out;
  }
  function detectarNovedades(){
    if(!SESION || !Array.isArray(SESION.materias)) return;
    const snaps=store.get(SNAP_KEY)||{};
    NOVEDADES={};
    let base=false;
    SESION.materias.forEach(m=>{
      if(m.id==null) return;
      const nuevo=snapDeMateria(m);
      const viejo=snaps[m.id];
      if(!viejo){ snaps[m.id]=nuevo; base=true; return; }   // primera vez: base silenciosa
      const items=[];
      (m.temas||[]).forEach(t=>(t.modulos||[]).forEach(mod=>{
        if(mod.tipo==="label"||mod.tipo==="subsection") return;
        if(!(mod.id in viejo) || (nuevo[mod.id]||0)>(viejo[mod.id]||0)){
          items.push({tema:t.seccion||"", nombre:mod.nombre||""});
        }
      }));
      if(items.length) NOVEDADES[m.id]=items;
    });
    if(base) store.set(SNAP_KEY, snaps);
  }
  function marcarAulaVista(m){
    if(!m || m.id==null || !NOVEDADES[m.id]) return;
    const snaps=store.get(SNAP_KEY)||{};
    snaps[m.id]=snapDeMateria(m);
    store.set(SNAP_KEY, snaps);
    delete NOVEDADES[m.id];
    gridMaterias((SESION&&SESION.materias)||[]);   // quita el 🆕 para cuando vuelva
  }
  function pintarNovedadesInicio(){
    const box=$("#novedadesWrap"); if(!box) return; box.innerHTML="";
    const ids=Object.keys(NOVEDADES); if(!ids.length) return;
    const w=document.createElement("div"); w.className="widget";
    w.innerHTML=`<div class="wHead"><span class="wTit">🆕 Nuevo en tu aula</span></div>`;
    ids.forEach(id=>{
      const m=((SESION&&SESION.materias)||[]).find(x=>String(x.id)===String(id)); if(!m) return;
      const items=NOVEDADES[id];
      const b=document.createElement("button"); b.className="novItem";
      const detalle=items.slice(0,2).map(i=>escapeHtml(i.nombre)).join(" · ")+(items.length>2?` · y ${items.length-2} más`:"");
      b.innerHTML=`<span class="dIcon">${iconMateria(m.nombre)}</span><span class="dTxt"><b>${escapeHtml(limpiaNombreMateria(m.nombre))} <span class="novN">${items.length} ${items.length===1?"novedad":"novedades"}</span></b><small>${detalle}</small></span><span class="dArrow">›</span>`;
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
    const w=document.createElement("div"); w.className="widget";
    w.innerHTML=`<div class="wHead"><span class="wTit">🎓 Mis notas</span><button class="wLink" id="btnVerNotas">Ver todas</button></div>`;
    const chips=document.createElement("div"); chips.className="chips";
    const proms=promediosPorMateria();
    proms.slice(0,4).forEach(p=>chips.appendChild(chipPromedio(p)));
    w.appendChild(chips);
    // la nota más reciente floja → empuje a reforzar (con fotos del examen)
    const floja=NOTAS.find(t=>Number(t.nota)<NOTA_REFUERZO && t.materia);
    if(floja){
      const b=document.createElement("button"); b.className="otros refuerzo";
      b.textContent=`💪 ${limpiaNombreMateria(floja.materia)} se puede reforzar →`;
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
    const cont=$("#nMaterias"); cont.innerHTML="";
    materiasParaFormularios().forEach(nombre=>{
      const b=document.createElement("button"); b.className="chip"; b.setAttribute("aria-pressed","false");
      b.textContent=`${iconMateria(nombre)} ${limpiaNombreMateria(nombre)}`;
      b.onclick=()=>{ nMatSel=(nMatSel===nombre)?"":nombre;
        cont.querySelectorAll(".chip").forEach(c=>c.setAttribute("aria-pressed", String(c===b && !!nMatSel))); };
      cont.appendChild(b);
    });
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
        nombre:(d.usuario&&d.usuario.nombre)||nombrePendiente, token:d.token, materias:d.materias||[], fetched:Date.now() };
      store.set("sesion", SESION); tokenPendiente=null; entrarHome();
    }catch(e){ btn.textContent="No se pudo, reintenta"; setTimeout(()=>{btn.textContent=txt;btn.disabled=false;},2600); }
  };
  $("#btnSalirPend").onclick = ()=>{ tokenPendiente=null; verLanding(); };
  $("#btnEntrarLanding").onclick = ()=>{ $("#loginMsg").innerHTML=""; verLogin(); };
  $("#btnVolverLanding").onclick = ()=>{ $("#user").value=""; $("#pass").value=""; verLanding(); };

  $("#btnSalir").onclick = ()=>{
    store.del("sesion"); SESION=null; origen="actual";
    materiaSel=null; temaSel=null; $("#results").innerHTML="";
    MIS_ERRORES=[]; PROGRESO=new Map();
    $("#user").value=""; $("#loginMsg").innerHTML="";
    verLanding();
  };

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
    try{
      const r = await fetch(API_MOODLE,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ token: SESION.token })});
      const d = await r.json().catch(()=>null);
      if(d && d.code===401){ sesionVencida(); return; }
      if(d && d.pendiente){ sesionVencida("Tu acceso fue pausado. Habla con el administrador."); return; }
      if(d && Array.isArray(d.materias) && d.materias.length){
        SESION.materias = d.materias;
        if(d.token) SESION.token = d.token;
        SESION.fetched = Date.now();
        store.set("sesion", SESION);
        detectarNovedades();   // el material fresco puede traer 🆕
        if(origen==="actual" && !$("#paneMaterias").classList.contains("hidden")) pintarMaterias();
        if(!$("#tabInicio").classList.contains("hidden")) pintarEscritorio();
      }
    }catch(e){ /* sin conexión: seguimos con lo cacheado */ }
  }

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
  // guarda las preguntas que la niña falló en un quiz (para repasarlas luego)
  async function guardarErrores(fallidas, meta){
    if(!SESION || SESION.id==null || !fallidas.length) return;
    const numerica = esNumerica((meta&&meta.materia)||"") || esNumerica((meta&&meta.tema)||"");
    const errores = fallidas.map(f=>({
      materia:(meta&&meta.materia)||null, tema:(meta&&meta.tema)||null, grado:(meta&&meta.grado)||null,
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
  function registrarActividad(meta, modo, extra){
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
  }
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
  }

  // grilla de materias (sirve para las actuales y para las del próximo año)
  function gridMaterias(lista){
    const g = $("#gridMaterias"); g.innerHTML="";
    lista.forEach(m=>{
      const b=document.createElement("button"); b.className="mat";
      b.style.setProperty("--c", colorMateria(m.nombre));
      const nuevo = (m.id!=null && NOVEDADES[m.id]) ? `<span class="nuevoBadge">🆕</span>` : "";
      b.innerHTML=`<span class="em">${iconMateria(m.nombre)}</span><span class="nom">${escapeHtml(limpiaNombreMateria(m.nombre))}</span>${nuevo}<span class="chev">›</span>`;
      b.onclick=()=>abrirMateria(m);
      g.appendChild(b);
    });
  }
  function pintarMaterias(){
    origen = "actual";
    $("#destacadaWrap").classList.toggle("hidden", !siguienteGradoLabel());
    $("#cumbreWrap").classList.remove("hidden");
    $("#erroresWrap").classList.toggle("hidden", !MIS_ERRORES.length);
    $("#materiasHead").innerHTML = "📚 Tus materias";
    gridMaterias(SESION.materias||[]);
  }

  // ───────── adelantar próximo año (lee el currículo guardado) ─────────
  $("#btnProximo").onclick = entrarProximo;
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
      $("#materiasHead").innerHTML = `<button class="volver" id="volverActual">‹ Mis materias</button><span class="proxTag">🚀 ${escapeHtml(grado)} · próximo año</span>`;
      $("#volverActual").onclick = ()=>{ pintarMaterias(); window.scrollTo({top:0,behavior:"smooth"}); };
      if(!mats.length){ $("#gridMaterias").innerHTML = `<div class="empty">Todavía no tenemos ${escapeHtml(grado)} cargado. ¡Pronto!</div>`; }
      else gridMaterias(mats);
      window.scrollTo({top:0,behavior:"smooth"});
    }catch(e){
      $("#gridMaterias").innerHTML = errBox("No pudimos cargar el próximo año. Intenta otra vez.", String(e.message||e));
    }finally{ btn.disabled=false; }
  }

  function verMaterias(){ $("#paneTemas").classList.add("hidden"); $("#paneErrores").classList.add("hidden"); $("#paneCumbre").classList.add("hidden"); $("#paneMaterias").classList.remove("hidden"); }

  // ───────── Cumbre: presentación del espacio (acceso listo, contenido próximamente) ─────────
  $("#btnCumbre").onclick = entrarCumbre;
  $("#btnBackCumbre").onclick = verMaterias;
  async function entrarCumbre(){
    $("#paneMaterias").classList.add("hidden");
    $("#paneErrores").classList.add("hidden");
    $("#paneTemas").classList.add("hidden");
    $("#paneCumbre").classList.remove("hidden");
    const box = $("#cumbreIntro");
    box.innerHTML = `<p class="labLoad">Cargando…</p>`;
    window.scrollTo({top:0,behavior:"smooth"});
    try{
      const r = await fetch(API_CURRICULO,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({ accion:"cumbre_intro" })});
      const d = await r.json();
      renderCumbreIntro(d.intro||{});
    }catch(e){ renderCumbreIntro({}); }
  }
  function renderCumbreIntro(x){
    const titulo = x.titulo || "Cumbre 🏔️";
    const bajada = x.bajada || "La mejor educación del mundo, para ti.";
    let html = `<div class="cumHero"><div class="cumMonte">🏔️</div><h2 class="cumTit">${escapeHtml(titulo)}</h2><p class="cumBaj">${escapeHtml(bajada)}</p></div>`;
    if(x.texto_nino) html += `<p class="cumPar">${escapeHtml(x.texto_nino)}</p>`;
    if(x.cierre) html += `<p class="cumCierre">${escapeHtml(x.cierre)}</p>`;
    if(x.texto_padre){
      html += `<details class="cumMas"><summary>Para los padres</summary><p class="cumPar">${escapeHtml(x.texto_padre)}</p></details>`;
    }
    html += `<div class="cumProx"><b>🚧 En preparación</b><span>Las materias de Cumbre están en camino. Pronto vas a poder practicar aquí. Por ahora, esta es tu presentación del espacio.</span></div>`;
    $("#cumbreIntro").innerHTML = html;
  }
  $("#btnBack").onclick = ()=>{ temaSel=null; $("#results").innerHTML=""; fotos=[]; pintarFotos(); limpiarRefuerzo(); verMaterias(); };

  function abrirMateria(m){
    materiaSel=m; temaSel=null; clearOtro(); $("#results").innerHTML="";
    fotos=[]; pintarFotos();
    const esProx = origen==="proximo";
    if(!esProx) marcarAulaVista(m);   // abrirla marca las novedades 🆕 como vistas
    // banner de refuerzo: solo si esta materia es la de la nota floja
    if(REFUERZO && norm(m.nombre)!==norm(REFUERZO.materia||"")) limpiarRefuerzo();
    else pintarRefuerzoBanner();
    $("#tituloMateria").textContent = `${iconMateria(m.nombre)}  ${limpiaNombreMateria(m.nombre)}`;
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
  // Guarda lo ya generado en este aparato para no repetir llamadas (ni a la IA
  // ni a Supabase) cuando la alumna vuelve a un modo/tema que ya vio. Se salta
  // con "Generar otros" y con fotos (resultados personales). Clave igual a la del
  // servidor (el resumen ignora "cantidad").
  const CACHE_LOCAL_KEY = "gen_cache_v3";  // v3: purga ASCII/Markdown + acertijos de lógica mal armados
  const CACHE_LOCAL_MAX = 60;
  // firma barata del contenido del tema (misma idea que el backend): si la maestra
  // actualiza el material, cambia la firma → clave nueva → se regenera solo.
  function firmaLocal(contexto){
    const acts = contexto && Array.isArray(contexto.actividades) ? contexto.actividades : [];
    const base = acts.map(a=>`${a.archivoUrl||a.nombre||""}:${a.modificado||""}`).join("~");
    const datos = (contexto && contexto.datosClave) || "";   // tema libre: distingue por datos clave
    return datos ? `d:${datos}~${base}` : base;               // vacío para temas del aula → clave igual que antes
  }
  function claveLocal(tema, firma){
    const cant = modoSel === "resumen" ? "" : cantidad;
    return [ (materiaSel&&materiaSel.nombre)||"General", tema, modoSel,
             gradoActivo(), cant, firma||"" ].join("|").toLowerCase();
  }
  function cacheLocalGet(k){
    const all = store.get(CACHE_LOCAL_KEY) || {};
    return (all[k] && all[k].d) ? all[k].d : null;
  }
  function cacheLocalSet(k, d){
    const all = store.get(CACHE_LOCAL_KEY) || {};
    all[k] = { d, t: Date.now() };
    const keys = Object.keys(all);
    if(keys.length > CACHE_LOCAL_MAX){                 // conserva los más nuevos
      keys.sort((a,b)=>(all[a].t||0)-(all[b].t||0));
      keys.slice(0, keys.length - CACHE_LOCAL_MAX).forEach(old=>delete all[old]);
    }
    store.set(CACHE_LOCAL_KEY, all);
  }

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
  $("#btnGen").onclick  = ()=>generar({via:"ia"});
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
      else { body.sinCurado=true; body.nocache=!!opts.nocache; }
      // refuerzo activo + fotos = son fotos del EXAMEN CORREGIDO (la IA ataca lo que falló)
      if(REFUERZO && usaFotos) body.examenFoto=true;
      const r = await fetch(API_GENERAR,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      let d;
      try { d = await r.json(); }
      catch(_){ throw new Error("El servidor tardó demasiado o se cayó. Prueba de nuevo en un momentico."); }
      if(d.error){ const er=new Error(d.error); er.code=d.code; er.retryAfter=d.retryAfter; throw er; }
      // el alumno ya gastó su presupuesto de IA del mes → seguir con guías/lo cacheado
      if(d.ia){ IA_ESTADO=d.ia; pintarEnergiaIA(); }   // refresca la batería de energía IA
      if(d.limiteIA){ renderLimite(res); return; }
      // guía agotada, o el tema no tiene guía → ofrecer seguir con IA
      if(d.sinItems || d.sinBanco){ renderHandoff(res, d); return; }
      if(via==="guia" && d.curado) acumularVistos(mat,tema,modoSel,gr,d);
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
    renderBanner(res, d.fuentes, d.basadoEnMaterial, d.apuntes, d.curado);
    const modo = d.modo || modoSel;
    const meta = { materia:d.materia, tema:d.tema, grado:gradoActivo() };
    if(modo==="resumen"){      renderResumen(res, d); registrarActividad(meta, "resumen"); }
    else if(modo==="examen"){  renderExamen(res, d.preguntas||[], meta); renderOtros(res); }
    else if(modo==="quiz")     renderQuiz(res, d.preguntas||[], meta);   // "otros" se agrega al terminar
    else {                     renderRetos(res, d.ejercicios||[], meta); renderOtros(res); }
    if(modo!=="quiz") renderFooter(res);   // el quiz cierra con su nota + mensaje
    res.scrollIntoView({behavior:"smooth",block:"nearest"});
  }

  function renderBanner(res, fuentes, basado, apuntes, curado){
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
    if(html){ const b=document.createElement("div"); b.className="basado"+(esIA?" ia":""); b.innerHTML=html; res.appendChild(b); }
  }
  function renderFooter(res){
    const f=document.createElement("p"); f.className="footer";
    f.textContent=`¡Tú puedes, ${(SESION.nombre||"").split(" ")[0]||""}! 🌟`;
    res.appendChild(f);
  }

  function renderRetos(res, ejercicios, meta){
    if(!ejercicios.length){ res.appendChild(vacio("No llegaron retos. Intenta otra vez.")); return; }
    let registrado=false;
    ejercicios.forEach((e,i)=>{
      const c=tarjeta(i);
      c.innerHTML=`<span class="tag">🎯 Reto ${i+1}</span>
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
      res.appendChild(c);
    });
  }

  function renderExamen(res, preguntas, meta){
    let registrado=false;
    if(!preguntas.length){ res.appendChild(vacio("No llegaron preguntas. Intenta otra vez.")); return; }
    preguntas.forEach((p,i)=>{
      const c=tarjeta(i);
      c.innerHTML=`<span class="tag t2">📋 Pregunta ${i+1}</span>
        <p class="q">${escapeHtml(p.pregunta||"")}</p>
        <div class="reveals"><button class="mini ans">✅ Ver respuesta</button></div>
        <div class="reveal ans"><b>Respuesta:</b> ${escapeHtml(p.respuesta||"")}${p.explicacion?`<div class="comoRes"><b>✏️ Cómo se resuelve:</b> ${escapeHtml(p.explicacion)}</div>`:``}</div>`;
      const a=c.querySelector(".mini.ans");
      a.onclick=()=>{ c.querySelector(".reveal.ans").classList.add("show"); a.disabled=true;
        if(!registrado){ registrado=true; registrarActividad(meta, "examen"); } };
      res.appendChild(c);
    });
  }

  function renderResumen(res, d){
    const c=document.createElement("div"); c.className="sumCard";
    let html=`<span class="tag t2">📝 Resumen</span>`;
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
    const estado = { resp:0, ok:0, total:preguntas.length, fallidas:[] };
    const score=document.createElement("div"); score.className="score";
    score.textContent=`Puntaje: 0/${estado.total}`;
    res.appendChild(score);

    preguntas.forEach((p,i)=>{
      const opciones = Array.isArray(p.opciones) ? p.opciones : [];
      const correcta = Number(p.correcta);
      const c=tarjeta(i);
      const letras="ABCDE";
      c.innerHTML=`<span class="tag t3">🎮 Pregunta ${i+1}</span>
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
            estado.fallidas.push({ pregunta:p.pregunta, opciones, correcta, elegida:j, explicacion:p.explicacion, figura:p.figura });
          }
          const exp=c.querySelector(".qexp"); if(exp) exp.classList.add("show");
          estado.resp++; if(j===correcta) estado.ok++;
          score.textContent=`Puntaje: ${estado.ok}/${estado.total}`;
          if(estado.resp===estado.total) mostrarResultadoQuiz(res, estado, meta);
        };
      });
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
    const c=document.createElement("div"); c.className="card";
    c.style.animationDelay="0.05s";
    c.innerHTML=`<span class="tag t3">🎉 ¡Terminaste!</span>
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
    return `<div class="loading"><div class="brain">🧠</div>
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
    const map=[["lógic","🧠"],["logic","🧠"],["matemát","🔢"],["matemat","🔢"],["lenguaje","📖"],["castellano","📖"],
      ["lengua","📖"],["inglés","🔤"],["ingles","🔤"],["natural","🔬"],["social","🌎"],
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
    const n=(nombre||"").toLowerCase();
    const map=[["lógic","#7C4DFF"],["logic","#7C4DFF"],["matemát","#12B5A4"],["matemat","#12B5A4"],
      ["lenguaje","#FF6B3D"],["lengua","#FF6B3D"],["inglés","#3A8DFF"],["ingles","#3A8DFF"],["natural","#1FA86A"],["social","#F2934A"],
      ["educación f","#EF476F"],["educacion f","#EF476F"],["físic","#D7263D"],["fisic","#D7263D"],
      ["químic","#0FA3B1"],["quimic","#0FA3B1"],["biolog","#1FA86A"],["geograf","#F2934A"],["historia","#F2934A"],
      ["metodolog","#5A6B8C"],["orientac","#6C7BD1"],["electrón","#F4A300"],["electron","#F4A300"],["puente","#8E5AE8"],
      ["estétic","#E84CA0"],["estetic","#E84CA0"],["arte","#E84CA0"],
      ["músic","#9B5DE5"],["music","#9B5DE5"],["religi","#6C7BD1"],["informát","#2DA8B8"],["informat","#2DA8B8"],
      ["robót","#5A6B8C"],["robot","#5A6B8C"],["emocional","#FF74A3"],["lideraz","#F4A300"],["comunic","#F4A300"],
      ["olimpiad","#FFB703"]];
    for(const [k,c] of map){ if(n.includes(k)) return c; }
    return "#FF6B3D";
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
  // Vista privada para revisar el contenido de Cumbre renderizado EXACTAMENTE como lo
  // verá la alumna, antes de publicarlo. Solo lectura: MODO_LAB apaga toda escritura y
  // no hay botones de generar. La clave se valida server-side (api/admin-check) y vive
  // solo en memoria (se re-pide al recargar; no se guarda en el aparato).
  const API_LAB = "https://aula-cam.vercel.app/api/lab";   // endpoint único (accion: check/materias/tema)
  let LAB_CLAVE = "";
  const MODOS_LAB = [["resumen","📝 Resumen"],["retos","🎯 Práctica"],["quiz","🎮 Quiz"],["examen","📋 Examen"]];
  const LETRA_MODO = { resumen:"R", retos:"P", quiz:"Q", examen:"E" };

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
      labCargarMaterias();
    }catch(_){ $("#labErr").classList.remove("hidden"); }
    finally{ btn.disabled=false; }
  }
  async function labCargarMaterias(){
    const body=$("#labBody"); labBack(true); body.innerHTML=`<p class="labLoad">Cargando…</p>`;
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"materias",clave:LAB_CLAVE})});
      if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
      const d=await r.json(); labNivelMaterias(d.materias||[]);
    }catch(_){ body.innerHTML=errBox("No se pudo cargar el cuarto. Reintenta."); }
  }
  function labBack(hide, fn){ const b=$("#labBack"); b.classList.toggle("hidden", !!hide); if(fn) b.onclick=fn; }
  function labNivelMaterias(materias){
    labBack(true); const body=$("#labBody"); body.innerHTML="";
    if(!materias.length){ body.innerHTML=`<div class="empty">Aún no hay materias de Cumbre.</div>`; return; }
    materias.forEach(m=>{
      const b=document.createElement("button"); b.className="labMat";
      b.innerHTML=`<span class="labMatNom">🏔️ ${escapeHtml(m.materia)}</span><span class="labMatGr">${escapeHtml(m.grado)}</span><span class="labProg">${m.curados} de ${m.total} temas curados</span>`;
      b.onclick=()=>labNivelMapa(m, materias);
      body.appendChild(b);
    });
  }
  function labNivelMapa(m, materias){
    labBack(false, ()=>labNivelMaterias(materias));
    const body=$("#labBody"); body.innerHTML=`<p class="labCrumb">🏔️ ${escapeHtml(m.materia)} · ${escapeHtml(m.grado)}</p>`;
    const varios=(m.dominios||[]).length>1;
    (m.dominios||[]).forEach((dom,idx)=>{
      const titulo = dom.intl ? `${dom.dominio}  ·  ${dom.intl}` : dom.dominio;
      const chips = crearLapso(body, titulo, (dom.temas||[]).length, idx===0);
      chips.classList.add("labTemas");
      (dom.temas||[]).forEach(t=>{
        const fila=document.createElement(t.curado?"button":"div");
        fila.className="labTema"+(t.curado?" curado":" pend");
        const modos=(t.modos||[]).map(k=>LETRA_MODO[k]||"?").join(" ");
        fila.innerHTML=`<span class="labBadge">${t.curado?"✅":"⬜"}</span><span class="labTemaNom">${escapeHtml(t.tema)}</span>${t.curado?`<span class="labModos">${modos}</span>`:`<span class="labModos pend">pendiente</span>`}`;
        if(t.curado) fila.onclick=()=>labNivelTema(m, t, materias);
        chips.appendChild(fila);
      });
    });
    if(!varios){} // (un solo dominio igual se ve como acordeón; está bien)
  }
  async function labNivelTema(m, t, materias){
    labBack(false, ()=>labNivelMapa(m, materias));
    const body=$("#labBody");
    body.innerHTML=`<p class="labCrumb">🏔️ ${escapeHtml(m.materia)} — ${escapeHtml(t.tema)}</p><p class="labLoad">Cargando…</p>`;
    try{
      const r=await fetch(API_LAB,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({accion:"tema", clave:LAB_CLAVE, materia:m.materia, tema:t.tema, grado:m.grado})});
      if(r.status===401){ LAB_CLAVE=""; entrarLab(); return; }
      const d=await r.json(); const modos=d.modos||{};
      body.innerHTML=`<p class="labCrumb">🏔️ ${escapeHtml(m.materia)} — ${escapeHtml(t.tema)}</p><p class="labNota">Así lo verá la alumna (vista de solo lectura).</p>`;
      const disp=MODOS_LAB.filter(([k])=>modos[k]);
      if(!disp.length){ body.innerHTML+=`<div class="empty">Aún no curado.</div>`; return; }
      const sel=document.createElement("div"); sel.className="labModoSel";
      const out=document.createElement("div"); out.className="results";
      const meta={materia:m.materia, tema:t.tema, grado:m.grado};
      const pintar=(k)=>{
        out.innerHTML="";
        [...sel.children].forEach(x=>x.classList.toggle("on", x.dataset.k===k));
        if(k==="resumen") renderResumen(out, modos.resumen||{});
        else if(k==="retos") renderRetos(out, (modos.retos&&modos.retos.items)||[], meta);
        else if(k==="quiz") renderQuiz(out, (modos.quiz&&modos.quiz.items)||[], meta);
        else if(k==="examen") renderExamen(out, (modos.examen&&modos.examen.items)||[], meta);
        out.scrollIntoView({behavior:"smooth",block:"nearest"});
      };
      disp.forEach(([k,lbl])=>{ const b=document.createElement("button"); b.className="labModoBtn"; b.dataset.k=k; b.textContent=lbl; b.onclick=()=>pintar(k); sel.appendChild(b); });
      body.appendChild(sel); body.appendChild(out);
      pintar(disp[0][0]);
    }catch(_){ body.innerHTML=errBox("No se pudo cargar el tema. Reintenta."); }
  }
  $("#labEntrar").onclick=labLogin;
  $("#labClave").addEventListener("keydown",(e)=>{ if(e.key==="Enter") labLogin(); });
  window.addEventListener("hashchange",()=>{ if(location.hash==="#lab" && !MODO_LAB) entrarLab(); });

  // ───────── arranque (al final: todas las consts/funciones ya están definidas) ─────────
  (function arrancar(){
    // cuarto de pruebas (admin), oculto: si se entra por #lab, no seguir el flujo normal
    if(location.hash === "#lab"){ entrarLab(); return; }
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
        // refresco en segundo plano si la sesión guardada ya tiene sus horas
        const viejo = !s.fetched || (Date.now() - s.fetched > 4*3600*1000);
        if(viejo) refrescarMaterias();
      }
    }catch(e){
      // si algo falla al restaurar la sesión, NO congelar: mostrar la landing
      SESION=null; try{ store.del("sesion"); }catch(_){}
      $("#vHome").classList.add("hidden"); $("#vLogin").classList.add("hidden");
      $("#vLanding").classList.remove("hidden");
    }
  })();
