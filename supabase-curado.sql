-- supabase-curado.sql
-- Contenido curado a mano por el administrador: resúmenes profundos y bancos de
-- preguntas/ejercicios revisados. api/generar.js los sirve ANTES de tocar el caché
-- de Gemini o consumir cupo. Un banco por (materia, tema, modo, grado).
-- RLS on sin políticas → solo la service key accede (igual que el resto del proyecto).
create table if not exists contenido_curado (
  id bigserial primary key,
  materia_norm text not null,      -- normalizada (ver herramientas/normcurado.mjs)
  tema_norm text not null,
  modo text not null check (modo in ('resumen','retos','quiz','examen')),
  grado text not null,             -- '5to grado' | '1er año' (igual que gradoActivo())
  contenido jsonb not null,        -- resumen: documento completo; demás: { "items": [...] }
  fuentes jsonb,                   -- opcional: ["Guía de fracciones.pdf"] para el banner
  version int not null default 1,
  actualizado timestamptz default now(),
  unique (materia_norm, tema_norm, modo, grado)
);
alter table contenido_curado enable row level security;
-- Sin políticas públicas (solo service key, como todo lo demás).
