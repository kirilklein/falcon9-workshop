// Falcon 9 Rocket Workshop — one scene, one camera, one set of rocket meshes.
import * as THREE from 'three';
import { buildRocket, INFO, HOME, ORDER, TOTAL } from './rocket.js';
import { buildHangar, PAD, AX_Y, BENCH_TOP } from './hangar.js';
import { clamp, lerp, sstep, ease, damp } from './util.js';
import * as sfx from './audio.js';
import * as flight from './flight.js';
import { buildEngine, INTRO, APART_HINT, STEPS } from './engine.js';

const $ = s => document.querySelector(s);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const DAY = new THREE.Color(0xc4e6f8), SPACE = new THREE.Color(0x0a0f2c);
scene.background = DAY.clone();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2500);
const rocket = buildRocket(), root = rocket.root, parts = rocket.P;
scene.add(root);
const hangar = buildHangar(scene);
const eng = buildEngine(); scene.add(eng.group);

// ---------------------------------------------------------------- state
// "Bench coordinates" for a part: x = distance along the rocket axis from the
// base, y = height above the axis, z = toward the front of the bench.
const LIE = V(-TOTAL / 2, AX_Y, 0);                    // rocket base when lying on the bench
const SPREAD = { booster: -1.3, interstage: -0.55, upper: 0.2, satellite: 1.45, fairing: 1.45 };
const TRAY = {};                                        // where loose pieces rest on the parts mat
{
  let x = -5.95;
  for (const id of ['upper', 'fairing', 'booster', 'satellite', 'interstage']) {
    const i = INFO[id];
    TRAY[id] = V(x - i.lo - LIE.x, BENCH_TOP + 0.03 + i.r - AX_Y, 2.5);
    x += i.hi - i.lo + 0.45;
  }
}
const ENG_OUT = V(LIE.x - 2, AX_Y, 0.9), ENG_S = 0.6;        // where the big engine floats, and its size
const homeV = id => V(HOME[id], 0, 0);
for (const id of ORDER) Object.assign(parts[id], { pos: homeV(id), placed: true, reveal: 0, lift: 0, pop: 0, hl: 0, tween: null });

const S = {
  mode: 'explore', t: 0, spread: 0, spreadGoal: 0, zoom: 1,
  focus: null, camFocus: null, revealOn: false,
  selected: null, drag: null, doneTimer: 0, pendingScatter: false, ring: null,
  standU: 0, ft: 0, playing: false, seek: null,
  engOut: 0, step: 0, cd: 0, sayT: 0,
};
const allPlaced = () => ORDER.every(id => parts[id].placed);
const busy = () => ORDER.some(id => parts[id].tween);

// ---------------------------------------------------------------- camera rig
// The camera is always "orbit pose" (target, azimuth, elevation, distance).
// Every frame a goal pose is computed for whatever the child is looking at and
// the rig spring-damps toward it, so any change of goal (tap a part, Back
// half-way, mode switch) continues from the current camera — never a cut.
let aspect = 1;
const defaults = () => {
  const port = aspect < 1;
  return { explore: { az: port ? -1.25 : 0.5, el: port ? 0.85 : 0.36 }, build: { az: port ? -1.3 : 0.2, el: port ? 0.95 : 0.75 }, launch: { az: 0.33, el: 0.1 } };
};
let views = defaults(), userMoved = false;
const fview = { az: 1.2, el: 0.5 };
const rig = { tx: 0, ty: AX_Y, tz: 0, az: 0.5, el: 0.36, d: 20 }, G = { ...rig };
const camPos = V(), camLook = V();
const pool = Array.from({ length: 96 }, () => V()); let poolN = 0;
const pv = (x, y, z) => pool[poolN++].set(x, y, z);
const MX = 0.9, MY = 0.74;

