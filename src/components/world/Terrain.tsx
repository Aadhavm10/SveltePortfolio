import { useLayoutEffect, useMemo, useRef } from 'react';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Object3D,
  PlaneGeometry
} from 'three';
import { ABOUT_AREA, BOUNDS, CLASSIC_GATE, LIFE_AREA, PITCH, PROJECT_ROW } from './zones';

/** Deterministic random numbers so the world looks the same on every visit. */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Outside the play area the ground rises into soft hills that frame the world. */
export function terrainHeight(x: number, z: number) {
  const ox = Math.max(BOUNDS.minX - x, x - BOUNDS.maxX, 0);
  const oz = Math.max(BOUNDS.minZ - z, z - BOUNDS.maxZ, 0);
  const out = Math.hypot(ox, oz);
  if (out < 7) return 0;
  const wobble = 0.7 + 0.3 * Math.sin(x * 0.09) * Math.cos(z * 0.11);
  return Math.pow(out - 7, 1.25) * 0.22 * wobble;
}

function grassShade(x: number, z: number) {
  const n = 0.5 + 0.25 * Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) + 0.25 * Math.sin(z * 0.11 + x * 0.05);
  return Math.min(1, Math.max(0, n));
}

function inPitch(x: number, z: number, margin = 0) {
  return x > PITCH.minX - margin && x < PITCH.maxX + margin && z > PITCH.goalLineZ - 3 - margin && z < PITCH.frontZ + margin;
}

/** Spots kept clear of trees, rocks and long grass. */
const CLEARINGS = [
  { x: 0, z: 0, r: 9 },
  { x: 0, z: -9, r: 8 },
  { x: ABOUT_AREA.x, z: ABOUT_AREA.z + 2, r: 7.5 },
  { x: LIFE_AREA.x, z: LIFE_AREA.z + 2, r: 7.5 },
  { x: CLASSIC_GATE.x, z: CLASSIC_GATE.z, r: 6 }
];

function isClear(x: number, z: number) {
  if (inPitch(x, z, 2)) return false;
  if (x > PROJECT_ROW.startX - 6 && z > PROJECT_ROW.z - 2.5 && z < PROJECT_ROW.z + 9) return false;
  return !CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r);
}

interface Item {
  x: number;
  y: number;
  z: number;
  rx?: number;
  ry?: number;
  rz?: number;
  sx: number;
  sy?: number;
  sz?: number;
  color?: string;
}

function Instanced({
  geometry,
  items,
  color = '#ffffff',
  roughness = 0.9,
  flatShading = true,
  castShadow = false,
  receiveShadow = false
}: {
  geometry: BufferGeometry;
  items: Item[];
  color?: string;
  roughness?: number;
  flatShading?: boolean;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const c = new Color();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0);
      o.scale.set(it.sx, it.sy ?? it.sx, it.sz ?? it.sx);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      if (it.color) mesh.setColorAt(i, c.set(it.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow={castShadow} receiveShadow={receiveShadow}>
      <meshStandardMaterial color={color} roughness={roughness} flatShading={flatShading} />
    </instancedMesh>
  );
}

function Ground() {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(280, 260, 140, 130);
    g.rotateX(-Math.PI / 2);
    g.translate(12, 0, -14);
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const light = new Color('#8fca62');
    const dark = new Color('#5f9f45');
    const hill = new Color('#79b457');
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z);
      pos.setY(i, h);
      c.copy(light).lerp(dark, grassShade(x, z));
      if (h > 0) c.lerp(hill, Math.min(1, h / 8));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);

  const { minX, maxX, minZ, maxZ } = BOUNDS;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const hx = (maxX - minX) / 2;
  const hz = (maxZ - minZ) / 2;

  return (
    <>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[160, 1, 160]} position={[0, -1, 0]} friction={1} />
        {/* Invisible walls around the play area */}
        <CuboidCollider args={[hx + 1, 3, 0.5]} position={[cx, 3, minZ - 0.5]} />
        <CuboidCollider args={[hx + 1, 3, 0.5]} position={[cx, 3, maxZ + 0.5]} />
        <CuboidCollider args={[0.5, 3, hz + 1]} position={[minX - 0.5, 3, cz]} />
        <CuboidCollider args={[0.5, 3, hz + 1]} position={[maxX + 0.5, 3, cz]} />
      </RigidBody>
    </>
  );
}

