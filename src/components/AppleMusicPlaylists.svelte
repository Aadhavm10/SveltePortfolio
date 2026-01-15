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
  <div class="header">
    <h3 class="title">Music Playlists</h3>
  </div>

  <div class="playlists-grid">
    {#each playlists as playlist, index}
      <div class="playlist-card">
        <div class="playlist-info">
          <h4 class="playlist-title">{playlist.title}</h4>
          <p class="playlist-description">{playlist.description}</p>
        </div>
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
    {/each}
  </div>
</div>

<style>
  .playlists-wrapper {
    width: 100%;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .title {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
  }

  .playlists-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  @media (min-width: 768px) {
    .playlists-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 2rem;
    }
  }

  @media (min-width: 1024px) {
    .playlists-grid {
      grid-template-columns: repeat(2, 1fr);
      gap: 2.5rem;
    }
  }

  .playlist-card {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .playlist-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .playlist-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
    line-height: 1.4;
  }

  .playlist-description {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.6);
    margin: 0;
    font-style: italic;
    line-height: 1.3;
  }

  .playlist-card iframe {
    width: 100%;
    height: 450px;
    border: none;
    border-radius: 0.5rem;
    background: rgba(0, 0, 0, 0.2);
  }

  @media (max-width: 640px) {
    .title {
      font-size: 0.875rem;
    }

    .playlists-grid {
      gap: 1.5rem;
    }
  }
</style>
