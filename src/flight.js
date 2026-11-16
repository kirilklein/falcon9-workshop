// Stylized launch. Everything is a pure function of flight time t, so the
// sequence can be paused, rewound and replayed with the very same meshes.
import * as THREE from 'three';
import { track, sstep, lerp } from './util.js';
import { HOME } from './rocket.js';
import { PAD, LZ } from './hangar.js';

export const T_END = 32;
export const T = { liftoff: 3, sep: 10, fairing: 13.6, land: 22.2, deploy: 25.5 };
export const CHAPTERS = [
  { t: 2.5, icon: '🚀', name: 'Старт' }, { t: 9.3, icon: '✂️', name: 'Ступени разделяются', text: 'Первая ступень отделяется. Дальше летит вторая!' }, { t: 13.2, icon: '🛡️', name: 'Обтекатель раскрывается', text: 'Мы уже в космосе. Обтекатель раскрывается.' },
  { t: 18, icon: '🛬', name: 'Первая ступень возвращается домой', text: 'Первая ступень возвращается домой и садится на ножки.' }, { t: 25, icon: '🛰️', name: 'Спутник летит сам', text: 'Спутник полетел сам. Счастливого пути!' },
];
// spoken countdown, indexed by the number shown (0 = launch)
export const COUNT = [{ text: 'Пуск!' }, { text: 'Один' }, { text: 'Два' }, { text: 'Три' }, { text: 'Четыре' }, { text: 'Пять' }, { text: 'Шесть' }, { text: 'Семь' }, { text: 'Восемь' }, { text: 'Девять' }, { text: 'Десять' }];

const PXc = PAD.x, TWO_PI = Math.PI * 2;
const stackY = track([[0, 0], [3, 0], [4, 0.7], [6, 12], [8, 34], [10, 60], [12.5, 74], [16, 90], [20, 104], [24, 110], [32, 112]]);
const boY = track([[10, 60], [11.6, 65], [13.5, 62], [17, 44], [19.5, 14], [21, 4.2], [22.2, 0.05], [32, 0.05]]);
const boX = track([[10, PXc], [12, PXc + 0.6], [18, 7.5], [20.3, LZ.x], [32, LZ.x]]);
const flip = track([[10.6, 0], [13.4, TWO_PI]]);
const roll = track([[3.5, 0], [8, Math.PI / 2]]);       // roll so the nose cone opens left/right for the camera
const upTilt = track([[16.5, 0], [22, -1.15], [32, -1.25]]);
const upX = track([[16.5, 0], [24, 5], [32, 8]]);

const V = () => new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const qRoll = new THREE.Quaternion();
const F = { t: -1, upC: V(), boC: V(), stackC: V(), sepC: V(), noseC: V(), satC: V(), qU: new THREE.Quaternion(), qB: new THREE.Quaternion() };

function calc(t) {
  if (t === F.t) return F; F.t = t;
  const sy = PAD.y + stackY(t);
  qRoll.setFromAxisAngle(Y, roll(t));
  F.upC.set(PXc + upX(t), sy + 5.85, 0); F.qU.setFromAxisAngle(Z, upTilt(t)).multiply(qRoll);
  if (t > T.sep) { F.boC.set(boX(t), PAD.y + boY(t) + 2.55, 0); F.qB.setFromAxisAngle(Z, -flip(t)).multiply(qRoll); }
  else { F.boC.set(PXc, sy + 2.55, 0); F.qB.copy(qRoll); }
  F.stackC.set(PXc, sy + 4.3, 0);
  F.sepC.addVectors(F.boC, F.upC).multiplyScalar(0.5);
  F.satOff = 2.4 * sstep(T.deploy, 29, t);
  F.noseC.set(0, HOME.fairing + 0.8 - 5.85, 0).applyQuaternion(F.qU).add(F.upC);
  F.satC.set(0, HOME.satellite + 0.35 - 5.85 + F.satOff, 0).applyQuaternion(F.qU).add(F.upC);
  F.main = sstep(2.2, 3, t) * (1 - sstep(9.8, 10, t));
  F.burn = sstep(19.2, 19.6, t) * (1 - sstep(22.1, 22.3, t));
  F.up = sstep(10.5, 11, t) * (1 - sstep(23.5, 24.5, t));
  return F;
}
export const thrust = t => { calc(t); return Math.max(F.main, 0.45 * F.up, 0.7 * F.burn); };

function puff(m, age, c, a, spread, rise, life) {
  if (age <= 0 || age >= life) { m.visible = false; return; }
  const e = 1 - Math.exp(-age * 1.1);
  m.visible = true; m.position.set(c.x + Math.cos(a) * (0.5 + spread * e), c.y + 0.3 + rise * age, c.z + Math.sin(a) * (0.5 + spread * e) * 0.8);
  m.scale.setScalar(0.7 + 1.7 * e); m.material.opacity = 0.85 * (1 - age / life);
}
export function hideFx(hangar) { for (const m of hangar.puffs) m.visible = false; }

