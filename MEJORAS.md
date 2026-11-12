# Chispa — lista definitiva de mejoras

Escrita el 2026-11-11 tras revisar toda la app (pantallas en tamaño teléfono + código + datos reales).
Es la lista aprobada por el dueño. Los puntos hechos llevan ✅ en su título. El orden es el aprobado: no
reordenar según cuánto se haya usado cada función — si algo se usa poco es justamente porque le falta
lo que aquí se propone.

Los números de línea son de `app.js` al commit `274fd63`; se mueven, buscar por nombre de función.

## Reglas del proyecto (leer antes de tocar nada)

- `git push` a `main` = producción (Vercel). Probar antes en el demo: `node herramientas/demo-servidor.mjs`
  → http://localhost:4321 (datos ficticios, IA simulada). Con `PROXY_API=1 PORT=4322` usa datos reales,
  pero la sesión la inicia el dueño, nunca el asistente.
- Al cambiar `app.js`, `estilos.css` o `index.html`: subir juntos `V` en `sw.js` y los `?v=` de
  `index.html` (hoy 123). Hacerlo con Node, no con PowerShell (rompe los acentos).
- `app.js`, `estilos.css` y `familia.html` usan CRLF: un reemplazo por script debe normalizar a `\n`
  y restaurar.
- Familia: subir `VERSION` en `familia-sw.js` (hoy `familia-v20`) y `FAMILIA_V` en `familia.js` (hoy `v16`).
- Vercel Hobby: máximo 12 funciones en `api/`. Hoy hay 11. Lo nuevo va como `accion` de un endpoint
  existente o en `herramientas/*.mjs`.
- Supabase: el dueño corre el SQL a mano. Entregar el SQL listo para pegar. Los `delete` siempre por
  id o por usuario, nunca tablas enteras.
- IA: solo DeepSeek (`deepseek-flash`). No empeorar lo que genera: cualquier cambio de prompt se prueba
  contra la IA real antes de publicar y sube `PROMPT_VER` en `api/generar.js`.
- Tiempo de la IA (2026-11-12): `api/generar.js` tiene 120 s (vercel.json), plazo interno 110 s y max_tokens 20000. Los temas difíciles tardan 70-85 s con razonamiento completo. Si aun así la respuesta vuelve vacía, el segundo intento usa `reasoning_effort: "low"` y el tema queda anotado 30 días (fila `esfuerzo-…` en cache_generaciones). No bajar esos límites.
- La clave de DeepSeek nunca va al repositorio (vive en Vercel, `DEEPSEEK_API_KEY`).
- Textos de la app en español neutro, de tú (no voseo), sin emojis nuevos en alertas.
- Usuarias: 118 = Martina (5to grado), 211 = Alessandra (1er año).

---

## A. Las cinco primeras

### 1. La sesión vencida no debe sacarlas de la app — ✅ HECHO 2026-11-12
El aula del colegio invalida el token de Moodle cada pocos días. Hoy `refrescarMaterias()` (~1724)
recibe 401 de `api/moodle.js` (~205) y llama a `sesionVencida()` (~1716), que borra todo y manda al login.
No hace falta: la firma de Chispa (`herramientas/sesion.mjs`) dura 365 días y es independiente; agenda,
progreso, errores y notas funcionan con ella, y `SESION.materias` ya está guardado.

- Ante un 401 del aula: conservar la sesión, marcar `SESION.aulaDesconectada = true` y seguir con las
  materias guardadas.
- Mostrar un aviso discreto en Inicio y Materias: "Reconecta tu aula para ver material nuevo", con un
  botón que abre el login (la niña escribe su clave; al entrar se quita el aviso).
- Generar sigue funcionando sin token (`api/generar.js` solo lo usa para bajar los PDF; sin ellos trabaja
  con el texto del tema). Verificar que no rompe.
- Solo se cierra la sesión de verdad si el acceso está pausado (`d.pendiente`) o si la firma de Chispa
  ya no vale.

Listo cuando: con un token inválido la app abre, muestra agenda y materias, deja hacer un quiz y enseña
el aviso de reconexión.

### 2. Recordatorios al teléfono — ✅ HECHO 2026-11-12
La app nunca avisa nada (no hay código de notificaciones en `app.js` ni `sw.js`).

