# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this app

**Juanfer OS** — personal productivity OS for Juan Fernando Rios (freelancer/entrepreneur). Tracks projects, tasks, time, and income. Deployed at Vercel, auto-deploys from GitHub on every push to `main`.

## Commands

```bash
npm run dev      # local dev server (localhost:3000)
npm run build    # production build (also validates TypeScript)
npm run lint     # ESLint
```

No test suite exists yet.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **React 19**
- **Supabase** — PostgreSQL DB + Auth + RLS (single user app)
- **Recharts** — charts in Dashboard
- **Vercel** — deployment

## Architecture

### Data flow

`app/page.tsx` is a **Server Component** that fetches all data from Supabase on the server and passes it as props to `AppShell`. There is no API layer — Supabase is called directly.

```
app/page.tsx (Server, fetches: proyectos + tareas + config)
  └─ AppShell.tsx (Client, manages active view + router.refresh())
       ├─ Dashboard.tsx   (read-only analytics view)
       ├─ Proyectos.tsx   (project CRUD + task time logging)
       └─ Tareas.tsx      (Kanban board + weekly planner)
```

**Refresh pattern**: Client components call `onDataChange()` / `onTareasChange()` → triggers `router.refresh()` in AppShell → Next.js re-renders the Server Component and pushes fresh props down. No local state sync needed for cross-view consistency.

### Key architectural decisions

**Hours are always computed from tasks** (`tareas.tiempo_real`), never from `proyectos.horas_logged`. The `horas_logged` column exists in the DB but gets out of sync when tasks are edited in Tareas.tsx. Always derive project hours as:
```ts
tareas.filter(t => t.proyecto_id === p.id).reduce((a, t) => a + t.tiempo_real / 60, 0)
```

**Timezone** — Colombia is UTC-5. All date functions must use local time, never `toISOString()`. The `today()` utility in `lib/utils.ts` handles this correctly using `getFullYear/getMonth/getDate`.

**Tarifa efectiva** — `getHourlyRate(p, horasReales?)` in Dashboard.tsx:
- `recurrente` → `valor_mensual / 160` (implied hourly rate from monthly fee)
- `unico` → `valor_total / horasReales` but only if `horasReales >= 5` (otherwise `null` to avoid inflated rates on new projects)

### Styling

Dark theme only. All styles are inline CSS-in-JS (`style={{}}`), no CSS modules or Tailwind. Shared style helpers in `lib/utils.ts`: `btnStyle(color)`, `inputStyle`. Global CSS (`app/globals.css`) defines only fonts, scrollbar, and animation classes (`.fade-up`, `.pulse-ring`).

Design tokens:
- Background: `#0a0a0a` / `#111` / `#0f0f0f`
- Accent gold: `#c8922a`
- Green: `#7c9e6e`, Blue: `#7b9ec8`, Red: `#b05a5a`
- Text: `#e8e0d0` (primary), `#555` (muted)
- Fonts: `DM Serif Display` (headings), `DM Mono` (numbers/labels), `Syne` (UI/buttons)

### Supabase

Two clients:
- `lib/supabase/server.ts` — Server Components only
- `lib/supabase/client.ts` — Client Components only

Auth is required (RLS enabled). Single-user app — policies allow all operations to any authenticated user.

## Database schema (key columns)

**proyectos**: `tipo` (cliente|propio|proposito), `tipo_cobro` (recurrente|unico), `valor_mensual`, `valor_total`, `horas_logged` (⚠️ may be stale — derive from tareas instead), `estado` (activo|pausado|finalizado), `fecha_inicio`, `fecha_fin`, `currency` (COP|USD)

**tareas**: `tiempo_estimado` (minutes), `tiempo_real` (minutes), `fecha` (local date YYYY-MM-DD), `estado` (pendiente|en_progreso|completada), `proyecto_id` (FK → proyectos)

**configuracion**: `capacidad_total_horas` (weekly hours capacity, default 40), `formacion_meta_horas`

## Features implemented

- **Dashboard**: capacity gauge, oversaturation alert (orange ≥80%, red ≥95%), rendimiento block (Hoy/Semana/Mes with 4 metrics), 3 ProyectoBlock sections (Clientes/Propios/Propósito), weekly bar chart
- **Proyectos**: CRUD, grouped by tipo, time logging per task (h/m inputs), inline edit, "Cerrar" flow (marks finalizado + fecha_fin), archive toggle, days-open counter + alerts for pago único projects open >21/45 days
- **Tareas**: Kanban (3 columns: Pendiente/En Progreso/Finalizada), inline card editing, "Mover a" per card, delete with confirmation, auto-sets `fecha=today()` when moved to Finalizada; Semana view (7-column weekly planner with navigation)

## Env vars required

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
