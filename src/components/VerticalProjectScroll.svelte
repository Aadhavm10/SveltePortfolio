<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gsap } from 'gsap';
  import { ScrollTrigger } from 'gsap/ScrollTrigger';
  import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

  export let projects: Array<{
    src: string;
    title: string;
    description: string;
    projectUrl: string;
  }> = [];

  let containerRef: HTMLElement;
  let cardRefs: HTMLElement[] = [];
  let scrollTriggers: ScrollTrigger[] = [];
  let currentIndex = 0;
  let showArrows = true;
  let arrowTimeout: number;
  let isMobile = false;

  // Bento layout configurations for each project
  const layoutStyles = [
    // Layout 1 (HackMatch): Large image right, text left
    { 
      imageClass: 'image-right-large',
      contentClass: 'content-left-large',
      imageSize: '60%',
      style: 'split-right'
    },
    // Layout 2 (ScribbleAi): Image top-left corner, text wraps around
    { 
      imageClass: 'image-corner-tl',
      contentClass: 'content-wrap-br',
      imageSize: '50%',
      style: 'corner-wrap'
    },
    // Layout 3 (FlowState): Full-width image background with floating text card
    { 
      imageClass: 'image-fullwidth-bg',
      contentClass: 'content-floating-card',
      imageSize: '100%',
      style: 'immersive'
    },
    // Layout 4 (Foodie): Split diagonal
    { 
      imageClass: 'image-diagonal-bl',
      contentClass: 'content-diagonal-tr',
      imageSize: '55%',
      style: 'diagonal-split'
    },
    // Layout 5 (GPU Optimizer): Image left, stacked text blocks right
    { 
      imageClass: 'image-left-medium',
      contentClass: 'content-stacked-right',
      imageSize: '45%',
      style: 'split-left'
    },
    // Layout 6 (PremScout): Mosaic - small image top-right, large text left
    { 
      imageClass: 'image-tr-small',
      contentClass: 'content-mosaic-left',
      imageSize: '40%',
      style: 'mosaic'
    }
  ];

  onMount(() => {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);
    isMobile = window.matchMedia('(max-width: 768px)').matches;

    // Set up scroll triggers for each card
    cardRefs.forEach((card, index) => {
      if (!card) return;

      const isLast = index === cardRefs.length - 1;
      
      // Create scroll trigger for stacking effect
      const trigger = ScrollTrigger.create({
        trigger: card,
        start: 'top top',
        end: isLast ? 'bottom bottom' : '+=100%',
        pin: true,
        pinSpacing: false,
        scrub: 1,
        onUpdate: (self) => {
          const progress = self.progress;
          
          // Scale down and fade as scrolling past
          const scale = 1 - (progress * 0.1);
          const yOffset = progress * 30;
          const opacity = 1 - (progress * 0.7);
          
          gsap.to(card, {
            scale: scale,
            y: yOffset,
            opacity: opacity,
            duration: 0.1,
            ease: 'none'
          });

          // Update current index based on scroll position
          if (progress > 0.5 && index < cardRefs.length - 1) {
            currentIndex = index + 1;
          } else if (progress < 0.5) {
            currentIndex = index;
          }
        }
      });

      scrollTriggers.push(trigger);

      // Initial stagger animation on load
      gsap.fromTo(
        card,
        {
          opacity: 0,
          y: 50,
          scale: 0.95
        },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.8,
          delay: index * 0.15,
          ease: 'power3.out'
        }
      );
    });

    // Auto-hide arrows after 3 seconds
    resetArrowTimeout();

    // Keyboard navigation
    window.addEventListener('keydown', handleKeydown);
    window.addEventListener('mousemove', handleMouseMove);
    
    const handleResize = () => {
      isMobile = window.matchMedia('(max-width: 768px)').matches;
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
    };
  });

  onDestroy(() => {
    scrollTriggers.forEach(trigger => trigger.kill());
    if (arrowTimeout) clearTimeout(arrowTimeout);
  });

  function scrollToProject(index: number) {
    if (index < 0 || index >= cardRefs.length) return;
    
    const targetCard = cardRefs[index];
    if (!targetCard) return;

    const targetY = targetCard.offsetTop;
    
    gsap.to(window, {
      scrollTo: { y: targetY, autoKill: false },
      duration: 1,
      ease: 'power2.inOut'
    });
  }

  function handlePrevious() {
    if (currentIndex > 0) {
      scrollToProject(currentIndex - 1);
    }
  }

  function handleNext() {
    if (currentIndex < projects.length - 1) {
      scrollToProject(currentIndex + 1);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      handleNext();
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      handlePrevious();
    }
  }

  function handleMouseMove() {
    showArrows = true;
    resetArrowTimeout();
  }

  function resetArrowTimeout() {
    if (arrowTimeout) clearTimeout(arrowTimeout);
    arrowTimeout = setTimeout(() => {
      showArrows = false;
    }, 3000) as unknown as number;
  }
</script>

