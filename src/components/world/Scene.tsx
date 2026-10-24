import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { DirectionalLight } from 'three';
import { Areas } from './Areas';
import { Ball } from './Ball';
import { Pitch } from './Pitch';
import { Player } from './Player';
import { Spawn } from './Spawn';
import { Terrain } from './Terrain';
import { bodies, world } from './store';

/** Warm afternoon sun whose shadow camera follows the player. */
function Sun() {
  const light = useRef<DirectionalLight>(null);
  const mapSize = world.get().touch ? 1024 : 2048;

  useFrame(() => {
    const p = bodies.player?.translation();
    const sun = light.current;
    if (!p || !sun) return;
    sun.position.set(p.x + 14, 24, p.z + 10);
    sun.target.position.set(p.x, 0, p.z);
    sun.target.updateMatrixWorld();
  });

  return (
    <directionalLight
      ref={light}
      castShadow
      color="#fff1d9"
      intensity={2.6}
      position={[14, 24, 12]}
      shadow-mapSize={[mapSize, mapSize]}
      shadow-camera-left={-26}
      shadow-camera-right={26}
      shadow-camera-top={26}
      shadow-camera-bottom={-26}
      shadow-camera-near={1}
      shadow-camera-far={70}
      shadow-bias={-0.0004}
      shadow-normalBias={0.03}
    />
  );
}

export function Scene() {
  useEffect(() => {
    world.set({ ready: true });
  }, []);

  return (
    <>
      <hemisphereLight args={['#e3f4ff', '#6b9a4a', 1.15]} />
      <Sun />
      <Terrain />
      <Spawn />
      <Areas />
      <Pitch />
      <Player />
      <Ball />
    </>
  );
}
