// Visited countries: raised glowing shapes, outlines, pulse rings, photo pins and travel arcs.
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import ConicPolygonGeometry from 'three-conic-polygon-geometry';
import { geoArea } from 'd3-geo';
import type { Position } from 'geojson';
import { findRegionAt, latLngToVector3, mainlandPolygons, regionFocus, type World } from '../../lib/geo';
import { HOME, type Manifest } from '../../data/travel';
import { linesToPositions } from './globeBody';

export const ALTITUDE = 0.025;
/** Caps stay below the bloom threshold (0.62) even at the top of the pulse; only the white outline blooms. */
const MAX_LUMINANCE = 0.36;
const R0 = 1.0;
const R1 = 1.0 + ALTITUDE;

interface VisitedCountry {
  id: string;
  group: Group;
  cap: Mesh<BufferGeometry, MeshBasicMaterial>;
  side: Mesh<BufferGeometry, MeshBasicMaterial>;
  outline: LineSegments<BufferGeometry, LineBasicMaterial>;
  ring: Mesh<PlaneGeometry, ShaderMaterial>;
  pins: Points<BufferGeometry, ShaderMaterial> | null;
  color: Color;
  focus: { lat: number; lng: number; size: number };
  phase: number;
  hover: number;
  dim: number;
  pinAlpha: number;
}

export interface VisitedLayer {
  group: Group;
  pickables: Object3D[];
  focus(id: string): { lat: number; lng: number; size: number } | null;
  setHover(id: string | null): void;
  setSelected(id: string | null): void;
  update(time: number, dt: number, reducedMotion: boolean): void;
  dispose(): void;
}

/** Drop tiny islands so coastlines don't turn into spiky walls. */
function keptPolygons(polygons: Position[][][]): Position[][][] {
  if (!polygons.length) return [];
  const areas = polygons.map((rings) => geoArea({ type: 'Polygon', coordinates: rings }));
  const min = Math.max(areas[0] * 0.001, 3e-6);
  return polygons.filter((_, i) => i === 0 || areas[i] >= min);
}

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const ringFragment = /* glsl */ `
  uniform float time;
  uniform vec3 color;
  uniform float opacity;
  varying vec2 vUv;
  float ring(float r, float t) { return smoothstep(0.09, 0.0, abs(r - t)) * (1.0 - t); }
  void main() {
    float r = length(vUv * 2.0 - 1.0);
    float t = fract(time * 0.4);
    float a = ring(r, t) + ring(r, fract(t + 0.5));
    gl_FragColor = vec4(color, a * opacity);
  }
`;

const pinVertex = /* glsl */ `
  uniform float size;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size;
    gl_Position = projectionMatrix * mv;
  }
`;
const pinFragment = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = smoothstep(0.22, 0.12, d);
    float halo = smoothstep(0.5, 0.0, d) * 0.55;
    vec3 c = mix(color, vec3(1.0), core);
    gl_FragColor = vec4(c, (core + halo) * opacity);
  }
