interface MetricBoxProps {
  label: string;
  value: string | number;
  color?: string;
}

export default function MetricBox({ label, value, color }: MetricBoxProps) {
  return (
    <div style={{ background: "#0f0f0f", borderRadius: 12, padding: "12px 16px" }}>
      <p style={{ fontSize: 10, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 15, color: color || "#e8e0d0", fontWeight: 500 }}>{value}</p>
    </div>
  );
}
