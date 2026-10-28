"use client";

import { audioContext } from "./sfx";

// A trilha de batalha do Panteão, composta na hora com Web Audio: tambores taiko, baixo em ostinato,
// cordas, coro e metais em ré menor (Rém – Si♭ – Fá – Dó), com reverb de catedral. Nada de arquivo de áudio.
// A intensidade sobe no Crepúsculo e na Lua de Sangue: tambores dobrados e caixa marcando o tempo.

const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
/** Fundamental de cada acorde (Hz, oitava 2) e as notas do acorde (semitons acima da fundamental). */
const PROGRESSION: { root: number; chord: number[] }[] = [
  { root: 73.42, chord: [0, 3, 7] }, // Rém
  { root: 58.27, chord: [0, 4, 7] }, // Si♭
  { root: 87.31, chord: [0, 4, 7] }, // Fá
  { root: 65.41, chord: [0, 4, 7] }, // Dó
];
/** Padrão dos tambores em colcheias: 1 = taiko grave, 2 = taiko médio. */
const TAIKO = [1, 0, 0, 2, 1, 0, 2, 0];
const TAIKO_HEAVY = [1, 0, 2, 2, 1, 2, 2, 1];
/** Melodia do coro/metais, uma nota por meio compasso (semitons acima de Ré 4; null = pausa). */
const MELODY: (number | null)[] = [0, 3, 7, 5, 3, null, 2, 3, 5, 7, 8, 7, 5, 3, 2, null];

const semi = (base: number, n: number) => base * Math.pow(2, n / 12);

type Bus = { out: GainNode; dry: GainNode; wet: ConvolverNode };

let bus: Bus | null = null;
let timer: number | undefined;
let nextTime = 0;
let step = 0;
let intensity = 0;
let playing = false;

function impulse(c: AudioContext, seconds: number) {
  const length = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.6);
  }
  return buffer;
}

function getBus(c: AudioContext): Bus {
  if (bus) return bus;
  const out = c.createGain();
  out.gain.value = 0;
  out.connect(c.destination);
  const dry = c.createGain();
  dry.gain.value = 0.8;
  dry.connect(out);
  const wet = c.createConvolver();
  wet.buffer = impulse(c, 3.2);
  const wetGain = c.createGain();
  wetGain.gain.value = 0.45;
  wet.connect(wetGain).connect(out);
  bus = { out, dry, wet };
  return bus;
}

function send(c: AudioContext, node: AudioNode, reverb = 0.5) {
  const b = getBus(c);
  node.connect(b.dry);
  if (reverb > 0) {
    const g = c.createGain();
    g.gain.value = reverb;
    node.connect(g).connect(b.wet);
  }
}

function taiko(c: AudioContext, t: number, heavy: boolean) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.setValueAtTime(heavy ? 70 : 110, t);
  osc.frequency.exponentialRampToValueAtTime(heavy ? 38 : 62, t + 0.35);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(heavy ? 0.9 : 0.5, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + (heavy ? 0.7 : 0.4));
  osc.connect(gain);
  send(c, gain, 0.35);
  osc.start(t);
  osc.stop(t + 0.8);
  // O couro do tambor: um estalo de ruído grave.
  const len = Math.floor(c.sampleRate * 0.08);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 900;
  const g = c.createGain();
  g.gain.value = heavy ? 0.35 : 0.2;
  src.connect(f).connect(g);
  send(c, g, 0.3);
  src.start(t);
}

function snare(c: AudioContext, t: number) {
  const len = Math.floor(c.sampleRate * 0.18);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = 1800;
  const g = c.createGain();
  g.gain.value = 0.22;
  src.connect(f).connect(g);
  send(c, g, 0.4);
  src.start(t);
}

