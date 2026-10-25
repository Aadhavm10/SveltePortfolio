import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Group, IcosahedronGeometry, LatheGeometry, MathUtils, MeshStandardMaterial, Vector2 } from 'three';
import { mergeParts, type Part } from './env/merge';
import { canvasTexture, FONT } from './textures';

/** Animation inputs, written by a controller every frame. */
export interface CharacterPose {
  /** Horizontal speed in m/s. */
  speed: number;
  /** Run cycle phase in radians. */
  phase: number;
  /** Lean into turns, in radians (positive leans right). */
  lean: number;
  /** Shot wind-up, 0..1. */
  charge: number;
  /** Kick swing progress, 0..1 (0 when not kicking). */
  kick: number;
  /** Dribble touch flick, decays 1 -> 0. */
  touch: number;
  /** Foot used for the last touch: 1 right, -1 left. */
  touchSide: number;
  /** Seconds since a goal celebration started, -1 when not celebrating. */
  celebrate: number;
  /** Holding a basketball at the chest, 0..1. */
  hold: number;
  /** Jump-shot progress, 0..1 (0 when not shooting). */
  shoot: number;
  /** Goalkeeper crouch, 0..1. */
  ready: number;
  /** Goalkeeper dive (arms stretched overhead), 0..1. */
  dive: number;
}

export const createPose = (): CharacterPose => ({
  speed: 0,
  phase: 0,
  lean: 0,
  charge: 0,
  kick: 0,
  touch: 0,
  touchSide: 1,
  celebrate: -1,
  hold: 0,
  shoot: 0,
  ready: 0,
  dive: 0
});

export interface Look {
  skin: string;
  hair: string;
  hairStyle: 'wavy' | 'short';
  beard: boolean;
  kit: string;
  trim: string;
  shorts: string;
  socks: string;
  boots: string;
  soles: string;
  gloves?: string;
  /** Jersey printing; leave both out for a plain tee. */
  name?: string;
  number?: string;
}

/** Plain white tee, dark shorts and white sneakers. */
export const AADHAV: Look = {
  skin: '#8d5a3b',
  hair: '#17110e',
  hairStyle: 'wavy',
  beard: true,
  kit: '#fbfaf6',
  trim: '#e6e3dc',
  shorts: '#2b2e38',
  socks: '#f4f2ec',
  boots: '#f2efe8',
  soles: '#e9775a'
};

export const KEEPER: Look = {
  skin: '#c58c63',
  hair: '#2a1c14',
  hairStyle: 'short',
  beard: false,
  kit: '#3ddc84',
  trim: '#0f3d24',
  shorts: '#0f3d24',
  socks: '#3ddc84',
  boots: '#141414',
  soles: '#ffffff',
  gloves: '#f4f4f4',
  number: '1'
};

/** Wavy hair: [x, y, z, radius] blobs around the head (head-local space). */
const CURLS: [number, number, number, number][] = [
  [0, 0.325, 0.0, 0.07],
  [0.078, 0.31, 0.04, 0.066],
  [-0.078, 0.312, 0.035, 0.068],
  [0.05, 0.3, -0.085, 0.068],
  [-0.05, 0.296, -0.085, 0.066],
  [0.07, 0.285, 0.105, 0.058],
  [-0.015, 0.29, 0.12, 0.06],
  [0.142, 0.235, 0.02, 0.058],
  [-0.145, 0.23, 0.015, 0.058],
  [0.125, 0.255, -0.075, 0.06],
  [-0.125, 0.25, -0.08, 0.06],
  [0, 0.24, -0.14, 0.068],
  [0.09, 0.18, -0.13, 0.058],
  [-0.09, 0.18, -0.13, 0.058],
  [0, 0.125, -0.135, 0.056],
  [0.15, 0.17, -0.04, 0.048],
  [-0.15, 0.17, -0.04, 0.048]
];

