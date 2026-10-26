/** Tiny synthesized sound effects, ambience and music, so the world ships without audio files. */

let ctx: AudioContext | null = null;
/** Everything goes through `out`, which is what mute silences. */
let out: GainNode | null = null;
/** Sound effects bus. */
let master: GainNode | null = null;
let ambienceBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let longNoise: AudioBuffer | null = null;
let brownNoise: AudioBuffer | null = null;
let muted = false;
let musicOn = true;

const VOLUME = 0.55;
const MUSIC_VOLUME = 1.3;

function noiseBuffer(context: AudioContext, seconds: number, brown: boolean) {
  const buffer = context.createBuffer(1, Math.round(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      // Integrated white noise: a soft rumble for wind and falling water.
      last = (last + white * 0.02) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

export function initAudio() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  ctx = new AudioCtor();
  const now = ctx.currentTime;
  out = ctx.createGain();
  out.gain.value = muted ? 0 : 1;
  out.connect(ctx.destination);
  master = ctx.createGain();
  master.gain.value = VOLUME;
  master.connect(out);
  // Ambience and music fade in rather than starting abruptly.
  ambienceBus = ctx.createGain();
  ambienceBus.gain.setValueAtTime(0, now);
  ambienceBus.gain.setTargetAtTime(1, now + 0.3, 1.2);
  ambienceBus.connect(out);
  musicBus = ctx.createGain();
  musicBus.gain.setValueAtTime(0, now);
  if (musicOn) musicBus.gain.setTargetAtTime(MUSIC_VOLUME, now + 1.5, 2);
  musicBus.connect(out);

  noise = noiseBuffer(ctx, 1, false);
  longNoise = noiseBuffer(ctx, 4, false);
  brownNoise = noiseBuffer(ctx, 4, true);

  // Nothing should keep playing in a background tab.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  });
}

/** The shared audio graph, once audio has started (after the first click). */
export function audioGraph() {
  if (!ctx || !ambienceBus || !musicBus || !longNoise || !brownNoise) return null;
  return { ctx, ambience: ambienceBus, music: musicBus, noise: longNoise, brown: brownNoise };
}

export function setMuted(value: boolean) {
  muted = value;
  if (out && ctx) out.gain.setTargetAtTime(value ? 0 : 1, ctx.currentTime, 0.02);
}

export function setMusicOn(value: boolean) {
  musicOn = value;
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(value ? MUSIC_VOLUME : 0, ctx.currentTime, 0.4);
}

function envelope(gain: GainNode, t: number, peak: number, attack: number, release: number) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
}

function noiseBurst(t: number, filterType: BiquadFilterType, freq: number, q: number, peak: number, attack: number, release: number) {
  if (!ctx || !master || !noise) return;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  envelope(gain, t, peak, attack, release);
  src.connect(filter).connect(gain).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + attack + release + 0.05);
}

function thump(t: number, from: number, to: number, peak: number, length: number) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length);
  const gain = ctx.createGain();
  envelope(gain, t, peak, 0.004, length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

export function playKick(power: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  thump(t, 170, 45, 0.5 + power * 0.5, 0.14 + power * 0.08);
  noiseBurst(t, 'lowpass', 2200, 0.7, 0.25 + power * 0.35, 0.002, 0.06);
}

export function playTouch(strength: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  thump(t, 130, 60, 0.12 + strength * 0.15, 0.07);
  noiseBurst(t, 'lowpass', 1400, 0.7, 0.05 + strength * 0.06, 0.002, 0.04);
}

export function playBump(strength: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  thump(t, 90, 40, Math.min(0.4, 0.08 + strength * 0.05), 0.12);
}

export function playGoal() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  // Crowd roar: two bands of filtered noise swelling in and fading out.
  noiseBurst(t + 0.05, 'bandpass', 900, 0.6, 0.55, 0.35, 2.4);
  noiseBurst(t + 0.05, 'bandpass', 2400, 0.9, 0.18, 0.4, 2.0);
  // Referee whistle.
  if (!master) return;
  const osc = ctx.createOscillator();
  osc.frequency.value = 2850;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 38;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 90;
  lfo.connect(lfoGain).connect(osc.frequency);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.08, t + 0.03);
  gain.gain.setValueAtTime(0.08, t + 0.45);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  osc.connect(gain).connect(master);
  osc.start(t);
  lfo.start(t);
  osc.stop(t + 0.65);
  lfo.stop(t + 0.65);
}

