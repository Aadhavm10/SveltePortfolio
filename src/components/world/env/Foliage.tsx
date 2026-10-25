import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  MeshLambertMaterial,
  Object3D
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BOUNDS } from '../layout';
import { terrainHeight } from './Ground';
import { isOpenGround } from './mask';
import { seeded } from './palette';

interface Item {
  x: number;
  y: number;
  z: number;
  s: number;
  ry: number;
  color?: string;
}

const windUniform = { value: 0 };

/** Lambert material whose vertices sway with the wind above `pivot` metres. */
export function swayingMaterial(pivot: number, strength: number, flatShading = true) {
  const material = new MeshLambertMaterial({ flatShading, vertexColors: true });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = windUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 basePos = instanceMatrix[3].xyz;
        #else
          vec3 basePos = vec3(0.0);
        #endif
        float lift = max(0.0, position.y - ${pivot.toFixed(2)});
        float sway = sin(uWind * 1.3 + basePos.x * 0.21 + basePos.z * 0.17) * 0.6 + sin(uWind * 2.7 + basePos.x) * 0.25;
        transformed.x += sway * lift * ${strength.toFixed(3)};
        transformed.z += sway * lift * ${(strength * 0.4).toFixed(3)};`
      );
  };
  return material;
}

/** Bakes a vertical light-to-dark gradient into vertex colours (lighter on top). */
function shade(geometry: BufferGeometry, bottom: number, top: number, from: number, to: number) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, (pos.getY(i) - bottom) / (top - bottom)));
    const v = from + (to - from) * t;
    colors.set([v, v, v], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g;
}

function roundCanopy() {
  const blobs = [
    new IcosahedronGeometry(1.35, 1).translate(0, 2.7, 0),
    new IcosahedronGeometry(1.0, 1).translate(0.75, 2.35, 0.35),
    new IcosahedronGeometry(0.95, 1).translate(-0.7, 2.45, -0.3),
    new IcosahedronGeometry(0.8, 1).translate(0.1, 3.55, 0.1)
  ];
  return shade(mergeGeometries(blobs), 1.4, 4.3, 0.62, 1.12);
}

function pineCanopy() {
  const cones = [
    new ConeGeometry(1.4, 2.0, 7).translate(0, 2.0, 0),
    new ConeGeometry(1.1, 1.7, 7).translate(0, 2.9, 0),
    new ConeGeometry(0.75, 1.4, 7).translate(0, 3.8, 0)
  ].map((g) => g.toNonIndexed());
  return shade(mergeGeometries(cones), 1.0, 4.5, 0.6, 1.1);
}

const ROUND_COLORS = ['#5f9a40', '#6fa843', '#579038', '#82b34c', '#e39a48', '#efc05a', '#f3a7bd', '#6fa843', '#5f9a40', '#f6b8c9'];
const SAKURA = ['#f7b9cb', '#f3a5bc', '#fbcad7'];
/** Cherry trees placed by hand around the quiet corners. */
const SAKURA_SPOTS: [number, number][] = [
  [-16.5, -31],
  [7.5, -50.5],
  [23.5, -50],
  [-20, 7.5],
  [21.5, 9],
  [-30, -46],
  [40, -46]
];
const PINE_COLORS = ['#447a42', '#4f8648', '#3c6b3d'];

function useInstances(ref: RefObject<InstancedMesh | null>, items: Item[], squash = 1) {
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const c = new Color();
    items.forEach((it, i) => {
      o.position.set(it.x, it.y, it.z);
      o.rotation.set(0, it.ry, 0);
      o.scale.set(it.s, it.s * squash, it.s);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.set(it.color ?? '#ffffff'));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, ref, squash]);
}

function InstancedSet({ geometry, material, items, castShadow = true }: { geometry: BufferGeometry; material: MeshLambertMaterial; items: Item[]; castShadow?: boolean }) {
  const ref = useRef<InstancedMesh>(null);
  useInstances(ref, items);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={castShadow} receiveShadow />;
}

export function Trees() {
  const { round, pine, colliders } = useMemo(() => {
    const rand = seeded(7);
    const round: Item[] = [];
    const pine: Item[] = [];
    const colliders: { x: number; z: number; r: number }[] = [];
    const add = (x: number, z: number, s: number, kind: 'round' | 'pine') => {
      const item = { x, y: terrainHeight(x, z) - 0.05, z, s, ry: rand() * 6 };
      if (kind === 'pine') pine.push({ ...item, color: PINE_COLORS[Math.floor(rand() * PINE_COLORS.length)] });
      else round.push({ ...item, color: ROUND_COLORS[Math.floor(rand() * ROUND_COLORS.length)] });
      if (x > BOUNDS.minX && x < BOUNDS.maxX && z > BOUNDS.minZ && z < BOUNDS.maxZ) colliders.push({ x, z, r: 0.3 * s });
    };

    // Rings of trees on the hills around the park; pines further out.
    const { minX, maxX, minZ, maxZ } = BOUNDS;
    for (const [offset, kind, step] of [[3, 'round', 4.2], [9, 'pine', 4.6], [16, 'pine', 5.5]] as const) {
      const place = (x: number, z: number) => {
        if (rand() < 0.12) return;
        add(x + (rand() - 0.5) * 3, z + (rand() - 0.5) * 3, 0.9 + rand() * 0.7, kind);
      };
      for (let x = minX - offset; x <= maxX + offset; x += step) {
        place(x, minZ - offset);
        // Keep the south edge (behind the camera) low so it never blocks the view.
        if (offset > 3) place(x, maxZ + offset + 6);
      }
      for (let z = minZ - offset; z <= maxZ + offset; z += step) {
        place(minX - offset, z);
        place(maxX + offset, z);
      }
    }

    for (const [x, z] of SAKURA_SPOTS) {
      const item = { x, y: 0, z, s: 1 + rand() * 0.25, ry: rand() * 6 };
      round.push({ ...item, color: SAKURA[Math.floor(rand() * SAKURA.length)] });
      colliders.push({ x, z, r: 0.3 * item.s });
    }

    // Groves scattered inside the park.
    let tries = 0;
    let groves = 0;
    while (groves < 70 && tries < 4000) {
      tries++;
      const x = minX + 3 + rand() * (maxX - minX - 6);
      const z = minZ + 3 + rand() * (maxZ - minZ - 10);
      if (!isOpenGround(x, z, 2.5)) continue;
      add(x, z, 0.75 + rand() * 0.55, rand() > 0.85 ? 'pine' : 'round');
      groves++;
    }
    return { round, pine, colliders };
  }, []);

  const geometries = useMemo(
    () => ({
      trunk: shade(new CylinderGeometry(0.14, 0.26, 2.2, 6).translate(0, 1.1, 0), 0, 2.2, 0.7, 1),
      round: roundCanopy(),
      pine: pineCanopy()
    }),
    []
  );
  const materials = useMemo(
    () => ({
      trunk: new MeshLambertMaterial({ color: '#7a5235', vertexColors: true, flatShading: true }),
      canopy: swayingMaterial(1.5, 0.05),
      pine: swayingMaterial(1.0, 0.035)
    }),
    []
  );
  const trunks = useMemo(() => [...round, ...pine].map((t) => ({ ...t, color: undefined })), [round, pine]);

  useFrame((state) => {
    windUniform.value = state.clock.elapsedTime;
  });

  return (
    <>
      <InstancedSet geometry={geometries.trunk} material={materials.trunk} items={trunks} />
      <InstancedSet geometry={geometries.round} material={materials.canopy} items={round} />
      <InstancedSet geometry={geometries.pine} material={materials.pine} items={pine} />
      <RigidBody type="fixed" colliders={false}>
        {colliders.map((c, i) => (
          <CylinderCollider key={i} args={[1.5, c.r]} position={[c.x, 1.5, c.z]} />
        ))}
      </RigidBody>
    </>
  );
}

const FLOWER_COLORS = ['#ffffff', '#ffe066', '#ff8fa3', '#ffb86b', '#c9b8ff', '#ff6b6b'];

/** Bushes, rocks and flower patches. */
export function Scatter() {
  const { bushes, rocks, flowers } = useMemo(() => {
    const rand = seeded(42);
    const { minX, maxX, minZ, maxZ } = BOUNDS;
    const bushes: Item[] = [];
    const rocks: Item[] = [];
    const flowers: Item[] = [];
    const pick = (margin: number) => {
      for (let i = 0; i < 200; i++) {
        const x = minX + 1 + rand() * (maxX - minX - 2);
        const z = minZ + 1 + rand() * (maxZ - minZ - 2);
        if (isOpenGround(x, z, margin)) return [x, z] as const;
      }
      return null;
    };
    for (let i = 0; i < 60; i++) {
      const p = pick(1);
      if (p) bushes.push({ x: p[0], y: 0, z: p[1], s: 0.5 + rand() * 0.6, ry: rand() * 6, color: ['#4f7f35', '#5d8d3b', '#6c9b3e'][i % 3] });
    }
    for (let i = 0; i < 45; i++) {
      const p = pick(0.5);
      if (p) rocks.push({ x: p[0], y: 0.05, z: p[1], s: 0.25 + rand() * 0.5, ry: rand() * 6, color: '#b7ab98' });
    }
    // Flowers grow in little patches.
    for (let i = 0; i < 38; i++) {
      const p = pick(0.5);
      if (!p) continue;
      const color = FLOWER_COLORS[Math.floor(rand() * FLOWER_COLORS.length)];
      for (let j = 0; j < 9; j++) {
        const x = p[0] + (rand() - 0.5) * 2.4;
        const z = p[1] + (rand() - 0.5) * 2.4;
        flowers.push({ x, y: 0.38 + rand() * 0.18, z, s: 0.06 + rand() * 0.04, ry: rand() * 6, color });
      }
    }
    return { bushes, rocks, flowers };
  }, []);

  const geometries = useMemo(
    () => ({
      bush: shade(new IcosahedronGeometry(1, 1).translate(0, 0.6, 0), -0.4, 1.6, 0.65, 1.1),
      rock: shade(new DodecahedronGeometry(1, 0), -1, 1, 0.8, 1.05),
      flower: shade(new IcosahedronGeometry(1, 0), -1, 1, 1, 1)
    }),
    []
  );
  const materials = useMemo(
    () => ({
      bush: swayingMaterial(0.4, 0.03),
      plain: new MeshLambertMaterial({ vertexColors: true, flatShading: true })
    }),
    []
  );
  const rockRef = useRef<InstancedMesh>(null);
  useInstances(rockRef, rocks, 0.6);

  return (
    <>
      <InstancedSet geometry={geometries.bush} material={materials.bush} items={bushes} />
      <instancedMesh ref={rockRef} args={[geometries.rock, materials.plain, rocks.length]} castShadow receiveShadow />
      <InstancedSet geometry={geometries.flower} material={materials.plain} items={flowers} castShadow={false} />
    </>
  );
}
