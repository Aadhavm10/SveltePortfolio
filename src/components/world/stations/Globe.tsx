import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { CatmullRomCurve3, Group, MathUtils, Mesh, MeshStandardMaterial, Quaternion, TubeGeometry, Vector3 } from 'three';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land from 'world-atlas/land-110m.json';
import { PROPS } from '../layout';
import { playTick } from '../sound';
import { world } from '../store';
import { canvasTexture } from '../textures';
import { HOME, visited, visitedAt, type Ring } from './countries';

export const GLOBE_RADIUS = 2;
const GLOBE_Y = 3.1;

/** Position on the (unrotated) globe for a latitude/longitude, matching three's sphere UVs. */
export function latLngToVector(lat: number, lng: number, radius: number) {
  const phi = MathUtils.degToRad(lng + 180);
  const theta = MathUtils.degToRad(90 - lat);
  return new Vector3(-radius * Math.cos(phi) * Math.sin(theta), radius * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta));
}

/** Spin needed to bring a place round to face the viewer (+z). */
const facingYaw = (lat: number, lng: number) => {
  const v = latLngToVector(lat, lng, 1);
  return -Math.atan2(v.x, v.z);
};

const W = 2048;
const H = 1024;
const X = (lng: number) => ((lng + 180) / 360) * W;
const Y = (lat: number) => ((90 - lat) / 180) * H;

/** Traces rings (already unwrapped) three times side by side, so shapes crossing the seam still draw. */
function traceRings(ctx: CanvasRenderingContext2D, rings: Ring[]) {
  for (const ring of rings) {
    const span = ring[ring.length - 1][0] - ring[0][0];
    for (const shift of [-360, 0, 360]) {
      ring.forEach(([lng, lat], i) => (i ? ctx.lineTo(X(lng + shift), Y(lat)) : ctx.moveTo(X(lng + shift), Y(lat))));
      // A ring that wraps the whole way round (Antarctica) closes along the pole.
      if (Math.abs(span) > 180) {
        const pole = ring[0][1] < 0 ? -90 : 90;
        ctx.lineTo(X(ring[ring.length - 1][0] + shift), Y(pole));
        ctx.lineTo(X(ring[0][0] + shift), Y(pole));
      }
      ctx.closePath();
    }
  }
}

/** The soft, hand-coloured base map: pastel sea, dotted graticule, green land, snowy poles. Drawn once. */
function baseMap() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const topology = land as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topology, topology.objects.land);
  const rings: Ring[] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates as Ring[]] : g.type === 'MultiPolygon' ? (g.coordinates as Ring[][]) : [];
    for (const poly of polys)
      for (const ring of poly) {
        let offset = 0;
        let prev = ring[0][0];
        rings.push(
          ring.map(([lng, lat]) => {
            const d = lng - prev;
            if (d > 180) offset -= 360;
            else if (d < -180) offset += 360;
            prev = lng;
            return [lng + offset, lat] as [number, number];
          })
        );
      }
  }

  const sea = ctx.createLinearGradient(0, 0, 0, H);
  sea.addColorStop(0, '#9ed7ea');
  sea.addColorStop(0.5, '#8fd0e6');
  sea.addColorStop(1, '#9ed7ea');
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 10]);
  for (let lat = -60; lat <= 60; lat += 30) {
    ctx.beginPath();
    ctx.moveTo(0, Y(lat));
    ctx.lineTo(W, Y(lat));
    ctx.stroke();
  }
  for (let lng = -180; lng < 180; lng += 30) {
    ctx.beginPath();
    ctx.moveTo(X(lng), 0);
    ctx.lineTo(X(lng), H);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.save();
  ctx.translate(3, 4);
  ctx.beginPath();
  traceRings(ctx, rings);
  ctx.fillStyle = 'rgba(40, 110, 130, 0.35)';
  ctx.fill('evenodd');
  ctx.restore();
  ctx.beginPath();
  traceRings(ctx, rings);
  ctx.fillStyle = '#bfe3a0';
  ctx.fill('evenodd');
  ctx.save();
  ctx.clip('evenodd');
  const tint = ctx.createLinearGradient(0, 0, 0, H);
  tint.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
  tint.addColorStop(0.12, 'rgba(255, 255, 255, 0.9)');
  tint.addColorStop(0.17, 'rgba(255, 255, 255, 0)');
  tint.addColorStop(0.36, 'rgba(240, 214, 150, 0.55)');
  tint.addColorStop(0.5, 'rgba(240, 214, 150, 0)');
  tint.addColorStop(0.62, 'rgba(240, 214, 150, 0.5)');
  tint.addColorStop(0.8, 'rgba(255, 255, 255, 0)');
  tint.addColorStop(0.86, 'rgba(255, 255, 255, 0.95)');
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.strokeStyle = '#7fae6a';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  return canvas;
}

