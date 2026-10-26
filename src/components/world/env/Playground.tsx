import { useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  BallCollider,
  ConeCollider,
  CuboidCollider,
  CylinderCollider,
  InstancedRigidBodies,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  type CollisionEnterPayload,
  type InstancedRigidBodyProps,
  type RapierRigidBody
} from '@react-three/rapier';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Euler,
  type InstancedMesh,
  LatheGeometry,
  MeshLambertMaterial,
  MeshStandardMaterial,
  Quaternion,
  QuadraticBezierCurve,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3
} from 'three';
import { TOYS } from '../layout';
import { playClack, playCrack, playGoal, playOpen } from '../sound';
import { bodies } from '../store';
import { canvasTexture, DISPLAY_FONT } from '../textures';
import { bin, cone } from './Details';
import { mergeParts, tinted } from './merge';
import { seeded } from './palette';

type V3 = [number, number, number];

// The toys' instanced meshes skip frustum culling: three works out their bounds once, from where the
// pieces start, and a kicked can or a crate panel can end up well outside them.

/** How the ball and the player were moving just before the latest physics step. */
const motion = { ball: { x: 0, y: 0, z: 0 }, player: { x: 0, y: 0, z: 0 } };

/** Clacks are rationed so a falling domino line sounds like a ripple, not a wall of noise. */
let lastClack = 0;
function clack(strength: number) {
  const now = performance.now();
  if (now - lastClack < 45) return;
  lastClack = now;
  playClack(strength);
}

const knock = ({ other }: CollisionEnterPayload) => {
  const v = other.rigidBody?.linvel();
  if (v) clack(Math.hypot(v.x, v.y, v.z) / 8);
};

/** Puts a set of bodies back where they started. */
function rack(list: (RapierRigidBody | null)[], homes: InstancedRigidBodyProps[]) {
  const q = new Quaternion();
  list.forEach((rb, i) => {
    const home = homes[i];
    if (!rb || !home) return;
    const [x, y, z] = home.position as V3;
    const [rx, ry, rz] = (home.rotation as V3 | undefined) ?? [0, 0, 0];
    q.setFromEuler(new Euler(rx, ry, rz));
    rb.setTranslation({ x, y, z }, false);
    rb.setRotation(q, false);
    rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
    rb.sleep();
  });
}

/** True when any body has moved or tipped away from where it started. */
function disturbed(list: (RapierRigidBody | null)[], homes: InstancedRigidBodyProps[]) {
  return list.some((rb, i) => {
    if (!rb || !homes[i]) return false;
    const p = rb.translation();
    const [x, y, z] = homes[i].position as V3;
    return Math.hypot(p.x - x, p.y - y, p.z - z) > 0.25;
  });
}

/**
 * Tidies a set back up: on its own after `auto` seconds if given (so you can bowl again), or
 * otherwise once the player has wandered off and won't see it pop back.
 */
function useTidy(list: MutableRefObject<(RapierRigidBody | null)[] | null>, homes: InstancedRigidBodyProps[], centre: [number, number], opts: { auto?: number; onTidy?: () => void; onDisturb?: () => void } = {}) {
  const state = useRef({ since: -1, check: 0 });
  useFrame((three) => {
    const t = three.clock.elapsedTime;
    if (t < state.current.check) return;
    state.current.check = t + 0.5;
    const bodiesList = list.current ?? [];
    const moved = disturbed(bodiesList, homes);
    if (!moved) {
      state.current.since = -1;
      return;
    }
    if (state.current.since < 0) {
      state.current.since = t;
      opts.onDisturb?.();
    }
    const p = bodies.player?.translation();
    const far = !p || Math.hypot(p.x - centre[0], p.z - centre[1]) > 26;
    if (far || (opts.auto !== undefined && t - state.current.since > opts.auto)) {
      rack(bodiesList, homes);
      state.current.since = -1;
      opts.onTidy?.();
    }
  });
}

/** Sets one colour per instance on an instanced mesh. */
function useInstanceColors(mesh: RefObject<InstancedMesh | null>, colors: string[]) {
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const c = new Color();
    colors.forEach((col, i) => m.setColorAt(i, c.set(col)));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [mesh, colors]);
}

