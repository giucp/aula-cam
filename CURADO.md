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
- **Quiz:** MÍNIMO 12 preguntas (el tema manda: si da para 15+, mejor; NUNCA por debajo del
  mínimo). 3–4 opciones, distractores creíbles (errores típicos reales del grado), explicación
  breve del porqué. `correcta` = índice válido dentro de `opciones`.
- **Retos:** MÍNIMO 10 (más si el tema lo amerita). Cada uno con pista que orienta sin regalar y
  solución con explicación corta.
- **Examen:** MÍNIMO 10 preguntas en el formato que evalúa la maestra (mirar guías/fotos para
  imitar su estilo), cada una con explicación de CÓMO se resuelve.
- **Figuras:** solo si el ejercicio lo necesita; SVG simple autocontenido con `viewBox`,
  sin `<script>` ni recursos externos; coherente con enunciado y solución. Si no, `"figura":""`.
- **Grados activos:** `5to grado` (cuenta A) y `1er año` (cuenta B) — usar EXACTAMENTE
  esos strings en el campo `grado`.

> Tamaños = MÍNIMOS, NO cantidades fijas. Cada tema es distinto: uno rinde 10 buenos ejercicios,
> otro da para 18 — subí por encima del mínimo cuando el tema lo justifique, nunca bajes de él.
> Mínimos: quiz ≥12, retos ≥10, examen ≥10. El mínimo existe por una razón FUNCIONAL, no estética:
> el servido toma una MUESTRA aleatoria de la cantidad que pide el niño, así que el banco necesita
> bastantes MÁS ítems que un pedido típico para que "generar otros" dé variedad real sin gastar IA.
> (El banco de oro de primos —10 retos/12 quiz— es un EJEMPLO que cumple el mínimo, no un molde fijo.)

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
- [ ] **Nivel cognitivo (solo Cumbre)**: el banco trabaja al `nivel_cognitivo` del grado
      (verbos de consigna y profundidad del resumen acordes a la escala Bloom); si el tema
      existe en un grado menor, esta versión SUBE de nivel, no repite.
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
  "Cumbre <Materia> 1er año" o "Cumbre <Materia> 5to grado" (Cumbre tiene 2 tracks: 1er año
  bachillerato y 5to grado primaria). Regla "sin profe al lado" al MÁXIMO (autoexploración);
  referencias internacionales (Singapore/IB/KS3/MEXT). Archivos en `curado/cumbre/<materia>-<grado>/NN-*.json`.
El resto del proceso (checklist, verificación, subida) es el mismo para ambos.

## ESCALA COGNITIVA DE CUMBRE — nivel de Bloom por grado (obligatoria al curar Cumbre)
Un mismo tema puede repetirse entre grados; para que la niña sienta que CRECE (no que repite),
cada grado trabaja a una PROFUNDIDAD cognitiva distinta. Base: Taxonomía de Bloom revisada
(Recordar → Entender → Aplicar → Analizar → Evaluar → Crear). Nivel dominante por grado (siempre
se apoya en los inferiores):

| Grado | Nivel Bloom dominante | Qué HACE el estudiante |
|---|---|---|
| 4to grado | Recordar → Entender | Reconoce, describe y explica con guía. |
| **5to grado** | **Entender → Aplicar (con guía)** | Explica con sus palabras y aplica en casos parecidos, guiado. |
| **6to grado** | **Aplicar → primeros Analizar** | Aplica solo a casos nuevos; empieza a comparar/detectar en contexto. |
| **1er año** | **Analizar → primeros Evaluar** | Descompone, distingue casos, relaciona, empieza a juzgar con criterios. |
| 2do año | Evaluar → Crear | Juzga con evidencia, refuta, produce/diseña lo propio. |

**REGLA DE ORO DE ESCALABILIDAD:** cuando un tema aparece en dos grados, el grado mayor NO repite
— sube ≥1 nivel de Bloom. Antes de curar un tema que ya existe en un grado inferior, MIRÁ cómo
quedó allá (Supabase/bancos) y garantizá que la versión del grado mayor sube de nivel.
**Cómo se nota el nivel en el banco:**
- Resumen: a mayor grado, menos "aquí está la regla" y más "por qué funciona, cómo se conecta,
  cuándo NO aplica".
- Práctica/reto: el verbo de la consigna sube — identifica/calcula (aplicar) → compara/explica por
  qué (analizar) → evalúa/decide/diseña (evaluar/crear).