/** Map plus the countries I've been to on top: warm for visited, brighter on hover, brightest when picked. */
function paintCountries(ctx: CanvasRenderingContext2D, base: HTMLCanvasElement, hovered: number, selected: number) {
  ctx.drawImage(base, 0, 0);
  visited().forEach((v, i) => {
    const fill = i === selected ? '#ff9a6b' : i === hovered ? '#ffb27a' : '#ffcf96';
    const edge = i === selected ? '#ffffff' : '#e8956a';
    if (v.country) {
      ctx.beginPath();
      for (const poly of v.country.polygons) traceRings(ctx, poly);
      ctx.fillStyle = fill;
      ctx.fill('evenodd');
      ctx.lineWidth = i === selected ? 5 : 3;
      ctx.strokeStyle = edge;
      ctx.stroke();
    } else {
      // Too small for an outline: a dot.
      for (const shift of [-360, 0, 360]) {
        ctx.beginPath();
        ctx.arc(X(v.centroid.lng + shift), Y(v.centroid.lat), i === selected ? 14 : 10, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = edge;
        ctx.stroke();
      }
    }
  });
}

/** Spin state shared with the HUD (drag and arrow keys). */
export const globeSpin = { yaw: 0, target: 0, dragging: false, hovered: -1 };

/** Turns the globe so the selected country faces the viewer. */
export function faceSelectedPlace() {
  const v = visited()[world.get().place];
  if (!v) return;
  const want = facingYaw(v.centroid.lat, v.centroid.lng);
  globeSpin.target = globeSpin.yaw + Math.atan2(Math.sin(want - globeSpin.yaw), Math.cos(want - globeSpin.yaw));
}

/** Selects the next or previous country, west to east. */
export function stepPlace(step: number) {
  const count = visited().length;
  if (!count) return;
  playTick();
  world.set({ place: (world.get().place + step + count) % count });
  faceSelectedPlace();
}

function selectCountry(index: number) {
  if (index < 0 || index === world.get().place) return;
  playTick();
  world.set({ place: index, gallery: -1 });
  faceSelectedPlace();
}

/** A little flag planted at a country's middle; it hops when picked. */
function Flag({ index }: { index: number }) {
  const v = visited()[index];
  const group = useRef<Group>(null);
  const cloth = useRef<Mesh>(null);
  const { position, quaternion } = useMemo(() => {
    const position = latLngToVector(v.centroid.lat, v.centroid.lng, GLOBE_RADIUS);
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), position.clone().normalize());
    return { position, quaternion };
  }, [v]);
  const material = useMemo(() => new MeshStandardMaterial({ color: '#ff6b5b', roughness: 0.5 }), []);
  useFrame((state) => {
    const s = world.get();
    const picked = s.station === 'globe' && s.place === index;
    const t = state.clock.elapsedTime;
    if (group.current) {
      const target = picked ? 1.35 : 1;
      group.current.scale.setScalar(MathUtils.damp(group.current.scale.x, target, 8, 1 / 60));
      group.current.position.copy(position).multiplyScalar(1 + (picked ? Math.abs(Math.sin(t * 4)) * 0.03 : 0));
    }
    if (cloth.current) cloth.current.rotation.y = Math.sin(t * 5 + index) * 0.25;
    material.color.set(picked ? '#ff6b5b' : '#e9775a');
  });
  return (
    <group ref={group} position={position} quaternion={quaternion}>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.34, 6]} />
        <meshStandardMaterial color="#5a4a3a" />
      </mesh>
      <mesh ref={cloth} position={[0, 0.29, 0]} material={material}>
        <boxGeometry args={[0.005, 0.1, 0.16]} />
      </mesh>
    </group>
  );
}

