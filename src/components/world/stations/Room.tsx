import { useEffect, useMemo, useRef, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { ContactShadows, Html, RoundedBox } from '@react-three/drei';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  MathUtils,
  MeshStandardMaterial,
  Vector3,
  type Camera,
  type PointLight,
  type Texture
} from 'three';
import { roomHotspots, type RoomHotspot } from '../../../data/portfolio';
import { StaticBatch } from '../env/batch';
import { seeded } from '../env/palette';
import { PROPS } from '../layout';
import { fx, useWorld, world } from '../store';
import { canvasTexture } from '../textures';
import {
  carpetTexture,
  codeTexture,
  drawMatch,
  flagTexture,
  helmetTexture,
  jerseyTexture,
  paintingTexture,
  robotTexture,
  scarfTexture,
  skylineTexture,
  waveTexture,
  windowSkyTexture
} from './roomArt';

/**
 * My room as a little cutaway diorama, laid out like the real one, standing out in the park on a
 * plinth. The walls between the camera and the room hide as you walk past; walk up and press Enter
 * to circle round it while dusk falls and the lamps come up.
 *
 *   A (desk wall, west):  hallway + door · Kallax and desk · floor lamp · record player (corner)
 *   B (bed wall, north):  lounge chair under the scarves · nightstand · bed under the jerseys
 *   C (east):             Star Wars prints and medals · window (centred) · flag
 *   D (south):            TV in the corner, facing the bed · guitar · mirror under the skyline
 */

const X0 = -1.9;
const X1 = 1.9;
const Z0 = -1.8;
const Z1 = 1.8;
const H = 2.5;
const T = 0.12;
/** The short hallway to the door, off the south-west corner. */
const HALL = { x0: X0, x1: -1.0, z1: 2.7 };
const WINDOW = { z0: -0.55, z1: 0.55, y0: 0.85, y1: 2.0 };

/** The plinth lifts the room this far off the grass. */
const LIFT = 0.3;
const { x: RX, z: RZ, yaw: RYAW } = PROPS.room;
const COS = Math.cos(RYAW);
const SIN = Math.sin(RYAW);

/** Room space to world space (the room is turned by RYAW about its centre). */
function toWorld(x: number, y: number, z: number, out: Vector3) {
  return out.set(RX + x * COS + z * SIN, y + LIFT, RZ - x * SIN + z * COS);
}

/** What the camera circles around, in room space. */
const TARGET = { x: 0, y: 0.9, z: 0.3 };

const START = { yaw: Math.PI / 4, pitch: 0.62, dist: 11.5 };

/** Where the camera should be (and look) to circle the room from the current orbit angles. */
export function roomOrbit(position: Vector3, look: Vector3, distScale = 1) {
  const cp = Math.cos(roomView.pitch);
  const d = roomView.dist * distScale;
  toWorld(TARGET.x, TARGET.y, TARGET.z, look);
  toWorld(TARGET.x + Math.sin(roomView.yaw) * cp * d, TARGET.y + Math.sin(roomView.pitch) * d, TARGET.z + Math.cos(roomView.yaw) * cp * d, position);
}

/** Orbit around the room: drag, the arrow keys or the wheel. */
export const roomView = {
  yaw: START.yaw,
  pitch: START.pitch,
  dist: START.dist,
  targetYaw: START.yaw,
  targetPitch: START.pitch,
  targetDist: START.dist
};

export function turnRoom(dYaw: number, dPitch: number) {
  roomView.targetYaw += dYaw;
  roomView.targetPitch = MathUtils.clamp(roomView.targetPitch + dPitch, 0.42, 1.2);
}

export function zoomRoom(factor: number) {
  roomView.targetDist = MathUtils.clamp(roomView.targetDist * factor, 7, 17);
}

/** Back to the corner view of the desk and the bed (on walking in). */
export function resetRoomView() {
  roomView.yaw = roomView.targetYaw = START.yaw;
  roomView.pitch = roomView.targetPitch = START.pitch;
  roomView.dist = roomView.targetDist = START.dist;
}

type WallId = 'A' | 'B' | 'C' | 'D';
const WALL_IDS: WallId[] = ['A', 'B', 'C', 'D'];

/** A point on each wall's inside face and the direction into the room. */
const WALLS: Record<WallId, { point: [number, number]; normal: [number, number] }> = {
  A: { point: [X0, 0], normal: [1, 0] },
  B: { point: [0, Z0], normal: [0, 1] },
  C: { point: [X1, 0], normal: [-1, 0] },
  D: { point: [0, Z1], normal: [0, -1] }
};

/** True for the walls standing between the camera and the room. */
const cut: Record<WallId, boolean> = { A: false, B: false, C: false, D: false };

function updateCutaway(camera: Camera) {
  // The camera in room space.
  const dx = camera.position.x - RX;
  const dz = camera.position.z - RZ;
  const cx = dx * COS - dz * SIN;
  const cz = dx * SIN + dz * COS;
  for (const id of WALL_IDS) {
    const { point, normal } = WALLS[id];
    cut[id] = (cx - point[0]) * normal[0] + (cz - point[1]) * normal[1] < 0;
  }
}

/** Where each label sits and which wall it hangs on (null for things standing on the floor). */
const SPOTS: Record<RoomHotspot['id'], { at: [number, number, number]; wall: WallId | null }> = {
  jerseys: { at: [1.08, 2.08, Z0 + 0.05], wall: 'B' },
  desk: { at: [-1.6, 1.45, 0.65], wall: null },
  records: { at: [-1.65, 1.2, -1.45], wall: null },
  scarves: { at: [-0.95, 2.22, Z0 + 0.05], wall: 'B' },
  guitar: { at: [0.2, 1.32, Z1 - 0.2], wall: null },
  starwars: { at: [X1 - 0.05, 2.05, 0.88], wall: 'C' },
  flag: { at: [X1 - 0.05, 2.1, 1.42], wall: 'C' },
  tv: { at: [1.2, 1.4, Z1 - 0.25], wall: null },
  skyline: { at: [0, 2.22, Z1 - 0.05], wall: 'D' }
};

const SHADOW = { castShadow: true, receiveShadow: true };
const BLACK = '#232328';

/** Materials for one wall. Cut-away walls stop drawing but keep casting shadows (so the window still frames the sun). */
function wallMaterials() {
  return {
    body: new MeshStandardMaterial({ color: '#eadfcd', roughness: 0.95 }),
    cap: new MeshStandardMaterial({ color: '#2f2a3a', roughness: 0.9 }),
    trim: new MeshStandardMaterial({ color: '#f7f3ea', roughness: 0.7 })
  };
}
type WallMaterials = ReturnType<typeof wallMaterials>;

