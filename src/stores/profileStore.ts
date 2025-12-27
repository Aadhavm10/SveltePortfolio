import { writable } from 'svelte/store';

export interface ProfileObstacle {
  x: number;
  y: number;
  radius: number;
  screenX: number;
  screenY: number;
  screenRadius: number;
}

export const profileObstacle = writable<ProfileObstacle | null>(null);
