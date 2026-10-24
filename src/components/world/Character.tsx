import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, IcosahedronGeometry, MathUtils, MeshStandardMaterial } from 'three';
import { canvasTexture, FONT } from './textures';

/** Animation inputs, written by the player controller every frame. */
export interface CharacterPose {
  /** Horizontal speed in m/s. */
  speed: number;
  /** Run cycle phase in radians. */
  phase: number;
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
}

export const createPose = (): CharacterPose => ({
  speed: 0,
  phase: 0,
  charge: 0,
  kick: 0,
  touch: 0,
  touchSide: 1,
  celebrate: -1
});

const COLORS = {
  skin: '#8d5a3b',
  hair: '#17110e',
  kit: '#f6f6f2',
  trim: '#161616',
  shorts: '#1a1a1f',
  sock: '#f1f1ec',
  boot: '#121212',
  eye: '#1b120e',
  mouth: '#4a1f18',
  teeth: '#fbfbf8'
};

/** Wavy hair: [x, y, z, radius] blobs around the head (head-local space). */
const CURLS: [number, number, number, number][] = [
  [0, 0.318, 0.0, 0.068],
  [0.075, 0.305, 0.035, 0.064],
  [-0.075, 0.307, 0.03, 0.066],
  [0.045, 0.295, -0.085, 0.066],
  [-0.05, 0.29, -0.085, 0.064],
  [0.142, 0.18, -0.03, 0.05],
  [-0.142, 0.18, -0.03, 0.05],
  [0.065, 0.285, 0.105, 0.06],
  [-0.01, 0.285, 0.125, 0.062],
  [-0.085, 0.255, 0.105, 0.058],
  [0.135, 0.235, 0.025, 0.06],
  [-0.138, 0.23, 0.02, 0.06],
  [0.12, 0.25, -0.075, 0.062],
  [-0.12, 0.245, -0.08, 0.062],
  [0, 0.235, -0.135, 0.07],
  [0.085, 0.175, -0.125, 0.06],
  [-0.085, 0.175, -0.125, 0.06],
  [0, 0.12, -0.13, 0.058]
];

type Materials = Record<keyof typeof COLORS, MeshStandardMaterial>;
type JointRef = RefObject<Group | null>;

const { damp, lerp } = MathUtils;
const smooth = (t: number) => t * t * (3 - 2 * t);

