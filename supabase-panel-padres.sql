-- aula-cam · PANEL DE PADRES DETALLADO (2026-10-29)
-- Correr una vez en el SQL Editor del proyecto de aula-cam. Es idempotente (se puede correr de nuevo).
--
-- Hasta acá solo se guardaba QUÉ hizo la niña (tabla actividad: modo + tema + nota del quiz). El
-- panel de padres no podía decir cuánto estudió, si leyó los ejercicios o solo los abrió, ni cuándo
-- usa la app. Dos tablas nuevas, solo escritas por el backend (api/actividad):
--
--   estudio    → una fila por cada vez que la niña tiene una actividad en pantalla: segundos REALES
--                (solo con la app visible y con interacción en los últimos 2 minutos), cuántos
--                ejercicios/preguntas trajo, cuántas respuestas reveló, cuántas pistas usó, cuántas
--                preguntas del quiz respondió y de dónde salió el contenido (guía revisada / IA).
--   aperturas  → cada vez que abre Chispa (o vuelve a ella después de 20+ minutos): hora de uso.

create table if not exists public.estudio (
  id          bigserial primary key,
  usuario_id  bigint not null,
  materia     text,
  tema        text,
  modo        text,          -- resumen | retos | quiz | examen
  fuente      text,          -- guia | ia | cumbre
  segundos    int  not null default 0,
  items       int,           -- ejercicios / preguntas que trajo la actividad
  revelados   int,           -- respuestas que abrió (práctica / examen)
  pistas      int,           -- pistas que abrió (práctica)
  respondidas int,           -- preguntas del quiz que contestó
  aciertos    int,
  total       int,
  creado      timestamptz not null default now()
);
create index if not exists estudio_usuario_idx on public.estudio (usuario_id, creado desc);
alter table public.estudio enable row level security;

create table if not exists public.aperturas (
  id          bigserial primary key,
  usuario_id  bigint not null,
  creado      timestamptz not null default now()
);
create index if not exists aperturas_usuario_idx on public.aperturas (usuario_id, creado desc);
alter table public.aperturas enable row level security;
-- RLS activado y SIN políticas → solo el backend (service_role) accede.
