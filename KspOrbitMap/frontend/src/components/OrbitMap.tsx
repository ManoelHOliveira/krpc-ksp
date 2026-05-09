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
const POST_COLOR = "#4488ff";
const TARGET_COLOR = "#ffdd44";
const NODE_COLOR = "#4488ff";

const OrbitMap = forwardRef<OrbitMapHandle, Props>(({ data, send }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panning = useRef(false);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const mouseOnNode = useRef(false);
  const nodePos = useRef({ x: 0, y: 0 });

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
    ctx.fillStyle = "#08081a";
    ctx.fillRect(0, 0, W, H);

    const { orbit, vessel, maneuver, target, soi_bodies, connected } = data;
    if (!connected || !orbit) {
      ctx.fillStyle = "#445";
      ctx.font = "20px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Desconectado", W / 2, H / 2);
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

    const peritoScreen = (r: number, th: number, w: number) => {
      const x = r * Math.cos(th), y = r * Math.sin(th);
      const cw = Math.cos(w), sw = Math.sin(w);
      return { x: cx + (x * cw - y * sw) * pxScale, y: cy - (x * sw + y * cw) * pxScale };
    };

    // ─── RPM radar grid ───────────────────────────────────────────
    ctx.strokeStyle = "rgba(40,80,60,0.3)";
    ctx.lineWidth = 0.5;

    for (let i = 1; i <= 5; i++) {
      const rr = drawR * (i / 5) * zoom;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Range label
      const labelDist = maxDist * (i / 5);
      const label = fmtDistShort(labelDist);
      ctx.fillStyle = "rgba(100,200,140,0.25)";
      ctx.font = "8px 'Segoe UI', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(label, cx + rr + 4, cy + 3);
    }

    // Outer ring (thicker)
    ctx.strokeStyle = "rgba(60,140,100,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, drawR * zoom, drawR * zoom, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshair
    ctx.strokeStyle = "rgba(40,80,60,0.25)";
    ctx.lineWidth = 0.5;
    const ax = drawR * zoom;
    ctx.beginPath(); ctx.moveTo(cx - ax, cy); ctx.lineTo(cx + ax, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - ax); ctx.lineTo(cx, cy + ax); ctx.stroke();

    // ─── SOI bodies ─────────────────────────────────────────────
    if (soi_bodies) for (const sb of soi_bodies) {
      const sx = cx + sb.pos_x * pxScale;
      const sy = cy - sb.pos_y * pxScale;
      const sr = sb.soi_radius * pxScale;

      // SOI circle
      if (sr > 4 && sr < 5000) {
        ctx.strokeStyle = "rgba(60,120,180,0.3)";
        ctx.lineWidth = 0.5;
        ctx.setLineDash([3, 5]);
        ctx.beginPath(); ctx.ellipse(sx, sy, sr, sr, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
      }

      // Body dot
      ctx.fillStyle = "rgba(100,160,200,0.5)";
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();

      // Name
      ctx.fillStyle = sb.encounter ? "#ff0" : "rgba(150,180,220,0.7)";
      ctx.font = "7px 'Segoe UI', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(sb.name, sx + 5, sy - 8);

      if (sb.encounter && maneuver) {
        ctx.fillStyle = "#ff0";
        ctx.font = "bold 7px 'Segoe UI', sans-serif";
        ctx.fillText(`SOI \u2192 ${sb.name}`, sx + 5, sy + 4);
      }

      // Target body: yellow circle
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
      const tp = makeOrbit(target.orbit.semi_major_axis, target.orbit.eccentricity, target.orbit.argument_of_periapsis, 128, pxScale, cx, cy);
      ctx.strokeStyle = "rgba(255,221,68,0.4)";
      ctx.lineWidth = 1;
      drawOrbit(ctx, tp);
    }

    // ─── Current orbit (green) ──────────────────────────────────
    const pts = makeOrbit(orbit.semi_major_axis, orbit.eccentricity, orbit.argument_of_periapsis, 128, pxScale, cx, cy);
    ctx.strokeStyle = ORBIT_COLOR;
    ctx.lineWidth = 1.5;
    drawOrbit(ctx, pts);

    // ─── Post-burn orbit (blue dashed) ──────────────────────────
    let postPePos = { x: 0, y: 0 };
    let postApPos = { x: 0, y: 0 };
    if (maneuver?.post_orbit) {
      const po = maneuver.post_orbit;
      const postPts = makeOrbit(po.semi_major_axis, po.eccentricity, po.argument_of_periapsis, 128, pxScale, cx, cy);
      ctx.strokeStyle = POST_COLOR;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 4]);
      drawOrbit(ctx, postPts);
      ctx.setLineDash([]);
      postPePos = peritoScreen(po.periapsis, 0, po.argument_of_periapsis);
      postApPos = peritoScreen(po.apoapsis, Math.PI, po.argument_of_periapsis);
    }

    // ─── Planet (transparent + white ring) ──────────────────────
    let pr = bodyR * pxScale;
    if (pr < 5) pr = 5;
    // inner glow
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr);
    grad.addColorStop(0, "rgba(40,80,60,0.15)");
    grad.addColorStop(1, "rgba(40,80,60,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, pr * 2, 0, Math.PI * 2); ctx.fill();
    // ring
    ctx.strokeStyle = "rgba(180,220,180,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.stroke();
    // name
    ctx.fillStyle = "rgba(180,220,180,0.8)";
    ctx.font = "bold 8px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(orbit.body_name, cx + pr + 6, cy + 4);

    // ─── Vessel ─────────────────────────────────────────────────
    const curR = orbit.semi_major_axis * (1 - orbit.eccentricity * orbit.eccentricity) / (1 + orbit.eccentricity * Math.cos(orbit.true_anomaly));
    const vp = peritoScreen(curR, orbit.true_anomaly, orbit.argument_of_periapsis);
    ctx.fillStyle = "#44ffaa";
    ctx.beginPath();
    ctx.moveTo(vp.x, vp.y - 8);
    ctx.lineTo(vp.x - 5, vp.y + 5);
    ctx.lineTo(vp.x + 5, vp.y + 5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "rgba(0,100,50,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // ─── Pe / Ap ────────────────────────────────────────────────
    const pep = peritoScreen(orbit.periapsis, 0, orbit.argument_of_periapsis);
    const app = peritoScreen(orbit.apoapsis, Math.PI, orbit.argument_of_periapsis);
    ctx.fillStyle = ORBIT_COLOR;
    ctx.font = "bold 8px 'Segoe UI', sans-serif";
    ctx.textAlign = "left";
    if (pep.x > 0) {
      ctx.strokeStyle = ORBIT_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pep.x, pep.y, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillText("Pe", pep.x + 6, pep.y + 3);
    }
    if (app.x > 0) {
      ctx.strokeStyle = ORBIT_COLOR;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(app.x, app.y, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillText("Ap", app.x + 6, app.y + 3);
    }
    if (maneuver) {
      ctx.fillStyle = POST_COLOR;
      ctx.font = "bold 7px 'Segoe UI', sans-serif";
      if (postPePos.x > 0) {
        ctx.strokeStyle = POST_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(postPePos.x, postPePos.y, 2.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillText("Pe'", postPePos.x + 5, postPePos.y + 3);
      }
      if (postApPos.x > 0) {
        ctx.strokeStyle = POST_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(postApPos.x, postApPos.y, 2.5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillText("Ap'", postApPos.x + 5, postApPos.y + 3);
      }
    }

    // ─── Maneuver node ──────────────────────────────────────────
    if (maneuver) {
      const nuN = nodeTrueAnomaly(maneuver.ut, orbit);
      const rN = orbit.semi_major_axis * (1 - orbit.eccentricity * orbit.eccentricity) / (1 + orbit.eccentricity * Math.cos(nuN));
      const np = peritoScreen(rN, nuN, orbit.argument_of_periapsis);
      nodePos.current = np;
      const timeToNode = maneuver.ut - orbit.epoch;

      const col = mouseOnNode.current ? "#ffa500" : NODE_COLOR;
      const bcol = mouseOnNode.current ? "#ffdd44" : "rgba(100,160,255,0.8)";
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(np.x, np.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = bcol;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(np.x, np.y, 7, 0, Math.PI * 2); ctx.stroke();

      ctx.fillStyle = "#fff";
      ctx.font = "bold 7px 'Segoe UI', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("\u0394V", np.x + 10, np.y + 3);

      ctx.fillStyle = "rgba(100,160,255,0.9)";
      ctx.font = "8px 'Segoe UI', sans-serif";
      ctx.fillText(`\u0394V: ${maneuver.delta_v.toFixed(1)} m/s`, np.x + 12, np.y + 14);
      ctx.fillText(`T: ${fmtTimeCompact(timeToNode)}`, np.x + 12, np.y + 24);
    }
  }, [data, zoom, pan]);

  // Resize
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

  // ─── Mouse wheel: zoom-to-cursor ─────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const old = zoom;
    const f = e.deltaY < 0 ? 1.15 : 0.87;
    const z = Math.max(0.05, Math.min(100, zoom * f));
    const cxc = canvas.width / 2 + pan.x;
    const cyc = canvas.height / 2 + pan.y;
    const dx = mx - cxc;
    const dy = my - cyc;
    setPan(p => ({ x: p.x - dx * (1 - z / old), y: p.y - dy * (1 - z / old) }));
    setZoom(z);
  }, [zoom, pan]);

  // ─── Mouse: left drag pan / left drag node ─────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const { x, y } = nodePos.current;
    const dx = e.nativeEvent.offsetX - x;
    const dy = e.nativeEvent.offsetY - y;
    if (dx * dx + dy * dy < 400 && data.maneuver) {
      dragging.current = true;
      mouseOnNode.current = true;
      lastMouse.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      return;
    }
    panning.current = true;
    lastMouse.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
  }, [data.maneuver]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current && data.maneuver && data.orbit) {
      const dx = e.nativeEvent.offsetX - lastMouse.current.x;
      const dy = e.nativeEvent.offsetY - lastMouse.current.y;
      if (dx) send({ type: "set_maneuver", prograde: (data.maneuver.prograde ?? 0) + dx * 0.1 });
      if (dy) send({ type: "set_maneuver", radial: (data.maneuver.radial ?? 0) - dy * 0.1 });
      lastMouse.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      return;
    }
    if (panning.current) {
      const dx = e.nativeEvent.offsetX - lastMouse.current.x;
      const dy = e.nativeEvent.offsetY - lastMouse.current.y;
      if (dx || dy) {
        setPan(p => ({ x: p.x + dx, y: p.y + dy }));
        lastMouse.current = { x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY };
      }
      return;
    }
    // hover on node
    const { x, y } = nodePos.current;
    const dd = e.nativeEvent.offsetX - x;
    const dy2 = e.nativeEvent.offsetY - y;
    const on = dd * dd + dy2 * dy2 < 400;
    if (on !== mouseOnNode.current) {
      mouseOnNode.current = on;
      draw();
    }
  }, [data, draw, send]);

  const onMouseUp = useCallback(() => {
    if (dragging.current) {
      dragging.current = false;
      mouseOnNode.current = false;
      draw();
    }
    panning.current = false;
  }, [draw]);

  const onClick = useCallback((e: React.MouseEvent) => {
    if (dragging.current || panning.current) return;
    if (e.button === 2 && data.maneuver) {
      const { x, y } = nodePos.current;
      const dx = e.nativeEvent.offsetX - x;
      const dy = e.nativeEvent.offsetY - y;
      if (dx * dx + dy * dy < 400) send({ type: "remove_node" });
    }
  }, [data.maneuver, send]);

  const onDblClick = useCallback(() => {
    send({ type: "add_node", prograde: 0, normal: 0, radial: 0 });
  }, [send]);

  return (
    <canvas
      ref={canvasRef}
      style={{ display: "block", width: "100%", height: "100%", cursor: "default" }}
      onWheel={handleWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onClick={onClick}
      onDoubleClick={onDblClick}
      onContextMenu={e => e.preventDefault()}
    />
  );
});

export default OrbitMap;

// ─── Helpers ──────────────────────────────────────────────────────

function makeOrbit(a: number, e: number, w: number, n: number, pxScale: number, cx: number, cy: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const th = 2 * Math.PI * i / n;
    const r = a * (1 - e * e) / (1 + e * Math.cos(th));
    if (r < 0) { pts.push({ x: -1, y: -1 }); continue; }
    const x = r * Math.cos(th), y = r * Math.sin(th);
    const cw = Math.cos(w), sw = Math.sin(w);
    pts.push({ x: cx + (x * cw - y * sw) * pxScale, y: cy - (x * sw + y * cw) * pxScale });
  }
  return pts;
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

function fmtTimeCompact(s: number): string {
  if (s < 0 || !isFinite(s)) return "---";
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}m`;
  return `${(s / 3600).toFixed(2)}h`;
}
