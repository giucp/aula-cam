# PLAN — Chispa Universal (escalar Chispa + Familia a cualquier niño, con o sin aula virtual)

> **Para quién es este documento:** para un modelo de Claude (u otro agente) que va a EJECUTAR la
> escalabilidad por fases. Es un plan, NO código. Nada de lo descrito está hecho todavía.
> **Estado de partida (2026-07-09):** todo lo actual está LIVE y estable. Leer primero
> `CLAUDE.md` del directorio padre y la memoria `aula-cam.md` (bloque "⚡ RETOMAR") para el contexto.

---

## 0. Qué existe hoy (punto de partida)

- **Chispa (niño):** `aula-cam.vercel.app`. Single-page (`index.html` + `app.js` ~133KB + `estilos.css`),
  PWA con `sw.js` (v57). **El login ES el Moodle del colegio U.E. Arzobispo Méndez**: el niño entra con su
  usuario/contraseña del aula virtual, `api/moodle.js` saca token vía `login/token.php` +
  `core_webservice_get_site_info`, y de ahí se derivan identidad, grado (shortname de cursos "4G"/"6G") y
  contenidos del aula.
- **Familia (padres):** `chispa-familia.vercel.app` (mismo repo, 2º proyecto Vercel, envs propias).
  Panel SOLO LECTURA por token (`familia_vinculos`), multi-hijo, PWA propia.
- **Backend:** 9 funciones serverless de 12 (límite Vercel Hobby): `actividad, agenda, curado-info,
  curriculo, errores, familia, generar, lab, moodle`. BD **Supabase** (project `xrkrwiolfjfcudpqnauu`),
  acceso MCP directo. RLS on, todo pasa por el backend con service key.
- **IA:** Gemini (flash / flash-lite / 2.5-pro según ruteo; key gratis + key paga). Límite de gasto por
  alumno/día (`usuarios.ia_limite_dia_usd`, RPC `sumar_gasto_ia`), cap 3 Pro/día para reportes.
- **Features del niño:** resúmenes, Practica, Demuestra (quiz), Examen, Cumbre (contenido 100% curado),
  agenda (notas/tareas/horario **ya se cargan a mano**), racha, energía, muro social por grado,
  Sinapsis embebido, botón Reportar, efemérides.
- **Acceso:** aprobación manual (`usuarios.autorizado`) desde el panel `#lab` (gated por `ADMIN_KEY`).

**La restricción arquitectónica central a romper:** hoy *identidad = credenciales Moodle de UN colegio
hardcodeado*. Todo lo demás (agenda manual, IA, quiz, familia, muro) ya es bastante agnóstico.

---

## 1. Visión objetivo

Una sola app donde **cualquier niño/adolescente de Venezuela** (y luego donde sea):

1. **Se registra con cuenta propia de Chispa** (ya no con credenciales de un colegio).
2. **Camino A — su colegio tiene aula virtual Moodle:** la CONECTA (usuario+contraseña del aula) y Chispa
   absorbe materias, contenidos y novedades igual que hoy con el CAM.
3. **Camino B — su colegio NO tiene aula virtual:** crea sus materias a mano y alimenta la app con
   **apuntes, fotos del cuaderno/pizarrón/libro y texto** → la IA extrae los temas y genera lo mismo:
   resúmenes, quiz, práctica, refuerzo de errores.
4. En ambos caminos: agenda (tareas/notas/horario), racha, energía, panel de Familia para los padres.

**Principio rector:** el aula virtual pasa de ser *el login* a ser *una fuente de contenido opcional
(un "conector")*. La cuenta Chispa es el centro; las fuentes (Moodle, fotos, apuntes) alimentan.

---

## 2. Decisiones de diseño (tomadas aquí para no re-debatir; validar con el user solo las marcadas ⚠️)

