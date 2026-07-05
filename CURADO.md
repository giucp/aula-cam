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
- **Resumen — regla de oro "SIN PROFE AL LADO" (obligatoria):** todo resumen debe explicarse
  DESDE CERO, como si el que lee no tuviera ninguna base y no hubiera nadie para aclararle. El
  resumen tiene que SUSTITUIR a la clase, no complementarla. En la práctica:
  - Da la INTUICIÓN antes que la definición formal (primero "qué es y por qué", con una imagen
    mental cotidiana; después el término técnico). Nunca sueltes la definición seca y esperes que
    el lector la razone solo.
  - DEFINÍ cada palabra técnica la primera vez que aparece (divisor, potencia, raíz, múltiplo…);
    no asumas que ya se sabe.
  - Enseña los PROCEDIMIENTOS paso a paso, con un ejemplo resuelto por sección.
  - Cuando algo "es así" (ej. el 1 no es primo), explicá el PORQUÉ, no solo lo afirmes.
  - Prueba del que no recuerda nada: ¿un adulto que olvidó el tema, o un adolescente que nunca lo
    vio, lo entiende leyéndolo solo? Si necesita que alguien se lo explique, NO cumple la regla.
  Es directo NO significa mejor: preferimos "nutritivo y explícito" a "correcto pero denso".
  Vale especialmente para Cumbre (currículo de autoexploración, sin profe por definición).
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

## CHECKLIST OBLIGATORIO de cada banco (seguirlo SIEMPRE, en orden)
Cada vez que el admin diga "vamos a crear el contenido de X", Claude debe ejecutar estas
4 fases COMPLETAS y reportar el resultado de cada una. Nació de errores reales que llegaron
a producción (2026-07-02): decirle "en 6to grado" a una niña que va a 5to, y un ejemplo
ambiguo de la regla de signos ("un negativo, impar" sin aclarar que se cuentan los SIGNOS).

### Fase 1 — ANTES de escribir (contexto)
- [ ] **¿Quién LEE esto?** Definir explícitamente el lector: grado que CURSA hoy y grado
      del contenido. En "adelántate", el niño VA HACIA ese grado → el texto habla de ESE
      grado como su futuro inmediato ("En 5to grado verás..."), nunca del siguiente.
      El nombre de la materia/tema también debe respetar esa perspectiva.
- [ ] **Título/materia/grado EXACTOS**: copiar el `tema` letra por letra del temario o del
      aula (no reescribirlo de memoria); `materia` y `grado` con los strings exactos que
      manda la app. Confirmar la clave con `filasDeBanco` ANTES de redactar el resto.
- [ ] Si hay material real (PDFs/fotos/temario con enfoque `d`), leerlo primero: define
      nivel, notación y estilo.

### Fase 2 — MIENTRAS se escribe (regla de oro por ítem)
- [ ] **Prueba del niño**: releer cada explicación/ejemplo preguntando "¿un niño de ese
      grado entiende esto SIN ayuda y SIN ambigüedad?". Cazar palabras que puedan referirse
      a dos cosas (ej.: "par/impar" ¿del número o de la cantidad de signos?) y explicitar
      SIEMPRE el referente ("hay DOS signos negativos → cantidad par → positivo").
- [ ] Cada ejemplo se explica solo: incluye qué se hace, el cálculo y el porqué, sin
      depender de haber leído otra sección.
- [ ] Toda solución/explicación: respuesta primero, procedimiento después, y COMPROBACIÓN
      cuando sea numérico. La pista orienta sin regalar.
- [ ] Distractores del quiz = errores típicos reales (no opciones absurdas).
- [ ] Texto plano siempre: sin Markdown, sin tablas/dibujos ASCII, sin jerga regional.
- [ ] Consistencia de datos dentro de cada ítem (si el enunciado dice 3 cuadernos de
      15 Bs, la solución usa 3 y 15, no otros números).

### Fase 3 — DESPUÉS de escribir (verificación mecánica, no opcional)
- [ ] **Estructura**: pasar cada banco por `filasDeBanco` (o `cargar-curado.mjs --solo=`)
      → 4/4 modos válidos, claves normalizadas correctas, sin avisos.
- [ ] **Matemática por script**: recomputar TODA la aritmética verificable (productos,
      signos, %, fracciones de cantidad, ecuaciones, valor numérico) comparando contra la
      respuesta escrita. Los ítems que el script no pueda parsear se listan y se verifican
      A MANO uno por uno (decir cuántos fueron).
- [ ] **Grep de perspectiva**: buscar en los archivos menciones de grado ("4to", "5to",
      "6to", "1er año"...) y confirmar una por una que corresponden al lector definido en
      Fase 1. Igual con nombres propios y géneros si aplica.
- [ ] **Lectura completa final** de los 4 modos (no solo el resumen) en "modo padre
      exigente": buscando ambigüedades, erratas, frases confusas o incompletas.

