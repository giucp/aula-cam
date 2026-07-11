-- aula-cam · F6 HARDENING (Chispa Universal) — aplicado por MCP. Doc de referencia.
-- Correr si se recrea el proyecto. 3 bloques: (1) search_path de funciones, (2) índice de FK,
-- (3) rate-limit anti-abuso.

-- (1) SEGURIDAD: fijar search_path en las funciones (advisor function_search_path_mutable).
--     pg_catalog se busca implícito primero → now()/nextval siguen resolviendo; lo no calificado cae en public.
alter function public.sumar_gasto_ia(p_id bigint, p_usd numeric) set search_path = public;
alter function public.sumar_reporte_ia(p_id bigint) set search_path = public;
alter function public.registrar_acceso(p_id bigint, p_nombre text, p_grado text, p_nombre_corto text, p_colegio_id bigint) set search_path = public;
alter function public.crear_cuenta_nativa(p_usuario text, p_nombre text, p_grado text, p_pass_hash text, p_codigo_hash text, p_colegio_id bigint) set search_path = public;
alter function public.tocar_acceso(p_id bigint) set search_path = public;

-- (2) PERFORMANCE: índice de cobertura para la FK usuarios.colegio_id (advisor unindexed_foreign_keys).
create index if not exists idx_usuarios_colegio on public.usuarios (colegio_id) where colegio_id is not null;

-- (3) ANTI-ABUSO: rate-limit por (acción + IP), ventana fija. Sin cron: cada llamada limpia los
--     expirados (la tabla se mantiene chica). La usa api/cuenta.js (registrar/login/recuperar/
--     solicitar_colegio) con FAIL-OPEN. RLS on → solo el backend.
create table if not exists public.rate_limit (
  clave   text primary key,
  n       int not null default 0,
  expira  timestamptz not null
);
alter table public.rate_limit enable row level security;
create index if not exists idx_rate_limit_expira on public.rate_limit (expira);

create or replace function public.rate_touch(p_clave text, p_limite int, p_ventana_seg int)
returns boolean language plpgsql security definer set search_path = public as $$
declare cnt int;
begin
  delete from public.rate_limit where expira < now();
  insert into public.rate_limit (clave, n, expira)
    values (p_clave, 1, now() + make_interval(secs => p_ventana_seg))
    on conflict (clave) do update set n = public.rate_limit.n + 1
    returning n into cnt;
  return cnt <= p_limite;   -- true = permitido
end; $$;

-- NOTA: el "RLS enabled, no policy" que marcan los advisors en casi todas las tablas es INTENCIONAL:
-- RLS on + sin políticas = el anon key no ve NADA; solo el backend con service_role (que salta RLS)
-- accede. NO agregar políticas (abriría acceso). /api/generar ya tiene su propio rate-limit por minuto.