/** The home marker in Dallas: a small house-shaped pin. */
function Home() {
  const { position, quaternion } = useMemo(() => {
    const position = latLngToVector(HOME.lat, HOME.lng, GLOBE_RADIUS);
    return { position, quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), position.clone().normalize()) };
  }, []);
  return (
    <group position={position} quaternion={quaternion}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="#fffaee" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.13, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.1, 0.08, 4]} />
        <meshStandardMaterial color="#d9644a" roughness={0.6} />
      </mesh>
    </group>
  );
}

const ARC_POINTS = 64;
const ARC_SIDES = 6;

/** A flight path from home to the picked country that draws itself, with a little plane on it. */
function Arc() {
  const tube = useRef<Mesh>(null);
  const plane = useRef<Mesh>(null);
  const state = useRef({ place: -2, t: 0, points: [] as Vector3[] });
  const a = useMemo(() => latLngToVector(HOME.lat, HOME.lng, 1), []);
  const material = useMemo(() => new MeshStandardMaterial({ color: '#ff8a5a', emissive: '#ff8a5a', emissiveIntensity: 0.35, roughness: 0.5 }), []);

  useFrame((_, delta) => {
    const s = world.get();
    const v = s.station === 'globe' ? visited()[s.place] : undefined;
    const st = state.current;
    const mesh = tube.current;
    if (!mesh) return;
    if (s.place !== st.place || !v) {
      st.place = v ? s.place : -2;
      st.t = 0;
      st.points = [];
      if (v) {
        const b = latLngToVector(v.centroid.lat, v.centroid.lng, 1);
        const angle = a.angleTo(b);
        // Home itself, or right next door: no flight needed.
        if (angle > 0.12) {
          const qa = new Quaternion();
          const qb = new Quaternion().setFromUnitVectors(a, b);
          const q = new Quaternion();
          for (let i = 0; i < ARC_POINTS; i++) {
            const k = i / (ARC_POINTS - 1);
            q.slerpQuaternions(qa, qb, k);
            const lift = 1 + Math.sin(Math.PI * k) * (0.04 + angle * 0.07);
            st.points.push(a.clone().applyQuaternion(q).multiplyScalar(GLOBE_RADIUS * lift));
          }
          mesh.geometry.dispose();
          mesh.geometry = new TubeGeometry(new CatmullRomCurve3(st.points), ARC_POINTS - 1, 0.016, ARC_SIDES, false);
        }
      }
    }
    const has = st.points.length > 0;
    mesh.visible = has;
    if (plane.current) plane.current.visible = has;
    if (!has) return;
    st.t = Math.min(1, st.t + delta / 1.4);
    const k = MathUtils.smootherstep(st.t, 0, 1);
    // Each tube segment is ARC_SIDES quads (6 indices each): grow the visible part along the path.
    mesh.geometry.setDrawRange(0, Math.ceil(k * (ARC_POINTS - 1)) * ARC_SIDES * 6);
    if (plane.current) {
      const i = Math.min(ARC_POINTS - 2, Math.floor(k * (ARC_POINTS - 1)));
      plane.current.position.copy(st.points[i]);
      plane.current.lookAt(st.points[i + 1].clone().multiplyScalar(2).sub(st.points[i]));
      plane.current.rotateX(Math.PI / 2);
    }
  });

  return (
    <>
      <mesh ref={tube} material={material} visible={false}>
        <bufferGeometry />
      </mesh>
      <mesh ref={plane} visible={false}>
        <coneGeometry args={[0.04, 0.13, 6]} />
        <meshStandardMaterial color="#fffaee" roughness={0.4} />
      </mesh>
    </>
  );
}