### Fase 4 — SUBIR y VERIFICAR en vivo
- [ ] Subir (`cargar-curado.mjs --solo=` o `POST /api/cargar-curado`) y confirmar N/4 por
      banco y la clave normalizada exacta.
- [ ] Probar `POST /api/generar` con `soloCurado:true` y los strings EXACTOS que manda la
      app (materia/tema/grado) → debe venir `curado:true` en al menos 2 modos.
- [ ] Si se RENOMBRÓ una materia o tema ya subido: las filas viejas quedan huérfanas en
      `contenido_curado` → dar al admin el SQL de limpieza (delete por materia_norm/tema_norm viejos).
- [ ] Commitear los `.json` y reportar al admin: qué se verificó por script, qué a mano,
      y qué quedó sin verificar (ser explícito, sin maquillar).

## Los DOS tipos de curado (no confundir)
- **AULA (`programa` ausente = 'aula')** — lo que ven los niños con sello 📗 en el flujo normal.
  Fuente de verdad: el Moodle REAL (títulos exactos con `moodle-leer`, PDFs del profe para calibrar
  estilo y nivel). **4 modos** (resumen+retos+quiz+examen; el examen imita cómo evalúa la maestra).
  `grado` = "4to grado" / "6to grado" / "1er año"… Archivos en `curado/*.json`.
- **CUMBRE (`"programa":"cumbre"`)** — currículo de élite, visible solo en `#lab` hasta Fase 4.
  Fuente de verdad: `cumbre-curriculo.mjs` (título del tema letra por letra). **3 modos**
  (resumen+practica+quiz; `practica`=retos; SIN examen — patrón del banco de primos). `grado` =
  "Cumbre <Materia> 1er año". Regla "sin profe al lado" al MÁXIMO (autoexploración); referencias
  internacionales (Singapore/IB/KS3/MEXT). Archivos en `curado/cumbre/<materia>-1/NN-*.json`.
El resto del proceso (checklist, verificación, subida) es el mismo para ambos.

## PATRÓN DE SUBAGENTES — calidad/precio (obligatorio al curar en lote)
Prioridad 1: CALIDAD. Prioridad 2: ahorro de tokens. Regla espejo de la matriz de Gemini de la
app: el modelo económico JAMÁS toca lo que puede salir mal caro; el modelo top SIEMPRE supervisa.

1. **Redacción — modelo según el contenido:**
   - Numérico/lógico o con hechos delicados (matemática, lógica, física con cálculo, seguridad de
     laboratorio, datos biológicos/históricos precisos) → **modelo TOP** (Opus/Fable, el heredado).
   - Teoría pura e idioma (sociales, inglés, "cómo pensar", ciudadanía digital, lenguaje) →
     **Sonnet** (`model: "sonnet"` en el Agent tool). Ahorra ~60-70% del grueso.
   - Todo redactor recibe SIEMPRE: CURADO.md + el banco de oro (primos) + reglas del tipo de curado.
2. **Verificación mecánica — SIN subagente (0 tokens):** la corre Claude en el loop principal con
   scripts: `filasDeBanco` (estructura/claves), recomputar TODA la aritmética, greps (mojibake,
   Markdown, ASCII, perspectiva de grado, contaminación del banco de oro, `<script>` en SVG).
3. **Revisión adversarial final — SIEMPRE modelo TOP, sin excepción:** lectura completa del banco
   en "modo padre exigente": enunciado↔ecuación↔respuesta, ambigüedades (izq/der, tiempos,
   referentes), regla "sin profe al lado", distractores = errores típicos reales, hechos correctos.
   Para bancos redactados por Sonnet este paso es OBLIGATORIO e intransigente (leer+reportar cuesta
   ~4-5× menos que redactar → la supervisión top sale barata). Puede hacerla el propio Claude
   principal si él es el modelo top de la sesión.
4. **Correcciones:** al MISMO redactor vía SendMessage (mantiene su contexto) o edición directa de
   Claude si es puntual. **Subida y verificación en vivo:** siempre Claude principal (endpoint +
   `curado:true` + commit), nunca los subagentes.
Paralelismo: un redactor por materia (como el lote de 13 bancos de 2026-07-04, ~545k tokens — con
este patrón el mismo lote costaría ~40-50% menos sin bajar calidad).

## Seguridad de la sesión
- **Nunca** imprimir contraseñas ni tokens en la conversación ni en logs.
- **Nunca** commitear `.env.local`, `curado/fotos/`, `curado/material/`.
- **No** subir bancos sin el visto bueno explícito del admin (paso 4).

## Nota operativa
`moodle-leer` deduce el grado real de la cuenta desde el aula. Si la cuenta que estás
usando aún cursa el grado anterior (p. ej. la cuenta va como 4G pero curás para "5to
grado"), pasá `--grado="5to grado"` para que el cruce con lo curado y el archivo usen el
grado correcto. El campo `grado` del `.json` es el que decide bajo qué grado lo sirve la app.
