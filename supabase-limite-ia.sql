-- supabase-limite-ia.sql
-- Límite DIARIO de gasto de IA por alumno, para que el proyecto sea sostenible (cobro
-- a los padres) y ningún niño se pase de unos pocos dólares al mes de Gemini.
--
-- Cómo funciona: cada llamada REAL a Gemini (no la caché ni las guías curadas, que
-- cuestan $0) se estima en dólares y se suma al gasto de HOY del alumno. Si el gasto del
-- día supera su tope (ia_limite_dia_usd), la app deja de GENERAR con IA para ese niño
-- hasta el día siguiente (el cupo se reinicia cada día) — pero sigue sirviéndole guías
-- revisadas y lo ya cacheado (gratis). Un tope diario ~$0.20 → como mucho ~$6/mes.
--
-- Controles (los manejás a mano en el Table Editor de Supabase):
--   ia_ilimitado = true      → ese alumno NUNCA se corta (tus hijas y quien vos elijas).
--   ia_limite_dia_usd = 0.20 → tope de HOY en dólares; subilo/bajalo por niño.
-- El gasto (ia_gasto_dia_usd / ia_dia) lo maneja solo el backend; no lo toques.

alter table public.usuarios
  add column if not exists ia_ilimitado      boolean       not null default false,
  add column if not exists ia_limite_dia_usd numeric(6,4)  not null default 0.20,
  add column if not exists ia_gasto_dia_usd  numeric(12,6) not null default 0,
  add column if not exists ia_dia            text;

-- Las hijas del administrador nunca se limitan (Martina 118, Alessandra 211).
update public.usuarios set ia_ilimitado = true where id in (118, 211);

-- Suma el costo (en USD) de una generación al gasto de HOY del alumno. Atómico.
-- El "día" es el día civil de Venezuela (UTC-4). Si cambió de día, reinicia el gasto.
create or replace function public.sumar_gasto_ia(p_id bigint, p_usd numeric)
returns void language plpgsql as $$
declare
  hoy text := to_char(now() at time zone 'America/Caracas', 'YYYY-MM-DD');
begin
  update public.usuarios set
    ia_gasto_dia_usd = case when ia_dia is distinct from hoy
                            then p_usd
                            else coalesce(ia_gasto_dia_usd, 0) + p_usd end,
    ia_dia           = hoy
  where id = p_id;
end; $$;

-- ── CAP de regeneraciones POR REPORTE con Gemini 2.5 Pro (2026-07-08) ───────────────────
-- La bandera 🚩 Reportar regenera SOLO ese ejercicio con Pro (más confiable) — pero Pro es
-- ~4× más caro que Flash. Para no castigar la batería del niño por 1 error nuestro/de Gemini,
-- el backend COBRA esa regeneración a la batería a tarifa Flash; el costo real de Pro lo
-- absorbe el proyecto, ACOTADO a CAP_REPORTE_PRO (=3) regeneraciones Pro por alumno y día.
-- Pasado el tope, el reporte igual regenera pero por el flujo normal (Flash), sin gasto Pro.
-- El contador (reportes_ia_dia / reportes_ia_fecha) lo maneja solo el backend; no lo toques.
alter table public.usuarios
  add column if not exists reportes_ia_dia   int  not null default 0,
  add column if not exists reportes_ia_fecha text;

-- Suma 1 al contador de regeneraciones Pro por reporte de HOY del alumno. Reinicia por día.
create or replace function public.sumar_reporte_ia(p_id bigint)
returns void language plpgsql as $$
declare
  hoy text := to_char(now() at time zone 'America/Caracas', 'YYYY-MM-DD');
begin
  update public.usuarios set
    reportes_ia_dia   = case when reportes_ia_fecha is distinct from hoy then 1
                             else coalesce(reportes_ia_dia, 0) + 1 end,
    reportes_ia_fecha = hoy
  where id = p_id;
end; $$;