type Materials = ReturnType<typeof makeMaterials>;
type JointRef = RefObject<Group | null>;

const { damp, lerp } = MathUtils;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Numbered kit printing that wraps the torso: u = 0 is the chest, u = 0.5 the back. */
function kitTexture(look: Look, number: string) {
  return canvasTexture(1024, 512, (ctx, w, h) => {
    ctx.fillStyle = look.kit;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = look.trim;
    for (const x of [w * 0.25, w * 0.75]) ctx.fillRect(x - 6, 0, 12, h);
    ctx.fillRect(0, h - 14, w, 14);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (look.name) {
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText(look.name, w / 2, 150);
    }
    ctx.font = `900 230px ${FONT}`;
    ctx.fillText(number, w / 2, look.name ? 370 : 330);
    ctx.font = `900 60px ${FONT}`;
    ctx.fillText(number, w * 0.07, 190);
  });
}

function makeMaterials(look: Look) {
  const mat = (color: string, roughness: number, flatShading = false) => new MeshStandardMaterial({ color, roughness, flatShading });
  return {
    jersey: look.number ? new MeshStandardMaterial({ roughness: 0.6, map: kitTexture(look, look.number) }) : mat(look.kit, 0.75),
    skin: mat(look.skin, 0.62),
    hair: mat(look.hair, 0.9, true),
    kit: mat(look.kit, 0.7),
    trim: mat(look.trim, 0.7),
    shorts: mat(look.shorts, 0.75),
    socks: mat(look.socks, 0.8),
    boots: mat(look.boots, 0.45),
    soles: mat(look.soles, 0.5),
    hands: mat(look.gloves ?? look.skin, 0.62),
    eye: mat('#1a120e', 0.2),
    sparkle: new MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.6 }),
    blush: new MeshStandardMaterial({ color: '#d27466', roughness: 0.8, transparent: true, opacity: 0.55, depthWrite: false }),
    mouth: mat('#4a2018', 0.6)
  };
}

function torsoGeometry() {
  const profile = [
    [0.172, 0.0],
    [0.19, 0.08],
    [0.205, 0.22],
    [0.226, 0.36],
    [0.232, 0.46],
    [0.214, 0.535],
    [0.16, 0.59],
    [0.085, 0.62]
  ].map(([r, y]) => new Vector2(r, y));
  return new LatheGeometry(profile, 24);
}

