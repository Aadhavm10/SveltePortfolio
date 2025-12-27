<script lang="ts">
  export let src: string;
  export let title: string;
  export let description: string;
  export let projectUrl: string = '';

  let cardRef: HTMLDivElement;
  let isHovered = false;

  function handleMouseMove(e: MouseEvent) {
    if (!cardRef) return;

    const rect = cardRef.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -8;
    const rotateY = ((x - centerX) / centerX) * 8;

    cardRef.style.transform = `
      rotateX(${rotateX}deg)
      rotateY(${rotateY}deg)
      scale(1.02)
    `;
  }

  function handleMouseLeave() {
    if (!cardRef) return;
    isHovered = false;
    cardRef.style.transform = `
      rotateX(0deg)
      rotateY(0deg)
      scale(1)
    `;
  }

  function handleMouseEnter() {
    isHovered = true;
  }
</script>

<div
  bind:this={cardRef}
  class="card"
  on:mousemove={handleMouseMove}
  on:mouseleave={handleMouseLeave}
  on:mouseenter={handleMouseEnter}
  role="article"
>
  <!-- Gradient overlay that appears on hover -->
  <div
    class="gradient-overlay"
    class:visible={isHovered}
  ></div>

  <div class="image-container">
    <img
      src={src}
      alt={title}
      class="project-image"
    />
  </div>

  <div class="content">
    <div class="text-content">
      <h2 class="project-title">{title}</h2>
      <p class="project-description">{description}</p>
    </div>

    {#if projectUrl}
      <a
        href={projectUrl}
        class="view-button"
        target={projectUrl.startsWith('http') ? "_blank" : "_self"}
        rel={projectUrl.startsWith('http') ? "noopener noreferrer" : undefined}
      >
        View Project
        <svg
          class="arrow-icon"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
    {/if}
  </div>

  <!-- Subtle shine effect -->
  <div
    class="shine-effect"
    class:visible={isHovered}
  ></div>
</div>

<style>
  .card {
    position: relative;
    overflow: hidden;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border: 1px solid #2A0E61;
    transition: all 300ms ease-out;
    width: 100%;
    max-width: 100%;
    height: auto;
    background: rgba(10, 10, 30, 0.95);
  }

  .gradient-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top right, rgba(168, 85, 247, 0.1), transparent, rgba(59, 130, 246, 0.1));
    transition: opacity 300ms;
    pointer-events: none;
    z-index: 10;
    opacity: 0;
  }

  .gradient-overlay.visible {
    opacity: 1;
  }

  .image-container {
    width: 100%;
    height: 200px;
  }

  .project-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .content {
    position: relative;
    padding: 0.75rem 1rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 200px;
  }

  @media (min-width: 640px) {
    .content {
      padding: 1rem;
    }
  }

  .text-content {
    flex: 1;
  }

  .project-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.5rem;
  }

  @media (min-width: 640px) {
    .project-title {
      font-size: 1.25rem;
    }
  }

  @media (min-width: 1024px) {
    .project-title {
      font-size: 1.5rem;
    }
  }

  .project-description {
    color: #d1d5db;
    font-size: 0.75rem;
    line-height: 1.625;
  }

  @media (min-width: 640px) {
    .project-description {
      font-size: 0.875rem;
    }
  }

  .view-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    background: linear-gradient(to right, #9333ea, #2563eb);
    color: white;
    transition: all 200ms ease-out;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    margin-top: 1rem;
    width: 100%;
    opacity: 1;
    position: relative;
    pointer-events: auto;
    z-index: 20;
    text-decoration: none;
  }

  .view-button:hover {
    background: linear-gradient(to right, #7e22ce, #1d4ed8);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    transform: scale(1.05);
  }

  .arrow-icon {
    margin-left: 0.5rem;
    width: 1rem;
    height: 1rem;
  }

  .shine-effect {
    position: absolute;
    inset: 0;
    transition: opacity 300ms;
    pointer-events: none;
    z-index: 10;
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%);
    opacity: 0;
  }

  .shine-effect.visible {
    opacity: 1;
  }
</style>
