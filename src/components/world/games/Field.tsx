import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody, type IntersectionEnterPayload } from '@react-three/rapier';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  BufferGeometry,
  CircleGeometry,
  DoubleSide,
  Group,
  MeshLambertMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RingGeometry
} from 'three';
import { canvasTexture, FONT } from '../textures';
import { FIELD, GOAL, PROPS } from '../layout';
import { playGoal } from '../sound';
import { bodies, fx, world } from '../store';
import { playerCommands } from '../Player';
import { addScore, callout, isPlaying } from './challenge';
import { Keeper, keeperTouch } from './Keeper';

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

function arc(radius: number, start: number, length: number, x: number, z: number, t = 0.12) {
  return new RingGeometry(radius - t / 2, radius + t / 2, 48, 1, start, length).rotateX(-Math.PI / 2).translate(x, 0, z);
}

function PitchSurface() {
  const { lines, stripes, base } = useMemo(() => {
    const { minX, maxX, goalZ, halfwayZ, box, sixYard, penaltySpotZ, centreRadius } = FIELD;
    const parts: BufferGeometry[] = [];
    rectLines(parts, 0, (goalZ + halfwayZ) / 2, maxX - minX, halfwayZ - goalZ);
    rectLines(parts, 0, goalZ + box.depth / 2, box.width, box.depth);
    rectLines(parts, 0, goalZ + sixYard.depth / 2, sixYard.width, sixYard.depth);
    parts.push(flat(new CircleGeometry(0.16, 16), 0, penaltySpotZ));
    // The "D": the part of the penalty arc outside the box.
    const boxEdge = goalZ + box.depth;
    const half = Math.acos((boxEdge - penaltySpotZ) / 4.5);
    parts.push(arc(4.5, -Math.PI / 2 - half, half * 2, 0, penaltySpotZ));
    // Half of the centre circle and the centre spot on the halfway line.
    parts.push(arc(centreRadius, 0, Math.PI, 0, halfwayZ));
    parts.push(flat(new CircleGeometry(0.16, 16), 0, halfwayZ));

    const bands: BufferGeometry[] = [];
    const bandDepth = 2.7;
    for (let z = goalZ - 3, i = 0; z < halfwayZ + 1; z += bandDepth, i++) {
      if (i % 2) bands.push(flat(new PlaneGeometry(maxX - minX + 2, bandDepth), 0, z + bandDepth / 2));
    }
    const base = flat(new PlaneGeometry(maxX - minX + 2, halfwayZ - goalZ + 4.5), 0, (goalZ - 3.5 + halfwayZ + 1) / 2);
    return { lines: mergeGeometries(parts), stripes: mergeGeometries(bands), base };
  }, []);

  return (
    <>
      <mesh geometry={base} position={[0, 0.004, 0]} receiveShadow>
        <meshLambertMaterial color="#6c9c3c" />
      </mesh>
      <mesh geometry={stripes} position={[0, 0.007, 0]} receiveShadow>
        <meshLambertMaterial color="#7cad48" />
      </mesh>
      <mesh geometry={lines} position={[0, 0.012, 0]} receiveShadow>
        <meshLambertMaterial color="#f4f1e8" polygonOffset polygonOffsetFactor={-2} />
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

export const goalEvents = { lastAt: 0 };

function Goal() {
  const { width, height, depth } = GOAL;
  const hw = width / 2;
  const net = useMemo(() => {
    const texture = canvasTexture(64, 64, (ctx, w, h) => {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 5;
      ctx.strokeRect(0, 0, w, h);
    });
    texture.wrapS = texture.wrapT = RepeatWrapping;
    return new MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.35, side: DoubleSide });
  }, []);
  const nets = useMemo(() => ({ back: netPlane(width, height), side: netPlane(depth, height), top: netPlane(width, depth) }), [width, height, depth]);

  const onEnter = ({ other }: IntersectionEnterPayload) => {
    if (!other.rigidBody || other.rigidBody !== bodies.ball) return;
    const now = performance.now();
    if (now - goalEvents.lastAt < 2500) return;
    goalEvents.lastAt = now;
    playGoal();
    if (isPlaying('soccer')) addScore(1, 'GOAL!');
    else if (world.get().mode === 'play') world.set({ goalAt: now });
  };

  const post = '#fbfbf8';
  return (
    <group position={[GOAL.x, 0, GOAL.z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[height / 2, 0.07]} position={[-hw, height / 2, 0]} restitution={0.7} />
        <CylinderCollider args={[height / 2, 0.07]} position={[hw, height / 2, 0]} restitution={0.7} />
        <CuboidCollider args={[hw, 0.07, 0.07]} position={[0, height, 0]} restitution={0.7} />
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
      <mesh geometry={nets.back} material={net} position={[0, height / 2, -depth]} />
      <mesh geometry={nets.side} material={net} position={[-hw, height / 2, -depth / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={nets.side} material={net} position={[hw, height / 2, -depth / 2]} rotation={[0, Math.PI / 2, 0]} />
      <mesh geometry={nets.top} material={net} position={[0, height, -depth / 2]} rotation={[-Math.PI / 2, 0, 0]} />
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
        <meshLambertMaterial color="#ffffff" />
      </mesh>
      <group ref={flag} position={[0, 1.38, 0]}>
        <mesh position={[0.2, 0, 0]} castShadow>
          <planeGeometry args={[0.4, 0.26]} />
          <meshLambertMaterial color={color} side={DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function drawScoreboard(ctx: CanvasRenderingContext2D, w: number, h: number, lines: { title: string; big: string; small: string }) {
  ctx.fillStyle = '#16181d';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffcf3e';
  ctx.lineWidth = 10;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffcf3e';
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText(lines.title, w / 2, 92);
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 150px ${FONT}`;
  ctx.fillText(lines.big, w / 2, 262);
  ctx.fillStyle = '#c9c9d1';
  ctx.font = `700 40px ${FONT}`;
  ctx.fillText(lines.small, w / 2, 336);
}

/** Electronic scoreboard by the touchline: shows best score, then the live clock and score. */
function Scoreboard() {
  const tex = useMemo(
    () => canvasTexture(640, 380, (ctx, w, h) => drawScoreboard(ctx, w, h, { title: 'SHOOTING CHALLENGE', big: '60s', small: 'Press Enter to play' })),
    []
  );
  const last = useRef('');

  useFrame(() => {
    const { challenge } = world.get();
    let lines = { title: 'SHOOTING CHALLENGE', big: '60s', small: 'Press Enter to play' };
    if (challenge?.kind === 'soccer') {
      const left = Math.max(0, Math.ceil((challenge.endsAt - Math.max(performance.now(), challenge.startsAt)) / 1000));
      lines =
        challenge.phase === 'done'
          ? { title: 'FULL TIME', big: String(challenge.score), small: `Best ${challenge.best}` }
          : { title: `SCORE ${challenge.score}`, big: `${left}s`, small: `Best ${challenge.best}` };
    }
    const key = `${lines.title}|${lines.big}|${lines.small}`;
    if (key === last.current) return;
    last.current = key;
    tex.redraw((ctx, w, h) => drawScoreboard(ctx, w, h, lines));
  });

  const { x, z } = PROPS.scoreboard;
  return (
    <group position={[x, 0, z]} rotation={[0, -0.5, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.3, 1.6, 0.2]} position={[0, 1.6, 0]} />
      </RigidBody>
      {[-0.9, 0.9].map((px) => (
        <mesh key={px} position={[px, 1, -0.05]} castShadow>
          <boxGeometry args={[0.14, 2, 0.14]} />
          <meshLambertMaterial color="#2a2d34" />
        </mesh>
      ))}
      <mesh position={[0, 2.35, -0.08]} castShadow>
        <boxGeometry args={[2.5, 1.55, 0.18]} />
        <meshLambertMaterial color="#2a2d34" />
      </mesh>
      <mesh position={[0, 2.35, 0.02]}>
        <planeGeometry args={[2.3, 1.37]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* A bag of balls at its feet */}
      {[[-0.5, 0.3], [-0.15, 0.45], [0.2, 0.3], [-0.3, 0.05]].map(([bx, bz], i) => (
        <mesh key={i} position={[bx, 0.22, bz + 0.5]} castShadow>
          <sphereGeometry args={[0.22, 14, 10]} />
          <meshStandardMaterial color={i % 2 ? '#f4f4f0' : '#202020'} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

const SPOTS: [number, number][] = [
  [0, FIELD.penaltySpotZ],
  [-6.5, -14],
  [6.5, -14],
  [-3.5, -9.5],
  [3.5, -9.5],
  [0, -8],
  [-10, -17.5],
  [10, -17.5],
  [-8, -10],
  [8, -10]
];

/** Runs the shooting challenge: a ball on a spot, one shot, next spot. */
function ShootingChallenge() {
  const g = useRef({ attempt: -1, spot: 0, placedAt: 0, shotAt: 0, resolvedAt: 0 });

  const place = (spot: number) => {
    const ball = bodies.ball;
    if (!ball) return;
    const [x, z] = SPOTS[spot];
    const toGoalX = GOAL.x - x;
    const toGoalZ = GOAL.z - z;
    const len = Math.hypot(toGoalX, toGoalZ);
    ball.setTranslation({ x, y: 0.3, z }, true);
    ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const ux = toGoalX / len;
    const uz = toGoalZ / len;
    // Stand back and to the left for the run-up, so the ball sits off the right foot.
    playerCommands.teleport = { x: x - ux * 1.4 + uz * 0.6, z: z - uz * 1.4 - ux * 0.6, yaw: Math.atan2(toGoalX, toGoalZ) };
    const st = g.current;
    st.spot = spot;
    st.placedAt = performance.now();
    st.shotAt = 0;
    st.resolvedAt = 0;
  };

  useEffect(
    () =>
      world.subscribe(() => {
        const { challenge } = world.get();
        const st = g.current;
        if (challenge?.kind === 'soccer' && challenge.phase === 'countdown' && st.attempt !== 0) {
          st.attempt = 0;
          place(0);
        }
        if (!challenge || challenge.kind !== 'soccer') st.attempt = -1;
      }),
    []
  );

  useFrame(() => {
    const st = g.current;
    const ball = bodies.ball;
    if (!ball || !isPlaying('soccer') || st.attempt < 0) return;
    const now = performance.now();
    if (!st.shotAt && fx.lastKick > st.placedAt) st.shotAt = fx.lastKick;
    if (st.shotAt && !st.resolvedAt) {
      const scored = goalEvents.lastAt > st.shotAt;
      const v = ball.linvel();
      const stopped = now - st.shotAt > 1200 && Math.hypot(v.x, v.y, v.z) < 0.8;
      if (scored) st.resolvedAt = now;
      else if (stopped || now - st.shotAt > 3500) {
        st.resolvedAt = now;
        callout(keeperTouch.at > st.shotAt ? 'SAVED!' : 'MISSED');
      }
    }
    if (st.resolvedAt && now - st.resolvedAt > 900) {
      st.attempt++;
      let next = Math.floor(Math.random() * SPOTS.length);
      if (next === st.spot) next = (next + 1) % SPOTS.length;
      place(next);
    }
  });

  return null;
}

/** A target ring on the goal mouth showing where a charging shot will go. */
function AimTarget() {
  const group = useRef<Group>(null);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    g.visible = fx.aim.visible;
    if (!fx.aim.visible) return;
    g.position.set(fx.aim.x, fx.aim.y, GOAL.z + 0.08);
    g.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 10) * 0.06);
  });
  return (
    <group ref={group} visible={false}>
      <mesh>
        <torusGeometry args={[0.32, 0.035, 8, 32]} />
        <meshBasicMaterial color="#ffd166" toneMapped={false} />
      </mesh>
      <mesh>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Field() {
  return (
    <>
      <PitchSurface />
      <Goal />
      <AimTarget />
      <Keeper />
      <Scoreboard />
      <ShootingChallenge />
      <CornerFlag x={FIELD.minX} z={FIELD.goalZ} color="#ff6b6b" />
      <CornerFlag x={FIELD.maxX} z={FIELD.goalZ} color="#ffe66d" />
      <CornerFlag x={FIELD.minX} z={FIELD.halfwayZ} color="#4ecdc4" />
      <CornerFlag x={FIELD.maxX} z={FIELD.halfwayZ} color="#ff8b94" />
    </>
  );
}
