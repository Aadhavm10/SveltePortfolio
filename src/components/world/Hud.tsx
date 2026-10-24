import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { contactLinks, experience, photos, projects, resumeUrl } from '../../data/portfolio';
import { arrow, back, CLASSIC_URL, closeStation, interact, openStation, selectPsp, turnPage } from './actions';
import { basketball } from './games/basketballState';
import { CHALLENGE_SECONDS, quitChallenge, startChallenge, tickChallenge } from './games/challenge';
import { clearInput, input } from './input';
import { stationById, type StationId } from './layout';
import { initAudio, setMuted } from './sound';
import { PSP_MENU } from './stations/pspMenu';
import { fx, MUTE_KEY, useWorld, world } from './store';

function start() {
  initAudio();
  world.set({ started: true });
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

/** O: open the link for whatever is on screen. */
function openCurrent() {
  const { mode, station, page } = world.get();
  if (mode !== 'station') return;
  if (station === 'projects') window.open(projects[page].projectUrl, '_blank', 'noopener');
  if (station === 'psp') selectPsp();
}

const isControl = (target: EventTarget | null) => target instanceof HTMLElement && target.closest('a, button') !== null;

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  KeyD: [1, 0],
  KeyW: [0, -1],
  KeyS: [0, 1]
};

export function Hud() {
  const ready = useWorld((s) => s.ready);
  const started = useWorld((s) => s.started);
  const mode = useWorld((s) => s.mode);
  const near = useWorld((s) => s.near);
  const touch = useWorld((s) => s.touch);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const s = world.get();
      if (!s.started) {
        if (e.code === 'Enter' && s.ready && !isControl(e.target)) start();
        return;
      }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        if (isControl(e.target)) return;
        e.preventDefault();
        interact();
      } else if (e.code === 'Escape' || e.code === 'Backspace') back();
      else if (e.code in ARROWS) {
        if (arrow(...ARROWS[e.code])) e.preventDefault();
      } else if (e.code === 'KeyO') openCurrent();
      else if (e.code === 'KeyR' && s.mode === 'play') input.resetBall = true;
      else if (e.code === 'KeyM') toggleMute();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Challenge clock
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      tickChallenge();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="world-hud">
      <StartScreen ready={ready} started={started} />
      <ContactDock />

      {started && (
        <>
          <TopBar />
          {mode === 'play' && !touch && <ControlsHint />}
          {mode === 'play' && near && touch && (
            <button type="button" className="world-prompt" style={{ '--accent': stationById[near].color } as CSSProperties} onClick={() => openStation(near)}>
              {stationById[near].label}
            </button>
          )}
          {mode === 'play' && <GoalBanner />}
          {mode === 'station' && <StationBar />}
          {(mode === 'soccer' || mode === 'basketball') && <ChallengeHud kind={mode} />}
          {(mode === 'play' || mode === 'soccer' || mode === 'basketball') && <ChargeMeter kind={mode} />}
          {touch && (mode === 'play' || mode === 'soccer' || mode === 'basketball') && <TouchControls />}
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
        <p className="world-start-eyebrow">Portfolio · golden hour</p>
        <p className="world-start-title">Aadhav Manimurugan</p>
        <p className="world-start-sub">Software engineer · CS @ UT Dallas</p>
        <p className="world-start-copy">
          Explore my park: browse my work on the laptop, flip through photos on the camera, and take a shot at the
          shooting challenge or the 3-point shootout.
        </p>
        <button type="button" className="world-btn world-btn-primary world-btn-large" disabled={!ready} onClick={start}>
          {ready ? 'Kick off' : 'Setting up the park…'}
        </button>
        <a className="world-start-classic" href={CLASSIC_URL}>
          Prefer a regular website? Visit the classic site →
        </a>
      </div>
    </div>
  );
}

function Icon({ name }: { name: 'github' | 'linkedin' | 'email' | 'resume' }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'email')
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    );
  if (name === 'resume')
    return (
      <svg {...common}>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h6" />
      </svg>
    );
  if (name === 'linkedin')
    return (
      <svg {...common}>
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M8 10v7M8 7v.01M12 17v-7M12 13a3 3 0 0 1 6 0v4" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M9 19c-4 1.3-4-2-6-2.5M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12 12 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </svg>
  );
}

