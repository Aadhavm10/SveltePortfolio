<script lang="ts">
  import { onMount } from 'svelte';
  import { Motion } from 'svelte-motion';
  import GitHubContributions from './GitHubContributions.svelte';
  import AppleMusicPlaylists from './AppleMusicPlaylists.svelte';

  const backgroundImages = [
    "/aboutImages/HASA.JPG",
    "/aboutImages/Soccer.JPG",
    "/aboutImages/IMG_3158.JPG",
    "/aboutImages/NAV05745.JPG",
    "/aboutImages/IMG_4152.JPG"
  ];

  // Animation visibility states
  let visibleSections = new Set<string>();
  
  function isVisible(section: string): boolean {
    return visibleSections.has(section);
  }

  // Card stack with all 5 images
  let stack = backgroundImages.map((src, index) => ({
    id: index,
    src
  }));

  function sendToBack(id: number) {
    const index = stack.findIndex(card => card.id === id);
    if (index !== -1) {
      const newStack = [...stack];
      const [card] = newStack.splice(index, 1);
      newStack.unshift(card);
      stack = newStack;
    }
  }

  onMount(() => {
    // Make hero visible immediately
    visibleSections.add('hero');
    visibleSections = visibleSections;

    // Enhanced scroll-triggered animations
    const observerOptions = {
      root: null,
      rootMargin: '0px 0px -100px 0px',
      threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-animate-id');
          if (id) {
            visibleSections.add(id);
            visibleSections = visibleSections; // trigger reactivity
          }
        }
      });
    }, observerOptions);

    // Observe all animated sections
    setTimeout(() => {
      document.querySelectorAll('[data-animate-id]').forEach((el) => {
        observer.observe(el);
      });
    }, 100);

    return () => observer.disconnect();
  });

</script>