interface Segment {
  wall: WallId;
  /** Centre and size of the box. */
  p: [number, number, number];
  s: [number, number, number];
}

const SEGMENTS: Segment[] = (() => {
  const zSpan = (a: number, b: number) => ({ c: (a + b) / 2, l: b - a });
  const xSpan = zSpan;
  const a = zSpan(Z0 - T, HALL.z1 + T);
  const b = xSpan(X0 - T, X1 + T);
  const cNorth = zSpan(Z0 - T, WINDOW.z0);
  const cSouth = zSpan(WINDOW.z1, Z1 + T);
  const cMid = zSpan(WINDOW.z0, WINDOW.z1);
  const d = xSpan(HALL.x1, X1 + T);
  const hallEast = zSpan(Z1, HALL.z1 + T);
  const doorWall = xSpan(X0 - T, HALL.x1 + T);
  return [
    { wall: 'A', p: [X0 - T / 2, H / 2, a.c], s: [T, H, a.l] },
    { wall: 'B', p: [b.c, H / 2, Z0 - T / 2], s: [b.l, H, T] },
    { wall: 'C', p: [X1 + T / 2, H / 2, cNorth.c], s: [T, H, cNorth.l] },
    { wall: 'C', p: [X1 + T / 2, H / 2, cSouth.c], s: [T, H, cSouth.l] },
    { wall: 'C', p: [X1 + T / 2, WINDOW.y0 / 2, cMid.c], s: [T, WINDOW.y0, cMid.l] },
    { wall: 'C', p: [X1 + T / 2, (WINDOW.y1 + H) / 2, cMid.c], s: [T, H - WINDOW.y1, cMid.l] },
    { wall: 'D', p: [d.c, H / 2, Z1 + T / 2], s: [d.l, H, T] },
    { wall: 'D', p: [HALL.x1 + T / 2, H / 2, hallEast.c], s: [T, H, hallEast.l] },
    { wall: 'D', p: [doorWall.c, H / 2, HALL.z1 + T / 2], s: [doorWall.l, H, T] }
  ];
})();

/** Never drawn; it only casts shadow, so sunlight comes in through the window rather than over the walls. */
const SHADOW_ONLY = new MeshStandardMaterial({ colorWrite: false, depthWrite: false });