export function Character({ pose, look = AADHAV }: { pose: CharacterPose; look?: Look }) {
  const m = useMemo(() => makeMaterials(look), [look]);
  const geometries = useMemo(() => {
    // All the curls (and the fringe) merged into one mesh: one draw call instead of nineteen.
    const curl = new IcosahedronGeometry(1, 1);
    const curls = mergeParts([
      ...CURLS.map(([x, y, z, r], i): Part => ({ geometry: curl, position: [x, y, z], rotation: [i * 0.7, i * 1.3, 0], scale: [r, r * 0.85, r] })),
      { geometry: curl, position: [-0.035, 0.262, 0.14], rotation: [0.3, 0.2, 0.45], scale: [0.1, 0.04, 0.05] },
      { geometry: curl, position: [0.06, 0.272, 0.132], rotation: [0.2, -0.2, -0.3], scale: [0.07, 0.035, 0.045] }
    ]);
    return { torso: torsoGeometry(), curls };
  }, []);

  const root = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const hipL = useRef<Group>(null);
  const hipR = useRef<Group>(null);
  const kneeL = useRef<Group>(null);
  const kneeR = useRef<Group>(null);
  const shoulderL = useRef<Group>(null);
  const shoulderR = useRef<Group>(null);
  const elbowL = useRef<Group>(null);
  const elbowR = useRef<Group>(null);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const run = Math.min(pose.speed / 5.4, 1.6);
    const amp = Math.min(run, 1);
    const sprint = Math.max(0, run - 1);
    const idle = 1 - amp;
    const s = Math.sin(pose.phase);
    const c = Math.cos(pose.phase);
    const stride = 0.78 + sprint * 0.45;

    // Run cycle
    let hipLx = -s * stride * amp;
    let hipRx = s * stride * amp;
    let hipLz = 0;
    let hipRz = 0;
    let kneeLx = 0.06 + (0.12 + Math.max(0, c) * (1.1 + sprint)) * amp;
    let kneeRx = 0.06 + (0.12 + Math.max(0, -c) * (1.1 + sprint)) * amp;
    let shLx = s * 0.8 * amp;
    let shRx = -s * 0.8 * amp;
    let shLz = -0.1 - amp * 0.05 - Math.sin(t * 1.7) * 0.025 * idle;
    let shRz = 0.1 + amp * 0.05 + Math.sin(t * 1.7) * 0.025 * idle;
    let elLx = -0.2 - 1.0 * amp;
    let elRx = -0.2 - 1.0 * amp;
    let torsoX = 0.08 * amp + 0.16 * sprint + Math.sin(t * 1.7) * 0.015 * idle;
    let torsoY = s * 0.18 * amp;
    let headX = -torsoX * 0.6;
    let headY = -torsoY * 0.7 + Math.sin(t * 0.5) * 0.18 * idle * idle;
    let bob = (Math.abs(s) * 0.075 - 0.04) * amp;
    let lift = 0;

    // Dribble touch: a quick flick of the touching foot.
    if (pose.touch > 0) {
      const flick = Math.sin(pose.touch * Math.PI) * 0.45;
      if (pose.touchSide > 0) hipRx -= flick;
      else hipLx -= flick;
    }

    // Goalkeeper crouch
    if (pose.ready > 0) {
      const k = pose.ready * idle;
      hipLx = lerp(hipLx, -0.45, k);
      hipRx = lerp(hipRx, -0.45, k);
      hipLz = lerp(hipLz, -0.12, k);
      hipRz = lerp(hipRz, 0.12, k);
      kneeLx = lerp(kneeLx, 0.75, k);
      kneeRx = lerp(kneeRx, 0.75, k);
      shLx = lerp(shLx, -0.55, k);
      shRx = lerp(shRx, -0.55, k);
      shLz = lerp(shLz, -0.55, k);
      shRz = lerp(shRz, 0.55, k);
      elLx = elRx = lerp(elLx, -0.7, k);
      torsoX = lerp(torsoX, 0.3, k);
      headX = lerp(headX, -0.25, k);
      bob = lerp(bob, -0.14, k);
    }

    // Holding a basketball at the chest
    if (pose.hold > 0) {
      const k = pose.hold;
      shLx = lerp(shLx, -0.95, k);
      shRx = lerp(shRx, -0.95, k);
      shLz = lerp(shLz, 0.18, k);
      shRz = lerp(shRz, -0.18, k);
      elLx = lerp(elLx, -1.15, k);
      elRx = lerp(elRx, -1.15, k);
    }

    // Shot wind-up
    if (pose.charge > 0) {
      const k = smooth(pose.charge);
      if (pose.hold > 0) {
        // Basketball: dip into the knees, ball up by the face.
        kneeLx = lerp(kneeLx, 0.7, k);
        kneeRx = lerp(kneeRx, 0.7, k);
        hipLx = lerp(hipLx, -0.4, k);
        hipRx = lerp(hipRx, -0.4, k);
        shLx = lerp(shLx, -2.1, k);
        shRx = lerp(shRx, -2.1, k);
        elLx = lerp(elLx, -1.6, k);
        elRx = lerp(elRx, -1.6, k);
        bob = lerp(bob, -0.16, k);
      } else {
        hipRx = lerp(hipRx, 0.9, k);
        kneeRx = lerp(kneeRx, 1.5, k);
        hipLx = lerp(hipLx, -0.1, k);
        kneeLx = lerp(kneeLx, 0.3, k);
        shLx = lerp(shLx, -0.35, k);
        shLz = lerp(shLz, -1.1, k);
        shRx = lerp(shRx, 0.45, k);
        shRz = lerp(shRz, 0.7, k);
        torsoX = lerp(torsoX, -0.1, k);
        torsoY = lerp(torsoY, 0.3, k);
        bob = lerp(bob, -0.04, k);
      }
    }

    // Jump shot
    if (pose.shoot > 0) {
      const k = pose.shoot;
      const up = Math.sin(Math.min(1, k * 1.4) * Math.PI);
      lift = up * 0.4;
      kneeLx = kneeRx = 0.15;
      hipLx = hipRx = -0.1;
      shLx = shRx = -2.8;
      shLz = 0.12;
      shRz = -0.12;
      elLx = elRx = k < 0.35 ? -1.4 : -0.15;
    }

    // Kick
    const kicking = pose.kick > 0;
    if (kicking) {
      const k = pose.kick;
      if (k < 0.25) {
        const e = smooth(k / 0.25);
        hipRx = lerp(0.9, -1.45, e);
        kneeRx = lerp(1.5, 0.08, e);
      } else {
        const e = smooth((k - 0.25) / 0.75);
        hipRx = lerp(-1.45, 0, e);
        kneeRx = lerp(0.08, 0.1, e);
      }
      hipLx = -0.1;
      kneeLx = 0.3;
      shLz = -1.05;
      shLx = -0.3;
      shRz = 0.6;
      shRx = 0.5;
      torsoX = k < 0.3 ? -0.18 : lerp(-0.18, 0.05, (k - 0.3) / 0.7);
      torsoY = lerp(0.3, -0.2, Math.min(1, k * 3));
    }

    // Goalkeeper dive: stretched out, arms overhead.
    if (pose.dive > 0) {
      const k = pose.dive;
      shLx = lerp(shLx, -3.0, k);
      shRx = lerp(shRx, -3.0, k);
      shLz = lerp(shLz, -0.15, k);
      shRz = lerp(shRz, 0.15, k);
      elLx = elRx = lerp(elLx, -0.1, k);
      hipLx = hipRx = lerp(hipLx, 0.05, k);
      kneeLx = kneeRx = lerp(kneeLx, 0.2, k);
      torsoX = lerp(torsoX, 0, k);
      bob = lerp(bob, 0, k);
    }

    // Goal celebration: jump with arms up, then land arms out wide.
    if (pose.celebrate >= 0) {
      const e = pose.celebrate;
      if (e < 0.7) {
        shLx = shRx = -2.75;
        shLz = -0.3;
        shRz = 0.3;
        elLx = elRx = -0.15;
        hipLx = hipRx = -0.35;
        kneeLx = kneeRx = 0.8;
        torsoX = -0.05;
      } else {
        shLx = shRx = 0.45;
        shLz = -1.05;
        shRz = 1.05;
        elLx = elRx = -0.1;
        hipLx = hipRx = -0.05;
        hipLz = -0.22;
        hipRz = 0.22;
        kneeLx = kneeRx = 0.3;
        torsoX = -0.2;
        headX = -0.3;
        bob = -0.08;
      }
      torsoY = 0;
      headY = 0;
    }

    const lambda = kicking || pose.shoot > 0 ? 38 : 15;
    const set = (ref: JointRef, x: number, y: number, z: number) => {
      const o = ref.current;
      if (!o) return;
      o.rotation.x = damp(o.rotation.x, x, lambda, dt);
      o.rotation.y = damp(o.rotation.y, y, lambda, dt);
      o.rotation.z = damp(o.rotation.z, z, lambda, dt);
    };
    set(hipL, hipLx, 0, hipLz);
    set(hipR, hipRx, 0, hipRz);
    set(kneeL, kneeLx, 0, 0);
    set(kneeR, kneeRx, 0, 0);
    set(shoulderL, shLx, 0, shLz);
    set(shoulderR, shRx, 0, shRz);
    set(elbowL, elLx, 0, 0);
    set(elbowR, elRx, 0, 0);
    set(torso, torsoX, torsoY, 0);
    set(head, headX, headY, 0);
    if (root.current) {
      root.current.position.y = damp(root.current.position.y, bob + lift, 20, dt);
      root.current.rotation.z = damp(root.current.rotation.z, -pose.lean, 10, dt);
    }
  });

  return (
    <group ref={root}>
      <group position={[0, 0.95, 0]}>
        {/* Shorts */}
        <mesh material={m.shorts} position={[0, -0.05, 0]} scale={[1, 1, 0.66]} castShadow>
          <cylinderGeometry args={[0.19, 0.205, 0.2, 18]} />
        </mesh>
        <Leg side={-1} hip={hipL} knee={kneeL} m={m} />
        <Leg side={1} hip={hipR} knee={kneeR} m={m} />

        <group ref={torso}>
          <mesh geometry={geometries.torso} material={m.jersey} scale={[1, 1, 0.62]} castShadow />
          <mesh material={m.trim} position={[0, 0.61, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.07, 0.014, 6, 18]} />
          </mesh>
          <mesh material={m.skin} position={[0, 0.65, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.06, 0.1, 10]} />
          </mesh>
          <group ref={head} position={[0, 0.65, 0]}>
            {/* A slightly oversized head keeps the look friendly. */}
            <group scale={1.16}>
              <Head m={m} look={look} curls={geometries.curls} />
            </group>
          </group>
          <Arm side={-1} shoulder={shoulderL} elbow={elbowL} m={m} />
          <Arm side={1} shoulder={shoulderR} elbow={elbowR} m={m} />
        </group>
      </group>
    </group>
  );
}