- Notificaciones web push: pedir permiso en un momento con sentido (al anotar un examen o tras terminar
  una actividad), guardar la suscripción en una tabla nueva (`push_suscripciones`: usuario_id, endpoint,
  claves, creado), manejar `push` y `notificationclick` en `sw.js`.
- Envío con un cron diario de Vercel (Hobby permite uno al día) alrededor de las 4:30 pm de Caracas,
  como `accion` de un endpoint existente. Claves VAPID en variables de Vercel.
- Un solo aviso al día, el más importante: examen mañana o en 2 días → tarea para mañana → tareas
  vencidas → "hoy no has estudiado". Al tocarlo abre el tema o la tarea, no solo la app.
- iPhone solo recibe avisos si la app está instalada en la pantalla de inicio (iOS 16.4+): explicarlo
  en la pantalla donde se activa.
- Interruptor para apagarlos en el menú ⋮.

### 3. "Practica" y "Examen" tienen que pedir algo — ✅ HECHO 2026-11-12 (etapas 1 y 2: autoevaluación + escribir el resultado)
`renderRetos()` (~2927) y `renderExamen()` (~2954) solo tienen "Ver respuesta": se puede tocar todo en
segundos y el tema cuenta como practicado al revelar la primera.

- Después de "Ver respuesta", preguntar "¿Te salió?" con dos botones (Sí / Todavía no). Sin cambiar el
  prompt de la IA.
- Guardar el resultado: en `estudio` se pueden reusar `aciertos` (me salió) y `total` (reveladas).
- Contar la actividad como hecha solo cuando respondió al menos la mitad, no con la primera.
- Los "todavía no" se ofrecen al final: "Repetir los que no me salieron".
- Mostrarlo en Familia ("le salieron 3 de 5").
- Segunda etapa, opcional: en ejercicios numéricos, campo para escribir el resultado y compararlo.
  Requiere un campo nuevo en el prompt; probar con la IA real antes.

### 4. Progreso honesto y con una sola definición — ✅ HECHO 2026-11-12
Hoy hay tres cuentas distintas:
- `progresoMateria()` (~1968): un tema cuenta con cualquier modo tocado (basta abrir el resumen). Es el
  "5 de 8 temas" de Materias.
- `pintarHomeProgreso()` (~460): "dominados" = quiz ≥ 80%, contando también temas de materias que ya no
  están en el aula.
- `pasoSugerido()` (~2498) y `marcarChips()` (~1941): otra mezcla.

Crear una sola función de estado por tema y usarla en todas partes:
- **Nuevo**: nada hecho.
- **Empezado**: vio el resumen o empezó algo.
- **Practicado**: hizo práctica o un quiz completo.
- **Dominado**: quiz ≥ 80% con 5 preguntas o más. `api/actividad.js` (acción `resumen`) hoy devuelve solo
  la proporción; debe devolver también el total de preguntas de ese mejor quiz.

Contar solo temas de las materias actuales. En Materias mostrar "2 dominados · 3 empezados de 8".

### 5. El examen debe llevar al tema, y detectarse aunque se anote como tarea — ✅ HECHO 2026-11-12
`pintarExamenBanner()` (~586) solo mira `tipo === "examen"` y llama a `irAPractica(materia, "examen")`
sin tema: deja en la lista de temas sin nada elegido.

- Tratar como examen cualquier tarea cuya descripción diga examen, evaluación, prueba, parcial o quiz.
  Misma regla en Familia (`seccionAtencion` en `familia.js`).
- En el formulario (`abrirFormTarea()` ~784): al escribir una de esas palabras, pasar el tipo a "Examen" solo.
- Buscar el tema comparando las palabras de la descripción con los títulos de `temasPracticables(m)`.
  Si coincide uno, entrar directo al paso 2 de ese tema; si coinciden varios, mostrarlos para elegir;
  si ninguno, usar `temaRecienteDe(m)`.
- Con el examen a 2 días o menos, proponer un plan corto: hoy resumen + práctica, mañana quiz.

---

## B. Estudio y quiz