<div class="semplice-container">
  <!-- Decorative Top Bar -->
  <div class="decorative-bar"></div>

  <!-- Hero Section -->
  <section class="hero-section animate-section" data-animate-id="hero" class:visible={isVisible('hero')}>
    <h1 class="hero-title">
      <span class="hero-line">AADHAV</span>
      <span class="hero-line hero-line-accent">MANIMURUGAN</span>
    </h1>
    <p class="hero-subtitle">Computer Science Student at University of Texas at Dallas</p>
  </section>

  <!-- Bio & Card Stack -->
  <section class="bio-grid animate-section" data-animate-id="bio" class:visible={isVisible('bio')}>
    <div class="bio-main">
      <h2 class="section-title">About Me→</h2>
      <div class="bio-content">
        <p class="bio-paragraph">
          I'm a <strong>Computer Science student at UT Dallas</strong> who believes the best technology disappears into great experiences. My approach is simple: understand deeply, build iteratively, and never stop learning. Whether I'm designing full-stack applications or training machine learning models, I'm obsessed with the details that make something feel effortless to use.
        </p>
        <p class="bio-paragraph">
          I thrive in <strong>collaborative environments</strong> where ideas flow freely and diverse perspectives push solutions further. When I'm not coding, you'll find me on the soccer field, watching films, or discovering new music. I'm looking for opportunities where I can contribute meaningfully and build things that actually improve people's lives.
        </p>
      </div>
    </div>
    
    <div class="card-stack-container">
      <div class="card-stack">
        {#each stack as card, index (card.id)}
          <Motion
            let:motion
            animate={{
              rotateZ: (stack.length - index - 1) * 4,
              scale: 1 + index * 0.06 - stack.length * 0.06,
              transformOrigin: '90% 90%'
            }}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20
            }}
          >
            <div 
              class="stack-card-wrapper"
              use:motion
            >
              <Motion
                let:motion
                drag={true}
                dragConstraints={{ top: 0, right: 0, bottom: 0, left: 0 }}
                dragElastic={0.8}
                on:dragEnd={(e) => {
                  const { offset } = e.detail;
                  // Calculate total distance dragged (works for any angle)
                  const distance = Math.sqrt(offset.x ** 2 + offset.y ** 2);
                  if (distance > 40) {
                    sendToBack(card.id);
                  }
                }}
              >
                <div 
                  class="stack-card"
                  use:motion
                  on:click={() => sendToBack(card.id)}
                >
                  <img src={card.src} alt="Photo {index + 1}" loading={index === stack.length - 1 ? 'eager' : 'lazy'} draggable="false" />
                </div>
              </Motion>
            </div>
          </Motion>
        {/each}
      </div>
      <p class="card-stack-hint">
        <span class="hint-icon">↻</span> Drag or click to explore more photos
      </p>
    </div>
  </section>

  <!-- GitHub Section with Browser Mockup -->
  <section class="github-section animate-section" data-animate-id="github" class:visible={isVisible('github')}>
    <h2 class="section-title">What I'm Building→</h2>
    <p class="section-intro">
      Here's what I've been working on lately.
    </p>
    
    <div class="browser-mockup">
      <div class="browser-header">
        <div class="browser-dots">
          <span class="dot red"></span>
          <span class="dot yellow"></span>
          <span class="dot green"></span>
        </div>
        <div class="browser-title">GitHub Activity</div>
        <div class="browser-spacer"></div>
      </div>
      <div class="browser-content">
        <GitHubContributions />
      </div>
    </div>
  </section>

  <!-- More About Me Section -->
  <section class="more-about-section">
    <div class="more-about-inner">
      <div class="left-column">
        <div class="sticky-text">
          <h2 class="mega-title">More<br/>about me→</h2>
        </div>
      </div>
      
      <div class="right-column">
        <div class="question-block">
          <h3 class="q-title">How to say your name?</h3>
          <p class="q-answer">Aadhav Manimurugan.</p>
          <p class="q-answer">Ahh-dhuv   Mah-nee-moo-roo-gun.</p>
        </div>

        <div class="question-block">
          <h3 class="q-title">What are your current goals?</h3>
          <p class="q-answer">Currently, I am looking for an internship for Summer 2026, as well as looking to graduate in December 2026.</p>
        </div>

        <div class="question-block">
          <h3 class="q-title">How many years of experience do you have?</h3>
          <p class="q-answer">I have 3 years of experience in coding, and 1 year of experience in machine learning. Prevously have held a Machine Learning Researcher position aswell as a Software Engineering Intern position.</p>
        </div>

        <div class="question-block">
          <h3 class="q-title">What are your main areas of focus?</h3>
          <p class="q-answer">Full-Stack Development and Machine Learning. I love building applications that combine  front-end design with powerful ML models on the backend.</p>
        </div>

        <div class="question-block">
          <h3 class="q-title">Where are you based?</h3>
          <p class="q-answer">Currently, in Dallas, Texas but looking for oppurtunites anywhere!.</p>
        </div>

        <div class="question-block">
          <h3 class="q-title">How do you approach your work?</h3>
          <p class="q-answer">I'm obsessed with the details and thrive in collaborative environments. I believe the best solutions come from understanding the problem deeply, iterating quickly, and learning from every mistake.</p>
        </div>

        <div class="question-block">
          <h3 class="q-title">What about awards or press you've received?</h3>
          <p class="q-answer">I have recieved a Presidentials Volunteer Service Award, as well as multiple Intramural Championships for multiple sports.</p>
      </div>
    </div>
  </section>

  <!-- Music Section -->
  <section class="music-section animate-section" data-animate-id="music" class:visible={isVisible('music')}>
    <div class="music-inner">
      <div class="music-header">
        <h2 class="music-title">My different<br/>Playlists→</h2>
      </div>
      
      <div class="playlists-staggered">
        <!-- Playlist 1: Text Left, Player Right -->
        <div class="playlist-row row-left">
          <div class="playlist-text">
            <h3 class="playlist-name">pretty girls make me nervous</h3>
            <p class="playlist-desc">My everything playlist.</p>
          </div>
          <div class="playlist-player">
            <iframe
              src="https://embed.music.apple.com/us/playlist/pretty-girls-make-me-nervous/pl.u-GgA5kZ6Co7mDM3q"
              height="450"
              frameborder="0"
              allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
              loading="lazy"
              title="Apple Music playlist: pretty girls make me nervous"
            ></iframe>
          </div>
        </div>

        <!-- Playlist 2: Player Left, Text Right -->
        <div class="playlist-row row-right">
          <div class="playlist-player">
            <iframe
              src="https://embed.music.apple.com/us/playlist/playlist-laced-with-agony-and-despair/pl.u-8aAVZybtvlYWk3R"
              height="450"
              frameborder="0"
              allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
              loading="lazy"
              title="Apple Music playlist: playlist laced with agony and despair"
            ></iframe>
          </div>
          <div class="playlist-text">
            <h3 class="playlist-name">playlist laced with agony and despair</h3>
            <p class="playlist-desc">Name says it all</p>
          </div>
        </div>

        <!-- Playlist 3: Text Left, Player Right -->
        <div class="playlist-row row-left">
          <div class="playlist-text">
            <h3 class="playlist-name">gong na</h3>
            <p class="playlist-desc">Harder music, more energy.</p>
          </div>
          <div class="playlist-player">
            <iframe
              src="https://embed.music.apple.com/us/playlist/gong-na/pl.u-NpXmza3s4Y9NzeM"
              height="450"
              frameborder="0"
              allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
              loading="lazy"
              title="Apple Music playlist: gong na"
            ></iframe>
          </div>
        </div>

        <!-- Playlist 4: Player Left, Text Right -->
        <div class="playlist-row row-right">
          <div class="playlist-player">
            <iframe
              src="https://embed.music.apple.com/us/playlist/3dun/pl.u-oZyl3PYIGbKoVxE"
              height="450"
              frameborder="0"
              allow="autoplay *; encrypted-media *; fullscreen *; clipboard-write"
              sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
              loading="lazy"
              title="Apple Music playlist: 3dun"
            ></iframe>
          </div>
          <div class="playlist-text">
            <h3 class="playlist-name">3dun</h3>
            <p class="playlist-desc">Tamil and Hindi songs.</p>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Terminal Footer -->
  <section class="terminal-footer animate-section" data-animate-id="terminal" class:visible={isVisible('terminal')}>
    <div class="terminal-window">
      <div class="terminal-header">
        <div class="window-controls">
          <span class="control close"></span>
          <span class="control minimize"></span>
          <span class="control maximize"></span>
        </div>
        <div class="terminal-title">aadhav@portfolio: ~/connect</div>
      </div>
      <div class="terminal-body">
        <pre class="ascii-art">
   ___   __  __ 
  / _ | /  |/  /
 / __ |/ /|_/ / 
