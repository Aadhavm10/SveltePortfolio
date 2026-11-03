// Turn storage failures into messages that say what to fix.
// Only signed-in admin routes use this, so it's fine to include the underlying reason.
import {
  BlobAccessError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  BlobStoreNotFoundError,
  BlobStoreSuspendedError,
} from '@vercel/blob';
import { json } from './auth';
import { StoreNotConfiguredError } from './travelStore';

export function storageErrorMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const details = raw ? ` (Details: ${raw.slice(0, 240)})` : '';

  if (err instanceof StoreNotConfiguredError) return { status: 503, message: err.message };
  if (err instanceof BlobStoreNotFoundError) {
    return {
      status: 502,
      message: `The connected Vercel Blob store doesn't exist any more. Connect a Blob store to this project, then redeploy.${details}`,
    };
  }
  if (err instanceof BlobStoreSuspendedError) {
    return { status: 502, message: `Your Vercel Blob store is suspended. Check your Vercel plan and usage.${details}` };
  }
  if (err instanceof BlobServiceRateLimited || err instanceof BlobServiceNotAvailable) {
    return { status: 503, message: `Vercel Blob is busy or unavailable right now. Please try again in a minute.${details}` };
  }
  if (/no token found|oidc|store ?id|unable to extract store id|invalid token/i.test(raw)) {
    return {
      status: 502,
      message: `This deployment couldn't sign in to your Vercel Blob store. Make sure the store is connected to the Production environment, then redeploy.${details}`,
    };
  }
  if (err instanceof BlobAccessError || /\b403\b|forbidden|access denied/i.test(raw)) {
    return {
      status: 502,
      message:
        'Vercel Blob refused access. Usually the store was created as Private: the uploader needs a Public Blob store ' +
        '(create one with Public access, connect it to Production, then redeploy). It can also mean the storage key ' +
        `is out of date: reconnect the store and redeploy.${details}`,
    };
  }
  return { status: 500, message: `Storage error${details || '. Please try again.'}` };
}

/** Log the full error for Vercel's logs and answer with a message that says what to fix. */
export function storageFailure(label: string, err: unknown): Response {
  console.error(`${label} failed`, err);
  const { status, message } = storageErrorMessage(err);
  return json({ error: message }, status);
}
