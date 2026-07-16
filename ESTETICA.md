# ESTÉTICA CHISPA — guía única para Claude

> **Este es el ÚNICO documento de estética que Claude lee y mantiene.** Reemplaza a
> `ESTETICA-CHISPA-2.0.md` (borrado: era un diario de sesión de 838 líneas, imposible de usar).
>
> **La carpeta `aula-cam-estetica-local/` es de Codex. Claude NO entra ahí** salvo que el usuario
> se lo pida explícitamente, y solo para buscar assets.
>
> Dos partes: **A = cómo se diseña** (el protocolo) · **B = qué existe** (el sistema real).
> El protocolo sin el inventario no sirve: se puede cumplir las 18 secciones y aun así inventar un
> componente que ya estaba hecho. Eso pasó el 2026-07-16 y es el origen de este doc.

---

# PARTE A — PROTOCOLO DE DISEÑO

## Objetivo

Cuando se pida "actualizar una pantalla a la estética de Chispa", **no basta con cambiar colores,
fuentes, sombras, radios o iconos**. Hay que rediseñar la experiencia: jerarquía, composición,
agrupación, densidad, recorrido visual, acciones, estados y responsive.

El resultado debe sentirse como un **producto infantil premium**. No debe parecer un panel
administrativo, un formulario de sistema, una plantilla, una colección de componentes, una página de
WordPress, ni una interfaz infantil hecha acumulando colores y dibujos.

## 1. Antes de diseñar

Responder, antes de escribir código:

1. ¿Cuál es el objetivo de esta pantalla?
2. ¿Qué debe ver primero el niño?
3. ¿Qué acción debe realizar?
4. ¿Qué es secundario?
5. ¿Qué puede ocultarse hasta que se pida?
6. ¿Qué datos pertenecen al mismo grupo?
7. ¿Qué genera ruido o repetición hoy?

**No empezar eligiendo componentes. Empezar ordenando la información.**

## 2. Regla de los cinco segundos

En 5 segundos el usuario entiende dónde está, qué contiene la pantalla, qué puede hacer y cuál es el
siguiente paso. **Si todo pesa parecido, el diseño falló.**

## 3. Jerarquía obligatoria

Contexto/título → información principal → acción principal → contenido cotidiano → información
secundaria → gestión/configuración.

Las acciones destructivas o administrativas **nunca compiten con el contenido**. Van en menú
contextual, gesto, modo edición o detalle.

## 4. Una pantalla no es una colección de componentes

No convertir cada dato en chip/tarjeta/badge/botón/cápsula. Un componente expresa una **relación
real**. Máximo: un nivel principal de tarjetas, un segundo solo si es claramente interactivo, **nunca
tarjeta dentro de tarjeta dentro de tarjeta**. El espacio, la alineación y la tipografía también
organizan: no todo necesita caja.

## 5. Prohibido la "sopa de chips"

Chips **solo** para: estado breve, filtro seleccionado, categoría compacta, fecha excepcional,
selección múltiple real.

**Nunca** para: nombres de materias, promedios, frases, fechas de todas las filas, acciones
repetidas, o rellenar. Máximo **un estado compacto por elemento**; el resto va como texto secundario
bien alineado.

## 6. Las listas se diseñan como listas

Filas consistentes, columnas visuales, divisores mínimos, ritmo vertical regular, escaneables.
Cada fila: identificador visual + título + **uno o dos datos secundarios como máximo** + un estado o
acción contextual. **No repetir un botón grande en todas las filas.** Si la fila abre un detalle, la
fila entera es la superficie, con un indicador discreto.

## 7. Diseñar densidad, no achicar

Mucha información pide **edición**, no miniaturización: resumir, agrupar, priorizar, limitar lo
visible, permitir expandir, mover lo secundario al detalle. La primera vista facilita decisiones; el
detalle da profundidad.

## 8. Una sola acción dominante

Por pantalla o bloque. Las demás: textuales, discretas, contextuales, reveladas progresivamente.

## 9. Uso correcto de los assets

Los assets **no son decoración para llenar**. Identifican una materia, introducen una sección,
explican una acción, acompañan un estado o refuerzan un momento.

