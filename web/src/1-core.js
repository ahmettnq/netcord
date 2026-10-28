'use strict';
/* =====================================================================
   NETCORD · core: math helpers, tennis constants, courts, rivals,
   save data and the synthesized audio engine.
   Units are metres and seconds. Court centre is the origin, x is across
   the court, z runs baseline to baseline, y is up. The human plays the
   +z half, the opponent plays the -z half.
   ===================================================================== */
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[(Math.random() * arr.length) | 0];
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random()); };
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const dampAngle = (a, b, k, dt) => a + angDiff(a, b) * (1 - Math.exp(-k * dt));
const $ = id => document.getElementById(id);

const COURT = {
  HL: 11.885,   // half length (baseline z)
  SW: 4.115,    // singles half width
  DW: 5.485,    // doubles half width
  SV: 6.40,     // service line z
  NETC: 0.914,  // net height at centre
  NETP: 1.07,   // net height at posts
  NETW: 6.40,   // net half width incl. posts
  RX: 9.15,     // run-off half width (fence)
  RZ: 18.0      // run-off half length (fence)
};

/* Surface physics: e = vertical restitution, mu = sliding friction.
   Clay grips (slow, high), grass skids (fast, low), hard is in between. */
const COURTS = {
  clay: {
    id: 'clay', name: 'Riviera Clay Club', short: 'Clay', tag: 'High, heavy bounce. Long rallies.',
    e: 0.80, mu: 0.82, swatch: 'linear-gradient(135deg,#d0683a,#b9512a)', board: 'RIVIERA · CENTRE'
  },
  grass: {
    id: 'grass', name: 'Hollyhock Lawn Club', short: 'Grass', tag: 'Low skid. Serves fly.',
    e: 0.69, mu: 0.40, swatch: 'linear-gradient(135deg,#7fae4f,#5f9138)', board: 'HOLLYHOCK · NO.1'
  },
  hard: {
    id: 'hard', name: 'Harbour Hard Courts', short: 'Hard', tag: 'True bounce. All-court tennis.',
    e: 0.76, mu: 0.60, swatch: 'linear-gradient(135deg,#3d79b8,#2a5f97)', board: 'HARBOUR · CT 2'
  }
};

/* Rivals: speed m/s, reaction s, accuracy 0..1, power 0..1, aggression,
   net = tendency to attack the net, lob/drop tendencies, serve power. */
const RIVALS = [
  { id: 'pip', name: 'Pip Harlow', short: 'PIP', style: 'Club regular · loves a lob', court: 'clay',
    speed: 4.6, reaction: 0.30, accuracy: 0.45, power: 0.35, aggression: 0.25, net: 0.05, lob: 0.35, drop: 0.05, serve: 0.35, judge: 0.4,
    shirt: 0xe7a33e, shorts: 0x2d3a4a, skin: 0xf1c7a1, hair: 0x6b3d21, cap: 0xe7a33e, lefty: false },
  { id: 'marisol', name: 'Marisol Vance', short: 'MARISOL', style: 'Counterpuncher · gets everything back', court: 'clay',
    speed: 5.4, reaction: 0.20, accuracy: 0.62, power: 0.45, aggression: 0.35, net: 0.05, lob: 0.25, drop: 0.08, serve: 0.45, judge: 0.65,
    shirt: 0x8a4fb0, shorts: 0xf4efe4, skin: 0xc98b5e, hair: 0x231711, cap: 0xf4efe4, lefty: true },
  { id: 'teodor', name: 'Teodor Lund', short: 'TEODOR', style: 'Big server · short points', court: 'grass',
    speed: 5.0, reaction: 0.17, accuracy: 0.62, power: 0.78, aggression: 0.6, net: 0.2, lob: 0.05, drop: 0.04, serve: 0.92, judge: 0.7,
    shirt: 0xf4efe4, shorts: 0xf4efe4, skin: 0xf3cfb0, hair: 0xd9b25a, cap: 0x1d4f8c, lefty: false },
  { id: 'juno', name: 'Juno Akande', short: 'JUNO', style: 'Serve and volley · rushes the net', court: 'grass',
    speed: 5.6, reaction: 0.15, accuracy: 0.68, power: 0.62, aggression: 0.65, net: 0.75, lob: 0.06, drop: 0.12, serve: 0.72, judge: 0.75,
    shirt: 0x2f8f6a, shorts: 0x173a2a, skin: 0x7a4a2c, hair: 0x15100c, cap: null, lefty: false },
  { id: 'rafe', name: 'Rafe Okoro', short: 'RAFE', style: 'Baseline grinder · heavy topspin', court: 'hard',
    speed: 5.8, reaction: 0.12, accuracy: 0.76, power: 0.72, aggression: 0.55, net: 0.12, lob: 0.12, drop: 0.08, serve: 0.7, judge: 0.85,
    shirt: 0xd4483a, shorts: 0x1c1c22, skin: 0x5e3a24, hair: 0x0e0b09, cap: 0x1c1c22, lefty: true },
  { id: 'saskia', name: 'Saskia Moreau', short: 'SASKIA', style: 'Club champion · no weaknesses', court: 'hard',
    speed: 6.2, reaction: 0.08, accuracy: 0.86, power: 0.84, aggression: 0.7, net: 0.35, lob: 0.12, drop: 0.14, serve: 0.86, judge: 0.95,
    shirt: 0x15263f, shorts: 0x15263f, skin: 0xe9b995, hair: 0x3a1f12, cap: 0xf4efe4, lefty: false }
];

