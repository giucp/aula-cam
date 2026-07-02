# CURADO.md — Playbook de la fábrica de contenido curado (Aula CAM)

Claude Code debe leer este archivo al inicio de CADA sesión de curaduría. La curaduría
produce bancos revisados a mano (resúmenes profundos + preguntas/ejercicios) que la web
sirve ANTES de Gemini a todos los niños del grado (spec de servido en
`aula-cam-contenido-curado.md`).

## Antes de empezar (una sola vez)
- Copiar `.env.local.ejemplo` a `.env.local` y completar: `MOODLE_USER_A/PASS_A`
  (cuenta que se cura como **5to grado**), `MOODLE_USER_B/PASS_B` (como **1er año**),
  `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
- Correr `supabase-curado.sql` en Supabase (crea la tabla `contenido_curado`).
- `.env.local`, `curado/fotos/` y `curado/material/` están en `.gitignore`: NUNCA se
  commitean. Los `.json` curados SÍ (son el activo del proyecto).

## Flujo de una sesión
1. **Elegir tema.** `node herramientas/moodle-leer.mjs estado --cuenta=<A|B>` para ver
   qué temas están ✅ curados / ⚠️ parciales / ❌ sin curar / 🔄 con material nuevo.
   Definir con el admin cuál se cura hoy.
2. **Bajar material.** `node herramientas/moodle-leer.mjs bajar --cuenta=<A|B>
   --materia="…" --tema="…"`. Descarga los PDFs a `curado/material/<tema>/` e imprime
   el texto del docente (resumen de sección + descripciones). Leer TODOS esos PDFs y
   TODAS las fotos que el admin haya dejado en `curado/fotos/<tema>/` (leerlas como
   imágenes; si la letra es ilegible, NO inventar).
3. **Generar el banco.** Crear `curado/<materia>-<grado>-<tema>.json` con el esquema de
   abajo. Basarse SIEMPRE en el material real: las guías definen enfoque, notación y
   nivel; las fotos del cuaderno definen cómo lo explicó la maestra en clase. Ante
   conflicto, **manda el cuaderno** (es lo que la maestra evaluará).
4. **Control con el admin.** Mostrar: título e ideas del resumen, 3 preguntas de quiz de
   muestra y 2 retos de muestra. Esperar su visto bueno o correcciones. **No subir sin OK.**
5. **Subir y commitear.** Con el OK: `node herramientas/cargar-curado.mjs
   --solo=<archivo.json>`. Confirmar la clave normalizada que imprime (debe casar con lo
   que manda la app). Commitear SOLO el `.json` (verificar con `git status` que
   `fotos/`, `material/` y `.env.local` no entren).

## Esquema del banco (`curado/<archivo>.json`)
Todas las claves de modo son OPCIONALES (se puede curar solo resumen+quiz de un tema).

```json
{
  "materia": "Matemática",
  "tema": "Fracciones equivalentes",
  "grado": "5to grado",
  "fuentes": ["Guía de fracciones - 2do lapso.pdf"],
  "resumen": { "titulo": "...", "intro": "...",
    "secciones": [ { "titulo": "...", "explicacion": "...", "pasos": ["..."], "ejemplo": "..." } ],
    "idea_clave": "..." },
  "retos":  [ { "enunciado": "...", "pista": "...", "solucion": "...", "figura": "" } ],
  "quiz":   [ { "pregunta": "...", "opciones": ["...","...","..."], "correcta": 0, "explicacion": "...", "figura": "" } ],
  "examen": [ { "pregunta": "...", "respuesta": "...", "explicacion": "..." } ]
}
```

## Reglas de calidad (obligatorias)
- **Español neutro** y claro para el grado; sin jerga regional ("chamo", "épale", "pana").
- **Matemática:** TODO ejercicio/ejemplo se resuelve y verifica antes de incluirse; elegir
  números para resultados EXACTOS; la solución nunca contradice el enunciado.
- **Resumen:** enseña PROCEDIMIENTOS paso a paso con ejemplo resuelto por sección, no
  definiciones sueltas. 3–5 secciones. Debe poder sustituir la clase que el niño se perdió.
- **Quiz:** 15 preguntas, 3–4 opciones, distractores creíbles (errores típicos reales del
  grado), explicación breve del porqué. `correcta` = índice válido dentro de `opciones`.
- **Retos:** 12, con pista que orienta sin regalar y solución con explicación corta.
- **Examen:** 10 preguntas en el formato que evalúa la maestra (mirar guías/fotos para
  imitar su estilo), cada una con explicación de CÓMO se resuelve.
- **Figuras:** solo si el ejercicio lo necesita; SVG simple autocontenido con `viewBox`,
  sin `<script>` ni recursos externos; coherente con enunciado y solución. Si no, `"figura":""`.
- **Grados activos:** `5to grado` (cuenta A) y `1er año` (cuenta B) — usar EXACTAMENTE
  esos strings en el campo `grado`.

> Tamaños: quiz y retos 12–15, examen 10. El servido toma una MUESTRA aleatoria de la
> cantidad que pide el niño; con bancos así, "generar otros" da variedad real sin gastar IA.

## Seguridad de la sesión
- **Nunca** imprimir contraseñas ni tokens en la conversación ni en logs.
- **Nunca** commitear `.env.local`, `curado/fotos/`, `curado/material/`.
- **No** subir bancos sin el visto bueno explícito del admin (paso 4).

## Nota operativa
`moodle-leer` deduce el grado real de la cuenta desde el aula. Si la cuenta que estás
usando aún cursa el grado anterior (p. ej. la cuenta va como 4G pero curás para "5to
grado"), pasá `--grado="5to grado"` para que el cruce con lo curado y el archivo usen el
grado correcto. El campo `grado` del `.json` es el que decide bajo qué grado lo sirve la app.
