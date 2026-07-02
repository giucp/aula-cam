// herramientas/normcurado.mjs
// Normalización compartida para casar lo que manda la app con el contenido curado
// a mano: minúsculas, sin acentos, espacios colapsados y sin el sufijo de grado
// ("5G" / "1A"). La usan api/generar.js (búsqueda) y los scripts de carga/lectura.
// IMPORTANTE: fuente única — no duplicar esta lógica; importarla desde aquí.
export function normCurado(s) {
  return String(s || "")
    .replace(/\b[1-6]\s*[GA]\b/gi, " ")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ").trim().toLowerCase();
}
