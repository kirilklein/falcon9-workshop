// The Falcon 9 model kit. Every section is its own named group so the same
// meshes are explored, assembled on the bench, and flown.
// Arrangement follows Figure 2-1 of the Falcon User's Guide: first stage with
// nine engines (eight around one) and four legs at its base, four grid fins
// near its top, interstage, second stage with a single vacuum engine, and a
// two-half payload fairing that is wider than the stages. Proportions are
// deliberately chunky (the real rocket is ~19x taller than it is wide).
import * as THREE from 'three';

export const R = 0.5, FR = 0.7, TOTAL = 8.6;
// Rocket axis is local +Y; these are the explicit snap points (bottom of each part).
export const HOME = { booster: 0, interstage: 4.2, upper: 5.1, satellite: 6.72, fairing: 6.6 };
export const ORDER = ['booster', 'interstage', 'upper', 'satellite', 'fairing'];
// lo/hi: extent of the part along the axis relative to its origin; r: radius.
export const INFO = {
  booster: { name: 'Первая ступень', icon: '🔥', r: 0.5, lo: 0, hi: 4.2,
    text: 'Это самая большая часть ракеты. Девять двигателей поднимают её с земли. Нажми на чёрное кольцо с двигателями!' },
  interstage: { name: 'Переходник', icon: '🔗', r: 0.5, lo: 0, hi: 0.9,
    text: 'Это кольцо соединяет две большие части. Внутри него прячется двигатель!' },
  upper: { name: 'Вторая ступень', icon: '⬆️', r: 0.5, lo: -0.7, hi: 1.62,
    text: 'Вторая ступень работает высоко в небе. Она везёт спутник в космос.' },
  satellite: { name: 'Спутник', icon: '🛰️', r: 0.3, lo: 0, hi: 0.72,
    text: 'Спутник — это пассажир ракеты. Его синие крылья делают электричество из солнечного света.' },
  fairing: { name: 'Обтекатель', icon: '🛡️', r: 0.7, lo: 0, hi: 2.0,
    text: 'Этот колпак бережёт спутник, пока ракета летит вверх.' },
};

const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.55, metalness: 0.05 }, o));
const Cyl = (a, b, h, s = 32, open = false) => new THREE.CylinderGeometry(a, b, h, s, 1, open);

