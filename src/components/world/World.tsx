import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { CameraRig } from './CameraRig';
import { Hud } from './Hud';
import { Scene } from './Scene';
import { bindKeyboard } from './input';
import { setMuted } from './sound';
import { GOLDEN } from './env/palette';
import { MUTE_KEY, PHYSICS_STEP, useWorld, world } from './store';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './world.css';

export default function World() {
  const [fontsReady, setFontsReady] = useState(false);
  const quality = useWorld((s) => s.quality);

  useEffect(() => {
    let muted = false;
    try {
      muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      // Storage can be unavailable (private mode); sound just defaults to on.
    }
    setMuted(muted);
    const touch = window.matchMedia('(pointer: coarse)').matches;
    world.set({ touch, muted, quality: touch ? 'low' : 'high' });

    // Canvas textures draw with these fonts, so wait for them (but never block on it for long).
    const fonts = Promise.all([
      ...['500', '700', '800', '900'].map((weight) => document.fonts.load(`${weight} 64px "Nunito Variable"`)),
      ...['500', '600', '700'].map((weight) => document.fonts.load(`${weight} 64px "Fredoka Variable"`))
    ]);
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
        dpr={quality === 'low' ? 1 : [1, 2]}
        camera={{ fov: 42, near: 0.3, far: 400, position: [0, 26, 30] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 1.25;
          // Software renderers can't keep up with the full scene.
          const context = gl.getContext();
          const info = context.getExtension('WEBGL_debug_renderer_info');
          const renderer = String(info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : '');
          if (/swiftshader|llvmpipe|software/i.test(renderer)) world.set({ quality: 'low' });
        }}
        fallback={
          <div className="world-fallback">
            Your browser can't show the 3D world. <a href="/classic">Visit the classic site →</a>
          </div>
        }
      >
        <color attach="background" args={[GOLDEN.fog]} />
        <fog attach="fog" args={[GOLDEN.fog, 55, 165]} />
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
