import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CylinderCollider, RigidBody } from '@react-three/rapier';
import { Group, MathUtils, Mesh, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import land from 'world-atlas/land-110m.json';
import { places } from '../../../data/portfolio';
import { PROPS } from '../layout';
import { playTick } from '../sound';
import { world } from '../store';
import { canvasTexture } from '../textures';

export const GLOBE_RADIUS = 2;
const GLOBE_Y = 3.1;

/** Places ordered west to east, so the arrow keys travel round the world. */
export const placeOrder = places.map((_, i) => i).sort((a, b) => places[a].lng - places[b].lng);

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

type Ring = [number, number][];

/** A soft, hand-coloured equirectangular map: pastel sea, dotted graticule, green land, snowy poles. */
function earthTexture() {
  const topology = land as unknown as Topology<{ land: GeometryCollection }>;
  const geo = feature(topology, topology.objects.land);
  const polygons: Ring[][] = [];
  for (const f of geo.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') polygons.push(g.coordinates as Ring[]);
    else if (g.type === 'MultiPolygon') polygons.push(...(g.coordinates as Ring[][]));
  }

  return canvasTexture(2048, 1024, (ctx, w, h) => {
    const X = (lng: number) => ((lng + 180) / 360) * w;
    const Y = (lat: number) => ((90 - lat) / 180) * h;

    const sea = ctx.createLinearGradient(0, 0, 0, h);
    sea.addColorStop(0, '#9ed7ea');
    sea.addColorStop(0.5, '#8fd0e6');
    sea.addColorStop(1, '#9ed7ea');
    ctx.fillStyle = sea;
    ctx.fillRect(0, 0, w, h);

    // Dotted graticule every 30 degrees.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      ctx.moveTo(0, Y(lat));
      ctx.lineTo(w, Y(lat));
      ctx.stroke();
    }
    for (let lng = -180; lng < 180; lng += 30) {
      ctx.beginPath();
      ctx.moveTo(X(lng), 0);
      ctx.lineTo(X(lng), h);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Unwrap each ring across the date line and draw it three times so nothing is cut off at the seam.
    const trace = () => {
      ctx.beginPath();
      for (const polygon of polygons) {
        for (const ring of polygon) {
          let offset = 0;
          let prev = ring[0][0];
          const pts = ring.map(([lng, lat]) => {
            const d = lng - prev;
            if (d > 180) offset -= 360;
            else if (d < -180) offset += 360;
            prev = lng;
            return [lng + offset, lat] as const;
          });
          const span = pts[pts.length - 1][0] - pts[0][0];
          for (const shift of [-360, 0, 360]) {
            pts.forEach(([lng, lat], i) => (i ? ctx.lineTo(X(lng + shift), Y(lat)) : ctx.moveTo(X(lng + shift), Y(lat))));
            // A ring that wraps the whole way round (Antarctica) closes along the pole.
            if (Math.abs(span) > 180) {
              const pole = pts[0][1] < 0 ? -90 : 90;
              ctx.lineTo(X(pts[pts.length - 1][0] + shift), Y(pole));
              ctx.lineTo(X(pts[0][0] + shift), Y(pole));
            }
            ctx.closePath();
          }
        }
      }
    };

    // A soft shadow under the land, then the land itself.
    ctx.save();
    ctx.translate(3, 4);
    trace();
    ctx.fillStyle = 'rgba(40, 110, 130, 0.35)';
    ctx.fill('evenodd');
    ctx.restore();
    trace();
    ctx.fillStyle = '#bfe3a0';
    ctx.fill('evenodd');
    ctx.save();
    ctx.clip('evenodd');
    // Warmer, drier band near the tropics and snow toward the poles.
    const tint = ctx.createLinearGradient(0, 0, 0, h);
    tint.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    tint.addColorStop(0.12, 'rgba(255, 255, 255, 0.9)');
    tint.addColorStop(0.17, 'rgba(255, 255, 255, 0)');
    tint.addColorStop(0.36, 'rgba(240, 214, 150, 0.55)');
    tint.addColorStop(0.5, 'rgba(240, 214, 150, 0)');
    tint.addColorStop(0.62, 'rgba(240, 214, 150, 0.5)');
    tint.addColorStop(0.8, 'rgba(255, 255, 255, 0)');
    tint.addColorStop(0.86, 'rgba(255, 255, 255, 0.95)');
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    ctx.strokeStyle = '#7fae6a';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
  });
}

/** Spin state shared with the HUD (drag and arrow keys). */
export const globeSpin = { yaw: 0, target: 0, dragging: false };

/** Turns the globe so the selected place faces the viewer. */
export function faceSelectedPlace() {
  const p = places[world.get().place];
  if (!p) return;
  const want = facingYaw(p.lat, p.lng);
  // Take the short way round from wherever the globe is now.
  globeSpin.target = globeSpin.yaw + Math.atan2(Math.sin(want - globeSpin.yaw), Math.cos(want - globeSpin.yaw));
}

/** Selects the next or previous place, west to east. */
export function stepPlace(step: number) {
  const at = placeOrder.indexOf(world.get().place);
  const next = placeOrder[(at + step + placeOrder.length) % placeOrder.length];
  playTick();
  world.set({ place: next });
  faceSelectedPlace();
}

function Pin({ index, radius }: { index: number; radius: number }) {
  const place = places[index];
  const head = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const { position, quaternion } = useMemo(() => {
    const position = latLngToVector(place.lat, place.lng, radius);
    // Stand the pin up along the surface normal.
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), position.clone().normalize());
    return { position, quaternion };
  }, [place, radius]);
  const material = useMemo(() => new MeshStandardMaterial({ color: place.placeholder ? '#ff9e8c' : '#ff6b5b', roughness: 0.4 }), [place]);
  useFrame((state) => {
    const s = world.get();
    const selected = s.station === 'globe' && s.place === index;
    const t = state.clock.elapsedTime;
    if (head.current) head.current.scale.setScalar(MathUtils.damp(head.current.scale.x, selected ? 1.5 : 1, 8, 1 / 60));
    if (halo.current) {
      halo.current.visible = selected;
      const k = (t * 1.2) % 1;
      halo.current.scale.setScalar(1 + k * 1.6);
      (halo.current.material as MeshStandardMaterial).opacity = (1 - k) * 0.7;
    }
  });
  return (
    <group
      position={position}
      quaternion={quaternion}
      onClick={(e) => {
        if (world.get().station !== 'globe') return;
        e.stopPropagation();
        world.set({ place: index });
        faceSelectedPlace();
        playTick();
      }}
    >
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.28, 6]} />
        <meshStandardMaterial color="#5a4a3a" />
      </mesh>
      <mesh ref={head} position={[0, 0.3, 0]} material={material}>
        <sphereGeometry args={[0.085, 14, 10]} />
      </mesh>
      <mesh ref={halo} position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.14, 24]} />
        <meshStandardMaterial color="#ff6b5b" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}

