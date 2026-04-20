"use client";

type View = "dashboard" | "tareas" | "proyectos";

interface HeaderProps {
  view: View;
  onViewChange: (v: View) => void;
  onSignOut: () => void;
}

const NAV_ITEMS: [View, string][] = [
  ["dashboard", "Dashboard"],
  ["tareas", "Tareas"],
  ["proyectos", "Proyectos"],
];

export default function Header({ view, onViewChange, onSignOut }: HeaderProps) {
  const dateStr = new Date().toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <header style={{
      borderBottom: "1px solid #1e1e1e",
      padding: "0 28px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: 60,
      position: "sticky",
      top: 0,
      background: "#0a0a0a",
      zIndex: 100,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#c8922a", boxShadow: "0 0 8px #c8922a88",
        }} />
        <span style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 20,
          letterSpacing: "-0.5px",
          color: "#e8e0d0",
        }}>
          Juanfer OS
        </span>
      </div>

      <nav style={{ display: "flex", gap: 4 }}>
        {NAV_ITEMS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onViewChange(key)}
            style={{
              background: view === key ? "#1a1a1a" : "transparent",
              border: view === key ? "1px solid #2a2a2a" : "1px solid transparent",
              color: view === key ? "#c8922a" : "#666",
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
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#444" }}>
          {dateStr}
        </div>
        <button
          onClick={onSignOut}
          style={{
            background: "transparent", border: "1px solid #222", color: "#555",
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
