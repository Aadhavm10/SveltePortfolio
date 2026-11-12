// A home base is part of its country / US state: when it has photos, that place lights up too.
// The place gets an entry in manifest.countries with no photos of its own (and a colour that
// contrasts with its neighbours); it's removed again once nothing keeps it lit.
import type { Topology } from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';
import usStates from 'us-atlas/states-10m.json';
import { buildRegions, findRegionAt, type RegionIndex } from '../geo';
import type { Manifest, StarredPlace } from '../../data/travel';
import { regionName } from './countryNames';
import { pickColor } from './placeColors';

let index: RegionIndex | null = null;
const cache = new Map<string, string | null>();

/** The country (or US state) a home base is in, if any. */
export function homeRegionId(s: Pick<StarredPlace, 'lat' | 'lng'>): string | null {
  const key = `${s.lat},${s.lng}`;
  if (!cache.has(key)) {
    index ??= buildRegions(world as unknown as Topology, usStates as unknown as Topology);
    const id = findRegionAt(index, s.lat, s.lng)?.id ?? null;
    cache.set(key, id && regionName(id) ? id : null);
  }
  return cache.get(key)!;
}

/** Light up places that contain a home base with photos; drop places nothing keeps lit. */
export function syncHomeRegions(m: Manifest): void {
  const lit = new Set<string>();
  for (const s of m.starred ?? []) {
    if (!s.photos?.length) continue;
    const id = homeRegionId(s);
    if (id) lit.add(id);
  }
  for (const id of lit) {
    m.countries[id] ??= { name: regionName(id)!, color: pickColor(m, id), addedAt: new Date().toISOString(), photos: [] };
  }
  for (const [id, c] of Object.entries(m.countries)) {
    // A country with no photos left (and no home base photos in it) stops glowing on the globe.
    if (c.photos.length === 0 && !lit.has(id)) delete m.countries[id];
  }
}
