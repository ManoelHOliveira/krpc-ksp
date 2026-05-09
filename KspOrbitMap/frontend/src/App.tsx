import { useKspConnection } from "./hooks/useKspConnection";
import TopBar from "./components/TopBar";
import ManeuverBar from "./components/ManeuverBar";
import StatusBar from "./components/StatusBar";

export default function App() {
  const { data, bodyNames, send } = useKspConnection();

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000", color: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <TopBar data={data} bodyNames={bodyNames} send={send} />

      <div style={{ flex: 1, padding: "20px", display: "flex", justifyContent: "center", alignItems: "flex-start" }}>
        <div style={{ background: "#1a1a2e", border: "1px solid #444", borderRadius: "8px", padding: "20px", width: "100%", maxWidth: "500px" }}>
            <ManeuverBar data={data} send={send} />
        </div>
      </div>

      <StatusBar data={data} />
    </div>
  );
}
