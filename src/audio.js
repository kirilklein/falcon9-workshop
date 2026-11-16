// Tiny synthesized sound kit (no audio files). Unlocked on first touch.
import { hash } from './util.js';
let ctx = null, master = null, rumbleG = null, noiseBuf = null, muted = false, voice = null;

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
    rumbleG = ctx.createGain(); rumbleG.gain.value = 0;
    src.connect(lp); lp.connect(rumbleG); rumbleG.connect(master); src.start();
  } catch (e) { ctx = null; }
}

function tone(f0, f1, dur, type = 'sine', vol = 0.3, delay = 0) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, freq) {
  if (!ctx || muted) return;
  const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = 'bandpass'; f.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02);
}

export const snap = () => { tone(1500, 500, 0.07, 'square', 0.16); noise(0.05, 0.4, 3200); tone(240, 140, 0.14, 'sine', 0.35, 0.02); };
export const boop = () => tone(340, 190, 0.24, 'sine', 0.28);
export const tick = () => tone(900, 700, 0.03, 'square', 0.07);
export const pick = () => tone(520, 780, 0.09, 'triangle', 0.2);
export const whoosh = () => noise(0.4, 0.14, 700);
export const beep = hi => tone(hi ? 1040 : 660, hi ? 1040 : 660, hi ? 0.5 : 0.18, 'triangle', 0.3);
export const tada = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.28, 'triangle', 0.25, i * 0.1));
export const clunk = () => { tone(190, 70, 0.2, 'sine', 0.45); noise(0.09, 0.3, 500); };
export function rumble(v) { if (ctx && rumbleG) rumbleG.gain.setTargetAtTime(muted ? 0 : v * 0.9, ctx.currentTime, 0.08); }
export function setMuted(m) { muted = m; if (m) { rumble(0); speak(); } }
// narration clips are made by tools/narrate.mjs; a missing clip is simply silent
export function speak(text) {
  if (voice) voice.pause();
  if (!text || muted) return;
  voice = new Audio(`audio/${hash(text)}.mp3`); voice.play().catch(() => {});
}
