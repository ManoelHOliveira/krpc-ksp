import { useMemo } from "react";
import type { ServerData } from "../types";

interface Props {
  data: ServerData;
  bodyNames: string[];
  send: (msg: object) => void;
  onFit: () => void;
  onReset: () => void;
}

export default function TopBar({ data, bodyNames, send, onFit, onReset }: Props) {
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
      <span style={{ color: data.connected ? "#44ffaa" : "#ff4466", fontSize: 10 }}>●</span>
      <span style={{ color: "rgba(180,200,180,0.7)", fontSize: 10, fontWeight: 600 }}>
        {data.connected ? "KSP" : "OFF"}
      </span>

      {data.connected && (
        <>
          <span style={{ color: "#44ffaa", fontSize: 10, fontWeight: 700, marginLeft: 10 }}>
            {data.vessel_name}
          </span>

          <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.1)", margin: "0 6px" }} />

          <select style={selStyle}
            value={data.target?.name || "none"}
            onChange={e => send({ type: "set_target", name: e.target.value === "none" ? null : e.target.value })}>
            <option value="none" style={optStyle}>-- target --</option>
            {sorted.map(n => <option key={n} value={n} style={optStyle}>{n}</option>)}
          </select>

          <button style={btnStyle} onClick={onFit} title="Ajustar zoom">Fit</button>
          <button style={btnStyle} onClick={onReset} title="Resetar zoom">Reset</button>
        </>
      )}
    </div>
  );
}

const barStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 4, padding: "2px 10px",
  background: "#0a0a14", height: 28,
  borderBottom: "1px solid rgba(255,255,255,0.06)",
};

const selStyle: React.CSSProperties = {
  height: 20, minWidth: 110, background: "#1a1a2a", color: "#ccc",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3,
  fontSize: 10, padding: "0 4px", outline: "none", cursor: "pointer",
};

const optStyle: React.CSSProperties = {
  background: "#1a1a2a", color: "#ddd",
};

const btnStyle: React.CSSProperties = {
  height: 20, background: "rgba(255,255,255,0.05)", color: "#bbb",
  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 3,
  cursor: "pointer", fontSize: 9, padding: "0 8px",
  display: "flex", alignItems: "center",
};