function Head({ m, look, curls }: { m: Materials; look: Look; curls: BufferGeometry }) {
  return (
    <group>
      <mesh material={m.skin} position={[0, 0.155, 0]} scale={[0.93, 1.06, 1]} castShadow>
        <sphereGeometry args={[0.165, 28, 20]} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} material={m.skin} position={[side * 0.15, 0.145, -0.005]} scale={[0.45, 1, 0.75]}>
          <sphereGeometry args={[0.04, 12, 8]} />
        </mesh>
      ))}

      {/* Hair */}
      <mesh material={m.hair} position={[0, 0.172, -0.012]} rotation={[-0.36, 0, 0]} scale={[0.97, 1, 1.03]} castShadow>
        <sphereGeometry args={[0.173, 18, 10, 0, Math.PI * 2, 0, Math.PI * (look.hairStyle === 'wavy' ? 0.56 : 0.5)]} />
      </mesh>
      {look.hairStyle === 'wavy' && (
        <>
          {/* Curls, with a fringe swooping across the forehead */}
          <mesh geometry={curls} material={m.hair} castShadow />
        </>
      )}

      {/* Eyes with a sparkle, brows and rosy cheeks */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh material={m.eye} position={[side * 0.056, 0.168, 0.146]} scale={[0.8, 1.15, 0.5]}>
            <sphereGeometry args={[0.024, 14, 12]} />
          </mesh>
          <mesh material={m.sparkle} position={[side * 0.056 + 0.007, 0.178, 0.158]}>
            <sphereGeometry args={[0.0065, 8, 6]} />
          </mesh>
          <mesh material={m.hair} position={[side * 0.057, 0.214, 0.147]} rotation={[0, 0, side * -0.12]}>
            <boxGeometry args={[0.054, 0.012, 0.012]} />
          </mesh>
          <mesh material={m.blush} position={[side * 0.093, 0.118, 0.13]} rotation={[0, side * 0.7, 0]} scale={[1, 0.6, 1]}>
            <circleGeometry args={[0.022, 16]} />
          </mesh>
        </group>
      ))}
      <mesh material={m.skin} position={[0, 0.132, 0.161]} scale={[0.8, 0.85, 0.8]}>
        <sphereGeometry args={[0.018, 10, 8]} />
      </mesh>

      {/* A simple curved smile, tilted to follow the face so no part of it sinks into the skin */}
      <mesh material={m.mouth} position={[0, 0.096, 0.156]} rotation={[0.33, 0, Math.PI]}>
        <torusGeometry args={[0.026, 0.0055, 6, 20, Math.PI]} />
      </mesh>

      {look.beard && (
        <>
          {[-1, 1].map((side) => (
            <mesh key={side} material={m.hair} position={[side * 0.025, 0.113, 0.156]} rotation={[0, 0, side * -0.22]}>
              <boxGeometry args={[0.046, 0.011, 0.012]} />
            </mesh>
          ))}
          {/* Pointed goatee lying on the chin */}
          <group position={[0, 0.036, 0.121]} rotation={[0.75, 0, 0]}>
            <mesh material={m.hair} rotation={[Math.PI, 0, 0]} scale={[1, 1, 0.35]}>
              <coneGeometry args={[0.026, 0.042, 3]} />
            </mesh>
          </group>
        </>
      )}
    </group>
  );
}

