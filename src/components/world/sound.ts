/** Tiny synthesized sound effects, so the world ships without audio files. */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

const VOLUME = 0.55;

export function initAudio() {
  if (ctx) {
    void ctx.resume();
    return;
  }
  const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return;
  ctx = new AudioCtor();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  master.connect(ctx.destination);

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

export function setMuted(value: boolean) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : VOLUME, ctx.currentTime, 0.02);
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
