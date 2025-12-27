<script lang="ts">
  import type { InstagramData } from './utils/types';

  let { data } = $props<{ data: InstagramData }>();

  const INSTAGRAM_USERNAME = import.meta.env.PUBLIC_INSTAGRAM_USERNAME;
</script>

<div class="instagram-preview">
  <div class="header">
    <h3>@{INSTAGRAM_USERNAME}</h3>
    <a
      href={`https://instagram.com/${INSTAGRAM_USERNAME}`}
      target="_blank"
      rel="noopener noreferrer"
      class="follow-btn"
    >
      Follow on Instagram
    </a>
  </div>

  <div class="photos-grid">
    {#each data.data.slice(0, 9) as media}
      <a
        href={media.permalink}
        target="_blank"
        rel="noopener noreferrer"
        class="photo-item"
      >
        <img
          src={media.media_type === 'VIDEO' ? (media.thumbnail_url || media.media_url) : media.media_url}
          alt={media.caption?.substring(0, 50) || 'Instagram post'}
          loading="lazy"
        />
        {#if media.media_type === 'VIDEO'}
          <span class="video-badge">▶</span>
        {/if}
        {#if media.media_type === 'CAROUSEL_ALBUM'}
          <span class="carousel-badge">⊞</span>
        {/if}
      </a>
    {/each}
  </div>
</div>

<style>
  .instagram-preview {
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
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .follow-btn {
    padding: 0.5rem 1rem;
    background: linear-gradient(45deg, #f09433, #e6683c, #dc2743);
    border-radius: 8px;
    text-decoration: none;
    color: white;
    font-weight: 600;
    font-size: 0.9rem;
    transition: opacity 0.2s;
  }

  .follow-btn:hover {
    opacity: 0.9;
  }

  .photos-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.5rem;
  }

  .photo-item {
    position: relative;
    aspect-ratio: 1;
    overflow: hidden;
    border-radius: 8px;
    cursor: pointer;
  }

  .photo-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s;
  }

  .photo-item:hover img {
    transform: scale(1.05);
  }

  .video-badge,
  .carousel-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }
</style>
