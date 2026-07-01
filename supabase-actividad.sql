-- Registro de actividad por niño: qué hizo, en qué tema, y cómo le fue.
-- Alimenta la ruta de aprendizaje (paso sugerido) y las marcas ✓/⭐ en los temas.
-- Correr una vez en el SQL Editor del proyecto de aula-cam.
create table if not exists actividad (
  id bigserial primary key,
  usuario_id bigint not null,
  materia text,
  tema text not null,
  grado text,
  modo text not null check (modo in ('resumen','retos','quiz','examen')),
  aciertos int,          -- solo quiz
  total int,             -- solo quiz
  creado timestamptz default now()
);
create index if not exists actividad_usuario_idx on actividad (usuario_id, materia, tema);
alter table actividad enable row level security;
-- Sin políticas públicas: solo el service key del servidor escribe/lee (mismo criterio
-- que las demás tablas del proyecto).
