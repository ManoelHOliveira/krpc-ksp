import type { ServerData } from "../types";

interface Props {
  data: ServerData;
}

export default function StatusBar({ data }: Props) {
  const { orbit, vessel, maneuvers } = data;

  const renderItem = (label: string, value: string, color = "#0f0") => (
    <div key={label} style={{ display: "flex", gap: 5, fontSize: "10px", fontFamily: "monospace" }}>
      <span style={{ color: "#080" }}>{label.toUpperCase()}:</span>
      <span style={{ color, fontWeight: "bold" }}>{value}</span>
    </div>
  );

  const items = [];
  if (orbit) {
    items.push(renderItem("alt", fmtAlt(vessel?.altitude ?? 0)));
    items.push(renderItem("vel", vessel?.speed ? `${vessel.speed.toFixed(1)}m/s` : "---"));
    items.push(renderItem("pe", fmtAlt(orbit.periapsis_altitude)));
    items.push(renderItem("ap", fmtAlt(orbit.apoapsis_altitude)));
    
    if (maneuvers && maneuvers.length > 0) {
      const m = maneuvers[0];
      items.push(<div key="sep" style={{ width: "1px", height: "10px", background: "#040", margin: "0 5px" }} />);
      items.push(renderItem("node_dv", `${m.delta_v.toFixed(1)}m/s`, "#ff0"));
      items.push(renderItem("t_node", fmtTimeCompact(m.ut - (data.ut || 0)), "#ff0"));
    }
  }

  return (
    <div style={barStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
        {items.length > 0 ? items : <span style={{ fontSize: "9px", color: "#040" }}>[ SYSTEM_READY: NO_TELEMETRY_LINK ]</span>}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ fontSize: "9px", color: "#040" }}>V2.0_RADAR_LINK</div>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "0 20px",
  background: "#000", height: 26,
  borderTop: "1px solid #040",
};

function fmtAlt(m: number): string {
  if (m < 0) return "NIL";
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)}Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m.toFixed(0)}m`;
}

function fmtTimeCompact(s: number): string {
  if (s < 0 || !isFinite(s)) return "NIL";
  if (s < 60) return `${s.toFixed(0)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  return `${m}m ${rs}s`;
}
