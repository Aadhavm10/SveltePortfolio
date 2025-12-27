<script lang="ts">
  import type { GitHubData } from './utils/types';

  let { data } = $props<{ data: GitHubData }>();
</script>

<div class="github-preview">
  <!-- Profile Header -->
  <div class="profile-header">
    <img src={data.profile.avatar_url} alt={data.profile.name} class="avatar" />
    <div class="profile-info">
      <h3>{data.profile.name || data.profile.login}</h3>
      <p class="bio">{data.profile.bio || 'No bio available'}</p>
      <div class="stats">
        <span>{data.profile.followers} followers</span>
        <span>·</span>
        <span>{data.profile.public_repos} repos</span>
      </div>
    </div>
  </div>

  <!-- Recent Repos -->
  <div class="repos-section">
    <h4>Recent Repositories</h4>
    <div class="repos-grid">
      {#each data.repos.slice(0, 6) as repo}
        <a
          href={repo.html_url}
          target="_blank"
          rel="noopener noreferrer"
          class="repo-card"
        >
          <div class="repo-header">
            <span class="repo-name">{repo.name}</span>
            <div class="repo-stats">
              <span>⭐ {repo.stargazers_count}</span>
              {#if repo.forks_count > 0}
                <span>🔀 {repo.forks_count}</span>
              {/if}
            </div>
          </div>
          {#if repo.description}
            <p class="repo-desc">{repo.description}</p>
          {/if}
          {#if repo.language}
            <span class="language">{repo.language}</span>
          {/if}
        </a>
      {/each}
    </div>
  </div>

  <!-- View Full Profile Link -->
  <a
    href={data.profile.html_url}
    target="_blank"
    rel="noopener noreferrer"
    class="view-profile-btn"
  >
    View Full GitHub Profile →
  </a>
</div>

<style>
  .github-preview {
    width: 100%;
  }

  .profile-header {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    border: 2px solid rgba(168, 85, 247, 0.3);
  }

  .profile-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: white;
  }

  .bio {
    margin: 0 0 0.5rem 0;
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
  }

  .stats {
    display: flex;
    gap: 0.5rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .repos-section h4 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: rgba(255, 255, 255, 0.9);
  }

  .repos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .repo-card {
    padding: 1rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    text-decoration: none;
    color: white;
    transition: all 0.2s;
  }

  .repo-card:hover {
    background: rgba(168, 85, 247, 0.1);
    border-color: rgba(168, 85, 247, 0.5);
    transform: translateY(-2px);
  }

  .repo-header {
    display: flex;
    justify-content: space-between;
    align-items: start;
    margin-bottom: 0.5rem;
  }

  .repo-name {
    font-weight: 600;
    font-size: 0.95rem;
  }

  .repo-stats {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
  }

  .repo-desc {
    margin: 0.5rem 0;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.7);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .language {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    background: rgba(6, 182, 212, 0.2);
    border-radius: 4px;
    font-size: 0.75rem;
    color: #06b6d4;
  }

  .view-profile-btn {
    display: block;
    width: 100%;
    padding: 0.75rem;
    text-align: center;
    background: linear-gradient(to right, #a855f7, #06b6d4);
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-weight: 600;
    transition: opacity 0.2s;
  }

  .view-profile-btn:hover {
    opacity: 0.9;
  }
</style>
