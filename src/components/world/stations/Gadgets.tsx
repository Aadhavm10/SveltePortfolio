import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { ExtrudeGeometry, MeshStandardMaterial, Shape, ShapeGeometry } from 'three';
import { canvasTexture, drawCover, FONT } from '../textures';
import { Cable } from './Cable';
import { PROPS, PSP_TILT } from '../layout';
import { world } from '../store';
import { useScreen, WOOD } from './common';
import { PSP_MENU } from './pspMenu';
import { drawPsp } from './screens';

const SILVER = new MeshStandardMaterial({ color: '#d5d8de', metalness: 0.62, roughness: 0.26 });
const GUNMETAL = new MeshStandardMaterial({ color: '#55585f', metalness: 0.5, roughness: 0.35 });
const GLOSS_BLACK = new MeshStandardMaterial({ color: '#0d0e12', metalness: 0.1, roughness: 0.12 });
const RUBBER = new MeshStandardMaterial({ color: '#2a2c31', roughness: 0.7 });

function roundedRect(w: number, h: number, r: number) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + h - r);
  s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  s.lineTo(x + r, y + h);
  s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + r);
  s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Face button symbols: triangle, circle, cross, square. */
function symbolTexture(kind: number, color: string) {
  return canvasTexture(96, 96, (ctx, w, h) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const c = w / 2;
    if (kind === 0) {
      ctx.moveTo(c, 22);
      ctx.lineTo(c + 24, h - 28);
      ctx.lineTo(c - 24, h - 28);
      ctx.closePath();
    } else if (kind === 1) ctx.arc(c, h / 2, 22, 0, Math.PI * 2);
    else if (kind === 2) {
      ctx.moveTo(c - 20, c - 20);
      ctx.lineTo(c + 20, c + 20);
      ctx.moveTo(c + 20, c - 20);
      ctx.lineTo(c - 20, c + 20);
    } else ctx.rect(c - 20, c - 20, 40, 40);
    ctx.stroke();
  });
}

const BUTTONS: [number, number, string][] = [
  [0, 0.27, '#4fd08a'],
  [0.27, 0, '#ff5d5d'],
  [0, -0.27, '#6c9bff'],
  [-0.27, 0, '#ff8fd0']
];

