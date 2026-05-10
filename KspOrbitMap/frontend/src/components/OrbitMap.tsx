import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import type { ServerData, OrbitData, SoiBodyData, PostOrbitData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

export interface OrbitMapHandle {
  autoFit: () => void;
}

const ORBIT_COLOR = "#00ff88";
const POST_COLOR = "#4af"; 
const TARGET_COLOR = "#ffdd44";
const NODE_COLORS = ["#4af", "#f0f", "#0ff", "#ff0", "#4f6", "#f44"];

const OrbitMap = forwardRef<OrbitMapHandle, Props>(({ data, send }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panning = useRef(false);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const mouseOnNodeIdx = useRef<number | null>(null);
  const nodePositions = useRef<{ x: number; y: number }[]>([]);

  const autoFit = useCallback(() => {
    if (!data.orbit || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const maxDist = Math.max(data.orbit.apoapsis, data.orbit.periapsis);
    const drawR = Math.min(canvas.width, canvas.height) * 0.42;
    const z = drawR / maxDist;
    setZoom(Math.max(0.005, Math.min(500, z)));
    setPan({ x: 0, y: 0 });
  }, [data.orbit]);

  useImperativeHandle(ref, () => ({ autoFit }), [autoFit]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#05080c";
    ctx.fillRect(0, 0, W, H);

    const { orbit, maneuvers, target, soi_bodies, connected, encounter, ut } = data;
    if (!connected || !orbit || ut == null) {
      ctx.fillStyle = "#2a3a4a";
      ctx.font = "bold 14px Orbitron, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("WAITING FOR TELEMETRY LINK...", W / 2, H / 2);
      return;
    }

    const bodyR = orbit.body_radius;
    let maxDist = Math.max(orbit.apoapsis, orbit.periapsis);
    if (target) {
      const ta = target.orbit.semi_major_axis;
      const te = target.orbit.eccentricity;
      const td = Math.max(ta * (1 + te), ta * (1 - te));
      if (td > maxDist) maxDist = td;
    }
    if (maxDist < bodyR * 4) maxDist = bodyR * 4;

    const drawR = Math.min(W, H) * 0.42;
    const pxScale = (drawR / maxDist) * zoom;
    const cx = W / 2 + pan.x;
    const cy = H / 2 + pan.y;

    const toScreen = (vec: { x: number; y: number }, origin = { x: cx, y: cy }) => ({
      x: origin.x + vec.x * pxScale,
      y: origin.y - vec.y * pxScale // Invert Y for canvas
    });

    // ─── Grid ─────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(68,136,255,0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const rr = drawR * (i / 5) * zoom;
      ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr, 0, 0, Math.PI * 2); ctx.stroke();
      
      // FIX: Grid labels show ALTITUDE (dist - body_radius)
      const dist = maxDist * (i / 5);
      const alt = dist - bodyR;
      const label = alt > 0 ? fmtDistShort(alt) : fmtDistShort(dist);
      
      ctx.fillStyle = "rgba(104,170,170,0.4)";
      ctx.font = "bold 9px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, cx + rr + 4, cy + 3);
    }

    // ─── SOI Bodies (Planets) ──────────────────────────────────────
    if (soi_bodies) for (const sb of soi_bodies) {
      const isTarget = target && sb.name === target.name;
      const isEncounter = encounter && encounter.body_name === sb.name;
      if (!isTarget && !isEncounter) continue;

      let sp;
      if (sb.orbit) {
        const bodyPos = getPosAtUt(sb.orbit, ut);
        sp = toScreen(bodyPos);
      } else {
        sp = toScreen({ x: sb.pos_x, y: sb.pos_z }); // KSP X-Z plane
      }
      
      const sr = sb.soi_radius * pxScale;
      if (sr > 4 && sr < 5000) {
        ctx.strokeStyle = "rgba(60,120,180,0.3)";
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.ellipse(sp.x, sp.y, sr, sr, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = "rgba(68,170,255,0.6)";
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(104,170,170,0.8)";
      ctx.font = "bold 9px 'Orbitron'";
      ctx.textAlign = "left";
      ctx.fillText(sb.name.toUpperCase(), sp.x + 6, sp.y - 8);

      if (isTarget) {
        ctx.strokeStyle = TARGET_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // ─── Orbits ───────────────────────────────────────────────────
    if (target) {
      const tp = makeOrbitPts(target.orbit, 128);
      ctx.strokeStyle = "rgba(255,221,68,0.4)";
      ctx.lineWidth = 1.0;
      drawPath(ctx, tp, toScreen);
    }

    const vpts = makeOrbitPts(orbit, 128);
    ctx.strokeStyle = ORBIT_COLOR;
    ctx.lineWidth = 1.5;
    drawPath(ctx, vpts, toScreen);

    // ─── Maneuvers ────────────────────────────────────────────────
    if (maneuvers) {
      maneuvers.forEach((m, idx) => {
        if (!m.post_orbit) return;
        const color = NODE_COLORS[idx % NODE_COLORS.length];
        const hasTransition = !!(m.post_orbit.transition_ut && m.post_orbit.next_orbit);
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);

        if (hasTransition) {
          const pts1 = makeOrbitPts(m.post_orbit as any, 128, m.ut, m.post_orbit.transition_ut!);
          drawPath(ctx, pts1, toScreen);
          
          const next = m.post_orbit.next_orbit!;
          const tut = m.post_orbit.transition_ut!;
          const targetBody = soi_bodies?.find(b => b.name === next.body_name);
          if (targetBody && targetBody.orbit) {
            const ghostPos = getPosAtUt(targetBody.orbit, tut);
            const ghostScreen = toScreen(ghostPos);

            // Ghost Body
            ctx.strokeStyle = "rgba(255,255,255,0.3)";
            ctx.setLineDash([2, 2]);
            ctx.beginPath(); ctx.arc(ghostScreen.x, ghostScreen.y, 4, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.font = "italic 8px Orbitron";
            ctx.fillText(`${targetBody.name.toUpperCase()} (ENCOUNTER)`, ghostScreen.x + 8, ghostScreen.y - 8);

            // Bending Path
            ctx.strokeStyle = color;
            ctx.setLineDash([5, 4]);
            const pts2 = makeOrbitPts(next as any, 64, tut, tut + 3600);
            drawPath(ctx, pts2, (v) => toScreen(v, ghostScreen));

            // Target Pe
            const pePos = getPosAtTrueAnomaly(next as any, 0);
            const peScreen = toScreen(pePos, ghostScreen);
            ctx.fillStyle = "#fb0";
            ctx.beginPath(); ctx.arc(peScreen.x, peScreen.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.font = "bold 9px 'Share Tech Mono'";
            ctx.fillText(`TARGET Pe: ${fmtAlt(next.periapsis_altitude)}`, peScreen.x + 8, peScreen.y + 3);
          }
        } else {
          const ptsFull = makeOrbitPts(m.post_orbit as any, 128);
          drawPath(ctx, ptsFull, toScreen);
        }
        ctx.setLineDash([]);
      });
    }

    // ─── Central Body ─────────────────────────────────────────────
    let pr = bodyR * pxScale;
    if (!isFinite(pr) || pr < 5) pr = 5;
    
    if (isFinite(cx) && isFinite(cy)) {
      try {
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr);
        grad.addColorStop(0, "rgba(68,136,255,0.2)");
        grad.addColorStop(1, "rgba(68,136,255,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, pr * 2, 0, Math.PI * 2); ctx.fill();
      } catch (e) {
        console.warn("Gradient failed:", e);
      }
    }
    
    ctx.strokeStyle = "rgba(68,170,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 10px Orbitron";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(orbit.body_name.toUpperCase(), cx, cy);
    ctx.textBaseline = "alphabetic";

    // ─── Vessel ───────────────────────────────────────────────────
    const vPos = getPosAtUt(orbit, ut);
    const vp = toScreen(vPos);
    ctx.fillStyle = "#4f6";
    ctx.shadowBlur = 10; ctx.shadowColor = "#4f6";
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y - 8); ctx.lineTo(vp.x - 5, vp.y + 5); ctx.lineTo(vp.x + 5, vp.y + 5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();

    // ─── Pe / Ap ──────────────────────────────────────────────────
    const pePos = getPosAtTrueAnomaly(orbit, 0);
    const apPos = getPosAtTrueAnomaly(orbit, Math.PI);
    const peS = toScreen(pePos);
    const apS = toScreen(apPos);
    ctx.fillStyle = ORBIT_COLOR;
    ctx.font = "bold 9px 'Share Tech Mono'";
    ctx.textAlign = "left";
    if (peS.x > 0) {
      ctx.strokeStyle = ORBIT_COLOR; ctx.beginPath(); ctx.arc(peS.x, peS.y, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillText(`Pe: ${fmtAlt(orbit.periapsis_altitude)}`, peS.x + 8, peS.y + 3);
    }
    if (apS.x > 0) {
      ctx.strokeStyle = ORBIT_COLOR; ctx.beginPath(); ctx.arc(apS.x, apS.y, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillText(`Ap: ${fmtAlt(orbit.apoapsis_altitude)}`, apS.x + 8, apS.y + 3);
    }

    // ─── Node Icons ───────────────────────────────────────────────
    nodePositions.current = [];
    if (maneuvers) {
      maneuvers.forEach((m, idx) => {
        const nPos = getPosAtUt(orbit, m.ut);
        const np = toScreen(nPos);
        nodePositions.current.push(np);
        const col = mouseOnNodeIdx.current === idx ? "#fff" : NODE_COLORS[idx % NODE_COLORS.length];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(np.x, np.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.stroke();
        ctx.fillText(`${idx + 1}`, np.x + 10, np.y + 3);
      });
    }
  }, [data, zoom, pan]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const parent = canvas.parentElement!;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const f = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom(prevZoom => {
        const newZoom = Math.max(0.005, Math.min(500, prevZoom * f));
        const worldX = (mx - (canvas.width / 2 + pan.x)) / prevZoom;
        const worldY = (my - (canvas.height / 2 + pan.y)) / prevZoom;
        const newPanX = mx - (canvas.width / 2) - worldX * newZoom;
        const newPanY = my - (canvas.height / 2) - worldY * newZoom;
        setPan({ x: newPanX, y: newPanY });
        return newZoom;
      });
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, [pan.x, pan.y]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const mx = e.nativeEvent.offsetX, my = e.nativeEvent.offsetY;
    let clickedNodeIdx = -1;
    nodePositions.current.forEach((pos, idx) => {
      const dx = mx - pos.x, dy = my - pos.y;
      if (dx * dx + dy * dy < 100) clickedNodeIdx = idx;
    });
    if (clickedNodeIdx !== -1) {
      dragging.current = true;
      mouseOnNodeIdx.current = clickedNodeIdx;
      lastMouse.current = { x: mx, y: my };
      return;
    }
    panning.current = true;
    lastMouse.current = { x: mx, y: my };
  }, [data.maneuvers]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const mx = e.nativeEvent.offsetX, my = e.nativeEvent.offsetY;
    if (dragging.current && mouseOnNodeIdx.current !== null && data.maneuvers) {
      const idx = mouseOnNodeIdx.current;
      const node = data.maneuvers[idx];
      const dx = mx - lastMouse.current.x, dy = my - lastMouse.current.y;
      if (dx) send({ type: "set_maneuver", index: idx, prograde: (node.prograde ?? 0) + dx * 0.1 });
      if (dy) send({ type: "set_maneuver", index: idx, radial: (node.radial ?? 0) - dy * 0.1 });
      lastMouse.current = { x: mx, y: my };
      return;
    }
    if (panning.current) {
      const dx = mx - lastMouse.current.x, dy = my - lastMouse.current.y;
      setPan(p => ({ x: p.x + dx, y: p.y + dy }));
      lastMouse.current = { x: mx, y: my };
      return;
    }
  }, [data, draw, send]);

  const onMouseUp = () => { dragging.current = false; panning.current = false; mouseOnNodeIdx.current = null; draw(); };

  return (
    <canvas ref={canvasRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onDoubleClick={() => send({ type: "add_node", prograde: 0, normal: 0, radial: 0 })}
      style={{ display: "block", width: "100%", height: "100%", cursor: "default", touchAction: "none" }} />
  );
});

export default OrbitMap;

// ─── PHYSICS HELPERS ───────────────────────────────────────────

function getPosAtTrueAnomaly(o: OrbitData | PostOrbitData, nu: number) {
  // r is distance from center
  const r = o.semi_major_axis * (1 - o.eccentricity * o.eccentricity) / (1 + o.eccentricity * Math.cos(nu));
  
  // Standard 2D projection for technical radar:
  // Angle = Argument of Periapsis + True Anomaly + Longitude of Ascending Node
  // This preserves the radial distance 'r' exactly in the visual.
  const angle = o.argument_of_periapsis + nu + o.longitude_of_ascending_node;
  
  return { 
    x: r * Math.cos(angle), 
    y: r * Math.sin(angle) 
  }; 
}

function utToTrueAnomaly(o: OrbitData | PostOrbitData, ut: number): number {
  const a = o.semi_major_axis;
  const e = o.eccentricity;
  const mu = o.mu || 3.5316e12;
  const dt = ut - o.epoch;

  const n = Math.sqrt(mu / Math.pow(Math.abs(a), 3));
  const M0 = o.mean_anomaly_at_epoch || 0;
  const M = M0 + n * dt;
  
  if (e < 1.0) {
    let E = M;
    for (let i = 0; i < 10; i++) {
      const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
      E += dE;
      if (Math.abs(dE) < 1e-7) break;
    }
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  } else {
    let H = M;
    for (let i = 0; i < 10; i++) {
      const dH = (M - (e * Math.sinh(H) - H)) / (e * Math.cosh(H) - 1);
      H += dH;
      if (Math.abs(dH) < 1e-7) break;
    }
    return 2 * Math.atan2(Math.sqrt(e + 1) * Math.tanh(H / 2), Math.sqrt(e - 1));
  }
}

function getPosAtUt(o: OrbitData | PostOrbitData, ut: number) {
  return getPosAtTrueAnomaly(o, utToTrueAnomaly(o, ut));
}

function makeOrbitPts(o: OrbitData | PostOrbitData, count: number, utStart?: number, utEnd?: number) {
  const pts = [];
  const isHyperbolic = o.eccentricity > 1.0;
  if (utStart != null && utEnd != null) {
    const duration = utEnd - utStart;
    const step = duration / count;
    for (let i = 0; i <= count; i++) {
      pts.push(getPosAtUt(o, utStart + i * step));
    }
  } else {
    if (isHyperbolic) {
      for (let i = 0; i <= count; i++) {
        const nu = -1.2 + (i / count) * 2.4;
        pts.push(getPosAtTrueAnomaly(o, nu));
      }
    } else {
      for (let i = 0; i <= count; i++) {
        const nu = (i / count) * Math.PI * 2;
        pts.push(getPosAtTrueAnomaly(o, nu));
      }
    }
  }
  return pts;
}

function drawPath(ctx: CanvasRenderingContext2D, pts: {x:number, y:number}[], projector: (v: {x:number, y:number}) => {x:number, y:number}) {
  ctx.beginPath();
  pts.forEach((p, i) => {
    const s = projector(p);
    if (i === 0) ctx.moveTo(s.x, s.y); else ctx.lineTo(s.x, s.y);
  });
  ctx.stroke();
}

function fmtDistShort(m: number): string {
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(1)}Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(0)}km`;
  return `${m.toFixed(0)}m`;
}

function fmtAlt(m: number): string {
  if (m < 0) return "---";
  if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)} Mm`;
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${m.toFixed(0)} m`;
}
