-- supabase-familia.sql — Panel de familia (padres): acceso de SOLO LECTURA de un adulto
-- a lo que hizo un niño. Aplicado por MCP el 2026-07-09 (migración familia_vinculos).
--
-- Ciclo de vida de una fila:
--   1) El niño invita (api/familia "invitar", auth por su token de Moodle) → se crea la fila
--      con `code` (corto, legible) + `code_expira` (24 h). `token` NULL todavía.
--   2) El padre canjea el link/código (api/familia "canjear") → se setea `token` (persistente,
--      guardado en el dispositivo del padre), se borran `code`/`code_expira` (1 solo uso).
--   3) El padre ve el panel (api/familia "panel", con su `token`) → SOLO LECTURA del niño.
--   4) El niño puede revocar (api/familia "revocar") → `activo=false`, `token=null`.
--
-- RLS on sin políticas: solo el service_role (los endpoints) accede. El token del padre
-- mapea a UN solo usuario_id; el padre nunca escribe nada del niño.

create table if not exists familia_vinculos (
  id bigint generated always as identity primary key,
  usuario_id bigint not null,            -- el niño (usuarios.id / userid de Moodle)
  code text unique,                      -- código de invitación corto (se borra al canjear)
  code_expira timestamptz,               -- validez del código de invitación
  token text unique,                     -- token persistente del padre (se setea al canjear)
  alias text,                            -- "Mamá", "Papá" (opcional)
  activo boolean not null default true,
  creado timestamptz not null default now(),
  ultimo_acceso timestamptz
);
create index if not exists familia_vinculos_uid_idx on familia_vinculos (usuario_id);
create index if not exists familia_vinculos_token_idx on familia_vinculos (token);
create index if not exists familia_vinculos_code_idx on familia_vinculos (code);
alter table familia_vinculos enable row level security;