| Tema | Decisión |
|---|---|
| Identidad | **Supabase Auth** (email+contraseña). Para niños sin email: email del padre/representante o alias `@chispa.local` interno con **código de rescate** de 8 caracteres que se muestra UNA vez al registrarse (recuperación sin email). ⚠️ validar con el user |
| Moodle | Conector genérico: URL del Moodle configurable por colegio. Solo Moodle con web services + `login/token.php` habilitados (lo estándar de la app móvil oficial). Si el colegio no lo expone → ese niño usa Camino B. **NO scraping.** |
| Multi-colegio | Tabla `colegios` (catálogo). El niño elige su colegio en el registro o "Mi colegio no está / no tiene aula virtual". |
| Grados | Se generaliza: el grado deja de inferirse solo del shortname del CAM; cada colegio tiene su `mapeo_grados` (regex/reglas) y en Camino B el niño lo elige a mano (1ro-6to primaria, 1ro-5to año). |
| Acceso | Se elimina la aprobación manual como bloqueo (no escala). Reemplazo: registro abierto + **límites de IA duros por defecto** + verificación por email cuando hay email. El panel `#lab` queda para moderar/banear, no para aprobar. ⚠️ validar |
| Costos IA | Tier gratuito con límite $/día bajo (ya existe la infraestructura `ia_limite_dia_usd`). El modelo de pago/donación se decide después — NO bloquear el plan por esto. |
| Muro social | Se segmenta por **colegio+grado** (hoy solo grado). Niños de Camino B sin colegio: muro por grado "general" o desactivado al inicio. ⚠️ validar |
| Infra | Seguir en Vercel + Supabase. **Consolidar funciones** (router único) para no chocar con el límite de 12. Fotos → **Supabase Storage**. Evaluar upgrade a Vercel Pro / Supabase Pro solo cuando las métricas lo pidan. |
| Marca/dominio | La app ya se llama Chispa pero vive en `aula-cam.vercel.app`. Con el salto a universal SÍ conviene dominio propio (`chispa.app` o similar) y quizá repo renombrado. ⚠️ decisión del user (costo) — el plan NO depende de esto, se puede hacer al final. |
| Retro-compatibilidad | Los 2 usuarios reales actuales (Martina, Alessandra) migran automáticamente: sus cuentas Moodle-CAM se convierten en cuentas Chispa con el conector CAM ya vinculado. **Cero pérdida de datos ni re-login forzado más allá de un paso guiado.** |

---

## 3. Modelo de datos objetivo (esquema de las migraciones)

Migrar de forma **aditiva** (columnas nuevas nullable primero, backfill, luego constraint). Nunca romper
la app en producción.

```
colegios
  id, nombre, ciudad/estado, tiene_moodle bool,
  moodle_url (ej: https://aula.colegio.edu.ve), mapeo_grados jsonb,
  verificado bool (curado por nosotros), creado

usuarios  (REFACTOR de la tabla actual)
  + auth_id uuid  → FK a auth.users (Supabase Auth)   ← la identidad nueva
  + colegio_id    → FK colegios, NULLABLE (Camino B = null)
  + fuente        → 'moodle' | 'manual'
  + grado         → ya existe; en Camino B lo setea el niño
  (moodle_userid pasa a ser NULLABLE; hoy es la PK lógica — cuidado con
   actividad/errores/agenda/familia_vinculos/muro que cuelgan de usuario_id: NO cambian,
   usuario_id sigue siendo la FK interna)

conexiones_moodle  (NUEVA — el "conector")
  id, usuario_id, colegio_id, moodle_userid, token_cifrado, estado (ok|expirado|error),
  ultimo_sync, creado
  → hoy el token Moodle vive en el cliente; acá se decide si persistirlo cifrado en
    servidor para sync en 2º plano, o mantenerlo client-side (más simple, menos features).
    RECOMENDACIÓN: client-side en Fase 1 (como hoy), servidor en fase posterior si se
    quiere "novedades sin abrir la app".

materias_manuales  (NUEVA — Camino B)
  id, usuario_id, nombre, emoji/color, grado, creado
  → en Camino A las materias siguen viniendo de Moodle (cursos). El front unifica ambas
    en una sola lista con la misma UI.

apuntes  (NUEVA — Camino B y también útil en A)
  id, usuario_id, materia (nombre normalizado), tipo ('foto'|'texto'),
  storage_path (Supabase Storage) | texto, extraido jsonb (lo que la IA sacó:
  tema, conceptos, texto OCR), estado ('pendiente'|'procesado'|'error'), creado

temas_detectados  (NUEVA — el "temario" del Camino B)
  id, usuario_id, materia, tema, origen ('apunte'|'manual'), apunte_ids[], creado
  → equivale al temario que hoy sale de Moodle/curriculo: es lo que alimenta
    resúmenes/quiz/práctica en modo manual.
```

Ajustes a tablas existentes: `muro` gana `colegio_id` (nullable); `familia_vinculos` no cambia
(ya es por `usuario_id`); `actividad/errores/notas/tareas/horario` no cambian.

