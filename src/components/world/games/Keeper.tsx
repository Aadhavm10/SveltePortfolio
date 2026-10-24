import { useMemo, useRef } from 'react';
import { BallCollider, CapsuleCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { MathUtils, Quaternion, Euler } from 'three';
import { Character, createPose, KEEPER } from '../Character';
import { GOAL } from '../layout';
import { playBump } from '../sound';
import { bodies, PHYSICS_STEP } from '../store';

const LINE_Z = GOAL.z + 0.55;
const REACTION = 0.2;
const DIVE_TIME = 0.42;
const MAX_REACH = GOAL.width / 2 - 0.35;

/** performance.now() of the keeper's last touch on the ball; read by the shooting challenge. */
export const keeperTouch = { at: 0 };

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);

/** An AI goalkeeper: shuffles with the ball, then dives at shots it can read in time. */
export function Keeper() {
  const body = useRef<RapierRigidBody>(null);
  const pose = useMemo(() => ({ ...createPose(), ready: 1 }), []);
  const k = useMemo(
    () => ({
      x: GOAL.x,
      time: 0,
      reactAt: -1,
      diveT: -1,
      fromX: 0,
      toX: 0,
      lift: 0,
      dir: 1,
      roll: 0,
      height: 0,
      quat: new Quaternion(),
      euler: new Euler()
    }),
    []
  );

  useBeforePhysicsStep(() => {
    const rb = body.current;
    const ball = bodies.ball;
    if (!rb) return;
    bodies.keeper = rb;
    const dt = PHYSICS_STEP;
    k.time += dt;

    if (k.diveT >= 0) {
      k.diveT += dt;
      const p = easeOut(Math.min(1, k.diveT / DIVE_TIME));
      k.x = MathUtils.lerp(k.fromX, k.toX, p);
      k.roll = -k.dir * 1.35 * p;
      k.height = Math.sin(Math.min(1, k.diveT / (DIVE_TIME * 1.6)) * Math.PI) * k.lift + 0.12 * p;
      pose.dive = p;
      pose.ready = 1 - p;
      if (k.diveT > 1.5) {
        k.diveT = -1;
        k.reactAt = -1;
      }
    } else {
      // Get back up and square to the ball.
      k.roll = MathUtils.damp(k.roll, 0, 8, dt);
      k.height = MathUtils.damp(k.height, 0, 8, dt);
      pose.dive = MathUtils.damp(pose.dive, 0, 8, dt);
      pose.ready = MathUtils.damp(pose.ready, 1, 6, dt);
      let target = GOAL.x;
      if (ball) {
        const bp = ball.translation();
        const bv = ball.linvel();
        if (bp.z > LINE_Z && bp.z < LINE_Z + 36) target = GOAL.x + MathUtils.clamp((bp.x - GOAL.x) * 0.22, -1.4, 1.4);

        // Read a shot heading for goal.
        const tc = bv.z < -5 ? (LINE_Z - bp.z) / bv.z : -1;
        if (tc > 0 && tc < 1.8 && bp.z > LINE_Z) {
          const px = bp.x + bv.x * tc;
          const py = bp.y + bv.y * tc - 7.5 * tc * tc;
          if (Math.abs(px - GOAL.x) < GOAL.width / 2 + 1 && py < GOAL.height + 0.6) {
            if (k.reactAt < 0) k.reactAt = k.time + REACTION + Math.random() * 0.08;
            if (k.time >= k.reactAt) {
              let aimX = MathUtils.clamp(px, GOAL.x - MAX_REACH, GOAL.x + MAX_REACH);
              // Sometimes he guesses wrong.
              if (Math.random() < 0.12) aimX = GOAL.x - (aimX - GOAL.x);
              if (Math.abs(aimX - k.x) < 0.7 && py < 1.6) {
                target = aimX;
              } else {
                k.diveT = 0;
                k.fromX = k.x;
                k.toX = aimX;
                k.dir = Math.sign(aimX - k.x) || 1;
                k.lift = MathUtils.clamp(py - 0.35, 0.15, 1.1);
              }
            }
          }
        } else {
          k.reactAt = -1;
        }
      }
      const step = 3.2 * dt;
      k.x += MathUtils.clamp(target - k.x, -step, step);
    }

    rb.setNextKinematicTranslation({ x: k.x, y: k.height, z: LINE_Z });
    k.quat.setFromEuler(k.euler.set(0, 0, k.roll));
    rb.setNextKinematicRotation(k.quat);
  });

  return (
    <RigidBody
      ref={body}
      type="kinematicPosition"
      colliders={false}
      position={[GOAL.x, 0, LINE_Z]}
      onCollisionEnter={({ other }) => {
        if (other.rigidBody && other.rigidBody === bodies.ball) {
          keeperTouch.at = performance.now();
          playBump(4);
        }
      }}
    >
      <CapsuleCollider args={[0.55, 0.3]} position={[0, 0.87, 0]} />
      {/* Outstretched gloves */}
      <BallCollider args={[0.28]} position={[0, 1.95, 0.05]} />
      <group scale={0.92}>
        <Character pose={pose} look={KEEPER} />
      </group>
    </RigidBody>
  );
}
