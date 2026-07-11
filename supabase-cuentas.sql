-- Chispa · CUENTA PROPIA (fundación de F1, PLAN-CHISPA-UNIVERSAL)
-- Correr una vez (o vía MCP apply_migration). 100% ADITIVO: nada del login actual lee estas
-- columnas todavía → el flujo vigente (login por Moodle del CAM) NO cambia. Prepara el terreno
-- para que un niño tenga cuenta propia de Chispa (usuario+clave, SIN email) y el aula virtual
-- pase a ser un "conector" opcional.

-- ───────── modelo de cuenta ─────────
-- usuario              : nombre de usuario para el login nativo (único, case-insensitive).
-- plan                 : tier de acceso. 'gratis' (agenda/tareas/horario/notas de examen, SIN IA
--                        ni Cumbre ni contenido curado) | 'premium' (todo). El desbloqueo a premium
--                        es MANUAL por ahora (#lab); el esquema queda listo para códigos de acceso.
-- codigo_rescate_hash  : hash del código de rescate que se muestra UNA sola vez al registrarse
--                        (recuperación sin email; también se puede resetear desde #lab).
-- moodle_userid        : id de Moodle del conector. Separa la PK de la app del id del aula: una
--                        cuenta nativa usa un id propio (secuencia) y guarda su moodle_userid aparte
--                        SOLO si enlaza un aula.
alter table public.usuarios
  add column if not exists usuario              text,
  add column if not exists plan                 text not null default 'gratis',
  add column if not exists codigo_rescate_hash  text,
  add column if not exists moodle_userid        bigint;

create unique index if not exists usuarios_usuario_uniq
  on public.usuarios (lower(usuario)) where usuario is not null;

-- Backfill de los usuarios actuales (login por Moodle): son premium; su id ES su userid de Moodle.
update public.usuarios set plan = 'premium' where autorizado = true;
update public.usuarios set moodle_userid = id where fuente = 'moodle' and moodle_userid is null;

-- Ids para cuentas NATIVAS (no-Moodle): arrancan altos para no colisionar con userids de Moodle.
create sequence if not exists public.usuarios_nativos_seq start with 1000000;

-- NOTA de convivencia: por ahora `autorizado` sigue siendo el gate LEGACY del login por Moodle
-- (en api/moodle.js). El nuevo gate de tier es `plan` y se aplicará EN EL SERVIDOR (endpoints de
-- IA/Cumbre/curado) cuando se construya el login nativo. Al terminar F1 se unifica/deprecia `autorizado`.

-- ───────── auth propia (migración auth_nativa_f1) ─────────
-- pass_hash: hash scrypt de la contraseña (formato "scrypt$<salt hex>$<hash hex>"). Lo usa api/cuenta.js.
alter table public.usuarios add column if not exists pass_hash text;

-- ───────── onboarding (F4, migración usuarios_onboarding_f4) ─────────
-- onboarding: ¿el niño ya vio el tutorial de bienvenida? Solo aplica a cuentas nativas (Camino B);
-- las cuentas de aula lo ignoran. Se marca true vía api/cuenta accion "onboarding_visto". Las filas
-- existentes se backfillearon a true (preceden al onboarding). Persistir por usuario (no localStorage)
-- evita que el tutorial se repita al cambiar de aparato (lección del tutorial de Sinapsis).
alter table public.usuarios add column if not exists onboarding boolean not null default false;
-- update public.usuarios set onboarding = true;  -- (backfill ya aplicado en la migración)

-- Crea una cuenta NATIVA (no-Moodle) de forma atómica: id de usuarios_nativos_seq + insert.
-- Devuelve el id nuevo, o NULL si el usuario ya existe (unique_violation sobre lower(usuario)).
create or replace function public.crear_cuenta_nativa(
  p_usuario text, p_nombre text, p_grado text, p_pass_hash text,
  p_codigo_hash text, p_colegio_id bigint default null
) returns bigint language plpgsql as $$
declare new_id bigint; hoy date := (now() at time zone 'America/Caracas')::date;
begin
  new_id := nextval('public.usuarios_nativos_seq');
  insert into public.usuarios
    (id, usuario, nombre, grado, pass_hash, codigo_rescate_hash, colegio_id, fuente, plan, racha_dias, racha_ultimo, autorizado)
  values
    (new_id, lower(trim(p_usuario)), p_nombre, p_grado, p_pass_hash, p_codigo_hash, p_colegio_id, 'manual', 'gratis', 1, hoy, false);
  return new_id;
exception when unique_violation then
  return null;
end; $$;

-- Registra un acceso de una cuenta ya existente (nativa): ultimo_acceso + accesos + RACHA (misma
-- lógica que registrar_acceso), SIN tocar nombre/grado. Devuelve la racha nueva. La usa cuenta.js.
create or replace function public.tocar_acceso(p_id bigint)
returns integer language plpgsql as $$
declare hoy date := (now() at time zone 'America/Caracas')::date; nueva int;
begin
  update public.usuarios set
    ultimo_acceso = now(),
    accesos = accesos + 1,
    racha_dias = case
                   when racha_ultimo = hoy then racha_dias
                   when racha_ultimo = hoy - 1 then racha_dias + 1
                   else 1 end,
    racha_ultimo = hoy
  where id = p_id
  returning racha_dias into nueva;
  return coalesce(nueva, 0);
end; $$;
