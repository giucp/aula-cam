-- supabase-muro.sql
-- MURO DE LOGROS por grado (mini red social sana dentro de Chispa) + reacciones con emoji.
--
-- Idea: cada niño ve los LOGROS de sus compañeros del MISMO grado (a uno de 1er año no le
-- interesa qué hizo uno de 3er grado) y puede reaccionar con un set curado y positivo de
-- emojis (estilo WhatsApp). NO se publican notas de examen — solo LO QUE HIZO. El texto del
-- anuncio lo COMPONE el backend a partir de datos estructurados (nunca texto libre del cliente),
-- y por ahora NO hay comentarios (eso sería una Fase 2 con moderación).
--
-- Segmentación: `grado` es el grado REAL del niño ("4to grado" / "6to grado" / "1er año"),
-- no el track de Cumbre. El backend (api/actividad.js) filtra el feed por ese grado.
-- Dedup: el backend evita republicar el mismo tipo+materia+tema del mismo niño el MISMO día.
-- RLS activado sin políticas → solo el backend (service_role) puede leer/escribir.

create table if not exists public.muro (
  id         bigint generated always as identity primary key,
  usuario_id bigint      not null,
  nombre     text,                 -- nombre corto para mostrar ("Ana B."); nunca apellido completo
  grado      text        not null, -- grado real del niño (clave de segmentación)
  tipo       text        not null, -- practica | quiz | examen | cumbre | racha | sinapsis
  materia    text,
  tema       text,
  meta       jsonb,                -- solo score (sinapsis) o dias (racha); NUNCA notas de examen
  creado     timestamptz not null default now()
);
create index if not exists muro_grado_creado on public.muro (grado, creado desc);
create index if not exists muro_dedup on public.muro (usuario_id, tipo, creado);

create table if not exists public.muro_reacciones (
  id         bigint generated always as identity primary key,
  muro_id    bigint      not null references public.muro(id) on delete cascade,
  usuario_id bigint      not null,
  emoji      text        not null, -- del set seguro (👏🔥💪🎉⭐), validado en el backend
  creado     timestamptz not null default now(),
  unique (muro_id, usuario_id)     -- una reacción por niño por anuncio (cambiable/quitable)
);
create index if not exists muro_reac_muro on public.muro_reacciones (muro_id);

alter table public.muro            enable row level security;
alter table public.muro_reacciones enable row level security;

-- LIMPIEZA (opcional, futura): el feed muestra solo los últimos 40 por grado, pero las filas
-- se acumulan. Conviene sumar `muro` (y `muro_reacciones` por cascada) al cron de limpieza
-- (borrar > ~30 días) cuando se retome scripts/limpiar_viejos.py.
