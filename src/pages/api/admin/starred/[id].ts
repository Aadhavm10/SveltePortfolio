// Rename / re-note / reorder the photos of a home base, or remove it (with its photos).
import type { APIRoute } from 'astro';
import { guard, json } from '../../../../lib/server/auth';
import { deleteFiles } from '../../../../lib/server/travelStore';
import { storageFailure } from '../../../../lib/server/storageErrors';
import { updatePlaces } from '../../../../lib/server/photoPlaces';

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
  let body: { name?: unknown; note?: unknown; order?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  if (typeof body.name === 'string' && !body.name.trim()) return json({ error: 'Give the place a name.' }, 400);
  if (body.order !== undefined && (!Array.isArray(body.order) || !body.order.every((x) => typeof x === 'string'))) {
    return json({ error: 'Bad photo order.' }, 400);
  }
  try {
    const { manifest } = await updatePlaces((m) => {
      const s = m.starred?.find((x) => x.id === id);
      if (!s) throw new NotFound();
      if (typeof body.name === 'string') s.name = body.name.trim().slice(0, 60);
      if (typeof body.note === 'string') s.note = body.note.trim().slice(0, 60) || undefined;
      if (Array.isArray(body.order) && s.photos) {
        const rank = new Map((body.order as string[]).map((pid, i) => [pid, i]));
        s.photos.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
      }
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
    const { manifest, result: removed } = await updatePlaces((m) => {
      const i = m.starred?.findIndex((x) => x.id === id) ?? -1;
      if (i < 0) throw new NotFound();
      return m.starred!.splice(i, 1)[0];
    });
    const files = (removed.photos ?? []).flatMap((p) => [p.full, p.thumb]);
    await deleteFiles(files).catch((e) => console.error('blob delete failed', e));
    return json({ manifest });
  } catch (err) {
    return fail(err);
  }
};
