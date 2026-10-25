import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { CameraRig } from './CameraRig';
import { Hud } from './Hud';
import { Scene } from './Scene';
import { bindKeyboard } from './input';
import { setMuted, setMusicOn } from './sound';
import { GOLDEN } from './env/palette';
import { MUSIC_KEY, MUTE_KEY, PHYSICS_STEP, useWorld, world } from './store';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './world.css';

export default function World() {
  const [fontsReady, setFontsReady] = useState(false);
  const [dprCap, setDprCap] = useState(2);
  const quality = useWorld((s) => s.quality);
  const ready = useWorld((s) => s.ready);

  // Fade out the plain HTML loading screen once the park is ready behind it.
  useEffect(() => {
    if (!ready) return;
    const shell = document.getElementById('world-shell');
    if (!shell) return;
    shell.style.transition = 'opacity 0.5s ease';
    shell.style.opacity = '0';
    const t = setTimeout(() => shell.remove(), 550);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    let muted = false;
    let music = true;
    try {
      muted = localStorage.getItem(MUTE_KEY) === '1';
      music = localStorage.getItem(MUSIC_KEY) !== '0';
    } catch {
      // Storage can be unavailable (private mode); sound just defaults to on.
    }
    setMuted(muted);
    setMusicOn(music);
    const touch = window.matchMedia('(pointer: coarse)').matches;
    // Pick a starting quality from what the device tells us; the frame rate can lower it later.
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const memory = nav.deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 8;
    const weak = memory <= 4 || cores <= 4;
    const lowEnd = memory <= 2 || !!nav.connection?.saveData;
    world.set({ touch, muted, music, quality: touch || weak ? 'low' : 'high', lowEnd });

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
        dpr={quality === 'low' ? [1, 1.25] : [1, dprCap]}
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
            Your browser can't show the 3D world. <a href="/classic">Visit the classic site</a>
          </div>
        }
      >
        {/* If frames start dropping: first a lower resolution, then the lighter scene. */}
        <PerformanceMonitor
          flipflops={3}
          onDecline={() => {
            if (dprCap > 1.25) setDprCap(1.25);
            else world.set({ quality: 'low' });
          }}
          onIncline={() => setDprCap(2)}
          onFallback={() => world.set({ quality: 'low' })}
        />
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
