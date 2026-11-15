// Add photos to countries, US states or home bases: one save for the whole batch.
// Their files were stored first, one photo at a time, by POST /api/admin/uploads.
import type { APIRoute } from 'astro';
import { guard, json } from '../../../lib/server/auth';
import { isOwnPhotoUrl } from '../../../lib/server/travelStore';
import { storageFailure } from '../../../lib/server/storageErrors';
import { MissingHomeError, parseTarget, photosAt, updatePlaces, type PlaceTarget } from '../../../lib/server/photoPlaces';
import { allPhotos, type Photo } from '../../../data/travel';

export const prerender = false;

const MAX_BATCH = 50;

function num(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** One photo of the batch, checked; or the reason it was refused. */
function parseEntry(raw: unknown, index: number): { target: PlaceTarget; photo: Photo } | string {
  if (!raw || typeof raw !== 'object') return 'Bad photo data.';
  const r = raw as Record<string, unknown>;

  const target = parseTarget(r.countryId);
  if (!target) return 'Pick a valid country, US state or home base.';
  // Only files this site stored can become photos on the globe.
  if (!isOwnPhotoUrl(r.full) || !isOwnPhotoUrl(r.thumb)) return 'Photo files must be uploaded here first.';

  const w = num(r.w);
  const h = num(r.h);
  if (!w || !h || w < 1 || h < 1 || w > 10000 || h > 10000) return 'Bad image size.';

  const lat = num(r.lat);
  const lng = num(r.lng);
  const hasCoords = lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  // Local wall-clock time from the photo ("2025-02-05T21:00:00"); kept as-is so the day never shifts.
  const takenAt =
    typeof r.takenAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(r.takenAt) && !Number.isNaN(Date.parse(r.takenAt))
      ? r.takenAt
      : undefined;
  const caption = (typeof r.caption === 'string' ? r.caption : '').trim().slice(0, 200) || undefined;
  const dhash = typeof r.dhash === 'string' && /^[0-9a-f]{16}$/.test(r.dhash) ? r.dhash : undefined;

  const photo: Photo = {
    // The position in the batch keeps ids unique when many photos are saved in the same millisecond.
    id: `${Date.now().toString(36)}${index.toString(36).padStart(2, '0')}${Math.random().toString(36).slice(2, 6)}`,
    full: r.full,
    thumb: r.thumb,
    w: Math.round(w),
    h: Math.round(h),
    takenAt,
    caption,
    showPin: r.showPin !== false,
    ...(dhash ? { dhash } : {}),
    ...(hasCoords ? { lat: round1(lat!), lng: round1(lng!) } : {}),
  };
  return { target, photo };
}

export const POST: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;

  let body: { photos?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (!Array.isArray(body.photos) || body.photos.length === 0) return json({ error: 'No photos to save.' }, 400);
  if (body.photos.length > MAX_BATCH) return json({ error: `Save at most ${MAX_BATCH} photos at a time.` }, 400);

  const entries: { target: PlaceTarget; photo: Photo }[] = [];
  for (const [i, raw] of body.photos.entries()) {
    const entry = parseEntry(raw, i);
    if (typeof entry === 'string') return json({ error: entry }, 400);
    entries.push(entry);
  }

  try {
    const { manifest } = await updatePlaces((m) => {
      // Skip files that are already saved, so repeating a save (after a lost reply) adds nothing twice.
      const saved = new Set(allPhotos(m).map(({ photo }) => photo.full));
      for (const { target, photo } of entries) {
        if (saved.has(photo.full)) continue;
        photosAt(m, target).push({ ...photo });
        saved.add(photo.full);
      }
    });
    return json({ manifest });
  } catch (err) {
    // The files stay in storage: the uploader keeps them and saves again on retry.
    if (err instanceof MissingHomeError) return json({ error: err.message }, 404);
    return storageFailure('POST /api/admin/photos', err);
  }
};