**Storage:** bucket `apuntes` privado, acceso SOLO vía backend (signed URLs cortas). Límite por foto
(~2-4 MB, comprimir client-side a JPEG antes de subir — redes venezolanas) y cuota por usuario
(ej. 50 fotos vivas; las procesadas pueden purgarse a los N días porque lo valioso queda en `extraido`).

---

## 4. FASES (orden de ejecución; cada fase termina LIVE y verificada antes de la siguiente)

### FASE 1 — Identidad propia (cuenta Chispa) sin romper nada
*La más delicada. Todo lo demás depende de esta.*

1. Activar **Supabase Auth** (email+password). Diseñar el flujo alias+código-de-rescate para niños
   sin email (una función `api/auth` o dentro del router — ver Fase 0 de infra abajo).
2. Migración BD: columnas nuevas en `usuarios` (`auth_id`, `colegio_id`, `fuente`), tabla `colegios`
   con UNA fila (el CAM, `tiene_moodle=true`, su URL, su mapeo de grados actual).
3. **Nuevo flujo de entrada** en `index.html`/`app.js`:
   - Pantalla 1: "Entrar" / "Crear mi cuenta".
   - Registro: nombre, grado, ¿tu colegio? (buscador sobre `colegios` + "no está / no tiene aula
     virtual"), credencial (email+pass o alias+PIN con código de rescate).
   - Login: cuenta Chispa. **Ya NO se entra con el usuario del aula.**
4. **Conector Moodle como paso separado:** si el colegio tiene Moodle, tras registrarse la app ofrece
   "Conectar tu aula virtual" → pide usuario/contraseña DEL AULA → mismo flujo actual de
   `api/moodle.js` pero contra `colegios.moodle_url` en vez del hardcode → guarda la vinculación en
   `conexiones_moodle` y el token donde se haya decidido (client-side en esta fase).
5. **Migración de los usuarios reales (2 niñas):** pantalla puente al abrir: "Chispa ahora tiene cuenta
   propia — creá tu clave" → crea auth, vincula `auth_id` al `usuarios` existente (match por
   moodle_userid), deja el conector CAM ya activo. Los datos (racha, notas, errores, familia) quedan
   intactos porque `usuario_id` no cambia.
6. **Familia:** `api/familia.js` no cambia su lógica de tokens; solo verificar que `invitar/vinculos/
   revocar` (que hoy autentican re-validando el token Moodle) pasen a autenticar con la **sesión
   Supabase Auth** del niño.
7. Verificar end-to-end contra prod (protocolo §6): registro nuevo → conectar aula → ver materias;
   login viejo migrado; panel familia intacto.

### FASE 2 — Camino B: modo manual (apuntes + fotos)
*El corazón de "universal". Reusar el pipeline de IA existente.*

1. Backend `apuntes`: subir foto (comprimida client-side) → Supabase Storage → encolar procesamiento.
   Procesar = **Gemini vision** (flash): OCR + "¿de qué materia/tema es esto?" + conceptos clave →
   guardar en `apuntes.extraido` y upsert en `temas_detectados`. Cobrar el costo al límite IA del
   usuario como cualquier generación.
2. Materias manuales: CRUD mínimo (crear con nombre+emoji, editar, archivar). El front unifica
   materias-Moodle y materias-manuales en la misma grilla de tarjetas.
3. **Adaptar `api/generar.js`:** hoy el contexto sale del contenido del aula/curriculo. Nuevo camino:
   si `fuente=manual`, el contexto del resumen/quiz/práctica sale de `temas_detectados` +
   `apuntes.extraido` de esa materia (+ el grado, para calibrar nivel). Mismo ruteo de modelos,
   mismos límites, mismo botón Reportar.
4. Entrada de texto libre además de fotos: "escribí o pegá lo que viste hoy" (para el niño sin cámara
   buena o que prefiere teclear).
5. Agenda: **ya es manual** (notas/tareas/horario se anotan a mano) → funciona igual en Camino B sin
   tocar nada. Verificarlo, no reescribirlo.
6. Cumbre y efemérides: son contenido curado independiente del colegio → disponibles para todos tal
   cual (Cumbre está atada a grados: usar el `grado` del usuario).
7. Refuerzo de errores, racha, energía: agnósticos de la fuente → verificar que funcionen con
   materias manuales (revisar todo lugar de `app.js` que asuma que una materia tiene `courseid` Moodle).