/* Quick-match difficulty overlays applied to a rival's personality. */
const DIFFICULTY = {
  easy:   { label: 'Easy',   speed: 0.82, reaction: 1.7, accuracy: 0.65, power: 0.75 },
  normal: { label: 'Normal', speed: 1.0,  reaction: 1.0, accuracy: 1.0,  power: 1.0 },
  hard:   { label: 'Hard',   speed: 1.1,  reaction: 0.6, accuracy: 1.15, power: 1.12 }
};

const FORMATS = {
  short:   { label: 'Short set', sub: 'First to 4 games', games: 4, sets: 1 },
  classic: { label: 'Classic set', sub: 'First to 6, tiebreak', games: 6, sets: 1 },
  match:   { label: 'Best of 3', sub: 'Sets to 4 games', games: 4, sets: 3 }
};

const SPEEDS = { relaxed: 0.66, normal: 0.8, pro: 0.95 };

/* ---------------- Save data ---------------- */
const SAVE_KEY = 'netcord.save.v1';
/* When running inside the iOS app, the native shell keeps a copy of the
   save in UserDefaults and injects it before the page loads, so progress
   survives even if the web view's storage is cleared. */
const NATIVE = window.webkit && window.webkit.messageHandlers ? window.webkit.messageHandlers : null;
const DEFAULT_SAVE = {
  settings: { speed: 'normal', assist: 'assist', pixel: 0, quality: 'auto', cam: 'diorama', sfx: true, voice: true, guides: true, haptics: true, tod: 'day' },
  career: { rung: 0 },
  quick: { court: 'clay', rival: 'marisol', difficulty: 'normal', format: 'short', tod: 'day' },
  stats: { played: 0, won: 0, aces: 0, longest: 0, fastest: 0 },
  flags: { intro: false, tut: false }
};
function loadSave() {
  let s = null;
  try { if (window.__NATIVE_SAVE) s = JSON.parse(window.__NATIVE_SAVE); } catch (e) { s = null; }
  if (!s) try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { s = null; }
  const out = JSON.parse(JSON.stringify(DEFAULT_SAVE));
  if (s && typeof s === 'object') for (const k of Object.keys(out)) if (s[k]) Object.assign(out[k], s[k]);
  return out;
}
const SAVE = loadSave();
function persist() {
  const j = JSON.stringify(SAVE);
  try { localStorage.setItem(SAVE_KEY, j); } catch (e) { /* storage blocked */ }
  try { if (NATIVE && NATIVE.save) NATIVE.save.postMessage(j); } catch (e) { /* not in the app */ }
}

/* ---------------- Haptics ----------------
   In the iOS app these go to Core Haptics through a message handler:
   i = intensity 0..1, s = sharpness 0..1, d = length of a soft tail in
   seconds (0 = a single crisp tap). Elsewhere, a short vibration. */
const Haptics = {
  send(msg, ms) {
    if (!SAVE.settings.haptics) return;
    try {
      if (NATIVE && NATIVE.haptic) { NATIVE.haptic.postMessage(msg); return; }
      if (navigator.vibrate && ms) navigator.vibrate(ms);
    } catch (e) { /* no haptics here */ }
  },
  hit(power, perfect) {
    // a clean strike is sharp and heavy with a short ringing tail, a weak one is soft
    this.send({ i: clamp(power, 0.15, 1), s: perfect ? 0.95 : 0.45 + power * 0.3, d: perfect ? 0.07 : 0 }, Math.round(10 + power * 18));
  },
  tap(i = 0.4) { this.send({ i, s: 0.5, d: 0 }, 8); },
  notify(type) { this.send({ n: type }, type === 'success' ? 30 : 0); }
};

