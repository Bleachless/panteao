"use client";

// Os sons do Panteão, sintetizados na hora com Web Audio: nenhum arquivo de áudio, nada de direitos de terceiros.
// O navegador só libera o áudio depois de um toque, então o contexto nasce no primeiro clique.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function unlockAudio() {
  audio();
}

/** O mesmo contexto de áudio, para a trilha de batalha. */
export function audioContext(): AudioContext | null {
  return audio();
}

export function isMuted() {
  return muted;
}

function tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number; attack?: number } = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(freq, t);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const vol = opts.vol ?? 0.3;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.008));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function noise(at: number, dur: number, opts: { vol?: number; from?: number; to?: number; type?: BiquadFilterType; q?: number } = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = opts.type ?? "bandpass";
  filter.Q.value = opts.q ?? 1.2;
  filter.frequency.setValueAtTime(opts.from ?? 800, t);
  if (opts.to) filter.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
  const gain = c.createGain();
  gain.gain.setValueAtTime(opts.vol ?? 0.25, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

const SOUNDS = {
  /** Lâmina cortando o ar. */
  ataque: () => {
    noise(0, 0.28, { from: 500, to: 3200, vol: 0.32, q: 0.9 });
    tone(240, 0.02, 0.18, { type: "sawtooth", to: 120, vol: 0.06 });
  },
  /** Pancada surda; quanto maior o dano, mais grave e mais forte. */
  dano: (amount = 4) => {
    const heavy = Math.min(1, amount / 12);
    tone(130 - heavy * 50, 0, 0.32 + heavy * 0.2, { to: 45, vol: 0.32 + heavy * 0.2 });
    noise(0, 0.14 + heavy * 0.1, { type: "lowpass", from: 1400, to: 300, vol: 0.28 });
  },
  /** Metal batendo em metal. */
  defesa: () => {
    tone(1250, 0, 0.32, { type: "triangle", vol: 0.16 });
    tone(1873, 0, 0.18, { type: "square", vol: 0.04 });
    noise(0, 0.05, { from: 4000, vol: 0.12 });
  },
  /** Arpejo que sobe. */
  cura: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.35, { vol: 0.12 })),
  /** Brilho de estrelas. */
  milagre: () => [1319, 1760, 2093, 2637].forEach((f, i) => tone(f, i * 0.05, 0.5, { type: "triangle", vol: 0.06 })),
  /** Acorde desafinado e torto. */
  mazela: () => {
    tone(196, 0, 0.5, { type: "sawtooth", to: 150, vol: 0.05 });
    tone(207, 0, 0.5, { type: "sawtooth", to: 155, vol: 0.05 });
  },
  /** Queda longa. */
  queda: () => {
    tone(523, 0, 0.9, { type: "triangle", to: 98, vol: 0.18 });
    noise(0.1, 0.8, { type: "lowpass", from: 900, to: 120, vol: 0.12 });
  },
  /** Fanfarra. */
  vitoria: () => {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(f, i * 0.13, 0.45, { type: "triangle", vol: 0.14 }));
    [523, 659, 784].forEach((f) => tone(f * 2, 0.55, 1.2, { type: "sine", vol: 0.08 }));
  },
  /** Moedas. */
  troca: () => {
    tone(2093, 0, 0.12, { vol: 0.08 });
    tone(2637, 0.07, 0.16, { vol: 0.08 });
  },
  /** Trompa grave chamando o guardião. */
  guardiao: () => {
    tone(196, 0, 0.6, { type: "sawtooth", vol: 0.06, attack: 0.08 });
    tone(294, 0.18, 0.6, { type: "sawtooth", vol: 0.05, attack: 0.08 });
    noise(0, 0.4, { type: "lowpass", from: 600, vol: 0.06 });
  },
  /** Gongo cósmico: o céu inteiro sente. */
  prodigio: () => {
    [110, 165, 221, 331].forEach((f, i) => tone(f, 0, 2.2 - i * 0.3, { vol: 0.16 - i * 0.03 }));
    [1760, 2349, 2794].forEach((f, i) => tone(f, 0.25 + i * 0.08, 0.9, { type: "triangle", vol: 0.04 }));
  },
  /** Sino da sua vez. */
  turno: () => {
    tone(880, 0, 0.5, { vol: 0.12 });
    tone(1320, 0.09, 0.6, { vol: 0.09 });
  },
  /** A torcida: ruído filtrado subindo e caindo, com uma ondulação de muitas vozes. */
  torcida: () => {
    const c = audio();
    if (!c || !master) return;
    const t = c.currentTime;
    const dur = 2.6;
    const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buffer;
    const band = c.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 0.6;
    const wobble = c.createGain();
    const lfo = c.createOscillator();
    lfo.frequency.value = 7;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain).connect(wobble.gain);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.22, t + 0.5);
    gain.gain.setValueAtTime(0.22, t + 1.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(band).connect(wobble).connect(gain).connect(master);
    src.start(t);
    lfo.start(t);
    lfo.stop(t + dur);
  },
  /** Relógio apertando. */
  tick: () => tone(1500, 0, 0.04, { type: "square", vol: 0.03 }),
} as const;

export type SoundName = keyof typeof SOUNDS;

export function play(name: SoundName, amount?: number) {
  if (muted) return;
  try {
    if (name === "dano") SOUNDS.dano(amount);
    else SOUNDS[name]();
  } catch {
    // Sem áudio no aparelho: o jogo segue mudo.
  }
}