export function Character({ pose }: { pose: CharacterPose }) {
  const m = useMemo<Materials>(() => {
    const mat = (color: string, roughness: number, flatShading = false) =>
      new MeshStandardMaterial({ color, roughness, flatShading });
    return {
      skin: mat(COLORS.skin, 0.6),
      hair: mat(COLORS.hair, 0.95, true),
      kit: mat(COLORS.kit, 0.55),
      trim: mat(COLORS.trim, 0.6),
      shorts: mat(COLORS.shorts, 0.75),
      sock: mat(COLORS.sock, 0.8),
      boot: mat(COLORS.boot, 0.35),
      eye: mat(COLORS.eye, 0.3),
      mouth: mat(COLORS.mouth, 0.6),
      teeth: mat(COLORS.teeth, 0.4)
    };
  }, []);

  // The jersey texture wraps around the torso: u = 0 is the chest, u = 0.5 the back.
  const jersey = useMemo(
    () =>
      new MeshStandardMaterial({
        roughness: 0.55,
        map: canvasTexture(1024, 512, (ctx, w, h) => {
          ctx.fillStyle = COLORS.kit;
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = COLORS.trim;
          for (const x of [w * 0.25, w * 0.75]) ctx.fillRect(x - 5, 0, 10, h);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.font = `800 46px ${FONT}`;
          ctx.fillText('AADHAV', w / 2, 120);
          ctx.font = `900 250px ${FONT}`;
          ctx.fillText('7', w / 2, 360);
          ctx.font = `900 64px ${FONT}`;
          ctx.fillText('7', w * 0.075, 150);
        })
      }),
    []
  );

  const curlGeometry = useMemo(() => new IcosahedronGeometry(1, 1), []);

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
    const run = Math.min(pose.speed / 5.2, 1.6);
    const amp = Math.min(run, 1);
    const sprint = Math.max(0, run - 1);
    const idle = 1 - amp;
    const s = Math.sin(pose.phase);
    const c = Math.cos(pose.phase);
    const stride = 0.75 + sprint * 0.5;

    // Run cycle
    let hipLx = -s * stride * amp;
    let hipRx = s * stride * amp;
    let hipLz = 0;
    let hipRz = 0;
    let kneeLx = 0.05 + (0.1 + Math.max(0, c) * (1.05 + sprint)) * amp;
    let kneeRx = 0.05 + (0.1 + Math.max(0, -c) * (1.05 + sprint)) * amp;
    let shLx = s * 0.75 * amp;
    let shRx = -s * 0.75 * amp;
    let shLz = -0.12 - amp * 0.04 - Math.sin(t * 1.7) * 0.025 * idle;
    let shRz = 0.12 + amp * 0.04 + Math.sin(t * 1.7) * 0.025 * idle;
    let elLx = -0.25 - 0.95 * amp;
    let elRx = -0.25 - 0.95 * amp;
    let torsoX = 0.1 * amp + 0.16 * sprint + Math.sin(t * 1.7) * 0.015 * idle;
    let torsoY = s * 0.16 * amp;
    let headX = -torsoX * 0.6;
    let headY = -torsoY * 0.7 + Math.sin(t * 0.6) * 0.12 * idle;
    let bob = (Math.abs(s) * 0.07 - 0.035) * amp;

    // Dribble touch: a quick flick of the touching foot.
    if (pose.touch > 0) {
      const flick = Math.sin(pose.touch * Math.PI) * 0.45;
      if (pose.touchSide > 0) hipRx -= flick;
      else hipLx -= flick;
    }

    // Shot wind-up
    if (pose.charge > 0) {
      const k = smooth(pose.charge);
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

    // Strike
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

    const lambda = kicking ? 40 : 16;
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
    if (root.current) root.current.position.y = damp(root.current.position.y, bob, 20, dt);
  });

  return (
    <group ref={root}>
      <group position={[0, 0.95, 0]}>
        {/* Shorts */}
        <mesh material={m.shorts} position={[0, -0.04, 0]} scale={[1, 1, 0.6]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.17, 16]} />
        </mesh>
        <Leg side={-1} hip={hipL} knee={kneeL} m={m} />
        <Leg side={1} hip={hipR} knee={kneeR} m={m} />

        <group ref={torso}>
          <mesh material={jersey} position={[0, 0.3, 0]} scale={[1, 1, 0.58]} castShadow>
            <cylinderGeometry args={[0.235, 0.2, 0.56, 20]} />
          </mesh>
          {/* Rounded shoulders */}
          <mesh material={m.kit} position={[0, 0.578, 0]} scale={[1, 0.32, 0.58]} castShadow>
            <sphereGeometry args={[0.235, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          {/* Collar */}
          <mesh material={m.trim} position={[0, 0.64, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.068, 0.018, 6, 16]} />
          </mesh>
          {/* Neck */}
          <mesh material={m.skin} position={[0, 0.62, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.06, 0.12, 10]} />
          </mesh>
          <group ref={head} position={[0, 0.66, 0]}>
            <Head m={m} curlGeometry={curlGeometry} />
          </group>
          <Arm side={-1} shoulder={shoulderL} elbow={elbowL} m={m} />
          <Arm side={1} shoulder={shoulderR} elbow={elbowR} m={m} />
        </group>
      </group>
    </group>
  );
}

