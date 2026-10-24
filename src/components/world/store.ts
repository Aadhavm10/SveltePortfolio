import { useSyncExternalStore } from 'react';
import type { RapierRigidBody } from '@react-three/rapier';
import type { Zone } from './zones';

export const MUTE_KEY = 'world-muted';
/** Fixed physics timestep; gameplay logic runs once per step. */
export const PHYSICS_STEP = 1 / 60;

export interface GoalEvent {
  zone: Zone;
  at: number;
}

export interface WorldState {
  /** Physics and fonts are loaded; the world can be entered. */
  ready: boolean;
  /** The visitor pressed "Kick off". */
  started: boolean;
  /** Interaction zone the player is standing in. */
  zone: Zone | null;
  /** Zone whose info panel is open. */
  panel: Zone | null;
  goal: GoalEvent | null;
  muted: boolean;
  touch: boolean;
  /** The player has moved at least once (hides the controls hint). */
  moved: boolean;
}

let state: WorldState = {
  ready: false,
  started: false,
  zone: null,
  panel: null,
  goal: null,
  muted: false,
  touch: false,
  moved: false
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
export const bodies: { player: RapierRigidBody | null; ball: RapierRigidBody | null } = {
  player: null,
  ball: null
};

/** Per-frame effects that don't need React re-renders. */
export const fx = {
  shake: 0
};
