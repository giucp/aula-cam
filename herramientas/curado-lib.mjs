// herramientas/curado-lib.mjs — lógica compartida de contenido curado.
// Valida un "banco" (documento con materia/tema/grado + modos) y arma las filas
// para la tabla contenido_curado. La usan el script local (cargar-curado.mjs) y el
// endpoint admin (api/cargar-curado.js), así el validador es idéntico en los dos.
// Pura: sin fs, sin red.
import { normCurado } from "./normcurado.mjs";

// Grados plausibles (solo para avisar de typos; se sube igual si no está).
const GRADOS_CONOCIDOS = new Set([
  "1er grado", "2do grado", "3er grado", "4to grado", "5to grado", "6to grado",
  "1er año", "2do año", "3er año", "4to año", "5to año",
  "Cumbre Matemática 1er año",
]);
// Programas conocidos: 'aula' (temario venezolano, lo de siempre) y 'cumbre' (élite).
const PROGRAMAS_CONOCIDOS = new Set(["aula", "cumbre"]);
const esStr = (s) => typeof s === "string" && s.trim().length > 0;

// Valida un modo del banco. { ok:true, contenido } o { ok:false, motivo }.
export function validarModo(modo, valor) {
  if (modo === "resumen") {
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return { ok: false, motivo: "resumen debe ser un objeto" };
    if (!esStr(valor.titulo)) return { ok: false, motivo: "resumen sin 'titulo'" };
    if (!Array.isArray(valor.secciones) || valor.secciones.length < 2) return { ok: false, motivo: "resumen con menos de 2 secciones" };
    for (const [i, s] of valor.secciones.entries()) {
      if (!s || !esStr(s.titulo) || !esStr(s.explicacion)) return { ok: false, motivo: `sección ${i + 1} sin titulo/explicacion` };
    }
    return { ok: true, contenido: valor }; // documento completo
  }
  if (!Array.isArray(valor) || !valor.length) return { ok: false, motivo: `${modo} debe ser un arreglo no vacío` };
  if (modo === "retos") {
    for (const [i, e] of valor.entries()) {
      if (!e || !esStr(e.enunciado)) return { ok: false, motivo: `reto ${i + 1} sin 'enunciado'` };
      if (!esStr(e.solucion)) return { ok: false, motivo: `reto ${i + 1} sin 'solucion'` };
    }
  } else if (modo === "examen") {
    for (const [i, p] of valor.entries()) {
      if (!p || !esStr(p.pregunta)) return { ok: false, motivo: `examen ${i + 1} sin 'pregunta'` };
      if (!esStr(p.respuesta)) return { ok: false, motivo: `examen ${i + 1} sin 'respuesta'` };
    }
  } else if (modo === "quiz") {
    for (const [i, p] of valor.entries()) {
      if (!p || !esStr(p.pregunta)) return { ok: false, motivo: `quiz ${i + 1} sin 'pregunta'` };
      if (!Array.isArray(p.opciones) || p.opciones.length < 2) return { ok: false, motivo: `quiz ${i + 1} con menos de 2 opciones` };
      if (!Number.isInteger(p.correcta) || p.correcta < 0 || p.correcta >= p.opciones.length) return { ok: false, motivo: `quiz ${i + 1}: 'correcta' fuera de rango` };
    }
  }
  return { ok: true, contenido: { items: valor } }; // demás: { items: [...] }
}

// doc → { filas, avisos, materia_norm, tema_norm, grado }. Lanza si el banco es
// inválido (falta materia/tema/grado o no trae ningún modo). Un modo mal formado
// se OMITE con aviso, sin tumbar el resto.
export function filasDeBanco(doc, ahoraISO) {
  if (!doc || typeof doc !== "object") throw new Error("banco vacío o no es objeto");
  if (!esStr(doc.materia)) throw new Error("falta 'materia'");
  if (!esStr(doc.tema)) throw new Error("falta 'tema'");
  if (!esStr(doc.grado)) throw new Error("falta 'grado'");

  const avisos = [];
  if (!GRADOS_CONOCIDOS.has(doc.grado)) avisos.push(`grado "${doc.grado}" no está en la lista conocida — se sube igual`);
  // programa: 'aula' por defecto (retrocompatible con todos los bancos ya existentes);
  // 'cumbre' para el currículo de élite. Aísla ambos mundos en la misma tabla.
  const programa = esStr(doc.programa) ? doc.programa.trim().toLowerCase() : "aula";
  if (!PROGRAMAS_CONOCIDOS.has(programa)) avisos.push(`programa "${programa}" desconocido — se sube igual`);
  const materia_norm = normCurado(doc.materia);
  const tema_norm = normCurado(doc.tema);
  const fuentes = Array.isArray(doc.fuentes) ? doc.fuentes.filter(esStr) : null;
  const ahora = ahoraISO || new Date().toISOString();

  const filas = [];
  let algun = false;
  // El esquema de Cumbre llama "practica" a lo que internamente es el modo "retos"
  // (mismos campos: enunciado/pista/solucion/figura). Se acepta como alias.
  const fuenteDe = (modo) =>
    modo === "retos" ? (doc.retos != null ? doc.retos : doc.practica) : doc[modo];
  for (const modo of ["resumen", "retos", "quiz", "examen"]) {
    const valor = fuenteDe(modo);
    if (valor == null) continue;
    algun = true;
    const v = validarModo(modo, valor);
    if (!v.ok) { avisos.push(`modo ${modo} omitido: ${v.motivo}`); continue; }
    filas.push({
      materia_norm, tema_norm, modo, grado: doc.grado, programa,
      contenido: v.contenido,
      fuentes: fuentes && fuentes.length ? fuentes : null,
      actualizado: ahora,
    });
  }
  if (!algun) throw new Error("no trae ningún modo (resumen/retos/quiz/examen)");
  return { filas, avisos, materia_norm, tema_norm, grado: doc.grado, programa };
}
