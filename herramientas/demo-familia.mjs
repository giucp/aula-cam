// herramientas/demo-familia.mjs — datos FICTICIOS del panel de familia para el servidor de demo.
// `node herramientas/demo-servidor.mjs` → http://localhost:4321/familia.html (cualquier código entra).
// Espeja los casos reales que el panel tiene que aguantar: tareas largas vencidas, un examen
// cercano, días con y sin quiz, notas flojas y buenas, horario con materias propias.
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const hace = (dias, h = 16) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(h, 20, 0, 0); return d.toISOString(); };

export function panelDemo() {
  return {
    ok: true,
    perfil: { nombre: "Martina Bambini", grado: "5to grado", nombre_corto: "5G", racha_dias: 3, ultimo_acceso: hace(0, 17) },
    actividad: [
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "quiz", aciertos: 4, total: 5, creado: hace(0, 17) },
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "retos", creado: hace(0, 16) },
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", modo: "resumen", creado: hace(0, 16) },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", modo: "resumen", creado: hace(2, 18) },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", modo: "quiz", aciertos: 2, total: 5, creado: hace(2, 18) },
      { materia: "INGLÉS 5G", tema: "Unit 1 · Daily routines", modo: "examen", creado: hace(5, 15) },
      { materia: "LENGUAJE 5G", tema: "El texto narrativo", modo: "quiz", aciertos: 8, total: 8, creado: hace(9, 19) },
    ],
    notas: [
      { materia: "MATEMÁTICAS 5G", descripcion: "Prueba de fracciones", nota: 13, fecha: dia(-3) },
      { materia: "LENGUAJE 5G", descripcion: "Dictado", nota: 18, fecha: dia(-8) },
    ],
    tareas: [
      { materia: "CIENCIAS NATURALES 5G", tipo: "tarea", descripcion: "Traer habladores con al menos 5 cambios para cada uno y 5 herramientas, todo organizado", fecha: dia(-2), hecha: false },
      { materia: "CIENCIAS NATURALES 5G", tipo: "trabajo", descripcion: "C. Naturales: culminó el contenido adolescencia y sexualidad. Traer papel bond base 20, marcadores, colores, regla, tijera, imágenes de género masculino y femenino, habladores o etiquetas con títulos cambios emocionales, cambios psicológicos, cambios sociales, herramientas para vivir la adolescencia", fecha: dia(-1), hecha: false },
      { materia: "MATEMÁTICAS 5G", tipo: "examen", descripcion: "Examen de decimales", fecha: dia(2), hecha: false },
      { materia: "INGLÉS 5G", tipo: "tarea", descripcion: "Workbook página 12", fecha: dia(1), hecha: false },
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
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", creado: hace(2) },
      { materia: "CIENCIAS SOCIALES 5G", tema: "TEMA 2. Clima y vegetación.", creado: hace(2) },
      { materia: "LÓGICA MATEMÁTICA 5G", tema: "Tema 1 · Patrones numéricos", creado: hace(0) },
    ],
    reportes: [],
  };
}
