"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Proyecto, Tarea, Configuracion, Curso, SesionFormacion } from "@/lib/types";
import Header from "./Header";
import Dashboard from "./Dashboard";
import Tareas from "./Tareas";
import Proyectos from "./Proyectos";
import Formacion from "./Formacion";

type View = "dashboard" | "tareas" | "proyectos" | "formacion";

export interface TimerState {
  trackingId: string | null;
  elapsed: number;
  startTracking: (id: string) => void;
  stopTracking: () => void;
}

interface AppShellProps {
  proyectos: Proyecto[];
  tareas: Tarea[];
  config: Configuracion | null;
  cursos: Curso[];
  sesiones: SesionFormacion[];
}

export default function AppShell({ proyectos, tareas, config, cursos, sesiones }: AppShellProps) {
  const [view, setView] = useState<View>("dashboard");
  const router = useRouter();
  const supabase = createClient();

  // Timer compartido — evita doble timer entre Tareas y Proyectos
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingStart, setTrackingStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!trackingId || !trackingStart) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - trackingStart) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [trackingId, trackingStart]);

  const startTracking = useCallback((id: string) => {
    setTrackingId(id);
    setTrackingStart(Date.now());
    setElapsed(0);
  }, []);

  const stopTracking = useCallback(() => {
    setTrackingId(null);
    setTrackingStart(null);
    setElapsed(0);
  }, []);

  const timer: TimerState = { trackingId, elapsed, startTracking, stopTracking };

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const capacidadHoras = config?.capacidad_total_horas ?? 40;

  return (
    <div style={{ fontFamily: "'Syne', sans-serif", background: "#141210", minHeight: "100vh", color: "#f0ebe3" }}>
      <Header view={view} onViewChange={setView} onSignOut={handleSignOut} />

      <main style={{ padding: "28px", maxWidth: view === "tareas" ? 1280 : 960, margin: "0 auto" }}>
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
            timer={timer}
          />
        )}
        {view === "proyectos" && (
          <Proyectos
            initialProyectos={proyectos}
            initialTareas={tareas}
            onDataChange={refresh}
            timer={timer}
          />
        )}
        {view === "formacion" && (
          <Formacion
            initialCursos={cursos}
            initialSesiones={sesiones}
            config={config}
            onDataChange={refresh}
            timer={timer}
          />
        )}
      </main>
    </div>
  );
}
