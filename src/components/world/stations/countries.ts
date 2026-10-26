import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countriesTopo from 'world-atlas/countries-110m.json';
import { travelPhotos, trips, type Trip } from '../../../data/portfolio';

export type Ring = [number, number][];

export interface Country {
  name: string;
  polygons: Ring[][];
  /** lng/lat bounds, after unwrapping across the date line. */
  bbox: [number, number, number, number];
  centroid: { lat: number; lng: number };
}

export interface Visited {
  /** Name shown on the card. */
  label: string;
  /** The outline on the globe; null for tiny countries drawn as a dot. */
  country: Country | null;
  centroid: { lat: number; lng: number };
  trip: Trip | null;
  photos: string[];
}

/** Home, where the arcs start: Dallas. */
export const HOME = { lat: 32.78, lng: -96.8 };

const slug = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Everyday names for the map's names. */
const ALIASES: Record<string, string> = {
  usa: 'United States of America',
  us: 'United States of America',
  'united-states': 'United States of America',
  america: 'United States of America',
  uk: 'United Kingdom',
  england: 'United Kingdom',
  scotland: 'United Kingdom',
  wales: 'United Kingdom',
  britain: 'United Kingdom',
  'great-britain': 'United Kingdom',
  'northern-ireland': 'United Kingdom',
  uae: 'United Arab Emirates',
  dubai: 'United Arab Emirates',
  'czech-republic': 'Czechia',
  holland: 'Netherlands',
  'the-netherlands': 'Netherlands',
  korea: 'South Korea',
  turkiye: 'Turkey',
  'north-macedonia': 'Macedonia',
  bosnia: 'Bosnia and Herz.',
  'bosnia-and-herzegovina': 'Bosnia and Herz.',
  'dominican-republic': 'Dominican Rep.',
  'ivory-coast': "Côte d'Ivoire",
  swaziland: 'eSwatini',
  eswatini: 'eSwatini',
  'south-sudan': 'S. Sudan',
  drc: 'Dem. Rep. Congo',
  burma: 'Myanmar'
};

/** Countries too small for the world outline map; they get a dot instead. */
const SMALL: Record<string, { label: string; lat: number; lng: number }> = {
  singapore: { label: 'Singapore', lat: 1.35, lng: 103.82 },
  'hong-kong': { label: 'Hong Kong', lat: 22.32, lng: 114.17 },
  macau: { label: 'Macau', lat: 22.2, lng: 113.55 },
  maldives: { label: 'Maldives', lat: 3.2, lng: 73.22 },
  bahrain: { label: 'Bahrain', lat: 26.07, lng: 50.55 },
  malta: { label: 'Malta', lat: 35.9, lng: 14.45 },
  monaco: { label: 'Monaco', lat: 43.73, lng: 7.42 },
  'vatican-city': { label: 'Vatican City', lat: 41.9, lng: 12.45 },
  'san-marino': { label: 'San Marino', lat: 43.94, lng: 12.46 },
  andorra: { label: 'Andorra', lat: 42.5, lng: 1.52 },
  liechtenstein: { label: 'Liechtenstein', lat: 47.16, lng: 9.55 },
  mauritius: { label: 'Mauritius', lat: -20.2, lng: 57.5 },
  seychelles: { label: 'Seychelles', lat: -4.68, lng: 55.49 },
  barbados: { label: 'Barbados', lat: 13.19, lng: -59.54 },
  bermuda: { label: 'Bermuda', lat: 32.3, lng: -64.79 },
  aruba: { label: 'Aruba', lat: 12.52, lng: -69.97 },
  'saint-lucia': { label: 'Saint Lucia', lat: 13.91, lng: -60.98 },
  grenada: { label: 'Grenada', lat: 12.11, lng: -61.68 },
  'antigua-and-barbuda': { label: 'Antigua and Barbuda', lat: 17.06, lng: -61.8 }
};

/** Shifts each point's longitude to within 180 degrees of the previous one, so rings don't jump at the date line. */
function unwrap(ring: Ring): Ring {
  let offset = 0;
  let prev = ring[0][0];
  return ring.map(([lng, lat]) => {
    const d = lng - prev;
    if (d > 180) offset -= 360;
    else if (d < -180) offset += 360;
    prev = lng;
    return [lng + offset, lat];
  });
}

function ringArea(ring: Ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return a / 2;
}

function ringCentroid(ring: Ring) {
  let cx = 0;
  let cy = 0;
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
    a += f;
  }
  if (Math.abs(a) < 1e-9) return { lng: ring[0][0], lat: ring[0][1] };
  return { lng: cx / (3 * a), lat: cy / (3 * a) };
}

const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

let all: Country[] | null = null;

