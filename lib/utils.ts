import { Proyecto } from "./types";

export function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function fmtCOP(n: number): string {
  return "$" + Math.round(n).toLocaleString("es-CO");
}

export function minsToH(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min > 0 ? min + "m" : ""}` : `${min}m`;
}

export function getRentabilidad(project: Proyecto) {
  const hrs = project.horas_logged || 0.001;
  const cobrado = project.valor_total || project.valor_mensual || 0;
  const rate = cobrado / hrs;
  if (project.currency === "COP") {
    if (rate >= 200000) return { label: "Excelente", color: "#7c9e6e", score: 3 };
    if (rate >= 120000) return { label: "Bien",      color: "#c8922a", score: 2 };
    return { label: "Revisar", color: "#b05a5a", score: 1 };
  }
  return { label: "OK", color: "#c8922a", score: 2 };
}

export function getCapacityStatus(pct: number) {
  if (pct >= 90) return { label: "Delega ya",           color: "#b05a5a", pulse: true  };
  if (pct >= 70) return { label: "Considera delegar",   color: "#c8922a", pulse: false };
  return             { label: "Tienes espacio",         color: "#7c9e6e", pulse: false };
}

export const ACCENT_COLORS = ["#c8922a", "#7c9e6e", "#6e8eb0", "#a06e9e", "#b05a5a"];

export const btnStyle = (color: string): React.CSSProperties => ({
  background: color + "18",
  border: `1px solid ${color}44`,
  color,
  padding: "8px 18px",
  borderRadius: 10,
  fontSize: 13,
  fontFamily: "'Syne', sans-serif",
  fontWeight: 700,
  letterSpacing: "0.02em",
});

export const inputStyle: React.CSSProperties = {
  background: "#0f0f0f",
  border: "1px solid #2a2a2a",
  borderRadius: 10,
  padding: "10px 14px",
  color: "#e8e0d0",
  fontSize: 13,
  fontFamily: "'Syne', sans-serif",
  outline: "none",
  width: "100%",
};
