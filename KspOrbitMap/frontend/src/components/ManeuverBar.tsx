import { useState, useEffect } from "react";
import type { ServerData, ManeuverData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

const STEPS = [0.01, 0.1, 1, 5, 10, 100];
const NODE_COLORS = ["#0f0", "#0cf", "#f0f", "#ff0", "#fff", "#f44"];

export default function ManeuverBar({ data, send }: Props) {
  const [inc, setInc] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const maneuvers = data.maneuvers || [];
  const m = maneuvers[activeIdx] || null;

  useEffect(() => {
    if (maneuvers.length > 0 && activeIdx >= maneuvers.length) setActiveIdx(maneuvers.length - 1);
  }, [maneuvers.length, activeIdx]);

  const sendM = (key: string, val: number) => send({ type: "set_maneuver", index: activeIdx, [key]: val });
  const handleTimeChange = (v: number) => send({ type: "set_node_time", index: activeIdx, time: v });

  return (
    <div style={{ userSelect: "none" }}>
      <style>{styleTag}</style>
      
      {/* Node Selector Tab */}
      <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
        {maneuvers.length === 0 ? (
          <div style={{ fontSize: "10px", color: "#080" }}>[ SYSTEM_IDLE ]</div>
        ) : (
          maneuvers.map((_, i) => (
            <button key={i} onClick={() => setActiveIdx(i)}
              style={{
                background: activeIdx === i ? "#0f0" : "#000",
                color: activeIdx === i ? "#000" : "#0f0",
                border: "1px solid #0f0",
                padding: "2px 8px", fontSize: "10px", cursor: "pointer",
                fontFamily: "monospace"
              }}>NODE_0{i + 1}</button>
          ))
        )}
      </div>

      {!m ? (
        <div style={{ padding: "10px", border: "1px dashed #080" }}>
          <div style={{ fontSize: "11px", color: "#0f0", marginBottom: 10 }}>NO_MANEUVER_DATA_FOUND</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <button className="term-btn" onClick={() => send({ type: "add_node" })}>EXEC:ADD_NODE</button>
            <button className="term-btn" onClick={() => send({ type: "add_node_pe" })}>EXEC:ADD_AT_PE</button>
            <button className="term-btn" onClick={() => send({ type: "add_node_ap" })}>EXEC:ADD_AT_AP</button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {/* Left: Vectors */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <TermVec label="PROG" val={m.prograde} inc={inc} onChange={v => sendM("prograde", v)} />
              <TermVec label="NORM" val={m.normal} inc={inc} onChange={v => sendM("normal", v)} />
              <TermVec label="RADI" val={m.radial} inc={inc} onChange={v => sendM("radial", v)} />
              
              <div style={{ marginTop: 5 }}>
                <div style={{ fontSize: "9px", color: "#080", marginBottom: 2 }}>PRECISION_STEP</div>
                <div style={{ display: "flex", gap: 2 }}>
                  {STEPS.map(v => (
                    <button key={v} onClick={() => setInc(v)}
                      style={{
                        background: v === inc ? "#0f0" : "#000",
                        color: v === inc ? "#000" : "#0f0",
                        border: "1px solid #0f0",
                        flex: 1, fontSize: "9px", cursor: "pointer"
                      }}>{v}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Time and Telemetry */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ border: "1px solid #040", padding: "5px" }}>
                <div style={{ fontSize: "9px", color: "#080", marginBottom: 2 }}>T_MINUS_ENCOUNTER</div>
                <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                  <button className="term-btn-small" onClick={() => handleTimeChange(Math.max(0, (m.ut - (data.orbit?.epoch || 0)) - inc))}>-</button>
                  <div style={{ flex: 1, textAlign: "center", fontSize: "14px", fontFamily: "monospace", color: "#0f0" }}>
                    {(m.ut - (data.orbit?.epoch || 0)).toFixed(1)}s
                  </div>
                  <button className="term-btn-small" onClick={() => handleTimeChange((m.ut - (data.orbit?.epoch || 0)) + inc)}>+</button>
                </div>
                <div style={{ fontSize: "9px", textAlign: "center", color: "#080", marginTop: 2 }}>
                  {fmtMinSec(m.ut - (data.orbit?.epoch || 0))}
                </div>
              </div>

              <div style={{ border: "1px solid #040", padding: "5px", fontSize: "10px", display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#080" }}>TOTAL_DV:</span>
                  <span>{m.delta_v.toFixed(2)}m/s</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#080" }}>BURN_TIME:</span>
                  <span>{m.burn_time.toFixed(1)}s</span>
                </div>
                <div style={{ height: "1px", background: "#040", margin: "2px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#080" }}>TARGET_PE:</span>
                  <span style={{ color: data.encounter ? "#0f0" : "#68a" }}>
                    {data.encounter ? fmtAlt(data.encounter.periapsis_altitude) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 5 }}>
            <button className="term-btn" style={{ flex: 1 }} onClick={() => send({ type: "add_node" })}>+ADD_NODE</button>
            <button className="term-btn" style={{ flex: 1 }} onClick={() => send({ type: "circularize" })}>CIRCULARIZE</button>
            <button className="term-btn" style={{ flex: 1, borderColor: "#f00", color: "#f00" }} 
              onClick={() => send({ type: "remove_node", index: activeIdx })}>DELETE_NODE</button>
          </div>
        </div>
      )}
    </div>
  );
}

function TermVec({ label, val, inc, onChange }: { label: string, val: number, inc: number, onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #040", padding: "2px 4px" }}>
      <span style={{ fontSize: "9px", color: "#080", width: "30px" }}>{label}</span>
      <button className="term-btn-small" onClick={() => onChange(val - inc)}>-</button>
      <div className="glow-text" style={{ flex: 1, textAlign: "center", fontSize: "11px", fontWeight: "bold" }}>
        {val >= 0 ? "+" : ""}{val.toFixed(2)}
      </div>
      <button className="term-btn-small" onClick={() => onChange(val + inc)}>+</button>
    </div>
  );
}

const styleTag = `
  .term-btn {
    background: #000;
    color: #0f0;
    border: 1px solid #0f0;
    padding: 4px 8px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    cursor: pointer;
    text-transform: uppercase;
    transition: all 0.1s;
  }
  .term-btn:hover {
    background: #0f0;
    color: #000;
    box-shadow: 0 0 10px rgba(0,255,0,0.5);
  }
  .term-btn-small {
    background: #000;
    color: #0f0;
    border: 1px solid #040;
    width: 18px;
    height: 18px;
    font-family: monospace;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .term-btn-small:hover {
    border-color: #0f0;
    color: #fff;
  }
`;

function fmtAlt(m: number): string {
  if (m < 0) return "NIL";
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)}Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m.toFixed(0)}m`;
}

function fmtMinSec(s: number): string {
  if (s < 0 || !isFinite(s)) return "NIL";
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  return `${m}m ${rs}s`;
}
