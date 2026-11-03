// Edit, move or delete a single photo (in a country / US state or a home base).
import type { APIRoute } from 'astro';
import { guard, json } from '../../../../lib/server/auth';
import { deleteFiles, updateManifest } from '../../../../lib/server/travelStore';
import { storageFailure } from '../../../../lib/server/storageErrors';
import { findPhoto, MissingHomeError, parseTarget, photosAt, targetKey } from '../../../../lib/server/photoPlaces';

export const prerender = false;

class NotFound extends Error {}

function fail(err: unknown): Response {
  if (err instanceof NotFound) return json({ error: 'Photo not found.' }, 404);
  if (err instanceof MissingHomeError) return json({ error: err.message }, 404);
  return storageFailure('photo route', err);
}

export const DELETE: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  try {
    const { manifest, result: removed } = await updateManifest((m) => {
      const hit = findPhoto(m, id);
      if (!hit) throw new NotFound();
      hit.remove();
      return hit.photo;
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

  const moveTo = body.countryId === undefined ? null : parseTarget(body.countryId);
  if (body.countryId !== undefined && !moveTo) return json({ error: 'Pick a valid country, US state or home base.' }, 400);

  try {
    const { manifest } = await updateManifest((m) => {
      const hit = findPhoto(m, id);
      if (!hit) throw new NotFound();
      const photo = hit.photo;
      if (typeof body.caption === 'string') photo.caption = body.caption.trim().slice(0, 200) || undefined;
      if (typeof body.showPin === 'boolean') photo.showPin = body.showPin;

      if (moveTo && targetKey(moveTo) !== hit.key) {
        const dest = photosAt(m, moveTo); // before removing, so a missing home base changes nothing
        hit.remove();
        // Coordinates belong to the old place, so drop them when moving.
        delete photo.lat;
        delete photo.lng;
        dest.push(photo);
      }
    });
    return json({ manifest });
  } catch (err) {
    return fail(err);
  }
};
