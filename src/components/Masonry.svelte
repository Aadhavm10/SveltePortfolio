<script lang="ts">
  import { onMount, tick, afterUpdate } from 'svelte';
  import { gsap } from 'gsap';

  interface Item {
    id: string;
    img: string;
    url: string;
    height: number;
  }

  interface GridItem extends Item {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  export let items: Item[] = [];
  export let ease: string = 'power3.out';
  export let duration: number = 0.6;
  export let stagger: number = 0.05;
  export let animateFrom: 'bottom' | 'top' | 'left' | 'right' | 'center' | 'random' = 'bottom';
  export let scaleOnHover: boolean = true;
  export let hoverScale: number = 0.95;
  export let blurToFocus: boolean = true;
  export let colorShiftOnHover: boolean = false;

  let containerRef: HTMLDivElement;
  let containerWidth = 0;
  let containerHeight = 0;
  let imagesReady = false;
  let hasMounted = false;
  let columns = 1;
  let loadedImages = new Set<string>();

  // Lightbox state
  let selectedIndex: number | null = null;
  $: selectedItem = selectedIndex !== null ? grid[selectedIndex] : null;

  function openLightbox(index: number) { selectedIndex = index; }
  function closeLightbox() { selectedIndex = null; }
  function prevPhoto() {
    if (selectedIndex !== null) selectedIndex = (selectedIndex - 1 + grid.length) % grid.length;
  }
  function nextPhoto() {
    if (selectedIndex !== null) selectedIndex = (selectedIndex + 1) % grid.length;
  }

  // Prevent body scroll when lightbox is open
  $: if (typeof document !== 'undefined') {
    document.body.style.overflow = selectedItem ? 'hidden' : '';
  }

  // Animate lightbox image on open
  let lbImgEl: HTMLImageElement;
  afterUpdate(() => {
    if (lbImgEl && selectedItem) {
      gsap.fromTo(lbImgEl, { scale: 0.88, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out' });
    }
  });

  // Media query reactive statement
  $: {
    if (typeof window !== 'undefined') {
      if (window.matchMedia('(min-width:1500px)').matches) columns = 5;
      else if (window.matchMedia('(min-width:1000px)').matches) columns = 4;
      else if (window.matchMedia('(min-width:600px)').matches) columns = 3;
      else if (window.matchMedia('(min-width:400px)').matches) columns = 2;
      else columns = 1;
    }
  }

  // Measure container size
  $: if (containerRef) {
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      containerWidth = width;
      containerHeight = height;
    });
    ro.observe(containerRef);
  }

  // Calculate grid layout
  let colHeights: number[] = [];
  $: grid = (() => {
    if (!containerWidth) return [];

    colHeights = new Array(columns).fill(0);
    const columnWidth = containerWidth / columns;

    return items.map(child => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = columnWidth * col;
      const height = child.height / 2;
      const y = colHeights[col];

      colHeights[col] += height;

      return { ...child, x, y, w: columnWidth, h: height };
    });
  })();

  // Calculate total grid height and dispatch event
  $: totalGridHeight = colHeights.length > 0 ? Math.max(...colHeights) + 30 : 0;

  $: if (totalGridHeight > 0 && containerRef) {
    const event = new CustomEvent('heightCalculated', {
      detail: { height: totalGridHeight }
    });
    containerRef.dispatchEvent(event);
  }

  function loadImage(src: string): Promise<void> {
    return new Promise<void>(resolve => {
      const img = new Image();
      img.src = src;
      img.onload = img.onerror = () => {
        loadedImages.add(src);
        loadedImages = loadedImages; // trigger reactivity
        resolve();
      };
    });
  }

  function lazyLoadImages() {
    // Load first 6 images immediately for above-the-fold
    const visibleImages = items.slice(0, 6);
    const remainingImages = items.slice(6);

    // Load visible images first
    Promise.all(visibleImages.map(item => loadImage(item.img))).then(() => {
      imagesReady = true;
    });

    // Load remaining images progressively
    remainingImages.forEach((item, index) => {
      setTimeout(() => {
        loadImage(item.img);
      }, index * 100); // Stagger loading
    });
  }

  function getInitialPosition(item: GridItem) {
    const containerRect = containerRef?.getBoundingClientRect();
    if (!containerRect) return { x: item.x, y: item.y };

    let direction = animateFrom;

    if (animateFrom === 'random') {
      const directions = ['top', 'bottom', 'left', 'right'];
      direction = directions[Math.floor(Math.random() * directions.length)] as typeof animateFrom;
    }

    switch (direction) {
      case 'top':
        return { x: item.x, y: -200 };
      case 'bottom':
        return { x: item.x, y: window.innerHeight + 200 };
      case 'left':
        return { x: -200, y: item.y };
      case 'right':
        return { x: window.innerWidth + 200, y: item.y };
      case 'center':
        return {
          x: containerRect.width / 2 - item.w / 2,
          y: containerRect.height / 2 - item.h / 2
        };
      default:
        return { x: item.x, y: item.y + 100 };
    }
  }

  function handleMouseEnter(e: MouseEvent, item: GridItem) {
    const element = e.currentTarget as HTMLElement;
    const selector = `[data-key="${item.id}"]`;

    if (scaleOnHover) {
      gsap.to(selector, {
        scale: hoverScale,
        duration: 0.3,
        ease: 'power2.out'
      });
    }

    if (colorShiftOnHover) {
      const overlay = element.querySelector('.color-overlay') as HTMLElement;
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0.3,
          duration: 0.3
        });
      }
    }
  }

  function handleMouseLeave(e: MouseEvent, item: GridItem) {
    const element = e.currentTarget as HTMLElement;
    const selector = `[data-key="${item.id}"]`;

    if (scaleOnHover) {
      gsap.to(selector, {
        scale: 1,
        duration: 0.3,
        ease: 'power2.out'
      });
    }

    if (colorShiftOnHover) {
      const overlay = element.querySelector('.color-overlay') as HTMLElement;
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0,
          duration: 0.3
        });
      }
    }
  }

  // Animate grid changes
  $: if (imagesReady && grid.length > 0) {
    tick().then(() => {
      grid.forEach((item, index) => {
        const selector = `[data-key="${item.id}"]`;
        const animationProps = {
          x: item.x,
          y: item.y,
          width: item.w,
          height: item.h
        };

        if (!hasMounted) {
          const initialPos = getInitialPosition(item);
          const initialState = {
            opacity: 0,
            x: initialPos.x,
            y: initialPos.y,
            width: item.w,
            height: item.h,
            ...(blurToFocus && { filter: 'blur(10px)' })
          };

          gsap.fromTo(selector, initialState, {
            opacity: 1,
            ...animationProps,
            ...(blurToFocus && { filter: 'blur(0px)' }),
            duration: 0.8,
            ease: 'power3.out',
            delay: index * stagger
          });
        } else {
          gsap.to(selector, {
            ...animationProps,
            duration: duration,
            ease: ease,
            overwrite: 'auto'
          });
        }
      });

      hasMounted = true;
    });
  }

  onMount(() => {
    lazyLoadImages();

    // Handle media query changes
    const mediaQueries = [
      window.matchMedia('(min-width:1500px)'),
      window.matchMedia('(min-width:1000px)'),
      window.matchMedia('(min-width:600px)'),
      window.matchMedia('(min-width:400px)')
    ];

    const handleMediaChange = () => {
      if (window.matchMedia('(min-width:1500px)').matches) columns = 5;
      else if (window.matchMedia('(min-width:1000px)').matches) columns = 4;
      else if (window.matchMedia('(min-width:600px)').matches) columns = 3;
      else if (window.matchMedia('(min-width:400px)').matches) columns = 2;
      else columns = 1;
    };

    mediaQueries.forEach(mq => mq.addEventListener('change', handleMediaChange));

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') prevPhoto();
      else if (e.key === 'ArrowRight') nextPhoto();
    }
    window.addEventListener('keydown', handleKeydown);

    return () => {
      mediaQueries.forEach(mq => mq.removeEventListener('change', handleMediaChange));
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div bind:this={containerRef} class="list masonry-container">
  {#each grid as item (item.id)}
    <div
      data-key={item.id}
      class="item-wrapper"
      role="button"
      tabindex="0"
      on:click={() => openLightbox(grid.indexOf(item))}
      on:keydown={e => (e.key === 'Enter' || e.key === ' ') && openLightbox(grid.indexOf(item))}
      on:mouseenter={e => handleMouseEnter(e, item)}
      on:mouseleave={e => handleMouseLeave(e, item)}
    >
      <div class="item-img" style="background-image: {loadedImages.has(item.img) ? `url(${item.img})` : 'none'}">
        {#if !loadedImages.has(item.img)}
          <div class="loading-skeleton"></div>
        {/if}
        {#if colorShiftOnHover}
          <div
            class="color-overlay"
            style="
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: 100%;
              background: linear-gradient(45deg, rgba(255,0,150,0.5), rgba(0,150,255,0.5));
              opacity: 0;
              pointer-events: none;
              border-radius: 8px;
            "
          ></div>
        {/if}
      </div>
    </div>
  {/each}
</div>

{#if selectedItem}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="lb-backdrop" on:click={closeLightbox}>
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="lb-container" on:click|stopPropagation>
      <img bind:this={lbImgEl} src={selectedItem.img} alt="Photo {selectedIndex !== null ? selectedIndex + 1 : ''}" class="lb-img" />
      <button class="lb-close" on:click={closeLightbox} aria-label="Close">✕</button>
      <button class="lb-prev" on:click={prevPhoto} aria-label="Previous photo">‹</button>
      <button class="lb-next" on:click={nextPhoto} aria-label="Next photo">›</button>
      <div class="lb-counter">{(selectedIndex ?? 0) + 1} / {grid.length}</div>
    </div>
  </div>
{/if}

<style>
  .list {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 100vh;
  }

  .item-wrapper {
    position: absolute;
    will-change: transform, width, height, opacity;
    padding: 15px;
    cursor: pointer;
    top: 0;
    left: 0;
  }

  .item-wrapper > .item-img {
    position: relative;
    background-size: cover;
    background-position: center center;
    width: 100%;
    height: 100%;
    text-transform: uppercase;
    font-size: 10px;
    line-height: 10px;
    border-radius: 10px;
    box-shadow: 0px 10px 50px -10px rgba(0, 0, 0, 0.2);
  }

  .loading-skeleton {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.15) 50%, rgba(255,255,255,0.05) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 10px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
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

  .lb-close:hover {
    background: rgba(255, 255, 255, 0.25);
  }

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
  .lb-next:hover {
    background: rgba(255, 255, 255, 0.25);
  }

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
    .lb-prev,
    .lb-next {
      width: 44px;
      height: 44px;
      font-size: 28px;
    }
  }
</style>
