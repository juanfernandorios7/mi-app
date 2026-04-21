"use client";

import { useState, useEffect, useCallback } from "react";
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

  const todayTasks = tareas.filter(t => t.fecha === today());
  const doneTasks = todayTasks.filter(t => t.estado === "completada").length;
  const inProgressTasks = todayTasks.filter(t => t.estado === "en_progreso").length;
  const pendingTasks = todayTasks.filter(t => t.estado === "pendiente").length;

  useEffect(() => {
    if (!trackingId || !trackingStart) return;
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - trackingStart) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [trackingId, trackingStart]);

  // Cerrar modal con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowAdd(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleDone = useCallback(async (tarea: Tarea) => {
    const newEstado = tarea.estado === "completada" ? "pendiente" : "completada";
    setTareas(ts => ts.map(t => t.id === tarea.id ? { ...t, estado: newEstado } : t));
    await supabase.from("tareas").update({ estado: newEstado }).eq("id", tarea.id);
    onTareasChange();
  }, [supabase, onTareasChange]);

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
    const lineas = bulkText
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);
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
      setBulkText("");
      setBulkProyecto("");
      setBulkFecha(today());
      setBulkTiempo(1);
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
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, marginBottom: 6 }}>Tareas del día</h2>
          <p style={{ fontSize: 12, color: "#555", fontFamily: "'DM Mono', monospace" }}>
            {doneTasks} finalizadas · {inProgressTasks} en progreso · {pendingTasks} pendientes
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            background: "#c8922a18", border: "1px solid #c8922a",
            color: "#c8922a", padding: "10px 20px", borderRadius: 12,
            fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700,
          }}
        >
          + Nueva tarea
        </button>
      </div>

      {/* Modal */}
      {showAdd && (
        <div
          onClick={() => setShowAdd(false)}
          style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "#000000bb",
            display: "flex", alignItems: "flex-start", justifyContent: "center",
            zIndex: 200, padding: "80px 24px 24px",
            overflowY: "auto",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="fade-up"
            style={{
              background: "#111", border: "1px solid #2a2a2a", borderRadius: 20,
              padding: 36, width: "100%", maxWidth: 560,
            }}
          >
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, marginBottom: 20, color: "#e8e0d0" }}>
              Nueva tarea
            </h3>

            {/* Pestañas */}
            <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "#0f0f0f", borderRadius: 10, padding: 4 }}>
              {(["una", "masiva"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setModalTab(tab)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                    background: modalTab === tab ? "#1e1e1e" : "transparent",
                    color: modalTab === tab ? "#c8922a" : "#555",
                    fontSize: 13, fontFamily: "'Syne', sans-serif", fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {tab === "una" ? "Una tarea" : "Carga masiva"}
                </button>
              ))}
            </div>

            {/* ── UNA TAREA ── */}
            {modalTab === "una" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    placeholder="Título *"
                    value={newTarea.titulo}
                    onChange={e => setNewTarea({ ...newTarea, titulo: e.target.value })}
                    style={field}
                    autoFocus
                  />
                  <input
                    placeholder="Descripción (opcional)"
                    value={newTarea.descripcion}
                    onChange={e => setNewTarea({ ...newTarea, descripcion: e.target.value })}
                    style={field}
                  />
                  <select value={newTarea.proyecto_id} onChange={e => setNewTarea({ ...newTarea, proyecto_id: e.target.value })} style={field}>
                    <option value="">Selecciona proyecto</option>
                    {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <select value={newTarea.estado} onChange={e => setNewTarea({ ...newTarea, estado: e.target.value })} style={field}>
                      <option value="pendiente">pendiente</option>
                      <option value="en_progreso">en progreso</option>
                      <option value="completada">completada</option>
                    </select>
                    <select value={newTarea.prioridad} onChange={e => setNewTarea({ ...newTarea, prioridad: e.target.value })} style={field}>
                      <option value="alta">alta</option>
                      <option value="media">media</option>
                      <option value="baja">baja</option>
                    </select>
                    <input type="date" value={newTarea.fecha} onChange={e => setNewTarea({ ...newTarea, fecha: e.target.value })} style={{ ...field, colorScheme: "dark" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 6 }}>Tiempo estimado (h)</label>
                      <input type="number" min="0" step="0.5" value={newTarea.tiempo_estimado} onChange={e => setNewTarea({ ...newTarea, tiempo_estimado: Number(e.target.value) })} style={field} />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, color: "#555", display: "block", marginBottom: 6 }}>Tiempo real (h)</label>
                      <input type="number" min="0" step="0.5" value={newTarea.tiempo_real || ""} onChange={e => setNewTarea({ ...newTarea, tiempo_real: Number(e.target.value) })} style={field} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28 }}>
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

            {/* ── CARGA MASIVA ── */}
            {modalTab === "masiva" && (
              <>
                <p style={{ fontSize: 12, color: "#555", marginBottom: 16, fontFamily: "'DM Mono', monospace", lineHeight: 1.6 }}>
                  Pega o escribe una tarea por línea. Puedes pedirle a Claude que te resuma las tareas de tu reunión en este formato.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <textarea
                    placeholder={"Configurar Meta Ads campaña retargeting\nRevisar copy homepage Shopify\nInforme mensual Google Ads\nAjustar automatizaciones CRM"}
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    autoFocus
                    rows={7}
                    style={{ ...field, resize: "vertical", lineHeight: 1.7 }}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px", gap: 12 }}>
                    <select value={bulkProyecto} onChange={e => setBulkProyecto(e.target.value)} style={field}>
                      <option value="">Proyecto (opcional)</option>
                      {proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                    <input type="date" value={bulkFecha} onChange={e => setBulkFecha(e.target.value)} style={{ ...field, colorScheme: "dark" }} />
                    <div>
                      <label style={{ fontSize: 10, color: "#555", display: "block", marginBottom: 6 }}>h/tarea</label>
                      <input type="number" min="0.5" step="0.5" value={bulkTiempo} onChange={e => setBulkTiempo(Number(e.target.value))} style={field} />
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28 }}>
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

      {/* Lista */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {todayTasks.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#444" }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, marginBottom: 8 }}>Sin tareas hoy</p>
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
                  {proj && <span style={{ fontSize: 11, color: proj.color, fontFamily: "'DM Mono', monospace" }}>◆ {proj.nombre}</span>}
                  <span style={{ fontSize: 11, color: "#444", fontFamily: "'DM Mono', monospace" }}>Est: {minsToH(task.tiempo_estimado)}</span>
                  {task.tiempo_real > 0 && <span style={{ fontSize: 11, color: "#666", fontFamily: "'DM Mono', monospace" }}>Real: {minsToH(task.tiempo_real)}</span>}
                </div>
              </div>

              {isTracking && (
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#c8922a", minWidth: 60 }}>
                  {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
                </div>
              )}

              {!isDone && (
                <button onClick={() => startTimer(task)} style={{
                  background: isTracking ? "#c8922a22" : "#1a1a1a",
                  border: "1px solid " + (isTracking ? "#c8922a" : "#2a2a2a"),
                  color: isTracking ? "#c8922a" : "#666",
                  padding: "6px 14px", borderRadius: 8,
                  fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 700, whiteSpace: "nowrap",
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
