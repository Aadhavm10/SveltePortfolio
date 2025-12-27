<script lang="ts">
  import { onMount, tick } from 'svelte';
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
  $: grid = (() => {
    if (!containerWidth) return [];

    const colHeights = new Array(columns).fill(0);
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

  async function preloadImages(urls: string[]): Promise<void> {
    await Promise.all(
      urls.map(
        src =>
          new Promise<void>(resolve => {
            const img = new Image();
            img.src = src;
            img.onload = img.onerror = () => resolve();
          })
      )
    );
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
    (async () => {
      await preloadImages(items.map(i => i.img));
      imagesReady = true;
    })();

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

    return () => {
      mediaQueries.forEach(mq => mq.removeEventListener('change', handleMediaChange));
    };
  });
</script>

<div bind:this={containerRef} class="list">
  {#each grid as item (item.id)}
    <div
      data-key={item.id}
      class="item-wrapper"
      role="button"
      tabindex="0"
      on:click={() => window.open(item.url, '_blank', 'noopener')}
      on:keydown={e => (e.key === 'Enter' || e.key === ' ') && window.open(item.url, '_blank', 'noopener')}
      on:mouseenter={e => handleMouseEnter(e, item)}
      on:mouseleave={e => handleMouseLeave(e, item)}
    >
      <div class="item-img" style="background-image: url({item.img})">
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
</style>
