import { useState, useEffect } from "react";
import type { ServerData, ManeuverData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

const STEPS = [0.01, 0.1, 1, 5, 10, 100];
const NODE_COLORS = ["#4af", "#f0f", "#0ff", "#ff0", "#4f6", "#f44"];

export default function ManeuverBar({ data, send }: Props) {
  const [inc, setInc] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  
  const maneuvers = data.maneuvers || [];
  const m = maneuvers[activeIdx] || null;

  // Auto-switch to last node if active one is removed
  useEffect(() => {
    if (maneuvers.length > 0 && activeIdx >= maneuvers.length) {
      setActiveIdx(maneuvers.length - 1);
    }
  }, [maneuvers.length, activeIdx]);

  const sendM = (key: string, val: number) => {
    send({ type: "set_maneuver", index: activeIdx, [key]: val });
  };

  const handleTimeChange = (v: number) => {
     send({ type: "set_node_time", index: activeIdx, time: v });
  };

  return (
    <div style={panelInner}>
      <style>{styleTag}</style>
      
      {/* Header with Node Selector */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 15, borderBottom: "1px solid #2a3a4a", paddingBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "Orbitron", fontSize: 12, fontWeight: 700, color: "#4af", letterSpacing: 2 }}>
            PLANNER
          </div>
          {maneuvers.length > 1 && (
            <div style={{ display: "flex", gap: 4 }}>
              {maneuvers.map((_, i) => (
                <button key={i} onClick={() => setActiveIdx(i)}
                  style={{
                    width: 20, height: 20, borderRadius: "50%", cursor: "pointer",
                    background: activeIdx === i ? NODE_COLORS[i % NODE_COLORS.length] : "transparent",
                    border: `2px solid ${NODE_COLORS[i % NODE_COLORS.length]}`,
                    color: activeIdx === i ? "#000" : NODE_COLORS[i % NODE_COLORS.length],
                    fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"
                  }}>{i + 1}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ fontFamily: "Share Tech Mono", fontSize: 10, color: "#68a" }}>
          NODE {activeIdx + 1} / {maneuvers.length || 0}
        </div>
      </div>

      {!m ? (
        <div style={{ padding: "20px", textAlign: "center", color: "#68a", fontFamily: "Orbitron", fontSize: 11 }}>
          NO ACTIVE MANEUVER NODES
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 15 }}>
            <button style={actBtn("#1a6a3c", "#4f6")} 
              onClick={() => send({ type: "add_node", prograde: 0, normal: 0, radial: 0 })}>
              + GENERIC
            </button>
            <button style={actBtn("#1a4a5a", "#4af")} 
              onClick={() => send({ type: "add_node_pe", prograde: 0, normal: 0, radial: 0 })}>
              + AT PE
            </button>
            <button style={actBtn("#1a4a5a", "#4af")} 
              onClick={() => send({ type: "add_node_ap", prograde: 0, normal: 0, radial: 0 })}>
              + AT AP
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 20 }}>
            {/* Left column: Vector controls */}
            <div style={{ flex: 1 }}>
              <VecGroup label="PROGRADE" color="#ff0" val={m.prograde} set={v => sendM("prograde", v)}
                inc={inc} keyName="prograde" />
              <VecGroup label="NORMAL" color="#f0f" val={m.normal} set={v => sendM("normal", v)}
                inc={inc} keyName="normal" />
              <VecGroup label="RADIAL" color="#0ff" val={m.radial} set={v => sendM("radial", v)}
                inc={inc} keyName="radial" />

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
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ position: "relative" }}>
                    <input type="number" step={1} value={(m.ut - (data.orbit?.epoch || 0)).toFixed(1)}
                      onChange={e => handleTimeChange(parseFloat(e.target.value) || 0)}
                      style={{ ...timeInputStyle, width: "100%", height: "40px", textAlign: "center", fontSize: "16px", paddingBottom: "12px" }} />
                    <div style={{ 
                      position: "absolute", bottom: "4px", left: 0, right: 0, 
                      textAlign: "center", fontSize: "8px", color: "#68a", 
                      fontFamily: "Orbitron", pointerEvents: "none", textTransform: "uppercase" 
                    }}>
                      SECONDS
                    </div>
                  </div>
                  <div style={{ 
                    textAlign: "center", background: "rgba(0,0,0,0.4)", 
                    padding: "4px", border: "1px solid #1a2a3a", borderRadius: 2,
                    fontSize: "10px", color: "#4af", fontFamily: "Share Tech Mono"
                  }}>
                    {fmtMinSec(m.ut - (data.orbit?.epoch || 0))}
                  </div>
                  <div style={{ display: "flex", gap: 2 }}>
                    <button style={{ ...vmBtn(), flex: 1, height: "30px" }} onClick={() => handleTimeChange(Math.max(0, (m.ut - (data.orbit?.epoch || 0)) - inc))}>-</button>
                    <button style={{ ...vpBtn(), flex: 1, height: "30px" }} onClick={() => handleTimeChange((m.ut - (data.orbit?.epoch || 0)) + inc)}>+</button>
                  </div>
                </div>
              </div>

              <div style={{ padding: "10px", background: "rgba(0,0,0,0.5)", border: "1px solid #2a3a4a", borderRadius: 2 }}>
                 <InfoRow label="TOTAL ΔV" value={`${m.delta_v.toFixed(2)} m/s`} highlight />
                 <InfoRow label="EST. BURN" value={m.burn_time > 0 ? `${m.burn_time.toFixed(1)}s` : "---"} />
                 <div style={{ height: 1, background: "#2a3a4a", margin: "5px 0" }} />
                 <InfoRow label="POST Pe" value={m.post_orbit ? fmtAlt(m.post_orbit.periapsis_altitude) : "---"} />
                 <InfoRow label="POST Ap" value={m.post_orbit ? fmtAlt(m.post_orbit.apoapsis_altitude) : "---"} />
                 <div style={{ height: 1, background: "#2a3a4a", margin: "5px 0" }} />
                 <InfoRow label="ENCOUNTER" value={data.encounter?.body_name?.toUpperCase() || "NONE"} color={data.encounter ? "#fb0" : "#68a"} />
                 <InfoRow label="TARGET Pe" value={data.encounter ? fmtAlt(data.encounter.periapsis_altitude) : "---"} highlight={!!data.encounter} color={data.encounter ? "#4f6" : "#68a"} />
              </div>
            </div>
          </div>

          {/* Bottom action row */}
          <div style={{ display: "flex", gap: 6, marginTop: 15 }}>
            <button style={actBtn("#1a6a3c", "#4f6")} onClick={() => send({ type: "add_node", prograde: 0, normal: 0, radial: 0 })}>
              + ADD
            </button>
            <button style={actBtn("#1a4a5a", "#4af")} onClick={() => send({ type: "add_node_pe", prograde: 0, normal: 0, radial: 0 })}>
              @PE
            </button>
            <button style={actBtn("#1a4a5a", "#4af")} onClick={() => send({ type: "add_node_ap", prograde: 0, normal: 0, radial: 0 })}>
              @AP
            </button>
            <button style={actBtn("#5a4a1a", "#fb0")} onClick={() => send({ type: "circularize" })}>
              CIRC
            </button>
            <div style={{ flex: 1 }} />
            <button style={actBtn("#5a2a2a", "#f44")} onClick={() => send({ type: "remove_node", index: activeIdx })}>
              DEL
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── VecGroup ─────────────────────────────────────────────────────

function VecGroup({ label, color, val, set, inc, keyName }: {
  label: string; color: string; val: number; set: (v: number) => void;
  inc: number; keyName: string;
}) {
  const [localVal, setLocalVal] = useState(val.toString());
  
  useEffect(() => { setLocalVal(val.toFixed(2)); }, [val]);

  const commit = (v: number) => { set(v); };

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

function fmtMinSec(s: number): string {
  if (s < 0 || !isFinite(s)) return "---";
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  if (m > 0) return `${m} MIN ${rs} SEC`;
  return `${rs} SEC`;
}