Los **3D** se reservan para encabezados de sección, materias, momentos destacados y estados
importantes. Los controles funcionales pequeños usan iconografía de línea. **No mezclar emojis de
sistema con 3D y línea. No repetir el mismo objeto para conceptos distintos. No poner íconos grandes
en todas las filas.**

## 10. Uso de Chispa

Es una compañera, no decoración. Aparece cuando recibe, explica, acompaña una decisión, espera,
anima, celebra o ayuda. **Una sola por vista.** Integrada en la composición, **nunca sticker
flotante**.

## 11. Personalidad sin saturación

La personalidad sale de composición amable, objetos 3D bien elegidos, movimiento sutil, formas
redondeadas, mensajes cercanos, fondos atmosféricos y detalles con intención. **La belleza está en la
edición, no en la acumulación.**

## 12. Espacio y ritmo

Ritmo vertical reconocible. Más separación entre secciones que dentro de una sección. Alinear
títulos, bordes, acciones, íconos y contenido. Nada de márgenes arbitrarios "para que quepa" ni
huecos accidentales.

## 13. Estados y acciones destructivas

Diseñar explícitamente: normal, vacío, carga, error, contenido largo, muchos elementos, completado,
modo edición.

Las destructivas no van visibles permanentemente en cada dato. **Nunca una "X" ambigua** para borrar
algo importante: acción comprensible + confirmación + cancelar.

## 14. Adaptación — móvil Y ESCRITORIO

Comprobar **360, 390 y 430 px**… **y 1600 px**.

> ★ El ancho de PC NO es opcional. El usuario prueba con la ventana **maximizada**. El 2026-07-16 se
> entregó una Agenda verificada solo a 375px: en PC el botón `+` se montaba sobre el libro y el fondo
> se veía blanco. Verificar donde el usuario mira, no donde es cómodo.

Requisitos: nada se sale, nada se corta, cero scroll horizontal, áreas táctiles ≥44px, la navegación
no cubre contenido, el teclado no tapa campos, los textos largos reorganizan.

## 15. Pantallas con datos

No deben parecer una hoja de cálculo decorada. Primero una **lectura resumida**; después el detalle
en filas ordenadas; una sola representación por estado; abrir para profundizar; lo secundario oculto
hasta que se pida.

## 16. Proceso obligatorio

1. **Auditar** — datos, acciones, estados, repeticiones, qué debe conservar funcionalidad.
2. **Definir jerarquía** — escribir el orden de lectura ANTES del código.
3. **Reducir** — sacar de la vista inicial todo lo que pueda venir después.
4. **Esquema** — superficies simples, alineación y espacio. **Todavía sin assets.**
5. **Componentes** — decidir qué dato necesita tarjeta/fila/chip/badge/botón, y justificarlo.
6. **Identidad** — recién acá los assets, solo donde aporten significado.
7. **Estados** — vacío, carga, error, mucho contenido, textos largos.
8. **Recorrido** — prueba de 5 segundos.
9. **Responsive** — los 3 anchos móviles + PC.
10. **Pulir** — ritmo, alineación, densidad. "Funciona" no es "terminado".

## 17. Criterios automáticos de rechazo

Si aparece cualquiera de estos, **se rehace**:

- filas completas de chips · un chip para cada dato
- botones repetidos en todas las filas · varias acciones dominantes
- "X" destructivas permanentes
- emojis como iconografía final (ver excepción abajo) · assets 3D sin función
- tarjetas anidadas innecesarias · demasiados bordes · todo con el mismo peso
- información técnica antes que la útil · mascota de relleno
- navegación cubriendo contenido · textos o tarjetas cortados
- huecos vacíos accidentales · consistente en un solo ancho
- **cambio superficial de colores sin reorganización real**

> **Excepción de emojis (acordada 2026-07-16):** se permiten como **provisional** SI están marcados
> con comentario en el código Y hay un pedido de asset abierto. Se cambian apenas llega el archivo.
> Sin esto, la pantalla se congela esperando dibujos.

## 18. Lista de control final

**Claude corre esta lista y muestra el resultado ANTES de decir "listo". Si no puede marcarlas, no
está listo.** No es decorativa: el 2026-07-16 se entregaron tres pantallas que la violaban.

