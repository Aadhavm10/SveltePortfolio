import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { CameraRig } from './CameraRig';
import { Hud } from './Hud';
import { Scene } from './Scene';
import { bindKeyboard } from './input';
import { setMuted } from './sound';
import { MUTE_KEY, PHYSICS_STEP, useWorld, world } from './store';
import './world.css';

const SKY = '#cde8f3';

export default function World() {
  const [fontsReady, setFontsReady] = useState(false);
  const touch = useWorld((s) => s.touch);

  useEffect(() => {
    let muted = false;
    try {
      muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Storage can be unavailable (private mode); sound just defaults to on.
    }
    setMuted(muted);
    world.set({ touch: window.matchMedia('(pointer: coarse)').matches, muted });

    // Canvas textures draw with Inter, so wait for it (but never block on it for long).
    const fonts = Promise.all(
      ['500', '700', '800', '900'].map((weight) => document.fonts.load(`${weight} 64px "Inter Variable"`))
    );
    const timeout = new Promise((resolve) => setTimeout(resolve, 3000));
    Promise.race([fonts, timeout])
      .catch(() => {})
      .finally(() => setFontsReady(true));

    return bindKeyboard();
  }, []);

  return (
    <div className="world">
      <Canvas
        shadows
        dpr={[1, touch ? 1.5 : 2]}
        camera={{ fov: 40, near: 0.5, far: 240, position: [0, 24, 32] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        fallback={
          <div className="world-fallback">
            Your browser can't show the 3D world. <a href="/classic">Visit the classic site →</a>
          </div>
        }
      >
        <color attach="background" args={[SKY]} />
        <fog attach="fog" args={[SKY, 60, 130]} />
        {fontsReady && (
          <Suspense fallback={null}>
            <Physics gravity={[0, -15, 0]} timeStep={PHYSICS_STEP}>
              <Scene />
            </Physics>
          </Suspense>
        )}
        <CameraRig />
      </Canvas>
      <Hud />
    </div>
  );
}
