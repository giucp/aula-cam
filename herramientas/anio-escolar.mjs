// herramientas/anio-escolar.mjs — qué es "del año escolar en curso" (lo usan api/agenda y api/familia).
//
// ★ POR QUÉ EXISTE (2026-10-20): horario, notas y tareas no tienen año escolar. Cada septiembre
//   el boletín del año pasado aparecía como si fuera el de este, y el horario seguía con las
//   materias del grado anterior; hubo que limpiarlos A MANO en 2026-09. En vez de una migración,
//   el servidor filtra al leer: se ve solo lo de este año escolar. Nada se borra de la base.
//
// Año escolar venezolano: septiembre a julio. Agosto todavía cuenta como el año que terminó
// (vacaciones), así que el corte es el 1 de septiembre.

function hoyCaracas() {
  // "YYYY-MM-DD" en hora de Venezuela (el server de Vercel corre en UTC)
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

export function inicioAnioEscolar(hoy = hoyCaracas()) {
  const [y, m] = hoy.split("-").map(Number);
  return `${m >= 9 ? y : y - 1}-09-01`;
}

// Nota o tarea: cuenta su fecha; si no tiene, cuándo se anotó. Sin ninguna de las dos, se muestra.
export function esDelAnioEnCurso(fila, inicio = inicioAnioEscolar()) {
  const f = (fila && (fila.fecha || String(fila.creado || "").slice(0, 10))) || "";
  return !f || f >= inicio;
}

// Horario: una materia con marca de grado ("MÚSICA 4G") que no es la del grado que cursa es del
// año pasado. Las materias propias (Caligrafía, Biblioteca) no llevan marca y siempre pasan.
// Sin grado conocido (nombreCorto vacío) no se descarta nada.
const MARCA_GRADO = /\b([1-6])\s*([GA])\b/i;
export function esDelGradoActual(materia, nombreCorto) {
  const t = String(materia || "").match(MARCA_GRADO);
  if (!t || !nombreCorto) return true;
  return `${t[1]}${t[2].toUpperCase()}` === String(nombreCorto).toUpperCase().replace(/\s+/g, "");
}