### FASE 3 — Conector Moodle genérico (multi-colegio)
1. Generalizar `api/moodle.js`: recibir `colegio_id`, resolver `moodle_url` de la BD, validar que sea
   un colegio `verificado` (evita SSRF: NUNCA aceptar URL arbitraria del cliente).
2. **Herramienta de alta de colegios** (para nosotros, en `#lab`): probar una URL de Moodle
   (¿`login/token.php` responde? ¿qué web services expone?), definir `mapeo_grados`, marcar verificado.
3. Manejar la variabilidad real de Moodle ajenos: web services deshabilitados (→ mensaje claro y
   fallback a Camino B), cursos sin patrón de grado (→ preguntar el grado al niño), contenidos con
   estructura distinta (el parser de contenidos debe degradar con gracia: lo que no entienda, lo ignora
   y el niño lo complementa con apuntes — **Camino A y B son COMBINABLES**, un niño con aula floja
   sube fotos igual).
4. Formulario "quiero que agreguen mi colegio" (guarda solicitud; nosotros lo verificamos y damos de alta).

### FASE 4 — Onboarding e instrucciones explícitas
*El user pidió instrucciones de uso "bien explícitas". Diseñar como flujo, no como texto pegado.*

1. **Tutorial de primera vez, bifurcado por camino:**
   - Común: qué es Chispa, la energía, la racha, cómo instalar la PWA (iOS "Agregar a inicio" /
     Android instalar — ya hay experiencia de esto en Familia).
   - Camino A: "conectamos tu aula, esto es lo que Chispa ve" + de dónde salen las materias.
   - Camino B: "sacale foto a tu cuaderno así" (foto nítida, buena luz, una página por foto),
     cómo crear materias, cómo pedir resumen/quiz de lo fotografiado.
2. Estados vacíos que enseñan: materia manual sin apuntes → "todavía no me diste material: sacá una
   foto o escribí el tema"; cada pantalla vacía dice el próximo paso.
3. Guía para padres en el panel Familia (qué ven, qué no ven — nunca escriben).
4. Persistir el progreso del onboarding **por usuario en Supabase** (no localStorage — lección del
   tutorial de Sinapsis que se repetía).

### FASE 5 — Familia universal + social
1. Panel Familia: verificar que muestre bien a un hijo de Camino B (actividad de apuntes/quiz manual,
   sin sección "aula virtual"). Etiquetar la fuente en el panel.
2. Muro: segmentar por colegio+grado; decidir con el user qué ven los de Camino B.
3. Limpieza pendiente heredada: sumar `familia_vinculos` (invitaciones vencidas) + `muro` viejo al cron
   `scripts/limpiar_viejos.py` — hacerlo en esta fase, ya con el esquema nuevo estable.

### FASE 6 — Hardening, costos y legal (antes de abrir el registro al público)
1. **Anti-abuso:** rate-limit por IP/cuenta en registro y en `/api/generar`; límites IA default bajos;
   captcha suave o verificación email si aparece abuso; alertas de gasto Gemini agregado
   (cron diario que suma `gasto` y avisa si pasa umbral).
2. **Privacidad/menores:** son datos de menores. Texto simple de privacidad + consentimiento del
   representante en el registro (checkbox + el flujo Familia ya da al padre visibilidad real).
   Fotos de cuadernos = contenido del niño: bucket privado, purga automática, nunca al muro.
3. **Credenciales Moodle ajenas:** dejar claro en la UI que la contraseña del aula va directo al
   Moodle del colegio y no se almacena (si el token queda client-side). Si en algún momento se
   persiste server-side: cifrado, y documentarlo.
4. `get_advisors` de Supabase (security+performance) + revisar RLS de TODAS las tablas nuevas
   (patrón actual: RLS on, solo el backend con service key toca la BD — mantenerlo).
5. Índices para las tablas nuevas (`apuntes(usuario_id, materia)`, `temas_detectados(usuario_id, materia)`).

### FASE 7 — Lanzamiento gradual
1. Beta cerrada: las 2 niñas + 3-5 niños conocidos SIN aula virtual (valida Camino B de verdad).
2. Medir: costo IA/usuario/día, fotos procesadas, errores (`error_log`), retención de racha.
3. Segundo colegio real con Moodle (valida Fase 3 con un aula ajena).
4. Recién entonces: dominio propio, registro abierto, y decidir modelo de sostenibilidad.