/_/ |_/_/  /_/  
                </pre>
        <div class="terminal-output">
          <p class="prompt-line">$ whoami</p>
          <p class="output-line">Aadhav Manimurugan</p>
          <p class="prompt-line">$ ls ./contact</p>
          <p class="output-line">Available connection methods:</p>
          <div class="terminal-links">
            <a href="mailto:aadhavmanimurugan@gmail.com" class="terminal-command" target="_blank" rel="noopener noreferrer">
              <span class="prompt">$</span> <span class="command-text">contact --email</span>
              <span class="command-desc">aadhavmanimurugan@gmail.com</span>
            </a>
            <a href="https://github.com/Aadhavm10" class="terminal-command" target="_blank" rel="noopener noreferrer">
              <span class="prompt">$</span> <span class="command-text">open --github</span>
              <span class="command-desc">@Aadhavm10</span>
            </a>
            <a href="https://www.linkedin.com/in/aadhav-/" class="terminal-command" target="_blank" rel="noopener noreferrer">
              <span class="prompt">$</span> <span class="command-text">connect --linkedin</span>
              <span class="command-desc">/in/aadhav-</span>
            </a>
            <a href="https://www.instagram.com/aadhav_04/" class="terminal-command" target="_blank" rel="noopener noreferrer">
              <span class="prompt">$</span> <span class="command-text">follow --instagram</span>
              <span class="command-desc">@aadhav_04</span>
            </a>
          </div>
          <p class="prompt-line cursor-line">$ <span class="blinking-cursor">_</span></p>
        </div>
      </div>
    </div>
  </section>

  <!-- Footer Tear Effect -->
  <div class="footer-tear">
    <svg viewBox="0 0 1200 60" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <path d="M0,30 Q150,10 300,30 T600,30 T900,30 T1200,30 L1200,60 L0,60 Z" fill="var(--accent-orange)" opacity="0.1"/>
    </svg>
  </div>
</div>

