"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Proyecto, Tarea, Configuracion } from "@/lib/types";
import Header from "./Header";
import Dashboard from "./Dashboard";
import Tareas from "./Tareas";
import Proyectos from "./Proyectos";

type View = "dashboard" | "tareas" | "proyectos";

interface AppShellProps {
  proyectos: Proyecto[];
  tareas: Tarea[];
  config: Configuracion | null;
}

export default function AppShell({ proyectos, tareas, config }: AppShellProps) {
  const [view, setView] = useState<View>("dashboard");
  const router = useRouter();
  const supabase = createClient();

  // Refrescar datos del servidor (Server Component re-render)
  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const capacidadHoras = config?.capacidad_total_horas ?? 40;

  return (
    <div style={{ fontFamily: "'Syne', sans-serif", background: "#0a0a0a", minHeight: "100vh", color: "#e8e0d0" }}>
      <Header view={view} onViewChange={setView} onSignOut={handleSignOut} />

      <main style={{ padding: "28px", maxWidth: 960, margin: "0 auto" }}>
        {view === "dashboard" && (
          <Dashboard
            proyectos={proyectos}
            tareas={tareas}
            capacidadHoras={capacidadHoras}
          />
        )}
        {view === "tareas" && (
          <Tareas
            initialTareas={tareas}
            proyectos={proyectos}
            onTareasChange={refresh}
            capacidadHoras={capacidadHoras}
          />
        )}
        {view === "proyectos" && (
          <Proyectos
            initialProyectos={proyectos}
            initialTareas={tareas}
            onDataChange={refresh}
          />
        )}
      </main>
    </div>
  );
}