### 6. Quiz de una pregunta por pantalla — ✅ HECHO 2026-11-12
`renderQuiz()` (~3004) pinta todas en una lista larga con la barra de navegación encima. Pasar a una por
vez, con barra de avance ("3 de 8"), explicación al responder y botón "Siguiente". Ocultar la barra
inferior mientras dura. Conservar el botón Reportar y la lógica de `estado`.

### 7. Avisar antes de salir de un quiz a medias — ✅ HECHO 2026-11-12
`verTab()` (~210), el botón Atrás y `mostrarPaso()` (~2528) lo borran sin preguntar. Si hay respuestas
dadas y no terminó: "¿Salir del quiz? Vas por la 4 de 8" (Seguir / Salir). Si sale, guardar las falladas
hasta ahí.

### 8. Repasar errores volviendo a preguntar — ✅ HECHO 2026-11-12
`renderErrores()` (~1782) muestra la respuesta y un botón "Ya lo entendí". Los errores ya guardan
`opciones` y `correcta`: mostrarlos como pregunta. Si acierta, se borra sola (`resolverError`); si falla,
ve la explicación y se queda en la lista.

### 9. Botón de repaso al terminar el quiz — ✅ HECHO 2026-11-12
En `mostrarResultadoQuiz()` (~3059), si falló alguna: "Repasar las 2 que fallé", que abre ese repaso
(punto 8) solo con las de ese quiz. Hoy hay que ir a buscarlo en Materias.

### 10. Estado visible en la lista de temas — ✅ HECHO 2026-11-12
`marcarChips()` (~1941) solo pone un ícono pequeño sin texto. Con los estados del punto 4, mostrar una
etiqueta legible por tema: "Nuevo", "Empezado", "Quiz 60%", "Dominado". Marcar también el tema con
material recién subido por el profesor.

### 11. Segunda revisión de las respuestas de matemática — ✅ HECHO 2026-11-12 (sin el cambio opcional de prompt)
El error del signo (−30 tomado como 30) se corrigió en `alinearCorrecta()` de `api/generar.js`. Falta:
- Si en un tema numérico el sello "Respuesta correcta: …" no coincide con ninguna opción, descartar esa
  pregunta en vez de dejarla como vino.
- Registrar cada vez que el servidor cambia el índice que marcó la IA, para vigilar.
- Opcional: pedir `explicacion` antes que `correcta` en el JSON, para que la IA resuelva antes de marcar.
  Es cambio de prompt: probar con la IA real y subir `PROMPT_VER`.

### 12. Textos confusos — ✅ HECHO 2026-11-12
- `renderOtros()` (~3161): "Otros con IA" → "Dame otras preguntas" / "Dame otros ejercicios".
  "Otra de la guía" → "Más de la guía".
- `renderSiguientePaso()` (~2838): dice "¿Cuántas preguntas quieres?" también para práctica; ahí debe
  decir "ejercicios".

### 23. Error de medición: un quiz se registra partido en varios pedazos — ✅ HECHO 2026-11-12
Confirmado con datos del 2026-11-11: una tarde de quiz de Alessandra dejó 12 filas en `estudio`, varias
de 5 a 15 segundos con 0 respuestas, y una con 9 respondidas de 8. Familia muestra por eso "Empezó un
quiz y no lo terminó" sin ser cierto.

Causas, en `app.js` (~1869–1908):
- Al apagarse la pantalla o cambiar de app se cierra la sesión de estudio y al volver se abre otra con
  los contadores en cero.
- Al reportar una pregunta ya respondida y reemplazarla, `respondidas` no se descuenta (callback de
  `zonaReporte` en `renderQuiz`).

Arreglo: un identificador por actividad (`sid`) generado en el teléfono; al volver se sigue la misma
sesión con sus contadores, y el servidor actualiza la fila de ese `sid` en vez de crear otra. Requiere
columna `sid` con índice único en `estudio` (SQL para el dueño) y `on_conflict` en `api/actividad.js`.
En `familia.js` (`construirEventos`, ~622 y ~635), ignorar sesiones de menos de 20 segundos sin respuestas.

---

## C. Inicio y agenda

### 13. Anotar una tarea con menos pasos — ✅ HECHO 2026-11-12
`abrirFormTarea()` (~784):
- La fecha sale en hoy. Debe salir en el próximo día de clases (`proximoDiaEscolar()`), o en la próxima
  clase de la materia elegida según el horario.
