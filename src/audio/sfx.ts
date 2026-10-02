// Tiny synthesised sound effects, so the game ships no audio files.
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

function ac(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, opts: { type?: OscillatorType; gain?: number; delay?: number; slide?: number } = {}) {
  const a = ac();
  if (!a || muted) return;
  const t0 = a.currentTime + (opts.delay ?? 0);
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = opts.type ?? "sine";
  o.frequency.setValueAtTime(freq, t0);
  if (opts.slide) o.frequency.exponentialRampToValueAtTime(opts.slide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.15, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

function noise(dur: number, gain = 0.2, highpass = 1500, delay = 0) {
  const a = ac();
  if (!a || muted) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = "highpass";
  f.frequency.value = highpass;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + delay);
}

/** A short heel impact followed by a softer sole scuff on the classroom floor. */
function footstep(index: number, volume = 1, position = 0) {
  const a = ac();
  if (!a || muted || volume <= 0) return;
  const at = a.currentTime;
  const len = Math.floor(a.sampleRate * 0.16);
  const buffer = a.createBuffer(1, len, a.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / a.sampleRate;
    const heel = Math.exp(-t * 65);
    const toe = t > 0.045 ? 0.4 * Math.exp(-(t - 0.045) * 55) : 0;
    samples[i] = (Math.random() * 2 - 1) * (heel + toe);
  }

  const pan = a.createStereoPanner();
  pan.pan.value = Math.max(-0.8, Math.min(0.8, position + (index % 2 ? -0.13 : 0.13)));
  pan.connect(a.destination);

  const scrape = a.createBufferSource();
  scrape.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = index % 2 ? 700 : 850;
  const scrapeGain = a.createGain();
  scrapeGain.gain.value = 0.16 * volume;
  scrape.connect(filter).connect(scrapeGain).connect(pan);
  scrape.start(at);

  const thud = a.createOscillator();
  thud.type = "sine";
  thud.frequency.setValueAtTime(index % 2 ? 86 : 94, at);
  thud.frequency.exponentialRampToValueAtTime(52, at + 0.12);
  const thudGain = a.createGain();
  thudGain.gain.setValueAtTime(0.0001, at);
  thudGain.gain.exponentialRampToValueAtTime(0.09 * volume, at + 0.008);
  thudGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
  thud.connect(thudGain).connect(pan);
  thud.start(at);
  thud.stop(at + 0.14);
}

export const sfx = {
  unlock: () => tone(880, 0.08, { type: "triangle", gain: 0.08 }),
  tap: () => tone(600, 0.04, { type: "triangle", gain: 0.05 }),
  shutter: () => {
    noise(0.05, 0.35, 2500);
    noise(0.07, 0.25, 1800, 0.07);
  },
  shutterQuiet: () => tone(1200, 0.03, { type: "square", gain: 0.02 }),
  ring: () => [0, 0.18, 0.36, 0.54].forEach((d, i) => tone(i % 2 ? 1320 : 990, 0.15, { type: "square", gain: 0.07, delay: d })),
  buzz: () => tone(90, 0.35, { type: "sawtooth", gain: 0.08 }),
  ping: () => {
    tone(1046, 0.12, { gain: 0.12 });
    tone(1568, 0.2, { gain: 0.1, delay: 0.1 });
  },
  pencil: () => noise(0.12, 0.12, 3000),
  step: footstep,
  door: () => {
    tone(180, 0.5, { type: "sawtooth", gain: 0.025, slide: 120 });
    noise(0.12, 0.2, 400, 0.45);
  },
  bell: () => [0, 0.25].forEach((d) => tone(1318, 0.9, { type: "sine", gain: 0.09, delay: d })),
  alert: () => tone(440, 0.25, { type: "square", gain: 0.06, slide: 660 }),
  heartbeat: (strength: number) => {
    tone(60, 0.12, { gain: 0.25 * strength });
    tone(55, 0.12, { gain: 0.18 * strength, delay: 0.16 });
  },
  caught: () => {
    tone(392, 0.25, { type: "sawtooth", gain: 0.1 });
    tone(311, 0.25, { type: "sawtooth", gain: 0.1, delay: 0.25 });
    tone(233, 0.6, { type: "sawtooth", gain: 0.1, delay: 0.5 });
  },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, { type: "triangle", gain: 0.1, delay: i * 0.11 })),
  siren: () => [0, 0.4, 0.8].forEach((d) => tone(700, 0.38, { type: "sawtooth", gain: 0.06, delay: d, slide: 1100 })),
};
