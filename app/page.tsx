import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { Proyecto, Tarea, Configuracion, Curso, SesionFormacion } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: proyectos }, { data: tareas }, { data: config }, { data: cursos }, { data: sesiones }] = await Promise.all([
    supabase.from("proyectos").select("*, clientes(*)").order("created_at", { ascending: false }),
    supabase.from("tareas").select("*").order("created_at", { ascending: false }),
    supabase.from("configuracion").select("*").limit(1).single(),
    supabase.from("cursos").select("*").order("created_at", { ascending: false }),
    supabase.from("sesiones_formacion").select("*").order("fecha", { ascending: true }),
  ]);

  return (
    <AppShell
      proyectos={(proyectos as Proyecto[]) ?? []}
      tareas={(tareas as Tarea[]) ?? []}
      config={config as Configuracion}
      cursos={(cursos as Curso[]) ?? []}
      sesiones={(sesiones as SesionFormacion[]) ?? []}
    />
  );
}
