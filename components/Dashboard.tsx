"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Proyecto, Tarea } from "@/lib/types";
import { fmtCOP, getRentabilidad, getCapacityStatus, today } from "@/lib/utils";
import StatBox from "./StatBox";

interface DashboardProps {
  proyectos: Proyecto[];
  tareas: Tarea[];
  capacidadHoras: number;
}

export default function Dashboard({ proyectos, tareas, capacidadHoras }: DashboardProps) {
  const CAPACITY_HOURS = capacidadHoras;

  const todayTasks = tareas.filter(t => t.fecha === today());
  const doneTasks = todayTasks.filter(t => t.estado === "completada").length;

  const totalHoursToday = todayTasks.reduce((a, t) => a + t.tiempo_real / 60, 0);
  const allProjectHours = proyectos.reduce((a, p) => a + p.horas_logged, 0);
  const capacityPct = Math.min(100, Math.round((allProjectHours / (CAPACITY_HOURS * 4)) * 100));
  const capStatus = getCapacityStatus(capacityPct);

  const bestRate = proyectos.length > 0
    ? Math.max(...proyectos.map(p => {
        const cobrado = p.valor_total || p.valor_mensual || 0;
        return cobrado / (p.horas_logged || 1);
      }))
    : 0;

  const chartData = proyectos.map(p => {
    const cobrado = p.valor_total || p.valor_mensual || 0;
    const r = getRentabilidad(p);
    return {
      name: p.nombre.split(" ")[0],
      rate: Math.round(cobrado / (p.horas_logged || 1)),
      color: r.color,
    };
  });

  return (
    <div className="fade-up">
      {/* Capacity Hero */}
      <div style={{
        background: "linear-gradient(135deg, #111 0%, #0f0f0f 100%)",
        border: "1px solid #1e1e1e", borderRadius: 20, padding: "32px 36px",
        marginBottom: 20, position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: -40, right: -40, width: 200, height: 200,
          borderRadius: "50%", background: capStatus.color + "08",
          border: "1px solid " + capStatus.color + "15",
        }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 24 }}>
          <div>
            <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
              Capacidad mensual
            </p>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 64, lineHeight: 1, color: capStatus.color, marginBottom: 12 }}>
              {capacityPct}<span style={{ fontSize: 28, opacity: 0.6 }}>%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {capStatus.pulse && (
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: capStatus.color }} className="pulse-ring" />
              )}
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
              <StatBox label="Tareas hoy"       value={`${doneTasks}/${todayTasks.length}`} />
              <StatBox label="Horas hoy"        value={totalHoursToday.toFixed(1) + "h"} />
              <StatBox label="Proyectos activos" value={proyectos.length} />
              <StatBox label="Mejor tarifa"     value={bestRate > 0 ? fmtCOP(bestRate) + "/h" : "—"} />
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 20, padding: "24px 28px", marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>
            Tarifa efectiva por proyecto (COP/hora)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={32}>
              <XAxis dataKey="name" tick={{ fill: "#555", fontSize: 12, fontFamily: "Syne" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#444", fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false}
                tickFormatter={v => "$" + (v / 1000).toFixed(0) + "k"} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10, fontFamily: "DM Mono", fontSize: 12 }}
                formatter={(v) => [fmtCOP(Number(v)), "COP/hora"]}
                labelStyle={{ color: "#888" }}
              />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Projects quick view */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {proyectos.map(p => {
          const r = getRentabilidad(p);
          const cobrado = p.valor_total || p.valor_mensual || 0;
          return (
            <div key={p.id} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 16, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color, marginTop: 5 }} />
                <span style={{ fontSize: 11, color: r.color, fontWeight: 700, background: r.color + "18", padding: "2px 8px", borderRadius: 20 }}>
                  {r.label}
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "#ddd" }}>{p.nombre}</p>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#555", marginBottom: 6 }}>
                {p.horas_logged}h invertidas
              </p>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: p.color }}>{fmtCOP(cobrado)}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
