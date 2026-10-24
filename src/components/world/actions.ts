import { experience, photos, projects } from '../../data/portfolio';
import { quitChallenge, startChallenge } from './games/challenge';
import { clearInput } from './input';
import type { StationId } from './layout';
import { playClose, playOpen, playShutter, playTick } from './sound';
import { PSP_MENU } from './stations/pspMenu';
import { world } from './store';

export const CLASSIC_URL = '/classic';

/** How many pages each browsable station has. */
export const PAGE_COUNT: Partial<Record<StationId, number>> = {
  projects: projects.length,
  experience: experience.length,
  camera: photos.length
};

export function openStation(id: StationId) {
  if (id === 'classic') {
    window.location.href = CLASSIC_URL;
    return;
  }
  if (id === 'soccer' || id === 'basketball') {
    startChallenge(id);
    return;
  }
  clearInput();
  playOpen();
  world.set({ mode: 'station', station: id, page: 0, psp: { col: 0, row: 0 } });
}

export function closeStation() {
  playClose();
  world.set({ mode: 'play', station: null });
}

export function turnPage(step: number) {
  const { station, page } = world.get();
  const count = station ? PAGE_COUNT[station] : undefined;
  if (!count) return;
  if (station === 'camera') playShutter();
  else playTick();
  world.set({ page: (page + step + count) % count });
}

export function movePsp(dx: number, dy: number) {
  const { psp } = world.get();
  const col = Math.max(0, Math.min(PSP_MENU.length - 1, psp.col + dx));
  const rows = PSP_MENU[col].items.length;
  const row = dx ? 0 : Math.max(0, Math.min(rows - 1, psp.row + dy));
  if (col === psp.col && row === psp.row) return;
  playTick();
  world.set({ psp: { col, row } });
}

export function selectPsp() {
  const { psp } = world.get();
  const item = PSP_MENU[psp.col].items[psp.row];
  if (item?.href) window.open(item.href, '_blank', 'noopener');
}

/** Enter: open what's nearby, flip to the next page, or replay a finished challenge. */
export function interact() {
  const s = world.get();
  if (!s.started) return;
  if (s.mode === 'play' && s.near) openStation(s.near);
  else if (s.mode === 'station') {
    if (s.station === 'psp') selectPsp();
    else turnPage(1);
  } else if ((s.mode === 'soccer' || s.mode === 'basketball') && s.challenge?.phase === 'done') startChallenge(s.mode);
}

/** Escape: leave whatever is open. */
export function back() {
  const { mode } = world.get();
  if (mode === 'station') closeStation();
  else if (mode === 'soccer' || mode === 'basketball') quitChallenge();
}

/** Arrow keys while a station is open. Returns true when the key was used. */
export function arrow(dx: number, dy: number) {
  const { mode, station } = world.get();
  if (mode !== 'station') return false;
  if (station === 'psp') movePsp(dx, dy);
  else if (dx) turnPage(dx);
  return true;
}