function Walls({ mats }: { mats: Record<WallId, WallMaterials> }) {
  return (
    <>
      <mesh material={SHADOW_ONLY} position={[(X0 + X1) / 2, H + 0.05, (Z0 + HALL.z1) / 2]} castShadow>
        <boxGeometry args={[X1 - X0 + T * 2, 0.1, HALL.z1 - Z0 + T * 2]} />
      </mesh>
      {SEGMENTS.map((seg, i) => (
        <group key={i}>
          <mesh material={mats[seg.wall].body} position={seg.p} {...SHADOW}>
            <boxGeometry args={seg.s} />
          </mesh>
          {seg.p[1] + seg.s[1] / 2 >= H - 0.001 && (
            <mesh material={mats[seg.wall].cap} position={[seg.p[0], H + 0.012, seg.p[2]]}>
              <boxGeometry args={[seg.s[0] + 0.004, 0.024, seg.s[2] + 0.004]} />
            </mesh>
          )}
        </group>
      ))}
      {/* Skirting boards */}
      <mesh material={mats.A.trim} position={[X0 + 0.01, 0.05, (Z0 + HALL.z1) / 2]}>
        <boxGeometry args={[0.02, 0.1, HALL.z1 - Z0]} />
      </mesh>
      <mesh material={mats.B.trim} position={[0, 0.05, Z0 + 0.01]}>
        <boxGeometry args={[X1 - X0, 0.1, 0.02]} />
      </mesh>
      <mesh material={mats.C.trim} position={[X1 - 0.01, 0.05, 0]}>
        <boxGeometry args={[0.02, 0.1, Z1 - Z0]} />
      </mesh>
      <mesh material={mats.D.trim} position={[(HALL.x1 + X1) / 2, 0.05, Z1 - 0.01]}>
        <boxGeometry args={[X1 - HALL.x1, 0.1, 0.02]} />
      </mesh>
      {/* Window frame, sill and tilted blinds; they cast the striped sunlight */}
      <group position={[X1, 0, (WINDOW.z0 + WINDOW.z1) / 2]}>
        {[
          [0, WINDOW.y1 + 0.03, 0, 0.06, 0.06, WINDOW.z1 - WINDOW.z0 + 0.12],
          [0, WINDOW.y0 - 0.03, 0, 0.06, 0.06, WINDOW.z1 - WINDOW.z0 + 0.12],
          [0, (WINDOW.y0 + WINDOW.y1) / 2, WINDOW.z0 - 0.03, 0.06, WINDOW.y1 - WINDOW.y0, 0.06],
          [0, (WINDOW.y0 + WINDOW.y1) / 2, WINDOW.z1 + 0.03, 0.06, WINDOW.y1 - WINDOW.y0, 0.06],
          [-0.07, WINDOW.y0 - 0.05, 0, 0.16, 0.04, WINDOW.z1 - WINDOW.z0 + 0.2]
        ].map(([x, y, z, sx, sy, sz], i) => (
          <mesh key={i} material={mats.C.trim} position={[x, y, z]} {...SHADOW}>
            <boxGeometry args={[sx, sy, sz]} />
          </mesh>
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} material={mats.C.trim} position={[-0.04, WINDOW.y1 - 0.06 - i * 0.079, 0]} rotation={[0, 0, 0.75]} castShadow>
            <boxGeometry args={[0.07, 0.006, WINDOW.z1 - WINDOW.z0 - 0.02]} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function Floor({ carpet }: { carpet: Texture }) {
  const hallFloor = useMemo(
    () =>
      canvasTexture(128, 128, (ctx, w, h) => {
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 ? '#b98a5e' : '#c4966a';
          ctx.fillRect(0, (i * h) / 8, w, h / 8);
        }
        ctx.fillStyle = 'rgba(80, 50, 30, 0.25)';
        for (let i = 1; i < 8; i++) ctx.fillRect(0, (i * h) / 8, w, 2);
      }),
    []
  );
  return (
    <>
      {/* The plinth the room stands on, with a lip of wooden deck */}
      <mesh position={[0, -LIFT / 2, (HALL.z1 - Z1) / 2]} {...SHADOW}>
        <boxGeometry args={[X1 - X0 + T * 2 + 0.5, LIFT, HALL.z1 - Z0 + T * 2 + 0.5]} />
        <meshStandardMaterial color="#3a3346" roughness={0.9} />
      </mesh>
      <mesh position={[0, -0.02, (HALL.z1 - Z1) / 2]} receiveShadow>
        <boxGeometry args={[X1 - X0 + T * 2 + 0.56, 0.05, HALL.z1 - Z0 + T * 2 + 0.56]} />
        <meshStandardMaterial color="#b98656" roughness={0.8} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
        <planeGeometry args={[X1 - X0, Z1 - Z0]} />
        <meshStandardMaterial map={carpet} roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(HALL.x0 + HALL.x1) / 2, 0.002, (Z1 + HALL.z1) / 2]} receiveShadow>
        <planeGeometry args={[HALL.x1 - HALL.x0, HALL.z1 - Z1]} />
        <meshStandardMaterial map={hallFloor} roughness={0.7} />
      </mesh>
    </>
  );
}

/** Kallax with the desk joined on, the monitor, the chair and everything on the desk. */
function DeskCorner({ screen }: { screen: Texture }) {
  const kx = X0 + 0.2;
  const kz = 1.5;
  const shelfY = [0.0, 0.365, 0.73, 1.095, 1.46];
  return (
    <>
      {/* Kallax 1x4: sides, shelves, and something in every cube */}
      <group position={[kx, 0, kz]}>
        {[-0.19, 0.19].map((z) => (
          <mesh key={z} position={[0, 0.745, z]} {...SHADOW}>
            <boxGeometry args={[0.39, 1.49, 0.04]} />
            <meshStandardMaterial color={BLACK} roughness={0.6} />
          </mesh>
        ))}
        {shelfY.map((y) => (
          <mesh key={y} position={[0, y + 0.0175, 0]} {...SHADOW}>
            <boxGeometry args={[0.39, 0.035, 0.42]} />
            <meshStandardMaterial color={BLACK} roughness={0.6} />
          </mesh>
        ))}
        {/* Bottom: books */}
        {['#d1303a', '#3b5fae', '#e9c46a', '#f4f1ea', '#5d8d3b'].map((c, i) => (
          <mesh key={c} position={[0.02, 0.17, -0.13 + i * 0.065]} rotation={[i === 4 ? 0.25 : 0, 0, 0]} {...SHADOW}>
            <boxGeometry args={[0.24, 0.28 - (i % 2) * 0.04, 0.05]} />
            <meshStandardMaterial color={c} roughness={0.8} />
          </mesh>
        ))}
        {/* Records */}
        {['#1d1b22', '#ff8a7a', '#1d1b22', '#7cc8e4'].map((c, i) => (
          <mesh key={i} position={[0.02, 0.535, -0.12 + i * 0.07]} rotation={[0.12, 0, 0]} {...SHADOW}>
            <boxGeometry args={[0.3, 0.3, 0.012]} />
            <meshStandardMaterial color={c} roughness={0.6} />
          </mesh>
        ))}
        {/* Fabric storage box */}
        <RoundedBox args={[0.33, 0.3, 0.34]} radius={0.03} position={[0.02, 0.9, 0]} {...SHADOW}>
          <meshStandardMaterial color="#8f8a86" roughness={1} />
        </RoundedBox>
        {/* Top cube: a little plant and a figure */}
        <mesh position={[0.02, 1.18, -0.08]} {...SHADOW}>
          <cylinderGeometry args={[0.06, 0.05, 0.1, 12]} />
          <meshStandardMaterial color="#e9dccb" roughness={0.8} />
        </mesh>
        <mesh position={[0.02, 1.28, -0.08]} {...SHADOW}>
          <icosahedronGeometry args={[0.08, 1]} />
          <meshStandardMaterial color="#5d8d3b" roughness={0.8} flatShading />
        </mesh>
        <mesh position={[0.02, 1.2, 0.1]} {...SHADOW}>
          <capsuleGeometry args={[0.035, 0.08, 4, 10]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
        </mesh>
        {/* Lego roses in a vase and the plush pup in a grad cap, on top */}
        <mesh position={[0.02, 1.62, -0.09]}>
          <cylinderGeometry args={[0.045, 0.065, 0.24, 14]} />
          <meshStandardMaterial color="#d8eef2" roughness={0.05} transparent opacity={0.55} />
        </mesh>
        {[
          [0.0, 1.86, -0.1],
          [0.06, 1.82, -0.04],
          [-0.05, 1.8, -0.06],
          [0.04, 1.9, -0.14],
          [-0.02, 1.84, -0.16],
          [0.08, 1.78, -0.12]
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} castShadow>
            <dodecahedronGeometry args={[0.038, 0]} />
            <meshStandardMaterial color="#d1303a" roughness={0.4} flatShading />
          </mesh>
        ))}
        <group position={[0.02, 1.47, 0.09]}>
          <mesh position={[0, 0.09, 0]} castShadow>
            <sphereGeometry args={[0.09, 16, 12]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
          </mesh>
          <mesh position={[0.02, 0.23, 0]} castShadow>
            <sphereGeometry args={[0.075, 16, 12]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.9} />
          </mesh>
          <mesh position={[0.06, 0.24, -0.03]}>
            <sphereGeometry args={[0.028, 10, 8]} />
            <meshStandardMaterial color="#6b4630" roughness={0.9} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.0, 0.2, s * 0.075]} scale={[0.5, 1, 0.4]}>
              <sphereGeometry args={[0.06, 10, 8]} />
              <meshStandardMaterial color="#1d1d21" roughness={0.9} />
            </mesh>
          ))}
          <mesh position={[0.02, 0.3, 0]}>
            <boxGeometry args={[0.07, 0.03, 0.07]} />
            <meshStandardMaterial color="#1d1d21" />
          </mesh>
          <mesh position={[0.02, 0.32, 0]} rotation={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[0.15, 0.012, 0.15]} />
            <meshStandardMaterial color="#1d1d21" />
          </mesh>
          <mesh position={[0.08, 0.29, 0.07]}>
            <boxGeometry args={[0.01, 0.06, 0.01]} />
            <meshStandardMaterial color="#e9c46a" />
          </mesh>
        </group>
      </group>
      {/* Desk top joined to the Kallax, with a leg panel at the far end */}
      <mesh position={[X0 + 0.3, 0.74, (kz - 0.21 + 0.05) / 2]} {...SHADOW}>
        <boxGeometry args={[0.6, 0.04, kz - 0.21 - 0.05]} />
        <meshStandardMaterial color={BLACK} roughness={0.5} />
      </mesh>
      <mesh position={[X0 + 0.3, 0.36, 0.08]} {...SHADOW}>
        <boxGeometry args={[0.56, 0.72, 0.04]} />
        <meshStandardMaterial color={BLACK} roughness={0.5} />
      </mesh>
      <group position={[X0, 0.76, 0]}>
        {/* Desk mat, keyboard and mouse */}
        <mesh position={[0.36, 0.003, 0.66]} receiveShadow>
          <boxGeometry args={[0.36, 0.004, 0.9]} />
          <meshStandardMaterial color="#17171b" roughness={0.9} />
        </mesh>
        <mesh position={[0.38, 0.014, 0.62]} {...SHADOW}>
          <boxGeometry args={[0.13, 0.018, 0.4]} />
          <meshStandardMaterial color="#2a2a30" roughness={0.5} />
        </mesh>
        <mesh position={[0.39, 0.024, 0.62]}>
          <boxGeometry args={[0.1, 0.004, 0.37]} />
          <meshBasicMaterial color="#7a6cff" toneMapped={false} transparent opacity={0.35} />
        </mesh>
        <mesh position={[0.4, 0.02, 0.98]} scale={[0.6, 0.35, 1]} {...SHADOW}>
          <sphereGeometry args={[0.05, 12, 8]} />
          <meshStandardMaterial color="#2a2a30" roughness={0.4} />
        </mesh>
        {/* Monitor on its stand, glowing */}
        <mesh position={[0.13, 0.01, 0.62]} {...SHADOW}>
          <boxGeometry args={[0.18, 0.02, 0.24]} />
          <meshStandardMaterial color="#3a3b42" roughness={0.4} />
        </mesh>
        <mesh position={[0.12, 0.13, 0.62]} {...SHADOW}>
          <boxGeometry args={[0.04, 0.24, 0.06]} />
          <meshStandardMaterial color="#3a3b42" roughness={0.4} />
        </mesh>
        <mesh position={[0.15, 0.36, 0.62]} {...SHADOW}>
          <boxGeometry args={[0.03, 0.38, 0.66]} />
          <meshStandardMaterial color="#141418" roughness={0.3} />
        </mesh>
        <mesh position={[0.166, 0.365, 0.62]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.62, 0.35]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
        {/* Speaker, plant, water bottle and a candle */}
        <mesh position={[0.1, 0.12, 0.25]} {...SHADOW}>
          <cylinderGeometry args={[0.045, 0.045, 0.24, 16]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.5} />
        </mesh>
        <mesh position={[0.12, 0.06, 1.08]} {...SHADOW}>
          <cylinderGeometry args={[0.05, 0.04, 0.1, 12]} />
          <meshStandardMaterial color="#e9dccb" roughness={0.8} />
        </mesh>
        <mesh position={[0.12, 0.17, 1.08]} castShadow>
          <icosahedronGeometry args={[0.09, 1]} />
          <meshStandardMaterial color="#4f8f45" roughness={0.8} flatShading />
        </mesh>
        <mesh position={[0.35, 0.1, 0.2]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 12]} />
          <meshStandardMaterial color="#cfe8f0" roughness={0.1} transparent opacity={0.7} />
        </mesh>
        <mesh position={[0.45, 0.05, 0.12]} castShadow>
          <cylinderGeometry args={[0.045, 0.045, 0.1, 16]} />
          <meshStandardMaterial color="#f2a69a" roughness={0.3} emissive="#ff8a5a" emissiveIntensity={0.35} />
        </mesh>
        <mesh position={[0.45, 0.115, 0.12]}>
          <coneGeometry args={[0.012, 0.035, 6]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </mesh>
      </group>
      {/* Gaming chair, pulled out a little */}
      <group position={[X0 + 0.95, 0, 0.72]} rotation={[0, -Math.PI / 2 + 0.45, 0]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15]} rotation={[0, -a, 0]} castShadow>
              <boxGeometry args={[0.3, 0.03, 0.04]} />
              <meshStandardMaterial color="#1d1d21" />
            </mesh>
          );
        })}
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
          <meshStandardMaterial color="#5a5d66" metalness={0.5} roughness={0.4} />
        </mesh>
        <RoundedBox args={[0.52, 0.09, 0.5]} radius={0.04} position={[0, 0.47, 0]} {...SHADOW}>
          <meshStandardMaterial color="#1d1d21" roughness={0.7} />
        </RoundedBox>
        <RoundedBox args={[0.5, 0.8, 0.09]} radius={0.04} position={[0, 0.9, 0.24]} rotation={[-0.12, 0, 0]} {...SHADOW}>
          <meshStandardMaterial color="#1d1d21" roughness={0.7} />
        </RoundedBox>
        {[-0.22, 0.22].map((x) => (
          <RoundedBox key={x} args={[0.07, 0.62, 0.1]} radius={0.03} position={[x, 0.95, 0.19]} rotation={[-0.12, 0, 0]} castShadow>
            <meshStandardMaterial color="#e9e6df" roughness={0.6} />
          </RoundedBox>
        ))}
        {[-0.28, 0.28].map((x) => (
          <mesh key={x} position={[x, 0.66, 0.0]} castShadow>
            <boxGeometry args={[0.05, 0.04, 0.32]} />
            <meshStandardMaterial color="#2e2e34" />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** The corner: floor lamp, the record cabinet and its turntable, the painting and a little camera. */
function RecordCorner({ platter, wave, painting }: { platter: RefObject<Group | null>; wave: Texture; painting: Texture }) {
  return (
    <>
      <group position={[X0 + 0.22, 0, -0.38]}>
        <mesh position={[0, 0.02, 0]} castShadow>
          <cylinderGeometry args={[0.14, 0.14, 0.03, 16]} />
          <meshStandardMaterial color="#1d1d21" />
        </mesh>
        <mesh position={[0, 0.9, 0]} castShadow>
          <cylinderGeometry args={[0.012, 0.012, 1.8, 6]} />
          <meshStandardMaterial color="#1d1d21" />
        </mesh>
        <mesh position={[0, 1.86, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.21, 0.14, 18, 1, true]} />
          <meshStandardMaterial color="#fffaf0" side={DoubleSide} emissive="#ffd9a0" emissiveIntensity={1.4} />
        </mesh>
      </group>
      <group position={[X0 + 0.24, 0, Z0 + 0.32]}>
        <mesh position={[0, 0.36, 0]} {...SHADOW}>
          <boxGeometry args={[0.46, 0.72, 0.6]} />
          <meshStandardMaterial color={BLACK} roughness={0.6} />
        </mesh>
        <mesh position={[0.231, 0.42, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.3, 0.15]} />
          <meshStandardMaterial map={wave} roughness={0.6} />
        </mesh>
        {/* Turntable */}
        <mesh position={[0.02, 0.77, 0.04]} {...SHADOW}>
          <boxGeometry args={[0.36, 0.09, 0.44]} />
          <meshStandardMaterial color="#a8774c" roughness={0.5} />
        </mesh>
        <group ref={platter} position={[0.02, 0.825, 0.0]} userData={{ dynamic: true }}>
          <mesh castShadow>
            <cylinderGeometry args={[0.15, 0.15, 0.012, 32]} />
            <meshStandardMaterial color="#141418" roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.008, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.004, 20]} />
            <meshStandardMaterial color="#d1303a" roughness={0.6} />
          </mesh>
          <mesh position={[0.03, 0.011, 0.01]}>
            <boxGeometry args={[0.02, 0.002, 0.008]} />
            <meshStandardMaterial color="#f4f1ea" />
          </mesh>
        </group>
        <mesh position={[0.1, 0.84, 0.2]} rotation={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.02, 0.02, 0.2]} />
          <meshStandardMaterial color="#c5ccd2" metalness={0.6} roughness={0.3} />
        </mesh>
        {/* Dust cover, propped open */}
        <mesh position={[-0.12, 0.98, 0.04]} rotation={[0, 0, 1.15]}>
          <boxGeometry args={[0.34, 0.01, 0.44]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.18} roughness={0.05} />
        </mesh>
        {/* Painting leaning on the wall behind */}
        <group position={[-0.16, 1.0, 0.12]} rotation={[0, Math.PI / 2, -0.12]}>
          <mesh castShadow>
            <boxGeometry args={[0.5, 0.4, 0.03]} />
            <meshStandardMaterial color="#1d1d21" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0.017]}>
            <planeGeometry args={[0.44, 0.34]} />
            <meshStandardMaterial map={painting} roughness={0.8} />
          </mesh>
        </group>
        {/* Books with a silver compact camera on top */}
        <mesh position={[0.08, 0.75, -0.22]} castShadow>
          <boxGeometry args={[0.16, 0.06, 0.2]} />
          <meshStandardMaterial color="#d1303a" roughness={0.8} />
        </mesh>
        <mesh position={[0.08, 0.8, -0.22]} castShadow>
          <boxGeometry args={[0.15, 0.04, 0.18]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.8} />
        </mesh>
        <mesh position={[0.08, 0.855, -0.22]} rotation={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.06, 0.07, 0.13]} />
          <meshStandardMaterial color="#d5d8de" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
    </>
  );
}