- [ ] El objetivo se entiende en 5 segundos
- [ ] Hay jerarquía evidente
- [ ] Una sola acción dominante
- [ ] Chips solo donde corresponde
- [ ] Las listas se escanean rápido
- [ ] Las acciones destructivas están protegidas
- [ ] Los assets tienen función concreta
- [ ] Chispa solo si aporta
- [ ] Emojis: ninguno, o provisionales marcados con pedido abierto
- [ ] Sin tarjetas ni bordes innecesarios
- [ ] La navegación no cubre contenido
- [ ] Funciona con poco y con mucho contenido
- [ ] Funciona en 360 / 390 / 430 **y 1600**
- [ ] Sin scroll horizontal
- [ ] Se siente diseñada como experiencia, no ensamblada con componentes

## Regla final

No preguntar *"¿usa la estética de Chispa?"* sino:

> **"¿Esta pantalla podría pertenecer a un producto educativo de primer nivel incluso si
> temporalmente retiráramos los colores, la mascota y los iconos?"**

Si la respuesta es no, la estructura todavía no está bien.

---

# PARTE B — EL SISTEMA REAL (qué existe hoy)

> Esto es el inventario de lo que YA está construido y aprobado. **Antes de crear un componente,
> buscar acá.** El 2026-07-16 se construyó el boletín de notas bueno y dos horas después se entregó
> una lista de chips crudos a diez centímetros: el patrón existía y no se aplicó.

## B.1 Colores — CONGELADOS

**Decisión del usuario (2026-07-16): los colores que se usan hoy se quedan. No se modifican.**
Si trae una idea o un mockup con otro color, ahí se evalúa. Hasta entonces, **no proponer paletas**.

Fuente de verdad: el `:root` de `estilos.css`. Los únicos válidos son los `--chispa-*`:

| Token | Hex | Uso |
|---|---|---|
| `--chispa-primary` | `#6753E8` | morado de marca: nav activo, CTA, misión, énfasis |
| `--chispa-primary-deep` | `#4933C8` | presionado |
| `--chispa-primary-soft` | `#F0EDFF` | fondos tintados suaves |
| `--chispa-turquoise` | `#23BFAE` | informativo / progreso |
| `--chispa-coral` | `#FF795F` | atención, error, vencido — **nunca rojo duro, es una niña** |
| `--chispa-green` | `#2DBE72` | éxito, nota buena |
| `--chispa-yellow` | `#F3B51B` | energía, logros, nota media |
| `--chispa-ink` | `#211B3A` | texto principal |
| `--chispa-muted` | `#77718F` | texto secundario |
| `--chispa-line` | `#ECEAF5` | divisores sutiles |
| `--chispa-surface` | `#FFFFFF` | tarjetas |

**Tokens viejos (`--mango`, `--grape`, `--teal`, `--ink`…) APUNTAN a los `--chispa-*`.** No se
borran: las pantallas sin migrar comparten esas primitivas. **Para componentes nuevos, usar
`--chispa-*` directo.**

⚠️ **Los tokens `--flame`, `--dusk`, `--spark`, `--calm`, `--leaf`, `--paper` NO EXISTEN.** Aparecen
en los docs de Codex como propuesta que nunca se implementó (0 usos en el repo, verificado
2026-07-16). **No usarlos ni citarlos.**

**Colores por materia:** salen de `homeMateriaVisual()` en `app.js`. Es la fuente única — devuelve
`{key, color, img}`. No hardcodear colores de materia en ningún lado.

## B.2 Tipografía, sombras, radios

- **Fredoka** 600 → títulos, números protagonistas, nombres. **Nunito** 700/800/900 → cuerpo y datos.
- Sombras: `--shadow`, `--shadow-sm`, `--shadow-xs`, `--shadow-card`. **Difusas y tenues, nunca duras.**
- Radios: tarjeta grande 23-26px · media 14-20px · pastilla 999px.

## B.3 Componentes que YA existen (usarlos, no reinventarlos)