- Atajos sobre el calendario: "Mañana", "Próxima clase", "Otra fecha".
- El botón Guardar queda tapado por la barra inferior (a 812 px de alto queda en 755 y la barra empieza
  en 740). Dar margen inferior y desplazar el formulario a la vista al abrirlo.
- La descripción dice "(opcional)": una tarea sin descripción no sirve; pedirla.
- Con el formulario abierto, encoger el dibujo grande de "Mi agenda".

### 14. Limpiar tareas vencidas con un toque — ✅ HECHO 2026-11-12
En `homeFilaTarea()` (~421) y `filaTarea()` (~721), a las vencidas agregar "¿La entregaste?": "Sí" la
marca hecha; "Es para otro día" abre la fecha. Si hay 3 o más, un "Marcar todas como entregadas".

### 15. Tipografía pareja en Inicio — ✅ HECHO 2026-11-12
"Lo que viene" (`.h2UpcomingCard`) usa letra gruesa de título y "Hoy" letra normal, siendo la misma clase
de lista. Unificar con el estilo de "Hoy" (en `estilos.css`).

### 16. Botón principal siempre a la vista — ✅ HECHO 2026-11-12
En "¿Cómo quieres estudiar?" (`#wizActividad`), `#btnGen` queda fuera de pantalla. Dejarlo fijo sobre la
barra inferior. Lo mismo con "Continuar" del paso 1 cuando la lista es larga.

### 17. Notas conectadas con un tema concreto — ✅ HECHO 2026-11-12
Ya existe "Practicar lo que salió mal" (`irARefuerzo()` ~1339), pero deja en la lista de temas. Aplicar
la misma búsqueda de tema del punto 5 con la descripción de la nota, y entrar directo a ese tema.

---

## D. Familia

### 18. Resumen semanal para el adulto — ✅ HECHO 2026-11-12
Cada domingo: días que estudió, tiempo, quiz y notas, tareas vencidas, exámenes de la semana que viene.
Por notificación del panel (misma infraestructura del punto 2, en `familia-sw.js`), con enlace al panel.

### 19. Avisos de lo importante — ✅ HECHO 2026-11-12
Examen en 2 días sin haber practicado ese tema; 3 días sin abrir la app; tareas vencidas acumuladas.
Un aviso por motivo, no repetido cada día. Con interruptor en el panel.

### 20. Mandar una misión desde el panel — ✅ HECHO 2026-11-12 (requiere supabase-misiones.sql)
El adulto elige materia y tema ("hoy estudia fracciones") y eso aparece como "Tu misión de hoy", con
prioridad sobre las automáticas en `homeMisionTema()` (~554). Tabla nueva (`misiones`: usuario_id,
materia, tema, modo, creada, hecha), acciones nuevas en `api/familia.js` y lectura desde la app. El panel
muestra si la cumplió.

---

## E. Técnico

### 21. Algo útil sin internet — ✅ HECHO 2026-11-12
`sw.js` guarda los archivos de la app, no los datos. Guardar en el teléfono la última agenda, las notas y
los resúmenes ya abiertos, y mostrarlos con el aviso "Sin conexión: esto es lo último que se guardó".
Las tareas marcadas sin conexión se envían al volver.

### 22. Rotar la clave de DeepSeek
Quedó expuesta en una conversación. Lo hace el dueño: crear una nueva en DeepSeek, cambiar
`DEEPSEEK_API_KEY` en Vercel (todos los entornos), volver a desplegar y borrar la vieja.

---

## Orden sugerido de trabajo

1. Punto 23 (medición) y punto 12 (textos): cortos y sin riesgo.
2. Puntos 1 y 5.
3. Puntos 6, 7, 8 y 9 juntos (todo el quiz).
4. Puntos 4 y 10 juntos (progreso).
5. Punto 3.
6. Puntos 13, 14, 15 y 16 juntos (agenda e Inicio).
7. Puntos 2, 18 y 19 juntos (notificaciones).
8. Puntos 20, 17, 11 y 21.

Tras cada bloque: probar en el demo a 375 px de ancho, subir versiones y publicar.
