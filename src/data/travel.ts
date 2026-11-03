// Shared travel data types + helpers (safe to import on client and server).

export interface Photo {
  id: string;
  /** URL of the full-size image (max ~2000px, EXIF stripped). */
  full: string;
  /** URL of the grid thumbnail (~600px). */
  thumb: string;
  w: number;
  h: number;
  /** When the photo was taken, as the photo's own local time ("2025-02-05T21:00:00", no time zone). */
  takenAt?: string;
  /** Rounded to 0.1° (~11km) so exact locations are never published. */
  lat?: number;
  lng?: number;
  caption?: string;
  showPin: boolean;
}

export interface CountryEntry {
  /** Display name, e.g. "Canada". */
  name: string;
  /** Free text, e.g. "August 2024". */
  when?: string;
  blurb?: string;
  color: string;
  addedAt: string;
  photos: Photo[];
}

/** A place lived in / visited many times ("home base"): a glowing marker on the globe, no date. */
export interface StarredPlace {
  id: string;
  name: string;
  /** Optional short note, e.g. "Home". */
  note?: string;
  /** City-level position, rounded to 0.01° (~1km). */
  lat: number;
  lng: number;
}

export const MAX_STARRED = 50;

export interface Manifest {
  version: 1;
  updatedAt: string;
  /** Starred places (optional so older manifests still load). */
  starred?: StarredPlace[];
  /** Keyed by region id: a country ("124") or a US state ("us-48"). See REGION_ID_RE. */
  countries: Record<string, CountryEntry>;
}

export const emptyManifest = (): Manifest => ({
  version: 1,
  updatedAt: new Date(0).toISOString(),
  countries: {},
});

/** Site accent colours (same as the BubbleMenu hovers) + a few extras. */
export const PALETTE = [
  '#ff6b6b',
  '#4ecdc4',
  '#ffe66d',
  '#a8e6cf',
  '#ff8b94',
  '#b197fc',
  '#ffa94d',
  '#74c0fc',
];

/** "Home" for the travel arcs. */
export const HOME = { name: 'Dallas', lat: 32.78, lng: -96.8 };

// The United States is shown as individual states rather than one country.
export const US_ID = '840';
export const US_NAME = 'United States';
/** Region ids: ISO 3166-1 numeric for countries ("124"), "us-<FIPS>" for US states ("us-48" = Texas). */
export const REGION_ID_RE = /^(\d{3}|us-\d{2})$/;
export const stateId = (fips: string) => `us-${fips}`;
export const isStateId = (id: string) => id.startsWith('us-');

/** Nicer names for world-atlas' abbreviated ones. */
const DISPLAY_NAMES: Record<string, string> = {
  '840': 'United States',
  '826': 'United Kingdom',
  '036': 'Australia',
  '214': 'Dominican Republic',
  '180': 'DR Congo',
  '140': 'Central African Republic',
  '070': 'Bosnia and Herzegovina',
  '728': 'South Sudan',
  '226': 'Equatorial Guinea',
  '732': 'Western Sahara',
  '258': 'French Polynesia',
  '028': 'Antigua and Barbuda',
  '670': 'St. Vincent and the Grenadines',
  '659': 'St. Kitts and Nevis',
  '090': 'Solomon Islands',
  '584': 'Marshall Islands',
  '580': 'Northern Mariana Islands',
  '850': 'U.S. Virgin Islands',
  '092': 'British Virgin Islands',
  '796': 'Turks and Caicos',
  '136': 'Cayman Islands',
  '238': 'Falkland Islands',
  '234': 'Faroe Islands',
  '184': 'Cook Islands',
  '612': 'Pitcairn Islands',
  '876': 'Wallis and Futuna',
  '666': 'St. Pierre and Miquelon',
};

const SHORT_NAMES: Record<string, string> = {
  '840': 'USA',
  '826': 'UK',
  '784': 'UAE',
};

export function displayName(id: string, atlasName: string): string {
  return DISPLAY_NAMES[id] ?? atlasName;
}

export function shortName(id: string, name: string): string {
  return SHORT_NAMES[id] ?? name;
}

/** Countries in journey order: earliest photo first, then by when they were added. */
export function orderedCountryIds(m: Manifest): string[] {
  const firstDate = (c: CountryEntry) => {
    const dates = c.photos.map((p) => p.takenAt).filter(Boolean) as string[];
    return dates.length ? dates.sort()[0] : c.addedAt;
  };
  return Object.keys(m.countries).sort((a, b) =>
    firstDate(m.countries[a]).localeCompare(firstDate(m.countries[b]))
  );
}

/**
 * What the public globe gets: the same data, minus the location of any photo whose pin is hidden,
 * so turning a pin off really keeps that spot private.
 */
export function publicManifest(m: Manifest): Manifest {
  const countries: Record<string, CountryEntry> = {};
  for (const [id, c] of Object.entries(m.countries)) {
    countries[id] = {
      ...c,
      photos: c.photos.map((p) => (p.showPin ? p : { ...p, lat: undefined, lng: undefined })),
    };
  }
  return { ...m, countries };
}

/** Next palette colour that no visited country uses yet (cycles when all are taken). */
export function nextColor(m: Manifest): string {
  const used = new Set(Object.values(m.countries).map((c) => c.color));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[Object.keys(m.countries).length % PALETTE.length];
}
