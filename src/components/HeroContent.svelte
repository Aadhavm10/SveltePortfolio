<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import RotatingText from './RotatingText.svelte';
  import { profileObstacle } from '../stores/profileStore';

  export let title: string = 'Aadhav Manimurugan';
  export let rotatingTexts: string[] = [
    'Software Engineer.',
    'Full Stack Developer.',
    'Student.',
    'Athlete.',
    'Gamer.',
    'Traveller.',

  ];

  let profileImageElement: HTMLImageElement;
  let resizeObserver: ResizeObserver;

  function updateProfilePosition() {
    if (!profileImageElement) return;

    const rect = profileImageElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;

    // Convert screen coordinates to normalized coordinates (-1 to 1)
    // We'll do the full conversion to world space in the Ballpit component
    profileObstacle.set({
      x: 0, // Will be calculated in Ballpit
      y: 0, // Will be calculated in Ballpit
      radius: 0, // Will be calculated in Ballpit
      screenX: centerX,
      screenY: centerY,
      screenRadius: radius
    });
  }

  onMount(() => {
    if (profileImageElement) {
      // Initial position
      updateProfilePosition();

      // Watch for resize
      resizeObserver = new ResizeObserver(updateProfilePosition);
      resizeObserver.observe(profileImageElement);

      // Watch for window resize
      window.addEventListener('resize', updateProfilePosition);
      window.addEventListener('scroll', updateProfilePosition);
    }
  });

  onDestroy(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', updateProfilePosition);
      window.removeEventListener('scroll', updateProfilePosition);
    }
    profileObstacle.set(null);
  });
</script>

<div class="content">
  <div class="profile-image-container">
    <img bind:this={profileImageElement} src="/lanyard/lanyard.png" alt="Aadhav Manimurugan" class="profile-image" />
  </div>
  <h1 class="title">{title}</h1>
  <div class="rotating-container">
    <span class="rotating-prefix">I am a</span>
    <RotatingText
      texts={rotatingTexts}
      className="rotating-text-display"
      rotationInterval={2500}
      staggerDuration={25}
      staggerFrom="last"
    />
  </div>
</div>

<style>
  .content {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem;
    text-align: center;
    pointer-events: none;
  }

  .profile-image-container {
    margin-bottom: 2rem;
    pointer-events: auto;
  }

  .profile-image {
    width: 200px;
    height: 200px;
    border-radius: 50%;
    object-fit: cover;
    border: 4px solid rgba(139, 92, 246, 0.6);
    box-shadow:
      0 10px 40px rgba(0, 0, 0, 0.3),
      0 0 0 8px rgba(139, 92, 246, 0.1);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }

  .profile-image:hover {
    transform: scale(1.05);
    box-shadow:
      0 15px 50px rgba(0, 0, 0, 0.4),
      0 0 0 8px rgba(139, 92, 246, 0.2);
  }

  .title {
    font-size: clamp(3rem, 8vw, 6rem);
    font-weight: 900;
    color: white;
    text-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    margin-bottom: 1.5rem;
    line-height: 1.1;
  }

  .rotating-container {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    font-weight: 700;
    color: white;
    text-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
    flex-wrap: nowrap;
  }

  .rotating-prefix {
    color: rgba(255, 255, 255, 0.95);
  }

  :global(.rotating-text-display) {
    display: inline-block;
    padding: 0.25rem 1rem;
    background: rgba(139, 92, 246, 0.4);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(167, 139, 250, 0.5);
    position: relative;
  }

  @media (max-width: 768px) {
    .content {
      padding: 1rem;
    }

    .profile-image {
      width: 150px;
      height: 150px;
    }
  }
</style>
