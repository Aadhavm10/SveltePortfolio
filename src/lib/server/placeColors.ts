// Random place colours, chosen so places that border each other look completely different.
import { PALETTE, type Manifest } from '../../data/travel';
import { neighborsOf } from './regionNeighbors';

/** Neighbours' colours must be at least this far apart on the colour wheel (degrees). */
const MIN_HUE_GAP = 60;

function hueOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

function shuffled<T>(xs: readonly T[], rand: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A random palette colour that stands out from the colours of the visited places bordering `id`. */
export function pickColor(m: Manifest, id: string, rand: () => number = Math.random): string {
  const nearHues = neighborsOf(id)
    .map((n) => m.countries[n]?.color)
    .filter((c): c is string => !!c)
    .map(hueOf);
  const used = new Set(Object.entries(m.countries).filter(([k]) => k !== id).map(([, c]) => c.color.toLowerCase()));
  const options = shuffled(PALETTE, rand).map((color) => ({
    color,
    gap: nearHues.length ? Math.min(...nearHues.map((h) => hueGap(h, hueOf(color)))) : 180,
    fresh: !used.has(color),
  }));
  // Far enough from every neighbour; among those, prefer a colour no other place has yet.
  const far = options.filter((o) => o.gap >= MIN_HUE_GAP);
  if (far.length) return (far.find((o) => o.fresh) ?? far[0]).color;
  // Surrounded by many coloured neighbours: take the most different colour left.
  return options.reduce((best, o) => (o.gap > best.gap ? o : best)).color;
}

/** Give every place a fresh random colour, with neighbours always clearly different. */
export function recolorAll(m: Manifest, rand: () => number = Math.random): void {
  const ids = Object.keys(m.countries);
  const visited = new Set(ids);
  const near = new Map(ids.map((id) => [id, neighborsOf(id).filter((n) => visited.has(n))]));

  // Greedy colouring, most-connected places first (they have the fewest good options), ties in
  // random order. A tight cluster of states can occasionally box itself in, so try a few random
  // orders and keep the one whose closest pair of neighbours is furthest apart.
  let best: Map<string, string> | null = null;
  let bestWorst = -1;
  for (let attempt = 0; attempt < 40 && bestWorst < MIN_HUE_GAP; attempt++) {
    const order = shuffled(ids, rand).sort((a, b) => near.get(b)!.length - near.get(a)!.length);
    const draft: Manifest = { ...m, countries: {} };
    const colors = new Map<string, string>();
    for (const id of order) {
      const color = pickColor(draft, id, rand);
      colors.set(id, color);
      draft.countries[id] = { ...m.countries[id], color };
    }
    let worst = 180;
    for (const [id, ns] of near) for (const n of ns) worst = Math.min(worst, hueGap(hueOf(colors.get(id)!), hueOf(colors.get(n)!)));
    if (worst > bestWorst) {
      best = colors;
      bestWorst = worst;
    }
  }
  for (const [id, color] of best ?? []) m.countries[id].color = color;
}
