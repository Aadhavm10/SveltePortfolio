import type { APIRoute } from 'astro';
import { endSession, json, sameOrigin } from '../../../lib/server/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json({ error: 'Cross-site request blocked.' }, 403);
  endSession(cookies);
  return json({ ok: true });
};
