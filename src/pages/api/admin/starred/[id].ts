// Rename / re-note or remove a starred place.
import type { APIRoute } from 'astro';
import { guard, json } from '../../../../lib/server/auth';
import { updateManifest } from '../../../../lib/server/travelStore';
import { storageFailure } from '../../../../lib/server/storageErrors';

export const prerender = false;

class NotFound extends Error {}

function fail(err: unknown): Response {
  if (err instanceof NotFound) return json({ error: 'Starred place not found.' }, 404);
  return storageFailure('starred route', err);
}

export const PATCH: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;
  const id = ctx.params.id ?? '';
  let body: { name?: unknown; note?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (typeof body.name === 'string' && !body.name.trim()) return json({ error: 'Give the place a name.' }, 400);
  try {
    const { manifest } = await updateManifest((m) => {
      const s = m.starred?.find((x) => x.id === id);
      if (!s) throw new NotFound();
      if (typeof body.name === 'string') s.name = body.name.trim().slice(0, 60);
      if (typeof body.note === 'string') s.note = body.note.trim().slice(0, 60) || undefined;
    });
    return json({ manifest });
  } catch (err) {
    return fail(err);
  }
};

export const DELETE: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;
  const id = ctx.params.id ?? '';
  try {
    const { manifest } = await updateManifest((m) => {
      const i = m.starred?.findIndex((x) => x.id === id) ?? -1;
      if (i < 0) throw new NotFound();
      m.starred!.splice(i, 1);
    });
    return json({ manifest });
  } catch (err) {
    return fail(err);
  }
};
