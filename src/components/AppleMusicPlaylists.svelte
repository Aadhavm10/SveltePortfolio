<script lang="ts">
  interface Playlist {
    id: string;
    title: string;
    description: string;
    embedUrl: string;
  }

  const playlists: Playlist[] = [
    {
      id: '1',
      title: '3dun',
      description: 'Tamil and Hindi songs',
      embedUrl: 'https://embed.music.apple.com/us/playlist/3dun/pl.u-oZyl3PYIGbKoVxE'
    },
    {
      id: '2',
      title: 'pretty girls make me nervous',
      description: 'My everything playlist',
      embedUrl: 'https://embed.music.apple.com/us/playlist/pretty-girls-make-me-nervous/pl.u-GgA5kZ6Co7mDM3q'
    },
    {
      id: '3',
      title: 'playlist laced with agony and despair',
      description: 'Name says it all',
      embedUrl: 'https://embed.music.apple.com/us/playlist/playlist-laced-with-agony-and-despair/pl.u-8aAVZybtvlYWk3R'
    },
    {
      id: '4',
      title: 'gong na',
      description: 'Hip-hop upbeat playlist',
      embedUrl: 'https://embed.music.apple.com/us/playlist/gong-na/pl.u-NpXmza3s4Y9NzeM'
    }
  ];
</script>

<div class="playlists-wrapper">
  <div class="playlist-grid">
    {#each playlists as playlist, idx}
      <article 
        class="playlist-card"
        role="region"
        aria-label="Playlist: {playlist.title}"
        style="--card-index: {idx};"
      >
        <div class="card-corner"></div>
        <div class="card-header">
          <div class="header-accent"></div>
          <div class="card-info">
            <h3 class="playlist-title">{playlist.title}</h3>
            <p class="playlist-description">{playlist.description}</p>
          </div>
        </div>
        <div class="card-player">
          <iframe
            src={playlist.embedUrl}
            height="450"
            frameborder="0"
            allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
            sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
            loading="lazy"
            title="Apple Music playlist: {playlist.title}"
            aria-label="Apple Music playlist: {playlist.title}"
          ></iframe>
        </div>
      </article>
    {/each}
  </div>
</div>

<style>
  /* CSS Variables */
  :root {
    --accent-orange: #ff6b35;
    --accent-orange-hover: #ff8254;
    --bg-black: #0a0a0a;
    --bg-card: #ffffff;
    --text-white: #0a0a0a;
    --text-gray: #666666;
    --border-color: rgba(0, 0, 0, 0.1);
  }

  .playlists-wrapper {
    width: 100%;
  }

  .playlist-grid {
    display: flex;
    flex-direction: column;
    gap: 60px;
  }

  .playlist-card {
    background: var(--bg-card);
    border: 2px solid var(--border-color);
    position: relative;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    animation: cardFadeIn 0.8s ease-out forwards;
    animation-delay: calc(var(--card-index) * 0.15s);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  }

  @keyframes cardFadeIn {
    from {
      opacity: 0;
      transform: translateY(40px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .playlist-card:hover {
    border-color: var(--accent-orange);
    transform: translateY(-4px);
    box-shadow: 0 12px 40px rgba(255, 107, 53, 0.2);
  }

  .card-corner {
    position: absolute;
    top: -3px;
    right: -3px;
    width: 40px;
    height: 40px;
    background: var(--accent-orange);
    clip-path: polygon(100% 0, 0 0, 100% 100%);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .playlist-card:hover .card-corner {
    opacity: 1;
  }

  .card-header {
    padding: 32px 32px 24px;
    position: relative;
  }

  .header-accent {
    position: absolute;
    left: 0;
    top: 0;
    width: 6px;
    height: 100%;
    background: var(--accent-orange);
    transform: scaleY(0);
    transform-origin: top;
    transition: transform 0.4s ease;
  }

  .playlist-card:hover .header-accent {
    transform: scaleY(1);
  }

  .card-info {
    position: relative;
  }

  .playlist-title {
    font-size: 24px;
    font-weight: 800;
    color: var(--text-white);
    margin: 0 0 8px 0;
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .playlist-description {
    font-size: 16px;
    color: var(--text-gray);
    margin: 0;
    line-height: 1.5;
  }

  .card-player {
    padding: 0 32px 32px;
  }

  .card-player iframe {
    width: 100%;
    height: 450px;
    border: none;
    border-radius: 0;
    background: rgba(0, 0, 0, 0.3);
    transition: transform 0.3s ease;
  }

  .playlist-card:hover .card-player iframe {
    transform: scale(1.02);
  }

  @media (max-width: 767px) {
    .playlist-grid {
      gap: 32px;
    }

    .card-header {
      padding: 24px 24px 16px;
    }

    .card-player {
      padding: 0 24px 24px;
    }

    .playlist-title {
      font-size: 20px;
    }

    .playlist-description {
      font-size: 14px;
    }

    .card-player iframe {
      height: 400px;
    }
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .playlist-card {
      animation: none;
      opacity: 1;
      transform: none;
    }

    .playlist-card:hover,
    .card-player iframe {
      transform: none;
    }
  }
</style>
