import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { FontLoader, type FontData } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { StaticBatch } from '../env/batch';
import { bodies } from '../store';
import { canvasTexture, DISPLAY_FONT, FONT } from '../textures';
import { PALETTE, PROPS, stationById, type StationId } from '../layout';

/** Giant name letters behind the goal; knock them over with a wild shot. */
function NameLetters() {
  const letters = useMemo(() => {
    const font = new FontLoader().parse(fontJson as unknown as FontData);
    const glyphs = 'AADHAV'.split('').map((char) => {
      const geometry = new TextGeometry(char, {
        font,
        size: 2.4,
        depth: 0.7,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.07,
        bevelSize: 0.05,
        bevelSegments: 2
      });
      geometry.computeBoundingBox();
      const box = geometry.boundingBox!;
      geometry.translate(-(box.min.x + box.max.x) / 2, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
      return { geometry, width: box.max.x - box.min.x, height: box.max.y - box.min.y };
    });
    const gap = 0.35;
    let x = -(glyphs.reduce((sum, g) => sum + g.width, 0) + gap * (glyphs.length - 1)) / 2;
    return glyphs.map((g, i) => {
      const cx = x + g.width / 2;
      x += g.width + gap;
      return { ...g, x: cx, color: PALETTE[i % PALETTE.length] };
    });
  }, []);

  // Stand them back up once you've wandered off.
  const bodiesRef = useRef<(RapierRigidBody | null)[]>([]);
  const check = useRef(0);
  useFrame((state) => {
    if (state.clock.elapsedTime < check.current) return;
    check.current = state.clock.elapsedTime + 1;
    const p = bodies.player?.translation();
    if (!p || Math.hypot(p.x - PROPS.letters.x, p.z - PROPS.letters.z) < 28) return;
    letters.forEach((l, i) => {
      const rb = bodiesRef.current[i];
      if (!rb) return;
      const home = { x: PROPS.letters.x + l.x, y: l.height / 2 + 0.01, z: PROPS.letters.z };
      const t = rb.translation();
      if (Math.hypot(t.x - home.x, t.y - home.y, t.z - home.z) < 0.2) return;
      rb.setTranslation(home, false);
      rb.setRotation({ x: 0, y: 0, z: 0, w: 1 }, false);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
      rb.sleep();
    });
  });

  return (
    <>
      {letters.map((l, i) => (
        <RigidBody key={i} ref={(rb) => void (bodiesRef.current[i] = rb)} colliders="cuboid" position={[PROPS.letters.x + l.x, l.height / 2 + 0.01, PROPS.letters.z]} mass={12} friction={0.8}>
          <mesh geometry={l.geometry} castShadow receiveShadow>
            <meshStandardMaterial color={l.color} roughness={0.45} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

/** Wooden signpost pointing to the classic site. */
function ClassicSign() {
  const label = useMemo(
    () =>
      canvasTexture(1024, 256, (ctx, w, h) => {
        ctx.fillStyle = '#f4ead8';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3b2a1c';
        ctx.font = `900 112px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CLASSIC SITE', w / 2 - 50, h / 2 + 6);
        // A drawn arrow rather than a text glyph.
        const ax = w / 2 + 330;
        const ay = h / 2;
        ctx.lineWidth = 16;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#3b2a1c';
        ctx.beginPath();
        ctx.moveTo(ax - 70, ay);
        ctx.lineTo(ax + 40, ay);
        ctx.moveTo(ax, ay - 38);
        ctx.lineTo(ax + 40, ay);
        ctx.lineTo(ax, ay + 38);
        ctx.stroke();
      }),
    []
  );
  const { x, z } = PROPS.classicSign;
  return (
    <group position={[x, 0, z]} rotation={[0, -0.35, 0]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.15, 1.3, 0.15]} position={[0, 1.3, 0]} />
      </RigidBody>
      <mesh position={[0, 1.3, 0]} castShadow>
        <boxGeometry args={[0.2, 2.6, 0.2]} />
        <meshLambertMaterial color="#7a5235" />
      </mesh>
      <mesh position={[0.9, 2.15, 0.12]} castShadow>
        <boxGeometry args={[2.4, 0.6, 0.1]} />
        <meshLambertMaterial color="#9a6b47" />
      </mesh>
      <mesh position={[0.9, 2.15, 0.175]}>
        <planeGeometry args={[2.25, 0.5]} />
        <meshLambertMaterial map={label} />
      </mesh>
    </group>
  );
}

const POINTERS: { id: StationId; text: string }[] = [
  { id: 'stall-0', text: 'Projects' },
  { id: 'arcade', text: 'Arcade' },
  { id: 'globe', text: 'Travels' },
  { id: 'room', text: 'My room' }
];

/** A wooden signpost by the spawn point, one arrow plank per place. */
function Signpost() {
  const planks = useMemo(() => {
    const { x, z } = PROPS.signpost;
    return POINTERS.map(({ id, text }, i) => {
      const s = stationById[id];
      const label = canvasTexture(512, 128, (ctx, w, h) => {
        ctx.fillStyle = '#f6e7c8';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(62, h / 2, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5a4030';
        ctx.font = `600 70px ${DISPLAY_FONT}`;
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 112, h / 2 + 4);
      });
      return { label, yaw: Math.atan2(-(s.z - z), s.x - x), y: 2.25 - i * 0.42, color: s.color };
    });
  }, []);
  const { x, z } = PROPS.signpost;
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.12, 1.3, 0.12]} position={[0, 1.3, 0]} />
      </RigidBody>
      <mesh position={[0, 1.3, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.11, 2.6, 8]} />
        <meshLambertMaterial color="#8a5d3b" />
      </mesh>
      <mesh position={[0, 2.62, 0]} castShadow>
        <coneGeometry args={[0.16, 0.2, 8]} />
        <meshLambertMaterial color="#e9775a" />
      </mesh>
      {planks.map((p, i) => (
        <group key={i} position={[0, p.y, 0]} rotation={[0, p.yaw, 0]}>
          <mesh position={[0.72, 0, 0]} castShadow>
            <boxGeometry args={[1.2, 0.34, 0.07]} />
            <meshLambertMaterial color="#c99a68" />
          </mesh>
          {/* Arrow tip */}
          <mesh position={[1.32, 0, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
            <boxGeometry args={[0.24, 0.24, 0.07]} />
            <meshLambertMaterial color="#c99a68" />
          </mesh>
          <mesh position={[0.72, 0, 0.037]}>
            <planeGeometry args={[1.1, 0.27]} />
            <meshLambertMaterial map={p.label} />
          </mesh>
          <mesh position={[0.72, 0, -0.037]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[1.1, 0.27]} />
            <meshLambertMaterial map={p.label} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function Landmarks() {
  return (
    <>
      <NameLetters />
      <StaticBatch>
        <ClassicSign />
        <Signpost />
      </StaticBatch>
    </>
  );
}
