-- supabase-misiones.sql — misiones que manda un adulto desde el panel de familia (MEJORAS 20, 2026-11-12).
-- Una misión activa por niño a la vez (la nueva desactiva la anterior pendiente). hecha_en se llena
-- cuando el niño estudia esa materia/tema desde la app.
create table if not exists public.misiones (
  id          bigint generated always as identity primary key,
  usuario_id  bigint not null,
  vinculo_id  bigint,
  materia     text not null,
  tema        text,
  modo        text,
  nota        text,
  activa      boolean not null default true,
  creada      timestamptz not null default now(),
  hecha_en    timestamptz
);
create index if not exists misiones_usuario_idx on public.misiones (usuario_id, creada desc);
alter table public.misiones enable row level security;
