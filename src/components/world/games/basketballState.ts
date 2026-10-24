import { COURT } from '../layout';

/** Shared between the player controller (which reads input) and the court (which owns the balls). */
export const basketball = {
  /** The player has a ball in hand. */
  holding: false,
  /** Seconds to fill the shot meter. */
  chargeTime: 1,
  /** Release inside this band of the meter for a true shot. */
  sweetSpot: [0.62, 0.78] as const,
  aimYaw(p: { x: number; z: number }) {
    return Math.atan2(COURT.rim.x - p.x, COURT.rim.z - p.z);
  },
  /** Set by the court once its balls exist. */
  shoot: (_from: { x: number; y: number; z: number }, _charge: number) => {}
};