/** Along the bed wall: lounge chair, nightstand with its lamp, and the bed. */
function BedWall() {
  const white = '#f4f1ea';
  return (
    <>
      <group position={[-0.95, 0, Z0 + 0.45]}>
        <RoundedBox args={[0.86, 0.32, 0.76]} radius={0.15} smoothness={4} position={[0, 0.16, 0.04]} {...SHADOW}>
          <meshStandardMaterial color="#29292f" roughness={1} />
        </RoundedBox>
        <RoundedBox args={[0.86, 0.6, 0.3]} radius={0.15} smoothness={4} position={[0, 0.46, -0.27]} rotation={[-0.28, 0, 0]} {...SHADOW}>
          <meshStandardMaterial color="#2d2d34" roughness={1} />
        </RoundedBox>
        {[-0.14, 0.14].map((x) => (
          <mesh key={x} position={[x, 0.325, 0.04]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.012, 0.6]} />
            <meshStandardMaterial color="#1c1c21" />
          </mesh>
        ))}
      </group>
      <group position={[-0.26, 0, Z0 + 0.22]}>
        <mesh position={[0, 0.25, 0]} {...SHADOW}>
          <boxGeometry args={[0.44, 0.5, 0.4]} />
          <meshStandardMaterial color={BLACK} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.501, 0.21]}>
          <boxGeometry args={[0.3, 0.008, 0.01]} />
          <meshStandardMaterial color="#5a5d66" />
        </mesh>
        <mesh position={[0, 0.6, 0]} castShadow>
          <sphereGeometry args={[0.09, 16, 12]} />
          <meshStandardMaterial color="#2e2e34" roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.11, 0.18, 0.2, 16, 1, true]} />
          <meshStandardMaterial color="#f6ead2" side={DoubleSide} emissive="#ffcf96" emissiveIntensity={1.1} />
        </mesh>
        <mesh position={[0.12, 0.52, 0.08]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.1, 10]} />
          <meshStandardMaterial color="#cfe8f0" transparent opacity={0.7} roughness={0.1} />
        </mesh>
      </group>
      <group position={[1.08, 0, Z0]}>
        <mesh position={[0, 0.15, 1.07]} {...SHADOW}>
          <boxGeometry args={[1.64, 0.3, 2.1]} />
          <meshStandardMaterial color={BLACK} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.5, 0.04]} {...SHADOW}>
          <boxGeometry args={[1.68, 1.0, 0.08]} />
          <meshStandardMaterial color={BLACK} roughness={0.6} />
        </mesh>
        <RoundedBox args={[1.56, 0.26, 2.0]} radius={0.08} position={[0, 0.42, 1.1]} {...SHADOW}>
          <meshStandardMaterial color={white} roughness={1} />
        </RoundedBox>
        {[
          [-0.15, 0.6, 1.2, 0.4],
          [0.25, 0.58, 1.55, 0.34],
          [-0.35, 0.56, 1.7, 0.28],
          [0.4, 0.57, 0.95, 0.3]
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} scale={[1, 0.36, 1.15]} {...SHADOW}>
            <sphereGeometry args={[r, 16, 12]} />
            <meshStandardMaterial color="#f7f4ee" roughness={1} />
          </mesh>
        ))}
        <RoundedBox args={[0.6, 0.16, 0.36]} radius={0.07} position={[-0.4, 0.62, 0.3]} rotation={[0.25, 0.15, 0]} {...SHADOW}>
          <meshStandardMaterial color={white} roughness={1} />
        </RoundedBox>
        <RoundedBox args={[0.58, 0.16, 0.36]} radius={0.07} position={[0.44, 0.62, 0.28]} rotation={[0.25, -0.1, 0]} {...SHADOW}>
          <meshStandardMaterial color={white} roughness={1} />
        </RoundedBox>
        <RoundedBox args={[0.5, 0.2, 0.34]} radius={0.08} position={[0.12, 0.69, 0.42]} rotation={[0.3, -0.3, 0.1]} {...SHADOW}>
          <meshStandardMaterial color="#2a2a30" roughness={1} />
        </RoundedBox>
        {/* MacBook left on the bed */}
        <mesh position={[0.1, 0.58, 1.7]} rotation={[0, 0.35, 0]} {...SHADOW}>
          <boxGeometry args={[0.4, 0.022, 0.28]} />
          <meshStandardMaterial color="#d5d8de" metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Slides on the floor */}
        {[-0.07, 0.07].map((dx, i) => (
          <RoundedBox key={i} args={[0.1, 0.03, 0.26]} radius={0.012} position={[-0.98 + dx * 2, 0.016, 2.0]} rotation={[0, (i ? 1 : -1) * 0.2, 0]} castShadow>
            <meshStandardMaterial color="#1d1d21" roughness={0.6} />
          </RoundedBox>
        ))}
      </group>
    </>
  );
}

