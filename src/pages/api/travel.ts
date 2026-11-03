// Public, read-only: the manifest that drives the globe on the home page.
import type { APIRoute } from 'astro';
import { readManifest, storeMode } from '../../lib/server/travelStore';
import { publicManifest } from '../../data/travel';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const manifest = publicManifest(await readManifest());
    const cache =
      storeMode() === 'blob' ? 'public, max-age=0, s-maxage=30, stale-while-revalidate=300' : 'no-store';
    return new Response(JSON.stringify(manifest), {
      headers: { 'content-type': 'application/json', 'cache-control': cache },
    });
  } catch (err) {
    console.error('GET /api/travel failed', err);
    return new Response(JSON.stringify({ error: 'Could not load travel data.' }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
};
