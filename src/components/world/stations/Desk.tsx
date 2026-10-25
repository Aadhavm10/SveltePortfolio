import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { Mesh, MeshStandardMaterial } from 'three';
import { experience } from '../../../data/portfolio';
import { ARCADE_H, ARCADE_W, drawArcade, updateArcade } from '../games/arcade';
import { LID_TILT, PROPS } from '../layout';
import { bodies, world } from '../store';
import { canvasTexture } from '../textures';
import { Cable } from './Cable';
import { ALUMINIUM, DARK, useScreen } from './common';
import { drawExperience } from './screens';

function keyboardTexture() {
  return canvasTexture(1024, 420, (ctx, w, h) => {
    ctx.fillStyle = '#2a2b31';
    ctx.fillRect(0, 0, w, h);
    const rows = 5;
    const keyH = (h - 40) / rows;
    for (let r = 0; r < rows; r++) {
      const keys = r === 4 ? 9 : 14;
      const keyW = (w - 40) / keys;
      for (let k = 0; k < keys; k++) {
        const wide = r === 4 && k === 4 ? 3 : 1;
        if (r === 4 && k > 4 && k < 7) continue;
        ctx.fillStyle = '#121317';
        ctx.beginPath();
        ctx.roundRect(20 + k * keyW + 4, 20 + r * keyH + 4, keyW * wide - 8, keyH - 8, 8);
        ctx.fill();
      }
    }
  });
}

/** Giant laptop that doubles as a tiny arcade. */
function Laptop() {
  const screen = useMemo(() => canvasTexture(ARCADE_W, ARCADE_H, (ctx) => drawArcade(ctx, false)), []);
  const idle = useRef(0);
  useFrame((_, delta) => {
    const active = world.get().station === 'arcade';
    updateArcade(active ? delta : delta * 0.5);
    // Full speed while playing; the attract screen only needs a few frames a second, and only nearby.
    idle.current += delta;
    if (!active) {
      const p = bodies.player?.translation();
      const near = p && Math.hypot(p.x - PROPS.laptop.x, p.z - PROPS.laptop.z) < 40;
      if (!near || idle.current < 0.25) return;
    }
    idle.current = 0;
    screen.redraw((ctx) => drawArcade(ctx, active));
  });

  const keys = useMemo(keyboardTexture, []);
  const { x, z } = PROPS.laptop;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.85, 0.15, 1.95]} position={[0, 0.15, 0]} />
        <CuboidCollider args={[2.85, 1.85, 0.2]} position={[0, 2, -2.2]} />
      </RigidBody>
      <RoundedBox args={[5.7, 0.26, 3.9]} radius={0.1} smoothness={3} position={[0, 0.13, 0]} material={ALUMINIUM} castShadow receiveShadow />
      <mesh position={[0, 0.265, -0.45]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4.9, 2]} />
        <meshStandardMaterial map={keys} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.265, 1.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.8, 1.05]} />
        <meshStandardMaterial color="#b9bcc3" metalness={0.4} roughness={0.25} />
      </mesh>
      {/* Ports on the right edge, where the monitor cable plugs in */}
      {[-0.35, 0.05].map((pz) => (
        <mesh key={pz} position={[2.86, 0.13, pz - 0.4]} material={DARK}>
          <boxGeometry args={[0.02, 0.07, 0.22]} />
        </mesh>
      ))}
      {/* A couple of stickers on the palm rest */}
      <mesh position={[-2.1, 0.266, 1.3]} rotation={[-Math.PI / 2, 0, 0.3]}>
        <circleGeometry args={[0.22, 20]} />
        <meshStandardMaterial color="#ff8a7a" roughness={0.6} />
      </mesh>
      <mesh position={[-1.55, 0.266, 1.45]} rotation={[-Math.PI / 2, 0, -0.2]}>
        <planeGeometry args={[0.36, 0.24]} />
        <meshStandardMaterial color="#7cc8e4" roughness={0.6} />
      </mesh>
      <group position={[0, 0.24, -1.9]} rotation={[-LID_TILT, 0, 0]}>
        <RoundedBox args={[5.7, 3.75, 0.14]} radius={0.08} smoothness={3} position={[0, 1.85, -0.05]} material={ALUMINIUM} castShadow />
        <mesh position={[0, 1.85, 0.025]}>
          <planeGeometry args={[5.55, 3.6]} />
          <meshStandardMaterial color="#0b0b0d" roughness={0.2} />
        </mesh>
        <mesh position={[0, 1.85, 0.03]}>
          <planeGeometry args={[5.25, 3.28]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
        {/* Webcam dot */}
        <mesh position={[0, 3.62, 0.03]}>
          <circleGeometry args={[0.035, 12]} />
          <meshBasicMaterial color="#202125" />
        </mesh>
      </group>
    </group>
  );
}

