// The full play loop at phone width, using touch input only:
// find the satellite → Back mid-animation → assemble → launch → rewind to stage separation → reset → build again.
import { serve, open } from './lib.mjs';
const vp = process.argv[2] === 'landscape' ? { width: 844, height: 390 } : process.argv[2] === 'tablet' ? { width: 820, height: 1180 } : { width: 390, height: 844 };
const s = await serve(), T = await open(s.url, vp), tag = process.argv[2] || 'phone';
const A = fn => T.ev(fn), ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) process.exitCode = 1; };
const ps = id => T.page.evaluate(i => window.__app.partScreen(i), id), ss = id => T.page.evaluate(i => window.__app.slotScreen(i), id);
const idle = () => T.until(() => !window.__app.ORDER.some(i => window.__app.parts[i].tween));
const cam = () => A(() => { const a = window.__app, c = a.camera.position; return { x: c.x, y: c.y, z: c.z, d: a.rig.d, rf: a.parts.fairing.reveal, ft: a.S.ft }; });
const settle = () => T.until(() => { const a = window.__app; return ['tx', 'ty', 'tz', 'az', 'el', 'd'].every(k => Math.abs(a.rig[k] - a.G[k]) < 0.01); }, 30000);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
async function assemble(order) {
  for (const [id, how] of order) {
    if (how === 'drag') await T.drag(await ps(id), await ss(id)); else { await T.tap(await ps(id)); await T.tap(await ss(id)); }
    await idle();
    ok(await T.page.evaluate(i => window.__app.parts[i].placed, id), `${id} snapped in by ${how}`);
  }
}
await T.wait(500); await settle(); const home = await cam(); await T.shot(tag + '-1-open');

// 1. find the satellite
await T.tap(await ps('fairing'));
let prev = await cam(), maxStep = 0, moved = 0;
while ((await cam()).rf < 0.97) { const c = await cam(); maxStep = Math.max(maxStep, dist(c, prev)); moved += dist(c, prev); prev = c; await T.wait(30); }
ok(moved > 2 && maxStep < moved * 0.5, `camera glided to the nose continuously (travelled ${moved.toFixed(1)}, biggest step ${maxStep.toFixed(2)})`);
await T.wait(600); await T.shot(tag + '-2-satellite');
await T.tap(await ps('satellite')); await T.until(() => window.__app.parts.satellite.reveal > 0.95); await T.shot(tag + '-2b-wings');
ok(await A(() => window.__app.S.focus === 'satellite' && window.__app.parts.fairing.reveal > 0.9), 'tapping the satellite keeps the nose cone open and unfolds its wings');
await T.tapSel('#back'); await T.until(() => !window.__app.S.camFocus && window.__app.parts.fairing.reveal < 0.02); await settle();
ok(dist(await cam(), home) < 0.6, 'Back restored the previous framing');

// 2. close the nose cone mid-animation
await T.tap(await ps('fairing')); await T.until(() => window.__app.parts.fairing.reveal > 0.35);
const mid = await cam(); await T.tapSel('#back');
let last = (await cam()).rf, peak = last, rose = false; prev = await cam(); maxStep = 0;
for (let i = 0; i < 80 && last > 0.02; i++) { await T.wait(40); const c = await cam(); if (c.rf > last + 0.02 && last < peak - 0.1) rose = true; peak = Math.max(peak, c.rf); maxStep = Math.max(maxStep, dist(c, prev)); prev = c; last = c.rf; }
ok(mid.rf < 0.9 && !rose && last <= 0.02, `Back at ${mid.rf.toFixed(2)} open reversed smoothly to closed (no jump: max camera step ${maxStep.toFixed(2)})`);
await settle(); ok(dist(await cam(), home) < 0.6, 'camera back on the whole rocket');

