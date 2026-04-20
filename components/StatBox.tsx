interface StatBoxProps {
  label: string;
  value: string | number;
}

export default function StatBox({ label, value }: StatBoxProps) {
  return (
    <div style={{ background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 12, padding: "12px 16px" }}>
      <p style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 18, color: "#e8e0d0", fontWeight: 500 }}>{value}</p>
    </div>
  );
}