/** Opposite the bed: the TV and a PS5 in the corner, the guitar and the mirror; the hallway door. */
function TvWall({ tv }: { tv: Texture }) {
  return (
    <>
      <group position={[1.2, 0, Z1 - 0.21]}>
        <mesh position={[0, 0.225, 0]} {...SHADOW}>
          <boxGeometry args={[1.3, 0.45, 0.4]} />
          <meshStandardMaterial color={BLACK} roughness={0.4} />
        </mesh>
        <mesh position={[0.1, 0.47, 0.02]} castShadow>
          <boxGeometry args={[0.3, 0.04, 0.16]} />
          <meshStandardMaterial color="#2e2e34" />
        </mesh>
        <mesh position={[0.1, 0.86, 0.06]} {...SHADOW}>
          <boxGeometry args={[1.12, 0.66, 0.04]} />
          <meshStandardMaterial color="#121216" roughness={0.2} metalness={0.3} />
        </mesh>
        <mesh position={[0.1, 0.86, 0.039]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1.08, 0.62]} />
          <meshBasicMaterial map={tv} toneMapped={false} />
        </mesh>
        {/* PS5 standing beside it, and a controller */}
        <group position={[-0.52, 0.45, 0.02]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.09, 0.4, 0.26]} />
            <meshStandardMaterial color="#1d1d21" roughness={0.4} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * 0.05, 0.21, 0]} castShadow>
              <boxGeometry args={[0.012, 0.42, 0.27]} />
              <meshStandardMaterial color="#f4f4f6" roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, 0.2, -0.131]}>
            <boxGeometry args={[0.02, 0.3, 0.002]} />
            <meshBasicMaterial color="#7cc8ff" toneMapped={false} />
          </mesh>
        </group>
        <mesh position={[-0.2, 0.465, -0.08]} rotation={[0, 0.4, 0]} castShadow>
          <boxGeometry args={[0.16, 0.035, 0.1]} />
          <meshStandardMaterial color="#f4f4f6" roughness={0.4} />
        </mesh>
        {/* A little figure on the console */}
        <mesh position={[0.55, 0.5, -0.05]} castShadow>
          <coneGeometry args={[0.035, 0.1, 8]} />
          <meshStandardMaterial color="#ff8a3d" roughness={0.6} />
        </mesh>
      </group>
      {/* Guitar leaning on the wall */}
      <group position={[0.18, 0, Z1 - 0.13]} rotation={[0.2, Math.PI, 0]}>
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.12, 1]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.09, 32]} />
          <meshStandardMaterial color="#d9944a" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.15, 0.15, 0.09, 32]} />
          <meshStandardMaterial color="#d9944a" roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.3, -0.002]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.12, 1]}>
          <cylinderGeometry args={[0.205, 0.205, 0.08, 32]} />
          <meshStandardMaterial color="#5a3d27" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.44, 0.046]}>
          <circleGeometry args={[0.05, 20]} />
          <meshStandardMaterial color="#2a1a10" />
        </mesh>
        <mesh position={[0, 0.2, 0.047]}>
          <boxGeometry args={[0.12, 0.025, 0.01]} />
          <meshStandardMaterial color="#3a2618" />
        </mesh>
        <mesh position={[0, 0.92, 0]} castShadow>
          <boxGeometry args={[0.05, 0.62, 0.03]} />
          <meshStandardMaterial color="#5a3d27" />
        </mesh>
        <mesh position={[0, 1.29, 0]} castShadow>
          <boxGeometry args={[0.08, 0.14, 0.03]} />
          <meshStandardMaterial color="#3a2618" />
        </mesh>
      </group>
      {/* Hallway: a mat and a backpack (the door hangs with wall D) */}
      <group position={[(HALL.x0 + HALL.x1) / 2, 0, HALL.z1 - 0.01]}>
        <mesh position={[0, 0.006, -0.35]} receiveShadow>
          <boxGeometry args={[0.6, 0.01, 0.36]} />
          <meshStandardMaterial color="#8a6a4a" roughness={1} />
        </mesh>
      </group>
      <RoundedBox args={[0.3, 0.34, 0.18]} radius={0.06} position={[HALL.x1 - 0.2, 0.17, Z1 + 0.25]} rotation={[0, 0.3, 0]} castShadow>
        <meshStandardMaterial color="#1f2a5c" roughness={0.8} />
      </RoundedBox>
    </>
  );
}

