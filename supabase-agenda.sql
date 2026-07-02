-- supabase-agenda.sql
-- Escritorio diario: horario semanal + tareas/trabajos/exámenes del alumno.
-- RLS on sin políticas → solo la service key (el backend) accede, como todo lo demás.

-- Horario: qué materias tiene el alumno cada día (1=lunes … 7=domingo).
-- Se reemplaza completo al guardar desde la app (delete + insert por usuario).
create table if not exists horario (
  usuario_id bigint not null,
  dia smallint not null check (dia between 1 and 7),
  materia text not null,
  orden smallint not null default 1,
  primary key (usuario_id, dia, materia)
);
alter table horario enable row level security;

-- Tareas: lo que el niño transcribe de su cuaderno de tareas.
-- tipo 'examen' alimenta el aviso "tienes examen en N días → ¿simulamos uno?".
create table if not exists tareas (
  id bigserial primary key,
  usuario_id bigint not null,
  materia text,
  descripcion text not null,
  tipo text not null default 'tarea' check (tipo in ('tarea','trabajo','examen')),
  fecha date,
  hecha boolean not null default false,
  creado timestamptz default now()
);
create index if not exists tareas_usuario_idx on tareas (usuario_id, hecha, fecha);
alter table tareas enable row level security;
