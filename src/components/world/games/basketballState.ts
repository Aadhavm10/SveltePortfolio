import { MathUtils } from 'three';
import { COURT } from '../layout';

/** Shared between the player controller (which reads input) and the court (which owns the balls). */
export const basketball = {
  /** The player has a ball in hand. */
  holding: false,
  /** Seconds to fill the shot meter. */
  chargeTime: 1,
  /** Release inside this band of the meter for a true shot; it narrows the further out you are. */
  zone(p: { x: number; z: number }): [number, number] {
    const d = Math.hypot(COURT.rim.x - p.x, COURT.rim.z - p.z);
    const half = MathUtils.clamp(0.1 - (d - 2) * 0.012, 0.03, 0.1);
    return [0.7 - half, 0.7 + half];
  },
  /** Distance from the rim, for scaling how much a miss is off by. */
  distance(p: { x: number; z: number }) {
    return Math.hypot(COURT.rim.x - p.x, COURT.rim.z - p.z);
  },
  aimYaw(p: { x: number; z: number }) {
    return Math.atan2(COURT.rim.x - p.x, COURT.rim.z - p.z);
  },
  /** Set by the court once its balls exist. */
  shoot: (_from: { x: number; y: number; z: number }, _charge: number) => {}
};