function Head({ m, curlGeometry }: { m: Materials; curlGeometry: IcosahedronGeometry }) {
  return (
    <group>
      {/* Skull */}
      <mesh material={m.skin} position={[0, 0.15, 0]} scale={[0.92, 1.08, 1]} castShadow>
        <sphereGeometry args={[0.16, 24, 18]} />
      </mesh>
      {/* Ears */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={m.skin} position={[side * 0.146, 0.14, -0.005]} scale={[0.5, 1, 0.8]}>
          <sphereGeometry args={[0.038, 10, 8]} />
        </mesh>
      ))}
      {/* Hair: a cap plus wavy curls and a fringe */}
      <mesh material={m.hair} position={[0, 0.17, -0.012]} rotation={[-0.38, 0, 0]} scale={[0.96, 1, 1.02]} castShadow>
        <sphereGeometry args={[0.168, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
      </mesh>
      {CURLS.map(([x, y, z, r], i) => (
        <mesh
          key={i}
          geometry={curlGeometry}
          material={m.hair}
          position={[x, y, z]}
          rotation={[i * 0.7, i * 1.3, 0]}
          scale={r}
          castShadow
        />
      ))}
      {/* Eyes and brows */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh material={m.eye} position={[side * 0.052, 0.168, 0.143]}>
            <sphereGeometry args={[0.019, 10, 8]} />
          </mesh>
          <mesh material={m.hair} position={[side * 0.056, 0.205, 0.142]} rotation={[0, 0, side * -0.12]}>
            <boxGeometry args={[0.056, 0.013, 0.014]} />
          </mesh>
        </group>
      ))}
      {/* Nose */}
      <mesh material={m.skin} position={[0, 0.13, 0.158]} scale={[0.75, 0.9, 0.8]}>
        <sphereGeometry args={[0.022, 10, 8]} />
      </mesh>
      {/* Big grin */}
      <mesh material={m.mouth} position={[0, 0.098, 0.149]} rotation={[0.3, 0, 0]} scale={[1.25, 0.72, 1]}>
        <circleGeometry args={[0.045, 20, Math.PI, Math.PI]} />
      </mesh>
      <mesh material={m.teeth} position={[0, 0.097, 0.151]} rotation={[0.3, 0, 0]} scale={[1.25, 0.6, 1]}>
        <circleGeometry args={[0.039, 20, Math.PI, Math.PI]} />
      </mesh>
      {/* Thin mustache */}
      {[-1, 1].map((side) => (
        <mesh key={side} material={m.hair} position={[side * 0.025, 0.112, 0.153]} rotation={[0, 0, side * -0.22]}>
          <boxGeometry args={[0.046, 0.011, 0.012]} />
        </mesh>
      ))}
      {/* Goatee and soul patch */}
      <mesh material={m.hair} position={[0, 0.028, 0.116]} rotation={[0.45, 0, 0]} scale={[0.027, 0.024, 0.013]}>
        <sphereGeometry args={[1, 12, 10]} />
      </mesh>
      <mesh material={m.hair} position={[0, 0.05, 0.134]} scale={[0.008, 0.011, 0.006]}>
        <sphereGeometry args={[1, 8, 6]} />
      </mesh>
    </group>
  );
}

function Leg({ side, hip, knee, m }: { side: number; hip: JointRef; knee: JointRef; m: Materials }) {
  return (
    <group ref={hip} position={[side * 0.1, -0.04, 0]}>
      <mesh material={m.shorts} position={[0, -0.1, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.09, 0.22, 10]} />
      </mesh>
      <mesh material={m.skin} position={[0, -0.31, 0]} castShadow>
        <cylinderGeometry args={[0.072, 0.064, 0.22, 10]} />
      </mesh>
      <group ref={knee} position={[0, -0.43, 0]}>
        <mesh material={m.sock} position={[0, -0.2, 0]} castShadow>
          <cylinderGeometry args={[0.066, 0.055, 0.38, 10]} />
        </mesh>
        <mesh material={m.boot} position={[0, -0.43, 0.04]} castShadow>
          <boxGeometry args={[0.11, 0.08, 0.25]} />
        </mesh>
      </group>
    </group>
  );
}

function Arm({ side, shoulder, elbow, m }: { side: number; shoulder: JointRef; elbow: JointRef; m: Materials }) {
  return (
    <group ref={shoulder} position={[side * 0.27, 0.5, 0]}>
      <mesh material={m.kit} position={[0, -0.06, 0]} castShadow>
        <cylinderGeometry args={[0.075, 0.07, 0.16, 10]} />
      </mesh>
      <mesh material={m.trim} position={[0, -0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.068, 0.012, 6, 14]} />
      </mesh>
      <mesh material={m.skin} position={[0, -0.215, 0]} castShadow>
        <cylinderGeometry args={[0.052, 0.048, 0.16, 10]} />
      </mesh>
      <group ref={elbow} position={[0, -0.29, 0]}>
        <mesh material={m.skin} position={[0, -0.11, 0]} castShadow>
          <cylinderGeometry args={[0.047, 0.04, 0.22, 10]} />
        </mesh>
        <mesh material={m.skin} position={[0, -0.25, 0]} castShadow>
          <sphereGeometry args={[0.05, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}
