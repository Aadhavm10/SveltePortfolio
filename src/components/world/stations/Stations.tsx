import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { MeshStandardMaterial } from 'three';
import { experience, photos, projects } from '../../../data/portfolio';
import { canvasTexture, drawCover, FONT, loadImage } from '../textures';
import { LID_TILT, PROPS, PSP_TILT } from '../layout';
import { world } from '../store';
import { drawExperience, drawProject, drawPsp } from './screens';
import { PSP_MENU } from './pspMenu';

const ALUMINIUM = new MeshStandardMaterial({ color: '#cdd0d6', metalness: 0.55, roughness: 0.32 });
const DARK = new MeshStandardMaterial({ color: '#1b1c22', metalness: 0.2, roughness: 0.3 });
const WOOD = new MeshStandardMaterial({ color: '#a87a52', roughness: 0.75 });

/** A screen texture that redraws whenever the world state it depends on changes. */
function useScreen(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, key: () => string) {
  const texture = useMemo(() => canvasTexture(width, height, draw), []);
  const last = useRef('');
  useEffect(() => {
    const update = () => {
      const k = key();
      if (k === last.current) return;
      last.current = k;
      texture.redraw(draw);
    };
    update();
    return world.subscribe(update);
    // The draw and key callbacks read live state, so subscribing once is enough.
  }, []);
  return texture;
}

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

/** Giant laptop: projects, one per Enter press. */
function Laptop() {
  const images = useRef<(HTMLImageElement | null)[]>(projects.map(() => null));
  const pageKey = () => {
    const s = world.get();
    const active = s.station === 'projects';
    return `${active ? s.page : 0}|${active}|${images.current.filter(Boolean).length}`;
  };
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const s = world.get();
    const active = s.station === 'projects';
    const page = active ? s.page : 0;
    drawProject(ctx, w, h, projects[page], page, projects.length, images.current[page], active);
  };
  const screen = useScreen(1600, 1000, draw, pageKey);

  useEffect(() => {
    projects.forEach((p, i) =>
      loadImage(p.src)
        .then((img) => {
          images.current[i] = img;
          screen.redraw(draw);
        })
        .catch(() => {})
    );
  }, []);

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
      </group>
    </group>
  );
}

