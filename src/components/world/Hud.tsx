import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { contactLinks } from '../../data/portfolio';
import { clearInput, input } from './input';
import { initAudio, playGoal, setMuted } from './sound';
import { MUTE_KEY, useWorld, world } from './store';
import { lifePhotos, type Zone } from './zones';

const CLASSIC_URL = '/classic';

function start() {
  initAudio();
  world.set({ started: true });
}

function openZone(zone: Zone) {
  if (zone.kind === 'classic') {
    window.location.href = CLASSIC_URL;
    return;
  }
  clearInput();
  world.set({ panel: zone });
}

function closePanel() {
  world.set({ panel: null });
}

function toggleMute() {
  const muted = !world.get().muted;
  setMuted(muted);
  world.set({ muted });
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Storage can be unavailable (private mode); the toggle still works for this visit.
  }
}

const isControl = (target: EventTarget | null) =>
  target instanceof HTMLButtonElement || target instanceof HTMLAnchorElement;

export function Hud() {
  const ready = useWorld((s) => s.ready);
  const started = useWorld((s) => s.started);
  const zone = useWorld((s) => s.zone);
  const panel = useWorld((s) => s.panel);
  const goal = useWorld((s) => s.goal);
  const muted = useWorld((s) => s.muted);
  const touch = useWorld((s) => s.touch);
  const [banner, setBanner] = useState<Zone | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = world.get();
      if (!s.started) {
        if (e.code === 'Enter' && s.ready && !isControl(e.target)) start();
        return;
      }
      if (e.code === 'Escape' && s.panel) closePanel();
      else if (e.code === 'KeyE' || (e.code === 'Enter' && !isControl(e.target))) {
        if (s.panel) closePanel();
        else if (s.zone) openZone(s.zone);
      } else if (e.code === 'KeyR' && !s.panel) input.resetBall = true;
      else if (e.code === 'KeyM') toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Goal: crowd roar and banner, then the contact card once the celebration lands.
  useEffect(() => {
    if (!goal) return;
    playGoal();
    setBanner(goal.zone);
    const open = setTimeout(() => world.set({ panel: goal.zone }), 1700);
    const hide = setTimeout(() => setBanner(null), 1900);
    return () => {
      clearTimeout(open);
      clearTimeout(hide);
    };
  }, [goal]);

  return (
    <div className="world-hud">
      <StartScreen ready={ready} started={started} />

      {started && (
        <>
          <header className="world-topbar">
            <span className="world-name">Aadhav Manimurugan</span>
            <div className="world-topbar-actions">
              <button
                type="button"
                className="world-icon-btn"
                onClick={(e) => {
                  toggleMute();
                  // Hand focus back to the world so Space shoots instead of re-toggling.
                  e.currentTarget.blur();
                }}
                aria-label={muted ? 'Unmute sound' : 'Mute sound'}
              >
                <SoundIcon muted={muted} />
              </button>
              <a className="world-pill" href={CLASSIC_URL}>
                Classic site
              </a>
            </div>
          </header>

          {!touch && <ControlsHint />}

          {zone && !panel && (
            <button type="button" className="world-prompt" style={{ '--accent': zone.color } as CSSProperties} onClick={() => openZone(zone)}>
              {!touch && <kbd>E</kbd>}
              {zone.kind === 'classic' ? 'Go to the classic site' : `Open ${zone.label}`}
            </button>
          )}

          {banner && (
            <div className="world-goal" style={{ '--accent': banner.color } as CSSProperties} aria-live="polite">
              <span>GOAL!</span>
              <small>{banner.label}</small>
            </div>
          )}

          {touch && !panel && <TouchControls />}
          {panel && <Panel zone={panel} />}
        </>
      )}
    </div>
  );
}

function StartScreen({ ready, started }: { ready: boolean; started: boolean }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className={`world-start${started ? ' is-leaving' : ''}`} onTransitionEnd={() => started && setGone(true)}>
      <div className="world-start-card">
        <p className="world-start-eyebrow">Portfolio</p>
        <p className="world-start-title">Aadhav Manimurugan</p>
        <p className="world-start-sub">Software engineer · CS @ UT Dallas</p>
        <p className="world-start-copy">
          Dribble around my little world to explore projects, learn about me, and score goals to get in touch.
        </p>
        <button type="button" className="world-btn world-btn-primary world-btn-large" disabled={!ready} onClick={start}>
          {ready ? 'Kick off' : 'Loading the pitch…'}
        </button>
        <a className="world-start-classic" href={CLASSIC_URL}>
          Prefer a regular website? Visit the classic site →
        </a>
      </div>
    </div>
  );
}

