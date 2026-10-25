import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BallCollider,
  CuboidCollider,
  CylinderCollider,
  RigidBody,
  type RapierRigidBody,
  useAfterPhysicsStep
} from '@react-three/rapier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BufferGeometry, DoubleSide, Group, LatheGeometry, MeshLambertMaterial, PlaneGeometry, RepeatWrapping, RingGeometry, Vector2 } from 'three';
import { canvasTexture } from '../textures';
import { COURT, PROPS } from '../layout';
import { playRim, playSwish } from '../sound';
import { fx, world } from '../store';
import { playerCommands } from '../Player';
import { basketball } from './basketballState';
import { addScore, callout, isPlaying } from './challenge';

const BALL_R = 0.12;
const POOL = 4;
/** A touch wider than regulation, so good shots drop more often. */
const RIM_R = 0.25;
const GRAVITY = 15;
const LAUNCH_ANGLE = (57 * Math.PI) / 180;
const RACK = { x: PROPS.ballRack.x, z: PROPS.ballRack.z };

function flat(geometry: BufferGeometry, x: number, z: number) {
  return geometry.rotateX(-Math.PI / 2).translate(x, 0, z);
}

function CourtSurface() {
  const lines = useMemo(() => {
    const { minX, maxX, minZ, maxZ, rim, threeRadius, keyWidth, freeThrowZ } = COURT;
    const t = 0.1;
    const parts: BufferGeometry[] = [];
    const w = maxX - minX;
    const d = maxZ - minZ;
    const cx = (minX + maxX) / 2;
    parts.push(
      flat(new PlaneGeometry(w, t), cx, minZ),
      flat(new PlaneGeometry(w, t), cx, maxZ),
      flat(new PlaneGeometry(t, d), minX, (minZ + maxZ) / 2),
      flat(new PlaneGeometry(t, d), maxX, (minZ + maxZ) / 2)
    );
    // Key and free-throw circle
    const keyDepth = freeThrowZ - minZ;
    parts.push(
      flat(new PlaneGeometry(t, keyDepth), rim.x - keyWidth / 2, minZ + keyDepth / 2),
      flat(new PlaneGeometry(t, keyDepth), rim.x + keyWidth / 2, minZ + keyDepth / 2),
      flat(new PlaneGeometry(keyWidth, t), rim.x, freeThrowZ)
    );
    parts.push(new RingGeometry(1.8 - t / 2, 1.8 + t / 2, 40, 1, Math.PI, Math.PI).rotateX(-Math.PI / 2).translate(rim.x, 0, freeThrowZ));
    // Three-point line: straight corners, then the arc.
    const cornerX = threeRadius - 0.4;
    const arcStart = Math.acos(cornerX / threeRadius);
    const cornerDepth = rim.z + Math.sin(arcStart) * threeRadius - minZ;
    parts.push(
      flat(new PlaneGeometry(t, cornerDepth), rim.x - cornerX, minZ + cornerDepth / 2),
      flat(new PlaneGeometry(t, cornerDepth), rim.x + cornerX, minZ + cornerDepth / 2)
    );
    parts.push(
      new RingGeometry(threeRadius - t / 2, threeRadius + t / 2, 64, 1, Math.PI + arcStart, Math.PI - arcStart * 2)
        .rotateX(-Math.PI / 2)
        .translate(rim.x, 0, rim.z)
    );
    parts.push(new RingGeometry(1.8 - t / 2, 1.8 + t / 2, 40, 1, 0, Math.PI).rotateX(-Math.PI / 2).translate(rim.x, 0, maxZ));
    return mergeGeometries(parts);
  }, []);
  const { minX, maxX, minZ, maxZ, rim, keyWidth, freeThrowZ } = COURT;
  return (
    <>
      <mesh position={[(minX + maxX) / 2, 0.006, (minZ + maxZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[maxX - minX + 1.2, maxZ - minZ + 1.2]} />
        <meshLambertMaterial color="#3f6f8a" />
      </mesh>
      <mesh position={[rim.x, 0.009, (minZ + freeThrowZ) / 2]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[keyWidth, freeThrowZ - minZ]} />
        <meshLambertMaterial color="#d9774a" />
      </mesh>
      <mesh geometry={lines} position={[0, 0.013, 0]} receiveShadow>
        <meshLambertMaterial color="#f4f1e8" polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </>
  );
}

function netGeometry() {
  // Tapered sock of net hanging from the rim.
  const profile = [
    [RIM_R, 0],
    [RIM_R * 0.92, -0.14],
    [RIM_R * 0.74, -0.3],
    [RIM_R * 0.62, -0.42]
  ].map(([r, y]) => new Vector2(r, y));
  const g = new LatheGeometry(profile, 16);
  const uv = g.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 3);
  return g;
}

export const hoopEvents = { rimAt: 0, swishAt: 0 };

function Hoop() {
  const { rim } = COURT;
  const net = useRef<Group>(null);
  const netMaterial = useMemo(() => {
    const texture = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();
    });
    texture.wrapS = texture.wrapT = RepeatWrapping;
    return new MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.4, side: DoubleSide });
  }, []);
  const netGeo = useMemo(netGeometry, []);
  const boardZ = rim.z - RIM_R - 0.16;
  const swish = useRef(0);
  const lastSwish = useRef(0);

  useFrame((_, delta) => {
    if (hoopEvents.swishAt !== lastSwish.current) {
      lastSwish.current = hoopEvents.swishAt;
      swish.current = 1;
    }
    swish.current = Math.max(0, swish.current - delta * 3);
    if (net.current) net.current.scale.set(1, 1 + Math.sin(swish.current * 14) * swish.current * 0.25, 1);
  });

  return (
    <group>
      {/* Rim as a ring of small spheres so the ball can rattle around it */}
      <RigidBody
        type="fixed"
        colliders={false}
        onCollisionEnter={() => {
          hoopEvents.rimAt = performance.now();
          playRim(0.6);
        }}
      >
        {Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2;
          return <BallCollider key={i} args={[0.02]} position={[rim.x + Math.cos(a) * RIM_R, rim.y, rim.z + Math.sin(a) * RIM_R]} restitution={0.5} />;
        })}
      </RigidBody>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[0.9, 0.53, 0.03]}
          position={[rim.x, rim.y + 0.33, boardZ]}
          restitution={0.6}
          onCollisionEnter={() => playRim(0.3)}
        />
        <CylinderCollider args={[1.6, 0.1]} position={[rim.x, 1.6, boardZ - 0.9]} />
      </RigidBody>
      {/* Pole, arm, board */}
      <mesh position={[rim.x, 1.7, boardZ - 0.9]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 3.4, 12]} />
        <meshLambertMaterial color="#2c3037" />
      </mesh>
      <mesh position={[rim.x, 3.35, boardZ - 0.45]} castShadow>
        <boxGeometry args={[0.12, 0.12, 0.9]} />
        <meshLambertMaterial color="#2c3037" />
      </mesh>
      <mesh position={[rim.x, rim.y + 0.33, boardZ]} castShadow>
        <boxGeometry args={[1.8, 1.06, 0.05]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.85} roughness={0.2} />
      </mesh>
      <BoardSquare x={rim.x} y={rim.y + 0.2} z={boardZ + 0.03} />
      <mesh position={[rim.x, rim.y, rim.z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[RIM_R, 0.02, 8, 28]} />
        <meshStandardMaterial color="#e2572b" roughness={0.4} metalness={0.3} />
      </mesh>
      <group ref={net} position={[rim.x, rim.y, rim.z]}>
        <mesh geometry={netGeo} material={netMaterial} />
      </group>
    </group>
  );
}

