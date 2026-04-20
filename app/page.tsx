import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { Proyecto, Tarea, Configuracion } from "@/lib/types";

export default async function Home() {
  const supabase = await createClient();

  const [{ data: proyectos }, { data: tareas }, { data: config }] = await Promise.all([
    supabase.from("proyectos").select("*, clientes(*)").order("created_at", { ascending: false }),
    supabase.from("tareas").select("*").order("created_at", { ascending: false }),
    supabase.from("configuracion").select("*").limit(1).single(),
  ]);

  return (
    <AppShell
      proyectos={(proyectos as Proyecto[]) ?? []}
      tareas={(tareas as Tarea[]) ?? []}
      config={config as Configuracion}
    />
  );
}
