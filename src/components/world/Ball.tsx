import { useEffect, useMemo, useRef } from 'react';
import { BallCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier';
import { BufferAttribute, GreaterDepth, IcosahedronGeometry, MathUtils, Vector3 } from 'three';
import { bodies } from './store';
import { BALL_SPAWN } from './layout';

export const BALL_RADIUS = 0.25;
export const BALL_MASS = 0.45;

/** Classic black-and-white ball: faces near the 12 icosahedron vertices become the black pentagons. */
function makeBallGeometry(radius: number) {
  const geometry = new IcosahedronGeometry(radius, 9);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const t = (1 + Math.sqrt(5)) / 2;
  const centres = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]
  ].map(([x, y, z]) => new Vector3(x, y, z).normalize());
  const threshold = Math.cos(MathUtils.degToRad(18.5));
  const centroid = new Vector3();
  const v = new Vector3();

  for (let i = 0; i < position.count; i += 3) {
    centroid.set(0, 0, 0);
    for (let j = 0; j < 3; j++) centroid.add(v.fromBufferAttribute(position, i + j));
    centroid.normalize();
    const nearest = Math.max(...centres.map((c) => centroid.dot(c)));
    const shade = nearest > threshold ? 0.05 : 0.92;
    for (let j = 0; j < 3; j++) colors.set([shade, shade, shade * 0.98], (i + j) * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

export function Ball() {
  const body = useRef<RapierRigidBody>(null);
  const geometry = useMemo(() => makeBallGeometry(BALL_RADIUS), []);

  useEffect(() => {
    bodies.ball = body.current;
    return () => {
      bodies.ball = null;
    };
  }, []);

  return (
    <RigidBody
      ref={body}
      position={[BALL_SPAWN.x, 0.6, BALL_SPAWN.z]}
      colliders={false}
      ccd
      canSleep={false}
      linearDamping={0.55}
      angularDamping={0.6}
    >
      <BallCollider args={[BALL_RADIUS]} mass={BALL_MASS} restitution={0.65} friction={0.8} />
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial vertexColors roughness={0.45} />
      </mesh>
      {/* X-ray outline: only drawn where something (usually the player) hides the ball. */}
      <mesh geometry={geometry} renderOrder={10}>
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.35}
          depthWrite={false}
          depthFunc={GreaterDepth}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-4}
          toneMapped={false}
        />
      </mesh>
    </RigidBody>
  );
}
