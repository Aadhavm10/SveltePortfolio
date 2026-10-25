import { audioGraph } from './sound';

/**
 * A soft, generated lo-fi loop in the spirit of a cosy village theme: warm keys, a round bass,
 * a kalimba that improvises over the chords, and a quiet shaker. Nothing repeats exactly.
 */

const BPM = 76;
const EIGHTH = 60 / BPM / 2;
/** Offbeat eighths land late for a lazy swing. */
const SWING = EIGHTH * 0.32;

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** One bar each: [bass note, chord voicing]. IV–iii–ii–I, then IV–iii–ii–V. */
const CHORDS: [number, number[]][] = [
  [41, [57, 60, 64, 67]], // Fmaj9
  [40, [55, 59, 62, 64]], // Em7
  [38, [53, 57, 60, 64]], // Dm9
  [36, [52, 55, 59, 62]], // Cmaj9
  [41, [57, 60, 64, 67]], // Fmaj9
  [40, [55, 59, 62, 64]], // Em7
  [38, [53, 57, 60, 64]], // Dm9
  [43, [53, 57, 60, 62]] // G9sus
];

/** C major pentatonic, G4 to C6, for the melody. */
const SCALE = [67, 69, 72, 74, 76, 79, 81, 84];

let timer: number | null = null;
let nextTime = 0;
let step = 0;
let melodyIndex = 3;
let filter: BiquadFilterNode | null = null;

function voice(ctx: AudioContext, dest: AudioNode, t: number, freq: number, type: OscillatorType, peak: number, attack: number, release: number) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + attack + release + 0.05);
}

/** Warm electric-piano chord, lightly strummed. */
function keys(ctx: AudioContext, dest: AudioNode, t: number, notes: number[], peak: number) {
  notes.forEach((n, i) => {
    const at = t + i * 0.014;
    voice(ctx, dest, at, midi(n), 'sine', peak, 0.025, 2.6);
    voice(ctx, dest, at, midi(n) * 1.003, 'triangle', peak * 0.3, 0.025, 1.4);
  });
}

function bass(ctx: AudioContext, dest: AudioNode, t: number, note: number, peak: number) {
  voice(ctx, dest, t, midi(note), 'sine', peak, 0.02, 1.1);
  voice(ctx, dest, t, midi(note + 12), 'sine', peak * 0.15, 0.02, 0.5);
}

/** Kalimba: a quick, woody pluck. */
function kalimba(ctx: AudioContext, dest: AudioNode, t: number, note: number, peak: number) {
  voice(ctx, dest, t, midi(note), 'sine', peak, 0.003, 0.9);
  voice(ctx, dest, t, midi(note) * 3, 'sine', peak * 0.1, 0.002, 0.15);
}

function shaker(ctx: AudioContext, dest: AudioNode, t: number, peak: number) {
  const g = audioGraph();
  if (!g) return;
  const src = ctx.createBufferSource();
  src.buffer = g.noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 6500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  src.connect(hp).connect(gain).connect(dest);
  src.start(t, Math.random() * 3);
  src.stop(t + 0.08);
}

/** Plays one eighth-note step of the loop at time t. */
function play(ctx: AudioContext, dest: AudioNode, t: number) {
  const bar = Math.floor(step / 8) % CHORDS.length;
  const beat = step % 8;
  const [root, chord] = CHORDS[bar];
  const human = () => (Math.random() - 0.5) * 0.012;

  if (beat === 0) keys(ctx, dest, t + human(), chord, 0.032);
  // Sometimes push the chord again on the "and" of two.
  if (beat === 3 && Math.random() < 0.35) keys(ctx, dest, t + human(), chord.slice(1), 0.02);
  if (beat === 0) bass(ctx, dest, t, root, 0.14);
  if (beat === 4) bass(ctx, dest, t, Math.random() < 0.3 ? root + 7 : root, 0.1);

  // Melody: a random walk on the pentatonic scale that breathes at the end of every two bars.
  const resting = bar % 2 === 1 && beat >= 5;
  if (!resting && Math.random() < (beat % 2 === 0 ? 0.42 : 0.24)) {
    melodyIndex = Math.max(0, Math.min(SCALE.length - 1, melodyIndex + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    kalimba(ctx, dest, t + human(), SCALE[melodyIndex], 0.05);
  }

  shaker(ctx, dest, t, beat % 2 ? 0.014 : 0.008);
}

function schedule() {
  const g = audioGraph();
  if (!g || !filter) return;
  const { ctx } = g;
  // Catch up rather than burst if the tab was paused.
  if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
  while (nextTime < ctx.currentTime + 0.3) {
    play(ctx, filter, nextTime + (step % 2 ? SWING : 0));
    nextTime += EIGHTH;
    step++;
  }
}

/** Starts the background music (its volume and on/off live on the music bus). */
export function startMusic() {
  const g = audioGraph();
  if (!g || timer !== null) return;
  // A gentle low-pass keeps it warm and in the background.
  filter = g.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 3200;
  filter.connect(g.music);
  nextTime = g.ctx.currentTime + 0.4;
  timer = window.setInterval(schedule, 90);
  schedule();
}
