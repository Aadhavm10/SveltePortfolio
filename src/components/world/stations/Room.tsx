import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import { DoubleSide, Group, MathUtils, RepeatWrapping, Texture, Vector3 } from 'three';
import { roomHotspots, type RoomHotspot } from '../../../data/portfolio';
import { StaticBatch } from '../env/batch';
import { seeded } from '../env/palette';
import { useWorld, world } from '../store';
import { canvasTexture, DISPLAY_FONT } from '../textures';

/**
 * My room as a little diorama, built from photos of the real one. It sits far below the park;
 * walking into the cottage puts the camera in the middle of it.
 */
export const ROOM_ORIGIN = new Vector3(0, -90, 0);
/** Where you stand inside, relative to the room. */
export const ROOM_EYE = new Vector3(0.3, 1.55, 0.6);

const W = 5.6;
const D = 4.6;
const H = 2.7;
const X0 = -W / 2;
const X1 = W / 2;
const Z0 = -D / 2;
const Z1 = D / 2;

const START_YAW = -Math.PI / 2;

/** Where you're looking inside the room; drag or use the arrow keys. */
export const roomView = { yaw: START_YAW, pitch: -0.05, targetYaw: START_YAW, targetPitch: -0.05 };

export function turnRoom(dYaw: number, dPitch: number) {
  roomView.targetYaw += dYaw;
  roomView.targetPitch = MathUtils.clamp(roomView.targetPitch + dPitch, -0.9, 0.7);
}

/** Face the bed and the jersey wall again (on walking in). */
export function resetRoomView() {
  roomView.yaw = roomView.targetYaw = START_YAW;
  roomView.pitch = roomView.targetPitch = -0.05;
}

/** Where each hotspot label sits, in room space. */
const SPOTS: Record<RoomHotspot['id'], [number, number, number]> = {
  jerseys: [0.4, 2.2, Z0 + 0.1],
  desk: [X0 + 0.45, 1.35, 0.25],
  records: [X0 + 0.4, 1.25, Z1 - 0.35],
  scarves: [-1.7, 2.5, Z1 - 0.1],
  guitar: [-0.35, 1.05, Z1 - 0.25],
  starwars: [X1 - 0.1, 2.25, -0.35],
  flag: [X1 - 0.1, 2.35, 0.45],
  tv: [X1 - 0.35, 1.5, 1.35],
  skyline: [0.33, 2.4, Z1 - 0.1]
};

// --- Canvas art ---