/** Silver handheld modelled on the original PSP: favourites and a game in a cross-media menu. */
export function Psp() {
  const geometries = useMemo(() => {
    const body = new ExtrudeGeometry(roundedRect(4.9, 2.05, 0.95), {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.09,
      bevelSize: 0.08,
      bevelSegments: 6,
      curveSegments: 28
    }).translate(0, 0, -0.12);
    const surround = new ShapeGeometry(roundedRect(3.1, 1.8, 0.1), 6);
    return { body, surround };
  }, []);
  const symbols = useMemo(() => BUTTONS.map(([, , color], i) => symbolTexture(i, color)), []);
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, time = 0) => {
    const s = world.get();
    const active = s.station === 'psp';
    drawPsp(ctx, w, h, PSP_MENU, active ? s.psp.col : 1, active ? s.psp.row : 0, time, active);
  };
  const screen = useMemo(() => canvasTexture(1024, 580, (ctx, w, h) => draw(ctx, w, h)), []);
  const lastDraw = useRef(0);

  useFrame((state) => {
    // The wave animates while open; otherwise refresh slowly.
    const active = world.get().station === 'psp';
    const t = state.clock.elapsedTime;
    if (t - lastDraw.current < (active ? 1 / 30 : 1)) return;
    lastDraw.current = t;
    screen.redraw((ctx, w, h) => draw(ctx, w, h, t));
  });

  const front = 0.215;
  const { x, z } = PROPS.psp;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.6, 1.4, 0.6]} position={[0, 1.4, -0.3]} />
      </RigidBody>
      {/* Wooden easel */}
      {[-1.6, 1.6].map((sx) => (
        <mesh key={sx} position={[sx, 0.55, -0.55]} rotation={[0.35, 0, 0]} material={WOOD} castShadow>
          <boxGeometry args={[0.16, 1.3, 0.16]} />
        </mesh>
      ))}
      <mesh position={[0, 0.82, 0.18]} material={WOOD} castShadow>
        <boxGeometry args={[4.2, 0.12, 0.4]} />
      </mesh>

      <group position={[0, 2.0, 0]} rotation={[-PSP_TILT, 0, 0]}>
        <mesh geometry={geometries.body} material={SILVER} castShadow receiveShadow />
        {/* Glossy screen glass and the screen itself */}
        <mesh geometry={geometries.surround} material={GLOSS_BLACK} position={[0, 0.03, front]} />
        <mesh position={[0, 0.03, front + 0.003]}>
          <planeGeometry args={[2.82, 1.6]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>

        {/* D-pad in its round well */}
        <group position={[-1.88, 0.25, front]}>
          <mesh material={RUBBER}>
            <circleGeometry args={[0.4, 32]} />
          </mesh>
          {[0, 1, 2, 3].map((i) => {
            const a = (i * Math.PI) / 2;
            return (
              <RoundedBox key={i} args={[0.17, 0.2, 0.06]} radius={0.03} position={[Math.sin(a) * 0.21, Math.cos(a) * 0.21, 0.02]} rotation={[0, 0, -a]} material={SILVER} />
            );
          })}
        </group>
        {/* Analog nub */}
        <group position={[-1.8, -0.55, front]}>
          <mesh material={RUBBER}>
            <circleGeometry args={[0.24, 24]} />
          </mesh>
          <mesh material={GUNMETAL} position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.15, 0.16, 0.05, 24]} />
          </mesh>
        </group>
        {/* Face buttons with their symbols */}
        <group position={[1.88, 0.25, front]}>
          {BUTTONS.map(([bx, by], i) => (
            <group key={i} position={[bx, by, 0]}>
              <mesh material={SILVER} position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.06, 24]} />
              </mesh>
              <mesh position={[0, 0, 0.062]}>
                <planeGeometry args={[0.2, 0.2]} />
                <meshBasicMaterial map={symbols[i]} transparent toneMapped={false} />
              </mesh>
            </group>
          ))}
        </group>
        {/* Home, select, start, and the little speaker grilles */}
        <RoundedBox args={[0.32, 0.12, 0.04]} radius={0.05} position={[-1.35, -0.78, front + 0.01]} material={GUNMETAL} />
        {[1.42, 1.82].map((bx) => (
          <RoundedBox key={bx} args={[0.26, 0.09, 0.04]} radius={0.04} position={[bx, -0.78, front + 0.01]} material={GUNMETAL} />
        ))}
        {[-2.2, 2.2].map((gx) =>
          [0, 1, 2].map((row) =>
            [0, 1, 2].map((col) => (
              <mesh key={`${gx}-${row}-${col}`} material={RUBBER} position={[gx + (col - 1) * 0.07 * Math.sign(gx), -0.5 - row * 0.07, front + 0.001]}>
                <circleGeometry args={[0.018, 8]} />
              </mesh>
            ))
          )
        )}
        {/* Shoulder buttons */}
        {[-1, 1].map((side) => (
          <RoundedBox key={side} args={[1.1, 0.14, 0.32]} radius={0.06} position={[side * 1.7, 1.02, -0.02]} rotation={[0, 0, -side * 0.12]} material={GUNMETAL} />
        ))}
      </group>

      {/* Bean bags */}
      {[[-3.3, 1.8, '#ff8b6b'], [3.4, 1.5, '#4ecdc4']].map(([bx, bz, color], i) => (
        <mesh key={i} position={[bx as number, 0.4, bz as number]} scale={[1, 0.62, 1]} castShadow receiveShadow>
          <sphereGeometry args={[0.8, 20, 14]} />
          <meshStandardMaterial color={color as string} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function dialTexture(marks: string[], color = '#1d1d1f') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#d5d8de';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.font = `700 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    marks.forEach((m, i) => {
      const a = -Math.PI / 2 + (i / marks.length) * Math.PI * 2;
      ctx.save();
      ctx.translate(w / 2 + Math.cos(a) * 92, h / 2 + Math.sin(a) * 92);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(m, 0, 0);
      ctx.restore();
    });
  });
}

function leatherTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#1f1f21';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const v = 22 + Math.random() * 22;
      ctx.fillStyle = `rgb(${v}, ${v}, ${v + 2})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
}

/** The last photo taken, shown on the camera's back screen. */
export const photoBooth: { last: HTMLCanvasElement | null; shots: number } = { last: null, shots: 0 };

/** A small silver-and-black rangefinder on a tripod: the photo booth. */
export function PhotoCamera() {
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#ffb3a1');
    g.addColorStop(1, '#ffd28a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (photoBooth.last) {
      drawCover(ctx, photoBooth.last, 0, 0, w, h);
    } else {
      // A little drawn camera and a prompt until the first photo.
      ctx.fillStyle = '#fffaee';
      ctx.beginPath();
      ctx.roundRect(w / 2 - 70, h / 2 - 70, 140, 96, 18);
      ctx.fill();
      ctx.fillRect(w / 2 - 30, h / 2 - 86, 60, 20);
      ctx.fillStyle = '#ff8a7a';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 - 22, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a3b2c';
      ctx.font = `800 34px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('Say cheese', w / 2, h / 2 + 90);
    }
  };
  const lcd = useScreen(512, 340, draw, () => `${photoBooth.shots}|${world.get().polaroid}`);

  const textures = useMemo(
    () => ({
      shutter: dialTexture(['A', '2', '4', '8', '15', '30', '60', '125', '250', '500', '1000', 'T']),
      comp: dialTexture(['0', '+1', '+2', '+3', '-3', '-2', '-1'], '#b23a2e'),
      leather: leatherTexture()
    }),
    []
  );
  const leather = useMemo(() => new MeshStandardMaterial({ map: textures.leather, roughness: 0.9 }), [textures]);

  const { x, z } = PROPS.camera;
  const legs = [0, 1, 2].map((i) => (i / 3) * Math.PI * 2 + Math.PI / 2);
  return (
    // The lens faces the visitor: this is the camera that takes their photo.
    <group position={[x, 0, z]} rotation={[0, Math.PI, 0]} scale={0.72}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.2, 0.6]} position={[0, 1.2, 0]} />
      </RigidBody>
      {legs.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.38, 0.78, Math.sin(a) * 0.38]} rotation={[Math.sin(a) * -0.32, 0, Math.cos(a) * 0.32]} material={GUNMETAL} castShadow>
          <cylinderGeometry args={[0.035, 0.05, 1.65, 8]} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]} material={GUNMETAL} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.2, 10]} />
      </mesh>

      <group position={[0, 1.95, 0]}>
        {/* Black leatherette body between silver plates */}
        <RoundedBox args={[1.5, 0.56, 0.48]} radius={0.05} smoothness={3} position={[0, -0.08, 0]} material={leather} castShadow />
        <RoundedBox args={[1.52, 0.3, 0.5]} radius={0.07} smoothness={3} position={[0, 0.33, 0]} material={SILVER} castShadow />
        <RoundedBox args={[1.52, 0.07, 0.5]} radius={0.03} smoothness={3} position={[0, -0.385, 0]} material={SILVER} />

        {/* Shutter-speed dial with the shutter button, exposure dial, hot shoe */}
        <group position={[0.22, 0.52, 0.02]}>
          <mesh material={SILVER} castShadow>
            <cylinderGeometry args={[0.18, 0.18, 0.09, 40]} />
          </mesh>
          <mesh position={[0, 0.046, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.18, 40]} />
            <meshStandardMaterial map={textures.shutter} metalness={0.4} roughness={0.35} />
          </mesh>
          <mesh material={SILVER} position={[0, 0.09, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.09, 20]} />
          </mesh>
        </group>
        <group position={[0.6, 0.51, 0.08]}>
          <mesh material={SILVER} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 0.08, 32]} />
          </mesh>
          <mesh position={[0, 0.041, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.12, 32]} />
            <meshStandardMaterial map={textures.comp} metalness={0.4} roughness={0.35} />
          </mesh>
        </group>
        <mesh material={GUNMETAL} position={[-0.2, 0.495, 0]}>
          <boxGeometry args={[0.24, 0.03, 0.2]} />
        </mesh>

        {/* Fixed prime lens: silver barrel, black front ring, blue-tinted glass */}
        <group position={[0.15, -0.06, -0.24]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh material={SILVER} position={[0, 0.1, 0]} castShadow>
            <cylinderGeometry args={[0.27, 0.29, 0.2, 40]} />
          </mesh>
          <mesh material={RUBBER} position={[0, 0.215, 0]}>
            <cylinderGeometry args={[0.265, 0.27, 0.05, 40]} />
          </mesh>
          <mesh position={[0, 0.242, 0]}>
            <cylinderGeometry args={[0.18, 0.18, 0.01, 32]} />
            <meshStandardMaterial color="#26385c" metalness={0.9} roughness={0.08} />
          </mesh>
        </group>
        {/* Optical viewfinder window on the front, eyepiece on the back */}
        <mesh material={SILVER} position={[-0.5, 0.31, -0.252]}>
          <planeGeometry args={[0.34, 0.2]} />
        </mesh>
        <mesh material={GLOSS_BLACK} position={[-0.5, 0.31, -0.255]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[0.28, 0.15]} />
        </mesh>
        <RoundedBox args={[0.26, 0.17, 0.08]} radius={0.03} position={[-0.52, 0.31, 0.27]} material={RUBBER} />

        {/* Back screen and a few buttons */}
        <mesh position={[0.08, -0.07, 0.247]}>
          <planeGeometry args={[0.86, 0.56]} />
          <meshBasicMaterial map={lcd} toneMapped={false} />
        </mesh>
        {[0.16, 0.0, -0.16].map((by) => (
          <mesh key={by} material={GUNMETAL} position={[0.62, by - 0.06, 0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.02, 16]} />
          </mesh>
        ))}
        {/* Strap lugs and a red strap hanging between them */}
        {[-1, 1].map((side) => (
          <mesh key={side} material={SILVER} position={[side * 0.77, 0.3, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.05, 0.015, 8, 16]} />
          </mesh>
        ))}
        <Cable
          color="#d9573f"
          plug="#c5ccd2"
          radius={0.03}
          points={[
            [-0.8, 0.28, 0.02],
            [-0.85, -0.25, 0.12],
            [-0.45, -0.72, 0.16],
            [0.2, -0.8, 0.16],
            [0.7, -0.4, 0.12],
            [0.8, 0.28, 0.02]
          ]}
        />
      </group>
    </group>
  );
}
