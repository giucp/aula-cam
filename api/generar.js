// api/generar.js  —  Función serverless de Vercel (runtime Node)
// Genera ejercicios de práctica NUEVOS con IA (Gemini Flash) a partir del
// CONTENIDO REAL que el alumno está viendo en su aula virtual.
//
// Dos niveles de "contenido real":
//  1) Texto que ya trae el login: materia, lapso, tema y las actividades que el
//     docente asignó (nombre + descripción). Da el ENFOQUE exacto del tema.
//  2) Los PDFs reales (guías y hojas de trabajo) donde está la TEORÍA y los
//     EJERCICIOS. Se descargan aquí (server-side) y se le mandan a Gemini, que
//     lee PDFs nativamente (incluso escaneados). Fuentes:
//       - módulos `resource`: archivo en el propio Moodle (descarga con token)
//       - módulos `page`: suelen embeber un PDF de Google Drive (se extrae el id)
//
// Si no hay contexto ni PDFs, cae al modo anterior (solo título). La clave de
// Gemini NO va aquí: va en Vercel como variable de entorno GEMINI_API_KEY.

import crypto from "node:crypto";
import { normCurado } from "../herramientas/normcurado.mjs";

// Modelo por modo: ejercicios (retos/quiz) con el flash completo (mejor en
// matemática); resumen/examen con flash-lite (más rápido y barato).
const MODEL_EJERCICIOS = "gemini-2.5-flash";
const MODEL_TEXTO = "gemini-2.5-flash-lite";
const MAX_PDFS = 3;                       // cuántos PDFs leer por generación
const MAX_PDF_BYTES = 8 * 1024 * 1024;    // por archivo
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // suma de todos
const DL_TIMEOUT_MS = 9000;               // timeout por descarga
const MAX_FOTOS = 3;                       // fotos de cuaderno por generación
const MIME_FOTOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Sanea las fotos del cuaderno que manda el frontend: {mime, data(base64)}.
function limpiarFotos(fotos) {
  if (!Array.isArray(fotos)) return [];
  const out = [];
  for (const f of fotos) {
    if (out.length >= MAX_FOTOS) break;
    if (!f || typeof f !== "object") continue;
    const mime = String(f.mime || "");
    const data = typeof f.data === "string" ? f.data : "";
    if (!MIME_FOTOS.has(mime)) continue;
    if (!data || data.length > 6_000_000) continue; // ~4.5MB en binario
    out.push({ mime, data });
  }
  return out;
}

// ───────── helpers de texto ─────────
function recortar(s, max) {
  s = String(s == null ? "" : s).trim();
  return s.length > max ? s.slice(0, max).trim() + "…" : s;
}
function limpiarTexto(s) {
  return String(s == null ? "" : s)
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
}

// Bloque de "material real" en texto (enfoque del tema). "" si no hay nada útil.
function armarMaterial(contexto) {
  if (!contexto || typeof contexto !== "object") return "";
  const partes = [];
  if (contexto.materia) partes.push(`Materia: ${limpiarTexto(contexto.materia)}`);
  if (contexto.lapso) partes.push(`Lapso: ${limpiarTexto(contexto.lapso)}`);
  if (contexto.tema) partes.push(`Tema: ${limpiarTexto(contexto.tema)}`);
  const resumen = limpiarTexto(contexto.resumen);
  if (resumen) partes.push(`Resumen del tema: ${recortar(resumen, 600)}`);
  const acts = (Array.isArray(contexto.actividades) ? contexto.actividades : []).filter((a) => a && a.nombre);
  if (acts.length) {
    partes.push("Actividades que el docente asignó en este tema (esto es lo que el alumno está viendo en su aula):");
    acts.slice(0, 12).forEach((a, i) => {
      let linea = `  ${i + 1}. ${limpiarTexto(a.nombre)}`;
      const desc = limpiarTexto(a.descripcion);
      if (desc) linea += ` — ${recortar(desc, 280)}`;
      partes.push(linea);
    });
  }
  return partes.length >= 2 ? partes.join("\n") : "";
}

