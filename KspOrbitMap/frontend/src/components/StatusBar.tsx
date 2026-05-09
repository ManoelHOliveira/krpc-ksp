import type { ServerData } from "../types";

interface Props {
  data: ServerData;
}

export default function StatusBar({ data }: Props) {
  const { orbit, vessel, maneuver, soi_bodies } = data;

  let parts: string[] = [];

  if (orbit) {
    const spd = vessel?.speed;
    const spdValid = spd != null && isFinite(spd);

    // Adicionando Ap e Pe claramente
    parts = [
      `Pe ${fmtAlt(orbit.periapsis_altitude)}`,
      `Ap ${fmtAlt(orbit.apoapsis_altitude)}`,
      `Alt ${fmtAlt(vessel?.altitude ?? 0)}`,
      spdValid ? `Vel ${spd.toFixed(1)} m/s` : "Vel ---",
    ];

    if (maneuver) {
      parts.push(`\u0394V ${maneuver.delta_v.toFixed(1)} m/s`);
      parts.push(`UT ${fmtTimeCompact(maneuver.ut - orbit.epoch)}`);
    }
  }

  const text = parts.length > 0
    ? parts.join("  |  ")
    : "Conectando ao KSP...";

  return (
    <div style={barStyle}>
      <span style={textStyle}>{text}</span>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "1px 10px",
  background: "#0a0a14", height: 24,
  borderTop: "1px solid rgba(255,255,255,0.1)",
  overflow: "hidden", whiteSpace: "nowrap",
  fontSize: "10px",
  color: "#0f0"
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
