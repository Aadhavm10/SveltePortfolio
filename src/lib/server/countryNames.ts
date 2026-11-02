// Server-side lookup of valid country ids → display names (from world-atlas).
import world from 'world-atlas/countries-50m.json';
import { displayName } from '../../data/travel';

type Geometry = { id?: string; properties?: { name?: string } };

const names = new Map<string, string>();
for (const g of (world as unknown as { objects: { countries: { geometries: Geometry[] } } }).objects.countries.geometries) {
  if (!g.id || names.has(g.id)) continue;
  names.set(g.id, displayName(g.id, g.properties?.name ?? g.id));
}

export function countryName(id: string): string | undefined {
  return names.get(id);
}
