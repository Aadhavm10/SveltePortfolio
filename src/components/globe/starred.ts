// Gold stars for places lived in / visited many times (Manifest.starred).
// Drawn as point sprites with a signed-distance five-point star, a soft glow and an occasional glint.
import { BufferGeometry, Color, Float32BufferAttribute, Points, ShaderMaterial, Vector3, type PerspectiveCamera } from 'three';
import { findRegionAt, latLngToVector3, type World } from '../../lib/geo';
import type { StarredPlace } from '../../data/travel';
import { ALTITUDE } from './countries';

const RADIUS = 1 + ALTITUDE + 0.012; // just above the raised countries
const BASE_SIZE = 40; // sprite size in CSS px at the default zoom (the star itself is about 60% of it)

export interface StarHit {
  place: StarredPlace;
  /** Country or US state the star is in, if any. */
  regionId: string | null;
}

export interface StarredLayer {
  points: Points;
  pick(clientX: number, clientY: number, rect: DOMRect, camera: PerspectiveCamera): StarHit | null;
  setHover(index: number | null): void;
  update(time: number, camera: PerspectiveCamera, defaultDistance: number, reducedMotion: boolean): void;
  dispose(): void;
}

const vertex = /* glsl */ `
  attribute float phase;
  attribute float idx;
  uniform float size;
  uniform float hoverIndex;
  varying float vPhase;
  varying float vHover;
  varying float vFade;
  void main() {
    vPhase = phase;
    vHover = 1.0 - step(0.5, abs(idx - hoverIndex));
    // Stars draw on top (no depth test, so a raised country can't clip them),
    // so hide them ourselves on the far side of the globe and fade them at the edge.
    vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
    float facing = dot(normalize(world), normalize(cameraPosition - world));
    vFade = smoothstep(0.02, 0.22, facing);
    gl_PointSize = facing > 0.02 ? size * (1.0 + 0.3 * vHover) : 0.0;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform float time;
  uniform float motion;
  uniform vec3 gold;
  uniform vec3 deep;
  varying float vPhase;
  varying float vHover;
  varying float vFade;

  // Inigo Quilez's exact SDF for a five-point star (point up).
  float sdStar5(vec2 p, float r, float rf) {
    const vec2 k1 = vec2(0.809016994375, -0.587785252292);
    const vec2 k2 = vec2(-k1.x, k1.y);
    p.x = abs(p.x);
    p -= 2.0 * max(dot(k1, p), 0.0) * k1;
    p -= 2.0 * max(dot(k2, p), 0.0) * k2;
    p.x = abs(p.x);
    p.y -= r;
    vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
    float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
    return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
  }

  void main() {
    vec2 p = (gl_PointCoord - 0.5) * vec2(2.0, -2.0);
    p.y += 0.05; // optical centring
    float d = sdStar5(p, 0.62, 0.47);
    float aa = fwidth(d);
    float fill = 1.0 - smoothstep(-aa, aa, d);
    float r = length(p);

    // Faceted gold: each arm has a lit half and a shaded half, like a cut star.
    float ang = atan(p.x, p.y);
    const float SEG = 1.2566370614; // 72 degrees
    float local = mod(ang + SEG * 0.5, SEG) - SEG * 0.5;
    float facet = mix(0.78, 1.0, smoothstep(-0.03, 0.03, local));
    vec3 body = gold * facet;
    body = mix(body, deep, smoothstep(-0.1, -0.01, d) * 0.5);           // deeper gold at the edges
    body = mix(body, vec3(1.0, 0.97, 0.86), smoothstep(0.2, 0.0, r) * 0.9); // small bright centre

    // Thin dark rim just outside the star so it reads on any colour underneath.
    float rim = (1.0 - smoothstep(0.0, 0.065, d)) * (1.0 - fill);

    float breathe = 0.82 + 0.18 * sin(time * 1.4 * motion + vPhase);
    float glow = exp(-max(d - 0.05, 0.0) * 8.0) * (0.28 + 0.3 * vHover) * breathe * (1.0 - fill) * (1.0 - rim);

    // An occasional four-ray glint, slowly turning.
    float rot = time * 0.25 * motion + vPhase;
    vec2 q = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p;
    float pulse = pow(0.5 + 0.5 * sin(time * 0.9 * motion + vPhase * 3.0), 14.0) * motion * 0.8 + 0.3 * vHover;
    float rays = (exp(-abs(q.x) * 60.0) * exp(-abs(q.y) * 2.6) + exp(-abs(q.y) * 60.0) * exp(-abs(q.x) * 2.6)) * pulse * (1.0 - fill);

    vec3 col = body * fill + vec3(0.09, 0.06, 0.0) * rim + gold * glow + vec3(1.0, 0.96, 0.86) * rays;
    float a = clamp(fill + rim * 0.7 + glow + rays, 0.0, 1.0);
    if (a * vFade < 0.004) discard;
    gl_FragColor = vec4(col / max(a, 0.001), a * vFade);
  }
`;

export function createStarredLayer(world: World, places: StarredPlace[], pixelRatio: number): StarredLayer {
  const positions = places.map((s) => new Vector3(...latLngToVector3(s.lat, s.lng, RADIUS)));
  const regions = places.map((s) => findRegionAt(world, s.lat, s.lng)?.id ?? null);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions.flatMap((v) => [v.x, v.y, v.z]), 3));
  geo.setAttribute('phase', new Float32BufferAttribute(places.map((_, i) => i * 2.399), 1));
  geo.setAttribute('idx', new Float32BufferAttribute(places.map((_, i) => i), 1));

  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      time: { value: 0 },
      motion: { value: 1 },
      size: { value: BASE_SIZE * pixelRatio },
      hoverIndex: { value: -1 },
      gold: { value: new Color('#ffc93c').multiplyScalar(0.92) }, // just under the bloom threshold
      deep: { value: new Color('#c47a00') },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });

  const points = new Points(geo, material);
  points.renderOrder = 10;
  points.visible = places.length > 0;

  let scale = 1;
  const tmp = new Vector3();
  const toCam = new Vector3();

  return {
    points,
    pick(clientX, clientY, rect, camera) {
      const hitRadius = Math.max(12, BASE_SIZE * scale * 0.34);
      let best: { i: number; dist: number } | null = null;
      positions.forEach((pos, i) => {
        // Skip stars on the far side of the globe.
        toCam.copy(camera.position).sub(pos);
        if (tmp.copy(pos).normalize().dot(toCam) <= 0) return;
        tmp.copy(pos).project(camera);
        if (tmp.z > 1) return;
        const sx = rect.left + ((tmp.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - tmp.y) / 2) * rect.height;
        const dist = Math.hypot(sx - clientX, sy - clientY);
        if (dist <= hitRadius && (!best || dist < best.dist)) best = { i, dist };
      });
      if (!best) return null;
      const i = (best as { i: number }).i;
      return { place: places[i], regionId: regions[i] };
    },
    setHover(index) {
      material.uniforms.hoverIndex.value = index ?? -1;
    },
    update(time, camera, defaultDistance, reducedMotion) {
      // Grow a little as you zoom in, so nearby stars (Dallas / Austin) separate.
      scale = Math.min(2, Math.max(0.8, Math.pow(defaultDistance / camera.position.length(), 0.7)));
      material.uniforms.size.value = BASE_SIZE * pixelRatio * scale;
      material.uniforms.time.value = time;
      material.uniforms.motion.value = reducedMotion ? 0 : 1;
    },
    dispose() {
      geo.dispose();
      material.dispose();
      points.removeFromParent();
    },
  };
}
