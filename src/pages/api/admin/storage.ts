// How much photo storage is used, compared with the free plan's 1 GB of Vercel Blob storage.
// Checked on demand from the uploader (one list call per 1,000 files).
import type { APIRoute } from 'astro';
import { isAdmin, json } from '../../../lib/server/auth';
import { storageUsage } from '../../../lib/server/travelStore';
import { storageFailure } from '../../../lib/server/storageErrors';

export const prerender = false;

/** Vercel Blob storage included on the free (Hobby) plan: 1 GB (decimal, the safer reading). */
const FREE_LIMIT_BYTES = 1_000_000_000;

export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ error: 'Not signed in.' }, 401);
  try {
    return json({ ...(await storageUsage()), freeLimitBytes: FREE_LIMIT_BYTES });
  } catch (err) {
    return storageFailure('GET /api/admin/storage', err);
  }
};