// ───────── helpers de descarga de PDFs ─────────
function conToken(url, token) {
  if (!token) return url;
  return url + (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
}
async function bajar(url) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), DL_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!r.ok) return null;
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    return null;
  } finally {
    clearTimeout(id);
  }
}
function esPdf(buf) {
  return buf && buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
}
function idDeDrive(html) {
  const m = String(html || "").match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// Devuelve el PDF (Buffer) de una actividad, o null si no aplica/falla.
async function pdfDeActividad(a, token) {
  if (!a || !a.archivoUrl) return null;
  if (a.tipo === "resource") {
    const buf = await bajar(conToken(a.archivoUrl, token));
    return esPdf(buf) && buf.length <= MAX_PDF_BYTES ? { nombre: a.nombre, buf } : null;
  }
  if (a.tipo === "page") {
    // la página suele embeber un PDF de Google Drive: bajo el index.html y saco el id
    const htmlBuf = await bajar(conToken(a.archivoUrl, token));
    if (!htmlBuf) return null;
    const id = idDeDrive(htmlBuf.toString("utf8"));
    if (!id) return null;
    const buf = await bajar(`https://drive.google.com/uc?export=download&id=${id}`);
    return esPdf(buf) && buf.length <= MAX_PDF_BYTES ? { nombre: a.nombre, buf } : null;
  }
  return null;
}

// Junta hasta MAX_PDFS PDFs de las actividades del tema.
async function juntarPdfs(contexto, token) {
  const acts = contexto && Array.isArray(contexto.actividades) ? contexto.actividades : [];
  const candidatas = acts.filter((a) => a && a.archivoUrl && (a.tipo === "resource" || a.tipo === "page")).slice(0, 6);
  const out = [];
  let total = 0;
  for (const a of candidatas) {
    if (out.length >= MAX_PDFS) break;
    const pdf = await pdfDeActividad(a, token);
    if (pdf && total + pdf.buf.length <= MAX_TOTAL_BYTES) {
      out.push(pdf);
      total += pdf.buf.length;
    }
  }
  return out;
}

// ───────── prompt ─────────
const MODOS_VALIDOS = new Set(["retos", "resumen", "examen", "quiz"]);
// Versión del prompt por modo: al subirla, el caché de ese modo se invalida
// (los resúmenes viejos y flacos no se vuelven a servir). Mismo criterio que el
// frontend para saber si un tema es "numérico" (matemática/lógica/olimpiada).
// retos/examen/quiz subidos 2026-07-04: protocolo CONSTRUIR→ENUMERAR→VERIFICAR para
// acertijos de deducción (purga del caché los acertijos ambiguos/sin solución previos).
const PROMPT_VER = { resumen: "3", retos: "4", examen: "5", quiz: "5" };
function esNumerica(txt) {
  return /matemát|matemat|lógic|logic|olimpiad/i.test(txt || "");
}

function armarPrompt({ modo, material, tienePdf, tieneFotos, fotosExamen, grado, tema, materia, n, numerica }) {
  const ctx = material
    ? `Este es el material REAL del aula del alumno (lo que está viendo):\n\n${material}\n`
    : `Tema: "${tema}" (materia: ${materia || "General"}).\n`;
  const pdfNota = tienePdf
    ? `\nTe adjunto la(s) guía(s)/hoja(s) en PDF con la teoría y los ejercicios reales del tema. Léelas con atención y básate en su contenido.\n`
    : ``;
  // Cómo usar las fotos depende del modo y de si el tema es numérico:
  // - numérico + práctica: la foto es MODELO (tipo/método/dificultad) → ejercicios
  //   NUEVOS, jamás copiar los de la foto (antes Gemini replicaba la hoja tal cual).
  // - teoría + práctica: la foto ES la teoría que le van a evaluar → las preguntas
  //   pueden salir directamente de su contenido.
  // - resumen: información complementaria, como siempre.
  const modoPractica = modo === "retos" || modo === "quiz" || modo === "examen";
  const fotosNota = !tieneFotos
    ? ``
    : fotosExamen
    ? `\nEl alumno adjuntó fotos de su EXAMEN CORREGIDO por el docente. Analízalas con atención: identifica las preguntas donde se equivocó o perdió puntos (marcas, tachaduras, correcciones del docente, puntajes bajos) y ENFOCA lo que generes en reforzar EXACTAMENTE esos puntos débiles: mismos tipos de pregunta y mismos conceptos donde falló, con dificultad similar a la del examen. Lo que ya respondió bien no necesita refuerzo (inclúyelo solo de repaso ligero si sobra espacio). NO inventes lo que sea ilegible.\n`
    : numerica && modoPractica
    ? `\nEl alumno también adjuntó fotos de su clase presencial (apuntes o ejercicios del cuaderno). Úsalas SOLO como MODELO del tipo de ejercicio, del método y del nivel de dificultad que están trabajando en clase. NO copies, NO repitas y NO reformules los ejercicios que aparecen en las fotos: crea ejercicios NUEVOS del mismo tipo y nivel, con números, nombres y contextos DISTINTOS a los de las fotos (el alumno ya tiene los de la hoja; necesita practicar con casos nuevos). Si las fotos muestran el procedimiento que enseñó el docente, respeta ese mismo procedimiento al explicar. La letra de un niño puede ser difícil de leer: interpreta lo que puedas con razonable seguridad y NO inventes lo que sea ilegible.\n`
    : modoPractica
    ? `\nEl alumno también adjuntó fotos de sus apuntes del cuaderno, tomados en sus clases presenciales: esa es la teoría que le van a evaluar. Básate en el CONTENIDO de esas fotos (junto al material del aula) para crear las preguntas — está bien que salgan directamente de lo que dicen los apuntes, porque eso es lo que el docente va a preguntar. La letra de un niño puede ser difícil de leer: interpreta y aprovecha lo que puedas con razonable seguridad, y NO inventes lo que sea ilegible.\n`
    : `\nEl alumno también adjuntó fotos de sus apuntes del cuaderno, tomados en sus clases presenciales. Léelas con atención y úsalas como información complementaria al material del aula. La letra de un niño puede ser difícil de leer: interpreta y aprovecha lo que puedas con razonable seguridad, y NO inventes lo que sea ilegible.\n`;
  const base = `Eres un docente de ${grado} en Venezuela, cálido y claro. Escribe en español neutro y claro, con palabras apropiadas para ${grado}. No uses jerga regional ni saludos coloquiales como "chamos", "chamo", "épale" o "pana"; dirígete al alumno de forma sencilla y neutra.

FORMATO (muy importante): la app muestra tu texto TAL CUAL, sin interpretar Markdown ni respetar alineaciones. Escribe SIEMPRE en texto plano y respeta estas reglas en TODOS los campos de texto:
- NO uses Markdown: nada de **negritas**, *asteriscos*, títulos con #, comillas invertidas ni viñetas con símbolos.
- NUNCA dibujes mesas, tableros, cuadrículas, figuras ni diagramas con caracteres o "arte ASCII" (guiones, barras, corchetes): en la app se ven rotos. Si necesitas mostrar una disposición (por ejemplo quién se sienta dónde, o el orden de algo), descríbela con palabras, de forma breve y clara.
- Sé CONCISO: incluye solo los pasos necesarios y evita el relleno (no escribas frases como "leemos el problema" o "dibujamos la mesa").

${ctx}${pdfNota}${fotosNota}\n`;
  const jsonOnly = `Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.`;
  const figuraNota = `Usa "figura" SOLO cuando el ejercicio es visual/geométrico y la figura ayuda de verdad a entenderlo (por ejemplo: estrellas mágicas con números, pirámides numéricas, conteo de cubos, secuencias o patrones de figuras). En ese caso incluye un dibujo en SVG simple y autocontenido, coherente con el enunciado y con la solución verificada (usa viewBox; solo formas, líneas, números y texto; SIN <script>, SIN <image>, SIN recursos externos). NUNCA uses figura para acertijos de deducción, ordenamiento o ubicación (quién se sienta dónde, en qué orden va algo): esos se explican con palabras. En la duda, deja "figura":"" (cadena vacía).`;
  // Reglas específicas para acertijos de deducción/lógica (donde el modelo suele
  // inventar acertijos sin solución única o razonar mal). Solo en temas numéricos/lógicos.
  // Protocolo CONSTRUIR→ENUMERAR→VERIFICAR: la instrucción vaga "comprueba que sea única"
  // no bastaba (salían acertijos ambiguos, sin solución o con explicación contradictoria).
  const reglasDeduccion = numerica
    ? `\nSi el ejercicio es de deducción, ordenamiento o ubicación (quién se sienta dónde, en qué orden llegan o se colocan, acertijos con pistas), sigue OBLIGATORIAMENTE este protocolo:
1. CONSTRUYE PRIMERO la solución: decide la disposición u orden final completo ANTES de redactar el enunciado, y escribe las pistas describiendo ESA disposición.
2. Redacta SIN ambigüedad: escribe siempre "inmediatamente a la derecha/izquierda de" o "en algún lugar a la derecha/izquierda de" (nunca "a la derecha de" a secas, que se entiende de dos formas); "justo antes/después" significa en la posición inmediata. En mesas redondas, aclara en el enunciado que la derecha y la izquierda son las de la persona sentada (no las del lector), y recuerda: en una mesa de 4, el que está al frente de tu vecino de la derecha es tu vecino de la izquierda.
3. VERIFICA LA UNICIDAD enumerando: con 3 o 4 elementos las disposiciones posibles son pocas (6 o 24; en mesa redonda, fija a una persona y ordena el resto). Recorre TODAS y cuenta cuántas cumplen todas las pistas: debe quedar EXACTAMENTE UNA. Si quedan cero o más de una, DESCARTA el acertijo y construye otro desde el paso 1. No uses más de 5 elementos.
4. La respuesta debe cumplir TODAS las pistas: verifícala pista por pista antes de entregar.
5. La explicación deduce la respuesta PASO A PASO citando en cada paso la pista que lo justifica. Nada de "por descarte" sin mostrar por qué cada alternativa es imposible, y NUNCA afirmes algo que contradiga una pista (ejemplo de error prohibido: "como el verde no está en los extremos, va al final" — el final ES un extremo).\n`
    : ``;

  if (modo === "resumen") {
    const enfoqueMate = numerica
      ? `\nComo es un tema de matemática o lógica, es OBLIGATORIO enseñar los PROCEDIMIENTOS concretos, no solo definiciones. Según lo que pida el tema, explica cosas como: cómo pasar del enunciado en palabras a la operación o ecuación (qué representa cada dato), cómo despejar o resolver PASO A PASO, cómo distinguir y plantear los distintos casos (por ejemplo, regla de tres DIRECTA vs. INVERSA: cómo se reconoce cada una y cómo se redacta), y cómo comprobar que el resultado está bien. Cada procedimiento con sus pasos y un ejemplo numérico resuelto y CORRECTO (verifica los cálculos; usa números que den exacto).\n`
      : ``;
    return base + `Explícale el tema al alumno con un RESUMEN DE ESTUDIO nutritivo: NO una lista de frases sueltas y generales, sino una explicación que de verdad le enseñe a ENTENDER y a HACER. Tono cálido y motivador, pero con contenido suficiente para resolver dudas o vacíos que traiga del colegio o de una clase en la que se distrajo.
Cubre los subtemas y PROCESOS importantes del tema (no generalidades vagas). Para cada proceso o procedimiento, explica el CÓMO paso a paso e incluye un ejemplo resuelto.${enfoqueMate}
Forma EXACTA del JSON:
{"titulo":"título del tema","intro":"1 o 2 frases que dicen de qué trata y para qué sirve","secciones":[{"titulo":"nombre del subtema o proceso","explicacion":"explicación clara y completa, no superficial","pasos":["paso 1","paso 2"],"ejemplo":"un ejemplo resuelto concreto que muestre el proceso"}],"idea_clave":"la idea más importante en una sola frase"}
- Entre 3 y 5 secciones.
- "pasos": los pasos ordenados del procedimiento. Si la sección es solo conceptual (no un procedimiento), deja "pasos":[].
- "ejemplo": un ejemplo resuelto y correcto; si la sección no lo necesita, deja "ejemplo":"".
- Lenguaje apropiado para ${grado}, simple pero SIN quedarte en lo superficial.
${jsonOnly}`;
  }

  if (modo === "examen") {
    return base + `Crea ${n} preguntas de examen sobre el tema, para que el alumno se autoevalúe y APRENDA a resolverlas. Variadas, claras y que cubran lo importante del tema.
Forma EXACTA del JSON:
{"preguntas":[{"pregunta":"...","respuesta":"...","explicacion":"..."}]}
- "respuesta": la respuesta correcta, breve.
- "explicacion": explica CÓMO se llega a esa respuesta (el procedimiento paso a paso o el razonamiento), claro y apropiado para ${grado}. Es OBLIGATORIO: siempre enseña cómo obtenerla, no solo el resultado.
- Si la pregunta involucra cálculo, RESUÉLVELA y verifica que la respuesta y el procedimiento son correctos.
${reglasDeduccion}${jsonOnly}`;
  }

  if (modo === "quiz") {
    const expNota = numerica
      ? `explica el procedimiento PASO A PASO para llegar a la respuesta correcta (así el alumno aprende a resolverlo, no solo cuál era)`
      : `da la respuesta correcta con una aclaración clara y, si ayuda, una breve recomendación de qué repasar`;
    return base + `Crea ${n} preguntas de opción múltiple sobre el tema, apropiadas para ${grado}. Cada una con 3 o 4 opciones, UNA sola correcta.
Forma EXACTA del JSON:
{"preguntas":[{"pregunta":"...","opciones":["opción A","opción B","opción C"],"correcta":0,"explicacion":"...","figura":""}]}
- "correcta" es el índice (empezando en 0) de la opción correcta dentro de "opciones".
- Las opciones incorrectas deben ser creíbles, no absurdas.
- "explicacion": ${expNota}. Sirve para repasar el error, así que enseña de verdad.
- Si la pregunta involucra cálculo, RESUÉLVELA y verifica que la opción marcada como "correcta" es de verdad la correcta.
${figuraNota}
${reglasDeduccion}${jsonOnly}`;
  }

  // retos (por defecto)
  return base + `Crea ${n} ejercicios de práctica NUEVOS para reforzar el MISMO tema y nivel, distintos entre sí${tienePdf ? " y distintos a los del documento, pero del mismo estilo" : ""}.
- Claros, resolubles y con dificultad acorde a la edad.
- Si el tema es de matemática o lógica: RESUELVE y VERIFICA cada ejercicio antes de entregarlo. Elige los números para que la respuesta sea EXACTA (un entero, salvo que el tema sea de decimales/fracciones). La respuesta debe cumplir TODAS las condiciones del enunciado, y el enunciado debe coincidir con la respuesta final.
- "pista": orienta sin dar la respuesta. "solucion": SOLO el resultado correcto y una explicación breve y clara. NUNCA escribas "Ups", "error", "ajustemos", "revisemos" ni cambies el enunciado dentro de la solución. Si un ejercicio no te cuadra, descártalo y crea otro distinto que SÍ cuadre.
Forma EXACTA del JSON:
{"ejercicios":[{"enunciado":"...","pista":"...","solucion":"...","figura":""}]}
${figuraNota}
${reglasDeduccion}${jsonOnly}`;
}

// ───────── caché en Supabase (opcional) ─────────
// Si no hay SUPABASE_URL/SUPABASE_SERVICE_KEY en el entorno, el caché se
// desactiva solo y todo funciona igual (solo que sin ahorro). Cuando estén
// configuradas, un mismo (materia+tema+modo+grado+cantidad) se reusa y NO
// vuelve a llamar a Gemini ni a bajar PDFs. Tabla: cache_generaciones.
function supabaseCfg() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? { url: url.replace(/\/+$/, ""), key } : null;
}