/** A big desk globe on a wooden stand: pins mark the places in `places`. */
export function Globe() {
  const texture = useMemo(earthTexture, []);
  const spin = useRef<Group>(null);
  const gl = useThree((s) => s.gl);

  // Drag across the canvas to spin it while the globe is open.
  useEffect(() => {
    const canvas = gl.domElement;
    let lastX = 0;
    let moved = 0;
    const down = (e: PointerEvent) => {
      if (world.get().station !== 'globe') return;
      globeSpin.dragging = true;
      lastX = e.clientX;
      moved = 0;
    };
    const move = (e: PointerEvent) => {
      if (!globeSpin.dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      globeSpin.target += dx * 0.008;
    };
    const up = () => {
      if (!globeSpin.dragging) return;
      globeSpin.dragging = false;
      if (moved < 6) return;
      // Select whichever place ended up facing the viewer.
      let best = world.get().place;
      let bestZ = -Infinity;
      places.forEach((p, i) => {
        const v = latLngToVector(p.lat, p.lng, 1).applyAxisAngle(new Vector3(0, 1, 0), globeSpin.target);
        if (v.z > bestZ) {
          bestZ = v.z;
          best = i;
        }
      });
      if (best !== world.get().place) {
        world.set({ place: best });
        playTick();
      }
      faceSelectedPlace();
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
    const open = world.get().station === 'globe';
    // A lazy idle spin until someone walks up.
    if (!open && !globeSpin.dragging) globeSpin.target += delta * 0.12;
    globeSpin.yaw = MathUtils.damp(globeSpin.yaw, globeSpin.target, open ? 5 : 2, delta);
    if (spin.current) spin.current.rotation.y = globeSpin.yaw;
  });

  const { x, z } = PROPS.globe;
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
      {/* Axis caps */}
      {[1, -1].map((side) => (
        <mesh key={side} position={[0, GLOBE_Y + side * (GLOBE_RADIUS + 0.12), 0]}>
          <sphereGeometry args={[0.08, 12, 8]} />
          <meshStandardMaterial color="#d9a441" metalness={0.75} roughness={0.28} />
        </mesh>
      ))}
      <group ref={spin} position={[0, GLOBE_Y, 0]} userData={{ dynamic: true }}>
        <mesh castShadow>
          <sphereGeometry args={[GLOBE_RADIUS, 64, 40]} />
          <meshStandardMaterial map={texture} roughness={0.55} />
        </mesh>
        {places.map((_, i) => (
          <Pin key={i} index={i} radius={GLOBE_RADIUS} />
        ))}
      </group>
    </group>
  );
}
