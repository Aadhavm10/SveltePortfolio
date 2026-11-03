<script lang="ts">
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';

  interface LightboxItem {
    src: string;
    alt?: string;
    caption?: string;
  }

  export let items: LightboxItem[] = [];
  /** Index of the open photo, or null when closed. Use bind:index. */
  export let index: number | null = null;

  $: current = index !== null ? items[index] ?? null : null;

  function close() {
    index = null;
  }
  function prev() {
    if (index !== null) index = (index - 1 + items.length) % items.length;
  }
  function next() {
    if (index !== null) index = (index + 1) % items.length;
  }

  $: if (typeof document !== 'undefined') {
    document.body.style.overflow = current ? 'hidden' : '';
  }

  let imgEl: HTMLImageElement;
  let lastShown: LightboxItem | null = null;
  $: if (imgEl && current && current !== lastShown) {
    lastShown = current;
    gsap.fromTo(imgEl, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out' });
  }
  $: if (!current) lastShown = null;

  onMount(() => {
    function onKey(e: KeyboardEvent) {
      if (index === null) return;
      if (e.key === 'Escape') {
        // Don't let the same Escape also close whatever is underneath.
        e.stopImmediatePropagation();
        close();
      } else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    }
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = '';
    };
  });
</script>

{#if current}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="lb-backdrop" on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="lb-container" on:click|stopPropagation>
      <img bind:this={imgEl} src={current.src} alt={current.alt ?? `Photo ${(index ?? 0) + 1}`} class="lb-img" />
      {#if current.caption}<p class="lb-caption">{current.caption}</p>{/if}
    </div>
    <button class="lb-close" on:click|stopPropagation={close} aria-label="Close">✕</button>
    {#if items.length > 1}
      <button class="lb-prev" on:click|stopPropagation={prev} aria-label="Previous">‹</button>
      <button class="lb-next" on:click|stopPropagation={next} aria-label="Next">›</button>
    {/if}
    <div class="lb-counter">{(index ?? 0) + 1} / {items.length}</div>
  </div>
{/if}

<style>
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    max-width: 95vw;
    max-height: 95vh;
  }

  .lb-img {
    max-width: 90vw;
    max-height: 84vh;
    object-fit: contain;
    border-radius: 6px;
    display: block;
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.8);
  }

  .lb-caption {
    margin-top: 14px;
    color: rgba(255, 255, 255, 0.82);
    font-size: 15px;
    text-align: center;
    max-width: 70ch;
  }

  .lb-close {
    position: fixed;
    top: calc(20px + env(safe-area-inset-top, 0px));
    right: calc(24px + env(safe-area-inset-right, 0px));
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

  .lb-prev { left: calc(16px + env(safe-area-inset-left, 0px)); }
  .lb-next { right: calc(16px + env(safe-area-inset-right, 0px)); }
  .lb-prev:hover,
  .lb-next:hover { background: rgba(255, 255, 255, 0.25); }

  .lb-counter {
    position: fixed;
    bottom: calc(20px + env(safe-area-inset-bottom, 0px));
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