<style>
  /* CSS Variables - Green/Black Theme */
  :root {
    --accent-orange: #2da44e;
    --accent-orange-hover: #3fb950;
    --accent-orange-light: #57d26d;
    --bg-black: #0a0a0a;
    --bg-dark-gray: #1a1a1a;
    --bg-card: #141414;
    --text-white: #ffffff;
    --text-gray: #9ca3af;
    --text-light-gray: #d1d5db;
    --border-color: rgba(45, 164, 78, 0.2);
  }

  /* Container */
  .semplice-container {
    background: var(--bg-black);
    min-height: 100vh;
    padding: 0;
    position: relative;
  }

  /* Decorative Top Bar */
  .decorative-bar {
    width: 100%;
    height: 8px;
    background: var(--accent-orange);
    position: sticky;
    top: 0;
    z-index: 50;
  }

  /* Animation System - Start visible for immediate display */
  .animate-section {
    opacity: 1;
  }

  /* Hero Section */
  .hero-section {
    min-height: 85vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 120px 24px 80px;
    position: relative;
    background: linear-gradient(180deg, var(--bg-black) 0%, var(--bg-dark-gray) 100%);
  }

  .hero-title {
    margin: 0;
    padding: 0;
    text-align: center;
  }

  .hero-line {
    display: block;
    font-size: clamp(56px, 15vw, 140px);
    font-weight: 900;
    line-height: 0.9;
    letter-spacing: -0.04em;
    color: var(--text-white);
    text-transform: uppercase;
  }

  .hero-line-accent {
    color: var(--accent-orange);
    position: relative;
  }

  .hero-subtitle {
    font-size: clamp(18px, 3vw, 28px);
    font-weight: 500;
    color: var(--text-gray);
    margin-top: 32px;
    text-align: center;
    letter-spacing: 0.02em;
  }

  /* More About Section - Fresh Complete Rebuild */
  .more-about-section {
    background: var(--bg-black);
    border-top: 2px solid var(--border-color);
    padding: 120px 24px 100px;
  }

  .more-about-inner {
    max-width: 1400px;
    margin: 0 auto;
  }

  @media (min-width: 1024px) {
    .more-about-inner {
      display: flex;
      gap: 100px;
    }
  }

  .left-column {
    flex: 0 0 400px;
  }

  .sticky-text {
    position: sticky;
    top: 80px;
  }

  .mega-title {
    font-size: clamp(48px, 10vw, 110px);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -0.03em;
    margin: 0;
    background: linear-gradient(135deg, var(--text-white) 0%, var(--accent-orange) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .right-column {
    flex: 1;
    min-width: 0;
  }

  .question-block {
    padding: 32px 0;
    border-bottom: 2px solid var(--border-color);
  }

  .question-block:last-child {
    border-bottom: none;
  }

  .question-block:hover {
    transform: translateX(8px);
    transition: transform 0.3s ease;
  }

  .q-title {
    font-size: clamp(24px, 4vw, 36px);
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.02em;
    color: var(--text-white);
    margin: 0 0 16px 0;
    padding-left: 40px;
    position: relative;
  }

  .q-title::before {
    content: '→';
    position: absolute;
    left: 0;
    color: var(--accent-orange);
    font-weight: 900;
  }

  .q-answer {
    font-size: clamp(17px, 3vw, 20px);
    line-height: 1.7;
    color: var(--text-gray);
    margin: 0;
    padding-left: 40px;
  }

  @media (max-width: 1023px) {
    .left-column {
      margin-bottom: 60px;
    }
    
    .sticky-text {
      position: relative;
      top: auto;
    }
  }

  /* Bio Grid */
  .bio-grid {
    padding: 120px 24px;
    max-width: 1400px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 80px;
  }

  @media (min-width: 1024px) {
    .bio-grid {
      grid-template-columns: 1.2fr 1fr;
      gap: 100px;
    }
  }

  .bio-main {
    position: relative;
  }

  .section-title {
    font-size: clamp(40px, 8vw, 72px);
    font-weight: 900;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--text-white);
    margin: 0 0 48px 0;
  }

  .bio-content {
    background: var(--bg-card);
    padding: 48px;
    border-left: 6px solid var(--accent-orange);
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.6);
  }

  .bio-paragraph {
    font-size: clamp(17px, 3vw, 21px);
    line-height: 1.8;
    color: var(--text-light-gray);
    margin: 0 0 28px 0;
  }

  .bio-paragraph:last-child {
    margin-bottom: 0;
  }

  .bio-paragraph strong {
    color: var(--accent-orange);
    font-weight: 700;
  }

  .card-stack-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 60px 20px;
    gap: 24px;
  }

  .card-stack {
    position: relative;
    width: 100%;
    max-width: 420px;
    aspect-ratio: 1 / 1;
    perspective: 600px;
  }

  .card-stack-hint {
    font-size: 15px;
    color: var(--text-gray);
    font-family: 'Courier New', monospace;
    text-align: center;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    opacity: 0.8;
    animation: subtlePulse 3s ease-in-out infinite;
  }

  .hint-icon {
    color: var(--accent-orange);
    font-size: 18px;
    font-weight: bold;
  }

  @keyframes subtlePulse {
    0%, 100% {
      opacity: 0.8;
    }
    50% {
      opacity: 1;
    }
  }

  .stack-card-wrapper {
    position: absolute;
    width: 100%;
    height: 100%;
    cursor: grab;
  }

  .stack-card-wrapper:active {
    cursor: grabbing;
  }

  .stack-card {
    width: 100%;
    height: 100%;
    border: none;
    background: var(--bg-card);
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
    border-radius: 8px;
    cursor: grab;
  }

  .stack-card:active {
    cursor: grabbing;
  }

  .stack-card img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    pointer-events: none;
    user-select: none;
  }

  @media (max-width: 767px) {
    .card-stack {
      max-width: 340px;
    }
    
    .card-stack-container {
      padding: 40px 20px;
    }
  }

  /* GitHub Section */
  .github-section {
    padding: 120px 24px;
    max-width: 1400px;
    margin: 0 auto;
    background: var(--bg-dark-gray);
  }

  .section-intro {
    font-size: clamp(18px, 3vw, 24px);
    line-height: 1.6;
    color: var(--text-gray);
    margin: 0 0 60px 0;
    max-width: 800px;
  }

  .browser-mockup {
    background: var(--bg-black);
    border: 2px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
    transition: border-color 0.3s ease;
  }

  .browser-mockup:hover {
    border-color: var(--accent-orange);
  }

  .browser-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    background: var(--bg-card);
    border-bottom: 2px solid var(--border-color);
    gap: 16px;
  }

  .browser-dots {
    display: flex;
    gap: 8px;
  }

  .dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
  }

  .dot.red {
    background: #ff5f56;
  }

  .dot.yellow {
    background: #ffbd2e;
  }

  .dot.green {
    background: #27c93f;
  }

  .browser-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-gray);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .browser-spacer {
    flex: 1;
  }

  .browser-content {
    padding: 48px;
    background: var(--bg-card);
    min-height: 300px;
  }

  @media (max-width: 767px) {
    .browser-content {
      padding: 24px;
    }
  }

  /* Music Section */
  .music-section {
    padding: 120px 0;
    background: #ffffff;
    border-top: 8px solid var(--accent-orange);
  }

  .music-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px;
  }

  .music-header {
    margin-bottom: 100px;
  }

  .music-title {
    font-size: clamp(48px, 10vw, 96px);
    font-weight: 900;
    line-height: 0.95;
    letter-spacing: -0.03em;
    color: #0a0a0a;
    margin: 0;
  }

  .playlists-staggered {
    display: flex;
    flex-direction: column;
    gap: 100px;
  }

  .playlist-row {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
    align-items: center;
  }

  @media (min-width: 768px) {
    .playlist-row {
      grid-template-columns: 280px 1fr;
      gap: 60px;
    }

    .playlist-row.row-right {
      grid-template-columns: 1fr 280px;
    }

    .playlist-row.row-right .playlist-text {
      order: 2;
    }

    .playlist-row.row-right .playlist-player {
      order: 1;
    }
  }

  .playlist-text {
    width: 100%;
  }

  .playlist-name {
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 800;
    line-height: 1.2;
    color: #0a0a0a;
    margin: 0 0 12px 0;
    letter-spacing: -0.01em;
  }

  .playlist-desc {
    font-size: clamp(15px, 2vw, 17px);
    line-height: 1.6;
    color: #666666;
    margin: 0;
  }

  .playlist-player {
    width: 100%;
  }

  .playlist-player iframe {
    width: 100%;
    height: 450px;
    border: 2px solid rgba(0, 0, 0, 0.1);
    border-radius: 12px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
    display: block;
  }

  /* Terminal Footer Section */
  .terminal-footer {
    padding: 120px 24px 80px 24px;
    background: var(--bg-black);
    max-width: 1200px;
    margin: 0 auto;
  }

  .terminal-window {
    background: #1a1a1a;
    border: 1px solid rgba(45, 164, 78, 0.2);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5),
                0 0 0 1px rgba(45, 164, 78, 0.1);
    transition: all 0.4s ease;
  }

  .terminal-window:hover {
    border-color: rgba(45, 164, 78, 0.4);
    box-shadow: 0 20px 60px rgba(45, 164, 78, 0.15),
                0 0 0 1px rgba(45, 164, 78, 0.2);
  }

  .terminal-header {
    background: #0d0d0d;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid rgba(45, 164, 78, 0.1);
  }

  .window-controls {
    display: flex;
    gap: 8px;
  }

  .control {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    transition: all 0.3s ease;
  }

  .control.close {
    background: #ff5f57;
  }

  .control.minimize {
    background: #ffbd2e;
  }

  .control.maximize {
    background: #28ca42;
  }

  .control:hover {
    opacity: 0.8;
    transform: scale(1.1);
  }

  .terminal-title {
    font-family: 'Courier New', monospace;
    font-size: 13px;
    color: var(--text-gray);
    letter-spacing: 0.5px;
  }

  .terminal-body {
    padding: 32px 28px;
    font-family: 'Courier New', 'Monaco', monospace;
    background: #0a0a0a;
  }

  .ascii-art {
    color: var(--accent-orange);
    font-size: 14px;
    line-height: 1.2;
    margin: 0 0 32px 0;
    font-weight: bold;
    letter-spacing: 0px;
  }

  .terminal-output {
    color: var(--text-white);
  }

  .prompt-line {
    font-size: 15px;
    color: var(--text-gray);
    margin: 0 0 8px 0;
    font-family: 'Courier New', monospace;
  }

  .output-line {
    font-size: 15px;
    color: var(--text-light-gray);
    margin: 0 0 24px 0;
    padding-left: 20px;
    font-family: 'Courier New', monospace;
  }

  .terminal-links {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 16px 0 24px 0;
  }

  .terminal-command {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    background: rgba(45, 164, 78, 0.05);
    border: 1px solid rgba(45, 164, 78, 0.1);
    border-radius: 6px;
    color: var(--text-white);
    text-decoration: none;
    font-size: 15px;
    font-family: 'Courier New', monospace;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
  }

  .terminal-command::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, 
      transparent, 
      rgba(45, 164, 78, 0.1), 
      transparent);
    transition: left 0.5s ease;
  }

  .terminal-command:hover::before {
    left: 100%;
  }

  .terminal-command:hover {
    background: rgba(45, 164, 78, 0.15);
    border-color: var(--accent-orange);
    transform: translateX(8px);
    box-shadow: 0 0 20px rgba(45, 164, 78, 0.3);
  }

  .terminal-command .prompt {
    color: var(--accent-orange);
    font-weight: bold;
    flex-shrink: 0;
  }

  .terminal-command .command-text {
    color: var(--text-white);
    font-weight: 600;
    flex-shrink: 0;
  }

  .terminal-command .command-desc {
    color: var(--text-gray);
    margin-left: auto;
    font-size: 14px;
  }

  .cursor-line {
    margin-top: 8px;
  }

  .blinking-cursor {
    color: var(--accent-orange);
    font-weight: bold;
    animation: blink 1s step-end infinite;
  }

  @keyframes blink {
    0%, 50% {
      opacity: 1;
    }
    51%, 100% {
      opacity: 0;
    }
  }

  /* Responsive Terminal Footer */
  @media (max-width: 767px) {
    .terminal-footer {
      padding: 80px 16px 60px 16px;
    }

    .terminal-body {
      padding: 24px 16px;
    }

    .ascii-art {
      font-size: 11px;
      margin-bottom: 24px;
    }

    .terminal-command {
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      padding: 12px 14px;
    }

    .terminal-command .command-desc {
      margin-left: 0;
      padding-left: 20px;
      font-size: 13px;
    }

    .terminal-command:hover {
      transform: translateX(4px);
    }

    .prompt-line,
    .output-line,
    .terminal-command {
      font-size: 14px;
    }

    .terminal-title {
      font-size: 12px;
    }
  }

  /* Gallery Section */
  /* Footer Tear */
  .footer-tear {
    width: 100%;
    height: 60px;
    margin-top: -1px;
  }

  .footer-tear svg {
    width: 100%;
    height: 100%;
    display: block;
  }

  /* Reduced Motion */
  @media (prefers-reduced-motion: reduce) {
    .animate-section,
    .decorative-stamp {
      animation: none;
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
