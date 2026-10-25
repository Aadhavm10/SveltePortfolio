import { experience, places, projects } from '../../data/portfolio';
import { arcadeBack, arcadeEnter, arcadePress } from './games/arcade';
import { quitChallenge, startChallenge } from './games/challenge';
import { clearInput } from './input';
import type { StationId } from './layout';
import { playClose, playOpen, playTick } from './sound';
import { takePhoto } from './stations/Capture';
import { turnRoom } from './stations/Cottage';
import { faceSelectedPlace, stepPlace } from './stations/Globe';
import { PSP_MENU } from './stations/pspMenu';
import { world } from './store';

export const CLASSIC_URL = '/classic';

/** Index of the project behind a fair stall's station id, or -1. */
export const stallIndex = (id: StationId | null) => (id && id.startsWith('stall-') ? Number(id.slice(6)) : -1);

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
  const extra = id === 'room' ? { roomFadeAt: performance.now() } : {};
  world.set({ mode: 'station', station: id, page: 0, psp: { col: 0, row: 0 }, gallery: -1, polaroid: null, ...extra });
  if (id === 'globe') faceSelectedPlace();
}

export function closeStation() {
  playClose();
  const { station, polaroid } = world.get();
  if (polaroid) URL.revokeObjectURL(polaroid);
  const extra = station === 'room' ? { roomFadeAt: performance.now() } : {};
  world.set({ mode: 'play', station: null, gallery: -1, polaroid: null, ...extra });
}

/** Experience pages. */
export function turnPage(step: number) {
  const { station, page } = world.get();
  if (station !== 'experience') return;
  playTick();
  world.set({ page: (page + step + experience.length) % experience.length });
}

/** Walk along the fair to the next stall without leaving it. */
export function moveStall(step: number) {
  const i = stallIndex(world.get().station);
  if (i < 0) return;
  playTick();
  world.set({ station: `stall-${(i + step + projects.length) % projects.length}` });
}

/** Photo gallery for the selected place on the globe. */
export function openGallery(index = 0) {
  const place = places[world.get().place];
  if (!place?.photos.length) return;
  playOpen();
  world.set({ gallery: index });
}

export function stepGallery(step: number) {
  const { gallery, place } = world.get();
  const count = places[place]?.photos.length ?? 0;
  if (gallery < 0 || !count) return;
  playTick();
  world.set({ gallery: (gallery + step + count) % count });
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

/** O: open the link for whatever is on screen. */
export function openCurrent() {
  const { mode, station } = world.get();
  if (mode !== 'station') return;
  const stall = stallIndex(station);
  if (stall >= 0) window.open(projects[stall].projectUrl, '_blank', 'noopener');
  if (station === 'psp') selectPsp();
}

/** Enter: open what's nearby, or do the main thing for the open station. */
export function interact() {
  const s = world.get();
  if (!s.started) return;
  if (s.mode === 'play' && s.near) openStation(s.near);
  else if (s.mode === 'station') {
    if (s.station === 'psp') selectPsp();
    else if (s.station === 'arcade') arcadeEnter();
    else if (s.station === 'experience') turnPage(1);
    else if (s.station === 'globe') s.gallery >= 0 ? stepGallery(1) : openGallery();
    else if (s.station === 'photo') {
      if (s.polaroid) {
        URL.revokeObjectURL(s.polaroid);
        world.set({ polaroid: null });
      } else takePhoto();
    } else if (stallIndex(s.station) >= 0) moveStall(1);
  } else if ((s.mode === 'soccer' || s.mode === 'basketball') && s.challenge?.phase === 'done') startChallenge(s.mode);
}

/** Escape: step back out of whatever is open. */
export function back() {
  const s = world.get();
  if (s.mode === 'station') {
    if (s.gallery >= 0) {
      playTick();
      world.set({ gallery: -1 });
    } else if (s.station === 'photo' && s.polaroid) {
      URL.revokeObjectURL(s.polaroid);
      world.set({ polaroid: null });
    } else if (s.station === 'arcade' && arcadeBack()) {
      // Left a game for the arcade menu.
    } else closeStation();
  } else if (s.mode === 'soccer' || s.mode === 'basketball') quitChallenge();
}

/** Arrow keys while a station is open. Returns true when the key was used. */
export function arrow(dx: number, dy: number) {
  const { mode, station, gallery } = world.get();
  if (mode !== 'station') return false;
  if (station === 'photo') return false;
  if (station === 'psp') movePsp(dx, dy);
  else if (station === 'arcade') arcadePress(dx, dy);
  else if (station === 'experience') {
    if (dx) turnPage(dx);
  } else if (station === 'globe') {
    if (gallery >= 0) {
      if (dx) stepGallery(dx);
    } else if (dx) stepPlace(dx);
  } else if (station === 'room') turnRoom(dx * 0.6, -dy * 0.35);
  else if (stallIndex(station) >= 0) {
    if (dx) moveStall(dx);
  }
  return true;
}
