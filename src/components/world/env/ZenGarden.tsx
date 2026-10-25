import { useLayoutEffect, useMemo, useRef } from 'react';
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  SphereGeometry
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { POND, WATERFALL, ZEN_GARDEN } from '../layout';
import { canvasTexture } from '../textures';
import { bridges } from './Streams';
import { swayingMaterial } from './Foliage';
import { seeded } from './palette';

/** Rocks in the raked sand, relative to the garden centre: [x, z, size]. */
const ROCKS: [number, number, number][] = [
  [-2.3, -0.7, 0.85],
  [1.5, 0.8, 0.6],
  [2.8, -1.4, 0.42]
];

const SAND_PX = 96;

function rakedSand() {
  const { w, d } = ZEN_GARDEN;
  return canvasTexture(Math.round(w * SAND_PX), Math.round(d * SAND_PX), (ctx, width, height) => {
    const px = (m: number) => m * SAND_PX;
    ctx.fillStyle = '#f1e8d4';
    ctx.fillRect(0, 0, width, height);
    const groove = (path: () => void) => {
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(160, 140, 105, 0.42)';
      path();
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 250, 0.7)';
      ctx.save();
      ctx.translate(0, -4);
      path();
      ctx.stroke();
      ctx.restore();
    };
    // Straight rake lines everywhere...
    for (let y = px(0.18); y < height; y += px(0.2)) {
      groove(() => {
        ctx.beginPath();
        ctx.moveTo(0, y);
        for (let x = 0; x <= width; x += 24) ctx.lineTo(x, y + Math.sin(x * 0.004 + y) * 2);
      });
    }
    // ...then smoothed flat around each rock and raked in rings.
    for (const [rx, rz, s] of ROCKS) {
      const cx = px(rx + w / 2);
      const cy = px(rz + d / 2);
      const outer = px(s * 2.1);
      ctx.fillStyle = '#f1e8d4';
      ctx.beginPath();
      ctx.arc(cx, cy, outer + 6, 0, Math.PI * 2);
      ctx.fill();
      for (let r = px(s * 1.1); r <= outer; r += px(0.2)) {
        groove(() => {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        });
      }
    }
  });
}

/** Bakes one colour per part into vertex colours so a whole prop is one draw call. */
function tinted(geometry: BufferGeometry, color: string) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const c = new Color(color);
  const count = g.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) colors.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.deleteAttribute('uv');
  return g;
}

function lanternGeometry() {
  const stone = '#c9c1b2';
  const dark = '#a9a090';
  return mergeGeometries([
    tinted(new CylinderGeometry(0.3, 0.36, 0.14, 6).translate(0, 0.07, 0), dark),
    tinted(new CylinderGeometry(0.1, 0.13, 0.7, 6).translate(0, 0.49, 0), stone),
    tinted(new CylinderGeometry(0.3, 0.26, 0.1, 6).translate(0, 0.89, 0), dark),
    tinted(new CylinderGeometry(0.06, 0.06, 0.3, 4).translate(0.15, 1.09, 0.15), stone),
    tinted(new CylinderGeometry(0.06, 0.06, 0.3, 4).translate(-0.15, 1.09, 0.15), stone),
    tinted(new CylinderGeometry(0.06, 0.06, 0.3, 4).translate(0.15, 1.09, -0.15), stone),
    tinted(new CylinderGeometry(0.06, 0.06, 0.3, 4).translate(-0.15, 1.09, -0.15), stone),
    tinted(new ConeGeometry(0.46, 0.3, 6).translate(0, 1.39, 0), dark),
    tinted(new SphereGeometry(0.08, 8, 6).translate(0, 1.58, 0), stone)
  ]);
}

