interface StatBoxProps {
  label: string;
  value: string | number;
}

export default function StatBox({ label, value }: StatBoxProps) {
  return (
    <div style={{ background: "#1c1917", border: "1px solid #2d2926", borderRadius: 12, padding: "12px 16px" }}>
      <p style={{ fontSize: 10, color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 20, color: "#f0ebe3", fontWeight: 500 }}>{value}</p>
    </div>
  );
}
