import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  DoubleSide,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  QuadraticBezierCurve3,
  ShapeGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3
} from 'three';
import { FAIR, POND, PROPS, stallX } from '../layout';
import { Cable } from '../stations/Cable';
import { canvasTexture, DISPLAY_FONT } from '../textures';
import { mergeParts, tinted, type Part } from './merge';
import { seeded } from './palette';

type V3 = [number, number, number];

const WOOD = '#b98656';
const DARK_WOOD = '#8a5a36';
const METAL = '#5a5d66';

const box = (w: number, h: number, d: number, color: string, position: V3, rotation?: V3): Part => ({ geometry: tinted(new BoxGeometry(w, h, d), color), position, rotation });
const cyl = (top: number, bottom: number, h: number, color: string, position: V3, rotation?: V3, segments = 10): Part => ({
  geometry: tinted(new CylinderGeometry(top, bottom, h, segments), color),
  position,
  rotation
});
const ball = (r: number, color: string, position: V3, scale: V3 = [1, 1, 1], detail = 1): Part => ({ geometry: tinted(new IcosahedronGeometry(r, detail), color), position, scale });

const material = new MeshLambertMaterial({ vertexColors: true, flatShading: true });

/** One merged, vertex-coloured mesh built from parts. */
function Prop({ parts, position, rotation = 0, shadow = true }: { parts: () => Part[]; position: V3; rotation?: number; shadow?: boolean }) {
  const geometry = useMemo(() => mergeParts(parts()), []);
  return <mesh geometry={geometry} material={material} position={position} rotation={[0, rotation, 0]} castShadow={shadow} receiveShadow />;
}

// --- Builders (local coordinates, front facing +z) ---

function bench(): Part[] {
  return [
    ...[-0.12, 0.12].map((z) => box(1.9, 0.07, 0.2, WOOD, [0, 0.48, z])),
    ...[0.66, 0.86].map((y) => box(1.9, 0.14, 0.05, WOOD, [0, y, -0.28], [-0.12, 0, 0])),
    ...[-0.8, 0.8].flatMap((x) => [box(0.07, 0.48, 0.5, METAL, [x, 0.24, -0.02]), box(0.07, 0.5, 0.07, METAL, [x, 0.72, -0.28], [-0.12, 0, 0])])
  ];
}

function picnicTable(): Part[] {
  return [
    ...[-0.3, 0, 0.3].map((z) => box(2.0, 0.07, 0.28, WOOD, [0, 0.78, z])),
    ...[-0.85, 0.85].map((z) => box(2.0, 0.06, 0.3, WOOD, [0, 0.46, z])),
    ...[-0.75, 0.75].flatMap((x) => [
      box(0.08, 0.95, 0.08, DARK_WOOD, [x, 0.4, -0.35], [0.55, 0, 0]),
      box(0.08, 0.95, 0.08, DARK_WOOD, [x, 0.4, 0.35], [-0.55, 0, 0]),
      box(0.08, 0.06, 1.9, DARK_WOOD, [x, 0.42, 0])
    ]),
    // A jug of lemonade and two cups
    cyl(0.1, 0.12, 0.28, '#fff2b0', [0.4, 0.96, 0]),
    cyl(0.05, 0.045, 0.1, '#ff8a7a', [-0.2, 0.86, 0.15]),
    cyl(0.05, 0.045, 0.1, '#7cc8e4', [0.0, 0.86, -0.2])
  ];
}

function blanket(): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) parts.push(box(0.5, 0.02, 0.5, (i + j) % 2 ? '#ff8a7a' : '#fffaee', [-0.75 + i * 0.5, 0.012, -0.75 + j * 0.5]));
  // Basket with a handle, and some fruit
  parts.push(box(0.5, 0.3, 0.36, '#c99a68', [0.45, 0.17, -0.3]));
  parts.push({ geometry: tinted(new TorusGeometry(0.2, 0.025, 6, 16, Math.PI), DARK_WOOD), position: [0.45, 0.32, -0.3] });
  parts.push(ball(0.08, '#ff6b5b', [-0.35, 0.08, 0.35]));
  parts.push(ball(0.08, '#ffc25c', [-0.2, 0.08, 0.45]));
  parts.push(ball(0.08, '#79c37d', [-0.45, 0.08, 0.5]));
  return parts;
}

