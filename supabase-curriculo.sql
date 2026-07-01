-- aula-cam · CURRÍCULO por grado (Supabase)
-- Correr una sola vez en el proyecto Supabase de aula-cam (SQL Editor).
-- Deja reposando el temario (materias, temas, actividades y PDFs) ANTES de que
-- reinicien el aula virtual con el año escolar nuevo, para que los niños puedan
-- "adelantar materias en vacaciones". NO usa la IA: guarda el material tal cual.

-- Una fila por (grado, materia). "temas" trae toda la estructura real del curso
-- (secciones/temas + módulos/actividades), y cada módulo con PDF referencia su
-- archivo por sha1 (los binarios se guardan aparte, deduplicados).
create table if not exists public.curriculo (
  grado        text   not null,           -- "4to grado", etc. (derivado del shortname)
  materia_id   bigint not null,           -- id del curso en Moodle (snapshot de hoy)
  materia      text,                       -- nombre completo de la materia
  nombre_corto text,                       -- shortname (ej "4G")
  temas        jsonb  not null,            -- [{seccion, resumenHtml, modulos:[{id,nombre,tipo,descripcionHtml,url,archivos,pdf(sha1)}]}]
  actualizado  timestamptz not null default now(),
  primary key (grado, materia_id)
);
alter table public.curriculo enable row level security;
create index if not exists idx_curriculo_grado on public.curriculo (grado);

-- PDFs/guías del currículo, deduplicados por hash (base64). Un mismo PDF usado en
-- varios módulos/materias se guarda una sola vez.
create table if not exists public.curriculo_archivos (
  sha1    text primary key,               -- sha1 del contenido del PDF
  nombre  text,
  mime    text,
  bytes   int,
  datos   text not null,                  -- contenido en base64
  creado  timestamptz not null default now()
);
alter table public.curriculo_archivos enable row level security;

-- Privacidad: RLS activado y SIN políticas → ni anon ni público leen/escriben.
-- Solo el service_role (backend con SUPABASE_SERVICE_KEY) pasa por encima de RLS.
-- Son guías de clase de menores: quedan accesibles SOLO desde el backend.
