<script lang="ts">
  import type { LinkedInHighlight } from './utils/types';

  let { data } = $props<{ data: LinkedInHighlight[] }>();

  const LINKEDIN_USERNAME = import.meta.env.PUBLIC_LINKEDIN_USERNAME || 'aadhav-';

  function getIconForType(type: string): string {
    switch(type) {
      case 'cert': return '🎓';
      case 'achievement': return '🏆';
      case 'post': return '📝';
      default: return '✨';
    }
  }
</script>

<div class="linkedin-preview">
  <div class="header">
    <h3>LinkedIn Profile</h3>
    <a
      href={`https://linkedin.com/in/${LINKEDIN_USERNAME}`}
      target="_blank"
      rel="noopener noreferrer"
      class="connect-btn"
    >
      Connect on LinkedIn
    </a>
  </div>

  <div class="highlights">
    {#each data as highlight}
      <a
        href={highlight.url}
        target="_blank"
        rel="noopener noreferrer"
        class="highlight-card"
      >
        <span class="icon">{getIconForType(highlight.type)}</span>
        <div class="content">
          <h4>{highlight.title}</h4>
          {#if highlight.description}
            <p>{highlight.description}</p>
          {/if}
          <span class="date">{highlight.date}</span>
        </div>
      </a>
    {/each}
  </div>

  <!-- LinkedIn Official Badge -->
  <div class="official-badge">
    <script src="https://platform.linkedin.com/badges/js/profile.js" async defer type="text/partytown"></script>
    <div
      class="badge-base LI-profile-badge"
      data-locale="en_US"
      data-size="medium"
      data-theme="dark"
      data-type="HORIZONTAL"
      data-vanity={LINKEDIN_USERNAME}
      data-version="v1"
    >
    </div>
  </div>
</div>

<style>
  .linkedin-preview {
    width: 100%;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .header h3 {
    margin: 0;
    font-size: 1.5rem;
    color: #0a66c2;
  }

  .connect-btn {
    padding: 0.5rem 1rem;
    background: #0a66c2;
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    transition: background 0.2s;
  }

  .connect-btn:hover {
    background: #084d8f;
  }

  .highlights {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .highlight-card {
    display: flex;
    gap: 1rem;
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    text-decoration: none;
    color: white;
    transition: all 0.2s;
  }

  .highlight-card:hover {
    background: rgba(10, 102, 194, 0.1);
    border-color: rgba(10, 102, 194, 0.5);
    transform: translateX(4px);
  }

  .icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .content h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
    color: white;
  }

  .content p {
    margin: 0 0 0.5rem 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .date {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .official-badge {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
</style>
