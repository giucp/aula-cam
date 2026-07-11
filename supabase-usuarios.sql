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

-- NOTA: las columnas colegio_id / fuente / auth_id se agregan en supabase-colegios.sql
-- (fundación multi-colegio, PLAN-CHISPA-UNIVERSAL). Esta tabla nació solo con identidad Moodle.

-- Columnas de RACHA (días seguidos), agregadas por migración 20260707205413:
--   racha_dias  int not null default 0,  racha_ultimo date
-- ⚠️ IMPORTANTE: la lógica de racha VIVE DENTRO de este RPC (abajo). Si alguna vez reescribís
-- registrar_acceso, NO la borres (una vez se perdió al reconstruir la función desde una versión
-- vieja de este archivo → la racha quedó congelada hasta que se restauró).

-- Registra un acceso: crea la fila la primera vez o actualiza nombre/grado/colegio, pone la fecha
-- del último acceso, suma 1 al contador y ACTUALIZA LA RACHA de días seguidos. Atómico (upsert).
-- p_colegio_id (opcional): a qué colegio pertenece; solo se setea en el INSERT o si estaba null.
-- Racha (zona horaria Caracas): mismo día → sin cambio; ayer → +1; hueco → reinicia a 1.
create or replace function public.registrar_acceso(
  p_id bigint, p_nombre text, p_grado text, p_nombre_corto text,
  p_colegio_id bigint default null
) returns void language plpgsql as $$
declare hoy date := (now() at time zone 'America/Caracas')::date;
begin
  insert into public.usuarios (id, nombre, grado, nombre_corto, colegio_id, racha_dias, racha_ultimo)
  values (p_id, p_nombre, p_grado, p_nombre_corto, p_colegio_id, 1, hoy)
  on conflict (id) do update set
    nombre        = excluded.nombre,
    grado         = coalesce(excluded.grado, public.usuarios.grado),
    nombre_corto  = coalesce(excluded.nombre_corto, public.usuarios.nombre_corto),
    colegio_id    = coalesce(public.usuarios.colegio_id, excluded.colegio_id),
    ultimo_acceso = now(),
    accesos       = public.usuarios.accesos + 1,
    racha_dias    = case
                      when public.usuarios.racha_ultimo = hoy then public.usuarios.racha_dias
                      when public.usuarios.racha_ultimo = hoy - 1 then public.usuarios.racha_dias + 1
                      else 1 end,
    racha_ultimo  = hoy;
end; $$;
