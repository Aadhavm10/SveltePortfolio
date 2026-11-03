<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import CountryPanel from './CountryPanel.svelte';
  import { loaderControl } from './loaderControl';
  import { findRegionAt, loadWorld, type World } from '../../lib/geo';
  import {
    emptyManifest,
    orderedCountryIds,
    isStateId,
    shortName,
    US_ID,
    US_NAME,
    type Manifest,
    type StarredPlace,
  } from '../../data/travel';
  import type { GlobeScene, HoverTarget } from './scene';

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let scene: GlobeScene | null = null;
  let manifest: Manifest = emptyManifest();
  let ready = false;
  let noWebGL = false;
  let mobile = false;
  let touch = false;
  let hovered: { target: HoverTarget; x: number; y: number } | null = null;
  let world: World | null = null;
  let selectedId: string | null = null;
  let destroyed = false;

  $: ids = orderedCountryIds(manifest);
  $: total = ids.length;
  // US states roll up into one country for the count.
  $: countryCount = new Set(ids.map((id) => (isStateId(id) ? US_ID : id))).size;
  $: selected = selectedId ? manifest.countries[selectedId] ?? null : null;
  $: selectedIndex = selectedId ? ids.indexOf(selectedId) : -1;
  $: hoveredCountry = hovered?.target.kind === 'region' ? manifest.countries[hovered.target.id] ?? null : null;
  $: hoveredStar = hovered?.target.kind === 'star' ? hovered.target : null;
  $: starredCount = manifest.starred?.length ?? 0;
  // Starred places grouped by the country / US state they're in (shown in that place's panel).
  $: starsByRegion = groupStars(world, manifest.starred ?? []);

  function groupStars(w: World | null, places: StarredPlace[]): Map<string, StarredPlace[]> {
    const out = new Map<string, StarredPlace[]>();
    if (!w) return out;
    for (const s of places) {
      const id = findRegionAt(w, s.lat, s.lng)?.id;
      if (id) out.set(id, [...(out.get(id) ?? []), s]);
    }
    return out;
  }
  $: if (typeof document !== 'undefined') document.body.classList.toggle('globe-panel-open', !!selected);

  function panelInfo() {
    if (mobile) return { side: 'bottom' as const, size: window.innerHeight * 0.58 };
    return { side: 'right' as const, size: Math.min(460, window.innerWidth * 0.38) };
  }

  function select(id: string | null) {
    if (id && !manifest.countries[id]) id = null;
    if (id === selectedId) return;
    if (!id && !selectedId) return;
    selectedId = id;
    hovered = null;
    scene?.select(id, panelInfo());
  }

  function step(dir: 1 | -1) {
    if (selectedIndex < 0 || !ids.length) return;
    select(ids[(selectedIndex + dir + ids.length) % ids.length]);
  }

  // Pass every dependency explicitly so the reactive statements below re-run when they change
  // (a template call like nameAt(-1) isn't re-evaluated when selectedIndex changes).
  function nameAt(m: Manifest, list: string[], index: number, offset: number): string | null {
    if (index < 0 || list.length < 2) return null;
    const id = list[(index + offset + list.length) % list.length];
    return m.countries[id]?.name ?? null;
  }
  $: prevName = nameAt(manifest, ids, selectedIndex, -1);
  $: nextName = nameAt(manifest, ids, selectedIndex, 1);

  async function fetchManifest(): Promise<Manifest> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('/api/travel', { headers: { accept: 'application/json' } });
        if (res.ok) return (await res.json()) as Manifest;
      } catch {
        /* retry */
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    throw new Error('travel manifest unavailable');
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && selectedId) select(null);
  }

  onMount(() => {
    mobile = matchMedia('(max-width: 768px)').matches;
    touch = matchMedia('(pointer: coarse)').matches;
    const mq = matchMedia('(max-width: 768px)');
    const onMq = () => (mobile = mq.matches);
    mq.addEventListener('change', onMq);
    window.addEventListener('keydown', onKey);
    init();
    return () => {
      mq.removeEventListener('change', onMq);
      window.removeEventListener('keydown', onKey);
    };
  });

  async function init() {
    const loader = loaderControl();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let worldP = 0;
    let modP = 0;
    let dataP = 0;
    let buildP = 0;
    const report = (label?: string) =>
      loader.progress(worldP * 0.45 + modP * 0.2 + dataP * 0.05 + buildP * 0.3, label);

    const manifestPromise = fetchManifest()
      .catch(() => {
        // Show the globe anyway and try again a bit later.
        setTimeout(async () => {
          try {
            const m = await fetchManifest();
            if (destroyed) return;
            manifest = m;
            scene?.setManifest(m);
          } catch {
            /* give up quietly */
          }
        }, 5000);
        return emptyManifest();
      })
      .then((m) => {
        dataP = 1;
        report();
        return m;
      });
    const modulePromise = import('./scene').then((mod) => {
      modP = 1;
      report();
      return mod;
    });
    const worldPromise = loadWorld((f) => {
      worldP = f;
      report('mapping borders…');
    });

    try {
      const [loadedWorld, m, mod] = await Promise.all([worldPromise, manifestPromise, modulePromise]);
      world = loadedWorld;
      if (destroyed) return;
      manifest = m;
      report('raising countries…');
      try {
        scene = await mod.createGlobeScene({
          canvas,
          container,
          world: loadedWorld,
          manifest: m,
          reducedMotion,
          topologyUrl: '/textures/earth-topology.webp',
          onProgress: (f) => {
            buildP = f;
            report();
          },
          onHover: (target, x, y) => (hovered = target && !selectedId ? { target, x, y } : null),
          onSelect: (id) => select(id),
        });
        if (destroyed) {
          scene.dispose();
          scene = null;
          return;
        }
      } catch (err) {
        console.error('WebGL globe failed to start', err);
        noWebGL = true;
      }
    } catch (err) {
      console.error('Globe data failed to load', err);
      noWebGL = true;
    }

    await loader.finish();
    if (destroyed) return;
    scene?.intro();
    ready = true;
  }

  onDestroy(() => {
    destroyed = true;
    scene?.dispose();
    scene = null;
    if (typeof document !== 'undefined') document.body.classList.remove('globe-panel-open');
  });