/** A framed print on a wall, facing into the room. */
function Picture({ map, position, rotationY, size, frame = '#f4f1ea' }: { map: Texture; position: [number, number, number]; rotationY: number; size: [number, number]; frame?: string }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.015]} castShadow>
        <boxGeometry args={[size[0] + 0.03, size[1] + 0.03, 0.03]} />
        <meshStandardMaterial color={frame} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={size} />
        <meshStandardMaterial map={map} roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Things hung on each wall; a wall's decor hides with it. */
function WallDecor({ groups }: { groups: MutableRefObject<Partial<Record<WallId, Group | null>>> }) {
  const art = useMemo(
    () => ({
      ribery: jerseyTexture('RIBÉRY', '#d51f2c', '#ffffff', false),
      ronaldo: jerseyTexture('RONALDO', '#e4252f', '#ffffff', true),
      dimaria: jerseyTexture('DI MARÍA', '#d71e2a', '#1d1d21', false),
      mini: jerseyTexture('', '#d51f2c', '#ffffff', false),
      united: scarfTexture('MAN UTD', null, '#d1303a', '#d1303a', '#ffffff'),
      semi: scarfTexture('FRANCE vs ESPAÑA', 'SEMI FINAL · DALLAS 2026', '#1f2a5c', '#c8202c', '#ffffff'),
      flag: flagTexture(),
      helmet: helmetTexture(),
      robot: robotTexture(),
      skyline: skylineTexture(),
      sky: windowSkyTexture()
    }),
    []
  );
  const panels = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const t = art.skyline.clone();
        t.repeat.set(1 / 3, 1);
        t.offset.set(i / 3, 0);
        t.needsUpdate = true;
        return t;
      }),
    [art]
  );
  const set = (id: WallId) => (g: Group | null) => void (groups.current[id] = g);
  return (
    <>
      <group ref={set('A')}>
        {/* Side of the Kallax that faces the hallway: a print and a mini shirt */}
        <Picture map={art.robot} position={[X0 + 0.2, 1.18, 1.72]} rotationY={0} size={[0.2, 0.16]} frame="#1f2a5c" />
        <mesh position={[X0 + 0.2, 0.86, 1.725]}>
          <planeGeometry args={[0.22, 0.22]} />
          <meshStandardMaterial map={art.mini} transparent alphaTest={0.5} roughness={0.8} />
        </mesh>
      </group>
      <group ref={set('B')}>
        {(
          [
            [art.ribery, 0.55],
            [art.ronaldo, 1.08],
            [art.dimaria, 1.61]
          ] as const
        ).map(([map, x], i) => (
          <mesh key={i} position={[x, 1.62, Z0 + 0.02]} rotation={[0, 0, (i - 1) * 0.02]} castShadow>
            <planeGeometry args={[0.56, 0.56]} />
            <meshStandardMaterial map={map} transparent alphaTest={0.5} roughness={0.8} side={DoubleSide} />
          </mesh>
        ))}
        <mesh position={[-0.95, 1.98, Z0 + 0.015]} rotation={[0, 0, 0.03]} castShadow>
          <planeGeometry args={[1.25, 0.22]} />
          <meshStandardMaterial map={art.united} side={DoubleSide} roughness={0.9} />
        </mesh>
        <mesh position={[-0.9, 1.72, Z0 + 0.022]} rotation={[0, 0, -0.04]} castShadow>
          <planeGeometry args={[1.22, 0.21]} />
          <meshStandardMaterial map={art.semi} side={DoubleSide} roughness={0.9} />
        </mesh>
      </group>
      <group ref={set('C')}>
        {/* Golden hour through the window */}
        <mesh position={[X1 + T + 0.04, (WINDOW.y0 + WINDOW.y1) / 2, (WINDOW.z0 + WINDOW.z1) / 2]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[WINDOW.z1 - WINDOW.z0 + 0.16, WINDOW.y1 - WINDOW.y0 + 0.16]} />
          <meshBasicMaterial map={art.sky} toneMapped={false} />
        </mesh>
        <Picture map={art.helmet} position={[X1 - 0.01, 1.75, 0.88]} rotationY={-Math.PI / 2} size={[0.34, 0.38]} />
        <Picture map={art.robot} position={[X1 - 0.01, 1.32, 0.88]} rotationY={-Math.PI / 2} size={[0.28, 0.26]} />
        {['#3b5fae', '#e9c46a', '#2a3a6a', '#d1303a'].map((c, i) => (
          <group key={c} position={[X1 - 0.012, 0.92, 0.75 + i * 0.09]} rotation={[0, -Math.PI / 2, (i - 1.5) * 0.06]}>
            <mesh position={[0, 0.15, 0]}>
              <boxGeometry args={[0.03, 0.32, 0.004]} />
              <meshStandardMaterial color={c} roughness={0.8} />
            </mesh>
            <mesh position={[0, -0.03, 0.01]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.035, 0.035, 0.01, 16]} />
              <meshStandardMaterial color={i === 1 ? '#c5ccd2' : '#d9a441'} metalness={0.8} roughness={0.25} />
            </mesh>
          </group>
        ))}
        <mesh position={[X1 - 0.012, 1.6, 1.42]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.5, 0.72]} />
          <meshStandardMaterial map={art.flag} roughness={0.9} />
        </mesh>
      </group>
      <group ref={set('D')}>
        {/* Tall mirror leaning on the wall */}
        <group position={[-0.4, 0, Z1 - 0.1]} rotation={[0.1, Math.PI, 0]}>
          <mesh position={[0, 0.68, 0]} castShadow>
            <boxGeometry args={[0.44, 1.34, 0.03]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.68, 0.016]}>
            <planeGeometry args={[0.36, 1.26]} />
            <meshStandardMaterial color="#c9d6e0" metalness={1} roughness={0.05} />
          </mesh>
        </group>
        {/* The door at the end of the hallway */}
        <group position={[(HALL.x0 + HALL.x1) / 2, 0, HALL.z1 - 0.01]}>
          <mesh position={[0, 1.02, 0]} castShadow>
            <boxGeometry args={[0.8, 2.04, 0.04]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
          </mesh>
          <mesh position={[0.3, 1.0, -0.04]}>
            <sphereGeometry args={[0.03, 10, 8]} />
            <meshStandardMaterial color="#c5ccd2" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
        {panels.map((map, i) => (
          <Picture key={i} map={map} position={[-0.55 + i * 0.55, 1.85, Z1 - 0.01]} rotationY={Math.PI} size={[0.5, 0.4]} frame="#3a3a3e" />
        ))}
      </group>
    </>
  );
}

