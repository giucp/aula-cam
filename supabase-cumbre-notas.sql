-- ============================================================
-- CHISPA (aula-cam) · notas del "Demuestra" (quiz) de CUMBRE
-- Por qué: la nota de cada tema de Cumbre debe SEGUIR al niño en cualquier
-- dispositivo (va por usuario_id). Tabla APARTE de `actividad` para no mezclar
-- con el progreso del aula. Se guarda cada intento; la MEJOR se calcula al leer.
-- Correr en el SQL Editor del proyecto Supabase de CHISPA (xrkrwiolf...).
-- Idempotente. RLS on sin políticas → solo el backend (service key) accede.
-- ============================================================

create table if not exists public.cumbre_notas (
  id         bigserial primary key,
  usuario_id bigint not null,
  materia    text,
  tema       text,
  aciertos   int,
  total      int,
  creado     timestamptz not null default now()
);
create index if not exists cumbre_notas_uid on public.cumbre_notas (usuario_id);
alter table public.cumbre_notas enable row level security;

-- Verificación:
-- select count(*) from public.cumbre_notas;
