import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  Color,
  ConeGeometry,
  DodecahedronGeometry,
  InstancedMesh,
  Object3D,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2
} from 'three';
import { POND } from '../layout';
import { GOLDEN, seeded, SUN_DIR } from './palette';

const vertexShader = /* glsl */ `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorld = worldPosition.xyz;
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform vec2 uCenter;
  uniform vec2 uRadii;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  void main() {
    float r = length((vWorld.xz - uCenter) / uRadii);
    float n1 = sin(vWorld.x * 1.3 + uTime * 1.1) * sin(vWorld.z * 1.7 - uTime * 0.9);
    float n2 = sin(vWorld.x * 3.1 - uTime * 1.7 + vWorld.z * 2.3);
    vec3 normal = normalize(vec3(n1 * 0.07 + n2 * 0.035, 1.0, n2 * 0.05 - n1 * 0.045));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
    vec3 col = mix(uDeep, uShallow, smoothstep(0.35, 1.0, r));
    col = mix(col, uSky, 0.06 + fresnel * 0.45);
    vec3 halfway = normalize(uSunDir + viewDir);
    col += uSun * pow(max(dot(normal, halfway), 0.0), 140.0) * 1.8;
    col += uSun * pow(max(dot(normal, halfway), 0.0), 18.0) * 0.12;
    col = mix(col, vec3(1.0, 0.94, 0.82), smoothstep(0.9, 0.99, r) * 0.35);
    gl_FragColor = vec4(col, (1.0 - smoothstep(0.97, 1.0, r)) * 0.97);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

const RING = 30;

function ringPoint(i: number, scale: number): [number, number] {
  const a = (i / RING) * Math.PI * 2;
  return [POND.x + Math.cos(a) * POND.rx * scale, POND.z + Math.sin(a) * POND.rz * scale];
}

function Rocks() {
  const ref = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const rand = seeded(5);
    const list: { x: number; z: number; s: number; r: number }[] = [];
    for (let i = 0; i < RING * 2; i++) {
      const [x, z] = ringPoint(i / 2 + rand() * 0.3, 1.05 + rand() * 0.06);
      list.push({ x, z, s: 0.35 + rand() * 0.45, r: rand() * 6 });
    }
    return list;
  }, []);
  const geometry = useMemo(() => new DodecahedronGeometry(1, 0), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    const c = new Color();
    items.forEach((it, i) => {
      o.position.set(it.x, it.s * 0.25, it.z);
      o.rotation.set(it.r, it.r * 2, 0);
      o.scale.set(it.s, it.s * 0.65, it.s * 0.9);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      mesh.setColorAt(i, c.set('#b8ad9c').offsetHSL(0, 0, (it.r % 1) * 0.12 - 0.06));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow receiveShadow>
      <meshLambertMaterial flatShading />
    </instancedMesh>
  );
}

function Reeds() {
  const ref = useRef<InstancedMesh>(null);
  const items = useMemo(() => {
    const rand = seeded(17);
    const list: { x: number; z: number; h: number; tx: number; tz: number }[] = [];
    // Clumps on the south-west and east banks.
    for (const [from, to] of [[0.38, 0.62], [0.9, 1.1]]) {
      for (let i = 0; i < 70; i++) {
        const t = from + rand() * (to - from);
        const [x, z] = ringPoint(t * RING, 0.9 + rand() * 0.14);
        list.push({ x, z, h: 0.7 + rand() * 0.8, tx: (rand() - 0.5) * 0.3, tz: (rand() - 0.5) * 0.3 });
      }
    }
    return list;
  }, []);
  const geometry = useMemo(() => new ConeGeometry(0.035, 1, 4).translate(0, 0.5, 0), []);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new Object3D();
    items.forEach((it, i) => {
      o.position.set(it.x, -0.1, it.z);
      o.rotation.set(it.tx, 0, it.tz);
      o.scale.set(1, it.h, 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]}>
      <meshLambertMaterial color="#6f8a3a" />
    </instancedMesh>
  );
}

function LilyPads() {
  const pads = useMemo(() => {
    const rand = seeded(23);
    return Array.from({ length: 9 }, () => {
      const a = rand() * Math.PI * 2;
      const r = 0.35 + rand() * 0.45;
      return { x: POND.x + Math.cos(a) * POND.rx * r, z: POND.z + Math.sin(a) * POND.rz * r, s: 0.35 + rand() * 0.3, rot: rand() * 6, flower: rand() > 0.6 };
    });
  }, []);
  return (
    <>
      {pads.map((p, i) => (
        <group key={i} position={[p.x, -0.05, p.z]} rotation={[0, p.rot, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={p.s}>
            <circleGeometry args={[1, 14, 0.3, Math.PI * 2 - 0.6]} />
            <meshLambertMaterial color="#5e8f3a" />
          </mesh>
          {p.flower && (
            <mesh position={[0.15, 0.08, 0.1]} scale={0.14}>
              <icosahedronGeometry args={[1, 0]} />
              <meshLambertMaterial color="#ffd1dc" flatShading />
            </mesh>
          )}
        </group>
      ))}
    </>
  );
}

/** The pond: shimmering water, a rocky shore (which keeps the player out), reeds and lily pads. */
export function Pond() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        fog: true,
        uniforms: UniformsUtils.merge([
          UniformsLib.fog,
          {
            uTime: { value: 0 },
            uDeep: { value: new Color('#1f4f63') },
            uShallow: { value: new Color('#4f8f8a') },
            uSky: { value: GOLDEN.sky.clone().lerp(GOLDEN.horizon, 0.5) },
            uSun: { value: GOLDEN.sun },
            uSunDir: { value: SUN_DIR },
            uCenter: { value: new Vector2(POND.x, POND.z) },
            uRadii: { value: new Vector2(POND.rx, POND.rz) }
          }
        ])
      }),
    []
  );

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const walls = useMemo(
    () =>
      Array.from({ length: RING }, (_, i) => {
        const [x1, z1] = ringPoint(i, 1.1);
        const [x2, z2] = ringPoint(i + 1, 1.1);
        return { x: (x1 + x2) / 2, z: (z1 + z2) / 2, len: Math.hypot(x2 - x1, z2 - z1), angle: Math.atan2(z2 - z1, x2 - x1) };
      }),
    []
  );

  return (
    <>
      <mesh material={material} position={[POND.x, -0.08, POND.z]} rotation={[-Math.PI / 2, 0, 0]} scale={[POND.rx, POND.rz, 1]}>
        <circleGeometry args={[1, 72]} />
      </mesh>
      <Rocks />
      <Reeds />
      <LilyPads />
      <RigidBody type="fixed" colliders={false}>
        {walls.map((w, i) => (
          <CuboidCollider key={i} args={[w.len / 2 + 0.1, 0.5, 0.25]} position={[w.x, 0.5, w.z]} rotation={[0, -w.angle, 0]} />
        ))}
      </RigidBody>
    </>
  );
}
