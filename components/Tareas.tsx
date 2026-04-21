"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tarea, Proyecto } from "@/lib/types";
import { today, minsToH } from "@/lib/utils";

interface TareasProps {
  initialTareas: Tarea[];
  proyectos: Proyecto[];
  onTareasChange: () => void;
}

const EMPTY_TAREA = {
  titulo: "", descripcion: "", proyecto_id: "",
  estado: "pendiente", prioridad: "media",
  fecha: today(), tiempo_estimado: 1, tiempo_real: 0,
};

const ESTADOS = [
  { key: "pendiente",   label: "Pendientes",   color: "#555"    },
  { key: "en_progreso", label: "En Progreso",   color: "#c8922a" },
  { key: "completada",  label: "Finalizadas",   color: "#7c9e6e" },
] as const;

export default function Tareas({ initialTareas, proyectos, onTareasChange }: TareasProps) {
  const supabase = createClient();
  const [tareas, setTareas] = useState<Tarea[]>(initialTareas);
  const [showAdd, setShowAdd] = useState(false);
  const [newTarea, setNewTarea] = useState({ ...EMPTY_TAREA });
  const [trackingId, setTrackingId] = useState<string | null>(null);
  const [trackingStart, setTrackingStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState<"una" | "masiva">("una");
  const [bulkText, setBulkText] = useState("");
  const [bulkProyecto, setBulkProyecto] = useState("");
  const [bulkFecha, setBulkFecha] = useState(today());
  const [bulkTiempo, setBulkTiempo] = useState(1);

  // Kanban states
  const [selectedProyecto, setSelectedProyecto] = useState<string>("todos");
  const [showProyectoMenu, setShowProyectoMenu] = useState(false);
  const [movingTask, setMovingTask] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    if (!trackingId || !trackingStart) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - trackingStart) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [trackingId, trackingStart]);

  // Escape para cerrar modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") { setShowAdd(false); setMovingTask(null); } };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cerrar menú proyecto al click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowProyectoMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Filtrar tareas por proyecto
  const filtered = selectedProyecto === "todos"
    ? tareas
    : tareas.filter(t => t.proyecto_id === selectedProyecto);

  const byEstado = (estado: string) => filtered.filter(t => t.estado === estado);

  const selectedProyectoObj = proyectos.find(p => p.id === selectedProyecto);

  // Mover tarea de estado
  const moveTask = async (tarea: Tarea, newEstado: string) => {
    setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, estado: newEstado as Tarea["estado"] } : t));
    await supabase.from("tareas").update({ estado: newEstado }).eq("id", tarea.id);
    setMovingTask(null);
    onTareasChange();
  };

  const startTimer = useCallback(async (tarea: Tarea) => {
    if (trackingId === tarea.id) {
      const mins = Math.floor(elapsed / 60);
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
      setTrackingId(null); setTrackingStart(null); setElapsed(0);
      onTareasChange();
    } else {
      setTrackingId(tarea.id); setTrackingStart(Date.now()); setElapsed(0);
    }
  }, [trackingId, elapsed, supabase, proyectos, onTareasChange]);

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
    }
    setSaving(false);
  };

  const bulkLines = bulkText.split("\n").filter(l => l.trim().length > 0).length;

  const field: React.CSSProperties = {
    background: "#111", border: "1px solid #2a2a2a", borderRadius: 12,
    padding: "14px 16px", color: "#e8e0d0", fontSize: 14,
    fontFamily: "'Syne', sans-serif", outline: "none", width: "100%",
  };

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>Tareas</h2>

          {/* Selector de proyecto */}
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              onClick={() => setShowProyectoMenu(v => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "#111", border: "1px solid #2a2a2a", borderRadius: 10,
                padding: "7px 14px", cursor: "pointer",
              }}
            >
              {selectedProyectoObj
                ? <><div style={{ width: 7, height: 7, borderRadius: "50%", background: selectedProyectoObj.color }} /><span style={{ fontSize: 13, color: "#ddd", fontFamily: "Syne", fontWeight: 600 }}>{selectedProyectoObj.nombre}</span></>
                : <span style={{ fontSize: 13, color: "#888", fontFamily: "Syne", fontWeight: 600 }}>Todos los proyectos</span>
              }
              <span style={{ fontSize: 10, color: "#555", marginLeft: 2 }}>▾</span>
            </button>

            {showProyectoMenu && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0,
                background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12,
                padding: 6, zIndex: 100, minWidth: 200, boxShadow: "0 8px 32px #00000088",
              }}>
                <button onClick={() => { setSelectedProyecto("todos"); setShowProyectoMenu(false); }}
                  style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8,
                    background: selectedProyecto === "todos" ? "#1e1e1e" : "transparent",
                    border: "none", color: selectedProyecto === "todos" ? "#c8922a" : "#888",
                    fontSize: 13, fontFamily: "Syne", fontWeight: 600, cursor: "pointer" }}>
                  ○ Todos los proyectos
                </button>
                {proyectos.map(p => (
                  <button key={p.id} onClick={() => { setSelectedProyecto(p.id); setShowProyectoMenu(false); }}
                    style={{ width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8,
                      background: selectedProyecto === p.id ? "#1e1e1e" : "transparent",
                      border: "none", color: selectedProyecto === p.id ? p.color : "#888",
                      fontSize: 13, fontFamily: "Syne", fontWeight: 600, cursor: "pointer",
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

      {/* ── Kanban ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>
        {ESTADOS.map(({ key, label, color }) => {
          const col = byEstado(key);
          return (
            <div key={key}>
              {/* Columna header */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 11, color, fontFamily: "DM Mono", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {label}
                </span>
                <span style={{ fontSize: 11, color: "#444", fontFamily: "DM Mono", marginLeft: 2 }}>{col.length}</span>
              </div>

              {/* Tarjetas */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.length === 0 && (
                  <div style={{ border: "1px dashed #1e1e1e", borderRadius: 14, padding: "24px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: 12, color: "#333", fontFamily: "DM Mono" }}>Sin tareas</p>
                  </div>
                )}

                {col.map(task => {
                  const proj = proyectos.find(p => p.id === task.proyecto_id);
                  const isTracking = trackingId === task.id;
                  const isMoving = movingTask === task.id;
                  const accentColor = proj?.color || "#555";

                  return (
                    <div key={task.id} style={{
                      background: "#111",
                      border: "1px solid " + (isTracking ? accentColor + "66" : "#1e1e1e"),
                      borderRadius: 14, padding: "14px 16px",
                      transition: "border-color 0.2s",
                    }}>
                      {/* Barra de color del proyecto */}
                      {proj && <div style={{ height: 2, background: proj.color, borderRadius: 2, marginBottom: 10, opacity: 0.6 }} />}

                      {/* Título */}
                      <p style={{ fontSize: 13, fontWeight: 700, color: key === "completada" ? "#555" : "#ddd",
                        textDecoration: key === "completada" ? "line-through" : "none", marginBottom: 8, lineHeight: 1.4 }}>
                        {task.titulo}
                      </p>

                      {/* Meta */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                        {proj && <span style={{ fontSize: 10, color: proj.color, fontFamily: "DM Mono" }}>◆ {proj.nombre}</span>}
                        <span style={{ fontSize: 10, color: "#444", fontFamily: "DM Mono" }}>Est: {minsToH(task.tiempo_estimado)}</span>
                        {task.tiempo_real > 0 && <span style={{ fontSize: 10, color: "#666", fontFamily: "DM Mono" }}>Real: {minsToH(task.tiempo_real)}</span>}
                        {task.fecha && task.fecha !== today() && (
                          <span style={{ fontSize: 10, color: "#444", fontFamily: "DM Mono" }}>{task.fecha}</span>
                        )}
                        {task.fecha === today() && <span style={{ fontSize: 10, color: accentColor, fontFamily: "DM Mono" }}>· hoy</span>}
                      </div>

                      {/* Acciones */}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {/* Timer */}
                        {key !== "completada" && (
                          <button onClick={() => startTimer(task)} style={{
                            background: isTracking ? accentColor + "22" : "#1a1a1a",
                            border: "1px solid " + (isTracking ? accentColor : "#2a2a2a"),
                            color: isTracking ? accentColor : "#666",
                            padding: "4px 10px", borderRadius: 7,
                            fontSize: 11, fontFamily: "Syne", fontWeight: 700, whiteSpace: "nowrap",
                          }}>
                            {isTracking
                              ? `⏹ ${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
                              : "▶"}
                          </button>
                        )}

                        {/* Mover a... */}
                        <div style={{ position: "relative" }}>
                          <button
                            onClick={() => setMovingTask(isMoving ? null : task.id)}
                            style={{
                              background: "#1a1a1a", border: "1px solid #2a2a2a",
                              color: "#666", padding: "4px 10px", borderRadius: 7,
                              fontSize: 11, fontFamily: "Syne", fontWeight: 700,
                            }}
                          >
                            Mover a ▾
                          </button>

                          {isMoving && (
                            <div style={{
                              position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                              background: "#141414", border: "1px solid #2a2a2a", borderRadius: 10,
                              padding: 6, zIndex: 50, minWidth: 160, boxShadow: "0 8px 24px #00000088",
                            }}>
                              {ESTADOS.filter(e => e.key !== key).map(e => (
                                <button key={e.key} onClick={() => moveTask(task, e.key)}
                                  style={{ width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 7,
                                    border: "none", background: "transparent", color: e.color,
                                    fontSize: 12, fontFamily: "Syne", fontWeight: 600, cursor: "pointer",
                                    display: "flex", alignItems: "center", gap: 8 }}>
                                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: e.color }} />
                                  {e.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
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
            background: "#111", border: "1px solid #2a2a2a", borderRadius: 20,
            padding: "28px 32px", width: "100%", maxWidth: 520,
            maxHeight: "calc(100vh - 80px)", overflowY: "auto", margin: "auto",
          }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, marginBottom: 16, color: "#e8e0d0" }}>
              Nueva tarea
            </h3>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#0f0f0f", borderRadius: 10, padding: 4 }}>
              {(["una", "masiva"] as const).map(tab => (
                <button key={tab} onClick={() => setModalTab(tab)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                  background: modalTab === tab ? "#1e1e1e" : "transparent",
                  color: modalTab === tab ? "#c8922a" : "#555",
                  fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: 700, cursor: "pointer",
                }}>
                  {tab === "una" ? "Una tarea" : "Carga masiva"}
                </button>
              ))}
            </div>

            {/* Una tarea */}
            {modalTab === "una" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input placeholder="Título *" value={newTarea.titulo}
                    onChange={e => setNewTarea({ ...newTarea, titulo: e.target.value })} style={field} autoFocus />
                  <input placeholder="Descripción (opcional)" value={newTarea.descripcion}
                    onChange={e => setNewTarea({ ...newTarea, descripcion: e.target.value })} style={field} />
                  <select value={newTarea.proyecto_id} onChange={e => setNewTarea({ ...newTarea, proyecto_id: e.target.value })} style={field}>
                    <option value="">Selecciona proyecto</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
                      style={{ ...field, colorScheme: "dark" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 6 }}>Tiempo estimado (h)</label>
                      <input type="number" min="0" step="0.5" value={newTarea.tiempo_estimado}
                        onChange={e => setNewTarea({ ...newTarea, tiempo_estimado: Number(e.target.value) })} style={field} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 6 }}>Tiempo real (h)</label>
                      <input type="number" min="0" step="0.5" value={newTarea.tiempo_real || ""}
                        onChange={e => setNewTarea({ ...newTarea, tiempo_real: Number(e.target.value) })} style={field} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20 }}>
                  <button onClick={addTarea} disabled={saving || !newTarea.titulo} style={{
                    background: saving || !newTarea.titulo ? "#2a2a2a" : "#c8922a",
                    border: "none", color: saving || !newTarea.titulo ? "#555" : "#0a0a0a",
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

            {/* Carga masiva */}
            {modalTab === "masiva" && (
              <>
                <p style={{ fontSize: 12, color: "#555", marginBottom: 16, fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
                  Pega o escribe una tarea por línea.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <textarea placeholder={"Configurar Meta Ads\nRevisar copy homepage\nInforme mensual"}
                    value={bulkText} onChange={e => setBulkText(e.target.value)}
                    autoFocus rows={7} style={{ ...field, resize: "vertical", lineHeight: 1.7 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 12 }}>
                    <select value={bulkProyecto} onChange={e => setBulkProyecto(e.target.value)} style={field}>
                      <option value="">Proyecto (opcional)</option>
                      {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <input type="date" value={bulkFecha} onChange={e => setBulkFecha(e.target.value)} style={{ ...field, colorScheme: "dark" }} />
                    <div>
                      <label style={{ fontSize: 10, color: "#555", display: "block", marginBottom: 6 }}>h/tarea</label>
                      <input type="number" min="0.5" step="0.5" value={bulkTiempo}
                        onChange={e => setBulkTiempo(Number(e.target.value))} style={field} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 20 }}>
                  <button onClick={addBulkTareas} disabled={saving || bulkLines === 0} style={{
                    background: saving || bulkLines === 0 ? "#2a2a2a" : "#c8922a",
                    border: "none", color: saving || bulkLines === 0 ? "#555" : "#0a0a0a",
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
