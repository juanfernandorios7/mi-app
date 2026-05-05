"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Curso, SesionFormacion, Configuracion } from "@/lib/types";
import { today, minsToH } from "@/lib/utils";
import { TimerState } from "./AppShell";

const CURSO_COLORS = ["#6e8eb0", "#7c9e6e", "#c8922a", "#a06e9e", "#b05a5a"];
const AREAS = ["Programación", "Diseño", "Marketing", "Negocios", "Idiomas", "Productividad", "Otro"];
const ACCENT = "#6e8eb0";

const EMPTY_CURSO = {
  nombre: "", descripcion: "", area: "Programación", estado: "activo", color: "#6e8eb0",
};
const EMPTY_SESION = { titulo: "", fecha: today(), tiempo_estimado: 1, notas: "" };

function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "hoy";
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

interface FormacionProps {
  initialCursos: Curso[];
  initialSesiones: SesionFormacion[];
  config: Configuracion | null;
  onDataChange: () => void;
  timer: TimerState;
}

export default function Formacion({ initialCursos, initialSesiones, config, onDataChange, timer }: FormacionProps) {
  const supabase = createClient();
  const [cursos, setCursos] = useState<Curso[]>(initialCursos);
  const [sesiones, setSesiones] = useState<SesionFormacion[]>(initialSesiones);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 4000);
  };

  useEffect(() => { setCursos(initialCursos); }, [initialCursos]);
  useEffect(() => { setSesiones(initialSesiones); }, [initialSesiones]);

  const [expandedCurso, setExpandedCurso] = useState<string | null>(null);
  const [showAddCurso, setShowAddCurso] = useState(false);
  const [newCurso, setNewCurso] = useState({ ...EMPTY_CURSO });
  const [addingSesionFor, setAddingSesionFor] = useState<string | null>(null);
  const [newSesion, setNewSesion] = useState({ ...EMPTY_SESION });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteCurso, setConfirmDeleteCurso] = useState<string | null>(null);
  const [confirmDeleteSesion, setConfirmDeleteSesion] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setShowAddCurso(false); setAddingSesionFor(null); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Métricas ──
  const metaHoras = config?.formacion_meta_horas ?? 10;
  const mesActual = today().substring(0, 7);
  const sesionesMes = sesiones.filter(s => s.fecha.startsWith(mesActual));
  const minsMes = sesionesMes.reduce((a, s) => a + s.tiempo_real, 0);
  const horasMes = minsMes / 60;
  const metaPct = Math.min(100, (horasMes / metaHoras) * 100);

  const horasPorArea: Record<string, number> = {};
  sesionesMes.forEach(s => {
    const curso = cursos.find(c => c.id === s.curso_id);
    if (curso) horasPorArea[curso.area] = (horasPorArea[curso.area] || 0) + s.tiempo_real / 60;
  });

  // ── Timer ──
  const startTimer = useCallback(async (sesion: SesionFormacion) => {
    if (timer.trackingId === sesion.id) {
      const mins = Math.floor(timer.elapsed / 60);
      const newReal = sesion.tiempo_real + mins;
      setSesiones(ss => ss.map(s => s.id === sesion.id ? { ...s, tiempo_real: newReal } : s));
      const { error } = await supabase.from("sesiones_formacion").update({ tiempo_real: newReal }).eq("id", sesion.id);
      if (error) showError("No se pudo guardar el tiempo.");
      timer.stopTracking();
      onDataChange();
    } else if (!timer.trackingId) {
      timer.startTracking(sesion.id);
    }
  }, [timer, supabase, onDataChange]);

  // ── CRUD Cursos ──
  const addCurso = async () => {
    if (!newCurso.nombre.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("cursos").insert({
      nombre: newCurso.nombre.trim(),
      descripcion: newCurso.descripcion || null,
      area: newCurso.area,
      estado: newCurso.estado,
      color: newCurso.color,
    }).select().single();
    if (!error && data) {
      setCursos(cs => [data as Curso, ...cs]);
      setNewCurso({ ...EMPTY_CURSO });
      setShowAddCurso(false);
      setExpandedCurso((data as Curso).id);
      onDataChange();
    } else if (error) {
      showError("No se pudo crear el curso. Intenta de nuevo.");
    }
    setSaving(false);
  };

  const deleteCurso = async (id: string) => {
    setCursos(cs => cs.filter(c => c.id !== id));
    setSesiones(ss => ss.filter(s => s.curso_id !== id));
    setConfirmDeleteCurso(null);
    if (expandedCurso === id) setExpandedCurso(null);
    const { error } = await supabase.from("cursos").delete().eq("id", id);
    if (error) showError("No se pudo eliminar el curso.");
    onDataChange();
  };

  // ── CRUD Sesiones ──
  const addSesion = async (cursoId: string) => {
    if (!newSesion.titulo.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("sesiones_formacion").insert({
      curso_id: cursoId,
      titulo: newSesion.titulo.trim(),
      fecha: newSesion.fecha,
      tiempo_estimado: Math.round(Number(newSesion.tiempo_estimado) * 60),
      tiempo_real: 0,
      notas: newSesion.notas || null,
    }).select().single();
    if (!error && data) {
      setSesiones(ss => [...ss, data as SesionFormacion]);
      setNewSesion({ ...EMPTY_SESION });
      setAddingSesionFor(null);
      onDataChange();
    } else if (error) {
      showError("No se pudo agregar la sesión.");
    }
    setSaving(false);
  };

  const deleteSesion = async (id: string) => {
    setSesiones(ss => ss.filter(s => s.id !== id));
    setConfirmDeleteSesion(null);
    const { error } = await supabase.from("sesiones_formacion").delete().eq("id", id);
    if (error) showError("No se pudo eliminar la sesión.");
    onDataChange();
  };

  const field: React.CSSProperties = {
    background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 12,
    padding: "14px 16px", color: "#1a1510", fontSize: 14,
    fontFamily: "'Syne', sans-serif", outline: "none", width: "100%",
  };

  return (
    <div className="fade-up">
      {errorMsg && <div className="error-toast">{errorMsg}</div>}

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28 }}>Formación</h2>
        <button
          onClick={() => setShowAddCurso(true)}
          style={{
            background: ACCENT + "18", border: "1px solid " + ACCENT,
            color: ACCENT, padding: "10px 20px", borderRadius: 12,
            fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700,
          }}
        >
          + Nuevo curso
        </button>
      </div>

      {/* ── Métricas ── */}
      <div style={{
        background: "#FAF7F3", border: "1px solid #E0D8CE",
        borderRadius: 16, padding: "20px 24px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#1a1510" }}>
              {horasMes.toFixed(1)}h
            </span>
            <span style={{ fontSize: 13, color: "#666", fontFamily: "'DM Mono', monospace", marginLeft: 10 }}>
              de {metaHoras}h meta mensual
            </span>
          </div>
          <span style={{
            fontSize: 13, fontFamily: "'DM Mono', monospace", fontWeight: 700,
            color: metaPct >= 100 ? "#7c9e6e" : ACCENT,
          }}>
            {metaPct.toFixed(0)}%
          </span>
        </div>

        <div style={{ height: 5, background: "#F5F1EC", borderRadius: 4, marginBottom: 14, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: Math.min(100, metaPct) + "%",
            background: metaPct >= 100 ? "#7c9e6e" : ACCENT,
            borderRadius: 4, transition: "width 0.5s ease",
          }} />
        </div>

        {Object.keys(horasPorArea).length > 0 ? (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {Object.entries(horasPorArea).map(([area, horas]) => (
              <span key={area} style={{ fontSize: 11, color: "#666", fontFamily: "'DM Mono', monospace" }}>
                <span style={{ color: "#888" }}>{area}</span>{" "}{horas.toFixed(1)}h
              </span>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: "#555", fontFamily: "'DM Mono', monospace" }}>
            Sin sesiones registradas este mes
          </p>
        )}
      </div>

      {/* ── Lista de cursos ── */}
      {cursos.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "56px 0",
          border: "1px dashed #E0D8CE", borderRadius: 16,
        }}>
          <p style={{ fontSize: 14, color: "#666", fontFamily: "'DM Mono', monospace" }}>No hay cursos todavía</p>
          <p style={{ fontSize: 12, color: "#555", fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
            Crea tu primer curso para empezar a registrar tiempo
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {cursos.map(curso => {
            const cursoSesiones = sesiones
              .filter(s => s.curso_id === curso.id)
              .sort((a, b) => a.fecha.localeCompare(b.fecha));
            const totalReal = cursoSesiones.reduce((a, s) => a + s.tiempo_real, 0);
            const totalEst = cursoSesiones.reduce((a, s) => a + s.tiempo_estimado, 0);
            const isExpanded = expandedCurso === curso.id;
            const pct = totalEst > 0 ? Math.min(100, (totalReal / totalEst) * 100) : 0;

            return (
              <div key={curso.id} style={{
                background: "#FAF7F3", border: "1px solid #E0D8CE",
                borderRadius: 16, overflow: "hidden",
              }}>
                <div style={{ height: 3, background: curso.color }} />

                <div style={{ padding: "16px 20px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>

                    <button
                      onClick={() => setExpandedCurso(isExpanded ? null : curso.id)}
                      style={{ background: "transparent", border: "none", textAlign: "left", flex: 1, padding: 0 }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                        <span style={{
                          fontSize: 13, color: "#666", display: "inline-block",
                          transition: "transform 0.2s",
                          transform: isExpanded ? "rotate(90deg)" : "none",
                        }}>›</span>
                        <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 20, color: "#1a1510" }}>
                          {curso.nombre}
                        </h3>
                        <span style={{
                          fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 700,
                          color: curso.estado === "completado" ? "#7c9e6e" : curso.estado === "pausado" ? "#666" : curso.color,
                          background: curso.estado === "completado" ? "#7c9e6e18" : curso.estado === "pausado" ? "#F5F1EC" : curso.color + "18",
                          border: "1px solid " + (curso.estado === "completado" ? "#7c9e6e44" : curso.estado === "pausado" ? "#D4C9BC" : curso.color + "44"),
                          padding: "2px 8px", borderRadius: 6,
                          textTransform: "uppercase", letterSpacing: "0.08em",
                        }}>
                          {curso.estado}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 16, paddingLeft: 23 }}>
                        <span style={{ fontSize: 11, color: "#666", fontFamily: "'DM Mono', monospace" }}>
                          ◆ {curso.area}
                        </span>
                        <span style={{ fontSize: 11, color: "#888", fontFamily: "'DM Mono', monospace" }}>
                          {minsToH(totalReal)} registradas · {cursoSesiones.length} sesión{cursoSesiones.length !== 1 ? "es" : ""}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => setConfirmDeleteCurso(confirmDeleteCurso === curso.id ? null : curso.id)}
                      style={{
                        background: "transparent", border: "none", color: "#555",
                        fontSize: 18, padding: "0 4px", lineHeight: 1, flexShrink: 0,
                      }}
                      title="Eliminar curso"
                    >×</button>
                  </div>

                  {cursoSesiones.length > 0 && (
                    <div style={{ paddingLeft: 23, marginTop: 10 }}>
                      <div style={{ height: 3, background: "#F5F1EC", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: pct + "%",
                          background: pct >= 100 ? "#7c9e6e" : curso.color,
                          borderRadius: 2, transition: "width 0.4s ease",
                        }} />
                      </div>
                      <span style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace", marginTop: 4, display: "block" }}>
                        {pct.toFixed(0)}% del tiempo estimado
                      </span>
                    </div>
                  )}

                  {confirmDeleteCurso === curso.id && (
                    <div style={{
                      background: "#b05a5a12", border: "1px solid #b05a5a33",
                      borderRadius: 10, padding: "10px 16px", marginTop: 12,
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: 12, color: "#b05a5a" }}>
                        ¿Eliminar "{curso.nombre}" y sus {cursoSesiones.length} sesiones?
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setConfirmDeleteCurso(null)} style={{
                          background: "transparent", border: "1px solid #333", color: "#666",
                          padding: "4px 10px", borderRadius: 7, fontSize: 12,
                        }}>No</button>
                        <button onClick={() => deleteCurso(curso.id)} style={{
                          background: "#b05a5a22", border: "1px solid #b05a5a", color: "#b05a5a",
                          padding: "4px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700,
                        }}>Sí, eliminar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Sesiones expandidas ── */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #F5F1EC", padding: "12px 20px 16px" }}>

                    {cursoSesiones.length === 0 ? (
                      <p style={{ fontSize: 12, color: "#555", fontFamily: "'DM Mono', monospace", padding: "6px 0 12px" }}>
                        Sin sesiones. Agrega la primera.
                      </p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
                        {cursoSesiones.map((sesion, idx) => {
                          const isTracking = timer.trackingId === sesion.id;
                          const otherTimerActive = timer.trackingId !== null && timer.trackingId !== sesion.id;
                          const isCompleted = sesion.tiempo_real > 0;
                          return (
                            <div key={sesion.id}>
                              <div style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: "10px 12px", borderRadius: 10,
                                background: isTracking ? curso.color + "0c" : "transparent",
                                border: "1px solid " + (isTracking ? curso.color + "33" : "transparent"),
                                // Borde izquierdo verde para sesiones completadas
                                borderLeft: isCompleted ? "3px solid #7c9e6e" : "3px solid transparent",
                              }}>
                                <span style={{
                                  fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace",
                                  minWidth: 20, textAlign: "right", flexShrink: 0,
                                }}>
                                  {idx + 1}
                                </span>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <p style={{ fontSize: 13, color: "#ccc", fontFamily: "'Syne', sans-serif", fontWeight: 600, marginBottom: 2 }}>
                                    {sesion.titulo}
                                  </p>
                                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
                                    {/* Fecha legible en lugar de ISO */}
                                    <span style={{ fontSize: 10, color: "#666", fontFamily: "'DM Mono', monospace" }}>
                                      {formatDate(sesion.fecha)}
                                    </span>
                                    {isCompleted && (
                                      <span style={{ fontSize: 10, color: "#7c9e6e", fontFamily: "'DM Mono', monospace" }}>
                                        ✓ {minsToH(sesion.tiempo_real)} registradas
                                      </span>
                                    )}
                                    {sesion.tiempo_estimado > 0 && (
                                      <span style={{ fontSize: 10, color: "#555", fontFamily: "'DM Mono', monospace" }}>
                                        est. {minsToH(sesion.tiempo_estimado)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  onClick={() => startTimer(sesion)}
                                  disabled={otherTimerActive}
                                  style={{
                                    background: isTracking ? curso.color + "22" : "#F5F1EC",
                                    border: "1px solid " + (isTracking ? curso.color : "#D4C9BC"),
                                    color: isTracking ? curso.color : otherTimerActive ? "#333" : "#666",
                                    padding: "4px 10px", borderRadius: 7,
                                    fontSize: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700,
                                    whiteSpace: "nowrap", flexShrink: 0,
                                    opacity: otherTimerActive ? 0.4 : 1,
                                  }}
                                  title={otherTimerActive ? "Hay un timer activo en otro lado" : undefined}
                                >
                                  {isTracking
                                    ? `⏹ ${String(Math.floor(timer.elapsed / 60)).padStart(2, "0")}:${String(timer.elapsed % 60).padStart(2, "0")}`
                                    : "▶"}
                                </button>

                                <button
                                  onClick={() => setConfirmDeleteSesion(confirmDeleteSesion === sesion.id ? null : sesion.id)}
                                  style={{
                                    background: "transparent", border: "none", color: "#555",
                                    fontSize: 16, padding: "0 2px", flexShrink: 0,
                                  }}
                                  title="Eliminar sesión"
                                >×</button>
                              </div>

                              {confirmDeleteSesion === sesion.id && (
                                <div style={{
                                  background: "#b05a5a12", border: "1px solid #b05a5a33",
                                  borderRadius: 8, padding: "8px 14px", margin: "4px 0",
                                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                                }}>
                                  <span style={{ fontSize: 11, color: "#b05a5a" }}>¿Eliminar esta sesión?</span>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button onClick={() => setConfirmDeleteSesion(null)} style={{
                                      background: "transparent", border: "1px solid #333", color: "#666",
                                      padding: "3px 8px", borderRadius: 6, fontSize: 11,
                                    }}>No</button>
                                    <button onClick={() => deleteSesion(sesion.id)} style={{
                                      background: "#b05a5a22", border: "1px solid #b05a5a", color: "#b05a5a",
                                      padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                                    }}>Sí</button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {addingSesionFor === curso.id ? (
                      <div style={{
                        background: "#FFFFFF", border: "1px solid #D4C9BC",
                        borderRadius: 12, padding: 16, marginTop: 4,
                      }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <input
                            autoFocus
                            placeholder="Título de la sesión *"
                            value={newSesion.titulo}
                            onChange={e => setNewSesion({ ...newSesion, titulo: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === "Enter") addSesion(curso.id);
                              if (e.key === "Escape") { setAddingSesionFor(null); setNewSesion({ ...EMPTY_SESION }); }
                            }}
                            style={{
                              background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 8,
                              padding: "10px 14px", color: "#1a1510", fontSize: 13,
                              fontFamily: "'Syne', sans-serif", outline: "none",
                            }}
                          />
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 10 }}>
                            <input
                              type="date" value={newSesion.fecha}
                              onChange={e => setNewSesion({ ...newSesion, fecha: e.target.value })}
                              style={{
                                background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 8,
                                padding: "10px 14px", color: "#888", fontSize: 13,
                                outline: "none", colorScheme: "light",
                              }}
                            />
                            <div>
                              <label style={{ fontSize: 10, color: "#666", display: "block", marginBottom: 5, fontFamily: "'DM Mono', monospace" }}>
                                Estimado (h)
                              </label>
                              <input
                                type="number" min="0.5" step="0.5" value={newSesion.tiempo_estimado}
                                onChange={e => setNewSesion({ ...newSesion, tiempo_estimado: Number(e.target.value) })}
                                style={{
                                  background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 8,
                                  padding: "10px 14px", color: "#888", fontSize: 13,
                                  fontFamily: "'DM Mono', monospace", outline: "none", width: "100%",
                                }}
                              />
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => addSesion(curso.id)}
                              disabled={saving || !newSesion.titulo.trim()}
                              style={{
                                background: !newSesion.titulo.trim() ? "#F5F1EC" : curso.color + "22",
                                border: "1px solid " + (!newSesion.titulo.trim() ? "#D4C9BC" : curso.color + "66"),
                                color: !newSesion.titulo.trim() ? "#555" : curso.color,
                                padding: "8px 18px", borderRadius: 8,
                                fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 700,
                                cursor: !newSesion.titulo.trim() ? "not-allowed" : "pointer",
                              }}
                            >
                              {saving ? "Guardando..." : "Agregar sesión"}
                            </button>
                            <button
                              onClick={() => { setAddingSesionFor(null); setNewSesion({ ...EMPTY_SESION }); }}
                              style={{
                                background: "transparent", border: "1px solid #D4C9BC", color: "#555",
                                padding: "8px 14px", borderRadius: 8, fontSize: 12,
                                fontFamily: "'Syne', sans-serif",
                              }}
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setAddingSesionFor(curso.id); setNewSesion({ ...EMPTY_SESION }); }}
                        style={{
                          width: "100%", background: "transparent",
                          border: "1px dashed #D4C9BC", borderRadius: 10,
                          color: "#555", padding: "8px 0",
                          fontSize: 12, fontFamily: "'Syne', sans-serif", fontWeight: 600,
                          marginTop: 4,
                        }}
                        onMouseEnter={e => { (e.currentTarget).style.borderColor = "#C8BAA8"; (e.currentTarget).style.color = "#777"; }}
                        onMouseLeave={e => { (e.currentTarget).style.borderColor = "#D4C9BC"; (e.currentTarget).style.color = "#555"; }}
                      >
                        + Nueva sesión
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal nuevo curso ── */}
      {showAddCurso && (
        <div
          onClick={() => setShowAddCurso(false)}
          style={{
            position: "fixed", inset: 0, paddingTop: 58,
            background: "#000000bb",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 200,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="fade-up"
            style={{
              background: "#FAF7F3", border: "1px solid #D4C9BC", borderRadius: 20,
              padding: "28px 32px", width: "100%", maxWidth: 480,
            }}
          >
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, marginBottom: 20, color: "#1a1510" }}>
              Nuevo curso
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <input
                placeholder="Nombre del curso *"
                value={newCurso.nombre}
                onChange={e => setNewCurso({ ...newCurso, nombre: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") addCurso(); }}
                autoFocus
                style={field}
              />
              <input
                placeholder="Descripción (opcional)"
                value={newCurso.descripcion}
                onChange={e => setNewCurso({ ...newCurso, descripcion: e.target.value })}
                style={field}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <select
                  value={newCurso.area}
                  onChange={e => setNewCurso({ ...newCurso, area: e.target.value })}
                  style={field}
                >
                  {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select
                  value={newCurso.estado}
                  onChange={e => setNewCurso({ ...newCurso, estado: e.target.value })}
                  style={field}
                >
                  <option value="activo">Activo</option>
                  <option value="pausado">Pausado</option>
                  <option value="completado">Completado</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, color: "#666", display: "block", marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>
                  Color
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  {CURSO_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewCurso({ ...newCurso, color: c })}
                      style={{
                        width: 30, height: 30, borderRadius: "50%", background: c,
                        border: newCurso.color === c ? "3px solid #fff" : "3px solid transparent",
                        outline: "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 24 }}>
              <button
                onClick={addCurso}
                disabled={saving || !newCurso.nombre.trim()}
                style={{
                  background: saving || !newCurso.nombre.trim() ? "#D4C9BC" : ACCENT,
                  border: "none",
                  color: saving || !newCurso.nombre.trim() ? "#555" : "#1a1510",
                  padding: "12px 24px", borderRadius: 10,
                  fontSize: 14, fontFamily: "'Syne', sans-serif", fontWeight: 700,
                  cursor: saving || !newCurso.nombre.trim() ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Guardando..." : "Crear curso"}
              </button>
              <button
                onClick={() => setShowAddCurso(false)}
                style={{
                  background: "transparent", border: "none",
                  color: "#555", fontSize: 14, fontFamily: "'Syne', sans-serif",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
