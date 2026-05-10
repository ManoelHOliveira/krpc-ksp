import { useEffect, useRef, useCallback, useState } from "react";
import type { ServerData, WsMessage } from "../types";

export function useKspConnection() {
  const [data, setData] = useState<ServerData>({ connected: false });
  const [bodyNames, setBodyNames] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      // Prevent multiple concurrent connections
      if (ws) ws.close();

      ws = new WebSocket("ws://127.0.0.1:8765");
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("%c[WS] Connected to KSP bridge server at ws://127.0.0.1:8765", "color: #4f6; font-weight: bold");
        send({ type: "get_body_names" });
      };

      ws.onmessage = (ev) => {
        try {
          const msg: WsMessage = JSON.parse(ev.data);
          // Only log a snippet or specific types to avoid flooding, or log a heartbeat
          if ("type" in msg && msg.type === "body_names") {
             console.log("[WS] Received body names:", msg.names);
             setBodyNames(msg.names);
             return;
          }
          
          // Log heartbeat every 5 seconds if connected
          if (msg.server_time && Math.floor(msg.server_time) % 5 === 0) {
            // console.debug("[WS] Telemetry heartbeat received", msg.vessel_name);
          }

          setData(msg as ServerData);
        } catch (err) {
          console.error("%c[WS] Failed to parse message from server:", "color: #f46", err, ev.data);
        }
      };

      ws.onclose = (ev) => {
        console.warn(`%c[WS] Connection closed (code: ${ev.code}, reason: ${ev.reason || "none"}), retrying in 2s...`, "color: #fb0");
        setData(prev => ({ ...prev, connected: false }));
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error("%c[WS] WebSocket error:", "color: #f46", err);
        ws?.close();
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      if (ws) ws.close();
    };
  }, [send]);

  return { data, bodyNames, send };
}
