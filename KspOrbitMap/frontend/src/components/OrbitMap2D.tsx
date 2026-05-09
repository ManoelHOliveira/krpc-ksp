import { useRef, useEffect } from "react";
import type { ServerData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

const OrbitMap2D = ({ data }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.orbit) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas size setup
    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = canvas.parentElement?.clientHeight || 800;

    // Clear
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const scale = 0.00015;

    const drawOrbit = (orbit: any, color: string, width: number) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath();
        for (let i = 0; i <= 128; i++) {
            const th = (2 * Math.PI * i) / 128;
            const r = (orbit.semi_major_axis * (1 - orbit.eccentricity ** 2)) / (1 + orbit.eccentricity * Math.cos(th));
            const x = r * Math.cos(th) * scale;
            const y = r * Math.sin(th) * scale;
            if (i === 0) ctx.moveTo(cx + x, cy + y);
            else ctx.lineTo(cx + x, cy + y);
        }
        ctx.stroke();
    };

    // 1. Draw Central Planet (White circle)
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const planetRadius = Math.max(data.orbit.body_radius * scale, 10);
    ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2);
    ctx.stroke();

    // 2. Draw Vessel Orbit
    drawOrbit(data.orbit, "#0f0", 2);

    // 3. Draw Target Orbit
    if (data.target?.orbit) {
        drawOrbit(data.target.orbit, "#ff0", 1);
    }

    // 4. Draw Maneuver Node and Trajectory
    if (data.maneuver) {
        // Draw blue trajectory if available
        if (data.maneuver.post_orbit) {
            drawOrbit(data.maneuver.post_orbit, "#00f", 2);
        }

        const mTh = data.maneuver.true_anomaly;
        const mr = (data.orbit.semi_major_axis * (1 - data.orbit.eccentricity ** 2)) / (1 + data.orbit.eccentricity * Math.cos(mTh));
        const mx = mr * Math.cos(mTh) * scale;
        const my = mr * Math.sin(mTh) * scale;
        ctx.fillStyle = "#0ff";
        ctx.beginPath();
        ctx.arc(cx + mx, cy + my, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // 5. Draw Vessel
    ctx.fillStyle = "#f00";
    const vx = data.orbit.semi_major_axis * Math.cos(data.orbit.true_anomaly) * scale;
    const vy = data.orbit.semi_major_axis * Math.sin(data.orbit.true_anomaly) * scale;
    ctx.beginPath();
    ctx.arc(cx + vx, cy + vy, 5, 0, Math.PI * 2);
    ctx.fill();

  }, [data]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />;
};

export default OrbitMap2D;