function BoardSquare({ x, y, z }: { x: number; y: number; z: number }) {
  const geometry = useMemo(() => {
    const t = 0.04;
    return mergeGeometries([
      new PlaneGeometry(0.6, t).translate(0, 0.225, 0),
      new PlaneGeometry(0.6, t).translate(0, -0.225, 0),
      new PlaneGeometry(t, 0.45).translate(-0.3, 0, 0),
      new PlaneGeometry(t, 0.45).translate(0.3, 0, 0)
    ]);
  }, []);
  return (
    <mesh geometry={geometry} position={[x, y, z]}>
      <meshBasicMaterial color="#d9472b" />
    </mesh>
  );
}

interface Shot {
  at: number;
  points: number;
  scored: boolean;
  /** Ball height on the previous physics step. */
  lastY: number;
}

/** Shots in flight, keyed by ball body handle. */
const shots = new Map<number, Shot>();

/** The rack of balls; the pool is reused shot after shot. */
function Basketballs() {
  const refs = useRef<(RapierRigidBody | null)[]>([]);
  const next = useRef(0);
  const ballTexture = useMemo(
    () =>
      canvasTexture(256, 128, (ctx, w, h) => {
        ctx.fillStyle = '#e0702f';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#2a1408';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        for (const x of [w * 0.25, w * 0.75]) {
          ctx.moveTo(x, 0);
          ctx.lineTo(x, h);
        }
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(0, h / 2, w * 0.12, h * 0.5, 0, 0, Math.PI * 2);
        ctx.ellipse(w / 2, h / 2, w * 0.12, h * 0.5, 0, 0, Math.PI * 2);
        ctx.ellipse(w, h / 2, w * 0.12, h * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }),
    []
  );

  // A basket counts when a ball crosses the rim plane going down, inside the rim. Checked every
  // physics step, because sensor events can miss a ball that passes through within one frame.
  useAfterPhysicsStep(() => {
    const { rim } = COURT;
    for (const b of refs.current) {
      if (!b) continue;
      const shot = shots.get(b.handle);
      if (!shot || shot.scored) continue;
      const p = b.translation();
      const wasAbove = shot.lastY > rim.y;
      shot.lastY = p.y;
      if (!wasAbove || p.y > rim.y) continue;
      if (Math.hypot(p.x - rim.x, p.z - rim.z) > RIM_R - 0.04) continue;
      shot.scored = true;
      hoopEvents.swishAt = performance.now();
      playSwish();
      const clean = hoopEvents.rimAt < shot.at;
      if (isPlaying('basketball')) addScore(shot.points, clean ? `SWISH +${shot.points}` : `+${shot.points}`);
    }
  });

  const park = (b: RapierRigidBody, i: number) => {
    b.setTranslation({ x: RACK.x - 0.6 + i * 0.4, y: 1.0, z: RACK.z }, true);
    b.setLinvel({ x: 0, y: 0, z: 0 }, true);
    b.setAngvel({ x: 0, y: 0, z: 0 }, true);
  };

  useEffect(() => {
    basketball.shoot = (from, charge) => {
      const b = refs.current[next.current % POOL];
      next.current++;
      if (!b) return;
      const { rim, threeRadius } = COURT;
      const fx0 = rim.x - from.x;
      const fz0 = rim.z - from.z;
      const dist = Math.hypot(fx0, fz0) || 1;
      const ux = fx0 / dist;
      const uz = fz0 / dist;
      const start = { x: from.x + ux * 0.35, y: 2.45, z: from.z + uz * 0.35 };
      const d = dist - 0.35;
      const dy = rim.y - start.y;
      const cos = Math.cos(LAUNCH_ANGLE);
      const speed = Math.sqrt((GRAVITY * d * d) / (2 * cos * cos * Math.max(0.2, d * Math.tan(LAUNCH_ANGLE) - dy)));
      // Off the sweet spot: long or short, and a little wide.
      const [lo, hi] = basketball.zone(from);
      const error = charge < lo ? charge - lo : charge > hi ? charge - hi : 0;
      // Misses are bigger from further out, and long shots wobble a little even when timed well.
      const range = 1 + Math.max(0, dist - 4) / 5;
      const v = speed * (1 + error * 0.55 * range);
      const wide = (Math.random() - 0.5) * (Math.abs(error) * 0.6 * range + Math.max(0, dist - 5) * 0.004);
      const yaw = Math.atan2(ux, uz) + wide;
      b.setTranslation(start, true);
      b.setLinvel({ x: Math.sin(yaw) * v * cos, y: v * Math.sin(LAUNCH_ANGLE), z: Math.cos(yaw) * v * cos }, true);
      b.setAngvel({ x: -uz * 8, y: 0, z: ux * 8 }, true);
      // Past the arc, or out in the corners where the three-point line runs straight.
      const three = dist >= threeRadius || Math.abs(from.x - rim.x) >= threeRadius - 0.4;
      shots.set(b.handle, { at: performance.now(), points: three ? 3 : 2, scored: false, lastY: start.y });
      basketball.holding = false;
      fx.lastKick = performance.now();
      window.setTimeout(() => {
        if (world.get().mode === 'basketball' && world.get().challenge?.phase !== 'done') basketball.holding = true;
      }, 650);
      window.setTimeout(() => {
        const shot = shots.get(b.handle);
        if (shot && !shot.scored && isPlaying('basketball')) callout(hoopEvents.rimAt > shot.at ? 'RIMMED OUT' : 'MISS');
      }, 2000);
    };
    return () => {
      basketball.shoot = () => {};
    };
  }, []);

  // Enter or leave the shootout.
  useEffect(
    () =>
      world.subscribe(() => {
        const { mode, challenge } = world.get();
        const active = mode === 'basketball' && challenge?.phase !== 'done';
        if (active && !basketball.holding && challenge?.phase === 'countdown') {
          basketball.holding = true;
          playerCommands.teleport = { x: COURT.rim.x + 2.5, z: COURT.freeThrowZ + 1.5, yaw: Math.PI };
        }
        if (!active && basketball.holding) {
          basketball.holding = false;
          refs.current.forEach((b, i) => b && park(b, i));
        }
      }),
    []
  );

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <RigidBody
          key={i}
          ref={(b) => {
            refs.current[i] = b;
          }}
          colliders={false}
          position={[RACK.x - 0.6 + i * 0.4, 1.0, RACK.z]}
          ccd
          linearDamping={0}
          angularDamping={0.3}
        >
          <BallCollider args={[BALL_R]} mass={0.6} restitution={0.78} friction={0.8} />
          <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
            <sphereGeometry args={[BALL_R, 20, 14]} />
            <meshStandardMaterial map={ballTexture} roughness={0.7} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

/** The basketball in the player's hands during the shootout. */
export function HeldBasketball() {
  const ref = useRef<Group>(null);
  const tex = useMemo(
    () =>
      canvasTexture(64, 32, (ctx, w, h) => {
        ctx.fillStyle = '#e0702f';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#2a1408';
        ctx.lineWidth = 2;
        ctx.strokeRect(-2, h / 2, w + 4, 0.5);
      }),
    []
  );
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    g.visible = basketball.holding && world.get().mode === 'basketball';
    // Rises from the chest to above the head as the shot loads.
    g.position.set(0.05, 1.2 + fx.charge * 0.95, 0.32 - fx.charge * 0.22);
  });
  return (
    <group ref={ref} visible={false}>
      <mesh castShadow>
        <sphereGeometry args={[BALL_R, 18, 12]} />
        <meshStandardMaterial map={tex} roughness={0.7} />
      </mesh>
    </group>
  );
}

