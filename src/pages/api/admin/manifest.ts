// Uncached manifest for the admin UI.
import type { APIRoute } from 'astro';
import { isAdmin, json } from '../../../lib/server/auth';
import { readManifest } from '../../../lib/server/travelStore';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Not signed in.' }, 401);
  return json(await readManifest());
};
