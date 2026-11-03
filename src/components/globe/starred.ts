// Markers for places lived in / visited many times (Manifest.starred, "home bases").
// A crisp white dot with a fine ring and a slow ripple spreading out from it — the same icy
// white / blue and thin-line language as the borders, outlines and pulse rings.
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Points, ShaderMaterial, Vector3, type PerspectiveCamera } from 'three';
import { findRegionAt, latLngToVector3, type World } from '../../lib/geo';
import type { StarredPlace } from '../../data/travel';
import { ALTITUDE } from './countries';

const RADIUS = 1 + ALTITUDE + 0.002; // on top of the raised countries
const SIZE = 38; // sprite size in CSS px; the dot and ring sit in the middle third, the ripple uses the rest

export interface StarHit {
  /** Position in the starred list (stable for this layer). */
  index: number;
  place: StarredPlace;
  /** Country or US state the marker is in, if any. */
  regionId: string | null;
}

export interface StarredLayer {
  group: Points;
  pick(clientX: number, clientY: number, rect: DOMRect, camera: PerspectiveCamera): StarHit | null;
  setHover(index: number | null): void;
  update(time: number, camera: PerspectiveCamera, defaultDistance: number, reducedMotion: boolean): void;
  dispose(): void;
}

const vertex = /* glsl */ `
  attribute float idx;
  attribute float phase;
  uniform float size;
  uniform float hoverIndex;
  varying float vHover;
  varying float vFade;
  varying float vPhase;
  void main() {
    vPhase = phase;
    vHover = 1.0 - step(0.5, abs(idx - hoverIndex));
    vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
    // Drawn without depth testing (so a raised country can't clip it); hide it on the far side ourselves.
    float facing = dot(normalize(world), normalize(cameraPosition - world));
    vFade = smoothstep(0.0, 0.2, facing);
    gl_PointSize = facing > 0.0 ? size : 0.0;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 core;
  uniform vec3 tint;
  uniform float time;
  uniform float motion;
  varying float vHover;
  varying float vFade;
  varying float vPhase;
  float band(float d, float r, float w) {
    return smoothstep(w, 0.0, abs(d - r));
  }
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;  // 0 centre .. 1 edge
    float grow = 1.0 + 0.18 * vHover;
    float dotR = 0.13 * grow;
    float centre = smoothstep(dotR + 0.035, dotR - 0.02, d);
    float ring = band(d, 0.3 * grow, 0.035) * (0.75 + 0.25 * vHover);
    float halo = exp(-d * d * 22.0) * 0.45;
    // A ripple that spreads out from the ring and fades, every few seconds.
    float t = fract(time * 0.32 * motion + vPhase);
    float ripple = band(d, 0.3 + t * 0.66, 0.03) * (1.0 - t) * (1.0 - t) * 0.8 * motion;
    float a = clamp(centre + ring + halo + ripple, 0.0, 1.0) * vFade;
    if (a < 0.003) discard;
    vec3 col = mix(tint, core, clamp(centre + 0.4 * ring, 0.0, 1.0));
    gl_FragColor = vec4(col, a);
  }
`;

export function createStarredLayer(world: World, places: StarredPlace[], pixelRatio: number): StarredLayer {
  const positions = places.map((s) => new Vector3(...latLngToVector3(s.lat, s.lng, RADIUS)));
  const regions = places.map((s) => findRegionAt(world, s.lat, s.lng)?.id ?? null);

  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(positions.flatMap((v) => [v.x, v.y, v.z]), 3));
  geo.setAttribute('idx', new Float32BufferAttribute(places.map((_, i) => i), 1));
  geo.setAttribute('phase', new Float32BufferAttribute(places.map((_, i) => (i * 0.37) % 1), 1));

  const material = new ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      size: { value: SIZE * pixelRatio },
      hoverIndex: { value: -1 },
      time: { value: 0 },
      motion: { value: 1 },
      core: { value: new Color('#ffffff') },
      tint: { value: new Color('#8fd3ff') }, // same family as the border glow
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geo, material);
  points.renderOrder = 10;
  points.visible = places.length > 0;

  const tmp = new Vector3();
  const toCam = new Vector3();

  return {
    group: points,
    pick(clientX, clientY, rect, camera) {
      let best: { i: number; dist: number } | null = null;
      positions.forEach((pos, i) => {
        toCam.copy(camera.position).sub(pos);
        if (tmp.copy(pos).normalize().dot(toCam) <= 0) return; // far side of the globe
        tmp.copy(pos).project(camera);
        if (tmp.z > 1) return;
        const sx = rect.left + ((tmp.x + 1) / 2) * rect.width;
        const sy = rect.top + ((1 - tmp.y) / 2) * rect.height;
        const dist = Math.hypot(sx - clientX, sy - clientY);
        if (dist <= 13 && (!best || dist < best.dist)) best = { i, dist };
      });
      if (!best) return null;
      const i = (best as { i: number }).i;
      return { index: i, place: places[i], regionId: regions[i] };
    },
    setHover(i) {
      material.uniforms.hoverIndex.value = i ?? -1;
    },
    update(time, _camera, _defaultDistance, reducedMotion) {
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
