<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  // Card data
  const techStackCards = [
    { id: 2, img: "/aboutImages/HASA.JPG" },
    { id: 3, img: "/aboutImages/Soccer.JPG" },
    { id: 4, img: "/aboutImages/IMG_3158.JPG" },
    { id: 5, img: "/aboutImages/NAV05745.JPG" },
    { id: 1, img: "/aboutImages/IMG_4152.JPG" }
  ];

  let cards = [...techStackCards];
  let draggedCard: { id: number; img: string } | null = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let isDragging = false;

  // Decrypted text state
  let displayText = '';
  let isTextComplete = false;
  const targetText = "Computer Science Student at the University of Texas at Dallas";
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';

  onMount(() => {
    // Decrypted text animation
    let iteration = 0;
    const interval = setInterval(() => {
      displayText = targetText
        .split('')
        .map((char, index) => {
          if (char === ' ') return ' ';
          if (index < iteration) return targetText[index];
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join('');

      if (iteration >= targetText.length) {
        isTextComplete = true;
        clearInterval(interval);
      }

      iteration += 1;
    }, 15);

    return () => clearInterval(interval);
  });

  function handleMouseDown(e: MouseEvent, card: { id: number; img: string }) {
    const topCard = cards[cards.length - 1];
    if (card.id !== topCard.id) return;

    isDragging = true;
    draggedCard = card;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragOffsetX = 0;
    dragOffsetY = 0;
  }

  function handleTouchStart(e: TouchEvent, card: { id: number; img: string }) {
    const topCard = cards[cards.length - 1];
    if (card.id !== topCard.id) return;

    isDragging = true;
    draggedCard = card;
    const touch = e.touches[0];
    dragStartX = touch.clientX;
    dragStartY = touch.clientY;
    dragOffsetX = 0;
    dragOffsetY = 0;
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging || !draggedCard) return;

    dragOffsetX = e.clientX - dragStartX;
    dragOffsetY = e.clientY - dragStartY;
  }

  function handleTouchMove(e: TouchEvent) {
    if (!isDragging || !draggedCard) return;

    const touch = e.touches[0];
    dragOffsetX = touch.clientX - dragStartX;
    dragOffsetY = touch.clientY - dragStartY;
  }

  function handleMouseUp() {
    if (!isDragging || !draggedCard) return;

    const dragDistance = Math.sqrt(dragOffsetX ** 2 + dragOffsetY ** 2);

    if (dragDistance > 60) {
      sendToBack(draggedCard.id);
    }

    isDragging = false;
    draggedCard = null;
    dragOffsetX = 0;
    dragOffsetY = 0;
  }

  function handleTouchEnd() {
    handleMouseUp();
  }

  function sendToBack(id: number) {
    const index = cards.findIndex((card) => card.id === id);
    if (index !== -1) {
      const newCards = [...cards];
      const [card] = newCards.splice(index, 1);
      newCards.unshift(card);
      cards = newCards;
    }
  }

  let hoveredCard: number | null = null;

  function getCardStyle(card: { id: number; img: string }, index: number) {
    const isTopCard = index === cards.length - 1;
    const isDraggedCard = draggedCard?.id === card.id && isDragging;

    const baseRotate = (cards.length - index - 1) * 4;
    const baseScale = 1 + index * 0.06 - cards.length * 0.06;

    if (isDraggedCard) {
      const rotateY = (dragOffsetX / 100) * -20;
      const rotateX = (dragOffsetY / 100) * 20;

      return `
        transform:
          translate(${dragOffsetX}px, ${dragOffsetY}px)
          rotateZ(${baseRotate + (dragOffsetX / 20)}deg)
          rotateX(${rotateX}deg)
          rotateY(${rotateY}deg)
          scale(1.15);
        transform-origin: 50% 50%;
        transition: none;
        z-index: 1000;
        cursor: grabbing;
      `;
    }

    return `
      transform:
        rotateZ(${baseRotate}deg)
        scale(${baseScale});
      transform-origin: 90% 90%;
      transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
      cursor: ${isTopCard ? 'grab' : 'default'};
      pointer-events: ${isTopCard ? 'auto' : 'none'};
    `;
  }

  function getCurrentCardNumber(): number {
    const topCard = cards[cards.length - 1];
    return techStackCards.findIndex(c => c.id === topCard.id) + 1;
  }
</script>

<svelte:window
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
  on:touchmove={handleTouchMove}
  on:touchend={handleTouchEnd}
/>

<div class="hero-content">
  <!-- Title -->
  <div class="title-section" in:fly={{ y: -30, duration: 800, delay: 500 }}>
    <span class="title-text">
      Aadhav
      <span class="title-gradient">Manimurugan</span>
    </span>
  </div>

  <div class="content-wrapper">
    <div class="content-left">
      <!-- About me -->
      <div class="about-cards" in:fly={{ x: -50, duration: 800, delay: 700 }}>
        <h3 class="about-heading">About me</h3>
        <div class="info-card">
          <p class="card-text">
            Full-Stack Developer and Machine Learning Engineer based in Dallas, Texas. I love solving problems through code and creating software that people actually use.
          </p>
          <p class="card-text">
            Currently studying Computer Science at the University of Texas at Dallas, where I'm exploring everything from web development to AI. I'm passionate about building tools that make a real impact and learning new technologies along the way.
          </p>
          <p class="card-text">
            Outside of tech, I enjoy playing soccer and basketball, watching movies, listening to music, and spending time with friends. I'm always looking for the next challenge, whether it's on the field or in front of a screen.
          </p>
        </div>
      </div>
    </div>

    <!-- Card Stack -->
    <div class="content-right" in:fly={{ x: 50, duration: 800, delay: 800 }}>
      <div class="stack-container">
      {#each cards as card, index (card.id)}
        <div
          class="card-wrapper"
          class:is-top={index === cards.length - 1}
          class:is-dragging={draggedCard?.id === card.id && isDragging}
          style={getCardStyle(card, index)}
          on:mousedown={(e) => handleMouseDown(e, card)}
          on:touchstart={(e) => handleTouchStart(e, card)}
          on:mouseenter={() => hoveredCard = card.id}
          on:mouseleave={() => hoveredCard = null}
          role="button"
          tabindex={index === cards.length - 1 ? 0 : -1}
        >
          <div class="card" class:hovered={hoveredCard === card.id && index === cards.length - 1}>
            <div class="card-shine"></div>
            <img
              src={card.img}
              alt={`Photo ${index + 1}`}
              class="card-image"
              draggable="false"
              on:error={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = `https://via.placeholder.com/350x350/1e293b/ffffff?text=Image+${card.id}`;
              }}
            />
          </div>
        </div>
      {/each}
    </div>
    <p class="drag-hint">Drag or swipe to explore</p>
    </div>
  </div>
</div>

<style>
  .hero-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0 1rem;
    margin-top: 2rem;
    width: 100%;
    position: relative;
    z-index: 10;
    gap: 2rem;
  }

  @media (min-width: 1024px) {
    .hero-content {
      padding: 0 5rem;
      margin-top: 4rem;
      gap: 3rem;
    }
  }

  .content-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    gap: 2rem;
  }

  @media (min-width: 1024px) {
    .content-wrapper {
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      gap: 1rem;
    }
  }

  .content-left {
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: auto;
    text-align: center;
    order: 2;
  }

  @media (min-width: 640px) {
    .content-left {
      gap: 1.25rem;
    }
  }

  @media (min-width: 1024px) {
    .content-left {
      order: 1;
      text-align: left;
      margin: 0;
      margin-left: auto;
      margin-right: 0;
    }
  }

  .title-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 0.75rem;
    margin-bottom: 2rem;
    font-size: 1.875rem;
    font-weight: 700;
    color: white;
    width: 100%;
  }

  @media (min-width: 640px) {
    .title-section {
      gap: 1.5rem;
      margin-bottom: 2.5rem;
      font-size: 2.25rem;
    }
  }

  @media (min-width: 768px) {
    .title-section {
      font-size: 3rem;
    }
  }

  @media (min-width: 1024px) {
    .title-section {
      font-size: 3.75rem;
    }
  }

  .title-text {
    display: block;
  }

  .title-gradient {
    background: linear-gradient(to right, #a855f7, #06b6d4);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }


  .about-cards {
    max-width: 600px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .about-heading {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: rgba(196, 181, 253, 0.8);
    margin-bottom: 1rem;
  }

  @media (min-width: 640px) {
    .about-heading {
      font-size: 0.875rem;
    }
  }

  .info-card {
    border-radius: 0.75rem;
    border: 1px solid rgba(167, 139, 250, 0.2);
    background: linear-gradient(to bottom right, rgba(139, 92, 246, 0.05), rgba(6, 182, 212, 0.05));
    backdrop-filter: blur(4px);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: all 300ms;
    cursor: pointer;
  }

  .info-card:hover {
    border-color: rgba(167, 139, 250, 0.4);
    background: linear-gradient(to bottom right, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1));
  }


  .card-text {
    font-size: 0.875rem;
    color: #d1d5db;
    line-height: 1.6;
    transition: color 300ms;
    margin-bottom: 1rem;
  }

  .card-text:last-child {
    margin-bottom: 0;
  }

  .info-card:hover .card-text {
    color: #e5e7eb;
  }

  .content-right {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    order: 1;
    margin-bottom: 2rem;
    gap: 1rem;
  }

  @media (min-width: 1024px) {
    .content-right {
      order: 2;
      margin-bottom: 0;
    }
  }

  .stack-container {
    position: relative;
    width: 408px;
    height: 408px;
    perspective: 600px;
  }

  .card-wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
    filter: blur(0px);
    transition: filter 0.3s ease;
  }

  .card-wrapper:not(.is-top) {
    filter: blur(1px);
  }

  .card-wrapper.is-dragging {
    filter: blur(0px) drop-shadow(0 35px 60px rgba(0, 0, 0, 0.7));
  }

  .card {
    width: 350px;
    height: 350px;
    border-radius: 16px;
    /* Polaroid-style border with thicker bottom */
    border: 8px solid white;
    border-bottom-width: 32px;
    overflow: hidden;
    position: relative;
    /* Enhanced layered shadows for depth */
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      0 4px 8px rgba(0, 0, 0, 0.15),
      0 8px 16px rgba(0, 0, 0, 0.2),
      0 16px 32px rgba(0, 0, 0, 0.25),
      0 32px 64px rgba(0, 0, 0, 0.3),
      inset 0 0 0 1px rgba(255, 255, 255, 0.1);
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    background: white;
  }

  .card.hovered {
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.1),
      0 4px 8px rgba(0, 0, 0, 0.15),
      0 8px 16px rgba(0, 0, 0, 0.2),
      0 16px 32px rgba(0, 0, 0, 0.25),
      0 32px 64px rgba(0, 0, 0, 0.3),
      0 0 0 2px rgba(139, 92, 246, 0.4),
      0 0 40px rgba(139, 92, 246, 0.3),
      inset 0 0 0 1px rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.95);
  }

  .card-shine {
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      transparent 0%,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.3) 50%,
      rgba(255, 255, 255, 0.1) 75%,
      transparent 100%
    );
    pointer-events: none;
    z-index: 10;
    transition: left 0.6s ease;
  }

  .card.hovered .card-shine {
    left: 100%;
  }

  .card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
    display: block;
  }

  .drag-hint {
    font-size: 0.75rem;
    color: rgba(156, 163, 175, 0.8);
    letter-spacing: 0.05em;
  }

  @media (min-width: 640px) {
    .drag-hint {
      font-size: 0.875rem;
    }
  }
</style>
