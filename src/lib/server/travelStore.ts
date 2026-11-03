// Storage for travel photos + the manifest that drives the globe.
//  - Vercel Blob when a store is connected (BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID with Vercel OIDC).
//  - Local filesystem under public/_local-travel/ during `astro dev` without a token.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BlobPreconditionFailedError, del, get, put } from '@vercel/blob';
import { BLOB_READ_WRITE_TOKEN, BLOB_STORE_ID } from 'astro:env/server';
import { emptyManifest, type Manifest } from '../../data/travel';

const MANIFEST_PATH = 'travel/manifest.json';

// With a read-write token, pass it explicitly; otherwise let @vercel/blob use OIDC + BLOB_STORE_ID.
const auth = () => (BLOB_READ_WRITE_TOKEN ? { token: BLOB_READ_WRITE_TOKEN } : {});

export type StoreMode = 'blob' | 'local' | 'none';

export function storeMode(): StoreMode {
  if (BLOB_READ_WRITE_TOKEN || BLOB_STORE_ID) return 'blob';
  if (import.meta.env.DEV) return 'local';
  return 'none';
}

export class StoreNotConfiguredError extends Error {
  constructor() {
    super('Photo storage is not set up. Connect a Vercel Blob store to this project.');
  }
}

interface Versioned {
  manifest: Manifest;
  etag: string | null;
}

// ---------- Vercel Blob ----------
const blob = {
  async read(): Promise<Versioned> {
    const res = await get(MANIFEST_PATH, { access: 'public', useCache: false, ...auth() });
    if (!res || res.statusCode !== 200) return { manifest: emptyManifest(), etag: null };
    const text = await new Response(res.stream).text();
    return { manifest: JSON.parse(text) as Manifest, etag: res.blob.etag };
  },
  async write(m: Manifest, etag: string | null): Promise<void> {
    await put(MANIFEST_PATH, JSON.stringify(m), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 60,
      ...auth(),
      // Optimistic concurrency: fail if someone else wrote in between.
      ...(etag ? { ifMatch: etag } : { allowOverwrite: false }),
    });
  },
  async putFile(pathname: string, data: Blob, contentType: string): Promise<string> {
    const res = await put(pathname, data, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      ...auth(),
    });
    return res.url;
  },
  async deleteFiles(urls: string[]): Promise<void> {
    if (urls.length) await del(urls, auth());
  },
};

// ---------- Local filesystem (dev only) ----------
const LOCAL_DIR = path.join(process.cwd(), 'public', '_local-travel');
const LOCAL_URL = '/_local-travel/';

const local = {
  async read(): Promise<Versioned> {
    try {
      const text = await readFile(path.join(LOCAL_DIR, MANIFEST_PATH), 'utf8');
      return { manifest: JSON.parse(text) as Manifest, etag: null };
    } catch {
      return { manifest: emptyManifest(), etag: null };
    }
  },
  async write(m: Manifest): Promise<void> {
    const file = path.join(LOCAL_DIR, MANIFEST_PATH);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(m, null, 2));
  },
  async putFile(pathname: string, data: Blob): Promise<string> {
    const ext = path.extname(pathname);
    const unique = `${pathname.slice(0, -ext.length)}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const file = path.join(LOCAL_DIR, unique);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.from(await data.arrayBuffer()));
    return LOCAL_URL + unique;
  },
  async deleteFiles(urls: string[]): Promise<void> {
    for (const url of urls) {
      if (!url.startsWith(LOCAL_URL)) continue;
      const file = path.join(LOCAL_DIR, url.slice(LOCAL_URL.length));
      if (!file.startsWith(LOCAL_DIR)) continue;
      await rm(file, { force: true });
    }
  },
};

function backend() {
  const mode = storeMode();
  if (mode === 'blob') return blob;
  if (mode === 'local') return local;
  throw new StoreNotConfiguredError();
}

export async function readManifest(): Promise<Manifest> {
  const mode = storeMode();
  if (mode === 'none') return emptyManifest();
  return (await backend().read()).manifest;
}

/**
 * Read-modify-write the manifest, retrying if it changed underneath us.
 * The mutator may throw to abort; its return value is passed through.
 */
export async function updateManifest<T>(mutate: (m: Manifest) => T | Promise<T>): Promise<{ manifest: Manifest; result: T }> {
  const store = backend();
  for (let attempt = 0; ; attempt++) {
    const { manifest, etag } = await store.read();
    const result = await mutate(manifest);
    manifest.updatedAt = new Date().toISOString();
    try {
      await store.write(manifest, etag);
      return { manifest, result };
    } catch (err) {
      const conflict = err instanceof BlobPreconditionFailedError || /already exists/i.test(String(err));
      if (!conflict || attempt >= 4) throw err;
    }
  }
}

export async function putFile(pathname: string, data: Blob, contentType: string): Promise<string> {
  return backend().putFile(pathname, data, contentType);
}

export async function deleteFiles(urls: string[]): Promise<void> {
  return backend().deleteFiles(urls);
}
