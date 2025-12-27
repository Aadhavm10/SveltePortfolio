<script lang="ts">
  import { onMount } from 'svelte';
  import SocialPreviewPanel from './SocialPreviewPanel.svelte';
  import GithubIcon from './icons/GithubIcon.svelte';
  import LinkedInIcon from './icons/LinkedInIcon.svelte';
  import { fetchGitHubData, getLinkedInHighlights } from './utils/api';
  import type { PlatformData } from './utils/types';

  type Platform = 'github' | 'linkedin';

  let activePanel = $state<Platform | null>(null);
  let hoverTimeout: ReturnType<typeof setTimeout> | null = null;
  let panelData = $state<Record<Platform, PlatformData | null>>({
    github: null,
    linkedin: null
  });
  let isLoading = $state(false);
  let isHoveringPanel = $state(false);
  let isMobile = $state(false);
  let fetchErrors = $state<Record<Platform, string | null>>({
    github: null,
    linkedin: null
  });

  onMount(() => {
    isMobile = window.matchMedia('(max-width: 768px)').matches;

    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = (e: MediaQueryListEvent) => {
      isMobile = e.matches;
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  });

  async function handleHover(platform: Platform) {
    if (isMobile) return; // Mobile uses click instead

    if (hoverTimeout) clearTimeout(hoverTimeout);

    hoverTimeout = setTimeout(async () => {
      activePanel = platform;

      if (!panelData[platform] && !fetchErrors[platform]) {
        await fetchPlatformData(platform);
      }
    }, 300);
  }

  function handleLeave() {
    if (hoverTimeout) clearTimeout(hoverTimeout);

    setTimeout(() => {
      if (!isHoveringPanel) {
        activePanel = null;
      }
    }, 500);
  }

  async function handleClick(platform: Platform) {
    if (!isMobile) return; // Desktop uses hover

    if (activePanel === platform) {
      activePanel = null;
    } else {
      activePanel = platform;
      if (!panelData[platform] && !fetchErrors[platform]) {
        await fetchPlatformData(platform);
      }
    }
  }

  async function fetchPlatformData(platform: Platform) {
    isLoading = true;
    fetchErrors[platform] = null;

    try {
      switch(platform) {
        case 'github':
          panelData.github = await fetchGitHubData();
          break;
        case 'linkedin':
          panelData.linkedin = getLinkedInHighlights();
          break;
      }
    } catch (error) {
      console.error(`Error fetching ${platform} data:`, error);
      fetchErrors[platform] = `Failed to load ${platform} data. Please try again.`;
    } finally {
      isLoading = false;
    }
  }

  function closePanel() {
    activePanel = null;
    isHoveringPanel = false;
  }
</script>

<div class="social-buttons">
  <h2 class="social-title">Connect</h2>

  <div class="buttons-container">
    <button
      class="social-btn github"
      class:active={activePanel === 'github'}
      onmouseenter={() => handleHover('github')}
      onmouseleave={handleLeave}
      onclick={() => handleClick('github')}
      aria-label="Preview GitHub profile"
    >
      <GithubIcon class="icon" />
      <div class="label-container">
        <span class="label">GitHub</span>
        <span class="sublabel">Hover to preview</span>
      </div>
    </button>

    <button
      class="social-btn linkedin"
      class:active={activePanel === 'linkedin'}
      onmouseenter={() => handleHover('linkedin')}
      onmouseleave={handleLeave}
      onclick={() => handleClick('linkedin')}
      aria-label="Preview LinkedIn profile"
    >
      <LinkedInIcon class="icon" />
      <div class="label-container">
        <span class="label">LinkedIn</span>
        <span class="sublabel">Hover to preview</span>
      </div>
    </button>
  </div>
</div>

{#if activePanel}
  <SocialPreviewPanel
    platform={activePanel}
    data={panelData[activePanel]}
    {isLoading}
    bind:isHovering={isHoveringPanel}
    onclose={closePanel}
  />
{/if}

<style>
  .social-buttons {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .social-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: white;
    margin: 0;
    background: linear-gradient(to right, #a855f7, #06b6d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .buttons-container {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .social-btn {
    display: flex;
    align-items: center;
    gap: 1.25rem;
    padding: 1.25rem 2rem;
    background: rgba(255, 255, 255, 0.08);
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(10px);
    color: white;
    font-size: 1.25rem;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .social-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    transform: translateX(8px) scale(1.05);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  }

  .social-btn.github:hover {
    border-color: rgba(168, 85, 247, 0.5);
  }

  .social-btn.github:hover :global(.icon) {
    color: #a855f7;
  }

  .social-btn.linkedin:hover {
    border-color: rgba(10, 102, 194, 0.5);
  }

  .social-btn.linkedin:hover :global(.icon) {
    color: #0a66c2;
  }

  .social-btn.instagram:hover {
    border-color: rgba(240, 148, 51, 0.5);
  }

  .social-btn.instagram:hover :global(.icon) {
    color: #f09433;
  }

  .social-btn.active {
    background: rgba(168, 85, 247, 0.2);
    border-color: rgba(168, 85, 247, 0.5);
  }

  .social-btn :global(.icon) {
    width: 2rem;
    height: 2rem;
    color: #06b6d4;
    transition: all 0.3s ease;
  }

  .social-btn.active :global(.icon) {
    color: #a855f7;
    transform: scale(1.1);
  }

  .label-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .label {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .sublabel {
    font-size: 0.75rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.6);
    transition: color 0.3s ease;
  }

  .social-btn:hover .sublabel {
    color: rgba(255, 255, 255, 0.9);
  }

  /* Mobile responsive */
  @media (max-width: 1024px) {
    .buttons-container {
      flex-direction: row;
      justify-content: center;
      flex-wrap: wrap;
    }

    .social-btn {
      flex-direction: column;
      text-align: center;
      padding: 1rem;
      min-width: 120px;
    }

    .social-title {
      text-align: center;
      font-size: 2rem;
    }
  }

  @media (max-width: 768px) {
    .social-title {
      font-size: 1.5rem;
    }

    .social-btn {
      padding: 0.75rem;
      gap: 0.5rem;
    }

    .social-btn :global(.icon) {
      width: 1.5rem;
      height: 1.5rem;
    }

    .label {
      font-size: 0.875rem;
    }

    .sublabel {
      font-size: 0.625rem;
    }
  }
</style>
