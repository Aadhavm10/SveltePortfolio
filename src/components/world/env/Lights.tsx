import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { DirectionalLight } from 'three';
import { bodies, world } from '../store';
import { GOLDEN, SUN_DIR } from './palette';

const SHADOW_EXTENT = 28;

/** Low warm sun (its shadow camera follows the player), a sky fill and a soft front fill. */
export function Lights() {
  const sun = useRef<DirectionalLight>(null);
  const mapSize = world.get().quality === 'low' ? 1024 : 2048;

  useFrame(({ camera }) => {
    const light = sun.current;
    if (!light) return;
    const p = bodies.player?.translation();
    const x = p?.x ?? camera.position.x;
    const z = p ? p.z - 4 : camera.position.z - 12;
    light.position.set(x + SUN_DIR.x * 40, SUN_DIR.y * 40, z + SUN_DIR.z * 40);
    light.target.position.set(x, 0, z);
    light.target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={[GOLDEN.hemiSky, GOLDEN.hemiGround, 1.45]} />
      {/* Soft fill from the camera's side so faces and screens aren't lost against the low sun. */}
      <directionalLight color="#ffe3c8" intensity={0.8} position={[12, 14, 30]} />
      <directionalLight
        ref={sun}
        castShadow
        color={GOLDEN.sunLight}
        intensity={4.4}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />
    </>
  );
}
