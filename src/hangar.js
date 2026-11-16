// Bright miniature hangar: painted floor, workbench, walls, overhead crane,
// plus the few sky props the launch needs (clouds, stars, smoke puffs).
import * as THREE from 'three';

export const PAD = new THREE.Vector3(-9.5, 0.2, 0);   // launch pad (rocket base when standing)
export const LZ = new THREE.Vector3(10.5, 0, 0);      // booster landing zone
export const AX_Y = 1.75;                              // height of the rocket axis on the bench
export const BENCH_TOP = 0.9;

const FW = 28, FD = 16, FZ0 = -6.6, PX = 50;
const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0 }, o));

function floorTexture() {
  const c = document.createElement('canvas'); c.width = FW * PX; c.height = FD * PX;
  const g = c.getContext('2d'), X = x => (x + FW / 2) * PX, Z = z => (z - FZ0) * PX;
  g.fillStyle = '#e6ebf0'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#d5dce4'; g.lineWidth = 3;
  for (let x = -14; x <= 14; x += 2) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), c.height); g.stroke(); }
  for (let z = -6; z <= 9; z += 2) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(c.width, Z(z)); g.stroke(); }
  // hazard border around the workbench
  const rect = [X(-7.4), Z(-2.4), 14.8 * PX, 7.1 * PX];
  g.lineWidth = 16; g.strokeStyle = '#ffc928'; g.setLineDash([]); g.strokeRect(...rect);
  g.strokeStyle = '#2b2f36'; g.setLineDash([20, 20]); g.strokeRect(...rect); g.setLineDash([]);
  // launch pad
  const ring = (x, z, r, w, col) => { g.beginPath(); g.arc(X(x), Z(z), r * PX, 0, 7); g.lineWidth = w; g.strokeStyle = col; g.stroke(); };
  g.beginPath(); g.arc(X(PAD.x), Z(0), 1.75 * PX, 0, 7); g.fillStyle = '#ffd9d2'; g.fill();
  ring(PAD.x, 0, 1.75, 16, '#e5484d'); ring(PAD.x, 0, 1.25, 8, '#ffffff');
  // landing zone: bullseye with a cross
  g.beginPath(); g.arc(X(LZ.x), Z(0), 1.9 * PX, 0, 7); g.fillStyle = '#d9ecff'; g.fill();
  ring(LZ.x, 0, 1.9, 16, '#2f80ed'); ring(LZ.x, 0, 1.1, 10, '#ffffff');
  g.lineWidth = 14; g.strokeStyle = '#2f80ed'; g.beginPath();
  g.moveTo(X(LZ.x - 0.6), Z(-0.6)); g.lineTo(X(LZ.x + 0.6), Z(0.6)); g.moveTo(X(LZ.x + 0.6), Z(-0.6)); g.lineTo(X(LZ.x - 0.6), Z(0.6)); g.stroke();
  // walkway
  g.strokeStyle = '#ffffff'; g.lineWidth = 10; g.setLineDash([40, 30]);
  g.beginPath(); g.moveTo(X(-13), Z(6.6)); g.lineTo(X(13), Z(6.6)); g.stroke(); g.setLineDash([]);
  // arrow from bench to pad
  g.fillStyle = '#ffc928'; g.beginPath();
  g.moveTo(X(-7.6), Z(2.6)); g.lineTo(X(-8.3), Z(2.6)); g.lineTo(X(-8.3), Z(2.3)); g.lineTo(X(-8.9), Z(2.9)); g.lineTo(X(-8.3), Z(3.5)); g.lineTo(X(-8.3), Z(3.2)); g.lineTo(X(-7.6), Z(3.2)); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export function buildHangar(scene) {
  const box = (w, h, d, mat, x, y, z, parent = scene, shadow = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  };
  // lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9d6e2, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 1.7); sun.position.set(7, 16, 9); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -17, right: 17, top: 14, bottom: -12, near: 1, far: 45 });
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.03; scene.add(sun);

  // floor on a diorama base
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), std(0xffffff, { map: floorTexture() }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, FZ0 + FD / 2); floor.receiveShadow = true; scene.add(floor);
  box(FW + 0.6, 0.6, FD + 0.6, std(0x8d99a8), 0, -0.31, FZ0 + FD / 2, scene, false);

  // walls (back and left; the front, right and top are open like a model kit)
  const wall = std(0xf6f1e7), blue = std(0x2f80ed), win = new THREE.MeshBasicMaterial({ color: 0xd4f0ff });
  box(FW, 12, 0.4, wall, 0, 6, FZ0 - 0.2);
  box(0.4, 12, FD, wall, -FW / 2 - 0.2, 6, FZ0 + FD / 2);
  box(FW, 0.7, 0.44, blue, 0, 3.1, FZ0 - 0.2, scene, false);
  box(0.44, 0.7, FD, blue, -FW / 2 - 0.2, 3.1, FZ0 + FD / 2, scene, false);
  for (const x of [-10, -5, 0, 5, 10]) box(3.2, 2.2, 0.05, win, x, 7.6, FZ0 + 0.03, scene, false);
  for (const z of [-2.5, 2, 6.5]) box(0.05, 2.2, 3, win, -FW / 2 + 0.03, 7.6, z, scene, false);

  // workbench with a parts mat and cradles
  const wood = std(0xeab676), woodD = std(0xb98045);
  box(13.4, 0.25, 5.6, wood, 0, BENCH_TOP - 0.125, 1.1);
  box(13.5, 0.12, 5.7, woodD, 0, BENCH_TOP - 0.31, 1.1);
  for (const x of [-6.2, 0, 6.2]) for (const z of [-1.3, 3.5]) box(0.4, 0.6, 0.4, woodD, x, 0.3, z);
  box(12.7, 0.02, 1.95, std(0x4f74ad), 0, BENCH_TOP + 0.01, 2.5, scene, false);
  for (const x of [-3.4, -1.0, 1.35]) box(0.35, 0.35, 1.15, std(0x5d6b7c), x, BENCH_TOP + 0.175, 0);
  // launch pad pedestal + landing pad
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.2, 28), std(0x6c7786));
  ped.position.set(PAD.x, 0.1, 0); ped.receiveShadow = true; ped.castShadow = true; scene.add(ped);
  // tool chest + cones, just for workshop flavour
  box(1.6, 1.3, 0.9, std(0xe5484d), 4.5, 0.65, -5.5); box(1.7, 0.1, 1.0, std(0x3a4049), 4.5, 1.35, -5.5);
  for (const [x, z] of [[-11.6, 3], [-7.6, 3.6], [8.2, -2.6]]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 14), std(0xff7a1a)); cone.position.set(x, 0.3, z); cone.castShadow = true; scene.add(cone);
  }

  // ---- overhead crane
  const yel = std(0xffc21a, { roughness: 0.5 }), dk = std(0x3a4049), RAIL_Y = 11;
  box(26.6, 0.4, 0.4, yel, 0, RAIL_Y, -5.5); box(26.6, 0.4, 0.4, yel, 0, RAIL_Y, 6.5);
  for (const x of [-12, -4, 4, 12]) box(0.3, 0.3, 0.9, yel, x, RAIL_Y - 0.2, -6.0);
  box(0.5, RAIL_Y, 0.5, yel, -13.4, RAIL_Y / 2, 6.5); box(0.5, RAIL_Y, 0.5, yel, 13.2, RAIL_Y / 2, 6.5);
  const bridge = new THREE.Group(); bridge.position.set(0, RAIL_Y + 0.45, 0); scene.add(bridge);
  box(0.7, 0.5, 12.8, yel, 0, 0, 0.5, bridge);
  const trolley = new THREE.Group(); bridge.add(trolley);
  box(1.0, 0.45, 1.0, dk, 0, -0.2, 0, trolley);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), std(0x3a4049)); trolley.add(cable);
  const hook = new THREE.Group(); trolley.add(hook);
  box(0.34, 0.26, 0.34, std(0xe5484d), 0, 0.13, 0, hook);
  const hk = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.04, 8, 16, Math.PI * 1.5), std(0x3a4049)); hk.position.y = -0.1; hk.castShadow = true; hook.add(hk);
  const crane = {
    setHook(v) {
      bridge.position.x = v.x; trolley.position.z = v.z;
      const hy = v.y + 0.25 - (RAIL_Y + 0.45), len = Math.max(0.1, -0.25 - (hy + 0.26));
      cable.scale.y = len; cable.position.y = -0.25 - len / 2; hook.position.y = hy;
    },
  };

  let fade = 1;
  const fadeCrane = o => {
    if (Math.abs(o - fade) < 0.005) return; fade = o;
    for (const m of [yel, dk]) { m.opacity = o; const tr = o < 0.99; if (m.transparent !== tr) { m.transparent = tr; m.depthWrite = !tr; m.needsUpdate = true; } }
  };

  // ---- sky props for the flight
  const puffMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true });
  const puffs = [];
  for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), puffMat()); m.visible = false; scene.add(m); puffs.push(m); }
  const clouds = new THREE.Group(), cm = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(); g.position.set(-26 + ((i * 37) % 40), 20 + i * 5.2, -12 - ((i * 13) % 9));
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(1.2 + ((i + k) % 3) * 0.5, 10, 8), cm); s.position.set(k * 1.5 - 2.2, (k % 2) * 0.5, 0); s.scale.y = 0.6; g.add(s); }
    clouds.add(g);
  }
  scene.add(clouds);
  const sp = [];
  for (let i = 0; i < 700; i++) {
    const u = Math.random() * 2 - 1, a = Math.random() * 6.283, r = 420, s = Math.sqrt(1 - u * u);
    sp.push(r * s * Math.cos(a), 110 + r * u, r * s * Math.sin(a));
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false }));
  scene.add(stars);

  return { crane, puffs, clouds, stars, fadeCrane };
}
