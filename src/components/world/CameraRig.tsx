import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { COURT, GOAL, SPAWN, stationById } from './layout';
import { bodies, fx, world } from './store';

/** Gameplay camera offset from the player: behind and above, looking north. */
const OFFSET = new Vector3(0, 8.6, 10.2);
const INTRO_TIME = 2.6;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function CameraRig() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const gl = useThree((s) => s.gl);
  const rig = useMemo(
    () => ({
      focus: new Vector3(SPAWN.x, 0, SPAWN.z),
      ahead: new Vector3(),
      position: new Vector3(SPAWN.x, 24, SPAWN.z + 30),
      look: new Vector3(SPAWN.x, 0, SPAWN.z),
      desiredPos: new Vector3(),
      desiredLook: new Vector3(),
      zoom: 1,
      targetZoom: 1,
      intro: 0
    }),
    []
  );

  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (world.get().mode !== 'play') return;
      rig.targetZoom = MathUtils.clamp(rig.targetZoom * Math.exp(e.deltaY * 0.001), 0.6, 1.8);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [gl, rig]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const { started, mode, station } = world.get();
    const body = bodies.player;
    const p = body?.translation();
    const v = body?.linvel();
    if (p) {
      rig.focus.set(p.x, Math.max(0, p.y) * 0.4, p.z);
      // Look a little ahead of where the player is running.
      rig.ahead.x = MathUtils.damp(rig.ahead.x, (v?.x ?? 0) * 0.35, 2.5, dt);
      rig.ahead.z = MathUtils.damp(rig.ahead.z, (v?.z ?? 0) * 0.35, 2.5, dt);
    }
    rig.zoom = MathUtils.damp(rig.zoom, rig.targetZoom, 6, dt);
    const aspect = state.size.width / state.size.height;
    const portrait = aspect < 1 ? 1 + (1 - aspect) * 0.9 : 1;
    let lambda = 4.5;

    const view = mode === 'station' && station ? stationById[station].view : undefined;
    if (view) {
      // Back off from the screen until all of it fits the viewport.
      const vfov = MathUtils.degToRad(camera.fov);
      const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
      const dist = Math.max(view.height / (2 * Math.tan(vfov / 2)), view.width / (2 * Math.tan(hfov / 2))) * 1.12;
      const n = view.normal;
      const len = Math.hypot(n[0], n[1], n[2]);
      rig.desiredLook.set(...view.target);
      rig.desiredPos.set(view.target[0] + (n[0] / len) * dist, view.target[1] + (n[1] / len) * dist, view.target[2] + (n[2] / len) * dist);
      lambda = 3.6;
    } else if ((mode === 'soccer' || mode === 'basketball') && p) {
      // Behind the ball (or the shooter), looking toward the goal or hoop.
      const tx = mode === 'soccer' ? GOAL.x : COURT.rim.x;
      const tz = mode === 'soccer' ? GOAL.z : COURT.rim.z;
      const ball = bodies.ball?.translation();
      const onBall = mode === 'soccer' && ball && ball.y < 0.6 && Math.hypot(ball.x - p.x, ball.z - p.z) < 4;
      const ax = onBall ? ball.x : p.x;
      const az = onBall ? ball.z : p.z;
      const dx = ax - tx;
      const dz = az - tz;
      const len = Math.hypot(dx, dz) || 1;
      const back = (mode === 'soccer' ? 6.5 : 6.2) * portrait;
      const height = (mode === 'soccer' ? 3.6 : 4.6) * portrait;
      rig.desiredPos.set(ax + (dx / len) * back, height, az + (dz / len) * back);
      rig.desiredLook.set(MathUtils.lerp(ax, tx, 0.45), mode === 'soccer' ? 1 : 2, MathUtils.lerp(az, tz, 0.45));
      lambda = 3.2;
    } else {
      const d = rig.zoom * portrait;
      rig.desiredLook.set(rig.focus.x + rig.ahead.x, rig.focus.y + 1, rig.focus.z + rig.ahead.z);
      rig.desiredPos.set(rig.desiredLook.x + OFFSET.x * d, rig.focus.y + OFFSET.y * d, rig.desiredLook.z + OFFSET.z * d);
    }

    // Before kick-off the camera drifts high above the field, then swoops down.
    rig.intro = started ? Math.min(1, rig.intro + dt / INTRO_TIME) : 0;
    if (rig.intro < 1) {
      const e = easeInOutCubic(rig.intro);
      const sway = Math.sin(state.clock.elapsedTime * 0.12) * 0.45;
      const introPos = new Vector3(SPAWN.x + Math.sin(sway) * 34, 26, SPAWN.z - 8 + Math.cos(sway) * 34);
      rig.position.copy(introPos.lerp(rig.desiredPos, e));
      rig.look.set(SPAWN.x, 0, SPAWN.z - 8).lerp(rig.desiredLook, e);
    } else {
      rig.position.x = MathUtils.damp(rig.position.x, rig.desiredPos.x, lambda, dt);
      rig.position.y = MathUtils.damp(rig.position.y, rig.desiredPos.y, lambda, dt);
      rig.position.z = MathUtils.damp(rig.position.z, rig.desiredPos.z, lambda, dt);
      rig.look.x = MathUtils.damp(rig.look.x, rig.desiredLook.x, lambda + 1, dt);
      rig.look.y = MathUtils.damp(rig.look.y, rig.desiredLook.y, lambda + 1, dt);
      rig.look.z = MathUtils.damp(rig.look.z, rig.desiredLook.z, lambda + 1, dt);
    }

    const shake = fx.shake;
    fx.shake = Math.max(0, fx.shake - dt * 1.5);
    camera.position.set(
      rig.position.x + (Math.random() - 0.5) * shake,
      rig.position.y + (Math.random() - 0.5) * shake,
      rig.position.z
    );
    camera.lookAt(rig.look);
    const fwdX = rig.look.x - rig.position.x;
    const fwdZ = rig.look.z - rig.position.z;
    const len = Math.hypot(fwdX, fwdZ) || 1;
    fx.camRight.x = -fwdZ / len;
    fx.camRight.z = fwdX / len;
  });

  return null;
}