function fitDist(n, t, az, el) { // distance so that pool[0..n) fits the screen when looking at t
  const ce = Math.cos(el), fx = -ce * Math.sin(az), fy = -Math.sin(el), fz = -ce * Math.cos(az);
  const rl = Math.hypot(fz, fx), rx = -fz / rl, rz = fx / rl;            // right = f × up
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;             // up = right × f
  const tv = Math.tan(camera.fov * Math.PI / 360), th = tv * aspect;
  let D = 1;
  for (let i = 0; i < n; i++) {
    const p = pool[i], qx = p.x - t.x, qy = p.y - t.y, qz = p.z - t.z;
    const depth = qx * fx + qy * fy + qz * fz;
    D = Math.max(D, Math.abs(qx * rx + qz * rz) / (MX * th) - depth, Math.abs(qx * ux + qy * uy + qz * uz) / (MY * tv) - depth);
  }
  return D;
}
function partCorners(id, padZ = 0) {
  const g = parts[id].group.position, i = INFO[id];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [i.lo, i.hi])
    pv(g.x + sx * i.r, g.y + y, g.z + sz * (i.r + padZ)).applyMatrix4(root.matrixWorld);
}
const bbC = V(), bbMin = V(), bbMax = V();
function bboxCenter(n) {
  bbMin.setScalar(1e9); bbMax.setScalar(-1e9);
  for (let i = 0; i < n; i++) { bbMin.min(pool[i]); bbMax.max(pool[i]); }
  return bbC.addVectors(bbMin, bbMax).multiplyScalar(0.5);
}
function computeGoal() {
  poolN = 0; let v, k = 1, t;
  if (S.mode === 'launch') {
    v = views.launch;
    for (const x of [-0.75, 0.75]) for (const z of [-0.75, 0.75]) for (const y of [-2.4, TOTAL]) pv(x, y, z).applyMatrix4(root.matrixWorld); // extra room below for the GO button
    t = bboxCenter(poolN);
  } else if (S.camFocus === 'engine') {
    v = fview; const B = eng.box();
    for (const x of B.x) for (const y of B.y) for (const z of B.z) pv(x, y, z).multiplyScalar(ENG_S).add(ENG_OUT);
    t = bboxCenter(poolN);
  } else if (S.camFocus) {
    v = fview; const id = S.camFocus, i = INFO[id];
    const noseP = id === 'fairing' || id === 'satellite';
    partCorners(id, noseP ? 0.75 : 0);
    t = bboxCenter(poolN);
    t.lerp(pool[poolN].set(0, TOTAL / 2, 0).applyMatrix4(root.matrixWorld), 0.15); // lean toward the whole rocket
    k = noseP ? 1.05 : 1.2 + 0.45 * (1 - (i.hi - i.lo) / 4.2);                                    // keep neighbours in view
  } else if (S.mode === 'build') {
    v = views.build;
    for (const a of [-1.6, 10.2]) for (const h of [-0.7, 0.8]) for (const z of [-0.75, 3.45]) pv(LIE.x + a, AX_Y + h, z);
    t = bboxCenter(poolN);
  } else {
    v = views.explore;
    for (const id of ORDER) partCorners(id);
    t = bboxCenter(poolN);
  }
  G.tx = t.x; G.ty = t.y; G.tz = t.z; G.az = v.az; G.el = v.el;
  G.d = fitDist(poolN, t, v.az, v.el) * k * S.zoom;
}
function rigToCam() {
  const ce = Math.cos(rig.el);
  camPos.set(rig.tx + rig.d * ce * Math.sin(rig.az), rig.ty + rig.d * Math.sin(rig.el), rig.tz + rig.d * ce * Math.cos(rig.az));
  camLook.set(rig.tx, rig.ty, rig.tz);
}
const camErr = () => Math.hypot(rig.tx - G.tx, rig.ty - G.ty, rig.tz - G.tz) + Math.abs(rig.d - G.d) * 0.5 + (Math.abs(rig.az - G.az) + Math.abs(rig.el - G.el)) * 4;

// ---------------------------------------------------------------- explore
function focusPart(id) {
  if (S.focus === id) return;
  const nose = id === 'fairing' || id === 'satellite';
  const keep = nose && (S.focus === 'fairing' || S.focus === 'satellite');
  if (!keep) { // nose parts are viewed so the halves part left/right on screen: from above, or from the nose end
    const e = views.explore, behind = e.az < 0;
    fview.az = nose && !behind ? 1.2 : e.az;
    fview.el = nose ? (behind ? Math.max(e.el, 1.08) : 0.5) : clamp(e.el, 0.3, 0.9);
  }
  S.focus = id; S.camFocus = id; S.revealOn = keep && S.revealOn;
  say(INFO[id]); sfx.whoosh();
}
function say(i) { $('#bIcon').textContent = i.icon; $('#bText').textContent = i.text; const b = $('#bubble'); b.hidden = true; void b.offsetWidth; b.hidden = false; sfx.speak(i.text); S.sayT = 0; }
function focusEngine() {
  if (S.focus === 'engine') return;
  fview.az = 0.6; fview.el = 0.22;
  Object.assign(S, { focus: 'engine', camFocus: 'engine', step: 0 }); eng.reset();
  say(INTRO); sfx.whoosh();
}
function setStep(n) {
  S.step = n;
  if (!n) return say(APART_HINT);
  eng.focus.goal = 0; say(STEPS[n - 1]); if (STEPS[n - 1].pop) eng.pop(STEPS[n - 1].pop); sfx.pick();
}
function back(all) { // one level up inside the engine; all: leave whatever is focused
  if (!S.focus) return;
  if (!all && S.focus === 'engine' && eng.up()) { say(eng.focus.info); sfx.whoosh(); return; }
  S.focus = null; $('#bubble').hidden = true; sfx.speak(); sfx.whoosh();
}

