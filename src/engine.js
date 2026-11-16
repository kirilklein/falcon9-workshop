// The big cut-open engine that pops out of the booster in Explore.
// Local axes: +Y up, nozzle exit at y = 0. A quarter of the chamber and the
// nozzle is cut away (toward +X/+Z) so the fire inside can be seen.
import * as THREE from 'three';

export const INTRO = { icon: '🚀', text: 'Это двигатель. Нажми ▶ и узнай, как он работает. А рычаг разберёт его на детали!' };
export const APART_HINT = { icon: '🔧', text: 'Двигатель разобран. Нажми на любую деталь!' };
export const PIECES = {
  tanks: { icon: '🛢️', text: 'Баки. В оранжевом — керосин, в синем — очень холодный кислород.' },
  pipes: { icon: '🚰', text: 'Трубы. По ним керосин и кислород текут к двигателю.' },
  pump: { icon: '🌀', text: 'Насос. Он быстро крутится и толкает керосин и кислород.' },
  chamber: { icon: '🔥', text: 'Камера. Здесь керосин и кислород встречаются и горят.' },
  nozzle: { icon: '🔔', text: 'Сопло. Оно похоже на колокол. Из него вылетает огонь.' },
};
export const STEPS = [
  { icon: '🛢️', pop: 'tanks', text: 'В ракете два бака: керосин и очень холодный кислород. В космосе нет воздуха, поэтому кислород ракета берёт с собой.' },
  { icon: '🌀', pop: 'pump', text: 'Насос быстро крутится и толкает керосин и кислород по трубам.' },
  { icon: '🔥', pop: 'chamber', text: 'В камере они встречаются, и керосин загорается. Получается очень горячий огонь!' },
  { icon: '💨', pop: 'nozzle', text: 'Огню тесно. Он с силой вылетает вниз через сопло.' },
  { icon: '🎈', text: 'Огонь летит вниз, а ракета — вверх! Как шарик, который надули и отпустили.' },
];
// corners of the space the engine needs on screen, with room to take it apart
export const BOX = { x: [-1.6, 0.75], y: [-1.1, 4.1], z: [-0.6, 0.6] };

const KERO = 0xff9a3d, LOX = 0x4fc3f7, DROPS = 4;
const APART = { tanks: [0, 0.5], pipes: [-0.3, 0.3], pump: [-0.8, -0.1], chamber: [0, 0], nozzle: [0, -0.6] };
const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0.35 }, o));
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });
const v2 = pts => pts.map(([r, y]) => new THREE.Vector2(r, y));

