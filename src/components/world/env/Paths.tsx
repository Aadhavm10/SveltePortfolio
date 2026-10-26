import { useLayoutEffect, useMemo, useRef } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import {
  BufferAttribute,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  RepeatWrapping,
  Vector3
} from 'three';
import { PROPS } from '../layout';
import { mergeParts } from './merge';
import { canvasTexture } from '../textures';
import { PATH_WIDTH, pathCurves, pathPoints } from './mask';
import { seeded } from './palette';

/** A flat strip following the points, with u across the width and v along the length. */
function ribbon(points: Vector3[], width: number) {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let travelled = 0;
  points.forEach((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const tx = next.x - prev.x;
    const tz = next.z - prev.z;
    const len = Math.hypot(tx, tz) || 1;
    const nx = -tz / len;
    const nz = tx / len;
    if (i > 0) travelled += p.distanceTo(points[i - 1]);
    positions.push(p.x + (nx * width) / 2, 0.015, p.z + (nz * width) / 2, p.x - (nx * width) / 2, 0.015, p.z - (nz * width) / 2);
    uvs.push(0, travelled / width, 1, travelled / width);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(positions.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  g.setIndex(indices);
  return g;
}

function dirtMaterial() {
  const rand = seeded(3);
  const map = canvasTexture(128, 256, (ctx, w, h) => {
    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const u = x / (w - 1);
        const edge = Math.min(u, 1 - u);
        const ragged = 0.16 + Math.sin(y * 0.21 + Math.sin(y * 0.05) * 3) * 0.04;
        const alpha = Math.min(1, Math.max(0, (edge - ragged * 0.4) / ragged));
        const speck = rand();
        const tone = speck > 0.97 ? 0.75 : speck < 0.04 ? 1.12 : 0.94 + rand() * 0.08;
        const i = (y * w + x) * 4;
        img.data[i] = 185 * tone;
        img.data[i + 1] = 140 * tone;
        img.data[i + 2] = 92 * tone;
        img.data[i + 3] = alpha * 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  });
  map.wrapT = RepeatWrapping;
  return new MeshLambertMaterial({
    map,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2
  });
}

/** Dirt paths from the field to each station, with lamp posts along the way. */
export function Paths() {
  const { geometries, lamps } = useMemo(() => {
    const geometries = pathCurves.map((curve) => ribbon(pathPoints(curve), PATH_WIDTH));
    const lamps: { x: number; z: number }[] = [];
    pathCurves.forEach((curve, ci) => {
      const length = curve.getLength();
      for (let d = 5; d < length - 2; d += 11) {
        const t = d / length;
        const p = curve.getPointAt(t);
        const tangent = curve.getTangentAt(t);
        const side = (Math.round(d / 11) + ci) % 2 ? 1 : -1;
        const lamp = { x: p.x - tangent.z * side * 1.8, z: p.z + tangent.x * side * 1.8 };
        // Not on top of my room's plinth.
        if (Math.hypot(lamp.x - PROPS.room.x, lamp.z - PROPS.room.z) < 4.4) continue;
        lamps.push(lamp);
      }
    });
    return { geometries, lamps };
  }, []);
  const material = useMemo(dirtMaterial, []);

  return (
    <>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g} material={material} receiveShadow />
      ))}
      <Lamps lamps={lamps} />
      <RigidBody type="fixed" colliders={false}>
        {lamps.map((l, i) => (
          <CylinderCollider key={i} args={[1.3, 0.1]} position={[l.x, 1.3, l.z]} />
        ))}
      </RigidBody>
    </>
  );
}

/** Every lamp post as two instanced meshes: the dark iron and the glowing lantern. */
function Lamps({ lamps }: { lamps: { x: number; z: number }[] }) {
  const iron = useRef<InstancedMesh>(null);
  const glow = useRef<InstancedMesh>(null);
  const geometries = useMemo(
    () => ({
      iron: mergeParts([
        { geometry: new CylinderGeometry(0.05, 0.08, 2.6, 8), position: [0, 1.3, 0] },
        { geometry: new ConeGeometry(0.26, 0.2, 8), position: [0, 2.9, 0] },
        { geometry: new CylinderGeometry(0.16, 0.2, 0.12, 8), position: [0, 0.06, 0] }
      ]),
      glow: new CylinderGeometry(0.16, 0.12, 0.3, 8).translate(0, 2.68, 0)
    }),
    []
  );
  const materials = useMemo(
    () => ({ iron: new MeshLambertMaterial({ color: '#2f3a33' }), glow: new MeshBasicMaterial({ color: '#ffd89a', toneMapped: false }) }),
    []
  );
  useLayoutEffect(() => {
    const o = new Object3D();
    lamps.forEach((l, i) => {
      o.position.set(l.x, 0, l.z);
      o.updateMatrix();
      iron.current?.setMatrixAt(i, o.matrix);
      glow.current?.setMatrixAt(i, o.matrix);
    });
    for (const mesh of [iron.current, glow.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [lamps]);
  return (
    <>
      <instancedMesh ref={iron} args={[geometries.iron, materials.iron, lamps.length]} castShadow />
      <instancedMesh ref={glow} args={[geometries.glow, materials.glow, lamps.length]} />
    </>
  );
}
