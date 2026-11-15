// Bring the travel data in line with the home bases: a place that contains a home base with photos
// lights up, and a place nothing keeps lit goes dark. Every save already does this; the uploader
// calls this when it opens and sees the data out of step (e.g. data saved before the rule existed).
// When nothing needs changing it writes nothing (one list call).
import type { APIRoute } from 'astro';
import { guard, json } from '../../../lib/server/auth';
import { readManifest } from '../../../lib/server/travelStore';
import { storageFailure } from '../../../lib/server/storageErrors';
import { syncHomeRegions } from '../../../lib/server/homeRegions';
import { updatePlaces } from '../../../lib/server/photoPlaces';

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;
  try {
    const current = await readManifest();
    const synced = structuredClone(current);
    syncHomeRegions(synced);
    if (JSON.stringify(synced.countries) === JSON.stringify(current.countries)) {
      return json({ manifest: current, changed: false });
    }
    // updatePlaces re-reads, applies the same sync and saves (retrying if a save races it).
    const { manifest } = await updatePlaces(() => {});
    return json({ manifest, changed: true });
  } catch (err) {
    return storageFailure('POST /api/admin/sync', err);
  }
};