// ---------------------------------------------------------------- build
function moveTo(p, to, dur, arc = 0, delay = 0, done = null) { p.tween = { from: p.pos.clone(), to: to.clone(), t: -delay, dur, arc, done }; }
function scatter() {
  ORDER.slice().reverse().forEach((id, i) => { const p = parts[id]; p.placed = false; moveTo(p, TRAY[id], 0.75, 0.9, i * 0.1); });
  refreshDots(); sfx.whoosh();
}
function snapIn(id) {
  const p = parts[id]; p.placed = true; p.pop = 1; S.ring = { t: 0, y: HOME[id] };
  sfx.snap(); if (navigator.vibrate) navigator.vibrate(18);
  refreshDots();
  if (allPlaced() && S.mode === 'build') { sfx.tada(); S.doneTimer = 1.2; }
}
function place(id, dur, arc) {
  if (id === 'fairing' && !parts.satellite.placed) { sendBack(id, 'satellite'); return; } // satellite goes in first
  S.selected = null; moveTo(parts[id], homeV(id), dur, arc, 0, () => snapIn(id));
}
function sendBack(id, hint = id) { // gently return to the bench and light up where it belongs
  S.selected = null; moveTo(parts[id], TRAY[id], 0.6, 0.5);
  parts[hint].hl = 2.8; if (hint !== id) parts[hint].pop = 1;
  sfx.boop();
}
function tryDrop(id) {
  const p = parts[id], i = INFO[id];
  if (Math.abs(p.pos.x - HOME[id]) < 0.75 + 0.2 * (i.hi - i.lo) && Math.abs(p.pos.z) < 1.25) place(id, 0.2, 0);
  else sendBack(id);
}
function refreshDots() { [...$('#dots').children].forEach((d, i) => d.classList.toggle('on', parts[ORDER[i]].placed)); }

