-- supabase-avisos.sql — avisos al teléfono (MEJORAS 2, 18 y 19, 2026-11-12).
-- push_subs: una fila por teléfono suscrito. vinculo_id null = el teléfono del niño;
--            si no, el de un adulto (familia_vinculos.id) que sigue a ese niño.
-- push_enviados: qué aviso ya se mandó a cada teléfono (no repetir el mismo motivo).
create table if not exists public.push_subs (
  id          bigint generated always as identity primary key,
  usuario_id  bigint not null,
  vinculo_id  bigint,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  activo      boolean not null default true,
  creado      timestamptz not null default now(),
  unique (endpoint, usuario_id)
);
create index if not exists push_subs_usuario_idx on public.push_subs (usuario_id);
alter table public.push_subs enable row level security;

create table if not exists public.push_enviados (
  id      bigint generated always as identity primary key,
  sub_id  bigint not null,
  clave   text not null,
  creado  timestamptz not null default now(),
  unique (sub_id, clave)
);
alter table public.push_enviados enable row level security;