</script>

<div class="globe-root" bind:this={container}>
  <canvas bind:this={canvas} class="globe-canvas" aria-label="Interactive globe of places Aadhav has visited"></canvas>

  {#if noWebGL}
    <p class="fallback">The 3D globe couldn't start on this device, but you can still browse the trips below.</p>
  {/if}

  <div class="hero" class:show={ready} class:hidden={!!selected}>
    <h1>Aadhav Manimurugan</h1>
    {#if countryCount || starredCount}
      <div class="meta">
        {#if countryCount}
          <p class="count"><strong>{countryCount}</strong> {countryCount === 1 ? 'country' : 'countries'} visited</p>
        {/if}
        {#if starredCount}
          <p class="legend"><span class="beacon" aria-hidden="true"></span>lived here or been many times</p>
        {/if}
      </div>
    {/if}
    {#if total}
      <!-- Hidden visually (the globe is the way in) but kept for keyboard and screen-reader users,
           and shown as a fallback when the 3D globe can't start. -->
      <nav class="chips" class:sr-only={!noWebGL} aria-label="Places I've been">
        {#each ids as id (id)}
          <button class="chip" style="--c:{manifest.countries[id].color}" on:click={() => select(id)}>
            <span class="dot"></span>{shortName(id, manifest.countries[id].name)}
          </button>
        {/each}
      </nav>
    {/if}
    {#if !noWebGL}
      <p class="hint">drag to spin · {touch ? 'tap' : 'click'} a glowing place</p>
    {/if}
  </div>

  {#if hovered && hoveredStar && !selected}
    <div class="tip" style="left:{hovered.x}px; top:{hovered.y}px">
      <span class="beacon" aria-hidden="true"></span>
      {hoveredStar.name}
      <span class="muted">· {hoveredStar.note ?? 'lived here or been many times'}{hoveredStar.regionId && manifest.countries[hoveredStar.regionId] ? ' · click to open' : ''}</span>
    </div>
  {:else if hovered && hoveredCountry && !selected}
    <div class="tip" style="left:{hovered.x}px; top:{hovered.y}px">
      <span class="dot" style="background:{hoveredCountry.color}; color:{hoveredCountry.color}"></span>
      {hoveredCountry.name}
      <span class="muted">· {hoveredCountry.photos.length} {hoveredCountry.photos.length === 1 ? 'photo' : 'photos'} · click to open</span>
    </div>
  {/if}

  {#if selected && selectedId}
    <CountryPanel
        country={selected}
        index={selectedIndex}
        total={ids.length}
        parentName={selectedId && isStateId(selectedId) ? US_NAME : null}
        stars={starsByRegion.get(selectedId) ?? []}
        {prevName}
        {nextName}
        {mobile}
        onClose={() => select(null)}
        onPrev={() => step(-1)}
        onNext={() => step(1)}
      />
  {/if}
</div>

<style>
  .globe-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #030408;
  }

  .globe-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    touch-action: none;
    outline: none;
  }

  .fallback {
    position: absolute;
    top: 40%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(420px, 85vw);
    text-align: center;
    color: rgba(255, 255, 255, 0.7);
    font-size: 15px;
    line-height: 1.5;
  }

  .hero {
    position: absolute;
    left: calc(clamp(1.25rem, 4vw, 3rem) + env(safe-area-inset-left, 0px));
    bottom: calc(clamp(1.5rem, 5vh, 3rem) + env(safe-area-inset-bottom, 0px));
    max-width: min(560px, 90vw);
    color: #fff;
    z-index: 10;
    pointer-events: none;
    opacity: 0;
    transform: translateY(14px);
    transition: opacity 0.8s ease 0.6s, transform 0.8s ease 0.6s;
  }

  .hero.show {
    opacity: 1;
    transform: none;
  }

  .hero.show.hidden {
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.35s ease, transform 0.35s ease;
  }

  .hero h1 {
    font-size: clamp(2.4rem, 5.2vw, 4rem);
    font-weight: 900;
    line-height: 1.02;
    letter-spacing: -0.02em;
    text-shadow: 0 4px 30px rgba(0, 0, 0, 0.6);
    max-width: 9.5em;
  }

  .sr-only {
    position: absolute !important;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  .chips {
    margin-top: 12px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    pointer-events: auto;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.18);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s, transform 0.2s;
  }

  .chip:hover,
  .chip:focus-visible {
    background: rgba(255, 255, 255, 0.16);
    border-color: var(--c);
    transform: translateY(-1px);
  }

  .chip .dot {
    background: var(--c);
    color: var(--c);
  }

  .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 10px currentColor;
    flex-shrink: 0;
  }

  .meta {
    margin-top: 14px;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 14px;
  }

  .legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: rgba(255, 255, 255, 0.6);
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

  .count {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 13px;
    letter-spacing: 0.02em;
    color: rgba(255, 255, 255, 0.72);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.14);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }

  .count strong {
    color: #fff;
    font-size: 15px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin-top: 14px;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.45);
  }

  .tip {
    position: fixed;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    padding: 9px 14px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    color: #fff;
    background: rgba(10, 14, 24, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.2);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    transform: translate(16px, -130%);
    pointer-events: none;
  }

  .tip .muted {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  :global(body.globe-panel-open .credit) {
    opacity: 0;
  }

  @media (max-width: 768px) {
    /* Sit above the fixed "Made with…" credit (its position comes from Layout.astro). */
    .hero {
      bottom: calc(
        var(--credit-bottom, 1.5rem) + var(--credit-line, 1.2rem) + 0.5rem + env(safe-area-inset-bottom, 0px)
      );
    }
    .hero h1 {
      font-size: clamp(2rem, 9vw, 2.6rem);
    }
    .chip {
      padding: 7px 12px;
      font-size: 13px;
    }
  }
</style>
