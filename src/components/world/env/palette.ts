import { Color, Vector3 } from 'three';

/** Golden-hour palette shared by the sky, fog, lights and materials. */
export const GOLDEN = {
  zenith: new Color('#5d6aa8'),
  sky: new Color('#e79a7c'),
  horizon: new Color('#ffcf94'),
  sun: new Color('#fff1cf'),
  sunGlow: new Color('#ffad66'),
  fog: '#f1bf8d',
  sunLight: '#ffb26e',
  hemiSky: '#aab8ee',
  hemiGround: '#7d6040',
  grassBase: new Color('#4f7f2c'),
  grassTip: new Color('#f0cd6e'),
  ground: '#679437',
  dirt: '#b98b5b'
};

/** Direction toward the low western sun. */
export const SUN_DIR = new Vector3(-0.72, 0.3, -0.62).normalize();

/** Cheap smooth 2D noise in [0, 1] for placing and tinting things. */
export function noise2(x: number, z: number) {
  const n =
    Math.sin(x * 0.13 + Math.sin(z * 0.07) * 2) * 0.5 +
    Math.sin(z * 0.11 + x * 0.05) * 0.3 +
    Math.sin((x + z) * 0.31) * 0.2;
  return n * 0.5 + 0.5;
}

/** Deterministic random numbers so the world looks the same on every visit. */
export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