// ───────── límite DIARIO de gasto de IA por alumno (opcional) ─────────
// Cada llamada REAL a Gemini (NO las de caché ni las curadas, que cuestan $0) se
// estima en dólares y se suma al gasto de HOY del alumno. Si supera su tope diario
// (usuarios.ia_limite_dia_usd), la app deja de generar con IA para ese niño hasta el
// día siguiente (el cupo se reinicia cada día) — pero SIGUE sirviendo guías revisadas y
// lo ya cacheado (gratis). Las hijas / cuentas elegidas llevan ia_ilimitado=true → nunca
// se les corta. Sin Supabase o sin usuario_id, no se limita (fail-open, como el resto de la app).
// Precio por 1M de tokens (Gemini 2.5, nivel de pago). Actualizar si Google cambia tarifas.
const PRECIO_IA = {
  "gemini-2.5-flash": { in: 0.30, out: 2.50 },
  "gemini-2.5-flash-lite": { in: 0.10, out: 0.40 },
};
const LIMITE_DIA_USD = 0.20; // tope diario por defecto si la fila no trae ia_limite_dia_usd
function costoUSD(model, usage) {
  const p = PRECIO_IA[model] || PRECIO_IA["gemini-2.5-flash"];
  const inp = (usage && usage.promptTokenCount) || 0;
  const out = ((usage && usage.candidatesTokenCount) || 0) + ((usage && usage.thoughtsTokenCount) || 0);
  return (inp * p.in + out * p.out) / 1e6;
}
// Día civil de Venezuela (UTC-4, sin horario de verano) como "YYYY-MM-DD".
function diaIA() {
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}
// ¿El alumno todavía tiene presupuesto de IA HOY? Fail-open: ante cualquier duda
// (sin id, sin Supabase, error, sin fila aún) devuelve permitido=true (no cortar por un hipo).
async function presupuestoIA(usuarioId) {
  const cfg = supabaseCfg();
  if (!cfg || usuarioId == null) return { permitido: true, ilimitado: true };
  try {
    const r = await fetch(
      `${cfg.url}/rest/v1/usuarios?id=eq.${encodeURIComponent(usuarioId)}&select=ia_ilimitado,ia_limite_dia_usd,ia_gasto_dia_usd,ia_dia`,
      { headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` } }
    );
    if (!r.ok) return { permitido: true, ilimitado: true };
    const rows = await r.json();
    const u = Array.isArray(rows) && rows[0];
    if (!u || u.ia_ilimitado) return { permitido: true, ilimitado: true }; // sin fila, o hijas/elegidos
    const limite = u.ia_limite_dia_usd == null ? LIMITE_DIA_USD : Number(u.ia_limite_dia_usd);
    const gasto = u.ia_dia === diaIA() ? Number(u.ia_gasto_dia_usd || 0) : 0; // día nuevo → 0
    return { permitido: gasto < limite, ilimitado: false, limite, gasto };
  } catch (e) {
    return { permitido: true, ilimitado: true };
  }
}
// Estado de IA para el front (batería): sin dinero crudo, solo lo necesario para el gauge.
// `add` = costo (USD) de la generación recién hecha, para reflejar el gasto ya actualizado.
function iaEstado(presu, add) {
  if (!presu || presu.ilimitado || !presu.limite) return { ilimitado: true };
  const limite = presu.limite;
  const gasto = Math.min(limite, (presu.gasto || 0) + (add || 0));
  return { ilimitado: false, limite, gasto, restante: Math.max(0, limite - gasto) };
}
// Suma el costo (USD) de una generación al gasto de HOY del alumno (atómico vía RPC).
// Nunca rompe la generación.
async function registrarGastoIA(usuarioId, usd) {
  const cfg = supabaseCfg();
  if (!cfg || usuarioId == null || !(usd > 0)) return;
  try {
    await fetch(`${cfg.url}/rest/v1/rpc/sumar_gasto_ia`, {
      method: "POST",
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: usuarioId, p_usd: usd }),
    });
  } catch (e) { /* el registro de gasto nunca debe romper la generación */ }
}

// ───────── contenido curado (revisado a mano) ─────────
// Bancos que el administrador cargó a mano en la tabla contenido_curado. Se sirven
// ANTES del caché de Gemini y sin consumir cupo. Nunca rompen: ante cualquier fallo
// de lectura, devolvemos null y el flujo sigue con el caché/Gemini de siempre.
async function curadoGet(materia, tema, modo, grado) {
  const cfg = supabaseCfg();
  if (!cfg) return null;
  try {
    const q =
      `materia_norm=eq.${encodeURIComponent(normCurado(materia))}` +
      `&tema_norm=eq.${encodeURIComponent(normCurado(tema))}` +
      `&modo=eq.${encodeURIComponent(modo)}` +
      `&grado=eq.${encodeURIComponent(grado)}` +
      `&programa=eq.aula` + // candado: las alumnas solo ven contenido del aula, nunca Cumbre
      `&select=contenido,fuentes&limit=1`;
    const r = await fetch(`${cfg.url}/rest/v1/contenido_curado?${q}`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0]) || null;
  } catch (e) {
    return null;
  }
}
// Baraja una copia (Fisher–Yates); NO muta el array original.
function barajar(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Baraja las opciones de una pregunta de quiz y recalcula "correcta" (los bancos se
// escriben a mano y tienden a dejar la correcta en la misma posición). No muta.
function barajarOpciones(p) {
  const opciones = Array.isArray(p.opciones) ? p.opciones : [];
  if (opciones.length < 2 || !Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta >= opciones.length) return p;
  const correctaTxt = opciones[p.correcta];
  const mezcladas = barajar(opciones);
  const idx = mezcladas.indexOf(correctaTxt);
  return { ...p, opciones: mezcladas, correcta: idx >= 0 ? idx : p.correcta };
}
// Firma estable de un item de banco (para no repetir): hash corto del texto principal.
function sigItem(modo, it) {
  const base = modo === "retos" ? (it && it.enunciado) : (it && it.pregunta);
  return crypto.createHash("sha1").update(String(base || "")).digest("hex").slice(0, 10);
}
// Elige qué servir desde un banco curado, SIN repetir lo ya visto:
//  - resumen → { doc } (el documento completo; no aplica "no repetir").
//  - retos/quiz/examen → hasta n items NO vistos (baraja quiz), cada uno marcado con
//    _sig para que el cliente lleve la cuenta. { items, wrap, quedan } o { agotado:true }.
//  - null si no hay banco utilizable.
function servirCurado(modo, curado, n, vistos) {
  const cont = curado && curado.contenido;
  if (modo === "resumen") {
    return cont && typeof cont === "object" && !Array.isArray(cont) ? { doc: cont } : null;
  }
  const items = cont && Array.isArray(cont.items) ? cont.items : [];
  if (!items.length) return null;
  const yaVistos = vistos instanceof Set ? vistos : new Set();
  const frescos = items.filter((it) => !yaVistos.has(sigItem(modo, it)));
  if (!frescos.length) return { agotado: true }; // ya vio todos los de la guía
  const elegidos = barajar(frescos).slice(0, n);
  const muestra = elegidos.map((it) => {
    const base = modo === "quiz" ? barajarOpciones(it) : it;
    return { ...base, _sig: sigItem(modo, it) };
  });
  return { items: muestra, wrap: modo === "retos" ? "ejercicios" : "preguntas", quedan: frescos.length - elegidos.length };
}

// Una o varias API keys de Gemini. Devuelve { gratis, pagas } (arreglos, sin duplicar).
// ESTRATEGIA DE COSTO: primero se agota lo GRATIS (cada key gratis tiene su cupo de
// ~20/min por modelo) y la(s) key(s) de PAGO quedan de RESPALDO al final — solo pagan
// cuando todo lo gratis dio 429/503. La rotación es transparente para el niño (el loop
// pasa a la siguiente key en el mismo request), así que gratis-primero no empeora la UX.
// GEMINI_API_KEY_PAGA (coma-separadas) = las de pago; GEMINI_API_KEY + GEMINI_API_KEYS
// = las gratis (si la paga aparece también ahí, se saca de las gratis para no repetirla).
// Retrocompatible: sin GEMINI_API_KEY_PAGA, pagas=[] y todo funciona como antes.
function geminiKeys() {
  const limpiar = (s) => String(s || "").split(",").map((k) => k.trim()).filter(Boolean);
  const pagas = [...new Set(limpiar(process.env.GEMINI_API_KEY_PAGA))];
  const gratis = [...new Set([...limpiar(process.env.GEMINI_API_KEY), ...limpiar(process.env.GEMINI_API_KEYS)])]
    .filter((k) => !pagas.includes(k));
  return { gratis, pagas };
}
function claveCache(o) {
  const ver = PROMPT_VER[o.modo] || "";
  // El resumen no usa "cantidad": la ignoramos en la clave para no fragmentar el
  // caché (si no, cambiar la cantidad en otro modo regeneraría el resumen con IA).
  const cant = o.modo === "resumen" ? "" : o.cantidad || "";
  const s = [o.materia || "", o.tema || "", o.modo || "", o.grado || "", cant, o.firma || "", ver]
    .join("|").toLowerCase();
  return crypto.createHash("sha1").update(s).digest("hex");
}
// Firma barata del contenido del tema (URLs + fecha de modificación de los
// archivos). Si la maestra sube/actualiza una guía, la firma cambia → clave nueva
// → se regenera solo con el contenido nuevo (antes la caché quedaba "ciega").
function firmaContenido(contexto) {
  const acts = contexto && Array.isArray(contexto.actividades) ? contexto.actividades : [];
  const base = acts.map((a) => `${a.archivoUrl || a.nombre || ""}:${a.modificado || ""}`).join("~");
  // Tema libre: los "datos clave" que escribió el alumno distinguen el contenido, así
  // dos temas libres con el mismo título pero distinta descripción NO comparten caché.
  // Vacío para temas del aula → la clave queda idéntica a la de antes (no invalida caché).
  const datos = (contexto && contexto.datosClave) || "";
  return datos ? `d:${datos}~${base}` : base;
}
// Valida que la generación tenga la forma mínima esperada, para NO cachear (ni
// mostrar) resultados vacíos o rotos que envenenarían el tema para todos.
function esValido(modo, d) {
  if (!d || typeof d !== "object") return false;
  if (modo === "resumen") {
    return (Array.isArray(d.secciones) && d.secciones.length >= 2) ||
           (Array.isArray(d.puntos) && d.puntos.length >= 3);
  }
  const arr = modo === "retos" ? d.ejercicios : d.preguntas;
  if (!Array.isArray(arr) || !arr.length) return false;
  if (modo === "retos") return arr.every((e) => e && String(e.enunciado || "").trim());
  if (modo === "examen") return arr.every((p) => p && String(p.pregunta || "").trim());
  if (modo === "quiz") return arr.every((p) =>
    p && Array.isArray(p.opciones) && p.opciones.length >= 2 &&
    Number.isInteger(p.correcta) && p.correcta >= 0 && p.correcta < p.opciones.length);
  return true;
}
async function cacheGet(clave) {
  const cfg = supabaseCfg();
  if (!cfg) return null;
  try {
    const r = await fetch(`${cfg.url}/rest/v1/cache_generaciones?clave=eq.${clave}&select=contenido`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return (Array.isArray(rows) && rows[0] && rows[0].contenido) || null;
  } catch (e) {
    return null;
  }
}
async function cacheSet(clave, fila) {
  const cfg = supabaseCfg();
  if (!cfg) return;
  try {
    await fetch(`${cfg.url}/rest/v1/cache_generaciones`, {
      method: "POST",
      headers: {
        apikey: cfg.key,
        Authorization: `Bearer ${cfg.key}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify({ clave, ...fila }),
    });
  } catch (e) {
    /* el caché nunca debe romper la generación */
  }
}