function jerseyTexture(name: string, main: string, trim: string, longSleeves: boolean) {
  return canvasTexture(256, 256, (ctx, w) => {
    ctx.clearRect(0, 0, w, w);
    // Hanger
    ctx.strokeStyle = '#3b3a40';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(128, 18, 9, Math.PI, Math.PI * 2.4);
    ctx.moveTo(128, 27);
    ctx.lineTo(128, 34);
    ctx.moveTo(62, 58);
    ctx.lineTo(128, 34);
    ctx.lineTo(194, 58);
    ctx.stroke();
    // Shirt
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.moveTo(100, 40);
    ctx.quadraticCurveTo(128, 52, 156, 40);
    ctx.lineTo(206, 58);
    if (longSleeves) {
      ctx.lineTo(240, 196);
      ctx.lineTo(214, 202);
      ctx.lineTo(192, 112);
    } else {
      ctx.lineTo(238, 104);
      ctx.lineTo(196, 122);
    }
    ctx.lineTo(194, 240);
    ctx.lineTo(62, 240);
    ctx.lineTo(60, longSleeves ? 112 : 122);
    if (longSleeves) {
      ctx.lineTo(42, 202);
      ctx.lineTo(16, 196);
    } else {
      ctx.lineTo(18, 104);
    }
    ctx.lineTo(50, 58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = trim;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(100, 41);
    ctx.quadraticCurveTo(128, 53, 156, 41);
    ctx.stroke();
    // Name and number, as seen from the back
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = `600 22px ${DISPLAY_FONT}`;
    ctx.fillText(name, 128, 90, 120);
    ctx.font = `700 104px ${DISPLAY_FONT}`;
    ctx.fillText('7', 128, 196);
  });
}

function scarfTexture(text: string, sub: string | null, left: string, right: string, ink: string) {
  return canvasTexture(640, 112, (ctx, w, h) => {
    ctx.fillStyle = left;
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = right;
    ctx.fillRect(w / 2, 0, w / 2, h);
    // Knitted bands at the ends, and a fringe
    for (const x of [24, w - 60]) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(x, 0, 10, h);
      ctx.fillRect(x + 20, 0, 10, h);
    }
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${sub ? 46 : 64}px ${DISPLAY_FONT}`;
    ctx.fillText(text, w / 2, sub ? h / 2 - 12 : h / 2 + 3, w - 160);
    if (sub) {
      ctx.font = `600 22px ${DISPLAY_FONT}`;
      ctx.fillText(sub, w / 2, h / 2 + 30);
    }
  });
}

function flagTexture() {
  return canvasTexture(256, 360, (ctx, w, h) => {
    ctx.fillStyle = '#1f2a44';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = '600 30px Georgia, serif';
    ctx.fillText('Welcome to my', w / 2, 58);
    ctx.fillText('crib', w / 2, 94);
    // A curious white goose peering out
    ctx.fillStyle = '#f4efe6';
    ctx.beginPath();
    ctx.ellipse(w / 2, h - 30, 70, 70, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w / 2, 225, 34, 80, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(w / 2, 168, 40, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8a08a';
    ctx.beginPath();
    ctx.ellipse(w / 2, 196, 20, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1b22';
    ctx.beginPath();
    ctx.arc(w / 2 - 16, 160, 5, 0, Math.PI * 2);
    ctx.arc(w / 2 + 16, 160, 5, 0, Math.PI * 2);
    ctx.fill();
    // Grommets
    ctx.fillStyle = '#c5ccd2';
    for (const [x, y] of [
      [12, 12],
      [w - 12, 12],
      [12, h - 12],
      [w - 12, h - 12]
    ]) {
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** A black helmet on white, and a gold robot head on white. */
function helmetTexture() {
  return canvasTexture(240, 260, (ctx, w, h) => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#18181c';
    ctx.beginPath();
    ctx.moveTo(40, 190);
    ctx.quadraticCurveTo(30, 60, 120, 44);
    ctx.quadraticCurveTo(210, 60, 200, 190);
    ctx.lineTo(178, 222);
    ctx.lineTo(62, 222);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#4a4c55';
    ctx.beginPath();
    ctx.moveTo(78, 118);
    ctx.lineTo(116, 126);
    ctx.lineTo(116, 140);
    ctx.lineTo(72, 136);
    ctx.closePath();
    ctx.moveTo(162, 118);
    ctx.lineTo(124, 126);
    ctx.lineTo(124, 140);
    ctx.lineTo(168, 136);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(108, 150);
    ctx.lineTo(132, 150);
    ctx.lineTo(146, 210);
    ctx.lineTo(94, 210);
    ctx.closePath();
    ctx.fill();
  });
}

function robotTexture() {
  return canvasTexture(240, 220, (ctx, w, h) => {
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(100, 80, 10, 120, 110, 90);
    g.addColorStop(0, '#ffe08a');
    g.addColorStop(1, '#c99a3c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(120, 110, 66, 74, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.arc(96, 100, 13, 0, Math.PI * 2);
    ctx.arc(144, 100, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd04a';
    ctx.beginPath();
    ctx.arc(96, 100, 6, 0, Math.PI * 2);
    ctx.arc(144, 100, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(108, 140, 24, 16);
  });
}

/** Black and white skyline across three canvases. */
function skylineTexture() {
  const rand = seeded(1929);
  return canvasTexture(900, 240, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#d6d6d4');
    sky.addColorStop(0.55, '#bdbdbb');
    sky.addColorStop(1, '#8e8e8c');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const horizon = h * 0.6;
    for (let x = 0; x < w * 0.82; ) {
      const bw = 8 + rand() * 22;
      const tall = x > w * 0.3 && x < w * 0.45 ? 1.8 : 1;
      const bh = (14 + rand() * 50) * tall;
      const v = Math.round(68 + rand() * 46);
      ctx.fillStyle = `rgb(${v}, ${v}, ${v + 2})`;
      ctx.fillRect(x, horizon - bh, bw, bh);
      if (rand() > 0.85) ctx.fillRect(x + bw / 2 - 1, horizon - bh - 18, 2, 18);
      x += bw - 2;
    }
    // Water with a soft reflection
    ctx.fillStyle = '#a7a7a5';
    ctx.fillRect(0, horizon, w, h - horizon);
    ctx.globalAlpha = 0.25;
    ctx.save();
    ctx.translate(0, horizon * 2);
    ctx.scale(1, -1);
    ctx.drawImage(ctx.canvas, 0, 0, w, horizon, 0, 0, w, horizon);
    ctx.restore();
    ctx.globalAlpha = 1;
  });
}

function paintingTexture() {
  return canvasTexture(240, 200, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#f6c88f');
    sky.addColorStop(1, '#8fc46a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const rand = seeded(77);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = ['#2f6b3a', '#4f8f45', '#79b35a', '#c98a4a'][i % 4];
      ctx.beginPath();
      ctx.ellipse(rand() * w, h * 0.35 + rand() * h * 0.7, 18 + rand() * 30, 10 + rand() * 20, rand() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(w * 0.48, h * 0.3, 6, 40);
  });
}

function waveTexture() {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#1c1c20';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f4f1ea';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 30; x < w - 30; x += 3) {
      const t = (x - 30) / (w - 60);
      const amp = Math.sin(t * Math.PI) * 40 * (0.5 + 0.5 * Math.sin(x * 0.31) * Math.cos(x * 0.13));
      ctx.moveTo(x, h / 2 - amp);
      ctx.lineTo(x, h / 2 + amp);
    }
    ctx.stroke();
  });
}

function carpetTexture() {
  const t = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#cdb99c';
    ctx.fillRect(0, 0, w, h);
    const rand = seeded(5);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255, 245, 225, 0.2)' : 'rgba(120, 95, 70, 0.14)';
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
  });
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
}

/** A canvas print on the wall, facing into the room. */
function Picture({ map, position, rotationY, size, frame = '#f4f1ea' }: { map: Texture; position: [number, number, number]; rotationY: number; size: [number, number]; frame?: string }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0, 0.015]}>
        <boxGeometry args={[size[0] + 0.03, size[1] + 0.03, 0.03]} />
        <meshLambertMaterial color={frame} />
      </mesh>
      <mesh position={[0, 0, 0.032]}>
        <planeGeometry args={size} />
        <meshLambertMaterial map={map} />
      </mesh>
    </group>
  );
}

function Furniture() {
  const black = '#26262b';
  const white = '#f4f1ea';
  return (
    <>
      {/* Bed against the jersey wall */}
      <group position={[0.4, 0, Z0]}>
        <mesh position={[0, 0.16, 1.12]}>
          <boxGeometry args={[1.72, 0.32, 2.15]} />
          <meshLambertMaterial color={black} />
        </mesh>
        <mesh position={[0, 0.52, 0.05]}>
          <boxGeometry args={[1.78, 1.0, 0.08]} />
          <meshLambertMaterial color={black} />
        </mesh>
        <RoundedBox args={[1.62, 0.26, 2.04]} radius={0.08} position={[0, 0.44, 1.14]}>
          <meshLambertMaterial color={white} />
        </RoundedBox>
        {/* Rumpled duvet */}
        {[
          [-0.1, 0.62, 1.15, 0.42],
          [0.25, 0.6, 1.5, 0.36],
          [-0.35, 0.58, 1.65, 0.3]
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x, y, z]} scale={[1, 0.38, 1.15]}>
            <sphereGeometry args={[r, 14, 10]} />
            <meshLambertMaterial color="#f7f4ee" />
          </mesh>
        ))}
        <RoundedBox args={[0.62, 0.16, 0.36]} radius={0.07} position={[-0.42, 0.64, 0.32]} rotation={[0.25, 0.15, 0]}>
          <meshLambertMaterial color={white} />
        </RoundedBox>
        <RoundedBox args={[0.6, 0.16, 0.36]} radius={0.07} position={[0.45, 0.64, 0.3]} rotation={[0.25, -0.1, 0]}>
          <meshLambertMaterial color={white} />
        </RoundedBox>
        <RoundedBox args={[0.52, 0.2, 0.34]} radius={0.08} position={[0.1, 0.7, 0.42]} rotation={[0.3, -0.3, 0.1]}>
          <meshLambertMaterial color="#2e2e34" />
        </RoundedBox>
        {/* MacBook left on the bed */}
        <mesh position={[0.15, 0.59, 1.75]} rotation={[0, 0.35, 0]}>
          <boxGeometry args={[0.42, 0.025, 0.3]} />
          <meshStandardMaterial color="#d5d8de" metalness={0.5} roughness={0.3} />
        </mesh>
        {/* Slides on the floor */}
        {[-0.08, 0.08].map((dx, i) => (
          <RoundedBox key={i} args={[0.11, 0.035, 0.28]} radius={0.015} position={[-1.05 + dx * 2, 0.02, 1.9]} rotation={[0, 0.2 * (i ? 1 : -1), 0]}>
            <meshLambertMaterial color="#1d1d21" />
          </RoundedBox>
        ))}
      </group>
      {/* Nightstand and its lamp */}
      <group position={[-0.78, 0, Z0 + 0.25]}>
        <mesh position={[0, 0.27, 0]}>
          <boxGeometry args={[0.46, 0.54, 0.4]} />
          <meshLambertMaterial color={black} />
        </mesh>
        <mesh position={[0, 0.64, 0]}>
          <sphereGeometry args={[0.1, 14, 10]} />
          <meshLambertMaterial color="#2e2e34" />
        </mesh>
        <mesh position={[0, 0.86, 0]}>
          <cylinderGeometry args={[0.12, 0.2, 0.22, 16, 1, true]} />
          <meshBasicMaterial color="#fff2d8" side={DoubleSide} toneMapped={false} />
        </mesh>
      </group>

      {/* Desk along the west wall */}
      <group position={[X0 + 0.35, 0, 0.25]}>
        <mesh position={[0, 0.74, 0]}>
          <boxGeometry args={[0.7, 0.05, 1.55]} />
          <meshLambertMaterial color={black} />
        </mesh>
        {[-0.72, 0.72].map((z) => (
          <mesh key={z} position={[0, 0.36, z]}>
            <boxGeometry args={[0.66, 0.72, 0.04]} />
            <meshLambertMaterial color={black} />
          </mesh>
        ))}
        {/* Desk mat, monitor, keyboard and mouse */}
        <mesh position={[0.1, 0.768, 0.05]}>
          <boxGeometry args={[0.42, 0.006, 0.9]} />
          <meshLambertMaterial color="#1a1a1e" />
        </mesh>
        <mesh position={[-0.2, 0.8, 0.0]}>
          <boxGeometry args={[0.18, 0.02, 0.24]} />
          <meshLambertMaterial color="#3a3b42" />
        </mesh>
        <mesh position={[-0.2, 0.9, 0.0]}>
          <boxGeometry args={[0.04, 0.2, 0.06]} />
          <meshLambertMaterial color="#3a3b42" />
        </mesh>
        <mesh position={[-0.17, 1.15, 0.0]}>
          <boxGeometry args={[0.03, 0.36, 0.64]} />
          <meshLambertMaterial color="#141418" />
        </mesh>
        <mesh position={[0.1, 0.78, 0.0]}>
          <boxGeometry args={[0.14, 0.015, 0.4]} />
          <meshLambertMaterial color="#2e2e34" />
        </mesh>
        <mesh position={[0.12, 0.78, 0.36]} scale={[0.6, 0.35, 1]}>
          <sphereGeometry args={[0.05, 12, 8]} />
          <meshLambertMaterial color="#2e2e34" />
        </mesh>
        {/* Plant, speaker, water bottle and a lit candle */}
        <mesh position={[-0.1, 0.84, -0.6]}>
          <icosahedronGeometry args={[0.11, 1]} />
          <meshLambertMaterial color="#5d8d3b" flatShading />
        </mesh>
        <mesh position={[-0.15, 0.88, 0.48]}>
          <cylinderGeometry args={[0.04, 0.04, 0.22, 12]} />
          <meshLambertMaterial color="#1a1a1e" />
        </mesh>
        <mesh position={[0.05, 0.86, 0.62]}>
          <cylinderGeometry args={[0.03, 0.03, 0.2, 10]} />
          <meshStandardMaterial color="#cfe8f0" roughness={0.2} />
        </mesh>
        <mesh position={[0.22, 0.81, 0.66]}>
          <cylinderGeometry args={[0.05, 0.05, 0.1, 14]} />
          <meshLambertMaterial color="#f2a69a" />
        </mesh>
        <mesh position={[0.22, 0.875, 0.66]}>
          <coneGeometry args={[0.012, 0.035, 6]} />
          <meshBasicMaterial color="#ffd27a" toneMapped={false} />
        </mesh>
      </group>
      {/* Gaming chair, pulled out and turned a little toward the room */}
      <group position={[X0 + 1.25, 0, 0.45]} rotation={[0, -Math.PI / 2 + 0.7, 0]}>
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 0.15, 0.05, Math.sin(a) * 0.15]} rotation={[0, -a, 0]}>
              <boxGeometry args={[0.3, 0.03, 0.04]} />
              <meshLambertMaterial color="#1d1d21" />
            </mesh>
          );
        })}
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.4, 8]} />
          <meshLambertMaterial color="#5a5d66" />
        </mesh>
        <RoundedBox args={[0.52, 0.09, 0.5]} radius={0.04} position={[0, 0.47, 0]}>
          <meshLambertMaterial color="#1d1d21" />
        </RoundedBox>
        <RoundedBox args={[0.5, 0.78, 0.09]} radius={0.04} position={[0, 0.9, 0.24]} rotation={[-0.12, 0, 0]}>
          <meshLambertMaterial color="#1d1d21" />
        </RoundedBox>
        {[-0.22, 0.22].map((x) => (
          <RoundedBox key={x} args={[0.07, 0.62, 0.1]} radius={0.03} position={[x, 0.95, 0.19]} rotation={[-0.12, 0, 0]}>
            <meshLambertMaterial color="#e9e6df" />
          </RoundedBox>
        ))}
        {[-0.28, 0.28].map((x) => (
          <mesh key={x} position={[x, 0.66, 0.0]}>
            <boxGeometry args={[0.05, 0.04, 0.32]} />
            <meshLambertMaterial color="#2e2e34" />
          </mesh>
        ))}
      </group>
      {/* Floor lamp with a reading arm */}
      <group position={[X0 + 0.3, 0, 1.25]}>
        <mesh position={[0, 0.02, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.03, 16]} />
          <meshLambertMaterial color="#1d1d21" />
        </mesh>
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 1.8, 6]} />
          <meshLambertMaterial color="#1d1d21" />
        </mesh>
        <mesh position={[0, 1.86, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.2, 0.14, 16, 1, true]} />
          <meshBasicMaterial color="#fffaf0" side={DoubleSide} toneMapped={false} />
        </mesh>
        <mesh position={[0.1, 1.28, -0.12]} rotation={[0.9, 0, -0.5]}>
          <cylinderGeometry args={[0.01, 0.01, 0.35, 6]} />
          <meshLambertMaterial color="#1d1d21" />
        </mesh>
        <mesh position={[0.2, 1.36, -0.26]} rotation={[0.6, 0, -0.4]}>
          <coneGeometry args={[0.07, 0.1, 12, 1, true]} />
          <meshBasicMaterial color="#fffaf0" side={DoubleSide} toneMapped={false} />
        </mesh>
      </group>
      {/* Tall shelf with roses and a plush pup in a grad cap on top */}
      <group position={[X0 + 0.24, 0, -0.95]}>
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[0.42, 1.56, 0.44]} />
          <meshLambertMaterial color={black} />
        </mesh>
        <mesh position={[0.05, 1.72, -0.08]}>
          <cylinderGeometry args={[0.05, 0.07, 0.26, 12]} />
          <meshStandardMaterial color="#d8eef2" roughness={0.1} transparent opacity={0.6} />
        </mesh>
        {[
          [0.02, 1.95, -0.1],
          [0.1, 1.9, -0.04],
          [-0.03, 1.88, -0.02],
          [0.07, 1.98, -0.14],
          [0.12, 1.86, -0.12]
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]}>
            <icosahedronGeometry args={[0.045, 0]} />
            <meshLambertMaterial color="#d1303a" flatShading />
          </mesh>
        ))}
        <group position={[0.02, 1.56, 0.1]}>
          <mesh position={[0, 0.1, 0]}>
            <sphereGeometry args={[0.1, 14, 10]} />
            <meshLambertMaterial color="#f4f1ea" />
          </mesh>
          <mesh position={[0.02, 0.25, 0.02]}>
            <sphereGeometry args={[0.08, 14, 10]} />
            <meshLambertMaterial color="#f4f1ea" />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0.02, 0.22, s * 0.08]} scale={[0.5, 1, 0.4]}>
              <sphereGeometry args={[0.06, 10, 8]} />
              <meshLambertMaterial color="#1d1d21" />
            </mesh>
          ))}
          <mesh position={[0.02, 0.33, 0.02]}>
            <boxGeometry args={[0.06, 0.04, 0.06]} />
            <meshLambertMaterial color="#1d1d21" />
          </mesh>
          <mesh position={[0.02, 0.355, 0.02]} rotation={[0, 0.5, 0]}>
            <boxGeometry args={[0.16, 0.012, 0.16]} />
            <meshLambertMaterial color="#1d1d21" />
          </mesh>
          <mesh position={[0.08, 0.33, 0.08]}>
            <boxGeometry args={[0.01, 0.06, 0.01]} />
            <meshLambertMaterial color="#e9c46a" />
          </mesh>
        </group>
      </group>

      {/* Record corner: cabinet, turntable, a little camera and a painting */}
      <group position={[X0 + 0.38, 0, Z1 - 0.32]}>
        <mesh position={[0, 0.36, 0]}>
          <boxGeometry args={[0.6, 0.72, 0.46]} />
          <meshLambertMaterial color={black} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[0.48, 0.1, 0.36]} />
          <meshLambertMaterial color="#a8774c" />
        </mesh>
        <mesh position={[-0.04, 0.84, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.015, 24]} />
          <meshLambertMaterial color="#1d1d21" />
        </mesh>
        <mesh position={[-0.04, 0.85, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.004, 16]} />
          <meshLambertMaterial color="#d1303a" />
        </mesh>
        <mesh position={[0.17, 0.86, 0.08]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.22]} />
          <meshLambertMaterial color="#c5ccd2" />
        </mesh>
        {/* Dust cover, propped open */}
        <mesh position={[0, 1.0, 0.18]} rotation={[-1.1, 0, 0]}>
          <boxGeometry args={[0.48, 0.36, 0.01]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.22} roughness={0.05} />
        </mesh>
        {/* Books and a silver compact camera */}
        <mesh position={[0.2, 0.75, -0.15]}>
          <boxGeometry args={[0.2, 0.06, 0.14]} />
          <meshLambertMaterial color="#d1303a" />
        </mesh>
        <mesh position={[0.2, 0.81, -0.15]}>
          <boxGeometry args={[0.13, 0.07, 0.05]} />
          <meshStandardMaterial color="#d5d8de" metalness={0.5} roughness={0.3} />
        </mesh>
      </group>
      {/* Low black lounge chair */}
      <group position={[-1.35, 0, Z1 - 0.55]} rotation={[0, Math.PI, 0]}>
        <RoundedBox args={[0.9, 0.32, 0.8]} radius={0.14} smoothness={3} position={[0, 0.16, 0.05]}>
          <meshLambertMaterial color="#26262b" />
        </RoundedBox>
        <RoundedBox args={[0.9, 0.62, 0.3]} radius={0.14} smoothness={3} position={[0, 0.48, -0.32]} rotation={[-0.25, 0, 0]}>
          <meshLambertMaterial color="#2a2a30" />
        </RoundedBox>
      </group>
      {/* Guitar leaning on the wall */}
      <group position={[-0.35, 0, Z1 - 0.18]} rotation={[0.22, Math.PI, 0]}>
        {/* Body: a wide lower bout and a narrower upper bout, with a dark rim */}
        <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.12, 1]}>
          <cylinderGeometry args={[0.2, 0.2, 0.09, 28]} />
          <meshLambertMaterial color="#d9944a" />
        </mesh>
        <mesh position={[0, 0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.09, 28]} />
          <meshLambertMaterial color="#d9944a" />
        </mesh>
        <mesh position={[0, 0.3, -0.002]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.12, 1]}>
          <cylinderGeometry args={[0.205, 0.205, 0.08, 28]} />
          <meshLambertMaterial color="#5a3d27" />
        </mesh>
        <mesh position={[0, 0.44, 0.046]}>
          <circleGeometry args={[0.05, 18]} />
          <meshLambertMaterial color="#2a1a10" />
        </mesh>
        <mesh position={[0, 0.2, 0.047]}>
          <boxGeometry args={[0.12, 0.025, 0.01]} />
          <meshLambertMaterial color="#3a2618" />
        </mesh>
        <mesh position={[0, 0.92, 0]}>
          <boxGeometry args={[0.05, 0.62, 0.03]} />
          <meshLambertMaterial color="#5a3d27" />
        </mesh>
        <mesh position={[0, 1.29, 0]}>
          <boxGeometry args={[0.08, 0.14, 0.03]} />
          <meshLambertMaterial color="#3a2618" />
        </mesh>
      </group>
      {/* Tall mirror leaning under the skyline */}
      <group position={[0.35, 0, Z1 - 0.12]} rotation={[0.1, Math.PI, 0]}>
        <mesh position={[0, 0.68, 0]}>
          <boxGeometry args={[0.46, 1.34, 0.03]} />
          <meshLambertMaterial color="#f4f1ea" />
        </mesh>
        <mesh position={[0, 0.68, 0.016]}>
          <planeGeometry args={[0.38, 1.26]} />
          <meshStandardMaterial color="#cdd7de" metalness={1} roughness={0.04} />
        </mesh>
      </group>
      {/* Door out */}
      <group position={[2.0, 0, Z1 - 0.01]} rotation={[0, Math.PI, 0]}>
        <mesh position={[0, 1.03, 0]}>
          <boxGeometry args={[0.86, 2.06, 0.03]} />
          <meshLambertMaterial color="#f4f1ea" />
        </mesh>
        <mesh position={[0.33, 1.0, 0.03]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshStandardMaterial color="#c5ccd2" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      {/* TV on a low console */}
      <group position={[X1 - 0.28, 0, 1.35]}>
        <mesh position={[0, 0.24, 0]}>
          <boxGeometry args={[0.42, 0.48, 1.5]} />
          <meshLambertMaterial color={black} />
        </mesh>
        <mesh position={[0.05, 0.53, 0]}>
          <boxGeometry args={[0.18, 0.04, 0.3]} />
          <meshLambertMaterial color="#2e2e34" />
        </mesh>
        <mesh position={[0.08, 0.98, 0]}>
          <boxGeometry args={[0.05, 0.8, 1.4]} />
          <meshStandardMaterial color="#141418" roughness={0.15} metalness={0.3} />
        </mesh>
        {/* A little figure and a controller */}
        <mesh position={[-0.08, 0.55, -0.55]}>
          <coneGeometry args={[0.04, 0.12, 8]} />
          <meshLambertMaterial color="#ff8a3d" />
        </mesh>
        <mesh position={[-0.08, 0.5, 0.5]}>
          <boxGeometry args={[0.1, 0.03, 0.16]} />
          <meshLambertMaterial color="#f4f1ea" />
        </mesh>
      </group>
      {/* Window with blinds */}
      <group position={[X1 - 0.02, 1.45, -1.35]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.08, 1.18, 0.04]} />
          <meshLambertMaterial color="#f4f1ea" />
        </mesh>
        <mesh position={[0, 0, 0.022]}>
          <planeGeometry args={[0.96, 1.06]} />
          <meshBasicMaterial color="#ffd6a3" toneMapped={false} />
        </mesh>
        {Array.from({ length: 12 }, (_, i) => (
          <mesh key={i} position={[0, 0.48 - i * 0.087, 0.05]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.98, 0.05, 0.005]} />
            <meshLambertMaterial color="#fbf8f2" />
          </mesh>
        ))}
        <mesh position={[0, -0.62, 0.06]}>
          <boxGeometry args={[1.16, 0.04, 0.14]} />
          <meshLambertMaterial color="#f4f1ea" />
        </mesh>
      </group>
      {/* Ceiling light */}
      <mesh position={[0.2, H - 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.28, 24]} />
        <meshBasicMaterial color="#fff6e2" toneMapped={false} />
      </mesh>
      {/* Medals on their lanyards */}
      {['#3b5fae', '#e9c46a', '#2a3a6a', '#d1303a'].map((c, i) => (
        <group key={c} position={[X1 - 0.02, 0.92, -0.52 + i * 0.12]} rotation={[0, -Math.PI / 2, (i - 1.5) * 0.06]}>
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.035, 0.36, 0.005]} />
            <meshLambertMaterial color={c} />
          </mesh>
          <mesh position={[0, -0.04, 0.01]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.012, 16]} />
            <meshStandardMaterial color={i === 1 ? '#c5ccd2' : '#d9a441'} metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
}

/** Walls, floor and ceiling, plus the skirting. */
function Shell({ carpet }: { carpet: Texture }) {
  const wall = '#ece3d4';
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshLambertMaterial map={carpet} />
      </mesh>
      {/* Ceiling stays light; lit from below it would look brown */}
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshBasicMaterial color="#e9e1d3" />
      </mesh>
      <mesh position={[0, H / 2, Z0]}>
        <planeGeometry args={[W, H]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      <mesh position={[0, H / 2, Z1]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      <mesh position={[X0, H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      <mesh position={[X1, H / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshLambertMaterial color={wall} />
      </mesh>
      {[
        [0, Z0 + 0.01, W, 0],
        [0, Z1 - 0.01, W, Math.PI],
        [X0 + 0.01, 0, D, Math.PI / 2],
        [X1 - 0.01, 0, D, -Math.PI / 2]
      ].map(([x, z, len, r], i) => (
        <mesh key={i} position={[x, 0.05, z]} rotation={[0, r, 0]}>
          <boxGeometry args={[len, 0.1, 0.02]} />
          <meshLambertMaterial color="#fbf8f2" />
        </mesh>
      ))}
    </>
  );
}

/** Everything with a printed image: jerseys, scarves, the flag and the pictures. */
function Decor() {
  const art = useMemo(
    () => ({
      ribery: jerseyTexture('RIBÉRY', '#d51f2c', '#ffffff', false),
      ronaldo: jerseyTexture('RONALDO', '#e4252f', '#ffffff', true),
      dimaria: jerseyTexture('DI MARÍA', '#d71e2a', '#1d1d21', false),
      united: scarfTexture('MAN UTD', null, '#d1303a', '#d1303a', '#ffffff'),
      semi: scarfTexture('FRANCE vs ESPAÑA', 'SEMI FINAL · DALLAS 2026', '#1f2a5c', '#c8202c', '#ffffff'),
      flag: flagTexture(),
      helmet: helmetTexture(),
      robot: robotTexture(),
      painting: paintingTexture(),
      wave: waveTexture(),
      skyline: skylineTexture()
    }),
    []
  );
  // Each of the three skyline canvases shows its third of the picture.
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
  const jerseys: [Texture, number][] = [
    [art.ribery, -0.35],
    [art.ronaldo, 0.4],
    [art.dimaria, 1.15]
  ];
  return (
    <>
      {jerseys.map(([map, x], i) => (
        <mesh key={i} position={[x, 1.72, Z0 + 0.03]} rotation={[0, 0, (i - 1) * 0.02]}>
          <planeGeometry args={[0.66, 0.66]} />
          <meshLambertMaterial map={map} transparent alphaTest={0.5} />
        </mesh>
      ))}
      {/* Two scarves, slightly draped */}
      <mesh position={[-1.75, 2.3, Z1 - 0.02]} rotation={[0, Math.PI, 0.03]}>
        <planeGeometry args={[1.5, 0.26]} />
        <meshLambertMaterial map={art.united} side={DoubleSide} />
      </mesh>
      <mesh position={[-1.68, 2.02, Z1 - 0.03]} rotation={[0, Math.PI, -0.05]}>
        <planeGeometry args={[1.45, 0.25]} />
        <meshLambertMaterial map={art.semi} side={DoubleSide} />
      </mesh>
      <mesh position={[X1 - 0.02, 1.75, 0.45]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[0.66, 0.93]} />
        <meshLambertMaterial map={art.flag} />
      </mesh>
      <Picture map={art.helmet} position={[X1 - 0.02, 1.85, -0.35]} rotationY={-Math.PI / 2} size={[0.46, 0.5]} />
      <Picture map={art.robot} position={[X1 - 0.02, 1.38, -0.35]} rotationY={-Math.PI / 2} size={[0.38, 0.35]} />
      {panels.map((map, i) => (
        <Picture key={i} map={map} position={[-0.25 + i * 0.6, 2.0, Z1 - 0.02]} rotationY={Math.PI} size={[0.56, 0.45]} frame="#3a3a3e" />
      ))}
      {/* Painting leaning behind the turntable */}
      <group position={[X0 + 0.42, 0.98, Z1 - 0.12]} rotation={[0.18, Math.PI + 0.1, 0]}>
        <mesh>
          <boxGeometry args={[0.46, 0.38, 0.03]} />
          <meshLambertMaterial color="#1d1d21" />
        </mesh>
        <mesh position={[0, 0, 0.017]}>
          <planeGeometry args={[0.4, 0.32]} />
          <meshLambertMaterial map={art.painting} />
        </mesh>
      </group>
      {/* Sound-wave sticker on the record cabinet */}
      <mesh position={[X0 + 0.38, 0.42, Z1 - 0.32 - 0.231]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[0.3, 0.15]} />
        <meshLambertMaterial map={art.wave} />
      </mesh>
    </>
  );
}

function Hotspots() {
  const open = useWorld((s) => s.station === 'room');
  if (!open) return null;
  return (
    <>
      {roomHotspots.map((h) => (
        <Html key={h.id} position={SPOTS[h.id]} center zIndexRange={[30, 10]}>
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
        </Html>
      ))}
    </>
  );
}

/** The room, only drawn while you're inside it. */
export function Room() {
  const group = useRef<Group>(null);
  const carpet = useMemo(carpetTexture, []);
  const gl = useThree((s) => s.gl);

  // Drag to look around.
  useEffect(() => {
    const canvas = gl.domElement;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      if (world.get().station === 'room') last = { x: e.clientX, y: e.clientY };
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      turnRoom(-(e.clientX - last.x) * 0.005, (e.clientY - last.y) * 0.004);
      last = { x: e.clientX, y: e.clientY };
    };
    const up = () => {
      last = null;
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const inside = world.get().station === 'room';
    if (group.current) group.current.visible = inside;
    roomView.yaw = MathUtils.damp(roomView.yaw, roomView.targetYaw, 8, delta);
    roomView.pitch = MathUtils.damp(roomView.pitch, roomView.targetPitch, 8, delta);
  });

  return (
    <group ref={group} position={ROOM_ORIGIN} visible={false}>
      <Shell carpet={carpet} />
      <StaticBatch>
        <Furniture />
      </StaticBatch>
      <Decor />
      <Hotspots />
    </group>
  );
}
