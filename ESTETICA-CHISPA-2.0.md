# Estética Chispa 2.0 — guía maestra

> **Propósito:** este documento es el norte visual para llevar TODA la app Chispa a la estética nueva
> (no dejar mitad nueva / mitad vieja). Lo trabajamos Claude + usuario; Codex se usa SOLO para dibujos
> (mascota, íconos, ilustraciones), el resto (sistema de diseño, layouts, estados, movimiento) es código.
> Redactado 2026-07-13 al cierre de una sesión (se cortó por cupo). **Retomar desde acá.**

Relacionados: **fuente de verdad = `aula-cam-estetica-local/docs/CHISPA_2.0_DESIGN_SPECIFICATION.md`**
(spec maestra de Codex) · filosofía en `CHISPA_2.0_VISION.md` · diagnóstico de la app vieja en
`.../docs/UI_INVENTORY.md` y `COMPONENT_INVENTORY.md` · estados de mascota en `.../docs/CHISPA_CHARACTER_STATES.md`.

---

> ## ⚡ RETOMAR EN CHAT NUEVO (cierre 2026-07-14) — leer en este orden
> 0. **§13 — MATERIAS 2.0: hecho y verificado en LOCAL, SIN desplegar.** Espera el OK del usuario en
>    su teléfono. Es lo único sin commitear. Incluye un **bug de producción arreglado** (la placa del
>    ícono en el pane de temas salía a 180px). **Falta la 2ª mitad: el pane de temas** (chips, modos,
>    cantidad, fotos, acciones siguen viejos).
> 1. **§12 — LANDING: dirección definitiva.** Tarea EN CURSO pero **BLOQUEADA**: el usuario todavía
>    está creando los assets (avisa dónde quedan). Todo lo anterior de la landing queda superado.
>    **Regla que manda: Chispa va EN UNA ESCENA, nunca como sticker flotante.**
>    **Prueba social DESCARTADA** (12.5-a) y **los textos de los mockups NO se copian: los ponemos nosotros.**
> 2. **§11 — Mapa de poses.** Hay **20 poses** en `aula-cam-estetica-local/assets/chispa-3d/`.
>    **No repetir la misma mascota entre pantallas ni clonar composiciones.**
> 3. **§10 — Hero del Inicio: CONGELADO.** Valores finales de mano/libro por ancho, assets válidos,
>    receta del atenuado y las 3 trampas. **No tocar sin pedido explícito.** Incluye la **regla de
>    peso: todo asset nuevo se exporta a ~3× su display, NUNCA a 1254px.**
>
> **Ya está LIVE en producción** (aula-cam.vercel.app, sw v77): hero del Inicio, "Más para ti" en 2.0,
> y la **base 2.0 en toda la app** (tokens viejos reapuntados, canvas global, íconos de materia 3D).
> **Falta convertir:** Materias (la próxima), Agenda, Amigos/Muro, Cumbre, onboarding, #lab.
>
> **Lección de este chat (no repetir):** hice la landing 2 veces y las 2 fueron malas por esperar
> guía en vez de traer decisiones, y por no mirar el material que el usuario ya había creado.

## ✅ ESTADO — Inicio reconstruido por composición (2026-07-14, verificado en LOCAL, sin desplegar)
Los 8 cambios del brief están implementados y probados a 360/375px, sin scroll horizontal, sin errores
de consola, cableado intacto (login/agenda/materias/misión renderizan con datos reales):
1. Encabezado compuesto: saludo protagonista, nombre en morado (`.h2Name`), grado+fecha en una línea
   tranquila (sin pill pesado), mascota presente sin competir, menú discreto 44px.
2. Stats = UN resumen integrado compacto con divisores (adiós 3 cards + líneas de estado).
3. Misión = HERO editorial morado con orbes sobrios (sin triángulos), título sentence-case vía
   `capMateria()`, un solo CTA blanco.
4. "Para hoy" vacío = fila ligera (`✓ Todo al día`), no card grande (`#tareasResumen.is-empty`).
5. "Continúa aprendiendo" = sección propia, visible antes de la nav.
6. Nombres de materia en caso título en toda la Home (`capMateria`); íconos 3D de materia.
7. Nav silenciosa: sin borde, sombra suave, activo = color + puntito (no pastilla-caja).
8. Canvas mucho más sutil (casi blanco); más aire entre secciones; mascota SIN animación.
**PENDIENTE:** ilustración de montaña opcional dentro de `.h2Mission` si algún día se quiere; aplicar el MISMO
lenguaje al resto de pantallas (Materias → Agenda → Amigos → Cumbre → Login). Falta que el usuario lo
apruebe en su teléfono (desplegar) — hasta entonces todo sigue en LOCAL.

## ⚡⚡ RETOMAR — REDISEÑO DEL INICIO (dirección corregida, 2026-07-13) — referencia del brief

> **Autocrítica honesta (para no repetir):** el Inicio actual (Partes 1a color / 1b 3-tarjetas / 1d
> mascota) quedó como **"cajas apiladas"** — mismo radio, sombra y padding en todo, sin jerarquía real,
> iconografía mezclada, mascota poco integrada. Se siente **básico, nivel novato**, igual que el anterior.
> El error de fondo: **porté la estructura vieja y le cambié los colores, en vez de COMPONER**. Mañana el
> Inicio se **RECONSTRUYE desde la composición**, no se parchea. El objetivo NO es copiar Duolingo ni
> ninguna app: es alcanzar su **nivel de intención, pulido, sistema visual y calidad percibida**.
>
> **Cómo lidero esto (nota para mí, Claude):** proponer, no esperar guía pixel a pixel. Primero definir
> **jerarquía real** (hero → sección → fila → dato auxiliar) y una **escala tipográfica con contraste de
> verdad**; después maquetar. **Menos cajas, más ritmo, escala y composición.** No usar el mismo radio/
> sombra/padding en todo. El resultado tiene que sentirse **terminado incluso vacío**.

### Norte de calidad
App educativa **premium, cálida, contemporánea y profesional de 2026**. Mobile-first.
- **Mucho espacio** y jerarquía clara. Menos cajas; más ritmo, escala y composición.
- **Fondo pastel MUY sutil** — menos brillante y menos presente que ahora (bajar la intensidad del
  degradado actual del canvas).
- **Blanco** = superficie principal.
- **Morado cálido** (`--chispa-primary #6753E8`) = color estructural y de acción principal.
- **Turquesa** (`#23BFAE`) = progreso. **Coral** (`#FF795F`) = SOLO acentos/recordatorios amables.
  **Verde** (`#2DBE72`) = SOLO avances reales. **Amarillo** = energía/logro (no en texto chico).
- **Fredoka** para personalidad y títulos; **Nunito** para lectura y datos.
- La **mascota y los íconos 3D son identidad de marca**, no decoración aleatoria.

### Los 8 cambios obligatorios del Inicio

