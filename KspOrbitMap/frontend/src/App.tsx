import { useKspConnection } from "./hooks/useKspConnection";
import TopBar from "./components/TopBar";
import OrbitMap2D from "./components/OrbitMap2D";
import ManeuverBar from "./components/ManeuverBar";
import StatusBar from "./components/StatusBar";
import { Rnd } from "react-rnd";

export default function App() {
  const { data, bodyNames, send } = useKspConnection();

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", position: "relative", overflow: "hidden" }}>
      {/* Background Full Viewport Map */}
      <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
        <OrbitMap2D data={data} send={send} />
      </div>

      {/* Floating UI Elements */}
      <div style={{ position: "relative", zIndex: 1, padding: "10px", pointerEvents: "none" }}>
        <div style={{ pointerEvents: "auto" }}>
            <TopBar data={data} bodyNames={bodyNames} send={send} />
        </div>
      </div>

      <Rnd 
        default={{ x: 50, y: 100, width: 350, height: 250 }} 
        bounds="window" 
        style={{ zIndex: 2, background: "#1a1a2e", border: "1px solid #444", borderRadius: "8px", padding: "10px", pointerEvents: "auto" }}
      >
        <ManeuverBar data={data} send={send} />
      </Rnd>

      <div style={{ position: "absolute", bottom: 0, width: "100%", zIndex: 3 }}>
        <StatusBar data={data} />
      </div>
    </div>
  );
}
