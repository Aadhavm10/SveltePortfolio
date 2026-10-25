import { useMemo, useRef, type CSSProperties } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Group, MathUtils, Mesh, MeshBasicMaterial } from 'three';
import { Icon } from '../icons';
import { STATIONS, type Station } from '../layout';
import { bodies, useWorld, world } from '../store';
import { canvasTexture } from '../textures';

function ringTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.86, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

function Marker({ station, ring }: { station: Station; ring: ReturnType<typeof ringTexture> }) {
  const gem = useRef<Group>(null);
  const pad = useRef<Mesh>(null);
  const sign = useRef<HTMLDivElement>(null);
  const near = useWorld((s) => s.near === station.id);
  const touch = useWorld((s) => s.touch);
  const materials = useMemo(
    () => ({
      gem: new MeshBasicMaterial({ color: station.color, toneMapped: false, transparent: true }),
      pad: new MeshBasicMaterial({ map: ring, color: station.color, transparent: true, depthWrite: false, toneMapped: false })
    }),
    [station, ring]
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const { mode, mapOpen } = world.get();
    const shown = mode === 'play' && !mapOpen ? 1 : 0;
    const active = world.get().near === station.id;
    if (gem.current) {
      gem.current.position.y = station.promptY + Math.sin(t * 2 + station.x) * 0.12;
      gem.current.rotation.y = t * 1.4;
      gem.current.scale.setScalar(MathUtils.damp(gem.current.scale.x, shown * (active ? 1.3 : 1), 8, delta));
    }
    materials.pad.opacity = MathUtils.damp(materials.pad.opacity, shown * (active ? 1 : 0.55), 8, delta);
    if (pad.current) pad.current.scale.setScalar(station.radius * (1 + Math.sin(t * 3) * 0.03));
    // Signs stay readable nearby and fade out across the park.
    const p = bodies.player?.translation();
    if (sign.current && p) {
      const dist = Math.hypot(p.x - station.x, p.z - station.z);
      sign.current.style.opacity = String(shown * MathUtils.clamp(1 - (dist - 24) / 14, 0, 1));
    }
  });

  return (
    <group position={[station.x, 0, station.z]}>
      <mesh ref={pad} material={materials.pad} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2, 2]} />
      </mesh>
      <group ref={gem}>
        <mesh material={materials.gem} scale={[0.22, 0.34, 0.22]}>
          <octahedronGeometry args={[1, 0]} />
        </mesh>
      </group>
      <Html position={[0, station.promptY + 0.75, 0]} center zIndexRange={[20, 0]} pointerEvents="none">
        <div ref={sign} className={`world-sign${near ? ' is-near' : ''}`} style={{ '--accent': station.color } as CSSProperties}>
          <Icon name={station.icon} size={18} />
          {near ? station.label : station.name}
          {near && !touch && <kbd>Enter</kbd>}
        </div>
      </Html>
    </group>
  );
}

/** Bobbing gems and name signs over each interaction point; the sign becomes a prompt up close. */
export function Markers() {
  const ring = useMemo(ringTexture, []);
  return (
    <>
      {STATIONS.map((s) => (
        <Marker key={s.id} station={s} ring={ring} />
      ))}
    </>
  );
}
