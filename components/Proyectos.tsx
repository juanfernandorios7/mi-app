"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Proyecto, Tarea } from "@/lib/types";
import { fmtCOP, minsToH, getRentabilidad, getDiasActivo, getAlertaDuracion, today, btnStyle, inputStyle, ACCENT_COLORS } from "@/lib/utils";
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
  const [closingProject, setClosingProject] = useState<string | null>(null);
  const [closingFecha, setClosingFecha] = useState(today());
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [editingTime, setEditingTime] = useState<string | null>(null); // tarea id
  const [editTimeH, setEditTimeH] = useState(0);
  const [editTimeM, setEditTimeM] = useState(0);
  const [editForm, setEditForm] = useState<{
    nombre: string; tipo: string; tipo_cobro: string;
    valor_total: string; currency: string; fecha_inicio: string; fecha_fin: string;
  } | null>(null);

  const [newProject, setNewProject] = useState({
    nombre: "", valor_total: "", currency: "COP", tipo_cobro: "unico", tipo: "cliente",
    fecha_inicio: today(), fecha_fin: "",
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
        fecha_inicio: newProject.fecha_inicio || null,
        fecha_fin: newProject.fecha_fin || null,
      })
      .select()
      .single();

    if (!error && data) {
      setProyectos(ps => [...ps, data as Proyecto]);
      setNewProject({ nombre: "", valor_total: "", currency: "COP", tipo_cobro: "unico", tipo: "cliente", fecha_inicio: today(), fecha_fin: "" });
      setShowAddProject(false);
      onDataChange();
    }
    setSaving(false);
  };

  const closeProject = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("proyectos")
      .update({ fecha_fin: closingFecha, estado: "finalizado" })
      .eq("id", id);
    if (!error) {
      setProyectos(ps => ps.map(p => p.id === id ? { ...p, fecha_fin: closingFecha, estado: "finalizado" } : p));
      setClosingProject(null);
      onDataChange();
    }
    setSaving(false);
  };

  const openEditTime = (task: Tarea) => {
    setEditingTime(task.id);
    setEditTimeH(Math.floor(task.tiempo_real / 60));
    setEditTimeM(task.tiempo_real % 60);
  };

  const saveEditTime = async (task: Tarea, proj: Proyecto) => {
    const newMins = editTimeH * 60 + editTimeM;
    const diff = newMins - task.tiempo_real; // diferencia vs lo que tenía antes
    setTareas(ts => ts.map(t => t.id === task.id ? { ...t, tiempo_real: newMins } : t));
    await supabase.from("tareas").update({ tiempo_real: newMins }).eq("id", task.id);
    // actualizar horas_logged del proyecto con la diferencia
    if (diff !== 0) {
      const newHours = +(proj.horas_logged + diff / 60).toFixed(2);
      setProyectos(ps => ps.map(p => p.id === proj.id ? { ...p, horas_logged: Math.max(0, newHours) } : p));
      await supabase.from("proyectos").update({ horas_logged: Math.max(0, newHours) }).eq("id", proj.id);
    }
    setEditingTime(null);
    onDataChange();
  };

  const startEdit = (p: Proyecto) => {
    setEditingProject(p.id);
    setEditForm({
      nombre: p.nombre,
      tipo: p.tipo,
      tipo_cobro: p.tipo_cobro,
      valor_total: String(p.valor_total || p.valor_mensual || ""),
      currency: p.currency,
      fecha_inicio: p.fecha_inicio || "",
      fecha_fin: p.fecha_fin || "",
    });
  };

  const saveEdit = async (id: string) => {
    if (!editForm) return;
    setSaving(true);
    const updates = {
      nombre: editForm.nombre,
      tipo: editForm.tipo,
      tipo_cobro: editForm.tipo_cobro,
      valor_total: Number(editForm.valor_total) || 0,
      currency: editForm.currency,
      fecha_inicio: editForm.fecha_inicio || null,
      fecha_fin: editForm.fecha_fin || null,
    };
    const { error } = await supabase.from("proyectos").update(updates).eq("id", id);
    if (!error) {
      setProyectos(ps => ps.map(p => p.id === id ? { ...p, ...updates } as Proyecto : p));
      setEditingProject(null);
      setEditForm(null);
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
          {newProject.tipo_cobro === "unico" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: "#555", fontFamily: "DM Mono", display: "block", marginBottom: 6 }}>Fecha inicio</label>
                <input type="date" value={newProject.fecha_inicio}
                  onChange={e => setNewProject({ ...newProject, fecha_inicio: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#555", fontFamily: "DM Mono", display: "block", marginBottom: 6 }}>Fecha entrega (opcional)</label>
                <input type="date" value={newProject.fecha_fin}
                  onChange={e => setNewProject({ ...newProject, fecha_fin: e.target.value })} style={inputStyle} />
              </div>
            </div>
          )}
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
          const diasActivo = getDiasActivo(p);
          const alerta = getAlertaDuracion(p);

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
                    {alerta && (
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: alerta.nivel === "danger" ? "#b05a5a" : "#c8922a",
                        background: alerta.nivel === "danger" ? "#b05a5a18" : "#c8922a18",
                        border: `1px solid ${alerta.nivel === "danger" ? "#b05a5a44" : "#c8922a44"}`,
                        padding: "3px 10px", borderRadius: 20,
                      }}>
                        ⚠ {alerta.msg}
                      </span>
                    )}
                    {diasActivo !== null && !alerta && (
                      <span style={{ fontSize: 11, color: "#555", fontFamily: "DM Mono" }}>
                        {diasActivo}d {p.fecha_fin ? "duración" : "activo"}
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: r.color, fontWeight: 700, background: r.color + "20", padding: "3px 10px", borderRadius: 20 }}>
                      {r.label}
                    </span>
                    <span style={{ fontFamily: "DM Mono", fontSize: 13, color: p.color }}>{fmtCOP(ratePerH)}/h</span>
                    {/* Botón editar */}
                    <button
                      onClick={e => { e.stopPropagation(); editingProject === p.id ? setEditingProject(null) : startEdit(p); }}
                      style={{
                        background: "transparent", border: "1px solid #2a2a2a",
                        color: "#555", padding: "4px 10px", borderRadius: 8,
                        fontSize: 11, fontFamily: "Syne", fontWeight: 700,
                      }}
                    >
                      Editar
                    </button>
                    {/* Botón cerrar proyecto (solo pago único sin fecha_fin) */}
                    {p.tipo_cobro === "unico" && !p.fecha_fin && (
                      <button
                        onClick={e => { e.stopPropagation(); setClosingProject(closingProject === p.id ? null : p.id); setClosingFecha(today()); }}
                        style={{
                          background: "#7c9e6e18", border: "1px solid #7c9e6e44",
                          color: "#7c9e6e", padding: "4px 10px", borderRadius: 8,
                          fontSize: 11, fontFamily: "Syne", fontWeight: 700,
                        }}
                        title="Cerrar proyecto"
                      >
                        Cerrar
                      </button>
                    )}
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
                  {diasActivo !== null
                    ? <MetricBox label={p.fecha_fin ? "Duración" : "Días abierto"} value={diasActivo + "d"} color={alerta ? (alerta.nivel === "danger" ? "#b05a5a" : "#c8922a") : "#666"} />
                    : <MetricBox label="Completadas" value={`${doneProjTasks}/${projTasks.length}`} color="#666" />
                  }
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

                {/* Panel editar proyecto */}
                {editingProject === p.id && editForm && (
                  <div onClick={e => e.stopPropagation()} style={{
                    marginTop: 14, background: "#0f0f0f", border: "1px solid #2a2a2a",
                    borderRadius: 12, padding: "16px 18px",
                  }}>
                    <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "DM Mono", marginBottom: 14 }}>Editar proyecto</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                      <input value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                        placeholder="Nombre" style={inputStyle} />
                      <select value={editForm.tipo} onChange={e => setEditForm({ ...editForm, tipo: e.target.value })} style={inputStyle}>
                        <option value="cliente">Cliente</option>
                        <option value="propio">Propio</option>
                        <option value="proposito">Propósito</option>
                      </select>
                      <input value={editForm.valor_total} onChange={e => setEditForm({ ...editForm, valor_total: e.target.value })}
                        placeholder="Valor cobrado" type="number" style={inputStyle} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 10, marginBottom: 10 }}>
                      <select value={editForm.tipo_cobro} onChange={e => setEditForm({ ...editForm, tipo_cobro: e.target.value })} style={inputStyle}>
                        <option value="unico">Único</option>
                        <option value="recurrente">Recurrente</option>
                      </select>
                      <select value={editForm.currency} onChange={e => setEditForm({ ...editForm, currency: e.target.value })} style={inputStyle}>
                        <option>COP</option>
                        <option>USD</option>
                      </select>
                      <div />
                    </div>
                    {editForm.tipo_cobro === "unico" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <div>
                          <label style={{ fontSize: 11, color: "#555", fontFamily: "DM Mono", display: "block", marginBottom: 6 }}>Fecha inicio</label>
                          <input type="date" value={editForm.fecha_inicio} onChange={e => setEditForm({ ...editForm, fecha_inicio: e.target.value })} style={inputStyle} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, color: "#555", fontFamily: "DM Mono", display: "block", marginBottom: 6 }}>Fecha entrega</label>
                          <input type="date" value={editForm.fecha_fin} onChange={e => setEditForm({ ...editForm, fecha_fin: e.target.value })} style={inputStyle} />
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={() => setEditingProject(null)} style={{
                        background: "transparent", border: "1px solid #333", color: "#666",
                        padding: "6px 14px", borderRadius: 8, fontSize: 12, fontFamily: "Syne", fontWeight: 600,
                      }}>Cancelar</button>
                      <button onClick={() => saveEdit(p.id)} disabled={saving} style={{
                        background: "#c8922a22", border: "1px solid #c8922a", color: "#c8922a",
                        padding: "6px 16px", borderRadius: 8, fontSize: 12, fontFamily: "Syne", fontWeight: 700,
                      }}>
                        {saving ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Panel cerrar proyecto */}
                {closingProject === p.id && (
                  <div onClick={e => e.stopPropagation()} style={{
                    marginTop: 14, background: "#7c9e6e12", border: "1px solid #7c9e6e44",
                    borderRadius: 10, padding: "14px 16px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                  }}>
                    <div>
                      <p style={{ fontSize: 13, color: "#7c9e6e", fontWeight: 700, marginBottom: 4 }}>Cerrar "{p.nombre}"</p>
                      <p style={{ fontSize: 11, color: "#555" }}>¿Cuál fue la fecha de entrega?</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <input
                        type="date"
                        value={closingFecha}
                        onChange={e => setClosingFecha(e.target.value)}
                        style={{ ...inputStyle, width: "auto", padding: "6px 12px", fontSize: 13 }}
                      />
                      <button onClick={() => setClosingProject(null)} style={{
                        background: "transparent", border: "1px solid #333", color: "#666",
                        padding: "6px 12px", borderRadius: 8, fontSize: 12, fontFamily: "Syne", fontWeight: 600,
                      }}>Cancelar</button>
                      <button onClick={() => closeProject(p.id)} disabled={saving} style={{
                        background: "#7c9e6e22", border: "1px solid #7c9e6e", color: "#7c9e6e",
                        padding: "6px 14px", borderRadius: 8, fontSize: 12, fontFamily: "Syne", fontWeight: 700,
                      }}>
                        {saving ? "Guardando..." : "Confirmar cierre"}
                      </button>
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
                            <div style={{ display: "flex", gap: 10, marginTop: 3, flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ fontSize: 11, color: "#444", fontFamily: "DM Mono" }}>Est: {minsToH(task.tiempo_estimado)}</span>

                              {editingTime === task.id ? (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }} onClick={e => e.stopPropagation()}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                      <input
                                        type="number" min={0} max={23} value={editTimeH}
                                        onChange={e => setEditTimeH(Math.max(0, Number(e.target.value)))}
                                        style={{ width: 48, background: "#1a1a1a", border: "1px solid #3a3a3a", borderRadius: 7,
                                          color: "#e8e0d0", fontSize: 14, fontFamily: "DM Mono", outline: "none",
                                          textAlign: "center", padding: "4px 0" }}
                                        autoFocus
                                      />
                                      <span style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono" }}>horas</span>
                                    </div>
                                    <span style={{ color: "#444", fontSize: 16, marginBottom: 14 }}>:</span>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                      <input
                                        type="number" min={0} max={59} value={editTimeM}
                                        onChange={e => setEditTimeM(Math.max(0, Math.min(59, Number(e.target.value))))}
                                        onKeyDown={e => e.key === "Enter" && saveEditTime(task, p)}
                                        style={{ width: 48, background: "#1a1a1a", border: "1px solid #3a3a3a", borderRadius: 7,
                                          color: "#e8e0d0", fontSize: 14, fontFamily: "DM Mono", outline: "none",
                                          textAlign: "center", padding: "4px 0" }}
                                      />
                                      <span style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono" }}>min</span>
                                    </div>
                                  </div>
                                  <button onClick={() => saveEditTime(task, p)} style={{
                                    background: p.color + "22", border: "1px solid " + p.color + "66",
                                    color: p.color, fontSize: 12, fontFamily: "Syne", fontWeight: 700,
                                    padding: "4px 10px", borderRadius: 7,
                                  }}>Guardar</button>
                                  <button onClick={() => setEditingTime(null)} style={{
                                    background: "transparent", border: "1px solid #2a2a2a", color: "#555",
                                    fontSize: 11, padding: "4px 8px", borderRadius: 7,
                                  }}>✕</button>
                                </div>
                              ) : (
                                <span
                                  onClick={e => { e.stopPropagation(); openEditTime(task); }}
                                  style={{ display: "inline-flex", alignItems: "center", gap: 4,
                                    fontSize: 11, color: task.tiempo_real > 0 ? "#888" : "#555",
                                    fontFamily: "DM Mono", cursor: "pointer",
                                    background: "#1a1a1a", border: "1px solid #2a2a2a",
                                    padding: "2px 8px", borderRadius: 6 }}
                                  title="Click para editar tiempo real"
                                >
                                  ✎ {task.tiempo_real > 0 ? `Real: ${minsToH(task.tiempo_real)}` : "Log tiempo"}
                                </span>
                              )}

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