function ControlsHint() {
  const moved = useWorld((s) => s.moved);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!moved) return;
    const timer = setTimeout(() => setHidden(true), 9000);
    return () => clearTimeout(timer);
  }, [moved]);
  return (
    <div className={`world-hint${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden}>
      <span><kbd>WASD</kbd> run</span>
      <span><kbd>Shift</kbd> sprint</span>
      <span><kbd>Space</kbd> hold to shoot</span>
      <span><kbd>E</kbd> open</span>
      <span><kbd>R</kbd> reset ball</span>
    </div>
  );
}

function Panel({ zone }: { zone: Zone }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, [zone]);

  return (
    <div className="world-panel-backdrop" onClick={closePanel}>
      <section
        className="world-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="world-panel-title"
        style={{ '--accent': zone.color } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={close} type="button" className="world-panel-close" onClick={closePanel} aria-label="Close">
          ×
        </button>
        {zone.kind === 'project' && <ProjectPanel zone={zone} />}
        {zone.kind === 'about' && <AboutPanel />}
        {zone.kind === 'life' && <LifePanel />}
        {zone.kind === 'contact' && <ContactPanel zone={zone} />}
      </section>
    </div>
  );
}

function ProjectPanel({ zone }: { zone: Zone }) {
  const project = zone.project!;
  return (
    <>
      <div className="world-panel-media">
        <img src={project.src} alt={`${project.title} screenshot`} />
      </div>
      <p className="world-panel-eyebrow">Project</p>
      <h2 id="world-panel-title">{project.title}</h2>
      <p>{project.description}</p>
      <div className="world-panel-actions">
        <a className="world-btn world-btn-primary" href={project.projectUrl} target="_blank" rel="noopener noreferrer">
          Visit project ↗
        </a>
        <a className="world-btn" href="/projects">
          All projects
        </a>
      </div>
    </>
  );
}

function ContactLinks() {
  return (
    <div className="world-panel-actions">
      {contactLinks.map((link) => (
        <a
          key={link.id}
          className="world-btn"
          href={link.href}
          target={link.id === 'email' ? undefined : '_blank'}
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

function AboutPanel() {
  return (
    <>
      <div className="world-panel-media world-panel-media-tall">
        <img src="/world/about-soccer.jpg" alt="Aadhav on a soccer pitch" />
      </div>
      <p className="world-panel-eyebrow">About me</p>
      <h2 id="world-panel-title">Hey, I'm Aadhav.</h2>
      <p>
        I'm a Computer Science student at UT Dallas who believes the best technology disappears into great experiences.
        Whether I'm designing full-stack applications or training machine learning models, I'm obsessed with the details
        that make something feel effortless to use.
      </p>
      <p>
        I thrive in collaborative environments where ideas flow freely. When I'm not coding, you'll find me on the soccer
        field, watching films, or discovering new music.
      </p>
      <ul className="world-facts">
        <li>Based in Dallas, Texas</li>
        <li>Graduating December 2026</li>
        <li>Full-stack development and machine learning</li>
        <li>Previously an ML researcher and software engineering intern</li>
      </ul>
      <ContactLinks />
      <a className="world-panel-more" href="/about">
        Read the full about page →
      </a>
    </>
  );
}

function LifePanel() {
  return (
    <>
      <p className="world-panel-eyebrow">Life</p>
      <h2 id="world-panel-title">A few photos I like</h2>
      <div className="world-photo-grid">
        {lifePhotos.map((src) => (
          <img key={src} src={src} alt="" loading="lazy" />
        ))}
      </div>
      <a className="world-panel-more" href="/life">
        See all the photos →
      </a>
    </>
  );
}

function ContactPanel({ zone }: { zone: Zone }) {
  const contact = zone.contact!;
  const email = contact.id === 'email';
  return (
    <>
      <p className="world-panel-eyebrow">Goal! Let's connect</p>
      <h2 id="world-panel-title">{contact.label}</h2>
      <p className="world-panel-handle">{contact.handle}</p>
      <div className="world-panel-actions">
        <a
          className="world-btn world-btn-primary"
          href={contact.href}
          target={email ? undefined : '_blank'}
          rel="noopener noreferrer"
        >
          {email ? 'Send me an email' : `Open ${contact.label} ↗`}
        </a>
      </div>
      <p className="world-panel-note">Or try the other goals on the pitch.</p>
    </>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      {muted ? (
        <>
          <line x1="23" y1="9" x2="17" y2="15" />
          <line x1="17" y1="9" x2="23" y2="15" />
        </>
      ) : (
        <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
      )}
    </svg>
  );
}

const STICK_RADIUS = 52;

function TouchControls() {
  const knob = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);

  const moveStick = (e: PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx = (dx / len) * STICK_RADIUS;
      dy = (dy / len) * STICK_RADIUS;
    }
    input.stickX = dx / STICK_RADIUS;
    input.stickZ = dy / STICK_RADIUS;
    input.stickActive = true;
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const releaseStick = () => {
    pointer.current = null;
    input.stickX = 0;
    input.stickZ = 0;
    input.stickActive = false;
    if (knob.current) knob.current.style.transform = '';
  };

  useEffect(() => () => clearInput(), []);

  return (
    <>
      <div
        className="world-stick"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pointer.current = e.pointerId;
          moveStick(e);
        }}
        onPointerMove={(e) => pointer.current === e.pointerId && moveStick(e)}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
      >
        <div ref={knob} className="world-stick-knob" />
      </div>
      <button
        type="button"
        className="world-kick"
        aria-label="Hold to charge, release to shoot"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          input.kickButton = true;
        }}
        onPointerUp={() => (input.kickButton = false)}
        onPointerCancel={() => (input.kickButton = false)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="#fff" stroke="#111" strokeWidth="1.5" />
          <path d="m12 7.5 3.2 2.3-1.2 3.7h-4l-1.2-3.7z" fill="#111" />
        </svg>
      </button>
    </>
  );
}
