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

const MODEL = "gemini-2.5-flash-lite";
const MAX_PDFS = 3;                       // cuántos PDFs leer por generación
const MAX_PDF_BYTES = 8 * 1024 * 1024;    // por archivo
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // suma de todos
const DL_TIMEOUT_MS = 9000;               // timeout por descarga
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

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

function armarPrompt({ modo, material, tienePdf, grado, tema, materia, n }) {
  const ctx = material
    ? `Este es el material REAL del aula del alumno (lo que está viendo):\n\n${material}\n`
    : `Tema: "${tema}" (materia: ${materia || "General"}).\n`;
  const pdfNota = tienePdf
    ? `\nTe adjunto la(s) guía(s)/hoja(s) en PDF con la teoría y los ejercicios reales del tema. Léelas con atención y básate en su contenido.\n`
    : ``;
  const base = `Eres un docente de ${grado} en Venezuela, cálido y claro. Escribe en español neutro y claro, con palabras apropiadas para ${grado}. No uses jerga regional ni saludos coloquiales como "chamos", "chamo", "épale" o "pana"; dirígete al alumno de forma sencilla y neutra.\n\n${ctx}${pdfNota}\n`;
  const jsonOnly = `Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.`;

  if (modo === "resumen") {
    return base + `Hazle al alumno un RESUMEN del tema para que le sea fácil de entender y recordar: claro, corto, con tono cálido y motivador.
Forma EXACTA del JSON:
{"titulo":"título del tema","puntos":["idea simple 1","idea simple 2","..."],"idea_clave":"la idea más importante en una sola frase"}
- Entre 4 y 7 puntos, cada uno una frase corta y concreta.
${jsonOnly}`;
  }

  if (modo === "examen") {
    return base + `Crea ${n} posibles preguntas de examen sobre el tema, cada una con su respuesta correcta, para que el alumno se autoevalúe. Variadas, claras y que cubran lo importante del tema.
Forma EXACTA del JSON:
{"preguntas":[{"pregunta":"...","respuesta":"..."}]}
- La respuesta debe ser correcta y breve.
${jsonOnly}`;
  }

  if (modo === "quiz") {
    return base + `Crea ${n} preguntas de opción múltiple sobre el tema, apropiadas para ${grado}. Cada una con 3 o 4 opciones, UNA sola correcta, y una explicación breve del porqué.
Forma EXACTA del JSON:
{"preguntas":[{"pregunta":"...","opciones":["opción A","opción B","opción C"],"correcta":0,"explicacion":"..."}]}
- "correcta" es el índice (empezando en 0) de la opción correcta dentro de "opciones".
- Las opciones incorrectas deben ser creíbles, no absurdas.
${jsonOnly}`;
  }

  // retos (por defecto)
  return base + `Crea ${n} ejercicios de práctica NUEVOS para reforzar el MISMO tema y nivel, distintos entre sí${tienePdf ? " y distintos a los del documento, pero del mismo estilo" : ""}.
- Claros, resolubles y con dificultad acorde a la edad.
- Si el tema es de matemática o lógica, usa números concretos y resultados verificables.
- La "pista" orienta sin dar la respuesta; la "solucion" es correcta y breve.
Forma EXACTA del JSON:
{"ejercicios":[{"enunciado":"...","pista":"...","solucion":"..."}]}
${jsonOnly}`;
}

// Llama a Gemini con reintentos: ante 429 (límite por minuto) o 503 (saturado)
// espera un poco y reintenta, en vez de fallarle al niño de una.
async function pedirAGemini(url, payload, intentos = 3) {
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
    if ((status === 429 || status === 503) && i < intentos - 1) {
      await dormir(900 * (i + 1)); // backoff corto: 0.9s, 1.8s
      continue;
    }
    return ultimo;
  }
  return ultimo;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });

  try {
    const { materia, tema, grado = "4to grado", cantidad = 5, contexto, token } = req.body || {};
    if (!tema) return res.status(400).json({ error: "Falta el campo 'tema'" });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Falta GEMINI_API_KEY en Vercel" });

    const modo = MODOS_VALIDOS.has(req.body && req.body.modo) ? req.body.modo : "retos";
    const n = Math.min(Math.max(parseInt(cantidad, 10) || 5, 1), 10);
    const material = armarMaterial(contexto);

    // Descarga los PDFs reales del tema (no rompe si falla alguno).
    let pdfs = [];
    try {
      pdfs = await juntarPdfs(contexto, token);
    } catch (e) {
      pdfs = [];
    }

    const prompt = armarPrompt({ modo, material, tienePdf: pdfs.length > 0, grado, tema, materia, n });

    // Partes del request: el prompt + cada PDF como inline_data.
    const parts = [{ text: prompt }];
    for (const p of pdfs) {
      parts.push({ inline_data: { mime_type: "application/pdf", data: p.buf.toString("base64") } });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.9,
        responseMimeType: "application/json", // fuerza a Gemini a devolver JSON limpio
      },
    };
    const { data, status } = await pedirAGemini(url, payload);

    if (!data) throw new Error("El modelo no respondió. Intenta de nuevo.");
    if (data.error) {
      if (status === 429) {
        // límite por minuto: mensaje amable + código para que el front lo distinga
        return res.status(429).json({
          error: "Hay mucha demanda en este momento. Espera unos segundos y vuelve a intentar.",
          code: 429,
        });
      }
      throw new Error(data.error.message);
    }

    const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    const limpio = texto.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(limpio);

    return res.status(200).json({
      tema,
      materia: materia || null,
      modo,
      basadoEnMaterial: !!material || pdfs.length > 0,
      fuentes: pdfs.map((p) => p.nombre), // PDFs que Gemini realmente leyó
      ...parsed,
    });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
