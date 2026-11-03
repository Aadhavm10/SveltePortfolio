// Server-side lookup of valid region ids → display names.
// Countries come from world-atlas; the United States is split into states from us-atlas.
import world from 'world-atlas/countries-50m.json';
import usStates from 'us-atlas/states-10m.json';
import { displayName, REGION_ID_RE, stateId, US_ID } from '../../data/travel';

type Geometry = { id?: string; properties?: { name?: string } };
type Topo = { objects: Record<string, { geometries: Geometry[] }> };

// Territories world-atlas already has as countries (Puerto Rico, Guam, …).
export const SKIP_STATE_FIPS = new Set(['60', '66', '69', '72', '78']);

const names = new Map<string, string>();
for (const g of (world as unknown as Topo).objects.countries.geometries) {
  if (!g.id || g.id === US_ID || names.has(g.id)) continue;
  names.set(g.id, displayName(g.id, g.properties?.name ?? g.id));
}
for (const g of (usStates as unknown as Topo).objects.states.geometries) {
  if (!g.id || SKIP_STATE_FIPS.has(g.id)) continue;
  names.set(stateId(g.id), g.properties?.name ?? g.id);
}

/** Display name for a valid region id, or undefined. The US itself isn't valid: photos go to a state. */
export function regionName(id: string): string | undefined {
  return REGION_ID_RE.test(id) ? names.get(id) : undefined;
}
