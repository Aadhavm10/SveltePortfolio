import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { MathUtils, Mesh, MeshBasicMaterial } from 'three';
import { canvasTexture, drawContain, drawCover, FONT, loadImage, wrapText } from './textures';
import { world } from './store';
import { PaintedText } from './Spawn';
import {
  aboutZone,
  ABOUT_AREA,
  CLASSIC_GATE,
  classicZone,
  LIFE_AREA,
  lifePhotos,
  lifeZone,
  PROJECT_ROW,
  projectZones,
  type Zone
} from './zones';

const WOOD = '#9a6b47';
const FRAME = '#26262b';

/** Glowing circle on the ground; stand on it and press E to open the zone. */
export function ZonePad({ zone }: { zone: Zone }) {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(() => {
    const map = canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = zone.color;
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 214, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = zone.color;
      ctx.lineWidth = 26;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 228, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
      ctx.shadowBlur = 12;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 96px ${FONT}`;
      ctx.fillText(zone.kind === 'classic' ? 'GO' : 'OPEN', w / 2, h / 2 + 4);
    });
    return new MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false, opacity: 0.75 });
  }, [zone]);

  useFrame((state, delta) => {
    const active = world.get().zone === zone;
    const target = active ? 1.08 : 1 + Math.sin(state.clock.elapsedTime * 3 + zone.x) * 0.03;
    if (mesh.current) mesh.current.scale.setScalar(MathUtils.damp(mesh.current.scale.x, target, 10, delta));
    material.opacity = MathUtils.damp(material.opacity, active ? 1 : 0.75, 10, delta);
  });

  return (
    <mesh ref={mesh} material={material} position={[zone.x, 0.035, zone.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[zone.radius, 48]} />
    </mesh>
  );
}

/** A framed board on two posts, facing the camera (+z). */
function Board({
  x,
  z,
  width,
  height,
  lift,
  draw,
  image,
  rotation = 0
}: {
  x: number;
  z: number;
  width: number;
  height: number;
  lift: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement | null) => void;
  image?: string;
  rotation?: number;
}) {
  const texture = useMemo(() => {
    const px = 1400;
    const tex = canvasTexture(px, Math.round((px * height) / width), (ctx, w, h) => draw(ctx, w, h, null));
    if (image) {
      loadImage(image)
        .then((img) => tex.redraw((ctx, w, h) => draw(ctx, w, h, img)))
        .catch(() => {});
    }
    return tex;
    // The draw function and image are fixed for a board's lifetime.
  }, []);
  const cy = lift + height / 2;
  const postX = width / 2 - 0.6;

  return (
    <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[width / 2 + 0.1, height / 2 + 0.1, 0.15]} position={[0, cy, 0]} />
        <CylinderCollider args={[lift / 2, 0.12]} position={[-postX, lift / 2, 0]} />
        <CylinderCollider args={[lift / 2, 0.12]} position={[postX, lift / 2, 0]} />
      </RigidBody>
      {[-postX, postX].map((px) => (
        <mesh key={px} position={[px, (lift + 0.4) / 2, -0.05]} castShadow>
          <boxGeometry args={[0.22, lift + 0.4, 0.22]} />
          <meshStandardMaterial color={WOOD} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, cy, -0.06]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.24, height + 0.24, 0.16]} />
        <meshStandardMaterial color={FRAME} roughness={0.7} />
      </mesh>
      <mesh position={[0, cy, 0.03]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
    </group>
  );
}

function ProjectBoards() {
  return (
    <>
      {projectZones.map((zone, i) => {
        const project = zone.project!;
        return (
          <group key={zone.id}>
            <Board
              x={zone.x}
              z={PROJECT_ROW.z}
              width={6.4}
              height={4.3}
              lift={1}
              image={project.src}
              draw={(ctx, w, h, img) => {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = zone.color;
                ctx.fillRect(0, 0, w, 22);
                const pad = 48;
                const imgH = h * 0.68;
                ctx.fillStyle = '#f2f2ef';
                ctx.beginPath();
                ctx.roundRect(pad, 62, w - pad * 2, imgH, 24);
                ctx.fill();
                if (img) {
                  ctx.save();
                  ctx.beginPath();
                  ctx.roundRect(pad, 62, w - pad * 2, imgH, 24);
                  ctx.clip();
                  const wide = img.width / img.height > 1.2;
                  (wide ? drawCover : drawContain)(ctx, img, pad, 62, w - pad * 2, imgH);
                  ctx.restore();
                }
                ctx.fillStyle = '#111111';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
                ctx.font = `900 92px ${FONT}`;
                ctx.fillText(project.title, pad, h - 64);
                ctx.textAlign = 'right';
                ctx.fillStyle = zone.color;
                ctx.font = `900 92px ${FONT}`;
                ctx.fillText(String(i + 1).padStart(2, '0'), w - pad, h - 64);
              }}
            />
            <ZonePad zone={zone} />
          </group>
        );
      })}
      <PaintedText
        x={PROJECT_ROW.startX - 7.2}
        z={PROJECT_ROW.z + 1}
        width={6}
        depth={4}
        rotation={0}
        lines={[
          { text: 'MY', size: 120 },
          { text: 'PROJECTS', size: 120 },
          { text: 'stand on a pad', size: 52, weight: 700 }
        ]}
      />
    </>
  );
}

function AboutBoard() {
  return (
    <>
      <Board
        x={ABOUT_AREA.x}
        z={ABOUT_AREA.z}
        width={8}
        height={4.6}
        lift={0.9}
        image="/world/about-soccer.jpg"
        draw={(ctx, w, h, img) => {
          ctx.fillStyle = '#fffdf7';
          ctx.fillRect(0, 0, w, h);
          const pad = 48;
          const photoW = w * 0.36;
          ctx.fillStyle = '#e9e5da';
          ctx.beginPath();
          ctx.roundRect(pad, pad, photoW, h - pad * 2, 28);
          ctx.fill();
          if (img) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(pad, pad, photoW, h - pad * 2, 28);
            ctx.clip();
            drawCover(ctx, img, pad, pad, photoW, h - pad * 2);
            ctx.restore();
          }
          const x = pad * 2 + photoW;
          const maxW = w - x - pad;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = aboutZone.color;
          ctx.font = `800 36px ${FONT}`;
          ctx.fillText('ABOUT ME', x, 110);
          ctx.fillStyle = '#111111';
          ctx.font = `900 88px ${FONT}`;
          ctx.fillText("Hey, I'm Aadhav.", x, 210);
          ctx.fillStyle = '#3a3a3f';
          ctx.font = `500 38px ${FONT}`;
          const body =
            'CS student at UT Dallas building full-stack apps and machine learning models. I sweat the details that make software feel effortless. Off the keyboard, I am usually on a soccer pitch.';
          wrapText(ctx, body, maxW).forEach((line, i) => ctx.fillText(line, x, 290 + i * 54));
          const chips = ['UT Dallas', 'Full-stack + ML', 'Dec 2026 grad'];
          let cx = x;
          ctx.font = `700 30px ${FONT}`;
          for (const chip of chips) {
            const cw = ctx.measureText(chip).width + 44;
            ctx.fillStyle = '#111111';
            ctx.beginPath();
            ctx.roundRect(cx, h - 140, cw, 64, 32);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(chip, cx + 22, h - 96);
            cx += cw + 16;
          }
        }}
      />
      <ZonePad zone={aboutZone} />
    </>
  );
}

function Polaroid({ src, x, z, tilt, facing }: { src: string; x: number; z: number; tilt: number; facing: number }) {
  const texture = useMemo(() => {
    const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, img: HTMLImageElement | null) => {
      ctx.fillStyle = '#fbfaf6';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#d9d5cb';
      ctx.fillRect(28, 28, w - 56, w - 56);
      if (img) drawCover(ctx, img, 28, 28, w - 56, w - 56);
    };
    const tex = canvasTexture(420, 500, (ctx, w, h) => draw(ctx, w, h, null));
    loadImage(src)
      .then((img) => tex.redraw((ctx, w, h) => draw(ctx, w, h, img)))
      .catch(() => {});
    return tex;
  }, [src]);

  return (
    <group position={[x, 0, z]} rotation={[0, facing, 0]}>
      <mesh position={[0, 0.6, -0.04]} castShadow>
        <cylinderGeometry args={[0.05, 0.06, 1.2, 8]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.95, 0]} rotation={[0, 0, tilt]} castShadow>
        <boxGeometry args={[1.5, 1.8, 0.04]} />
        <meshStandardMaterial color="#fbfaf6" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.95, 0.025]} rotation={[0, 0, tilt]}>
        <planeGeometry args={[1.5, 1.8]} />
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
    </group>
  );
}

function LifeGallery() {
  const layout = [
    [-5.2, 1.4], [-3.1, 0.3], [-1, -0.2], [1.1, -0.2], [3.2, 0.3], [5.3, 1.4]
  ];
  return (
    <>
      <RigidBody type="fixed" colliders={false}>
        {layout.map(([dx, dz], i) => (
          <CylinderCollider key={i} args={[1.4, 0.12]} position={[LIFE_AREA.x + dx, 1.4, LIFE_AREA.z + dz]} />
        ))}
      </RigidBody>
      {layout.map(([dx, dz], i) => (
        <Polaroid
          key={lifePhotos[i]}
          src={lifePhotos[i]}
          x={LIFE_AREA.x + dx}
          z={LIFE_AREA.z + dz}
          tilt={((i * 37) % 9 - 4) * 0.015}
          facing={-dx * 0.07}
        />
      ))}
      <PaintedText
        x={LIFE_AREA.x}
        z={LIFE_AREA.z + 2}
        width={7}
        depth={1.2}
        lines={[{ text: 'LIFE IN PHOTOS', size: 100 }]}
      />
      <ZonePad zone={lifeZone} />
    </>
  );
}

function ClassicGate() {
  const sign = useMemo(
    () =>
      canvasTexture(1400, 160, (ctx, w, h) => {
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 112px ${FONT}`;
        ctx.fillText('CLASSIC SITE', w / 2, h / 2 + 6);
      }),
    []
  );
  const { x, z } = CLASSIC_GATE;
  return (
    <>
      <group position={[x, 0, z]}>
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[0.35, 1.6, 0.35]} position={[-3.3, 1.6, 0]} />
          <CuboidCollider args={[0.35, 1.6, 0.35]} position={[3.3, 1.6, 0]} />
        </RigidBody>
        {[-3.3, 3.3].map((px) => (
          <mesh key={px} position={[px, 1.6, 0]} castShadow>
            <boxGeometry args={[0.7, 3.2, 0.7]} />
            <meshStandardMaterial color="#f4efe6" roughness={0.8} />
          </mesh>
        ))}
        <mesh position={[0, 3.55, 0]} castShadow>
          <boxGeometry args={[7.6, 0.8, 0.7]} />
          <meshStandardMaterial color="#26262b" roughness={0.7} />
        </mesh>
        <mesh position={[0, 3.55, 0.36]}>
          <planeGeometry args={[7, 0.8]} />
          <meshStandardMaterial map={sign} transparent roughness={0.7} />
        </mesh>
      </group>
      <ZonePad zone={classicZone} />
    </>
  );
}

export function Areas() {
  return (
    <>
      <ProjectBoards />
      <AboutBoard />
      <LifeGallery />
      <ClassicGate />
    </>
  );
}