/** Stone lanterns with a warm glow, by the garden, the pond, the falls and each bridge. */
function Lanterns() {
  const spots = useMemo(() => {
    const list: { x: number; z: number; ry: number }[] = [
      { x: ZEN_GARDEN.x + ZEN_GARDEN.w / 2 + 0.9, z: ZEN_GARDEN.z + ZEN_GARDEN.d / 2 - 0.4, ry: 0.3 },
      { x: POND.x - 11.4, z: POND.z + 6.4, ry: 0.1 },
      { x: WATERFALL.x + 4.2, z: WATERFALL.z + 2.2, ry: 0.5 },
      { x: WATERFALL.x - 4.4, z: WATERFALL.z + 2.4, ry: -0.4 }
    ];
    // One at the south end of each bridge, just off the deck.
    for (const b of bridges) {
      const end = b.length / 2 + 0.7;
      const nx = -b.tz;
      const nz = b.tx;
      const sign = nz > 0 ? 1 : -1;
      list.push({ x: b.x + nx * end * sign + b.tx * 1.7, z: b.z + nz * end * sign + b.tz * 1.7, ry: b.yaw });
    }
    return list;
  }, []);
  const stone = useRef<InstancedMesh>(null);
  const glow = useRef<InstancedMesh>(null);
  const geometries = useMemo(() => ({ stone: lanternGeometry(), glow: new BoxGeometry(0.24, 0.24, 0.24) }), []);
  const materials = useMemo(
    () => ({
      stone: new MeshLambertMaterial({ vertexColors: true, flatShading: true }),
      glow: new MeshBasicMaterial({ color: '#ffd98a', toneMapped: false })
    }),
    []
  );
  useLayoutEffect(() => {
    const o = new Object3D();
    spots.forEach((s, i) => {
      o.position.set(s.x, 0, s.z);
      o.rotation.set(0, s.ry, 0);
      o.updateMatrix();
      stone.current?.setMatrixAt(i, o.matrix);
      o.position.y = 1.09;
      o.updateMatrix();
      glow.current?.setMatrixAt(i, o.matrix);
    });
    for (const mesh of [stone.current, glow.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [spots]);

  return (
    <>
      <instancedMesh ref={stone} args={[geometries.stone, materials.stone, spots.length]} castShadow receiveShadow />
      <instancedMesh ref={glow} args={[geometries.glow, materials.glow, spots.length]} />
      <RigidBody type="fixed" colliders={false}>
        {spots.map((s, i) => (
          <CylinderCollider key={i} args={[0.75, 0.3]} position={[s.x, 0.75, s.z]} />
        ))}
      </RigidBody>
    </>
  );
}

/** A swaying bamboo grove. */
function Bamboo({ x, z, count, radius, seed }: { x: number; z: number; count: number; radius: number; seed: number }) {
  const ref = useRef<InstancedMesh>(null);
  const leaves = useRef<InstancedMesh>(null);
  const stalks = useMemo(() => {
    const rand = seeded(seed);
    return Array.from({ length: count }, () => {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      return { x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, h: 0.75 + rand() * 0.45, tilt: (rand() - 0.5) * 0.12, ry: rand() * 6 };
    });
  }, [x, z, count, radius, seed]);
  const geometries = useMemo(() => {
    const segments: BufferGeometry[] = [];
    // A stalk of five segments with a lighter ring at each node.
    for (let i = 0; i < 5; i++) {
      segments.push(tinted(new CylinderGeometry(0.07, 0.075, 1.0, 6).translate(0, 0.5 + i * 1.04, 0), i % 2 ? '#8dbb4f' : '#7fae45'));
      segments.push(tinted(new CylinderGeometry(0.085, 0.085, 0.05, 6).translate(0, 1.02 + i * 1.04, 0), '#c4d98a'));
    }
    const sprays = [
      [0.35, 4.6, 0.1, 0.5],
      [-0.3, 4.9, -0.15, 0.45],
      [0.1, 5.3, 0.25, 0.42],
      [-0.15, 4.2, 0.3, 0.38]
    ].map(([lx, ly, lz, s]) => tinted(new IcosahedronGeometry(1, 0).scale(s, s * 0.5, s * 0.8).translate(lx, ly, lz), '#6fa548'));
    return { stalk: mergeGeometries(segments), leaves: mergeGeometries(sprays) };
  }, []);
  const materials = useMemo(() => ({ stalk: swayingMaterial(1.5, 0.025, false), leaves: swayingMaterial(1.5, 0.025) }), []);
  useLayoutEffect(() => {
    const o = new Object3D();
    stalks.forEach((s, i) => {
      o.position.set(s.x, 0, s.z);
      o.rotation.set(s.tilt, s.ry, s.tilt * 0.6);
      o.scale.set(1, s.h, 1);
      o.updateMatrix();
      ref.current?.setMatrixAt(i, o.matrix);
      leaves.current?.setMatrixAt(i, o.matrix);
    });
    for (const mesh of [ref.current, leaves.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [stalks]);
  return (
    <>
      <instancedMesh ref={ref} args={[geometries.stalk, materials.stalk, stalks.length]} castShadow />
      <instancedMesh ref={leaves} args={[geometries.leaves, materials.leaves, stalks.length]} castShadow />
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.5, radius * 0.8]} position={[x, 1.5, z]} />
      </RigidBody>
    </>
  );
}

/** A small Japanese-maple style tree in red. */
function Maple({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.7, 0]} rotation={[0, 0, 0.12]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 1.4, 6]} />
        <meshLambertMaterial color="#6e4a33" />
      </mesh>
      {[
        [0.15, 1.55, 0, 0.75],
        [-0.45, 1.35, 0.2, 0.55],
        [0.55, 1.3, -0.15, 0.5]
      ].map(([px, py, pz, s], i) => (
        <mesh key={i} position={[px, py, pz]} scale={[s, s * 0.6, s]} castShadow>
          <icosahedronGeometry args={[1, 1]} />
          <meshLambertMaterial color={i === 1 ? '#f08a5d' : '#e0604a'} flatShading />
        </mesh>
      ))}
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[0.7, 0.18]} position={[0, 0.7, 0]} />
      </RigidBody>
    </group>
  );
}