// ---------------------------------------------------------------- modes
function setMode(m) {
  if (m === 'launch' && !allPlaced()) { nudge($('[data-mode=build]')); sfx.boop(); return; }
  if (m === S.mode) return;
  back(true); Object.assign(S, { selected: null, drag: null, spreadGoal: 0, playing: false, seek: null, doneTimer: 0, pendingScatter: false, cd: 0, mode: m });
  if (m === 'build') { if (allPlaced()) S.pendingScatter = true; }
  else for (const id of ORDER) { const p = parts[id]; if (!p.placed) moveTo(p, homeV(id), 0.6, 0.6, 0, () => { p.placed = true; refreshDots(); }); }
  sfx.whoosh();
}
function reset() {
  sfx.clunk(); S.zoom = 1; views = defaults(); userMoved = false;
  if (S.mode === 'build') { back(true); S.selected = null; S.drag = null; S.doneTimer = 0; S.pendingScatter = true; }
  else if (S.mode !== 'explore') setMode('explore');
  else { back(true); S.spreadGoal = 0; }
}
function nudge(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

// ---------------------------------------------------------------- per-frame layout
function setGhost(p, r) {
  for (const m of p.shells) {
    m.opacity = 1 - 0.8 * r; const tr = r > 0.01;
    if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; }
  }
  for (const i of p.inner) i.visible = r > 0.02;
}
function layoutRoot() {
  const s = ease(clamp((S.standU - 0.15) / 0.65, 0, 1));
  root.position.lerpVectors(LIE, PAD, s); root.position.y += 0.8 * Math.sin(Math.PI * s);
  root.rotation.set(0, 0, -Math.PI / 2 * (1 - s));
}
function layoutParts(dt) {
  for (const id of ORDER) {
    const p = parts[id], tw = p.tween;
    if (tw) {
      tw.t += dt; const k = ease(clamp(tw.t / tw.dur, 0, 1));
      p.pos.lerpVectors(tw.from, tw.to, k); p.pos.y += tw.arc * Math.sin(Math.PI * k);
      if (tw.t >= tw.dur) { p.pos.copy(tw.to); p.tween = null; if (tw.done) tw.done(); }
    }
    if (S.drag && S.drag.id === id) p.pos.y = lerp(p.pos.y, 0.3, 1 - Math.exp(-dt * 10));
    damp(p, 'lift', S.selected === id && !S.drag && !p.tween ? 1 : 0, 0.15, dt);
    p.pop = Math.max(0, p.pop - dt * 2.6); p.hl = Math.max(0, p.hl - dt);
    const h = p.pos.y + p.lift * (0.3 + 0.04 * Math.sin(S.t * 5));
    p.group.position.set(-h, p.pos.x + SPREAD[id] * S.spread, p.pos.z);
    p.group.quaternion.identity(); p.group.scale.setScalar(1 + 0.14 * Math.sin(p.pop * Math.PI));
    // outline at the snap point
    const gh = rocket.ghosts[id], on = S.mode === 'build' && !p.placed && S.standU === 0;
    gh.group.visible = on;
    if (on) {
      const hot = p.hl > 0 || S.selected === id;
      gh.mesh.material.color.setHex(hot ? 0xffd600 : 0x29b6f6); gh.line.material.color.setHex(hot ? 0xf59f00 : 0x0277bd);
      gh.mesh.material.opacity = hot ? 0.38 + 0.22 * Math.sin(S.t * 9) : 0.2;
      gh.group.scale.setScalar(hot ? 1.03 + 0.03 * Math.sin(S.t * 9) : 1);
    }
  }
  // reveals on the model itself
  const P = parts, rf = P.fairing.reveal;
  P.fairing.halves.forEach((h, i) => { h.position.set(0, 0, (i ? -1 : 1) * 0.95 * rf); h.rotation.set(0, 0, 0); h.scale.setScalar(1); h.visible = true; });
  P.satellite.panels.forEach(pn => { pn.rotation.z = (1 - P.satellite.reveal) * Math.PI / 2; });
  P.satellite.lamp.visible = (S.t * 2) % 1 < 0.5;
  setGhost(P.booster, P.booster.reveal); setGhost(P.upper, P.upper.reveal); setGhost(P.interstage, P.interstage.reveal);
  P.booster.legs.forEach(l => { l.rotation.z = 0; });
  P.interstage.fins.forEach(f => { f.rotation.z = P.interstage.reveal * Math.PI / 2; });
  P.booster.flame.visible = P.upper.flame.visible = false;
  if (S.ring) {
    const r = rocket.ring, k = (S.ring.t += dt) / 0.45;
    r.visible = k < 1; r.position.y = S.ring.y; r.scale.setScalar(0.8 + 1.3 * k); r.material.opacity = 1 - k;
    if (k >= 1) S.ring = null;
  }
}
const hook = V(-2.2, 4.6, -2.4), hookT = V(), REST = V(-2.2, 4.6, -2.4), PARK = V(1.5, 9.6, 0), nose = V();
function updateCrane(dt) {
  let id = S.mode === 'build' ? (S.drag ? S.drag.id : S.selected || ORDER.find(i => parts[i].tween && parts[i].tween.t > 0)) : null;
  const u = S.standU;
  if (id) { const i = INFO[id]; parts[id].group.localToWorld(hookT.set(0, (i.lo + i.hi) / 2, 0)); hookT.y += i.r + 0.35; }
  else {
    root.localToWorld(nose.set(0, TOTAL + 0.05, 0)); nose.y += 0.1;
    if (u <= 0) hookT.copy(REST);
    else if (u < 0.15) hookT.lerpVectors(REST, nose, ease(u / 0.15));
    else if (u < 0.8) hookT.copy(nose);
    else hookT.lerpVectors(nose, PARK, ease((u - 0.8) / 0.2));
  }
  hook.lerp(hookT, 1 - Math.exp(-dt * (u > 0 ? 30 : 9)));
  hangar.crane.setHook(hook);
}

