-- supabase-cumbre.sql
-- Cimientos de "Cumbre" (currículo de élite): separa su contenido curado del
-- contenido del aula venezolana con una columna "programa".
--   'aula'   = contenido curado del temario venezolano (TODO lo que ya existe).
--   'cumbre' = currículo de élite (Cumbre). No se sirve a las alumnas por el flujo
--              normal (el backend filtra programa='aula'); vive aparte hasta publicarlo.
-- Al agregar la columna con default 'aula', TODAS las filas existentes quedan como
-- 'aula' automáticamente. No hay que tocar nada más.
alter table public.contenido_curado
  add column if not exists programa text not null default 'aula';

-- Nota: la unique key (materia_norm, tema_norm, modo, grado) NO cambia. Cumbre usa un
-- grado propio ("Cumbre Matemática 1er año"), distinto de los grados del aula, así que
-- nunca colisiona con lo existente aunque el nombre del tema coincida.
