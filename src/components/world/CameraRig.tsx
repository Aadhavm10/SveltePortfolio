import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3 } from 'three';
import { bodies, fx, world } from './store';
import { SPAWN } from './zones';

/** Gameplay camera offset from the player: high and behind, looking north. */
const OFFSET = new Vector3(0, 11, 9.5);
const INTRO_TIME = 2.4;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const rig = useMemo(() => ({ focus: new Vector3(SPAWN.x, 0, SPAWN.z), zoom: 1, targetZoom: 1, intro: 0 }), []);

  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      rig.targetZoom = MathUtils.clamp(rig.targetZoom * Math.exp(e.deltaY * 0.001), 0.6, 1.7);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [gl, rig]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const p = bodies.player?.translation();
    if (p) {
      rig.focus.x = MathUtils.damp(rig.focus.x, p.x, 5, dt);
      rig.focus.z = MathUtils.damp(rig.focus.z, p.z, 5, dt);
      rig.focus.y = MathUtils.damp(rig.focus.y, Math.max(0, p.y) * 0.4, 5, dt);
    }

    rig.intro = world.get().started ? Math.min(1, rig.intro + dt / INTRO_TIME) : 0;
    const e = easeInOutCubic(rig.intro);
    rig.zoom = MathUtils.damp(rig.zoom, rig.targetZoom, 6, dt);
    // Portrait screens pull the camera back so the player has room around them.
    const aspect = state.size.width / state.size.height;
    const d = rig.zoom * (aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1);

    // Before kick-off the camera drifts high above the spawn.
    const sway = Math.sin(state.clock.elapsedTime * 0.15) * 0.5;
    const shake = fx.shake;
    fx.shake = Math.max(0, fx.shake - dt * 1.5);

    camera.position.set(
      rig.focus.x + MathUtils.lerp(Math.sin(sway) * 30, OFFSET.x * d, e) + (Math.random() - 0.5) * shake,
      rig.focus.y + MathUtils.lerp(24, OFFSET.y * d, e) + (Math.random() - 0.5) * shake,
      rig.focus.z + MathUtils.lerp(Math.cos(sway) * 30, OFFSET.z * d, e)
    );
    camera.lookAt(rig.focus.x, rig.focus.y + 0.9, rig.focus.z);
  });

  return null;
}
