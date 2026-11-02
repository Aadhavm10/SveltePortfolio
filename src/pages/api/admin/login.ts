import type { APIRoute } from 'astro';
import { adminConfigured, checkPassword, json, sameOrigin, startSession } from '../../../lib/server/auth';

export const prerender = false;

export const POST: APIRoute = async ({ request, url, cookies }) => {
  if (!sameOrigin(request, url)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!adminConfigured()) return json({ error: 'ADMIN_PASSWORD is not set (min 10 characters).' }, 503);

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  if (!checkPassword(password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 1000));
    return json({ error: 'Wrong password.' }, 401);
  }

  startSession(cookies, url.protocol === 'https:');
  return json({ ok: true });
};