/** Every country on the 1:110m Natural Earth map. */
export function countries() {
  if (all) return all;
  const topology = countriesTopo as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const geo = feature(topology, topology.objects.countries);
  all = geo.features.map((f) => {
    const g = f.geometry;
    const raw = g.type === 'Polygon' ? [g.coordinates as Ring[]] : g.type === 'MultiPolygon' ? (g.coordinates as Ring[][]) : [];
    const polygons = raw.map((poly) => poly.map(unwrap));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let biggest: Ring = polygons[0]?.[0] ?? [[0, 0]];
    for (const poly of polygons) {
      for (const [x, y] of poly[0]) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
      if (Math.abs(ringArea(poly[0])) > Math.abs(ringArea(biggest))) biggest = poly[0];
    }
    const c = ringCentroid(biggest);
    return { name: String(f.properties?.name ?? ''), polygons, bbox: [minX, minY, maxX, maxY], centroid: { lat: c.lat, lng: wrapLng(c.lng) } };
  });
  return all;
}

/** Finds the map country (or small-country dot) for a name typed in portfolio.ts or used as a folder name. */
function resolve(name: string): { country: Country | null; label: string; centroid: { lat: number; lng: number } } | null {
  const key = slug(name);
  const target = ALIASES[key];
  const list = countries();
  const country = list.find((c) => (target ? c.name === target : slug(c.name) === key));
  if (country) return { country, label: name, centroid: country.centroid };
  const small = SMALL[key];
  if (small) return { country: null, label: small.label, centroid: { lat: small.lat, lng: small.lng } };
  return null;
}

/** Fuller names for the map's abbreviations, for folder-only countries. */
const PRETTY: Record<string, string> = {
  'United States of America': 'United States',
  'Bosnia and Herz.': 'Bosnia and Herzegovina',
  'Dominican Rep.': 'Dominican Republic',
  'Dem. Rep. Congo': 'DR Congo',
  'Central African Rep.': 'Central African Republic',
  'S. Sudan': 'South Sudan',
  'Eq. Guinea': 'Equatorial Guinea',
  Macedonia: 'North Macedonia'
};

const titleCase = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

let visitedList: Visited[] | null = null;

/** The countries I've been to: everything in `trips`, plus any photo folder without a trip yet. */
export function visited() {
  if (visitedList) return visitedList;
  const list: Visited[] = [];
  const seen = new Map<string, Visited>();
  const add = (name: string, trip: Trip | null, folder: string | null) => {
    const found = resolve(name);
    if (!found) {
      console.warn(`[globe] No country called "${name}" on the map. Try its everyday English name.`);
      return;
    }
    const id = found.country?.name ?? found.label;
    const existing = seen.get(id);
    const photos = folder ? travelPhotos[folder] ?? [] : [];
    if (existing) {
      existing.trip ??= trip;
      existing.photos.push(...photos.filter((p) => !existing.photos.includes(p)));
      return;
    }
    const label = trip?.country ?? (found.country ? PRETTY[found.country.name] ?? found.country.name : found.label);
    const v: Visited = { label, country: found.country, centroid: found.centroid, trip, photos: [...photos] };
    seen.set(id, v);
    list.push(v);
  };
  for (const trip of trips) add(trip.country, trip, slug(trip.country));
  for (const folder of Object.keys(travelPhotos)) add(titleCase(folder), null, folder);
  // Folders matched by alias (e.g. "usa") also pick up photos for a trip named differently.
  visitedList = list.sort((a, b) => a.centroid.lng - b.centroid.lng);
  return visitedList;
}

/** Is the lng/lat point inside this country? */
export function contains(country: Country, lng: number, lat: number) {
  let inside = false;
  for (const poly of country.polygons) {
    for (const ring of poly) {
      // Bring the ring next to the point before ray casting, in case it sits across the date line.
      const shift = Math.round((lng - ring[0][0]) / 360) * 360;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0] + shift;
        const yi = ring[i][1];
        const xj = ring[j][0] + shift;
        const yj = ring[j][1];
        if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
  }
  return inside;
}

/** Which visited country (index into visited()) is at this point, if any. */
export function visitedAt(lng: number, lat: number) {
  const list = visited();
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    if (v.country) {
      const [x0, y0, x1, y1] = v.country.bbox;
      const l = lng + Math.round(((x0 + x1) / 2 - lng) / 360) * 360;
      if (l < x0 - 1 || l > x1 + 1 || lat < y0 - 1 || lat > y1 + 1) continue;
      if (contains(v.country, lng, lat)) return i;
    } else {
      const dLng = Math.abs(wrapLng(lng - v.centroid.lng)) * Math.cos((lat * Math.PI) / 180);
      if (Math.hypot(dLng, lat - v.centroid.lat) < 3) return i;
    }
  }
  return -1;
}
