import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from "react";
import type { ServerData, OrbitData, SoiBodyData, PostOrbitData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

export interface OrbitMapHandle {
  autoFit: () => void;
}

const ORBIT_COLOR = "rgba(0, 255, 0, 0.6)";
const TARGET_COLOR = "rgba(255, 220, 0, 0.8)";
const NODE_COLORS = ["#4af", "#f0f", "#0ff", "#ff0", "#fff", "#f44"];

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
    const W = canvas.width, H = canvas.height;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);

    const { orbit, maneuvers, target, soi_bodies, connected, ut, encounter } = data;
    if (!connected || !orbit || ut == null) {
      ctx.fillStyle = "#040";
      ctx.font = "12px monospace"; ctx.textAlign = "center";
      ctx.fillText("[ SYSTEM_OFFLINE: WAITING_FOR_LINK ]", W / 2, H / 2);
      return;
    }

    const bodyR = orbit.body_radius || 600000;
    let maxDist = Math.max(orbit.apoapsis, orbit.periapsis);
    if (target) {
      const td = Math.max(target.orbit.apoapsis, target.orbit.periapsis);
      if (td > maxDist) maxDist = td;
    }
    if (maxDist < bodyR * 4) maxDist = bodyR * 4;

    const drawR = Math.min(W, H) * 0.45;
    const pxScale = (drawR / maxDist) * zoom;
    const cx = W / 2 + pan.x, cy = H / 2 + pan.y;

    const toScreen = (v: { x: number; y: number }, origin = { x: cx, y: cy }) => ({
      x: origin.x + v.x * pxScale,
      y: origin.y - v.y * pxScale
    });

    // ─── Radar Grid ───────────────────────────────────────────────
    ctx.strokeStyle = "rgba(0, 60, 0, 0.4)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 6; i++) {
      const rr = drawR * (i / 6) * zoom;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      const alt = (maxDist * (i / 6)) - bodyR;
      const label = alt > 0 ? fmtDistShort(alt) : fmtDistShort(maxDist * (i/6));
      ctx.fillStyle = "rgba(0, 100, 0, 0.5)"; ctx.font = "8px monospace";
      ctx.textAlign = "center"; ctx.fillText(label, cx + rr + 5, cy + 3);
    }
    const ax = drawR * zoom * 1.1;
    ctx.beginPath(); ctx.moveTo(cx - ax, cy); ctx.lineTo(cx + ax, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - ax); ctx.lineTo(cx, cy + ax); ctx.stroke();

    // ─── Planets ──────────────────────────────────────────────────
    if (soi_bodies) for (const sb of soi_bodies) {
      const isTarget = target && sb.name === target.name;
      const isEncounter = maneuvers?.some(m => hasBodyInChain(m.post_orbit, sb.name));
      if (!isTarget && !isEncounter) continue;

      const bodyPos = sb.orbit ? getPosAtUt(sb.orbit, ut) : { x: sb.pos_x, y: sb.pos_z };
      const sp = toScreen(bodyPos);
      const sr = sb.soi_radius * pxScale;

      ctx.strokeStyle = "rgba(0, 255, 0, 0.1)"; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.arc(sp.x, sp.y, sr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = isTarget ? "#ff0" : "#0f0";
      ctx.beginPath(); ctx.arc(sp.x, sp.y, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.font = "10px monospace"; ctx.textAlign = "left";
      ctx.fillText(sb.name.toUpperCase(), sp.x + 8, sp.y - 5);
      if (isTarget) {
        ctx.strokeStyle = "#ff0"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // ─── Target Orbit ─────────────────────────────────────────────
    if (target) {
      const tp = makeOrbitPts(target.orbit, 128);
      ctx.strokeStyle = "rgba(255, 255, 0, 0.3)"; ctx.lineWidth = 1;
      drawPath(ctx, tp, toScreen);
    }

    // ─── Vessel Orbit ─────────────────────────────────────────────
    const vpts = makeOrbitPts(orbit, 128);
    ctx.strokeStyle = ORBIT_COLOR; ctx.lineWidth = 2;
    drawPath(ctx, vpts, toScreen);

    // ─── Maneuvers ────────────────────────────────────────────────
    if (maneuvers) maneuvers.forEach((m, idx) => {
      if (!m.post_orbit) return;
      const color = NODE_COLORS[idx % NODE_COLORS.length];
      renderPatchChain(ctx, m.post_orbit, m.ut, color, toScreen, soi_bodies || [], ut, encounter);
    });

    // ─── Central Body ─────────────────────────────────────────────
    let pr = bodyR * pxScale; if (!isFinite(pr) || pr < 4) pr = 4;
    ctx.strokeStyle = "#0f0"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px monospace"; ctx.textAlign = "center";
    ctx.textBaseline = "middle"; ctx.fillText(orbit.body_name.toUpperCase(), cx, cy);
    ctx.textBaseline = "alphabetic";

    // ─── Vessel Icon ──────────────────────────────────────────────
    const vPos = getPosAtUt(orbit, ut); const vp = toScreen(vPos);
    ctx.fillStyle = "#0f0"; ctx.beginPath();
    ctx.moveTo(vp.x, vp.y-6); ctx.lineTo(vp.x-4, vp.y+4); ctx.lineTo(vp.x+4, vp.y+4); ctx.closePath(); ctx.fill();

    // ─── Node Markers ─────────────────────────────────────────────
    nodePositions.current = [];
    if (maneuvers) maneuvers.forEach((m, idx) => {
      const nPos = getPosAtUt(orbit, m.ut); const np = toScreen(nPos);
      nodePositions.current.push(np);
      const col = mouseOnNodeIdx.current === idx ? "#fff" : NODE_COLORS[idx % NODE_COLORS.length];
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(np.x, np.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(np.x, np.y, 7, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = col; ctx.font = "bold 9px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${idx + 1}`, np.x, np.y + 3);
    });
  }, [data, zoom, pan]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => { const p = canvas.parentElement!; canvas.width = p.clientWidth; canvas.height = p.clientHeight; draw(); };
    resize(); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize);
  }, [draw]);
  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault(); const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top, f = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom(pz => {
        const nz = Math.max(0.005, Math.min(500, pz * f));
        const wx = (mx - (canvas.width/2 + pan.x)) / pz, wy = (my - (canvas.height/2 + pan.y)) / pz;
        setPan({ x: mx - (canvas.width/2) - wx * nz, y: my - (canvas.height/2) - wy * nz });
        return nz;
      });
    };
    canvas.addEventListener("wheel", handler, { passive: false }); return () => canvas.removeEventListener("wheel", handler);
  }, [pan.x, pan.y]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const mx = e.nativeEvent.offsetX, my = e.nativeEvent.offsetY;
    let ci = -1; nodePositions.current.forEach((pos, idx) => { if ((mx-pos.x)**2+(my-pos.y)**2 < 144) ci = idx; });
    if (ci !== -1) { dragging.current = true; mouseOnNodeIdx.current = ci; lastMouse.current = { x: mx, y: my }; return; }
    panning.current = true; lastMouse.current = { x: mx, y: my };
  }, [data.maneuvers]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const mx = e.nativeEvent.offsetX, my = e.nativeEvent.offsetY;
    if (dragging.current && mouseOnNodeIdx.current !== null && data.maneuvers) {
      const idx = mouseOnNodeIdx.current, node = data.maneuvers[idx], dx = mx - lastMouse.current.x, dy = my - lastMouse.current.y;
      if (dx) send({ type: "set_maneuver", index: idx, prograde: (node.prograde ?? 0) + dx * 0.1 });
      if (dy) send({ type: "set_maneuver", index: idx, radial: (node.radial ?? 0) - dy * 0.1 });
      lastMouse.current = { x: mx, y: my }; return;
    }
    if (panning.current) { const dx = mx - lastMouse.current.x, dy = my - lastMouse.current.y; setPan(p => ({ x: p.x + dx, y: p.y + dy })); lastMouse.current = { x: mx, y: my }; return; }
  }, [data, draw, send]);

  const onMouseUp = () => { dragging.current = false; panning.current = false; mouseOnNodeIdx.current = null; draw(); };

  return (
    <canvas ref={canvasRef} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onDoubleClick={() => send({ type: "add_node", prograde: 0, normal: 0, radial: 0 })}
      style={{ display: "block", width: "100%", height: "100%", cursor: "crosshair", touchAction: "none" }} />
  );
});