`;

const arcVertex = /* glsl */ `
  attribute float t;
  varying float vT;
  void main() { vT = t; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const arcFragment = /* glsl */ `
  uniform float time;
  uniform vec3 colorA;
  uniform vec3 colorB;
  uniform float opacity;
  varying float vT;
  void main() {
    float dash = smoothstep(0.35, 0.45, fract(vT * 5.0 - time * 0.3));
    float fade = smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);
    gl_FragColor = vec4(mix(colorA, colorB, vT), dash * fade * opacity);
  }
`;

function buildCountry(
  world: World,
  id: string,
  colorHex: string,
  pinCoords: { lat: number; lng: number }[],
  pixelRatio: number,
  /** Photo and home-base spots in this place: far-off pieces light up only where these are. */
  anchors: { lat: number; lng: number }[] = []
): VisitedCountry | null {
  const country = world.regions.get(id);
  if (!country) return null;
  const polygons = mainlandPolygons(keptPolygons(country.polygons), anchors);

  const caps: BufferGeometry[] = [];
  const sides: BufferGeometry[] = [];
  const outlineRings: Position[][] = [];
  for (const rings of polygons) {
    try {
      const cap = new ConicPolygonGeometry(rings, R0, R1, false, true, false, 3);
      const side = new ConicPolygonGeometry(rings, R0, R1, false, false, true, 3);
      cap.clearGroups();
      side.clearGroups();
      caps.push(cap);
      sides.push(side);
      outlineRings.push(...rings);
    } catch (err) {
      console.warn('Skipping polygon for', id, err);
    }
  }
  if (!caps.length) return null;

  // Even out brightness across palette colours: a light yellow would otherwise be far brighter
  // than red or teal and flare through the bloom when it pulses.
  const color = new Color(colorHex);
  const lum = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b; // linear luminance
  color.multiplyScalar(Math.min(1, MAX_LUMINANCE / Math.max(lum, 1e-4)));
  const group = new Group();
  group.userData.countryId = id;

  const capGeo = mergeGeometries(caps)!;
  const sideGeo = mergeGeometries(sides)!;
  caps.forEach((g) => g.dispose());
  sides.forEach((g) => g.dispose());

  const cap = new Mesh(capGeo, new MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 0.94 }));
  cap.userData.countryId = id;
  cap.renderOrder = 2;
  const side = new Mesh(
    sideGeo,
    new MeshBasicMaterial({ color: color.clone(), transparent: true, opacity: 0.5, side: DoubleSide, depthWrite: false })
  );
  side.userData.countryId = id;
  side.renderOrder = 1;

  const outlineGeo = new BufferGeometry();
  outlineGeo.setAttribute('position', new Float32BufferAttribute(linesToPositions(outlineRings, R1 + 0.0006), 3));
  const outline = new LineSegments(
    outlineGeo,
    new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false })
  );
  outline.renderOrder = 3;

  const focus = regionFocus(country);
  const ringSize = Math.min(0.2, Math.max(0.07, focus.size * 0.55));
  const ring = new Mesh(
    new PlaneGeometry(ringSize, ringSize),
    new ShaderMaterial({
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      uniforms: { time: { value: 0 }, color: { value: color.clone() }, opacity: { value: 0.9 } },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
  );
  const ringPos = new Vector3(...latLngToVector3(focus.lat, focus.lng, R1 + 0.002));
  ring.position.copy(ringPos);
  ring.lookAt(ringPos.clone().multiplyScalar(2));
  ring.renderOrder = 4;

  let pins: VisitedCountry['pins'] = null;
  if (pinCoords.length) {
    const pos: number[] = [];
    for (const p of pinCoords) pos.push(...latLngToVector3(p.lat, p.lng, R1 + 0.004));
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    pins = new Points(
      g,
      new ShaderMaterial({
        vertexShader: pinVertex,
        fragmentShader: pinFragment,
        uniforms: { size: { value: 15 * pixelRatio }, color: { value: color.clone() }, opacity: { value: 0 } },
        transparent: true,
        depthWrite: false,
      })
    );
    pins.renderOrder = 5;
    pins.visible = false;
  }

  group.add(side, cap, outline, ring);
  if (pins) group.add(pins);

  return {
    id,
    group,
    cap,
    side,
    outline,
    ring,
    pins,
    color,
    focus,
    phase: Math.random() * Math.PI * 2,
    hover: 0,
    dim: 1,
    pinAlpha: 0,
  };
}

function buildArc(from: { lat: number; lng: number }, to: { lat: number; lng: number }, colorHex: string) {
  const a = new Vector3(...latLngToVector3(from.lat, from.lng, 1));
  const b = new Vector3(...latLngToVector3(to.lat, to.lng, 1));
  const angle = a.angleTo(b);
  if (angle < 0.12) return null; // too close to bother (e.g. home country)
  const q = new Quaternion().setFromUnitVectors(a, b);
  const id = new Quaternion();
  const tmp = new Quaternion();
  const N = 96;
  const pos: number[] = [];
  const ts: number[] = [];
  const lift = 0.04 + 0.14 * (angle / Math.PI);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    tmp.slerpQuaternions(id, q, t);
    const p = a.clone().applyQuaternion(tmp).multiplyScalar(R1 + Math.sin(Math.PI * t) * lift);
    pos.push(p.x, p.y, p.z);
    ts.push(t);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('t', new Float32BufferAttribute(ts, 1));
  return new Line(
    g,
    new ShaderMaterial({
      vertexShader: arcVertex,
      fragmentShader: arcFragment,
      uniforms: {
        time: { value: 0 },
        colorA: { value: new Color('#ffffff') },
        colorB: { value: new Color(colorHex) },
        opacity: { value: 0.75 },
      },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    })
  );
}

export function createVisitedLayer(world: World, manifest: Manifest, pixelRatio: number): VisitedLayer {
  const group = new Group();
  const countries = new Map<string, VisitedCountry>();
  const arcs: Line<BufferGeometry, ShaderMaterial>[] = [];

  for (const [id, entry] of Object.entries(manifest.countries)) {
    const seen = new Set<string>();
    const pins = entry.photos
      .filter((p) => p.showPin && p.lat !== undefined && p.lng !== undefined)
      .map((p) => ({ lat: p.lat!, lng: p.lng! }))
      // A starred place already marks that spot; don't stack a pin under the star.
      .filter((p) => !(manifest.starred ?? []).some((s) => Math.abs(s.lat - p.lat) < 0.25 && Math.abs(s.lng - p.lng) < 0.25))
      .filter((p) => {
        const k = `${p.lat},${p.lng}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    const anchors = [
      ...entry.photos.filter((p) => p.lat !== undefined && p.lng !== undefined).map((p) => ({ lat: p.lat!, lng: p.lng! })),
      ...(manifest.starred ?? []).filter((s) => findRegionAt(world, s.lat, s.lng)?.id === id),
    ];
    const c = buildCountry(world, id, entry.color, pins, pixelRatio, anchors);
    if (!c) continue;
    countries.set(id, c);
    group.add(c.group);
    const arc = buildArc(HOME, c.focus, entry.color);
    if (arc) {
      arcs.push(arc as Line<BufferGeometry, ShaderMaterial>);
      group.add(arc);
    }
  }

  let hovered: string | null = null;
  let selected: string | null = null;
  let arcAlpha = 1;
  const pickables: Object3D[] = [];
  countries.forEach((c) => pickables.push(c.cap, c.side));

  const approach = (cur: number, target: number, dt: number, speed = 8) =>
    cur + (target - cur) * (1 - Math.exp(-speed * dt));

  return {
    group,
    pickables,
    focus(id) {
      return countries.get(id)?.focus ?? null;
    },
    setHover(id) {
      hovered = id;
    },
    setSelected(id) {
      selected = id;
    },
    update(time, dt, reducedMotion) {
      countries.forEach((c) => {
        const isHover = hovered === c.id || selected === c.id;
        c.hover = approach(c.hover, isHover ? 1 : 0, dt);
        c.dim = approach(c.dim, selected && selected !== c.id ? 0.28 : 1, dt, 5);
        c.pinAlpha = approach(c.pinAlpha, selected === c.id ? 1 : 0, dt, 4);

        // Lift on hover: radial extrusion means scaling outward raises the whole shape.
        c.group.scale.setScalar(1 + c.hover * 0.012);

        // Same gentle pulse for every colour: the fill breathes and the outline (which carries the glow) follows.
        const wave = reducedMotion ? 1 : 0.5 + 0.5 * Math.sin(time * 1.6 + c.phase);
        const breathe = 0.78 + 0.22 * wave;
        const glow = breathe * (1 + 0.35 * c.hover);
        c.cap.material.color.copy(c.color).multiplyScalar(glow * (0.35 + 0.65 * c.dim));
        c.cap.material.opacity = 0.5 + 0.44 * c.dim;
        c.side.material.opacity = 0.18 + 0.32 * c.dim;
        c.outline.material.opacity = (0.25 + 0.6 * c.dim) * (0.55 + 0.45 * wave);
        c.ring.material.uniforms.time.value = reducedMotion ? 0.25 : time + c.phase;
        c.ring.material.uniforms.opacity.value = 0.9 * c.dim * (selected === c.id ? 0.4 : 1);
        if (c.pins) {
          c.pins.material.uniforms.opacity.value = c.pinAlpha;
          c.pins.visible = c.pinAlpha > 0.01;
        }
      });
      arcAlpha = approach(arcAlpha, selected ? 0 : 1, dt, 5);
      for (const arc of arcs) {
        arc.material.uniforms.time.value = reducedMotion ? 0 : time;
        arc.material.uniforms.opacity.value = 0.75 * arcAlpha;
        arc.visible = arcAlpha > 0.01;
      }
    },
    dispose() {
      group.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose();
        (m.material as { dispose?: () => void } | undefined)?.dispose?.();
      });
      group.removeFromParent();
    },
  };
}