const vertexColored = () => new MeshLambertMaterial({ vertexColors: true });

// --- Bowling ---

function pinGeometry() {
  const profile = [
    [0, 0],
    [0.07, 0],
    [0.1, 0.07],
    [0.12, 0.2],
    [0.112, 0.32],
    [0.07, 0.44],
    [0.05, 0.5],
    [0.06, 0.57],
    [0.075, 0.64],
    [0.065, 0.71],
    [0.03, 0.75],
    [0, 0.755]
  ].map(([r, y]) => new Vector2(r, y));
  const g = new LatheGeometry(profile, 16).toNonIndexed();
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const white = new Color('#fbf8f2');
  const red = new Color('#e0453a');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const c = (y > 0.47 && y < 0.5) || (y > 0.53 && y < 0.56) ? red : white;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function laneTexture() {
  return canvasTexture(128, 512, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? '#d9b07a' : '#e3bd8a';
      ctx.fillRect((i * w) / 8, 0, w / 8, h);
    }
    ctx.fillStyle = 'rgba(120, 80, 40, 0.18)';
    for (let i = 1; i < 8; i++) ctx.fillRect((i * w) / 8 - 1, 0, 2, h);
    // Aiming arrows and the foul line
    ctx.fillStyle = '#8a5a36';
    for (let i = 0; i < 5; i++) {
      const x = w * (0.2 + i * 0.15);
      const y = h * 0.72 - Math.abs(i - 2) * 14;
      ctx.beginPath();
      ctx.moveTo(x, y - 14);
      ctx.lineTo(x + 7, y + 6);
      ctx.lineTo(x - 7, y + 6);
      ctx.fill();
    }
    ctx.fillRect(0, h * 0.9, w, 4);
  });
}