function flowerBed(w: number, d: number, seed: number): Part[] {
  const rand = seeded(seed);
  const colors = ['#ff8a7a', '#ffe27a', '#ff9ec3', '#fffaee', '#c9a6ff'];
  const parts: Part[] = [box(w, 0.32, d, DARK_WOOD, [0, 0.16, 0]), box(w - 0.12, 0.04, d - 0.12, '#6b4a33', [0, 0.32, 0])];
  for (let i = 0; i < w * d * 9; i++) {
    const x = (rand() - 0.5) * (w - 0.3);
    const z = (rand() - 0.5) * (d - 0.3);
    parts.push(cyl(0.012, 0.012, 0.3, '#5d8d3b', [x, 0.48, z], undefined, 4));
    parts.push(ball(0.07 + rand() * 0.04, colors[Math.floor(rand() * colors.length)], [x, 0.66, z], [1, 0.7, 1], 0));
    if (i % 2) parts.push(ball(0.09, '#6fa843', [x + 0.08, 0.4, z], [1, 0.5, 1], 0));
  }
  return parts;
}

function mushrooms(seed: number): Part[] {
  const rand = seeded(seed);
  const parts: Part[] = [];
  for (let i = 0; i < 4; i++) {
    const x = (rand() - 0.5) * 0.9;
    const z = (rand() - 0.5) * 0.9;
    const s = 0.6 + rand() * 0.6;
    parts.push(cyl(0.05 * s, 0.07 * s, 0.22 * s, '#fffaee', [x, 0.11 * s, z]));
    parts.push({ geometry: tinted(new SphereGeometry(0.16 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), '#e0604a'), position: [x, 0.2 * s, z] });
    for (let k = 0; k < 3; k++) {
      const a = rand() * Math.PI * 2;
      parts.push(ball(0.025 * s, '#fffaee', [x + Math.cos(a) * 0.09 * s, 0.32 * s, z + Math.sin(a) * 0.09 * s], [1, 0.5, 1], 0));
    }
  }
  return parts;
}

function log(length: number): Part[] {
  return [cyl(0.32, 0.32, length, '#8a5d3b', [0, 0.3, 0], [0, 0, Math.PI / 2], 9), ...[-1, 1].map((side) => cyl(0.27, 0.27, 0.02, '#d9b48a', [(side * length) / 2, 0.3, 0], [0, 0, Math.PI / 2], 9))];
}

function stump(): Part[] {
  return [cyl(0.42, 0.5, 0.5, '#8a5d3b', [0, 0.25, 0], undefined, 9), cyl(0.38, 0.38, 0.02, '#d9b48a', [0, 0.51, 0], undefined, 9), ball(0.12, '#6fa843', [0.35, 0.1, 0.25], [1, 0.6, 1], 0)];
}

function bin(): Part[] {
  return [cyl(0.3, 0.26, 0.85, '#5f9a5a', [0, 0.43, 0], undefined, 12), cyl(0.33, 0.33, 0.07, '#4a7a46', [0, 0.88, 0], undefined, 12), box(0.14, 0.05, 0.03, '#fffaee', [0, 0.6, 0.29])];
}

function cone(): Part[] {
  return [box(0.36, 0.03, 0.36, '#ff8a3d', [0, 0.015, 0]), cyl(0.02, 0.13, 0.32, '#ff8a3d', [0, 0.18, 0], undefined, 10), cyl(0.07, 0.085, 0.05, '#fffaee', [0, 0.2, 0], undefined, 10)];
}

