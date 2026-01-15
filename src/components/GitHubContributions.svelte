<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchGitHubContributions } from './social/utils/api';
  import type { GitHubContributions } from './social/utils/types';

  let contributions = $state<GitHubContributions | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);

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
      console.log('[GitHubContributions] Load complete.');
    }
  }

  onMount(() => {
    loadContributions();
  });

  function getContributionColor(count: number): string {
    if (count === 0) return '#ebedf0';
    if (count <= 3) return '#0e4429';
    if (count <= 6) return '#006d32';
    if (count <= 9) return '#26a641';
    return '#39d353';
  }
</script>

<div
  style="background: #ffffff; border: 2px solid #e5e7eb; border-radius: 8px; padding: 20px; max-width: 1200px; width: 100%; margin: 0 auto; box-shadow: 0 1px 3px rgba(0,0,0,0.1); cursor: pointer;"
  onclick={() => window.open('https://github.com/Aadhavm10', '_blank', 'noopener')}
  role="button"
  tabindex="0"
>
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(0,0,0,0.05);">
    <div>
      <h3 style="font-size: 14px; font-weight: 600; color: #1f2937; margin: 0 0 4px 0;">GitHub Activity</h3>
      {#if contributions && !loading}
        <p style="font-size: 12px; color: #6b7280; margin: 0;">{contributions.totalContributions} contributions in the last year</p>
      {/if}
    </div>
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></div>
      <span style="font-size: 12px; color: #10b981; font-weight: 500;">Active</span>
    </div>
  </div>

  {#if loading}
    <div style="text-align: center; padding: 40px; color: #6b7280;">
      Loading GitHub contributions...
    </div>
  {:else if error}
    <div style="text-align: center; padding: 40px;">
      <p style="color: #dc2626; font-size: 14px; margin-bottom: 16px;">{error}</p>
      <button
        style="padding: 8px 16px; border-radius: 6px; border: 1px solid #10b981; background: rgba(16, 185, 129, 0.1); color: #1f2937; cursor: pointer;"
        onclick={(e) => { e.stopPropagation(); loadContributions(); }}
      >
        Retry
      </button>
    </div>
  {:else if contributions}
    <!-- Contributions Grid -->
    <div style="width: 100%; overflow-x: auto;">
      <!-- Simple grid - 7 rows of contribution days -->
      <div style="display: flex; gap: 2px; margin-bottom: 12px; min-width: fit-content;">
        {#each contributions.weeks as week}
          <div style="display: flex; flex-direction: column; gap: 2px; flex-shrink: 0;">
            {#each week.contributionDays as day}
              <div
                style="width: 11px; height: 11px; border-radius: 2px; background: {getContributionColor(day.contributionCount)}; border: 1px solid rgba(0,0,0,0.06);"
                title="{day.contributionCount} contributions on {day.date}"
              ></div>
            {/each}
          </div>
        {/each}
      </div>

      <!-- Legend -->
      <div style="display: flex; align-items: center; gap: 4px; justify-content: flex-end; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.05);">
        <span style="font-size: 11px; color: #6b7280; margin-right: 4px;">Less</span>
        <div style="width: 10px; height: 10px; border-radius: 2px; background: #ebedf0; border: 1px solid rgba(0,0,0,0.06);"></div>
        <div style="width: 10px; height: 10px; border-radius: 2px; background: #0e4429; border: 1px solid rgba(0,0,0,0.06);"></div>
        <div style="width: 10px; height: 10px; border-radius: 2px; background: #006d32; border: 1px solid rgba(0,0,0,0.06);"></div>
        <div style="width: 10px; height: 10px; border-radius: 2px; background: #26a641; border: 1px solid rgba(0,0,0,0.06);"></div>
        <div style="width: 10px; height: 10px; border-radius: 2px; background: #39d353; border: 1px solid rgba(0,0,0,0.06);"></div>
        <span style="font-size: 11px; color: #6b7280; margin-left: 4px;">More</span>
      </div>
    </div>
  {/if}
</div>
