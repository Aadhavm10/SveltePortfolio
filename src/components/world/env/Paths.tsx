import { useMemo } from 'react';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, BufferGeometry, MeshLambertMaterial, RepeatWrapping, Vector3 } from 'three';
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
        lamps.push({ x: p.x - tangent.z * side * 1.8, z: p.z + tangent.x * side * 1.8 });
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
      {lamps.map((l, i) => (
        <Lamp key={i} x={l.x} z={l.z} />
      ))}
      <RigidBody type="fixed" colliders={false}>
        {lamps.map((l, i) => (
          <CylinderCollider key={i} args={[1.3, 0.1]} position={[l.x, 1.3, l.z]} />
        ))}
      </RigidBody>
    </>
  );
}

function Lamp({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.05, 0.08, 2.6, 8]} />
        <meshLambertMaterial color="#2f3a33" />
      </mesh>
      <mesh position={[0, 2.68, 0]}>
        <cylinderGeometry args={[0.16, 0.12, 0.3, 8]} />
        <meshBasicMaterial color="#ffd89a" toneMapped={false} />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow>
        <coneGeometry args={[0.26, 0.2, 8]} />
        <meshLambertMaterial color="#2f3a33" />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.16, 0.2, 0.12, 8]} />
        <meshLambertMaterial color="#2f3a33" />
      </mesh>
    </group>
  );
}

