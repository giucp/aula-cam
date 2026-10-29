// herramientas/demo-familia.mjs — datos FICTICIOS del panel de familia para el servidor de demo.
// `node herramientas/demo-servidor.mjs` → http://localhost:4321/familia.html (cualquier código entra).
// Espeja los casos reales que el panel tiene que aguantar: tareas largas vencidas, un examen
// cercano, quiz altos y bajos, una práctica vista "a la carrera", una práctica abierta sin ver
// respuestas, errores con su detalle, aperturas de noche y horario con materias propias.
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const hace = (dias, h = 16, m = 20) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(h, m, 0, 0); return d.toISOString(); };
const mas = (iso, min) => new Date(Date.parse(iso) + min * 60000).toISOString();

export function panelDemo() {
  const a1 = hace(0, 16, 5), a2 = hace(0, 16, 22), a3 = hace(0, 16, 40), a4 = hace(2, 18, 10), a5 = hace(2, 18, 30), a6 = hace(5, 15, 0), a7 = hace(9, 19, 0), a8 = hace(12, 17, 0);
  return {
    ok: true,
    anioDesde: (() => { const d = new Date(); const y = d.getMonth() >= 8 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-09-01`; })(),
    perfil: { nombre: "Martina Bambini", grado: "5to grado", nombre_corto: "5G", racha_dias: 3, ultimo_acceso: hace(0, 17), accesos: 86 },
    actividad: [
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "resumen", creado: a1 },
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "retos", creado: a2 },
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "quiz", aciertos: 4, total: 5, creado: a3 },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", modo: "resumen", creado: a4 },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", modo: "quiz", aciertos: 2, total: 5, creado: a5 },
      { materia: "INGLÉS 5G", tema: "Unit 1 · Daily routines", modo: "examen", creado: a6 },
      { materia: "LENGUAJE 5G", tema: "El texto narrativo", modo: "quiz", aciertos: 8, total: 8, creado: a7 },
      { materia: "MATEMÁTICAS 5G", tema: "TEMA 2. Polígonos y su clasificación", modo: "quiz", aciertos: 6, total: 8, creado: a8 },
    ],
    estudio: [
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "resumen", fuente: "ia", segundos: 410, items: null, creado: mas(a1, 7) },
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "retos", fuente: "ia", segundos: 760, items: 5, revelados: 5, pistas: 2, creado: mas(a2, 14) },
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "quiz", fuente: "ia", segundos: 300, items: 5, respondidas: 5, aciertos: 4, total: 5, creado: mas(a3, 5) },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", modo: "resumen", fuente: "guia", segundos: 250, creado: mas(a4, 4) },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", modo: "quiz", fuente: "guia", segundos: 180, items: 5, respondidas: 5, aciertos: 2, total: 5, creado: mas(a5, 3) },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", modo: "retos", fuente: "ia", segundos: 70, items: 5, revelados: 0, pistas: 0, creado: hace(2, 18, 40) },
      { materia: "INGLÉS 5G", tema: "Unit 1 · Daily routines", modo: "examen", fuente: "ia", segundos: 60, items: 8, revelados: 8, creado: mas(a6, 1) },
    ],
    aperturas: [hace(0, 16, 0), hace(0, 21, 40), hace(1, 7, 10), hace(2, 18, 5), hace(2, 22, 50), hace(5, 14, 55), hace(6, 19, 30), hace(9, 18, 50), hace(12, 16, 45)],
    notas: [
      { materia: "MATEMÁTICAS 5G", descripcion: "Prueba de fracciones", nota: 13, fecha: dia(-3) },
      { materia: "LENGUAJE 5G", descripcion: "Dictado", nota: 18, fecha: dia(-8) },
      { materia: "MATEMÁTICAS 5G", descripcion: "Quiz de decimales", nota: 16, fecha: dia(-15) },
    ],
    tareas: [
      { materia: "CIENCIAS NATURALES 5G", tipo: "tarea", descripcion: "Traer habladores con al menos 5 cambios para cada uno y 5 herramientas, todo organizado", fecha: dia(-2), hecha: false },
      { materia: "CIENCIAS NATURALES 5G", tipo: "trabajo", descripcion: "C. Naturales: culminó el contenido adolescencia y sexualidad. Traer papel bond base 20, marcadores, colores, regla, tijera, imágenes, habladores o etiquetas con títulos", fecha: dia(-1), hecha: false },
      { materia: "MATEMÁTICAS 5G", tipo: "examen", descripcion: "Examen de decimales", fecha: dia(2), hecha: false },
      { materia: "INGLÉS 5G", tipo: "tarea", descripcion: "Workbook página 12", fecha: dia(1), hecha: false },
      { materia: "CIENCIAS SOCIALES 5G", tipo: "trabajo", descripcion: "Maqueta de las regiones naturales", fecha: dia(9), hecha: false },
      { materia: "LENGUAJE 5G", tipo: "tarea", descripcion: "Leer el capítulo 3", fecha: dia(-5), hecha: true },
    ],
    horario: [
      { dia: 1, materia: "MATEMÁTICAS 5G", orden: 1 }, { dia: 1, materia: "LENGUAJE 5G", orden: 2 }, { dia: 1, materia: "Caligrafía", orden: 3 },
      { dia: 2, materia: "CIENCIAS NATURALES 5G", orden: 1 }, { dia: 2, materia: "INGLÉS 5G", orden: 2 },
      { dia: 3, materia: "CIENCIAS SOCIALES 5G", orden: 1 }, { dia: 3, materia: "INFORMÁTICA 5G", orden: 2 },
      { dia: 4, materia: "LÓGICA MATEMÁTICA 5G", orden: 1 }, { dia: 4, materia: "MÚSICA 5G", orden: 2 },
      { dia: 5, materia: "EDUCACIÓN FÍSICA 5G", orden: 1 },
    ],
    errores: [
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", pregunta: "¿Qué tipo de vegetación predomina en los Llanos venezolanos?", opciones: ["Selva tropical", "Sabana", "Páramo", "Manglar"], correcta: 1, elegida: 0, explicacion: "Los Llanos tienen dos estaciones marcadas (lluvia y sequía), y por eso crecen pastos y árboles dispersos: eso es una sabana.\nRespuesta correcta: Sabana", creado: hace(2) },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", pregunta: "¿Cuál región tiene el clima más frío?", opciones: ["Los Andes", "La Guayana", "Los Llanos"], correcta: 0, elegida: 2, explicacion: "A mayor altura, menor temperatura. Los Andes son la región más alta.\nRespuesta correcta: Los Andes", creado: hace(2) },
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", pregunta: "¿Qué número sigue? 3, 6, 12, 24, …", opciones: ["30", "36", "48"], correcta: 2, elegida: 1, explicacion: "Cada número es el doble del anterior: 24 × 2 = 48.\nRespuesta correcta: 48", creado: hace(0) },
    ],
    reportes: [{ materia: "MATEMÁTICAS 5G", tema: "TEMA 2. Polígonos y su clasificación", modo: "quiz", creado: hace(12) }],
  };
}
