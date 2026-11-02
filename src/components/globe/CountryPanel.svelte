<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Lightbox from '../Lightbox.svelte';
  import type { CountryEntry } from '../../data/travel';

  export let country: CountryEntry;
  export let index = 0;
  export let total = 1;
  export let prevName: string | null = null;
  export let nextName: string | null = null;
  export let mobile = false;
  export let onClose: () => void = () => {};
  export let onPrev: () => void = () => {};
  export let onNext: () => void = () => {};

  let lightboxIndex: number | null = null;
  let scroller: HTMLDivElement;

  $: items = country.photos.map((p, i) => ({
    src: p.full,
    alt: p.caption ?? `${country.name} photo ${i + 1}`,
    caption: p.caption,
  }));
  // Scroll back to the top when switching country.
  $: if (scroller && country) scroller.scrollTop = 0;
</script>

<aside
  class="panel"
  class:mobile
  style="--accent:{country.color}"
  aria-label="{country.name} photos"
  transition:fly|global={mobile ? { y: 400, duration: 450, easing: cubicOut } : { x: 420, duration: 450, easing: cubicOut }}
>
  {#if mobile}<div class="grab" aria-hidden="true"></div>{/if}
  <button class="close" on:click={onClose} aria-label="Close">✕</button>

  <div class="scroll" bind:this={scroller}>
    <p class="kicker">Country {index + 1} of {total}</p>
    <h2>{country.name}</h2>
    {#if country.when}<p class="when">{country.when}</p>{/if}
    {#if country.blurb}<p class="blurb">{country.blurb}</p>{/if}

    <div class="grid">
      {#each country.photos as photo, i (photo.id)}
        <button class="photo" class:wide={photo.w > photo.h * 1.25} on:click={() => (lightboxIndex = i)} aria-label="Open photo {i + 1}">
          <img src={photo.thumb} alt={photo.caption ?? `${country.name} photo ${i + 1}`} loading="lazy" decoding="async" width={photo.w} height={photo.h} />
          {#if photo.caption}<span class="cap">{photo.caption}</span>{/if}
        </button>
      {/each}
    </div>
  </div>

  {#if total > 1}
    <nav class="nav">
      <button on:click={onPrev}>‹ {prevName}</button>
      <button on:click={onNext}>{nextName} ›</button>
    </nav>
  {/if}
</aside>

<Lightbox {items} bind:index={lightboxIndex} />

<style>
  .panel {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(460px, 38vw);
    z-index: 95;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, rgba(16, 22, 36, 0.78), rgba(6, 8, 14, 0.88));
    backdrop-filter: blur(22px) saturate(1.3);
    -webkit-backdrop-filter: blur(22px) saturate(1.3);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: -30px 0 80px rgba(0, 0, 0, 0.5);
    color: #fff;
  }

  .panel.mobile {
    top: auto;
    left: 0;
    width: 100%;
    height: 58vh;
    height: 58dvh;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 22px 22px 0 0;
    box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.5);
  }

  .grab {
    width: 42px;
    height: 4px;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.3);
    margin: 10px auto 0;
    flex-shrink: 0;
  }

  .scroll {
    flex: 1;
    overflow-y: auto;
    padding: 112px 32px 24px;
    overscroll-behavior: contain;
  }

  .mobile .scroll {
    padding: 14px 20px 20px;
  }

  .close {
    position: absolute;
    top: 108px;
    right: 28px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    font-size: 17px;
    cursor: pointer;
    transition: background 0.2s;
    z-index: 2;
  }

  .mobile .close {
    top: 14px;
    right: 16px;
  }

  .close:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  .kicker {
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--accent);
  }

  h2 {
    font-size: clamp(2rem, 4vw, 2.9rem);
    font-weight: 900;
    letter-spacing: -0.02em;
    line-height: 1.05;
    margin-top: 6px;
    padding-right: 48px;
  }

  .when {
    margin-top: 6px;
    color: rgba(255, 255, 255, 0.65);
    font-size: 15px;
  }

  .blurb {
    margin-top: 16px;
    color: rgba(255, 255, 255, 0.84);
    line-height: 1.6;
    font-size: 15px;
    white-space: pre-line;
  }

  .grid {
    margin-top: 22px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .photo {
    position: relative;
    display: block;
    border: none;
    padding: 0;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.06);
    aspect-ratio: 3 / 4;
  }

  .photo.wide {
    grid-column: span 2;
    aspect-ratio: 16 / 10;
  }

  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.4s ease;
  }

  .photo:hover img {
    transform: scale(1.04);
  }

  .cap {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 18px 10px 8px;
    font-size: 12px;
    text-align: left;
    color: #fff;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
  }

  .nav {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 24px 18px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }

  .nav button {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.65);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
    padding: 6px 4px;
    max-width: 48%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav button:hover {
    color: #fff;
  }
</style>