- Quiz: menos recordar, más aplicar a casos nuevos y razonar el porqué a medida que sube el grado.
El nivel dominante del grado vive como metadato `nivel_cognitivo` en cada materia del
`cumbre-curriculo.mjs` (y en la fila de `curriculo`). Es INPUT obligatorio del autor y CRITERIO
del revisor (ver patrón de subagentes).

## PATRÓN DE SUBAGENTES — calidad/precio (obligatorio al curar en lote)
Prioridad 1: CALIDAD. Prioridad 2: ahorro de tokens. Regla espejo de la matriz de Gemini de la
app: el modelo económico JAMÁS toca lo que puede salir mal caro; el modelo top SIEMPRE supervisa.

1. **Redacción — modelo según el contenido:**
   - Numérico/lógico o con hechos delicados (matemática, lógica, física con cálculo, seguridad de
     laboratorio, datos biológicos/históricos precisos) → **modelo TOP** (Opus/Fable, el heredado).
   - Teoría pura e idioma (sociales, inglés, "cómo pensar", ciudadanía digital, lenguaje) →
     **Sonnet** (`model: "sonnet"` en el Agent tool). Ahorra ~60-70% del grueso.
   - Todo redactor recibe SIEMPRE: CURADO.md + el banco de oro (primos) + reglas del tipo de curado
     + (para Cumbre) el **`nivel_cognitivo` del grado** como objetivo explícito, y —si el tema existe
     en un grado menor— cómo quedó allá, para SUBIR de nivel y no repetir.
2. **Verificación mecánica — SIN subagente (0 tokens):** la corre Claude en el loop principal con
   scripts: `filasDeBanco` (estructura/claves), recomputar TODA la aritmética, greps (mojibake,
   Markdown, ASCII, perspectiva de grado, contaminación del banco de oro, `<script>` en SVG).
3. **Revisión adversarial final — SIEMPRE modelo TOP, sin excepción:** lectura completa del banco
   en "modo padre exigente": enunciado↔ecuación↔respuesta, ambigüedades (izq/der, tiempos,
   referentes), regla "sin profe al lado", distractores = errores típicos reales, hechos correctos,
   y (Cumbre) **que el banco trabaje al `nivel_cognitivo` del grado** — ni corto ni pasado; un banco
   que se quedó en recordar/entender cuando el grado pide analizar se DEVUELVE, igual que por un
   error de cálculo.
   Para bancos redactados por Sonnet este paso es OBLIGATORIO e intransigente. Puede hacerla el
   propio Claude principal si él es el modelo top de la sesión.
   OJO COSTO (medido 2026-07-04, 7 revisores de nivel cognitivo = ~418k tokens): revisar un banco
   NO sale casi gratis — el revisor debe LEER el banco completo (~30KB) antes de juzgar, así que
   revisar ≈ 0.7× redactar, no 0.2×. El ahorro REAL del patrón está en (1) usar Sonnet para
   redactar teoría/idioma y (2) que la verificación mecánica (paso 2) no gaste subagentes; NO en
   suponer que la revisión es barata. No inflar el nº de revisores.
4. **Correcciones:** al MISMO redactor vía SendMessage (mantiene su contexto) o edición directa de
   Claude si es puntual. **Subida y verificación en vivo:** siempre Claude principal (endpoint +
   `curado:true` + commit), nunca los subagentes.
Paralelismo: un redactor por materia (como el lote de 13 bancos de 2026-07-04, ~545k tokens — con
Sonnet para la teoría el mismo lote costaría ~25-35% menos sin bajar calidad; la revisión NO ahorra
mucho porque implica releer todo).

## Seguridad de la sesión
- **Nunca** imprimir contraseñas ni tokens en la conversación ni en logs.
- **Nunca** commitear `.env.local`, `curado/fotos/`, `curado/material/`.
- **No** subir bancos sin el visto bueno explícito del admin (paso 4).

## Nota operativa
`moodle-leer` deduce el grado real de la cuenta desde el aula. Si la cuenta que estás
usando aún cursa el grado anterior (p. ej. la cuenta va como 4G pero curás para "5to
grado"), pasá `--grado="5to grado"` para que el cruce con lo curado y el archivo usen el
grado correcto. El campo `grado` del `.json` es el que decide bajo qué grado lo sirve la app.
