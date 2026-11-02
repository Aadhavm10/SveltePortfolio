// Edit or delete a single photo.
import type { APIRoute } from 'astro';
import { guard, json } from '../../../../lib/server/auth';
import { countryName } from '../../../../lib/server/countryNames';
import { deleteFiles, StoreNotConfiguredError, updateManifest } from '../../../../lib/server/travelStore';
import { nextColor, type Manifest, type Photo } from '../../../../data/travel';

export const prerender = false;

class NotFound extends Error {}

function findPhoto(m: Manifest, id: string): { countryId: string; index: number } | null {
  for (const [countryId, c] of Object.entries(m.countries)) {
    const index = c.photos.findIndex((p) => p.id === id);
    if (index !== -1) return { countryId, index };
  }
  return null;
}

function fail(err: unknown): Response {
  if (err instanceof NotFound) return json({ error: 'Photo not found.' }, 404);
  if (err instanceof StoreNotConfiguredError) return json({ error: err.message }, 503);
  console.error('photo route failed', err);
  return json({ error: 'Something went wrong. Please try again.' }, 500);
}

export const DELETE: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  try {
    const { manifest, result: removed } = await updateManifest((m) => {
      const hit = findPhoto(m, id);
      if (!hit) throw new NotFound();
      const country = m.countries[hit.countryId];
      const [photo] = country.photos.splice(hit.index, 1);
      // A country with no photos left stops glowing on the globe.
      if (country.photos.length === 0) delete m.countries[hit.countryId];
      return photo;
    });
    await deleteFiles([removed.full, removed.thumb]).catch((e) => console.error('blob delete failed', e));
    return json({ manifest });
  } catch (err) {
    return fail(err);
  }
};

export const PATCH: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  let body: { caption?: unknown; showPin?: unknown; countryId?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  const moveTo = typeof body.countryId === 'string' ? body.countryId : undefined;
  const moveName = moveTo && /^\d{3}$/.test(moveTo) ? countryName(moveTo) : undefined;
  if (moveTo && !moveName) return json({ error: 'Pick a valid country.' }, 400);

  try {
    const { manifest } = await updateManifest((m) => {
      const hit = findPhoto(m, id);
      if (!hit) throw new NotFound();
      const photo: Photo = m.countries[hit.countryId].photos[hit.index];
      if (typeof body.caption === 'string') photo.caption = body.caption.trim().slice(0, 200) || undefined;
      if (typeof body.showPin === 'boolean') photo.showPin = body.showPin;

      if (moveTo && moveTo !== hit.countryId) {
        m.countries[hit.countryId].photos.splice(hit.index, 1);
        if (m.countries[hit.countryId].photos.length === 0) delete m.countries[hit.countryId];
        // Coordinates belong to the old country, so drop them when moving.
        delete photo.lat;
        delete photo.lng;
        if (!m.countries[moveTo]) {
          m.countries[moveTo] = { name: moveName!, color: nextColor(m), addedAt: new Date().toISOString(), photos: [] };
        }
        m.countries[moveTo].photos.push(photo);
      }
    });
    return json({ manifest });
  } catch (err) {
    return fail(err);
  }
};