/** Dust drifting through the sunbeam. */
function Motes() {
  const COUNT = 90;
  const { geometry, seeds } = useMemo(() => {
    const rand = seeded(9);
    const seeds = Array.from({ length: COUNT }, () => [rand(), rand(), rand(), rand()]);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(COUNT * 3), 3));
    return { geometry: g, seeds };
  }, []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const attr = geometry.getAttribute('position') as BufferAttribute;
    seeds.forEach(([a, b, c, d], i) => {
      const k = (a + t * 0.02 * (0.5 + d)) % 1;
      attr.setXYZ(i, MathUtils.lerp(X1 - 0.1, -0.4, k) + Math.sin(t * 0.3 + i) * 0.05, 0.4 + b * 1.6 + Math.sin(t * 0.5 + c * 6) * 0.08, MathUtils.lerp(WINDOW.z0, WINDOW.z1, c) + Math.cos(t * 0.4 + i) * 0.05);
    });
    attr.needsUpdate = true;
  });
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial color="#ffd9a8" size={0.022} transparent opacity={0.75} depthWrite={false} blending={AdditiveBlending} />
    </points>
  );
}

/** Lamps and the TV. They glow softly by day and come up as dusk falls while you're at the room. */
function RoomLights() {
  const low = world.get().quality === 'low';
  const lamp = useRef<PointLight>(null);
  const bedside = useRef<PointLight>(null);
  const tv = useRef<PointLight>(null);
  const at = useMemo(() => ({ lamp: toWorld(X0 + 0.25, 1.75, -0.38, new Vector3()), bedside: toWorld(-0.26, 0.85, Z0 + 0.25, new Vector3()), tv: toWorld(1.3, 0.95, Z1 - 0.55, new Vector3()) }), []);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const k = 0.35 + fx.evening * 0.65;
    if (lamp.current) lamp.current.intensity = 5 * k;
    if (bedside.current) bedside.current.intensity = 2 * k;
    if (tv.current) tv.current.intensity = (2.4 + Math.sin(t * 3.1) * 0.35 + Math.sin(t * 7.3) * 0.2) * k;
  });
  // Lights are world-wide in three.js, so they live outside the room's turned group and keep a fixed count.
  return (
    <>
      <pointLight ref={lamp} position={at.lamp} color="#ffbf7a" intensity={2} distance={6} decay={2} />
      {!low && <pointLight ref={bedside} position={at.bedside} color="#ffcf96" intensity={1} distance={3.5} decay={2} />}
      {!low && <pointLight ref={tv} position={at.tv} color="#9d8cff" intensity={1} distance={4} decay={2} />}
    </>
  );
}

