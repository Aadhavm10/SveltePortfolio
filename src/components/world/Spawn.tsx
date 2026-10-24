import { useMemo } from 'react';
import { CapsuleCollider, ConeCollider, RigidBody } from '@react-three/rapier';
import { FontLoader, type FontData } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';
import type { CanvasTexture } from 'three';
import { canvasTexture, FONT } from './textures';
import { world } from './store';
import { PALETTE, PITCH } from './zones';

const PAINT = 'rgba(255, 255, 255, 0.92)';

export function GroundDecal({
  texture,
  x,
  z,
  width,
  depth,
  rotation = 0
}: {
  texture: CanvasTexture;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation?: number;
}) {
  return (
    <mesh position={[x, 0.03, z]} rotation={[-Math.PI / 2, 0, rotation]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={texture} transparent depthWrite={false} roughness={1} polygonOffset polygonOffsetFactor={-4} />
    </mesh>
  );
}

/** Painted ground text, sized so the texture keeps the plane's aspect ratio. */
export function PaintedText({
  lines,
  x,
  z,
  width,
  depth,
  rotation = 0,
  align = 'center'
}: {
  lines: { text: string; size: number; weight?: number; color?: string }[];
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation?: number;
  align?: CanvasTextAlign;
}) {
  const texture = useMemo(() => {
    const pxPerMetre = 128;
    return canvasTexture(Math.round(width * pxPerMetre), Math.round(depth * pxPerMetre), (ctx, w, h) => {
      const total = lines.reduce((sum, l) => sum + l.size * 1.15, 0);
      let y = (h - total) / 2;
      ctx.textAlign = align;
      ctx.textBaseline = 'top';
      const tx = align === 'center' ? w / 2 : align === 'right' ? w - 8 : 8;
      for (const line of lines) {
        ctx.fillStyle = line.color ?? PAINT;
        ctx.font = `${line.weight ?? 900} ${line.size}px ${FONT}`;
        ctx.fillText(line.text, tx, y, w - 16);
        y += line.size * 1.15;
      }
    });
  }, []);
  return <GroundDecal texture={texture} x={x} z={z} width={width} depth={depth} rotation={rotation} />;
}

function keycap(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string) {
  ctx.lineWidth = 7;
  ctx.strokeStyle = PAINT;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 16);
  ctx.stroke();
  ctx.fillStyle = PAINT;
  ctx.font = `800 ${Math.round(h * 0.42)}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 2);
}

function ControlsDecal() {
  const texture = useMemo(() => {
    const touch = world.get().touch;
    return canvasTexture(1280, 640, (ctx, w) => {
      ctx.fillStyle = PAINT;
      if (touch) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 64px ${FONT}`;
        ctx.fillText('HOW TO PLAY', w / 2, 70);
        ctx.font = `700 46px ${FONT}`;
        const rows = ['Left stick: run (push far to sprint)', 'Ball button: hold to charge, release to shoot', 'Stand on glowing pads, then tap to open'];
        rows.forEach((row, i) => ctx.fillText(row, w / 2, 210 + i * 120));
        return;
      }
      const k = 96;
      const label = (text: string, x: number, y: number) => {
        ctx.fillStyle = PAINT;
        ctx.font = `700 44px ${FONT}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x, y);
      };
      // WASD cluster
      keycap(ctx, 150, 40, k, k, 'W');
      keycap(ctx, 46, 146, k, k, 'A');
      keycap(ctx, 150, 146, k, k, 'S');
      keycap(ctx, 254, 146, k, k, 'D');
      label('run', 380, 146 + k / 2);
      keycap(ctx, 46, 290, 300, k, 'SHIFT');
      label('sprint', 380, 290 + k / 2);
      keycap(ctx, 46, 430, 400, k, 'SPACE');
      label('hold + release to shoot', 480, 430 + k / 2);
      keycap(ctx, 760, 146, k, k, 'E');
      label('open', 880, 146 + k / 2);
      keycap(ctx, 760, 290, k, k, 'R');
      label('reset ball', 880, 290 + k / 2);
    });
  }, []);
  return <GroundDecal texture={texture} x={0} z={7} width={10} depth={5} />;
}

function NameLetters() {
  const letters = useMemo(() => {
    const font = new FontLoader().parse(fontJson as unknown as FontData);
    const glyphs = 'AADHAV'.split('').map((char) => {
      const geometry = new TextGeometry(char, {
        font,
        size: 2.2,
        depth: 0.6,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.04,
        bevelSegments: 2
      });
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
      return { geometry, width: box.max.x - box.min.x, height: box.max.y - box.min.y };
    });
    const gap = 0.3;
    let x = -(glyphs.reduce((sum, g) => sum + g.width, 0) + gap * (glyphs.length - 1)) / 2;
    return glyphs.map((g, i) => {
      const cx = x + g.width / 2;
      x += g.width + gap;
      return { ...g, x: cx, color: PALETTE[i % PALETTE.length] };
    });
  }, []);

  return (
    <>
      {letters.map((l, i) => (
        <RigidBody key={i} colliders="cuboid" position={[l.x, l.height / 2 + 0.01, -9]} mass={10} friction={0.8}>
          <mesh geometry={l.geometry} castShadow receiveShadow>
            <meshStandardMaterial color={l.color} roughness={0.45} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

const CONE_SPOTS: [number, number][] = [
  // slalom toward the projects
  [5.5, 3.6], [7.2, 3.6], [8.9, 3.6], [10.6, 3.6], [12.3, 3.6],
  // scattered near the pitch
  [-6, -15.5], [-4.8, -16.3], [5.5, -15.8], [14, -17], [-14, -17.5]
];

function Cone({ x, z }: { x: number; z: number }) {
  return (
    <RigidBody colliders={false} position={[x, 0.3, z]}>
      <ConeCollider args={[0.28, 0.22]} mass={0.3} friction={0.7} />
      <mesh castShadow position={[0, 0, 0]}>
        <coneGeometry args={[0.22, 0.56, 14]} />
        <meshStandardMaterial color="#ff7a3d" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.122, 0.142, 0.1, 14, 1, true]} />
        <meshStandardMaterial color="#ffffff" roughness={0.6} />
      </mesh>
      <mesh position={[0, -0.27, 0]} castShadow>
        <boxGeometry args={[0.46, 0.03, 0.46]} />
        <meshStandardMaterial color="#ff7a3d" roughness={0.6} />
      </mesh>
    </RigidBody>
  );
}

const DUMMIES: { x: number; z: number; color: string }[] = [
  { x: -8, z: -17, color: '#ff6b6b' },
  { x: 8.5, z: -17.5, color: '#4ecdc4' },
  { x: 16, z: 6, color: '#ffe66d' }
];

/** Training mannequins: wobbly, knock-over-able defenders. */
function Dummy({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <RigidBody colliders={false} position={[x, 0, z]} angularDamping={1.5}>
      <CapsuleCollider args={[0.55, 0.28]} position={[0, 0.85, 0]} mass={6} />
      <mesh position={[0, 0.85, 0]} castShadow>
        <capsuleGeometry args={[0.28, 1.1, 6, 14]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.78, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 12]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[0.38, 0.42, 0.1, 18]} />
        <meshStandardMaterial color="#2d2d33" roughness={0.8} />
      </mesh>
    </RigidBody>
  );
}

export function Spawn() {
  return (
    <>
      <NameLetters />
      <PaintedText
        x={0}
        z={-5.6}
        width={16}
        depth={3.2}
        lines={[
          { text: 'MANIMURUGAN', size: 150 },
          { text: 'SOFTWARE ENGINEER  ·  CS @ UT DALLAS', size: 58, weight: 700 }
        ]}
      />
      <ControlsDecal />
      <PaintedText x={9} z={0.8} width={7} depth={1.4} lines={[{ text: 'PROJECTS →', size: 120 }]} />
      <PaintedText x={-9} z={0.8} width={8} depth={1.4} lines={[{ text: '← ABOUT  ·  LIFE', size: 110 }]} />
      <PaintedText x={0} z={-14.4} width={9} depth={2} lines={[{ text: '↑ CONNECT', size: 120 }, { text: 'score a goal', size: 60, weight: 700 }]} />
      <PaintedText x={0} z={11} width={8} depth={1.4} lines={[{ text: '↓ CLASSIC SITE', size: 110 }]} />
      <PaintedText x={0} z={PITCH.frontZ - 5.2} width={14} depth={1.6} lines={[{ text: 'SCORE TO CONNECT', size: 150 }]} />
      {CONE_SPOTS.map(([x, z], i) => (
        <Cone key={i} x={x} z={z} />
      ))}
      {DUMMIES.map((d, i) => (
        <Dummy key={i} {...d} />
      ))}
    </>
  );
}
