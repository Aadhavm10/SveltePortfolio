<script lang="ts">
  import { onMount } from 'svelte';
  import Lightbox from './Lightbox.svelte';

  interface Item {
    id: string;
    img: string;
    url: string;
    height: number;
  }

  export let items: Item[] = [];

  let shuffled = [...items];

  onMount(() => {
    shuffled = [...items].sort(() => Math.random() - 0.5);
  });
  // Legacy props kept for compatibility
  export let ease: string = 'power3.out';
  export let duration: number = 0.6;
  export let stagger: number = 0.05;
  export let animateFrom: string = 'bottom';
  export let scaleOnHover: boolean = true;
  export let hoverScale: number = 0.95;
  export let blurToFocus: boolean = true;
  export let colorShiftOnHover: boolean = false;

  let selectedIndex: number | null = null;
  $: lightboxItems = shuffled.map((item, i) => ({ src: item.img, alt: `Photo ${i + 1}` }));
</script>

<div class="masonry">
  {#each shuffled as item, i}
    <button class="masonry-item" on:click={() => (selectedIndex = i)} aria-label="View photo {i + 1}">
      <img
        src={item.img}
        alt="Photo {i + 1}"
        loading={i < 8 ? 'eager' : 'lazy'}
        decoding="async"
      />
    </button>
  {/each}
</div>

<Lightbox items={lightboxItems} bind:index={selectedIndex} />

<style>
  .masonry {
    columns: 4;
    column-gap: 12px;
  }

  @media (max-width: 1200px) { .masonry { columns: 3; } }
  @media (max-width: 700px)  { .masonry { columns: 2; column-gap: 8px; } }

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

  @media (max-width: 700px) {
    .masonry-item { margin-bottom: 8px; }
  }
</style>