### FASE 0 (transversal, hacer ANTES de Fase 1) — Infraestructura para crecer
1. **Router de API:** consolidar endpoints en menos funciones (ej. `api/app.js` con `?accion=` como ya
   hace `familia.js` internamente) para liberar slots del límite de 12 — las fases nuevas necesitan
   `auth` y `apuntes`. Alternativa: pagar Vercel Pro. Elegir al arrancar.
2. Congelar una **suite de humo** (scripts Node locales estilo los ya usados con `.env.local`):
   login, generar, agenda, familia — correrla tras cada fase.
3. Rama de trabajo o feature-flags: **hoy push a `main` = producción con 2 usuarios reales.** Las
   fases 1-3 son cirugía mayor → usar flags (`?beta=` o columna `usuarios.beta`) o un 3er proyecto
   Vercel de preview apuntando a una rama, para no operar a corazón abierto.

---

## 5. Qué NO hacer (límites del plan)

- NO scraping de Moodles sin web services, NO pedir contraseñas de plataformas que no sean Moodle.
- NO reescribir la app: es una evolución **quirúrgica** del código existente ([[surgical-edits]]).
  `app.js` ya tiene 133KB — si una fase lo infla demasiado, modularizar es un proyecto aparte a
  proponer, no a improvisar.
- NO tocar turepo ni Sinapsis (proyectos aparte; Sinapsis solo recibe el mismo embed).
- NO abrir registro público antes de Fase 6.
- NO eliminar el flujo actual del CAM hasta que la migración de Fase 1 esté verificada con las niñas.

## 6. Reglas operativas para el modelo ejecutor (lecciones YA pagadas — no re-aprenderlas)

1. Ediciones quirúrgicas + `node --check` de cada JS tocado antes de dar algo por hecho.
2. Push a `main` = PRODUCCIÓN inmediata en ambos dominios. Commits: autor giucp + trailer Co-Authored-By.
3. Verificar contra producción con scripts Node + `.env.local` (el Bot Filter de Vercel bloquea curl
   pelado; usar User-Agent de navegador, y aún así puede saltar el Security Checkpoint).
4. En pruebas contra prod: borrar SOLO filas propias por id — **NUNCA una tabla entera** (ya se
   borraron vínculos reales del user 2 veces).
5. Service workers: **network-first en el shell durante desarrollo; JAMÁS `skipWaiting()`+`clients.claim()`**
   (mató requests en vuelo y causó un loop de días). Bump de versión de SW en cada cambio de assets.
6. Ante "el flujo A anda y el B no": diferenciar QUÉ EJECUTA cada flujo (repro en Node con stubs)
   ANTES de culpar red/infra (bug TDZ de `PANEL_CACHE`: costó medio chat).
7. Nada de volcados de texto plano en la UI: el user exige estética organizada de una
   ([[estetica-calidad-estandar]]). Identidad visual: teal/uva/mango, Fredoka/Nunito, emojis OK.
8. Cambios de esquema: por MCP de Supabase mostrando el SQL antes, con OK explícito para
   DROP/DELETE masivo. Documentar cada migración en un `supabase-*.sql` del repo como hasta ahora.
9. Al borrar un endpoint `api/*`, revisar `vercel.json` (un pattern huérfano en `functions` rompe el build).
10. Decisiones de producto marcadas ⚠️ en §2: confirmarlas con el user (AskUserQuestion) al llegar a
    esa fase, no antes ni todas juntas.

## 7. Orden resumido (checklist ejecutable)

- [ ] F0: router API + suite de humo + estrategia de flags/preview
- [ ] F1: Supabase Auth + tabla colegios + registro/login propio + Moodle como conector + migrar a las 2 niñas + Familia autentica con sesión
- [ ] F2: apuntes (fotos+texto) → Gemini vision → temas → generar resumen/quiz/práctica en modo manual + materias manuales
- [x] F3: conector Moodle multi-colegio ✅ + alta de colegios en #lab ✅ + solicitud "agreguen mi colegio" ✅ (commit cb213b9)
- [~] F4: onboarding nativo (Camino B) persistido en BD ✅ (commit 02265d0) · guía de padres en Familia → difer. a F5
- [ ] F5: Familia con hijos manuales + muro por colegio+grado + limpieza cron pendiente
- [ ] F6: rate-limits, alertas de gasto, privacidad de menores, advisors, índices
- [ ] F7: beta cerrada → métricas → 2º colegio → registro abierto + dominio propio
