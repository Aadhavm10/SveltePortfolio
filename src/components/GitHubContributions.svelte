<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchGitHubContributions } from './social/utils/api';
  import type { GitHubContributions } from './social/utils/types';

  let contributions = $state<GitHubContributions | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let hoveredDay = $state<{ date: string; count: number; x: number; y: number } | null>(null);
  let mounted = $state(false);

  // Generate month labels dynamically from contribution data
  const monthLabels = $derived((() => {
    if (!contributions) return [];

    const labels: Array<{month: string, index: number}> = [];
    let lastMonth = '';

    contributions.weeks.forEach((week, weekIndex) => {
      const date = new Date(week.contributionDays[0].date);
      const monthName = date.toLocaleString('en-US', { month: 'short' });

      if (monthName !== lastMonth) {
        labels.push({ month: monthName, index: weekIndex });
        lastMonth = monthName;
      }
    });

    return labels;
  })());

  // Day labels - 7 rows matching GitHub (Sun at top, Sat at bottom)
  // Show labels only on Mon, Wed, Fri like GitHub does
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  async function loadContributions() {
    console.log('[GitHubContributions] Starting load...');
    loading = true;
    error = null;
    try {
      contributions = await fetchGitHubContributions();
      console.log('[GitHubContributions] Loaded successfully:', contributions);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load contributions';
      console.error('[GitHubContributions] Load failed:', error);
    } finally {
      loading = false;
      console.log('[GitHubContributions] Load complete. Loading:', loading, 'Error:', error, 'Has data:', !!contributions);
    }
  }

  onMount(() => {
    loadContributions();
    mounted = true;
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

<div
  class="contributions-card"
  class:mounted
  role="button"
  tabindex="0"
  onclick={() => window.open('https://github.com/Aadhavm10', '_blank', 'noopener')}
  onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && window.open('https://github.com/Aadhavm10', '_blank', 'noopener')}
>
  <!-- Card Header -->
  <div class="card-header">
    <div class="header-left">
      <h3 class="title">GitHub Activity</h3>
      {#if contributions && !loading}
        <p class="subtitle">{contributions.totalContributions} contributions in the last year</p>
      {/if}
    </div>
    <div class="header-right">
      <div class="active-dot"></div>
      <span class="active-text">Active</span>
    </div>
  </div>

  {#if loading}
    <!-- Loading Skeleton -->
    <div class="loading-skeleton">
      <p class="debug-text">Loading GitHub contributions...</p>
      <div class="skeleton-grid">
        {#each Array(52) as _}
          {#each Array(7) as _}
            <div class="skeleton-day"></div>
          {/each}
        {/each}
      </div>
    </div>
  {:else if error}
    <!-- Error State -->
    <div class="error-state">
      <p class="error-message">{error}</p>
      <p class="error-hint">
        {#if error.includes('token')}
          Check that PUBLIC_GITHUB_TOKEN is set in your environment variables.
        {:else}
          Unable to load GitHub activity. Please check console for details.
        {/if}
      </p>
      <button class="retry-button" onclick={loadContributions}>
        Retry
      </button>
    </div>
  {:else if contributions}
    <!-- Grid Container -->
    <div class="grid-container">
      <!-- Debug info (remove later) -->
      <p class="debug-text">Showing {contributions.totalContributions} contributions</p>
      <!-- Month Labels Row -->
      <div class="month-labels-row">
        {#each monthLabels as {month, index}}
          <div class="month-label" style="grid-column: {index + 1};">
            {month}
          </div>
        {/each}
      </div>

      <!-- Grid Content Wrapper -->
      <div class="grid-content-wrapper">
        <!-- Day Labels Column -->
        <div class="day-labels-column">
          {#each dayLabels as day}
            <span class="day-label">{day}</span>
          {/each}
        </div>

        <!-- Contributions Grid -->
        <div class="contributions-grid">
          {#each contributions.weeks as week}
            {#each week.contributionDays as day}
              <div
                class="contribution-day level-{getContributionLevel(day.contributionCount)}"
                onmouseenter={(e) => handleDayHover(e, day.date, day.contributionCount)}
                onmouseleave={handleDayLeave}
                aria-label="{day.contributionCount} contributions on {formatDate(day.date)}"
                role="img"
              ></div>
            {/each}
          {/each}
        </div>
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
    </div>
  {:else}
    <!-- Unexpected state -->
    <div class="error-state">
      <p class="debug-text">Unexpected state: loading={loading}, error={error}, hasContributions={!!contributions}</p>
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
  .contributions-card {
    background: #ffffff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.08);
    padding: 0.375rem 1rem;
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    opacity: 0;
    transition: opacity 600ms ease-out 200ms, box-shadow 300ms ease, transform 300ms ease;
    cursor: pointer;
  }

  .contributions-card.mounted {
    opacity: 1;
  }

  .contributions-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 8px 24px rgba(0,0,0,0.12);
    transform: translateY(-2px);
  }

  .contributions-card:active {
    transform: translateY(0);
  }

  /* Card Header */
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.375rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(0,0,0,0.05);
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
    line-height: 1.1;
  }

  .subtitle {
    font-size: 0.65rem;
    color: #6b7280;
    margin: 0;
    line-height: 1.1;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .active-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #10b981;
    animation: pulse 2s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(1.1);
    }
  }

  .active-text {
    font-size: 0.75rem;
    color: #10b981;
    font-weight: 500;
  }

  /* Grid Container */
  .grid-container {
    width: 100%;
  }

  /* Month Labels Row */
  .month-labels-row {
    display: grid;
    grid-template-columns: repeat(52, 1fr);
    gap: 2px;
    margin-bottom: 0.125rem;
    padding-left: 2.5rem;
  }

  .month-label {
    font-size: 0.65rem;
    color: rgba(0,0,0,0.5);
    text-align: left;
    font-weight: 500;
    line-height: 1;
  }

  /* Grid Content Wrapper */
  .grid-content-wrapper {
    display: flex;
    gap: 0.5rem;
  }

  /* Day Labels Column */
  .day-labels-column {
    width: 2.5rem;
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    gap: 2px;
    font-size: 0.65rem;
    color: rgba(0,0,0,0.5);
    text-align: right;
    padding-right: 0.5rem;
    align-items: center;
  }

  .day-label {
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
  }

  /* Contributions Grid */
  .contributions-grid {
    flex: 1;
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(7, auto);
    gap: 2px;
    overflow-x: auto;
  }

  .contribution-day {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid rgba(0,0,0,0.08);
    transition: all 200ms ease;
    cursor: pointer;
  }

  /* Contribution Levels */
  .contribution-day.level-0 {
    background: #ebedf0;
  }

  .contribution-day.level-1 {
    background: #0e4429;
  }

  .contribution-day.level-2 {
    background: #006d32;
  }

  .contribution-day.level-3 {
    background: #26a641;
  }

  .contribution-day.level-4 {
    background: #39d353;
  }

  .contribution-day:hover {
    transform: scale(1.5);
    border-color: rgba(16, 185, 129, 0.5);
    box-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
    z-index: 10;
  }

  /* Legend */
  .legend {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.375rem;
    padding-top: 0.375rem;
    border-top: 1px solid rgba(0,0,0,0.05);
    justify-content: flex-end;
    font-size: 0.65rem;
    color: rgba(0,0,0,0.5);
  }

  .legend-label {
    margin: 0 0.25rem;
  }

  .legend-item {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    border: 1px solid rgba(0,0,0,0.08);
  }

  .legend-item.level-0 {
    background: #ebedf0;
  }

  .legend-item.level-1 {
    background: #0e4429;
  }

  .legend-item.level-2 {
    background: #006d32;
  }

  .legend-item.level-3 {
    background: #26a641;
  }

  .legend-item.level-4 {
    background: #39d353;
  }

  /* Loading Skeleton */
  .loading-skeleton {
    padding: 0.5rem 0;
  }

  .skeleton-grid {
    display: grid;
    grid-auto-flow: column;
    grid-template-rows: repeat(7, auto);
    gap: 2px;
    overflow-x: hidden;
  }

  .skeleton-day {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: rgba(0, 0, 0, 0.1);
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

  /* Error State */
  .error-state {
    text-align: center;
    padding: 2rem 1rem;
  }

  .error-message {
    color: #dc2626;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .error-hint {
    color: #6b7280;
    font-size: 0.75rem;
    margin-bottom: 1rem;
  }

  .debug-text {
    color: #6b7280;
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
    text-align: center;
  }

  .retry-button {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(16, 185, 129, 0.3);
    background: rgba(16, 185, 129, 0.1);
    color: #1f2937;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .retry-button:hover {
    background: rgba(16, 185, 129, 0.2);
    border-color: rgba(16, 185, 129, 0.5);
  }

  /* Tooltip */
  .tooltip {
    position: fixed;
    transform: translate(-50%, -100%);
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: white;
    border: 1px solid #e5e7eb;
    color: #1f2937;
    font-size: 0.8rem;
    pointer-events: none;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    white-space: nowrap;
  }

  .tooltip strong {
    display: block;
    margin-bottom: 0.25rem;
    color: #111827;
    font-weight: 600;
  }

  .tooltip-date {
    color: #6b7280;
    font-size: 0.75rem;
  }

  /* Responsive Breakpoints */
  @media (max-width: 640px) {
    .contributions-card {
      padding: 0.375rem 0.75rem;
    }

    .card-header {
      margin-bottom: 0.25rem;
    }

    .title {
      font-size: 0.75rem;
    }

    .subtitle {
      font-size: 0.6rem;
    }

    .contribution-day {
      width: 8px;
      height: 8px;
    }

    .contributions-grid {
      gap: 2px;
    }

    .month-labels-row {
      gap: 2px;
      padding-left: 2rem;
      margin-bottom: 0.1rem;
    }

    .month-label {
      font-size: 0.6rem;
    }

    .day-labels-column {
      width: 2rem;
      font-size: 0.6rem;
      gap: 2px;
    }

    .legend {
      margin-top: 0.25rem;
      padding-top: 0.25rem;
      font-size: 0.6rem;
    }

    .legend-item {
      width: 8px;
      height: 8px;
    }

    .skeleton-day {
      width: 8px;
      height: 8px;
    }

    .skeleton-grid {
      gap: 2px;
    }
  }

  @media (min-width: 1024px) {
    .contributions-card {
      padding: 0.375rem 1.25rem;
    }
  }
</style>
