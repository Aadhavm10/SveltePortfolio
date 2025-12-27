<script lang="ts">
  import { fly } from 'svelte/transition';
  import { quintOut } from 'svelte/easing';
  import GitHubPreview from './GitHubPreview.svelte';
  import LinkedInPreview from './LinkedInPreview.svelte';
  import InstagramPreview from './InstagramPreview.svelte';

  let {
    platform,
    data,
    isLoading,
    isHovering = $bindable(false),
    onclose
  } = $props<{
    platform: 'github' | 'linkedin' | 'instagram';
    data: any;
    isLoading: boolean;
    isHovering?: boolean;
    onclose: () => void;
  }>();

  let panelRef: HTMLDivElement | null = $state(null);

  function handleClickOutside(event: MouseEvent) {
    if (panelRef && !panelRef.contains(event.target as Node)) {
      onclose();
    }
  }

  $effect(() => {
    if (panelRef) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  });
</script>

<div
  bind:this={panelRef}
  class="panel-overlay"
  transition:fly={{ y: 20, duration: 400, easing: quintOut }}
  onmouseenter={() => isHovering = true}
  onmouseleave={() => isHovering = false}
  onclick={(e) => e.stopPropagation()}
>
  <div class="panel-container">
    <button
      class="close-btn"
      onclick={onclose}
      aria-label="Close preview panel"
    >
      ×
    </button>

    {#if isLoading}
      <div class="loading-skeleton">
        <div class="pulse"></div>
        <div class="pulse"></div>
        <div class="pulse"></div>
      </div>
    {:else if platform === 'github'}
      <GitHubPreview {data} />
    {:else if platform === 'linkedin'}
      <LinkedInPreview {data} />
    {:else if platform === 'instagram'}
      <InstagramPreview {data} />
    {/if}
  </div>
</div>

<style>
  .panel-overlay {
    position: fixed;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    pointer-events: auto;
  }

  .panel-container {
    position: relative;
    width: min(700px, 90vw);
    max-height: 70vh;
    overflow-y: auto;
    background: rgba(10, 10, 30, 0.95);
    border: 1px solid rgba(168, 85, 247, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.5),
      0 0 40px rgba(168, 85, 247, 0.2);
    backdrop-filter: blur(20px);
  }

  .close-btn {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    font-size: 28px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .close-btn:hover {
    background: rgba(168, 85, 247, 0.8);
    transform: scale(1.1);
  }

  .loading-skeleton {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 0;
  }

  .pulse {
    height: 100px;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.05) 0%,
      rgba(255, 255, 255, 0.1) 50%,
      rgba(255, 255, 255, 0.05) 100%
    );
    border-radius: 8px;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  /* Scrollbar styling */
  .panel-container::-webkit-scrollbar {
    width: 8px;
  }

  .panel-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 10px;
  }

  .panel-container::-webkit-scrollbar-thumb {
    background: rgba(168, 85, 247, 0.5);
    border-radius: 10px;
  }

  .panel-container::-webkit-scrollbar-thumb:hover {
    background: rgba(168, 85, 247, 0.7);
  }

  /* Mobile adjustments */
  @media (max-width: 768px) {
    .panel-overlay {
      bottom: 80px;
    }

    .panel-container {
      max-height: 60vh;
      padding: 1rem;
    }
  }
</style>
