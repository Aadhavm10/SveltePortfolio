// Add a home base (lived there / been many times): a glowing marker on the globe, no date.
import type { APIRoute } from 'astro';
import { guard, json } from '../../../lib/server/auth';
import { storageFailure } from '../../../lib/server/storageErrors';
import { updatePlaces } from '../../../lib/server/photoPlaces';
import { MAX_STARRED, type StarredPlace } from '../../../data/travel';

export const prerender = false;

class TooMany extends Error {}

const round2 = (n: number) => Math.round(n * 100) / 100;

export const POST: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;

  let body: { name?: unknown; note?: unknown; lat?: unknown; lng?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 60) : '';
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!name) return json({ error: 'Give the place a name.' }, 400);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return json({ error: 'Location must look like 32.78, -96.80.' }, 400);
  }

  const place: StarredPlace = {
    id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
    name,
    ...(note ? { note } : {}),
    lat: round2(lat),
    lng: round2(lng),
  };

  try {
    const { manifest } = await updatePlaces((m) => {
      m.starred ??= [];
      if (m.starred.length >= MAX_STARRED) throw new TooMany();
      m.starred.push(place);
    });
    return json({ manifest });
  } catch (err) {
    if (err instanceof TooMany) return json({ error: `You can star up to ${MAX_STARRED} places.` }, 400);
    return storageFailure('POST /api/admin/starred', err);
  }
};
