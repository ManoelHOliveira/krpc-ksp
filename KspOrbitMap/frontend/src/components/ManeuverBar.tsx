import { useState, useEffect } from "react";
import type { ServerData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

const STEPS = [0.01, 0.1, 1, 5, 10, 100];

export default function ManeuverBar({ data, send }: Props) {
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
    <div style={barOuter}>
      <style>{styleTag}</style>
      {/* Row 1: vector controls + step */}
      <div style={rowStyle}>

        {/* PRO */}
        <VecGroup label="PRO" color="#ff66ff" val={pro} set={v => { setPro(v); sendM("prograde", v); }}
          inc={inc} sendM={sendM} keyName="prograde" />

        <div style={sepStyle} />

        {/* NRM */}
        <VecGroup label="NRM" color="#b388ff" val={nor} set={v => { setNor(v); sendM("normal", v); }}
          inc={inc} sendM={sendM} keyName="normal" />

        <div style={sepStyle} />

        {/* RAD */}
        <VecGroup label="RAD" color="#66b3ff" val={rad} set={v => { setRad(v); sendM("radial", v); }}
          inc={inc} sendM={sendM} keyName="radial" />

        <div style={sepVStyle} />

        {/* Step buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span style={{ color: "#888", fontSize: 8, marginRight: 2 }}>STEP</span>
          {STEPS.map(v => (
            <button key={v} onClick={() => setInc(v)}
              style={{
                height: 20, minWidth: 30, borderRadius: 2, cursor: "pointer",
                fontSize: 9, fontWeight: 600, textAlign: "center", padding: "0 2px",
                background: v === inc ? "rgba(68,136,255,0.3)" : "rgba(255,255,255,0.04)",
                color: v === inc ? "#88bbff" : "#888",
                border: v === inc ? "1px solid rgba(68,136,255,0.5)" : "1px solid rgba(255,255,255,0.06)",
              }}>{v}</button>
          ))}
        </div>

        <div style={sepVStyle} />

        {/* T+ time */}
        <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
          <span style={{ color: "#888", fontSize: 7 }}>T+</span>
          <input type="number" step={1} value={time}
            onChange={e => { const v = parseFloat(e.target.value) || 0; setTime(v); send({ type: "set_node_time", time: v }); }}
            style={inputStyle} />
          <button style={tmBtn} onClick={() => { const v = Math.max(0, time - 600); setTime(v); send({ type: "set_node_time", time: v }); }}>-10m</button>
          <button style={tmBtn} onClick={() => { const v = Math.max(0, time - 60); setTime(v); send({ type: "set_node_time", time: v }); }}>-1m</button>
          <button style={tpBtn} onClick={() => { const v = time + 60; setTime(v); send({ type: "set_node_time", time: v }); }}>+1m</button>
          <button style={tpBtn} onClick={() => { const v = time + 600; setTime(v); send({ type: "set_node_time", time: v }); }}>+10m</button>
        </div>
      </div>

      {/* Row 2: info + actions */}
      <div style={rowStyle}>
        <span style={infoStyle}>
          <span style={infoLabel}>DV</span> {m ? `${m.delta_v.toFixed(1)} m/s` : "--"}
        </span>
        <span style={infoStyle}>
          <span style={infoLabel}>Burn</span> {m ? (m.burn_time > 0 ? `${m.burn_time.toFixed(1)}s` : "--") : "--"}
        </span>
        <span style={infoStyle}>
          <span style={infoLabel}>Pe</span> {m?.post_orbit ? fmtAlt(m.post_orbit.periapsis_altitude) : "--"}
        </span>
        <span style={infoStyle}>
          <span style={infoLabel}>Ap</span> {m?.post_orbit ? fmtAlt(m.post_orbit.apoapsis_altitude) : "--"}
        </span>
        <span style={infoStyle} title={data.encounter_text || ""}>
          <span style={infoLabel}>Enc</span> {data.encounter_text || "--"}
        </span>

        <div style={sepVStyle} />

        <button style={actBtn("#1a6a3c")} onClick={() => send({ type: "add_node", prograde: pro, normal: nor, radial: rad })}>
          + Add
        </button>
        <button style={actBtn("#1a4a5a")} onClick={() => send({ type: "add_node_pe", prograde: pro, normal: nor, radial: rad })}>
          @Pe
        </button>
        <button style={actBtn("#1a4a5a")} onClick={() => send({ type: "add_node_ap", prograde: pro, normal: nor, radial: rad })}>
          @Ap
        </button>
        <button style={actBtn("#5a4a1a")} onClick={() => send({ type: "circularize" })}>
          Circ
        </button>
        <button style={actBtn("#5a2a2a")} onClick={() => send({ type: "remove_node" })}>
          Del
        </button>
      </div>
    </div>
  );
}

