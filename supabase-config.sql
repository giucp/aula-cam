-- supabase-config.sql — tabla de configuración editable por el admin (clave/valor jsonb).
-- Hoy guarda el texto de presentación del espacio Cumbre (clave 'cumbre_intro'), que la
-- app muestra al entrar a Cumbre. El admin edita los campos desde el Table Editor sin
-- tocar código. Si la fila no existe, el server usa un default incrustado (la app funciona
-- igual). RLS on sin políticas → solo la service key (del backend) accede.

create table if not exists public.config (
  clave text primary key,
  valor jsonb not null,
  actualizado timestamptz default now()
);

alter table public.config enable row level security;

-- Texto público de Cumbre (editable). Campos: titulo, bajada, texto_nino, texto_padre, cierre.
insert into public.config (clave, valor) values
('cumbre_intro', '{
  "titulo": "Cumbre 🏔️",
  "bajada": "La mejor educación del mundo, para ti.",
  "texto_nino": "Cumbre es un lugar para aprender más y llegar más alto. Aquí cada materia está pensada como la enseñan los mejores colegios del mundo: aprenderás no solo QUÉ cosas son, sino POR QUÉ funcionan, cómo se conectan entre sí y cómo pensar como lo hacen los que más saben. No es tarea del colegio ni tiene nota: es tuyo, para cuando quieras retarte y descubrir de qué eres capaz.",
  "texto_padre": "El contenido de Cumbre se construye tomando lo mejor de los sistemas educativos con mejores resultados del mundo —como Singapur, el Bachillerato Internacional (IB) y Japón, entre otros— y adaptándolo con cuidado a la edad de cada niño. Cada tema se organiza como lo hacen esos sistemas (por grandes ideas conectadas, no por temas sueltos) y crece en profundidad grado a grado, de modo que volver a una materia el año siguiente siempre ofrece un nivel más alto. Todo el material es revisado por una persona antes de estar disponible.",
  "cierre": "Empieza por donde quieras. En Cumbre no se trata de correr, sino de llegar alto. ✨"
}')
on conflict (clave) do nothing;
