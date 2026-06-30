-- aula-cam · tabla de caché de generaciones (Supabase)
-- Correr una sola vez en el proyecto Supabase de aula-cam (SQL Editor).
-- Guarda el resultado ya generado por Gemini para un (materia+tema+modo+grado+cantidad),
-- así un tema repetido NO vuelve a llamar a la IA ni a bajar PDFs.

create table if not exists public.cache_generaciones (
  clave     text primary key,            -- sha1 de materia|tema|modo|grado|cantidad
  materia   text,
  tema      text,
  modo      text,
  grado     text,
  cantidad  int,
  contenido jsonb not null,              -- la respuesta completa que sirve la API
  creado    timestamptz not null default now()
);

-- Privacidad: con RLS activado y SIN políticas, el rol público/anon NO puede leer ni
-- escribir. Solo el service_role (que usa la función serverless con SUPABASE_SERVICE_KEY)
-- pasa por encima de RLS. Es exactamente lo que queremos: acceso solo desde el backend.
alter table public.cache_generaciones enable row level security;

-- (Opcional) índice para limpiar por antigüedad si algún día querés un TTL:
create index if not exists idx_cache_creado on public.cache_generaciones (creado);
