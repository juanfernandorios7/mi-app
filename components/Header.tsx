"use client";

type View = "dashboard" | "tareas" | "proyectos" | "formacion";

interface HeaderProps {
  view: View;
  onViewChange: (v: View) => void;
  onSignOut: () => void;
}

const NAV_ITEMS: [View, string][] = [
  ["dashboard", "Dashboard"],
  ["tareas", "Tareas"],
  ["proyectos", "Proyectos"],
  ["formacion", "Formación"],
];

export default function Header({ view, onViewChange, onSignOut }: HeaderProps) {
  const dateStr = new Date().toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <header style={{
      borderBottom: "1px solid #E5D4B8",
      padding: "0 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 60,
      position: "sticky",
      top: 0,
      background: "#EFE4D2",
      zIndex: 50,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#C8893A", boxShadow: "0 0 8px #C8893A88",
        }} />
        <span style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 20,
          letterSpacing: "-0.5px",
          color: "#2A2520",
        }}>
          Navva
        </span>
      </div>

      <nav style={{ display: "flex", gap: 4 }}>
        {NAV_ITEMS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            style={{
              background: view === key ? "#F4ECDF" : "transparent",
              border: view === key ? "1px solid #E5D4B8" : "1px solid transparent",
              color: view === key ? "#C8893A" : "#6B5E52",
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontFamily: "'Syne', sans-serif",
              fontWeight: 600,
              letterSpacing: "0.02em",
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#6B5E52" }}>
          {dateStr}
        </div>
        <button
          onClick={onSignOut}
          style={{
            background: "transparent", border: "1px solid #E5D4B8", color: "#999",
            padding: "5px 12px", borderRadius: 8, fontSize: 12,
            fontFamily: "'Syne', sans-serif", fontWeight: 600,
          }}
        >
          Salir
        </button>
      </div>
    </header>
  );
}
