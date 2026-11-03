// Client-side geography helpers shared by the globe and the admin uploader.
// Regions are countries (world-atlas) plus, inside the United States, individual states (us-atlas).
import { feature, mesh } from 'topojson-client';
import { geoArea, geoBounds, geoCentroid, geoContains } from 'd3-geo';
import type { Feature, FeatureCollection, MultiLineString, MultiPolygon, Polygon, Position } from 'geojson';
import type { Topology, GeometryCollection } from 'topojson-specification';
import worldUrl from 'world-atlas/countries-50m.json?url';
import statesUrl from 'us-atlas/states-10m.json?url';
import { displayName, stateId, US_ID } from '../data/travel';

export interface Region {
  /** ISO 3166-1 numeric for countries ("124"), "us-<FIPS>" for US states ("us-48"). */
  id: string;
  name: string;
  kind: 'country' | 'state';
  /** Polygon rings, largest polygon first. */
  polygons: Position[][][];
  feature: Feature<MultiPolygon>;
  bounds: [[number, number], [number, number]];
}

export interface World {
  /** Every country (the US included) and every US state, by id. */
  regions: Map<string, Region>;
  /** Countries for pickers, sorted by name. The US is left out: pick a state instead. */
  countries: Region[];
  /** US states (+ DC), sorted by name. */
  states: Region[];
  /** Country borders + coastlines, each arc once. */
  borders: MultiLineString;
  /** Borders between US states (no coastlines). */
  stateBorders: MultiLineString;
  land: FeatureCollection | Feature;
}

// Territories that world-atlas already has as their own countries (Puerto Rico, Guam, …).
const SKIP_STATE_FIPS = new Set(['60', '66', '69', '72', '78']);
const WORLD_BYTES = 760_000;
const STATES_BYTES = 115_000;

/** fetch() that reports download progress (0..1) when it can. */
export async function fetchText(url: string, onProgress?: (fraction: number) => void, estimate = WORLD_BYTES): Promise<string> {
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
    let a = 0;
    let b = 0;
    const report = () => onProgress?.((a * WORLD_BYTES + b * STATES_BYTES) / (WORLD_BYTES + STATES_BYTES));
    worldPromise = Promise.all([
      fetchText(worldUrl, (f) => ((a = f), report()), WORLD_BYTES),
      fetchText(statesUrl, (f) => ((b = f), report()), STATES_BYTES),
    ]).then(([w, s]) => buildWorld(JSON.parse(w), JSON.parse(s)));
    worldPromise.catch(() => (worldPromise = null));
  } else {
    onProgress?.(1);
  }
  return worldPromise;
}

type NameProps = { name?: string };

function makeRegion(id: string, name: string, kind: Region['kind'], polys: Position[][][]): Region {
  const polygons = polys
    .map((rings) => ({ rings, area: geoArea({ type: 'Polygon', coordinates: rings }) }))
    .sort((x, y) => y.area - x.area)
    .map((p) => p.rings);
  const feat: Feature<MultiPolygon> = { type: 'Feature', id, properties: {}, geometry: { type: 'MultiPolygon', coordinates: polygons } };
  return { id, name, kind, polygons, feature: feat, bounds: geoBounds(feat) };
}

/** Group features by id (world-atlas has a duplicate id: Australia + Ashmore Is.). */
function grouped(fc: FeatureCollection<Polygon | MultiPolygon, NameProps>) {
  const out = new Map<string, { names: string[]; polys: Position[][][] }>();
  for (const f of fc.features) {
    const id = f.id == null ? '' : String(f.id);
    if (!id || !f.geometry) continue;
    const g = out.get(id) ?? { names: [], polys: [] };
    g.names.push(f.properties?.name ?? id);
    if (f.geometry.type === 'Polygon') g.polys.push(f.geometry.coordinates);
    else g.polys.push(...f.geometry.coordinates);
    out.set(id, g);
  }
  return out;
}

function buildWorld(worldTopo: Topology, usTopo: Topology): World {
  const wObjects = worldTopo.objects as { countries: GeometryCollection<NameProps>; land: GeometryCollection };
  const uObjects = usTopo.objects as { states: GeometryCollection<NameProps> };

  const regions = new Map<string, Region>();
  const countries: Region[] = [];
  const states: Region[] = [];

  const cfc = feature(worldTopo, wObjects.countries) as FeatureCollection<Polygon | MultiPolygon, NameProps>;
  for (const [id, g] of grouped(cfc)) {
    const r = makeRegion(id, displayName(id, g.names[0]), 'country', g.polys);
    regions.set(id, r);
    if (id !== US_ID) countries.push(r);
  }

  const sfc = feature(usTopo, uObjects.states) as FeatureCollection<Polygon | MultiPolygon, NameProps>;
  for (const [fips, g] of grouped(sfc)) {
    if (SKIP_STATE_FIPS.has(fips)) continue;
    const r = makeRegion(stateId(fips), g.names[0], 'state', g.polys);
    regions.set(r.id, r);
    states.push(r);
  }

  countries.sort((x, y) => x.name.localeCompare(y.name));
  states.sort((x, y) => x.name.localeCompare(y.name));

  return {
    regions,
    countries,
    states,
    borders: mesh(worldTopo, wObjects.countries) as MultiLineString,
    stateBorders: mesh(usTopo, uObjects.states, (a, b) => a !== b) as MultiLineString,
    land: feature(worldTopo, wObjects.land),
  };
}

function inBounds(r: Region, lng: number, lat: number): boolean {
  const [[x0, y0], [x1, y1]] = r.bounds;
  if (lat < y0 - 0.5 || lat > y1 + 0.5) return false;
  // Bounds can wrap the antimeridian (x0 > x1).
  return x0 <= x1 ? lng >= x0 - 0.5 && lng <= x1 + 0.5 : lng >= x0 - 0.5 || lng <= x1 + 0.5;
}

function containing(list: Iterable<Region>, lat: number, lng: number): Region | null {
  for (const r of list) {
    if (inBounds(r, lng, lat) && geoContains(r.feature, [lng, lat])) return r;
  }
  return null;
}

/** The region at an exact point: a US state inside the US, otherwise the country. */
function regionAt(world: World, lat: number, lng: number): Region | null {
  const country = containing(world.countries, lat, lng); // every country except the US
  if (country) return country;
  // Inside (or right at the edge of) the US: answer with the state instead.
  const us = world.regions.get(US_ID);
  return us && inBounds(us, lng, lat) ? containing(world.states, lat, lng) : null;
}

/** Which country (or US state) is this point in? Falls back to a nearby one for photos taken on the coast or a boat. */
export function findRegionAt(world: World, lat: number, lng: number): Region | null {
  const direct = regionAt(world, lat, lng);
  if (direct) return direct;
  for (const r of [0.1, 0.25, 0.5]) {
    for (let a = 0; a < 360; a += 45) {
      const rad = (a * Math.PI) / 180;
      const hit = regionAt(world, lat + r * Math.sin(rad), lng + (r * Math.cos(rad)) / Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
      if (hit) return hit;
    }
  }
  return null;
}

/** Where to point the camera for a region, plus its rough angular size (radians). */
export function regionFocus(r: Region): { lat: number; lng: number; size: number } {
  const main: Polygon = { type: 'Polygon', coordinates: r.polygons[0] };
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
