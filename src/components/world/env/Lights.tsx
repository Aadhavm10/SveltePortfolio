import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, MathUtils, PMREMGenerator, type DirectionalLight, type HemisphereLight } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bodies, fx, world } from '../store';
import { GOLDEN, SUN_DIR } from './palette';

const SHADOW_EXTENT = 28;
/** A tighter shadow area on the light setting: fewer things to draw twice. */
const SHADOW_EXTENT_LOW = 20;

/** Low warm sun (its shadow camera follows the player), a sky fill and a soft front fill. */
export function Lights() {
  const sun = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const fill = useRef<DirectionalLight>(null);
  const tones = useMemo(() => ({ sky: new Color(GOLDEN.hemiSky), duskSky: new Color('#7f78c0') }), []);
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

  useFrame(({ camera }, delta) => {
    // Dusk falls while you're at my room, so its lamps glow.
    fx.evening = MathUtils.damp(fx.evening, world.get().station === 'room' ? 1 : 0, 1.6, Math.min(delta, 0.1));
    const e = fx.evening;
    if (hemi.current) {
      hemi.current.intensity = MathUtils.lerp(1.45, 0.42, e);
      hemi.current.color.copy(tones.sky).lerp(tones.duskSky, e);
    }
    if (fill.current) fill.current.intensity = MathUtils.lerp(0.8, 0.1, e);
    // Reflections would light the room's insides evenly; let them fade so the lamps carry it.
    scene.environmentIntensity = MathUtils.lerp(0.35, 0.06, e);
    const light = sun.current;
    if (!light) return;
    light.intensity = MathUtils.lerp(4.4, 1.8, e);
    const p = bodies.player?.translation();
    const x = p?.x ?? camera.position.x;
    const z = p ? p.z - 4 : camera.position.z - 12;
    light.position.set(x + SUN_DIR.x * 40, SUN_DIR.y * 40, z + SUN_DIR.z * 40);
    light.target.position.set(x, 0, z);
    light.target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={[GOLDEN.hemiSky, GOLDEN.hemiGround, 1.45]} />
      {/* Soft fill from the camera's side so faces and screens aren't lost against the low sun. */}
      <directionalLight ref={fill} color="#ffe3c8" intensity={0.8} position={[12, 14, 30]} />
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