/** Always-visible ways to get in touch, no gameplay required. */
function ContactDock() {
  return (
    <nav className="world-dock" aria-label="Contact">
      {contactLinks.map((link) => (
        <a
          key={link.id}
          className="world-dock-link"
          href={link.href}
          target={link.id === 'email' ? undefined : '_blank'}
          rel="noopener noreferrer"
          title={link.handle}
        >
          <Icon name={link.id} />
          <span>{link.label}</span>
        </a>
      ))}
      <a className="world-dock-link" href={resumeUrl} target="_blank" rel="noopener noreferrer">
        <Icon name="resume" />
        <span>Résumé</span>
      </a>
    </nav>
  );
}

function TopBar() {
  const muted = useWorld((s) => s.muted);
  return (
    <header className="world-topbar">
      <span className="world-name">Aadhav Manimurugan</span>
      <div className="world-topbar-actions">
        <button
          type="button"
          className="world-icon-btn"
          onClick={(e) => {
            toggleMute();
            e.currentTarget.blur();
          }}
          aria-label={muted ? 'Unmute sound' : 'Mute sound'}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 5 6 9H2v6h4l5 4V5z" />
            {muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
          </svg>
        </button>
        <a className="world-pill" href={CLASSIC_URL}>
          Classic site
        </a>
      </div>
    </header>
  );
}

function ControlsHint() {
  const moved = useWorld((s) => s.moved);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!moved) return;
    const timer = setTimeout(() => setHidden(true), 10000);
    return () => clearTimeout(timer);
  }, [moved]);
  return (
    <div className={`world-hint${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden}>
      <span><kbd>WASD</kbd> run</span>
      <span><kbd>Shift</kbd> sprint</span>
      <span><kbd>Space</kbd> hold to shoot</span>
      <span><kbd>Enter</kbd> interact</span>
      <span><kbd>R</kbd> reset ball</span>
    </div>
  );
}

function GoalBanner() {
  const goalAt = useWorld((s) => s.goalAt);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!goalAt) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), 1800);
    return () => clearTimeout(t);
  }, [goalAt]);
  if (!shown) return null;
  return (
    <div key={goalAt} className="world-callout is-good is-big" aria-live="polite">
      GOAL!
    </div>
  );
}

const STATION_TITLES: Partial<Record<StationId, string>> = {
  projects: 'Work',
  experience: 'Experience',
  psp: 'Favorites',
  camera: 'Photos'
};

function StationBar() {
  const station = useWorld((s) => s.station);
  const page = useWorld((s) => s.page);
  const psp = useWorld((s) => s.psp);
  if (!station) return null;
  const count = station === 'projects' ? projects.length : station === 'experience' ? experience.length : station === 'camera' ? photos.length : 0;
  const pspItem = station === 'psp' ? PSP_MENU[psp.col].items[psp.row] : null;

  let action: ReactNode = null;
  if (station === 'projects') {
    action = (
      <a className="world-btn world-btn-primary" href={projects[page].projectUrl} target="_blank" rel="noopener noreferrer">
        Open site ↗ <kbd>O</kbd>
      </a>
    );
  } else if (pspItem?.href) {
    action = (
      <a className="world-btn world-btn-primary" href={pspItem.href} target="_blank" rel="noopener noreferrer">
        Open {pspItem.title} ↗
      </a>
    );
  }

  return (
    <>
      {station === 'camera' && <Viewfinder page={page} />}
      <div className="world-station-bar" style={{ '--accent': stationById[station].color } as CSSProperties}>
        <span className="world-station-title">
          {STATION_TITLES[station]}
          {count > 0 && <small>{`${page + 1} / ${count}`}</small>}
        </span>
        <div className="world-station-actions">
          {count > 0 && (
            <>
              <button type="button" className="world-btn" onClick={() => turnPage(-1)} aria-label="Previous">
                ←
              </button>
              <button type="button" className="world-btn" onClick={() => turnPage(1)}>
                Next <kbd>Enter</kbd>
              </button>
            </>
          )}
          {station === 'psp' && (
            <>
              <button type="button" className="world-btn" onClick={() => arrow(-1, 0)} aria-label="Previous category">
                ←
              </button>
              <button type="button" className="world-btn" onClick={() => arrow(0, 1)} aria-label="Next item">
                ↓
              </button>
              <button type="button" className="world-btn" onClick={() => arrow(1, 0)} aria-label="Next category">
                →
              </button>
            </>
          )}
          {action}
          <button type="button" className="world-btn" onClick={closeStation}>
            Back <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    </>
  );
}

/** Looking through the camera: the photo fills a viewfinder frame, with a flash on every shot. */
function Viewfinder({ page }: { page: number }) {
  return (
    <div className="world-viewfinder" onClick={() => turnPage(1)}>
      <div className="world-viewfinder-frame">
        <img key={page} src={photos[page]} alt={`Photo ${page + 1} of ${photos.length}`} />
        <span className="world-viewfinder-flash" key={`flash-${page}`} />
        <span className="world-viewfinder-corner tl" />
        <span className="world-viewfinder-corner tr" />
        <span className="world-viewfinder-corner bl" />
        <span className="world-viewfinder-corner br" />
        <span className="world-viewfinder-meta left">
          <i /> REC
        </span>
        <span className="world-viewfinder-meta right">{`${String(page + 1).padStart(2, '0')} / ${photos.length}`}</span>
        <span className="world-viewfinder-meta bottom">f/2.8 · 1/250 · ISO 100</span>
      </div>
    </div>
  );
}

function ChallengeHud({ kind }: { kind: 'soccer' | 'basketball' }) {
  const challenge = useWorld((s) => s.challenge);
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 200);
    return () => clearInterval(id);
  }, []);
  if (!challenge) return null;
  const now = performance.now();
  const left = Math.max(0, Math.ceil((challenge.endsAt - Math.max(now, challenge.startsAt)) / 1000));
  const countdown = Math.ceil((challenge.startsAt - now) / 1000);
  const title = kind === 'soccer' ? 'Shooting challenge' : '3-point shootout';
  const calloutFresh = challenge.callout && now - challenge.callout.at < 1100;

  return (
    <>
      <div className="world-scorebar">
        <span className="world-scorebar-title">{title}</span>
        <span className={`world-scorebar-time${left <= 10 && challenge.phase === 'playing' ? ' is-low' : ''}`}>{challenge.phase === 'countdown' ? CHALLENGE_SECONDS : left}s</span>
        <span className="world-scorebar-score">
          {challenge.score}
          <small>Best {challenge.best}</small>
        </span>
      </div>
      {challenge.phase === 'countdown' && countdown > 0 && (
        <div key={countdown} className="world-callout is-big">
          {countdown}
        </div>
      )}
      {challenge.phase === 'playing' && now - challenge.startsAt < 700 && <div className="world-callout is-big is-good">GO!</div>}
      {challenge.phase === 'playing' && calloutFresh && challenge.callout && (
        <div key={challenge.callout.at} className={`world-callout ${challenge.callout.tone === 'good' ? 'is-good' : 'is-bad'}`}>
          {challenge.callout.text}
        </div>
      )}
      {challenge.phase === 'playing' && (
        <p className="world-challenge-help">
          {kind === 'soccer' ? 'Hold Space to power up, release to shoot. Beat the keeper!' : 'Hold Space and release in the green zone.'}
        </p>
      )}
      {challenge.phase === 'done' && (
        <div className="world-results" role="dialog" aria-label="Results">
          <p className="world-results-eyebrow">{kind === 'soccer' ? 'Full time' : 'Buzzer!'}</p>
          <p className="world-results-score">{challenge.score}</p>
          <p className="world-results-best">
            {challenge.score >= challenge.best && challenge.score > 0 ? 'New best!' : `Best ${challenge.best}`}
          </p>
          <div className="world-results-actions">
            <button type="button" className="world-btn world-btn-primary" onClick={() => startChallenge(kind)}>
              Play again <kbd>Enter</kbd>
            </button>
            <button type="button" className="world-btn" onClick={quitChallenge}>
              Exit <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      )}
      {challenge.phase !== 'done' && (
        <button type="button" className="world-btn world-challenge-quit" onClick={quitChallenge}>
          Quit <kbd>Esc</kbd>
        </button>
      )}
    </>
  );
}

/** Shot power: a bar that fills while Space is held; basketball shows the sweet spot. */
function ChargeMeter({ kind }: { kind: 'play' | 'soccer' | 'basketball' }) {
  const fill = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const c = fx.charge;
      if (fill.current) fill.current.style.transform = `scaleX(${c})`;
      if (wrap.current) wrap.current.classList.toggle('is-visible', c > 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const [lo, hi] = basketball.sweetSpot;
  return (
    <div ref={wrap} className="world-meter" aria-hidden="true">
      {kind === 'basketball' && <div className="world-meter-zone" style={{ left: `${lo * 100}%`, width: `${(hi - lo) * 100}%` }} />}
      <div ref={fill} className="world-meter-fill" />
    </div>
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
