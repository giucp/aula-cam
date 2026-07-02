-- supabase-notas.sql
-- Notas de exámenes entregados (sobre 20), registro manual del alumno/padre.
-- Alimenta el escritorio: última nota por materia + "ese tema se puede reforzar".
-- Sin fotos del examen en v1 (privacidad/peso); la nota numérica da el valor.
-- RLS on sin políticas → solo la service key (el backend) accede.
create table if not exists notas (
  id bigserial primary key,
  usuario_id bigint not null,
  materia text,
  descripcion text,
  nota numeric(4,1) not null check (nota >= 0 and nota <= 20),
  fecha date,
  creado timestamptz default now()
);
create index if not exists notas_usuario_idx on notas (usuario_id, fecha desc);
alter table notas enable row level security;
