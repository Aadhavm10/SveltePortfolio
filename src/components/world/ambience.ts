import { useFrame } from '@react-three/fiber';
import { pondDistance, streamDistance } from './env/mask';
import { POND, WATERFALL, ZEN_GARDEN } from './layout';
import { audioGraph } from './sound';
import { bodies } from './store';

interface Layers {
  brook: GainNode;
  bubbles: BiquadFilterNode[];
  falls: GainNode;
  wind: GainNode;
  windFilter: BiquadFilterNode;
}

let layers: Layers | null = null;
const near = { brook: 0, falls: 0, zen: 0, pond: 0 };
const next = { check: 0, bird: 4, chime: 0, plop: 6 };

/** Major pentatonic wind-chime notes (C6 and up). */
const CHIMES = [1046.5, 1174.7, 1318.5, 1568, 1760, 2093];

function loop(ctx: AudioContext, buffer: AudioBuffer) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  source.start(0, Math.random() * buffer.duration);
  return source;
}

/** Starts the always-on layers (brook, falls, wind); their levels follow the player. */
export function startAmbience() {
  const g = audioGraph();
  if (!g || layers) return;
  const { ctx, ambience, noise, brown } = g;

  // Babbling brook: white noise through two narrow band-passes whose centres keep wandering.
  const brook = ctx.createGain();
  brook.gain.value = 0;
  brook.connect(ambience);
  const bubbles = [650, 1250].map((f) => {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = 3;
    loop(ctx, noise).connect(band).connect(brook);
    return band;
  });
  const hiss = ctx.createBiquadFilter();
  hiss.type = 'bandpass';
  hiss.frequency.value = 2400;
  hiss.Q.value = 0.4;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.25;
  loop(ctx, noise).connect(hiss).connect(hissGain).connect(brook);

  // Waterfall: a soft, steady roar.
  const falls = ctx.createGain();
  falls.gain.value = 0;
  falls.connect(ambience);
  const roar = ctx.createBiquadFilter();
  roar.type = 'lowpass';
  roar.frequency.value = 1300;
  loop(ctx, noise).connect(roar).connect(falls);
  const rumble = ctx.createGain();
  rumble.gain.value = 0.6;
  loop(ctx, brown).connect(rumble).connect(falls);

  // Wind: low rumble that swells and settles.
  const wind = ctx.createGain();
  wind.gain.value = 0;
  wind.connect(ambience);
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 400;
  windFilter.Q.value = 0.8;
  loop(ctx, brown).connect(windFilter).connect(wind);

  layers = { brook, bubbles, falls, wind, windFilter };
}

function panned(ctx: AudioContext, destination: AudioNode, pan: number) {
  if (!ctx.createStereoPanner) return destination;
  const panner = ctx.createStereoPanner();
  panner.pan.value = pan;
  panner.connect(destination);
  return panner;
}

function chirp(ctx: AudioContext, dest: AudioNode, t: number, from: number, to: number, length: number, peak: number) {
  const osc = ctx.createOscillator();
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(dest);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

/** A few kinds of songbird: quick tweets, a falling whistle, and a trill. */
function bird(ctx: AudioContext, dest: AudioNode, t: number) {
  const voice = Math.random();
  const peak = 0.035 + Math.random() * 0.035;
  const out = panned(ctx, dest, Math.random() * 1.6 - 0.8);
  if (voice < 0.45) {
    const base = 3000 + Math.random() * 1400;
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) chirp(ctx, out, t + i * (0.11 + Math.random() * 0.04), base, base * 1.3, 0.07, peak);
  } else if (voice < 0.8) {
    const base = 2300 + Math.random() * 600;
    const notes = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < notes; i++) chirp(ctx, out, t + i * 0.32, base, base * 0.68, 0.24, peak * 0.9);
  } else {
    const osc = ctx.createOscillator();
    osc.frequency.value = 3600 + Math.random() * 600;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 22 + Math.random() * 10;
    const depth = ctx.createGain();
    depth.gain.value = 350;
    lfo.connect(depth).connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak * 0.6, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    osc.connect(gain).connect(out);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + 0.52);
    lfo.stop(t + 0.52);
  }
}

