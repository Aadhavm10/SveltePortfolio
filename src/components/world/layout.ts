/**
 * World layout in metres. y is up and the camera looks north, so north is -z.
 *
 *            camera ·          pond · psp
 *                    [letters]
 *   court   ·   [====== field ======]   · macbook
 *                  spawn (centre)        · monitor
 *                        · classic sign
 */

export const BOUNDS = { minX: -56, maxX: 52, minZ: -56, maxZ: 26 };

/** Half-pitch with a single goal on the north end. */
export const FIELD = {
  minX: -15,
  maxX: 15,
  goalZ: -22,
  halfwayZ: 5,
  box: { width: 20, depth: 9 },
  sixYard: { width: 9, depth: 3 },
  penaltySpotZ: -15.5,
  centreRadius: 4.5
};

export const GOAL = { x: 0, z: FIELD.goalZ, width: 5.2, height: 2.2, depth: 1.8 };

export const SPAWN = { x: 0, z: 1.5 };
export const BALL_SPAWN = { x: 0, z: -0.5 };

/** Outdoor half court; the hoop faces south so you shoot away from the camera. */
export const COURT = {
  x: -36,
  minX: -44,
  maxX: -28,
  minZ: -17,
  maxZ: -1,
  baselineZ: -17,
  rim: { x: -36, y: 3.05, z: -15.4 },
  threeRadius: 6.2,
  keyWidth: 4.9,
  freeThrowZ: -10.8
};

export const POND = { x: 15, z: -40, rx: 12, rz: 7 };

export type StationId = 'projects' | 'experience' | 'psp' | 'camera' | 'soccer' | 'basketball' | 'classic';

export interface Station {
  id: StationId;
  /** Short name on the floating sign and the map. */
  name: string;
  icon: string;
  /** What the prompt says, e.g. "Enter · Browse my work". */
  label: string;
  /** Where the player stands to interact. */
  x: number;
  z: number;
  radius: number;
  /** Height of the floating prompt above the interaction point. */
  promptY: number;
  color: string;
  /**
   * What the camera frames when the station opens: the screen's centre, the direction it faces,
   * and its size (the camera backs off until the whole screen fits the viewport).
   */
  view?: { target: [number, number, number]; normal: [number, number, number]; width: number; height: number };
}

/** Tilt of the laptop lid and the PSP on its stand, in radians. */
export const LID_TILT = 0.2;
export const PSP_TILT = 0.22;

/** Big props sit just north of their interaction point. */
export const PROPS = {
  laptop: { x: 34, z: -15 },
  monitor: { x: 37, z: 3 },
  psp: { x: 31, z: -35 },
  camera: { x: -24, z: -36 },
  scoreboard: { x: 18.5, z: -10 },
  ballRack: { x: -26.5, z: -7 },
  classicSign: { x: 9, z: 15 },
  signpost: { x: -5.2, z: 6.8 },
  letters: { x: 0, z: -30 }
};

export const STATIONS: Station[] = [
  {
    id: 'projects',
    name: 'Work',
    icon: '💻',
    label: 'Browse my work',
    x: PROPS.laptop.x,
    z: PROPS.laptop.z + 5.5,
    radius: 2.6,
    promptY: 2.6,
    color: '#ffd28a',
    view: { target: [PROPS.laptop.x, 2.05, PROPS.laptop.z - 2.25], normal: [0, 0.2, 0.98], width: 5.4, height: 3.4 }
  },
  {
    id: 'experience',
    name: 'Experience',
    icon: '🖥️',
    label: 'See my experience',
    x: PROPS.monitor.x,
    z: PROPS.monitor.z + 5,
    radius: 2.6,
    promptY: 2.6,
    color: '#9fd8ff',
    view: { target: [PROPS.monitor.x, 3.35, PROPS.monitor.z - 0.25], normal: [0, 0.08, 1], width: 4.9, height: 2.95 }
  },
  {
    id: 'psp',
    name: 'PSP',
    icon: '🎮',
    label: 'Play with the PSP',
    x: PROPS.psp.x,
    z: PROPS.psp.z + 5,
    radius: 2.6,
    promptY: 2.4,
    color: '#c9b8ff',
    view: { target: [PROPS.psp.x, 2.0, PROPS.psp.z], normal: [0, 0.22, 0.97], width: 5.2, height: 2.4 }
  },
  {
    id: 'camera',
    name: 'Photos',
    icon: '📷',
    label: 'Look through the camera',
    x: PROPS.camera.x,
    z: PROPS.camera.z + 3.4,
    radius: 2.4,
    promptY: 2.9,
    color: '#ffb3a1',
    view: { target: [PROPS.camera.x + 0.08, 1.88, PROPS.camera.z + 0.25], normal: [0, 0.12, 1], width: 1.5, height: 1.0 }
  },
  {
    id: 'soccer',
    name: 'Shooting challenge',
    icon: '⚽',
    label: 'Start the shooting challenge',
    x: PROPS.scoreboard.x - 2,
    z: PROPS.scoreboard.z + 1,
    radius: 2.4,
    promptY: 2.6,
    color: '#b8f28c'
  },
  {
    id: 'basketball',
    name: '3-point shootout',
    icon: '🏀',
    label: 'Start the 3-point shootout',
    x: PROPS.ballRack.x + 0.5,
    z: PROPS.ballRack.z + 2.2,
    radius: 2.4,
    promptY: 2.4,
    color: '#ffb36b'
  },
  {
    id: 'classic',
    name: 'Classic site',
    icon: '🪧',
    label: 'Go to the classic site',
    x: PROPS.classicSign.x,
    z: PROPS.classicSign.z + 2,
    radius: 2.2,
    promptY: 2.6,
    color: '#ffffff'
  }
];

