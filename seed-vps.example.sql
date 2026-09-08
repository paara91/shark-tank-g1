-- PLANTILLA — no contiene datos reales, es seguro que este archivo esté en el repositorio.
--
-- Cómo usarla:
-- 1. Copia este archivo y renómbralo a "seed-vps.local.sql" (ese nombre ya
--    está en .gitignore, nunca se va a subir a GitHub).
-- 2. Reemplaza los nombres de ejemplo por los reales.
-- 3. Pega el CONTENIDO de tu copia (no de este archivo) en el SQL Editor de
--    Supabase y dale "Run". Los nombres reales solo quedan en tu base de
--    datos de Supabase, nunca en el repositorio de GitHub.
--
-- El "id" es un identificador corto sin espacios ni tildes (se usa en los
-- enlaces personalizados, ej. tusitio.github.io/?vp=tecnica_innovacion).
-- El orden en que aparecen los botones en "Selecciona tu rol" es alfabético
-- por nombre, así que no hace falta definir un orden aparte.

insert into vp_directorio (id, nombre) values
('vp1', 'Nombre del VP 1'),
('vp2', 'Nombre del VP 2'),
('vp3', 'Nombre del VP 3'),
('vp4', 'Nombre del VP 4'),
('vp5', 'Nombre del VP 5'),
('vp6', 'Nombre del VP 6'),
('vp7', 'Nombre del VP 7'),
('vp8', 'Nombre del VP 8'),
('vp9', 'Nombre del VP 9')
on conflict (id) do update set nombre = excluded.nombre;
