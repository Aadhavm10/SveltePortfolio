import { useMemo } from 'react';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import { FontLoader, type FontData } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontJson from 'three/examples/fonts/helvetiker_bold.typeface.json';
import { canvasTexture, FONT } from '../textures';
import { PALETTE, PROPS } from '../layout';

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

  return (
    <>
      {letters.map((l, i) => (
        <RigidBody key={i} colliders="cuboid" position={[PROPS.letters.x + l.x, l.height / 2 + 0.01, PROPS.letters.z]} mass={12} friction={0.8}>
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
        ctx.fillText('CLASSIC SITE →', w / 2, h / 2 + 6);
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

export function Landmarks() {
  return (
    <>
      <NameLetters />
      <ClassicSign />
    </>
  );
}