<div class="vertical-scroll-container" bind:this={containerRef}>
  <h1 class="projects-title">Projects</h1>

  <div class="scroll-wrapper">
    {#each projects as project, idx}
      <div 
        class="project-section"
        bind:this={cardRefs[idx]}
        data-index={idx}
      >
        <article 
          class="project-card bento-layout {layoutStyles[idx].style}"
          class:mobile={isMobile}
        >
          <!-- Image Container -->
          <div class="image-container {layoutStyles[idx].imageClass}">
            <img
              src={project.src}
              alt={project.title}
              class="project-image"
              loading={idx === 0 ? 'eager' : 'lazy'}
              decoding="async"
            />
            <div class="image-overlay"></div>
          </div>

          <!-- Content Container -->
          <div class="content-container {layoutStyles[idx].contentClass}">
            <div class="content-inner">
              <h2 class="project-title">{project.title}</h2>
              <p class="project-description">{project.description}</p>
              <a
                href={project.projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="project-link"
              >
                View Project
                <svg class="arrow-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </a>
            </div>
          </div>

          <!-- Decorative elements for certain layouts -->
          {#if idx === 1}
            <div class="deco-badge">AI-Powered</div>
          {/if}
          {#if idx === 3}
            <div class="deco-shape"></div>
          {/if}
        </article>
      </div>
    {/each}
  </div>

  <!-- Navigation Arrows -->
  <button
    class="nav-arrow prev"
    class:visible={showArrows && currentIndex > 0}
    on:click={handlePrevious}
    aria-label="Previous project"
  >
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M20 24L12 16L20 8" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>

  <button
    class="nav-arrow next"
    class:visible={showArrows && currentIndex < projects.length - 1}
    on:click={handleNext}
    aria-label="Next project"
  >
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <path d="M12 8L20 16L12 24" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </button>
</div>

<style>
  .vertical-scroll-container {
    width: 100%;
    min-height: 100vh;
    position: relative;
  }

  .projects-title {
    position: fixed;
    top: 2rem;
    left: 50%;
    transform: translateX(-50%);
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 800;
    color: #ffffff;
    text-align: center;
    z-index: 50;
    letter-spacing: -0.02em;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    opacity: 0.95;
  }

  .scroll-wrapper {
    width: 100%;
    position: relative;
  }

  .project-section {
    width: 100%;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    padding: 0 2rem;
  }

  .project-card {
    width: 100%;
    max-width: 1400px;
    height: 85vh;
    max-height: 800px;
    background: rgba(20, 20, 20, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    position: relative;
    overflow: hidden;
    display: grid;
    will-change: transform, opacity;
  }

  /* Bento Layout Styles */
  
  /* Layout 1: Split Right - Image right 60%, text left 40% */
  .bento-layout.split-right {
    grid-template-columns: 40% 60%;
    gap: 0;
  }

  .bento-layout.split-right .image-right-large {
    grid-column: 2;
    grid-row: 1;
  }

  .bento-layout.split-right .content-left-large {
    grid-column: 1;
    grid-row: 1;
    padding: 3rem;
    display: flex;
    align-items: center;
  }

  /* Layout 2: Corner Wrap - Image top-left corner 50% */
  .bento-layout.corner-wrap {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 50% 50%;
    gap: 0;
  }

  .bento-layout.corner-wrap .image-corner-tl {
    grid-column: 1;
    grid-row: 1;
    border-radius: 24px 0 24px 0;
  }

  .bento-layout.corner-wrap .content-wrap-br {
    grid-column: 1 / 3;
    grid-row: 1 / 3;
    padding: 3rem;
    padding-top: 52%;
    padding-left: 52%;
    display: flex;
    align-items: flex-start;
  }

  /* Layout 3: Immersive - Full-width background with floating card */
  .bento-layout.immersive {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }

  .bento-layout.immersive .image-fullwidth-bg {
    grid-column: 1;
    grid-row: 1;
  }

  .bento-layout.immersive .content-floating-card {
    grid-column: 1;
    grid-row: 1;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .bento-layout.immersive .content-inner {
    background: rgba(15, 15, 15, 0.92);
    backdrop-filter: blur(20px);
    padding: 3rem;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    max-width: 600px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  }

  /* Layout 4: Diagonal Split */
  .bento-layout.diagonal-split {
    grid-template-columns: 55% 45%;
    grid-template-rows: 45% 55%;
    gap: 0;
  }

  .bento-layout.diagonal-split .image-diagonal-bl {
    grid-column: 1;
    grid-row: 2;
    clip-path: polygon(0 0, 100% 20%, 100% 100%, 0 100%);
  }

  .bento-layout.diagonal-split .content-diagonal-tr {
    grid-column: 1 / 3;
    grid-row: 1 / 3;
    padding: 3rem;
    padding-bottom: 58%;
    padding-left: 58%;
    display: flex;
    align-items: flex-start;
  }

  /* Layout 5: Split Left - Image left 45%, stacked text right */
  .bento-layout.split-left {
    grid-template-columns: 45% 55%;
    gap: 0;
  }

  .bento-layout.split-left .image-left-medium {
    grid-column: 1;
    grid-row: 1;
  }

  .bento-layout.split-left .content-stacked-right {
    grid-column: 2;
    grid-row: 1;
    padding: 3rem;
    display: flex;
    align-items: center;
  }

  /* Layout 6: Mosaic - Small image top-right, large text left */
  .bento-layout.mosaic {
    grid-template-columns: 60% 40%;
    grid-template-rows: 40% 60%;
    gap: 0;
  }

  .bento-layout.mosaic .image-tr-small {
    grid-column: 2;
    grid-row: 1;
    border-radius: 0 24px 0 20px;
  }

  .bento-layout.mosaic .content-mosaic-left {
    grid-column: 1 / 3;
    grid-row: 1 / 3;
    padding: 3rem;
    padding-top: 42%;
    padding-right: 42%;
    display: flex;
    align-items: flex-start;
  }

  /* Image Container Styles */
  .image-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }

  .project-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .project-card:hover .project-image {
    transform: scale(1.05);
  }

  .image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(236, 72, 153, 0.15));
    opacity: 0;
    transition: opacity 0.4s ease;
  }

  .project-card:hover .image-overlay {
    opacity: 1;
  }

  /* Content Styles */
  .content-container {
    position: relative;
    z-index: 5;
  }

  .content-inner {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .project-title {
    font-size: clamp(2rem, 4vw, 3.5rem);
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .project-description {
    font-size: clamp(0.95rem, 1.5vw, 1.15rem);
    line-height: 1.7;
    color: #b0b0b0;
    margin: 0;
    max-width: 600px;
  }

  .project-link {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 2rem;
    background: linear-gradient(135deg, #8b5cf6, #ec4899);
    color: #ffffff;
    font-weight: 600;
    font-size: 1rem;
    text-decoration: none;
    border-radius: 12px;
    transition: all 0.3s ease;
    align-self: flex-start;
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
  }

  .project-link:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 30px rgba(139, 92, 246, 0.6);
    gap: 1rem;
  }

  .arrow-icon {
    transition: transform 0.3s ease;
  }

  .project-link:hover .arrow-icon {
    transform: translateX(4px);
  }

  /* Decorative Elements */
  .deco-badge {
    position: absolute;
    top: 2rem;
    right: 2rem;
    padding: 0.5rem 1rem;
    background: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.5);
    border-radius: 20px;
    color: #a78bfa;
    font-size: 0.85rem;
    font-weight: 600;
    z-index: 20;
  }

  .deco-shape {
    position: absolute;
    top: 3rem;
    right: 3rem;
    width: 120px;
    height: 120px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(236, 72, 153, 0.3));
    border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
    filter: blur(40px);
    z-index: 1;
  }

  /* Navigation Arrows */
  .nav-arrow {
    position: fixed;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 56px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #ffffff;
    z-index: 100;
    transition: all 0.3s ease;
    opacity: 0;
    pointer-events: none;
  }

  .nav-arrow.visible {
    opacity: 1;
    pointer-events: auto;
  }

  .nav-arrow:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-50%) scale(1.1);
  }

  .nav-arrow.prev {
    left: 2rem;
  }

  .nav-arrow.next {
    right: 2rem;
  }

  /* Mobile Responsive */
  @media (max-width: 768px) {
    .projects-title {
      font-size: 2rem;
      top: 1rem;
    }

    .project-section {
      padding: 0 1rem;
    }

    .project-card {
      height: auto;
      min-height: 80vh;
      max-height: none;
    }

    /* Mobile: All layouts become vertical stack */
    .project-card.mobile {
      grid-template-columns: 1fr !important;
      grid-template-rows: auto auto !important;
      gap: 0 !important;
    }

    .project-card.mobile .image-container {
      grid-column: 1 !important;
      grid-row: 1 !important;
      height: 300px;
      clip-path: none !important;
      border-radius: 24px 24px 0 0 !important;
    }

    .project-card.mobile .content-container {
      grid-column: 1 !important;
      grid-row: 2 !important;
      padding: 2rem 1.5rem !important;
    }

    .project-card.mobile .content-inner {
      background: transparent !important;
      padding: 0 !important;
      border: none !important;
      max-width: 100% !important;
    }

    .project-title {
      font-size: 1.75rem;
    }

    .project-description {
      font-size: 0.95rem;
    }

    .project-link {
      padding: 0.875rem 1.5rem;
      font-size: 0.95rem;
    }

    .nav-arrow {
      width: 48px;
      height: 48px;
    }

    .nav-arrow.prev {
      left: 1rem;
    }

    .nav-arrow.next {
      right: 1rem;
    }

    .deco-badge {
      top: 1rem;
      right: 1rem;
      font-size: 0.75rem;
      padding: 0.4rem 0.8rem;
    }
  }

  /* Reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .project-card,
    .project-image,
    .project-link,
    .nav-arrow {
      transition: none;
    }
  }
</style>
