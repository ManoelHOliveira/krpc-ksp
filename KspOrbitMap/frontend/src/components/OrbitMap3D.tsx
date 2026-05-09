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
    
    // Clear dynamic objects
    sceneRef.current.children = sceneRef.current.children.filter(c => 
        !(c instanceof THREE.Group)
    );
    
    const orbitsGroup = new THREE.Group();
    const bodiesGroup = new THREE.Group();
    sceneRef.current.add(orbitsGroup);
    sceneRef.current.add(bodiesGroup);

    const scale = 100000;
    
    const createOrbitLine = (orbit: any, color: number) => {
      const points = [];
      const { semi_major_axis: a, eccentricity: e, argument_of_periapsis: w, inclination: inc, longitude_of_ascending_node: lan } = orbit;
      for (let i = 0; i <= 128; i++) {
        const th = (2 * Math.PI * i) / 128;
        const r = (a * (1 - e * e)) / (1 + e * Math.cos(th));
        const xp = r * Math.cos(th), yp = r * Math.sin(th);
        const cw = Math.cos(-w), sw = Math.sin(-w);
        const ci = Math.cos(inc), si = Math.sin(inc);
        const cl = Math.cos(-lan), sl = Math.sin(-lan);
        const x1 = xp * cw - yp * sw;
        const y1 = xp * sw + yp * cw;
        const x2 = x1, y2 = y1 * ci, z2 = y1 * si;
        const x = x2 * cl - y2 * sl, y = x2 * sl + y2 * cl, z = z2;
        points.push(new THREE.Vector3(x / scale, z / scale, y / scale));
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color }));
    };

    orbitsGroup.add(createOrbitLine(data.orbit, 0x00ff88));
    if (data.target) {
        orbitsGroup.add(createOrbitLine(data.target.orbit, 0xffdd44));
    }

    if (data.soi_bodies) {
        const centralRadius = Math.max(data.orbit.body_radius / scale, 5);
        const centralSphere = new THREE.Mesh(new THREE.SphereGeometry(centralRadius), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
        bodiesGroup.add(centralSphere);

        data.soi_bodies.forEach(body => {
            const radius = Math.max(body.soi_radius / scale, 2);
            const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius), new THREE.MeshBasicMaterial({ color: 0x0088ff }));
            sphere.position.set(body.pos_x / scale, body.pos_z / scale, body.pos_y / scale);
            bodiesGroup.add(sphere);
        });
    }

    const th = data.orbit.true_anomaly;
    const { semi_major_axis: a, eccentricity: e, argument_of_periapsis: w, inclination: inc, longitude_of_ascending_node: lan } = data.orbit;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(th));
    const xp = r * Math.cos(th), yp = r * Math.sin(th);
    const cw = Math.cos(-w), sw = Math.sin(-w);
    const ci = Math.cos(inc), si = Math.sin(inc);
    const cl = Math.cos(-lan), sl = Math.sin(-lan);
    const x1 = xp * cw - yp * sw, y1 = xp * sw + yp * cw;
    const x2 = x1, y2 = y1 * ci, z2 = y1 * si;
    const x = x2 * cl - y2 * sl, y = x2 * sl + y2 * cl, z = z2;
    const vessel = new THREE.Mesh(new THREE.SphereGeometry(2), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    vessel.position.set(x / scale, z / scale, y / scale);
    bodiesGroup.add(vessel);

  }, [data]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0 }} />;
});

export default OrbitMap3D;
