import { clearInput } from '../input';
import { playBeep, playBuzzer } from '../sound';
import { world, type Challenge } from '../store';

export const CHALLENGE_SECONDS = 60;
const COUNTDOWN_MS = 3000;

const bestKey = (kind: Challenge['kind']) => `world-best-${kind}`;

function readBest(kind: Challenge['kind']) {
  try {
    return Number(localStorage.getItem(bestKey(kind))) || 0;
  } catch {
    return 0;
  }
}

export function startChallenge(kind: Challenge['kind']) {
  clearInput();
  const now = performance.now();
  world.set({
    mode: kind,
    station: null,
    challenge: {
      kind,
      phase: 'countdown',
      score: 0,
      best: readBest(kind),
      startsAt: now + COUNTDOWN_MS,
      endsAt: now + COUNTDOWN_MS + CHALLENGE_SECONDS * 1000,
      callout: null
    }
  });
}

export function quitChallenge() {
  world.set({ mode: 'play', challenge: null });
}

export function addScore(points: number, text: string) {
  const { challenge } = world.get();
  if (!challenge || challenge.phase !== 'playing') return;
  world.set({ challenge: { ...challenge, score: challenge.score + points, callout: { text, tone: 'good', at: performance.now() } } });
}

export function callout(text: string, tone: 'good' | 'bad' = 'bad') {
  const { challenge } = world.get();
  if (!challenge || challenge.phase !== 'playing') return;
  world.set({ challenge: { ...challenge, callout: { text, tone, at: performance.now() } } });
}

let lastBeep = -1;

/** Advances countdown -> playing -> done. Call every frame. */
export function tickChallenge() {
  const { challenge } = world.get();
  if (!challenge || challenge.phase === 'done') return;
  const now = performance.now();
  if (challenge.phase === 'countdown') {
    const left = Math.ceil((challenge.startsAt - now) / 1000);
    if (left !== lastBeep && left > 0) {
      lastBeep = left;
      playBeep(false);
    }
    if (now >= challenge.startsAt) {
      lastBeep = -1;
      playBeep(true);
      world.set({ challenge: { ...challenge, phase: 'playing' } });
    }
  } else if (now >= challenge.endsAt) {
    playBuzzer();
    const best = Math.max(challenge.best, challenge.score);
    try {
      localStorage.setItem(bestKey(challenge.kind), String(best));
    } catch {
      // Best scores are a nice-to-have; ignore storage failures.
    }
    world.set({ challenge: { ...challenge, phase: 'done', best } });
  }
}

export function isPlaying(kind: Challenge['kind']) {
  const { challenge } = world.get();
  return challenge?.kind === kind && challenge.phase === 'playing';
}
