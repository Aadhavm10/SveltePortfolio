// Password + signed-cookie auth for the private /admin uploader.
// There is exactly one user (the site owner), identified by ADMIN_PASSWORD.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { AstroCookies } from 'astro';
import { ADMIN_PASSWORD } from 'astro:env/server';

const COOKIE = 'am_admin';
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days
const MIN_PASSWORD_LENGTH = 10;

export function adminConfigured(): boolean {
  return typeof ADMIN_PASSWORD === 'string' && ADMIN_PASSWORD.length >= MIN_PASSWORD_LENGTH;
}

/** Signing key derived from the password, so changing it logs out every session. */
function sessionKey(): Buffer {
  return createHash('sha256').update(`am-admin-session:${ADMIN_PASSWORD}`).digest();
}

function sign(value: string): string {
  return createHmac('sha256', sessionKey()).update(value).digest('base64url');
}

function safeEqual(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(input: unknown): boolean {
  if (!adminConfigured() || typeof input !== 'string') return false;
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(ADMIN_PASSWORD as string).digest();
  return safeEqual(a, b);
}

export function verifySession(value: string | undefined): boolean {
  if (!value || !adminConfigured()) return false;
  const [exp, sig] = value.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(Buffer.from(sig), Buffer.from(sign(exp)));
}

export function isAdmin(cookies: AstroCookies): boolean {
  return verifySession(cookies.get(COOKIE)?.value);
}

export function startSession(cookies: AstroCookies, secure: boolean): void {
  const exp = String(Date.now() + MAX_AGE_S * 1000);
  cookies.set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export function endSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE, { path: '/' });
}

/** Browsers always send Origin on POST/PATCH/DELETE; reject anything cross-site. */
export function sameOrigin(request: Request, url: URL): boolean {
  return request.headers.get('origin') === url.origin;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  });
}

/**
 * Guard for every mutating /api/admin/* route.
 * Returns an error Response to send back, or null when the request may proceed.
 */
export function guard(ctx: { request: Request; url: URL; cookies: AstroCookies }): Response | null {
  if (!sameOrigin(ctx.request, ctx.url)) return json({ error: 'Cross-site request blocked.' }, 403);
  if (!isAdmin(ctx.cookies)) return json({ error: 'Not signed in.' }, 401);
  return null;
}