function bicycle(): Part[] {
  const wheel = (x: number): Part[] => [
    { geometry: tinted(new TorusGeometry(0.33, 0.035, 6, 20), '#2f2f36'), position: [x, 0.36, 0] },
    cyl(0.03, 0.03, 0.08, '#c5ccd2', [x, 0.36, 0], [Math.PI / 2, 0, 0], 8)
  ];
  const tube = (from: V3, to: V3, color = '#7cc8e4'): Part => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const len = a.distanceTo(b);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    return cyl(0.025, 0.025, len, color, [mid.x, mid.y, mid.z], [0, 0, angle - Math.PI / 2], 6);
  };
  return [
    ...wheel(-0.5),
    ...wheel(0.5),
    tube([-0.5, 0.36, 0], [-0.05, 0.36, 0]),
    tube([-0.05, 0.36, 0], [-0.15, 0.78, 0]),
    tube([-0.5, 0.36, 0], [-0.15, 0.78, 0]),
    tube([-0.05, 0.36, 0], [0.38, 0.8, 0]),
    tube([-0.15, 0.78, 0], [0.38, 0.8, 0]),
    tube([0.38, 0.8, 0], [0.5, 0.36, 0]),
    box(0.22, 0.05, 0.1, '#2f2f36', [-0.17, 0.83, 0]),
    box(0.04, 0.04, 0.42, '#2f2f36', [0.4, 0.95, 0]),
    tube([0.38, 0.8, 0], [0.4, 0.95, 0], '#2f2f36'),
    // Front basket with flowers
    box(0.28, 0.2, 0.3, '#c99a68', [0.62, 0.85, 0]),
    ball(0.07, '#ff9ec3', [0.6, 0.98, 0.06], [1, 0.8, 1], 0),
    ball(0.07, '#ffe27a', [0.66, 0.98, -0.06], [1, 0.8, 1], 0)
  ];
}

function tent(): Part[] {
  const shape = new Shape();
  shape.moveTo(-1.2, 0);
  shape.lineTo(1.2, 0);
  shape.lineTo(0, 1.6);
  shape.closePath();
  const side = new ShapeGeometry(shape);
  return [
    // Two sloped canvas panels and the back
    box(2.0, 0.04, 2.0, '#ffb36b', [-0.6, 0.8, 0], [0, 0, 0.93]),
    box(2.0, 0.04, 2.0, '#ff9b52', [0.6, 0.8, 0], [0, 0, -0.93]),
    { geometry: tinted(side, '#e8894a'), position: [0, 0, -1] },
    // Door flaps, pulled open
    { geometry: tinted(new ShapeGeometry(shape), '#fff2c8'), position: [0, 0, 1.0], scale: [0.45, 0.9, 1] },
    cyl(0.03, 0.03, 1.75, DARK_WOOD, [0, 0.87, 1.02], undefined, 6),
    cyl(0.03, 0.03, 1.75, DARK_WOOD, [0, 0.87, -1.02], undefined, 6),
    // Pegs
    ...[
      [-1.8, 1.4],
      [1.8, 1.4],
      [-1.8, -1.4],
      [1.8, -1.4]
    ].map(([x, z]) => cyl(0.03, 0.01, 0.2, DARK_WOOD, [x, 0.08, z], undefined, 5))
  ];
}

function campfireBase(): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push({ geometry: tinted(new DodecahedronGeometry(0.16, 0), '#9d978c'), position: [Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55], scale: [1, 0.7, 1] });
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    parts.push(cyl(0.06, 0.06, 0.8, '#6e4a33', [0, 0.14, 0], [Math.PI / 2 - 0.2, a, 0], 6));
  }
  return parts;
}