/* ---------------- Audio (all synthesized, no files) ---------------- */
class Audio {
  constructor() { this.ctx = null; this.master = null; this.amb = null; this.enabled = true; this.noiseBuf = null; }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.startAmbience();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (typeof Umpire !== 'undefined') Umpire.load();
    this.loadHit();
  }
  /* the recorded racket strike (HIT_CLIP in 8-voice.js); the synth below stays as the fallback and adds weight */
  loadHit() {
    if (this.hitBuf || this._hitLoading || !this.ctx || typeof HIT_CLIP === 'undefined') return;
    this._hitLoading = true;
    try {
      const bin = atob(HIT_CLIP), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const ok = b => { this.hitBuf = b; }, bad = () => { this._hitLoading = false; };
      const p = this.ctx.decodeAudioData(u8.buffer, ok, bad); if (p && p.catch) p.catch(bad);
    } catch (e) { this._hitLoading = false; }
  }
  get ok() { return this.ctx && this.enabled; }
  noise(dur, freq, q, gain, type = 'bandpass', when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.02);
  }
  tone(freq, dur, gain, type = 'sine', slide = 0, when = 0) {
    const c = this.ctx, t = c.currentTime + when;
    const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  hit(power = 0.6, perfect = false, kind = 'top') {
    if (!this.ok) return;
    const p = clamp(power, 0.2, 1.2);
    if (this.hitBuf) {
      // the recorded strike: harder shots are louder and a touch lower, slices a touch brighter, each one varied slightly
      const c = this.ctx, s = c.createBufferSource(), g = c.createGain();
      s.buffer = this.hitBuf;
      s.playbackRate.value = clamp((kind === 'slice' ? 1.07 : kind === 'lob' ? 1.02 : 0.98) - (p - 0.6) * 0.1 + rand(-0.04, 0.04), 0.85, 1.2);
      g.gain.value = clamp(0.42 + p * 0.7, 0.4, 1.15);
      s.connect(g); g.connect(this.master); s.start();
    } else {
      // string "pock": a short bright noise burst plus a hollow body tone
      this.noise(0.05 + p * 0.02, kind === 'slice' ? 1300 : 1900, 1.4, 0.55 * p + 0.15);
      this.tone(kind === 'slice' ? 330 : 420, 0.07, 0.35 * p + 0.1, 'triangle', 0.55);
      this.tone(160, 0.09, 0.25 * p, 'sine', 0.6);
    }
    // weight: a low thump that grows with pace, so big hits feel big
    this.tone(70 + p * 25, 0.12, 0.18 * p, 'sine', 0.5);
    if (perfect) { this.noise(0.12, 3200, 3, 0.18); this.tone(880, 0.12, 0.08, 'sine', 1.02, 0.01); this.noise(0.05, 6000, 0.8, 0.12, 'highpass'); }
  }
  bounce(surface, v) {
    if (!this.ok) return;
    const k = clamp(v / 9, 0.15, 1);
    if (surface === 'clay') { this.noise(0.07, 520, 1.2, 0.35 * k); this.tone(120, 0.06, 0.25 * k, 'sine', 0.6); }
    else if (surface === 'grass') { this.noise(0.05, 380, 0.9, 0.22 * k); this.tone(95, 0.05, 0.18 * k, 'sine', 0.7); }
    else { this.noise(0.04, 1500, 1.6, 0.3 * k); this.tone(190, 0.05, 0.25 * k, 'sine', 0.6); }
  }
  whoosh() { if (!this.ok) return; this.noise(0.16, 900, 0.7, 0.12, 'bandpass'); this.noise(0.1, 2400, 1.2, 0.04, 'bandpass', 0.03); }
  net() { if (!this.ok) return; this.noise(0.18, 260, 0.8, 0.5); this.noise(0.25, 2200, 6, 0.06); this.tone(90, 0.15, 0.25, 'sine', 0.5); }
  cord() { if (!this.ok) return; this.tone(150, 0.2, 0.3, 'sawtooth', 0.5); this.noise(0.2, 900, 2, 0.15); }
  step(surface) { if (!this.ok) return; this.noise(0.035, surface === 'clay' ? 700 : surface === 'hard' ? 2600 : 500, 1, surface === 'hard' ? 0.05 : 0.07); }
  click() { if (!this.ok) return; this.tone(660, 0.05, 0.08, 'triangle', 1.3); }
  applause(intensity = 1) {
    if (!this.ok) return;
    const n = Math.round(40 + 70 * intensity);
    for (let i = 0; i < n; i++) {
      const when = Math.pow(Math.random(), 0.7) * (1.4 + intensity);
      this.noise(0.025, rand(900, 2600), 1.2, rand(0.03, 0.09) * intensity, 'bandpass', when);
    }
  }
  ooh() {
    if (!this.ok) return;
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 6; i++) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      const f = rand(150, 260); o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 0.82, t + 0.9);
      const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 700;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.025, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + 1.0);
      o.connect(flt); flt.connect(g); g.connect(this.master); o.start(t); o.stop(t + 1.05);
    }
  }
  chime(win) {
    if (!this.ok) return;
    const notes = win ? [523.3, 659.3, 784, 1046.5] : [440, 349.2];
    notes.forEach((f, i) => this.tone(f, 0.4, 0.09, 'triangle', 1, i * 0.09));
  }
  startAmbience() {
    // soft crowd murmur: brown-ish noise through a low-pass with a slow swell
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = c.createGain(); g.gain.value = 0.0;
    s.connect(f); f.connect(g); g.connect(this.master); s.start();
    this.amb = g;
  }
  setAmbience(v) { if (this.amb) this.amb.gain.setTargetAtTime(this.enabled ? v : 0, this.ctx.currentTime, 0.6); }
  bird() { if (!this.ok) return; const f = rand(2600, 4200); for (let i = 0; i < 3; i++) this.tone(f * rand(0.9, 1.1), 0.08, 0.015, 'sine', rand(1.2, 1.5), i * 0.11); }
  cricket() { if (!this.ok) return; for (let i = 0; i < 4; i++) this.tone(4400, 0.03, 0.01, 'square', 1, i * 0.05); }
}
const SFX = new Audio();