export const stationById = Object.fromEntries(STATIONS.map((s) => [s.id, s])) as Record<StationId, Station>;

/** Dirt paths from the field out to each station, as polyline control points. */
export const PATHS: [number, number][][] = [
  [[-15, -6], [-20, -5.5], [-24.5, -5]],
  [[15, -6], [20, -6.5], [27, -8], [33, -9.6]],
  [[27, -8], [32, -2], [37, 7.5]],
  [[15, -22], [20, -26], [26, -29], [31, -30.2]],
  [[-15, -22], [-19, -27], [-23, -31.5]],
  [[2, 5], [4, 9.5], [8, 16]]
];

/** Shallow streams (you can wade through them); each is a polyline of control points. */
export const STREAMS: { points: [number, number][]; width: number }[] = [
  // From the waterfall into the pond
  { points: [[15, -52.5], [14.4, -49.6], [15, -46.6]], width: 2.6 },
  // West brook, past the zen garden into the pond
  { points: [[-58, -29], [-46, -33], [-36, -40], [-24, -45], [-10, -46.5], [0, -45], [5.5, -41.5]], width: 2.6 },
  // East outflow towards the hills
  { points: [[26.5, -40.5], [34, -42], [42, -38.5], [47, -31], [54, -25]], width: 2.4 },
  // South brook along the meadow
  { points: [[-58, 13], [-44, 9.5], [-32, 12], [-20, 18], [-8, 22.5], [2, 29]], width: 2.2 }
];

/** Bridges: which stream, and how far along it (0..1). The first is the red arched one by the zen garden. */
export const BRIDGES: { stream: number; t: number }[] = [
  { stream: 1, t: 0.8 },
  { stream: 1, t: 0.3 },
  { stream: 2, t: 0.46 },
  { stream: 3, t: 0.36 }
];

export const WATERFALL = { x: 15, z: -53.4, width: 4.2, height: 3.4 };
export const ZEN_GARDEN = { x: -6, z: -38.5, w: 9, d: 6 };

/** Spots kept clear of trees and rocks (besides the areas above). */
export const CLEARINGS = [
  { x: ZEN_GARDEN.x, z: ZEN_GARDEN.z, r: 6.5 },
  { x: WATERFALL.x, z: WATERFALL.z, r: 6 },
  { x: PROPS.letters.x, z: PROPS.letters.z, r: 9 },
  { x: PROPS.laptop.x, z: PROPS.laptop.z + 2, r: 8 },
  { x: PROPS.monitor.x, z: PROPS.monitor.z + 2, r: 7.5 },
  { x: PROPS.psp.x, z: PROPS.psp.z + 2, r: 7 },
  { x: PROPS.camera.x, z: PROPS.camera.z + 1, r: 6 },
  { x: PROPS.classicSign.x, z: PROPS.classicSign.z + 1, r: 4 },
  { x: PROPS.scoreboard.x, z: PROPS.scoreboard.z, r: 3.5 }
];

export const PALETTE = ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ff8b94', '#b8a9ff'];
