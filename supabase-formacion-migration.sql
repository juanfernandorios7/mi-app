-- ============================================================
-- Juanfer OS — Migración: Módulo Formación Jerárquico
-- ============================================================
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Reemplaza la tabla "formacion" con dos tablas: cursos + sesiones_formacion
-- ============================================================

-- Eliminar tabla anterior (si existe)
drop table if exists formacion;

-- ============================================================
-- CURSOS (padre)
-- ============================================================
create table if not exists cursos (
  id           uuid primary key default uuid_generate_v4(),
  nombre       text not null,
  descripcion  text,
  area         text not null default 'General',
  estado       text not null default 'activo' check (estado in ('activo', 'pausado', 'completado')),
  color        text not null default '#6e8eb0',
  fecha_inicio date,
  fecha_fin    date,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- SESIONES_FORMACION (hijo)
-- ============================================================
create table if not exists sesiones_formacion (
  id               uuid primary key default uuid_generate_v4(),
  curso_id         uuid not null references cursos(id) on delete cascade,
  titulo           text not null,
  fecha            date not null default current_date,
  tiempo_estimado  integer not null default 60,  -- minutos
  tiempo_real      integer not null default 0,   -- minutos
  notas            text,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table cursos              enable row level security;
alter table sesiones_formacion  enable row level security;

create policy "auth_cursos"             on cursos             for all to authenticated using (true) with check (true);
create policy "auth_sesiones_formacion" on sesiones_formacion for all to authenticated using (true) with check (true);
