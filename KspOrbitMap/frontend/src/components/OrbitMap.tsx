import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import type { ServerData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

export interface OrbitMapHandle {
  autoFit: () => void;
}

const ORBIT_COLOR = "#00ff88";
const POST_COLOR = "#4af"; // Standard KSP blue
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

  const drawRef = useRef<() => void>(() => {});

  const autoFit = useCallback(() => {
    if (!data.orbit || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const maxDist = Math.max(data.orbit.apoapsis, data.orbit.periapsis);
    if (maxDist < data.orbit.body_radius * 3) return;
    const drawR = Math.min(canvas.width, canvas.height) * 0.42;
    const z = drawR / maxDist;
    setZoom(Math.max(0.05, Math.min(100, z)));
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
    if (maxDist < bodyR * 4) maxDist = bodyR * 4;
    if (target) {
      const ta = target.orbit.semi_major_axis;
      const te = target.orbit.eccentricity;
      const td = Math.max(ta * (1 + te), ta * (1 - te));
      if (td > maxDist) maxDist = td;
    }

    const drawR = Math.min(W, H) * 0.42;
    const pxScale = (drawR / maxDist) * zoom;
    const cx = W / 2 + pan.x;
    const cy = H / 2 + pan.y;

    drawRef.current = draw;

    const peritoScreen = (r: number, th: number, w: number, inc: number, lan: number) => {
      const { x, y } = perifocalToRef(r, th, w, inc, lan);
      return { x: cx + x * pxScale, y: cy - y * pxScale };
    };

    // ─── Technical grid ───────────────────────────────────────────
    ctx.strokeStyle = "rgba(68,136,255,0.1)";
    ctx.lineWidth = 0.5;

    for (let i = 1; i <= 5; i++) {
      const rr = drawR * (i / 5) * zoom;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Range label
      const labelDist = maxDist * (i / 5);
      const label = fmtDistShort(labelDist);
      ctx.fillStyle = "rgba(104,170,170,0.4)";
      ctx.font = "bold 9px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText(label, cx + rr + 4, cy + 3);
    }

    // Outer ring (thicker)
    ctx.strokeStyle = "rgba(68,136,255,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, drawR * zoom, drawR * zoom, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair
    ctx.strokeStyle = "rgba(68,136,255,0.15)";
    ctx.lineWidth = 0.5;
    const ax = drawR * zoom;
    ctx.beginPath(); ctx.moveTo(cx - ax, cy); ctx.lineTo(cx + ax, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - ax); ctx.lineTo(cx, cy + ax); ctx.stroke();

    // ─── SOI bodies ─────────────────────────────────────────────
    if (soi_bodies) for (const sb of soi_bodies) {
      const sx = cx + sb.pos_x * pxScale;
      const sy = cy - sb.pos_y * pxScale;
      const sr = sb.soi_radius * pxScale;

      if (sr > 4 && sr < 5000) {
        ctx.strokeStyle = "rgba(60,120,180,0.3)";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.fillStyle = "rgba(68,170,255,0.6)";
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();

      ctx.fillStyle = "rgba(104,170,170,0.8)";
      ctx.font = "bold 9px 'Orbitron', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(sb.name.toUpperCase(), sx + 6, sy - 8);

      if (encounter && encounter.body_name === sb.name) {
        ctx.fillStyle = "#fb0";
        ctx.font = "bold 10px 'Orbitron', sans-serif";
        ctx.fillText(`\u2192 ENCOUNTER: ${sb.name.toUpperCase()}`, sx + 6, sy + 6);
        ctx.font = "bold 9px 'Share Tech Mono', monospace";
        ctx.fillText(`Pe: ${fmtAlt(encounter.periapsis_altitude)}`, sx + 6, sy + 18);
        ctx.strokeStyle = "#fb0";
        ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      if (target && sb.name === target.name) {
        ctx.strokeStyle = TARGET_COLOR;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(sx, sy, 6, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "rgba(255,221,68,0.3)";
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ─── Target orbit ───────────────────────────────────────────
    if (target) {
      const tp = makeOrbit(target.orbit.semi_major_axis, target.orbit.eccentricity, target.orbit.argument_of_periapsis, target.orbit.inclination, target.orbit.longitude_of_ascending_node, 128, pxScale, cx, cy);
      ctx.strokeStyle = "rgba(255,221,68,0.7)";
      ctx.lineWidth = 1.5;
      drawOrbit(ctx, tp);
    }

    // ─── Current orbit (green) ──────────────────────────────────
    const pts = makeOrbit(orbit.semi_major_axis, orbit.eccentricity, orbit.argument_of_periapsis, orbit.inclination, orbit.longitude_of_ascending_node, 128, pxScale, cx, cy);
    ctx.strokeStyle = ORBIT_COLOR;
    ctx.lineWidth = 1.5;
    drawOrbit(ctx, pts);

    // ─── Post-burn orbits (multi-node) ──────────────────────────
    if (maneuvers && maneuvers.length > 0) {
      maneuvers.forEach((m, idx) => {
        if (m.post_orbit) {
          const po = m.post_orbit;
          const postPts = makeOrbit(po.semi_major_axis, po.eccentricity, po.argument_of_periapsis, po.inclination, po.longitude_of_ascending_node, 128, pxScale, cx, cy);
          ctx.strokeStyle = NODE_COLORS[idx % NODE_COLORS.length];
          ctx.lineWidth = 1.2;
          ctx.setLineDash([5, 4]);
          drawOrbit(ctx, postPts);
          ctx.setLineDash([]);
        }
      });
    }

    // ─── Planet (transparent + white ring) ──────────────────────
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
    // name - CENTERED INSIDE
    ctx.fillStyle = "rgba(68,170,255,1)";
    ctx.font = "bold 10px Orbitron, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(orbit.body_name.toUpperCase(), cx, cy);
    ctx.textBaseline = "alphabetic"; // Reset

    // ─── Vessel ─────────────────────────────────────────────────
    const curR = orbit.semi_major_axis * (1 - orbit.eccentricity * orbit.eccentricity) / (1 + orbit.eccentricity * Math.cos(orbit.true_anomaly));
    const vp = peritoScreen(curR, orbit.true_anomaly, orbit.argument_of_periapsis, orbit.inclination, orbit.longitude_of_ascending_node);
    ctx.fillStyle = "#4f6";
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#4f6";
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y - 8);
    ctx.lineTo(vp.x - 5, vp.y + 5);
    ctx.lineTo(vp.x + 5, vp.y + 5);
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // ─── Pe / Ap ────────────────────────────────────────────────
    const pep = peritoScreen(orbit.periapsis, 0, orbit.argument_of_periapsis, orbit.inclination, orbit.longitude_of_ascending_node);
    const app = peritoScreen(orbit.apoapsis, Math.PI, orbit.argument_of_periapsis, orbit.inclination, orbit.longitude_of_ascending_node);
    ctx.fillStyle = ORBIT_COLOR;
    ctx.font = "bold 9px 'Share Tech Mono', monospace";
    ctx.textAlign = "left";
    if (pep.x > 0) {
      ctx.strokeStyle = ORBIT_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pep.x, pep.y, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillText(`Pe: ${fmtAlt(orbit.periapsis_altitude)}`, pep.x + 8, pep.y + 3);
    }
    if (app.x > 0) {
      ctx.strokeStyle = ORBIT_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(app.x, app.y, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillText(`Ap: ${fmtAlt(orbit.apoapsis_altitude)}`, app.x + 8, app.y + 3);
    }

    // ─── Maneuver nodes ──────────────────────────────────────────
    nodePositions.current = [];
    if (maneuvers) {
      maneuvers.forEach((m, idx) => {
        const nuN = nodeTrueAnomaly(m.ut, orbit);
        const rN = orbit.semi_major_axis * (1 - orbit.eccentricity * orbit.eccentricity) / (1 + orbit.eccentricity * Math.cos(nuN));
        const np = peritoScreen(rN, nuN, orbit.argument_of_periapsis, orbit.inclination, orbit.longitude_of_ascending_node);
        nodePositions.current.push(np);

        const col = mouseOnNodeIdx.current === idx ? "#fff" : NODE_COLORS[idx % NODE_COLORS.length];
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(np.x, np.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = col;
        ctx.font = "bold 9px 'Share Tech Mono', monospace";
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
      const newZoom = Math.max(0.05, Math.min(100, zoom * f));
      const cxc = canvas.width / 2 + pan.x;
      const cyc = canvas.height / 2 + pan.y;
      const dx = mx - cxc;
      const dy = my - cyc;
      setPan(p => ({ x: p.x - dx * (1 - newZoom / zoom), y: p.y - dy * (1 - newZoom / zoom) }));
      setZoom(newZoom);
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, [zoom, pan]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const mx = e.nativeEvent.offsetX;
    const my = e.nativeEvent.offsetY;
    
    let clickedNodeIdx = -1;
    nodePositions.current.forEach((pos, idx) => {
      const dx = mx - pos.x;
      const dy = my - pos.y;
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
    const mx = e.nativeEvent.offsetX;
    const my = e.nativeEvent.offsetY;

    if (dragging.current && mouseOnNodeIdx.current !== null && data.maneuvers) {
      const idx = mouseOnNodeIdx.current;
      const node = data.maneuvers[idx];
      const dx = mx - lastMouse.current.x;
      const dy = my - lastMouse.current.y;
      if (dx) send({ type: "set_maneuver", index: idx, prograde: (node.prograde ?? 0) + dx * 0.1 });
      if (dy) send({ type: "set_maneuver", index: idx, radial: (node.radial ?? 0) - dy * 0.1 });
      lastMouse.current = { x: mx, y: my };
      return;
    }

    if (panning.current) {
      const dx = mx - lastMouse.current.x;
      const dy = my - lastMouse.current.y;
      if (dx || dy) {
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        lastMouse.current = { x: mx, y: my };
      }
      return;
    }

    let hoverIdx = null;
    nodePositions.current.forEach((pos, idx) => {
      const dx = mx - pos.x;
      const dy = my - pos.y;
      if (dx * dx + dy * dy < 100) hoverIdx = idx;
    });
    if (hoverIdx !== mouseOnNodeIdx.current) {
      mouseOnNodeIdx.current = hoverIdx;
      draw();
    }
  }, [data, draw, send]);

  const onMouseUp = useCallback(() => {
    dragging.current = false;
    panning.current = false;
    mouseOnNodeIdx.current = null;
    draw();
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", cursor: "default", touchAction: "none" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onDoubleClick={() => send({ type: "add_node", prograde: 0, normal: 0, radial: 0 })}
      onContextMenu={e => e.preventDefault()}
    />
  );
});

export default OrbitMap;

function makeOrbit(a: number, e: number, w: number, inc: number, lan: number, n: number, pxScale: number, cx: number, cy: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const th = 2 * Math.PI * i / n;
    const r = a * (1 - e * e) / (1 + e * Math.cos(th));
    if (r < 0) { pts.push({ x: -1, y: -1 }); continue; }
    const { x, y } = perifocalToRef(r, th, w, inc, lan);
    pts.push({ x: cx + x * pxScale, y: cy - y * pxScale });
  }
  return pts;
}

function perifocalToRef(r: number, th: number, w: number, inc: number, lan: number): { x: number; y: number } {
  const xp = r * Math.cos(th), yp = r * Math.sin(th);
  const cw = Math.cos(w), sw = Math.sin(w);
  const ci = Math.cos(inc), si = Math.sin(inc);
  const cl = Math.cos(lan), sl = Math.sin(lan);
  const x1 = xp * cw + yp * sw;
  const y1 = -xp * sw + yp * cw;
  const x2 = x1;
  const y2 = y1 * ci;
  const x = x2 * cl + y2 * sl;
  const y = -x2 * sl + y2 * cl;
  return { x, y };
}

function drawOrbit(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
  let started = false;
  ctx.beginPath();
  for (const p of pts) {
    if (p.x < -50000 || p.y < -50000) { started = false; continue; }
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

function nodeTrueAnomaly(ut: number, orbit: { semi_major_axis: number; eccentricity: number; epoch: number; mu?: number; true_anomaly: number }): number {
  const a = orbit.semi_major_axis, e = orbit.eccentricity;
  const mu_val = orbit.mu ?? 3.5316e12;
  const n = Math.sqrt(mu_val / (a * a * a));
  const dt = ut - orbit.epoch;
  const curNu = orbit.true_anomaly;
  const curE = 2 * Math.atan2(Math.sqrt(1 - e) * Math.sin(curNu / 2), Math.sqrt(1 + e) * Math.cos(curNu / 2));
  const curM = curE - e * Math.sin(curE);
  const tarM = curM + n * dt;
  let tarE = tarM;
  for (let i = 0; i < 100; i++) {
    const d = (tarM - tarE + e * Math.sin(tarE)) / (1 - e * Math.cos(tarE));
    tarE += d;
    if (Math.abs(d) < 1e-12) break;
  }
  return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(tarE / 2), Math.sqrt(1 - e) * Math.cos(tarE / 2));
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

function fmtTimeCompact(s: number): string {
  if (s < 0 || !isFinite(s)) return "---";
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}m`;
  return `${(s / 3600).toFixed(2)}h`;
}
