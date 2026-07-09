-- Chispa · CATÁLOGO DE COLEGIOS (fundación multi-colegio, Fase 0/1 del PLAN-CHISPA-UNIVERSAL)
-- Correr una vez (o vía MCP apply_migration). 100% ADITIVO: nada del código actual lee estas
-- columnas/tabla todavía → el funcionamiento vigente (login Moodle del CAM, RPC registrar_acceso,
-- select * de usuarios) NO cambia. Solo prepara el terreno para que un usuario pueda pertenecer a
-- un colegio y tener una "fuente" (moodle / manual), y para que la URL+mapeo de grados del aula
-- dejen de estar hardcodeados en api/moodle.js y pasen a ser DATOS.

-- ───────── colegios: un colegio (con o sin aula virtual) ─────────
create table if not exists public.colegios (
  id           bigserial primary key,
  nombre       text not null,
  ciudad       text,
  estado       text,                              -- estado/provincia
  tiene_moodle boolean not null default false,    -- ¿su aula virtual es Moodle conectable?
  moodle_url   text,                              -- base URL del Moodle, SIN barra final
  mapeo_grados jsonb,                             -- reglas para derivar grado del shortname del curso
  verificado   boolean not null default false,    -- probado/aprobado por nosotros (anti-SSRF: solo se
                                                  --   conecta a colegios verificados)
  creado       timestamptz not null default now()
);
alter table public.colegios enable row level security;
-- RLS activado y SIN políticas → solo el backend (service_role) accede.

-- Siembra: el colegio actual. mapeo_grados replica el regex ya usado en moodle.js
-- (gradoDeCursos): shortname tipo "4G"/"1A" → G=grado, A=año.
insert into public.colegios (nombre, tiene_moodle, moodle_url, mapeo_grados, verificado)
select 'U.E. Arzobispo Méndez', true,
       'https://aulacam.uearzobispomendez.edu.ve',
       '{"patron":"([1-6])\\s*([GA])\\b","sufijos":{"G":"grado","A":"año"}}'::jsonb,
       true
where not exists (
  select 1 from public.colegios
  where moodle_url = 'https://aulacam.uearzobispomendez.edu.ve'
);

-- ───────── usuarios: generalización (columnas nullable, aditivas) ─────────
-- colegio_id : a qué colegio pertenece (null = todavía sin colegio / Camino B a futuro)
-- fuente     : 'moodle' (aula virtual conectada) | 'manual' (apuntes/fotos, Camino B a futuro)
-- auth_id    : futura cuenta propia de Chispa (Supabase Auth). Reservada; sin FK aún (se agrega
--              la constraint cuando se cablee la autenticación en Fase 1).
alter table public.usuarios
  add column if not exists colegio_id bigint references public.colegios(id),
  add column if not exists fuente     text not null default 'moodle',
  add column if not exists auth_id    uuid;

-- Backfill: los usuarios actuales son del CAM vía Moodle.
update public.usuarios
set colegio_id = (
  select id from public.colegios
  where moodle_url = 'https://aulacam.uearzobispomendez.edu.ve' limit 1
)
where colegio_id is null;