export default OrbitMap;

// ─── CHAIN RENDERING ───────────────────────────────────────────

function renderPatchChain(ctx: CanvasRenderingContext2D, patch: any, startUt: number, color: string, toScreen: any, bodies: SoiBodyData[], currentUt: number, encounter: any, originScreen?: {x:number, y:number}) {
  const nextPatch = patch.next_patch;
  const isHyperbolic = patch.eccentricity > 1.0;
  
  let endUt = null;
  if (nextPatch) endUt = nextPatch.epoch;
  else if (encounter && patch.body_name === "Kerbin" && encounter.body_name !== "Kerbin") endUt = encounter.transition_ut;

  let pts;
  if (endUt && endUt > startUt) {
    pts = makeOrbitPts(patch, 128, startUt, endUt);
  } else if (isHyperbolic) {
    pts = makeOrbitPts(patch, 128, startUt, startUt + 3600 * 6);
  } else {
    pts = makeOrbitPts(patch, 128); 
  }
  
  ctx.strokeStyle = color; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
  drawPath(ctx, pts, (v: any) => toScreen(v, originScreen));
  ctx.setLineDash([]);

  if (endUt) {
    const nextBodyName = nextPatch ? nextPatch.body_name : (encounter ? encounter.body_name : null);
    if (nextBodyName) {
      const targetBody = bodies.find(b => b.name === nextBodyName);
      if (targetBody && targetBody.orbit) {
        const ghostNu = utToTrueAnomaly(targetBody.orbit, endUt);
        const ghostPos = getPosAtTrueAnomaly(targetBody.orbit, ghostNu);
        const ghostScreen = toScreen(ghostPos);

        ctx.strokeStyle = "rgba(0, 255, 0, 0.3)"; ctx.setLineDash([2, 2]);
        ctx.beginPath(); ctx.arc(ghostScreen.x, ghostScreen.y, 5, 0, Math.PI*2); ctx.stroke();
        ctx.setLineDash([]); ctx.fillStyle = "rgba(0, 255, 0, 0.4)"; ctx.font = "8px monospace";
        ctx.fillText(targetBody.name.toUpperCase(), ghostScreen.x + 8, ghostScreen.y - 8);

        if (nextPatch) {
          renderPatchChain(ctx, nextPatch, endUt, color, toScreen, bodies, currentUt, null, ghostScreen);
          const pePos = getPosAtTrueAnomaly(nextPatch, 0);
          const peS = toScreen(pePos, ghostScreen);
          ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(peS.x, peS.y, 2.5, 0, Math.PI * 2); ctx.fill();
          ctx.font = "bold 9px monospace"; ctx.fillText(`PE: ${fmtAlt(nextPatch.periapsis_altitude)}`, peS.x + 8, peS.y + 3);
        } else {
          ctx.strokeStyle = color; ctx.setLineDash([4, 4]);
          ctx.beginPath(); ctx.arc(ghostScreen.x, ghostScreen.y, 15, Math.PI, Math.PI * 1.5); ctx.stroke();
        }
      }
    }
  } else if (patch.end_ut && isHyperbolic) {
    const exitPos = pts[pts.length - 1];
    const exitS = toScreen(exitPos, originScreen);
    ctx.strokeStyle = color; ctx.beginPath(); ctx.arc(exitS.x, exitS.y, 3, 0, Math.PI*2); ctx.stroke();
    ctx.font = "8px monospace"; ctx.fillStyle = color; ctx.fillText("OUT", exitS.x + 6, exitS.y + 3);
  }
}

