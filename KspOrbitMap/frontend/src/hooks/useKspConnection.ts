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
        console.log("Connected to KSP bridge server at ws://127.0.0.1:8765");
        send({ type: "get_body_names" });
      };

      ws.onmessage = (ev) => {
        try {
          const msg: WsMessage = JSON.parse(ev.data);
          if ("type" in msg && msg.type === "body_names") {
            setBodyNames(msg.names);
            return;
          }
          setData(msg as ServerData);
        } catch (err) {
          console.error("Failed to parse message from server:", err);
        }
      };

      ws.onclose = (ev) => {
        console.warn(`Connection closed (code: ${ev.code}, reason: ${ev.reason}), retrying in 2s...`);
        setData(prev => ({ ...prev, connected: false }));
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
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
