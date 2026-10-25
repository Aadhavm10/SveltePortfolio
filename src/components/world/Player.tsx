import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CapsuleCollider, RigidBody, useBeforePhysicsStep, type RapierRigidBody } from '@react-three/rapier';
import { DoubleSide, Group, MathUtils, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { AADHAV, Character, createPose } from './Character';
import { BALL_MASS, BALL_RADIUS } from './Ball';
import { basketball } from './games/basketballState';
import { HeldBasketball } from './games/Court';
import { input, isShootHeld, readMove } from './input';
import { groundOffset, inWater } from './env/Streams';
import { BOUNDS, COURT, GOAL, SPAWN, STATIONS } from './layout';
import { playKick, playStep, playTouch, type Surface } from './sound';
import { bodies, fx, PHYSICS_STEP, world } from './store';

const RUN_SPEED = 5.6;
const SPRINT_SPEED = 8.8;
/** Exponential smoothing rates for speeding up, slowing down and turning. */
const ACCEL = 7;
const BRAKE = 11;
const TURN = 11;
const CHARGE_TIME = 0.85;
/** While charging a kick you stand still and left/right swings the aim, up to AIM_RANGE either way. */
const AIM_TURN = 0.9;
const AIM_RANGE = 0.65;
const KICK_TIME = 0.42;
/** How far the ball can be (centre to centre, metres) for a dribble touch or shot. */
const TOUCH_REACH = 1.3;
const KICK_REACH = 1.75;
/** The ball sits just off the right foot so it stays visible past the body. */
const FOOT_OFFSET = 0.28;

const NO_MOVE = { x: 0, z: 0, amount: 0, sprint: false };

/**
 * The point on the goal mouth a shot would go to: where the player's facing crosses the goal line,
 * kept inside the posts. Harder shots fly higher (still under the bar). Null when not facing the goal.
 */
export function goalAim(fromX: number, fromZ: number, yaw: number, charge: number) {
  const dz = GOAL.z + 0.2 - fromZ;
  const fz = Math.cos(yaw);
  if (dz > -1.5 || dz < -34 || fz > -0.3) return null;
  const crossX = fromX + Math.sin(yaw) * (dz / fz);
  if (Math.abs(crossX - GOAL.x) > GOAL.width / 2 + 3) return null;
  const half = GOAL.width / 2 - 0.35;
  return { x: MathUtils.clamp(crossX, GOAL.x - half, GOAL.x + half), y: 0.35 + charge * 1.4 };
}

/** Moves `current` toward `target` along the shortest arc. */
function dampAngle(current: number, target: number, lambda: number, dt: number) {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + diff * (1 - Math.exp(-lambda * dt));
}

/** Requests from games (e.g. "stand behind the ball for the next shot"), consumed on the next physics step. */
export const playerCommands: { teleport: { x: number; z: number; yaw: number } | null } = { teleport: null };

export function Player() {
  const body = useRef<RapierRigidBody>(null);
  const model = useRef<Group>(null);
  const aim = useRef<Group>(null);
  const ripples = useRef<Group>(null);
  const aimShaft = useRef<Mesh>(null);
  const aimHead = useRef<Mesh>(null);
  const pose = useMemo(createPose, []);
  const aimMaterial = useMemo(
    () =>
      new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: DoubleSide }),
    []
  );
  const shaftGeometry = useMemo(() => new PlaneGeometry(0.14, 1).translate(0, 0.5, 0), []);
  const s = useMemo(
    () => ({
      vx: 0,
      vz: 0,
      yaw: Math.PI,
      fx: 0,
      fz: -1,
      charging: false,
      charge: 0,
      aimBase: 0,
      aimOffset: 0,
      aimMin: 0,
      aimMax: 0,
      kickT: -1,
      kickPower: 0,
      kicked: false,
      shootT: -1,
      shotAt: -1,
      touchCooldown: 0,
      lastGoal: 0,
      time: 0,
      ballResetAt: -1,
      nearTimer: 0
    }),
    []
  );

  // Gameplay runs in the fixed physics step so it feels the same at any frame rate.
  useBeforePhysicsStep(() => {
    const rb = body.current;
    if (!rb) return;
    bodies.player = rb;
    const dt = PHYSICS_STEP;
    s.time += dt;
    const { started, mode, goalAt, challenge, mapOpen } = world.get();

    if (playerCommands.teleport) {
      const t = playerCommands.teleport;
      playerCommands.teleport = null;
      rb.setTranslation({ x: t.x, y: 0.05, z: t.z }, true);
      rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
      s.vx = s.vz = 0;
      s.yaw = t.yaw;
    }

    // Free-play goal celebration
    if (goalAt && goalAt !== s.lastGoal) {
      s.lastGoal = goalAt;
      pose.celebrate = 0;
      s.ballResetAt = s.time + 2.2;
      if (rb.translation().y < 0.1) rb.setLinvel({ x: 0, y: 6.5, z: 0 }, true);
    }
    if (pose.celebrate >= 0) {
      pose.celebrate += dt;
      if (pose.celebrate > 2.4) pose.celebrate = -1;
    }

    const celebrating = pose.celebrate >= 0 && pose.celebrate < 1.6;
    const countdown = challenge?.phase === 'countdown' || challenge?.phase === 'done';
    const locked = !started || mapOpen || mode === 'station' || celebrating || countdown;
    const move = locked ? NO_MOVE : readMove();
    if (move.amount > 0 && !world.get().moved) world.set({ moved: true });
    const hoops = mode === 'basketball';

    // Velocity eases toward the target; braking is quicker than speeding up. Wading is a little slower.
    const here = rb.translation();
    const offset = groundOffset(here.x, here.z);
    const wading = offset < -0.05;
    const slow = (s.charging ? (hoops ? 0.4 : 0) : s.kickT >= 0 || s.shootT >= 0 ? 0.3 : 1) * (wading ? 0.8 : 1);
    const maxSpeed = (move.sprint && !hoops ? SPRINT_SPEED : RUN_SPEED) * slow * move.amount;
    const tx = move.x * maxSpeed;
    const tz = move.z * maxSpeed;
    const speeding = tx * tx + tz * tz > s.vx * s.vx + s.vz * s.vz;
    const k = 1 - Math.exp(-(speeding ? ACCEL : BRAKE) * dt);
    s.vx += (tx - s.vx) * k;
    s.vz += (tz - s.vz) * k;
    const lv = rb.linvel();
    rb.setLinvel({ x: s.vx, y: lv.y, z: s.vz }, true);

    // Facing and lean
    const prevYaw = s.yaw;
    if (pose.celebrate >= 0) s.yaw = dampAngle(s.yaw, 0, 7, dt);
    else if (hoops && (s.charging || s.shootT >= 0)) s.yaw = dampAngle(s.yaw, basketball.aimYaw(rb.translation()), 14, dt);
    else if (s.charging) {
      // Left/right swing the shot left/right as seen from the camera.
      const r = fx.camRight;
      const toRight = Math.cos(s.yaw) * r.x - Math.sin(s.yaw) * r.z < 0 ? -1 : 1;
      s.aimOffset = MathUtils.clamp(s.aimOffset + move.x * AIM_TURN * dt * toRight, s.aimMin, s.aimMax);
      s.yaw = dampAngle(s.yaw, s.aimBase + s.aimOffset, 14, dt);
    } else if (move.amount > 0.05) s.yaw = dampAngle(s.yaw, Math.atan2(move.x, move.z), TURN, dt);
    s.fx = Math.sin(s.yaw);
    s.fz = Math.cos(s.yaw);
    fx.facing.x = s.fx;
    fx.facing.z = s.fz;
    const speed = Math.hypot(lv.x, lv.z);
    const turnRate = Math.atan2(Math.sin(s.yaw - prevYaw), Math.cos(s.yaw - prevYaw)) / dt;
    pose.lean = MathUtils.damp(pose.lean, MathUtils.clamp(-turnRate * speed * 0.018, -0.3, 0.3), 8, dt);

    // Run cycle
    pose.speed = speed;
    const prevPhase = pose.phase;
    if (speed > 0.3) pose.phase += dt * (2.4 + speed * 1.4);
    const stepped = Math.floor(prevPhase / Math.PI) !== Math.floor(pose.phase / Math.PI);
    if (stepped && speed > 1 && rb.translation().y < 0.2) {
      const onCourt = here.x > COURT.minX && here.x < COURT.maxX && here.z > COURT.minZ && here.z < COURT.maxZ;
      const surface: Surface = offset > 0.05 ? 'wood' : wading ? 'water' : onCourt ? 'hard' : 'grass';
      playStep(surface, speed);
    }
    pose.touch = Math.max(0, pose.touch - dt * 5);

    const pp = rb.translation();
    const shootHeld = !locked && isShootHeld();
    if (locked && s.charging) {
      s.charging = false;
      pose.charge = 0;
      fx.aim.visible = false;
    }

    // Basketball: hold to dip, release to shoot.
    pose.hold = MathUtils.damp(pose.hold, hoops && basketball.holding ? 1 : 0, 12, dt);
    if (hoops) {
      if (shootHeld && !s.charging && s.shootT < 0 && basketball.holding) {
        s.charging = true;
        s.charge = 0;
      }
      if (s.charging) {
        s.charge = Math.min(1, s.charge + dt / basketball.chargeTime);
        pose.charge = s.charge;
        if (!shootHeld) {
          s.charging = false;
          pose.charge = 0;
          s.shootT = 0;
          basketball.shoot(pp, s.charge);
        }
      }
      if (s.shootT >= 0) {
        s.shootT += dt;
        pose.shoot = Math.min(1, s.shootT / 0.6);
        if (s.shootT > 0.6) {
          s.shootT = -1;
          pose.shoot = 0;
        }
      }
      fx.charge = s.charging ? s.charge : 0;
      return;
    }
    fx.charge = s.charging ? s.charge : 0;

    const ball = bodies.ball;
    if (!ball || mode === 'station') return;

    const bp = ball.translation();
    const bv = ball.linvel();
    const bx = bp.x - pp.x;
    const bz = bp.z - pp.z;
    const ballDist = Math.hypot(bx, bz);
    const ahead = bx * s.fx + bz * s.fz;
    const ballLow = bp.y < 0.6;

    // Cushion a ball rolling at the player so it can be controlled.
    const incoming = -(bv.x * bx + bv.z * bz) / (ballDist || 1);
    if (ballLow && ballDist < 1.4 && incoming > 2.5 && s.kickT < 0) {
      const c = 0.7 * BALL_MASS;
      ball.applyImpulse({ x: (s.vx - bv.x) * c, y: 0, z: (s.vz - bv.z) * c }, true);
    }

    // Dribble: on each stride, if we've caught up with the ball, knock it ahead.
    s.touchCooldown -= dt;
    const canTouch = move.amount > 0.1 && ballLow && !s.charging && s.kickT < 0 && s.touchCooldown <= 0;
    if (canTouch && ballDist < TOUCH_REACH && (ahead > -0.1 || ballDist < 0.62)) {
      const lead = 0.7 + speed * 0.08 + (move.sprint ? 0.3 : 0);
      if ((stepped && ahead < lead * 0.85) || ballDist < 0.7) {
        const push = move.sprint ? 1.3 : 1.18;
        const pace = Math.max(speed, 2) * push;
        const targetX = pp.x + s.fx * lead - s.fz * FOOT_OFFSET;
        const targetZ = pp.z + s.fz * lead + s.fx * FOOT_OFFSET;
        const wantX = s.fx * pace + (targetX - bp.x) * 2.6;
        const wantZ = s.fz * pace + (targetZ - bp.z) * 2.6;
        ball.applyImpulse({ x: (wantX - bv.x) * BALL_MASS, y: 0, z: (wantZ - bv.z) * BALL_MASS }, true);
        ball.setAngvel({ x: wantZ / BALL_RADIUS, y: 0, z: -wantX / BALL_RADIUS }, true);
        s.touchCooldown = 0.18;
        pose.touch = 1;
        pose.touchSide = Math.sin(pose.phase) > 0 ? -1 : 1;
        playTouch(Math.min(1, speed / SPRINT_SPEED));
      }
    }

    // Trap: standing still settles a loose ball at the feet.
    if (move.amount === 0 && ballLow && ballDist < 1.1 && Math.hypot(bv.x, bv.z) < 5 && s.kickT < 0) {
      const t = Math.min(1, dt * 5) * BALL_MASS;
      ball.applyImpulse({ x: -bv.x * t, y: 0, z: -bv.z * t }, true);
    }

    if (s.shotAt >= 0 && s.time - s.shotAt > 1.3) s.shotAt = -1;
    // Water slows a rolling ball.
    if (s.shotAt < 0) ball.setLinearDamping(inWater(bp.x, bp.z) ? 2.2 : 0.55);

    // Shooting: hold to charge, release to strike.
    if (shootHeld && !s.charging && s.kickT < 0) {
      s.charging = true;
      s.charge = 0;
      s.aimOffset = 0;
      // Lining up roughly at goal with the ball at your feet: square up to the goal's centre.
      const toGoal = Math.atan2(GOAL.x - bp.x, GOAL.z - bp.z);
      const off = Math.atan2(Math.sin(toGoal - s.yaw), Math.cos(toGoal - s.yaw));
      if (ballDist < KICK_REACH && bp.z > GOAL.z && Math.abs(off) < 0.8) {
        // Keep the aim between the posts.
        s.aimBase = toGoal;
        const half = GOAL.width / 2 - 0.35;
        const post = (x: number) => {
          const a = Math.atan2(x - bp.x, GOAL.z - bp.z) - toGoal;
          return Math.atan2(Math.sin(a), Math.cos(a));
        };
        const a = post(GOAL.x - half);
        const b = post(GOAL.x + half);
        s.aimMin = Math.min(a, b) - 0.04;
        s.aimMax = Math.max(a, b) + 0.04;
      } else {
        s.aimBase = s.yaw;
        s.aimMin = -AIM_RANGE;
        s.aimMax = AIM_RANGE;
      }
    }
    if (s.charging) {
      s.charge = Math.min(1, s.charge + dt / CHARGE_TIME);
      pose.charge = s.charge;
      const target = ballDist < KICK_REACH ? goalAim(bp.x, bp.z, s.yaw, s.charge) : null;
      fx.aim.visible = !!target;
      if (target) {
        fx.aim.x = target.x;
        fx.aim.y = target.y;
      }
      if (!shootHeld) {
        s.charging = false;
        s.kickT = 0;
        s.kicked = false;
        s.kickPower = s.charge;
        pose.charge = 0;
        fx.aim.visible = false;
      }
    }
    if (s.kickT >= 0) {
      s.kickT += dt;
      pose.kick = Math.min(1, s.kickT / KICK_TIME);
      if (!s.kicked && s.kickT > 0.09) {
        s.kicked = true;
        if (ballDist < KICK_REACH && ahead > -0.25 && bp.y < 1.2) {
          const p = s.kickPower;
          let vx = s.fx * (7 + p * 20);
          let vz = s.fz * (7 + p * 20);
          let vy = 0.6 + p * p * 6.5;
          // Facing the goal: the shot flies straight to the aimed spot on the goal mouth.
          const target = goalAim(bp.x, bp.z, s.yaw, p);
          if (target) {
            const tx = target.x - bp.x;
            const tz = GOAL.z - bp.z;
            const dist = Math.hypot(tx, tz);
            const speed = 11 + p * 15;
            const t = dist / speed;
            vx = (tx / dist) * speed;
            vz = (tz / dist) * speed;
            vy = (target.y - bp.y + 7.5 * t * t) / t;
          }
          ball.applyImpulse({ x: (vx - bv.x) * BALL_MASS, y: (vy - bv.y) * BALL_MASS, z: (vz - bv.z) * BALL_MASS }, true);
          ball.setAngvel({ x: vz / BALL_RADIUS / 2, y: 0, z: -vx / BALL_RADIUS / 2 }, true);
          // Near-ballistic flight so the ball reaches the spot it was aimed at.
          ball.setLinearDamping(0.03);
          s.shotAt = s.time;
          playKick(p);
          fx.shake = Math.max(fx.shake, p * p * 0.3);
          fx.lastKick = performance.now();
        }
      }
      if (s.kickT > KICK_TIME) {
        s.kickT = -1;
        pose.kick = 0;
      }
    }

    // Bring the ball back after a goal, on R, or if it escapes the world.
    const lost =
      bp.y < -3 || bp.x < BOUNDS.minX - 4 || bp.x > BOUNDS.maxX + 4 || bp.z < BOUNDS.minZ - 4 || bp.z > BOUNDS.maxZ + 4;
    const resetDue = s.ballResetAt > 0 && s.time > s.ballResetAt;
    if ((input.resetBall && mode === 'play') || lost || resetDue) {
      input.resetBall = false;
      s.ballResetAt = -1;
      ball.setTranslation({ x: pp.x + s.fx * 1.1, y: 0.6, z: pp.z + s.fz * 1.1 }, true);
      ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
      ball.setAngvel({ x: 0, y: 0, z: 0 }, true);
    }
  });

  // Visuals and interaction detection follow the render loop.
  useFrame((_, delta) => {
    const rb = body.current;
    if (!rb) return;
    const dt = Math.min(delta, 0.1);
    const pp = rb.translation();
    const lift = groundOffset(pp.x, pp.z);
    if (model.current) {
      model.current.rotation.y = s.yaw;
      model.current.position.y = MathUtils.damp(model.current.position.y, lift, 10, dt);
    }
    // Ripples around the legs while wading.
    if (ripples.current) {
      const wet = lift < -0.05 ? 1 : 0;
      ripples.current.children.forEach((child, i) => {
        const k = (s.time * (0.9 + Math.min(1, pose.speed / 6)) + i * 0.5) % 1;
        child.scale.setScalar(0.45 + k * 1.1);
        const m = (child as Mesh).material as MeshBasicMaterial;
        m.opacity = MathUtils.damp(m.opacity, wet * (1 - k) * 0.7, 12, dt);
      });
    }

    // Aim arrow grows with the shot charge (soccer only).
    if (aim.current && aimShaft.current && aimHead.current) {
      const show = s.charging && world.get().mode !== 'basketball';
      aim.current.rotation.y = s.yaw;
      aimMaterial.opacity = MathUtils.damp(aimMaterial.opacity, show ? 0.85 : 0, 18, dt);
      aimMaterial.color.setRGB(1, 1 - s.charge * 0.55, 1 - s.charge * 0.6);
      const length = 0.4 + s.charge * 2.2;
      aimShaft.current.scale.y = length;
      aimHead.current.position.z = 0.55 + length;
    }

    s.nearTimer -= dt;
    if (s.nearTimer <= 0) {
      s.nearTimer = 0.1;
      const { mode, near } = world.get();
      const found = mode === 'play' ? (STATIONS.find((st) => Math.hypot(pp.x - st.x, pp.z - st.z) < st.radius)?.id ?? null) : null;
      if (found !== near) world.set({ near: found });
    }
  });

  return (
    <RigidBody
      ref={body}
      position={[SPAWN.x, 0.1, SPAWN.z]}
      colliders={false}
      enabledRotations={[false, false, false]}
      canSleep={false}
      ccd
    >
      <CapsuleCollider args={[0.55, 0.32]} position={[0, 0.87, 0]} mass={70} friction={0} />
      <group ref={model} rotation={[0, Math.PI, 0]} scale={0.92}>
        <Character pose={pose} look={AADHAV} />
        <HeldBasketball />
      </group>
      <group ref={ripples} position={[0, -0.03, 0]}>
        {[0, 1].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <ringGeometry args={[0.5, 0.58, 28]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <group ref={aim} position={[0, 0.04, 0]}>
        <mesh ref={aimShaft} geometry={shaftGeometry} material={aimMaterial} position={[0, 0, 0.45]} rotation={[Math.PI / 2, 0, 0]} />
        <mesh ref={aimHead} material={aimMaterial} rotation={[-Math.PI / 2, 0, -Math.PI / 2]}>
          <circleGeometry args={[0.24, 3]} />
        </mesh>
      </group>
    </RigidBody>
  );
}
