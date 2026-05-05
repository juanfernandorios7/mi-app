interface MetricBoxProps {
  label: string;
  value: string | number;
  color?: string;
}

export default function MetricBox({ label, value, color }: MetricBoxProps) {
  return (
    <div style={{ background: "#2a2018", borderRadius: 12, padding: "12px 16px" }}>
      <p style={{ fontSize: 10, color: "#999", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: color || "#f0ebe3", fontWeight: 500 }}>{value}</p>
    </div>
  );
}
