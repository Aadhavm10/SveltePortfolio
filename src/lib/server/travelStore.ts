// Storage for travel photos + the manifest that drives the globe.
//  - Vercel Blob when a store is connected (BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID with Vercel OIDC).
//  - Local filesystem under public/_local-travel/ during `astro dev` without a token.
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BlobPreconditionFailedError, del, get, list, put, type ListBlobResultBlob } from '@vercel/blob';
import { BLOB_READ_WRITE_TOKEN, BLOB_STORE_ID } from 'astro:env/server';
import { emptyManifest, type Manifest } from '../../data/travel';

// Local mode keeps the only copy here. On Blob this is the public copy the globe reads (see below).
const MANIFEST_PATH = 'travel/manifest.json';

// With a read-write token, pass it explicitly; otherwise let @vercel/blob use OIDC + BLOB_STORE_ID.
const auth = () => (BLOB_READ_WRITE_TOKEN ? { token: BLOB_READ_WRITE_TOKEN } : {});

export type StoreMode = 'blob' | 'local' | 'none';

export function storeMode(): StoreMode {
  if (BLOB_READ_WRITE_TOKEN || BLOB_STORE_ID) return 'blob';
  if (import.meta.env.DEV) return 'local';
  return 'none';
}

/** How much is stored (photos, thumbnails and the saved travel data). */
export interface StorageUsage {
  bytes: number;
  files: number;
}

export class StoreNotConfiguredError extends Error {
  constructor() {
    super('Photo storage is not set up. Connect a Vercel Blob store to this project.');
  }
}

/** Someone else saved between our read and our write; the caller retries. */
export class ManifestConflictError extends Error {
  constructor() {
    super('Your travel data changed while saving. Please try again.');
  }
}

interface Versioned {
  manifest: Manifest;
  /** Which saved copy this is (Blob: its pathname; null for legacy / none / local). */
  version: string | null;
}

// ---------- Vercel Blob ----------
// Public blobs are served through a CDN that keeps an overwritten file stale for up to a minute
// (@vercel/blob's `useCache: false` only bypasses that for private blobs). So the copy that saves
// build on is never overwritten: every save writes a new, immutable file under travel/manifest/, and
// the newest one is found with list(), which goes to the Blob API and is always current.
//
// list() is a metered "advanced" operation, so visitors never trigger it: each save also overwrites
// the fixed public copy at MANIFEST_PATH, which the globe reads through the CDN (fine if it's a
// minute behind). That file is also where data saved before versioned saves existed lives.
const VERSION_PREFIX = 'travel/manifest/';
const KEEP_VERSIONS = 5;
const ONE_YEAR_S = 60 * 60 * 24 * 365;

async function readPublicCopy(): Promise<Manifest | null> {
  const res = await get(MANIFEST_PATH, { access: 'public', ...auth() });
  if (!res || res.statusCode !== 200) return null;
  return JSON.parse(await new Response(res.stream).text()) as Manifest;
}

async function listVersions(): Promise<ListBlobResultBlob[]> {
  const blobs: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: VERSION_PREFIX, limit: 1000, cursor, ...auth() });
    blobs.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  // Names start with a zero-padded timestamp, so name order is save order.
  return blobs.sort((a, b) => a.pathname.localeCompare(b.pathname));
}

function versionTime(pathname: string | undefined): number {
  const n = pathname ? Number(pathname.slice(VERSION_PREFIX.length).split('-')[0]) : NaN;
  return Number.isFinite(n) ? n : 0;
}

const blob = {
  async read(): Promise<Versioned> {
    const newest = (await listVersions()).at(-1);
    if (newest) {
      const res = await fetch(newest.url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Couldn't read the travel data (${res.status}).`);
      return { manifest: (await res.json()) as Manifest, version: newest.pathname };
    }
    // Nothing saved the new way yet: start from the data saved the old way (or empty).
    return { manifest: (await readPublicCopy()) ?? emptyManifest(), version: null };
  },

  /** For the public globe: no list() call; may be up to a minute behind the latest save. */
  async readPublic(): Promise<Manifest> {
    return (await readPublicCopy()) ?? (await blob.read()).manifest;
  },

  async write(m: Manifest, readVersion: string | null): Promise<void> {
    const versions = await listVersions();
    const newest = versions.at(-1)?.pathname ?? null;
    if (newest !== readVersion) throw new ManifestConflictError();

    // Always sort after the current newest, even if this server's clock is a little behind.
    const time = Math.max(Date.now(), versionTime(newest ?? undefined) + 1);
    const name = `${VERSION_PREFIX}${String(time).padStart(15, '0')}-${Math.random().toString(36).slice(2, 8)}.json`;
    const body = JSON.stringify(m);
    await put(name, body, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: ONE_YEAR_S, // never overwritten, so safe to cache
      ...auth(),
    });

    // The save is done; the rest is best effort. Refresh the public copy (the next save rewrites it
    // if this fails) and keep only the newest few versions.
    await put(MANIFEST_PATH, body, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 60,
      ...auth(),
    }).catch((e) => console.error('Public travel data refresh failed', e));
    const stale = versions.slice(0, Math.max(0, versions.length + 1 - KEEP_VERSIONS)).map((b) => b.url);
    if (stale.length) await del(stale, auth()).catch((e) => console.error('Old travel data cleanup failed', e));
  },

  /** Adds up everything under travel/ (one list call per 1,000 files). */
  async usage(): Promise<StorageUsage> {
    let bytes = 0;
    let files = 0;
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: 'travel/', limit: 1000, cursor, ...auth() });
      for (const b of page.blobs) {
        bytes += b.size;
        files++;
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return { bytes, files };
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
      return { manifest: JSON.parse(text) as Manifest, version: null };
    } catch {
      return { manifest: emptyManifest(), version: null };
    }
  },
  async readPublic(): Promise<Manifest> {
    return (await local.read()).manifest;
  },
  async usage(): Promise<StorageUsage> {
    let bytes = 0;
    let files = 0;
    const walk = async (dir: string) => {
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else if (e.isFile()) {
          bytes += (await stat(full)).size;
          files++;
        }
      }
    };
    await walk(path.join(LOCAL_DIR, 'travel'));
    return { bytes, files };
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

/** Always the latest save (for the uploader). */
export async function readManifest(): Promise<Manifest> {
  if (storeMode() === 'none') return emptyManifest();
  return (await backend().read()).manifest;
}

/** For the public globe: cheap to read, may be up to a minute behind the latest save. */
export async function readPublicManifest(): Promise<Manifest> {
  if (storeMode() === 'none') return emptyManifest();
  return backend().readPublic();
}

/**
 * Read-modify-write the manifest, retrying if it changed underneath us.
 * The mutator may throw to abort; its return value is passed through.
 */
export async function updateManifest<T>(mutate: (m: Manifest) => T | Promise<T>): Promise<{ manifest: Manifest; result: T }> {
  const store = backend();
  for (let attempt = 0; ; attempt++) {
    const { manifest, version } = await store.read();
    const result = await mutate(manifest);
    manifest.updatedAt = new Date().toISOString();
    try {
      await store.write(manifest, version);
      return { manifest, result };
    } catch (err) {
      const conflict =
        err instanceof ManifestConflictError || err instanceof BlobPreconditionFailedError || /already exists/i.test(String(err));
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

export async function storageUsage(): Promise<StorageUsage> {
  return backend().usage();
}
