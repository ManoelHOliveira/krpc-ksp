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
    const timer = setTimeout(() => setIsStale(true), 2000);
    return () => clearTimeout(timer);
  }, [data.server_time]);

  const bodyList = useMemo(() => {
    if (data.soi_bodies && data.soi_bodies.length > 0) {
      return data.soi_bodies.map(b => b.name);
    }
    const list = [...bodyNames];
    list.sort();
    return list;
  }, [data.soi_bodies, bodyNames]);

  return (
    <div style={barStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 10, height: 10, 
          background: data.connected ? "#0f0" : "#f00",
          boxShadow: data.connected ? "0 0 8px #0f0" : "0 0 8px #f00"
        }} />
        <span className="glow-text" style={{ 
          color: data.connected ? "#0f0" : "#f00", 
          fontSize: 12, fontWeight: 700, 
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 2
        }}>
          [{data.connected ? (isStale ? "STALLED" : "ONLINE") : (data.error ? "ERROR" : "OFFLINE")}]
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {data.connected && (
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <span className="glow-text" style={{ fontSize: 12, color: "#0f0" }}>
            VESSEL::{data.vessel_name?.toUpperCase().replace(/\s+/g, "_")}
          </span>
          
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: "#080" }}>TARGET_BODY:</span>
            <select style={selStyle}
              value={data.target?.name || "none"}
              onChange={e => send({ type: "set_target", target: e.target.value === "none" ? null : e.target.value })}>
              <option value="none">-- NIL --</option>
              {bodyList.map(n => <option key={n} value={n}>{n.toUpperCase()}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", padding: "0 20px",
  background: "#000",
  height: 40,
  borderBottom: "1px solid #040",
};

const selStyle: React.CSSProperties = {
  height: 24, minWidth: 120, background: "#000", color: "#0f0",
  border: "1px solid #0f0", borderRadius: 0,
  fontSize: 11, padding: "0 6px", outline: "none", cursor: "pointer",
  fontFamily: "'JetBrains Mono', monospace",
  textTransform: "uppercase"
};