/** Giant monitor on its stand: experience, one role per page. */
function Monitor() {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const s = world.get();
    const active = s.station === 'experience';
    const page = active ? s.page : 0;
    drawExperience(ctx, w, h, experience[page], page, experience.length, active);
  };
  const screen = useScreen(1600, 940, draw, () => {
    const s = world.get();
    return `${s.station === 'experience' ? s.page : 0}|${s.station === 'experience'}`;
  });
  const { x, z } = PROPS.monitor;
  const notes = useMemo(
    () => [
      { x: -2.62, y: 3.55, rot: 0.12, color: '#ffe27a' },
      { x: -2.6, y: 3.05, rot: -0.08, color: '#ff9ec3' },
      { x: 2.62, y: 1.55, rot: -0.15, color: '#9fe3b0' }
    ],
    []
  );
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[1.15, 0.1, 0.8]} position={[0, 0.1, -0.2]} />
        <CuboidCollider args={[2.6, 1.6, 0.2]} position={[0, 2.65, 0]} />
      </RigidBody>
      {/* Stand */}
      <RoundedBox args={[2.3, 0.14, 1.6]} radius={0.06} position={[0, 0.07, -0.2]} material={ALUMINIUM} castShadow receiveShadow />
      <RoundedBox args={[0.5, 1.6, 0.22]} radius={0.06} position={[0, 0.9, -0.55]} rotation={[-0.12, 0, 0]} material={ALUMINIUM} castShadow />
      {/* Cable hole in the neck */}
      <mesh position={[0, 0.75, -0.67]} rotation={[0.12, Math.PI, 0]}>
        <circleGeometry args={[0.1, 16]} />
        <meshBasicMaterial color="#45474d" />
      </mesh>
      {/* Screen */}
      <RoundedBox args={[5.15, 3.15, 0.22]} radius={0.08} smoothness={3} position={[0, 2.65, -0.12]} material={ALUMINIUM} castShadow />
      <mesh position={[0, 2.65, 0.005]}>
        <planeGeometry args={[5.0, 3.0]} />
        <meshStandardMaterial color="#0b0b0d" roughness={0.2} />
      </mesh>
      <mesh position={[0, 2.65, 0.01]}>
        <planeGeometry args={[4.9, 2.9]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {/* Power light */}
      <mesh position={[2.3, 1.15, 0.0]}>
        <circleGeometry args={[0.03, 10]} />
        <meshBasicMaterial color="#9fe3b0" toneMapped={false} />
      </mesh>
      {/* Sticky notes on the bezel */}
      {notes.map((n, i) => (
        <mesh key={i} position={[n.x, n.y - 0.2, 0.015]} rotation={[0, 0, n.rot]}>
          <planeGeometry args={[0.42, 0.42]} />
          <meshStandardMaterial color={n.color} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

/** Steam that rises off the coffee and fades. */
function Steam({ position }: { position: [number, number, number] }) {
  const puffs = useRef<Mesh[]>([]);
  const materials = useMemo(() => [0, 1, 2].map(() => new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })), []);
  useFrame((state) => {
    puffs.current.forEach((m, i) => {
      if (!m) return;
      const k = (state.clock.elapsedTime * 0.35 + i / 3) % 1;
      m.position.set(Math.sin(k * 6 + i) * 0.08, k * 0.9, 0);
      m.scale.setScalar(0.08 + k * 0.14);
      (m.material as MeshStandardMaterial).opacity = (1 - k) * 0.45;
    });
  });
  return (
    <group position={position}>
      {[0, 1, 2].map((i) => (
        <mesh key={i} ref={(m) => void (puffs.current[i] = m!)} material={materials[i]}>
          <sphereGeometry args={[1, 10, 8]} />
        </mesh>
      ))}
    </group>
  );
}

/** Mouse, mug, plant, power strip and an outdoor outlet, all at laptop scale. */
function DeskBits() {
  const { x: lx, z: lz } = PROPS.laptop;
  const { x: mx, z: mz } = PROPS.monitor;
  const { x: sx, z: sz } = PROPS.powerStrip;
  const { x: ox, z: oz } = PROPS.outlet;
  return (
    <>
      {/* Mouse with its pad */}
      <mesh position={[lx + 4.4, 0.025, lz + 1.6]} rotation={[-Math.PI / 2, 0, 0.1]} receiveShadow>
        <planeGeometry args={[1.5, 1.2]} />
        <meshStandardMaterial color="#3d3a55" roughness={0.9} />
      </mesh>
      <mesh position={[lx + 4.4, 0.16, lz + 1.6]} scale={[0.36, 0.2, 0.55]} material={ALUMINIUM} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
      </mesh>
      {/* Coffee mug */}
      <group position={[mx + 3.4, 0, mz + 1.3]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.38, 0.9, 20]} />
          <meshStandardMaterial color="#ff8b6b" roughness={0.5} />
        </mesh>
        <mesh position={[0.45, 0.48, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[0.2, 0.06, 8, 16]} />
          <meshStandardMaterial color="#ff8b6b" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.86, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.37, 20]} />
          <meshStandardMaterial color="#6b4630" roughness={0.3} />
        </mesh>
        <group userData={{ dynamic: true }}>
          <Steam position={[0, 1.0, 0]} />
        </group>
      </group>
      {/* Potted plant */}
      <group position={[lx - 3.9, 0, lz - 0.6]}>
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.4, 0.8, 16]} />
          <meshStandardMaterial color="#e9dccb" roughness={0.8} />
        </mesh>
        {[
          [0, 1.15, 0, 0.55],
          [0.32, 1.45, 0.1, 0.4],
          [-0.3, 1.35, -0.12, 0.42],
          [0.05, 1.75, -0.05, 0.32]
        ].map(([px, py, pz, r], i) => (
          <mesh key={i} position={[px, py, pz]} castShadow>
            <icosahedronGeometry args={[r, 1]} />
            <meshStandardMaterial color={i % 2 ? '#6fa843' : '#5d8d3b'} roughness={0.8} flatShading />
          </mesh>
        ))}
      </group>
      {/* Power strip with a glowing switch */}
      <group position={[sx, 0, sz]}>
        <RoundedBox args={[2.2, 0.22, 0.6]} radius={0.06} position={[0, 0.11, 0]} castShadow>
          <meshStandardMaterial color="#f4f1ea" roughness={0.5} />
        </RoundedBox>
        {[-0.6, -0.1, 0.4].map((px) => (
          <mesh key={px} position={[px, 0.225, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.16, 18]} />
            <meshStandardMaterial color="#d9d4c9" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0.88, 0.235, 0]}>
          <boxGeometry args={[0.2, 0.06, 0.3]} />
          <meshBasicMaterial color="#ff7a59" toneMapped={false} />
        </mesh>
      </group>
      {/* Outdoor outlet on a little post */}
      <group position={[ox, 0, oz]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.24, 1.2, 0.24]} />
          <meshStandardMaterial color="#8a5d3b" roughness={0.8} />
        </mesh>
        <RoundedBox args={[0.5, 0.6, 0.22]} radius={0.04} position={[0, 1.0, 0.2]} castShadow>
          <meshStandardMaterial color="#9aa3ab" roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 1.06, 0.315]}>
          <boxGeometry args={[0.34, 0.3, 0.02]} />
          <meshStandardMaterial color="#c5ccd2" roughness={0.4} />
        </mesh>
        <RigidBody type="fixed" colliders={false}>
          <CylinderCollider args={[0.6, 0.3]} position={[0, 0.6, 0]} />
        </RigidBody>
      </group>
      {/* Video cable: laptop's right side to the back of the monitor */}
      <Cable
        color="#ffb3a1"
        plug="#f4f1ea"
        points={[
          [lx + 2.95, 0.13, lz - 0.6],
          [lx + 3.5, 0.06, lz - 0.6],
          [lx + 4.6, 0.06, lz - 1.5],
          [mx - 3.2, 0.06, mz - 0.8],
          [mx - 1.2, 0.06, mz - 1.2],
          [mx - 0.25, 0.12, mz - 1.05],
          [mx, 0.75, mz - 0.75]
        ]}
      />
      {/* Laptop charger, with its power brick, to the strip */}
      <Cable
        points={[
          [lx - 2.95, 0.13, lz - 1.2],
          [lx - 3.4, 0.06, lz - 1.8],
          [lx - 2.6, 0.06, lz - 3.4],
          [lx, 0.06, lz - 4.3],
          [sx - 2.6, 0.06, sz - 0.2],
          [sx - 1.3, 0.12, sz + 0.05]
        ]}
      />
      <RoundedBox args={[0.7, 0.24, 0.45]} radius={0.06} position={[lx + 0.2, 0.12, lz - 4.3]} rotation={[0, 0.15, 0]} castShadow>
        <meshStandardMaterial color="#f4f1ea" roughness={0.5} />
      </RoundedBox>
      {/* Monitor power to the strip */}
      <Cable
        color="#2f2f36"
        plug="#45474d"
        points={[
          [mx + 0.9, 1.2, mz - 0.35],
          [mx + 1.1, 0.06, mz - 0.9],
          [mx + 0.4, 0.06, mz - 2.6],
          [sx + 2.5, 0.06, sz + 0.4],
          [sx + 1.3, 0.12, sz + 0.05]
        ]}
      />
      {/* Strip to the outlet */}
      <Cable
        color="#ff7a59"
        plug="#f4f1ea"
        radius={0.06}
        points={[
          [sx - 1.25, 0.11, sz - 0.1],
          [sx - 1.9, 0.06, sz - 0.9],
          [sx - 0.6, 0.06, sz - 2.6],
          [ox - 0.6, 0.06, oz + 1.3],
          [ox, 0.25, oz + 0.55],
          [ox, 0.95, oz + 0.35]
        ]}
      />
    </>
  );
}

/** The desk setup: laptop arcade, experience monitor and everything plugged into them. */
export function Desk() {
  return (
    <>
      <Laptop />
      <Monitor />
      <DeskBits />
    </>
  );
}
