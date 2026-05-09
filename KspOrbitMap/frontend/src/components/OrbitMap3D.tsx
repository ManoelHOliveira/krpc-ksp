import { useEffect, useRef, forwardRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import type { ServerData } from "../types";

interface Props {
  data: ServerData;
  send: (msg: object) => void;
}

export interface OrbitMapHandle {
  autoFit: () => void;
}

const OrbitMap3D = forwardRef<OrbitMapHandle, Props>(({ data }, ref) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const objectsGroup = useRef(new THREE.Group());

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000000);
    camera.position.set(50, 50, 50);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    scene.add(new THREE.AmbientLight(0xffffff, 1));
    scene.add(new THREE.GridHelper(100, 10));
    scene.add(objectsGroup.current);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    if (!sceneRef.current || !data.orbit) return;
    
    objectsGroup.current.clear();
    const scale = 100000;

    const createLabel = (text: string) => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 64;
      const context = canvas.getContext('2d')!;
      context.font = 'Bold 40px Arial';
      context.fillStyle = 'white';
      context.textAlign = 'center'; // Center horizontally
      context.fillText(text, 128, 40);
      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({ map: texture });
      return new THREE.Sprite(material);
    };

    // 1. Draw Kerbin (Central Body)
    const centralRadius = Math.max(data.orbit.body_radius / scale, 5);
    const kerbin = new THREE.Mesh(
      new THREE.SphereGeometry(centralRadius), 
      new THREE.MeshBasicMaterial({ color: 0x4488ff })
    );
    objectsGroup.current.add(kerbin);
    
    // Add Label
    const label = createLabel("Kerbin");
    label.position.set(0, centralRadius + 5, 0); 
    // Proportional scale for text: canvas is 256x64 (4:1 ratio)
    label.scale.set(20, 5, 1); 
    objectsGroup.current.add(label);
    
    console.log("Rendering Kerbin at 0,0,0 with label");

    // 2. Draw Orbit (Centered)
    const points = [];
    const { semi_major_axis: a, eccentricity: e, argument_of_periapsis: w, inclination: inc, longitude_of_ascending_node: lan } = data.orbit;
    for (let i = 0; i <= 128; i++) {
        const th = (2 * Math.PI * i) / 128;
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(th));
        const xp = r * Math.cos(th), yp = r * Math.sin(th);
        const cw = Math.cos(w), sw = Math.sin(w);
        const ci = Math.cos(inc), si = Math.sin(inc);
        const cl = Math.cos(lan), sl = Math.sin(lan);
        const x1 = xp * cw - yp * sw;
        const y1 = xp * sw + yp * cw;
        const x2 = x1;
        const y2 = y1 * ci;
        const z2 = y1 * si;
        const x = x2 * cl - y2 * sl;
        const y = x2 * sl + y2 * cl;
        const z = z2;
        points.push(new THREE.Vector3(x / scale, z / scale, y / scale));
    }
    const orbitLine = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(points), 
        new THREE.LineBasicMaterial({ color: 0xffffff }) // White line
    );
    objectsGroup.current.add(orbitLine);
    console.log("Rendering Kerbin Orbit");

  }, [data]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />;
});

export default OrbitMap3D;
