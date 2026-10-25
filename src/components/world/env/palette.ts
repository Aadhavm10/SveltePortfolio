import { Color, Vector3 } from 'three';

/** Golden-hour palette shared by the sky, fog, lights and materials. */
export const GOLDEN = {
  zenith: new Color('#7486c9'),
  sky: new Color('#f3ac92'),
  horizon: new Color('#ffdcaa'),
  sun: new Color('#fff1cf'),
  sunGlow: new Color('#ffad66'),
  fog: '#f5cba0',
  sunLight: '#ffb26e',
  hemiSky: '#b8c6f0',
  hemiGround: '#86704c',
  grassBase: new Color('#5a9236'),
  grassTip: new Color('#ecd979'),
  ground: '#72a443',
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