function BallRack() {
  const { x, z } = RACK;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.9, 0.45, 0.3]} position={[0, 0.45, 0]} />
      </RigidBody>
      {[-0.85, 0.85].map((px) => (
        <mesh key={px} position={[px, 0.45, 0]} castShadow>
          <boxGeometry args={[0.06, 0.9, 0.5]} />
          <meshLambertMaterial color="#2c3037" />
        </mesh>
      ))}
      <mesh position={[0, 0.84, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.7, 8]} />
        <meshLambertMaterial color="#2c3037" />
      </mesh>
      <mesh position={[0, 0.84, 0.18]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 1.7, 8]} />
        <meshLambertMaterial color="#2c3037" />
      </mesh>
    </group>
  );
}

function Fence() {
  // Low chain-link style fence behind the hoop.
  const { minX, maxX, baselineZ } = COURT;
  const material = useMemo(() => {
    const texture = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.strokeStyle = '#d7dade';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w, h);
      ctx.moveTo(w, 0);
      ctx.lineTo(0, h);
      ctx.stroke();
    });
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set((maxX - minX + 2) / 0.3, 2.4 / 0.3);
    return new MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.4, side: DoubleSide });
  }, [minX, maxX]);
  const z = baselineZ - 2.2;
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[(maxX - minX) / 2 + 1, 1.2, 0.05]} position={[(minX + maxX) / 2, 1.2, z]} />
      </RigidBody>
      <mesh material={material} position={[(minX + maxX) / 2, 1.2, z]}>
        <planeGeometry args={[maxX - minX + 2, 2.4]} />
      </mesh>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[minX - 1 + (i * (maxX - minX + 2)) / 6, 1.25, z]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 2.5, 6]} />
          <meshLambertMaterial color="#8c9097" />
        </mesh>
      ))}
    </group>
  );
}

export function Court() {
  return (
    <>
      <CourtSurface />
      <Hoop />
      <Basketballs />
      <BallRack />
      <Fence />
    </>
  );
}