// Llama a Gemini con reintentos: ante 429 (límite por minuto) o 503 (saturado)
// espera un poco y reintenta, en vez de fallarle al niño de una.
async function pedirAGemini(url, payload, intentos = 2) {
  let ultimo = { data: null, status: 0 };
  for (let i = 0; i < intentos; i++) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = null;
    try { data = await r.json(); } catch (e) { data = null; }
    const status = (data && data.error && data.error.code) || r.status;
    ultimo = { data, status };
    // Solo reintentamos en 503 (saturación transitoria). En 429 (límite por
    // minuto) NO reintentamos: reintentar gastaría más cuota y la empeora.
    if (status === 503 && i < intentos - 1) {
      await dormir(900 * (i + 1)); // backoff corto: 0.9s, 1.8s
      continue;
    }
    return ultimo;
  }
  return ultimo;
}

// Saca los segundos que Gemini pide esperar ("Please retry in 7.05s.").
function segReintento(msg) {
  const m = String(msg || "").match(/retry in\s+([\d.]+)\s*s/i);
  return m ? Math.ceil(parseFloat(m[1])) : null;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://aula-cam.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { materia, tema, grado = "4to grado", cantidad = 5, contexto, token } = req.body || {};
    if (!tema) return res.status(400).json({ error: "Falta el campo 'tema'" });
    // Para el límite de gasto de IA por alumno (lo manda el front, igual que en errores/actividad).
    const usuarioId = req.body && req.body.usuario_id != null ? req.body.usuario_id : null;

    const { gratis, pagas } = geminiKeys();
    if (!gratis.length && !pagas.length) return res.status(500).json({ error: "Falta GEMINI_API_KEY en Vercel" });

    const modo = MODOS_VALIDOS.has(req.body && req.body.modo) ? req.body.modo : "retos";
    const n = Math.min(Math.max(parseInt(cantidad, 10) || 5, 1), 10);

    // Fotos del cuaderno (apuntes de clase presencial): personales del alumno, complementan el material.
    const fotos = limpiarFotos(req.body && req.body.fotos);
    const tieneFotos = fotos.length > 0;
    const nocache = !!(req.body && req.body.nocache);
    // Dos caminos explícitos desde la app: "Guía revisada" (soloCurado) y "Con IA"
    // (sinCurado). "vistos" = firmas de los items que el alumno YA vio (para no
    // repetir dentro de la guía).
    const soloCurado = !!(req.body && req.body.soloCurado);
    const sinCurado = !!(req.body && req.body.sinCurado);
    const vistos = new Set(Array.isArray(req.body && req.body.vistos) ? req.body.vistos.map(String) : []);

    // 0) CONTENIDO CURADO: bancos revisados a mano. Se sirven ANTES del caché/Gemini
    //    (sin gastar cupo). "Con IA" (sinCurado) y las fotos lo saltan a propósito.
    //    Dentro de la guía NO se repite: solo items no vistos; al agotarse, se avisa.
    if (!tieneFotos && !sinCurado) {
      const curado = await curadoGet(materia, tema, modo, grado);
      if (curado) {
        const s = servirCurado(modo, curado, n, vistos);
        const comun = {
          tema, materia: materia || null, modo, curado: true,
          basadoEnMaterial: true, fuentes: Array.isArray(curado.fuentes) ? curado.fuentes : [],
        };
        if (s && s.doc) return res.status(200).json({ ...s.doc, ...comun });
        if (s && s.items) return res.status(200).json({ [s.wrap]: s.items, ...comun, agotado: s.quedan <= 0 });
        if (s && s.agotado && soloCurado) {
          // ya vio TODA la guía y pidió solo la guía → avisamos para ofrecer IA.
          return res.status(200).json({ ...comun, agotado: true, sinItems: true });
        }
        // s.agotado sin soloCurado → cae a Gemini para seguir practicando.
      } else if (soloCurado) {
        // pidió la guía pero este tema/modo aún no tiene banco curado.
        return res.status(200).json({ tema, materia: materia || null, modo, curado: false, sinBanco: true });
      }
    }

    // 1) caché: si ya generamos esto antes, lo devolvemos al instante (sin Gemini ni PDFs).
    //    nocache=true (botón "generar otros") salta la lectura. Con fotos NO se cachea (son personales).
    //    La firma del contenido entra en la clave → si la maestra actualiza el material, se regenera.
    const firma = firmaContenido(contexto);
    const clave = claveCache({ materia, tema, modo, grado, cantidad: n, firma });
    const noCache = nocache || tieneFotos;
    if (!noCache) {
      const hit = await cacheGet(clave);
      if (hit) return res.status(200).json({ ...hit, cacheado: true });
    }

    // LÍMITE DE IA: llegamos acá solo si NO hubo guía curada ni caché (o si se saltaron
    //   a propósito con "Con IA"/fotos) → esta generación SÍ cuesta plata. Si el alumno
    //   ya gastó su presupuesto de HOY, no generamos: le queda la guía revisada y lo ya
    //   cacheado (gratis), y mañana se le reinicia el cupo. Las hijas / cuentas con
    //   ia_ilimitado nunca entran acá.
    const presu = await presupuestoIA(usuarioId);
    if (!presu.permitido) {
      return res.status(200).json({ limiteIA: true, tema, materia: materia || null, modo, ia: iaEstado(presu) });
    }

    const material = armarMaterial(contexto);

    // Descarga los PDFs reales del tema (no rompe si falla alguno).
    let pdfs = [];
    try {
      pdfs = await juntarPdfs(contexto, token);
    } catch (e) {
      pdfs = [];
    }

    // ¿el tema es numérico? (por materia o por el título del tema)
    const numerica = esNumerica(materia) || esNumerica(tema);
    // examenFoto: las fotos son de un examen corregido (modo refuerzo) → la IA ataca lo que falló
    const fotosExamen = tieneFotos && !!(req.body && req.body.examenFoto);
    const prompt = armarPrompt({ modo, material, tienePdf: pdfs.length > 0, tieneFotos, fotosExamen, grado, tema, materia, n, numerica });

    // Partes del request: el prompt + cada PDF + cada foto del cuaderno como inline_data.
    const parts = [{ text: prompt }];
    for (const p of pdfs) {
      parts.push({ inline_data: { mime_type: "application/pdf", data: p.buf.toString("base64") } });
    }
    for (const f of fotos) {
      parts.push({ inline_data: { mime_type: f.mime, data: f.data } });
    }

    const esEjercicio = modo === "retos" || modo === "quiz";
    // El resumen y el examen de un tema numérico llevan cálculos (ejemplos/
    // procedimientos): conviene el modelo completo + thinking para que salgan bien.
    const necesitaMate = esEjercicio || ((modo === "resumen" || modo === "examen") && numerica);
    const genCfg = {
      temperature: esEjercicio ? 0.7 : necesitaMate ? 0.8 : 0.9, // más bajo con cálculo → más correcto
      responseMimeType: "application/json", // fuerza a Gemini a devolver JSON limpio
    };
    // Pensar antes de responder mejora MUCHO la matemática (retos/quiz y resumen
    // numérico). Razona aparte y los cálculos salen limpios y correctos.
    if (necesitaMate) genCfg.thinkingConfig = { thinkingBudget: 4096 };
    const payload = { contents: [{ parts }], generationConfig: genCfg };
    // REGLA DE MODELOS (2026-07-04): flash-lite NUNCA toca contenido numérico/lógico —
    // por más blindado que esté el prompt, se equivoca. Prioridades:
    // - Tema NUMÉRICO (mate/lógica/olimpiada, cualquier modo): SOLO flash. Sin respaldo
    //   hacia abajo: si flash se agota en TODAS las keys (gratis + paga), devolvemos el
    //   429/503 amable y el front enfría/reintenta — mejor esperar unos segundos que
    //   servir un ejercicio mal hecho. Con la key paga (flash 1000 req/min) en la cola,
    //   en la práctica nunca se agota.
    // - PRÁCTICA de teoría (retos/quiz/examen no numéricos): flash preferido (calidad),
    //   flash-lite solo como ÚLTIMO recurso (sin números el riesgo es bajo; mejor que fallar).
    // - RESUMEN de teoría: flash-lite (barato, texto puro) con flash de respaldo.
    const esPractica = esEjercicio || modo === "examen";
    const modelos = numerica
      ? [MODEL_EJERCICIOS] // numérico: SOLO flash, nunca degradar a lite
      : esPractica
      ? [MODEL_EJERCICIOS, MODEL_TEXTO] // práctica de teoría: flash primero
      : [MODEL_TEXTO, MODEL_EJERCICIOS]; // resumen de teoría: lite primero
    // Probamos modelos × keys. Ante 429 (cupo) o 503 (saturado) seguimos con la
    // próxima key; agotadas todas, el próximo modelo. ESTRATEGIA DE COSTO: primero
    // TODAS las gratis (arrancando en una al azar, para repartir su cupo de ~20/min
    // entre requests) y la PAGA al FINAL como respaldo — solo gasta plata cuando lo
    // gratis se agotó o está saturado. La rotación pasa dentro del mismo request,
    // así que el niño no nota nada.
    const ini = gratis.length > 1 ? Math.floor(Math.random() * gratis.length) : 0;
    const ordenKeys = [...gratis.map((_, i) => gratis[(ini + i) % gratis.length]), ...pagas];
    let data = null,
      status = 0,
      modeloUsado = modelos[0],
      keyUsada = null;
    buscar: for (const m of modelos) {
      const ep = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
      for (const key of ordenKeys) {
        const r = await pedirAGemini(`${ep}?key=${key}`, payload);
        data = r.data;
        status = r.status;
        modeloUsado = m;
        keyUsada = key;
        if (status !== 429 && status !== 503) break buscar; // éxito o error no recuperable
      }
    }
    // ¿la sirvió la key de pago? (true = esta generación costó plata de verdad)
    const usoPaga = keyUsada != null && pagas.includes(keyUsada);

    if (!data) throw new Error("El modelo no respondió. Intenta de nuevo.");
    if (data.error) {
      if (status === 429) {
        // límite por minuto: mensaje amable + código + segundos que pide esperar + detalle.
        return res.status(429).json({
          error: "Hay mucha demanda en este momento. Espera unos segundos y vuelve a intentar.",
          code: 429,
          retryAfter: segReintento(data.error && data.error.message),
          detalle: (data.error && data.error.message) || null,
        });
      }
      if (status === 503) {
        // modelo saturado (transitorio): el front reintenta solo una vez
        return res.status(503).json({
          error: "El servicio está ocupado en este momento. Intenta de nuevo en unos segundos.",
          code: 503,
        });
      }
      throw new Error(data.error.message);
    }

    let parsed;
    try {
      const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      const limpio = texto.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(limpio);
    } catch (e) {
      // Gemini devolvió algo que no es JSON: no cacheamos y pedimos reintentar.
      return res.status(502).json({ error: "No pudimos armar la actividad. Intenta de nuevo.", code: 502 });
    }
    // Si salió vacío o malformado, NO lo cacheamos (evita envenenar el tema para todos).
    if (!esValido(modo, parsed)) {
      return res.status(502).json({ error: "No salió bien esta vez. Intenta de nuevo.", code: 502 });
    }

    // parsed va PRIMERO, pero nuestras claves de control van al final para que una
    // alucinación de Gemini (ej. un "modo" inventado) NO pise las nuestras.
    const respuesta = {
      ...parsed,
      tema,
      materia: materia || null,
      modo,
      basadoEnMaterial: !!material || pdfs.length > 0 || tieneFotos,
      fuentes: pdfs.map((p) => p.nombre), // PDFs que Gemini realmente leyó
      apuntes: tieneFotos, // usó fotos del cuaderno del alumno
      iaVia: usoPaga ? "paga" : "gratis", // diagnóstico: qué tipo de key sirvió esta generación
      iaModelo: modeloUsado, // diagnóstico: qué modelo generó (auditar que lo numérico salga de flash)
    };
    // 2) guardamos en caché para la próxima vez — SALVO si usó fotos (resultado personal del alumno)
    if (!tieneFotos) {
      await cacheSet(clave, { materia: materia || null, tema, modo, grado, cantidad: n, contenido: respuesta });
    }
    // 3) sumamos el costo estimado al gasto de HOY del alumno (límite de IA). Cuenta
    //    AUNQUE la haya servido una key gratis: el cupo diario es un freno de USO por
    //    niño (las gratis también se agotan y son compartidas entre todos); si contara
    //    solo la paga, un niño podría vaciar el cupo gratis de los demás sin frenarse.
    const costo = costoUSD(modeloUsado, data.usageMetadata);
    await registrarGastoIA(usuarioId, costo);
    // El estado de IA (batería) es POR ALUMNO → se agrega DESPUÉS de cachear (línea de arriba),
    // así el caché compartido nunca guarda el presupuesto de un niño en particular.
    respuesta.ia = iaEstado(presu, costo);
    return res.status(200).json(respuesta);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
