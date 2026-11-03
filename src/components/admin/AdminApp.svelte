<script lang="ts">
  import { onMount } from 'svelte';
  import exifr from 'exifr';
  import { findRegionAt, loadWorld, type World } from '../../lib/geo';
  import {
    allPhotos,
    homeIdOf,
    homeTarget,
    isHomeTarget,
    nearestHome,
    orderedCountryIds,
    PALETTE,
    samePhoto,
    type Manifest,
    type Photo,
    type StarredPlace,
  } from '../../data/travel';

  export let authed = false;
  export let configured = false;
  export let mode: 'blob' | 'local' | 'none' = 'none';

  // ---------- state ----------
  let password = '';
  let loginError = '';
  let loggingIn = false;

  let manifest: Manifest | null = null;
  let world: World | null = null;
  let loadError = '';

  interface QueueItem {
    key: string;
    file: File;
    preview: string;
    status: 'reading' | 'ready' | 'uploading' | 'done' | 'error';
    error?: string;
    progress: number;
    countryId: string;
    detected: boolean;
    lat?: number;
    lng?: number;
    takenAt?: string;
    dhash?: string;
    caption: string;
    showPin: boolean;
    full?: Blob;
    thumb?: Blob;
    w?: number;
    h?: number;
  }

  let queue: QueueItem[] = [];
  let lastCountry = '';
  let uploading = false;
  let dragOver = false;
  let openCountry: string | null = null;
  let draft = { when: '', blurb: '', color: '' };
  let saving = false;
  let toast = '';
  let toastTimer: number | undefined;

  $: visitedIds = manifest ? orderedCountryIds(manifest) : [];
  $: readyCount = queue.filter((q) => q.status === 'ready' && q.countryId).length;
  $: needsCountry = queue.filter((q) => q.status === 'ready' && !q.countryId).length;

  // After a place is picked by hand on one photo, offer to use it for the rest of the queue.
  let applyFrom: string | null = null;
  $: readyTotal = queue.filter((q) => q.status === 'ready').length;
  $: applySource = queue.find((q) => q.key === applyFrom && q.status === 'ready' && q.countryId);
  $: applyTargets = applySource
    ? queue.filter((q) => q !== applySource && q.status === 'ready' && q.countryId !== applySource.countryId)
    : [];
  $: applyUndetected = applyTargets.filter((q) => !q.detected).length;

  // Photos that look like ones already uploaded, or like an earlier photo in this batch.
  $: queueDups = findQueueDups(queue, manifest);
  // Uploaded photos that look like another uploaded photo (by photo id).
  $: uploadedDups = findUploadedDups(manifest);

  function findQueueDups(q: QueueItem[], m: Manifest | null): Map<string, string> {
    const out = new Map<string, string>();
    const uploaded = m ? allPhotos(m) : [];
    const earlier: QueueItem[] = [];
    for (const item of q) {
      if (item.status !== 'ready') continue;
      const hit = uploaded.find(({ photo }) => samePhoto(item, photo));
      if (hit) out.set(item.key, `Already uploaded · ${hit.place}`);
      else if (earlier.some((e) => samePhoto(item, e))) out.set(item.key, 'Duplicate in this batch');
      earlier.push(item);
    }
    return out;
  }

  function findUploadedDups(m: Manifest | null): Set<string> {
    const out = new Set<string>();
    const all = m ? allPhotos(m).map((x) => x.photo) : [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (samePhoto(all[i], all[j])) {
          out.add(all[i].id);
          out.add(all[j].id);
        }
      }
    }
    return out;
  }

  function removeDuplicates() {
    const n = queueDups.size;
    queue.filter((q) => queueDups.has(q.key)).forEach((q) => URL.revokeObjectURL(q.preview));
    queue = queue.filter((q) => !queueDups.has(q.key));
    flash(`Removed ${n} ${n === 1 ? 'duplicate' : 'duplicates'}.`);
  }

  function nameOf(id: string): string {
    if (isHomeTarget(id)) return manifest?.starred?.find((s) => s.id === homeIdOf(id))?.name ?? 'Home base';
    return manifest?.countries[id]?.name ?? world?.regions.get(id)?.name ?? id;
  }

  function flash(msg: string) {
    toast = msg;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast = ''), 3200);
  }

  // ---------- API ----------
  async function api<T = { manifest: Manifest }>(url: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.body && !(init.body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) authed = false;
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
    return data as T;
  }

  async function loadAll() {
    loadError = '';
    try {
      const [w, m] = await Promise.all([loadWorld(), api<Manifest>('/api/admin/manifest')]);
      world = w;
      manifest = m;
    } catch (err) {
      loadError = (err as Error).message;
    }
  }

  async function login() {
    if (!password || loggingIn) return;
    loggingIn = true;
    loginError = '';
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      password = '';
      authed = true;
      await loadAll();
    } catch (err) {
      loginError = (err as Error).message;
    } finally {
      loggingIn = false;
    }
  }

  async function logout() {
    await api('/api/admin/logout', { method: 'POST' }).catch(() => {});
    authed = false;
    manifest = null;
  }

  // ---------- image processing (all in the browser) ----------
  async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      const url = URL.createObjectURL(file);
      try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return img;
      } finally {
        URL.revokeObjectURL(url);
      }
    }
  }

  function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((r) => canvas.toBlob(r, type, quality));
  }

  /** Re-encode at most `maxEdge` px. Re-encoding drops all EXIF (GPS, camera info). */
  async function encode(src: ImageBitmap | HTMLImageElement, maxEdge: number, quality: number, maxBytes: number) {
    const sw = 'naturalWidth' in src ? src.naturalWidth : src.width;
    const sh = 'naturalHeight' in src ? src.naturalHeight : src.height;
    let edge = maxEdge;
    let q = quality;
    for (let attempt = 0; attempt < 5; attempt++) {
      const scale = Math.min(1, edge / Math.max(sw, sh));
      const w = Math.max(1, Math.round(sw * scale));
      const h = Math.max(1, Math.round(sh * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, w, h);
      let blob = await toBlob(canvas, 'image/webp', q);
      // Safari can't encode WebP and silently returns PNG; use JPEG instead.
      if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', q);
      if (!blob) throw new Error('Could not encode image');
      if (blob.size <= maxBytes) return { blob, w, h };
      edge = Math.round(edge * 0.8);
      q = Math.max(0.6, q - 0.06);
    }
    throw new Error('Image is too large even after compression');
  }

  /**
   * Fingerprint of the picture: shrink it to 9×8 greys and record whether each pixel is brighter
   * than its right-hand neighbour (a 64-bit "difference hash"). The same photo re-saved, resized or
   * converted gives (nearly) the same bits; different photos almost never do.
   */
  let hashCanvas: HTMLCanvasElement | null = null;
  function fingerprint(src: ImageBitmap | HTMLImageElement): string | undefined {
    try {
      // Draw at 72×64 first and average 8×8 blocks, so the result doesn't depend on how the
      // browser samples a big photo down.
      hashCanvas ??= Object.assign(document.createElement('canvas'), { width: 72, height: 64 });
      const ctx = hashCanvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return undefined;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, 72, 64);
      const px = ctx.getImageData(0, 0, 72, 64).data;
      const grey = new Float32Array(72);
      for (let y = 0; y < 64; y++) {
        for (let x = 0; x < 72; x++) {
          const i = (y * 72 + x) * 4;
          grey[(y >> 3) * 9 + Math.floor(x / 8)] += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        }
      }
      let hex = '';
      for (let row = 0; row < 8; row++) {
        let nibble = 0;
        for (let col = 0; col < 8; col++) {
          nibble = (nibble << 1) | (grey[row * 9 + col] > grey[row * 9 + col + 1] ? 1 : 0);
          if (col % 4 === 3) {
            hex += nibble.toString(16);
            nibble = 0;
          }
        }
      }
      return hex;
    } catch {
      return undefined; // a missing fingerprint only means duplicates are matched by date + size
    }
  }

  /**
   * EXIF dates have no time zone, and exifr turns them into a Date in this browser's zone.
   * Keep the wall-clock time as written ("2025-02-05T21:00:00", no "Z") so the day doesn't
   * shift when you upload from somewhere else.
   */
  function localIso(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  async function processItem(item: QueueItem) {
    try {
      const [gps, meta] = await Promise.all([
        exifr.gps(item.file).catch(() => null),
        exifr.parse(item.file, ['DateTimeOriginal', 'CreateDate']).catch(() => null),
      ]);
      if (gps && Number.isFinite(gps.latitude) && Number.isFinite(gps.longitude)) {
        item.lat = gps.latitude;
        item.lng = gps.longitude;
        // Within 50 miles of a home base: tag it to that home base; otherwise its country / state.
        const home = nearestHome(manifest?.starred, gps.latitude, gps.longitude);
        const hit = home ? homeTarget(home.id) : world ? findRegionAt(world, gps.latitude, gps.longitude)?.id : null;
        if (hit) {
          item.countryId = hit;
          item.detected = true;
          lastCountry = hit;
        }
      }
      const date = meta?.DateTimeOriginal ?? meta?.CreateDate;
      if (date instanceof Date && !Number.isNaN(+date)) item.takenAt = localIso(date);
      if (!item.countryId) item.countryId = lastCountry;

      const img = await decode(item.file);
      item.dhash = fingerprint(img);
      const full = await encode(img, 2000, 0.82, 3_500_000);
      const thumb = await encode(img, 640, 0.75, 280_000);
      if ('close' in img) img.close();
      item.full = full.blob;
      item.thumb = thumb.blob;
      item.w = full.w;
      item.h = full.h;
      item.status = 'ready';
    } catch (err) {
      item.status = 'error';
      item.error = /heic|heif/i.test(item.file.name + item.file.type)
        ? "This browser can't read HEIC photos. Pick it from your iPhone, or export it as JPG first."
        : `Couldn't read this image (${(err as Error).message}).`;
    }
    queue = queue;
  }

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    if (!world) world = await loadWorld().catch(() => null);
    const files = [...list].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    const items: QueueItem[] = files.map((file) => ({
      key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'reading',
      progress: 0,
      countryId: '',
      detected: false,
      caption: '',
      showPin: true,
    }));
    queue = [...queue, ...items];
    // Two at a time on computers; one at a time on phones, where decoding 48MP photos can run out of memory.
    const pending = [...items];
    const worker = async () => {
      for (let it = pending.shift(); it; it = pending.shift()) await processItem(it);
    };
    const lowMemory = matchMedia('(pointer: coarse)').matches;
    await Promise.all(lowMemory ? [worker()] : [worker(), worker()]);
  }

  function pickPlace(item: QueueItem) {
    item.detected = false;
    lastCountry = item.countryId;
    applyFrom = item.key;
    queue = queue;
  }

  function applyPlace(onlyUndetected: boolean) {
    if (!applySource) return;
    const id = applySource.countryId;
    const targets = applyTargets.filter((q) => !onlyUndetected || !q.detected);
    for (const q of targets) {
      q.countryId = id;
      // Its GPS points somewhere else, so it gets no pin here (like moving a photo).
      q.detected = false;
    }
    applyFrom = null;
    queue = queue;
    flash(`Set ${targets.length} ${targets.length === 1 ? 'photo' : 'photos'} to ${nameOf(id)}.`);
  }

  function removeItem(item: QueueItem) {
    URL.revokeObjectURL(item.preview);
    queue = queue.filter((q) => q !== item);
  }

  function uploadOne(item: QueueItem): Promise<{ manifest: Manifest }> {
    return new Promise((resolve, reject) => {
      const fd = new FormData();
      const ext = (b: Blob) => (b.type === 'image/webp' ? 'webp' : 'jpg');
      fd.append('full', item.full!, `full.${ext(item.full!)}`);
      fd.append('thumb', item.thumb!, `thumb.${ext(item.thumb!)}`);
      fd.append('countryId', item.countryId);
      fd.append('w', String(item.w));
      fd.append('h', String(item.h));
      if (item.takenAt) fd.append('takenAt', item.takenAt);
      if (item.lat !== undefined && item.lng !== undefined && item.detected) {
        fd.append('lat', String(item.lat));
        fd.append('lng', String(item.lng));
      }
      fd.append('caption', item.caption);
      fd.append('showPin', item.showPin ? '1' : '0');
      if (item.dhash) fd.append('dhash', item.dhash);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/admin/photos');
      xhr.responseType = 'json';
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          item.progress = e.loaded / e.total;
          queue = queue;
        }
      };
      xhr.onload = () => {
        if (xhr.status === 401) authed = false;
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
        else reject(new Error(xhr.response?.error ?? `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(fd);
    });
  }

  async function uploadAll() {
    if (uploading) return;
    uploading = true;
    applyFrom = null;
    let done = 0;
    // One at a time so manifest updates never race.
    for (const item of queue) {
      if (item.status !== 'ready' || !item.countryId) continue;
      item.status = 'uploading';
      item.error = undefined;
      item.progress = 0;
      queue = queue;
      try {
        const res = await uploadOne(item);
        manifest = res.manifest;
        item.status = 'done';
        done++;
      } catch (err) {
        // Stays in the queue, so the next "Upload" tries it again.
        item.status = 'ready';
        item.error = (err as Error).message;
        if (!authed) break;
      }
      queue = queue;
    }
    uploading = false;
    if (done) flash(`Uploaded ${done} ${done === 1 ? 'photo' : 'photos'} — the globe will update within a minute.`);
    setTimeout(() => {
      queue.filter((q) => q.status === 'done').forEach((q) => URL.revokeObjectURL(q.preview));
      queue = queue.filter((q) => q.status !== 'done');
    }, 1500);
  }

  // ---------- country + photo editing ----------
  function toggleCountry(id: string) {
    if (openCountry === id) {
      openCountry = null;
      return;
    }
    const c = manifest!.countries[id];
    openCountry = id;
    draft = { when: c.when ?? '', blurb: c.blurb ?? '', color: c.color };
  }

  async function saveCountry() {
    if (!openCountry) return;
    saving = true;
    try {
      ({ manifest } = await api(`/api/admin/countries/${openCountry}`, { method: 'PATCH', body: JSON.stringify(draft) }));
      flash('Saved.');
    } catch (err) {
      flash((err as Error).message);
    } finally {
      saving = false;
    }
  }

  async function patchPhoto(photo: Photo, body: Record<string, unknown>, msg?: string) {
    try {
      ({ manifest } = await api(`/api/admin/photos/${photo.id}`, { method: 'PATCH', body: JSON.stringify(body) }));
      if (msg) flash(msg);
      if (openCountry && !manifest.countries[openCountry]) openCountry = null;
    } catch (err) {
      flash((err as Error).message);
    }
  }

  async function deletePhoto(photo: Photo) {
    if (!confirm('Delete this photo? This cannot be undone.')) return;
    try {
      ({ manifest } = await api(`/api/admin/photos/${photo.id}`, { method: 'DELETE' }));
      flash('Photo deleted.');
      if (openCountry && !manifest.countries[openCountry]) openCountry = null;
    } catch (err) {
      flash((err as Error).message);
    }
  }

  // ---------- starred places ----------
  let openHome: string | null = null;
  let starName = '';
  let starNote = '';
  let starWhere = '';
  let starBusy = false;
  let starError = '';

  /** Accepts "32.78, -96.80" (what Google Maps copies) or "32.78 -96.80". */
  function parseLatLng(text: string): { lat: number; lng: number } | null {
    const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (!m) return null;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
  }

  $: starPoint = parseLatLng(starWhere);
  $: starRegion = starPoint && world ? findRegionAt(world, starPoint.lat, starPoint.lng)?.name ?? 'not inside a country' : null;
  $: photoSpots = manifest
    ? Object.values(manifest.countries).flatMap((c) =>
        c.photos
          .filter((ph) => ph.lat !== undefined && ph.lng !== undefined)
          .map((ph) => ({
            value: `${ph.lat}, ${ph.lng}`,
            label: [c.name, ph.caption, ph.takenAt ? new Date(ph.takenAt).toLocaleDateString() : null].filter(Boolean).join(' · '),
          }))
      )
    : [];

  async function addStar() {
    if (!starName.trim() || !starPoint || starBusy) return;
    starBusy = true;
    starError = '';
    try {
      ({ manifest } = await api('/api/admin/starred', {
        method: 'POST',
        body: JSON.stringify({ name: starName, note: starNote, lat: starPoint.lat, lng: starPoint.lng }),
      }));
      flash(`Added ${starName.trim()}.`);
      starName = '';
      starNote = '';
      starWhere = '';
    } catch (err) {
      starError = (err as Error).message;
    } finally {
      starBusy = false;
    }
  }

  async function patchStar(s: StarredPlace, body: { name?: string; note?: string }) {
    try {
      ({ manifest } = await api(`/api/admin/starred/${s.id}`, { method: 'PATCH', body: JSON.stringify(body) }));
      flash('Saved.');
    } catch (err) {
      flash((err as Error).message);
    }
  }

  async function removeStar(s: StarredPlace) {
    const n = s.photos?.length ?? 0;
    if (n && !confirm(`Remove ${s.name} and its ${n} ${n === 1 ? 'photo' : 'photos'}? This cannot be undone.`)) return;
    try {
      ({ manifest } = await api(`/api/admin/starred/${s.id}`, { method: 'DELETE' }));
      if (openHome === s.id) openHome = null;
      flash(`Removed ${s.name}.`);
    } catch (err) {
      flash((err as Error).message);
    }
  }

  let shuffling = false;
  async function shuffleColors() {
    shuffling = true;
    try {
      ({ manifest } = await api('/api/admin/colors', { method: 'POST' }));
      flash('Colours shuffled. The globe updates within a minute.');
    } catch (err) {
      flash((err as Error).message);
    } finally {
      shuffling = false;
    }
  }

  async function makeCover(placeKey: string, photos: Photo[], photo: Photo) {
    const order = [photo.id, ...photos.filter((p) => p.id !== photo.id).map((p) => p.id)];
    const url = isHomeTarget(placeKey) ? `/api/admin/starred/${homeIdOf(placeKey)}` : `/api/admin/countries/${placeKey}`;
    try {
      ({ manifest } = await api(url, { method: 'PATCH', body: JSON.stringify({ order }) }));
      flash('Cover photo updated.');
    } catch (err) {
      flash((err as Error).message);
    }
  }

  function onDrop(e: DragEvent) {
    dragOver = false;
    addFiles(e.dataTransfer?.files ?? null);
  }

  onMount(() => {
    if (authed) loadAll();
  });
</script>

<svelte:window on:dragover|preventDefault on:drop|preventDefault />

<!-- Photos of one place (a country / US state, or a home base: placeKey "home:<id>"). -->
{#snippet photoGrid(placeKey: string, photos: Photo[])}
  <div class="photos">
    {#each photos as p, i (p.id)}
      <div class="ph">
        <img src={p.thumb} alt={p.caption ?? ''} loading="lazy" />
        {#if i === 0}<span class="cover-tag">cover</span>{/if}
        {#if uploadedDups.has(p.id)}<span class="dup-tag">Possible duplicate</span>{/if}
        <input
          class="caption"
          type="text"
          value={p.caption ?? ''}
          placeholder="Caption"
          maxlength="200"
          on:change={(e) => patchPhoto(p, { caption: e.currentTarget.value }, 'Caption saved.')}
        />
        <div class="ph-actions">
          {#if i !== 0}<button class="ghost small" on:click={() => makeCover(placeKey, photos, p)}>Make cover</button>{/if}
          {#if p.lat !== undefined && !isHomeTarget(placeKey)}
            <button class="ghost small" on:click={() => patchPhoto(p, { showPin: !p.showPin })}>{p.showPin ? 'Hide pin' : 'Show pin'}</button>
          {/if}
          <select
            class="small"
            value={placeKey}
            on:change={(e) => patchPhoto(p, { countryId: e.currentTarget.value }, 'Photo moved.')}
            aria-label="Move to another place"
          >
            {#if manifest?.starred?.length}
              <optgroup label="Home bases">
                {#each manifest.starred as hb (hb.id)}
                  <option value={homeTarget(hb.id)}>{homeTarget(hb.id) === placeKey ? `In ${hb.name}` : `Move to ${hb.name}`}</option>
                {/each}
              </optgroup>
            {/if}
            <optgroup label="Countries and US states">
              {#each [...(world?.states ?? []), ...(world?.countries ?? [])] as wc (wc.id)}<option value={wc.id}>{wc.id === placeKey ? `In ${wc.name}` : `Move to ${wc.name}`}</option>{/each}
            </optgroup>
          </select>
          <button class="danger small" on:click={() => deletePhoto(p)}>Delete</button>
        </div>
      </div>
    {/each}
  </div>
{/snippet}

<main class="admin">
  {#if !configured}
    <section class="card narrow">
      <h1>Travel uploader</h1>
      <p class="muted">The uploader is locked until a password is set.</p>
      <ol class="steps">
        <li>In Vercel, open your project → <b>Settings → Environment Variables</b>.</li>
        <li>Add <code>ADMIN_PASSWORD</code> with a long passphrase (at least 10 characters).</li>
        <li>Redeploy, then come back to this page.</li>
      </ol>
      <p class="muted small">For local development, put <code>ADMIN_PASSWORD=…</code> in a <code>.env</code> file.</p>
    </section>
  {:else if !authed}
    <form class="card narrow login" on:submit|preventDefault={login}>
      <div class="logo">AM</div>
      <h1>Travel uploader</h1>
      <p class="muted">Private. Enter your password to add trip photos.</p>
      <!-- svelte-ignore a11y-autofocus -->
      <input type="password" bind:value={password} placeholder="Password" autocomplete="current-password" autofocus />
      {#if loginError}<p class="error">{loginError}</p>{/if}
      <button class="primary" type="submit" disabled={!password || loggingIn}>{loggingIn ? 'Checking…' : 'Sign in'}</button>
    </form>
  {:else}
    <header class="top">
      <div>
        <h1>Travel uploader</h1>
        <p class="muted small">
          {#if mode === 'blob'}Photos are stored in Vercel Blob.{:else if mode === 'local'}Local dev storage (<code>public/_local-travel/</code>, not deployed).{/if}
        </p>
      </div>
      <div class="top-actions">
        <a href="/" target="_blank" rel="noopener">View globe ↗</a>
        <button class="ghost" on:click={logout}>Log out</button>
      </div>
    </header>

    {#if mode === 'none'}
      <section class="card warn">
        <b>Photo storage isn't set up yet.</b>
        <p>In Vercel: <b>Storage → Create → Blob</b> (choose <b>Public</b> access), connect it to this project, then redeploy.</p>
      </section>
    {/if}
    {#if loadError}<section class="card warn">{loadError} <button class="ghost" on:click={loadAll}>Retry</button></section>{/if}

    <section class="card">
      <h2>Add photos</h2>
      <label
        class="drop"
        class:over={dragOver}
        on:dragenter={() => (dragOver = true)}
        on:dragleave={() => (dragOver = false)}
        on:drop|preventDefault={onDrop}
      >
        <input type="file" accept="image/*" multiple on:change={(e) => { addFiles(e.currentTarget.files); e.currentTarget.value = ''; }} />
        <span class="drop-icon">＋</span>
        <span><b>Choose photos</b> or drop them here</span>
        <span class="muted small">The country (or US state) is detected from each photo's location. Location data is removed before upload.</span>
      </label>

      {#if queue.length}
        {#if queueDups.size}
          <div class="dup-note">
            <span>⚠ {queueDups.size} {queueDups.size === 1 ? 'photo looks like a duplicate' : 'photos look like duplicates'}</span>
            <button class="ghost small" on:click={removeDuplicates}>Remove {queueDups.size === 1 ? 'it' : 'them'}</button>
          </div>
        {/if}
        <ul class="queue">
          {#each queue as item (item.key)}
            <li class="q" class:error={item.status === 'error' || !!item.error} class:done={item.status === 'done'}>
              <img src={item.preview} alt="" />
              <div class="q-body">
                {#if item.status === 'reading'}
                  <p class="muted small">Reading photo…</p>
                {:else if item.status === 'error'}
                  <p class="error small">{item.error}</p>
                {:else}
                  {#if item.error && item.status === 'ready'}<p class="error small">Upload failed: {item.error}</p>{/if}
                  <div class="q-row">
                    <select bind:value={item.countryId} on:change={() => pickPlace(item)} disabled={item.status !== 'ready'}>
                      <option value="" disabled>Choose a country or US state…</option>
                      {#if manifest?.starred?.length}
                        <optgroup label="Home bases">
                          {#each manifest.starred as hb (hb.id)}<option value={homeTarget(hb.id)}>{hb.name}</option>{/each}
                        </optgroup>
                      {/if}
                      {#if visitedIds.length}
                        <optgroup label="Visited">
                          {#each visitedIds as id (id)}<option value={id}>{nameOf(id)}</option>{/each}
                        </optgroup>
                      {/if}
                      <optgroup label="United States (by state)">
                        {#each world?.states ?? [] as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
                      </optgroup>
                      <optgroup label="Countries">
                        {#each world?.countries ?? [] as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
                      </optgroup>
                    </select>
                    {#if item.detected}<span class="badge ok">📍 detected</span>{:else if item.lat === undefined}<span class="badge">no location</span>{/if}
                  </div>
                  {#if queueDups.has(item.key)}<p class="dup small">⚠ {queueDups.get(item.key)}</p>{/if}
                  {#if applySource === item && applyTargets.length}
                    <div class="q-row apply">
                      <button class="ghost small" on:click={() => applyPlace(false)} aria-label="Use {nameOf(item.countryId)} for all {readyTotal} photos">
                        Use for all {readyTotal} photos
                      </button>
                      {#if applyUndetected && applyUndetected < applyTargets.length}
                        <button class="ghost small" on:click={() => applyPlace(true)} aria-label="Use {nameOf(item.countryId)} only for the {applyUndetected} with no location">
                          Only the {applyUndetected} with no location
                        </button>
                      {/if}
                    </div>
                  {/if}
                  <input class="caption" type="text" bind:value={item.caption} placeholder="Caption (optional)" maxlength="200" disabled={item.status !== 'ready'} />
                  <div class="q-row small">
                    <label class="check"><input type="checkbox" bind:checked={item.showPin} disabled={!item.detected || item.status !== 'ready'} /> Show pin on map</label>
                    {#if item.takenAt}<span class="muted">{new Date(item.takenAt).toLocaleDateString()}</span>{/if}
                  </div>
                  {#if item.status === 'uploading'}
                    <div class="progress"><i style="transform:scaleX({item.progress})"></i></div>
                  {:else if item.status === 'done'}
                    <p class="ok small">Uploaded ✓</p>
                  {/if}
                {/if}
              </div>
              {#if item.status !== 'uploading'}
                <button class="x" on:click={() => removeItem(item)} aria-label="Remove">✕</button>
              {/if}
            </li>
          {/each}
        </ul>
        <div class="upload-bar">
          {#if needsCountry}<span class="muted small">{needsCountry} {needsCountry === 1 ? 'photo needs' : 'photos need'} a country</span>{/if}
          <button class="primary" on:click={uploadAll} disabled={!readyCount || uploading || mode === 'none'}>
            {uploading ? 'Uploading…' : `Upload ${readyCount} ${readyCount === 1 ? 'photo' : 'photos'}`}
          </button>
        </div>
      {/if}
    </section>

    <section class="card">
      <div class="places-head">
        <h2>Your places <span class="muted">({visitedIds.length})</span></h2>
        {#if visitedIds.length > 1}
          <button class="ghost small" on:click={shuffleColors} disabled={shuffling}>{shuffling ? 'Shuffling…' : '🎲 Shuffle colours'}</button>
        {/if}
      </div>
      {#if !manifest}
        <p class="muted">Loading…</p>
      {:else if !visitedIds.length}
        <p class="muted">Nothing here yet. Upload a photo and its country or US state will light up on the globe.</p>
      {:else}
        <ul class="countries">
          {#each visitedIds as id (id)}
            {@const c = manifest.countries[id]}
            <li class="country" class:open={openCountry === id}>
              <button class="country-head" on:click={() => toggleCountry(id)}>
                <span class="dot" style="background:{c.color}"></span>
                <span class="c-name">{c.name}</span>
                <span class="muted small">{c.photos.length} {c.photos.length === 1 ? 'photo' : 'photos'}{c.when ? ` · ${c.when}` : ''}</span>
                {#if c.photos.some((p) => uploadedDups.has(p.id))}<span class="badge warn">possible duplicate</span>{/if}
                <span class="chev">{openCountry === id ? '−' : '+'}</span>
              </button>

              {#if openCountry === id}
                <div class="country-body">
                  <label>When<input type="text" bind:value={draft.when} placeholder="e.g. August 2024" maxlength="80" /></label>
                  <label>Note<textarea bind:value={draft.blurb} rows="3" placeholder="A line or two about the trip" maxlength="1200"></textarea></label>
                  <div class="swatches" role="radiogroup" aria-label="Colour">
                    {#each PALETTE as col}
                      <button
                        class="swatch"
                        class:sel={draft.color === col}
                        style="background:{col}"
                        on:click={() => (draft.color = col)}
                        role="radio"
                        aria-checked={draft.color === col}
                        aria-label={col}
                      ></button>
                    {/each}
                  </div>
                  <button class="primary" on:click={saveCountry} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>

                  {@render photoGrid(id, c.photos)}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="card">
      <h2>Home bases <span class="muted">({manifest?.starred?.length ?? 0})</span></h2>
      <p class="muted small">Places you've lived or been many times. They get a glowing marker on the globe instead of a date, and their own photos: photos taken within 50 miles are tagged to them automatically.</p>

      {#if manifest?.starred?.length}
        <ul class="starred">
          {#each manifest.starred as s (s.id)}
            <li class="star-row">
              <span class="beacon" aria-hidden="true"></span>
              <input
                id="star-name-{s.id}"
                class="star-name"
                type="text"
                value={s.name}
                maxlength="60"
                aria-label="Name"
                on:change={(e) => patchStar(s, { name: e.currentTarget.value })}
              />
              <input
                id="star-note-{s.id}"
                class="star-note"
                type="text"
                value={s.note ?? ''}
                placeholder="Note, e.g. Home"
                maxlength="60"
                aria-label="Note"
                on:change={(e) => patchStar(s, { note: e.currentTarget.value })}
              />
              <span class="muted small star-where">{world ? findRegionAt(world, s.lat, s.lng)?.name ?? '' : ''}</span>
              <button
                class="ghost small"
                on:click={() => (openHome = openHome === s.id ? null : s.id)}
                disabled={!s.photos?.length}
                aria-expanded={openHome === s.id}
              >
                {s.photos?.length ?? 0} {s.photos?.length === 1 ? 'photo' : 'photos'}{s.photos?.length ? (openHome === s.id ? ' −' : ' +') : ''}
              </button>
              {#if s.photos?.some((p) => uploadedDups.has(p.id))}<span class="badge warn">possible duplicate</span>{/if}
              <button class="danger small" on:click={() => removeStar(s)}>Remove</button>
              {#if openHome === s.id && s.photos?.length}
                <div class="star-photos">{@render photoGrid(homeTarget(s.id), s.photos)}</div>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}

      <form class="star-form" on:submit|preventDefault={addStar}>
        <div class="star-fields">
          <label for="new-star-name">Name<input id="new-star-name" type="text" bind:value={starName} placeholder="e.g. Dallas" maxlength="60" /></label>
          <label for="new-star-note">Note (optional)<input id="new-star-note" type="text" bind:value={starNote} placeholder="e.g. Home" maxlength="60" /></label>
        </div>
        <label for="new-star-where">Location
          <input id="new-star-where" type="text" bind:value={starWhere} placeholder="32.78, -96.80" autocomplete="off" />
        </label>
        {#if photoSpots.length}
          <label for="new-star-photo">Or use where one of your photos was taken
            <select
              id="new-star-photo"
              on:change={(e) => {
                if (e.currentTarget.value) starWhere = e.currentTarget.value;
                e.currentTarget.value = '';
              }}
            >
              <option value="">Pick a photo…</option>
              {#each photoSpots as spot}<option value={spot.value}>{spot.label}</option>{/each}
            </select>
          </label>
        {/if}
        <p class="muted small">
          Tip: in Google Maps, right-click a spot and click the numbers at the top to copy them.
          {#if starRegion}<span class="star-region">Lands in {starRegion}.</span>{/if}
        </p>
        {#if starError}<p class="error small">{starError}</p>{/if}
        <button class="primary" type="submit" disabled={!starName.trim() || !starPoint || starBusy}>
          {starBusy ? 'Adding…' : 'Add place'}
        </button>
      </form>
    </section>
  {/if}

  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</main>

<style>
  .admin {
    max-width: 880px;
    margin: 0 auto;
    padding: 28px 16px 120px;
  }

  h1 {
    font-size: 28px;
    font-weight: 900;
    letter-spacing: -0.02em;
  }

  h2 {
    font-size: 18px;
    font-weight: 800;
    margin-bottom: 14px;
  }

  code {
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.9em;
    background: rgba(255, 255, 255, 0.08);
    padding: 1px 6px;
    border-radius: 6px;
  }

  .muted { color: rgba(255, 255, 255, 0.55); }
  .small { font-size: 13px; }
  .error { color: #ff8b94; }
  .ok { color: #a8e6cf; }

  .card {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 18px;
    padding: 22px;
    margin-top: 18px;
  }

  .card.narrow {
    max-width: 420px;
    margin: 12vh auto 0;
  }

  .card.warn {
    border-color: rgba(255, 230, 109, 0.45);
    background: rgba(255, 230, 109, 0.07);
    line-height: 1.5;
  }

  .login {
    display: flex;
    flex-direction: column;
    gap: 12px;
    text-align: center;
  }

  .logo {
    width: 54px;
    height: 54px;
    margin: 0 auto 4px;
    border-radius: 50%;
    background: #fff;
    color: #111;
    font-weight: 900;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .steps {
    margin: 16px 0 12px 20px;
    line-height: 1.7;
  }

  input[type='text'],
  input[type='password'],
  textarea,
  select {
    width: 100%;
    font: inherit;
    font-size: 15px;
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px;
    padding: 10px 12px;
    outline: none;
  }

  select.small {
    width: auto;
    font-size: 13px;
    padding: 6px 8px;
    max-width: 170px;
  }

  input:focus,
  textarea:focus,
  select:focus {
    border-color: #4ecdc4;
  }

  button {
    font: inherit;
    cursor: pointer;
  }

  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .primary {
    border: none;
    border-radius: 999px;
    padding: 11px 22px;
    font-weight: 700;
    color: #071311;
    background: #4ecdc4;
  }

  .ghost {
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: transparent;
    color: #fff;
    border-radius: 999px;
    padding: 8px 14px;
  }

  .ghost.small,
  .danger.small {
    padding: 5px 10px;
    font-size: 13px;
  }

  .danger {
    border: 1px solid rgba(255, 107, 107, 0.5);
    background: transparent;
    color: #ff8b94;
    border-radius: 999px;
  }

  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    flex-wrap: wrap;
  }

  .top-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .top-actions a {
    color: #4ecdc4;
    text-decoration: none;
    font-weight: 600;
  }

  .drop {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    padding: 30px 16px;
    border: 1.5px dashed rgba(255, 255, 255, 0.22);
    border-radius: 14px;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }

  .drop.over,
  .drop:hover {
    border-color: #4ecdc4;
    background: rgba(78, 205, 196, 0.06);
  }

  .drop input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }

  .drop-icon {
    font-size: 28px;
    color: #4ecdc4;
  }

  .queue,
  .countries {
    list-style: none;
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .q {
    position: relative;
    display: flex;
    gap: 14px;
    padding: 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .q.error { border-color: rgba(255, 107, 107, 0.4); }
  .q.done { opacity: 0.6; }

  .q img {
    width: 84px;
    height: 84px;
    object-fit: cover;
    border-radius: 10px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.06);
  }

  .q-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-right: 28px;
  }

  .q-row {
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }
  .q-row.apply {
    gap: 8px;
  }
  .q-row.apply .ghost {
    border-color: rgba(78, 205, 196, 0.5);
    border-radius: 14px;
    color: #4ecdc4;
    text-align: left;
  }

  .q-row select {
    flex: 1;
    min-width: 160px;
  }

  .caption {
    font-size: 14px !important;
    padding: 8px 10px !important;
  }

  .badge {
    font-size: 12px;
    padding: 3px 9px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.7);
    white-space: nowrap;
  }

  .badge.warn {
    border-color: rgba(255, 196, 87, 0.55);
    color: #ffd38a;
  }
  .dup {
    color: #ffd38a;
  }
  .dup-note {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    margin-top: 14px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid rgba(255, 196, 87, 0.4);
    background: rgba(255, 196, 87, 0.07);
    color: #ffd38a;
    font-size: 14px;
  }
  .places-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .dup-tag {
    position: absolute;
    top: 14px;
    right: 14px;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 999px;
    color: #1a1204;
    background: #ffd38a;
  }
  .badge.ok {
    border-color: rgba(78, 205, 196, 0.5);
    color: #bff3ee;
  }

  .check {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    color: rgba(255, 255, 255, 0.75);
  }

  .x {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .progress {
    height: 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.1);
    overflow: hidden;
  }

  .progress i {
    display: block;
    height: 100%;
    background: #4ecdc4;
    transform-origin: left;
    transition: transform 0.2s;
  }

  .upload-bar {
    position: sticky;
    bottom: 12px;
    margin-top: 14px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 14px;
    padding: 10px;
    border-radius: 999px;
    background: rgba(7, 8, 12, 0.85);
    backdrop-filter: blur(12px);
  }

  .country {
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .country-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 16px;
    background: none;
    border: none;
    color: #fff;
    text-align: left;
  }

  .c-name {
    font-weight: 700;
  }

  .chev {
    margin-left: auto;
    font-size: 20px;
    color: rgba(255, 255, 255, 0.5);
  }

  .dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .country-body {
    padding: 4px 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .country-body label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
  }

  .country-body .primary {
    align-self: flex-start;
  }

  .swatches {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .swatch {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid transparent;
  }

  .swatch.sel {
    border-color: #fff;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
  }

  .photos {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 12px;
    margin-top: 6px;
  }

  .ph {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 8px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
  }

  .ph img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: 8px;
  }

  .cover-tag {
    position: absolute;
    top: 14px;
    left: 14px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.6);
  }

  .ph-actions {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    align-items: center;
  }

  .starred {
    list-style: none;
    margin: 14px 0 6px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .star-photos {
    flex-basis: 100%;
  }
  .star-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(143, 211, 255, 0.05);
    border: 1px solid rgba(143, 211, 255, 0.22);
  }

  /* Small marker icon (white dot in a thin ring), matching the globe's home-base markers. */
  .beacon {
    position: relative;
    display: inline-block;
    width: 12px;
    height: 12px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1.5px solid rgba(143, 211, 255, 0.85);
    box-shadow: 0 0 8px rgba(143, 211, 255, 0.45);
  }

  .beacon::after {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 4px;
    height: 4px;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 0 5px 1px rgba(143, 211, 255, 0.9);
  }

  .star-row .star-name {
    flex: 1 1 140px;
    min-width: 0;
    font-weight: 700;
  }

  .star-row .star-note {
    flex: 1 1 140px;
    min-width: 0;
  }

  .star-where {
    min-width: 0;
  }

  .star-form {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .star-form label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    color: rgba(255, 255, 255, 0.7);
  }

  .star-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .star-region {
    color: #bfe6ff;
  }

  .star-form .primary {
    align-self: flex-start;
  }

  .toast {
    position: fixed;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    padding: 12px 18px;
    border-radius: 12px;
    background: rgba(20, 26, 40, 0.95);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    font-size: 14px;
    z-index: 50;
    max-width: calc(100vw - 32px);
  }

  @media (max-width: 600px) {
    .q img {
      width: 64px;
      height: 64px;
    }
    .upload-bar {
      border-radius: 16px;
      justify-content: space-between;
    }
  }
</style>