**1. Reconstruir la jerarquía del encabezado.** El **saludo es el protagonista**. Integrar saludo +
grado + fecha + Chispa + menú como **una sola composición** (no piezas sueltas). Chispa cercana y
cuidada, pero **sin competir con el nombre** del estudiante. Menú de cuenta discreto, claro, target
44 px. Grado y fecha = **contexto tranquilo**, no badges decorativos compitiendo. Sin avatar genérico.
**No duplicar Chispa** en otra zona de la Home (§9 spec).

**2. Reemplazar las 3 tarjetas de métricas separadas** (revierte la Parte 1b). NO tres mini-cards
independientes para racha/energía/metas. Crear **un único resumen integrado y compacto**: cada métrica
rápida de leer pero **sin su propia caja blanca grande**. Divisores sutiles o composición horizontal
elegante. Solo datos reales. **Acompañan al saludo, no lo dominan.**

**3. "Tu misión de hoy" = el verdadero HERO de la pantalla.** El momento visual más especial de la Home.
Reducir la sensación de "card genérica". Un **único CTA dominante**. **Evitar mayúsculas** y cortes
bruscos de palabras (hoy dice "MATEMÁTICA" en caps — mal). La ilustración de Cumbre debe sentirse
**intencional y editorial**. **Fuera los triángulos CSS que parecen placeholder** (la `.h2Mountain`
actual). Si no hay ilustración adecuada, preferir una **composición abstracta sobria** antes que una
montaña pobre. Título/contexto/acción con **datos reales**; la misión **recomienda qué conviene hacer**,
sin repetir literalmente lo de "Para hoy".

**4. Simplificar "Para hoy".** Solo pendientes reales. Si no hay: **"Todo al día por ahora" ligero e
integrado** (una fila suave con check verde + texto), **no una card grande vacía**. "Anotar" secundario y
**perfectamente alineado con el título**. Si hay pendientes: **máximo dos**, con materia + descripción +
fecha real.

**5. "Continúa aprendiendo" útil y visible.** La materia principal debe verse **claramente antes de la
nav inferior** (revisar que la nav NUNCA corte ni tape este bloque). Datos reales de materia + progreso.
No como deber obligatorio. **Íconos 3D de materia** cuando existan (nunca iniciales genéricas). Máximo
**dos accesos secundarios** compactos.

**6. Unificar iconografía.** Hoy hay mezcla que baja la calidad. Materias → **assets 3D transparentes**
de `assets/materias/`. Funcionales (nav, flechas, menú, calendario, checks) → **SVG simples, redondeados
y consistentes entre sí** (mismo tamaño, trazo, radio, color). **Nada de emojis como iconografía
principal.** No mezclar íconos ultrafinos grises con la mascota 3D sin un tratamiento coherente.

**7. Rediseñar la navegación inferior.** Mantener destinos EXACTOS (Inicio, Materias, Amigos, Agenda) y
la funcionalidad actual. **Flotante, cómoda, silenciosa.** Reducir bordes, cajas internas y ruido. Estado
activo claro **sin parecer "otra tarjeta dentro de otra tarjeta"**. Respetar safe area inferior.
Separación suficiente del último contenido, **sin hueco gigante**.

**8. Proporciones, ritmo y densidad.** Revisar TODO a **360 / 390 / 430 px**. **No usar el mismo radio,
sombra y padding en todo.** Jerarquía real: **hero → sección → fila → dato auxiliar**. Más espacio donde
importa; compactar lo secundario. Evitar que cada bloque parezca **encerrado en una caja**. Terminado
incluso con estados vacíos.

