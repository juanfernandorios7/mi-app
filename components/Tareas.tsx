"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tarea, Proyecto } from "@/lib/types";
import { today, minsToH } from "@/lib/utils";
import { TimerState } from "./AppShell";

interface TareasProps {
  initialTareas: Tarea[];
  proyectos: Proyecto[];
  onTareasChange: () => void;
  capacidadHoras?: number;
  timer: TimerState;
}

const EMPTY_TAREA = {
  titulo: "", descripcion: "", proyecto_id: "",
  estado: "pendiente", prioridad: "media",
  fecha: today(), tiempo_estimado: 1, tiempo_real: 0,
};

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function getWeekDays(offset: number): { date: string; label: string; dayName: string; isToday: boolean }[] {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  const result = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() + i);
    const year = cur.getFullYear();
    const month = String(cur.getMonth() + 1).padStart(2, "0");
    const dayStr = String(cur.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${dayStr}`;
    result.push({
      date: dateKey,
      label: `${DIAS[i]} ${cur.getDate()}`,
      dayName: DIAS[i],
      isToday: dateKey === today(),
    });
  }
  return result;
}

const ESTADOS = [
  { key: "pendiente",   label: "Pendientes",   color: "#555"    },
  { key: "en_progreso", label: "En Progreso",   color: "#c8922a" },
  { key: "completada",  label: "Finalizadas",   color: "#7c9e6e" },
] as const;

export default function Tareas({ initialTareas, proyectos, onTareasChange, capacidadHoras = 40, timer }: TareasProps) {
  const supabase = createClient();
  const [tareas, setTareas] = useState<Tarea[]>(initialTareas);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  useEffect(() => { setTareas(initialTareas); }, [initialTareas]);
  const [showAdd, setShowAdd] = useState(false);
  const [newTarea, setNewTarea] = useState({ ...EMPTY_TAREA });
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState<"una" | "masiva">("una");
  const [bulkText, setBulkText] = useState("");
  const [bulkProyecto, setBulkProyecto] = useState("");
  const [bulkFecha, setBulkFecha] = useState(today());
  const [bulkTiempo, setBulkTiempo] = useState(1);

  const [view, setView] = useState<"kanban" | "semana">("kanban");

  const [selectedProyecto, setSelectedProyecto] = useState<string>("todos");
  const [showProyectoMenu, setShowProyectoMenu] = useState(false);
  const [movingTask, setMovingTask] = useState<string | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [rolloverDismissed, setRolloverDismissed] = useState(false);
  const [rolloverSaving, setRolloverSaving] = useState(false);
  const atrasadas = tareas.filter(t =>
    (t.estado === "pendiente" || t.estado === "en_progreso") && t.fecha < today()
  );

  const rolloverToday = async () => {
    if (atrasadas.length === 0) return;
    setRolloverSaving(true);
    const ids = atrasadas.map(t => t.id);
    const { error } = await supabase.from("tareas").update({ fecha: today() }).in("id", ids);
    if (!error) {
      setTareas(ts => ts.map(t => ids.includes(t.id) ? { ...t, fecha: today() } : t));
      setRolloverDismissed(true);
      onTareasChange();
    } else {
      showError("No se pudieron mover las tareas. Intenta de nuevo.");
    }
    setRolloverSaving(false);
  };

  const [weekOffset, setWeekOffset] = useState(0);
  const [quickAddDay, setQuickAddDay] = useState<string | null>(null);
  const [movingToDay, setMovingToDay] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  const moveTaskToDay = async (taskId: string, newDate: string) => {
    const task = tareas.find(t => t.id === taskId);
    if (!task || task.fecha === newDate) return;
    setTareas(ts => ts.map(t => t.id === taskId ? { ...t, fecha: newDate } : t));
    setMovingToDay(null);
    const { error } = await supabase.from("tareas").update({ fecha: newDate }).eq("id", taskId);
    if (error) showError("No se pudo mover la tarea.");
    onTareasChange();
  };
  const [quickTitulo, setQuickTitulo] = useState("");
  const [quickProyecto, setQuickProyecto] = useState("");

  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    titulo: string; proyecto_id: string; prioridad: string;
    fecha: string; tiempo_estimado_h: number; tiempo_estimado_m: number;
    tiempo_real_h: number; tiempo_real_m: number;
  } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowAdd(false); setMovingTask(null); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowProyectoMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = selectedProyecto === "todos"
    ? tareas
    : tareas.filter(t => t.proyecto_id === selectedProyecto);

  const byEstado = (estado: string) => filtered.filter(t => t.estado === estado);
  const selectedProyectoObj = proyectos.find(p => p.id === selectedProyecto);

  const moveTask = async (tarea: Tarea, newEstado: string) => {
    const updates: Record<string, string> = { estado: newEstado };
    if (newEstado === "completada") updates.fecha = today();
    setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, ...updates } as Tarea : t));
    const { error } = await supabase.from("tareas").update(updates).eq("id", tarea.id);
    if (error) showError("No se pudo mover la tarea.");
    setMovingTask(null);
    onTareasChange();
  };

  const deleteTask = async (id: string) => {
    setTareas(ts => ts.filter(t => t.id !== id));
    setConfirmDeleteTask(null);
    const { error } = await supabase.from("tareas").delete().eq("id", id);
    if (error) showError("No se pudo eliminar la tarea.");
    onTareasChange();
  };

  const startTimer = useCallback(async (tarea: Tarea) => {
    if (timer.trackingId === tarea.id) {
      const mins = Math.floor(timer.elapsed / 60);
      const newReal = tarea.tiempo_real + mins;
      setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, tiempo_real: newReal } : t));
      await supabase.from("tareas").update({ tiempo_real: newReal }).eq("id", tarea.id);
      if (tarea.proyecto_id) {
        const proj = proyectos.find(p => p.id === tarea.proyecto_id);
        if (proj) {
          const newHours = +(proj.horas_logged + mins / 60).toFixed(2);
          await supabase.from("proyectos").update({ horas_logged: newHours }).eq("id", tarea.proyecto_id);
        }
      }
      timer.stopTracking();
      onTareasChange();
    } else if (!timer.trackingId) {
      timer.startTracking(tarea.id);
    }
  }, [timer, supabase, proyectos, onTareasChange]);

  const quickAddTask = async (fecha: string) => {
    if (!quickTitulo.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("tareas").insert({
      titulo: quickTitulo.trim(),
      proyecto_id: quickProyecto || null,
      estado: "pendiente", prioridad: "media",
      fecha,
      tiempo_estimado: 60, tiempo_real: 0,
    }).select().single();
    if (!error && data) {
      setTareas(ts => [...ts, data as Tarea]);
      setQuickTitulo(""); setQuickProyecto("");
      setQuickAddDay(null);
      onTareasChange();
    } else if (error) {
      showError("No se pudo crear la tarea.");
    }
    setSaving(false);
  };

  const openEditTask = (task: Tarea) => {
    setEditingTask(task.id);
    setMovingTask(null);
    setEditForm({
      titulo: task.titulo,
      proyecto_id: task.proyecto_id || "",
      prioridad: task.prioridad,
      fecha: task.fecha || today(),
      tiempo_estimado_h: Math.floor(task.tiempo_estimado / 60),
      tiempo_estimado_m: task.tiempo_estimado % 60,
      tiempo_real_h: Math.floor(task.tiempo_real / 60),
      tiempo_real_m: task.tiempo_real % 60,
    });
  };

  const saveEditTask = async (task: Tarea) => {
    if (!editForm || !editForm.titulo) return;
    setSaving(true);
    const tiempo_estimado = editForm.tiempo_estimado_h * 60 + editForm.tiempo_estimado_m;
    const tiempo_real = editForm.tiempo_real_h * 60 + editForm.tiempo_real_m;
    const updates = {
      titulo: editForm.titulo,
      proyecto_id: editForm.proyecto_id || null,
      prioridad: editForm.prioridad,
      fecha: editForm.fecha,
      tiempo_estimado,
      tiempo_real,
    };
    const { error } = await supabase.from("tareas").update(updates).eq("id", task.id);
    if (!error) {
      setTareas(ts => ts.map(t => t.id === task.id ? { ...t, ...updates } as Tarea : t));
      setEditingTask(null);
      setEditForm(null);
      onTareasChange();
    } else {
      showError("No se pudo guardar. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const addTarea = async () => {
    if (!newTarea.titulo) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("tareas")
      .insert({
        titulo: newTarea.titulo,
        descripcion: newTarea.descripcion || null,
        proyecto_id: newTarea.proyecto_id || null,
        estado: newTarea.estado,
        prioridad: newTarea.prioridad,
        fecha: newTarea.fecha || today(),
        tiempo_estimado: Math.round((Number(newTarea.tiempo_estimado) || 1) * 60),
        tiempo_real: Math.round((Number(newTarea.tiempo_real) || 0) * 60),
      })
      .select().single();
    if (!error && data) {
      setTareas(ts => [...ts, data as Tarea]);
      setNewTarea({ ...EMPTY_TAREA });
      setShowAdd(false);
      onTareasChange();
    } else if (error) {
      showError("No se pudo crear la tarea. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const addBulkTareas = async () => {
    const lineas = bulkText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
    if (lineas.length === 0) return;
    setSaving(true);
    const rows = lineas.map(titulo => ({
      titulo,
      proyecto_id: bulkProyecto || null,
      estado: "pendiente",
      prioridad: "media",
      fecha: bulkFecha || today(),
      tiempo_estimado: Math.round(bulkTiempo * 60),
      tiempo_real: 0,
    }));
    const { data, error } = await supabase.from("tareas").insert(rows).select();
    if (!error && data) {
      setTareas(ts => [...ts, ...(data as Tarea[])]);
      setBulkText(""); setBulkProyecto(""); setBulkFecha(today()); setBulkTiempo(1);
      setShowAdd(false);
      onTareasChange();
    } else if (error) {
      showError("No se pudieron crear las tareas. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const bulkLines = bulkText.split("\n").filter(l => l.trim().length > 0).length;

  const field: React.CSSProperties = {
    background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 12,
    padding: "14px 16px", color: "#1a1510", fontSize: 14,
    fontFamily: "'Syne', sans-serif", outline: "none", width: "100%",
  };

  return (
    <div className="fade-up">

      {/* Error toast */}
      {errorMsg && <div className="error-toast">{errorMsg}</div>}

      {/* ── Banner rollover ── */}
      {atrasadas.length > 0 && !rolloverDismissed && (
        <div style={{
          background: "#c8922a0f", border: "1px solid #c8922a33",
          borderRadius: 14, padding: "14px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#c8922a", fontFamily: "Syne", marginBottom: 2 }}>
                {atrasadas.length} tarea{atrasadas.length > 1 ? "s" : ""} pendiente{atrasadas.length > 1 ? "s" : ""} de días anteriores
              </p>
              <p style={{ fontSize: 11, color: "#c8922a", opacity: 0.7, fontFamily: "DM Mono" }}>
                {atrasadas.map(t => t.titulo).slice(0, 3).join(" · ")}{atrasadas.length > 3 ? ` · +${atrasadas.length - 3} más` : ""}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={rolloverToday}
              disabled={rolloverSaving}
              style={{
                background: "#c8922a", border: "none", color: "#1a1510",
                padding: "8px 18px", borderRadius: 9,
                fontSize: 12, fontFamily: "Syne", fontWeight: 700,
              }}
            >
              {rolloverSaving ? "Moviendo..." : "Mover a hoy"}
            </button>
            <button
              onClick={() => setRolloverDismissed(true)}
              style={{
                background: "transparent", border: "1px solid #c8922a44", color: "#c8922a",
                padding: "8px 14px", borderRadius: 9,
                fontSize: 12, fontFamily: "Syne", fontWeight: 600, opacity: 0.6,
              }}
            >
              Ignorar
            </button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>Tareas</h2>

          <div style={{ display: "flex", gap: 2, background: "#FAF7F3", border: "1px solid #E0D8CE", borderRadius: 10, padding: 3 }}>
            {(["kanban", "semana"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: "5px 14px", borderRadius: 8, border: "none",
                background: view === v ? "#E0D8CE" : "transparent",
                color: view === v ? "#c8922a" : "#555",
                fontSize: 12, fontFamily: "Syne", fontWeight: 700,
              }}>
                {v === "kanban" ? "Kanban" : "Semana"}
              </button>
            ))}
          </div>

          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowProyectoMenu(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 10,
                padding: "7px 14px",
              }}
            >
              {selectedProyectoObj
                ? <><div style={{ width: 7, height: 7, borderRadius: "50%", background: selectedProyectoObj.color }} /><span style={{ fontSize: 13, color: "#2a2018", fontFamily: "Syne", fontWeight: 600 }}>{selectedProyectoObj.nombre}</span></>
                : <span style={{ fontSize: 13, color: "#888", fontFamily: "Syne", fontWeight: 600 }}>Todos los proyectos</span>
              }
              <span style={{ fontSize: 10, color: "#555", marginLeft: 2 }}>▾</span>
            </button>

            {showProyectoMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0,
                background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 12,
                padding: 6, zIndex: 100, minWidth: 200, boxShadow: "0 8px 32px #00000088",
              }}>
                <button onClick={() => { setSelectedProyecto("todos"); setShowProyectoMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8,
                    background: selectedProyecto === "todos" ? "#E0D8CE" : "transparent",
                    border: "none", color: selectedProyecto === "todos" ? "#c8922a" : "#888",
                    fontSize: 13, fontFamily: "Syne", fontWeight: 600 }}>
                  ○ Todos los proyectos
                </button>
                {proyectos.filter(p => p.estado !== "finalizado").map(p => (
                  <button key={p.id} onClick={() => { setSelectedProyecto(p.id); setShowProyectoMenu(false); }}
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8,
                      background: selectedProyecto === p.id ? "#E0D8CE" : "transparent",
                      border: "none", color: selectedProyecto === p.id ? p.color : "#888",
                      fontSize: 13, fontFamily: "Syne", fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button onClick={() => setShowAdd(true)} style={{
          background: "#c8922a18", border: "1px solid #c8922a",
          color: "#c8922a", padding: "10px 20px", borderRadius: 12,
          fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700,
        }}>
          + Nueva tarea
        </button>
      </div>

      {/* ── Vista Semana ── */}
      {view === "semana" && (() => {
        const weekDays = getWeekDays(weekOffset);
        const monthLabel = new Date(weekDays[0].date).toLocaleDateString("es-CO", { month: "long", year: "numeric" });
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => setWeekOffset(w => w - 1)} style={{
                background: "#FAF7F3", border: "1px solid #D4C9BC", color: "#666",
                width: 32, height: 32, borderRadius: 8, fontSize: 16,
              }}>‹</button>
              <span style={{ fontSize: 13, color: "#888", fontFamily: "DM Mono", textTransform: "capitalize", minWidth: 160, textAlign: "center" }}>
                {monthLabel}
              </span>
              <button onClick={() => setWeekOffset(w => w + 1)} style={{
                background: "#FAF7F3", border: "1px solid #D4C9BC", color: "#666",
                width: 32, height: 32, borderRadius: 8, fontSize: 16,
              }}>›</button>
              {weekOffset !== 0 && (
                <button onClick={() => setWeekOffset(0)} style={{
                  background: "transparent", border: "1px solid #D4C9BC", color: "#555",
                  padding: "4px 12px", borderRadius: 8, fontSize: 11, fontFamily: "Syne", fontWeight: 600,
                }}>Hoy</button>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 10, alignItems: "start" }}>
              {weekDays.map(({ date, label, isToday }) => {
                const dayTasks = tareas.filter(t => t.fecha === date);
                const isQuickAdd = quickAddDay === date;

                const dailyCap = capacidadHoras / 5;
                const dayWorked = dayTasks.filter(t => t.tiempo_real > 0).reduce((a, t) => a + t.tiempo_real / 60, 0);
                const dayCommitted = dayTasks.filter(t => t.estado === "pendiente" || t.estado === "en_progreso").reduce((a, t) => a + t.tiempo_estimado / 60, 0);
                const dayTotal = dayWorked + dayCommitted;
                const dayPct = Math.min(100, (dayTotal / dailyCap) * 100);
                const barColor = dayPct >= 90 ? "#b05a5a" : dayPct >= 70 ? "#c8922a" : "#7c9e6e";

                const isDragTarget = dragOverDate === date && draggedTaskId !== null;
                return (
                  <div
                    key={date}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverDate(date); }}
                    onDragLeave={e => { const rel = e.relatedTarget as Node | null; if (!rel || !e.currentTarget.contains(rel)) setDragOverDate(null); }}
                    onDrop={e => {
                      e.preventDefault();
                      if (draggedTaskId) { moveTaskToDay(draggedTaskId, date); }
                      setDraggedTaskId(null); setDragOverDate(null);
                    }}
                    style={{
                      padding: "6px 4px", borderRadius: 12,
                      background: isDragTarget ? "#c8922a08" : "transparent",
                      border: isDragTarget ? "1px solid #c8922a44" : "1px solid transparent",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                  >
                    <div style={{
                      textAlign: "center", marginBottom: 10, padding: "8px 4px",
                      borderRadius: 10,
                      background: isToday ? "#c8922a18" : "transparent",
                      border: isToday ? "1px solid #c8922a33" : "1px solid transparent",
                    }}>
                      <p style={{ fontSize: 11, fontFamily: "DM Mono", fontWeight: 700,
                        color: isToday ? "#c8922a" : "#666",
                        textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {label.split(" ")[0]}
                      </p>
                      <p style={{ fontSize: 20, fontFamily: "'DM Serif Display', serif",
                        color: isToday ? "#c8922a" : "#888", lineHeight: 1.2 }}>
                        {label.split(" ")[1]}
                      </p>
                      {dayTasks.length > 0 && (
                        <div style={{ marginTop: 6, padding: "0 4px" }}>
                          <div style={{ height: 3, background: "#F5F1EC", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: dayPct + "%", background: barColor, borderRadius: 2, transition: "width 0.4s ease" }} />
                          </div>
                          <p style={{ fontSize: 9, fontFamily: "DM Mono", color: barColor, marginTop: 3, opacity: 0.8 }}>
                            {dayTotal.toFixed(1)}h
                          </p>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, minHeight: 60 }}>
                      {dayTasks.map(task => {
                        const proj = proyectos.find(p => p.id === task.proyecto_id);
                        const isDone = task.estado === "completada";
                        const isMovingThis = movingToDay === task.id;
                        const isBeingDragged = draggedTaskId === task.id;
                        return (
                          <div
                            key={task.id}
                            style={{ position: "relative", opacity: isBeingDragged ? 0.35 : 1, transition: "opacity 0.15s", userSelect: "none" }}
                            draggable={!isDone}
                            onDragStart={e => {
                              setDraggedTaskId(task.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", task.id);
                            }}
                            onDragEnd={() => { setDraggedTaskId(null); setDragOverDate(null); }}
                          >
                            <div style={{
                              background: "#FAF7F3", border: "1px solid " + (isDone ? "#F5F1EC" : "#E0D8CE"),
                              borderRadius: 10, padding: "10px 12px",
                              opacity: isDone ? 0.5 : 1,
                              cursor: isDone ? "default" : "grab",
                            }}>
                              {proj && <div style={{ height: 2, background: proj.color, borderRadius: 2, marginBottom: 6, opacity: 0.7 }} />}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 4 }}>
                                <p style={{
                                  fontSize: 12, fontWeight: 600, lineHeight: 1.3,
                                  color: isDone ? "#555" : "#ddd",
                                  textDecoration: isDone ? "line-through" : "none",
                                  marginBottom: 4, flex: 1,
                                }}>{task.titulo}</p>
                                {!isDone && (
                                  <button
                                    onClick={() => setMovingToDay(isMovingThis ? null : task.id)}
                                    style={{ background: "transparent", border: "none", color: "#555", fontSize: 14, padding: "0 2px", lineHeight: 1, flexShrink: 0 }}
                                    title="Mover a otro día"
                                  >⇄</button>
                                )}
                              </div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {proj && <span style={{ fontSize: 9, color: proj.color, fontFamily: "DM Mono" }}>◆ {proj.nombre}</span>}
                                <span style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono" }}>{minsToH(task.tiempo_estimado)}</span>
                                {isDone && <span style={{ fontSize: 9, color: "#7c9e6e", fontFamily: "DM Mono" }}>✓</span>}
                              </div>
                            </div>
                            {isMovingThis && (
                              <div style={{
                                position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                                background: "#F5F1EC", border: "1px solid #D4C9BC", borderRadius: 10,
                                padding: 6, zIndex: 100, boxShadow: "0 8px 24px #00000088",
                              }}>
                                <p style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono", textTransform: "uppercase", letterSpacing: "0.1em", padding: "4px 6px 6px" }}>Mover a</p>
                                {weekDays.filter(d => d.date !== date).map(d => (
                                  <button key={d.date} onClick={() => moveTaskToDay(task.id, d.date)} style={{
                                    width: "100%", textAlign: "left", padding: "6px 10px", borderRadius: 7,
                                    border: "none", background: "transparent", color: "#aaa",
                                    fontSize: 11, fontFamily: "Syne", fontWeight: 600,
                                    display: "flex", justifyContent: "space-between",
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "#D4C9BC")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                                  >
                                    <span>{d.label}</span>
                                    {d.isToday && <span style={{ fontSize: 9, color: "#c8922a" }}>hoy</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {isQuickAdd ? (
                        <div style={{ background: "#FAF7F3", border: "1px solid #C8BAA8", borderRadius: 10, padding: 10 }}>
                          <input
                            autoFocus
                            placeholder="Nombre de la tarea"
                            value={quickTitulo}
                            onChange={e => setQuickTitulo(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") quickAddTask(date); if (e.key === "Escape") { setQuickAddDay(null); setQuickTitulo(""); } }}
                            style={{ width: "100%", background: "transparent", border: "none", color: "#fff",
                              fontSize: 12, fontFamily: "Syne", outline: "none", marginBottom: 8 }}
                          />
                          <select value={quickProyecto} onChange={e => setQuickProyecto(e.target.value)}
                            style={{ width: "100%", background: "#F5F1EC", border: "1px solid #D4C9BC",
                              borderRadius: 6, padding: "4px 8px", color: "#888", fontSize: 11,
                              fontFamily: "Syne", outline: "none", marginBottom: 8 }}>
                            <option value="">Sin proyecto</option>
                            {proyectos.filter(p => p.estado !== "finalizado").map(p =>
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            )}
                          </select>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => quickAddTask(date)} disabled={saving} style={{
                              flex: 1, background: "#c8922a22", border: "1px solid #c8922a66",
                              color: "#c8922a", borderRadius: 6, padding: "4px 0",
                              fontSize: 11, fontFamily: "Syne", fontWeight: 700,
                            }}>Agregar</button>
                            <button onClick={() => { setQuickAddDay(null); setQuickTitulo(""); }} style={{
                              background: "transparent", border: "1px solid #D4C9BC", color: "#555",
                              borderRadius: 6, padding: "4px 8px", fontSize: 11,
                            }}>✕</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={() => { setQuickAddDay(date); setQuickTitulo(""); setQuickProyecto(""); }}
                          style={{
                            width: "100%", background: "transparent",
                            border: "1px dashed #E0D8CE", borderRadius: 10,
                            color: "#333", padding: "8px 0", fontSize: 18,
                            transition: "all 0.15s",
                          }}
                          onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = "#C8BAA8"; (e.target as HTMLElement).style.color = "#555"; }}
                          onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = "#E0D8CE"; (e.target as HTMLElement).style.color = "#333"; }}
                        >+</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── Vista Kanban ── */}
      <div style={{ display: view === "kanban" ? "grid" : "none", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
        {ESTADOS.map(({ key, label, color }) => {
          const col = byEstado(key);
          return (
            <div key={key}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 11, color, fontFamily: "DM Mono", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {label}
                </span>
                {/* Contador mejorado — visible */}
                <span style={{
                  fontSize: 10, color: "#888", fontFamily: "DM Mono",
                  background: "#F5F1EC", padding: "1px 7px", borderRadius: 20, marginLeft: 2,
                }}>{col.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.length === 0 && (
                  <div style={{ border: "1px dashed #E0D8CE", borderRadius: 14, padding: "24px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#555", fontFamily: "DM Mono" }}>Sin tareas</p>
                  </div>
                )}

                {col.map(task => {
                  const proj = proyectos.find(p => p.id === task.proyecto_id);
                  const isTracking = timer.trackingId === task.id;
                  const isMoving = movingTask === task.id;
                  const accentColor = proj?.color || "#555";
                  const isEditing = editingTask === task.id;
                  const otherTimerActive = timer.trackingId !== null && timer.trackingId !== task.id;

                  return (
                    <div key={task.id} className="task-card" style={{
                      background: "#FAF7F3",
                      border: "1px solid " + (isTracking ? accentColor + "66" : isEditing ? "#C8BAA8" : "#E0D8CE"),
                      borderRadius: 14, padding: "14px 16px",
                      transition: "border-color 0.2s",
                    }}>
                      {proj && <div style={{ height: 2, background: proj.color, borderRadius: 2, marginBottom: 10, opacity: 0.6 }} />}

                      {isEditing && editForm ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <input
                            value={editForm.titulo}
                            onChange={e => setEditForm({ ...editForm, titulo: e.target.value })}
                            autoFocus
                            style={{ background: "#FFFFFF", border: "1px solid #C8BAA8", borderRadius: 8,
                              padding: "8px 10px", color: "#fff", fontSize: 13, fontFamily: "Syne",
                              outline: "none", width: "100%" }}
                          />
                          <select value={editForm.proyecto_id}
                            onChange={e => setEditForm({ ...editForm, proyecto_id: e.target.value })}
                            style={{ background: "#FFFFFF", border: "1px solid #C8BAA8", borderRadius: 8,
                              padding: "7px 10px", color: "#2a2018", fontSize: 12, fontFamily: "Syne", outline: "none" }}>
                            <option value="">Sin proyecto</option>
                            {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                          </select>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <select value={editForm.prioridad}
                              onChange={e => setEditForm({ ...editForm, prioridad: e.target.value })}
                              style={{ background: "#FFFFFF", border: "1px solid #C8BAA8", borderRadius: 8,
                                padding: "7px 10px", color: "#2a2018", fontSize: 12, fontFamily: "Syne", outline: "none" }}>
                              <option value="alta">Alta</option>
                              <option value="media">Media</option>
                              <option value="baja">Baja</option>
                            </select>
                            <input type="date" value={editForm.fecha}
                              onChange={e => setEditForm({ ...editForm, fecha: e.target.value })}
                              style={{ background: "#FFFFFF", border: "1px solid #C8BAA8", borderRadius: 8,
                                padding: "7px 10px", color: "#2a2018", fontSize: 12, outline: "none", colorScheme: "light" }} />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            <div>
                              <p style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono", marginBottom: 4 }}>Estimado</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <input type="number" min={0} value={editForm.tiempo_estimado_h}
                                    onChange={e => setEditForm({ ...editForm, tiempo_estimado_h: Math.max(0, Number(e.target.value)) })}
                                    style={{ width: 44, background: "#D4C9BC", border: "1px solid #444", borderRadius: 6,
                                      color: "#fff", fontSize: 13, fontFamily: "DM Mono", textAlign: "center", padding: "4px 0", outline: "none" }} />
                                  <span style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono" }}>h</span>
                                </div>
                                <span style={{ color: "#444", marginBottom: 12 }}>:</span>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <input type="number" min={0} max={59} value={editForm.tiempo_estimado_m}
                                    onChange={e => setEditForm({ ...editForm, tiempo_estimado_m: Math.max(0, Math.min(59, Number(e.target.value))) })}
                                    style={{ width: 44, background: "#D4C9BC", border: "1px solid #444", borderRadius: 6,
                                      color: "#fff", fontSize: 13, fontFamily: "DM Mono", textAlign: "center", padding: "4px 0", outline: "none" }} />
                                  <span style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono" }}>min</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <p style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono", marginBottom: 4 }}>Real</p>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <input type="number" min={0} value={editForm.tiempo_real_h}
                                    onChange={e => setEditForm({ ...editForm, tiempo_real_h: Math.max(0, Number(e.target.value)) })}
                                    style={{ width: 44, background: "#D4C9BC", border: "1px solid #444", borderRadius: 6,
                                      color: "#fff", fontSize: 13, fontFamily: "DM Mono", textAlign: "center", padding: "4px 0", outline: "none" }} />
                                  <span style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono" }}>h</span>
                                </div>
                                <span style={{ color: "#444", marginBottom: 12 }}>:</span>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                                  <input type="number" min={0} max={59} value={editForm.tiempo_real_m}
                                    onChange={e => setEditForm({ ...editForm, tiempo_real_m: Math.max(0, Math.min(59, Number(e.target.value))) })}
                                    style={{ width: 44, background: "#D4C9BC", border: "1px solid #444", borderRadius: 6,
                                      color: "#fff", fontSize: 13, fontFamily: "DM Mono", textAlign: "center", padding: "4px 0", outline: "none" }} />
                                  <span style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono" }}>min</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                            <button onClick={() => saveEditTask(task)} disabled={saving} style={{
                              background: accentColor + "22", border: "1px solid " + accentColor + "66",
                              color: accentColor, padding: "6px 14px", borderRadius: 8,
                              fontSize: 12, fontFamily: "Syne", fontWeight: 700, flex: 1,
                            }}>
                              {saving ? "Guardando..." : "Guardar"}
                            </button>
                            <button onClick={() => { setEditingTask(null); setEditForm(null); }} style={{
                              background: "transparent", border: "1px solid #D4C9BC",
                              color: "#555", padding: "6px 12px", borderRadius: 8,
                              fontSize: 12, fontFamily: "Syne", fontWeight: 600,
                            }}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 8 }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: key === "completada" ? "#555" : "#ddd",
                              textDecoration: key === "completada" ? "line-through" : "none", lineHeight: 1.4, flex: 1 }}>
                              {task.titulo}
                            </p>
                            {/* Acciones hover — visibles solo al pasar el cursor */}
                            <div className="task-actions" style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                              <button onClick={() => openEditTask(task)} style={{
                                background: "transparent", border: "none", color: "#888",
                                fontSize: 14, padding: "2px 4px",
                              }} title="Editar">✎</button>
                              <button onClick={() => setConfirmDeleteTask(confirmDeleteTask === task.id ? null : task.id)} style={{
                                background: "transparent", border: "none", color: "#888",
                                fontSize: 16, padding: "2px 4px",
                              }} title="Eliminar">×</button>
                            </div>
                          </div>

                          {confirmDeleteTask === task.id && (
                            <div style={{ background: "#b05a5a12", border: "1px solid #b05a5a33",
                              borderRadius: 8, padding: "10px 12px", marginBottom: 10,
                              display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, color: "#b05a5a" }}>¿Eliminar esta tarea?</span>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => setConfirmDeleteTask(null)} style={{
                                  background: "transparent", border: "1px solid #333", color: "#666",
                                  padding: "3px 8px", borderRadius: 6, fontSize: 11, fontFamily: "Syne",
                                }}>No</button>
                                <button onClick={() => deleteTask(task.id)} style={{
                                  background: "#b05a5a22", border: "1px solid #b05a5a", color: "#b05a5a",
                                  padding: "3px 8px", borderRadius: 6, fontSize: 11, fontFamily: "Syne", fontWeight: 700,
                                }}>Sí</button>
                              </div>
                            </div>
                          )}

                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                            {proj && <span style={{ fontSize: 10, color: proj.color, fontFamily: "DM Mono" }}>◆ {proj.nombre}</span>}
                            <span style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono" }}>Est: {minsToH(task.tiempo_estimado)}</span>
                            {task.tiempo_real > 0 && <span style={{ fontSize: 10, color: "#777", fontFamily: "DM Mono" }}>Real: {minsToH(task.tiempo_real)}</span>}
                            {task.fecha && task.fecha !== today() && (
                              <span style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono" }}>{task.fecha}</span>
                            )}
                            {task.fecha === today() && <span style={{ fontSize: 10, color: accentColor, fontFamily: "DM Mono" }}>· hoy</span>}
                          </div>

                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {key !== "completada" && (
                              <button
                                onClick={() => startTimer(task)}
                                disabled={otherTimerActive}
                                style={{
                                  background: isTracking ? accentColor + "22" : "#F5F1EC",
                                  border: "1px solid " + (isTracking ? accentColor : "#D4C9BC"),
                                  color: isTracking ? accentColor : otherTimerActive ? "#333" : "#666",
                                  padding: "4px 10px", borderRadius: 7,
                                  fontSize: 11, fontFamily: "Syne", fontWeight: 700, whiteSpace: "nowrap",
                                  opacity: otherTimerActive ? 0.4 : 1,
                                }}
                                title={otherTimerActive ? "Hay un timer activo en otro lado" : undefined}
                              >
                                {isTracking
                                  ? `⏹ ${String(Math.floor(timer.elapsed / 60)).padStart(2, "0")}:${String(timer.elapsed % 60).padStart(2, "0")}`
                                  : "▶"}
                              </button>
                            )}

                            <div style={{ position: "relative" }}>
                              <button onClick={() => setMovingTask(isMoving ? null : task.id)} style={{
                                background: "#F5F1EC", border: "1px solid #D4C9BC",
                                color: "#666", padding: "4px 10px", borderRadius: 7,
                                fontSize: 11, fontFamily: "Syne", fontWeight: 700,
                              }}>
                                Mover a ▾
                              </button>
                              {isMoving && (
                                <div style={{
                                  position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                                  background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 10,
                                  padding: 6, zIndex: 50, minWidth: 160, boxShadow: "0 8px 24px #00000088",
                                }}>
                                  {ESTADOS.filter(e => e.key !== key).map(e => (
                                    <button key={e.key} onClick={() => moveTask(task, e.key)}
                                      style={{ width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 7,
                                        border: "none", background: "transparent", color: e.color,
                                        fontSize: 12, fontFamily: "Syne", fontWeight: 600,
                                        display: "flex", alignItems: "center", gap: 8 }}>
                                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.color }} />
                                      {e.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Modal nueva tarea ── */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{
          position: "fixed", inset: 0, paddingTop: 58,
          background: "#000000bb",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 200,
        }}>
          <div onClick={e => e.stopPropagation()} className="fade-up" style={{
            background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 20,
            padding: "28px 32px", width: "100%", maxWidth: 520,
            maxHeight: "calc(100vh - 80px)", overflowY: "auto", margin: "auto",
          }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, marginBottom: 16, color: "#1a1510" }}>
              Nueva tarea
            </h3>

            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#FFFFFF", borderRadius: 10, padding: 4 }}>
              {(["una", "masiva"] as const).map(tab => (
                <button key={tab} onClick={() => setModalTab(tab)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                  background: modalTab === tab ? "#E0D8CE" : "transparent",
                  color: modalTab === tab ? "#c8922a" : "#555",
                  fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: 700,
                }}>
                  {tab === "una" ? "Una tarea" : "Carga masiva"}
                </button>
              ))}
            </div>

            {modalTab === "una" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input placeholder="Título *" value={newTarea.titulo}
                    onChange={e => setNewTarea({ ...newTarea, titulo: e.target.value })} style={field} autoFocus />
                  <input placeholder="Descripción (opcional)" value={newTarea.descripcion}
                    onChange={e => setNewTarea({ ...newTarea, descripcion: e.target.value })} style={field} />
                  <select value={newTarea.proyecto_id} onChange={e => setNewTarea({ ...newTarea, proyecto_id: e.target.value })} style={field}>
                    <option value="">Selecciona proyecto</option>
                    {proyectos.filter(p => p.estado !== "finalizado").map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <select value={newTarea.estado} onChange={e => setNewTarea({ ...newTarea, estado: e.target.value })} style={field}>
                      <option value="pendiente">Pendiente</option>
                      <option value="en_progreso">En progreso</option>
                      <option value="completada">Completada</option>
                    </select>
                    <select value={newTarea.prioridad} onChange={e => setNewTarea({ ...newTarea, prioridad: e.target.value })} style={field}>
                      <option value="alta">Alta</option>
                      <option value="media">Media</option>
                      <option value="baja">Baja</option>
                    </select>
                    <input type="date" value={newTarea.fecha}
                      onChange={e => setNewTarea({ ...newTarea, fecha: e.target.value })}
                      style={{ ...field, colorScheme: "light" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 6 }}>Tiempo estimado (h)</label>
                      <input type="number" min="0" step="0.5" value={newTarea.tiempo_estimado}
                        onChange={e => setNewTarea({ ...newTarea, tiempo_estimado: Number(e.target.value) })} style={field} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 6 }}>Tiempo real (h)</label>
                      <input type="number" min="0" step="0.5" value={newTarea.tiempo_real || ""}
                        onChange={e => setNewTarea({ ...newTarea, tiempo_real: Number(e.target.value) })} style={field} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20 }}>
                  <button onClick={addTarea} disabled={saving || !newTarea.titulo} style={{
                    background: saving || !newTarea.titulo ? "#D4C9BC" : "#c8922a",
                    border: "none", color: saving || !newTarea.titulo ? "#555" : "#1a1510",
                    padding: "12px 24px", borderRadius: 10,
                    fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700,
                    cursor: saving || !newTarea.titulo ? "not-allowed" : "pointer",
                  }}>
                    {saving ? "Guardando..." : "Guardar tarea"}
                  </button>
                  <button onClick={() => setShowAdd(false)} style={{ background: "transparent", border: "none", color: "#555", fontSize: 14, fontFamily: "'Syne', sans-serif" }}>
                    Cancelar
                  </button>
                </div>
              </>
            )}

            {modalTab === "masiva" && (
              <>
                <p style={{ fontSize: 12, color: "#666", marginBottom: 16, fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
                  Pega o escribe una tarea por línea.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <textarea placeholder={"Configurar Meta Ads\nRevisar copy homepage\nInforme mensual"}
                    value={bulkText} onChange={e => setBulkText(e.target.value)}
                    autoFocus rows={7} style={{ ...field, resize: "vertical", lineHeight: 1.7 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 12 }}>
                    <select value={bulkProyecto} onChange={e => setBulkProyecto(e.target.value)} style={field}>
                      <option value="">Proyecto (opcional)</option>
                      {proyectos.filter(p => p.estado !== "finalizado").map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <input type="date" value={bulkFecha} onChange={e => setBulkFecha(e.target.value)} style={{ ...field, colorScheme: "light" }} />
                    <div>
                      <label style={{ fontSize: 10, color: "#666", display: "block", marginBottom: 6 }}>h/tarea</label>
                      <input type="number" min="0.5" step="0.5" value={bulkTiempo}
                        onChange={e => setBulkTiempo(Number(e.target.value))} style={field} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20 }}>
                  <button onClick={addBulkTareas} disabled={saving || bulkLines === 0} style={{
                    background: saving || bulkLines === 0 ? "#D4C9BC" : "#c8922a",
                    border: "none", color: saving || bulkLines === 0 ? "#555" : "#1a1510",
                    padding: "12px 24px", borderRadius: 10,
                    fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700,
                    cursor: saving || bulkLines === 0 ? "not-allowed" : "pointer",
                  }}>
                    {saving ? "Creando..." : bulkLines > 0 ? `Crear ${bulkLines} tarea${bulkLines > 1 ? "s" : ""}` : "Crear tareas"}
                  </button>
                  <button onClick={() => setShowAdd(false)} style={{ background: "transparent", border: "none", color: "#555", fontSize: 14, fontFamily: "'Syne', sans-serif" }}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
