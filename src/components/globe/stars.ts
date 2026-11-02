// Procedural twinkling starfield (no textures).
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, ShaderMaterial } from 'three';

export function createStars(count: number, pixelRatio: number) {
  const pos = new Float32Array(count * 3);
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // Uniform direction on a sphere, radius 30–60.
    const u = Math.random() * 2 - 1;
    const a = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = 30 + Math.random() * 30;
    pos[i * 3] = r * s * Math.cos(a);
    pos[i * 3 + 1] = r * u;
    pos[i * 3 + 2] = r * s * Math.sin(a);
    size[i] = Math.random() < 0.06 ? 2.6 + Math.random() * 1.6 : 0.8 + Math.random() * 1.3;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('size', new Float32BufferAttribute(size, 1));
  geo.setAttribute('phase', new Float32BufferAttribute(phase, 1));

  const material = new ShaderMaterial({
    uniforms: { time: { value: 0 }, pixelRatio: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute float size;
      attribute float phase;
      uniform float time;
      uniform float pixelRatio;
      varying float vAlpha;
      void main() {
        vAlpha = 0.55 + 0.45 * sin(time * (0.6 + fract(phase) * 1.4) + phase);
        gl_PointSize = size * pixelRatio;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.82, 0.88, 1.0), a * vAlpha * 0.9);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geo, material);
  return {
    points,
    update(time: number) {
      material.uniforms.time.value = time;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
