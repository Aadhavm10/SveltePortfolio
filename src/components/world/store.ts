import { useSyncExternalStore } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import type { StationId } from './layout';

export const MUTE_KEY = 'world-muted';
export const MUSIC_KEY = 'world-music';
/** Fixed physics timestep; gameplay logic runs once per step. */
export const PHYSICS_STEP = 1 / 60;

/** play: roam with the ball. station: browsing a screen. soccer / basketball: a mini-game is running. */
export type Mode = 'play' | 'station' | 'soccer' | 'basketball';

export interface Challenge {
  kind: 'soccer' | 'basketball';
  phase: 'countdown' | 'playing' | 'done';
  score: number;
  best: number;
  /** performance.now() when the countdown ends and play begins. */
  startsAt: number;
  /** performance.now() when the clock runs out. */
  endsAt: number;
  /** Most recent callout, e.g. "GOAL!" or "SAVED". */
  callout: { text: string; tone: 'good' | 'bad'; at: number } | null;
}

export interface WorldState {
  /** Physics and fonts are loaded; the world can be entered. */
  ready: boolean;
  /** The visitor pressed "Kick off". */
  started: boolean;
  muted: boolean;
  /** Background music on/off (ambience and effects follow `muted` only). */
  music: boolean;
  touch: boolean;
  /** 'low' on phones, small devices, software renderers, or when the frame rate drops: less grass, smaller shadows. */
  quality: 'high' | 'low';
  /** Very little memory or data saver on: the start screen suggests the classic site. */
  lowEnd: boolean;
  /** The player has moved at least once (hides the controls hint). */
  moved: boolean;
  /** The park map is open (it pauses movement). */
  mapOpen: boolean;
  mode: Mode;
  /** Station whose interaction point the player is standing in. */
  near: StationId | null;
  /** Open station while mode is 'station'. */
  station: StationId | null;
  /** Page within the open station (project, job or photo index). */
  page: number;
  /** PSP menu cursor: column (category) and row (item). */
  psp: { col: number; row: number };
  /** Globe: the selected place, and the photo shown full screen (-1 when the gallery is closed). */
  place: number;
  gallery: number;
  /** Photo booth: the last polaroid (an object URL) while it's being shown. */
  polaroid: string | null;
  challenge: Challenge | null;
  /** Free-play goal celebration. */
  goalAt: number;
}

let state: WorldState = {
  ready: false,
  started: false,
  muted: false,
  music: true,
  touch: false,
  quality: 'high',
  lowEnd: false,
  moved: false,
  mapOpen: false,
  mode: 'play',
  near: null,
  station: null,
  page: 0,
  psp: { col: 0, row: 0 },
  place: 0,
  gallery: -1,
  polaroid: null,
  challenge: null,
  goalAt: 0
};

const listeners = new Set<() => void>();

export const world = {
  get: () => state,
  set(partial: Partial<WorldState>) {
    state = { ...state, ...partial };
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};

/** Selectors must return primitives or stable references. */
export function useWorld<T>(selector: (s: WorldState) => T): T {
  return useSyncExternalStore(
    world.subscribe,
    () => selector(state),
    () => selector(state)
  );
}

/** Physics bodies shared between systems, registered by their components. */
export const bodies: {
  player: RapierRigidBody | null;
  ball: RapierRigidBody | null;
  keeper: RapierRigidBody | null;
} = {
  player: null,
  ball: null,
  keeper: null
};

/** Per-frame effects that don't need React re-renders. */
export const fx = {
  shake: 0,
  /** Current shot charge, 0..1 (0 when not charging), for the HUD meter. */
  charge: 0,
  /** performance.now() of the last kick that connected with the ball. */
  lastKick: 0,
  /** Player facing (unit vector on the ground), for systems that place things in front of them. */
  facing: { x: 0, z: -1 },
  /** The camera's right-hand and forward directions on the ground, so movement keys follow the view. */
  camRight: { x: 1, z: 0 },
  camForward: { x: 0, z: -1 },
  /** 0 by day, easing to 1 while you're at my room: dusk falls and its lamps come up. */
  evening: 0,
  /** Where a charging soccer shot will land on the goal mouth (shown as a target ring). */
  aim: { x: 0, y: 0, visible: false },
  /** Set to ask the photo booth to take a picture on the next frame. */
  snap: false
};
