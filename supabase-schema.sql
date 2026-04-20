-- ============================================================
-- Juanfer OS — Esquema SQL para Supabase
-- ============================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensiones
create extension if not exists "uuid-ossp";

-- ============================================================
-- CLIENTES
-- ============================================================
create table if not exists clientes (
  id          uuid primary key default uuid_generate_v4(),
  nombre      text not null,
  tipo        text not null check (tipo in ('recurrente', 'unico')),
  color       text not null default '#c8922a',
  created_at  timestamptz not null default now()
);

-- ============================================================
-- PROYECTOS
-- ============================================================
create table if not exists proyectos (
  id              uuid primary key default uuid_generate_v4(),
  nombre          text not null,
  descripcion     text,
  cliente_id      uuid references clientes(id) on delete set null,
  estado          text not null default 'activo' check (estado in ('activo', 'pausado', 'finalizado')),
  prioridad       text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  fecha_inicio    date,
  fecha_fin       date,
  tipo_cobro      text not null check (tipo_cobro in ('recurrente', 'unico')),
  valor_mensual   numeric(14,2) default 0,
  valor_total     numeric(14,2) default 0,
  currency        text not null default 'COP' check (currency in ('COP', 'USD')),
  color           text not null default '#c8922a',
  horas_logged    numeric(8,2) not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- TAREAS
-- ============================================================
create table if not exists tareas (
  id               uuid primary key default uuid_generate_v4(),
  titulo           text not null,
  descripcion      text,
  proyecto_id      uuid references proyectos(id) on delete cascade,
  estado           text not null default 'pendiente' check (estado in ('pendiente', 'en_progreso', 'completada')),
  prioridad        text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  fecha_limite     date,
  tiempo_estimado  integer not null default 60,  -- minutos
  tiempo_real      integer not null default 0,   -- minutos
  fecha            date not null default current_date,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- FORMACION
-- ============================================================
create table if not exists formacion (
  id               uuid primary key default uuid_generate_v4(),
  tema             text not null,
  area             text not null,
  fecha            date not null default current_date,
  tiempo_estimado  integer not null default 60,  -- minutos
  tiempo_real      integer not null default 0,   -- minutos
  notas            text,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- CONFIGURACION (una sola fila por usuario)
-- ============================================================
create table if not exists configuracion (
  id                      uuid primary key default uuid_generate_v4(),
  formacion_meta_horas    integer not null default 10,
  capacidad_total_horas   integer not null default 40,
  created_at              timestamptz not null default now()
);

-- Insertar fila por defecto
insert into configuracion (formacion_meta_horas, capacidad_total_horas)
values (10, 40)
on conflict do nothing;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Solo el usuario autenticado accede a sus datos.
-- Como la app es personal (un solo usuario), simplificamos
-- con una política que permite todo a usuarios autenticados.

alter table clientes      enable row level security;
alter table proyectos     enable row level security;
alter table tareas        enable row level security;
alter table formacion     enable row level security;
alter table configuracion enable row level security;

-- Políticas: solo usuarios autenticados
create policy "auth_clientes"      on clientes      for all to authenticated using (true) with check (true);
create policy "auth_proyectos"     on proyectos     for all to authenticated using (true) with check (true);
create policy "auth_tareas"        on tareas        for all to authenticated using (true) with check (true);
create policy "auth_formacion"     on formacion     for all to authenticated using (true) with check (true);
create policy "auth_configuracion" on configuracion for all to authenticated using (true) with check (true);

-- ============================================================
-- DATOS DE EJEMPLO (opcional — borrar en prod)
-- ============================================================
insert into clientes (nombre, tipo, color) values
  ('Vara de Oro', 'recurrente', '#c8922a'),
  ('Biosaem',     'recurrente', '#7c9e6e'),
  ('Radkiddo',    'unico',      '#6e8eb0'),
  ('Bushwick',    'recurrente', '#a06e9e');

-- Proyectos de ejemplo (referenciando los clientes recién creados)
with c as (select id, nombre from clientes)
insert into proyectos (nombre, descripcion, cliente_id, tipo_cobro, valor_total, currency, color, horas_logged)
select
  c.nombre,
  'Proyecto ' || c.nombre,
  c.id,
  'recurrente',
  case c.nombre
    when 'Vara de Oro' then 3500000
    when 'Biosaem'     then 2800000
    when 'Radkiddo'    then 1500000
    when 'Bushwick'    then 4200000
  end,
  'COP',
  case c.nombre
    when 'Vara de Oro' then '#c8922a'
    when 'Biosaem'     then '#7c9e6e'
    when 'Radkiddo'    then '#6e8eb0'
    when 'Bushwick'    then '#a06e9e'
  end,
  case c.nombre
    when 'Vara de Oro' then 12
    when 'Biosaem'     then 18
    when 'Radkiddo'    then 6
    when 'Bushwick'    then 22
  end
from c;