function Leg({ side, hip, knee, m }: { side: number; hip: JointRef; knee: JointRef; m: Materials }) {
  return (
    <group ref={hip} position={[side * 0.1, -0.06, 0]}>
      <mesh material={m.shorts} position={[0, -0.08, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.092, 0.2, 12]} />
      </mesh>
      <mesh material={m.skin} position={[0, -0.28, 0]} castShadow>
        <capsuleGeometry args={[0.068, 0.16, 4, 12]} />
      </mesh>
      <group ref={knee} position={[0, -0.41, 0]}>
        <mesh material={m.skin} position={[0, -0.05, 0]}>
          <capsuleGeometry args={[0.06, 0.06, 4, 10]} />
        </mesh>
        <mesh material={m.socks} position={[0, -0.24, 0]} castShadow>
          <capsuleGeometry args={[0.062, 0.24, 4, 12]} />
        </mesh>
        <mesh material={m.boots} position={[0, -0.44, 0.045]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <capsuleGeometry args={[0.058, 0.15, 4, 10]} />
        </mesh>
        <mesh material={m.soles} position={[0, -0.495, 0.045]}>
          <boxGeometry args={[0.1, 0.018, 0.24]} />
        </mesh>
      </group>
    </group>
  );
}

function Arm({ side, shoulder, elbow, m }: { side: number; shoulder: JointRef; elbow: JointRef; m: Materials }) {
  return (
    <group ref={shoulder} position={[side * 0.27, 0.5, 0]}>
      <mesh material={m.kit} position={[0, -0.04, 0]} castShadow>
        <sphereGeometry args={[0.082, 14, 10]} />
      </mesh>
      <mesh material={m.kit} position={[0, -0.1, 0]} castShadow>
        <cylinderGeometry args={[0.078, 0.07, 0.13, 12]} />
      </mesh>
      <mesh material={m.trim} position={[0, -0.165, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.068, 0.011, 6, 14]} />
      </mesh>
      <mesh material={m.skin} position={[0, -0.215, 0]} castShadow>
        <capsuleGeometry args={[0.05, 0.1, 4, 10]} />
      </mesh>
      <group ref={elbow} position={[0, -0.29, 0]}>
        <mesh material={m.skin} position={[0, -0.11, 0]} castShadow>
          <capsuleGeometry args={[0.045, 0.16, 4, 10]} />
        </mesh>
        <mesh material={m.hands} position={[0, -0.25, 0]} scale={[0.85, 1, 1]} castShadow>
          <sphereGeometry args={[0.055, 12, 10]} />
        </mesh>
      </group>
    </group>
  );
}
