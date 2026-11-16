// The big cut-open engine that pops out of the booster in Explore.
// Local axes: +Y up, nozzle exit at y = 0. A quarter of the chamber and the
// nozzle is cut away (toward +X/+Z) so the fire inside can be seen.
// The engine is a tree of nodes: tapping a node that has children goes into it
// (it grows, its shell turns see-through, the lever spreads its children).
import * as THREE from 'three';

export const INTRO = { icon: '🚀', text: 'Это двигатель. Нажми ▶ и узнай, как он работает. А рычаг разберёт его на детали!' };
export const APART_HINT = { icon: '🔧', text: 'Двигатель разобран. Нажми на любую деталь!' };
export const STEPS = [
  { icon: '🛢️', pop: 'tanks', text: 'В ракете два бака: керосин и очень холодный кислород. В космосе нет воздуха, поэтому кислород ракета берёт с собой.' },
  { icon: '🌀', pop: 'pump', text: 'Насос быстро крутится и толкает керосин и кислород по трубам.' },
  { icon: '🔥', pop: 'chamber', text: 'В камере они встречаются, и керосин загорается. Получается очень горячий огонь!' },
  { icon: '💨', pop: 'nozzle', text: 'Огню тесно. Он с силой вылетает вниз через сопло.' },
  { icon: '🎈', text: 'Огонь летит вниз, а ракета — вверх! Как шарик, который надули и отпустили.' },
];
const KERO = 0xff9a3d, LOX = 0x4fc3f7, DROPS = 4;
const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.45, metalness: 0.35 }, o));
const glow = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1, side: THREE.DoubleSide });
const v2 = pts => pts.map(([r, y]) => new THREE.Vector2(r, y));
const zCyl = (r, d, seg = 24) => { const g = new THREE.CylinderGeometry(r, r, d, seg); g.rotateX(Math.PI / 2); return g; };

