-- Chispa · CAMINO B (F2 del PLAN-CHISPA-UNIVERSAL): niños SIN aula virtual.
-- Materias creadas a mano + apuntes (fotos/texto) que alimentan la IA + temas detectados.
-- Aditivo, RLS on (solo el backend con service key). La API es api/manual.js (auth por token de sesión).

create table if not exists public.materias_manuales (
  id         bigserial primary key,
  usuario_id bigint not null,
  nombre     text not null,
  emoji      text,
  color      text,
  archivada  boolean not null default false,
  creado     timestamptz not null default now()
);
create index if not exists materias_manuales_usuario on public.materias_manuales(usuario_id);
alter table public.materias_manuales enable row level security;

-- apuntes: fotos (a Supabase Storage) o texto libre. La IA (premium) los procesa → extraido.
create table if not exists public.apuntes (
  id           bigserial primary key,
  usuario_id   bigint not null,
  materia      text,
  tipo         text not null,                     -- 'foto' | 'texto'
  storage_path text,                              -- ruta en Storage (fotos)
  texto        text,                              -- texto libre (tipo='texto')
  extraido     jsonb,                             -- lo que la IA sacó (tema, conceptos, ocr)
  estado       text not null default 'pendiente', -- 'pendiente' | 'procesado' | 'error'
  creado       timestamptz not null default now()
);
create index if not exists apuntes_usuario on public.apuntes(usuario_id);
alter table public.apuntes enable row level security;

-- temas detectados: el "temario" del Camino B (equivale a lo que en Moodle sale del aula).
create table if not exists public.temas_detectados (
  id         bigserial primary key,
  usuario_id bigint not null,
  materia    text,
  tema       text not null,
  origen     text,                                -- 'apunte' | 'manual'
  apunte_ids bigint[],
  creado     timestamptz not null default now()
);
create index if not exists temas_detectados_usuario on public.temas_detectados(usuario_id, materia);
alter table public.temas_detectados enable row level security;