function hasBodyInChain(patch: any, bodyName: string): boolean {
  if (!patch) return false;
  if (patch.body_name === bodyName) return true;
  return hasBodyInChain(patch.next_patch, bodyName);
}

// ─── PHYSICS HELPERS ───────────────────────────────────────────

function getPosAtTrueAnomaly(o: OrbitData | PostOrbitData, nu: number) {
  const r = (o.semi_major_axis * (1 - o.eccentricity * o.eccentricity)) / (1 + o.eccentricity * Math.cos(nu));
  const w = o.argument_of_periapsis, l = o.longitude_of_ascending_node;
  const angle = l + w + nu;
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}

function utToTrueAnomaly(o: OrbitData | PostOrbitData, ut: number): number {
  const a = o.semi_major_axis, e = o.eccentricity, mu = o.mu || 3.5316e12, dt = ut - o.epoch;
  const n = Math.sqrt(mu / Math.pow(Math.abs(a), 3));
  const M0 = o.mean_anomaly_at_epoch || 0, M = M0 + n * dt;
  if (e < 1.0) {
    let E = M; for (let i = 0; i < 8; i++) { const dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E)); E += dE; if (Math.abs(dE) < 1e-6) break; }
    return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  } else {
    let H = M; for (let i = 0; i < 8; i++) { const dH = (M - (e * Math.sinh(H) - H)) / (e * Math.cosh(H) - 1); H += dH; if (Math.abs(dH) < 1e-6) break; }
    return 2 * Math.atan2(Math.sqrt(e + 1) * Math.tanh(H / 2), Math.sqrt(e - 1));
  }
}

