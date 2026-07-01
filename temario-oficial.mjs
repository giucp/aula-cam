// temario-oficial.mjs — Temario de referencia (programa educativo venezolano)
// para 5to grado (primaria) y 1er año (bachillerato / Media General), armado para
// que los niños puedan ADELANTAR materias en vacaciones mientras no tengamos el
// temario EXACTO del colegio (el aula bloquea leer grados donde no estás inscrito).
//
// Cuando se consiga un login de un alumno de 5to / 1er año, la captura real del
// Moodle hace UPSERT sobre estas mismas filas (mismo grado + materia_id) y las
// reemplaza por el temario exacto del colegio.
//
// Los "id" y "nombre_corto" son los reales del Moodle del colegio (5G: 68-80,
// 1A: 94-108 y 176) para que ese futuro reemplazo calce sin duplicar.

export const TEMARIO = {
  "5to grado": [
    { id: 72, materia: "Matemáticas", nombre_corto: "MATEMÁTICAS 5G", grupos: [
      { lapso: "Primer lapso", temas: [
        "Números naturales hasta millones y millardos: lectura, escritura y valor posicional",
        "Orden y comparación de números naturales",
        "Adición y sustracción de números naturales",
        "Multiplicación de números naturales",
        "División de números naturales (una y dos cifras)",
        "Propiedades de la adición y la multiplicación",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Múltiplos y divisores; criterios de divisibilidad",
        "Números primos y compuestos",
        "Mínimo común múltiplo y máximo común divisor",
        "Fracciones: representación, comparación y equivalencia",
        "Suma y resta de fracciones",
        "Multiplicación y división de fracciones",
        "Números decimales: lectura, orden y operaciones",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Proporcionalidad: regla de tres simple directa e inversa",
        "Porcentaje y su cálculo",
        "Medidas de longitud, masa, capacidad y tiempo",
        "Perímetro y área de figuras planas",
        "Ángulos y su medición",
        "Estadística: tablas, gráficos de barras y promedio",
      ]},
    ]},
    { id: 79, materia: "Lógica Matemática", nombre_corto: "LÓGICA MAT 5G", grupos: [
      { lapso: "Primer lapso", temas: [
        "Secuencias y patrones numéricos",
        "Series de figuras",
        "Razonamiento con operaciones",
        "Problemas de sumas y restas con enunciado",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Problemas de multiplicación y división",
        "Acertijos numéricos",
        "Cuadrados mágicos",
        "Razonamiento lógico: verdadero/falso y deducción",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Problemas de proporcionalidad y regla de tres",
        "Conteo y combinaciones sencillas",
        "Problemas de dos pasos",
        "Retos de ingenio con geometría",
      ]},
    ]},
    { id: 71, materia: "Lenguaje", nombre_corto: "LENGUAJE 5G", grupos: [
      { lapso: "Primer lapso", temas: [
        "Comprensión lectora",
        "El sustantivo y el adjetivo",
        "El artículo",
        "Sílaba tónica y átona; acentuación",
        "Signos de puntuación: punto y coma",
      ]},
      { lapso: "Segundo lapso", temas: [
        "El verbo y sus tiempos: presente, pasado y futuro",
        "El pronombre",
        "Sinónimos y antónimos",
        "La oración: sujeto y predicado",
        "Uso de b/v y de c/s/z",
      ]},
      { lapso: "Tercer lapso", temas: [
        "El párrafo y el texto",
        "Tipos de textos: narrativo, descriptivo e instructivo",
        "La carta y el correo",
        "El cuento y la leyenda",
        "Producción de textos propios",
      ]},
    ]},
    { id: 68, materia: "Ciencias Naturales", nombre_corto: "CS NATURALES 5G", grupos: [
      { lapso: "Primer lapso", temas: [
        "La célula y los seres vivos",
        "Clasificación de los seres vivos",
        "Vertebrados e invertebrados",
        "Las plantas y su nutrición: la fotosíntesis",
      ]},
      { lapso: "Segundo lapso", temas: [
        "El cuerpo humano: sistema digestivo",
        "Sistema respiratorio",
        "Sistema circulatorio",
        "Alimentación y salud",
      ]},
      { lapso: "Tercer lapso", temas: [
        "La materia y sus estados",
        "Mezclas y métodos de separación",
        "La energía y sus formas",
        "El agua y su ciclo",
        "El suelo y su cuidado",
      ]},
    ]},
    { id: 69, materia: "Ciencias Sociales", nombre_corto: "CS SOCIALES 5G", grupos: [
      { lapso: "Primer lapso", temas: [
        "La Tierra: continentes y océanos",
        "Venezuela: ubicación y límites",
        "El relieve de Venezuela",
        "Regiones naturales de Venezuela",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Población de Venezuela",
        "Estados y capitales",
        "Actividades económicas",
        "Recursos naturales",
      ]},
      { lapso: "Tercer lapso", temas: [
        "La independencia de Venezuela",
        "Simón Bolívar y los próceres",
        "Símbolos patrios",
        "Deberes y derechos del ciudadano",
      ]},
    ]},
    { id: 75, materia: "Inglés", nombre_corto: "INGLÉS 5G", grupos: [
      { lapso: "Primer lapso", temas: [
        "The alphabet and greetings",
        "Numbers and colors",
        "Personal pronouns",
        "Verb to be",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Family members",
        "Parts of the body",
        "Animals",
        "Present simple: daily routines",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Food and drinks",
        "The house and rooms",
        "Prepositions of place",
        "Telling the time",
      ]},
    ]},
    { id: 76, materia: "Informática", nombre_corto: "INFORMÁTICA 5G", grupos: [
      { lapso: "Primer lapso", temas: [
        "Partes de la computadora",
        "Hardware y software",
        "Uso del teclado y el mouse",
      ]},
      { lapso: "Segundo lapso", temas: [
        "El sistema operativo",
        "Carpetas y archivos",
        "El procesador de texto",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Internet y navegación segura",
        "El correo electrónico",
        "Presentaciones básicas",
      ]},
    ]},
    { id: 74, materia: "Liderazgo Comunicacional", nombre_corto: "LID COMUNIC 5G", grupos: [
      { lapso: "Primer lapso", temas: ["La comunicación", "Escucha activa", "Expresión oral"] },
      { lapso: "Segundo lapso", temas: ["Trabajo en equipo", "Resolución de conflictos", "Respeto y empatía"] },
      { lapso: "Tercer lapso", temas: ["Hablar en público", "Liderazgo positivo", "Proyectos comunitarios"] },
    ]},
    { id: 70, materia: "Educación Estética", nombre_corto: "EDUC ESTÉTICA 5G", grupos: [
      { lapso: "Primer lapso", temas: ["El dibujo y la línea", "Colores primarios y secundarios", "Formas y figuras"] },
      { lapso: "Segundo lapso", temas: ["La pintura", "Manualidades", "El collage"] },
      { lapso: "Tercer lapso", temas: ["Apreciación artística", "Artistas venezolanos", "Proyecto artístico"] },
    ]},
    { id: 80, materia: "Música", nombre_corto: "MÚSICA 5G", grupos: [
      { lapso: "Primer lapso", temas: ["El sonido y sus cualidades", "Las notas musicales", "El ritmo"] },
      { lapso: "Segundo lapso", temas: ["Instrumentos musicales", "La melodía", "Canciones tradicionales venezolanas"] },
      { lapso: "Tercer lapso", temas: ["El pentagrama", "Interpretación grupal", "Géneros musicales venezolanos"] },
    ]},
    { id: 78, materia: "Religión", nombre_corto: "RELIGIÓN 5G", grupos: [
      { lapso: "Primer lapso", temas: ["La creación", "Valores cristianos", "La familia"] },
      { lapso: "Segundo lapso", temas: ["Historias de la Biblia", "Jesús y sus enseñanzas", "La solidaridad"] },
      { lapso: "Tercer lapso", temas: ["Las parábolas", "Fiestas religiosas", "El servicio a los demás"] },
    ]},
    { id: 77, materia: "Robótica", nombre_corto: "ROBÓTICA 5G", grupos: [
      { lapso: "Primer lapso", temas: ["¿Qué es un robot?", "Partes de un robot", "Máquinas simples"] },
      { lapso: "Segundo lapso", temas: ["Sensores y actuadores", "Secuencias y algoritmos", "Programación por bloques"] },
      { lapso: "Tercer lapso", temas: ["Armado de un robot básico", "Programación de movimientos", "Proyecto de robótica"] },
    ]},
    { id: 73, materia: "Educación Física", nombre_corto: "EDUC FÍSICA 5G", grupos: [
      { lapso: "Primer lapso", temas: ["Calentamiento y estiramiento", "Capacidades físicas", "Juegos pre-deportivos"] },
      { lapso: "Segundo lapso", temas: ["Voleibol y baloncesto", "Coordinación y equilibrio", "Atletismo básico"] },
      { lapso: "Tercer lapso", temas: ["Fútbol y kickingball", "Hábitos saludables", "Juegos tradicionales"] },
    ]},
  ],

  "1er año": [
    { id: 103, materia: "Matemáticas", nombre_corto: "MATEMÁTICAS 1A", grupos: [
      { lapso: "Primer lapso", temas: [
        "Conjuntos numéricos: N, Z y Q",
        "Números naturales: operaciones y propiedades",
        "Potenciación y radicación en N",
        "Números enteros: operaciones",
        "Valor absoluto y orden en Z",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Números racionales: fracciones y decimales",
        "Operaciones con números racionales",
        "Razones y proporciones",
        "Regla de tres y porcentaje",
        "Expresiones algebraicas: términos y valor numérico",
        "Ecuaciones de primer grado",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Ángulos y su clasificación",
        "Triángulos y sus propiedades",
        "Cuadriláteros y polígonos",
        "Perímetro y área",
        "Circunferencia y círculo",
        "Estadística: frecuencia, media, mediana y moda",
      ]},
    ]},
    { id: 102, materia: "Lógica Matemática", nombre_corto: "LÓGICA MAT 1A", grupos: [
      { lapso: "Primer lapso", temas: [
        "Proposiciones y valor de verdad",
        "Conectivos lógicos: y, o, no",
        "Tablas de verdad",
        "Razonamiento deductivo",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Secuencias y patrones",
        "Problemas de razonamiento numérico",
        "Conjuntos: unión, intersección y diferencia",
        "Diagramas de Venn",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Razonamiento con proporciones",
        "Conteo y combinatoria básica",
        "Problemas de ingenio",
        "Resolución de problemas de varios pasos",
      ]},
    ]},
    { id: 100, materia: "Lengua y Literatura", nombre_corto: "LENGUA Y LIT 1A", grupos: [
      { lapso: "Primer lapso", temas: [
        "La comunicación y sus elementos",
        "Comprensión lectora",
        "El sustantivo, el adjetivo y el artículo",
        "Acentuación: reglas generales",
        "Género narrativo: el cuento",
      ]},
      { lapso: "Segundo lapso", temas: [
        "El verbo y sus conjugaciones",
        "La oración: sujeto y predicado",
        "Sinónimos, antónimos y homónimos",
        "El texto expositivo",
        "Género lírico: el poema y las figuras literarias",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Uso de conectores",
        "El texto argumentativo",
        "Ortografía: b/v, g/j, h",
        "El ensayo breve",
        "Literatura venezolana e hispanoamericana",
      ]},
    ]},
    { id: 96, materia: "Física", nombre_corto: "FÍSICA 1A", grupos: [
      { lapso: "Primer lapso", temas: [
        "La física y la medición",
        "Magnitudes y unidades del Sistema Internacional",
        "Notación científica",
        "Instrumentos de medición",
      ]},
      { lapso: "Segundo lapso", temas: [
        "El movimiento: posición, distancia y desplazamiento",
        "Rapidez y velocidad",
        "Movimiento rectilíneo uniforme",
        "Las fuerzas y sus efectos",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Trabajo, energía y potencia",
        "Formas de energía y su transformación",
        "El calor y la temperatura",
        "Máquinas simples",
      ]},
    ]},
    { id: 106, materia: "Química", nombre_corto: "QUÍMICA 1A", grupos: [
      { lapso: "Primer lapso", temas: [
        "La química y la materia",
        "Propiedades de la materia",
        "Estados de la materia y sus cambios",
        "Sustancias puras y mezclas",
        "Métodos de separación de mezclas",
      ]},
      { lapso: "Segundo lapso", temas: [
        "El átomo y su estructura",
        "Elementos y la tabla periódica",
        "Símbolos químicos",
        "Moléculas y compuestos",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Enlaces químicos (idea básica)",
        "Reacciones químicas",
        "El agua y sus propiedades",
        "La química en la vida diaria",
      ]},
    ]},
    { id: 94, materia: "Biología, Ambiente y Tecnología", nombre_corto: "BIOLOGÍA 1A", grupos: [
      { lapso: "Primer lapso", temas: [
        "La biología y los seres vivos",
        "La célula: estructura y funciones",
        "Células procariotas y eucariotas",
        "Niveles de organización de la vida",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Clasificación de los seres vivos: los reinos",
        "Funciones vitales: nutrición, relación y reproducción",
        "La nutrición en plantas y animales",
        "Fotosíntesis y respiración",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Ecosistemas y cadenas alimentarias",
        "Biodiversidad de Venezuela",
        "El ambiente y su conservación",
        "Ciencia, tecnología y ambiente",
      ]},
    ]},
    { id: 97, materia: "Geografía, Historia y Ciudadanía", nombre_corto: "GHC 1A", grupos: [
      { lapso: "Primer lapso", temas: [
        "El espacio geográfico",
        "El universo, la Tierra y sus movimientos",
        "Coordenadas geográficas",
        "Continentes y océanos",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Geografía de Venezuela: relieve, clima e hidrografía",
        "Regiones naturales de Venezuela",
        "Población y poblamiento",
        "Pueblos originarios y primeras civilizaciones",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Descubrimiento y colonización de América",
        "La independencia de Venezuela",
        "Ciudadanía: derechos y deberes",
        "La Constitución y la convivencia",
      ]},
    ]},
    { id: 99, materia: "Inglés", nombre_corto: "INGLÉS 1A", grupos: [
      { lapso: "Primer lapso", temas: [
        "Verb to be and personal information",
        "Subject pronouns",
        "Numbers, dates and the alphabet",
        "Countries and nationalities",
      ]},
      { lapso: "Segundo lapso", temas: [
        "Present simple and daily routines",
        "Adverbs of frequency",
        "Family and jobs",
        "There is / there are",
      ]},
      { lapso: "Tercer lapso", temas: [
        "Present continuous",
        "Can (ability)",
        "Prepositions of time and place",
        "Describing people and places",
      ]},
    ]},
    { id: 98, materia: "Informática", nombre_corto: "INFORMÁTICA 1A", grupos: [
      { lapso: "Primer lapso", temas: ["El computador: hardware y software", "Sistemas operativos", "Gestión de archivos y carpetas"] },
      { lapso: "Segundo lapso", temas: ["Procesador de texto", "Hoja de cálculo básica", "Presentaciones digitales"] },
      { lapso: "Tercer lapso", temas: ["Internet y buscadores", "Seguridad y ciudadanía digital", "Introducción a la programación"] },
    ]},
    { id: 176, materia: "Electrónica", nombre_corto: "ELECTRÓNICA 1A", grupos: [
      { lapso: "Primer lapso", temas: ["La electricidad: conceptos básicos", "Corriente, voltaje y resistencia", "Circuitos eléctricos simples"] },
      { lapso: "Segundo lapso", temas: ["Componentes electrónicos: resistencias, LED, interruptores", "La ley de Ohm", "Instrumentos de medición"] },
      { lapso: "Tercer lapso", temas: ["Circuitos en serie y en paralelo", "Montaje de circuitos básicos", "Proyecto de electrónica"] },
    ]},
    { id: 108, materia: "Robótica", nombre_corto: "ROBÓTICA 1A", grupos: [
      { lapso: "Primer lapso", temas: ["Introducción a la robótica", "Partes de un robot", "Sensores y actuadores"] },
      { lapso: "Segundo lapso", temas: ["Algoritmos y programación por bloques", "Control de motores", "Lógica de programación"] },
      { lapso: "Tercer lapso", temas: ["Diseño y armado de un robot", "Programación de tareas", "Proyecto final de robótica"] },
    ]},
    { id: 104, materia: "Metodología", nombre_corto: "METODOLOGÍA 1A", grupos: [
      { lapso: "Primer lapso", temas: ["El conocimiento y la ciencia", "El método científico", "Observación y planteamiento de problemas"] },
      { lapso: "Segundo lapso", temas: ["Fuentes de información", "La investigación documental", "Fichas y citas"] },
      { lapso: "Tercer lapso", temas: ["El proyecto de investigación", "Recolección de datos", "Presentación de resultados"] },
    ]},
    { id: 105, materia: "Orientación y Convivencia", nombre_corto: "ORIENTACIÓN 1A", grupos: [
      { lapso: "Primer lapso", temas: ["Autoconocimiento y autoestima", "Cambios en la adolescencia", "Hábitos de estudio"] },
      { lapso: "Segundo lapso", temas: ["Convivencia y valores", "Comunicación asertiva", "Resolución de conflictos"] },
      { lapso: "Tercer lapso", temas: ["Proyecto de vida", "Trabajo en equipo", "Prevención y salud integral"] },
    ]},
    { id: 101, materia: "Liderazgo Comunicacional", nombre_corto: "LID COMUNIC 1A", grupos: [
      { lapso: "Primer lapso", temas: ["La comunicación efectiva", "Expresión oral y corporal", "Escucha activa"] },
      { lapso: "Segundo lapso", temas: ["Liderazgo y trabajo en equipo", "Oratoria y debate", "Manejo de conflictos"] },
      { lapso: "Tercer lapso", temas: ["Proyectos comunitarios", "Vocería y participación", "Comunicación y redes"] },
    ]},
    { id: 107, materia: "Religión", nombre_corto: "RELIGIÓN 1A", grupos: [
      { lapso: "Primer lapso", temas: ["La fe y la persona", "La Biblia: Antiguo y Nuevo Testamento", "Valores cristianos"] },
      { lapso: "Segundo lapso", temas: ["Jesús y su mensaje", "Las parábolas", "La solidaridad y el servicio"] },
      { lapso: "Tercer lapso", temas: ["La Iglesia y la comunidad", "Ética y moral", "Proyecto de vida cristiano"] },
    ]},
    { id: 95, materia: "Educación Física", nombre_corto: "EDUC FÍSICA 1A", grupos: [
      { lapso: "Primer lapso", temas: ["Capacidades físicas y calentamiento", "Acondicionamiento físico", "Atletismo"] },
      { lapso: "Segundo lapso", temas: ["Deportes colectivos: voleibol, baloncesto y fútbol", "Reglas y técnicas", "Trabajo en equipo"] },
      { lapso: "Tercer lapso", temas: ["Gimnasia y expresión corporal", "Salud, nutrición y actividad física", "Recreación y juegos tradicionales"] },
    ]},
  ],
};
