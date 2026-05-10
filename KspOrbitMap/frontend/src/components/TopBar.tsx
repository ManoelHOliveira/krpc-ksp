import { useMemo, useState, useEffect } from "react";
import type { ServerData } from "../types";

interface Props {
  data: ServerData;
  bodyNames: string[];
  send: (msg: object) => void;
}

export default function TopBar({ data, bodyNames, send }: Props) {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    if (!data.server_time) return;
    setIsStale(false);
    
    // If we don't get new data for 2 seconds, consider it stale
    const timer = setTimeout(() => setIsStale(true), 2000);
    return () => clearTimeout(timer);
  }, [data.server_time]);

  const sorted = useMemo(() => {
    if (!data.soi_bodies || data.soi_bodies.length === 0) return bodyNames;
    const order = data.soi_bodies.map(sb => sb.name);
    const inOrder = bodyNames.filter(n => order.includes(n));
    inOrder.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    const rest = bodyNames.filter(n => !order.includes(n));
    return [...inOrder, ...rest];
  }, [bodyNames, data.soi_bodies]);

  return (
    <div style={barStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: data.connected ? "#4f6" : "#f46",
          boxShadow: data.connected ? "0 0 10px #4f6" : "0 0 10px #f46"
        }} />
        <span style={{ 
          color: data.connected ? "#4f6" : "#f46", 
          fontSize: 10, fontWeight: 700, 
          fontFamily: "Orbitron, sans-serif",
          letterSpacing: 1
        }}>
          {data.connected ? (isStale ? "TELEMETRY STALLED" : "LINK ESTABLISHED") : (data.error ? "BRIDGE ERROR" : "NO CONNECTION")}
        </span>
        {isStale && (
          <span style={{ color: "#fb0", fontSize: 9, fontFamily: "Share Tech Mono", marginLeft: 10, animation: "blink 1s infinite" }}>
            WARNING: DATA STALE (CHECK SERVER)
          </span>
        )}
        {data.error && (
          <span style={{ color: "#f44", fontSize: 9, fontFamily: "Share Tech Mono", marginLeft: 10 }}>
            ERR: {data.error}
          </span>
        )}
      </div>

      {data.connected && (
        <>
          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.1)", margin: "0 10px" }} />
          
          <span style={{ 
            color: "#4af", fontSize: 11, fontWeight: 700, 
            fontFamily: "Orbitron, sans-serif",
            textShadow: "0 0 5px rgba(68,170,255,0.5)"
          }}>
            {data.vessel_name?.toUpperCase()}
          </span>

          <div style={{ flex: 1 }} />

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, color: "#68a", fontWeight: 700, fontFamily: "Orbitron" }}>TARGET:</span>
            <select style={selStyle}
              value={data.target?.name || "none"}
              onChange={e => send({ type: "set_target", target: e.target.value === "none" ? null : e.target.value })}>
              <option value="none" style={optStyle}>-- SELECIONAR --</option>
              {sorted.map(n => <option key={n} value={n} style={optStyle}>{n}</option>)}
            </select>

            <button style={btnStyle} onClick={() => send({ type: "set_target", target: null })}>LIMPAR ALVO</button>
            <button style={btnStyle} onClick={() => send({ type: "remove_node" })}>RESETAR MANOBRA</button>
          </div>
        </>
      )}
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "0 15px",
  background: "linear-gradient(to bottom, #161b22, #0d1117)",
  height: 36,
  borderBottom: "2px solid #2a3a4a",
  boxShadow: "0 2px 10px rgba(0,0,0,0.3)"
};

const selStyle: React.CSSProperties = {
  height: 24, minWidth: 140, background: "#080c12", color: "#4af",
  border: "1px solid #2a3a4a", borderRadius: 2,
  fontSize: 10, padding: "0 6px", outline: "none", cursor: "pointer",
  fontFamily: "Share Tech Mono, monospace",
  textTransform: "uppercase"
};

const optStyle: React.CSSProperties = {
  background: "#080c12", color: "#4af",
};

const btnStyle: React.CSSProperties = {
  height: 24, background: "rgba(68,136,255,0.05)", color: "#8ab",
  border: "1px solid #2a3a4a", borderRadius: 2,
  cursor: "pointer", fontSize: 9, padding: "0 12px",
  fontFamily: "Orbitron, sans-serif",
  fontWeight: 600,
  transition: "all 0.2s",
  display: "flex", alignItems: "center",
};