export function apply(t, rocket, hangar, time) {
  calc(t);
  const P = rocket.P, root = rocket.root;
  const place = (p, C, q, off) => { p.group.position.set(0, off, 0).applyQuaternion(q).add(C).sub(PAD); p.group.quaternion.copy(q); p.group.scale.setScalar(1); };
  root.position.copy(PAD); root.rotation.set(0, 0, 0);
  place(P.booster, F.boC, F.qB, -2.55); place(P.interstage, F.boC, F.qB, HOME.interstage - 2.55);
  place(P.upper, F.upC, F.qU, HOME.upper - 5.85); place(P.fairing, F.upC, F.qU, HOME.fairing - 5.85);
  place(P.satellite, F.upC, F.qU, HOME.satellite - 5.85 + F.satOff);

  const legs = sstep(18.3, 20.3, t), fins = sstep(10.6, 11.8, t), flick = 1 + 0.1 * Math.sin(time * 43) + 0.05 * Math.sin(time * 71);
  P.booster.legs.forEach(l => { l.rotation.z = -2.2 * legs; });
  P.interstage.fins.forEach(f => { f.rotation.z = fins * Math.PI / 2; });
  const bf = P.booster.flame, on = F.main > 0.01 || F.burn > 0.01;
  bf.visible = on;
  if (on) { const w = F.main > 0.01 ? 1 : 0.5, len = F.main > 0.01 ? F.main : 0.55 * F.burn; bf.scale.set(w, Math.max(0.01, len * flick), w); }
  const uf = P.upper.flame; uf.visible = F.up > 0.01; if (uf.visible) uf.scale.set(1, Math.max(0.01, F.up * flick), 1);

  const s = t - T.fairing; // the two fairing halves part, tip outward and drift away
  P.fairing.halves.forEach((h, i) => {
    const sg = i ? -1 : 1;
    if (s <= 0) { h.position.set(0, 0, 0); h.rotation.set(0, 0, 0); h.scale.setScalar(1); h.visible = true; return; }
    const sc = 1 - sstep(2.6, 4, s);
    h.position.set(0, -0.35 * Math.pow(Math.max(0, s - 1), 2), sg * (0.9 * sstep(0, 1.4, s) + 0.5 * Math.max(0, s - 1.2)));
    h.rotation.set(sg * Math.min(0.3 * s, 1.2), 0, 0); h.scale.setScalar(Math.max(sc, 0.001)); h.visible = sc > 0.01;
  });
  const un = sstep(26.2, 28.2, t);
  P.satellite.panels.forEach(pn => { pn.rotation.z = (1 - un) * Math.PI / 2; });

  hangar.puffs.forEach((m, i) => {
    if (i < 16) puff(m, t - (2.3 + (i % 5) * 0.22), PAD, i / 16 * TWO_PI + (i % 2) * 0.2, 2.4 + (i % 3) * 0.8, 0.25, 6);
    else puff(m, t - (21.4 + (i % 3) * 0.2), LZ, i / 10 * TWO_PI, 2, 0.15, 3.5);
  });
}

// Flight camera: keyframes that look at moving things; blended in from the
// workshop camera over the first moments so there is no cut at launch.
const KEYS = [
  { t: 0, look: 'stackC', dir: [0.35, 0.12, 1], d: 1.0 }, { t: 3, look: 'stackC', dir: [0.35, 0.12, 1], d: 1.0 },
  { t: 6, look: 'stackC', dir: [0.55, -0.22, 1], d: 1.2 }, { t: 9.6, look: 'stackC', dir: [0.6, 0.05, 1], d: 1.25 },
  { t: 11.8, look: 'sepC', dir: [0.45, 0.1, 1], d: 1.5 },
  { t: 13.4, look: 'noseC', dir: [0.2, 0.3, 1], d: 0.55 }, { t: 16.4, look: 'noseC', dir: [0.2, 0.3, 1], d: 0.6 },
  { t: 18.4, look: 'boC', dir: [-0.5, 0.12, 1], d: 1.0 }, { t: 21.6, look: 'boC', dir: [-0.65, 0.3, 1], d: 1.15 }, { t: 23.2, look: 'boC', dir: [-0.65, 0.3, 1], d: 1.15 },
  { t: 25.6, look: 'satC', dir: [0.3, 0.25, 1], d: 0.55 }, { t: 32, look: 'satC', dir: [0.5, 0.3, 1], d: 0.5 },
];
for (const k of KEYS) k.n = new THREE.Vector3(...k.dir).normalize();
const pa = V(), pb = V();
export function camera(t, D, pos, look, time) {
  calc(t);
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
  const a = KEYS[i], b = KEYS[i + 1], w = sstep(a.t, b.t, t), blend = sstep(0, 1.6, t);
  pa.copy(F[a.look]).addScaledVector(a.n, a.d * D); pb.copy(F[b.look]).addScaledVector(b.n, b.d * D); pa.lerp(pb, w);
  pb.lerpVectors(F[a.look], F[b.look], w);
  const shake = 0.07 * F.main * sstep(2.5, 3.5, t) * (1 - sstep(5, 8, t));
  pa.x += shake * Math.sin(time * 31); pa.y += shake * Math.sin(time * 47);
  pos.lerp(pa, blend); look.lerp(pb, blend);
}
