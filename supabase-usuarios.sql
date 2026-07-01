-- aula-cam · tabla de USUARIOS (Supabase)
-- Correr una vez en el SQL Editor del proyecto de aula-cam.
-- Le da a cada niño su "espacio" en la base de datos (una fila), para poder
-- colgar acciones individuales a futuro. Solo identidad + accesos (sin datos
-- sensibles). Se llena solo cuando el niño inicia sesión.

create table if not exists public.usuarios (
  id            bigint primary key,            -- userid de Moodle (identifica al niño)
  nombre        text,
  grado         text,                          -- "4to grado", "1er año", etc.
  nombre_corto  text,                          -- token del grado, ej "4G" / "1A"
  creado        timestamptz not null default now(),
  ultimo_acceso timestamptz not null default now(),
  accesos       int not null default 1
);
alter table public.usuarios enable row level security;
-- RLS activado y SIN políticas → solo el backend (service_role) accede.

-- Registra un acceso: crea la fila la primera vez o actualiza nombre/grado,
-- pone la fecha del último acceso y suma 1 al contador. Atómico (upsert).
create or replace function public.registrar_acceso(
  p_id bigint, p_nombre text, p_grado text, p_nombre_corto text
) returns void language plpgsql as $$
begin
  insert into public.usuarios (id, nombre, grado, nombre_corto)
  values (p_id, p_nombre, p_grado, p_nombre_corto)
  on conflict (id) do update set
    nombre        = excluded.nombre,
    grado         = coalesce(excluded.grado, public.usuarios.grado),
    nombre_corto  = coalesce(excluded.nombre_corto, public.usuarios.nombre_corto),
    ultimo_acceso = now(),
    accesos       = public.usuarios.accesos + 1;
end; $$;
