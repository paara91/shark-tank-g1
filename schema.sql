-- Esquema de base de datos de Shark Tank G1 (Supabase / PostgreSQL).
-- Se ejecuta UNA vez en un proyecto nuevo (SQL Editor de Supabase -> Run).
-- Refleja el estado actual de la app: votacion directa de 3 opciones
-- (Priorizar / Resolver barreras / Descartar) + notas del facilitador.

-- Directorio de roles que aparecen como botones en "Selecciona tu rol".
-- (Son cargos, no nombres de personas.)
create table vp_directorio (
  id text primary key,
  nombre text not null
);

-- Quien esta conectado ahora mismo. Un VP usa id fijo 'vp-<id>' (asi una
-- reconexion reutiliza su fila); invitados y facilitador usan un uuid.
create table sala (
  participante_id text primary key,
  vp_id text references vp_directorio(id),
  nombre_mostrado text not null,
  rol text not null check (rol in ('vp','invitado','facilitador')),
  conectado_en timestamptz not null default now()
);

-- Iniciativas de la ronda actual.
create table iniciativas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  orden int not null default 0,
  creado_en timestamptz not null default now()
);

-- Estado global de la sesion: una sola fila (id = 1).
-- fase: 'espera' (QR / preparando) -> 'votando' -> 'reveal' (resultados).
create table estado_sesion (
  id int primary key default 1,
  iniciativa_activa_id uuid references iniciativas(id) on delete set null,
  fase text not null default 'espera' check (fase in ('espera','votando','reveal')),
  ronda_id uuid not null default gen_random_uuid(),
  constraint solo_una_fila check (id = 1)
);
insert into estado_sesion (id) values (1);

-- Un voto por participante por iniciativa.
create table votos (
  iniciativa_id uuid not null references iniciativas(id) on delete cascade,
  participante_id text not null references sala(participante_id) on delete cascade,
  voto text check (voto in ('priorizar','resolver','descartar')),
  creado_en timestamptz not null default now(),
  primary key (iniciativa_id, participante_id)
);

-- Decision final del facilitador y sus notas de la discusion, por iniciativa.
-- decision_id puede ser nulo: se puede escribir una nota antes de decidir.
create table decisiones (
  iniciativa_id uuid primary key references iniciativas(id) on delete cascade,
  decision_id text,
  nota text,
  decidido_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SEGURIDAD: a proposito, SIN restricciones (ver README.md, seccion
-- "Pendientes de seguridad"). Supabase activa RLS por defecto en tablas
-- nuevas y bloquea todo; aqui se apaga porque es una demo sin autenticacion.
-- Una version formal debe reemplazar esto por politicas reales.
-- ---------------------------------------------------------------------
alter table vp_directorio disable row level security;
alter table sala disable row level security;
alter table iniciativas disable row level security;
alter table estado_sesion disable row level security;
alter table votos disable row level security;
alter table decisiones disable row level security;

-- Tiempo real (websocket): avisa a los celulares cuando algo cambia.
alter publication supabase_realtime add table iniciativas, estado_sesion, votos, decisiones, sala;

-- Roles del Comite (cargos). Ajustar si cambian.
insert into vp_directorio (id, nombre) values
('presidente', 'Presidente'),
('tecnica_innovacion', 'VP Técnica e Innovación'),
('generacion_demanda', 'VP Generación Demanda'),
('logistica_fp', 'VP Logística y FP'),
('ventas', 'VP Ventas'),
('gestion_humana', 'VP Gestión Humana'),
('administrativa_financiera', 'VP Administrativa y Financiera'),
('juridica_ac', 'VP Jurídica y AC'),
('coe', 'COE'),
('riesgos_cumplimiento', 'Gestión Riesgos y Cumplimiento');