export function buildEngine() {
  const group = new THREE.Group(), body = new THREE.Group(); group.add(body); group.visible = false;
  const N = {}, pick = [], drops = [], spins = [];

  // c: centre the node scales around; apart: where the parent's lever moves it;
  // mag: how much it grows when entered; half/boxc: the space it needs on screen then
  function node(parent, id, c, o) {
    const g = new THREE.Group(), inner = new THREE.Group();
    g.position.set(...c); inner.position.set(-c[0], -c[1], -c[2]); g.add(inner);
    const n = N[id] = Object.assign({ id, parent, kids: [], g, inner, c, boxc: c, apart: [0, 0, 0], mag: 1, shells: [], s: parent && parent.parent ? 0 : 1, spread: 0, goal: 0, ghost: 0, pop: 0 }, o);
    if (parent) { parent.kids.push(n); parent.inner.add(g); }
    return n;
  }
  function add(n, geo, mat, x = 0, y = 0, z = 0, pickable = true) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); n.inner.add(m);
    if (pickable) { m.userData.node = n; pick.push(m); }
    return m;
  }
  const shell = (n, mat) => { n.shells.push(mat); return mat; };
  function cutaway(n, pts, outer, inner) {
    const geo = new THREE.LatheGeometry(v2(pts), 28, Math.PI / 2, Math.PI * 1.5);
    add(n, geo, shell(n, std(outer, { side: THREE.FrontSide }))); add(n, geo, shell(n, std(inner, { side: THREE.BackSide })));
  }
  function spinner(n, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); n.inner.add(g); spins.push(g); return g; }

  const root = node(null, 'engine', [0, 0, 0], { info: INTRO, boxc: [-0.425, 1.5, 0], half: [1.175, 2.6, 0.6] });
  body.add(root.g);
  let path = [root];

  let jet, flame, fire, wheel, spark;
  { // nozzle, with the jet inside it and the flame below
    const n = node(root, 'nozzle', [0, 0.5, 0], { apart: [0, -0.6, 0], info: { icon: '🔔', text: 'Сопло. Оно похоже на колокол. Из него вылетает огонь.' } });
    cutaway(n, [[0.5, 0], [0.47, 0.2], [0.4, 0.45], [0.3, 0.68], [0.2, 0.85], [0.13, 0.97]], 0x4a525e, 0x8a6a55);
    jet = add(n, new THREE.CylinderGeometry(0.09, 0.4, 0.92, 18, 1, true), glow(0xffb347, 0.85), 0, 0.5, 0, false);
    flame = new THREE.Group(); flame.position.y = 0.05; n.inner.add(flame);
    for (const [r, len, c, o] of [[0.45, 1.1, 0xff8a1f, 0.8], [0.25, 0.7, 0xfff2a8, 0.95]]) {
      const geo = new THREE.ConeGeometry(r, len, 18, 1, true); geo.rotateX(Math.PI); geo.translate(0, -len / 2, 0);
      flame.add(new THREE.Mesh(geo, glow(c, o)));
    }
  }
  { // combustion chamber with the fire inside
    const n = node(root, 'chamber', [0, 1.3, 0], { mag: 2.6, boxc: [-0.1, 1.24, -0.05], half: [0.55, 0.63, 0.55], info: { icon: '🔥', text: 'Камера. Здесь керосин и кислород встречаются и горят. Потяни рычаг и загляни внутрь!' } });
    cutaway(n, [[0.13, 0.97], [0.22, 1.08], [0.27, 1.2], [0.27, 1.55]], 0x7b8794, 0xb87333);
    add(n, new THREE.CylinderGeometry(0.29, 0.29, 0.08, 28), shell(n, std(0x7b8794)), 0, 1.59);
    fire = add(n, new THREE.SphereGeometry(0.2, 16, 12), glow(0xffd24a), 0, 1.3, 0, false);

    const inj = node(n, 'injector', [0, 1.5, 0], { apart: [0, 0.32, 0], info: { icon: '🚿', text: 'Форсунки. Это как душ: из маленьких дырочек брызгают керосин и кислород.' } });
    add(inj, new THREE.CylinderGeometry(0.24, 0.24, 0.03, 24), std(0xc9d2dc), 0, 1.51);
    for (let i = 0; i < 9; i++) { const a = i / 8 * Math.PI * 2, r = i ? 0.15 : 0; add(inj, new THREE.SphereGeometry(0.022, 8, 6), std(i % 2 ? KERO : LOX), Math.sin(a) * r, 1.49, Math.cos(a) * r); }

    const tubes = node(n, 'tubes', [0, 1.3, 0], { apart: [-0.32, 0, -0.32], info: { icon: '🧊', text: 'Стенка с трубочками. По ним течёт холодный керосин, чтобы камера не расплавилась.' } });
    for (let i = 0; i < 12; i++) { const a = Math.PI / 2 + 0.2 + i / 11 * (Math.PI * 1.5 - 0.4); add(tubes, new THREE.CylinderGeometry(0.016, 0.016, 0.4, 8), std(KERO), Math.sin(a) * 0.29, 1.32, Math.cos(a) * 0.29); }

    const throat = node(n, 'throat', [0, 0.97, 0], { apart: [0, -0.3, 0], info: { icon: '⏳', text: 'Горлышко. Это самое узкое место. Здесь огонь разгоняется.' } });
    add(throat, new THREE.TorusGeometry(0.15, 0.03, 10, 28), std(0xf2b632, { metalness: 0.6 }), 0, 0.97).rotation.x = Math.PI / 2;

    const ign = node(n, 'igniter', [0.1, 1.38, 0.1], { apart: [0.3, 0.05, 0.3], info: { icon: '✨', text: 'Запал. Зелёная вспышка — и огонь загорелся!' } });
    add(ign, new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8), std(0xc9d2dc), 0.1, 1.44, 0.1);
    spark = add(ign, new THREE.SphereGeometry(0.04, 12, 10), glow(0x5cff7a), 0.1, 1.36, 0.1);
  }
  { // pump: outside a wheel on its face, inside three wheels on one shaft
    const n = node(root, 'pump', [-0.7, 1.5, 0], { apart: [-0.8, -0.1, 0], mag: 3, boxc: [-0.78, 1.53, 0], half: [0.36, 0.42, 0.33], info: { icon: '🌀', text: 'Насос. Он быстро крутится и толкает керосин и кислород. Потяни рычаг и загляни внутрь!' } });
    add(n, zCyl(0.2, 0.3), shell(n, std(0x5d6b7c)), -0.7, 1.5);
    wheel = new THREE.Group(); wheel.position.set(-0.7, 1.5, 0.17); n.inner.add(wheel);
    const blade = shell(n, std(0xffd43b));
    for (const a of [0, Math.PI / 2]) { const b = add(n, new THREE.BoxGeometry(0.34, 0.08, 0.04), blade); wheel.add(b); b.rotation.z = a; }

    function disc(id, z, color, r, bars, o) { // a wheel on the shaft
      const k = node(n, id, [-0.7, 1.5, z], o), g = spinner(k, -0.7, 1.5, z);
      g.add(add(k, zCyl(r, 0.035), std(color, { metalness: 0.2 })));
      for (let i = 0; i < bars; i++) { const b = add(k, new THREE.BoxGeometry(r * 2.15, 0.03, 0.05), std(color, { metalness: 0.2 })); g.add(b); b.rotation.z = i / bars * Math.PI; }
    }
    disc('turbine', -0.09, 0xe5484d, 0.14, 4, { apart: [0, 0, -0.26], info: { icon: '🌬️', text: 'Турбина. Горячий газ дует на неё, и она крутится. Как вертушка на ветру!' } });
    disc('keroWheel', 0, KERO, 0.12, 2, { apart: [0, 0.3, 0], info: { icon: '🟠', text: 'Колесо для керосина. Оно крутится и гонит керосин в камеру.' } });
    disc('loxWheel', 0.09, LOX, 0.12, 2, { apart: [0, 0, 0.26], info: { icon: '🔵', text: 'Колесо для кислорода. Оно крутится и гонит холодный кислород в камеру.' } });
    const shaft = node(n, 'shaft', [-0.7, 1.5, 0], { apart: [0, -0.32, 0], info: { icon: '➖', text: 'Вал. Это палка, на которой сидят все колёса. Крутится она — крутятся и они.' } });
    add(shaft, zCyl(0.02, 0.28, 10), std(0xdfe6ee, { metalness: 0.7 }), -0.7, 1.5);
    const burner = node(n, 'burner', [-0.92, 1.66, -0.09], { apart: [-0.16, 0.16, 0], info: { icon: '♨️', text: 'Маленькая печка. В ней горит чуть-чуть топлива. Её горячий газ крутит турбину.' } });
    add(burner, new THREE.CylinderGeometry(0.05, 0.05, 0.13, 14), std(0x8a6a55), -0.92, 1.66, -0.09);
    add(burner, new THREE.SphereGeometry(0.035, 10, 8), glow(0xffb347), -0.92, 1.58, -0.09);
  }
  { // see-through pipes with drops running inside
    const n = node(root, 'pipes', [-0.5, 1.85, 0], { apart: [-0.3, 0.3, 0], info: { icon: '🚰', text: 'Трубы. По ним керосин и кислород текут к двигателю.' } });
    const paths = [
      [KERO, 1, [[-0.95, 2.2, 0], [-0.95, 1.95, 0], [-0.8, 1.68, 0]]],
      [LOX, 1, [[-0.45, 2.2, 0], [-0.45, 1.95, 0], [-0.6, 1.68, 0]]],
      [KERO, 2, [[-0.52, 1.55, 0.08], [-0.38, 1.85, 0.08], [-0.12, 1.9, 0.08], [-0.03, 1.63, 0.08]]],
      [LOX, 2, [[-0.52, 1.55, -0.08], [-0.38, 1.85, -0.08], [-0.12, 1.9, -0.08], [-0.03, 1.63, -0.08]]],
    ];
    for (const [color, from, pts] of paths) {
      const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
      add(n, new THREE.TubeGeometry(curve, 20, 0.07, 10), std(color, { transparent: true, opacity: 0.4, depthWrite: false }));
      for (let i = 0; i < DROPS; i++) drops.push({ m: add(n, new THREE.SphereGeometry(0.04, 10, 8), glow(color), 0, 0, 0, false), curve, from, i });
    }
  }
  { // the two tanks
    const n = node(root, 'tanks', [-0.7, 2.55, 0], { apart: [0, 0.5, 0], info: { icon: '🛢️', text: 'Баки. В оранжевом — керосин, в синем — очень холодный кислород.' } });
    add(n, new THREE.CapsuleGeometry(0.2, 0.3, 6, 16), std(KERO, { metalness: 0.1 }), -0.95, 2.55);
    add(n, new THREE.CapsuleGeometry(0.2, 0.3, 6, 16), std(LOX, { metalness: 0.1 }), -0.45, 2.55);
  }

  let lift = 0;
  function update(step, t, dt) {
    const k = 1 - Math.exp(-dt * 7), focus = path[path.length - 1];
    lift += ((step === 5 ? 0.3 + 0.2 * Math.sin(t * 2.2) : 0) - lift) * (1 - Math.exp(-dt * 4));
    body.position.y = lift;
    (function walk(n, on) { // on: this node is on the path
      n.spread += ((n === focus ? n.goal : 0) - n.spread) * k;
      n.ghost += ((on && n.parent ? 1 : 0) - n.ghost) * k;
      for (const m of n.shells) {
        m.opacity = 1 - 0.8 * n.ghost; const tr = n.ghost > 0.01;
        if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; }
      }
      for (const c of n.kids) {
        const cOn = on && path.includes(c);
        c.s += ((cOn ? c.mag : n === focus ? 1 : 0) - c.s) * k; c.pop = Math.max(0, c.pop - dt * 2.6);
        c.g.visible = c.s > 0.01; c.g.scale.setScalar(Math.max(c.s, 0.001) * (1 + 0.16 * Math.sin(c.pop * Math.PI)));
        c.g.position.set(c.c[0] + c.apart[0] * n.spread, c.c[1] + c.apart[1] * n.spread, c.c[2] + c.apart[2] * n.spread);
        walk(c, cOn);
      }
    })(root, true);
    for (const d of drops) {
      d.m.visible = step >= d.from;
      if (d.m.visible) d.curve.getPointAt((t * 0.6 + d.i / DROPS) % 1, d.m.position);
    }
    const inPump = path.includes(N.pump);
    if (step >= 2 || inPump) wheel.rotation.z -= dt * 10;
    if (inPump) for (const g of spins) g.rotation.z -= dt * 5;
    spark.scale.setScalar(1 + 0.35 * Math.sin(t * 9));
    const flick = 1 + 0.1 * Math.sin(t * 38);
    fire.visible = step >= 3; fire.scale.setScalar(flick);
    jet.visible = flame.visible = step >= 4; flame.scale.y = flick;
  }
  function box() { // what the camera must fit, in engine coordinates, once the focused node has grown
    let C = [0, 0, 0], S = 1, p = root;
    for (const n of path.slice(1)) { C = C.map((v, i) => v + S * (n.c[i] - p.c[i])); S *= n.mag; p = n; }
    const side = i => [-1, 1].map(d => C[i] + S * (p.boxc[i] - p.c[i] + d * p.half[i]));
    return { x: side(0), y: side(1), z: side(2) };
  }
  return {
    group, pick, update, box, pop: id => { N[id].pop = 1; },
    get focus() { return path[path.length - 1]; },
    get depth() { return path.length - 1; },
    reset() { path = [root]; for (const id in N) N[id].goal = 0; },
    enter(n) { this.focus.goal = 0; path.push(n); },
    up() { if (path.length < 2) return false; this.focus.goal = 0; path.pop(); return true; },
    child(hits) { // the nearest hit that belongs to a child of the focused node
      for (const h of hits) { let n = h.object.userData.node; while (n && n.parent !== this.focus) n = n.parent; if (n) return n; }
      return null;
    },
  };
}