/** A big desk globe on a wooden stand, with the countries I've been to lit up. */
export function Globe() {
  const base = useMemo(baseMap, []);
  const texture = useMemo(() => canvasTexture(W, H, (ctx) => paintCountries(ctx, base, -1, -1)), [base]);
  const painted = useRef({ hovered: -2, selected: -2 });
  const spin = useRef<Group>(null);
  const gl = useThree((s) => s.gl);

  // Drag across the canvas to spin it while the globe is open.
  useEffect(() => {
    const canvas = gl.domElement;
    let lastX = 0;
    const down = (e: PointerEvent) => {
      if (world.get().station !== 'globe') return;
      globeSpin.dragging = true;
      lastX = e.clientX;
    };
    const move = (e: PointerEvent) => {
      if (!globeSpin.dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      globeSpin.target += dx * 0.008;
    };
    const up = () => {
      globeSpin.dragging = false;
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const s = world.get();
    const open = s.station === 'globe';
    // A lazy idle spin until someone walks up.
    if (!open && !globeSpin.dragging) globeSpin.target += delta * 0.12;
    globeSpin.yaw = MathUtils.damp(globeSpin.yaw, globeSpin.target, open ? 5 : 2, delta);
    if (spin.current) spin.current.rotation.y = globeSpin.yaw;
    const hovered = open ? globeSpin.hovered : -1;
    const selected = open ? s.place : -1;
    if (hovered !== painted.current.hovered || selected !== painted.current.selected) {
      painted.current = { hovered, selected };
      texture.redraw((ctx) => paintCountries(ctx, base, hovered, selected));
    }
  });

  /** The visited country under the pointer, from where the ray meets the sphere. */
  const countryAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (!e.uv) return -1;
    return visitedAt(e.uv.x * 360 - 180, e.uv.y * 180 - 90);
  };
  const hover = (e: ThreeEvent<PointerEvent>) => {
    if (world.get().station !== 'globe') return;
    const i = countryAt(e);
    if (i !== globeSpin.hovered) {
      globeSpin.hovered = i;
      document.body.style.cursor = i >= 0 ? 'pointer' : '';
    }
  };
  const leave = () => {
    globeSpin.hovered = -1;
    document.body.style.cursor = '';
  };

  const { x, z } = PROPS.globe;
  const flags = visited();
  return (
    <group position={[x, 0, z]}>
      <RigidBody type="fixed" colliders={false}>
        <CylinderCollider args={[1, 1.1]} position={[0, 1, 0]} />
      </RigidBody>
      {/* Stand: round base, turned stem and a brass meridian ring */}
      <mesh position={[0, 0.14, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.15, 1.3, 0.28, 32]} />
        <meshStandardMaterial color="#8a5a36" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.3, 0.75, 16]} />
        <meshStandardMaterial color="#a8774c" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <sphereGeometry args={[0.22, 16, 12]} />
        <meshStandardMaterial color="#a8774c" roughness={0.6} />
      </mesh>
      {/* The ring's gap sits at the bottom, where the stem holds it */}
      <mesh position={[0, GLOBE_Y, 0]} rotation={[0, 0, -0.36 * Math.PI]}>
        <torusGeometry args={[GLOBE_RADIUS + 0.14, 0.055, 10, 72, Math.PI * 1.72]} />
        <meshStandardMaterial color="#d9a441" metalness={0.75} roughness={0.28} />
      </mesh>
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, GLOBE_Y + side * (GLOBE_RADIUS + 0.12), 0]}>
          <sphereGeometry args={[0.08, 12, 8]} />
          <meshStandardMaterial color="#d9a441" metalness={0.75} roughness={0.28} />
        </mesh>
      ))}
      <group ref={spin} position={[0, GLOBE_Y, 0]} userData={{ dynamic: true }}>
        <mesh
          castShadow
          onPointerMove={hover}
          onPointerOut={leave}
          onClick={(e) => {
            if (world.get().station !== 'globe' || e.delta > 6) return;
            e.stopPropagation();
            selectCountry(countryAt(e));
          }}
        >
          <sphereGeometry args={[GLOBE_RADIUS, 64, 40]} />
          <meshStandardMaterial map={texture} roughness={0.55} />
        </mesh>
        <Home />
        {flags.map((_, i) => (
          <Flag key={i} index={i} />
        ))}
        <Arc />
      </group>
    </group>
  );
}