/* Chair umpire voice through the platform speech engine (works in iOS WebView). */
const Umpire = {
  buf: null, loading: false, live: [], last: null,
  /* Recorded umpire words (UMPIRE_CLIPS in 8-voice.js), decoded once the audio engine is unlocked. */
  load() {
    if (this.buf || this.loading || !SFX.ctx || typeof UMPIRE_CLIPS === 'undefined') return;
    this.loading = true; const ctx = SFX.ctx, out = {}; let left = 0;
    const done = () => { if (--left <= 0) { this.buf = out; this.loading = false; } };
    for (const [w, b64] of Object.entries(UMPIRE_CLIPS)) {
      left++;
      try {
        const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const ok = b => { out[w] = b; done(); }, bad = () => done();
        const p = ctx.decodeAudioData(u8.buffer, ok, bad); if (p && p.catch) p.catch(bad);
      } catch (e) { done(); }
    }
  },
  /* Turn a call like "Game, set and match, Rowe." into recorded words with natural gaps.
     Returns false (so the speech engine takes over) if any word has no recording. */
  clips(text) {
    if (!this.buf || !SFX.ctx || !SFX.enabled) return false;
    const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen'];
    const toks = (String(text).toLowerCase().match(/[a-z0-9']+|[,.;:!?]+/g) || []).map(t => /^\d+$/.test(t) ? (NUM[+t] || t) : t);
    const seq = []; let gap = 0;
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (/^[,;:]+$/.test(t)) { gap = Math.max(gap, 0.4); continue; }
      if (/^[.!?]+$/.test(t)) { gap = Math.max(gap, 0.62); continue; }
      let w = t, two = toks[i + 1] ? t + ' ' + toks[i + 1] : null;
      if (two && this.buf[two]) { w = two; i++; }
      if (!this.buf[w]) return false;
      seq.push([w, gap]); gap = 0.16;
    }
    if (!seq.length) return false;
    for (const s of this.live) { try { s.stop(); } catch (e) { /* already ended */ } }
    this.live = [];
    const c = SFX.ctx; let t = c.currentTime + 0.4;
    const g = c.createGain(); g.gain.value = 1.15; g.connect(SFX.master);
    for (const [w, gp] of seq) {
      const b = this.buf[w], s = c.createBufferSource(); s.buffer = b; s.connect(g);
      t += gp; s.start(t); this.live.push(s); t += Math.max(0.12, b.duration - 0.01);
    }
    this.last = seq.map(x => x[0]).join(' ');
    return true;
  },
  say(text) {
    if (!SAVE.settings.voice || !SAVE.settings.sfx) return;
    this.load();
    if (this.clips(text)) return;
    try { if (NATIVE && NATIVE.speak) { NATIVE.speak.postMessage(text); return; } } catch (e) { /* fall through */ }
    try {
      const ss = window.speechSynthesis; if (!ss) return;
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98; u.pitch = 0.92; u.volume = 0.85; u.lang = 'en-GB';
      ss.speak(u);
    } catch (e) { /* speech not available */ }
  }
};
