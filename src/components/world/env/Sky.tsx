import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Mesh, ShaderMaterial } from 'three';
import { GOLDEN, SUN_DIR } from './palette';

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
    <mesh ref={mesh} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[200, 32, 16]} />
    </mesh>
  );
}