// ---------------------------------------------------------------- main update
function update(dt) {
  S.t += dt;
  if (S.doneTimer > 0 && (S.doneTimer -= dt) <= 0) setMode('launch');
  const prevStand = S.standU;
  if (S.sayT > 0 && (S.sayT -= dt) <= 0) $('#bubble').hidden = true;
  if (S.mode === 'launch') {
    if (S.cd > 0) { if ((S.cd -= dt) <= 0) { S.cd = 0; S.ft = 0.001; S.playing = true; } } // 10…4, then the flight's own 3-2-1
    else if (S.seek) {
      const k = S.seek; k.t += dt; S.ft = lerp(k.from, k.to, ease(clamp(k.t / k.dur, 0, 1)));
      if (k.t >= k.dur) { S.seek = null; S.playing = true; }
    } else if (S.playing) {
      const prev = S.ft; S.ft = Math.min(flight.T_END, S.ft + dt); flightSounds(prev, S.ft);
      if (S.ft >= flight.T_END) S.playing = false;
    }
    if (allPlaced() && !busy()) S.standU = Math.min(1, S.standU + dt / 6);
  } else if (S.ft > 0) S.ft = Math.max(0, S.ft - dt * 28);          // rewind the flight before laying down
  else if (S.standU > 0) S.standU = Math.max(0, S.standU - dt / 2.4);
  if (prevStand < 1 && S.standU >= 1) sfx.tada();
  if (S.pendingScatter && S.mode === 'build' && S.ft === 0 && S.standU === 0) { S.pendingScatter = false; scatter(); }

  damp(S, 'spread', S.spreadGoal, 0.3, dt);
  layoutRoot(); root.updateMatrixWorld(true);

  // camera goal, then gate the reveal on the camera having (nearly) arrived
  computeGoal();
  if (S.focus && !S.revealOn && camErr() < 1.1) S.revealOn = true;
  let maxR = 0;
  for (const id of ORDER) {
    const on = S.focus && S.revealOn && (S.focus === id || (S.focus === 'satellite' && id === 'fairing'));
    damp(parts[id], 'reveal', on ? 1 : 0, 0.3, dt);
    parts[id].reveal = clamp(parts[id].reveal, 0, 1); maxR = Math.max(maxR, parts[id].reveal);
  }
  damp(S, 'engOut', S.focus === 'engine' ? 1 : 0, 0.35, dt);
  if (!S.focus && S.camFocus && Math.max(maxR, S.engOut) < 0.4) S.camFocus = null;    // Back: close first, then glide out

  layoutParts(dt);
  { // the big engine grows out of the booster's base and stands upright
    const k = ease(clamp(S.engOut, 0, 1)), g = eng.group;
    g.visible = k > 0.01; g.position.lerpVectors(LIE, ENG_OUT, k); g.rotation.z = -Math.PI / 2 * (1 - k); g.scale.setScalar(lerp(0.2, ENG_S, k));
    if (g.visible) eng.update(S.focus === 'engine' ? S.step : 0, S.t, dt);
  }
  if (flight) { if (S.ft > 0) flight.apply(S.ft, rocket, hangar, S.t); else flight.hideFx(hangar); }
  root.updateMatrixWorld(true);
  updateCrane(dt);

  for (const k of ['tx', 'ty', 'tz', 'az', 'el', 'd']) damp(rig, k, G[k], 0.5, dt);
  rigToCam();
  if (flight && S.ft > 0) flight.camera(S.ft, flightD(), camPos, camLook, S.t);
  camera.position.copy(camPos); camera.lookAt(camLook); camera.updateMatrixWorld();
  const sky = sstep(26, 85, camera.position.y);
  scene.background.copy(DAY).lerp(SPACE, sky); hangar.stars.material.opacity = sky;
  hangar.fadeCrane(1 - 0.88 * sstep(9.5, 12, camera.position.y)); // see through the crane when looking down past it
  sfx.rumble(flight && S.ft > 0 && (S.playing || S.seek) ? flight.thrust(S.ft) : S.focus === 'engine' && S.step >= 4 ? 0.35 : 0);
  syncUI();
}
function flightD() { // camera distance that frames the standing rocket (unit for the flight camera)
  poolN = 0;
  for (const x of [-0.75, 0.75]) for (const y of [0, TOTAL]) pv(PAD.x + x, PAD.y + y, 0);
  return fitDist(poolN, bboxCenter(poolN), 0.33, 0.1);
}
function flightSounds(a, b) {
  const cross = t => a < t && b >= t;
  if (cross(0.05) || cross(1) || cross(2)) sfx.beep(false);
  if (cross(3)) sfx.beep(true);
  if (cross(flight.T.sep) || cross(flight.T.fairing) || cross(flight.T.land)) sfx.clunk();
  if (cross(28.2)) sfx.tada();
  for (const c of flight.CHAPTERS) if (c.text && a <= c.t && b > c.t) { say(c); S.sayT = 6; }
}

