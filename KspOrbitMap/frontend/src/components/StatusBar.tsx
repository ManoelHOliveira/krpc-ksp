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

    parts = [
      `Pe ${fmtAlt(orbit.periapsis_altitude)}`,
      `Ap ${fmtAlt(orbit.apoapsis_altitude)}`,
      `Alt ${fmtAlt(vessel?.altitude ?? 0)}`,
      spdValid
        ? `Vel ${spd.toFixed(1)} m/s (${(spd * 3.6).toFixed(1)} km/h)`
        : "Vel ---",
      `Per ${fmtPeriod(orbit.period)}`,
    ];
    if (maneuver) {
      const ttn = maneuver.ut - orbit.epoch;
      parts.push(`\u0394V ${maneuver.delta_v.toFixed(1)} m/s`);
      parts.push(`T ${fmtTimeCompact(ttn)}`);
    }
    if (soi_bodies) for (const sb of soi_bodies) {
      if (sb.encounter) { parts.push(`SOI ${sb.name}`); break; }
    }
  }

  const text = parts.length > 0
    ? parts.join("  |  ")
    : "Scroll=zoom  |  Clique=pan  |  D-clic=n\u00f3  |  R-clic=remove  |  Arraste \u0394V";

  return (
    <div style={barStyle}>
      <span style={textStyle}>{text}</span>
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "1px 10px",
  background: "#0a0a14", height: 20,
  borderTop: "1px solid rgba(255,255,255,0.04)",
  overflow: "hidden", whiteSpace: "nowrap",
};

const textStyle: React.CSSProperties = {
  color: "rgba(160,190,170,0.6)", fontSize: 9,
  fontVariantNumeric: "tabular-nums",
};

function fmtAlt(m: number): string {
  if (m < 0) return "---";
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m.toFixed(0)} m`;
}

function fmtPeriod(s: number): string {
  if (s < 0 || !isFinite(s)) return "---";
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(2)}m`;
  return `${(s / 3600).toFixed(3)}h`;
}

function fmtTimeCompact(s: number): string {
  if (s < 0 || !isFinite(s)) return "---";
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}m`;
  return `${(s / 3600).toFixed(2)}h`;
}
