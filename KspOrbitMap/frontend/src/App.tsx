import { useRef } from "react";
import { useKspConnection } from "./hooks/useKspConnection";
import TopBar from "./components/TopBar";
import OrbitMap, { type OrbitMapHandle } from "./components/OrbitMap";
import ManeuverBar from "./components/ManeuverBar";
import StatusBar from "./components/StatusBar";

export default function App() {
  const { data, bodyNames, send } = useKspConnection();
  const mapRef = useRef<OrbitMapHandle>(null);

  return (
    <div style={rootStyle}>
      <TopBar data={data} bodyNames={bodyNames} send={send}
        onFit={() => mapRef.current?.autoFit()}
        onReset={() => mapRef.current?.autoFit()} />
      <div style={mapStyle}>
        <OrbitMap ref={mapRef} data={data} send={send} />
      </div>
      <ManeuverBar data={data} send={send} />
      <StatusBar data={data} />
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", width: "100%", height: "100%",
  background: "#08081a", color: "#fff", overflow: "hidden",
};

const mapStyle: React.CSSProperties = {
  flex: "1 1 0", minHeight: 0, position: "relative", overflow: "hidden",
};
