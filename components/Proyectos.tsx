"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Proyecto, Tarea } from "@/lib/types";
import { fmtCOP, minsToH, getRentabilidad, today, btnStyle, inputStyle, ACCENT_COLORS } from "@/lib/utils";
import MetricBox from "./MetricBox";

interface ProyectosProps {
  initialProyectos: Proyecto[];
  initialTareas: Tarea[];
  onDataChange: () => void;
}

export default function Proyectos({ initialProyectos, initialTareas, onDataChange }: ProyectosProps) {
  const supabase = createClient();
  const [proyectos, setProyectos] = useState<Proyecto[]>(initialProyectos);
  const [tareas, setTareas] = useState<Tarea[]>(initialTareas);
  const [showAddProject, setShowAddProject] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [addTaskForProject, setAddTaskForProject] = useState<string | null>(null);
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingStart, setTrackingStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [newProject, setNewProject] = useState({
    nombre: "", valor_total: "", currency: "COP", tipo_cobro: "unico", tipo: "cliente",
  });
  const [newProjectTask, setNewProjectTask] = useState({ titulo: "", tiempo_estimado: 60 });

  const addProject = async () => {
    if (!newProject.nombre) return;
    setSaving(true);
    const color = ACCENT_COLORS[proyectos.length % ACCENT_COLORS.length];
    const { data, error } = await supabase
      .from("proyectos")
      .insert({
        nombre: newProject.nombre,
        tipo: newProject.tipo,
        valor_total: Number(newProject.valor_total) || 0,
        currency: newProject.currency,
        tipo_cobro: newProject.tipo_cobro,
        estado: "activo",
        prioridad: "media",
        color,
        horas_logged: 0,
      })
      .select()
      .single();

    if (!error && data) {
      setProyectos(ps => [...ps, data as Proyecto]);
      setNewProject({ nombre: "", valor_total: "", currency: "COP", tipo_cobro: "unico", tipo: "cliente" });
      setShowAddProject(false);
      onDataChange();
    }
    setSaving(false);
  };

  const deleteProject = async (id: string) => {
    setProyectos(ps => ps.filter(p => p.id !== id));
    setTareas(ts => ts.filter(t => t.proyecto_id !== id));
    setConfirmDelete(null);
    setExpandedProject(null);
    await supabase.from("proyectos").delete().eq("id", id);
    onDataChange();
  };

  const addProjectTask = async (proyectoId: string) => {
    if (!newProjectTask.titulo) return;
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        titulo: newProjectTask.titulo,
        proyecto_id: proyectoId,
        tiempo_estimado: Number(newProjectTask.tiempo_estimado) || 60,
        tiempo_real: 0,
        estado: "pendiente",
        prioridad: "media",
        fecha: today(),
      })
      .select()
      .single();

    if (!error && data) {
      setTareas(ts => [...ts, data as Tarea]);
      setNewProjectTask({ titulo: "", tiempo_estimado: 60 });
      setAddTaskForProject(null);
      onDataChange();
    }
  };

  const toggleDone = useCallback(async (tarea: Tarea) => {
    const newEstado = tarea.estado === "completada" ? "pendiente" : "completada";
    setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, estado: newEstado } : t));
    await supabase.from("tareas").update({ estado: newEstado }).eq("id", tarea.id);
    onDataChange();
  }, [supabase, onDataChange]);

  const startTimer = useCallback(async (tarea: Tarea, proj: Proyecto) => {
    if (trackingId === tarea.id) {
      const mins = Math.floor(elapsed / 60);
      const newReal = tarea.tiempo_real + mins;
      setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, tiempo_real: newReal } : t));
      await supabase.from("tareas").update({ tiempo_real: newReal }).eq("id", tarea.id);

      const newHours = +(proj.horas_logged + mins / 60).toFixed(2);
      setProyectos(ps => ps.map(p => p.id === proj.id ? { ...p, horas_logged: newHours } : p));
      await supabase.from("proyectos").update({ horas_logged: newHours }).eq("id", proj.id);

      setTrackingId(null);
      setTrackingStart(null);
      setElapsed(0);
      onDataChange();
    } else {
      setTrackingId(tarea.id);
      setTrackingStart(Date.now());
      setElapsed(0);
    }
  }, [trackingId, elapsed, supabase, onDataChange]);

  return (
    <div className="fade-up">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 4 }}>Proyectos</h2>
          <p style={{ fontSize: 12, color: "#555", fontFamily: "DM Mono" }}>Click en un proyecto para ver sus tareas</p>
        </div>
        <button onClick={() => setShowAddProject(!showAddProject)} style={btnStyle("#c8922a")}>
          {showAddProject ? "Cancelar" : "+ Nuevo proyecto"}
        </button>
      </div>

      {showAddProject && (
        <div className="fade-up" style={{ background: "#111", border: "1px solid #2a2a2a", borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <input placeholder="Nombre proyecto" value={newProject.nombre}
              onChange={e => setNewProject({ ...newProject, nombre: e.target.value })} style={inputStyle} />
            <select value={newProject.tipo}
              onChange={e => setNewProject({ ...newProject, tipo: e.target.value })} style={inputStyle}>
              <option value="cliente">Cliente</option>
              <option value="propio">Propio</option>
              <option value="proposito">Propósito</option>
            </select>
            <input placeholder="Valor cobrado (opcional)" type="number" value={newProject.valor_total}
              onChange={e => setNewProject({ ...newProject, valor_total: e.target.value })} style={inputStyle} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 12, marginBottom: 12 }}>
            <select value={newProject.tipo_cobro}
              onChange={e => setNewProject({ ...newProject, tipo_cobro: e.target.value })} style={inputStyle}>
              <option value="unico">Único</option>
              <option value="recurrente">Recurrente</option>
            </select>
            <select value={newProject.currency}
              onChange={e => setNewProject({ ...newProject, currency: e.target.value })} style={inputStyle}>
              <option>COP</option>
              <option>USD</option>
            </select>
          </div>
          <button onClick={addProject} disabled={saving} style={btnStyle("#c8922a")}>
            {saving ? "Guardando..." : "Agregar proyecto"}
          </button>
        </div>
      )}

      {(["cliente", "propio", "proposito"] as const).map(tipo => {
        const grupo = proyectos.filter(p => p.tipo === tipo);
        if (grupo.length === 0) return null;
        const labels: Record<string, string> = { cliente: "Clientes", propio: "Propios", proposito: "Propósito" };
        const colors: Record<string, string> = { cliente: "#c8922a", propio: "#7c9e6e", proposito: "#7b9ec8" };
        return (
          <div key={tipo} style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: colors[tipo] }} />
              <span style={{ fontSize: 11, color: colors[tipo], letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "DM Mono", fontWeight: 700 }}>
                {labels[tipo]}
              </span>
              <div style={{ flex: 1, height: 1, background: "#1a1a1a" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {grupo.map(p => {
          const r = getRentabilidad(p);
          const cobrado = p.valor_total || p.valor_mensual || 0;
          const ratePerH = Math.round(cobrado / (p.horas_logged || 1));
          const pct = Math.min(100, Math.round((p.horas_logged / 40) * 100));
          const projTasks = tareas.filter(t => t.proyecto_id === p.id);
          const doneProjTasks = projTasks.filter(t => t.estado === "completada").length;
          const isExpanded = expandedProject === p.id;

          return (
            <div key={p.id} style={{
              background: "#111",
              border: "1px solid " + (isExpanded ? p.color + "44" : "#1e1e1e"),
              borderRadius: 18, overflow: "hidden",
              transition: "border-color 0.2s",
            }}>
              {/* Header clickeable */}
              <div
                onClick={() => setExpandedProject(isExpanded ? null : p.id)}
                style={{ padding: "22px 28px", cursor: "pointer", userSelect: "none" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 700, color: "#e8e0d0" }}>{p.nombre}</h3>
                      <p style={{ fontSize: 11, color: "#555", fontFamily: "DM Mono", marginTop: 2 }}>
                        {projTasks.length} tareas
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, color: r.color, fontWeight: 700, background: r.color + "20", padding: "3px 10px", borderRadius: 20 }}>
                      {r.label}
                    </span>
                    <span style={{ fontFamily: "DM Mono", fontSize: 13, color: p.color }}>{fmtCOP(ratePerH)}/h</span>
                    {/* Botón eliminar */}
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(confirmDelete === p.id ? null : p.id); }}
                      style={{
                        background: "transparent", border: "1px solid #2a2a2a",
                        color: "#555", width: 28, height: 28, borderRadius: 8,
                        fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                      title="Eliminar proyecto"
                    >
                      ×
                    </button>
                    <span style={{
                      fontSize: 16, color: "#444",
                      transition: "transform 0.2s",
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      display: "inline-block",
                    }}>▾</span>
                  </div>
                </div>

                {/* Mini metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
                  <MetricBox label="Cobrado"     value={fmtCOP(cobrado)}          color={p.color} />
                  <MetricBox label="Horas"       value={p.horas_logged + "h"}     color="#666" />
                  <MetricBox label="Tarifa/h"    value={fmtCOP(ratePerH)}         color={r.color} />
                  <MetricBox label="Completadas" value={`${doneProjTasks}/${projTasks.length}`} color="#666" />
                </div>

                {/* Confirmación eliminar */}
                {confirmDelete === p.id && (
                  <div onClick={e => e.stopPropagation()} style={{
                    marginTop: 14, background: "#b05a5a18", border: "1px solid #b05a5a44",
                    borderRadius: 10, padding: "12px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <span style={{ fontSize: 13, color: "#b05a5a" }}>¿Eliminar "{p.nombre}" y todas sus tareas?</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setConfirmDelete(null)} style={{
                        background: "transparent", border: "1px solid #333", color: "#666",
                        padding: "5px 12px", borderRadius: 7, fontSize: 12, fontFamily: "Syne", fontWeight: 600,
                      }}>Cancelar</button>
                      <button onClick={() => deleteProject(p.id)} style={{
                        background: "#b05a5a22", border: "1px solid #b05a5a", color: "#b05a5a",
                        padding: "5px 12px", borderRadius: 7, fontSize: 12, fontFamily: "Syne", fontWeight: 700,
                      }}>Eliminar</button>
                    </div>
                  </div>
                )}

                {/* Barra de carga */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ height: 3, background: "#1a1a1a", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: pct + "%", background: p.color, borderRadius: 2, transition: "width 0.6s ease" }} />
                  </div>
                </div>
              </div>

              {/* Tareas expandibles */}
              {isExpanded && (
                <div style={{ borderTop: "1px solid #1e1e1e", padding: "20px 28px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      Tareas del proyecto
                    </p>
                    <button
                      onClick={e => { e.stopPropagation(); setAddTaskForProject(addTaskForProject === p.id ? null : p.id); }}
                      style={{ ...btnStyle(p.color), padding: "5px 12px", fontSize: 12 }}
                    >
                      {addTaskForProject === p.id ? "Cancelar" : "+ Tarea"}
                    </button>
                  </div>

                  {addTaskForProject === p.id && (
                    <div style={{ background: "#0f0f0f", borderRadius: 12, padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: "1fr 100px auto", gap: 10 }}>
                      <input
                        placeholder="Nombre de la tarea"
                        value={newProjectTask.titulo}
                        onChange={e => setNewProjectTask({ ...newProjectTask, titulo: e.target.value })}
                        onKeyDown={e => e.key === "Enter" && addProjectTask(p.id)}
                        style={inputStyle}
                        autoFocus
                      />
                      <input
                        type="number"
                        placeholder="Min est."
                        value={newProjectTask.tiempo_estimado}
                        onChange={e => setNewProjectTask({ ...newProjectTask, tiempo_estimado: Number(e.target.value) })}
                        style={inputStyle}
                      />
                      <button onClick={() => addProjectTask(p.id)} style={btnStyle(p.color)}>Agregar</button>
                    </div>
                  )}

                  {projTasks.length === 0 && !addTaskForProject && (
                    <p style={{ fontSize: 13, color: "#444", fontFamily: "DM Mono", padding: "12px 0" }}>
                      Sin tareas aún. Agrega la primera ↑
                    </p>
                  )}

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {projTasks.map(task => {
                      const isTracking = trackingId === task.id;
                      const isDone = task.estado === "completada";
                      return (
                        <div key={task.id} style={{
                          background: "#0f0f0f",
                          border: "1px solid " + (isTracking ? p.color + "55" : "#1a1a1a"),
                          borderRadius: 12, padding: "12px 16px",
                          display: "flex", alignItems: "center", gap: 12,
                          opacity: isDone ? 0.45 : 1, transition: "all 0.2s",
                        }}>
                          <button onClick={() => toggleDone(task)} style={{
                            width: 18, height: 18, borderRadius: "50%",
                            border: "2px solid " + (isDone ? "#7c9e6e" : "#333"),
                            background: isDone ? "#7c9e6e" : "transparent",
                            flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {isDone && <span style={{ fontSize: 9, color: "#fff" }}>✓</span>}
                          </button>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: isDone ? "#555" : "#ddd", textDecoration: isDone ? "line-through" : "none" }}>
                              {task.titulo}
                            </p>
                            <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 11, color: "#444", fontFamily: "DM Mono" }}>Est: {minsToH(task.tiempo_estimado)}</span>
                              {task.tiempo_real > 0 && <span style={{ fontSize: 11, color: "#666", fontFamily: "DM Mono" }}>Real: {minsToH(task.tiempo_real)}</span>}
                              {task.fecha === today() && <span style={{ fontSize: 10, color: p.color, fontFamily: "DM Mono" }}>· hoy</span>}
                            </div>
                          </div>

                          {isTracking && (
                            <div style={{ fontFamily: "DM Mono", fontSize: 13, color: p.color, minWidth: 52 }}>
                              {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                            </div>
                          )}

                          {!isDone && (
                            <button onClick={() => startTimer(task, p)} style={{
                              background: isTracking ? p.color + "22" : "#1a1a1a",
                              border: "1px solid " + (isTracking ? p.color : "#2a2a2a"),
                              color: isTracking ? p.color : "#555",
                              padding: "5px 12px", borderRadius: 8,
                              fontSize: 11, fontFamily: "Syne", fontWeight: 700, whiteSpace: "nowrap",
                            }}>
                              {isTracking ? "⏹ Stop" : "▶"}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
