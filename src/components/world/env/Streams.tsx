import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CuboidCollider, RigidBody } from '@react-three/rapier';
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DodecahedronGeometry,
  Group,
  IcosahedronGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  Vector2
} from 'three';
import { BOUNDS, BRIDGES, POND, STREAMS, WATERFALL } from '../layout';
import { groundColor, terrainHeight } from './Ground';
import { pathPoints, streamCurves, streamDistance } from './mask';
import { mergeParts, type Part } from './merge';
import { seeded, SUN_DIR } from './palette';

/** Height of the water surface; the physics floor stays flat at 0. */
const WATER_Y = -0.05;
/** How far the channel runs on past each end of a stream, rising back to ground level. */
const TAIL = 4.5;

interface Sample {
  x: number;
  z: number;
  /** Unit direction of flow. */
  tx: number;
  tz: number;
  /** 1 along the stream, easing to 0 over the tails. */
  depth: number;
  /** Metres along the stream. */
  v: number;
}

function samples(index: number) {
  const points = pathPoints(streamCurves[index]);
  const list: Sample[] = [];
  let v = -TAIL;
  const dir = (i: number) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { tx: (b.x - a.x) / len, tz: (b.z - a.z) / len };
  };
  const steps = Math.round(TAIL / 0.5);
  const start = dir(0);
  for (let k = steps; k > 0; k--) {
    const d = k * 0.5;
    list.push({ x: points[0].x - start.tx * d, z: points[0].z - start.tz * d, ...start, depth: 1 - d / TAIL, v: -d });
  }
  points.forEach((p, i) => {
    if (i > 0) v += Math.hypot(p.x - points[i - 1].x, p.z - points[i - 1].z);
    else v = 0;
    list.push({ x: p.x, z: p.z, ...dir(i), depth: 1, v });
  });
  const last = points[points.length - 1];
  const end = dir(points.length - 1);
  for (let k = 1; k <= steps; k++) {
    const d = k * 0.5;
    list.push({ x: last.x + end.tx * d, z: last.z + end.tz * d, ...end, depth: 1 - d / TAIL, v: v + d });
  }
  return list;
}

