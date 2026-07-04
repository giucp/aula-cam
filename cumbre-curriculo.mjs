// cumbre-curriculo.mjs — Árbol de contenido de "Cumbre" (currículo de élite).
// Cumbre destila lo mejor de Singapur (MOE), IB MYP, Japón (MEXT) y UK KS3. Cada materia
// se organiza en DOMINIOS (grandes hilos conceptuales), no en lapsos sueltos. Este archivo
// es el ESQUELETO: define materia → dominios → temas (títulos). Curar cada tema
// (resumen/práctica/quiz) es trabajo posterior; al inicio todos figuran como "pendiente".
//
// Se carga en la tabla `curriculo` (reusando el sistema del "próximo año"): una fila por
// materia, cada una con su GRADO propio ("Cumbre Matemática 1er año", "Cumbre Física 1er
// año", …) y temas.grupos = dominios. El front ya sabe pintar grupos en acordeón; cada
// "grupo" (lapso) es un dominio. El campo `intl` guarda el nombre internacional del dominio.
//
// Cada materia = su propio grado (igual que "Cumbre Matemática 1er año"): así el cuarto de
// pruebas y el candado de aislamiento (programa='cumbre') los tratan por separado.

export const CUMBRE_CURRICULO = {
  // Orden de las materias en el cuarto de pruebas = por materia_id ascendente (ids sintéticos
  // ≥9000 para no chocar con cursos reales de Moodle). "Cómo Pensar" (9000) va primero por ser
  // la materia transversal que enseña a razonar; luego las ciencias.
  materias: [
    {
      id: 9000,
      grado: "Cumbre Cómo Pensar 1er año",
      materia: "Cómo Pensar",
      nombre_corto: "CUMBRE PENS 1A",
      // Materia PROPIA y TRANSVERSAL: enseña a pensar con método, evidencia y lógica, sin
      // dejarse engañar. Inspirada en IB ToK/ATL, NGSS (argumentar desde la evidencia),
      // marcos de pensamiento crítico (Ennis/Facione) y alfabetización mediática y de datos.
      grupos: [
        {
          lapso: "Preguntar e investigar",
          intl: "Scientific Inquiry",
          temas: [
            "La gran pregunta: cómo sabemos lo que sabemos (afirmación vs. evidencia)",
            "Observar de verdad: notar detalles, no lo que esperamos ver",
            "La hipótesis: una buena conjetura que se puede poner a prueba",
            "Variables: qué cambio, qué mido y qué mantengo igual",
            "Diseñar una prueba justa: el experimento controlado (con ejemplos de física y biología)",
            "Sacar conclusiones honestas: qué dicen los datos y qué NO dicen",
            "La ciencia se corrige a sí misma: por qué equivocarse es parte del método",
          ],
        },
        {
          lapso: "Razonar con lógica",
          intl: "Logic & Reasoning",
          temas: [
            "Afirmaciones, razones y conclusiones: las partes de un argumento",
            "Razonar de lo general a lo particular y al revés (deducir e inducir)",
            "Causa y correlación: que dos cosas ocurran juntas no significa que una cause la otra",
            "Condiciones: 'si… entonces' y por qué invertirlo engaña (con ejemplos de matemática)",
            "Contraejemplos: cómo una sola excepción derrumba una regla",
            "Buenos y malos argumentos: cómo se ve un razonamiento sólido",
          ],
        },
        {
          lapso: "No dejarse engañar",
          intl: "Fallacies & Biases",
          temas: [
            "Falacias comunes 1: atacar a la persona, no a la idea; y la falsa autoridad",
            "Falacias comunes 2: falso dilema, generalización apresurada y pendiente resbaladiza",
            "Trampas del lenguaje: ambigüedad, cargar la pregunta y las palabras que manipulan",
            "Sesgos de la mente: por qué creemos lo que ya queríamos creer (sesgo de confirmación)",
            "Otros sesgos cotidianos: el ancla, lo que se recuerda fácil, seguir a la mayoría",
            "Persuasión y publicidad: cómo te intentan convencer sin argumentos",
          ],
        },
        {
          lapso: "Pensar con datos",
          intl: "Data Literacy",
          temas: [
            "Qué es un dato y de dónde sale: muestras justas y muestras tramposas",
            "Promedio, mediana y moda: cuál cuenta la verdad según el caso (puente con Matemática)",
            "Leer un gráfico con ojo crítico: qué muestra y qué esconde",
            "Gráficos engañosos: ejes cortados, escalas y trucos visuales",
            "Porcentajes y probabilidades en la vida real: no dejarse impresionar por un número",
            "Correlación en los datos: ver un patrón sin saltar a conclusiones",
          ],
        },
        {
          lapso: "Evaluar la información",
          intl: "Media & Source Literacy",
          temas: [
            "Fuentes: quién lo dice, cómo lo sabe y por qué lo dice",
            "Hecho, opinión y afirmación disfrazada de hecho",
            "Evaluar una noticia o un video: credibilidad, sesgo y evidencia",
            "Rastrear la evidencia: llegar a la fuente original, no al que la repitió",
            "Información falsa: cómo se fabrica y se propaga (y cómo verificar)",
          ],
        },
        {
          lapso: "Pensar mejor y resolver problemas",
          intl: "Thinking & Problem-Solving",
          temas: [
            "Descomponer un problema grande en partes manejables (pensamiento computacional)",
            "Buscar patrones y generalizar (con ejemplos de matemática y ciencias)",
            "Considerar varias perspectivas antes de decidir",
            "Pensar sobre tu propio pensar: revisar, dudar y corregirte (metacognición)",
            "Creatividad con criterio: generar ideas y luego evaluarlas",
            "Decidir con cabeza: pesar evidencia, riesgos y valores en una decisión real",
          ],
        },
      ],
    },
    {
      id: 9001,
      grado: "Cumbre Matemática 1er año",
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
    {
      id: 9002,
      grado: "Cumbre Física 1er año",
      materia: "Física",
      nombre_corto: "CUMBRE FIS 1A",
      // Equivalente: UK KS3 Year 7 Physics, Japan MEXT Grade 7 "fenómenos físicos cercanos",
      // hilo de física de Singapore Lower Secondary Science, IB MYP Y1 Sciences.
      grupos: [
        {
          lapso: "Medir el mundo",
          intl: "Measurement & Scientific Method",
          temas: [
            "Qué es la física: fenómenos, preguntas y el método científico",
            "Magnitudes físicas y el Sistema Internacional de unidades",
            "Medir longitud, masa y tiempo: instrumentos, precisión y error",
            "Volumen y densidad: por qué unas cosas flotan y otras se hunden",
            "Tablas y gráficas: presentar datos como un científico",
          ],
        },
        {
          lapso: "La materia y el modelo de partículas",
          intl: "Particle Model",
          temas: [
            "El modelo de partículas: de qué está hecho todo",
            "Sólidos, líquidos y gases explicados con partículas",
            "Cambios de estado: qué les pasa a las partículas al calentar y enfriar",
            "Temperatura y calor: no son lo mismo",
            "Cómo viaja el calor: conducción, convección y radiación",
            "Dilatación: por qué los materiales se agrandan con el calor",
          ],
        },
        {
          lapso: "Fuerzas y presión",
          intl: "Forces & Pressure",
          temas: [
            "Qué es una fuerza: empujar, halar y sus efectos",
            "Medir fuerzas: el newton y el dinamómetro (ley de Hooke)",
            "Tipos de fuerzas: gravedad, fricción, normal y elástica",
            "Masa y peso: la diferencia que casi todos confunden",
            "Fuerzas equilibradas y desequilibradas: pares de interacción",
            "Rapidez y movimiento: la ecuación de la velocidad",
            "Presión: la fuerza repartida (sólidos y la ecuación de presión)",
            "Presión en líquidos y en el aire: del buzo a la atmósfera",
            "Flotación: el empuje del agua (principio de Arquímedes)",
          ],
        },
        {
          lapso: "Energía",
          intl: "Energy",
          temas: [
            "La energía: qué es y en qué formas se almacena",
            "Transformaciones de energía: seguirle la pista",
            "Conservación de la energía: nada se pierde",
            "Energía cinética y energía potencial",
            "Trabajo y máquinas simples: palancas, poleas y planos inclinados",
            "Fuentes de energía: renovables, no renovables y eficiencia",
          ],
        },
        {
          lapso: "Luz y sonido",
          intl: "Light & Sound",
          temas: [
            "La luz viaja en línea recta: rayos, sombras y eclipses",
            "Reflexión: espejos y la ley de la reflexión",
            "Refracción: por qué el lápiz se 'dobla' en el agua",
            "Lentes y el ojo humano: cómo vemos (y la cámara oscura)",
            "El color: la luz blanca, el prisma y el arcoíris",
            "El sonido: vibraciones que viajan en ondas",
            "Volumen y tono: amplitud y frecuencia",
            "La velocidad del sonido: ecos y por qué el trueno llega tarde",
          ],
        },
        {
          lapso: "Electricidad y magnetismo",
          intl: "Electricity & Magnetism",
          temas: [
            "Carga eléctrica y electricidad estática: rayos y chispas",
            "Circuitos eléctricos: corriente, y el modelo para entenderla",
            "Circuitos en serie y en paralelo",
            "Imanes y campos magnéticos: la brújula",
            "Electroimanes: cuando la electricidad crea magnetismo",
          ],
        },
        {
          lapso: "La Tierra en el universo",
          intl: "Earth & Space",
          temas: [
            "Día y noche, y las estaciones: los movimientos de la Tierra",
            "La Luna: fases y eclipses",
            "La gravedad más allá de la Tierra: órbitas y peso en otros mundos",
            "El sistema solar y nuestro lugar en el universo",
          ],
        },
      ],
    },
    {
      id: 9003,
      grado: "Cumbre Química 1er año",
      materia: "Química",
      nombre_corto: "CUMBRE QUI 1A",
      // Equivalente: UK KS3 Year 7 Chemistry, hilo químico de Singapore Lower Secondary
      // Science, Japan MEXT Grade 7 "las sustancias que nos rodean", IB MYP Y1 Sciences.
      grupos: [
        {
          lapso: "Pensar como químico",
          intl: "The Chemist's Craft",
          temas: [
            "Qué es la química: la ciencia de las sustancias y sus transformaciones",
            "El laboratorio: seguridad, materiales y el mechero (tu primera herramienta)",
            "Propiedades de las sustancias: describir, comparar y medir (punto de fusión, dureza, solubilidad)",
            "¿Cambio físico o cambio químico? Las señales de que nació una sustancia nueva",
          ],
        },
        {
          lapso: "Partículas en acción",
          intl: "Particles in Action",
          temas: [
            "El modelo de partículas visto por la química: la lente para entenderlo todo",
            "Difusión: por qué el perfume cruza la habitación solo",
            "Disolución: qué pasa de verdad cuando el azúcar 'desaparece' en el agua",
            "Soluciones: soluto, solvente y concentración",
            "Solubilidad y cristalización: cuánto cabe en el agua y cómo recuperarlo",
            "Saturación y el efecto de la temperatura: soluciones al límite",
          ],
        },
        {
          lapso: "Átomos, elementos y compuestos",
          intl: "Atoms, Elements & Compounds",
          temas: [
            "El átomo: la pieza más pequeña de todas (primera idea)",
            "Los elementos: el alfabeto del universo y sus símbolos",
            "La tabla periódica: el mapa de todos los elementos (primera visita)",
            "Metales y no metales: dos familias con personalidades opuestas",
            "Compuestos: cuando los átomos se combinan (H₂O, CO₂ y las fórmulas sencillas)",
            "¿Elemento, compuesto o mezcla? Aprender a clasificar cualquier sustancia",
          ],
        },
        {
          lapso: "Mezclas y el arte de separarlas",
          intl: "Mixtures & Separation",
          temas: [
            "Mezclas: juntas pero no combinadas (homogéneas y heterogéneas)",
            "Decantación y filtración: separar lo que no se disuelve",
            "Evaporación y cristalización: recuperar la sal del agua",
            "Destilación: separar con calor (agua pura a partir del mar)",
            "Cromatografía: el detective que descompone las tintas",
            "Elegir la técnica correcta: qué separa qué y por qué (el reto del ingeniero)",
          ],
        },
        {
          lapso: "Los gases que nos rodean",
          intl: "Gases Around Us",
          temas: [
            "El aire: la mezcla invisible que respiramos (composición)",
            "El oxígeno: el gas de la vida y del fuego (obtenerlo e identificarlo)",
            "El dióxido de carbono: identificarlo y entender su doble papel",
            "El hidrógeno y otros gases: propiedades y pruebas de identificación",
          ],
        },
        {
          lapso: "Ácidos y álcalis",
          intl: "Acids & Alkalis",
          temas: [
            "Ácidos y álcalis en tu vida diaria: del limón al jabón",
            "Indicadores: sustancias que cambian de color (incluida la col morada)",
            "La escala de pH: el termómetro de la acidez",
            "Neutralización: cuando un ácido y un álcali se cancelan",
            "Neutralización en acción: antiácidos, suelos de cultivo y picaduras",
          ],
        },
        {
          lapso: "Reacciones químicas",
          intl: "Chemical Reactions",
          temas: [
            "Qué es una reacción química: reactivos, productos y ecuaciones de palabras",
            "La combustión: el fuego explicado por la química",
            "Metales que reaccionan: oxidación y metales con ácidos",
            "La conservación de la masa: nada aparece ni desaparece (la gran idea de Lavoisier)",
            "Reacciones útiles y reacciones problema: de la cocina a la corrosión",
          ],
        },
      ],
    },
    {
      id: 9004,
      grado: "Cumbre Biología 1er año",
      materia: "Biología",
      nombre_corto: "CUMBRE BIO 1A",
      // Equivalente: UK KS3 Year 7 Biology (big questions de Oak National), hilo biológico de
      // Singapore Lower Secondary Science, Japan MEXT Grade 7 "el mundo vivo cercano", IB MYP Y1.
      grupos: [
        {
          lapso: "La unidad de la vida: la célula",
          intl: "Cells — the Unit of Life",
          temas: [
            "¿Qué significa estar vivo? Las siete funciones vitales (MRS GREN)",
            "El microscopio: la herramienta que abrió el mundo invisible",
            "La célula: la unidad básica de todo ser vivo",
            "Célula animal y célula vegetal: partes y diferencias",
            "Células especializadas: la forma sigue a la función",
            "De célula a organismo: células, tejidos, órganos y sistemas",
          ],
        },
        {
          lapso: "El cuerpo humano como sistema",
          intl: "The Human Body",
          temas: [
            "El sistema digestivo: cómo el cuerpo obtiene lo que necesita del alimento",
            "El sistema respiratorio: el intercambio de gases",
            "El sistema circulatorio: el corazón y el transporte por la sangre",
            "El sistema locomotor: huesos, músculos y movimiento",
            "Alimentación y nutrición: una dieta balanceada explicada por la ciencia",
            "Salud e higiene: cómo el cuerpo se mantiene sano y se defiende",
          ],
        },
        {
          lapso: "Crecer y reproducirse",
          intl: "Growth & Reproduction",
          temas: [
            "Reproducción sexual y asexual: dos estrategias de la vida",
            "La reproducción en las plantas: la flor, la polinización y la semilla",
            "La reproducción humana: los cambios de la pubertad explicados",
            "El ciclo de vida: de la semilla o el huevo al adulto",
          ],
        },
        {
          lapso: "La diversidad de la vida",
          intl: "Classifying Life",
          temas: [
            "¿Por qué clasificamos? Orden en la enorme variedad de la vida",
            "Los cinco reinos: animales, plantas, hongos, protistas y bacterias",
            "Vertebrados: los cinco grupos y sus características",
            "Invertebrados: la mayoría oculta de los animales",
            "Las plantas: con y sin flores, y cómo se agrupan",
            "El sistema de Linneo: nombrar cada ser vivo (nombre científico) y las claves dicotómicas",
          ],
        },
        {
          lapso: "La energía de la vida",
          intl: "Energy in Life",
          temas: [
            "La fotosíntesis: cómo las plantas fabrican su alimento con luz",
            "La hoja: la fábrica de la planta por dentro",
            "La respiración celular: cómo los seres vivos liberan la energía del alimento",
            "Fotosíntesis y respiración: dos procesos que se conectan",
          ],
        },
        {
          lapso: "Los seres vivos y su ambiente",
          intl: "Ecosystems & Interdependence",
          temas: [
            "El ecosistema: seres vivos (bióticos) y su entorno (abióticos)",
            "Cadenas y redes alimentarias: productores, consumidores y descomponedores",
            "El flujo de energía y el reciclaje de la materia en la naturaleza",
            "Adaptaciones: cómo cada ser vivo encaja en su ambiente",
            "Relaciones entre especies: competencia, depredación y cooperación",
            "Biodiversidad de Venezuela y el impacto humano en los ecosistemas",
          ],
        },
      ],
    },
  ],
};
