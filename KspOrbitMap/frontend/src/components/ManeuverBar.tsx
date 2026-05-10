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
    <div style={panelInner}>
      <style>{styleTag}</style>
      
      {/* Header with technical info */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 15, borderBottom: "1px solid #2a3a4a", paddingBottom: 8 }}>
        <div style={{ fontFamily: "Orbitron", fontSize: 12, fontWeight: 700, color: "#4af", letterSpacing: 2 }}>
          ORBITAL MANEUVER UNIT
        </div>
        <div style={{ fontFamily: "Share Tech Mono", fontSize: 10, color: "#68a" }}>
          REF: {data.orbit?.body_name?.toUpperCase() || "---"}
        </div>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {/* Left column: Vector controls */}
        <div style={{ flex: 1 }}>
          <VecGroup label="PROGRADE" color="#ff0" val={pro} set={v => { setPro(v); sendM("prograde", v); }}
            inc={inc} sendM={sendM} keyName="prograde" />
          <VecGroup label="NORMAL" color="#f0f" val={nor} set={v => { setNor(v); sendM("normal", v); }}
            inc={inc} sendM={sendM} keyName="normal" />
          <VecGroup label="RADIAL" color="#0ff" val={rad} set={v => { setRad(v); sendM("radial", v); }}
            inc={inc} sendM={sendM} keyName="radial" />

          {/* Step Selector */}
          <div style={{ marginTop: 15, padding: "10px", background: "rgba(0,0,0,0.3)", border: "1px solid #1a2a3a" }}>
            <div style={{ fontSize: 9, color: "#68a", fontFamily: "Orbitron", marginBottom: 5 }}>PRECISION STEP</div>
            <div style={{ display: "flex", gap: 2 }}>
              {STEPS.map(v => (
                <button key={v} onClick={() => setInc(v)}
                  style={{
                    height: 22, flex: 1, borderRadius: 2, cursor: "pointer",
                    fontSize: 10, fontWeight: 700, fontFamily: "Share Tech Mono",
                    background: v === inc ? "#4af" : "#161b22",
                    color: v === inc ? "#000" : "#68a",
                    border: "1px solid #2a3a4a",
                    transition: "all 0.1s"
                  }}>{v}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Right column: Time and Post-Orbit info */}
        <div style={{ width: 180, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "10px", background: "rgba(0,0,0,0.3)", border: "1px solid #1a2a3a", flex: 1 }}>
            <div style={{ fontSize: 9, color: "#68a", fontFamily: "Orbitron", marginBottom: 5 }}>TIME TO NODE (T+)</div>
            <div style={{ display: "flex", gap: 2, marginBottom: 5 }}>
              <input type="number" step={1} value={time.toFixed(1)}
                onChange={e => { const v = parseFloat(e.target.value) || 0; setTime(v); send({ type: "set_node_time", time: v }); }}
                style={timeInputStyle} />
              <div style={{ fontSize: 10, color: "#4af", alignSelf: "center", fontFamily: "Share Tech Mono" }}>S</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
              <button style={tmBtn} onClick={() => { const v = Math.max(0, time - 60); setTime(v); send({ type: "set_node_time", time: v }); }}>-1M</button>
              <button style={tpBtn} onClick={() => { const v = time + 60; setTime(v); send({ type: "set_node_time", time: v }); }}>+1M</button>
              <button style={tmBtn} onClick={() => { const v = Math.max(0, time - 600); setTime(v); send({ type: "set_node_time", time: v }); }}>-10M</button>
              <button style={tpBtn} onClick={() => { const v = time + 600; setTime(v); send({ type: "set_node_time", time: v }); }}>+10M</button>
            </div>
          </div>

          <div style={{ padding: "10px", background: "rgba(0,0,0,0.5)", border: "1px solid #2a3a4a", borderRadius: 2 }}>
             <InfoRow label="TOTAL ΔV" value={m ? `${m.delta_v.toFixed(2)} m/s` : "---"} highlight />
             <InfoRow label="EST. BURN" value={m ? (m.burn_time > 0 ? `${m.burn_time.toFixed(1)}s` : "---") : "---"} />
             <div style={{ height: 1, background: "#2a3a4a", margin: "5px 0" }} />
             <InfoRow label="POST Pe" value={m?.post_orbit ? fmtAlt(m.post_orbit.periapsis_altitude) : "---"} />
             <InfoRow label="POST Ap" value={m?.post_orbit ? fmtAlt(m.post_orbit.apoapsis_altitude) : "---"} />
             <div style={{ height: 1, background: "#2a3a4a", margin: "5px 0" }} />
             <InfoRow label="ENCOUNTER" value={data.encounter?.body_name?.toUpperCase() || "NONE"} color={data.encounter ? "#fb0" : "#68a"} />
             <InfoRow label="TARGET Pe" value={data.encounter ? fmtAlt(data.encounter.periapsis_altitude) : "---"} highlight={!!data.encounter} color={data.encounter ? "#4f6" : "#68a"} />
          </div>
        </div>
      </div>

      {/* Bottom action row */}
      <div style={{ display: "flex", gap: 6, marginTop: 15 }}>
        <button style={actBtn("#1a6a3c", "#4f6")} onClick={() => send({ type: "add_node", prograde: pro, normal: nor, radial: rad })}>
          NEW NODE
        </button>
        <button style={actBtn("#1a4a5a", "#4af")} onClick={() => send({ type: "add_node_pe", prograde: pro, normal: nor, radial: rad })}>
          AT PE
        </button>
        <button style={actBtn("#1a4a5a", "#4af")} onClick={() => send({ type: "add_node_ap", prograde: pro, normal: nor, radial: rad })}>
          AT AP
        </button>
        <button style={actBtn("#5a4a1a", "#fb0")} onClick={() => send({ type: "circularize" })}>
          CIRCULARIZE
        </button>
        <div style={{ flex: 1 }} />
        <button style={actBtn("#5a2a2a", "#f44")} onClick={() => send({ type: "remove_node" })}>
          DELETE
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
  
  useEffect(() => { setLocalVal(val.toFixed(2)); }, [val]);

  const commit = (v: number) => { set(v); sendM(keyName, v); };

  return (
    <div style={{ marginBottom: 8, padding: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid #1a2a3a", borderRadius: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ color, fontWeight: 700, fontSize: 10, fontFamily: "Orbitron", letterSpacing: 1 }}>{label}</span>
        <span style={{ color, fontWeight: 700, fontSize: 14, fontFamily: "Share Tech Mono", textShadow: `0 0 8px ${color}44` }}>
          {val >= 0 ? "+" : ""}{val.toFixed(2)} <span style={{ fontSize: 10 }}>m/s</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button style={vmBtn()} onClick={() => commit(val - inc)}>-</button>
        <input type="number" step={0.01} value={localVal}
          onChange={e => setLocalVal(e.target.value)}
          onBlur={e => commit(parseFloat(e.target.value) || 0)}
          onKeyDown={e => { if (e.key === "Enter") commit(parseFloat(localVal) || 0); }}
          style={nudStyle(color)} />
        <button style={vpBtn()} onClick={() => commit(val + inc)}>+</button>
      </div>
    </div>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────

function InfoRow({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
      <span style={{ fontSize: 9, color: "#68a", fontFamily: "Orbitron", fontWeight: 700 }}>{label}</span>
      <span style={{ 
        fontSize: highlight ? 12 : 10, 
        color: color || (highlight ? "#4af" : "#ddd"), 
        fontFamily: "Share Tech Mono",
        fontWeight: highlight ? 700 : 400
      }}>{value}</span>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────

const panelInner: React.CSSProperties = {
  userSelect: "none"
};

const nudStyle = (color: string): React.CSSProperties => ({
  flex: 1, height: 28, background: "#05080c", color: color,
  border: `1px solid ${color}44`, borderRadius: 2,
  textAlign: "center", fontSize: 14, padding: "0 6px", outline: "none",
  fontFamily: "Share Tech Mono, monospace",
});

const timeInputStyle: React.CSSProperties = {
  flex: 1, height: 24, background: "#05080c", color: "#4af",
  border: "1px solid #2a3a4a", borderRadius: 2,
  textAlign: "right", fontSize: 12, padding: "0 6px", outline: "none",
  fontFamily: "Share Tech Mono, monospace",
};

const tmBtn: React.CSSProperties = {
  height: 22, background: "#161b22", color: "#68a",
  border: "1px solid #2a3a4a", borderRadius: 2,
  cursor: "pointer", fontSize: 9, fontFamily: "Orbitron", fontWeight: 700
};

const tpBtn: React.CSSProperties = {
  height: 22, background: "#161b22", color: "#68a",
  border: "1px solid #2a3a4a", borderRadius: 2,
  cursor: "pointer", fontSize: 9, fontFamily: "Orbitron", fontWeight: 700
};

const vmBtn = (): React.CSSProperties => ({
  height: 28, width: 30, background: "#161b22", color: "#68a",
  border: "1px solid #2a3a4a", borderRadius: 2,
  cursor: "pointer", fontSize: 14, fontFamily: "Share Tech Mono", fontWeight: 700
});

const vpBtn = (): React.CSSProperties => ({
  height: 28, width: 30, background: "#161b22", color: "#68a",
  border: "1px solid #2a3a4a", borderRadius: 2,
  cursor: "pointer", fontSize: 14, fontFamily: "Share Tech Mono", fontWeight: 700
});

const actBtn = (bg: string, border: string): React.CSSProperties => ({
  height: 30, padding: "0 12px", background: bg, color: "#fff",
  border: `1px solid ${border}aa`, borderRadius: 2,
  cursor: "pointer", fontWeight: 700, fontSize: 10,
  fontFamily: "Orbitron", letterSpacing: 1,
  boxShadow: `0 0 10px ${border}22`,
  transition: "all 0.2s"
});

const styleTag = `
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input[type=number] {
    -moz-appearance: textfield;
  }
  button:hover {
    filter: brightness(1.2);
    box-shadow: 0 0 15px currentColor;
  }
  button:active {
    transform: scale(0.98);
  }
`;

function fmtAlt(m: number): string {
  if (m < 0) return "---";
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m.toFixed(0)} m`;
}
