<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchGitHubContributions } from './social/utils/api';
  import type { GitHubContributions } from './social/utils/types';

  let contributions = $state<GitHubContributions | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let hoveredDay = $state<{ date: string; count: number; x: number; y: number } | null>(null);

  async function loadContributions() {
    loading = true;
    error = null;
    try {
      contributions = await fetchGitHubContributions();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load contributions';
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    loadContributions();
  });

  function getContributionLevel(count: number): number {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 6) return 2;
    if (count <= 9) return 3;
    return 4;
  }

  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function handleDayHover(event: MouseEvent, date: string, count: number) {
    const rect = (event.target as HTMLElement).getBoundingClientRect();
    hoveredDay = {
      date,
      count,
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    };
  }

  function handleDayLeave() {
    hoveredDay = null;
  }
</script>

<div class="contributions-container">
  <div class="header">
    <h3 class="title">GitHub Activity</h3>
    {#if contributions}
      <span class="total">{contributions.totalContributions} contributions in the last year</span>
    {/if}
  </div>

  {#if loading}
    <!-- Loading Skeleton -->
    <div class="loading-skeleton">
      <div class="skeleton-grid">
        {#each Array(52) as _, weekIdx}
          <div class="skeleton-week">
            {#each Array(7) as _, dayIdx}
              <div class="skeleton-day"></div>
            {/each}
          </div>
        {/each}
      </div>
    </div>
  {:else if error}
    <!-- Error State -->
    <div class="error-state">
      <p class="error-message">{error}</p>
      <button class="retry-button" onclick={loadContributions}>
        Retry
      </button>
    </div>
  {:else if contributions}
    <!-- Contributions Grid -->
    <div class="contributions-grid">
      {#each contributions.weeks as week, weekIdx}
        <div class="week-column">
          {#each week.contributionDays as day}
            <div
              class="contribution-day level-{getContributionLevel(day.contributionCount)}"
              onmouseenter={(e) => handleDayHover(e, day.date, day.contributionCount)}
              onmouseleave={handleDayLeave}
              aria-label="{day.contributionCount} contributions on {formatDate(day.date)}"
              role="img"
            ></div>
          {/each}
        </div>
      {/each}
    </div>

    <!-- Legend -->
    <div class="legend">
      <span class="legend-label">Less</span>
      <div class="legend-item level-0" title="No contributions"></div>
      <div class="legend-item level-1" title="1-3 contributions"></div>
      <div class="legend-item level-2" title="4-6 contributions"></div>
      <div class="legend-item level-3" title="7-9 contributions"></div>
      <div class="legend-item level-4" title="10+ contributions"></div>
      <span class="legend-label">More</span>
    </div>
  {/if}
</div>

<!-- Tooltip -->
{#if hoveredDay}
  <div
    class="tooltip"
    style="left: {hoveredDay.x}px; top: {hoveredDay.y}px;"
  >
    <strong>{hoveredDay.count} contributions</strong>
    <div class="tooltip-date">{formatDate(hoveredDay.date)}</div>
  </div>
{/if}

<style>
  .contributions-container {
    border-radius: 0.75rem;
    border: 1px solid rgba(167, 139, 250, 0.2);
    background: linear-gradient(
      to bottom right,
      rgba(139, 92, 246, 0.05),
      rgba(6, 182, 212, 0.05)
    );
    backdrop-filter: blur(4px);
    padding: 1.5rem;
    transition: border-color 0.3s ease;
  }

  .contributions-container:hover {
    border-color: rgba(167, 139, 250, 0.4);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .title {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
  }

  .total {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .contributions-grid {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(7, 1fr);
    gap: 3px;
    overflow-x: auto;
    padding: 0.5rem 0;
  }

  .week-column {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    gap: 3px;
  }

  .contribution-day {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 200ms ease;
    cursor: pointer;
  }

  .contribution-day.level-0 {
    background: rgba(255, 255, 255, 0.05);
  }

  .contribution-day.level-1 {
    background: rgba(168, 85, 247, 0.3);
  }

  .contribution-day.level-2 {
    background: rgba(168, 85, 247, 0.6);
  }

  .contribution-day.level-3 {
    background: rgba(168, 85, 247, 0.85);
  }

  .contribution-day.level-4 {
    background: #a855f7;
  }

  .contribution-day:hover {
    transform: scale(1.5);
    border-color: rgba(167, 139, 250, 0.6);
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.4);
    z-index: 10;
  }

  .legend {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 1rem;
    justify-content: flex-end;
  }

  .legend-label {
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    margin: 0 0.25rem;
  }

  .legend-item {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .loading-skeleton {
    padding: 0.5rem 0;
  }

  .skeleton-grid {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(7, 1fr);
    gap: 3px;
    overflow-x: hidden;
  }

  .skeleton-week {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    gap: 3px;
  }

  .skeleton-day {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.1);
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer {
    0%, 100% {
      opacity: 0.3;
    }
    50% {
      opacity: 0.6;
    }
  }

  .error-state {
    text-align: center;
    padding: 2rem 1rem;
  }

  .error-message {
    color: rgba(255, 100, 100, 0.9);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }

  .retry-button {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(167, 139, 250, 0.3);
    background: rgba(139, 92, 246, 0.1);
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(167, 139, 250, 0.5);
  }

  .tooltip {
    position: fixed;
    transform: translate(-50%, -100%);
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background: rgba(17, 24, 39, 0.95);
    border: 1px solid rgba(167, 139, 250, 0.3);
    color: white;
    font-size: 0.75rem;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    white-space: nowrap;
  }

  .tooltip strong {
    display: block;
    margin-bottom: 0.25rem;
  }

  .tooltip-date {
    color: rgba(255, 255, 255, 0.7);
    font-size: 0.7rem;
  }

  @media (max-width: 1024px) {
    .contributions-grid {
      max-width: 100%;
    }

    .contribution-day {
      width: 10px;
      height: 10px;
    }

    .legend-item {
      width: 10px;
      height: 10px;
    }
  }

  @media (max-width: 640px) {
    .contributions-container {
      padding: 1rem;
    }

    .title {
      font-size: 0.875rem;
    }

    .total {
      font-size: 0.7rem;
    }

    .contribution-day {
      width: 8px;
      height: 8px;
    }

    .legend-item {
      width: 8px;
      height: 8px;
    }

    .legend-label {
      font-size: 0.65rem;
    }
  }
</style>