function Hotspots({ labels }: { labels: MutableRefObject<Partial<Record<string, HTMLDivElement | null>>> }) {
  const open = useWorld((s) => s.station === 'room');
  if (!open) return null;
  return (
    <>
      {roomHotspots.map((h) => (
        <Html key={h.id} position={SPOTS[h.id].at} center zIndexRange={[30, 10]}>
          <div ref={(el) => void (labels.current[h.id] = el)}>
            <details className="world-hotspot">
              <summary>
                <span className="world-hotspot-dot" aria-hidden="true" />
                {h.title}
              </summary>
              <p>{h.note}</p>
              {h.href && (
                <a href={h.href} target="_blank" rel="noopener noreferrer">
                  Open
                </a>
              )}
            </details>
          </div>
        </Html>
      ))}
    </>
  );
}

function RoomContents() {
  const mats = useMemo(() => Object.fromEntries(WALL_IDS.map((id) => [id, wallMaterials()])) as Record<WallId, WallMaterials>, []);
  const decor = useRef<Partial<Record<WallId, Group | null>>>({});
  const labels = useRef<Partial<Record<string, HTMLDivElement | null>>>({});
  const platter = useRef<Group>(null);
  const textures = useMemo(
    () => ({
      carpet: carpetTexture(),
      code: codeTexture(),
      tv: canvasTexture(512, 300, (ctx, w, h) => drawMatch(ctx, w, h, 0)),
      wave: waveTexture(),
      painting: paintingTexture()
    }),
    []
  );
  const lastTv = useRef(0);
  const scratch = useMemo(() => new Vector3(), []);

  useFrame((state, delta) => {
    // Only bother when the camera is close enough to see in.
    const near = state.camera.position.distanceToSquared(toWorld(0, 0, 0, scratch)) < 50 * 50;
    if (!near) return;
    updateCutaway(state.camera);
    for (const id of WALL_IDS) {
      const show = !cut[id];
      for (const m of Object.values(mats[id])) {
        m.colorWrite = show;
        m.depthWrite = show;
      }
      const g = decor.current[id];
      if (g) g.visible = show;
    }
    for (const h of roomHotspots) {
      const el = labels.current[h.id];
      const wall = SPOTS[h.id].wall;
      if (el) el.style.display = wall && cut[wall] ? 'none' : '';
    }
    if (platter.current) platter.current.rotation.y -= delta * 3.5;
    const t = state.clock.elapsedTime;
    if (t - lastTv.current > 1 / 12) {
      lastTv.current = t;
      textures.tv.redraw((ctx, w, h) => drawMatch(ctx, w, h, t));
    }
  });

  return (
    <>
      <Floor carpet={textures.carpet} />
      <Walls mats={mats} />
      <StaticBatch>
        <DeskCorner screen={textures.code} />
        <RecordCorner platter={platter} wave={textures.wave} painting={textures.painting} />
        <BedWall />
        <TvWall tv={textures.tv} />
      </StaticBatch>
      <WallDecor groups={decor} />
      <ContactShadows position={[0, 0.006, 0]} scale={[X1 - X0, Z1 - Z0]} resolution={512} far={1.4} blur={2.4} opacity={0.55} color="#24182a" frames={1} />
      <Motes />
      <Hotspots labels={labels} />
    </>
  );
}

/** My room, standing in the park. */
export function Room(): ReactNode {
  const gl = useThree((s) => s.gl);

  // Drag to circle round and scroll to zoom while you're at the room.
  useEffect(() => {
    const canvas = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const inside = () => world.get().station === 'room';
    const down = (e: PointerEvent) => {
      if (inside()) last = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      turnRoom(-(e.clientX - last.x) * 0.006, (e.clientY - last.y) * 0.004);
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      last = null;
    };
    const wheel = (e: WheelEvent) => {
      if (!inside()) return;
      e.preventDefault();
      zoomRoom(Math.exp(e.deltaY * 0.001));
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      canvas.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  useFrame((_, delta) => {
    roomView.yaw = MathUtils.damp(roomView.yaw, roomView.targetYaw, 7, delta);
    roomView.pitch = MathUtils.damp(roomView.pitch, roomView.targetPitch, 7, delta);
    roomView.dist = MathUtils.damp(roomView.dist, roomView.targetDist, 7, delta);
  });

  return (
    <>
      <group position={[RX, LIFT, RZ]} rotation={[0, RYAW, 0]}>
        <RoomContents />
        {/* You walk round the room, not into it */}
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[(X1 - X0) / 2 + T + 0.25, 1.4, (HALL.z1 - Z0) / 2 + T + 0.25]} position={[0, 1.1, (HALL.z1 + Z0) / 2]} />
        </RigidBody>
      </group>
      <RoomLights />
    </>
  );
}