function getPosAtUt(o: OrbitData | PostOrbitData, ut: number) { return getPosAtTrueAnomaly(o, utToTrueAnomaly(o, ut)); }

function makeOrbitPts(o: OrbitData | PostOrbitData, count: number, utStart?: number, utEnd?: number) {
  const pts = []; if (utStart != null && utEnd != null) {
    const step = (utEnd - utStart) / count;
    for (let i = 0; i <= count; i++) { pts.push(getPosAtUt(o, utStart + i * step)); }
  } else {
    if (o.eccentricity > 1.0) { for (let i = 0; i <= count; i++) { pts.push(getPosAtTrueAnomaly(o, -1.2 + (i / count) * 2.4)); } }
    else { for (let i = 0; i <= count; i++) { pts.push(getPosAtTrueAnomaly(o, (i / count) * Math.PI * 2)); } }
  }
  return pts;
}

function drawPath(ctx: CanvasRenderingContext2D, pts: {x:number, y:number}[], projector: (v: {x:number, y:number}) => {x:number, y:number}, close = false) {
  if (pts.length < 2) return;
  ctx.beginPath();
  let first = true;
  let lastS = { x: 0, y: 0 };
  for (const p of pts) {
    const s = projector(p);
    if (!first) {
      const distSq = (s.x - lastS.x)**2 + (s.y - lastS.y)**2;
      if (distSq > 500 * 500) { ctx.stroke(); ctx.beginPath(); ctx.moveTo(s.x, s.y); }
      else { ctx.lineTo(s.x, s.y); }
    } else { ctx.moveTo(s.x, s.y); first = false; }
    lastS = s;
  }
  if (close) ctx.closePath();
  ctx.stroke();
}

function fmtDistShort(m: number): string { if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(1)}M`; if (m >= 1000) return `${(m / 1000).toFixed(0)}K`; return `${m.toFixed(0)}M`; }
function fmtAlt(m: number): string { if (m < 0) return "NIL"; if (m >= 1_000_000) return `${(m / 1_000_000).toFixed(2)}Mm`; if (m >= 1000) return `${(m / 1000).toFixed(1)}km`; return `${m.toFixed(0)}m`; }
