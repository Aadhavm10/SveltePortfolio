<script lang="ts">
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';

  interface Item {
    id: string;
    img: string;
    url: string;
    height: number;
  }

  export let items: Item[] = [];
  // Legacy props kept for compatibility
  export let ease: string = 'power3.out';
  export let duration: number = 0.6;
  export let stagger: number = 0.05;
  export let animateFrom: string = 'bottom';
  export let scaleOnHover: boolean = true;
  export let hoverScale: number = 0.95;
  export let blurToFocus: boolean = true;
  export let colorShiftOnHover: boolean = false;

  // Lightbox
  let selectedIndex: number | null = null;
  $: selectedItem = selectedIndex !== null ? items[selectedIndex] : null;

  function openLightbox(i: number) { selectedIndex = i; }
  function closeLightbox() { selectedIndex = null; }
  function prevPhoto() {
    if (selectedIndex !== null) selectedIndex = (selectedIndex - 1 + items.length) % items.length;
  }
  function nextPhoto() {
    if (selectedIndex !== null) selectedIndex = (selectedIndex + 1) % items.length;
  }

  $: if (typeof document !== 'undefined') {
    document.body.style.overflow = selectedItem ? 'hidden' : '';
  }

  let lbImgEl: HTMLImageElement;
  let lastSelected: Item | null = null;
  $: if (lbImgEl && selectedItem && selectedItem !== lastSelected) {
    lastSelected = selectedItem;
    gsap.fromTo(lbImgEl, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out' });
  }

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prevPhoto();
      else if (e.key === 'ArrowRight') nextPhoto();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="masonry">
  {#each items as item, i}
    <button class="masonry-item" on:click={() => openLightbox(i)} aria-label="View photo {i + 1}">
      <img
        src={item.img}
        alt="Photo {i + 1}"
        loading={i < 8 ? 'eager' : 'lazy'}
        decoding="async"
      />
    </button>
  {/each}
</div>

{#if selectedItem}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="lb-backdrop" on:click={closeLightbox}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="lb-container" on:click|stopPropagation>
      <img
        bind:this={lbImgEl}
        src={selectedItem.img}
        alt="Photo {selectedIndex !== null ? selectedIndex + 1 : ''}"
        class="lb-img"
      />
      <button class="lb-close" on:click={closeLightbox} aria-label="Close">✕</button>
      <button class="lb-prev" on:click={prevPhoto} aria-label="Previous">‹</button>
      <button class="lb-next" on:click={nextPhoto} aria-label="Next">›</button>
      <div class="lb-counter">{(selectedIndex ?? 0) + 1} / {items.length}</div>
    </div>
  </div>
{/if}

<style>
  .masonry {
    columns: 4;
    column-gap: 12px;
  }

  @media (max-width: 1200px) { .masonry { columns: 3; } }
  @media (max-width: 700px)  { .masonry { columns: 2; } }
  @media (max-width: 420px)  { .masonry { columns: 1; } }

  .masonry-item {
    display: block;
    width: 100%;
    break-inside: avoid;
    margin-bottom: 12px;
    cursor: pointer;
    border-radius: 10px;
    overflow: hidden;
    padding: 0;
    border: none;
    background: none;
  }

  .masonry-item img {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 10px;
    transition: transform 0.3s ease, opacity 0.3s ease;
  }

  .masonry-item:hover img {
    transform: scale(0.97);
    opacity: 0.9;
  }

  /* Lightbox */
  .lb-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.93);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .lb-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    max-width: 95vw;
    max-height: 95vh;
  }

  .lb-img {
    max-width: 90vw;
    max-height: 88vh;
    object-fit: contain;
    border-radius: 6px;
    display: block;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8);
  }

  .lb-close {
    position: fixed;
    top: 20px;
    right: 24px;
    background: rgba(255, 255, 255, 0.12);
    border: none;
    color: #fff;
    font-size: 22px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 10001;
  }

  .lb-close:hover { background: rgba(255, 255, 255, 0.25); }

  .lb-prev,
  .lb-next {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.12);
    border: none;
    color: #fff;
    font-size: 36px;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 10001;
    line-height: 1;
  }

  .lb-prev { left: 16px; }
  .lb-next { right: 16px; }
  .lb-prev:hover,
  .lb-next:hover { background: rgba(255, 255, 255, 0.25); }

  .lb-counter {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.6);
    font-size: 14px;
    font-family: 'Courier New', monospace;
    pointer-events: none;
  }

  @media (max-width: 600px) {
    .lb-prev { left: 8px; }
    .lb-next { right: 8px; }
    .lb-prev, .lb-next { width: 44px; height: 44px; font-size: 28px; }
  }
</style>