function scoreTexture(text: string) {
  return canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = '#3a3346';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd28a';
    ctx.font = `700 40px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

function Bowling() {
  const { x, z, length } = TOYS.bowling;
  const headZ = z - length / 2 + 1.7;
  const homes = useMemo<InstancedRigidBodyProps[]>(() => {
    const list: InstancedRigidBodyProps[] = [];
    for (let row = 0; row < 4; row++) for (let i = 0; i <= row; i++) list.push({ key: `pin${row}${i}`, position: [x + (i - row / 2) * 0.42, 0.06, headZ - row * 0.38] });
    return list;
  }, [x, headZ]);
  const pins = useRef<(RapierRigidBody | null)[]>(null);
  const geometry = useMemo(pinGeometry, []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }), []);
  const lane = useMemo(laneTexture, []);
  const sign = useMemo(() => scoreTexture('BOWLING'), []);
  const [call, setCall] = useState<{ text: string; at: number } | null>(null);
  const counted = useRef(false);

  useTidy(pins, homes, [x, z], {
    auto: 7,
    onDisturb: () => {
      counted.current = false;
      // Count what's down once things have settled.
      setTimeout(() => {
        if (counted.current) return;
        counted.current = true;
        const down = (pins.current ?? []).filter((rb, i) => {
          if (!rb) return false;
          const r = rb.rotation();
          const up = 1 - 2 * (r.x * r.x + r.z * r.z);
          const p = rb.translation();
          const [hx, , hz] = homes[i].position as V3;
          return up < 0.8 || Math.hypot(p.x - hx, p.z - hz) > 0.3;
        }).length;
        if (!down) return;
        if (down === homes.length) playGoal();
        else playOpen();
        setCall({ text: down === homes.length ? 'Strike!' : `${down} pin${down === 1 ? '' : 's'}`, at: performance.now() });
      }, 3000);
    },
    onTidy: () => {
      setCall(null);
      clack(0.4);
    }
  });

  return (
    <>
      {/* The lane, its gutters and a little back wall */}
      <mesh position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.4, length]} />
        <meshLambertMaterial map={lane} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[x + side * 0.85, 0.05, z]} receiveShadow>
          <boxGeometry args={[0.3, 0.1, length]} />
          <meshLambertMaterial color="#8f8a86" />
        </mesh>
      ))}
      <mesh position={[x, 0.35, z - length / 2 - 0.1]} castShadow receiveShadow>
        <boxGeometry args={[2.1, 0.7, 0.2]} />
        <meshLambertMaterial color="#8a5a36" />
      </mesh>
      <mesh position={[x, 1.05, z - length / 2 - 0.1]} castShadow>
        <boxGeometry args={[1.6, 0.42, 0.08]} />
        <meshLambertMaterial color="#3a3346" />
      </mesh>
      <mesh position={[x, 1.05, z - length / 2 - 0.055]}>
        <planeGeometry args={[1.5, 0.36]} />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.05, 0.5, 0.1]} position={[x, 0.5, z - length / 2 - 0.1]} />
        {[-1, 1].map((side) => (
          <CuboidCollider key={side} args={[0.06, 0.12, length / 2]} position={[x + side * 0.98, 0.12, z]} />
        ))}
      </RigidBody>
      <InstancedRigidBodies ref={pins} instances={homes} colliders={false} canSleep linearDamping={0.3} angularDamping={0.4} onCollisionEnter={knock} colliderNodes={[<CylinderCollider key="c" args={[0.36, 0.11]} position={[0, 0.375, 0]} density={18} friction={0.5} restitution={0.2} />]}>
        <instancedMesh args={[geometry, material, homes.length]} frustumCulled={false} castShadow receiveShadow />
      </InstancedRigidBodies>
      {call && (
        <Html position={[x, 2.1, headZ - 0.4]} center zIndexRange={[20, 0]} pointerEvents="none">
          <div key={call.at} className="world-sign is-pop">
            {call.text}
          </div>
        </Html>
      )}
    </>
  );
}

// --- Dominoes ---

const DOMINO_COLORS = ['#ff8a7a', '#ffc25c', '#79c37d', '#7cc8e4', '#c9a6ff', '#ff9ec3'];

function Dominoes() {
  const { from, via, to } = TOYS.dominoes;
  const homes = useMemo<InstancedRigidBodyProps[]>(() => {
    const curve = new QuadraticBezierCurve(new Vector2(...from), new Vector2(...via), new Vector2(...to));
    const count = Math.floor(curve.getLength() / 0.36);
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const p = curve.getPointAt(t);
      const d = curve.getTangentAt(t);
      return { key: `d${i}`, position: [p.x, 0.31, p.y] as V3, rotation: [0, Math.atan2(d.x, d.y), 0] as V3 };
    });
  }, [from, via, to]);
  const list = useRef<(RapierRigidBody | null)[]>(null);
  const mesh = useRef<InstancedMesh>(null);
  const colors = useMemo(() => homes.map((_, i) => DOMINO_COLORS[i % DOMINO_COLORS.length]), [homes]);
  useInstanceColors(mesh, colors);
  const geometry = useMemo(() => new BoxGeometry(0.34, 0.62, 0.11), []);
  const material = useMemo(() => new MeshLambertMaterial(), []);
  useTidy(list, homes, [via[0], via[1]], { auto: 9, onTidy: () => clack(0.4) });
  return (
    <InstancedRigidBodies ref={list} instances={homes} colliders={false} canSleep onCollisionEnter={knock} colliderNodes={[<CuboidCollider key="c" args={[0.17, 0.31, 0.055]} density={6} friction={0.6} restitution={0.05} />]}>
      <instancedMesh ref={mesh} args={[geometry, material, homes.length]} frustumCulled={false} castShadow receiveShadow />
    </InstancedRigidBodies>
  );
}

// --- Breakable crates ---

const CRATE = 0.8;
const PANELS_PER_CRATE = 6;
/** Pieces wait out of sight, switched off, until a crate breaks. */
const PARKED_Y = -40;

function crateTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#c99a68';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(110, 70, 40, 0.35)';
    for (let i = 1; i < 4; i++) ctx.fillRect(0, (i * h) / 4 - 2, w, 4);
    ctx.strokeStyle = '#8a5a36';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(10, 10);
    ctx.lineTo(w - 10, h - 10);
    ctx.stroke();
  });
}

function Crates() {
  const { x, z } = TOYS.crates;
  const homes = useMemo<InstancedRigidBodyProps[]>(() => {
    const list: InstancedRigidBodyProps[] = [];
    const rows = [3, 2, 1];
    rows.forEach((n, row) => {
      for (let i = 0; i < n; i++) list.push({ key: `c${row}${i}`, position: [x + (i - (n - 1) / 2) * (CRATE + 0.05), CRATE / 2 + row * CRATE + 0.01, z], rotation: [0, (row + i) * 0.08, 0] });
    });
    return list;
  }, [x, z]);
  const panelHomes = useMemo<InstancedRigidBodyProps[]>(
    () => Array.from({ length: homes.length * PANELS_PER_CRATE }, (_, i) => ({ key: `p${i}`, position: [x + (i % 12) * 1.2, PARKED_Y - Math.floor(i / 12) * 2, z] as V3 })),
    [homes, x, z]
  );
  const crates = useRef<(RapierRigidBody | null)[]>(null);
  const panels = useRef<(RapierRigidBody | null)[]>(null);
  const broken = useRef<Set<number>>(new Set());
  const texture = useMemo(crateTexture, []);
  const crateGeometry = useMemo(() => new BoxGeometry(CRATE, CRATE, CRATE), []);
  const panelGeometry = useMemo(() => new BoxGeometry(CRATE - 0.02, CRATE - 0.02, 0.07), []);
  const material = useMemo(() => new MeshLambertMaterial({ map: texture }), [texture]);

  // Park the pieces once everything exists.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => (panels.current ?? []).forEach((rb) => rb?.setEnabled(false)));
    return () => cancelAnimationFrame(id);
  }, []);

  const shatter = (index: number, hit: { x: number; z: number }) => {
    const crate = crates.current?.[index];
    if (!crate || broken.current.has(index)) return;
    broken.current.add(index);
    const at = crate.translation();
    const r = crate.rotation();
    const q = new Quaternion(r.x, r.y, r.z, r.w);
    crate.setEnabled(false);
    crate.setTranslation({ x: at.x, y: PARKED_Y + 10, z: at.z }, false);
    playCrack();
    const faces: [V3, V3][] = [
      [[1, 0, 0], [0, Math.PI / 2, 0]],
      [[-1, 0, 0], [0, Math.PI / 2, 0]],
      [[0, 0, 1], [0, 0, 0]],
      [[0, 0, -1], [0, 0, 0]],
      [[0, 1, 0], [Math.PI / 2, 0, 0]],
      [[0, -1, 0], [Math.PI / 2, 0, 0]]
    ];
    const rand = seeded(index * 31 + broken.current.size);
    faces.forEach(([n, rot], f) => {
      const piece = panels.current?.[index * PANELS_PER_CRATE + f];
      if (!piece) return;
      const normal = new Vector3(...n).applyQuaternion(q);
      const pq = q.clone().multiply(new Quaternion().setFromEuler(new Euler(...rot)));
      piece.setEnabled(true);
      piece.setTranslation({ x: at.x + normal.x * CRATE * 0.45, y: at.y + normal.y * CRATE * 0.45, z: at.z + normal.z * CRATE * 0.45 }, true);
      piece.setRotation(pq, true);
      const burst = 3 + rand() * 3;
      piece.setLinvel({ x: normal.x * burst + hit.x * 0.45, y: Math.max(0, normal.y) * burst * 0.4 + 2.5 + rand() * 2.5, z: normal.z * burst + hit.z * 0.45 }, true);
      piece.setAngvel({ x: (rand() - 0.5) * 12, y: (rand() - 0.5) * 12, z: (rand() - 0.5) * 12 }, true);
    });
    // Shove the crates around it, so the stack comes down instead of bridging the gap.
    crates.current?.forEach((other, i) => {
      if (!other || broken.current.has(i)) return;
      const o = other.translation();
      const dx = o.x - at.x;
      const dz = o.z - at.z;
      if (Math.hypot(dx, o.y - at.y, dz) > CRATE * 1.6) return;
      // Ones above tip into the hole, ones beside it slide away.
      const away = (o.y > at.y + CRATE / 2 ? -2.4 : 1.4) / (Math.hypot(dx, dz) || 1);
      const m = other.mass();
      other.applyImpulse({ x: (hit.x * 0.12 + dx * away) * m, y: 0.5 * m, z: (hit.z * 0.12 + dz * away) * m }, true);
      other.applyTorqueImpulse({ x: (rand() - 0.5) * 0.8, y: (rand() - 0.5) * 0.8, z: (rand() - 0.5) * 0.8 }, true);
    });
  };

  // Only a proper kick or a sprint breaks a crate; tumbling onto each other doesn't. This is checked
  // after every step rather than on collision events, which only arrive once a frame: on a slow
  // frame the ball would already have bounced off and slowed down by then.
  useAfterPhysicsStep((world) => {
    const list = crates.current;
    if (!list) return;
    const hitters: [RapierRigidBody | null, { x: number; y: number; z: number }, number][] = [
      [bodies.ball, motion.ball, 9],
      [bodies.player, motion.player, 7.2]
    ];
    for (const [rb, v, needed] of hitters) {
      if (!rb || Math.hypot(v.x, v.y, v.z) < needed) continue;
      const p = rb.translation();
      const hitter = rb.collider(0);
      list.forEach((crate, i) => {
        if (!crate || broken.current.has(i)) return;
        const c = crate.translation();
        if (Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) > CRATE + 0.6) return;
        let touching = false;
        world.contactPair(crate.collider(0), hitter, (manifold) => void (touching ||= manifold.numContacts() > 0));
        if (!touching) return;
        shatter(i, v);
        // The ball carries on through what's left of it.
        if (rb === bodies.ball) rb.setLinvel({ x: v.x * 0.7, y: v.y * 0.7, z: v.z * 0.7 }, true);
      });
    }
  });

  useTidy(crates, homes, [x, z], {
    onTidy: () => {
      (crates.current ?? []).forEach((rb) => rb?.setEnabled(true));
      broken.current.clear();
      rack(panels.current ?? [], panelHomes);
      (panels.current ?? []).forEach((rb) => rb?.setEnabled(false));
    }
  });

  return (
    <>
      <InstancedRigidBodies ref={crates} instances={homes} colliders={false} canSleep onCollisionEnter={knock} colliderNodes={[<CuboidCollider key="c" args={[CRATE / 2, CRATE / 2, CRATE / 2]} density={2.2} friction={0.5} />]}>
        <instancedMesh args={[crateGeometry, material, homes.length]} frustumCulled={false} castShadow receiveShadow />
      </InstancedRigidBodies>
      <InstancedRigidBodies ref={panels} instances={panelHomes} colliders={false} canSleep linearDamping={0.2} angularDamping={0.5} colliderNodes={[<CuboidCollider key="c" args={[CRATE / 2 - 0.01, CRATE / 2 - 0.01, 0.035]} density={2} friction={0.8} />]}>
        <instancedMesh args={[panelGeometry, material, panelHomes.length]} frustumCulled={false} castShadow receiveShadow />
      </InstancedRigidBodies>
    </>
  );
}

// --- Cans, cones, bins, barrels, beach balls ---

const CAN_COLORS = ['#e0453a', '#7cc8e4', '#ffc25c', '#79c37d', '#fbf8f2'];

function Cans() {
  const { x, z } = TOYS.cans;
  const homes = useMemo<InstancedRigidBodyProps[]>(() => {
    const list: InstancedRigidBodyProps[] = [];
    [4, 3, 2, 1].forEach((n, row) => {
      for (let i = 0; i < n; i++) list.push({ key: `can${row}${i}`, position: [x + (i - (n - 1) / 2) * 0.28, 0.165 + row * 0.335, z] });
    });
    return list;
  }, [x, z]);
  const list = useRef<(RapierRigidBody | null)[]>(null);
  const mesh = useRef<InstancedMesh>(null);
  const colors = useMemo(() => homes.map((_, i) => CAN_COLORS[i % CAN_COLORS.length]), [homes]);
  useInstanceColors(mesh, colors);
  const geometry = useMemo(
    () =>
      mergeParts([
        { geometry: tinted(new CylinderGeometry(0.13, 0.13, 0.3, 16), '#ffffff'), position: [0, 0, 0] },
        { geometry: tinted(new CylinderGeometry(0.12, 0.13, 0.02, 16), '#c5ccd2'), position: [0, 0.16, 0] },
        { geometry: tinted(new CylinderGeometry(0.131, 0.131, 0.08, 16), '#f4f1ea'), position: [0, 0.02, 0] }
      ]),
    []
  );
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.3 }), []);
  useTidy(list, homes, [x, z], { auto: 12 });
  return (
    <InstancedRigidBodies ref={list} instances={homes} colliders={false} canSleep onCollisionEnter={knock} colliderNodes={[<CylinderCollider key="c" args={[0.16, 0.13]} density={4} friction={0.5} restitution={0.3} />]}>
      <instancedMesh ref={mesh} args={[geometry, material, homes.length]} frustumCulled={false} castShadow receiveShadow />
    </InstancedRigidBodies>
  );
}

function Cones() {
  const homes = useMemo<InstancedRigidBodyProps[]>(() => TOYS.cones.map(([x, z], i) => ({ key: `cone${i}`, position: [x, 0.01, z] })), []);
  const list = useRef<(RapierRigidBody | null)[]>(null);
  const geometry = useMemo(() => mergeParts(cone()), []);
  const material = useMemo(vertexColored, []);
  useTidy(list, homes, [-18.8, -13]);
  return (
    <InstancedRigidBodies ref={list} instances={homes} colliders={false} canSleep onCollisionEnter={knock} colliderNodes={[<ConeCollider key="c" args={[0.16, 0.13]} position={[0, 0.17, 0]} density={8} friction={0.6} />, <CuboidCollider key="b" args={[0.18, 0.015, 0.18]} position={[0, 0.015, 0]} density={8} />]}>
      <instancedMesh args={[geometry, material, homes.length]} frustumCulled={false} castShadow />
    </InstancedRigidBodies>
  );
}

function Bins() {
  const homes = useMemo<InstancedRigidBodyProps[]>(() => TOYS.bins.map(([x, z], i) => ({ key: `bin${i}`, position: [x, 0.01, z] })), []);
  const list = useRef<(RapierRigidBody | null)[]>(null);
  const geometry = useMemo(() => mergeParts(bin()), []);
  const material = useMemo(vertexColored, []);
  // Each bin tidies itself when you've walked away from it.
  const groups = useMemo(() => homes.map((h, i) => ({ home: h, i })), [homes]);
  useFrame(() => {
    const p = bodies.player?.translation();
    if (!p) return;
    groups.forEach(({ home, i }) => {
      const rb = list.current?.[i];
      const [hx, hy, hz] = home.position as V3;
      if (!rb || Math.hypot(p.x - hx, p.z - hz) < 26) return;
      const t = rb.translation();
      if (Math.hypot(t.x - hx, t.y - hy, t.z - hz) > 0.25) rack([rb], [home]);
    });
  });
  return (
    <InstancedRigidBodies ref={list} instances={homes} colliders={false} canSleep onCollisionEnter={knock} colliderNodes={[<CylinderCollider key="c" args={[0.45, 0.3]} position={[0, 0.45, 0]} density={10} friction={0.6} />]}>
      <instancedMesh args={[geometry, material, homes.length]} frustumCulled={false} castShadow receiveShadow />
    </InstancedRigidBodies>
  );
}

function Barrels() {
  const { x, z } = TOYS.barrels;
  const homes = useMemo<InstancedRigidBodyProps[]>(
    () => [
      { key: 'b0', position: [x, 0.43, z] },
      { key: 'b1', position: [x + 0.72, 0.43, z + 0.3] },
      { key: 'b2', position: [x + 0.3, 0.33, z + 1.1], rotation: [Math.PI / 2, 0.6, 0] }
    ],
    [x, z]
  );
  const list = useRef<(RapierRigidBody | null)[]>(null);
  const geometry = useMemo(
    () =>
      mergeParts([
        { geometry: tinted(new CylinderGeometry(0.3, 0.3, 0.86, 14), '#a8774c'), position: [0, 0, 0] },
        { geometry: tinted(new CylinderGeometry(0.34, 0.34, 0.4, 14), '#b98656'), position: [0, 0, 0] },
        ...[-0.32, 0.32, -0.1, 0.1].map((y) => ({ geometry: tinted(new TorusGeometry(0.325 + (Math.abs(y) < 0.2 ? 0.02 : 0), 0.025, 6, 20), '#5a5d66'), position: [0, y, 0] as V3, rotation: [Math.PI / 2, 0, 0] as V3 }))
      ]),
    []
  );
  const material = useMemo(vertexColored, []);
  useTidy(list, homes, [x, z]);
  return (
    <InstancedRigidBodies ref={list} instances={homes} colliders={false} canSleep onCollisionEnter={knock} colliderNodes={[<CylinderCollider key="c" args={[0.43, 0.32]} density={5} friction={0.6} />]}>
      <instancedMesh args={[geometry, material, homes.length]} frustumCulled={false} castShadow receiveShadow />
    </InstancedRigidBodies>
  );
}

function beachBallGeometry() {
  const g = new SphereGeometry(0.42, 24, 16).toNonIndexed();
  const pos = g.getAttribute('position');
  const colors = new Float32Array(pos.count * 3);
  const gores = ['#ff6b5b', '#fffaee', '#4fa8e0', '#fffaee', '#ffc25c', '#fffaee'].map((c) => new Color(c));
  const white = new Color('#fffaee');
  for (let i = 0; i < pos.count; i += 3) {
    // Colour whole triangles by where their middle sits, so the stripes stay crisp.
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (let k = 0; k < 3; k++) {
      cx += pos.getX(i + k);
      cy += pos.getY(i + k);
      cz += pos.getZ(i + k);
    }
    const a = (Math.atan2(cz, cx) + Math.PI) / (Math.PI * 2);
    const c = Math.abs(cy / 3) > 0.37 ? white : gores[Math.floor(a * gores.length) % gores.length];
    for (let k = 0; k < 3; k++) colors.set([c.r, c.g, c.b], (i + k) * 3);
  }
  g.setAttribute('color', new BufferAttribute(colors, 3));
  return g as BufferGeometry;
}

function BeachBalls() {
  const geometry = useMemo(beachBallGeometry, []);
  const material = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }), []);
  const refs = useRef<(RapierRigidBody | null)[]>([]);
  useFrame(() => {
    const p = bodies.player?.translation();
    if (!p) return;
    TOYS.beachBalls.forEach(([hx, hz], i) => {
      const rb = refs.current[i];
      if (!rb || Math.hypot(p.x - hx, p.z - hz) < 30) return;
      const t = rb.translation();
      if (Math.hypot(t.x - hx, t.z - hz) > 1) rack([rb], [{ key: i, position: [hx, 0.45, hz] }]);
    });
  });
  return (
    <>
      {TOYS.beachBalls.map(([x, z], i) => (
        <RigidBody key={i} ref={(rb) => void (refs.current[i] = rb)} position={[x, 0.45, z]} colliders={false} linearDamping={0.45} angularDamping={0.6} canSleep onCollisionEnter={knock}>
          <BallCollider args={[0.42]} mass={0.14} restitution={0.8} friction={0.5} />
          <mesh geometry={geometry} material={material} castShadow />
        </RigidBody>
      ))}
    </>
  );
}

/** Notes how things were moving before each physics step, for deciding what breaks. */
function MotionTracker() {
  useBeforePhysicsStep(() => {
    const b = bodies.ball?.linvel();
    const p = bodies.player?.linvel();
    motion.ball.x = b?.x ?? 0;
    motion.ball.y = b?.y ?? 0;
    motion.ball.z = b?.z ?? 0;
    motion.player.x = p?.x ?? 0;
    motion.player.z = p?.z ?? 0;
  });
  return null;
}

/** Things to knock over, kick about and break: they all tidy themselves up when you've moved on. */
export function Playground() {
  return (
    <>
      <MotionTracker />
      <Bowling />
      <Dominoes />
      <Crates />
      <Cans />
      <Cones />
      <Bins />
      <Barrels />
      <BeachBalls />
    </>
  );
}
