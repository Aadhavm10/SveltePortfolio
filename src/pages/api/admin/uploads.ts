// Store one photo's files (already resized + EXIF-stripped in the browser). The photo is added to
// the travel data afterwards by POST /api/admin/photos, once for the whole batch, so a batch of
// photos costs one save instead of one per photo.
import type { APIRoute } from 'astro';
import { guard, json } from '../../../lib/server/auth';
import { deleteFiles, isOwnPhotoUrl, putFile, readManifest } from '../../../lib/server/travelStore';
import { storageFailure } from '../../../lib/server/storageErrors';
import { parseTarget, targetFolder } from '../../../lib/server/photoPlaces';
import { allPhotos } from '../../../data/travel';

export const prerender = false;

const MAX_FULL = 4 * 1024 * 1024 - 300 * 1024; // keep the whole request under Vercel's 4.5MB limit
const MAX_THUMB = 300 * 1024;
const MAX_DELETE = 100;

async function imageKind(file: File): Promise<'webp' | 'jpg' | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (s: number, e: number) => String.fromCharCode(...b.slice(s, e));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  return null;
}

export const POST: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return json({ error: 'Upload was too large or malformed.' }, 400);
  }

  const target = parseTarget(form.get('countryId'));
  if (!target) return json({ error: 'Pick a valid country, US state or home base.' }, 400);
  const folder = targetFolder(target);

  const full = form.get('full');
  const thumb = form.get('thumb');
  if (!(full instanceof File) || !(thumb instanceof File)) return json({ error: 'Missing image data.' }, 400);
  if (full.size > MAX_FULL || thumb.size > MAX_THUMB) return json({ error: 'Image is too large.' }, 413);
  const fullKind = await imageKind(full);
  const thumbKind = await imageKind(thumb);
  if (!fullKind || !thumbKind) return json({ error: 'Only WebP or JPEG images are accepted.' }, 415);

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const mime = (k: 'webp' | 'jpg') => (k === 'webp' ? 'image/webp' : 'image/jpeg');

  let fullUrl: string | undefined;
  try {
    fullUrl = await putFile(`travel/photos/${folder}/${id}-full.${fullKind}`, full, mime(fullKind));
    const thumbUrl = await putFile(`travel/photos/${folder}/${id}-thumb.${thumbKind}`, thumb, mime(thumbKind));
    return json({ full: fullUrl, thumb: thumbUrl });
  } catch (err) {
    if (fullUrl) await deleteFiles([fullUrl]).catch(() => {});
    return storageFailure('POST /api/admin/uploads', err);
  }
};

/** Remove files that were uploaded but never saved (a queued photo taken out of the queue). */
export const DELETE: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;

  let body: { urls?: unknown };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: 'Bad request.' }, 400);
  }
  const urls = body.urls;
  if (!Array.isArray(urls) || urls.length > MAX_DELETE || !urls.every(isOwnPhotoUrl)) {
    return json({ error: 'Bad file list.' }, 400);
  }

  try {
    // Never delete a file a saved photo uses (e.g. the save went through but its reply got lost).
    const inUse = new Set(allPhotos(await readManifest()).flatMap(({ photo }) => [photo.full, photo.thumb]));
    const unused = (urls as string[]).filter((u) => !inUse.has(u));
    await deleteFiles(unused);
    return json({ deleted: unused.length });
  } catch (err) {
    return storageFailure('DELETE /api/admin/uploads', err);
  }
};