/** Strip of quads across a list of samples; `columns` gives each vertex's offset, height, colour and uv. */
function ribbon(list: Sample[], columns: number, vertex: (s: Sample, column: number, out: { x: number; y: number; z: number; u: number; color?: Color }) => void, withColor: boolean) {
  const count = list.length * columns;
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const fades = new Float32Array(count);
  const colors = withColor ? new Float32Array(count * 3) : null;
  const out = { x: 0, y: 0, z: 0, u: 0, color: withColor ? new Color() : undefined };
  list.forEach((s, r) => {
    for (let c = 0; c < columns; c++) {
      const i = r * columns + c;
      vertex(s, c, out);
      positions.set([out.x, out.y, out.z], i * 3);
      uvs.set([out.u, s.v], i * 2);
      fades[i] = s.depth;
      if (colors && out.color) colors.set([out.color.r, out.color.g, out.color.b], i * 3);
    }
  });
  const index: number[] = [];
  for (let r = 0; r < list.length - 1; r++) {
    for (let c = 0; c < columns - 1; c++) {
      const a = r * columns + c;
      const b = a + columns;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setAttribute('aFade', new BufferAttribute(fades, 1));
  if (colors) g.setAttribute('color', new BufferAttribute(colors, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

const SAND = new Color('#e4cf9f');
const BED = new Color('#93ad9d');

/** Cross-section of a stream bed: [offset beyond the half width, height, how sandy (1) or pebbly (2)]. */
const PROFILE: [number, number, number][] = [
  [2.9, 0, 0],
  [1.2, 0, 0],
  [0.6, -0.01, 0.6],
  [0.1, -0.12, 1],
  [-0.45, -0.3, 1.6],
  [-1, -0.36, 2]
];

function channelGeometry(index: number, list: Sample[]) {
  const hw = STREAMS[index].width / 2;
  // Mirror the profile: bank, slope, bed, slope, bank.
  const cols = [...PROFILE, ...PROFILE.slice(0, -1).reverse()].map(([o, y, sand], i) => {
    const side = i < PROFILE.length - 1 ? -1 : i === PROFILE.length - 1 ? 0 : 1;
    return { s: side * (o === -1 ? 0 : hw + o), y, sand };
  });
  const ground = new Color();
  return ribbon(
    list,
    cols.length,
    (s, c, out) => {
      const col = cols[c];
      out.x = s.x - s.tz * col.s;
      out.z = s.z + s.tx * col.s;
      // Inside the pond basin the bed simply follows the (deeper) ground.
      out.y = Math.min(col.y * s.depth, terrainHeight(out.x, out.z));
      out.u = c / (cols.length - 1);
      groundColor(out.x, out.z, out.y, ground);
      const t = col.sand * s.depth;
      out.color!.copy(ground).lerp(SAND, Math.min(1, t));
      if (t > 1) out.color!.lerp(BED, t - 1);
    },
    true
  );
}

function waterGeometry(index: number, list: Sample[]) {
  const hw = STREAMS[index].width / 2 + 0.35;
  return ribbon(
    list,
    5,
    (s, c, out) => {
      const o = (c / 4 - 0.5) * 2 * hw;
      out.x = s.x - s.tz * o;
      out.z = s.z + s.tx * o;
      out.y = WATER_Y;
      out.u = c / 4;
    },
    false
  );
}

const waterVertex = /* glsl */ `
  attribute float aFade;
  varying vec2 vUv;
  varying float vFade;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vFade = aFade;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorld = worldPosition.xyz;
    vec4 mvPosition = viewMatrix * worldPosition;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const waterFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uFoam;
  uniform vec3 uSun;
  uniform vec3 uSunDir;
  uniform vec2 uPond;
  uniform vec2 uPondRadii;
  varying vec2 vUv;
  varying float vFade;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  void main() {
    float edge = abs(vUv.x - 0.5) * 2.0;
    float flow = vUv.y;
    float n1 = sin(flow * 1.6 - uTime * 2.4 + sin(vUv.x * 7.0 + flow * 0.5) * 1.4) * 0.5 + 0.5;
    float n2 = sin(flow * 3.4 - uTime * 3.3 + vUv.x * 13.0) * 0.5 + 0.5;
    vec3 col = mix(uDeep, uShallow, smoothstep(0.05, 0.95, edge));
    // Ripples drifting downstream, and foam where the water meets the bank.
    float streak = smoothstep(0.7, 0.95, n1 * n2 + 0.2 * sin(vUv.x * 18.0 + flow * 0.8));
    col = mix(col, uFoam, streak * 0.4);
    float foam = smoothstep(0.7, 0.9, edge + (n1 - 0.5) * 0.14);
    col = mix(col, uFoam, foam * 0.8);
    vec3 normal = normalize(vec3((n1 - 0.5) * 0.14, 1.0, (n2 - 0.5) * 0.14));
    vec3 viewDir = normalize(cameraPosition - vWorld);
    vec3 halfway = normalize(uSunDir + viewDir);
    col += uSun * pow(max(dot(normal, halfway), 0.0), 120.0) * 1.5;
    float alpha = mix(0.92, 0.72, edge) * (1.0 - smoothstep(0.9, 1.0, edge));
    alpha *= smoothstep(0.0, 0.5, vFade - 0.45);
    // Melt into the pond where the stream meets it.
    alpha *= smoothstep(0.86, 1.02, length((vWorld.xz - uPond) / uPondRadii));
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function streamWaterMaterial() {
  return new ShaderMaterial({
    vertexShader: waterVertex,
    fragmentShader: waterFragment,
    transparent: true,
    depthWrite: false,
    fog: true,
    uniforms: UniformsUtils.merge([
      UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDeep: { value: new Color('#3e9fb5') },
        uShallow: { value: new Color('#86d6d2') },
        uFoam: { value: new Color('#f4fbf6') },
        uSun: { value: new Color('#fff1cf') },
        uSunDir: { value: SUN_DIR },
        uPond: { value: new Vector2(POND.x, POND.z) },
        uPondRadii: { value: new Vector2(POND.rx, POND.rz) }
      }
    ])
  });
}

interface Bridge {
  x: number;
  z: number;
  /** Unit flow direction under the bridge. */
  tx: number;
  tz: number;
  yaw: number;
  length: number;
  width: number;
  arch: number;
  red: boolean;
}

export const bridges: Bridge[] = BRIDGES.map(({ stream, t }, i) => {
  const curve = streamCurves[stream];
  const p = curve.getPointAt(t);
  const tan = curve.getTangentAt(t);
  const len = Math.hypot(tan.x, tan.z) || 1;
  const tx = tan.x / len;
  const tz = tan.z / len;
  return { x: p.x, z: p.z, tx, tz, yaw: Math.atan2(-tz, tx), length: STREAMS[stream].width + 3, width: 1.7, arch: i === 0 ? 0.5 : 0.32, red: i === 0 };
});

function deckHeight(b: Bridge, u: number) {
  return b.arch * (1 - u * u) + 0.06;
}

/**
 * How far to raise (bridge deck) or sink (wading) a character standing at x, z.
 * The physics floor is flat, so this is purely visual.
 */
export function groundOffset(x: number, z: number) {
  for (const b of bridges) {
    const dx = x - b.x;
    const dz = z - b.z;
    const along = dx * b.tx + dz * b.tz;
    const across = -dx * b.tz + dz * b.tx;
    if (Math.abs(along) < b.width / 2 + 0.1 && Math.abs(across) < b.length / 2) return deckHeight(b, across / (b.length / 2)) - 0.04;
  }
  const d = streamDistance(x, z);
  return d < 0.1 ? -0.22 * Math.min(1, (0.1 - d) / 0.6) : 0;
}

/** True when x, z is in a stream (and not on a bridge). */
export function inWater(x: number, z: number) {
  return groundOffset(x, z) < -0.05;
}

function BridgeModel({ bridge: b }: { bridge: Bridge }) {
  // Planks in one mesh and the railings in another.
  const { deck, railing } = useMemo(() => {
    const planks: Part[] = [];
    const rails: Part[] = [];
    const n = 14;
    const half = b.length / 2;
    for (let i = 0; i < n; i++) {
      const u = -1 + ((i + 0.5) * 2) / n;
      const slope = (-2 * b.arch * u) / half;
      const depth = (b.length / n) * Math.sqrt(1 + slope * slope) * 0.96;
      planks.push({ geometry: new BoxGeometry(b.width, 0.08, depth), position: [0, deckHeight(b, u), u * half], rotation: [-Math.atan(slope), 0, 0] });
    }
    const posts = [-1, -0.5, 0, 0.5, 1].map((u) => ({ y: deckHeight(b, u), z: u * half * 0.96 }));
    for (const side of [-1, 1]) {
      const x = (side * b.width) / 2;
      for (const p of posts) rails.push({ geometry: new BoxGeometry(0.1, 0.62, 0.1), position: [x, p.y + 0.3, p.z] });
      posts.slice(1).forEach((p, i) => {
        const q = posts[i];
        const dz = p.z - q.z;
        const dy = p.y - q.y;
        rails.push({ geometry: new BoxGeometry(0.08, 0.08, Math.hypot(dz, dy) + 0.06), position: [x, (p.y + q.y) / 2 + 0.55, (p.z + q.z) / 2], rotation: [-Math.atan2(dy, dz), 0, 0] });
      });
    }
    return { deck: mergeParts(planks), railing: mergeParts(rails) };
  }, [b]);

  return (
    <group position={[b.x, 0, b.z]} rotation={[0, b.yaw, 0]}>
      <mesh geometry={deck} castShadow receiveShadow>
        <meshLambertMaterial color={b.red ? '#c08b5c' : '#b98656'} />
      </mesh>
      <mesh geometry={railing} castShadow>
        <meshLambertMaterial color={b.red ? '#e0604a' : '#8a5a36'} />
      </mesh>
      {b.red &&
        [-1, 1].flatMap((side) =>
          [-1, 1].map((end) => (
            <mesh key={`${side}${end}`} position={[(side * b.width) / 2, deckHeight(b, end) + 0.66, end * (b.length / 2) * 0.96]}>
              <sphereGeometry args={[0.08, 8, 6]} />
              <meshLambertMaterial color="#e9c46a" />
            </mesh>
          ))
        )}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[0.06, 0.6, b.length / 2]} position={[b.width / 2, 0.6, 0]} />
        <CuboidCollider args={[0.06, 0.6, b.length / 2]} position={[-b.width / 2, 0.6, 0]} />
      </RigidBody>
    </group>
  );
}

const waterfallVertex = /* glsl */ `
  varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const waterfallFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  #include <fog_pars_fragment>
  void main() {
    float y = vUv.y * 4.0 + uTime * 2.6;
    float s1 = sin(vUv.x * 31.0 + sin(vUv.x * 7.0) * 2.0) * 0.5 + 0.5;
    float s2 = sin(y * 2.2 + vUv.x * 19.0) * 0.5 + 0.5;
    float streak = smoothstep(0.55, 0.95, s1 * 0.6 + s2 * 0.5);
    vec3 col = mix(vec3(0.42, 0.78, 0.84), vec3(0.95, 0.99, 0.98), streak * 0.8 + (1.0 - vUv.y) * 0.25);
    float side = 1.0 - smoothstep(0.82, 1.0, abs(vUv.x - 0.5) * 2.0);
    col = mix(col, vec3(1.0), smoothstep(0.75, 0.0, vUv.y) * 0.5);
    gl_FragColor = vec4(col, side * 0.92);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** A little cliff with a waterfall that feeds the pond. */
function Waterfall() {
  const { x, z, width, height } = WATERFALL;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: waterfallVertex,
        fragmentShader: waterfallFragment,
        transparent: true,
        depthWrite: false,
        fog: true,
        uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }])
      }),
    []
  );
  const sheet = useMemo(() => {
    const g = new PlaneGeometry(width * 0.62, height + 0.15, 1, 10);
    const pos = g.getAttribute('position');
    // Water leaves the lip and arcs outward as it falls.
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) + (height + 0.15) / 2) / (height + 0.15);
      pos.setZ(i, Math.sqrt(1 - t) * 0.6);
    }
    g.computeVertexNormals();
    return g;
  }, [width, height]);
  const topWater = useMemo(() => {
    const m = streamWaterMaterial();
    m.uniforms.uPondRadii.value.set(0.001, 0.001);
    return m;
  }, []);
  const topGeometry = useMemo(() => {
    const list: Sample[] = [];
    for (let i = 0; i <= 12; i++) list.push({ x, z: z - 6 + i * 0.5, tx: 0, tz: 1, depth: 1, v: i * 0.5 });
    return ribbon(
      list,
      5,
      (s, c, out) => {
        out.x = s.x - (c / 4 - 0.5) * width * 0.7;
        out.z = s.z;
        out.y = height - 0.12;
        out.u = c / 4;
      },
      false
    );
  }, [x, z, width, height]);
  const foam = useRef<Group>(null);
  const cliff = useMemo(() => {
    const rand = seeded(91);
    const list: { x: number; z: number; w: number; d: number; h: number; ry: number }[] = [];
    // Two shoulders either side of the falls, with lower steps further out.
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const w = 3 + rand() * 1.4;
        list.push({ x: x + side * (width * 0.35 + 1.4 + i * 2.9), z: z - 2.3 - rand() * 0.6, w, d: 4.4 + rand(), h: height + 0.35 - i * 0.55 + rand() * 0.3, ry: (rand() - 0.5) * 0.25 });
      }
    }
    // The notch the water runs through.
    list.push({ x, z: z - 2.3, w: width * 0.75, d: 4.4, h: height - 0.3, ry: 0 });
    // Boulders tumbled along the foot of the cliff.
    const boulder = new DodecahedronGeometry(1, 0);
    const brand = seeded(57);
    const boulders: Part[] = Array.from({ length: 11 }, (_, i) => {
      const side = i % 2 ? 1 : -1;
      const s = 0.45 + brand() * 0.6;
      const r = brand() * 6;
      return { geometry: boulder, position: [x + side * (width * 0.45 + brand() * 4.5), s * 0.35, z + 0.2 + brand() * 1.1], rotation: [r, r * 2, 0], scale: [s, s * 0.75, s] };
    });
    return {
      rock: mergeParts([
        ...list.map((b): Part => ({ geometry: new BoxGeometry(b.w, b.h + 0.4, b.d), position: [b.x, b.h / 2 - 0.2, b.z], rotation: [0, b.ry, 0] })),
        ...boulders
      ]),
      moss: mergeParts(list.map((b): Part => ({ geometry: new BoxGeometry(b.w + 0.25, 0.14, b.d + 0.25), position: [b.x, b.h + 0.03, b.z], rotation: [0, b.ry, 0] })))
    };
  }, [x, z, width, height]);
  const rock = useMemo(() => new MeshLambertMaterial({ color: '#a69d8e', flatShading: true }), []);
  const moss = useMemo(() => new MeshLambertMaterial({ color: '#79a84a', flatShading: true }), []);
  const foamMaterial = useMemo(() => new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }), []);
  const foamGeometry = useMemo(() => new IcosahedronGeometry(1, 0), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    material.uniforms.uTime.value = t;
    topWater.uniforms.uTime.value = t;
    foam.current?.children.forEach((child, i) => {
      const k = (t * 1.6 + i * 0.37) % 1;
      child.scale.setScalar(0.25 + k * 0.45);
      child.position.y = 0.05 + k * 0.35;
    });
  });

  return (
    <group>
      <mesh geometry={cliff.rock} material={rock} castShadow receiveShadow />
      <mesh geometry={cliff.moss} material={moss} receiveShadow />
      <mesh geometry={sheet} material={material} position={[x, (height + 0.15) / 2 - 0.27, z]} />
      <mesh geometry={topGeometry} material={topWater} />
      <group ref={foam} position={[x, 0, z + 0.7]}>
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} geometry={foamGeometry} material={foamMaterial} position={[(i / 6 - 0.5) * width * 0.55, 0, (i % 3) * 0.2]} />
        ))}
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[14, 2.5, 2.6]} position={[x, 2.5, z - 2.5]} />
      </RigidBody>
    </group>
  );
}