export function buildRocket() {
  const root = new THREE.Group(); root.name = 'rocket';
  const P = {}, pick = [], ghosts = {};
  const metal = std(0x6f7a87, { metalness: 0.55, roughness: 0.4 });
  const black = std(0x262b33, { roughness: 0.65 });

  function mesh(g, geo, mat, id, x = 0, y = 0, z = 0) {
    const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
    m.castShadow = true; m.userData.part = id; g.add(m); pick.push(m); return m;
  }
  function part(id) {
    const g = new THREE.Group(); g.name = id; g.position.y = HOME[id]; root.add(g);
    P[id] = { id, group: g, shells: [], inner: [] }; return g;
  }
  function flame(g, y, r, len, c1, c2) {
    const f = new THREE.Group(); f.position.y = y; f.visible = false;
    for (const [rr, ll, c, o] of [[r, len, c1, 0.8], [r * 0.55, len * 0.6, c2, 0.95]]) {
      const geo = new THREE.ConeGeometry(rr, ll, 18, 1, true); geo.rotateX(Math.PI); geo.translate(0, -ll / 2, 0);
      f.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide })));
    }
    g.add(f); return f;
  }
  function tank(g, id, r, len, y, color) {
    const m = mesh(g, new THREE.CapsuleGeometry(r, len, 6, 20), std(color, { roughness: 0.35 }), id, 0, y);
    m.castShadow = false; m.visible = false; P[id].inner.push(m);
  }

  { // ---- booster (first stage)
    const g = part('booster'), p = P.booster, sh = std(0xf5f7fa); p.shells.push(sh);
    mesh(g, Cyl(R, R, 3.75, 36), sh, 'booster', 0, 2.325);
    mesh(g, Cyl(R + 0.03, R + 0.03, 0.25, 36), black, 'booster', 0, 0.325).userData.engine = true;
    mesh(g, Cyl(R + 0.006, R + 0.006, 0.1, 36), black, 'booster', 0, 3.95);
    for (let i = 0; i < 9; i++) { // eight engines around one
      const a = (i - 1) / 8 * Math.PI * 2, rr = i === 0 ? 0 : 0.33;
      mesh(g, Cyl(0.045, 0.1, 0.3, 12), metal, 'booster', Math.cos(a) * rr, 0.15, Math.sin(a) * rr).userData.engine = true;
    }
    p.legs = [];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, piv = new THREE.Group();
      piv.position.set(Math.cos(a) * (R + 0.04), 0.5, Math.sin(a) * (R + 0.04)); piv.rotation.y = -a;
      const geo = new THREE.BoxGeometry(0.1, 1.35, 0.24); geo.translate(0, 0.675, 0);
      mesh(piv, geo, black, 'booster'); g.add(piv); p.legs.push(piv);
    }
    tank(g, 'booster', 0.4, 0.7, 1.2, 0xff9a3d);  // fuel
    tank(g, 'booster', 0.4, 1.3, 3.05, 0x4fc3f7); // liquid oxygen
    p.flame = flame(g, 0.05, 0.45, 2.6, 0xff8a1f, 0xfff2a8);
  }
  { // ---- interstage ("connector") with grid fins
    const g = part('interstage'), p = P.interstage, sh = std(0x262b33, { roughness: 0.6, side: THREE.DoubleSide }); p.shells.push(sh);
    mesh(g, Cyl(R, R, 0.9, 36, true), sh, 'interstage', 0, 0.45);
    p.fins = [];
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, piv = new THREE.Group();
      piv.position.set(Math.cos(a) * (R + 0.04), 0.72, Math.sin(a) * (R + 0.04)); piv.rotation.y = -a;
      const geo = new THREE.BoxGeometry(0.06, 0.34, 0.34); geo.translate(0, -0.17, 0);
      mesh(piv, geo, metal, 'interstage'); g.add(piv); p.fins.push(piv);
    }
  }
  { // ---- upper (second) stage with one vacuum engine
    const g = part('upper'), p = P.upper, sh = std(0xf5f7fa); p.shells.push(sh);
    mesh(g, Cyl(R, R, 1.5, 36), sh, 'upper', 0, 0.75);
    mesh(g, Cyl(0.3, R, 0.12, 28), metal, 'upper', 0, 1.56);       // payload adapter
    mesh(g, Cyl(0.15, 0.15, 0.14, 16), metal, 'upper', 0, -0.07);
    mesh(g, Cyl(0.13, 0.3, 0.6, 24, true), std(0x3d444e, { side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 }), 'upper', 0, -0.4);
    tank(g, 'upper', 0.34, 0.04, 0.4, 0xff9a3d);
    tank(g, 'upper', 0.34, 0.26, 1.02, 0x4fc3f7);
    p.flame = flame(g, -0.68, 0.28, 1.5, 0xbfe6ff, 0xffffff);
  }
  { // ---- satellite
    const g = part('satellite'), p = P.satellite;
    mesh(g, Cyl(0.2, 0.24, 0.08, 20), metal, 'satellite', 0, 0.04);
    mesh(g, new THREE.BoxGeometry(0.34, 0.46, 0.34), std(0xf2b632, { metalness: 0.55, roughness: 0.35 }), 'satellite', 0, 0.31);
    mesh(g, Cyl(0.17, 0.05, 0.09, 20), std(0xffffff), 'satellite', 0, 0.6);
    mesh(g, Cyl(0.012, 0.012, 0.12, 6), metal, 'satellite', 0, 0.66);
    p.lamp = mesh(g, new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }), 'satellite', 0.1, 0.57, 0.1);
    p.panels = [];
    for (const s of [1, -1]) { // wings unfold sideways (local ±Z)
      const piv = new THREE.Group(); piv.position.set(0, 0.12, s * 0.18); piv.rotation.y = -s * Math.PI / 2; piv.rotation.z = Math.PI / 2;
      const geo = new THREE.BoxGeometry(0.62, 0.025, 0.3); geo.translate(0.31, 0, 0);
      mesh(piv, geo, std(0x2456c9, { metalness: 0.3, roughness: 0.3, emissive: 0x0a1f55 }), 'satellite');
      g.add(piv); p.panels.push(piv);
    }
  }
  const fairPts = [new THREE.Vector2(0.5, 0), new THREE.Vector2(FR, 0.3), new THREE.Vector2(FR, 1.05)];
  for (let i = 1; i <= 12; i++) { const t = i / 12; fairPts.push(new THREE.Vector2(Math.max(FR * Math.pow(1 - t * t, 0.6), 0.001), 1.05 + 0.95 * t)); }
  { // ---- payload fairing ("nose cone"): two halves split on the local z=0 plane
    const g = part('fairing'), p = P.fairing; p.halves = [];
    for (const s of [1, -1]) {
      const h = new THREE.Group(), geo = new THREE.LatheGeometry(fairPts, 20, s > 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI);
      mesh(h, geo, std(0xf5f7fa, { side: THREE.FrontSide }), 'fairing');
      mesh(h, geo, std(0x9fb0c2, { side: THREE.BackSide }), 'fairing');
      g.add(h); p.halves.push(h);
    }
  }
  // ---- translucent outlines shown at each snap point in Build mode
  const shapes = {
    booster: [Cyl(R, R, 4.2, 24), 2.1], interstage: [Cyl(R, R, 0.9, 24), 0.45], upper: [Cyl(R, R, 1.5, 24), 0.75],
    satellite: [new THREE.BoxGeometry(0.42, 0.72, 0.42), 0.36], fairing: [new THREE.LatheGeometry(fairPts, 24), 0],
  };
  for (const id of ORDER) {
    const g = new THREE.Group(); g.position.y = HOME[id]; g.visible = false;
    const [geo, y] = shapes[id];
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x29b6f6, transparent: true, opacity: 0.22, depthWrite: false }));
    m.position.y = y; m.userData.ghost = id; m.name = 'outline-' + id;
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), new THREE.LineBasicMaterial({ color: 0x0277bd }));
    e.position.y = y; g.add(m, e); root.add(g); ghosts[id] = { group: g, mesh: m, line: e };
  }
  // ---- "snap" ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.05, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd600, transparent: true, depthWrite: false }));
  ring.rotation.x = Math.PI / 2; ring.visible = false; root.add(ring);

  return { root, P, pick, ghosts, ring };
}
