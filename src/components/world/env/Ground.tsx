import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { BufferAttribute, Color, PlaneGeometry } from 'three';
import { BOUNDS } from '../layout';
import { pondDistance, streamDistance } from './mask';
import { GOLDEN, noise2 } from './palette';

/** Distance outside the play area, in metres (0 inside). */
function outside(x: number, z: number) {
  const ox = Math.max(BOUNDS.minX - x, x - BOUNDS.maxX, 0);
  const oz = Math.max(BOUNDS.minZ - z, z - BOUNDS.maxZ, 0);
  return Math.hypot(ox, oz);
}

/** Ground height: flat play area, a pond basin, rolling hills beyond the edges. */
export function terrainHeight(x: number, z: number) {
  const out = outside(x, z);
  let y = 0;
  if (out > 4) {
    const wobble = 0.65 + 0.35 * Math.sin(x * 0.07) * Math.cos(z * 0.09);
    y = Math.pow(out - 4, 1.3) * 0.28 * wobble;
  }
  const pd = pondDistance(x, z);
  if (pd < 1.15) y -= 0.75 * (1 - Math.min(1, pd / 1.15) ** 2);
  return y;
}

const light = new Color(GOLDEN.ground).offsetHSL(0.01, 0.02, 0.05);
const dark = new Color(GOLDEN.ground).offsetHSL(-0.01, 0, -0.06);
const hill = new Color('#93ab55');
const sand = new Color('#d8bd8c');
const mud = new Color('#6f6a4a');

/** Ground tint at a point; the stream banks reuse it so they blend in. */
export function groundColor(x: number, z: number, y: number, target: Color) {
  target.copy(light).lerp(dark, noise2(x, z));
  if (y > 0) target.lerp(hill, Math.min(0.75, y / 10));
  const pd = pondDistance(x, z);
  if (pd < 1.35) target.lerp(sand, Math.min(1, (1.35 - pd) * 4));
  if (pd < 0.95) target.lerp(mud, Math.min(1, (0.95 - pd) * 3));
  return target;
}

export function Ground() {
  const geometry = useMemo(() => {
    const g = new PlaneGeometry(320, 280, 200, 175);
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0, -16);
    const pos = g.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = terrainHeight(x, z);
      // Drop the ground out of the way under the streams; their own channel mesh covers the gap.
      pos.setY(i, streamDistance(x, z) < 0.5 ? Math.min(y, -0.7) : y);
      groundColor(x, z, y, c);
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
        <meshLambertMaterial vertexColors />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[200, 1, 200]} position={[0, -1, 0]} friction={1} />
        {/* Invisible walls around the play area */}
        <CuboidCollider args={[hx + 1, 4, 0.5]} position={[cx, 4, minZ - 0.5]} />
        <CuboidCollider args={[hx + 1, 4, 0.5]} position={[cx, 4, maxZ + 0.5]} />
        <CuboidCollider args={[0.5, 4, hz + 1]} position={[minX - 0.5, 4, cz]} />
        <CuboidCollider args={[0.5, 4, hz + 1]} position={[maxX + 0.5, 4, cz]} />
      </RigidBody>
    </>
  );
}