// ─── VecGroup ─────────────────────────────────────────────────────

function VecGroup({ label, color, val, set, inc, sendM, keyName }: {
  label: string; color: string; val: number; set: (v: number) => void;
  inc: number; sendM: (k: string, v: number) => void; keyName: string;
}) {
  const [localVal, setLocalVal] = useState(val.toString());
  
  useEffect(() => { setLocalVal(val.toFixed(1)); }, [val]);

  const commit = (v: number) => { set(v); sendM(keyName, v); };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
      <span style={{ color, fontWeight: 700, fontSize: 9, width: 24, letterSpacing: 1 }}>{label}</span>
      <button style={vmBtn}
        onClick={() => commit(val - inc)}>-</button>
      <input type="number" step={0.01} value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={e => commit(parseFloat(e.target.value) || 0)}
        onKeyDown={e => { if (e.key === "Enter") commit(parseFloat(localVal) || 0); }}
        style={nudStyle} />
      <button style={vpBtn}
        onClick={() => commit(val + inc)}>+</button>
      <span style={{ color, fontWeight: 600, fontSize: 10, width: 40, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {val >= 0 ? "+" : ""}{val.toFixed(1)}
      </span>
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────

const barOuter: React.CSSProperties = {
  background: "#0e0e1a", borderTop: "1px solid rgba(255,255,255,0.06)",
  padding: "4px 6px", flexShrink: 0,
};

const rowStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4, minHeight: 22,
  flexWrap: "wrap", marginBottom: 2,
};

const sepStyle: React.CSSProperties = {
  width: 1, height: 18, background: "rgba(255,255,255,0.06)", margin: "0 4px",
};

const sepVStyle: React.CSSProperties = {
  width: 1, height: 18, background: "rgba(255,255,255,0.08)", margin: "0 6px",
};

const nudStyle: React.CSSProperties = {
  width: 46, height: 20, background: "rgba(255,255,255,0.04)", color: "#ddd",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2,
  textAlign: "right", fontSize: 9, padding: "0 2px", outline: "none",
  // Hide spinners
  appearance: "textfield",
};

// Add to ManeuverBar.tsx to inject this into style tag for input[type=number]
const styleTag = `
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
`;

const inputStyle: React.CSSProperties = {
  width: 52, height: 20, background: "rgba(255,255,255,0.04)", color: "#ddd",
  border: "1px solid rgba(255,255,255,0.08)", borderRadius: 2,
  textAlign: "right", fontSize: 9, padding: "0 2px", outline: "none",
};

const tmBtn: React.CSSProperties = {
  height: 20, background: "rgba(255,255,255,0.04)", color: "#999",
  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2,
  cursor: "pointer", fontSize: 8, padding: "0 3px",
};

const tpBtn: React.CSSProperties = {
  height: 20, background: "rgba(255,255,255,0.04)", color: "#999",
  border: "1px solid rgba(255,255,255,0.06)", borderRadius: 2,
  cursor: "pointer", fontSize: 8, padding: "0 3px",
};

const vmBtn: React.CSSProperties = {
  width: 18, height: 20, background: "rgba(255,80,80,0.12)", color: "#f88",
  border: "1px solid rgba(255,80,80,0.15)", borderRadius: 2,
  cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center",
  justifyContent: "center", padding: 0, lineHeight: 1,
};

const vpBtn: React.CSSProperties = {
  width: 18, height: 20, background: "rgba(80,255,80,0.1)", color: "#8f8",
  border: "1px solid rgba(80,255,80,0.15)", borderRadius: 2,
  cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center",
  justifyContent: "center", padding: 0, lineHeight: 1,
};

const infoStyle: React.CSSProperties = {
  fontSize: 9, color: "#aaa", fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const infoLabel: React.CSSProperties = {
  color: "#666", fontWeight: 600, marginRight: 2,
};

const actBtn = (bg: string): React.CSSProperties => ({
  height: 20, padding: "0 7px", background: bg, color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 2,
  cursor: "pointer", fontWeight: 600, fontSize: 9,
  display: "inline-flex", alignItems: "center",
});

// ─── Helpers ──────────────────────────────────────────────────────

function fmtAlt(m: number): string {
  if (m < 0) return "---";
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m.toFixed(0)} m`;
}
