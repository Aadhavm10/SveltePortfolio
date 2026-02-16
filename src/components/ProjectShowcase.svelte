<script lang="ts">
  import { onMount } from 'svelte';

  export let projects: Array<{
    src: string;
    title: string;
    description: string;
    projectUrl: string;
  }> = [];

  let currentIndex = 0;
  let isAnimating = false;
  let mounted = false;
  let direction: 'up' | 'down' = 'down';
  let containerEl: HTMLElement;

  $: project = projects[currentIndex] || projects[0];
  $: canGoNext = currentIndex < projects.length - 1;
  $: canGoPrev = currentIndex > 0;

  function goTo(index: number) {
    if (isAnimating || index === currentIndex || index < 0 || index >= projects.length) return;
    isAnimating = true;
    direction = index > currentIndex ? 'down' : 'up';
    currentIndex = index;
    setTimeout(() => { isAnimating = false; }, 600);
  }

  function next() { goTo(currentIndex + 1); }
  function prev() { goTo(currentIndex - 1); }

  function handleWheel(e: WheelEvent) {
    if (isAnimating) return;
    if (Math.abs(e.deltaY) < 30) return;
    if (e.deltaY > 0) next();
    else prev();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); prev(); }
  }

  let touchStartY = 0;
  function handleTouchStart(e: TouchEvent) { touchStartY = e.touches[0].clientY; }
  function handleTouchEnd(e: TouchEvent) {
    const diff = touchStartY - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next(); else prev();
    }
  }

  onMount(() => {
    mounted = true;
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div
  class="showcase"
  bind:this={containerEl}
  on:wheel|preventDefault={handleWheel}
  on:touchstart={handleTouchStart}
  on:touchend={handleTouchEnd}
>
  <!-- Project Display -->
  {#key currentIndex}
    <div class="project-slide {direction}">
      <div class="slide-inner">
        <!-- Image -->
        <div class="image-side">
          <img src={project.src} alt={project.title} class="project-img" />
          <div class="img-gradient"></div>
        </div>

        <!-- Info -->
        <div class="info-side">
          <span class="counter">{String(currentIndex + 1).padStart(2, '0')} / {String(projects.length).padStart(2, '0')}</span>
          <h2 class="title">{project.title}</h2>
          <p class="desc">{project.description}</p>
          <a href={project.projectUrl} target="_blank" rel="noopener noreferrer" class="cta">
            View Project
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M4 9H14M14 9L9.5 4.5M14 9L9.5 13.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </a>
        </div>
      </div>
    </div>
  {/key}

  <!-- Dots -->
  <div class="dots">
    {#each projects as _, i}
      <button
        class="dot"
        class:active={i === currentIndex}
        on:click={() => goTo(i)}
        aria-label="Go to project {i + 1}"
      ></button>
    {/each}
  </div>

  <!-- Arrows -->
  {#if canGoPrev}
    <button class="arrow arrow-up" on:click={prev} aria-label="Previous project">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M18 15L12 9L6 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  {/if}
  {#if canGoNext}
    <button class="arrow arrow-down" on:click={next} aria-label="Next project">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
  {/if}

  <!-- Scroll hint on first slide -->
  {#if currentIndex === 0 && mounted}
    <div class="scroll-hint">
      <span>Scroll to explore</span>
      <div class="scroll-line"></div>
    </div>
  {/if}
</div>

<style>
  .showcase {
    width: 100%;
    height: 100vh;
    position: relative;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Slide transition */
  .project-slide {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5rem 3rem 3rem;
  }

  .project-slide.down {
    animation: slideInDown 0.55s cubic-bezier(0.4, 0, 0.15, 1) forwards;
  }

  .project-slide.up {
    animation: slideInUp 0.55s cubic-bezier(0.4, 0, 0.15, 1) forwards;
  }

  @keyframes slideInDown {
    from { opacity: 0; transform: translateY(60px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes slideInUp {
    from { opacity: 0; transform: translateY(-60px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .slide-inner {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 4rem;
    max-width: 1300px;
    width: 100%;
    align-items: center;
  }

  /* Image */
  .image-side {
    position: relative;
    border-radius: 20px;
    overflow: hidden;
    aspect-ratio: 16 / 10;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .project-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 0.6s ease;
  }

  .image-side:hover .project-img {
    transform: scale(1.04);
  }

  .img-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.35) 0%, transparent 50%);
    pointer-events: none;
  }

  /* Info */
  .info-side {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }

  .counter {
    font-size: 0.85rem;
    font-weight: 700;
    color: #8b5cf6;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
  }

  .title {
    font-size: clamp(2.2rem, 4.5vw, 3.8rem);
    font-weight: 800;
    color: #fff;
    line-height: 1.1;
    letter-spacing: -0.03em;
    margin: 0;
  }

  .desc {
    font-size: 1.05rem;
    line-height: 1.75;
    color: #c0c0c0;
    margin: 0;
    max-width: 520px;
  }

  .cta {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    margin-top: 0.5rem;
    padding: 0.9rem 2rem;
    background: linear-gradient(135deg, #8b5cf6, #a855f7);
    color: #fff;
    font-weight: 700;
    font-size: 0.95rem;
    text-decoration: none;
    border-radius: 12px;
    align-self: flex-start;
    transition: all 0.3s ease;
    box-shadow: 0 6px 24px rgba(139, 92, 246, 0.35);
  }

  .cta:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 32px rgba(139, 92, 246, 0.5);
    gap: 0.9rem;
  }

  /* Dots */
  .dots {
    position: fixed;
    right: 2rem;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    z-index: 50;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.25);
    border: none;
    padding: 0;
    cursor: pointer;
    transition: all 0.35s ease;
  }

  .dot:hover {
    background: rgba(255, 255, 255, 0.5);
  }

  .dot.active {
    background: #8b5cf6;
    height: 28px;
    border-radius: 5px;
  }

  /* Arrows */
  .arrow {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 50%;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #fff;
    z-index: 50;
    transition: all 0.3s ease;
    padding: 0;
  }

  .arrow:hover {
    background: rgba(255, 255, 255, 0.18);
    transform: translateX(-50%) scale(1.1);
  }

  .arrow-up { bottom: calc(100vh - 5rem); top: auto; top: 5rem; }
  .arrow-down { bottom: 2rem; }

  /* Scroll hint */
  .scroll-hint {
    position: fixed;
    bottom: 2.5rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    z-index: 40;
    animation: fadeInHint 1s ease 1s both;
  }

  .scroll-hint span {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-weight: 500;
  }

  .scroll-line {
    width: 1px;
    height: 32px;
    background: linear-gradient(to bottom, rgba(255,255,255,0.4), transparent);
    animation: scrollPulse 1.5s ease-in-out infinite;
  }

  @keyframes fadeInHint {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  @keyframes scrollPulse {
    0%, 100% { opacity: 0.3; transform: scaleY(0.6); }
    50%      { opacity: 1;   transform: scaleY(1); }
  }

  /* Mobile */
  @media (max-width: 900px) {
    .project-slide {
      padding: 5rem 1.5rem 3rem;
    }

    .slide-inner {
      grid-template-columns: 1fr;
      gap: 2rem;
      max-width: 600px;
    }

    .image-side {
      aspect-ratio: 16 / 9;
    }

    .title {
      font-size: 1.8rem;
    }

    .desc {
      font-size: 0.95rem;
    }

    .dots {
      right: 1rem;
    }

    .arrow-up { top: 4.5rem; }
    .arrow-down { bottom: 1.5rem; }
  }

  @media (max-width: 500px) {
    .project-slide {
      padding: 4.5rem 1rem 3rem;
    }

    .slide-inner {
      gap: 1.5rem;
    }

    .info-side {
      gap: 0.75rem;
    }

    .title {
      font-size: 1.5rem;
    }

    .desc {
      font-size: 0.85rem;
      line-height: 1.6;
    }

    .cta {
      padding: 0.75rem 1.5rem;
      font-size: 0.875rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .project-slide.down,
    .project-slide.up {
      animation: none;
      opacity: 1;
    }

    .scroll-line,
    .scroll-hint {
      animation: none;
    }
  }
</style>