// 3. assemble with touch
await T.tapSel('[data-mode=build]'); await T.until(() => window.__app.ORDER.every(i => !window.__app.parts[i].placed)); await idle(); await T.wait(1500);
await T.shot(tag + '-3-bench');
await T.drag(await ps('upper'), await ss('booster')); await T.wait(150);
ok(await A(() => !window.__app.parts.upper.placed && window.__app.parts.upper.hl > 0), 'wrong spot: piece returns and its outline lights up'); await idle();
await assemble([['booster', 'drag'], ['interstage', 'tap'], ['upper', 'drag'], ['satellite', 'tap'], ['fairing', 'drag']]);
await T.until(() => window.__app.S.mode === 'launch'); await T.until(() => window.__app.S.standU > 0.45); await T.shot(tag + '-4-crane');
await T.until(() => window.__app.S.standU >= 1, 90000); await T.wait(1500);
ok(await T.page.locator('#go').isVisible(), 'crane stood the rocket up and the launch button lit'); await T.shot(tag + '-5-ready');

// 4. launch, then rewind to stage separation
await T.tapSel('#go'); await T.until(() => window.__app.S.ft > 1.2); await T.shot(tag + '-6-countdown');
await T.until(() => window.__app.S.ft > 6); await T.shot(tag + '-7-ascent');
await T.until(() => window.__app.S.ft > 11.4, 120000); await T.shot(tag + '-8-separation');
ok(await A(() => { const p = window.__app.parts; return p.upper.group.position.y - p.interstage.group.position.y > 1.5; }), 'stages separated');
await T.until(() => window.__app.S.ft > 15, 120000); await T.shot(tag + '-9-fairing');
await T.tapSel('#chapters button:nth-child(2)');
let mono = true, steps = 0, f0 = 99;
for (let i = 0; i < 40; i++) { const q = await A(() => ({ ft: window.__app.S.ft, seek: !!window.__app.S.seek })); if (!q.seek) { if (steps) break; } else { if (q.ft > f0 + 1e-6) mono = false; f0 = q.ft; steps++; } await T.wait(30); }
mono = mono && steps >= 3;
await T.until(() => window.__app.S.ft < 10 && !window.__app.S.seek);
ok(mono && await A(() => window.__app.parts.fairing.halves[0].visible && window.__app.S.playing), 'rewound (played backwards) to just before stage separation; nose cone is back on');
await T.until(() => window.__app.S.ft > 10.6, 60000);
await T.tapSel('#pp'); const p1 = (await cam()).ft; await T.wait(500); const p2 = (await cam()).ft; ok(Math.abs(p1 - p2) < 1e-6, 'pause holds the flight'); await T.tapSel('#pp');
await T.tapSel('#chapters button:nth-child(4)'); await T.until(() => window.__app.S.ft > 20.5, 120000); await T.shot(tag + '-10-landing');
await T.until(() => window.__app.S.ft > 22.8, 60000); await T.shot(tag + '-10b-landed');
await T.tapSel('#chapters button:nth-child(5)'); await T.until(() => window.__app.S.ft > 29, 120000); await T.shot(tag + '-11-satellite');
await T.until(() => window.__app.S.ft >= 32, 60000); await T.tapSel('#replay'); await T.until(() => window.__app.S.ft < 1 && window.__app.S.playing, 30000); ok(true, 'replay restarts the countdown');

// 5. reset and build again
await T.tapSel('#reset'); await T.until(() => window.__app.S.mode === 'explore' && window.__app.S.standU === 0 && window.__app.S.ft === 0, 90000);
await settle(); ok(dist(await cam(), home) < 0.8, 'reset returns to the opening view with the rocket on the bench'); await T.shot(tag + '-12-reset');
await T.tapSel('[data-mode=build]'); await T.until(() => window.__app.ORDER.every(i => !window.__app.parts[i].placed)); await idle(); await T.wait(1200);
await assemble([['booster', 'tap'], ['interstage', 'drag'], ['upper', 'tap'], ['satellite', 'drag'], ['fairing', 'tap']]);
await T.until(() => window.__app.S.standU >= 1, 90000); await T.wait(300);
ok(await T.page.locator('#go').isVisible(), 'second build stands up and is ready to launch again');
ok(T.errors.length === 0, 'no console errors ' + JSON.stringify(T.errors));
await T.browser.close(); s.close();
