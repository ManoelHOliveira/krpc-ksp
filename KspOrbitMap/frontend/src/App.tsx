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
      background: "#000", 
      color: "#0f0", display: "flex", flexDirection: "column", overflow: "hidden",
      border: "2px solid #040"
    }}>
      <TopBar data={data} bodyNames={bodyNames} send={send} />

      <div style={{ 
        flex: 1, position: "relative", overflow: "hidden",
        borderBottom: "1px solid #040"
      }}>
        {/* The Authentic Radar Map */}
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}>
          <OrbitMap data={data} send={send} />
        </div>

        {/* Terminal Style Planner - Floating on right or center */}
        <div style={{ 
          position: "absolute", top: "20px", right: "20px",
          zIndex: 10, width: "100%", maxWidth: "400px"
        }}>
          <div style={{ 
            background: "rgba(0, 10, 0, 0.85)", 
            border: "1px solid #0f0", 
            padding: "2px", 
            boxShadow: "0 0 15px rgba(0,255,0,0.2)",
            position: "relative"
          }}>
            {/* Terminal Header */}
            <div style={{ background: "#0f0", color: "#000", padding: "2px 8px", fontSize: "10px", fontWeight: "bold", fontFamily: "Orbitron" }}>
              COMMAND_PLANNER_V2.0
            </div>
            
            <div style={{ padding: "10px", border: "1px solid #040" }}>
              <ManeuverBar data={data} send={send} />
            </div>
          </div>
        </div>
      </div>

      <StatusBar data={data} />
    </div>
  );
}
