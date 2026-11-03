// Which regions (countries and US states) border each other, so neighbouring places on the globe
// can get clearly different colours. Built once, on first use, from the same map data as the globe.
import { neighbors } from 'topojson-client';
import type { GeometryObject } from 'topojson-specification';
import world from 'world-atlas/countries-50m.json';
import usStates from 'us-atlas/states-10m.json';
import { stateId, US_ID } from '../../data/travel';
import { SKIP_STATE_FIPS } from './countryNames';

type Topo = { objects: Record<string, { geometries: (GeometryObject & { id?: string })[] }> };

// The two atlases don't share borders with each other, so these are listed by hand (state FIPS).
// Canada includes the Great Lakes water border (Ohio, Pennsylvania).
const CROSS_BORDERS: Record<string, string[]> = {
  '124': ['02', '53', '16', '30', '38', '27', '26', '36', '50', '33', '23', '39', '42'],
  '484': ['06', '04', '35', '48'],
};

let adjacency: Map<string, Set<string>> | null = null;

function build(): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  const addTopology = (geoms: (GeometryObject & { id?: string })[], idOf: (raw: string) => string | null) => {
    const ids = geoms.map((g) => (g.id ? idOf(g.id) : null));
    neighbors(geoms).forEach((list, i) => {
      const a = ids[i];
      if (a) for (const j of list) if (ids[j]) link(a, ids[j]!);
    });
  };
  addTopology((world as unknown as Topo).objects.countries.geometries, (id) => (id === US_ID ? null : id));
  addTopology((usStates as unknown as Topo).objects.states.geometries, (id) => (SKIP_STATE_FIPS.has(id) ? null : stateId(id)));
  for (const [country, states] of Object.entries(CROSS_BORDERS)) for (const s of states) link(country, stateId(s));
  return adj;
}

/** Region ids that share a border with `id`. */
export function neighborsOf(id: string): string[] {
  adjacency ??= build();
  return [...(adjacency.get(id) ?? [])];
}
