import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody, type IntersectionEnterPayload } from '@react-three/rapier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Group,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RingGeometry
} from 'three';
import { canvasTexture, FONT } from './textures';
import { bodies, world } from './store';
import { contactZones, PITCH, type Zone } from './zones';

const GOAL = { width: 5.2, height: 2.2, depth: 1.8 };

function flat(geometry: BufferGeometry, x: number, z: number) {
  return geometry.rotateX(-Math.PI / 2).translate(x, 0, z);
}

function rectLines(parts: BufferGeometry[], cx: number, cz: number, w: number, d: number, t = 0.12) {
  parts.push(
    flat(new PlaneGeometry(w + t, t), cx, cz - d / 2),
    flat(new PlaneGeometry(w + t, t), cx, cz + d / 2),
    flat(new PlaneGeometry(t, d), cx - w / 2, cz),
    flat(new PlaneGeometry(t, d), cx + w / 2, cz)
  );
}

function PitchMarkings() {
  const { lines, stripes } = useMemo(() => {
    const { minX, maxX, goalLineZ, frontZ } = PITCH;
    const parts: BufferGeometry[] = [];
    rectLines(parts, (minX + maxX) / 2, (goalLineZ + frontZ) / 2, maxX - minX, frontZ - goalLineZ);
    for (const zone of contactZones) {
      rectLines(parts, zone.x, goalLineZ + 2.75, 10, 5.5);
      parts.push(flat(new CircleGeometry(0.18, 16), zone.x, goalLineZ + 7.5));
    }
    parts.push(new RingGeometry(3.94, 4.06, 48, 1, 0, Math.PI).rotateX(-Math.PI / 2).translate(0, 0, frontZ));

    // Mowed stripes across the pitch.
    const bands: BufferGeometry[] = [];
    const bandDepth = 2.6;
    for (let z = goalLineZ - 2.6, i = 0; z < frontZ; z += bandDepth, i++) {
      if (i % 2 === 0) continue;
      const d = Math.min(bandDepth, frontZ - z);
      bands.push(flat(new PlaneGeometry(maxX - minX + 2, d), 0, z + d / 2));
    }
    return { lines: mergeGeometries(parts), stripes: mergeGeometries(bands) };
  }, []);

  return (
    <>
      <mesh geometry={stripes} position={[0, 0.006, 0]} receiveShadow>
        <meshStandardMaterial color="#86c75e" roughness={1} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh geometry={lines} position={[0, 0.012, 0]} receiveShadow>
        <meshStandardMaterial color="#f7f7f2" roughness={0.9} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </>
  );
}

/** A plane whose UVs repeat every `cell` metres, so one net texture fits any size. */
function netPlane(w: number, h: number, cell = 0.2) {
  const geometry = new PlaneGeometry(w, h);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / cell, (uv.getY(i) * h) / cell);
  return geometry;
}

function useNetMaterial() {
  return useMemo(() => {
    const texture = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.strokeRect(0, 0, w, h);
    });
    texture.wrapS = texture.wrapT = RepeatWrapping;
    return new MeshStandardMaterial({ map: texture, transparent: true, alphaTest: 0.35, side: DoubleSide, roughness: 1 });
  }, []);
}