| Qué | Clase | Dónde vive | Para qué |
|---|---|---|---|
| Placa de ícono de materia | `.h2SubjectMark` / `.nbMark` / `.agTipo` | Inicio, boletín, Agenda | cuadrado tintado con el color de la materia + PNG 3D. **Se dimensiona desde afuera** (no se autodimensiona) |
| Fila de tarea | `.h2TodayRow` (Inicio) · `.agTarea` (Agenda) | — | placa + título Fredoka + "Materia · cuándo" + check circular |
| Check circular | `.h2TaskCheck` / `.h2TaskBox` | Inicio, Agenda | marcar hecho |
| Tarjeta blanca | `.h2Today`, `.nbCard`, `.agCard`, `.h3MoreCard` | todas | superficie base |
| Encabezado de sección | `.h2SectionHead` + `h2` + `.h2TextAction` | Inicio | título + link a la derecha |
| **Pie colapsable** | `.nbToggle` + `.nbExtra`/`.agExtra` + clase `nb-todo`/`ag-todo` | boletín, Agenda | **lista continua + pie "Ver N más" AL FINAL.** Nunca `<details>` para esto: obliga a poner el botón encima de lo oculto y parte el bloque en dos |
| Chip con punto de color | `.h3Chip` (`--tone`) | horario, "Mañana toca" | solo estados/categorías compactas |
| Control segmentado | `.agSeg` + `.chip[aria-pressed]` | formulario de tarea | opciones **excluyentes** (tipo) |
| **Selector de materia** | `montarSelectorMateria()` en `app.js` → `.selMat*` + `.selMatTile` | formularios de tarea y nota (Agenda) | toggle compacto ("Elegir materia") que abre una **GRILLA de fichas de materia** (ícono 3D + color + nombre, como Materias 2.0): 2 col móvil / 3 col ≥560px. Elige UNA; la elegida rellena con su color. **Nunca chips para nombres de materia** (§5). Fuente única: `homeMateriaVisual()` |
| Barra de progreso | `.nbBar` / `.h2SubjectBar` / `.h3AcademicBar` | boletín, materias | `--subject` de relleno |
| Semáforo de nota | `.nb-buena` / `.nb-media` / `.nb-floja` → `--nb` | boletín, Agenda | verde ≥16 · ámbar ≥14 · coral <14 |
| Formulario | `.agForm` (+ `.agLbl`, `.field`, `.acciones`) | Agenda | panel lavanda, campos sin borde duro, foco morado |
| Menú de cuenta | `.h3AccountMenu` + `.h3AccountPopover` | Inicio | acciones de cuenta (Salir, Familia) |
| Alertas | `errBox()` / `avisoBox()` en `app.js` | global | blanco + placa tintada + SVG. **Cero emojis** |

**Canvas de página:** `body.home-v2-page` (Inicio, casi blanco — **congelado**) y
`body.agenda-v2-page` (Agenda, wash cálido→azul, más presente porque en PC el casi-blanco lee como
blanco). Las pantallas sin migrar usan el `body` base viejo.

⚠️ **Los tokens `--h2-*` están scoped a `#tabInicio.homeV2, #tabAgenda.agendaV2`.** Una pantalla
nueva que use `var(--h2-line)` fuera de ese scope **cae a currentColor = tinta** → bordes negros.
Pasó en la Agenda el 2026-07-16. Agregar el selector al scope o usar `--chispa-*` directo.

## B.4 Assets

- `assets/hero/` — Chispa + mano + libro del Inicio (**congelado**, ver B.6)
- `assets/materias/` — 15 íconos 3D de materia. Cambiar un PNG lo cambia en toda la app
- `assets/stats/` — racha, energía, metas
- `assets/onboarding/` — kit de la landing
- `assets/agenda/` — libro, tareas, notas-examenes, horario, tipo-tarea/trabajo/examen
- `assets/chispa-3d/` (en la carpeta de Codex) — 20 poses. **Una pose por momento, nunca repetir**

**Regla de peso (§10.3 histórica, vigente):** todo asset se exporta a **~3× su tamaño de display**,
**NUNCA a 1254px**. Los kits crudos vienen a 1254×1254 con ~50% de padding transparente. Receta:
recortar al contenido (`getbbox`) → cuadrar si va en placa → resize a 3× display → **WebP**
(le gana al PNG por ~6×). Script: `scratchpad/opt_agenda.py`. **PIL está disponible**, no hace falta
ImageMagick. Referencia real: 4.9 MB → 64 KB en la Agenda.

## B.5 Reglas duras (cada una se pagó con una sesión)

