<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { gsap } from 'gsap';

  export let projects: Array<{
    src: string;
    title: string;
    description: string;
    projectUrl: string;
  }> = [];

  let theaterMode = false;
  let activeIndex = 0;
  let thumbnailRefs: HTMLElement[] = [];
  let theaterRef: HTMLElement;
  let isTransitioning = false;

  function openTheater(index: number) {
    if (isTransitioning) return;
    isTransitioning = true;
    activeIndex = index;
    theaterMode = true;

    // Animate theater opening
    setTimeout(() => {
      if (theaterRef) {
        gsap.fromTo(
          theaterRef,
          { opacity: 0, scale: 0.95 },
          { 
            opacity: 1, 
            scale: 1, 
            duration: 0.5,
            ease: 'power3.out',
            onComplete: () => {
              isTransitioning = false;
            }
          }
        );
      }
    }, 10);
  }

  function closeTheater() {
    if (isTransitioning) return;
    isTransitioning = true;

    gsap.to(theaterRef, {
      opacity: 0,
      scale: 0.95,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        theaterMode = false;
        isTransitioning = false;
      }
    });
  }

  function nextProject() {
    if (activeIndex < projects.length - 1) {
      navigateToProject(activeIndex + 1);
    }
  }

  function previousProject() {
    if (activeIndex > 0) {
      navigateToProject(activeIndex - 1);
    }
  }

  function navigateToProject(index: number) {
    if (isTransitioning) return;
    isTransitioning = true;

    const content = theaterRef?.querySelector('.theater-content');
    if (content) {
      gsap.to(content, {
        opacity: 0,
        x: index > activeIndex ? -30 : 30,
        duration: 0.25,
        ease: 'power2.in',
        onComplete: () => {
          activeIndex = index;
          gsap.fromTo(
            content,
            { opacity: 0, x: index > activeIndex ? 30 : -30 },
            { 
              opacity: 1, 
              x: 0, 
              duration: 0.25,
              ease: 'power2.out',
              onComplete: () => {
                isTransitioning = false;
              }
            }
          );
        }
      });
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!theaterMode) return;

    switch (e.key) {
      case 'Escape':
        closeTheater();
        break;
      case 'ArrowRight':
        nextProject();
        break;
      case 'ArrowLeft':
        previousProject();
        break;
    }
  }

  onMount(() => {
    // Stagger animation for thumbnails
    gsap.fromTo(
      thumbnailRefs.filter(Boolean),
      { opacity: 0, y: 40, scale: 0.9 },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.6,
        stagger: 0.1,
        ease: 'power3.out',
        delay: 0.2
      }
    );

    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', handleKeydown);
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('keydown', handleKeydown);
      }
    };
  });

  onDestroy(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', handleKeydown);
    }
  });
</script>

