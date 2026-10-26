import { CatmullRomCurve3, CanvasTexture, LinearFilter, Vector3 } from 'three';
import { projects } from '../../../data/portfolio';
import { CLEARINGS, COURT, FAIR, FIELD, PATHS, POND, PROPS, stallX, STREAMS, TOYS, ZEN_GARDEN } from '../layout';

/** Normalised elliptical distance from the pond centre (1 = shoreline). */
export function pondDistance(x: number, z: number) {
  return Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
}

/** World rectangle covered by the grass mask. */
export const MASK_RECT = { minX: -64, minZ: -64, width: 124, depth: 98 };
const PX_PER_M = 8;

export const PATH_WIDTH = 2.4;

/** Smoothed points along each path, shared by the path ribbons and the grass mask. */
export const pathCurves = PATHS.map(
  (points) => new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), false, 'catmullrom', 0.5)
);

export const streamCurves = STREAMS.map(
  ({ points }) => new CatmullRomCurve3(points.map(([x, z]) => new Vector3(x, 0, z)), false, 'catmullrom', 0.5)
);

export function pathPoints(curve: CatmullRomCurve3) {
  return curve.getSpacedPoints(Math.max(8, Math.round(curve.getLength() / 0.5)));
}

/** Footprints of props that sit on bare ground: [x, z, halfWidth, halfDepth]. */
const PADS: [number, number, number, number][] = [
  [(PROPS.laptop.x + PROPS.monitor.x) / 2, PROPS.laptop.z - 0.5, 9, 3.8],
  [PROPS.psp.x, PROPS.psp.z + 0.5, 3.5, 2.2],
  [PROPS.scoreboard.x, PROPS.scoreboard.z, 1.6, 1],
  [PROPS.ballRack.x, PROPS.ballRack.z, 1.4, 1],
  [TOYS.bowling.x, TOYS.bowling.z, 1.2, TOYS.bowling.length / 2 + 0.3],
  // The fair: stalls plus a little apron in front of each
  [stallX(0) + ((projects.length - 1) * FAIR.spacing) / 2, FAIR.z + 0.6, ((projects.length - 1) * FAIR.spacing) / 2 + FAIR.width / 2 + 0.4, FAIR.depth / 2 + 1.2]
];

/** White where grass grows, black where it doesn't; edges are softened. */
export function createGrassMask() {
  const canvas = document.createElement('canvas');
  canvas.width = MASK_RECT.width * PX_PER_M;
  canvas.height = MASK_RECT.depth * PX_PER_M;
  const ctx = canvas.getContext('2d')!;
  const X = (x: number) => (x - MASK_RECT.minX) * PX_PER_M;
  const Z = (z: number) => (z - MASK_RECT.minZ) * PX_PER_M;
  const M = (m: number) => m * PX_PER_M;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.filter = 'blur(3px)';
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = '#000000';

  // Pitch (with a mown margin), court and the area behind the goal.
  ctx.fillRect(X(FIELD.minX - 1), Z(FIELD.goalZ - 3.5), M(FIELD.maxX - FIELD.minX + 2), M(FIELD.halfwayZ - FIELD.goalZ + 4.5));
  ctx.fillRect(X(COURT.minX - 0.8), Z(COURT.minZ - 0.8), M(COURT.maxX - COURT.minX + 1.6), M(COURT.maxZ - COURT.minZ + 1.6));

  // Pond and its sandy shore.
  ctx.beginPath();
  ctx.ellipse(X(POND.x), Z(POND.z), M(POND.rx * 1.3), M(POND.rz * 1.3), 0, 0, Math.PI * 2);
  ctx.fill();

  for (const [x, z, hw, hd] of PADS) ctx.fillRect(X(x - hw), Z(z - hd), M(hw * 2), M(hd * 2));
  ctx.fillRect(X(ZEN_GARDEN.x - ZEN_GARDEN.w / 2 - 0.6), Z(ZEN_GARDEN.z - ZEN_GARDEN.d / 2 - 0.6), M(ZEN_GARDEN.w + 1.2), M(ZEN_GARDEN.d + 1.2));

  // My room's plinth, the globe stand, camera tripod and the letters' footprint.
  ctx.beginPath();
  ctx.arc(X(PROPS.room.x), Z(PROPS.room.z), M(3.9), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(X(PROPS.globe.x), Z(PROPS.globe.z), M(2.2), 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(X(PROPS.camera.x), Z(PROPS.camera.z), M(1.1), 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(X(PROPS.letters.x - 8), Z(PROPS.letters.z - 1), M(16), M(2));

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = M(PATH_WIDTH + 0.4);
  for (const curve of pathCurves) {
    ctx.beginPath();
    pathPoints(curve).forEach((p, i) => (i ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))));
    ctx.stroke();
  }
  streamCurves.forEach((curve, i) => {
    ctx.lineWidth = M(STREAMS[i].width + 1.3);
    ctx.beginPath();
    pathPoints(curve).forEach((p, j) => (j ? ctx.lineTo(X(p.x), Z(p.z)) : ctx.moveTo(X(p.x), Z(p.z))));
    ctx.stroke();
  });

  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.minFilter = LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function distanceToSegment(px: number, pz: number, a: Vector3, b: Vector3) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (a.x + dx * t), pz - (a.z + dz * t));
}

const pathPolylines = pathCurves.map((c) => pathPoints(c));
const streamPolylines = streamCurves.map((c) => pathPoints(c));

/** Distance from the nearest stream's centre line, minus its half width (negative = in the water). */
export function streamDistance(x: number, z: number) {
  let best = Infinity;
  streamPolylines.forEach((line, s) => {
    for (let i = 1; i < line.length; i++) {
      best = Math.min(best, distanceToSegment(x, z, line[i - 1], line[i]) - STREAMS[s].width / 2);
    }
  });
  return best;
}

/** True where it's fine to place trees, rocks and flowers. */
export function isOpenGround(x: number, z: number, margin = 0) {
  if (x > FIELD.minX - 3 - margin && x < FIELD.maxX + 3 + margin && z > FIELD.goalZ - 5 - margin && z < FIELD.halfwayZ + 3 + margin)
    return false;
  if (x > COURT.minX - 2 - margin && x < COURT.maxX + 2 + margin && z > COURT.minZ - 2 - margin && z < COURT.maxZ + 2 + margin)
    return false;
  if (pondDistance(x, z) < 1.45 + margin * 0.1) return false;
  if (streamDistance(x, z) < 1 + margin) return false;
  if (Math.abs(x - ZEN_GARDEN.x) < ZEN_GARDEN.w / 2 + 1 + margin && Math.abs(z - ZEN_GARDEN.z) < ZEN_GARDEN.d / 2 + 1 + margin) return false;
  if (CLEARINGS.some((c) => Math.hypot(x - c.x, z - c.z) < c.r + margin)) return false;
  for (const line of pathPolylines) {
    for (let i = 1; i < line.length; i++) {
      if (distanceToSegment(x, z, line[i - 1], line[i]) < PATH_WIDTH / 2 + 0.8 + margin) return false;
    }
  }
  return true;
}