0. **★ Migrar una pantalla = envoltorio + INTERIORES.** No está migrada hasta que sus FILAS,
   FORMULARIOS y ESTADOS lo estén. El 2026-07-16 se entregó la Agenda con encabezado y tarjetas
   2.0 pero las listas crudas adentro (chips de promedio, fechas `2026-07-14`, emoji de bíceps) y
   se dijo "listo, falta la 2ª mitad". No es media pantalla: es una pantalla mal entregada.
   Avisar del defecto en el mensaje no lo convierte en aceptable.
1. **La escena va A SANGRE, sin tarjeta.** Envolver a Chispa o al libro en una caja blanca los
   vuelve sticker. Es el error de las 2 landings malas.
2. **Cero emojis** como iconografía final (excepción provisional en §17).
3. **Verificar en PC maximizado**, no solo a 375px.
4. **`?v=NN` de `index.html` apareado con el `const V` de `sw.js`. Subir los DOS juntos.** Sin eso,
   la 1ª apertura tras un deploy mezcla index nuevo + app.js viejo y **la app no abre**.
5. **Nunca `<details>` para "ver más" de una lista** (parte el bloque en dos). Sí para desplegar el
   detalle de UN elemento.
6. **Medir el efecto observable, no la propiedad CSS.** `getComputedStyle` miente con propiedades en
   transición y dentro de `<details>` cerrado. ¿Se despliega? → el alto de la FILA.
7. **El mockup es una GUÍA, no una plantilla.** No copiar medidas: tomar la intención. Medir sus
   píxeles es señal de que se está replicando en vez de diseñar. La IA que lo dibuja tampoco es
   exacta: exagera tamaños, trata una tarjeta como si fuera una pantalla entera, inventa fondos.
8. **★ Antes de descartar algo del mockup por "decorativo", buscarle el significado.** El usuario
   dibuja INTENCIÓN, no adorno. Los puntos de color de los días se descartaron por "no significan
   nada"; él los pidió igual y tenía razón — le daban a la fila un ancla que se lee antes que el
   texto. La salida buena no era ponerlos porque sí ni sacarlos: fue **darles significado** (el
   color de la materia con la que arranca el día). Preguntarse "¿qué PODRÍA significar?" antes de
   "no significa nada".
9. **Mirar el material que el usuario YA creó** antes de decidir (inventarios, mockups, assets).
10. Las decisiones **congeladas** no se tocan sin pedido explícito (B.6).

## B.6 Congelado — no tocar sin pedido explícito

- **Hero del Inicio** (`assets/hero/` + valores CSS): costó una sesión entera, lo ajustó el usuario
  con `tuner.html`.
- **Login**: el formulario vive DENTRO de la pantalla de la laptop. `--lap-y` es una **fórmula**
  (`calc(17px - 13.67svh)`), **jamás px por breakpoint**. La vista de PC (≥560px) tiene perillas
  propias. Ajustar solo con `tuner-login.html`, **abierto maximizado**.
- **Canvas del Inicio**: "casi blanco" por decisión del usuario.
- **Paleta**: B.1.

## B.6-b ★ Cómo trabajamos (el flujo que funcionó, 2026-07-16)

En un mismo día se entregaron cinco pantallas malas y una buena. La buena (Mi horario) salió **a la
primera**. La diferencia NO fue que el usuario diera más instrucciones — fue el FORMATO:

**Los 3 insumos que hacen que salga bien:**
1. **Un paso a paso escrito** — qué está mal hoy y cómo lo rediseñaría él, en prosa.
2. **Un mockup como GUÍA visual** — la intención, no la plantilla.
3. **Las aclaraciones de qué NO copiar** — "sigue siendo una tarjeta, no una pantalla" · "los
   íconos no tan grandes" · "no necesita fondo propio" · "la IA que lo dibuja no es exacta".

**Qué hace Claude con eso:**
- El paso a paso **manda** sobre el mockup cuando se contradicen (el mockup exagera).
- **No medir el mockup.** Tomar la intención. Si aparece un `getpixel` sobre un mockup, algo va mal.
- Apartarse de él **está permitido y se agradece** — pero se declara y se justifica en el mensaje.
  Ejemplos que el usuario aceptó: sacar "Ver semana completa" (reintroduce la pantalla
  interminable), no poner "Primera materia" (sería un dato falso).
