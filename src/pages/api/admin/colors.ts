// Shuffle every place's colour (neighbouring places always clearly different).
import type { APIRoute } from 'astro';
import { guard, json } from '../../../lib/server/auth';
import { updateManifest } from '../../../lib/server/travelStore';
import { storageFailure } from '../../../lib/server/storageErrors';
import { recolorAll } from '../../../lib/server/placeColors';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;
  try {
    const { manifest } = await updateManifest((m) => recolorAll(m));
    return json({ manifest });
  } catch (err) {
    return storageFailure('POST /api/admin/colors', err);
  }
};
