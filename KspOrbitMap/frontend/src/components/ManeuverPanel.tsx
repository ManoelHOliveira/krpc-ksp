import { useState, useEffect } from "react";
import type { ServerData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

const STEPS = [0.01, 0.1, 1, 5, 10, 100];

export default function ManeuverPanel({ data, send }: Props) {
  const [inc, setInc] = useState(1);
  const [pro, setPro] = useState(0);
  const [nor, setNor] = useState(0);
  const [rad, setRad] = useState(0);
  const [time, setTime] = useState(0);

  const m = data.maneuver;

  useEffect(() => {
    if (m) {
      setPro(m.prograde);
      setNor(m.normal);
      setRad(m.radial);
      if (data.orbit) setTime(m.ut - data.orbit.epoch);
    } else {
      setPro(0); setNor(0); setRad(0); setTime(0);
    }
  }, [m, data.orbit]);

  const sendM = (key: string, val: number) => send({ type: "set_maneuver", [key]: val });

  return (
    <div style={panelStyle}>
      <div style={titleStyle}>PLANNER</div>
      <div style={dividerStyle} />

      {/* Step selector — buttons */}
      <div style={{ marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: "#888", marginBottom: 3 }}>STEP</div>
        <div style={{ display: "flex", gap: 2 }}>
          {STEPS.map(v => (
            <button
              key={v}
              onClick={() => setInc(v)}
              style={{
                ...stepBtnStyle,
                background: v === inc ? "rgba(68,136,255,0.3)" : "rgba(255,255,255,0.04)",
                color: v === inc ? "#88bbff" : "#888",
                border: v === inc ? "1px solid rgba(68,136,255,0.5)" : "1px solid rgba(255,255,255,0.06)",
              }}
            >{v}</button>
          ))}
        </div>
      </div>

      {/* Vector rows */}
      <VecRow label="PRO" color="#ff66ff" val={pro} set={v => { setPro(v); sendM("prograde", v); }}
        inc={inc} sendM={sendM} keyName="prograde" />
      <VecRow label="NRM" color="#b388ff" val={nor} set={v => { setNor(v); sendM("normal", v); }}
        inc={inc} sendM={sendM} keyName="normal" />
      <VecRow label="RAD" color="#66b3ff" val={rad} set={v => { setRad(v); sendM("radial", v); }}
        inc={inc} sendM={sendM} keyName="radial" />

      <div style={dividerStyle} />

      {/* Info */}
      <InfoRow label={"\u0394V"} value={m ? `${m.delta_v.toFixed(1)} m/s` : "--"} />
      <InfoRow label="BURN" value={m ? (m.burn_time > 0 ? `${m.burn_time.toFixed(1)}s` : "--") : "--"} />
      <InfoRow label="PE'" value={m?.post_orbit ? fmtAlt(m.post_orbit.periapsis_altitude) : "--"} />
      <InfoRow label="AP'" value={m?.post_orbit ? fmtAlt(m.post_orbit.apoapsis_altitude) : "--"} />
      <InfoRow label="ENC" value={data.encounter_text || ""} />

      {/* Node time */}
      <div style={{ marginTop: 4 }}>
        <div style={{ fontSize: 10, color: "#888", marginBottom: 2 }}>T+ (s)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <input type="number" step={1} value={time}
            onChange={e => { const v = parseFloat(e.target.value) || 0; setTime(v); send({ type: "set_node_time", time: v }); }}
            style={inputStyle} />
          <Tb text="\u23EE\u23EE" onClick={() => nudTime(-600)} />
          <Tb text="\u23EE" onClick={() => nudTime(-60)} />
          <Tb text="\u23ED" onClick={() => nudTime(60)} />
          <Tb text="\u23ED\u23ED" onClick={() => nudTime(600)} />
        </div>
      </div>

      <div style={dividerStyle} />

      {/* Action buttons */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        <ABtn text="\u2795 Add" color="#1a7a3c" onClick={() => send({ type: "add_node", prograde: pro, normal: nor, radial: rad })} />
        <ABtn text="\u25D4 @Pe" color="#1a5a6c" onClick={() => send({ type: "add_node_pe", prograde: pro, normal: nor, radial: rad })} />
        <ABtn text="\u25D5 @Ap" color="#1a5a6c" onClick={() => send({ type: "add_node_ap", prograde: pro, normal: nor, radial: rad })} />
        <ABtn text="\u21BB Circ" color="#5a5a1a" onClick={() => send({ type: "circularize" })} />
        <ABtn text="\u2716 Del" color="#6a2a2a" onClick={() => send({ type: "remove_node" })} />
      </div>
    </div>
  );

  function nudTime(delta: number) {
    const v = Math.max(0, time + delta);
    setTime(v);
    send({ type: "set_node_time", time: v });
  }
}

// ─── VecRow ──────────────────────────────────────────────────────

function VecRow({ label, color, val, set, inc, sendM, keyName }: {
  label: string; color: string; val: number; set: (v: number) => void;
  inc: number; sendM: (k: string, v: number) => void; keyName: string;
}) {
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ fontSize: 9, color: color, fontWeight: 700, marginBottom: 1, letterSpacing: 1 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
        <button style={btnM} onClick={() => { const v = val - inc; set(v); sendM(keyName, v); }}>\u2212</button>
        <input type="number" step={0.01} value={val}
          onChange={e => { const v = parseFloat(e.target.value) || 0; set(v); sendM(keyName, v); }}
          style={inputStyle} />
        <button style={btnP} onClick={() => { const v = val + inc; set(v); sendM(keyName, v); }}>+</button>
        <span style={{
          color, fontWeight: 600, fontSize: 11, width: 56, textAlign: "right",
          fontVariantNumeric: "tabular-nums",
        }}>
          {val >= 0 ? "+" : ""}{val.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", fontSize: 10,
      padding: "2px 0", lineHeight: "16px",
    }}>
      <span style={{ color: "#888", fontWeight: 600, letterSpacing: 1 }}>{label}</span>
      <span style={{ color: "#ddd", fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

// ─── Small buttons ────────────────────────────────────────────────

function Tb({ text, onClick }: { text: string; onClick: () => void }) {
  return (
    <button style={{
      height: 22, minWidth: 26, background: "rgba(255,255,255,0.04)", color: "#aaa",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3,
      cursor: "pointer", fontSize: 9, display: "flex", alignItems: "center",
      justifyContent: "center",
    }} onClick={onClick}>{text}</button>
  );
}

function ABtn({ text, color, onClick }: { text: string; color: string; onClick: () => void }) {
  return (
    <button style={{
      height: 26, padding: "0 9px", background: color, color: "#fff",
      border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
      cursor: "pointer", fontWeight: 600, fontSize: 10,
      display: "inline-flex", alignItems: "center", gap: 3,
    }} onClick={onClick}>{text}</button>
  );
}

// ─── Style constants ──────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  padding: "6px 10px", background: "#0e0e1a", height: "100%",
  overflowY: "auto", overflowX: "hidden",
};

const titleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#fff",
  letterSpacing: 2, padding: "2px 0",
};

const dividerStyle: React.CSSProperties = {
  height: 1, background: "linear-gradient(90deg, rgba(42,74,58,0.5), transparent)",
  margin: "5px 0",
};

const inputStyle: React.CSSProperties = {
  flex: 1, height: 24, background: "rgba(255,255,255,0.04)", color: "#ddd",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 3,
  textAlign: "right", fontSize: 10, padding: "0 4px", outline: "none",
  minWidth: 0,
};

const stepBtnStyle: React.CSSProperties = {
  flex: 1, height: 22, borderRadius: 3, cursor: "pointer",
  fontSize: 9, fontWeight: 600, textAlign: "center",
  display: "flex", alignItems: "center", justifyContent: "center",
  minWidth: 0,
};

const btnM: React.CSSProperties = {
  width: 24, height: 24, background: "rgba(255,80,80,0.15)", color: "#f88",
  border: "1px solid rgba(255,80,80,0.2)", borderRadius: 3,
  cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center",
  justifyContent: "center",
};

const btnP: React.CSSProperties = {
  width: 24, height: 24, background: "rgba(80,255,80,0.12)", color: "#8f8",
  border: "1px solid rgba(80,255,80,0.2)", borderRadius: 3,
  cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center",
  justifyContent: "center",
};

// ─── Helpers ──────────────────────────────────────────────────────

function fmtAlt(m: number): string {
  if (m < 0) return "---";
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m.toFixed(0)} m`;
}
