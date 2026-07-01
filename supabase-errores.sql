-- aula-cam · ERRORES por alumno (Supabase) — para "Repasar mis errores"
-- Correr una vez en el SQL Editor del proyecto de aula-cam.
-- Guarda las preguntas de quiz que cada niño FALLÓ, para que pueda repasarlas
-- con la explicación paso a paso. Se dedup por (usuario + pregunta): si vuelve a
-- fallar la misma, se actualiza, no se duplica.

create table if not exists public.errores (
  id          bigserial primary key,
  usuario_id  bigint not null,             -- userid de Moodle (de la tabla usuarios)
  clave       text not null,               -- sha1(usuario_id|pregunta) para dedup
  materia     text,
  tema        text,
  grado       text,
  pregunta    text not null,
  opciones    jsonb,
  correcta    int,
  elegida     int,
  explicacion text,                        -- cómo se resuelve / aclaración
  figura      text,                        -- SVG opcional
  numerica    boolean default false,
  creado      timestamptz not null default now(),
  unique (usuario_id, clave)
);
alter table public.errores enable row level security;
create index if not exists idx_errores_usuario on public.errores (usuario_id);
-- RLS activado y SIN políticas → solo el backend (service_role) accede.
