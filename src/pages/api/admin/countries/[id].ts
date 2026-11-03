// Edit a visited country's dates, note, colour and photo order.
import type { APIRoute } from 'astro';
import { guard, json } from '../../../../lib/server/auth';
import { updateManifest } from '../../../../lib/server/travelStore';
import { storageFailure } from '../../../../lib/server/storageErrors';

export const prerender = false;

class NotFound extends Error {}

export const PATCH: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;
  const id = ctx.params.id ?? '';

  let body: { when?: unknown; blurb?: unknown; color?: unknown; order?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  if (body.color !== undefined && (typeof body.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(body.color))) {
    return json({ error: 'Colour must look like #4ecdc4.' }, 400);
  }
  if (body.order !== undefined && (!Array.isArray(body.order) || !body.order.every((x) => typeof x === 'string'))) {
    return json({ error: 'Bad photo order.' }, 400);
  }

  try {
    const { manifest } = await updateManifest((m) => {
      const c = m.countries[id];
      if (!c) throw new NotFound();
      if (typeof body.when === 'string') c.when = body.when.trim().slice(0, 80) || undefined;
      if (typeof body.blurb === 'string') c.blurb = body.blurb.trim().slice(0, 1200) || undefined;
      if (typeof body.color === 'string') c.color = body.color.toLowerCase();
      if (Array.isArray(body.order)) {
        const rank = new Map((body.order as string[]).map((pid, i) => [pid, i]));
        c.photos.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
      }
    });
    return json({ manifest });
  } catch (err) {
    if (err instanceof NotFound) return json({ error: 'Country not found.' }, 404);
    return storageFailure('PATCH country', err);
  }
};