function Goal({ zone }: { zone: Zone }) {
  const { width, height, depth } = GOAL;
  const hw = width / 2;
  const net = useNetMaterial();
  const nets = useMemo(
    () => ({ back: netPlane(width, height), side: netPlane(depth, height), top: netPlane(width, depth) }),
    [width, height, depth]
  );
  const sign = useMemo(
    () =>
      canvasTexture(1024, 360, (ctx, w, h) => {
        ctx.fillStyle = zone.color;
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, 56);
        ctx.fill();
        ctx.fillStyle = '#111111';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 150px ${FONT}`;
        ctx.fillText(zone.label, w / 2, h * 0.42, w * 0.9);
        ctx.font = `700 44px ${FONT}`;
        ctx.fillText('SCORE TO CONNECT', w / 2, h * 0.8);
      }),
    [zone]
  );
  const lastScore = useRef(0);

  const onEnter = ({ other }: IntersectionEnterPayload) => {
    if (!other.rigidBody || other.rigidBody !== bodies.ball) return;
    const now = performance.now();
    if (now - lastScore.current < 3000) return;
    lastScore.current = now;
    world.set({ goal: { zone, at: now } });
  };

  const post = '#fbfbf8';

  return (
    <group position={[zone.x, 0, zone.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[height / 2, 0.07]} position={[-hw, height / 2, 0]} restitution={0.7} />
        <CylinderCollider args={[height / 2, 0.07]} position={[hw, height / 2, 0]} restitution={0.7} />
        <CuboidCollider args={[hw, 0.07, 0.07]} position={[0, height, 0]} restitution={0.7} />
        {/* Net walls soak up the ball */}
        <CuboidCollider args={[hw, height / 2, 0.05]} position={[0, height / 2, -depth]} restitution={0} />
        <CuboidCollider args={[0.05, height / 2, depth / 2]} position={[-hw, height / 2, -depth / 2]} restitution={0} />
        <CuboidCollider args={[0.05, height / 2, depth / 2]} position={[hw, height / 2, -depth / 2]} restitution={0} />
        <CuboidCollider args={[hw, 0.05, depth / 2]} position={[0, height, -depth / 2]} restitution={0} />
        <CuboidCollider
          sensor
          args={[hw - 0.15, height / 2 - 0.05, (depth - 0.6) / 2]}
          position={[0, height / 2, -0.6 - (depth - 0.6) / 2]}
          onIntersectionEnter={onEnter}
        />
      </RigidBody>

      {/* Frame */}
      {[-hw, hw].map((x) => (
        <group key={x}>
          <mesh position={[x, height / 2, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, height, 12]} />
            <meshStandardMaterial color={post} roughness={0.4} />
          </mesh>
          <mesh position={[x, height / 2, -depth]}>
            <cylinderGeometry args={[0.035, 0.035, height, 8]} />
            <meshStandardMaterial color={post} roughness={0.4} />
          </mesh>
          <mesh position={[x, height, -depth / 2]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, depth, 8]} />
            <meshStandardMaterial color={post} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, height, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.07, 0.07, width + 0.14, 12]} />
        <meshStandardMaterial color={post} roughness={0.4} />
      </mesh>

      {/* Net */}
      <mesh geometry={nets.back} material={net} position={[0, height / 2, -depth]} />
      <mesh geometry={nets.side} material={net} position={[-hw, height / 2, -depth / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={nets.side} material={net} position={[hw, height / 2, -depth / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={nets.top} material={net} position={[0, height, -depth / 2]} rotation={[-Math.PI / 2, 0, 0]} />

      {/* Sign behind the goal */}
      {[-1.7, 1.7].map((x) => (
        <mesh key={x} position={[x, 2.1, -depth - 0.7]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 4.2, 8]} />
          <meshStandardMaterial color="#3a3a40" roughness={0.6} />
        </mesh>
      ))}
      <mesh position={[0, 3.75, -depth - 0.62]} castShadow>
        <planeGeometry args={[4, 1.4]} />
        <meshStandardMaterial map={sign} transparent roughness={0.7} />
      </mesh>
    </group>
  );
}

function CornerFlag({ x, z, color }: { x: number; z: number; color: string }) {
  const flag = useRef<Group>(null);
  useFrame((state) => {
    if (flag.current) flag.current.rotation.y = Math.sin(state.clock.elapsedTime * 3 + x) * 0.35;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 1.5, 6]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <group ref={flag} position={[0, 1.38, 0]}>
        <mesh position={[0.2, 0, 0]} castShadow>
          <planeGeometry args={[0.4, 0.26]} />
          <meshStandardMaterial color={color} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

export function Pitch() {
  const { minX, maxX, goalLineZ, frontZ } = PITCH;
  return (
    <>
      <PitchMarkings />
      {contactZones.map((zone) => (
        <Goal key={zone.id} zone={zone} />
      ))}
      <CornerFlag x={minX} z={goalLineZ} color="#ff6b6b" />
      <CornerFlag x={maxX} z={goalLineZ} color="#ffe66d" />
      <CornerFlag x={minX} z={frontZ} color="#4ecdc4" />
      <CornerFlag x={maxX} z={frontZ} color="#ff8b94" />
    </>
  );
}