function veggiePatch(): Part[] {
  const parts: Part[] = [box(3.6, 0.1, 2.6, '#6b4a33', [0, 0.05, 0])];
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const x = -1.5 + i * 0.6;
      const z = -0.85 + row * 0.85;
      if (row === 0) parts.push(ball(0.2, '#8fc46a', [x, 0.25, z], [1, 0.8, 1], 1));
      else if (row === 1) parts.push(...[-0.08, 0, 0.08].map((dx) => ({ geometry: tinted(new ConeGeometry(0.04, 0.32, 4), '#6fa843'), position: [x + dx, 0.26, z] as V3 })));
      else parts.push(ball(0.11, '#ff6b5b', [x, 0.22, z]), ball(0.14, '#5d8d3b', [x, 0.36, z], [1, 0.6, 1], 0));
    }
  }
  // Picket fence round three sides, open at the front
  const picket = (x: number, z: number): Part => box(0.08, 0.6, 0.04, '#fffaee', [x, 0.3, z]);
  for (let x = -1.9; x <= 1.91; x += 0.3) parts.push(picket(x, -1.45));
  for (let z = -1.15; z <= 1.3; z += 0.3) parts.push(picket(-1.9, z), picket(1.9, z));
  parts.push(box(3.9, 0.06, 0.04, '#fffaee', [0, 0.45, -1.45]));
  parts.push(box(0.04, 0.06, 2.9, '#fffaee', [-1.9, 0.45, 0]), box(0.04, 0.06, 2.9, '#fffaee', [1.9, 0.45, 0]));
  return parts;
}

function dock(): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < 9; i++) parts.push(box(1.4, 0.07, 0.3, i % 3 ? WOOD : '#c99a68', [0, 0.12, i * 0.34]));
  for (const z of [0.2, 1.5, 2.8]) for (const x of [-0.65, 0.65]) parts.push(cyl(0.07, 0.07, 0.8, DARK_WOOD, [x, -0.15, z], undefined, 6));
  // Bucket and a fishing rod resting on the end
  parts.push(cyl(0.16, 0.13, 0.3, '#7cc8e4', [0.45, 0.31, 2.6]));
  parts.push(cyl(0.012, 0.02, 2.2, DARK_WOOD, [-0.3, 0.35, 2.2], [0.9, 0.2, 0], 5));
  return parts;
}

