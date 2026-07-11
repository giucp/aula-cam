-- aula-cam · SOLICITUDES DE COLEGIO (Chispa Universal, F3) — para "quiero que agreguen mi colegio"
-- Aplicada por MCP (migración solicitudes_colegio_f3). Correr una vez si se recrea el proyecto.
-- Un niño/representante cuyo colegio no está en Chispa pide que lo agreguemos. Nosotros lo
-- revisamos desde el panel #lab (pestaña Solicitudes) y, si tiene aula virtual conectable,
-- lo damos de alta en la tabla `colegios`. RLS on sin políticas → solo el backend lo toca.

create table if not exists public.solicitudes_colegio (
  id          bigserial primary key,
  colegio     text not null,            -- nombre del colegio que piden agregar
  ciudad      text,
  estado      text,                     -- estado/región de Venezuela
  tiene_aula  boolean,                  -- ¿el colegio tiene aula virtual (Moodle)?
  moodle_url  text,                     -- URL del aula si quien pide la conoce (opcional)
  contacto    text,                     -- nombre / whatsapp / email de quien pide (opcional)
  nota        text,                     -- comentario libre (opcional)
  origen_uid  bigint,                   -- usuario_id si vino de una cuenta logueada (opcional)
  atendida    boolean not null default false,
  creado      timestamptz not null default now()
);
alter table public.solicitudes_colegio enable row level security;
create index if not exists idx_solicitudes_creado on public.solicitudes_colegio (creado desc);
-- RLS activado y SIN políticas → solo el backend (service_role) accede.