/** Desk with a monitor: experience, one role per page. */
function Desk() {
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
  const keys = useMemo(keyboardTexture, []);
  const { x, z } = PROPS.monitor;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.5, 0.85, 1.3]} position={[0, 0.85, -0.6]} />
      </RigidBody>
      {/* Desk */}
      <RoundedBox args={[7, 0.18, 2.6]} radius={0.05} position={[0, 1.6, -0.6]} material={WOOD} castShadow receiveShadow />
      {[[-3.3, 0.5], [3.3, 0.5], [-3.3, -1.7], [3.3, -1.7]].map(([lx, lz], i) => (
        <mesh key={i} position={[lx, 0.76, lz]} material={WOOD} castShadow>
          <boxGeometry args={[0.16, 1.52, 0.16]} />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0, 1.74, -0.9]} material={DARK} castShadow>
        <boxGeometry args={[1.1, 0.1, 0.7]} />
      </mesh>
      <mesh position={[0, 2.05, -0.95]} material={DARK} castShadow>
        <boxGeometry args={[0.22, 0.65, 0.12]} />
      </mesh>
      <RoundedBox args={[4.95, 2.95, 0.16]} radius={0.06} position={[0, 3.35, -0.36]} material={DARK} castShadow />
      <mesh position={[0, 3.35, -0.27]}>
        <planeGeometry args={[4.7, 2.76]} />
        <meshBasicMaterial map={screen} toneMapped={false} />
      </mesh>
      {/* Keyboard, mouse, mug and a plant */}
      <mesh position={[0, 1.73, 0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, 0.8]} />
        <meshStandardMaterial map={keys} roughness={0.6} />
      </mesh>
      <mesh position={[1.8, 1.74, 0.2]} scale={[1, 0.5, 1.4]} material={DARK} castShadow>
        <sphereGeometry args={[0.16, 14, 10]} />
      </mesh>
      <mesh position={[-2.4, 1.92, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.18, 0.46, 16]} />
        <meshStandardMaterial color="#ff8b6b" roughness={0.5} />
      </mesh>
      <group position={[2.85, 1.69, -1.3]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.24, 0.5, 14]} />
          <meshStandardMaterial color="#e9dccb" roughness={0.8} />
        </mesh>
        {[[0, 0.75, 0, 0.36], [0.2, 0.95, 0.1, 0.26], [-0.18, 0.9, -0.1, 0.28]].map(([px, py, pz, r], i) => (
          <mesh key={i} position={[px, py, pz]} castShadow>
            <icosahedronGeometry args={[r, 1]} />
            <meshStandardMaterial color="#5d8d3b" roughness={0.8} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Giant handheld console on a stand: favourites and a game, in a cross-media menu. */
function Psp() {
  const face = useMemo(
    () =>
      canvasTexture(2048, 900, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#26272e');
        g.addColorStop(1, '#141519');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // D-pad
        ctx.fillStyle = '#0c0c0f';
        const dx = 250;
        const dy = 380;
        for (const [ox, oy] of [[0, -90], [0, 90], [-90, 0], [90, 0]]) {
          ctx.beginPath();
          ctx.roundRect(dx + ox - 45, dy + oy - 45, 90, 90, 14);
          ctx.fill();
        }
        ctx.fillStyle = '#3a3b44';
        for (const [ox, oy, r] of [[0, -90, 0], [0, 90, Math.PI], [-90, 0, -Math.PI / 2], [90, 0, Math.PI / 2]]) {
          ctx.save();
          ctx.translate(dx + ox, dy + oy);
          ctx.rotate(r);
          ctx.beginPath();
          ctx.moveTo(0, -18);
          ctx.lineTo(16, 12);
          ctx.lineTo(-16, 12);
          ctx.fill();
          ctx.restore();
        }
        // Analog nub
        ctx.fillStyle = '#0c0c0f';
        ctx.beginPath();
        ctx.arc(230, 690, 62, 0, Math.PI * 2);
        ctx.fill();
        // Face buttons
        const bx = w - 250;
        const by = 380;
        const buttons: [number, number, string][] = [[0, -95, '#57d38c'], [95, 0, '#ff6b6b'], [0, 95, '#7aa7ff'], [-95, 0, '#ff8fd0']];
        buttons.forEach(([ox, oy, color], i) => {
          ctx.fillStyle = '#0c0c0f';
          ctx.beginPath();
          ctx.arc(bx + ox, by + oy, 54, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 9;
          ctx.beginPath();
          const cx = bx + ox;
          const cy = by + oy;
          if (i === 0) {
            ctx.moveTo(cx, cy - 24);
            ctx.lineTo(cx + 22, cy + 16);
            ctx.lineTo(cx - 22, cy + 16);
            ctx.closePath();
          } else if (i === 1) ctx.arc(cx, cy, 21, 0, Math.PI * 2);
          else if (i === 2) {
            ctx.moveTo(cx - 18, cy - 18);
            ctx.lineTo(cx + 18, cy + 18);
            ctx.moveTo(cx + 18, cy - 18);
            ctx.lineTo(cx - 18, cy + 18);
          } else ctx.rect(cx - 18, cy - 18, 36, 36);
          ctx.stroke();
        });
        // Start / select and a speaker grille
        ctx.fillStyle = '#0c0c0f';
        for (const sx of [w / 2 + 520, w / 2 + 640]) {
          ctx.beginPath();
          ctx.roundRect(sx, h - 90, 90, 30, 15);
          ctx.fill();
        }
        ctx.fillStyle = '#3a3b44';
        for (let i = 0; i < 18; i++) {
          ctx.beginPath();
          ctx.arc(w / 2 - 700 + (i % 9) * 22, h - 85 + Math.floor(i / 9) * 22, 5, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#9a9ba6';
        ctx.font = `800 40px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('AADHAV', w / 2, 72);
      }),
    []
  );

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

  const { x, z } = PROPS.psp;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.6, 1.4, 0.6]} position={[0, 1.4, -0.3]} />
      </RigidBody>
      {/* Easel stand */}
      {[-1.6, 1.6].map((sx) => (
        <mesh key={sx} position={[sx, 0.55, -0.55]} rotation={[0.35, 0, 0]} material={WOOD} castShadow>
          <boxGeometry args={[0.16, 1.3, 0.16]} />
        </mesh>
      ))}
      <mesh position={[0, 0.82, 0.18]} material={WOOD} castShadow>
        <boxGeometry args={[4.2, 0.12, 0.4]} />
      </mesh>
      <group position={[0, 2.0, 0]} rotation={[-PSP_TILT, 0, 0]}>
        <RoundedBox args={[5, 2.25, 0.42]} radius={0.2} smoothness={4} material={DARK} castShadow />
        <mesh position={[0, 0, 0.212]}>
          <planeGeometry args={[4.8, 2.1]} />
          <meshStandardMaterial map={face} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.02, 0.216]}>
          <planeGeometry args={[2.92, 1.66]} />
          <meshBasicMaterial map={screen} toneMapped={false} />
        </mesh>
        {[-1.9, 1.9].map((sx) => (
          <RoundedBox key={sx} args={[0.9, 0.12, 0.3]} radius={0.05} position={[sx, 1.13, -0.02]} material={DARK} />
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

/** Camera on a tripod: look through it to flip through photos. */
function PhotoCamera() {
  const images = useRef<Record<number, HTMLImageElement>>({});
  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const s = world.get();
    const page = s.station === 'camera' ? s.page : 0;
    ctx.fillStyle = '#0d0d10';
    ctx.fillRect(0, 0, w, h);
    const img = images.current[page];
    if (img) drawCover(ctx, img, 0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(`${page + 1}/${photos.length}`, 18, h - 18);
  };
  const lcd = useScreen(512, 340, draw, () => {
    const s = world.get();
    return `${s.station === 'camera' ? s.page : 0}|${Object.keys(images.current).length}`;
  });

  useEffect(
    () =>
      world.subscribe(() => {
        const s = world.get();
        const page = s.station === 'camera' ? s.page : 0;
        if (images.current[page]) return;
        loadImage(photos[page])
          .then((img) => {
            images.current[page] = img;
            lcd.redraw(draw);
          })
          .catch(() => {});
      }),
    []
  );
  useEffect(() => {
    loadImage(photos[0])
      .then((img) => {
        images.current[0] = img;
        lcd.redraw(draw);
      })
      .catch(() => {});
  }, []);

  const { x, z } = PROPS.camera;
  const legs = [0, 1, 2].map((i) => (i / 3) * Math.PI * 2 + Math.PI / 2);
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1.2, 0.7]} position={[0, 1.2, 0]} />
      </RigidBody>
      {legs.map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.38, 0.78, Math.sin(a) * 0.38]} rotation={[Math.sin(a) * -0.32, 0, Math.cos(a) * 0.32]} castShadow>
          <cylinderGeometry args={[0.035, 0.05, 1.65, 8]} />
          <meshStandardMaterial color="#2a2b31" metalness={0.4} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 1.55, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.12, 0.2, 10]} />
        <meshStandardMaterial color="#2a2b31" />
      </mesh>
      <group position={[0, 1.95, 0]}>
        <RoundedBox args={[1.4, 0.8, 0.62]} radius={0.08} smoothness={3} castShadow>
          <meshStandardMaterial color="#26262a" roughness={0.7} />
        </RoundedBox>
        <RoundedBox args={[1.42, 0.22, 0.64]} radius={0.06} smoothness={3} position={[0, 0.33, 0]} castShadow>
          <meshStandardMaterial color="#d3d5da" metalness={0.6} roughness={0.3} />
        </RoundedBox>
        <mesh position={[-0.05, 0.5, -0.02]} castShadow>
          <boxGeometry args={[0.42, 0.22, 0.4]} />
          <meshStandardMaterial color="#d3d5da" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.45, 0.47, 0.05]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 14]} />
          <meshStandardMaterial color="#e2483b" roughness={0.4} />
        </mesh>
        {/* Lens, pointing out over the pond */}
        <mesh position={[0, -0.02, -0.55]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.3, 0.33, 0.5, 24]} />
          <meshStandardMaterial color="#1a1a1e" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.02, -0.81]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.03, 24]} />
          <meshStandardMaterial color="#3a4a6a" metalness={0.8} roughness={0.1} />
        </mesh>
        {/* Back screen */}
        <mesh position={[0.05, -0.03, 0.315]}>
          <planeGeometry args={[0.9, 0.6]} />
          <meshBasicMaterial map={lcd} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

export function Stations() {
  return (
    <>
      <Laptop />
      <Desk />
      <Psp />
      <PhotoCamera />
    </>
  );
}