/** A wind chime: a bell-like tone with an inharmonic overtone and a long ring. */
function chime(ctx: AudioContext, dest: AudioNode, t: number, freq: number, peak: number) {
  for (const [ratio, level, ring] of [
    [1, 1, 2.6],
    [2.76, 0.25, 1.1],
    [5.4, 0.08, 0.5]
  ]) {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(peak * level, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + ring + 0.05);
  }
}

/** A koi breaking the surface. */
function plop(ctx: AudioContext, dest: AudioNode, t: number, peak: number) {
  chirp(ctx, dest, t, 900 + Math.random() * 300, 260, 0.09, peak);
  chirp(ctx, dest, t + 0.06, 1400, 700, 0.05, peak * 0.4);
}

function level(param: AudioParam, value: number, ctx: AudioContext) {
  param.setTargetAtTime(value, ctx.currentTime, 0.35);
}

/** Moves the ambience mix with the player: louder by the water, chimes by the zen garden. */
function update(x: number, z: number) {
  const g = audioGraph();
  if (!g || !layers) return;
  const { ctx, ambience } = g;
  const now = ctx.currentTime;

  if (now >= next.check) {
    next.check = now + 0.15;
    const toStream = streamDistance(x, z);
    const toPond = (pondDistance(x, z) - 1) * Math.min(POND.rx, POND.rz);
    const toFalls = Math.hypot(x - WATERFALL.x, z - WATERFALL.z);
    near.brook = Math.max(0, 1 - Math.max(0, Math.min(toStream, toPond + 3)) / 16) ** 2;
    near.falls = Math.max(0, 1 - toFalls / 30) ** 2;
    near.zen = Math.max(0, 1 - Math.hypot(x - ZEN_GARDEN.x, z - ZEN_GARDEN.z) / 22);
    near.pond = Math.max(0, 1 - Math.max(0, toPond) / 14);
    level(layers.brook.gain, 0.02 + near.brook * 0.32, ctx);
    level(layers.falls.gain, near.falls * 0.22, ctx);
    // The brook's bubbles wander so it never sounds like a steady hiss.
    layers.bubbles.forEach((band, i) => band.frequency.setTargetAtTime((i ? 1000 : 450) + Math.random() * (i ? 900 : 500), now, 0.06));
    // Wind gusts slowly.
    const gust = 0.5 + 0.5 * Math.sin(now * 0.21) * Math.sin(now * 0.13 + 1);
    level(layers.wind.gain, 0.03 + gust * 0.055, ctx);
    layers.windFilter.frequency.setTargetAtTime(280 + gust * 320, now, 0.5);
  }

  if (now >= next.bird) {
    // Fewer birds over the roar of the falls.
    if (Math.random() > near.falls * 0.7) bird(ctx, ambience, now + 0.05);
    next.bird = now + 2.5 + Math.random() * 7;
  }
  if (near.zen > 0 && now >= next.chime) {
    const notes = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) {
      chime(ctx, ambience, now + 0.05 + i * (0.18 + Math.random() * 0.3), CHIMES[Math.floor(Math.random() * CHIMES.length)], 0.05 * near.zen);
    }
    next.chime = now + 2 + Math.random() * 5;
  }
  if (near.pond > 0 && now >= next.plop) {
    plop(ctx, ambience, now + 0.05, 0.07 * near.pond);
    next.plop = now + 5 + Math.random() * 9;
  }
}

/** Feeds the player's position to the ambience mix every frame. */
export function Ambience() {
  useFrame(() => {
    const p = bodies.player?.translation();
    if (p) update(p.x, p.z);
  });
  return null;
}