export function buildEngine() {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body); group.visible = false;
  const G = {}, pick = [], drops = [];

  function piece(id, cx, cy) { // scales ("pops") around its own centre
    const g = new THREE.Group(), inner = new THREE.Group();
    g.position.set(cx, cy, 0); inner.position.set(-cx, -cy, 0); g.add(inner); body.add(g);
    G[id] = { g, cx, cy, pop: 0 }; inner.userData.piece = id; return inner;
  }
  function add(g, geo, mat, x = 0, y = 0, z = 0, pickable = true) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m);
    if (pickable) { m.userData.piece = g.userData.piece; pick.push(m); }
    return m;
  }
  function cutaway(g, pts, outer, inner) {
    const geo = new THREE.LatheGeometry(v2(pts), 28, Math.PI / 2, Math.PI * 1.5);
    add(g, geo, std(outer, { side: THREE.FrontSide })); add(g, geo, std(inner, { side: THREE.BackSide }));
  }

  { // nozzle, with the jet inside it and the flame below
    const g = piece('nozzle', 0, 0.5);
    cutaway(g, [[0.5, 0], [0.47, 0.2], [0.4, 0.45], [0.3, 0.68], [0.2, 0.85], [0.13, 0.97]], 0x4a525e, 0x8a6a55);
    G.nozzle.jet = add(g, new THREE.CylinderGeometry(0.09, 0.4, 0.92, 18, 1, true), glow(0xffb347, 0.85), 0, 0.5, 0, false);
    const f = new THREE.Group(); f.position.y = 0.05; g.add(f); G.nozzle.flame = f;
    for (const [r, len, c, o] of [[0.45, 1.1, 0xff8a1f, 0.8], [0.25, 0.7, 0xfff2a8, 0.95]]) {
      const geo = new THREE.ConeGeometry(r, len, 18, 1, true); geo.rotateX(Math.PI); geo.translate(0, -len / 2, 0);
      f.add(new THREE.Mesh(geo, glow(c, o)));
    }
  }
  { // combustion chamber with the fire inside
    const g = piece('chamber', 0, 1.3);
    cutaway(g, [[0.13, 0.97], [0.22, 1.08], [0.27, 1.2], [0.27, 1.55]], 0x7b8794, 0xb87333);
    add(g, new THREE.CylinderGeometry(0.29, 0.29, 0.08, 28), std(0x7b8794), 0, 1.59);
    G.chamber.fire = add(g, new THREE.SphereGeometry(0.2, 16, 12), glow(0xffd24a), 0, 1.3, 0, false);
  }
  { // pump with a spinning wheel on its face
    const g = piece('pump', -0.7, 1.5);
    const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.3, 24); geo.rotateX(Math.PI / 2);
    add(g, geo, std(0x5d6b7c), -0.7, 1.5);
    const wheel = new THREE.Group(); wheel.position.set(-0.7, 1.5, 0.17); g.add(wheel); G.pump.wheel = wheel;
    for (const a of [0, Math.PI / 2]) { const b = add(wheel, new THREE.BoxGeometry(0.34, 0.08, 0.04), std(0xffd43b)); b.rotation.z = a; b.userData.piece = 'pump'; }
  }
  { // see-through pipes with drops running inside
    const g = piece('pipes', -0.5, 1.85);
    const paths = [
      [KERO, 1, [[-0.95, 2.2, 0], [-0.95, 1.95, 0], [-0.8, 1.68, 0]]],
      [LOX, 1, [[-0.45, 2.2, 0], [-0.45, 1.95, 0], [-0.6, 1.68, 0]]],
      [KERO, 2, [[-0.52, 1.55, 0.08], [-0.38, 1.85, 0.08], [-0.12, 1.9, 0.08], [-0.03, 1.63, 0.08]]],
      [LOX, 2, [[-0.52, 1.55, -0.08], [-0.38, 1.85, -0.08], [-0.12, 1.9, -0.08], [-0.03, 1.63, -0.08]]],
    ];
    for (const [color, from, pts] of paths) {
      const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
      add(g, new THREE.TubeGeometry(curve, 20, 0.07, 10), std(color, { transparent: true, opacity: 0.4, depthWrite: false }));
      for (let i = 0; i < DROPS; i++) drops.push({ m: add(g, new THREE.SphereGeometry(0.04, 10, 8), glow(color), 0, 0, 0, false), curve, from, i });
    }
  }
  { // the two tanks
    const g = piece('tanks', -0.7, 2.55);
    add(g, new THREE.CapsuleGeometry(0.2, 0.3, 6, 16), std(KERO, { metalness: 0.1 }), -0.95, 2.55);
    add(g, new THREE.CapsuleGeometry(0.2, 0.3, 6, 16), std(LOX, { metalness: 0.1 }), -0.45, 2.55);
  }

  let lift = 0;
  function update(spread, step, t, dt) {
    lift += ((step === 5 ? 0.3 + 0.2 * Math.sin(t * 2.2) : 0) - lift) * (1 - Math.exp(-dt * 4));
    body.position.y = lift;
    for (const id in APART) {
      const p = G[id]; p.pop = Math.max(0, p.pop - dt * 2.6);
      p.g.position.set(p.cx + APART[id][0] * spread, p.cy + APART[id][1] * spread, 0);
      p.g.scale.setScalar(1 + 0.16 * Math.sin(p.pop * Math.PI));
    }
    for (const d of drops) {
      d.m.visible = step >= d.from;
      if (d.m.visible) d.curve.getPointAt((t * 0.6 + d.i / DROPS) % 1, d.m.position);
    }
    if (step >= 2) G.pump.wheel.rotation.z -= dt * 10;
    const flick = 1 + 0.1 * Math.sin(t * 38);
    G.chamber.fire.visible = step >= 3; G.chamber.fire.scale.setScalar(flick);
    G.nozzle.jet.visible = G.nozzle.flame.visible = step >= 4; G.nozzle.flame.scale.y = flick;
  }
  return { group, pick, update, pop: id => { G[id].pop = 1; } };
}