<div class="theater-container">
  <h1 class="main-title">Projects</h1>

  <!-- Thumbnail Grid -->
  <div class="thumbnail-grid">
    {#each projects as project, idx}
      <button
        class="thumbnail-card"
        bind:this={thumbnailRefs[idx]}
        on:click={() => openTheater(idx)}
        aria-label="Open {project.title} in theater mode"
      >
        <div class="thumbnail-image-wrapper">
          <img
            src={project.src}
            alt={project.title}
            class="thumbnail-image"
            loading={idx < 3 ? 'eager' : 'lazy'}
          />
          <div class="thumbnail-overlay">
            <div class="play-icon">
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle cx="24" cy="24" r="24" fill="rgba(255,255,255,0.2)" />
                <path d="M20 16L32 24L20 32V16Z" fill="white" />
              </svg>
            </div>
          </div>
        </div>
        <div class="thumbnail-info">
          <h3 class="thumbnail-title">{project.title}</h3>
          <p class="thumbnail-description">{project.description}</p>
        </div>
      </button>
    {/each}
  </div>

  <!-- Theater Mode Overlay -->
  {#if theaterMode}
    <div class="theater-overlay" bind:this={theaterRef}>
      <button class="theater-close" on:click={closeTheater} aria-label="Close theater mode">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M24 8L8 24M8 8L24 24" stroke="white" stroke-width="3" stroke-linecap="round"/>
        </svg>
      </button>

      <div class="theater-content">
        <div class="theater-split">
          <!-- Image Side -->
          <div class="theater-image-section">
            <img
              src={projects[activeIndex].src}
              alt={projects[activeIndex].title}
              class="theater-image"
            />
          </div>

          <!-- Content Side -->
          <div class="theater-info-section">
            <div class="theater-info-inner">
              <div class="project-number">Project {activeIndex + 1} of {projects.length}</div>
              <h2 class="theater-title">{projects[activeIndex].title}</h2>
              <p class="theater-description">{projects[activeIndex].description}</p>
              <a
                href={projects[activeIndex].projectUrl}
                target="_blank"
                rel="noopener noreferrer"
                class="theater-link"
              >
                Visit Project
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M4 10H16M16 10L11 5M16 10L11 15" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      <!-- Navigation Arrows -->
      {#if activeIndex > 0}
        <button
          class="theater-nav prev"
          on:click={previousProject}
          aria-label="Previous project"
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M24 30L14 20L24 10" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      {/if}

      {#if activeIndex < projects.length - 1}
        <button
          class="theater-nav next"
          on:click={nextProject}
          aria-label="Next project"
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <path d="M16 10L26 20L16 30" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      {/if}

      <!-- Progress Indicator -->
      <div class="theater-progress">
        {#each projects as _, idx}
          <button
            class="progress-dot"
            class:active={idx === activeIndex}
            on:click={() => navigateToProject(idx)}
            aria-label="Go to project {idx + 1}"
          ></button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .theater-container {
    width: 100%;
    min-height: 100vh;
    padding: 6rem 2rem 4rem;
    position: relative;
  }

  .main-title {
    font-size: clamp(3rem, 7vw, 5rem);
    font-weight: 900;
    color: #ffffff;
    text-align: center;
    margin-bottom: 4rem;
    letter-spacing: -0.03em;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  }

  /* Thumbnail Grid */
  .thumbnail-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 2.5rem;
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  .thumbnail-card {
    background: rgba(25, 25, 25, 0.9);
    backdrop-filter: blur(20px);
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    overflow: hidden;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    opacity: 0;
    padding: 0;
    text-align: left;
  }

  .thumbnail-card:hover {
    transform: translateY(-8px);
    border-color: rgba(139, 92, 246, 0.5);
    box-shadow: 0 20px 60px rgba(139, 92, 246, 0.3);
  }

  .thumbnail-image-wrapper {
    position: relative;
    width: 100%;
    height: 280px;
    overflow: hidden;
  }

  .thumbnail-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .thumbnail-card:hover .thumbnail-image {
    transform: scale(1.1);
  }

  .thumbnail-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.7));
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .thumbnail-card:hover .thumbnail-overlay {
    opacity: 1;
  }

  .play-icon {
    transform: scale(0.8);
    transition: transform 0.3s ease;
  }

  .thumbnail-card:hover .play-icon {
    transform: scale(1);
  }

  .thumbnail-info {
    padding: 1.75rem;
  }

  .thumbnail-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0 0 0.75rem 0;
    line-height: 1.2;
  }

  .thumbnail-description {
    font-size: 0.95rem;
    line-height: 1.6;
    color: #b0b0b0;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Theater Mode Overlay */
  .theater-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.96);
    backdrop-filter: blur(10px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    opacity: 0;
  }

  .theater-close {
    position: absolute;
    top: 2rem;
    right: 2rem;
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
    transition: all 0.3s ease;
    z-index: 10;
    padding: 0;
  }

  .theater-close:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: rotate(90deg);
  }

  .theater-content {
    width: 100%;
    height: 100%;
    max-width: 1600px;
    max-height: 900px;
    position: relative;
  }

  .theater-split {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 0;
    height: 100%;
    background: rgba(20, 20, 20, 0.95);
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow: 0 30px 80px rgba(0, 0, 0, 0.8);
  }

  .theater-image-section {
    position: relative;
    overflow: hidden;
    background: #000;
  }

  .theater-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .theater-info-section {
    padding: 4rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(20, 20, 20, 0.98), rgba(30, 30, 30, 0.98));
  }

  .theater-info-inner {
    max-width: 500px;
  }

  .project-number {
    font-size: 0.875rem;
    font-weight: 600;
    color: #8b5cf6;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-bottom: 1rem;
  }

  .theater-title {
    font-size: clamp(2.5rem, 4vw, 3.5rem);
    font-weight: 800;
    color: #ffffff;
    line-height: 1.1;
    margin: 0 0 1.5rem 0;
    letter-spacing: -0.02em;
  }

  .theater-description {
    font-size: 1.125rem;
    line-height: 1.8;
    color: #d0d0d0;
    margin: 0 0 2.5rem 0;
  }

  .theater-link {
    display: inline-flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem 2.5rem;
    background: linear-gradient(135deg, #8b5cf6, #ec4899);
    color: #ffffff;
    font-weight: 700;
    font-size: 1.125rem;
    text-decoration: none;
    border-radius: 14px;
    transition: all 0.3s ease;
    box-shadow: 0 10px 30px rgba(139, 92, 246, 0.4);
  }

  .theater-link:hover {
    transform: translateY(-3px);
    box-shadow: 0 15px 40px rgba(139, 92, 246, 0.6);
    gap: 1rem;
  }

  /* Navigation Arrows */
  .theater-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 50%;
    width: 64px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    z-index: 10;
    padding: 0;
  }

  .theater-nav:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: translateY(-50%) scale(1.1);
  }

  .theater-nav.prev {
    left: 2rem;
  }

  .theater-nav.next {
    right: 2rem;
  }

  /* Progress Indicator */
  .theater-progress {
    position: absolute;
    bottom: 2rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 0.75rem;
    z-index: 10;
  }

  .progress-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 0;
  }

  .progress-dot:hover {
    background: rgba(255, 255, 255, 0.6);
    transform: scale(1.2);
  }

  .progress-dot.active {
    background: #8b5cf6;
    width: 32px;
    border-radius: 5px;
  }

  /* Mobile Responsive */
  @media (max-width: 1024px) {
    .theater-split {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }

    .theater-info-section {
      padding: 2.5rem 2rem;
    }

    .theater-title {
      font-size: 2rem;
    }

    .theater-description {
      font-size: 1rem;
    }

    .theater-nav {
      width: 52px;
      height: 52px;
    }

    .theater-nav.prev {
      left: 1rem;
    }

    .theater-nav.next {
      right: 1rem;
    }
  }

  @media (max-width: 768px) {
    .thumbnail-grid {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }

    .theater-overlay {
      padding: 0;
    }

    .theater-split {
      border-radius: 0;
      max-height: 100vh;
    }

    .theater-close {
      top: 1rem;
      right: 1rem;
      width: 48px;
      height: 48px;
    }

    .theater-info-section {
      padding: 2rem 1.5rem;
    }

    .theater-title {
      font-size: 1.75rem;
    }

    .theater-description {
      font-size: 0.95rem;
      margin-bottom: 2rem;
    }

    .theater-link {
      padding: 1rem 2rem;
      font-size: 1rem;
    }

    .theater-nav {
      width: 44px;
      height: 44px;
    }

    .theater-progress {
      bottom: 1rem;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .thumbnail-card,
    .thumbnail-image,
    .theater-overlay,
    .theater-link,
    .theater-nav {
      transition: none;
    }
  }
</style>
