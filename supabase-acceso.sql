-- supabase-acceso.sql
-- Control de acceso por código de invitación. Agrega la marca "autorizado" a los
-- usuarios y pre-autoriza a las hijas del administrador para que no tengan que
-- escribir el código.
--
-- El candado se ACTIVA solo cuando exista la variable ACCESO_CODIGO en Vercel.
-- Mientras no esté, todo sigue igual (cualquiera con clave del aula entra).

alter table usuarios add column if not exists autorizado boolean not null default false;

-- Pre-autorizar a las hijas (userids reales de Moodle): Martina 118, Alessandra 211.
update usuarios set autorizado = true where id in (118, 211);
