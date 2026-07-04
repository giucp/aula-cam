// cumbre-curriculo.mjs — Árbol de contenido de "Cumbre" (currículo de élite).
// Cumbre destila lo mejor de Singapur (MOE), IB MYP y Japón (MEXT). La matemática se
// organiza en DOMINIOS (grandes hilos conceptuales), no en lapsos sueltos. Este archivo
// es el ESQUELETO: define materia → dominios → temas (títulos). Curar cada tema
// (resumen/práctica/quiz) es trabajo posterior; al inicio todos figuran como "pendiente".
//
// Se carga en la tabla `curriculo` (reusando el sistema del "próximo año"): una fila por
// materia, con grado propio "Cumbre Matemática 1er año" y temas.grupos = dominios. El
// front ya sabe pintar grupos en acordeón; cada "grupo" (lapso) es un dominio. El campo
// `intl` guarda el nombre internacional del dominio (para mostrarlo en la UI de Cumbre).
//
// Primer entregable: Matemática, nivel 1er año (Singapore Sec 1 / IB MYP Y1 / Japan G7).

export const CUMBRE_CURRICULO = {
  grado: "Cumbre Matemática 1er año",
  materias: [
    {
      id: 9001, // id sintético (Cumbre no viene de Moodle); >9000 para no chocar con cursos reales
      materia: "Matemática",
      nombre_corto: "CUMBRE MAT 1A",
      grupos: [
        {
          lapso: "Números y Álgebra",
          intl: "Number & Algebra",
          temas: [
            "Números primos, factorización, MCD y MCM",
            "Cuadrados, cubos, raíces cuadradas y cúbicas",
            "Números negativos y enteros: la recta numérica",
            "Operaciones con enteros y su significado",
            "Números racionales: fracciones, decimales y su unidad esencial",
            "Razón, tasa, velocidad y proporción",
            "Porcentaje como proporción",
            "Aproximación y estimación: ¿es razonable mi respuesta?",
            "Introducción al lenguaje algebraico: la letra como número",
            "Expresiones algebraicas: simplificar y evaluar",
            "Ecuaciones lineales sencillas y su resolución",
            "Traducir problemas del mundo real a ecuaciones",
            "Sucesiones y patrones: encontrar la regla general",
          ],
        },
        {
          lapso: "Geometría y Medición",
          intl: "Geometry & Measurement",
          temas: [
            "Ángulos: tipos, medición y relaciones (en un punto, en una recta, opuestos)",
            "Ángulos con rectas paralelas",
            "Triángulos y cuadriláteros: propiedades y construcción",
            "Polígonos: propiedades y simetría",
            "Perímetro y área de figuras planas",
            "Área y volumen de prismas (mensuración)",
            "Construcciones geométricas con regla y compás",
            "Razonamiento geométrico: justificar con propiedades",
          ],
        },
        {
          lapso: "Funciones y Relaciones",
          intl: "Functions & Relations",
          temas: [
            "Proporcionalidad directa e inversa como relación",
            "El plano cartesiano: coordenadas",
            "Gráficas lineales y su interpretación",
            "Relación entre una regla, una tabla y una gráfica (las tres representaciones)",
          ],
        },
        {
          lapso: "Estadística y Probabilidad",
          intl: "Statistics & Probability",
          temas: [
            "Recolección y organización de datos",
            "Tablas de frecuencia y representaciones (barras, líneas, sectores, tallo y hoja)",
            "Media, mediana y moda: qué dice cada una",
            "Lectura crítica de gráficos: ¿qué me quieren decir y qué me esconden?",
            "Nociones de probabilidad: seguro, posible, imposible; eventos simples",
          ],
        },
      ],
    },
  ],
};
