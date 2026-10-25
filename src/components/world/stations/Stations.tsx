import { useEffect, useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { experience, projects } from '../../../data/portfolio';
import { canvasTexture, loadImage } from '../textures';
import { LID_TILT, PROPS } from '../layout';
import { world } from '../store';
import { ALUMINIUM, DARK, useScreen, WOOD } from './common';
import { PhotoCamera, Psp } from './Gadgets';
import { drawExperience, drawProject } from './screens';

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
