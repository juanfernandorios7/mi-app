"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Proyecto, Tarea } from "@/lib/types";
import { fmtCOP, getRentabilidad, getCapacityStatus, today } from "@/lib/utils";
import StatBox from "./StatBox";

interface DashboardProps {
  proyectos: Proyecto[];
  tareas: Tarea[];
  capacidadHoras: number;
}

type Periodo = "hoy" | "semana" | "mes";

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0=dom, 1=lun...
  const diff = day === 0 ? -6 : 1 - day; // ajuste a lunes
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dayStr = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayStr}`;
}

function getMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function filterByPeriodo(tareas: Tarea[], periodo: Periodo): Tarea[] {
  const t = today();
  if (periodo === "hoy") return tareas.filter(t2 => t2.fecha === t);
  if (periodo === "semana") return tareas.filter(t2 => t2.fecha >= getWeekStart() && t2.fecha <= t);
  return tareas.filter(t2 => t2.fecha >= getMonthStart() && t2.fecha <= t);
}

function getWeekDays(): { key: string; label: string }[] {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const result = [];
  const weekStart = new Date(getWeekStart());
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const key = d.toISOString().split("T")[0];
    if (key > today()) break;
    result.push({ key, label: days[i] });
  }
  return result;
}

// ── Tarifa horaria real de un proyecto ────────────────────────────────────────
// Recurrente: valor_mensual / 160h (mes estándar de trabajo)
// Único: solo cuando hay ≥5h reales trabajadas (usa horasReales si se pasa, sino horas_logged)
function getHourlyRate(p: Proyecto, horasReales?: number): number | null {
  if (p.tipo_cobro === "recurrente") {
    if (!p.valor_mensual || p.valor_mensual === 0) return null;
    return p.valor_mensual / 160;
  }
  // único: necesita mínimo 5h para ser representativo
  if (!p.valor_total || p.valor_total === 0) return null;
  const horas = horasReales ?? p.horas_logged;
  if (horas < 5) return null;
  return p.valor_total / horas;
}

// ── Bloque de proyectos por tipo ──────────────────────────────────────────────
function ProyectoBlock({ titulo, proyectos, tareas, accentColor, descripcion }: {
  titulo: string; proyectos: Proyecto[]; tareas: Tarea[]; accentColor: string; descripcion?: string;
}) {
  if (proyectos.length === 0) return null;
  const activos = proyectos.filter(p => p.estado !== "finalizado");
  if (activos.length === 0) return null;

  // Horas calculadas desde tareas (siempre sincronizado)
  const getHorasProy = (p: Proyecto) =>
    +(tareas.filter(t => t.proyecto_id === p.id).reduce((a, t) => a + t.tiempo_real / 60, 0)).toFixed(2);

  const totalHoras = activos.reduce((a, p) => a + getHorasProy(p), 0);
  const totalCobrado = activos.reduce((a, p) => a + (p.valor_mensual || p.valor_total || 0), 0);

  // Tarifa ponderada por horas: solo proyectos con rate calculable
  const { pesoTotal, ingresosPonderados } = activos.reduce((acc, p) => {
    const hrs = getHorasProy(p);
    const rate = getHourlyRate(p, hrs);
    if (rate !== null && hrs > 0) {
      acc.ingresosPonderados += rate * hrs;
      acc.pesoTotal += hrs;
    }
    return acc;
  }, { pesoTotal: 0, ingresosPonderados: 0 });
  const tarifaEfectiva = pesoTotal > 0 ? ingresosPonderados / pesoTotal : null;

  const chartData = activos.map(p => {
    const rate = getHourlyRate(p, getHorasProy(p));
    const r = getRentabilidad(p);
    return { name: p.nombre.split(" ")[0], rate: rate ? Math.round(rate) : 0, color: r.color };
  });

  return (
    <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 20, padding: "28px 32px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: accentColor, boxShadow: `0 0 8px ${accentColor}66` }} />
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: "#e8e0d0" }}>{titulo}</span>
        {descripcion && <span style={{ fontSize: 11, color: "#444", fontFamily: "DM Mono", marginLeft: 4 }}>{descripcion}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatBox label="Horas totales"   value={totalHoras.toFixed(1) + "h"} />
        <StatBox label="Total cobrado"   value={totalCobrado > 0 ? fmtCOP(totalCobrado) : "—"} />
        <StatBox label="Tarifa efectiva" value={tarifaEfectiva !== null ? fmtCOP(Math.round(tarifaEfectiva)) + "/h" : "—"} />
      </div>
      {chartData.some(d => d.rate > 0) && (
        <div style={{ marginBottom: 20 }}>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData} barSize={28}>
              <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 11, fontFamily: "Syne" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false}
                tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, fontFamily: "DM Mono", fontSize: 12 }}
                formatter={(v) => [fmtCOP(Number(v)), "COP/hora"]} labelStyle={{ color: "#888" }} />
              <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
        {activos.map(p => {
          const r = getRentabilidad(p);
          const cobrado = p.valor_total || p.valor_mensual || 0;
          return (
            <div key={p.id} style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, marginTop: 4 }} />
                <span style={{ fontSize: 10, color: r.color, fontWeight: 700, background: r.color + "18", padding: "2px 7px", borderRadius: 20 }}>{r.label}</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#ddd" }}>{p.nombre}</p>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#555", marginBottom: 4 }}>{getHorasProy(p)}h invertidas</p>
              {cobrado > 0 && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: p.color }}>{fmtCOP(cobrado)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Dashboard principal ───────────────────────────────────────────────────────
export default function Dashboard({ proyectos, tareas, capacidadHoras }: DashboardProps) {
  const [periodo, setPeriodo] = useState<Periodo>("hoy");

  // Alerta sobresaturación semanal
  const weekStart = getWeekStart();
  const weekTareas = tareas.filter(t => t.fecha >= weekStart && t.fecha <= today());
  const horasSemanales = weekTareas.reduce((a, t) => a + t.tiempo_real / 60, 0);
  const capacidadSemanal = capacidadHoras;
  const pctSemana = Math.round((horasSemanales / capacidadSemanal) * 100);
  const saturacion = pctSemana >= 95
    ? { color: "#b05a5a", bg: "#b05a5a12", border: "#b05a5a33", emoji: "🔴", msg: "Estás saturado — antes de aceptar algo nuevo, ¿qué puedes mover o delegar?" }
    : pctSemana >= 80
    ? { color: "#c8922a", bg: "#c8922a12", border: "#c8922a33", emoji: "🟡", msg: "Estás cerca del límite — evalúa qué puede esperar o delegar." }
    : null;

  const CAPACITY_HOURS = capacidadHoras;
  // Horas totales siempre calculadas desde tareas (nunca desincronizadas)
  const allProjectHours = tareas.reduce((a, t) => a + t.tiempo_real / 60, 0);
  const capacityPct = Math.min(100, Math.round((allProjectHours / (CAPACITY_HOURS * 4)) * 100));
  const capStatus = getCapacityStatus(capacityPct);

  // Métricas por período
  const periodTareas = filterByPeriodo(tareas, periodo);
  const horasPeriodo = periodTareas.reduce((a, t) => a + t.tiempo_real / 60, 0);
  const completadasPeriodo = periodTareas.filter(t => t.estado === "completada").length;
  const estimadoPeriodo = periodTareas.reduce((a, t) => a + t.tiempo_estimado / 60, 0);
  const eficiencia = estimadoPeriodo > 0
    ? Math.round((horasPeriodo / estimadoPeriodo) * 100)
    : null;

  // Tarifa efectiva del período: promedio ponderado por horas de cada proyecto
  // Usa horas calculadas desde tareas (nunca horas_logged desincronizado)
  const tarifaPeriodo = (() => {
    let totalIngresosPonderados = 0;
    let totalHoras = 0;
    proyectos.forEach(p => {
      const horasEnPeriodo = periodTareas
        .filter(t => t.proyecto_id === p.id)
        .reduce((a, t) => a + t.tiempo_real / 60, 0);
      if (horasEnPeriodo > 0) {
        // Horas totales del proyecto (fuente de verdad desde tareas)
        const horasTotalesProyecto = tareas
          .filter(t => t.proyecto_id === p.id)
          .reduce((a, t) => a + t.tiempo_real / 60, 0);
        const rate = getHourlyRate(p, horasTotalesProyecto);
        if (rate !== null) {
          totalIngresosPonderados += rate * horasEnPeriodo;
          totalHoras += horasEnPeriodo;
        }
      }
    });
    return totalHoras > 0 ? Math.round(totalIngresosPonderados / totalHoras) : null;
  })();

  // Chart semanal — horas por día
  const weekDays = getWeekDays();
  const weekData = weekDays.map(({ key, label }) => ({
    label,
    horas: +(tareas.filter(t => t.fecha === key).reduce((a, t) => a + t.tiempo_real / 60, 0)).toFixed(1),
    esHoy: key === today(),
  }));

  const periodoLabels: Record<Periodo, string> = { hoy: "hoy", semana: "esta semana", mes: "este mes" };

  const clientes  = proyectos.filter(p => p.tipo === "cliente");
  const propios   = proyectos.filter(p => p.tipo === "propio");
  const proposito = proyectos.filter(p => p.tipo === "proposito");

  return (
    <div className="fade-up">

      {/* ── Alerta sobresaturación ── */}
      {saturacion && (
        <div style={{
          background: saturacion.bg, border: "1px solid " + saturacion.border,
          borderRadius: 14, padding: "14px 20px", marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 18 }}>{saturacion.emoji}</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: saturacion.color, fontFamily: "Syne", marginBottom: 2 }}>
                Esta semana llevas {horasSemanales.toFixed(1)}h de {capacidadSemanal}h — {pctSemana}% de tu capacidad
              </p>
              <p style={{ fontSize: 12, color: saturacion.color, opacity: 0.8, fontFamily: "DM Mono" }}>
                {saturacion.msg}
              </p>
            </div>
          </div>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 28, color: saturacion.color, opacity: 0.4 }}>
            {capacidadSemanal - Math.round(horasSemanales) > 0
              ? `${capacidadSemanal - Math.round(horasSemanales)}h restantes`
              : "Sin espacio"}
          </div>
        </div>
      )}

      {/* ── Bloque rendimiento ── */}
      <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 20, padding: "28px 32px", marginBottom: 20 }}>

        {/* Header + toggle período */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "DM Mono", marginBottom: 4 }}>
              Rendimiento
            </p>
            <p style={{ fontSize: 13, color: "#444", fontFamily: "DM Mono" }}>
              {horasPeriodo.toFixed(1)}h trabajadas {periodoLabels[periodo]}
            </p>
          </div>
          <div style={{ display: "flex", gap: 4, background: "#0f0f0f", borderRadius: 10, padding: 4 }}>
            {(["hoy", "semana", "mes"] as Periodo[]).map(p => (
              <button key={p} onClick={() => setPeriodo(p)} style={{
                padding: "6px 16px", borderRadius: 8, border: "none",
                background: periodo === p ? "#1e1e1e" : "transparent",
                color: periodo === p ? "#c8922a" : "#555",
                fontSize: 12, fontFamily: "Syne", fontWeight: 700, cursor: "pointer",
                textTransform: "capitalize",
              }}>
                {p === "hoy" ? "Hoy" : p === "semana" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
        </div>

        {/* 4 métricas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: periodo === "semana" ? 24 : 0 }}>
          {/* Horas trabajadas */}
          <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px 20px" }}>
            <p style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Horas trabajadas</p>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#e8e0d0", lineHeight: 1 }}>
              {horasPeriodo.toFixed(1)}<span style={{ fontSize: 16, color: "#555" }}>h</span>
            </p>
          </div>

          {/* Tareas completadas */}
          <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px 20px" }}>
            <p style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Tareas completadas</p>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#e8e0d0", lineHeight: 1 }}>
              {completadasPeriodo}
              <span style={{ fontSize: 16, color: "#555" }}>/{periodTareas.length}</span>
            </p>
          </div>

          {/* Eficiencia */}
          <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px 20px" }}>
            <p style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Eficiencia</p>
            {eficiencia !== null ? (
              <>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, lineHeight: 1,
                  color: eficiencia <= 100 ? "#7c9e6e" : "#c8922a" }}>
                  {eficiencia}<span style={{ fontSize: 16, opacity: 0.6 }}>%</span>
                </p>
                <p style={{ fontSize: 10, color: "#444", fontFamily: "DM Mono", marginTop: 6 }}>
                  {eficiencia <= 100 ? "Más rápido que lo estimado" : "Más lento que lo estimado"}
                </p>
              </>
            ) : (
              <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#333", lineHeight: 1 }}>—</p>
            )}
          </div>

          {/* Tarifa efectiva */}
          <div style={{ background: "#0f0f0f", border: "1px solid #1a1a1a", borderRadius: 14, padding: "18px 20px" }}>
            <p style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Tarifa efectiva</p>
            {tarifaPeriodo !== null ? (
              <>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 24, color: "#c8922a", lineHeight: 1 }}>
                  {fmtCOP(tarifaPeriodo)}
                </p>
                <p style={{ fontSize: 10, color: "#444", fontFamily: "DM Mono", marginTop: 6 }}>por hora trabajada</p>
              </>
            ) : (
              <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: "#333", lineHeight: 1 }}>—</p>
            )}
          </div>
        </div>

        {/* Gráfico semanal por día */}
        {periodo === "semana" && weekData.some(d => d.horas > 0) && (
          <div>
            <p style={{ fontSize: 10, color: "#444", fontFamily: "DM Mono", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
              Horas por día
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 80 }}>
              {weekData.map(d => {
                const maxH = Math.max(...weekData.map(x => x.horas), 1);
                const pct = (d.horas / maxH) * 100;
                return (
                  <div key={d.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: d.horas > 0 ? "#888" : "#333", fontFamily: "DM Mono" }}>
                      {d.horas > 0 ? d.horas + "h" : ""}
                    </span>
                    <div style={{ width: "100%", background: "#1a1a1a", borderRadius: 6, height: 48, display: "flex", alignItems: "flex-end", overflow: "hidden" }}>
                      <div style={{
                        width: "100%", borderRadius: 6,
                        height: pct + "%",
                        background: d.esHoy ? "#c8922a" : "#2a2a2a",
                        transition: "height 0.4s ease",
                        minHeight: d.horas > 0 ? 4 : 0,
                      }} />
                    </div>
                    <span style={{ fontSize: 10, color: d.esHoy ? "#c8922a" : "#444", fontFamily: "DM Mono", fontWeight: d.esHoy ? 700 : 400 }}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Capacity hero ── */}
      <div style={{
        background: "linear-gradient(135deg, #111 0%, #0f0f0f 100%)",
        border: "1px solid #1e1e1e", borderRadius: 20, padding: "32px 36px",
        marginBottom: 20, position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200,
          borderRadius: "50%", background: capStatus.color + "08", border: "1px solid " + capStatus.color + "15" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Capacidad mensual
            </p>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 64, lineHeight: 1, color: capStatus.color, marginBottom: 12 }}>
              {capacityPct}<span style={{ fontSize: 28, opacity: 0.6 }}>%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {capStatus.pulse && <div style={{ width: 8, height: 8, borderRadius: "50%", background: capStatus.color }} className="pulse-ring" />}
              <span style={{ fontSize: 14, color: capStatus.color, fontWeight: 700 }}>{capStatus.label}</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ height: 8, background: "#1a1a1a", borderRadius: 4, marginBottom: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: capacityPct + "%", background: capStatus.color, borderRadius: 4, transition: "width 0.8s ease" }} />
            </div>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#444" }}>
              {allProjectHours.toFixed(1)}h registradas / {CAPACITY_HOURS * 4}h capacidad mensual
            </p>
            <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <StatBox label="Proyectos activos" value={proyectos.filter(p => p.estado !== "finalizado").length} />
              <StatBox label="Mejor tarifa" value={(() => {
                const rates = proyectos.map(p => getHourlyRate(p)).filter((r): r is number => r !== null);
                return rates.length > 0 ? fmtCOP(Math.max(...rates)) + "/h" : "—";
              })()} />
            </div>
          </div>
        </div>
      </div>

      {/* ── 3 bloques por tipo ── */}
      <ProyectoBlock titulo="Clientes"  proyectos={clientes}  tareas={tareas} accentColor="#c8922a" descripcion="proyectos facturados" />
      <ProyectoBlock titulo="Propios"   proyectos={propios}   tareas={tareas} accentColor="#7c9e6e" descripcion="tiempo vs. retorno" />
      <ProyectoBlock titulo="Propósito" proyectos={proposito} tareas={tareas} accentColor="#7b9ec8" descripcion="impacto sobre lucro" />
    </div>
  );
}