function bass(c: AudioContext, t: number, freq: number, dur: number) {
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = freq;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = 380;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(f).connect(g);
  send(c, g, 0.15);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Cordas: três serras desafinadas por nota, abrindo devagar, num filtro que respira. */
function strings(c: AudioContext, t: number, freqs: number[], dur: number) {
  for (const freq of freqs) {
    for (const detune of [-9, 0, 8]) {
      const osc = c.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(600, t);
      f.frequency.linearRampToValueAtTime(1600, t + dur * 0.5);
      f.frequency.linearRampToValueAtTime(700, t + dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.022, t + 0.6);
      g.gain.setValueAtTime(0.022, t + dur - 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
      osc.connect(f).connect(g);
      send(c, g, 0.7);
      osc.start(t);
      osc.stop(t + dur + 0.4);
    }
  }
}

/** Coro: senoides com vibrato e um pouco de triângulo, como um "ahh" distante. */
function choir(c: AudioContext, t: number, freq: number, dur: number, brass: boolean) {
  const lfo = c.createOscillator();
  lfo.frequency.value = 5.2;
  const lfoGain = c.createGain();
  lfoGain.gain.value = freq * 0.012;
  lfo.connect(lfoGain);
  for (const [type, mult, vol] of [
    ["sine", 1, 0.05],
    ["triangle", 2, 0.015],
    [brass ? "sawtooth" : "sine", 0.5, brass ? 0.03 : 0.025],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq * mult;
    lfoGain.connect(osc.frequency);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = brass ? 1800 : 2400;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.25);
    g.gain.setValueAtTime(vol, t + dur - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.25);
    osc.connect(f).connect(g);
    send(c, g, 0.8);
    osc.start(t);
    osc.stop(t + dur + 0.3);
  }
  lfo.start(t);
  lfo.stop(t + dur + 0.3);
}

/** Agenda uma colcheia (meio tempo) da trilha no instante t. */
function scheduleStep(c: AudioContext, t: number, s: number) {
  const eighth = s % 8;
  const bar = Math.floor(s / 8);
  const chord = PROGRESSION[Math.floor(bar / 2) % PROGRESSION.length];
  const heavy = intensity > 0;
  const pattern = heavy ? TAIKO_HEAVY : TAIKO;
  if (pattern[eighth]) taiko(c, t, pattern[eighth] === 1);
  if (heavy && (eighth === 2 || eighth === 6)) snare(c, t);
  // Baixo em colcheias, oitava acima no fim do compasso.
  bass(c, t, eighth === 6 || eighth === 7 ? chord.root * 2 : chord.root, BEAT / 2 - 0.02);
  // Cordas a cada dois compassos, no tempo 1.
  if (eighth === 0 && bar % 2 === 0) strings(c, t, chord.chord.map((n) => semi(chord.root * 4, n)), BAR * 2);
  // Coro (e metais na intensidade alta) a cada meio compasso.
  if (eighth === 0 || eighth === 4) {
    const note = MELODY[(bar * 2 + eighth / 4) % MELODY.length];
    if (note !== null) choir(c, t, semi(293.66, note), BAR / 2 - 0.05, heavy);
  }
}

function tick() {
  const c = audioContext();
  if (!c) return;
  // Agenda tudo o que cai nos próximos 300 ms.
  while (nextTime < c.currentTime + 0.3) {
    scheduleStep(c, nextTime, step);
    nextTime += BEAT / 2;
    step = (step + 1) % (8 * 16);
  }
}

export function startMusic() {
  const c = audioContext();
  if (!c || playing) return;
  playing = true;
  const b = getBus(c);
  b.out.gain.cancelScheduledValues(c.currentTime);
  b.out.gain.setValueAtTime(b.out.gain.value, c.currentTime);
  b.out.gain.linearRampToValueAtTime(0.55, c.currentTime + 2.5);
  nextTime = c.currentTime + 0.1;
  step = 0;
  tick();
  timer = window.setInterval(tick, 80);
}

export function stopMusic(fade = 1.2) {
  const c = audioContext();
  if (!c || !playing) return;
  playing = false;
  window.clearInterval(timer);
  const b = getBus(c);
  b.out.gain.cancelScheduledValues(c.currentTime);
  b.out.gain.setValueAtTime(b.out.gain.value, c.currentTime);
  b.out.gain.linearRampToValueAtTime(0, c.currentTime + fade);
}

/** 0 = batalha normal; 1 = Crepúsculo ou Lua de Sangue (tambores dobrados e caixa). */
export function setIntensity(level: number) {
  intensity = level;
}

/** A abertura da partida: três pancadas de taiko, metais subindo e o gongo. */
export function playOpening() {
  const c = audioContext();
  if (!c) return;
  const t = c.currentTime + 0.05;
  getBus(c).out.gain.setValueAtTime(0.7, t);
  [0, 0.32, 0.64].forEach((d, i) => taiko(c, t + d, i !== 1));
  taiko(c, t + 1.0, true);
  taiko(c, t + 1.0, true);
  strings(c, t + 1.0, [146.83, 220, 293.66], 2.6);
  choir(c, t + 1.0, 293.66, 2.4, true);
  choir(c, t + 1.0, 440, 2.4, true);
  // Gongo: parciais graves que demoram a morrer.
  for (const [f, v] of [
    [55, 0.25],
    [82.4, 0.15],
    [110.7, 0.1],
    [147.9, 0.06],
  ]) {
    const osc = c.createOscillator();
    osc.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t + 1.0);
    g.gain.exponentialRampToValueAtTime(v, t + 1.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 5);
    osc.connect(g);
    send(c, g, 0.6);
    osc.start(t + 1.0);
    osc.stop(t + 5.1);
  }
}
