<script lang="ts">
  export let projects: Array<{
    src: string;
    title: string;
    description: string;
    projectUrl: string;
  }> = [];
</script>

<div class="projects-wrapper">
  <h1 class="projects-title">Projects</h1>

  <div class="projects-grid">
    {#each projects as project}
      <article class="project-card">
        <div class="card-image-container">
          <img
            src={project.src}
            alt={project.title}
            class="card-image"
            loading="lazy"
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
  .projects-wrapper {
    width: 100%;
    min-height: 100vh;
    padding: 6rem 0 4rem 0;
    background: #0a0a0a;
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
    background: #1a1a1a;
    border-radius: 16px;
    overflow: hidden;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .project-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.2);
  }

  .card-image-container {
    position: relative;
    width: 100%;
    height: 240px;
    overflow: hidden;
    background: #0f0f0f;
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .project-card:hover .card-image {
    transform: scale(1.05);
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
    transition: all 0.2s ease;
    align-self: flex-start;
    padding: 0.5rem 0;
  }

  .card-link:hover {
    color: #7c3aed;
    gap: 0.75rem;
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
  }
</style>
