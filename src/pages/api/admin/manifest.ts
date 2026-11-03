// Uncached manifest for the admin UI.
import type { APIRoute } from 'astro';
import { isAdmin, json } from '../../../lib/server/auth';
import { readManifest } from '../../../lib/server/travelStore';
import { storageFailure } from '../../../lib/server/storageErrors';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Not signed in.' }, 401);
  try {
    return json(await readManifest());
  } catch (err) {
    return storageFailure('GET /api/admin/manifest', err);
  }
};
