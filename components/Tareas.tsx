"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tarea, Proyecto } from "@/lib/types";
import { today, minsToH, btnStyle, inputStyle } from "@/lib/utils";

interface TareasProps {
  initialTareas: Tarea[];
  proyectos: Proyecto[];
  onTareasChange: () => void;
}

export default function Tareas({ initialTareas, proyectos, onTareasChange }: TareasProps) {
  const supabase = createClient();
  const [tareas, setTareas] = useState<Tarea[]>(initialTareas);
  const [showAdd, setShowAdd] = useState(false);
  const [newTarea, setNewTarea] = useState({ titulo: "", proyecto_id: "", tiempo_estimado: 60 });
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingStart, setTrackingStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  const todayTasks = tareas.filter(t => t.fecha === today());
  const doneTasks = todayTasks.filter(t => t.estado === "completada").length;

  // Timer tick
  useEffect(() => {
    if (!trackingId || !trackingStart) return;
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - trackingStart) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, [trackingId, trackingStart]);

  const toggleDone = useCallback(async (tarea: Tarea) => {
    const newEstado = tarea.estado === "completada" ? "pendiente" : "completada";
    setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, estado: newEstado } : t));
    await supabase.from("tareas").update({ estado: newEstado }).eq("id", tarea.id);
    onTareasChange();
  }, [supabase, onTareasChange]);

  const startTimer = useCallback(async (tarea: Tarea) => {
    if (trackingId === tarea.id) {
      // Stop timer
      const mins = Math.floor(elapsed / 60);
      const newReal = tarea.tiempo_real + mins;
      setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, tiempo_real: newReal } : t));
      await supabase.from("tareas").update({ tiempo_real: newReal }).eq("id", tarea.id);

      // Update horas_logged on project
      if (tarea.proyecto_id) {
        const proj = proyectos.find(p => p.id === tarea.proyecto_id);
        if (proj) {
          const newHours = +(proj.horas_logged + mins / 60).toFixed(2);
          await supabase.from("proyectos").update({ horas_logged: newHours }).eq("id", tarea.proyecto_id);
        }
      }
      setTrackingId(null);
      setTrackingStart(null);
      setElapsed(0);
      onTareasChange();
    } else {
      setTrackingId(tarea.id);
      setTrackingStart(Date.now());
      setElapsed(0);
    }
  }, [trackingId, elapsed, supabase, proyectos, onTareasChange]);

  const addTarea = async () => {
    if (!newTarea.titulo) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        titulo: newTarea.titulo,
        proyecto_id: newTarea.proyecto_id || null,
        tiempo_estimado: Number(newTarea.tiempo_estimado) || 60,
        tiempo_real: 0,
        estado: "pendiente",
        prioridad: "media",
        fecha: today(),
      })
      .select()
      .single();

    if (!error && data) {
      setTareas(ts => [...ts, data as Tarea]);
      setNewTarea({ titulo: "", proyecto_id: "", tiempo_estimado: 60 });
      setShowAdd(false);
      onTareasChange();
    }
    setSaving(false);
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 4 }}>Tareas de hoy</h2>
          <p style={{ fontSize: 12, color: "#555", fontFamily: "DM Mono" }}>{doneTasks} completadas de {todayTasks.length}</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={btnStyle("#c8922a")}>
          {showAdd ? "Cancelar" : "+ Nueva tarea"}
        </button>
      </div>

      {showAdd && (
        <div className="fade-up" style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 12, marginBottom: 12 }}>
            <input
              placeholder="Nombre de la tarea"
              value={newTarea.titulo}
              onChange={e => setNewTarea({ ...newTarea, titulo: e.target.value })}
              onKeyDown={e => e.key === "Enter" && addTarea()}
              style={inputStyle}
              autoFocus
            />
            <select
              value={newTarea.proyecto_id}
              onChange={e => setNewTarea({ ...newTarea, proyecto_id: e.target.value })}
              style={inputStyle}
            >
              <option value="">Proyecto...</option>
              {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <input
              type="number"
              placeholder="Min est."
              value={newTarea.tiempo_estimado}
              onChange={e => setNewTarea({ ...newTarea, tiempo_estimado: Number(e.target.value) })}
              style={inputStyle}
            />
          </div>
          <button onClick={addTarea} disabled={saving} style={btnStyle("#c8922a")}>
            {saving ? "Guardando..." : "Agregar"}
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {todayTasks.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#444" }}>
            <p style={{ fontFamily: "DM Serif Display", fontSize: 20, marginBottom: 8 }}>Sin tareas hoy</p>
            <p style={{ fontSize: 13 }}>Agrega tu primera tarea del día</p>
          </div>
        )}

        {todayTasks.map(task => {
          const proj = proyectos.find(p => p.id === task.proyecto_id);
          const isTracking = trackingId === task.id;
          const isDone = task.estado === "completada";

          return (
            <div key={task.id} style={{
              background: "#111",
              border: "1px solid " + (isTracking ? "#c8922a44" : "#1e1e1e"),
              borderRadius: 14, padding: "16px 20px",
              display: "flex", alignItems: "center", gap: 16,
              opacity: isDone ? 0.5 : 1, transition: "all 0.2s",
            }}>
              <button onClick={() => toggleDone(task)} style={{
                width: 20, height: 20, borderRadius: "50%",
                border: "2px solid " + (isDone ? "#7c9e6e" : "#333"),
                background: isDone ? "#7c9e6e" : "transparent",
                flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isDone && <span style={{ fontSize: 10, color: "#fff" }}>✓</span>}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: isDone ? "#666" : "#ddd", textDecoration: isDone ? "line-through" : "none" }}>
                  {task.titulo}
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 4, flexWrap: "wrap" }}>
                  {proj && <span style={{ fontSize: 11, color: proj.color, fontFamily: "DM Mono" }}>◆ {proj.nombre}</span>}
                  <span style={{ fontSize: 11, color: "#444", fontFamily: "DM Mono" }}>Est: {minsToH(task.tiempo_estimado)}</span>
                  {task.tiempo_real > 0 && <span style={{ fontSize: 11, color: "#666", fontFamily: "DM Mono" }}>Real: {minsToH(task.tiempo_real)}</span>}
                </div>
              </div>

              {isTracking && (
                <div style={{ fontFamily: "DM Mono", fontSize: 14, color: "#c8922a", minWidth: 60 }}>
                  {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                </div>
              )}

              {!isDone && (
                <button onClick={() => startTimer(task)} style={{
                  background: isTracking ? "#c8922a22" : "#1a1a1a",
                  border: "1px solid " + (isTracking ? "#c8922a" : "#2a2a2a"),
                  color: isTracking ? "#c8922a" : "#666",
                  padding: "6px 14px", borderRadius: 8,
                  fontSize: 12, fontFamily: "Syne", fontWeight: 700, whiteSpace: "nowrap",
                }}>
                  {isTracking ? "⏹ Stop" : "▶ Timer"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