function tone(t: number, freq: number, peak: number, length: number, type: OscillatorType = 'sine', endFreq?: number) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + length);
  const gain = ctx.createGain();
  envelope(gain, t, peak, 0.005, length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

/** Soft blip for menus and page turns. */
export function playTick() {
  if (!ctx || muted) return;
  tone(ctx.currentTime, 1250, 0.07, 0.05, 'triangle');
}

export function playOpen() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  noiseBurst(t, 'bandpass', 900, 0.8, 0.12, 0.08, 0.25);
  tone(t + 0.02, 520, 0.06, 0.18, 'sine', 880);
}

export function playClose() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  noiseBurst(t, 'bandpass', 700, 0.8, 0.1, 0.06, 0.2);
  tone(t, 760, 0.05, 0.16, 'sine', 440);
}

export function playShutter() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  noiseBurst(t, 'highpass', 2500, 0.7, 0.3, 0.002, 0.03);
  noiseBurst(t + 0.07, 'highpass', 1800, 0.7, 0.22, 0.002, 0.04);
}

/** Countdown beep; the final one is higher. */
export function playBeep(go: boolean) {
  if (!ctx || muted) return;
  tone(ctx.currentTime, go ? 1320 : 660, 0.12, go ? 0.35 : 0.16, 'square');
}

export function playBuzzer() {
  if (!ctx || muted) return;
  tone(ctx.currentTime, 180, 0.16, 0.8, 'sawtooth', 150);
}

export function playSwish() {
  if (!ctx || muted) return;
  noiseBurst(ctx.currentTime, 'bandpass', 3200, 1.2, 0.3, 0.02, 0.22);
}

export function playRim(strength: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  tone(t, 420, Math.min(0.25, 0.08 + strength * 0.03), 0.25, 'triangle', 380);
  tone(t, 1130, Math.min(0.12, 0.04 + strength * 0.015), 0.18, 'sine');
}

export type Surface = 'grass' | 'water' | 'wood' | 'hard';

/** One footstep; quiet on grass, splashy in the streams, hollow on the bridges. */
export function playStep(surface: Surface, speed: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const s = Math.min(1, speed / 8);
  if (surface === 'water') {
    noiseBurst(t, 'bandpass', 1000 + Math.random() * 600, 1.1, 0.08 + s * 0.08, 0.01, 0.22);
    tone(t + 0.03, 420 + Math.random() * 220, 0.02, 0.07, 'sine', 900);
  } else if (surface === 'wood') {
    tone(t, 200 + Math.random() * 40, 0.06 + s * 0.05, 0.09, 'triangle', 130);
    noiseBurst(t, 'bandpass', 1800, 1, 0.025, 0.002, 0.04);
  } else if (surface === 'hard') {
    noiseBurst(t, 'highpass', 2600, 0.7, 0.018 + s * 0.02, 0.002, 0.03);
  } else {
    noiseBurst(t, 'bandpass', 2400 + Math.random() * 900, 0.9, 0.01 + s * 0.018, 0.004, 0.05);
  }
}

/** Chiptune blip for the arcade. */
export function playBlip(freq: number) {
  if (!ctx || muted) return;
  tone(ctx.currentTime, freq, 0.045, 0.07, 'square');
}

/** Wood or plastic knocking together: pins, dominoes, cans. */
export function playClack(strength: number) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const s = Math.min(1, strength);
  tone(t, 900 + Math.random() * 500, 0.03 + s * 0.06, 0.05, 'triangle', 500);
  noiseBurst(t, 'highpass', 2200, 0.8, 0.02 + s * 0.05, 0.002, 0.03);
}

/** A crate splintering apart. */
export function playCrack() {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  thump(t, 140, 50, 0.35, 0.16);
  noiseBurst(t, 'bandpass', 1500, 0.8, 0.35, 0.002, 0.12);
  noiseBurst(t + 0.04, 'bandpass', 2600, 1.2, 0.2, 0.002, 0.08);
  tone(t + 0.02, 420, 0.06, 0.12, 'square', 180);
}
