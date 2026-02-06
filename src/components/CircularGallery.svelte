<script lang="ts">
  import { onMount } from 'svelte';
  import { gsap } from 'gsap';

  export let projects: Array<{
    src: string;
    title: string;
    description: string;
    projectUrl: string;
  }> = [];

  let cardRefs: HTMLElement[] = [];
  let isLoaded = false;
  let isMobile = false;

  onMount(() => {
    isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    // Stagger animation on load
    gsap.fromTo(
      cardRefs.filter(Boolean),
      {
        opacity: 0,
        y: 60,
        scale: 0.9
      },
      {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        onComplete: () => {
          isLoaded = true;
        }
      }
    );

    // Handle window resize
    const handleResize = () => {
      isMobile = window.matchMedia('(max-width: 768px)').matches;
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  // Magnetic hover effect (desktop only)
  function handleMouseMove(e: MouseEvent, card: HTMLElement) {
    if (isMobile) return;

    const rect = card.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) / rect.width;
    const deltaY = (e.clientY - centerY) / rect.height;

    gsap.to(card, {
      x: deltaX * 15,
      y: deltaY * 15,
      rotateY: deltaX * 5,
      rotateX: -deltaY * 5,
      duration: 0.4,
      ease: 'power2.out'
    });
  }

  function handleMouseLeave(card: HTMLElement) {
    if (isMobile) return;

    gsap.to(card, {
      x: 0,
      y: 0,
      rotateY: 0,
      rotateX: 0,
      duration: 0.6,
      ease: 'elastic.out(1, 0.5)'
    });
  }
</script>

<div class="projects-wrapper">
  <h1 class="projects-title">Projects</h1>

  <div class="projects-grid">
    {#each projects as project, idx}
      <article 
        class="project-card"
        bind:this={cardRefs[idx]}
        on:mousemove={(e) => handleMouseMove(e, cardRefs[idx])}
        on:mouseleave={() => handleMouseLeave(cardRefs[idx])}
        style="--card-index: {idx};"
      >
        <div class="card-glow"></div>
        <div class="card-image-container">
          <img
            src={project.src}
            alt={project.title}
            class="card-image"
            loading="lazy"
            decoding="async"
            fetchpriority="low"
          />
          <div class="image-overlay"></div>
        </div>
        <div class="card-content">
          <h3 class="card-title">{project.title}</h3>
          <p class="card-description">{project.description}</p>
          <a
            href={project.projectUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="card-link"
          >
            View Project
            <svg class="arrow-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </a>
        </div>
      </article>
    {/each}
  </div>
</div>

<style>
  /* IMPORTANT: Keep background transparent to show prism effect on projects page */
  .projects-wrapper {
    width: 100%;
    min-height: 100vh;
    padding: 6rem 0 4rem 0;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .projects-title {
    font-size: clamp(2.5rem, 6vw, 4rem);
    font-weight: 800;
    color: #ffffff;
    text-align: center;
    margin-bottom: 4rem;
    letter-spacing: -0.02em;
    width: 100%;
    padding: 0 2rem;
  }

  .projects-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    max-width: 900px;
    width: 100%;
    margin: 0 auto;
    padding: 0 2rem;
  }

  @media (min-width: 768px) {
    .projects-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 2.5rem;
      max-width: 1200px;
    }
  }

  .project-card {
    background: rgba(26, 26, 26, 0.8);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    height: 100%;
    position: relative;
    opacity: 0;
    transform-style: preserve-3d;
    perspective: 1000px;
  }

  .card-glow {
    position: absolute;
    inset: -2px;
    background: linear-gradient(
      135deg,
      transparent 0%,
      rgba(139, 92, 246, 0.3) 25%,
      rgba(236, 72, 153, 0.3) 50%,
      rgba(139, 92, 246, 0.3) 75%,
      transparent 100%
    );
    border-radius: 20px;
    opacity: 0;
    transition: opacity 0.4s ease;
    z-index: -1;
    background-size: 200% 200%;
    animation: gradientShift 4s ease infinite;
  }

  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  .project-card:hover {
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
    border-color: rgba(139, 92, 246, 0.4);
    background: rgba(26, 26, 26, 0.9);
  }

  .project-card:hover .card-glow {
    opacity: 1;
  }

  .card-image-container {
    position: relative;
    width: 100%;
    height: 240px;
    overflow: hidden;
    background: linear-gradient(135deg, #1a1a1a 0%, #0f0f0f 100%);
  }

  .card-image-container::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(139, 92, 246, 0.1) 0%,
      transparent 50%,
      rgba(6, 182, 212, 0.1) 100%
    );
    opacity: 0.5;
    z-index: 1;
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
    will-change: transform;
    position: relative;
    z-index: 2;
  }

  .card-image[loading="lazy"] {
    opacity: 0;
    animation: fadeIn 0.5s ease forwards;
  }

  @keyframes fadeIn {
    to {
      opacity: 1;
    }
  }

  .project-card:hover .card-image {
    transform: scale(1.08) translateZ(20px);
  }

  .image-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.4), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .project-card:hover .image-overlay {
    opacity: 1;
  }

  .card-content {
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    flex: 1;
  }

  .card-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: #ffffff;
    margin: 0;
    line-height: 1.3;
  }

  .card-description {
    font-size: 0.875rem;
    color: #a0a0a0;
    line-height: 1.6;
    margin: 0;
    flex: 1;
  }

  .card-link {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: #8b5cf6;
    font-weight: 600;
    font-size: 0.875rem;
    text-decoration: none;
    transition: all 0.3s ease;
    align-self: flex-start;
    padding: 0.5rem 1rem 0.5rem 0;
    position: relative;
  }

  .card-link::after {
    content: '';
    position: absolute;
    bottom: 0.3rem;
    left: 0;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, #8b5cf6, #ec4899);
    transition: width 0.3s ease;
  }

  .card-link:hover {
    color: #a78bfa;
    gap: 0.75rem;
  }

  .card-link:hover::after {
    width: calc(100% - 1.5rem);
  }

  .arrow-icon {
    transition: transform 0.2s ease;
  }

  .card-link:hover .arrow-icon {
    transform: translateX(4px);
  }

  @media (max-width: 767px) {
    .card-image-container {
      height: 200px;
    }

    .card-content {
      padding: 1.25rem;
    }

    .card-title {
      font-size: 1.25rem;
    }

    .project-card {
      transform-style: flat;
    }

    .project-card:hover .card-image {
      transform: scale(1.05);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .project-card,
    .card-image,
    .card-link {
      transition: none;
    }

    .card-glow {
      animation: none;
    }
  }
</style>
