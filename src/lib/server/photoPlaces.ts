// Where a photo lives: a country / US state ("124", "us-48") or a home base ("home:<id>").
import { homeIdOf, homeTarget, isHomeTarget, type Manifest, type Photo } from '../../data/travel';
import { regionName } from './countryNames';
import { pickColor } from './placeColors';

export type PlaceTarget = { kind: 'region'; id: string; name: string } | { kind: 'home'; id: string };

/** The home base was removed (e.g. in another tab) before the photo got there. */
export class MissingHomeError extends Error {
  constructor() {
    super('That home base no longer exists.');
  }
}

export function parseTarget(raw: unknown): PlaceTarget | null {
  if (typeof raw !== 'string') return null;
  if (isHomeTarget(raw)) {
    const id = homeIdOf(raw);
    return /^[a-z0-9]{1,40}$/i.test(id) ? { kind: 'home', id } : null;
  }
  const name = regionName(raw);
  return name ? { kind: 'region', id: raw, name } : null;
}

export const targetKey = (t: PlaceTarget) => (t.kind === 'home' ? homeTarget(t.id) : t.id);

/** Storage folder for a place's photo files. */
export const targetFolder = (t: PlaceTarget) => (t.kind === 'home' ? `home-${t.id}` : t.id);

/** The photo list for a place, creating the country / state (with a fresh colour) if needed. */
export function photosAt(m: Manifest, t: PlaceTarget): Photo[] {
  if (t.kind === 'home') {
    const s = m.starred?.find((x) => x.id === t.id);
    if (!s) throw new MissingHomeError();
    return (s.photos ??= []);
  }
  m.countries[t.id] ??= { name: t.name, color: pickColor(m, t.id), addedAt: new Date().toISOString(), photos: [] };
  return m.countries[t.id].photos;
}

export interface PhotoHit {
  photo: Photo;
  /** Upload / move target of the place it's in. */
  key: string;
  /** Take it out of its place (a country / state left with no photos is removed). */
  remove(): void;
}

export function findPhoto(m: Manifest, id: string): PhotoHit | null {
  for (const [countryId, c] of Object.entries(m.countries)) {
    const i = c.photos.findIndex((p) => p.id === id);
    if (i !== -1) {
      return {
        photo: c.photos[i],
        key: countryId,
        remove() {
          c.photos.splice(i, 1);
          // A country with no photos left stops glowing on the globe.
          if (c.photos.length === 0) delete m.countries[countryId];
        },
      };
    }
  }
  for (const s of m.starred ?? []) {
    const i = s.photos?.findIndex((p) => p.id === id) ?? -1;
    if (i !== -1) {
      return {
        photo: s.photos![i],
        key: homeTarget(s.id),
        remove() {
          s.photos!.splice(i, 1);
          if (s.photos!.length === 0) delete s.photos;
        },
      };
    }
  }
  return null;
}
