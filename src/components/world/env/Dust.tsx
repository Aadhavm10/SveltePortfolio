import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BufferAttribute, BufferGeometry, ShaderMaterial, Vector2 } from 'three';
import { bodies } from '../store';
import { seeded } from './palette';

const AREA = 46;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uCenter;
  uniform float uArea;
  uniform float uPixelRatio;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.x += sin(uTime * 0.17 + aSeed * 6.28) * 1.5 + uTime * 0.25;
    p.z += cos(uTime * 0.13 + aSeed * 3.1) * 1.5;
    p.y += sin(uTime * 0.4 + aSeed * 12.0) * 0.35;
    p.xz = p.xz + uArea * floor((uCenter - p.xz) / uArea + 0.5);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.0 + aSeed * 3.0) * uPixelRatio * (24.0 / -mv.z);
    vAlpha = (0.35 + 0.65 * (sin(uTime * (0.8 + aSeed) + aSeed * 40.0) * 0.5 + 0.5)) * smoothstep(60.0, 20.0, -mv.z);
  }
`;

const fragmentShader = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    gl_FragColor = vec4(1.0, 0.86, 0.6, a * 0.75);
  }
`;

/** Specks of dust catching the low sun, drifting around the player. */
export function Dust() {
  const { geometry, material } = useMemo(() => {
    const rand = seeded(11);
    const count = 420;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rand() * AREA;
      positions[i * 3 + 1] = 0.4 + rand() * 4.5;
      positions[i * 3 + 2] = rand() * AREA;
      seeds[i] = rand();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new Vector2() },
        uArea: { value: AREA },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }
      }
    });
    return { geometry, material };
  }, []);

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime;
    const p = bodies.player?.translation();
    if (p) material.uniforms.uCenter.value.set(p.x, p.z - 6);
  });

  return <points geometry={geometry} material={material} frustumCulled={false} />;
}