/** Raked sand, three rocks on moss, a bench to sit and look at it, bamboo and a maple. */
export function ZenGarden() {
  const sand = useMemo(rakedSand, []);
  const { x, z, w, d } = ZEN_GARDEN;
  const rock = useMemo(() => new DodecahedronGeometry(1, 0), []);
  const curb = '#b4ac9d';
  return (
    <>
      <group position={[x, 0, z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]} receiveShadow>
          <planeGeometry args={[w, d]} />
          <meshLambertMaterial map={sand} />
        </mesh>
        {/* Stone curb */}
        {[
          [0, -d / 2 - 0.12, w + 0.48, 0.24],
          [0, d / 2 + 0.12, w + 0.48, 0.24],
          [-w / 2 - 0.12, 0, 0.24, d],
          [w / 2 + 0.12, 0, 0.24, d]
        ].map(([cx, cz, cw, cd], i) => (
          <mesh key={i} position={[cx, 0.07, cz]} castShadow receiveShadow>
            <boxGeometry args={[cw, 0.14, cd]} />
            <meshLambertMaterial color={curb} />
          </mesh>
        ))}
        {ROCKS.map(([rx, rz, s], i) => (
          <group key={i} position={[rx, 0, rz]}>
            <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, i]}>
              <circleGeometry args={[s * 1.15, 9]} />
              <meshLambertMaterial color="#79a04c" />
            </mesh>
            <mesh geometry={rock} position={[0, s * 0.45, 0]} rotation={[i * 0.7, i * 1.3, 0.2]} scale={[s, s * 0.85, s * 0.9]} castShadow receiveShadow>
              <meshLambertMaterial color={i === 1 ? '#8f8a82' : '#9d978c'} flatShading />
            </mesh>
          </group>
        ))}
        {/* Bench facing the garden from the south */}
        <group position={[0.4, 0, d / 2 + 1.5]}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.08, 0.55]} />
            <meshLambertMaterial color="#b98656" />
          </mesh>
          {[-0.85, 0.85].map((lx) => (
            <mesh key={lx} position={[lx, 0.21, 0]} castShadow>
              <boxGeometry args={[0.12, 0.42, 0.45]} />
              <meshLambertMaterial color="#8a5a36" />
            </mesh>
          ))}
        </group>
        <RigidBody type="fixed" colliders={false}>
          {ROCKS.map(([rx, rz, s], i) => (
            <BallCollider key={i} args={[s * 0.85]} position={[rx, s * 0.4, rz]} />
          ))}
          <CuboidCollider args={[1.1, 0.25, 0.28]} position={[0.4, 0.25, d / 2 + 1.5]} />
        </RigidBody>
      </group>
      <Lanterns />
      <Bamboo x={x - w / 2 - 3.2} z={z - 1.2} count={26} radius={1.9} seed={77} />
      <Bamboo x={x + w / 2 + 1.6} z={z - 2.8} count={16} radius={1.2} seed={78} />
      <Maple x={x - w / 2 - 1.4} z={z + d / 2 + 0.6} />
    </>
  );
}
