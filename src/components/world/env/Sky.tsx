import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Group, IcosahedronGeometry, Mesh, MeshLambertMaterial, ShaderMaterial } from 'three';
import { mergeParts, type Part } from './merge';
import { GOLDEN, seeded, SUN_DIR } from './palette';

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uSky;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform vec3 uSunGlow;
  uniform vec3 uSunDir;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    float toSun = max(dot(d, uSunDir), 0.0);
    // Warmer horizon on the sun's side of the sky.
    vec3 horizon = mix(uHorizon * 0.92, uHorizon, pow(toSun, 2.0));
    vec3 col = mix(horizon, uSky, smoothstep(0.0, 0.22, h));
    col = mix(col, uZenith, smoothstep(0.18, 0.85, h));
    col = mix(col, horizon, smoothstep(0.0, -0.15, h));
    col += uSunGlow * pow(toSun, 6.0) * 0.45;
    col += uSun * smoothstep(0.9975, 0.9992, toSun) * 1.6;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Gradient sky dome with a low sun, always centred on the camera. */
export function Sky() {
  const mesh = useRef<Mesh>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
        side: BackSide,
        depthWrite: false,
        uniforms: {
          uZenith: { value: GOLDEN.zenith },
          uSky: { value: GOLDEN.sky },
          uHorizon: { value: GOLDEN.horizon },
          uSun: { value: GOLDEN.sun },
          uSunGlow: { value: GOLDEN.sunGlow },
          uSunDir: { value: SUN_DIR }
        }
      }),
    []
  );

  useFrame(({ camera }) => {
    mesh.current?.position.copy(camera.position);
  });

  return (
    <>
      <mesh ref={mesh} material={material} renderOrder={-1} frustumCulled={false}>
        <sphereGeometry args={[200, 32, 16]} />
      </mesh>
      <Clouds />
    </>
  );
}

/** Puffy low-poly clouds drifting slowly around the horizon, lit pink from below by the sun. */
function Clouds() {
  const group = useRef<Group>(null);
  const clouds = useMemo(() => {
    const rand = seeded(404);
    return Array.from({ length: 11 }, (_, i) => {
      const a = (i / 11) * Math.PI * 2 + rand() * 0.4;
      return {
        a,
        r: 150 + rand() * 40,
        y: 30 + rand() * 26,
        s: 6 + rand() * 5,
        blobs: Array.from({ length: 4 + Math.floor(rand() * 3) }, (_, j) => ({
          x: (j - 2) * 1.3 + (rand() - 0.5),
          y: rand() * 0.8,
          z: (rand() - 0.5) * 1.2,
          s: 0.9 + rand() * 0.8
        }))
      };
    });
  }, []);
  const geometry = useMemo(() => {
    const blob = new IcosahedronGeometry(1, 1);
    const parts: Part[] = [];
    for (const c of clouds) {
      const cx = Math.cos(c.a) * c.r;
      const cz = Math.sin(c.a) * c.r;
      const ry = -c.a + Math.PI / 2;
      for (const b of c.blobs) {
        // The blob's offset, scaled and turned with its cloud.
        const ox = b.x * c.s;
        const oz = b.z * c.s;
        parts.push({
          geometry: blob,
          position: [cx + ox * Math.cos(ry) + oz * Math.sin(ry), c.y + b.y * c.s, cz - ox * Math.sin(ry) + oz * Math.cos(ry)],
          rotation: [0, ry, 0],
          scale: [b.s * c.s, b.s * 0.7 * c.s, b.s * c.s]
        });
      }
    }
    return mergeParts(parts);
  }, [clouds]);
  const material = useMemo(() => new MeshLambertMaterial({ color: '#ffffff', emissive: '#ffd6c4', emissiveIntensity: 0.3, flatShading: true, fog: false }), []);

  useFrame((state) => {
    if (group.current) group.current.rotation.y = state.clock.elapsedTime * 0.004;
  });

  return (
    <group ref={group} position={[0, 0, -16]}>
      <mesh geometry={geometry} material={material} frustumCulled={false} />
    </group>
  );
}
