import { useKspConnection } from "./hooks/useKspConnection";
import TopBar from "./components/TopBar";
import ManeuverBar from "./components/ManeuverBar";
import StatusBar from "./components/StatusBar";
import OrbitMap from "./components/OrbitMap";

export default function App() {
  const { data, bodyNames, send } = useKspConnection();

  return (
    <div style={{ 
      width: "100vw", height: "100vh", 
      background: "radial-gradient(circle at center, #101620 0%, #05080c 100%)", 
      color: "#e0e0e0", display: "flex", flexDirection: "column", overflow: "hidden" 
    }}>
      <TopBar data={data} bodyNames={bodyNames} send={send} />

      <div style={{ 
        flex: 1, position: "relative", overflow: "hidden" 
      }}>
        {/* The 2D Orbit Map background */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
          <OrbitMap data={data} send={send} />
        </div>

        {/* Floating Maneuver Bar */}
        <div style={{ 
          position: "absolute", bottom: "40px", left: "50%", transform: "translateX(-50%)",
          zIndex: 10, width: "100%", maxWidth: "600px"
        }}>
          <div style={{ 
            background: "rgba(13, 17, 23, 0.9)", 
            border: "2px solid #2a3a4a", 
            borderRadius: "4px", 
            padding: "2px", 
            boxShadow: "0 0 30px rgba(0,0,0,0.5), inset 0 0 10px rgba(68,136,255,0.1)",
            position: "relative"
          }}>
            {/* Decorative corners */}
            <div style={{ position: "absolute", top: -2, left: -2, width: 20, height: 20, borderTop: "2px solid #4af", borderLeft: "2px solid #4af" }} />
            <div style={{ position: "absolute", top: -2, right: -2, width: 20, height: 20, borderTop: "2px solid #4af", borderRight: "2px solid #4af" }} />
            <div style={{ position: "absolute", bottom: -2, left: -2, width: 20, height: 20, borderBottom: "2px solid #4af", borderLeft: "2px solid #4af" }} />
            <div style={{ position: "absolute", bottom: -2, right: -2, width: 20, height: 20, borderBottom: "2px solid #4af", borderRight: "2px solid #4af" }} />
            
            <div style={{ padding: "16px", border: "1px solid #1a2a3a" }}>
              <ManeuverBar data={data} send={send} />
            </div>
          </div>
        </div>
      </div>

      <StatusBar data={data} />
    </div>
  );
}