/** Rock piles where streams run off the edge of the park. */
function StreamEnds() {
  const geometry = useMemo(() => {
    const rand = seeded(311);
    const rock = new DodecahedronGeometry(1, 0);
    const parts: Part[] = [];
    for (const s of STREAMS) {
      for (const [px, pz] of [s.points[0], s.points[s.points.length - 1]]) {
        const out = px < BOUNDS.minX || px > BOUNDS.maxX || pz < BOUNDS.minZ || pz > BOUNDS.maxZ;
        if (!out) continue;
        for (let i = 0; i < 4; i++) {
          const size = 0.8 + rand() * 0.9;
          const r = rand() * 6;
          parts.push({ geometry: rock, position: [px + (rand() - 0.5) * 3, size * 0.3, pz + (rand() - 0.5) * 3], rotation: [r, r * 2, 0], scale: [size, size * 0.7, size] });
        }
      }
    }
    return mergeParts(parts);
  }, []);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshLambertMaterial color="#a69d8e" flatShading />
    </mesh>
  );
}

/** Shallow streams you can wade through, wooden bridges over them and the waterfall that feeds the pond. */
export function Streams() {
  const { channels, waters } = useMemo(() => {
    const lists = STREAMS.map((_, i) => samples(i));
    return { channels: lists.map((l, i) => channelGeometry(i, l)), waters: lists.map((l, i) => waterGeometry(i, l)) };
  }, []);
  const channelMaterial = useMemo(
    () => new MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }),
    []
  );
  const water = useMemo(streamWaterMaterial, []);
  useFrame((state) => {
    water.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <>
      {channels.map((g, i) => (
        <mesh key={i} geometry={g} material={channelMaterial} receiveShadow />
      ))}
      {waters.map((g, i) => (
        <mesh key={i} geometry={g} material={water} renderOrder={1} />
      ))}
      {bridges.map((b, i) => (
        <BridgeModel key={i} bridge={b} />
      ))}
      <Waterfall />
      <StreamEnds />
    </>
  );
}
