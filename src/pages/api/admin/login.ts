import type { APIRoute } from 'astro';
import {
  adminConfigured,
  checkPassword,
  clearLoginFailures,
  json,
  loginRetryAfter,
  recordLoginFailure,
  sameOrigin,
  startSession,
} from '../../../lib/server/auth';

export const prerender = false;

function addressOf(request: Request, clientAddress: () => string): string {
  try {
    return clientAddress();
  } catch {
    return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  }
}

export const POST: APIRoute = async (ctx) => {
  const { request, url, cookies } = ctx;
  if (!sameOrigin(request, url)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!adminConfigured()) return json({ error: 'ADMIN_PASSWORD is not set (min 10 characters).' }, 503);

  const address = addressOf(request, () => ctx.clientAddress);
  const wait = loginRetryAfter(address);
  if (wait > 0) {
    const minutes = Math.ceil(wait / 60);
    return json({ error: `Too many wrong passwords. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.` }, 429, {
      'retry-after': String(wait),
    });
  }

  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }

  if (!checkPassword(password)) {
    recordLoginFailure(address);
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 1000));
    return json({ error: 'Wrong password.' }, 401);
  }

  clearLoginFailures(address);
  startSession(cookies, url.protocol === 'https:');
  return json({ ok: true });
};
