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
    if (maxDist < data.orbit.body_radius * 3) return;
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

    const { orbit, vessel, maneuvers, target, soi_bodies, connected, encounter } = data;
    if (!connected || !orbit) {
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
      y: origin.y - vec.y * pxScale
    });

    // ─── Grid ─────────────────────────────────────────────────────
    ctx.strokeStyle = "rgba(68,136,255,0.1)";
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const rr = drawR * (i / 5) * zoom;
      ctx.beginPath(); ctx.ellipse(cx, cy, rr, rr, 0, 0, Math.PI * 2); ctx.stroke();
      const label = fmtDistShort(maxDist * (i / 5));
      ctx.fillStyle = "rgba(104,170,170,0.4)";
      ctx.font = "bold 9px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, cx + rr + 4, cy + 3);
    }
    ctx.strokeStyle = "rgba(68,136,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, drawR * zoom, drawR * zoom, 0, 0, Math.PI * 2); ctx.stroke();
// ─── SOI Bodies (Planets) ──────────────────────────────────────
if (soi_bodies) for (const sb of soi_bodies) {
  const isTarget = target && sb.name === target.name;
  const isEncounter = encounter && encounter.body_name === sb.name;
  if (!isTarget && !isEncounter) continue;

  // FIX: Use orbital parameters for positioning to match the orbit lines exactly
  let sp;
  if (sb.orbit) {
    const bodyVec3 = getPosAtTrueAnomaly(sb.orbit, sb.orbit.true_anomaly);
    sp = toScreen({ x: bodyVec3.x, y: bodyVec3.y });
  } else {
    // Fallback to raw pos if no orbit data
    sp = toScreen({ x: sb.pos_x, y: sb.pos_y });
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
      ctx.font = "bold 9px 'Orbitron', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(sb.name.toUpperCase(), sp.x + 6, sp.y - 8);

      if (target && sb.name === target.name) {
        ctx.strokeStyle = TARGET_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // ─── Target Orbit ─────────────────────────────────────────────
    if (target) {
      const tp = makeOrbitPts(target.orbit, 128);
      ctx.strokeStyle = "rgba(255,221,68,0.5)";
      ctx.lineWidth = 1.2;
      drawPath(ctx, tp, toScreen);
    }

    // ─── Current Vessel Orbit ─────────────────────────────────────
    const vpts = makeOrbitPts(orbit, 128);
    ctx.strokeStyle = ORBIT_COLOR;
    ctx.lineWidth = 1.5;
    drawPath(ctx, vpts, toScreen);

    // ─── Maneuvers & Patched Conics ────────────────────────────────
    if (maneuvers) {
      maneuvers.forEach((m, idx) => {
        if (!m.post_orbit) return;
        const color = NODE_COLORS[idx % NODE_COLORS.length];
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.setLineDash([5, 4]);

        const utStart = m.ut;
        const utEnd = m.post_orbit.transition_ut || (utStart + (orbit.period || 3600));
        const pts1 = makeOrbitPts(m.post_orbit as any as OrbitData, 128, utStart, utEnd);
        drawPath(ctx, pts1, toScreen);
        ctx.setLineDash([]);

        if (m.post_orbit.next_orbit && m.post_orbit.transition_ut) {
          const next = m.post_orbit.next_orbit;
          const tut = m.post_orbit.transition_ut;
          const targetBody = soi_bodies?.find(b => b.name === next.body_name);
          if (targetBody && targetBody.orbit) {
            const ghostVec3 = getPosAtUt(targetBody.orbit, tut);
            const ghostScreen = toScreen({ x: ghostVec3.x, y: ghostVec3.y });

            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.setLineDash([2, 2]);
            ctx.beginPath(); ctx.arc(ghostScreen.x, ghostScreen.y, 4, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(255,255,255,0.3)";
            ctx.font = "italic 8px Orbitron";
            ctx.fillText(`${targetBody.name.toUpperCase()} (ENCOUNTER)`, ghostScreen.x + 8, ghostScreen.y - 8);

            const pts2 = makeOrbitPts(next as any as OrbitData, 64, tut, tut + (next.period || 3600));
            drawPath(ctx, pts2, (v) => toScreen(v, ghostScreen));

            const peVec3_target = getPosAtTrueAnomaly(next as any as OrbitData, 0);
            const peScreen = toScreen({ x: peVec3_target.x, y: peVec3_target.y }, ghostScreen);
            ctx.fillStyle = "#fb0";
            ctx.beginPath(); ctx.arc(peScreen.x, peScreen.y, 3, 0, Math.PI * 2); ctx.fill();
            ctx.font = "bold 9px 'Share Tech Mono'";
            ctx.fillText(`TARGET Pe: ${fmtAlt(next.periapsis_altitude)}`, peScreen.x + 8, peScreen.y + 3);
          }
        }
      });
    }

    // ─── Central Body (Kerbin) ────────────────────────────────────
    let pr = bodyR * pxScale;
    if (pr < 5) pr = 5;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr);
    grad.addColorStop(0, "rgba(68,136,255,0.2)");
    grad.addColorStop(1, "rgba(68,136,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, pr * 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(68,170,255,0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.stroke();
    
    ctx.fillStyle = "rgba(68,170,255,1)";
    ctx.font = "bold 10px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(orbit.body_name.toUpperCase(), cx, cy);
    ctx.textBaseline = "alphabetic";

    // ─── Vessel Icon ──────────────────────────────────────────────
    const vvec3 = getPosAtTrueAnomaly(orbit, orbit.true_anomaly);
    const vp = toScreen({ x: vvec3.x, y: vvec3.y });
    ctx.fillStyle = "#4f6";
    ctx.shadowBlur = 10; ctx.shadowColor = "#4f6";
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y - 8); ctx.lineTo(vp.x - 5, vp.y + 5); ctx.lineTo(vp.x + 5, vp.y + 5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.stroke();

    // ─── Periapsis / Apoapsis ─────────────────────────────────────
    const peVec3 = getPosAtTrueAnomaly(orbit, 0);
    const apVec3 = getPosAtTrueAnomaly(orbit, Math.PI);
    const peS = toScreen({ x: peVec3.x, y: peVec3.y });
    const apS = toScreen({ x: apVec3.x, y: apVec3.y });
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

    // ─── Maneuver Node Icons ──────────────────────────────────────
    nodePositions.current = [];
    if (maneuvers) {
      maneuvers.forEach((m, idx) => {
        const nuN = nodeTrueAnomaly(m.ut, orbit);
        const nvec3 = getPosAtTrueAnomaly(orbit, nuN);
        const np = toScreen({ x: nvec3.x, y: nvec3.y });
        nodePositions.current.push(np);

        const col = mouseOnNodeIdx.current === idx ? "#fff" : NODE_COLORS[idx % NODE_COLORS.length];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(np.x, np.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#000"; ctx.stroke();
        ctx.font = "bold 9px 'Share Tech Mono'";
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
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
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
    const mx = e.nativeEvent.offsetX;
    const my = e.nativeEvent.offsetY;
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

function getPosAtTrueAnomaly(o: OrbitData, nu: number) {
  const r = o.semi_major_axis * (1 - o.eccentricity * o.eccentricity) / (1 + o.eccentricity * Math.cos(nu));
  const xp = r * Math.cos(nu), yp = r * Math.sin(nu);
  const cw = Math.cos(o.argument_of_periapsis), sw = Math.sin(o.argument_of_periapsis);
  const ci = Math.cos(o.inclination), si = Math.sin(o.inclination);
  const cl = Math.cos(o.longitude_of_ascending_node), sl = Math.sin(o.longitude_of_ascending_node);
  const x1 = xp * cw - yp * sw, y1 = xp * sw + yp * cw;
  const y2 = y1 * ci, z2 = y1 * si;
  const x3 = x1 * cl - y2 * sl, y3 = x1 * sl + y2 * cl;
  return { x: x3, y: y3, z: z2 };
}

function getPosAtUt(o: OrbitData, ut: number) {
  const mu = o.mu || 3.5316e12;
  const n = Math.sqrt(mu / Math.pow(Math.abs(o.semi_major_axis), 3));
  const dt = ut - o.epoch;
  const M = (o.true_anomaly_at_epoch || 0) + n * dt;
  return getPosAtTrueAnomaly(o, M);
}

function makeOrbitPts(o: OrbitData, count: number, utStart?: number, utEnd?: number) {
  const pts = [];
  const isHyperbolic = o.eccentricity > 1.0;
  if (utStart != null && utEnd != null) {
    const step = (utEnd - utStart) / count;
    for (let i = 0; i <= count; i++) {
      const ut = utStart + i * step;
      const nu = utToTrueAnomaly(o, ut);
      const pos = getPosAtTrueAnomaly(o, nu);
      pts.push({ x: pos.x, y: pos.y });
    }
  } else {
    const range = isHyperbolic ? 2.0 : Math.PI * 2;
    const start = isHyperbolic ? -1.0 : 0;
    for (let i = 0; i <= count; i++) {
      const nu = start + (i / count) * range;
      const pos = getPosAtTrueAnomaly(o, nu);
      pts.push({ x: pos.x, y: pos.y });
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

function utToTrueAnomaly(o: OrbitData, ut: number): number {
  const a = o.semi_major_axis, e = o.eccentricity;
  const mu = o.mu || 3.5316e12;
  const n = Math.sqrt(mu / Math.pow(Math.abs(a), 3));
  const dt = ut - o.epoch;
  return n * dt; 
}

function nodeTrueAnomaly(ut: number, o: OrbitData): number {
  return utToTrueAnomaly(o, ut);
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
