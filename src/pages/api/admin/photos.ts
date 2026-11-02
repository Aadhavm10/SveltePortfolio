// Add a photo (already resized + EXIF-stripped in the browser) to a country.
import type { APIRoute } from 'astro';
import { guard, json } from '../../../lib/server/auth';
import { regionName } from '../../../lib/server/countryNames';
import { deleteFiles, putFile, StoreNotConfiguredError, updateManifest } from '../../../lib/server/travelStore';
import { nextColor, type Photo } from '../../../data/travel';

export const prerender = false;

const MAX_FULL = 4 * 1024 * 1024 - 300 * 1024; // keep the whole request under Vercel's 4.5MB limit
const MAX_THUMB = 300 * 1024;

async function imageKind(file: File): Promise<'webp' | 'jpg' | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const ascii = (s: number, e: number) => String.fromCharCode(...b.slice(s, e));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  return null;
}

function num(v: FormDataEntryValue | null): number | undefined {
  if (typeof v !== 'string' || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export const POST: APIRoute = async (ctx) => {
  const denied = guard(ctx);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await ctx.request.formData();
  } catch {
    return json({ error: 'Upload was too large or malformed.' }, 400);
  }

  const countryId = String(form.get('countryId') ?? '');
  const name = regionName(countryId);
  if (!name) return json({ error: 'Pick a valid country or US state.' }, 400);

  const full = form.get('full');
  const thumb = form.get('thumb');
  if (!(full instanceof File) || !(thumb instanceof File)) return json({ error: 'Missing image data.' }, 400);
  if (full.size > MAX_FULL || thumb.size > MAX_THUMB) return json({ error: 'Image is too large.' }, 413);
  const fullKind = await imageKind(full);
  const thumbKind = await imageKind(thumb);
  if (!fullKind || !thumbKind) return json({ error: 'Only WebP or JPEG images are accepted.' }, 415);

  const w = num(form.get('w'));
  const h = num(form.get('h'));
  if (!w || !h || w < 1 || h < 1 || w > 10000 || h > 10000) return json({ error: 'Bad image size.' }, 400);

  const lat = num(form.get('lat'));
  const lng = num(form.get('lng'));
  const hasCoords = lat !== undefined && lng !== undefined && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

  const takenRaw = form.get('takenAt');
  const takenAt =
    typeof takenRaw === 'string' && takenRaw && !Number.isNaN(Date.parse(takenRaw))
      ? new Date(takenRaw).toISOString()
      : undefined;
  const caption = String(form.get('caption') ?? '').trim().slice(0, 200) || undefined;
  const showPin = form.get('showPin') !== '0';

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const mime = (k: 'webp' | 'jpg') => (k === 'webp' ? 'image/webp' : 'image/jpeg');

  const uploaded: string[] = [];
  try {
    const fullUrl = await putFile(`travel/photos/${countryId}/${id}-full.${fullKind}`, full, mime(fullKind));
    uploaded.push(fullUrl);
    const thumbUrl = await putFile(`travel/photos/${countryId}/${id}-thumb.${thumbKind}`, thumb, mime(thumbKind));
    uploaded.push(thumbUrl);

    const photo: Photo = {
      id,
      full: fullUrl,
      thumb: thumbUrl,
      w: Math.round(w),
      h: Math.round(h),
      takenAt,
      caption,
      showPin,
      ...(hasCoords ? { lat: round1(lat!), lng: round1(lng!) } : {}),
    };

    const { manifest } = await updateManifest((m) => {
      if (!m.countries[countryId]) {
        m.countries[countryId] = {
          name,
          color: nextColor(m),
          addedAt: new Date().toISOString(),
          photos: [],
        };
      }
      m.countries[countryId].photos.push(photo);
    });
    return json({ manifest, photo });
  } catch (err) {
    await deleteFiles(uploaded).catch(() => {});
    if (err instanceof StoreNotConfiguredError) return json({ error: err.message }, 503);
    console.error('POST /api/admin/photos failed', err);
    const msg = /access/i.test(String(err))
      ? 'Storage refused the upload. Make sure the Vercel Blob store is set to Public.'
      : 'Upload failed. Please try again.';
    return json({ error: msg }, 500);
  }
};