function bannerTexture() {
  return canvasTexture(1024, 220, (ctx, w, h) => {
    ctx.fillStyle = '#fffaee';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ff8a7a';
    ctx.fillRect(0, 0, w, 18);
    ctx.fillRect(0, h - 18, w, 18);
    ctx.fillStyle = '#5a3d27';
    ctx.font = `700 120px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Project fair', w / 2, h / 2 + 6);
  });
}

/** Triangle flags along a sagging rope between two points. */
function Bunting({ from, to, sag = 0.5 }: { from: V3; to: V3; sag?: number }) {
  const { rope, flags } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= sag;
    const curve = new QuadraticBezierCurve3(a, mid, b);
    const rope = new TubeGeometry(curve, 20, 0.015, 4, false);
    const colors = ['#ff8a7a', '#ffc25c', '#7cc8e4', '#79c37d', '#c9a6ff', '#ff9ec3'];
    const shape = new Shape();
    shape.moveTo(-0.16, 0);
    shape.lineTo(0.16, 0);
    shape.lineTo(0, -0.34);
    shape.closePath();
    const count = Math.max(4, Math.round(a.distanceTo(b) / 0.45));
    const parts: Part[] = [];
    const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
    for (let i = 1; i < count; i++) {
      const p = curve.getPoint(i / count);
      parts.push({ geometry: tinted(new ShapeGeometry(shape), colors[i % colors.length]), position: [p.x, p.y, p.z], rotation: [0, yaw, 0] });
    }
    return { rope, flags: mergeParts(parts) };
  }, [from, to, sag]);
  return (
    <>
      <mesh geometry={rope}>
        <meshBasicMaterial color="#6b5a4c" />
      </mesh>
      <mesh geometry={flags}>
        <meshLambertMaterial vertexColors side={DoubleSide} />
      </mesh>
    </>
  );
}

/** Flames that flicker, and a soft glow on the ground. */
function Flames() {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    group.current?.children.forEach((child, i) => {
      const s = 0.8 + Math.sin(t * (9 + i * 3) + i) * 0.15 + Math.sin(t * 17 + i * 2) * 0.08;
      child.scale.set(s, s * (1.1 + Math.sin(t * 7 + i) * 0.2), s);
    });
  });
  return (
    <group ref={group} position={[0, 0.2, 0]}>
      {[
        ['#ffb347', 0.22, 0.7, 0],
        ['#ff7a3d', 0.16, 0.55, 0.08],
        ['#fff2b0', 0.1, 0.4, -0.05]
      ].map(([color, r, h, x], i) => (
        <mesh key={i} position={[x as number, (h as number) / 2, 0]}>
          <coneGeometry args={[r as number, h as number, 7]} />
          <meshBasicMaterial color={color as string} toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 24]} />
        <meshBasicMaterial color="#ffb347" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** Butterflies flitting around a few flowery spots. */
function Butterflies() {
  const COUNT = 14;
  const ref = useRef<InstancedMesh>(null);
  const homes = useMemo(() => {
    const spots: V3[] = [
      [8.5, 0, 7.2],
      [-12.5, 0, 11.5],
      [-37, 0, 21],
      [-6, 0, -35],
      [-29.5, 0, 19.5],
      [20, 0, 8]
    ];
    const rand = seeded(808);
    return Array.from({ length: COUNT }, (_, i) => ({ home: spots[i % spots.length], phase: rand() * 10, speed: 0.4 + rand() * 0.4, r: 1 + rand() * 1.5, color: ['#ffe27a', '#ff9ec3', '#fffaee', '#9fd8ff'][i % 4] }));
  }, []);
  const geometry = useMemo(() => {
    const wing = new PlaneGeometry(0.16, 0.12);
    return mergeParts([
      { geometry: wing, position: [-0.08, 0, 0], rotation: [-Math.PI / 2, 0, 0] },
      { geometry: wing, position: [0.08, 0, 0], rotation: [-Math.PI / 2, 0, 0] }
    ]);
  }, []);
  const mat = useMemo(() => new MeshBasicMaterial({ side: DoubleSide, toneMapped: false }), []);
  const o = useMemo(() => new Object3D(), []);
  useLayoutEffect(() => {
    homes.forEach((h, i) => ref.current?.setColorAt(i, new Color(h.color)));
    if (ref.current?.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [homes]);
  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = state.clock.elapsedTime;
    homes.forEach((b, i) => {
      const a = t * b.speed + b.phase;
      o.position.set(b.home[0] + Math.cos(a) * b.r + Math.sin(a * 2.3) * 0.4, 0.9 + Math.sin(a * 1.7) * 0.4, b.home[2] + Math.sin(a * 1.3) * b.r);
      o.rotation.set(0, -a, 0);
      // Flap: squash across the body.
      o.scale.set(Math.abs(Math.sin(t * 14 + b.phase)) * 0.9 + 0.1, 1, 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geometry, mat, COUNT]} frustumCulled={false} />;
}

/** Three ducks paddling round the pond. */
function Ducks() {
  const group = useRef<Group>(null);
  const duck = useMemo(
    () =>
      mergeParts([
        ball(0.22, '#fffaee', [0, 0.1, 0], [1, 0.7, 1.35]),
        ball(0.13, '#fffaee', [0, 0.32, 0.22]),
        { geometry: tinted(new ConeGeometry(0.05, 0.14, 6), '#ffb347'), position: [0, 0.3, 0.38], rotation: [Math.PI / 2, 0, 0] },
        ball(0.025, '#2f2f36', [0.08, 0.36, 0.3], [1, 1, 1], 0),
        ball(0.025, '#2f2f36', [-0.08, 0.36, 0.3], [1, 1, 1], 0),
        { geometry: tinted(new ConeGeometry(0.1, 0.18, 5), '#fffaee'), position: [0, 0.16, -0.32], rotation: [-1.9, 0, 0] }
      ]),
    []
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    group.current?.children.forEach((child, i) => {
      const a = t * 0.08 * (i % 2 ? 1 : -1) + i * 2.1;
      const r = 0.55 + i * 0.1;
      child.position.set(POND.x + Math.cos(a) * POND.rx * r, -0.08 + Math.sin(t * 2 + i) * 0.02, POND.z + Math.sin(a) * POND.rz * r);
      const dx = -Math.sin(a) * POND.rx * (i % 2 ? 1 : -1);
      const dz = Math.cos(a) * POND.rz * (i % 2 ? 1 : -1);
      child.rotation.y = Math.atan2(dx, dz);
    });
  });
  return (
    <group ref={group}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={duck} material={material} scale={i === 2 ? 0.6 : 1} castShadow />
      ))}
    </group>
  );
}

/** A kite tugging on its string high over the field. */
function Kite() {
  const kite = useRef<Group>(null);
  const tail = useRef<Group>(null);
  const anchor = useMemo(() => new Vector3(-6.4, 0.1, 9.4), []);
  const geometry = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0.9);
    shape.lineTo(0.55, 0);
    shape.lineTo(0, -1.2);
    shape.lineTo(-0.55, 0);
    shape.closePath();
    return new ShapeGeometry(shape);
  }, []);
  // The string is a thin line whose points are recomputed as the kite drifts.
  const string = useMemo(() => {
    const g = new BufferGeometry().setFromPoints(Array.from({ length: 25 }, () => new Vector3()));
    return new Line(g, new LineBasicMaterial({ color: '#fff6e8', transparent: true, opacity: 0.45 }));
  }, []);
  const curve = useMemo(() => new QuadraticBezierCurve3(new Vector3(), new Vector3(), new Vector3()), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const pos = new Vector3(-3 + Math.sin(t * 0.3) * 2.5, 17 + Math.sin(t * 0.7) * 1.2, -6 + Math.cos(t * 0.25) * 1.5);
    if (kite.current) {
      kite.current.position.copy(pos);
      kite.current.rotation.set(-0.5 + Math.sin(t * 1.1) * 0.1, 0.2, Math.sin(t * 0.9) * 0.25);
    }
    tail.current?.children.forEach((c, i) => (c.position.x = Math.sin(t * 3 + i) * 0.15 * i));
    curve.v0.copy(anchor);
    curve.v2.copy(pos).add(new Vector3(0, -1.0, 0));
    curve.v1.copy(anchor).lerp(curve.v2, 0.5).add(new Vector3(0, -3, 0));
    const attr = string.geometry.getAttribute('position');
    for (let i = 0; i < attr.count; i++) {
      const p = curve.getPoint(i / (attr.count - 1));
      attr.setXYZ(i, p.x, p.y, p.z);
    }
    attr.needsUpdate = true;
  });
  return (
    <>
      <group ref={kite}>
        <mesh geometry={geometry}>
          <meshBasicMaterial color="#ff8a7a" side={DoubleSide} toneMapped={false} />
        </mesh>
        <mesh geometry={geometry} scale={[0.5, 0.5, 1]} position={[0, 0, 0.01]}>
          <meshBasicMaterial color="#ffe27a" side={DoubleSide} toneMapped={false} />
        </mesh>
        <group ref={tail} position={[0, -1.2, 0]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[0, -0.35 * (i + 1), 0]} rotation={[0, 0, Math.PI / 4]}>
              <planeGeometry args={[0.16, 0.16]} />
              <meshBasicMaterial color={['#7cc8e4', '#ffc25c', '#ff9ec3'][i % 3]} side={DoubleSide} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>
      <primitive object={string} frustumCulled={false} />
      <Prop position={[anchor.x, 0, anchor.z]} parts={() => [cyl(0.04, 0.02, 0.5, DARK_WOOD, [0, 0.2, 0], undefined, 5)]} />
    </>
  );
}

/** Benches, bins, beds, a campsite and a hundred little things between the places. */
export function Details() {
  const banner = useMemo(bannerTexture, []);
  const { x: sbx, z: sbz } = PROPS.scoreboard;
  const fairSign: V3 = [FAIR.firstX - 4.3, 0, FAIR.z + 1];
  return (
    <>
      {/* Benches looking at things */}
      {(
        [
          [-10.5, 8.6, Math.PI],
          [21, -31.6, Math.PI],
          [26, 19.6, Math.PI],
          [38, 19.6, Math.PI],
          [-36, 1.6, Math.PI]
        ] as const
      ).map(([x, z, r], i) => (
        <Prop key={`bench${i}`} position={[x, 0, z]} rotation={r} parts={bench} />
      ))}
      {/* Picnic spot between the desk and the fair */}
      <Prop position={[23, 0, 3.5]} rotation={0.2} parts={picnicTable} />
      <Prop position={[27.5, 0, 5.2]} rotation={-0.3} parts={blanket} shadow={false} />
      {/* Flower beds */}
      <Prop position={[8.5, 0, 7.2]} parts={() => flowerBed(2.4, 1, 1)} />
      <Prop position={[-12.5, 0, 11.5]} rotation={0.15} parts={() => flowerBed(2.4, 1, 2)} />
      <Prop position={[PROPS.cottage.x - 2.6, 0, PROPS.cottage.z + 2.95]} parts={() => flowerBed(1.4, 0.6, 3)} />
      <Prop position={[PROPS.cottage.x + 2.6, 0, PROPS.cottage.z + 2.95]} parts={() => flowerBed(1.4, 0.6, 4)} />
      <Prop position={[PROPS.globe.x + 3.2, 0, PROPS.globe.z + 1.2]} rotation={0.6} parts={() => flowerBed(1.6, 0.8, 5)} />
      {/* Mushrooms, logs and stumps in the grass */}
      {(
        [
          [-21.5, -13],
          [11.5, -27.5],
          [-47, -11],
          [44, -27],
          [-26, 9],
          [41, 9],
          [-12, -42],
          [48, -12]
        ] as const
      ).map(([x, z], i) => (
        <Prop key={`m${i}`} position={[x, 0, z]} parts={() => mushrooms(30 + i)} shadow={false} />
      ))}
      <Prop position={[-46, 0, -19]} rotation={0.3} parts={() => log(2.2)} />
      <Prop position={[46, 0, -1]} rotation={1.2} parts={() => log(1.8)} />
      <Prop position={[-17, 0, 13]} rotation={-0.4} parts={() => log(1.6)} />
      {(
        [
          [-50, 0],
          [24, -46],
          [-4, 14]
        ] as const
      ).map(([x, z], i) => (
        <Prop key={`s${i}`} position={[x, 0, z]} rotation={i} parts={stump} />
      ))}
      {/* Bins by the paths */}
      {(
        [
          [14.6, -3.6],
          [-14.4, 8.4],
          [33.5, 19.4],
          [-20.5, -30.5],
          [8, -24.5]
        ] as const
      ).map(([x, z], i) => (
        <Prop key={`b${i}`} position={[x, 0, z]} parts={bin} />
      ))}
      {/* Training cones beside the pitch */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Prop key={`c${i}`} position={[-18 - (i % 2) * 1.6, 0, -10 - i * 1.3]} parts={cone} shadow={false} />
      ))}
      {/* Fair: welcome sign with bunting, and a bike leaning by the street */}
      <group position={fairSign}>
        <Prop position={[0, 0, 0]} parts={() => [box(0.16, 3.2, 0.16, DARK_WOOD, [-1.5, 1.6, 0]), box(0.16, 3.2, 0.16, DARK_WOOD, [1.5, 1.6, 0]), box(3.4, 0.9, 0.1, DARK_WOOD, [0, 2.75, 0])]} />
        <mesh position={[0, 2.75, 0.06]}>
          <planeGeometry args={[3.2, 0.72]} />
          <meshLambertMaterial map={banner} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[1.6, 0.15]} position={[-1.5, 1.6, 0]} />
          <CylinderCollider args={[1.6, 0.15]} position={[1.5, 1.6, 0]} />
        </RigidBody>
      </group>
      <Bunting from={[fairSign[0] + 1.5, 3.15, fairSign[2]]} to={[stallX(0) - 2, 3.7, FAIR.z + 1.2]} sag={0.4} />
      <Prop position={[13.8, 0, 18.3]} rotation={0.4} parts={bicycle} />
      {/* Campsite in the woods behind the court */}
      <Prop position={[-44.5, 0, -28.5]} rotation={0.6} parts={tent} />
      <Cable color="#fffaee" plug="#8a5a36" radius={0.012} points={[[-44.5 + 0.6, 1.72, -28.5 + 0.8], [-43.1, 0.9, -27.6], [-42.6, 0.08, -27.2]]} />
      <group position={[-40.5, 0, -25.5]}>
        <Prop position={[0, 0, 0]} parts={campfireBase} />
        <group userData={{ dynamic: true }}>
          <Flames />
        </group>
        <Prop position={[0, 0, 1.6]} parts={() => log(1.4)} />
        <Prop position={[-1.5, 0, -0.4]} rotation={1.2} parts={() => log(1.4)} />
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[0.3, 0.7]} position={[0, 0.3, 0]} />
        </RigidBody>
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.3, 0.8, 1.1]} position={[-44.5, 0.8, -28.5]} rotation={[0, 0.6, 0]} />
      </RigidBody>
      {/* Cottage garden: vegetables and a washing line */}
      <Prop position={[-29.5, 0, 19.5]} parts={veggiePatch} />
      <Prop position={[-44, 0, 22]} parts={() => [box(0.12, 2, 0.12, DARK_WOOD, [0, 1, 0]), box(0.8, 0.1, 0.1, DARK_WOOD, [0, 1.95, 0])]} />
      <Prop position={[-40.6, 0, 23.6]} parts={() => [box(0.12, 2, 0.12, DARK_WOOD, [0, 1, 0]), box(0.8, 0.1, 0.1, DARK_WOOD, [0, 1.95, 0])]} />
      <Cable color="#fffaee" plug="#fffaee" radius={0.012} points={[[-44, 1.95, 22], [-42.3, 1.75, 22.8], [-40.6, 1.95, 23.6]]} />
      {(
        [
          [-43.3, '#fffaee', 0.5],
          [-42.5, '#ff8a7a', 0.36],
          [-41.6, '#7cc8e4', 0.42]
        ] as const
      ).map(([x, color, size], i) => (
        <mesh key={i} position={[x, 1.55, 22 + ((x + 44) / 3.4) * 1.6]} rotation={[0, -0.44, 0]}>
          <planeGeometry args={[size, size * 0.9]} />
          <meshLambertMaterial color={color} side={DoubleSide} />
        </mesh>
      ))}
      {/* A dock reaching into the pond */}
      <Prop position={[5.8, 0, -36.2]} rotation={2.0} parts={dock} />
      <group userData={{ dynamic: true }}>
        <Ducks />
      </group>
      {/* Scoreboard power: a cable to a little grey box */}
      <Prop position={[sbx + 2.2, 0, sbz - 2.4]} parts={() => [box(0.5, 0.6, 0.35, '#9aa3ab', [0, 0.3, 0]), box(0.3, 0.06, 0.02, '#ffc25c', [0, 0.45, 0.18])]} />
      <Cable color="#2f2f36" plug="#45474d" radius={0.035} points={[[sbx + 0.5, 0.6, sbz - 0.3], [sbx + 0.7, 0.04, sbz - 0.8], [sbx + 1.6, 0.04, sbz - 1.9], [sbx + 2.2, 0.3, sbz - 2.25]]} />
      <group userData={{ dynamic: true }}>
        <Kite />
        <Butterflies />
      </group>
      <RigidBody type="fixed" colliders={false}>
        {/* Benches and the picnic table */}
        {(
          [
            [-10.5, 8.6],
            [21, -31.6],
            [26, 19.6],
            [38, 19.6],
            [-36, 1.6]
          ] as const
        ).map(([x, z], i) => (
          <CuboidCollider key={i} args={[0.95, 0.45, 0.3]} position={[x, 0.45, z]} />
        ))}
        <CuboidCollider args={[1.0, 0.45, 1.0]} position={[23, 0.45, 3.5]} />
      </RigidBody>
    </>
  );
}
