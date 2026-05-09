import { useRef } from "react";
import { useKspConnection } from "./hooks/useKspConnection";
import TopBar from "./components/TopBar";
import OrbitMap, { type OrbitMapHandle } from "./components/OrbitMap";
import ManeuverPanel from "./components/ManeuverPanel";
import StatusBar from "./components/StatusBar";

export default function App() {
  const { data, bodyNames, send } = useKspConnection();
  const mapRef = useRef<OrbitMapHandle>(null);

  return (
    <div style={rootStyle}>
      <TopBar
        data={data}
        bodyNames={bodyNames}
        send={send}
        onFit={() => mapRef.current?.autoFit()}
        onReset={() => mapRef.current?.autoFit()}
      />
      <div style={mainStyle}>
        <div style={mapStyle}>
          <OrbitMap ref={mapRef} data={data} send={send} />
        </div>
        <div style={panelStyle}>
          <ManeuverPanel data={data} send={send} />
        </div>
      </div>
      <StatusBar data={data} />
    </div>
  );
}

const rootStyle: React.CSSProperties = {
  display: "flex", flexDirection: "column", width: "100%", height: "100%",
  background: "#08081a", color: "#fff",
};

const mainStyle: React.CSSProperties = {
  display: "flex", flex: 1, overflow: "hidden",
};

const mapStyle: React.CSSProperties = {
  flex: "1 1 0", minWidth: 0, position: "relative", overflow: "hidden",
};

const panelStyle: React.CSSProperties = {
  flex: "0 0 280px", overflow: "hidden",
  borderLeft: "1px solid rgba(255,255,255,0.06)", minWidth: 240,
};
