import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PMREMGenerator, type DirectionalLight } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bodies, world } from '../store';
import { GOLDEN, SUN_DIR } from './palette';

const SHADOW_EXTENT = 28;
/** A tighter shadow area on the light setting: fewer things to draw twice. */
const SHADOW_EXTENT_LOW = 20;

/** Low warm sun (its shadow camera follows the player), a sky fill and a soft front fill. */
export function Lights() {
  const sun = useRef<DirectionalLight>(null);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  // A soft studio reflection so metal (the PSP, camera and laptop) catches light.
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.35;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  const low = world.get().quality === 'low';
  const mapSize = low ? 1024 : 2048;
  const extent = low ? SHADOW_EXTENT_LOW : SHADOW_EXTENT;

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
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent}
        shadow-camera-bottom={-extent}
        shadow-camera-near={1}
        shadow-camera-far={100}
        shadow-bias={-0.0003}
        shadow-normalBias={0.04}
      />
    </>
  );
}
