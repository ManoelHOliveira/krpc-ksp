import type { ServerData } from "../types";

interface Props {
  data: ServerData;
}

export default function StatusBar({ data }: Props) {
  const { orbit, vessel, maneuver } = data;

  const renderPart = (label: string, value: string, color = "#4af") => (
    <div key={label} style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
      <span style={{ color: "#68a", fontSize: 9, fontFamily: "Orbitron", fontWeight: 700 }}>{label.toUpperCase()}</span>
      <span style={{ color, fontSize: 11, fontFamily: "Share Tech Mono", fontWeight: 700, textShadow: `0 0 5px ${color}44` }}>{value}</span>
    </div>
  );

  const parts = [];

  if (orbit) {
    const spd = vessel?.speed;
    parts.push(renderPart("Pe", fmtAlt(orbit.periapsis_altitude)));
    parts.push(renderPart("Ap", fmtAlt(orbit.apoapsis_altitude)));
    parts.push(renderPart("Alt", fmtAlt(vessel?.altitude ?? 0), "#4f6"));
    parts.push(renderPart("Vel", spd != null && isFinite(spd) ? `${spd.toFixed(1)} m/s` : "---", "#4f6"));
    
    if (maneuver) {
      parts.push(<div key="sep" style={{ width: 1, height: 12, background: "#2a3a4a", margin: "0 10px" }} />);
      parts.push(renderPart("Node ΔV", `${maneuver.delta_v.toFixed(1)} m/s`, "#ff0"));
      parts.push(renderPart("Time", fmtTimeCompact(maneuver.ut - orbit.epoch), "#ff0"));
    }
  }

  return (
    <div style={barStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {parts.length > 0 ? parts : <span style={{ color: "#68a", fontSize: 10, fontFamily: "Orbitron" }}>WAITING FOR TELEMETRY LINK...</span>}
      </div>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "0 15px",
  background: "#05080c", height: 28,
  borderTop: "2px solid #2a3a4a",
  overflow: "hidden",
};

const textStyle: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 10,
  fontWeight: "bold",
  color: "#fff"
};

function fmtAlt(m: number): string {
  if (m < 0) return "---";
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m.toFixed(0)} m`;
}

function fmtTimeCompact(s: number): string {
  if (s < 0 || !isFinite(s)) return "---";
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}m`;
  return `${(s / 3600).toFixed(2)}h`;
}