### Qué se revierte / rehace de lo ya hecho
- **1b (3 tarjetas de stats)** → se elimina; va el resumen integrado del punto #2.
- **Montaña CSS `.h2Mountain` (triángulos)** → fuera; ilustración editorial o composición abstracta (#3).
- **Título de misión en mayúsculas** → sentence case, sin cortar palabras (#3).
- **Canvas del Inicio** → bajar intensidad del degradado (fondo más sutil que el actual).
- **Estado vacío "Todo al día" como card grande** → fila suave integrada (#4).
- **Lo que SÍ se conserva:** tokens oficiales `--chispa-*` (Parte 1a), config central de la mascota
  `chispaSrc()`/`chispaPoseSrc()` (Parte 1d), íconos de materia 3D, el "arco de compañía" del flujo de
  aprender (pensando→leyendo→celebrando), y la mascota SIN animación (el usuario pidió quitar el
  movimiento — **no volver a agregar sube-y-baja ni floteos**).

### Método para mañana (orden sugerido)
1. Bocetar la **jerarquía y el ritmo** del Inicio completo ANTES de tocar CSS (definir hero, secciones,
   filas, datos auxiliares; qué lleva aire y qué se compacta).
2. Encabezado como composición integrada (#1).
3. Resumen integrado de métricas (#2).
4. Hero de misión editorial (#3).
5. "Para hoy" + "Continúa aprendiendo" con densidad correcta (#4, #5).
6. Nav inferior silenciosa (#7).
7. Pasada de iconografía coherente (#6) y de proporciones a 360/390/430 (#8).
Verificar en LOCAL (Browser pane, login mockeado) a los 3 anchos. Sin desplegar hasta aprobar.

---

## 0. Regla de oro
El norte es **calma + belleza + claridad** (ver `CHISPA_2.0_VISION.md`). Cada pantalla debe provocar
"qué bonito" antes que "qué funciones tiene". Menos botones, más aire, una sola acción importante por
pantalla. La mascota **acompaña** (aparece cuando su expresión ayuda), no decora todo.

---

## 1. Estado actual (qué YA está hecho, todo LOCAL sin desplegar)

Trabajamos en el repo real `aula-cam/` (no en `aula-cam-estetica-local`, que es solo la base de Codex).
Se prueba en LOCAL con `vercel dev` en el Browser pane (ver §8). **Nada commiteado ni desplegado aún.**

- **Inicio (pestaña `#tabInicio`)** ya migrado al look nuevo: encabezado con saludo + mascota, fila de
  stats (racha/energía/metas), tarjeta "misión de hoy", "Para hoy", "Continúa aprendiendo", "Próximas
  entregas", "Tu progreso", "Mis materias", y un `<details> Más para ti` con lo secundario (Sinapsis,
  horario, notas, familia). CSS en `estilos.css` bajo el bloque `CHISPA 2.0 — INICIO`. Lógica en
  `app.js` (funciones `homeMateriaVisual`, `homeMarca...`, `pintarHome*`, `pintarExamenBanner` reescrito
  como "misión").
- **Mascota 3D** (5 expresiones) en `assets/chispa-3d/chispa-3d-{saludando,pensando,animando,celebrando,descansando}.png`.
  Cableado hecho: **saludando** en el header (con balanceo idle CSS `@keyframes chispaBob`), **pensando**
  en la carga de IA (`vistaCargando`, reemplazó el 🧠), **celebrando/animando** en el resultado del quiz
  (`mostrarResultadoQuiz`: ≥70% celebra, <70% anima — nunca castiga). Faltan **animando** (antes de
  practicar) y **descansando** (estados vacíos: "todo al día").
- **Íconos de materia** (15, estilo claymorphism 3D de Codex) en `assets/materias/*.png`. Mapeados por
  nombre real en `homeMateriaVisual` (orden importa: sociales antes que ciencias, ed. física antes que
  física, química/física/biología antes que "ciencias" genérico). Fallback = `como-pensar.png`.
- **Nav inferior**: íconos SVG stroke (Inicio/Materias/Amigos/Agenda), activo en morado con fondo pill.

**Lo que sigue VIEJO (a migrar):** Materias, Agenda, Amigos (muro), Cumbre, login/landing, onboarding,
paneles de Familia y `#lab`. Todo eso todavía usa el CSS y layout anteriores.

---

## 2. Sistema de diseño (tokens únicos)

Hoy conviven 2-3 paletas (`--mango/--teal/--grape` viejas, `--h2-*` de la migración de Inicio, colores
de la mascota). **Pendiente clave: consolidar en un solo set de tokens en `:root`** y migrar todo sobre
eso. Valores objetivo (fusión ya usada en Inicio):

| Token | Hex | Uso |
|---|---|---|
| Llama `--flame` | `#FF6B3D` | acción principal / CTA cálido |
| Brasa `--flame-deep` | `#C7431C` | hover/pressed de flame |
| Chispa `--spark` | `#FFC83D` | energía, racha, logros |
| Anochecer `--dusk` | `#5B3FD1` | color estructural fuerte (nav activo, misión, énfasis, botones) |
| `--dusk-deep` | `#4530A3` | hover/pressed de dusk |
| Calma `--calm` | `#0EA99A` | informativo, progreso, neutro-positivo |
| Hoja `--leaf` | `#2DAE68` | éxito puntual (completado) |
| Coral `--coral` | `#FF7A5C` | incorrecto / atención SIN alarmar (nunca rojo duro para un niño) |
| Tinta `--ink` | `#26193A` | texto principal |
| Muted `--muted` | `#786E8C` | texto secundario |
| Papel `--paper` | `#FFF7EE` / lavanda | fondo de página (wash pastel) |
| Superficie | `#FFFFFF` | fondo de tarjeta |
| Línea | `#F0E4EC` | bordes/divisores sutiles |

**Colores por materia** (para íconos/dots/acentos): Matemática `#5B3FD1`, Lenguaje `#FF7A5C`, Inglés
`#3B6FD4`, Ciencias `#2DAE68`, Biología `#12B5A4`, Física `#7C4DFF`, Química `#C7431C`, Informática
`#0EA99A`, Sociales `#4F83D8`, Cómo Pensar `#E4A91B`, Música `#9A62D5`, Arte `#FF7A5C`, Ed. Física
`#F0A500`, Robótica `#12B5A4`, Religión `#E4A91B`.

**Tipografía:** Fredoka (títulos, 600; los títulos GRANDES de pantalla van MUY bold, casi negro — ver
"Agenda"/"Amigos"/"Cumbre" en las referencias, con la palabra clave en morado) + Nunito (cuerpo 400,
datos 800). **Fondo de página:** wash pastel muy suave (lavanda→durazno→crema) con glow radial arriba.
**Radios:** `--r-lg 28px` (tarjetas grandes) · `--r-md 20px` · `--r-sm 14px`. **Sombras:** difusas,
tenue, de color (nunca duras). **Mucho aire entre bloques.**

---

## 3. Componentes base (patrones que se repiten en TODAS las pantallas)

Extraídos de las 4 referencias. Construirlos UNA vez como clases reutilizables y usarlos en todas las
pantallas (así se migra rápido y queda coherente):

1. **Encabezado de pantalla**: título Fredoka grande y bold (palabra clave en morado) + subtítulo muted
   opcional; a la derecha un botón circular (acción principal, ej. "Anotar" con lápiz) o la mascota.
2. **Section header**: título Fredoka 1.1-1.2rem + link "Ver todo/Ver todas ›" en morado a la derecha.
3. **Tarjeta blanca**: fondo blanco, radio grande, sombra difusa, buen padding. Es la base de casi todo.
4. **Tarjeta con acento lateral**: barra vertical de color a la izquierda (por materia) — usada en tareas
   ("Próximo" de Agenda).
5. **Placa de ícono de materia**: cuadrado redondeado con fondo tintado del color de la materia + el PNG
   del ícono adentro (`assets/materias/`). Ya existe como `.h2SubjectMark`/`.h2SubjectIcon`.
6. **Chip de meta/hora**: pastilla tintada con ícono (reloj) + texto (ej. "10:30 AM", "Hoy", "Ayer").
7. **Pill de estado**: `Completado/Completada` (verde `--leaf`), `En progreso` (muted/lavanda),
   `Pendiente` (coral). Redondeada, texto del color de su familia.
8. **Stepper horizontal** (progreso): nodos circulares con ícono, conectados por línea; hechos = morado,
   activo = morado grande, futuros = gris. Dos variantes vistas: 5 pasos (Explorar·Aprender·Practicar·
   Dominar·Cumbre) y 3 pasos (Aprendiendo·Practicando·Dominando). Barra de progreso teal debajo.
8b. **Barra de progreso**: track gris claro + relleno degradado (morado→teal o color de materia).
9. **Botón de reacción** (muro/Amigos): pill con borde, ícono + label ("Me alegra ♥", "¡Bien hecho! ★",
   "Inspirador ✧"). Fila de 3.
10. **Avatar**: círculo con degradado del color asignado + iniciales o nombre corto.
11. **Fila de lista** (agenda "Esta semana"): badge de fecha (día abrev + número) a la izquierda, dot de
    color, materia bold, divisor, descripción muted a la derecha.
12. **Nav inferior**: barra flotante redondeada, íconos stroke, activo = morado + fondo pill + indicador.
    En Cumbre la referencia muestra un **botón central elevado (FAB)** morado con ícono de montaña →
    evaluar si Cumbre pasa a ser el centro de una nav de 5 (Inicio·Materias·[Cumbre]·Amigos·Agenda).
13. **Ilustraciones**: montaña (hero de Cumbre + tarjeta "misión" del Inicio), planeta (tema en curso),
    etc. La de la montaña hoy es un placeholder CSS (`.h2Mountain`) → reemplazar por PNG de Codex
    (o la hago yo en SVG). Es el ÚNICO dibujo que falta pedir.

---

## 3.5. Chispa compañero — config central (Parte 1d, en curso)
`app.js` tiene una **config central** de la mascota (spec §13): `chispaSrc(estado)` para los 5 estados
oficiales (fallback seguro a saludando) y `chispaPoseSrc(nombre)` para las 15 poses de `poses/png/`
(fallback a reposo). Todos los usos existentes (header, carga IA, resultado de quiz) pasan por ahí.
**"Arco de compañía" del flujo aprender:** Chispa **piensa** (pensando) mientras la IA prepara →
**lee con vos** (pose leyendo) en el resumen → **festeja/anima** (celebrando/animando) en el quiz.
Regla §9 respetada: una sola Chispa por vista (el resumen/quiz NO tienen la del header).
**Pendiente de 1d (poses ya disponibles):** animando/pulgarArriba antes de practicar · descansando en
estados vacíos que NO sean el Inicio (ej. "sin errores por repasar") · poses en el onboarding nativo ·
sorprendido al desbloquear algo. NO poner una 2ª Chispa en el Inicio (viola §9).

## 4. Movimiento y estados de la mascota

- **Idle**: balanceo suave en el header de Inicio (ya hecho, `@keyframes chispaBob`, respeta
  `prefers-reduced-motion`).
- **Pensando**: durante toda carga de IA (ya hecho en `vistaCargando`).
- **Celebrando**: logro real — quiz aprobado, racha, tema dominado (parcial: quiz hecho).
- **Animando**: antes de practicar / respuesta incorrecta / quiz bajo — nunca como castigo (parcial:
  quiz bajo hecho; falta "antes de practicar").
- **Descansando**: estados vacíos ("todo al día", sin tareas, fin de sesión) — FALTA cablear.
- **Entradas de tarjetas**: fade-up escalonado suave (200-250ms ease-out). Nunca rebote exagerado.
- Regla: **una sola expresión de la mascota por contexto** (ver `CHISPA_CHARACTER_STATES.md`).

---

## 5. Pantalla por pantalla — el objetivo

> Las 4 imágenes que dejó el usuario son REFERENCIA de dirección, NO literales: los íconos son otros
> (usamos los nuestros de `assets/materias/`), los datos varían, y muchos detalles cambian. Capturan el
> "sabor", no el pixel.

### Inicio (referencia img 4) — ya migrado, pulir hacia la referencia
- Saludo "¡Hola, [Nombre]!" (Nombre en morado grande) + subtítulo + **mascota saludando prominente,
  asomándose** en el header. Stats como **3 tarjetas separadas** (racha/energía/metas) cada una con
  ícono de color, número grande y una línea de estado de color ("¡Sigue así!", "¡Lista para aprender!",
  "Vas por buen camino"). Tarjeta "misión de hoy" morada con **ilustración de montaña**. Secciones "Tu
  agenda" (filas con placa de materia + chevron), "Continúa aprendiendo" (tarjeta tintada con
  ilustración del tema + barra de progreso %), "Tu progreso académico" (stepper de 3), y fila de
  **tarjetas de materia tintadas** (lavanda/teal/coral) con ícono + "Explorar" + chevron.
- Ajustes vs. lo actual: separar los stats en 3 tarjetas, sumar líneas de estado de color, y la
  ilustración real de montaña.

### Agenda (referencia img 1) — MIGRAR
- Encabezado "Agenda" bold + botón circular "Anotar" (lápiz) arriba a la derecha.
- **Tira de semana**: tarjeta blanca con LUN-DOM (abrev + número), día activo con pill morado.
- Sección **"Próximo"**: tarjetas con **acento lateral de color** por materia, placa de ícono, materia
  en color, título bold, descripción muted, y **chip de hora** tintado con reloj a la derecha.
- Sección **"Esta semana"**: filas de lista (badge fecha + dot + materia bold + descripción muted).
- Sección **"Notas recientes"**: mini-tarjetas horizontales con ícono en círculo tintado + título +
  pill de estado (Completada/En progreso/Pendiente).
- Hoy la Agenda vieja tiene formularios que vuelcan chips; rediseñar con estos patrones.

### Amigos / Muro (referencia img 2) — MIGRAR
- Encabezado "Amigos" bold + subtítulo "Celebramos el esfuerzo de tu grado" + botón circular (gente).
- **Tarjetas de compañero**: avatar con degradado + iniciales, nombre bold, "Logró algo en [Materia]"
  (materia en color), caja tintada con ícono de materia + el logro, y **fila de 3 reacciones** (Me
  alegra ♥ / ¡Bien hecho! ★ / Inspirador ✧) como pills con borde. Chip de tiempo (Hoy/Ayer) arriba.
- **Tarjeta "Mi logro personal"** (verde tenue): pill "Solo para mí" 🔒, título, texto, ilustración de
  montañita con estrella, y fila interior "Completé mi reto de práctica" con check verde.
- Mantiene la privacidad actual (reacciones seguras, sin texto libre, segmentado por grado).

### Cumbre (referencia img 3) — MIGRAR
- **Hero: ilustración de montaña** a sangre (morada/lavanda, bandera en la cima, camino serpenteante,
  nubes, glow de amanecer) + título "Cumbre" + lema **"Chispa te acompaña. Cumbre te espera."** + botón
  volver circular arriba a la izquierda.
- Tarjeta **"Tu camino al próximo grado"**: **stepper de 5** (Explorar·Aprender·Practicar·Dominar·
  Cumbre) con nodos-ícono, activo morado grande; barra de progreso teal + hint debajo.
- **"Tus materias"**: tarjetas-acordeón por materia (placa de ícono + nombre + subtítulo alentador +
  chevron). Expandida: lista tintada de temas con estado (Completado ✓ verde / en curso radio / bloqueado
  gris + chevron).
- Evaluar nav de 5 con Cumbre como **FAB central elevado** (círculo morado con montaña).

### Materias — MIGRAR (la más usada después de Inicio; buen 2º paso)
- Grilla/lista de materias con placa de ícono tintada + nombre + barra de progreso; al entrar, el panel
  de temas con la ruta de aprendizaje (Aprende→Practica→Quiz→Examen). Reusar placas de ícono, pills de
  estado, stepper y barras de progreso ya definidos.

### Login / Landing / Onboarding — MIGRAR
- Landing y login (`#vLanding`/`#vLogin`) al look nuevo: tipografía grande, tarjetas suaves, mascota
  saludando de bienvenida. El onboarding de 5 pasos (cuentas nativas) ya existe; re-estilizarlo igual.

### Secundarios (baja prioridad): panel `#lab` (admin, no lo ven niños) y panel de Familia
(`familia.html`, otro dominio) — migrar al final o dejar como están.

---

## 6. Orden de ejecución sugerido
1. **Consolidar tokens** en `:root` (fusión del §2) y apuntar el Inicio nuevo a esos tokens (quitar el
   `--h2-*` local). Base para no acumular paletas.
2. **Componentes base** como clases reutilizables (§3): section header, pills de estado, chips, stepper,
   barra de progreso, placa de ícono, tarjeta con acento lateral, botón de reacción, avatar, nav.
3. **Materias** (migrar primero — alto uso).
4. **Agenda** (patrones muy claros en la referencia).
5. **Amigos / Muro**.
6. **Cumbre** (necesita la ilustración de montaña; decidir FAB central).
7. **Login / Landing / Onboarding**.
8. Pulido de estados de mascota faltantes (descansando en vacíos, animando antes de practicar) +
   entradas escalonadas de tarjetas.
9. Ilustraciones que faltan (montaña) — pedir a Codex o hacer en SVG.
10. `#lab` y Familia (opcional).

---

## 7. Assets
- Mascota 3D: `assets/chispa-3d/chispa-3d-{saludando,pensando,animando,celebrando,descansando}.png` (listos).
- **15 poses adicionales** de la mascota en `aula-cam-estetica-local/assets/chispa-3d/poses/png/`
  (reposo, brazos-abiertos, señala-derecha/izquierda, pulgar-arriba, escuchando, leyendo, escribiendo,
  estrella, explicando, sorprendido, caminando, saltando, estirando, parpadeando) + versiones SVG.
  Son la base del "compañero estilo Duolingo" (Parte 1d).
- Íconos de materia: `assets/materias/*.png` (15, listos).
- **Íconos de stats (racha/energía/metas)** 3D en `assets/stats/{racha,energia,metas}.png` (LISTOS,
  2026-07-14) — flama con órbita, rayo con destellos, montaña-bandera (rima con Cumbre). Cableados en
  `pintarHomeStats` (`tarea → metas`). Reemplazaron a los SVG placeholder.
- Falta: **ilustración de montaña** (hero Cumbre + tarjeta misión). Los originales de Codex están en
  `aula-cam-estetica-local/assets/`.

---

## 8. Reglas operativas (cómo trabajamos)
- **Se trabaja en `aula-cam/` (repo real).** `aula-cam-estetica-local/` es solo la base de Codex (sin
  internet, no se desarrolla ahí).
- **Verificación en LOCAL, en vivo:** `npx vercel dev --listen 3311` y se abre en el Browser pane; el
  usuario ve la ventana moverse en vivo (no capturas). El `preview_start` de dev server estaba roto antes;
  `vercel dev` sí funciona.
- **Login real NO corre en local** (las APIs están candado CORS al dominio `aula-cam.vercel.app`). Para
  ver pantallas con datos, se **mockea el login** inyectando `window.fetch` para `/api/moodle` con datos
  de prueba (una "Martina" inventada). El diseño se ve exacto; los datos son de relleno.
- **Service worker cachea agresivo:** tras cada cambio hay que **desregistrar SW + borrar caches** por
  JS y recargar, si no sirve el código viejo. (En el teléfono del usuario: recargar 1-2 veces o reinstalar.)
- **Nada se despliega hasta que el usuario apruebe una tanda.** Producción = push a `main` (auto-deploy
  Vercel a 2 dominios). No commitear ni pushear sin pedido.
- **Ediciones quirúrgicas** + `node --check app.js` antes de dar por hecho un cambio de JS.
- Commits (cuando toque): autor `giucp <loveandpainsports@gmail.com>` + trailer Co-Authored-By.

---

## 9. Nota de dirección (del usuario, 2026-07-13)
"Empecé con Codex solo para mejorar la estética, pero al final quiero trabajar contigo nomás." → Codex
queda como herramienta de dibujos puntuales; el rediseño (sistema, pantallas, estados, movimiento) lo
lleva Claude. Las 4 referencias que dejó son el resultado deseado a grandes rasgos, no plantillas literales.

---

# 🔒 10. HERO DEL INICIO — RESUELTO Y CONGELADO (2026-07-14)

> **NO tocar estos valores ni estos assets sin pedido explícito.** Costaron una sesión entera.
> Resuelto con Claude Design + ajuste fino del usuario en el panel `tuner.html`.

## 10.1 Assets (los ÚNICOS válidos; están en `assets/hero/`)
| Archivo | Qué es | Origen / proceso |
|---|---|---|
| `chispa.png` | mascota cuerpo entero (capa de atrás) | copia EXACTA de `aula-cam-estetica-local/assets/illustrations/hero/usa esta.png` (1254×1254, sin tocar) |
| `chispa-mano.png` | **solo la mano** (capa de adelante, apoyada en el hero) | recortada de la mano original: se **eliminó el domo/muñeca de arriba** (corte al **26%** de la altura del contenido, con **feather de 16px**) y se recortó al bbox → **570×490** |
| `libro.png` | libro + destellos | `…/hero/y este hero.png` (1536×1024) con los **destellos de la izquierda atenuados** (ver 10.3). El **libro NO se toca** |

**Respaldos de los originales:** carpeta `codex/assets/hero/` (intacta) y scratchpad de la sesión
(`chispa-mano-ORIGINAL.png`, `libro-ORIGINAL.png`, `assets-ORIGINAL/`).

### ⚡ Optimización de peso (2026-07-14, antes del 1er deploy)
Los PNG venían a **1254×1254** (y 1536×1024) pesando **28.6 MB en total** aunque se muestran a
18–158 px → el Inicio se traía 6-7 MB. Se **redimensionaron a ~3× su tamaño de display** (retina) y
se recomprimieron: **28.6 MB → 1.21 MB**. Tamaños actuales: `chispa.png` 480×480 (129 KB) ·
`chispa-mano.png` 96×83 (10 KB) · `libro.png` 860×573 (190 KB) · `materias/*` 180×180 (~30 KB) ·
`stats/*` 120×120 · `chispa-3d/*` 360×360.
**La PROPORCIÓN se preservó exacta** (1.0 / 1.163 / 1.500) → los valores CSS de §10.2 **siguen
valiendo igual** (el CSS mide en px de display, no en resolución del archivo).
También se sacó **peso muerto**: `assets/chispa/` (no referenciada) y 13 de las 15 `poses/` (el código
solo usa `leyendo`; se dejó `reposo` por ser el fallback). Todo eso vive en
`aula-cam-estetica-local/` y en el scratchpad (`assets-descartados/`).
**Si se agrega un asset nuevo: exportarlo a ~3× su display, NO a 1254px.**

## 10.2 Valores CSS finales (bloque `CHISPA 2.0 — HOME · FINAL COMPOSITION PASS` de `estilos.css`)
Ajustados por el usuario en `tuner.html`. **La mano y el libro son 2 piezas independientes.**

```
/* 390px · base (sin media) */
.h2Top        { --hand-w:17px; --hand-t:107px; --hand-r:13px; }
.h2MissionArt { right:16px; bottom:35px; width:266px; }

/* 360px · @media (max-width:374px) */
.h2Top        { --hand-w:16px; --hand-t:102px; --hand-r:13px; }
.h2MissionArt { right:6px;  bottom:40px; width:245px; }

/* 430px · @media (min-width:420px) */
.h2Top        { --hand-w:18px; --hand-t:110px; --hand-r:16px; }
.h2MissionArt { right:24px; bottom:24px; width:285px; }
```
Regla de la mano (fija):
```
.h2HeroHand{position:absolute;z-index:4;top:var(--hand-t);right:var(--hand-r);width:var(--hand-w);
  height:auto;pointer-events:none;transform:rotate(8deg);transform-origin:top center;
  filter:drop-shadow(0 6px 5px rgba(57,34,135,.26));}
```
- **HTML** (`index.html` y `demo-inicio.html`), dentro de `.h2Top`, justo después de `.h2HeroChispa`:
  `<span class="h2HeroHand" aria-hidden="true"><img src="assets/hero/chispa-mano.png" alt="" /></span>`
- `.h2Top::after{content:none}` → **el intento viejo de clip-path quedó ABANDONADO** (no revivirlo).
- Capas: mascota `z-1` (detrás del hero) · hero/misión `z-2` · texto `z-3` · **mano `z-4`** (delante).

## 10.3 Cómo se atenuaron los destellos de `libro.png` (receta exacta)
Objetivo: que las estrellas que caen sobre el texto no le quiten fuerza, **sin tocar el libro**.
1. **Aislar el libro con FLOOD-FILL 4-conexo** (semilla = mediana de los px con alpha>90), luego
   dilatar con `MaxFilter(9)` para tomar el borde suave. Resultado: libro ≈ 242.853 px, x **806→1410**.
2. Atenuar **solo** los píxeles `alpha>25 AND NOT libro`, con factor **continuo** por X:
   - `x < 806` → `0.20 + 0.32*(x/806)` (lejos ≈20%, junto al libro ≈52%)
   - `x >= 806` → `clip(0.52 + 0.48*(x-806)/244, 0.52, 1.0)` (sube suave hasta 100%)

### ⚠️ Las 3 trampas que costaron horas (NO repetir)
1. **Aislar el libro por columnas NO sirve**: el libro está **ladeado**, su esquina inferior-izquierda
   (lomo + marcador) cae a la izquierda del "borde" detectado → se atenuaba y aparecía un
   **cuadro de degradado sobre el libro**. Solución: flood-fill de la región conectada.
2. **El degradado DEBE ser continuo**: con un salto (52% → 100%) en el borde del libro, las estrellas
   que caen justo ahí quedan **mitad degradadas / mitad sólidas** (le pasó a la estrella morada).
3. **Los valores CSS están calibrados para ESTE `libro.png` (1536×1024)**. Si se cambia el asset por
   otro (o por un recorte), el tamaño/posición se rompen aunque los números sean los mismos.
   *(Pasó: quedó un recorte viejo de 1010×690 y el libro salía gigante.)*

## 10.4 Herramientas de trabajo (siguen sirviendo)
- **`tuner.html`** — panel interactivo: carga el hero REAL en un iframe, sliders de mano
  (`--hand-w/--hand-t/--hand-r`) y libro (`width/right/bottom`), botones 360/390/430 + ancho libre,
  **zoom** (−/+/⟲) y caja con los valores exactos para pegar en el CSS.
- **`demo-inicio.html`** — Inicio con datos mockeados y auto-login (no necesita backend).
- **`demo-largo.html`** — igual pero con materia de nombre largo ("Lógica Matemática").
- **`../chispa-viewing.bat`** — sirve la carpeta en LAN (`0.0.0.0:8080`) para verlo en el celular.
  PC: `http://localhost:8080/…` · Celu (misma WiFi): `http://192.168.68.109:8080/…`
  *(si la IP cambia: `ipconfig` → IPv4 del adaptador Wi-Fi; y permitir Python en el Firewall).*

---

# 🎭 11. MAPA DE POSES DE CHISPA — una pose por momento (2026-07-14)

> **Regla dura: NO repetir la misma Chispa en pantallas distintas.** Hay **20 poses** en
> `aula-cam-estetica-local/assets/chispa-3d/` (15 en `poses/png/` + 5 estados). Usar una sola para
> todo mata la personalidad y hace que dos pantallas parezcan la misma. Cada momento tiene SU pose.
> **Tampoco clonar la composición**: el hero del Inicio es una tarjeta morada con la mano apoyada;
> otra pantalla NO debe copiar esa tarjeta — necesita su propio ritmo.

| Momento | Pose | Estado |
|---|---|---|
| **Inicio · hero** | `saludando` + `chispa-mano` apoyada (2 capas) | ✅ hecho (§10) |
| **Bienvenida / landing** | **`02-brazos-abiertos`** (recibe), centrada sobre glow cálido | ✅ hecho |
| **Login** | `05-pulgar-arriba` o `06-escuchando` | ⬜ pendiente (decidir con el user) |
| **¿Cómo funciona?** | `10-explicando` | ⬜ idea |
| **Carga de IA** | `pensando` | ✅ ya estaba |
| **Resumen** | `07-leyendo` | ✅ ya estaba |
| **Antes de practicar** | `08-escribiendo` | ⬜ pendiente |
| **Quiz aprobado (≥70%)** | `celebrando` | ✅ ya estaba |
| **Quiz bajo (<70%)** | `animando` (nunca castiga) | ✅ ya estaba |
| **Racha / logro** | `09-estrella` | ⬜ pendiente |
| **Vacío "todo al día"** | `descansando` | ⬜ pendiente |
| **Materias vacío / guiar** | `03-senala-derecha` | ⬜ idea |
| **Onboarding nativo** | `02`, `10-explicando`, `05-pulgar-arriba` | ⬜ pendiente |

**Al agregar una pose:** exportarla a **~3× su tamaño de display** (regla de peso de §10.3), NO a
1254px. Ej.: `chispa-bienvenida.png` = pose 02 a 510px (135 KB) para mostrarse a ~186px.

---

# 🎯 12. LANDING — DIRECCIÓN DEFINITIVA (spec del usuario, 2026-07-14) ← **RETOMAR ACÁ**

> El usuario trajo una lámina con la metodología + 3 mockups. **Esto manda sobre todo lo anterior
> de la landing.** Las 2 versiones que hice antes NO sirven y quedan superadas.
>
> **Autocrítica (para no repetirlo):** hice la landing dos veces y las dos fueron malas.
> 1ª: diseño viejo recoloreado (mascota flotando al lado de un párrafo, cero hero, cero color).
> 2ª: Chispa brazos-abiertos centrada sobre un glow → **sigue siendo un sticker flotante**.
> El error de fondo: **no miré las 20 poses que ya existían** y **clonaba la composición del Inicio**
> en vez de componer. Y esperaba que el usuario me guiara pixel a pixel en vez de traer decisiones.

## 12.1 Los 10 principios (de la lámina)
1. **Objetivo único:** que el usuario entienda el valor y quiera entrar a practicar. Todo el diseño
   guía al botón principal, sin competir por atención.
2. **Jerarquía fuerte:** el ojo ve 1º la mascota y el valor, 2º el botón, 3º cómo funciona, 4º padres.
   Se logra con tamaño, color, contraste y espacio.
3. **⭐ Chispa es el PROTAGONISTA, no decoración: es el guía.** Debe aparecer **EN UNA ESCENA**
   (entorno del aula, interactuando con elementos educativos), **NO como un sticker flotante**.
4. **El valor en una frase:** clara, corta y emocional.
5. **3 pasos visuales:** que se entiendan en 2 segundos. Tarjetas con ilustraciones 3D coherentes y
   texto mínimo.
6. **CTA imposible de ignorar:** grande, con degradado, ícono y microcopia orientada a la acción.
7. **Padres, discreto:** tarjeta secundaria al final, estilo neutro, ícono de seguridad. Importante
   pero no compite.
8. **Ritmo:** márgenes amplios, radios grandes, mucho aire. Alternar bloques grandes/chicos.
9. **Consistencia:** paleta, tipografía y estilo 3D ya definidos.
10. **Validar el recorrido** (test de 5 segundos): **Chispa → Valor → CTA → Pasos → Padres**.

## 12.2 Mockup 1 — Landing (la pantalla principal)
- Eyebrow `CHISPA` morado.
- **H1:** "Tu aula virtual, **hecha para ti**" ("para ti" en morado).
- **Sub:** "Todo lo que aprendes en clase, ahora en un solo lugar para que practiques, entiendas y apruebes."
- **ESCENA (el asset clave):** Chispa **en un escritorio con una laptop**, pizarrón de fondo, planta —
  ambiente de aula. Ocupa el bloque central, a sangre con el fondo cálido.
- **CTA:** "Entrar a practicar" + flecha en círculo. Grande, degradado morado.
- **Prueba social: DESCARTADA (decisión del usuario, 2026-07-14).** No va fila de avatares ni "miles de
  estudiantes" ni ninguna variante — sería falso (Chispa la usan 2 niñas). **NO reabrir.** Los mockups
  son REFERENCIA de composición; **el texto lo escribimos nosotros**, no se copia el de la lámina.
- **Padres:** tarjeta neutra al final: ícono candado + "Para los padres · Consulta el acceso y la
  seguridad" + chevron.

## 12.3 Mockup 2 — "¿Cómo funciona?"
- Título + bajada: "Así es tu aula virtual en 3 simples pasos".
- 3 **tarjetas horizontales**: nº morado + título + texto corto + **ilustración 3D a la derecha**:
  1. "Entra con tu usuario del aula" · "El mismo de siempre." → ilustración: tarjeta de acceso.
  2. "Escoge tu materia y tu tema" · "Los mismos que estás viendo en clase." → libros + matraz.
  3. "Aprende, practica y ponte a prueba" · "Primero entiendes, después practicas, y al final simulas
     tu examen." → **Chispa escribiendo en un cuaderno** (pose 08-escribiendo, en escena).
- Cierra con la tarjeta de padres.

## 12.4 Mockup 3 — "Todo en un solo lugar"
- **H1:** "Todo en un solo lugar para que avances **más y mejor**".
- **Chispa brazos-abiertos EN ESCENA**, rodeada de elementos 3D flotantes (trofeo, checks, checklist).
- **Grid 2×2** de features, cada una con ícono 3D:
  | Resúmenes inteligentes · "Entiende rápido lo más importante" | Retos y prácticas · "Ejercicios para reforzar lo aprendido" |
  | Simulacros de examen · "Practica como si fuera el día real" | Tu progreso · "Sigue tu avance y celebra logros" |
- Cierra con la tarjeta de padres.

## 12.5 ASSETS — los está creando el usuario (avisa dónde quedan)
Necesarios para poder maquetar esto:
- [ ] **Escena landing:** Chispa en el escritorio con laptop + pizarrón + planta.
- [ ] **3 ilustraciones de los pasos** (acceso / libros+matraz / Chispa escribiendo).
- [ ] **Escena "todo en un lugar":** Chispa brazos-abiertos + elementos flotantes (trofeo, checks).
- [ ] **4 íconos 3D** de features (resúmenes, retos, simulacros, progreso).
- [ ] **Ícono candado** (padres).
- ~~Avatares de prueba social~~ → **descartada, no hace falta ningún asset** (ver 12.2 / 12.5-a).

**⚠️ Al recibirlos: exportar/redimensionar a ~3× su tamaño de display** (regla de peso de §10.3),
NUNCA a 1254px. Los assets actuales pesan 1.2 MB en total; no romper eso.

**12.5-a · RESUELTO (2026-07-14):** la prueba social **se saca del todo**. El usuario fue tajante: "en
ningún lugar dirá eso". Nada de "miles de estudiantes", ni avatares, ni una versión suavizada. Además
dejó la regla general: **los mockups son referencia de COMPOSICIÓN; el texto lo ponemos nosotros.**

## 12.7 ✅ CONSTRUIDA (2026-07-14) — verificada en LOCAL, falta el OK del usuario

**Decisión estructural (la duda de "¿3 pantallas o 1?"): UNA sola que se scrollea.** La respuesta
estaba en la propia lámina: el **principio 10** define el recorrido `Chispa → Valor → CTA → Pasos →
Padres`, que es UNA secuencia — si fueran 3 pantallas no habría un recorrido que validar, habría tres.
Además **un carrusel de 3 pisaría el onboarding de 5 pasos que ya existe** (F4, cuentas nativas), y
forzar a un niño a pasar 3 pantallas antes de entrar es maltratarlo.
**Reparto de audiencia:** arriba (hero + CTA) = el niño, que toca y entra sin enterarse de que hay más
abajo. Abajo (Pasos + Beneficios) = el adulto/colegio que evalúa (F7). Cada uno agarra lo suyo del
mismo scroll. **"Para los padres" va UNA vez, al final** (en los mockups se repetía por ser el mismo
componente dibujado en cada frame).

**El kit del usuario** está en `aula-cam-estetica-local/assets/onboarding-2.0/` (con su
`ASSET_INVENTORY.md`: capas, tamaños de display sugeridos y reglas de producción). **Importado y
optimizado a `aula-cam/assets/onboarding/`.**

### ★ Peso: 8.5 MB → 350 KB (regla §10.3 aplicada)
El kit crudo pesaba **8578 KB** (badges de 650px para mostrarse a 50px). Se redimensionó cada asset a
**~3× su display** (según el inventario) y se convirtió a **WebP**: PNG habría quedado en 3.2 MB,
**WebP quedó en 301 KB** (+ SVGs = 350 KB). Script reutilizable: `scratchpad/opt_assets.py`.
**PIL 12.2 está disponible** (`python -c "from PIL import Image"`) — no hace falta ImageMagick.
`avatares-estudiantes.png` **NO se importó** (iba con la prueba social descartada).
Se borró `assets/hero/chispa-bienvenida.png`, huérfano al caer la landing anterior.

### Cómo quedó (clases `lx*` en `estilos.css`, markup en `index.html`)
- **HERO:** `.lxHero` sangra rompiendo el padding del body (`margin:… -16px`) — **se evita `100vw`
  a propósito** (provoca scroll horizontal por la barra del navegador). Dos capas reales: el fondo
  `aula-fondo.webp` (`center bottom/cover`) y `chispa-laptop.webp` encima. **El fondo deja la pared
  vacía arriba a propósito → ahí va el texto; el piso abajo → ahí se apoya Chispa.**
- **Texto a la IZQUIERDA** (como el mockup). Centrado lo volvía un póster.
- **CTA** único, morado, con flecha en círculo; se monta sobre la escena (capas, no cajas).
- **Paso 3:** Chispa + lista como dos capas. ⚠️ La pose es **VERTICAL (715×1178)**: metida en una caja
  horizontal con `contain` quedaba diminuta → **manda la altura** (`height:104%`), el ancho sale solo.
  Asoma fuera de la tarjeta y eso suma.
- **Beneficios:** `chispa-brazos` con las 4 insignias en `position:absolute` alrededor, sin tarjeta.
- **Padres:** `<details>` neutro con candado + chevron que gira. Conserva el texto legal que ya existía.

### Verificado en LOCAL (index.html real, no el demo)
360px y 414px: **hero a sangre (360/360), CERO scroll horizontal, el CTA se ve sin scrollear**
(614 de 780), `#btnEntrarLanding` → login → volver OK, **cero errores de consola**. sw → **v79**.

### Falta
- [ ] **OK del usuario** → recién ahí push (auto-deploy a producción).
- [ ] **Decisión pendiente: qué hace "Para los padres" al tocarlo.** Hoy despliega el texto legal (lo
      que ya hacía). Se preguntó y quedó sin responder. Alternativa: llevar a `chispa-familia`.
- [ ] El `#lab`, el onboarding de 5 pasos y el login siguen sin migrar.

## 12.6 Estado del código al cerrar el chat anterior (histórico)
- La landing en `index.html` (`.h3Bienvenida`) es la **2ª versión (superada)**: Chispa brazos-abiertos
  centrada sobre glow + CTA + `.h3Steps` + padres colapsado. **Se va a reemplazar** por 12.2 cuando
  lleguen los assets. El CSS vive en `estilos.css` (buscar `.h3Bienvenida`).
- `assets/hero/chispa-bienvenida.png` = pose 02 a 510px (135 KB). Se puede reusar o descartar.
- El `#btnEntrarLanding` NO se puede renombrar (lo cablea `app.js`).

---

# 📚 13. MATERIAS 2.0 (2026-07-14) — hecho en LOCAL, falta aprobar y falta el pane de temas

## 13.1 El diagnóstico (por qué se rehízo, no se recoloreó)
`#paneMaterias` era **el mismo pecado del Inicio viejo: cajas apiladas.** Tres `.destacada` idénticas
(Adelántate / Cumbre / Repasar errores) **arriba**, empujando abajo del fold las materias —que son el
motivo de la pantalla—; emojis como iconografía (🚀🏔️🩹📚); sombras rosadas (`rgba(90,40,70,…)`) que ya
no existen en el sistema; y los nombres **GRITANDO EN MAYÚSCULAS** (`limpiaNombreMateria` las devuelve
así y la grilla no pasaba por `capMateria`). Encima la Home ya tenía su lista 2.0 (`.h2SubjectCard`) →
**dos sistemas visuales para lo mismo.**

## 13.2 Lo que se hizo (jerarquía invertida)
`título → recordatorio (si hay) → GRILLA → invitación (Cumbre) al final`
- **Encabezado propio:** `.m2Title` "Tus materias" protagonista + `.m2Sub` con un dato real y tranquilo
  ("7 materias · 5 empezadas", de `resumenMaterias()`), sin badges compitiendo.
- **La `.topbar` VIEJA se oculta en Materias** (`body.materias-v2-page .topbar{display:none}`, gate nuevo
  en `verTab`, app.js). Traía el saludo del Inicio ("¡Hola, Martina! 👋" + 🎓 grado + 🔥 racha + Salir) y
  **competía con el título de la pantalla**. **Salir sigue estando en el Inicio** (`#btnSalirHome`).
  ⚠️ **Agenda y Amigos NO están migradas → conservan la topbar.** Al migrarlas, sumarles su gate.
- **Grilla `.m2Grid` de 2 columnas** (3 desde 560px) = el protagonista. Misma LENGUA que la Home (placa
  tintada por `--c`, Fredoka, sombra difusa) pero **otro RITMO a propósito**: la Home es una tira que se
  desliza, acá es grilla. **No clonar composiciones.** Nombres por fin con `capMateria()`.
- **Recordatorio de errores** = `.m2Row--coral`, fila ligera (coral = recordatorio amable), no caja.
- **Cumbre** = `.m2Cumbre`, **lo único grande y va al FINAL** (ritmo grande/chico del principio 8).
- **Emojis fuera:** SVG stroke para volver/errores/adelantarse/+; `🆕` → pill `.m2New` "Nuevo".
- **Camino B:** `.m2Card--nueva` (hueco punteado). El emoji de materia manual **se conserva** — es
  elección del niño y vive en la BD, no es iconografía nuestra.

## 13.3 ★ BUG DE PRODUCCIÓN ARREGLADO (no era mío, está LIVE hoy)
En el pane de temas, `#tituloMateria` reusa `homeMarcaMateria(nombre,"em")`, pero **`.em` solo tenía
tamaño dentro de `.mat`** → la placa quedaba sin medida y **el PNG se disparaba a ~180px**. Ahora
`#tituloMateria>.em` tiene su placa de 44px tintada. De paso salió el `style="color:var(--mango)"`
inline del HTML (y con él el `!important` que lo peleaba). **Lección: `.h2SubjectVisual`/`.em` NO se
autodimensionan — quien las use DEBE darles tamaño.**

## 13.4 Verificado (LOCAL, demo-inicio.html a 375px)
Grilla 2 col sin scroll horizontal · nav no tapa el final · entrar a materia OK (8 chips, título bien) ·
fila coral OK · Cumbre OK · **cero errores de consola** · `node --check app.js` OK.

## 13.5 FALTA
- [ ] **OK del usuario en su teléfono** → recién ahí commitear/desplegar (subir `VERSION` de `sw.js`).
- [ ] **La 2ª mitad: `#paneTemas`** — siguen viejos los chips/lapsos (`.chip`, `.lapso`), los modos
      (`.modo`, `.pmNum` con `--sun`), `#pasoCantidad` (`.count`, teal viejo), `#pasoFotos` (`.addFoto`),
      `.acciones` (`.go.guia` con teal literal `#34C6A6`) y `.accInfo`. La referencia de §5 es la **ruta
      de aprendizaje Aprende→Practica→Quiz→Examen** con stepper y pills de estado.
- [ ] Clases viejas que quedaron SIN USO al migrar (no se borraron por seguridad; barrer cuando Agenda/
      Amigos/Cumbre estén migradas): `.destacada`+`.dIcon/.dTxt/.dArrow`, `.repasar`, `.cumEyebrow`,
      `.grid`, `.mat`+`.em/.matMid/.nom/.matBar/.chev`, `.matHint`, `.nuevoBadge`, `.proxTag`.
- [ ] `iconMateria()` (app.js ~2642) sigue muerto (mapa de ~40 emojis).