const CANOPY_COLORS = ['#4f9a3f', '#5fae4a', '#3f8a3a', '#6dbb52', '#4f9a3f', '#5fae4a', '#f2a65a', '#ff8b94'];

function Trees() {
  const { trunks, canopies, tops, colliders } = useMemo(() => {
    const rand = seeded(7);
    const spots: { x: number; z: number; s: number }[] = [];
    const { minX, maxX, minZ, maxZ } = BOUNDS;

    // Two loose rows of trees just outside the play area.
    for (const offset of [2.5, 7]) {
      const add = (x: number, z: number) => {
        if (rand() < 0.15) return;
        spots.push({ x: x + (rand() - 0.5) * 2.5, z: z + (rand() - 0.5) * 2.5, s: 0.85 + rand() * 0.7 });
      };
      for (let x = minX - offset; x <= maxX + offset; x += 4.2) {
        add(x, minZ - offset);
        add(x, maxZ + offset);
      }
      for (let z = minZ - offset; z <= maxZ + offset; z += 4.2) {
        add(minX - offset, z);
        add(maxX + offset, z);
      }
    }

    // Groves inside the park.
    const groves = [
      { x: -12, z: -26, n: 6 },
      { x: 30, z: -26, n: 9 },
      { x: 55, z: -30, n: 7 },
      { x: -32, z: -30, n: 8 },
      { x: 26, z: 14, n: 6 },
      { x: -26, z: 13, n: 6 },
      { x: 50, z: 12, n: 5 }
    ];
    for (const g of groves) {
      for (let i = 0; i < g.n; i++) {
        const x = g.x + (rand() - 0.5) * 12;
        const z = g.z + (rand() - 0.5) * 9;
        if (isClear(x, z)) spots.push({ x, z, s: 0.8 + rand() * 0.6 });
      }
    }

    const trunks: Item[] = [];
    const canopies: Item[] = [];
    const tops: Item[] = [];
    const colliders: { x: number; z: number; r: number }[] = [];
    for (const { x, z, s } of spots) {
      const y = terrainHeight(x, z);
      const color = CANOPY_COLORS[Math.floor(rand() * CANOPY_COLORS.length)];
      trunks.push({ x, y, z, sx: s, ry: rand() * 6 });
      canopies.push({ x, y: y + 2.4 * s, z, sx: s * 1.35, sy: s * 1.2, sz: s * 1.35, ry: rand() * 6, color });
      tops.push({ x: x + 0.2 * s, y: y + 3.5 * s, z: z - 0.1 * s, sx: s * 0.85, ry: rand() * 6, color });
      colliders.push({ x, z, r: 0.3 * s });
    }
    return { trunks, canopies, tops, colliders };
  }, []);

  const trunk = useMemo(() => new CylinderGeometry(0.16, 0.26, 1.8, 6).translate(0, 0.9, 0), []);
  const blob = useMemo(() => new IcosahedronGeometry(1, 0), []);

  return (
    <>
      <Instanced geometry={trunk} items={trunks} color="#8b5e3c" castShadow />
      <Instanced geometry={blob} items={canopies} castShadow />
      <Instanced geometry={blob} items={tops} castShadow />
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => (
          <CylinderCollider key={i} args={[1.5, c.r]} position={[c.x, 1.5, c.z]} />
        ))}
      </RigidBody>
    </>
  );
}

const FLOWER_COLORS = ['#ff6b6b', '#ffe66d', '#ffffff', '#ff8b94', '#b8a9ff', '#4ecdc4'];

