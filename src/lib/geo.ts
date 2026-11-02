// Client-side geography helpers shared by the globe and the admin uploader.
import { feature, mesh } from 'topojson-client';
import { geoArea, geoBounds, geoCentroid, geoContains } from 'd3-geo';
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldUrl from 'world-atlas/countries-50m.json?url';
import { displayName } from '../data/travel';

export interface Country {
  id: string;
  name: string;
  /** Polygon rings, largest polygon first. */
  polygons: Position[][][];
  feature: Feature<MultiPolygon>;
  bounds: [[number, number], [number, number]];
}

export interface World {
  countries: Map<string, Country>;
  /** Sorted by name, for pickers. */
  list: Country[];
  /** Country borders + coastlines, each arc once. */
  borders: MultiLineString;
  land: FeatureCollection | Feature;
}

const WORLD_BYTES_ESTIMATE = 760_000;

/** fetch() that reports download progress (0..1) when it can. */
export async function fetchText(
  url: string,
  onProgress?: (fraction: number) => void,
  estimate = WORLD_BYTES_ESTIMATE
): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  if (!res.body || !onProgress) {
    const text = await res.text();
    onProgress?.(1);
    return text;
  }
  const total = Number(res.headers.get('content-length')) || estimate;
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(Math.min(0.99, loaded / total));
  }
  onProgress(1);
  const all = new Uint8Array(loaded);
  let o = 0;
  for (const c of chunks) {
    all.set(c, o);
    o += c.length;
  }
  return new TextDecoder().decode(all);
}

let worldPromise: Promise<World> | null = null;

export function loadWorld(onProgress?: (fraction: number) => void): Promise<World> {
  if (!worldPromise) {
    worldPromise = fetchText(worldUrl, onProgress).then((text) => buildWorld(JSON.parse(text)));
    worldPromise.catch(() => (worldPromise = null));
  } else {
    onProgress?.(1);
  }
  return worldPromise;
}

type CountryProps = { name?: string };

function buildWorld(topo: Topology): World {
  const objects = topo.objects as { countries: GeometryCollection<CountryProps>; land: GeometryCollection };
  const fc = feature(topo, objects.countries) as FeatureCollection<Polygon | MultiPolygon, CountryProps>;

  // Group by id (world-atlas has a couple of duplicate ids, e.g. Australia + Ashmore Is.).
  const grouped = new Map<string, { names: string[]; polys: Position[][][] }>();
  for (const f of fc.features) {
    const id = f.id == null ? '' : String(f.id);
    if (!id || !f.geometry) continue;
    const g = grouped.get(id) ?? { names: [], polys: [] };
    g.names.push(f.properties?.name ?? id);
    if (f.geometry.type === 'Polygon') g.polys.push(f.geometry.coordinates);
    else g.polys.push(...f.geometry.coordinates);
    grouped.set(id, g);
  }

  const countries = new Map<string, Country>();
  for (const [id, g] of grouped) {
    const polygons = g.polys
      .map((rings) => ({ rings, area: geoArea({ type: 'Polygon', coordinates: rings }) }))
      .sort((a, b) => b.area - a.area)
      .map((p) => p.rings);
    const feat: Feature<MultiPolygon> = {
      type: 'Feature',
      id,
      properties: {},
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    };
    countries.set(id, {
      id,
      name: displayName(id, g.names[0]),
      polygons,
      feature: feat,
      bounds: geoBounds(feat),
    });
  }

  const list = [...countries.values()].sort((a, b) => a.name.localeCompare(b.name));
  const borders = mesh(topo, objects.countries) as MultiLineString;
  const land = feature(topo, objects.land);
  return { countries, list, borders, land };
}

function inBounds(c: Country, lng: number, lat: number): boolean {
  const [[x0, y0], [x1, y1]] = c.bounds;
  if (lat < y0 - 0.5 || lat > y1 + 0.5) return false;
  // Bounds can wrap the antimeridian (x0 > x1).
  return x0 <= x1 ? lng >= x0 - 0.5 && lng <= x1 + 0.5 : lng >= x0 - 0.5 || lng <= x1 + 0.5;
}

function containing(world: World, lat: number, lng: number): Country | null {
  for (const c of world.countries.values()) {
    if (inBounds(c, lng, lat) && geoContains(c.feature, [lng, lat])) return c;
  }
  return null;
}

/** Which country is this point in? Falls back to a nearby country for photos taken on the coast or a boat. */
export function findCountryAt(world: World, lat: number, lng: number): Country | null {
  const direct = containing(world, lat, lng);
  if (direct) return direct;
  for (const r of [0.1, 0.25, 0.5]) {
    for (let a = 0; a < 360; a += 45) {
      const rad = (a * Math.PI) / 180;
      const hit = containing(world, lat + r * Math.sin(rad), lng + (r * Math.cos(rad)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
      if (hit) return hit;
    }
  }
  return null;
}

/** Where to point the camera for a country, plus its rough angular size (radians). */
export function countryFocus(c: Country): { lat: number; lng: number; size: number } {
  const main: Polygon = { type: 'Polygon', coordinates: c.polygons[0] };
  const [lng, lat] = geoCentroid(main);
  return { lat, lng, size: Math.sqrt(geoArea(main)) };
}

/** Same convention as three-conic-polygon-geometry: lng 0 → +Z, lng 90 → +X, north → +Y. */
export function latLngToVector3(lat: number, lng: number, r = 1): [number, number, number] {
  const phi = (lat * Math.PI) / 180;
  const lam = (lng * Math.PI) / 180;
  return [r * Math.cos(phi) * Math.sin(lam), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lam)];
}

export function vector3ToLatLng(x: number, y: number, z: number): { lat: number; lng: number } {
  const r = Math.hypot(x, y, z) || 1;
  return { lat: (Math.asin(y / r) * 180) / Math.PI, lng: (Math.atan2(x, z) * 180) / Math.PI };
}
