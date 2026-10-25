import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier';
import { ExtrudeGeometry, Mesh, MeshStandardMaterial, Shape } from 'three';
import { PROPS } from '../layout';
import { canvasTexture, DISPLAY_FONT } from '../textures';

/** A cosy cottage with a round-topped door; walk up to it to step into my room. */
export function Cottage() {
  const smoke = useRef<Mesh[]>([]);
  const smokeMaterials = useMemo(() => [0, 1, 2, 3].map(() => new MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false })), []);
  const roof = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-3.2, 0);
    shape.lineTo(3.2, 0);
    shape.lineTo(0, 2.3);
    shape.closePath();
    const g = new ExtrudeGeometry(shape, { depth: 5, bevelEnabled: false });
    g.translate(0, 0, -2.5);
    return g;
  }, []);
  const door = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.6, 0);
    shape.lineTo(0.6, 0);
    shape.lineTo(0.6, 1.5);
    shape.absarc(0, 1.5, 0.6, 0, Math.PI, false);
    shape.closePath();
    return new ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
  }, []);
  const plaque = useMemo(
    () =>
      canvasTexture(256, 96, (ctx, w, h) => {
        ctx.fillStyle = '#fffaee';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#5a3d27';
        ctx.font = `600 46px ${DISPLAY_FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('My room', w / 2, h / 2 + 3);
      }),
    []
  );

  useFrame((state) => {
    smoke.current.forEach((m, i) => {
      if (!m) return;
      const k = (state.clock.elapsedTime * 0.18 + i / 4) % 1;
      m.position.set(Math.sin(k * 5 + i) * 0.3 + k * 0.6, k * 2.6, 0);
      m.scale.setScalar(0.25 + k * 0.5);
      (m.material as MeshStandardMaterial).opacity = (1 - k) * 0.55;
    });
  });

  const { x, z } = PROPS.cottage;
  const wall = '#fbefd9';
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.8, 2.2, 2.2]} position={[0, 2.2, 0]} />
        <CylinderCollider args={[0.6, 0.15]} position={[3.6, 0.6, 3.4]} />
      </RigidBody>
      {/* Walls and a stone base */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.8, 0.4, 4.6]} />
        <meshStandardMaterial color="#b4ac9d" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.9, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.4, 3.0, 4.2]} />
        <meshStandardMaterial color={wall} roughness={0.85} />
      </mesh>
      {/* Timber trim at the corners */}
      {[-1, 1].flatMap((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`${sx}${sz}`} position={[sx * 2.68, 1.9, sz * 2.08]} castShadow>
            <boxGeometry args={[0.16, 3.0, 0.16]} />
            <meshStandardMaterial color="#8a5a36" roughness={0.8} />
          </mesh>
        ))
      )}
      {/* Roof */}
      <mesh geometry={roof} position={[0, 3.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#d9644a" roughness={0.7} flatShading />
      </mesh>
      {/* Chimney with smoke */}
      <group position={[1.6, 4.4, -0.8]}>
        <mesh castShadow>
          <boxGeometry args={[0.6, 1.6, 0.6]} />
          <meshStandardMaterial color="#b4ac9d" roughness={0.9} />
        </mesh>
        <group position={[0, 0.9, 0]} userData={{ dynamic: true }}>
          {smokeMaterials.map((m, i) => (
            <mesh key={i} ref={(el) => void (smoke.current[i] = el!)} material={m}>
              <sphereGeometry args={[1, 10, 8]} />
            </mesh>
          ))}
        </group>
      </group>
      {/* Door, knob, step and mat */}
      <mesh geometry={door} position={[0, 0.4, 2.1]} castShadow>
        <meshStandardMaterial color="#a8774c" roughness={0.6} />
      </mesh>
      <mesh position={[0.4, 1.3, 2.2]}>
        <sphereGeometry args={[0.07, 10, 8]} />
        <meshStandardMaterial color="#d9a441" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.05, 2.75]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[1.5, 0.8]} />
        <meshStandardMaterial color="#d9644a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.75, 2.12]}>
        <planeGeometry args={[1.1, 0.4]} />
        <meshStandardMaterial map={plaque} roughness={0.7} />
      </mesh>
      {/* Two glowing windows with flower boxes */}
      {[-1.75, 1.75].map((wx) => (
        <group key={wx} position={[wx, 2.0, 2.11]}>
          <mesh>
            <boxGeometry args={[1.1, 1.0, 0.06]} />
            <meshStandardMaterial color="#fffaee" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0, 0.035]}>
            <planeGeometry args={[0.9, 0.8]} />
            <meshBasicMaterial color="#ffe3a3" toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.06, 0.8, 0.02]} />
            <meshStandardMaterial color="#fffaee" />
          </mesh>
          <mesh position={[0, 0, 0.04]}>
            <boxGeometry args={[0.9, 0.06, 0.02]} />
            <meshStandardMaterial color="#fffaee" />
          </mesh>
          <mesh position={[0, -0.62, 0.15]} castShadow>
            <boxGeometry args={[1.2, 0.24, 0.3]} />
            <meshStandardMaterial color="#8a5a36" roughness={0.8} />
          </mesh>
          {[-0.4, -0.15, 0.1, 0.35].map((fx, i) => (
            <mesh key={fx} position={[fx, -0.42, 0.16]}>
              <icosahedronGeometry args={[0.1, 0]} />
              <meshStandardMaterial color={['#ff8a7a', '#ffe27a', '#ff9ec3', '#fffaee'][i]} flatShading />
            </mesh>
          ))}
        </group>
      ))}
      {/* Mailbox by the path */}
      <group position={[3.6, 0, 3.4]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.12, 1.2, 0.12]} />
          <meshStandardMaterial color="#8a5a36" />
        </mesh>
        <mesh position={[0, 1.32, 0]} castShadow>
          <boxGeometry args={[0.4, 0.34, 0.6]} />
          <meshStandardMaterial color="#7cc8e4" roughness={0.5} />
        </mesh>
        <mesh position={[0.22, 1.42, 0.1]} rotation={[0, 0, -0.3]}>
          <boxGeometry args={[0.03, 0.26, 0.06]} />
          <meshStandardMaterial color="#ff6b5b" />
        </mesh>
      </group>
    </group>
  );
}