function Foliage() {
  const { grass, flowers, rocks } = useMemo(() => {
    const rand = seeded(42);
    const { minX, maxX, minZ, maxZ } = BOUNDS;
    const grass: Item[] = [];
    const flowers: Item[] = [];
    const rocks: Item[] = [];
    const greens = ['#5c9e45', '#6aae4c', '#4d8f3c', '#78b956'];

    while (grass.length < 3200) {
      const x = minX - 6 + rand() * (maxX - minX + 12);
      const z = minZ - 6 + rand() * (maxZ - minZ + 12);
      if (inPitch(x, z, 1)) continue;
      // Clumps: denser where the ground noise is dark.
      if (rand() > grassShade(x, z) + 0.25) continue;
      grass.push({
        x,
        y: terrainHeight(x, z),
        z,
        rx: (rand() - 0.5) * 0.5,
        rz: (rand() - 0.5) * 0.5,
        ry: rand() * 6,
        sx: 0.7 + rand() * 0.7,
        sy: 0.6 + rand() * 0.9,
        color: greens[Math.floor(rand() * greens.length)]
      });
    }

    while (flowers.length < 260) {
      const x = minX + rand() * (maxX - minX);
      const z = minZ + rand() * (maxZ - minZ);
      if (!isClear(x, z)) continue;
      flowers.push({ x, y: 0.12, z, sx: 0.07 + rand() * 0.05, color: FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)] });
    }

    while (rocks.length < 40) {
      const x = minX - 8 + rand() * (maxX - minX + 16);
      const z = minZ - 8 + rand() * (maxZ - minZ + 16);
      if (!isClear(x, z)) continue;
      const s = 0.2 + rand() * 0.5;
      rocks.push({ x, y: terrainHeight(x, z) + s * 0.2, z, sx: s, sy: s * 0.6, sz: s * 0.9, ry: rand() * 6, rx: rand() });
    }
    return { grass, flowers, rocks };
  }, []);

  const blade = useMemo(() => new ConeGeometry(0.07, 0.42, 3).translate(0, 0.21, 0), []);
  const blossom = useMemo(() => new IcosahedronGeometry(1, 0), []);
  const rock = useMemo(() => new DodecahedronGeometry(1, 0), []);

  return (
    <>
      <Instanced geometry={blade} items={grass} />
      <Instanced geometry={blossom} items={flowers} roughness={0.6} />
      <Instanced geometry={rock} items={rocks} color="#b9b5ab" castShadow receiveShadow />
    </>
  );
}

/** Flat stepping stones leading from the spawn to each area. */
function Paths() {
  const stones = useMemo(() => {
    const rand = seeded(99);
    const items: Item[] = [];
    const segments: [number, number, number, number][] = [
      [5, -1.4, BOUNDS.maxX - 3, -1.4],
      [-5, -1.4, BOUNDS.minX + 4, -1.4],
      [0, -16.6, 0, PITCH.frontZ + 0.5]
    ];
    const tones = ['#e9dfc8', '#ddd2b8', '#f1e8d4', '#d6cab0'];
    for (const [x1, z1, x2, z2] of segments) {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const count = Math.floor(length / 1.25);
      for (let i = 0; i <= count; i++) {
        const t = i / count;
        items.push({
          x: x1 + (x2 - x1) * t + (rand() - 0.5) * 0.5,
          y: 0.012,
          z: z1 + (z2 - z1) * t + (rand() - 0.5) * 0.5,
          ry: rand() * 6,
          sx: 0.38 + rand() * 0.16,
          sy: 1,
          sz: 0.32 + rand() * 0.14,
          color: tones[Math.floor(rand() * tones.length)]
        });
      }
    }
    return items;
  }, []);
  const stone = useMemo(() => new CylinderGeometry(1, 1, 0.03, 7), []);
  return <Instanced geometry={stone} items={stones} roughness={1} receiveShadow />;
}

export function Terrain() {
  return (
    <>
      <Ground />
      <Trees />
      <Foliage />
      <Paths />
    </>
  );
}
