<script lang="ts">
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';

  export let logo: string = 'AM';
  export let menuAriaLabel: string = 'Toggle menu';
  export let menuBg: string = '#ffffff';
  export let menuContentColor: string = '#111111';
  export let useFixedPosition: boolean = true;
  export let animationEase: string = 'back.out(1.5)';
  export let animationDuration: number = 0.5;
  export let staggerDelay: number = 0.12;
  export let items: Array<{
    label: string;
    href?: string;
    ariaLabel?: string;
    rotation?: number;
    hoverStyles?: {
      bgColor?: string;
      textColor?: string;
    };
    subItems?: Array<{
      label: string;
      href: string;
    }>;
  }> = [
    {
      label: 'home',
      href: '/',
      ariaLabel: 'Home',
      rotation: -8,
      hoverStyles: { bgColor: '#3b82f6', textColor: '#ffffff' }
    },
    {
      label: 'about',
      href: '/about',
      ariaLabel: 'About',
      rotation: 8,
      hoverStyles: { bgColor: '#10b981', textColor: '#ffffff' }
    },
    {
      label: 'projects',
      href: '/projects',
      ariaLabel: 'Projects',
      rotation: 8,
      hoverStyles: { bgColor: '#f59e0b', textColor: '#ffffff' }
    },
    {
      label: 'life',
      href: '/life',
      ariaLabel: 'Life',
      rotation: 8,
      hoverStyles: { bgColor: '#ef4444', textColor: '#ffffff' }
    },
    {
      label: 'connect',
      ariaLabel: 'Connect',
      rotation: -8,
      hoverStyles: { bgColor: '#8b5cf6', textColor: '#ffffff' },
      subItems: [
        { label: 'GitHub', href: 'https://github.com/Aadhavm10' },
        { label: 'LinkedIn', href: 'https://www.linkedin.com/in/aadhav-/' },
        { label: 'Email', href: 'mailto:aadhavmanimurugan@gmail.com' }
      ]
    }
  ];

  let isMenuOpen = false;
  let showOverlay = false;
  let overlayRef: HTMLDivElement;
  let bubblesRef: (HTMLAnchorElement | HTMLDivElement)[] = [];
  let labelRefs: HTMLSpanElement[] = [];
  let hoveredItemIndex: number | null = null;
  let clickedItemIndex: number | null = null;

  $: containerClassName = useFixedPosition ? 'bubble-menu fixed' : 'bubble-menu absolute';

  function handleToggle() {
    const nextState = !isMenuOpen;
    if (nextState) showOverlay = true;
    isMenuOpen = nextState;
    hoveredItemIndex = null;
    clickedItemIndex = null; // Reset clicked state when closing menu
  }

  function handleOverlayClick(e: MouseEvent) {
    if (e.target === overlayRef) {
      isMenuOpen = false;
      hoveredItemIndex = null;
      clickedItemIndex = null;
    }
  }

  function handleParentClick(idx: number, e: Event) {
    // Don't interfere if clicking on a sub-item link
    const target = e.target as HTMLElement;
    if (target.classList.contains('sub-item-link') || target.closest('.sub-item-link')) {
      return; // Let the link handle the click
    }
    
    e.preventDefault();
    e.stopPropagation();
    // Toggle: if already clicked, unclick it. Otherwise, click it.
    clickedItemIndex = clickedItemIndex === idx ? null : idx;
  }

  function handleLinkClick() {
    isMenuOpen = false;
    hoveredItemIndex = null;
    clickedItemIndex = null;
  }

  function animateMenu() {
    if (typeof window === 'undefined') return;

    const overlay = overlayRef;
    const bubbles = bubblesRef.filter(Boolean);
    const labels = labelRefs.filter(Boolean);

    if (!overlay || !bubbles.length) return;

    if (isMenuOpen) {
      gsap.set(overlay, { display: 'flex' });
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.set(bubbles, { scale: 0, transformOrigin: '50% 50%' });
      gsap.set(labels, { y: 24, autoAlpha: 0 });

      bubbles.forEach((bubble, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05);
        const tl = gsap.timeline({ delay });

        tl.to(bubble, {
          scale: 1,
          duration: animationDuration,
          ease: animationEase
        });
        if (labels[i]) {
          tl.to(
            labels[i],
            {
              y: 0,
              autoAlpha: 1,
              duration: animationDuration,
              ease: 'power3.out'
            },
            `-=${animationDuration * 0.9}`
          );
        }
      });
    } else if (showOverlay) {
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.to(labels, {
        y: 24,
        autoAlpha: 0,
        duration: 0.2,
        ease: 'power3.in'
      });
      gsap.to(bubbles, {
        scale: 0,
        duration: 0.2,
        ease: 'power3.in',
        onComplete: () => {
          gsap.set(overlay, { display: 'none' });
          showOverlay = false;
        }
      });
    }
  }

  $: if (isMenuOpen !== undefined && showOverlay !== undefined) {
    animateMenu();
  }

  onMount(() => {
    const handleResize = () => {
      if (isMenuOpen) {
        const bubbles = bubblesRef.filter(Boolean);
        const isDesktop = window.innerWidth >= 900;

        bubbles.forEach((bubble, i) => {
          const item = items[i];
          if (bubble && item) {
            const rotation = isDesktop ? (item.rotation ?? 0) : 0;
            gsap.set(bubble, { rotation });
          }
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });
</script>

<nav class={containerClassName} aria-label="Main navigation">
  <a href="/" class="bubble logo-bubble" aria-label="Home" style="background: {menuBg};">
    <span class="logo-content">{logo}</span>
  </a>

  <button
    type="button"
    class="bubble toggle-bubble menu-btn {isMenuOpen ? 'open' : ''}"
    on:click={handleToggle}
    aria-label={menuAriaLabel}
    aria-pressed={isMenuOpen}
    style="background: {menuBg};"
  >
    <span class="menu-line" style="background: {menuContentColor};"></span>
    <span class="menu-line" style="background: {menuContentColor};"></span>
  </button>
</nav>

{#if showOverlay}
  <div
    bind:this={overlayRef}
    class="bubble-menu-items {useFixedPosition ? 'fixed' : 'absolute'}"
    aria-hidden={!isMenuOpen}
    on:click={handleOverlayClick}
  >
    <ul class="pill-list" role="menu" aria-label="Menu links">
      {#each items as item, idx}
        <li role="none" class="pill-col">
          {#if item.subItems}
            <!-- Item with sub-items (Connect button) -->
            <div
              role="menuitem"
              tabindex="0"
              aria-label={item.ariaLabel || item.label}
              class="pill-link pill-link-parent {hoveredItemIndex === idx || clickedItemIndex === idx ? 'hovered' : ''}"
              style="--item-rot: {item.rotation ?? 0}deg; --pill-bg: {menuBg}; --pill-color: {menuContentColor}; --hover-bg: {item.hoverStyles?.bgColor || '#f3f4f6'}; --hover-color: {item.hoverStyles?.textColor || menuContentColor};"
              bind:this={bubblesRef[idx]}
              on:mouseenter={() => hoveredItemIndex = idx}
              on:mouseleave={() => hoveredItemIndex = null}
              on:click={(e) => handleParentClick(idx, e)}
            >
              {#if hoveredItemIndex === idx || clickedItemIndex === idx}
                <div class="sub-items">
                  {#each item.subItems as subItem}
                    <a 
                      href={subItem.href} 
                      class="sub-item-link" 
                      target={subItem.href.startsWith('mailto:') ? '_self' : '_blank'}
                      rel="noopener noreferrer"
                      on:click={(e) => {
                        e.stopPropagation();
                        handleLinkClick();
                      }}
                    >
                      {subItem.label}
                    </a>
                  {/each}
                </div>
              {:else}
                <span class="pill-label" bind:this={labelRefs[idx]}>{item.label}</span>
              {/if}
            </div>
          {:else}
            <!-- Regular link item -->
            <a
              role="menuitem"
              href={item.href}
              aria-label={item.ariaLabel || item.label}
              class="pill-link"
              style="--item-rot: {item.rotation ?? 0}deg; --pill-bg: {menuBg}; --pill-color: {menuContentColor}; --hover-bg: {item.hoverStyles?.bgColor || '#f3f4f6'}; --hover-color: {item.hoverStyles?.textColor || menuContentColor};"
              bind:this={bubblesRef[idx]}
              on:click={handleLinkClick}
              on:mouseenter={() => clickedItemIndex = null}
            >
              <span class="pill-label" bind:this={labelRefs[idx]}>{item.label}</span>
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  /* Navigation Container */
  :global(.bubble-menu) {
    left: 0;
    right: 0;
    top: 2em;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 0 2em;
    pointer-events: none;
    z-index: 99;
  }

  :global(.bubble-menu.fixed) {
    position: fixed;
  }

  :global(.bubble-menu.absolute) {
    position: absolute;
  }

  /* Bubble Base Styles */
  :global(.bubble-menu .bubble) {
    --bubble-size: 48px;
    width: var(--bubble-size);
    height: var(--bubble-size);
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  }

  :global(.bubble-menu .logo-bubble),
  :global(.bubble-menu .toggle-bubble) {
    will-change: transform;
  }

  :global(.bubble-menu .logo-bubble) {
    width: auto;
    min-height: var(--bubble-size);
    height: var(--bubble-size);
    padding: 0 16px;
    border-radius: calc(var(--bubble-size) / 2);
    gap: 8px;
    text-decoration: none;
    color: inherit;
    transition: transform 0.2s ease;
    cursor: pointer;
  }

  :global(.bubble-menu .logo-bubble:hover) {
    transform: scale(1.05);
  }

  :global(.bubble-menu .toggle-bubble) {
    width: var(--bubble-size);
    height: var(--bubble-size);
  }

  :global(.bubble-menu .logo-content) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 1.2rem;
  }

  :global(.bubble-menu .menu-btn) {
    border: none;
    background: #fff;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  :global(.bubble-menu .menu-line) {
    width: 26px;
    height: 2px;
    background: #111;
    border-radius: 2px;
    display: block;
    margin: 0 auto;
    transition: transform 0.3s ease, opacity 0.3s ease;
    transform-origin: center;
  }

  :global(.bubble-menu .menu-line + .menu-line) {
    margin-top: 6px;
  }

  :global(.bubble-menu .menu-btn.open .menu-line:first-child) {
    transform: translateY(4px) rotate(45deg);
  }

  :global(.bubble-menu .menu-btn.open .menu-line:last-child) {
    transform: translateY(-4px) rotate(-45deg);
  }

  @media (min-width: 768px) {
    :global(.bubble-menu .bubble) {
      --bubble-size: 56px;
    }

    :global(.bubble-menu .logo-bubble) {
      padding: 0 16px;
    }
  }

  /* Menu Overlay */
  :global(.bubble-menu-items) {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 98;
  }

  :global(.bubble-menu-items.fixed) {
    position: fixed;
  }

  :global(.bubble-menu-items.absolute) {
    position: absolute;
  }

  /* Pill List */
  :global(.bubble-menu-items .pill-list) {
    list-style: none;
    margin: 0;
    padding: 0 24px;
    display: flex;
    flex-wrap: wrap;
    gap: 0;
    row-gap: 4px;
    width: 100%;
    max-width: 1600px;
    margin-left: auto;
    margin-right: auto;
    pointer-events: auto;
    justify-content: stretch;
  }

  :global(.bubble-menu-items .pill-list .pill-col) {
    display: flex;
    justify-content: center;
    align-items: stretch;
    flex: 0 0 calc(100% / 3);
    box-sizing: border-box;
  }

  /* 5-item layout: items 4 and 5 centered on second row */
  :global(.bubble-menu-items .pill-list .pill-col:nth-child(4):nth-last-child(2)) {
    margin-left: calc(100% / 6);
  }

  :global(.bubble-menu-items .pill-list .pill-col:nth-child(5):last-child) {
    margin-right: calc(100% / 6);
  }

  /* Pill Link Base */
  :global(.bubble-menu-items .pill-link) {
    --pill-bg: #ffffff;
    --pill-color: #111;
    --item-rot: 0deg;
    --hover-bg: #f3f4f6;
    --hover-color: #111;
    width: 100%;
    min-height: 160px;
    padding: clamp(1.5rem, 3vw, 8rem) 0;
    font-size: clamp(1.5rem, 4vw, 4rem);
    font-weight: 400;
    line-height: 1.2;
    border-radius: 999px;
    background: var(--pill-bg);
    color: var(--pill-color);
    text-decoration: none;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    transition: background 0.3s ease, color 0.3s ease;
    will-change: transform;
    box-sizing: border-box;
    white-space: nowrap;
    overflow: visible;
  }

  :global(.bubble-menu-items .pill-link .pill-label) {
    display: inline-block;
    will-change: transform, opacity;
    line-height: 1.2;
  }

  /* Desktop hover effects */
  @media (min-width: 900px) {
    :global(.bubble-menu-items .pill-link) {
      transform: rotate(var(--item-rot));
    }

    :global(.bubble-menu-items .pill-link:not(.pill-link-parent):hover) {
      transform: rotate(var(--item-rot)) scale(1.06);
      background: var(--hover-bg);
      color: var(--hover-color);
    }

    :global(.bubble-menu-items .pill-link:active) {
      transform: rotate(var(--item-rot)) scale(0.94);
    }
  }

  /* Mobile Layout */
  @media (max-width: 899px) {
    :global(.bubble-menu-items) {
      padding-top: 120px;
      align-items: flex-start;
    }

    :global(.bubble-menu-items .pill-list) {
      row-gap: 16px;
    }

    :global(.bubble-menu-items .pill-list .pill-col) {
      flex: 0 0 100%;
      margin-left: 0 !important;
      margin-right: 0 !important;
    }

    :global(.bubble-menu-items .pill-link) {
      font-size: clamp(1.2rem, 3vw, 4rem);
      padding: clamp(1rem, 2vw, 2rem) 0;
      min-height: 80px;
    }

    :global(.bubble-menu-items .pill-link:not(.pill-link-parent):hover) {
      transform: scale(1.06);
      background: var(--hover-bg);
      color: var(--hover-color);
    }

    :global(.bubble-menu-items .pill-link:active) {
      transform: scale(0.94);
    }
  }

  /* Parent with Sub-items (Connect button) */
  :global(.bubble-menu-items .pill-link-parent) {
    cursor: pointer;
  }

  :global(.bubble-menu-items .pill-link-parent.hovered) {
    background: var(--hover-bg);
    color: var(--hover-color);
  }

  @media (min-width: 900px) {
    :global(.bubble-menu-items .pill-link-parent.hovered) {
      transform: rotate(var(--item-rot)) scale(1.06);
    }
  }

  /* Sub-items Container - Overlaid directly on the button */
  :global(.bubble-menu-items .sub-items) {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 1rem;
    z-index: 1;
  }

  /* Sub-item Links */
  :global(.bubble-menu-items .sub-item-link) {
    font-size: clamp(1.1rem, 2vw, 1.4rem);
    font-weight: 500;
    color: inherit;
    text-decoration: none;
    padding: 0.5rem 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 0.2s ease;
    white-space: nowrap;
    pointer-events: auto;
    cursor: pointer;
    z-index: 10;
    position: relative;
  }

  :global(.bubble-menu-items .sub-item-link:hover) {
    opacity: 0.7;
  }

  @media (max-width: 899px) {
    :global(.bubble-menu-items .sub-items) {
      gap: 0.4rem;
      padding: 0.75rem;
    }

    :global(.bubble-menu-items .sub-item-link) {
      font-size: 1.1rem;
      padding: 0.4rem 0.8rem;
    }
  }
</style>