- **Traer decisiones, no opciones.** "Ya ni sé qué hacer porque o te digo literalmente qué hacer o
  lo hacés mal" es el peor lugar al que se puede llegar. Preguntar de nuevo lo ya autorizado es
  parte de eso.
- **Correr la §18 y mostrarla** antes de decir "listo", incluida la casilla que NO se puede marcar.

**Y lo que NO cuesta y da miedo por mi culpa:** borrar un `.md`, reordenar docs, limpiar CSS muerto.
Todo eso es git y es reversible. Lo caro nunca fue eso: fue entregar y que lo descubra él.

## B.7 Estado por pantalla

| Pantalla | Estado |
|---|---|
| Landing | ✅ 2.0 — aprobada ("quedó de 10") |
| Login | ✅ 2.0 — aprobado, congelado |
| Inicio | ✅ 2.0 — orden por jerarquía + boletín de notas |
| Agenda | ✅ 2.0 **completa** — encabezado, semana, tareas, notas, horario, formularios y editor |
| Materias | 🟡 mitad: la grilla sí, **`#paneTemas` no** |
| `#vPendiente` | ❌ vieja |
| Amigos / Muro | ❌ vieja |
| Cumbre | ❌ vieja |
| Onboarding 5 pasos | ❌ vieja (solo cuentas nativas, ver Chispa Universal — en pausa) |
| `#lab` | ❌ vieja (admin, no lo ven niñas) |

## B.8 Deuda conocida (violaciones vivas de la Parte A)

Detectadas al correr la §17 contra producción. **Se resuelven cuando toque cada pantalla; anotarlas
no las perdona.**

- **"X" de borrar permanente** en cada fila de tarea y de nota de la Agenda (`.agBorrar`) → viola
  §13 y §17. El horario ya lo resolvió bien: las acciones destructivas viven en el modo edición, no
  en la lectura. Las tareas y notas deberían seguir el mismo camino.
- **Ícono 3D en todas las filas** de tarea (`.agTipo`) → tensiona §9 (los 3D son para encabezados y
  momentos, no para cada fila). El usuario los pidió y funcionan; queda anotado, no es urgente.
- Barra de stats del Inicio: "días de racha" roza el divisor entre 375 y 387px (cosmético; hueco
  entre el `@media max-width:374` y el ancho donde ya entra solo).
- ~~Chips para nombres de materia en el horario~~ → resuelto: ahora son filas.
- ~~Chips para nombres de materia en los selectores de tarea/nota~~ → resuelto 2026-07-16: grilla
  de fichas de materia (`.selMatTile`, ícono 3D + color), 2 col móvil / 3 col PC.
- ~~Editor de horario sin migrar~~ → resuelto: hoja aparte.

## B.9 Herramientas

- `demo-inicio.html` — la app con datos mockeados, sin backend. Dos obligaciones:
  1. **Mantenerlo SIEMPRE en sync con `index.html`**: si miente, el preview no sirve (y `app.js`
     revienta por ids que no existen).
  2. **★ Sus datos deben ejercitar los estados REALES, no los cómodos.** Los mocks alegres esconden
     bugs. Cada estado que se agregó al demo cazó uno de verdad el mismo día: una nota sin fecha
     (la tarea que desaparecía del Inicio), una nota vieja (decía "Venció" porque se reusó
     `fechaBonita`, que es para tareas), una materia PROPIA (Caligrafía → no se practica), un día
     sin clases, un nombre largo. **Antes de dar por buena una pantalla: ¿el demo tiene el caso
     feo?** Si el usuario lo encuentra usando la app y el demo no lo tenía, el demo estaba mal.
- `tuner.html` / `tuner-login.html` — paneles con sliders sobre el render real. **Darle el panel al
  usuario en vez de adivinar por él** — es lo que funcionó con el hero y el login.
- `chispa-viewing.bat` — sirve en LAN para probar en el celular.
- El pane del navegador de Claude se degrada: los screenshots se cuelgan y las transiciones CSS no
  asientan. Verificar apagando transiciones y midiendo geometría. **El ojo del usuario es el juez.**