// ---------------------------------------------------------------- pointer input
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmpV = V();
function setRay(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
}
const vis = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
let hitObj = null;
function hitPart(e, ok) {
  setRay(e);
  for (const h of ray.intersectObjects(rocket.pick, false)) { if (!vis(h.object)) continue; const id = h.object.userData.part; if (!ok || ok(id)) { hitObj = h.object; return id; } }
  return null;
}
function toScreen(w) { const r = canvas.getBoundingClientRect(); tmpV.copy(w).project(camera); return { x: r.left + (tmpV.x + 1) / 2 * r.width, y: r.top + (1 - tmpV.y) / 2 * r.height }; }
const cW = V();
const partScreen = id => { const i = INFO[id]; return toScreen(parts[id].group.localToWorld(cW.set(0, (i.lo + i.hi) / 2, 0))); };
const slotScreen = id => { const i = INFO[id]; return toScreen(root.localToWorld(cW.set(0, HOME[id] + (i.lo + i.hi) / 2, 0))); };
const loose = id => !parts[id].placed && !parts[id].tween;
function nearPiece(e, px = 46) { // forgiving touch target for small pieces
  let best = null, bd = px;
  for (const id of ORDER) if (loose(id)) { const s = partScreen(id), d = Math.hypot(s.x - e.clientX, s.y - e.clientY); if (d < bd) { bd = d; best = id; } }
  return best;
}
function hitGhosts(e) {
  setRay(e); const ids = new Set();
  for (const id of ORDER) { const g = rocket.ghosts[id]; if (g.group.visible && ray.intersectObject(g.mesh, false).length) ids.add(id); }
  return ids;
}
const plane = new THREE.Plane(V(0, 1, 0), -AX_Y), hitP = V();
function dragTo(e) {
  setRay(e); if (!ray.ray.intersectPlane(plane, hitP)) return;
  const p = parts[S.drag.id];
  p.pos.x = clamp(hitP.x - LIE.x + S.drag.oa, -2, 10.6); p.pos.z = clamp(hitP.z + S.drag.oz, -1.4, 3.6);
}
function startDrag(id, e) {
  const p = parts[id]; p.tween = null; S.selected = id; S.drag = { id, oa: 0, oz: 0 };
  setRay(e); if (ray.ray.intersectPlane(plane, hitP)) { S.drag.oa = p.pos.x - (hitP.x - LIE.x); S.drag.oz = p.pos.z - hitP.z; }
  sfx.pick();
}
function buildTap(e) {
  const sel = S.selected;
  if (sel) { // tap-to-place: tap the piece, then its outline
    const s = slotScreen(sel);
    if (hitGhosts(e).has(sel) || Math.hypot(s.x - e.clientX, s.y - e.clientY) < 52) { place(sel, 0.7, 0.9); return; }
  }
  const id = hitPart(e, loose) || nearPiece(e);
  if (id) { S.selected = id === sel ? null : id; if (S.selected) sfx.pick(); return; }
  if (sel) { if (hitGhosts(e).size) sendBack(sel); else S.selected = null; }
}
function onTap(e) {
  if (S.mode === 'explore') {
    if (S.standU > 0) return;
    if (S.focus === 'engine') {
      setRay(e); const n = eng.child(ray.intersectObjects(eng.pick, false).filter(h => vis(h.object)));
      if (n) { if (n.kids.length) { eng.enter(n); S.step = 0; sfx.whoosh(); } else { n.pop = 1; sfx.pick(); } say(n.info); return; }
    }
    const id = hitPart(e);
    if (id && hitObj.userData.engine) focusEngine(); else if (id) focusPart(id); else back();
  } else if (S.mode === 'build') buildTap(e);
}
const ptr = new Map(); let gest = null;
canvas.addEventListener('pointerdown', e => {
  sfx.unlock(); $('#title').classList.add('gone');
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptr.size === 2) {
    if (S.drag) { const id = S.drag.id; S.drag = null; sendBack(id); }
    const [a, b] = [...ptr.values()]; gest = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: S.zoom };
  } else if (ptr.size === 1) {
    const piece = S.mode === 'build' && S.standU === 0 ? (hitPart(e, loose) || nearPiece(e, 34)) : null;
    gest = { type: 'tap', id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, piece };
  }
});
canvas.addEventListener('pointermove', e => {
  if (!ptr.has(e.pointerId) || !gest) return;
  ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gest.type === 'pinch') {
    if (ptr.size < 2) return;
    const [a, b] = [...ptr.values()]; S.zoom = clamp(gest.z0 * gest.d0 / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), 0.55, 1.5); return;
  }
  if (gest.id !== e.pointerId) return;
  if (gest.type === 'tap' && Math.hypot(e.clientX - gest.x0, e.clientY - gest.y0) > 9) {
    if (gest.piece) { gest.type = 'drag'; startDrag(gest.piece, e); } else gest.type = 'orbit';
  }
  if (gest.type === 'drag') dragTo(e);
  else if (gest.type === 'orbit') { // rotate around the rocket
    const v = S.camFocus ? fview : views[S.mode], az0 = v.az, el0 = v.el;
    v.az = clamp(v.az - (e.clientX - gest.lx) * 0.006, -1.9, 2.3); v.el = clamp(v.el + (e.clientY - gest.ly) * 0.005, 0.06, 1.3);
    rig.az += v.az - az0; rig.el += v.el - el0; userMoved = true;
  }
  gest.lx = e.clientX; gest.ly = e.clientY;
});
function pointerEnd(e) {
  if (!ptr.has(e.pointerId)) return;
  ptr.delete(e.pointerId);
  if (!gest) return;
  if (gest.type === 'pinch') { if (ptr.size < 2) gest = null; return; }
  if (gest.id !== e.pointerId) return;
  if (gest.type === 'tap' && e.type === 'pointerup') onTap(e);
  if (gest.type === 'drag' && S.drag) { const id = S.drag.id; S.drag = null; if (e.type === 'pointerup') tryDrop(id); else sendBack(id); }
  gest = null;
}
canvas.addEventListener('pointerup', pointerEnd); canvas.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('wheel', e => { e.preventDefault(); S.zoom = clamp(S.zoom * Math.exp(e.deltaY * 0.001), 0.55, 1.5); }, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('pointerdown', () => $('#title').classList.add('gone'), { once: true });

// ---------------------------------------------------------------- DOM controls
const press = (el, fn) => el.addEventListener('click', e => { sfx.unlock(); fn(e); });
press($('#back'), () => back()); press($('#reset'), reset); press($('#next'), () => setStep(S.step % STEPS.length + 1));
press($('#mute'), () => { const m = $('#mute').textContent === '🔊'; $('#mute').textContent = m ? '🔇' : '🔊'; sfx.setMuted(m); });
document.querySelectorAll('#tabs button').forEach(b => press(b, () => setMode(b.dataset.mode)));
for (let i = 0; i < ORDER.length; i++) $('#dots').appendChild(document.createElement('i'));
{ // the big lever
  const lever = $('#lever'); let lv = null; lever.classList.add('hint');
  const span = () => lever.clientWidth - $('#knob').offsetWidth;
  lever.addEventListener('pointerdown', e => { sfx.unlock(); lever.setPointerCapture(e.pointerId); lever.classList.remove('hint'); lv = S.focus === 'engine' ? { o: eng.focus, k: 'goal' } : { o: S, k: 'spreadGoal' }; Object.assign(lv, { x0: e.clientX, moved: false, v0: lv.o[lv.k], last: lv.o[lv.k] }); });
  lever.addEventListener('pointermove', e => {
    if (!lv) return; const dx = e.clientX - lv.x0; if (Math.abs(dx) > 6) lv.moved = true;
    if (lv.moved) { lv.o[lv.k] = clamp(lv.v0 + dx / span(), 0, 1); if (Math.abs(lv.o[lv.k] - lv.last) > 0.12) { lv.last = lv.o[lv.k]; sfx.tick(); } }
  });
  const end = e => {
    if (!lv) return; if (!lv.moved && e.type === 'pointerup') lv.o[lv.k] = lv.o[lv.k] > 0.5 ? 0 : 1;
    if (S.focus === 'engine' && lv.o[lv.k] > 0 && S.step) setStep(0);
    sfx.clunk(); lv = null;
  };
  lever.addEventListener('pointerup', end); lever.addEventListener('pointercancel', end);
}
press($('#go'), () => { if (S.mode === 'launch' && S.standU >= 1 && S.ft === 0 && !S.cd) S.cd = 7; });
function seekTo(t) { S.playing = false; S.seek = { from: S.ft, to: Math.max(0.001, t), t: 0, dur: clamp(Math.abs(S.ft - t) / 14, 0.5, 1.4) }; sfx.whoosh(); }
if (flight) {
  press($('#pp'), () => { if (S.seek) return; if (S.ft >= flight.T_END) seekTo(0); else S.playing = !S.playing; });
  press($('#replay'), () => seekTo(0));
  press($('#rew'), () => { let t = 0; for (const c of flight.CHAPTERS) if (c.t < S.ft - 1.2) t = c.t; seekTo(t); });
  for (const c of flight.CHAPTERS) {
    const b = document.createElement('button'); b.textContent = c.icon; b.title = c.name; b.dataset.t = c.t; b.style.left = (c.t / flight.T_END * 100) + '%';
    press(b, () => seekTo(c.t)); $('#chapters').appendChild(b);
  }
}
let uiKey = '', countTxt = '';
function syncUI() {
  const ready = S.mode === 'launch' && S.standU >= 1 && S.ft === 0 && !S.cd, flying = S.mode === 'launch' && S.ft > 0;
  const engOn = S.focus === 'engine', engTop = engOn && !eng.depth;
  const key = [S.mode, S.focus, eng.depth, S.step, ready, flying, allPlaced(), S.playing || !!S.seek, flight && S.ft >= flight.T_END].join();
  if (key !== uiKey) {
    uiKey = key;
    $('#lever').hidden = S.mode !== 'explore' || (!!S.focus && !engOn); $('#back').hidden = !S.focus;
    $('#ctx').classList.toggle('eng', engOn); $('#next').hidden = !engTop;
    if (engOn) [...$('#dots').children].forEach((d, i) => d.classList.toggle('on', i < S.step)); else refreshDots();
    $('#dots').hidden = S.mode !== 'build' && !engTop; $('#go').hidden = !ready; $('#flight').hidden = !flying;
    document.querySelectorAll('#tabs button').forEach(b => { b.classList.toggle('on', b.dataset.mode === S.mode); b.classList.toggle('locked', b.dataset.mode === 'launch' && !allPlaced()); });
    $('#pp').textContent = S.playing || S.seek ? '⏸' : '▶️';
    $('#replay').classList.toggle('pulse', !!(flight && S.ft >= flight.T_END));
  }
  $('#knob').style.transform = `translateX(${(engOn ? eng.focus.goal : S.spreadGoal) * ($('#lever').clientWidth - 68)}px)`;
  let n = -1;
  if (S.cd > 0) n = 3 + Math.ceil(S.cd);
  if (flying) {
    $('#fill').style.width = (S.ft / flight.T_END * 100) + '%';
    if (S.ft < 3) n = Math.ceil(3 - S.ft); else if (S.ft < 3.9) n = 0;
    for (const b of $('#chapters').children) b.classList.toggle('on', S.ft >= +b.dataset.t);
  }
  const txt = n < 0 ? '' : n ? String(n) : 'ПУСК!';
  if (txt !== countTxt && txt && (S.cd > 0 || S.playing)) { sfx.speak(flight.COUNT[n].text); if (S.cd > 0) sfx.beep(false); }
  if (txt !== countTxt) { countTxt = txt; const c = $('#count'); c.textContent = txt; c.classList.remove('tick'); void c.offsetWidth; c.classList.add('tick'); }
}

// ---------------------------------------------------------------- boot
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false); aspect = w / h; camera.aspect = aspect;
  camera.setViewOffset(w, h, 0, Math.round(h * (h < 480 ? 0.08 : 0.06)), w, h);   // leave room for the controls at the bottom
  camera.updateProjectionMatrix();
  if (!userMoved) views = defaults();
}
window.addEventListener('resize', resize); resize();
layoutRoot(); root.updateMatrixWorld(true); computeGoal(); Object.assign(rig, G); // start framed on the whole rocket
let last = performance.now();
function frame(now) { const dt = Math.min(0.05, (now - last) / 1000); last = now; update(dt); renderer.render(scene, camera); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

// handles for automated tests
window.__app = { S, parts, rig, G, camera, views, ORDER, setMode, reset, focusPart, focusEngine, setStep, eng, back, partScreen, slotScreen, allPlaced, seekTo };
