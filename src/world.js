import * as THREE from 'three';
import * as A from './assets.js';
import { rng } from './textures.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { height, HILL, HILL2, MOAT, riverDist, riverHalfWidth, WATER_Y, makeGroundMask } from './env.js';

const C = (h) => new THREE.Color(h);
// ---------------- instancing registry ----------------
export class Instancer {
  constructor(M) {
    this.M = M; this.reg = new Map();
    const std = (o) => new THREE.MeshStandardMaterial(o);
    this.base = {
      skin: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.52, sheen: 0.22, sheenRoughness: 0.55, sheenColor: new THREE.Color(0x8a4a30), clearcoat: 0.05, clearcoatRoughness: 0.6 }),
      garment: new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: M.cloth, roughness: 0.95, envMapIntensity: 0.5, sheen: 0.3, sheenRoughness: 0.8, sheenColor: new THREE.Color(0x707070) }),
      shawl: std({ color: 0xffffff, map: M.cloth, roughness: 1, envMapIntensity: 0.5 }), accent: std({ color: 0xffffff, map: M.cloth, roughness: 0.8 }),
      hair: M.hair, prop: M.bronze, pole: M.timberUV, ivory: M.ivory, nail: M.ivory, cloth: std({ color: 0xffffff, map: M.cloth, roughness: 0.85 }),
      trim: std({ color: 0xc89a3a, roughness: 0.6, metalness: 0.3 }), wood: M.timberUV, horn: M.horn, dark: M.dark, sack: M.sack,
      clay: std({ color: 0xa8603c, roughness: 0.85 }), bark: M.bark, leaves: M.leaves, blob: M.foliageBlob, grass: std({ color: 0x8a8a4a, roughness: 1 }),
      stone: M.paleStone, inscr: M.inscription, plaster: M.plaster, plasterPink: M.plasterPink, dome: M.stupaBrick, log: M.log, timber: M.timber,
      thatch: M.thatch, tiles: M.roofTiles, tilesRed: M.roofTilesRed, brick: M.brick, brickPale: M.brickPale, mud: M.mud, basket: M.straw,
      goods0: std({ color: 0xd8761e, roughness: 0.6 }), goods1: std({ color: 0xb02a1e, roughness: 0.5 }), goods2: std({ color: 0x6a8a2a, roughness: 0.6 }), goods3: std({ color: 0xe0b030, roughness: 0.7 }),
      sail: M.fabric(0xe0d4b8),
      gold: M.gold, iron: M.iron, eye: std({ color: 0x1a1410, roughness: 0.3 }), lips: std({ color: 0x5a2a22, roughness: 0.6 }), stubble: std({ color: 0xffffff, roughness: 0.75 }),
      contact: new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: contactTex(), transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    };
    for (const k of ['garment', 'shawl', 'accent']) this.base[k].side = THREE.DoubleSide;
    this.base.leaves = M.leaves;
  }
  register(name, parts, { mats = {}, colors = {}, shadow = true } = {}) { this.reg.set(name, { parts, mats, colors, shadow, items: [] }); return name; }
  put(name, x, y, z, ry = 0, s = 1, o = {}) {
    const r = this.reg.get(name); const m = new THREE.Matrix4();
    const sc = Array.isArray(s) ? new THREE.Vector3(...s) : new THREE.Vector3(s, s, s);
    m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, ry, o.rz || 0, 'YXZ')), sc);
    r.items.push({ m, col: o.col || {} });
  }
  ground(name, x, z, ry = 0, s = 1, o = {}) { this.put(name, x, height(x, z) + (o.dy || 0), z, ry, s, o); }
  build(group) {
    for (const [name, r] of this.reg) {
      if (!r.items.length) continue;
      for (const [part, geo] of Object.entries(r.parts)) {
        const mat = r.mats[part] || this.base[part] || this.M.dark;
        const im = new THREE.InstancedMesh(geo, mat, r.items.length); im.name = name + ':' + part;
        r.items.forEach((it, i) => { im.setMatrixAt(i, it.m); const cf = it.col[part] || (r.colors[part] && r.colors[part](i)); if (cf) im.setColorAt(i, cf instanceof THREE.Color ? cf : C(cf)); else if (r.colors[part] || Object.keys(r.colors).length) im.setColorAt(i, C(0xffffff)); });
        im.castShadow = r.shadow && part !== 'grass' && part !== 'contact'; if (part === 'contact') { im.receiveShadow = false; im.renderOrder = 1; } im.receiveShadow = true; im.computeBoundingSphere(); group.add(im);
      }
    }
  }
}

function contactTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#888'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }
// ---------------- palettes ----------------
const PAL = {
  skin: ['#6a4028', '#7a4a2e', '#5a3620', '#84543a', '#4e301c', '#8e5c3c'],
  dhoti: ['#e9e1cf', '#efe7d6', '#e2d8c0', '#d8ccb0', '#ece4d2', '#e6dcc4', '#c9b893'],
  shawl: ['#e8e0cc', '#b8322a', '#8a2a22', '#d4a038', '#e4d8bc', '#7a5a9a', '#c86a2a', '#e4dcc8'],
  monk: ['#c8641e', '#b8561a', '#d2701e', '#a8481a', '#c05c22'],
  monkDeep: ['#8a3a1c', '#9a4420', '#7a2e18'],
  sari: ['#c88a2a', '#a83a2a', '#d8b878', '#8a4a7a', '#c86a3a', '#e0c8a0', '#b84a3a', '#d8a050'],
  turban: ['#efe8d8', '#e8dcc0', '#d8c8a0', '#c03a2a'],
};
const pick = (r, a) => a[Math.floor(r() * a.length)];

// ---------------- builders ----------------
export function buildWorld(scene, M) {
  const G = new THREE.Group(); scene.add(G);
  const I = new Instancer(M); const R = rng(77);
  const ref = { pois: {} };

  // ---- people registry (many variants)
  const peopleKinds = [];
  const mkPeople = (type, pose, n, seed0) => {
    for (let i = 0; i < n; i++) {
      const name = `p_${type}_${pose}_${i}`; const parts = A.human({ type, pose, seed: seed0 + i * 13 });
      I.register(name, parts, { colors: {} }); peopleKinds.push({ name, type, pose });
    }
  };
  for (const t of ['man', 'monk', 'woman', 'soldier', 'noble', 'scribe']) for (const p of ['stand', 'walk']) mkPeople(t, p, t === 'man' ? 3 : 2, t.length * 7 + p.length);
  mkPeople('monk', 'sit', 2, 300); mkPeople('man', 'sit', 2, 310); mkPeople('noble', 'sit', 2, 320); mkPeople('scribe', 'sit', 2, 330); mkPeople('noble', 'throne', 1, 340);
  const personCol = (type, r, over = {}) => {
    const col = { skin: C(pick(r, PAL.skin)), hair: null }; col.stubble = col.skin.clone().multiplyScalar(0.62);
    if (type === 'monk') { col.garment = C(pick(r, r() < 0.3 ? PAL.monkDeep : PAL.monk)); col.shawl = col.garment; }
    else if (type === 'woman') { col.garment = C(pick(r, PAL.sari)); col.shawl = r() < 0.5 ? col.garment.clone().multiplyScalar(0.85) : C(pick(r, PAL.sari)); col.accent = C('#d8a84a'); }
    else if (type === 'soldier') { col.garment = C(pick(r, ['#e2d6b8', '#d8c8a2', '#e8dcc4'])); col.shawl = C('#5a3a22'); col.accent = C(pick(r, ['#efe6d4', '#e0d0b0'])); }
    else if (type === 'noble') { col.garment = C(pick(r, ['#efe6d0', '#f2ead8'])); col.shawl = C(pick(r, ['#9a2a2a', '#d4a038', '#7a3a7a', '#b84a2a'])); col.accent = C('#d8a84a'); }
    else { col.garment = C(pick(r, PAL.dhoti)); col.shawl = C(pick(r, PAL.shawl)); col.accent = C(pick(r, PAL.turban)); }
    return { ...col, ...over };
  };
  const person = (x, z, ry, { type, pose = r => (r() < 0.5 ? 'walk' : 'stand'), y = null, col = {}, s = null } = {}) => {
    const r = rng(Math.floor(x * 131 + z * 71) + 9);
    const tp = type || pick(r, ['man', 'man', 'man', 'woman', 'woman', 'monk', 'soldier', 'scribe']);
    const ps = typeof pose === 'function' ? pose(r) : pose;
    const kinds = peopleKinds.filter(k => k.type === tp && k.pose === ps); const k = pick(r, kinds.length ? kinds : peopleKinds.filter(k => k.type === tp));
    const sc = s ?? (0.92 + r() * 0.14) * (tp === 'woman' ? 0.94 : 1);
    if (y == null) I.ground(k.name, x, z, ry, sc, { col: personCol(tp, r, col) }); else I.put(k.name, x, y, z, ry, sc, { col: personCol(tp, r, col) });
  };
  const crowd = (cx, cz, rx, rz, n, opts = {}) => { for (let i = 0; i < n; i++) { const x = cx + (R() - 0.5) * 2 * rx, z = cz + (R() - 0.5) * 2 * rz; person(x, z, opts.dir !== undefined ? opts.dir + (R() - 0.5) * 0.8 : R() * 6.28, opts); } };

  // ---- animals & carts
  I.register('elephant', A.elephant({ seed: 2 }), { mats: { skin: M.elephant, cloth: M.clothRed } });
  I.register('elephantH', A.elephant({ seed: 3, howdah: true }), { mats: { skin: M.elephant, cloth: M.clothRed } });
  I.register('elephantPlain', A.elephant({ seed: 4, caparison: false }), { mats: { skin: M.elephant } });
  I.register('ox', A.ox({ seed: 1 }), { mats: { skin: M.ox } });
  I.register('cartSacks', A.cart({ load: 'sacks' }));
  I.register('cartPots', A.cart({ load: 'pots' }));
  const oxCart = (x, z, ry, load = 'sacks') => {
    I.ground(load === 'sacks' ? 'cartSacks' : 'cartPots', x, z, ry);
    const fx = Math.sin(ry), fz = Math.cos(ry);
    for (const s of [-1, 1]) I.ground('ox', x + fx * 4.6 + Math.cos(ry) * s * 0.55, z + fz * 4.6 - Math.sin(ry) * s * 0.55, ry);
    person(x + fx * 5.6 + Math.cos(ry) * 1.2, z + fz * 5.6, ry, { type: 'man', pose: 'walk' });
  };
  const mahoutElephant = (x, z, ry, kind = 'elephant') => {
    I.ground(kind, x, z, ry, 0.95);
    const k = peopleKinds.find(k => k.type === 'man' && k.pose === 'sit');
    const fx = Math.sin(ry), fz = Math.cos(ry);
    I.put(k.name, x + fx * 0.9, height(x, z) + 3.15, z + fz * 0.9, ry, 1, { col: personCol('man', rng(x | 0)) });
  };

  // ---- vegetation registry
  const treeKinds = [];
  for (let i = 0; i < 6; i++) { I.register('tree' + i, A.tree({ seed: 100 + i, height: 8 + i * 1.3, cards: 420 + i * 40, leafSize: 1.0 + (i % 3) * 0.2 }), { colors: { leaves: (k) => C(0xffffff).offsetHSL((rng(k + i)() - 0.5) * 0.04, 0, (rng(k * 3 + i)() - 0.5) * 0.2) } }); treeKinds.push('tree' + i); }
  I.register('treeBig', A.tree({ seed: 211, height: 16, cards: 1300, spread: 1.4, leafSize: 1.3 }), { mats: { leaves: M.leavesDark } });
  I.register('treeBig2', A.tree({ seed: 223, height: 14, cards: 1100, spread: 1.3, leafSize: 1.2 }), {});
  I.register('cypress', A.cypress({ seed: 5 }), { mats: { leaves: M.leavesDark } });
  I.register('cypress2', A.cypress({ seed: 6, height: 9 }), { mats: { leaves: M.leavesDark } });
  I.register('palm', A.palm({ seed: 3 }), { mats: { leaves: new THREE.MeshStandardMaterial({ color: 0x4a6a2a, roughness: 0.8, side: THREE.DoubleSide }) } });
  for (let i = 0; i < 3; i++) I.register('blob' + i, A.blobTree({ seed: 400 + i, height: 9 + i * 2 }), { colors: { blob: (k) => C(0x5a7a34).offsetHSL((rng(k)() - 0.5) * 0.05, 0, (rng(k * 7)() - 0.5) * 0.12) }, shadow: true });
  I.register('shrub', A.shrub({ seed: 9 }), {});
  I.register('grass', A.grassClump({ seed: 3 }), { shadow: false, colors: { grass: (k) => C(0xc2a862).offsetHSL((rng(k)() - 0.5) * 0.05, 0, (rng(k * 5)() - 0.5) * 0.2) } });
  for (let i = 0; i < 4; i++) I.register('rock' + i, { stone: A.rockGeo(500 + i, 1) }, { mats: { stone: M.rock } });
  const treeAt = (x, z, s = 1, far = false) => {
    const r = rng(Math.floor(x * 7.1 + z * 13.3)); if (far) I.ground('blob' + Math.floor(r() * 3), x, z, r() * 6, s * (0.8 + r() * 0.5));
    else I.ground(pick(r, treeKinds), x, z, r() * 6, s * (0.85 + r() * 0.35));
  };

  // ======================= ZONE A: PALISADED CITY =======================
  const wall = { x0: -175, x1: 330, z0: -470, z1: 0 };
  ref.pois.gate = new THREE.Vector3(0, 0, 0);
  I.register('log', A.palisadeLog({ h: 9 }), { colors: { log: (k) => { const q = rng(k * 7 + 3); const v = 0.72 + q() * 0.5; return new THREE.Color(v * (0.95 + q() * 0.1), v, v * (0.9 + q() * 0.15)); } } });
  I.register('tower', A.watchtower({ h: 23, w: 7 }), {});
  I.register('rail', { timber: new THREE.BoxGeometry(1, 0.28, 0.3) }, {});
  const palisade = (x0, z0, x1, z1, gaps = []) => {
    const L = Math.hypot(x1 - x0, z1 - z0); const n = Math.floor(L / 0.43); const ry = Math.atan2(x1 - x0, z1 - z0);
    for (let i = 0; i < n; i++) {
      const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
      if (gaps.some(([a, b]) => t * L > a && t * L < b)) continue;
      const r = rng(i * 7 + (x0 | 0)); I.put('log', x, 0.3 + (r() - 0.5) * 0.4, z, r() * 6, [0.9 + r() * 0.25, 0.94 + r() * 0.12, 0.9 + r() * 0.25], { rx: (r() - 0.5) * 0.03, rz: (r() - 0.5) * 0.03 });
    }
    for (const y of [2.2, 6.5]) { // binding rails on the outside face, in segments
      for (let s = 0; s < L; s += 12) {
        if (gaps.some(([a, b]) => s + 6 > a && s + 6 < b)) continue;
        const t = (s + 6) / L; const nx = Math.cos(ry) * 0.32, nz = -Math.sin(ry) * 0.32;
        I.put('rail', x0 + (x1 - x0) * t + nx, y, z0 + (z1 - z0) * t + nz, ry + Math.PI / 2, [12.2, 1, 1]);
      }
    }
  };
  // south wall with gate gap; west wall along the river; east and north walls
  palisade(wall.x0, 0, wall.x1, 0, [[175 - 11, 175 + 11]]);
  palisade(wall.x0, wall.z0, wall.x0, 0);
  palisade(wall.x1, 0, wall.x1, wall.z0);
  palisade(wall.x0, wall.z0, wall.x1, wall.z0);
  const towersAt = [];
  for (let x = wall.x0; x <= wall.x1 + 1; x += 50) if (Math.abs(x) > 20) towersAt.push([x === wall.x0 ? x : x - 10, 0]);
  towersAt.push([-40, 0], [52, 0]);
  for (let z = -50; z > wall.z0; z -= 58) { towersAt.push([wall.x0, z]); towersAt.push([wall.x1, z]); }
  for (let x = wall.x0 + 55; x < wall.x1; x += 62) towersAt.push([x, wall.z0]);
  const seen = new Set();
  for (const [x, z] of towersAt) { const key = Math.round(x / 8) + ',' + z; if (seen.has(key)) continue; seen.add(key); I.put('tower', x, 0, z, 0, 1); }

  // gatehouse
  const gh = A.gatehouse({ w: 22, d: 11, h: 14 }); I.register('gatehouse', gh, {}); I.put('gatehouse', 0, 0, 0, 0, [1.2, 1.25, 1.2]);
  // inner taller gate pavilion behind
  I.register('gatehouse2', A.gatehouse({ w: 20, d: 9, h: 18 }), {}); I.put('gatehouse2', -2, 0, -24, 0, 0.95);
  // banners with chakra on poles flanking the gate
  const bannerGeo = new THREE.PlaneGeometry(1.6, 3.4, 4, 8); { const p = bannerGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getY(i) * 1.4 + p.getX(i)) * 0.12); bannerGeo.computeVertexNormals(); }
  I.register('banner', { banner: bannerGeo, pole: new THREE.CylinderGeometry(0.06, 0.07, 1, 6) }, { mats: { banner: M.banner } });
  const bannerPole = (x, z, h = 12, kind = 'banner') => { const y0 = height(x, z); const r = I.reg.get(kind); const m1 = new THREE.Matrix4().compose(new THREE.Vector3(x + 0.85, y0 + h - 2, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)); r.items.push({ m: m1, col: {} }); };
  // (banner geometry and pole share one matrix — pole scaled separately below)
  I.register('pole', { pole: new THREE.CylinderGeometry(0.07, 0.09, 1, 6) }, {});
  for (const x of [-13, 13]) { bannerPole(x, 6.5, 14); I.put('pole', x, 7, 6.5, 0, [1, 14, 1]); }

  // moat bridge: stone abutments + timber deck + railings
  const bridge = new A.AB();
  // short bridge crossing the narrow left arm of the moat diagonally toward the south-west road (as in R01)
  bridge.add(new THREE.BoxGeometry(8, 3.6, 5), 'stone', [0, -1.0, 4]).add(new THREE.BoxGeometry(8.5, 3.2, 5), 'stone', [0, -1.0, 19]);
  bridge.add(new THREE.BoxGeometry(7, 0.35, 18), 'timber', [0, 0.9, 11.5]);
  for (let z = 7; z <= 16; z += 3) bridge.add(new THREE.CylinderGeometry(0.22, 0.22, 4.5, 8), 'log', [-3, -1.5, z]).add(new THREE.CylinderGeometry(0.22, 0.22, 4.5, 8), 'log', [3, -1.5, z]);
  for (let z = 3; z <= 20; z += 1.4) for (const x of [-3.4, 3.4]) bridge.add(new THREE.BoxGeometry(0.14, 1.1, 0.14), 'timber', [x, 1.6, z]);
  for (const x of [-3.4, 3.4]) bridge.add(new THREE.BoxGeometry(0.16, 0.16, 18), 'timber', [x, 2.15, 11.5]);
  I.register('bridge', bridge.build(), {}); I.put('bridge', -1, 0, 0, -0.46, 1);
  // stone embankment along wall foot facing moat
  I.register('embank', { stone: new THREE.BoxGeometry(1, 1, 1) }, {});
  I.put('embank', 77, -0.6, 4.6, 0, [154, 2.2, 3]); I.put('embank', -90, -0.6, 4.6, 0, [170, 2.2, 3]);

  // houses
  const houseKinds = [];
  const hk = (name, opts, mats = {}) => { I.register(name, A.house(opts), { mats }); houseKinds.push(name); };
  hk('hA', { w: 10, d: 8, h: 6.5, style: 'flat', wall: 'brick', seed: 1 });
  hk('hB', { w: 8, d: 8, h: 5.5, style: 'flat', wall: 'brickPale', seed: 2 });
  hk('hC', { w: 12, d: 9, h: 7, style: 'flat', wall: 'brick', seed: 3 });
  hk('hD', { w: 9, d: 7, h: 5, style: 'hip', wall: 'brickPale', seed: 4, roof: 'tiles' });
  hk('hE', { w: 7, d: 7, h: 4.5, style: 'flat', wall: 'plaster', seed: 5 });
  hk('hF', { w: 14, d: 10, h: 7.5, style: 'hip', wall: 'brick', seed: 6, roof: 'tiles' });
  hk('hG', { w: 9, d: 9, h: 6, style: 'flat', wall: 'brickPale', seed: 7 });
  // keep-out regions inside city: avenue, plaza+palace+garden, gate court
  const keep = [
    [-14, 14, -470, 5], [-30, 30, -60, 5], // avenue + gate court
    [-14, 200, -270, -95], // palace gardens
    [20, 240, -380, -255], // palace hall & courts
    [-180, -150, -470, 0], [300, 340, -470, 0], [-180, 340, -18, 2], [-180, 340, -480, -455], // wall margins
    [-40, 40, -150, -100], // inner plaza
  ];
  const free = (x, z, m = 0) => !keep.some(([a, b, c, d]) => x > a - m && x < b + m && z > c - m && z < d + m);
  for (let x = wall.x0 + 16; x < wall.x1 - 8; x += 11) for (let z = -22; z > wall.z0 + 10; z -= 10.5) {
    const r = rng(x * 31 + z * 17); const jx = x + (r() - 0.5) * 3, jz = z + (r() - 0.5) * 3;
    if (!free(jx, jz, 6)) continue;
    if (r() < 0.2) { treeAt(jx, jz, 1.15); continue; }
    I.put(pick(r, houseKinds), jx, 0.4, jz, Math.round(r() * 4) * Math.PI / 2 + (r() - 0.5) * 0.06, [0.62 + r() * 0.3, 0.75 + r() * 0.5, 0.62 + r() * 0.3]);
    if (r() < 0.55) treeAt(jx + 7, jz + 6, 0.95);
  }
  // avenue trees and people
  for (let z = -40; z > -460; z -= 16) { if (z < -95 && z > -150) continue; treeAt(-12, z, 0.9); treeAt(12, z + 8, 0.9); }
  crowd(0, -60, 9, 35, 70); crowd(0, -200, 8, 60, 50); crowd(0, -125, 30, 20, 40);
  crowd(0, -20, 18, 10, 30); // gate court
  // large hall behind gate court (tiled hipped roof) and pavilions
  const bigHall = new A.AB();
  bigHall.add(new THREE.BoxGeometry(34, 1.2, 16), 'stone', [0, 0.6, 0]);
  for (let i = 0; i <= 10; i++) for (const z of [-7, 7]) bigHall.add(new THREE.CylinderGeometry(0.4, 0.45, 6, 10), 'timber', [-16 + i * 3.2, 4.2, z]);
  bigHall.add(new THREE.BoxGeometry(30, 5, 12), 'plaster', [0, 3.7, 0]);
  bigHall.add(new THREE.BoxGeometry(34.5, 0.6, 15), 'timber', [0, 7.4, 0]);
  bigHall.add(A.curvedRoof(38, 19, 6, 0.15), 'tiles', [0, 7.6, 0]);
  I.register('bigHall', bigHall.build(), {}); I.put('bigHall', 20, 0.4, -75, 0, 1); I.put('bigHall', -40, 0.4, -88, Math.PI / 2, 0.8);
  const pav = new A.AB();
  pav.add(new THREE.BoxGeometry(14, 0.8, 10), 'stone', [0, 0.4, 0]);
  for (const [x, z] of [[-6, -4], [-6, 4], [6, -4], [6, 4], [0, -4], [0, 4], [-3, 4], [3, 4], [-3, -4], [3, -4]]) pav.add(new THREE.CylinderGeometry(0.25, 0.3, 4, 8), 'timber', [x, 2.8, z]);
  pav.add(new THREE.BoxGeometry(14, 0.4, 10), 'timber', [0, 4.9, 0]); pav.add(A.curvedRoof(17, 13, 4, 0.18), 'tiles', [0, 5.1, 0]);
  for (let i = 0; i <= 40; i++) pav.add(new THREE.BoxGeometry(0.06, 0.8, 0.06), 'timber', [-6 + i * 0.3, 1.2, 4.6]);
  I.register('pavilion', pav.build(), {});
  for (const [x, z, r] of [[95, -32, 0], [130, -60, 0.2], [210, -150, Math.PI / 2], [-90, -150, 0], [160, -100, 0], [250, -80, 0], [-60, -40, 0]]) I.put('pavilion', x, 0.4, z, r, 1);

  // Ashoka pillar on the plaza (palace garden axis)
  I.register('pillarCity', A.ashokaPillar({ height: 15, capital: 'four' }), { mats: { stone: M.polishedSandstone } });
  ref.pois.cityPillar = new THREE.Vector3(48, 0, -168);
  I.put('pillarCity', 48, 0.4, -168, 0.4, 1.5);
  I.register('plinth', { stone: new THREE.BoxGeometry(1, 1, 1) }, { mats: { stone: M.paleStone } });
  I.put('plinth', 48, 0.6, -168, 0.4, [6.5, 1.2, 6.5]);
  // palace garden: cypress rows, lawns, pools, people
  for (let x = 0; x <= 190; x += 9) for (const z of [-118, -222]) I.put(x % 18 ? 'cypress' : 'cypress2', x, 0.4, z, 0, 0.9);
  for (let z = -130; z >= -210; z -= 10) for (const x of [-6, 196]) I.put('cypress', x, 0.4, z, 0, 0.9);
  for (let z = -128; z >= -212; z -= 12) for (const x of [26, 70]) I.put('cypress', x, 0.4, z, 0, 0.8);
  for (let i = 0; i < 30; i++) treeAt(90 + R() * 100, -125 - R() * 95, 0.85);
  for (let i = 0; i < 60; i++) I.put('shrub', R() * 190, 0.4, -120 - R() * 100, R() * 6, 0.8 + R());
  crowd(48, -155, 20, 6, 22, { type: 'monk', pose: 'stand' }); crowd(110, -235, 50, 8, 30);
  // pools in garden
  const pool = new A.AB(); pool.add(new THREE.BoxGeometry(30, 0.6, 14), 'stone', [0, 0.3, 0]);
  I.register('poolRim', pool.build(), {}); I.put('poolRim', 135, 0.1, -175, 0, 1); I.put('poolRim', 48, 0.1, -200, 0, [0.6, 1, 0.6]);
  const poolWater = new THREE.Mesh(new THREE.PlaneGeometry(29, 13), new THREE.MeshStandardMaterial({ color: 0x2c4a48, roughness: 0.05, metalness: 0.2 }));
  poolWater.rotation.x = -Math.PI / 2; poolWater.position.set(135, 0.71, -175); G.add(poolWater);

  // ---- PALACE HALL (exterior & interior: ref 1 & 2)
  buildPalaceHall(G, I, M, ref, person, treeAt);

  // ---- along the river: west wall towers, boats, ghats
  for (let i = 0; i < 18; i++) {
    const z = 120 - i * 75 - R() * 30; const hw = riverHalfWidth(z);
    // find river centre x by scanning
    let bx = -300, bd = 1e9; for (let x = -800; x < 200; x += 5) { const d = riverDist(x, z); if (d < bd) { bd = d; bx = x; } }
    const off = (R() - 0.3) * hw * 1.2; const L = 9 + R() * 8;
    const name = 'boat' + (i % 3); if (!I.reg.has(name)) I.register(name, A.boat({ L: 10 + (i % 3) * 3, canopy: i % 3 !== 2, sail: i % 3 === 2 }), {});
    I.put(name, bx + off, WATER_Y - 0.3, z, R() * 0.6 - 0.3 + (R() < 0.5 ? 0 : Math.PI), 1);
  }
  // river traffic in the stretch visible from the gate shot (R01 top left)
  for (let i = 0; i < 60; i++) {
    const z = -300 - R() * 1300; let bx = -300, bd = 1e9; for (let x = -900; x < 400; x += 6) { const d = riverDist(x, z); if (d < bd) { bd = d; bx = x; } }
    const hw = riverHalfWidth(z); I.put('boat' + (i % 3), bx + (R() - 0.5) * hw * 1.4, WATER_Y - 0.3, z, R() * 6, 1.8 + R() * 0.9);
  }
  // far bank trees and countryside
  for (let i = 0; i < 2600; i++) {
    const x = -2400 + R() * 5200, z = -3200 + R() * 4200;
    const hgt = height(x, z);
    if (hgt < 0.2 || riverDist(x, z) < riverHalfWidth(z) + 10) continue;
    if (x > wall.x0 - 30 && x < wall.x1 + 40 && z > wall.z0 - 30 && z < 220) continue;
    if (Math.hypot(x - HILL.x, z - HILL.z) < 260) continue;
    if (Math.hypot(x - 880, z - 270) < 170) continue;
    treeAt(x, z, 1.1, Math.hypot(x - 0, z - 100) > 700);
  }
  // groves on the near river bank (west of city) and palms
  for (let i = 0; i < 160; i++) { const z = -480 + R() * 600, x = -175 - R() * 40; if (height(x, z) > 0.1) treeAt(x, z, 1); }
  for (let i = 0; i < 40; i++) { const x = -150 + R() * 480, z = 40 + R() * 160; if (Math.abs(x) < 70 && z < 110) continue; I.ground('palm', x, z, R() * 6, 0.9 + R() * 0.3); }

  // ======================= OUTSIDE THE GATE (south bank) =======================
  I.register('stall', A.stall({ w: 4.4, d: 3.2, seed: 1 }), {}); I.register('stall2', A.stall({ w: 3.6, d: 3, seed: 2 }), {});
  I.register('hut', A.hut({ w: 5, d: 4.4, h: 2.6, seed: 3 }), {}); I.register('hutOpen', A.hut({ w: 4.6, d: 4, h: 2.5, seed: 4, open: true }), {});
  I.register('logPile', A.logPile({ n: 36, L: 6 }), {}); I.register('scaffold', A.scaffold({ w: 9, h: 7, d: 3 }), {});
  // road from bridge heading south-west, market on its west side
  // market street on the near bank: the road leaves the bridge foot and runs south-west, stalls on both sides (R01 lower left)
  const road0 = new THREE.Vector2(-9.5, 18.5), rdir = new THREE.Vector2(-0.75, 0.66).normalize(), rn = new THREE.Vector2(rdir.y, -rdir.x);
  const along = (t, off) => [road0.x + rdir.x * t + rn.x * off, road0.y + rdir.y * t + rn.y * off];
  for (let i = 0; i < 9; i++) for (const side of [-1, 1]) {
    const [x, z] = along(4 + i * 4.6 + (side > 0 ? 2 : 0), side * 6.2);
    I.ground(i % 2 ? 'stall' : 'stall2', x, z, Math.atan2(-side * rn.x, -side * rn.y) + (R() - 0.5) * 0.12);
  }
  for (let i = 0; i < 6; i++) { const [x, z] = along(8 + i * 7, -12); I.ground('hutOpen', x, z, Math.atan2(rn.x, rn.y) + R() * 0.3); }
  for (let i = 0; i < 120; i++) { const t = R() * 46, off = (R() - 0.5) * 7.5; const [x, z] = along(t, off); person(x, z, Math.atan2(rdir.x, rdir.y) + (R() < 0.5 ? Math.PI : 0) + (R() - 0.5) * 0.8, {}); }
  for (let i = 0; i < 30; i++) { const t = R() * 46, side = R() < 0.5 ? -1 : 1; const [x, z] = along(t, side * 4.4); person(x, z, Math.atan2(side * rn.x, side * rn.y), { pose: 'stand' }); }
  for (let i = 0; i < 26; i++) { const a = -0.46; const zz = 2 + R() * 17, xx = (R() - 0.5) * 5; person(-1 + Math.sin(a) * zz + Math.cos(a) * xx, Math.cos(a) * zz - Math.sin(a) * xx, a + (R() < 0.5 ? Math.PI : 0), { pose: 'walk', y: 1.1 }); }
  for (let i = 0; i < 8; i++) person(-4 + R() * 7, 1 + R() * 3, 0, { type: 'soldier', pose: 'stand' });
  { const [x, z] = along(11, 1.2); mahoutElephant(x, z, Math.atan2(-rdir.x, -rdir.y) + 0.2, 'elephant'); }
  { const [x, z] = along(22, -1.5); oxCart(x, z, Math.atan2(-rdir.x, -rdir.y)); }
  { const [x, z] = along(34, 1.5); oxCart(x, z, Math.atan2(rdir.x, rdir.y), 'pots'); }
  I.ground('elephantPlain', -60, 60, 0.8, 0.9);
  // foreground huts and the timber yard on the south bank of the moat, right of the bridge (R01 bottom centre and right)
  for (const [x, z, r] of [[6, 45.5, 0.08], [14.5, 44.5, -0.05], [23, 45.5, 0.1], [-1, 50, 0.2]]) I.ground('hut', x, z, r, 1);
  for (const [x, z, r] of [[34, 44, 0.05], [41, 45.5, 0.1], [50, 44, -0.05]]) I.ground('logPile', x, z, r, 1);
  I.ground('scaffold', 45, 41.5, 0.0, 1); I.ground('scaffold', 33, 41.8, 0.08, 0.85);
  crowd(42, 44.5, 9, 1.5, 12, { type: 'man', pose: 'stand' });
  for (let i = 0; i < 40; i++) { const x = 60 + R() * 200, z = 45 + R() * 30; I.ground('shrub', x, z, R() * 6, 1 + R()); }
  for (let i = 0; i < 14; i++) treeAt(-80 + R() * 160, 50 + R() * 60 + (R() < 0.5 ? 0 : 40), 0.9);
  treeAt(-6, 30, 0.75); treeAt(-40, 12, 0.8); treeAt(29, 47, 0.7); treeAt(-24, 52, 0.9);

  // ======================= ZONE B: STUPA HILL =======================
  buildStupaHill(G, I, M, ref, person, treeAt);
  // ======================= ZONE C: BRICK TOWN STREET =======================
  buildTown(G, I, M, ref, person, treeAt, oxCart, mahoutElephant);

  I.build(G);
  // ---- ground mask (roads, plazas, wet margins)
  const mask = makeGroundMask(({ g, tx, tz, ts }) => {
    g.filter = 'blur(3px)';
    const rect = (x0, z0, x1, z1, col) => { g.fillStyle = col; g.fillRect(tx(x0), tz(z0), tx(x1) - tx(x0), tz(z1) - tz(z0)); };
    rect(wall.x0, wall.z0, wall.x1, 0, 'rgb(200,0,0)'); // city: mostly trodden earth
    rect(-14, -270, 200, -95, 'rgb(30,0,0)'); // garden lawns
    rect(20, -255, 240, -380, 'rgb(150,0,0)');
    rect(-40, -150, 40, -100, 'rgb(255,0,0)'); rect(30, -180, 66, -156, 'rgb(255,0,0)');
    g.lineCap = 'round'; g.strokeStyle = 'rgb(255,0,0)';
    g.lineWidth = ts(12); g.beginPath(); g.moveTo(tx(0), tz(0)); g.lineTo(tx(-9.5), tz(18.5)); g.lineTo(tx(-45), tz(49.5)); g.lineTo(tx(-90), tz(200)); g.stroke();
    rect(-70, 13, -2, 60, 'rgb(230,0,0)'); rect(-10, 41, 70, 64, 'rgb(200,0,0)');
    // town street & plaza
    rect(820, 150, 960, 400, 'rgb(230,0,0)');
    // hill paths
    g.lineWidth = ts(6); g.beginPath(); g.moveTo(tx(905), tz(170)); g.bezierCurveTo(tx(940), tz(80), tx(960), tz(-30), tx(HILL.x), tz(HILL.z + 40)); g.stroke();
    g.lineWidth = ts(5); g.beginPath(); g.moveTo(tx(HILL.x + 40), tz(HILL.z - 40)); g.lineTo(tx(HILL.x + 6), tz(HILL.z - 6)); g.stroke();
    g.fillStyle = 'rgb(120,0,0)'; g.beginPath(); g.arc(tx(HILL.x), tz(HILL.z), ts(24), 0, Math.PI * 2); g.fill();
    // wet margins of moat
    g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgb(0,0,150)';
    g.fillRect(tx(6), tz(MOAT.z0 - 3), tx(MOAT.x1) - tx(6), tz(MOAT.z1 + 3) - tz(MOAT.z0 - 3));
    g.fillRect(tx(MOAT.x0), tz(MOAT.z0 - 3), tx(6) - tx(MOAT.x0), tz(16) - tz(MOAT.z0 - 3));
    g.globalCompositeOperation = 'source-over';
  });
  return { group: G, I, mask, ref };
}

// ---------------- PALACE HALL ----------------
function buildPalaceHall(G, I, M, ref, person, treeAt) {
  // hall footprint centred at (130, -315), long axis X. Interior floor at y = 2.6
  const cx = 130, cz = -315, W = 72, D = 36, fy = 2.6, colH = 8.5, sp = 7.2;
  ref.pois.hall = { cx, cz, W, D, fy };
  const b = new A.AB();
  // plinth with steps on south face
  b.add(new THREE.BoxGeometry(W + 8, fy, D + 8), 'stone', [0, fy / 2, 0]);
  for (let i = 0; i < 8; i++) b.add(new THREE.BoxGeometry(24, fy / 8, 1.4), 'stone', [0, (i + 0.5) * fy / 8, D / 2 + 4 + (8 - i) * 0.7 - 0.35]);
  // columns: polished wood shafts on stone bases with bracket capitals
  const nx = Math.round(W / sp), nz = Math.round(D / sp);
  const shaft = A.lathe([[0, 0], [0.68, 0], [0.72, colH * 0.2], [0.7, colH * 0.6], [0.62, colH], [0, colH]], 28);
  for (let i = 0; i <= nx; i++) for (let j = 0; j <= nz; j++) {
    const x = -W / 2 + i * sp, z = -D / 2 + j * sp;
    if (Math.abs(x - (W / 2 - 16.2)) < 7 && Math.abs(z) < 7) continue; // clear space for throne
    b.add(new THREE.BoxGeometry(2.1, 0.5, 2.1), 'pstone', [x, fy + 0.25, z]); b.add(new THREE.BoxGeometry(1.8, 1.1, 1.8), 'pstone', [x, fy + 1.05, z]);
    b.add(A.lathe([[0.9, 0], [0.76, 0.3], [0.72, 0.35], [0, 0.35]], 24), 'pstone', [x, fy + 1.6, z]);
    b.add(shaft, 'pwood', [x, fy + 1.95, z]);
    for (const yy of [0.5, 1.0, colH - 0.9, colH - 0.45]) b.add(new THREE.TorusGeometry(0.71 - yy * 0.009, 0.06, 8, 28), 'cwood', [x, fy + 1.95 + yy, z], [Math.PI / 2, 0, 0]);
    // capital: ring, block, bracket arms
    b.add(new THREE.CylinderGeometry(0.62, 0.5, 0.4, 20), 'pwood', [x, fy + 1.95 + colH + 0.2, z]);
    b.add(new THREE.BoxGeometry(1.4, 0.5, 1.4), 'pwood', [x, fy + 1.95 + colH + 0.6, z]);
    b.add(new THREE.BoxGeometry(3.2, 0.4, 0.7), 'pwood', [x, fy + 1.95 + colH + 1.0, z]);
    b.add(new THREE.BoxGeometry(0.7, 0.4, 3.2), 'pwood', [x, fy + 1.95 + colH + 1.0, z]);
  }
  const by = fy + 1.95 + colH + 1.2;
  // main beams both directions, joists, ceiling planks
  for (let j = 0; j <= nz; j++) b.add(new THREE.BoxGeometry(W + 2, 0.8, 0.7), 'cwood', [0, by + 0.4, -D / 2 + j * sp]);
  for (let i = 0; i <= nx; i++) b.add(new THREE.BoxGeometry(0.6, 0.6, D + 2), 'cwood', [-W / 2 + i * sp, by + 1.0, 0]);
  for (let x = -W / 2; x <= W / 2; x += 1.0) b.add(new THREE.BoxGeometry(0.22, 0.28, D + 2), 'cwood', [x, by + 1.45, 0]);
  b.add(new THREE.BoxGeometry(W + 2, 0.1, D + 2), 'cwood', [0, by + 1.65, 0]);
  // outer roof: two-tier curved tile roof
  b.add(A.curvedRoof(W + 12, D + 12, 7, 0.16, 10), 'tiles', [0, by + 1.7, 0]);
  b.add(new THREE.BoxGeometry(W * 0.7, 3, D * 0.45), 'cwood', [0, by + 7, 0]);
  b.add(A.curvedRoof(W * 0.8, D * 0.6, 5, 0.18, 8), 'tiles', [0, by + 8.4, 0]);
  // back (north) wall: partial wall with windows, east end wall behind throne
  // throne dais: 4 steps
  const tx = W / 2 - 16.2;
  for (let k = 0; k < 4; k++) b.add(new THREE.BoxGeometry(10 - k * 1.2, 0.22, 12 - k * 1.4), 'pstone', [tx + 1 + k * 0.6, fy + 0.11 + k * 0.22, 0]);
  const dy = fy + 0.88; ref.pois.throne = new THREE.Vector3(cx + tx + 3.5, dy, cz);
  // throne: seat, back, lion armrests
  b.add(new THREE.BoxGeometry(1.6, 0.7, 1.4), 'cwood', [tx + 3.5, dy + 0.35, 0]);
  b.add(new THREE.BoxGeometry(0.22, 1.9, 1.9), 'cwood', [tx + 4.3, dy + 0.95, 0]);
  b.add(new THREE.CylinderGeometry(0.95, 0.95, 0.24, 24, 1, false, 0, Math.PI), 'cwood', [tx + 4.3, dy + 1.9, 0], [Math.PI / 2, 0, Math.PI / 2]);
  b.add(new THREE.TorusGeometry(0.95, 0.06, 8, 24, Math.PI), 'gold', [tx + 4.18, dy + 1.9, 0], [0, Math.PI / 2, 0]);
  b.add(new THREE.BoxGeometry(0.26, 0.12, 2.0), 'gold', [tx + 4.18, dy + 1.88, 0]);
  b.add(new THREE.BoxGeometry(1.7, 0.18, 1.5), 'redcloth', [tx + 3.5, dy + 0.75, 0]);
  b.add(new THREE.BoxGeometry(5.5, 0.03, 6), 'rug', [tx + 2.5, dy + 0.02, 0]);
  const lionG = A.lion({});
  for (const s of [-1, 1]) { const lb = new A.AB(); for (const [k, g] of Object.entries(lionG)) lb.add(g, 'gold'); b.merge(lb, [tx + 3.3, dy + 0.15, s * 1.05], [0, -Math.PI / 2, 0], 1.25); }
  // stepped carpet runner
  b.add(new THREE.BoxGeometry(6, 0.02, 3), 'rug', [tx - 7, fy + 0.01, 0]);
  // low writing desks and mats
  const parts = b.build();
  const std = (o) => new THREE.MeshStandardMaterial(o);
  I.register('hall', parts, { mats: { stone: M.paleStone, pstone: M.baseStone, pwood: M.polishedWood, cwood: M.carvedWood, wallP: M.plasterPink, gold: M.gold, redcloth: M.clothMaroon, rug: std({ color: 0x8a2a3a, map: M.cloth, roughness: 0.9 }), mat: std({ color: 0xc8b07a, map: M.thatch.map, roughness: 1 }) } });
  I.put('hall', cx, 0.4, cz, 0, 1);
  // separate polished floor (reflective-ish)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, D + 6), M.hallFloor); floor.rotation.x = -Math.PI / 2; floor.position.set(cx, fy + 0.4 + 0.01, cz); floor.receiveShadow = true; G.add(floor);
  const refl = new Reflector(new THREE.PlaneGeometry(W + 6, D + 6), { textureWidth: 1024, textureHeight: 576, clipBias: 0.003, color: 0xffffff });
  refl.material.transparent = true; refl.material.depthWrite = false;
  refl.material.fragmentShader = refl.material.fragmentShader.replace('gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );', 'gl_FragColor = vec4( base.rgb * vec3(1.0, 0.88, 0.72), 0.24 );');
  refl.rotation.x = -Math.PI / 2; refl.position.set(cx, fy + 0.4 + 0.02, cz); G.add(refl); ref.hallReflector = refl;
  // big banner behind throne
  // hanging cloth banner behind the throne (gently rippled), on a gilt rod
  const banG = new THREE.PlaneGeometry(2.4, 5.4, 8, 20); { const p = banG.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3.1 + p.getY(i) * 0.4) * 0.05 + Math.sin(p.getY(i) * 1.7) * 0.03); banG.computeVertexNormals(); }
  const ban = new THREE.Mesh(banG, M.bannerHall); ban.castShadow = true;
  ban.position.set(cx + tx + 6.2, fy + 0.4 + 6.6, cz - 1.0); ban.rotation.y = -Math.PI / 2; G.add(ban);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.8, 10), M.gold); rod.rotation.x = Math.PI / 2; rod.position.set(cx + tx + 6.2, fy + 0.4 + 9.35, cz - 1.0); G.add(rod);
  for (const s of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), M.gold); k.position.set(cx + tx + 6.2, fy + 0.4 + 9.35, cz - 1.0 + s * 1.95); G.add(k); }
  // brass pot of lotuses near steps
  const pot = new THREE.Mesh(A.lathe([[0, 0], [0.35, 0.05], [0.55, 0.35], [0.5, 0.7], [0.38, 0.85], [0.45, 0.95], [0.4, 0.97]], 32), M.gold);
  const yy = fy + 0.4; pot.position.set(cx + tx - 5.2, yy, cz + 2.4); pot.scale.setScalar(0.7); pot.castShadow = true; G.add(pot);
  const lotusMat = new THREE.MeshStandardMaterial({ color: 0xf0a0b8, roughness: 0.6, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28; const fl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 8, 1, true), lotusMat); fl.position.set(pot.position.x + Math.cos(a) * 0.25, yy + 0.8 + (i % 3) * 0.06, pot.position.z + Math.sin(a) * 0.25); fl.rotation.x = Math.PI; G.add(fl); const lf = new THREE.Mesh(new THREE.CircleGeometry(0.22, 10), new THREE.MeshStandardMaterial({ color: 0x4a6a2a, side: THREE.DoubleSide })); lf.position.set(pot.position.x + Math.cos(a + 0.3) * 0.45, yy + 0.7, pot.position.z + Math.sin(a + 0.3) * 0.45); lf.rotation.x = -Math.PI / 2 + 0.4; G.add(lf); }
  // scrolls
  const scrollG = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 10); const paper = new THREE.MeshStandardMaterial({ color: 0xe0cc98, roughness: 0.8 });

  // ---- people in the hall (floor at fy + 0.4). Composition relative to shot-2 camera.
  const Y = fy + 0.4;
  const HC = { x: cx + 9.8, z: cz + 7.6 }; const hf = new THREE.Vector2(cx + tx + 1 - HC.x, cz - 1.5 - HC.z).normalize(); const hl = new THREE.Vector2(hf.y, -hf.x);
  const hat = (fw, lf) => [HC.x + hf.x * fw + hl.x * lf, HC.z + hf.y * fw + hl.y * lf];
  const nearCol = (x, z) => { const gx = (x - (cx - W / 2)) / sp, gz = (z - (cz - D / 2)) / sp; return Math.hypot((gx - Math.round(gx)) * sp, (gz - Math.round(gz)) * sp) < 1.5; };
  const toThrone = (x, z) => Math.atan2(cx + tx + 3.5 - x, cz - z);
  const seat = (fw, lf, type, extra = {}) => { const [x, z] = hat(fw, lf); if (nearCol(x, z)) return; person(x, z, toThrone(x, z) + (extra.turn || 0), { type, pose: 'sit', y: Y, ...extra }); };
  person(cx + tx + 3.65, cz, -Math.PI / 2, { type: 'noble', pose: 'throne', s: 1.6, y: dy + 0.62, col: { garment: C('#f2ead6'), shawl: C('#e9dcc2') } });
  person(cx + tx + 4.6, cz + 1.9, -Math.PI / 2 - 0.3, { type: 'noble', pose: 'stand', y: dy + 0.4, col: { garment: C('#efe6d4'), shawl: C('#e8dcc8') } }); // chauri bearer
  { // fly-whisk (chauri) held up by the bearer, and a bronze gong on a stand at the throne's left
    const fan = new A.AB(); fan.add(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), 'gold', [0, 0.8, 0]);
    const plume = new THREE.ConeGeometry(0.28, 0.75, 14, 4, true); fan.add(plume, 'plume', [0, 1.9, 0], [Math.PI, 0, 0]);
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.28; fan.add(new THREE.ConeGeometry(0.05, 0.6, 5), 'plume', [Math.cos(a) * 0.14, 1.95, Math.sin(a) * 0.14], [Math.PI + Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3]); }
    const gong = new A.AB(); gong.add(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 32), 'bronze', [0, 1.6, 0], [Math.PI / 2, 0, 0]); gong.add(new THREE.SphereGeometry(0.12, 12, 8), 'bronze', [0, 1.6, 0.04]);
    for (const s of [-1, 1]) gong.add(new THREE.CylinderGeometry(0.045, 0.05, 2.4, 8), 'cwood', [s * 0.75, 1.2, 0]); gong.add(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 8), 'cwood', [0, 2.35, 0], [0, 0, Math.PI / 2]);
    I.register('chauri', fan.build(), { mats: { gold: M.gold, plume: new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.9 }) } });
    I.put('chauri', cx + tx + 4.3, dy + 1.25, cz + 1.75, 0, 1, { rz: 0.35 });
    I.register('gong', gong.build(), { mats: { bronze: M.bronze, cwood: M.carvedWood } });
    I.put('gong', cx + tx + 1.2, dy + 0.4, cz - 3.2, Math.PI / 2 - 0.3, 1);
  }
  person(cx + tx + 2.0, cz - 3.8, -Math.PI / 2 - 0.4, { type: 'soldier', pose: 'stand', y: Y + 1.2 });
  person(cx + tx - 1.5, cz - 6.0, -Math.PI / 2 - 0.5, { type: 'soldier', pose: 'stand', y: Y });
  person(cx + tx - 3.0, cz - 7.0, -Math.PI / 2 - 0.6, { type: 'noble', pose: 'stand', y: Y });
  person(cx + tx - 0.5, cz - 8.0, -Math.PI / 2 - 0.6, { type: 'man', pose: 'stand', y: Y });
  // monks in rows, left foreground leading toward the throne
  for (let row = 0; row < 4; row++) for (let k = 0; k < 6; k++) seat(1.05 + k * 1.0 + row * 0.25, 0.55 + row * 1.05, 'monk', { turn: -0.2 });
  // nobles / scholars seated further along on the left (facing throne)
  for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) seat(3.5 + k * 1.4, 6.2 + row * 1.4, k % 2 ? 'noble' : 'man');
  // ministers seated near the dais on the right side
  for (let k = 0; k < 6; k++) { const x = cx + tx - 4 - (k % 3) * 1.7, z = cz - 4.5 - Math.floor(k / 3) * 1.7; if (!nearCol(x, z)) person(x, z, toThrone(x, z), { type: k % 2 ? 'noble' : 'man', pose: 'sit', y: Y }); }
  // scribes at low desks, right foreground
  const scribeDesk = new A.AB();
  for (const [fw, lf] of [[2.1, -0.85], [3.5, -1.55]]) { const [x, z] = hat(fw, lf); if (nearCol(x, z)) continue; person(x, z, toThrone(x, z) + 0.5, { type: 'scribe', pose: 'sit', y: Y, col: { garment: C('#efe7d4'), shawl: C('#e6dac0') } }); const [dx, dz] = hat(fw + 0.75, lf + 0.15); scribeDesk.add(new THREE.BoxGeometry(1.1, 0.42, 0.6), 'cwood', [dx - cx, fy + 0.21, dz - cz], [0, toThrone(x, z) + 0.5, 0]); for (let q = 0; q < 4; q++) scribeDesk.add(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10), 'paper', [dx - cx + (q % 2) * 0.1 - 0.05, fy + 0.47 + Math.floor(q / 2) * 0.08, dz - cz + (q % 2) * 0.09], [0, toThrone(x, z) + 0.5, Math.PI / 2]); }
  // standing courtiers in the far back right
  for (let i = 0; i < 10; i++) { const x = cx + tx - 14 + (i % 5) * 2.4, z = cz - 10 - Math.floor(i / 5) * 2; if (!nearCol(x, z)) person(x, z, toThrone(x, z), { type: i % 2 ? 'noble' : 'man', pose: 'stand', y: Y }); }
  // mats under the monk rows
  for (let row = 0; row < 4; row++) { const [x, z] = hat(5.2 + row * 0.3, 1.3 + row * 1.25); scribeDesk.add(new THREE.BoxGeometry(8, 0.03, 1.1), 'mat', [x - cx, fy + 0.015, z - cz], [0, Math.atan2(hf.x, hf.y) + Math.PI / 2, 0]); }
  I.register('hallProps', scribeDesk.build(), { mats: { paper: new THREE.MeshStandardMaterial({ color: 0xe0cc98, roughness: 0.8 }), cwood: M.carvedWood, mat: new THREE.MeshStandardMaterial({ color: 0xc8b07a, map: M.thatch.map, roughness: 1 }) } }); I.put('hallProps', cx, 0.4, cz, 0, 1);
  // ---- garden north of hall with lotus pond + fountains (visible through open side)
  const gp = new THREE.Mesh(new THREE.PlaneGeometry(60, 24), new THREE.MeshStandardMaterial({ color: 0x3a5a58, roughness: 0.04, metalness: 0.3 }));
  gp.rotation.x = -Math.PI / 2; gp.position.set(cx - 10, 0.75, cz - D / 2 - 26); G.add(gp);
  ref.pois.gardenPond = gp.position.clone();
  const rim = new A.AB(); rim.add(new THREE.BoxGeometry(62, 0.6, 1), 'stone', [0, 0.3, 12.5]).add(new THREE.BoxGeometry(62, 0.6, 1), 'stone', [0, 0.3, -12.5]).add(new THREE.BoxGeometry(1, 0.6, 26), 'stone', [30.5, 0.3, 0]).add(new THREE.BoxGeometry(1, 0.6, 26), 'stone', [-30.5, 0.3, 0]);
  for (const x of [-15, 0, 15]) rim.add(A.lathe([[0, 0], [1.4, 0], [1.5, 0.5], [0.4, 0.6], [0.25, 1.6], [0.8, 1.7], [0.85, 1.9], [0, 1.9]], 20), 'stone', [x, 0.4, 0]);
  I.register('gardenRim', rim.build(), { mats: { stone: M.paleStone } }); I.put('gardenRim', cx - 10, 0.4, cz - D / 2 - 26, 0, 1);
  // fountain jets (soft emissive water)
  const jetMat = new THREE.MeshStandardMaterial({ color: 0xdfeef4, transparent: true, opacity: 0.55, roughness: 0.1, emissive: 0x6a7a80, emissiveIntensity: 0.4, depthWrite: false });
  for (const x of [-15, 0, 15]) { const j = new THREE.Mesh(A.lathe([[0.02, 0], [0.12, 0.6], [0.22, 1.8], [0.08, 3.2], [0, 3.4]], 16), jetMat); j.position.set(cx - 10 + x, 2.3, cz - D / 2 - 26); G.add(j); const sp = new THREE.Mesh(A.lathe([[0, 3.3], [0.6, 3.0], [1.1, 2.2], [1.25, 1.2], [1.3, 0]], 20), jetMat); sp.position.copy(j.position); sp.position.y = 2.2; sp.scale.set(1, 0.95, 1); G.add(sp); }
  // flower beds (pink) and lawn, trees, distant red sandstone colonnade + tower
  I.register('flowers', { f: new THREE.IcosahedronGeometry(0.25, 0) }, { mats: { f: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }) }, colors: { f: (k) => C(pick(rng(k), ['#e870a0', '#f4a0c0', '#e85a8a', '#ffffff', '#f0c040'])) }, shadow: false });
  const RR = rng(5);
  for (let i = 0; i < 1400; i++) { const x = cx - 40 + RR() * 60, z = cz - D / 2 - 10 + -(RR() < 0.5 ? RR() * 3 : 29 + RR() * 3); I.put('flowers', x, 0.55 + RR() * 0.35, z, RR() * 6, 0.6 + RR() * 0.6); }
  for (let i = 0; i < 26; i++) treeAt(cx - 60 + RR() * 120, cz - D / 2 - 45 - RR() * 35, 0.95);
  const col = new A.AB();
  for (let i = 0; i < 22; i++) { col.add(new THREE.CylinderGeometry(0.4, 0.45, 5, 12), 'stone', [i * 4, 2.5, 0]); }
  col.add(new THREE.BoxGeometry(90, 1.4, 5), 'stone', [42, 5.7, 0]); col.add(new THREE.BoxGeometry(90, 6.4, 1), 'stone', [42, 3.2, -2.5]);
  for (let i = 0; i < 45; i++) col.add(new THREE.BoxGeometry(1.2, 0.8, 1.2), 'stone', [i * 2, 6.8, 2]);
  col.add(new THREE.BoxGeometry(8, 16, 8), 'stone', [96, 8, 0]); col.add(new THREE.BoxGeometry(9, 1, 9), 'stone', [96, 16.5, 0]);
  for (const [x, z] of [[-3, -3], [-3, 3], [3, -3], [3, 3]]) col.add(new THREE.CylinderGeometry(0.3, 0.3, 3, 8), 'stone', [96 + x, 18.5, z]);
  col.add(A.curvedRoof(10, 10, 3, 0.2), 'tiles', [96, 20, 0]);
  I.register('colonnade', col.build(), { mats: { stone: M.pinkStone, tiles: M.roofTilesRed } });
  I.put('colonnade', cx - 90, 0.4, cz - D / 2 - 75, 0, 1);
  crowd2(person, cx - 10, cz - D / 2 - 40, 30, 10, 18);
  // eastern garden court seen through the open end of the hall (R02 background): pool, fountains, flowers, trees, red colonnade with tower
  I.put('gardenRim', cx + 70, 0.4, cz - 4, Math.PI / 2, 0.8);
  const gp2 = new THREE.Mesh(new THREE.PlaneGeometry(48, 19), new THREE.MeshStandardMaterial({ color: 0x3a5a58, roughness: 0.04, metalness: 0.3 }));
  gp2.rotation.x = -Math.PI / 2; gp2.rotation.z = Math.PI / 2; gp2.position.set(cx + 70, 0.75, cz - 4); G.add(gp2);
  for (const dz of [-12, 0, 12]) { const j = new THREE.Mesh(A.lathe([[0.02, 0], [0.12, 0.6], [0.22, 1.8], [0.08, 3.2], [0, 3.4]], 16), jetMat); j.position.set(cx + 70, 2.0, cz - 4 + dz); G.add(j); }
  for (let i = 0; i < 900; i++) { const zz = cz - 30 + RR() * 52, xx = cx + 70 + (RR() < 0.5 ? -1 : 1) * (11 + RR() * 3); I.put('flowers', xx, 0.55 + RR() * 0.35, zz, RR() * 6, 0.6 + RR() * 0.6); }
  for (let i = 0; i < 22; i++) treeAt(cx + 50 + RR() * 50, cz - 40 + RR() * 70, 0.9);
  for (let z = -30; z <= 24; z += 9) { I.put('cypress', cx + 52, 0.4, cz + z, 0, 0.85); I.put('cypress', cx + 88, 0.4, cz + z, 0, 0.85); }
  I.put('colonnade', cx + 100, 0.4, cz + 40, Math.PI / 2, 1);
}
function crowd2(person, cx, cz, rx, rz, n) { const r = rng(cx | 0); for (let i = 0; i < n; i++) person(cx + (r() - 0.5) * 2 * rx, cz + (r() - 0.5) * 2 * rz, r() * 6.28, {}); }

// ---------------- STUPA HILL ----------------
function buildStupaHill(G, I, M, ref, person, treeAt) {
  const sx = HILL.x, sz = HILL.z, sy = height(sx, sz);
  ref.pois.stupa = new THREE.Vector3(sx, sy, sz);
  const R = 14;
  I.register('stupa', A.stupa({ R }), { mats: { dome: M.stupaBrick, plaster: M.plaster, stone: M.weatheredStone, medhi: M.brickPale } });
  I.put('stupa', sx, sy - 0.2, sz, 0, 1);
  // circular vedika railing around stupa with a gap for stairs facing NE (toward camera of shot 3)
  const path = []; const rr = R * 1.18 + 5; const gapA = Math.atan2(-1, 1); // direction (+x,-z)
  for (let i = 0; i <= 72; i++) { const a = i / 72 * Math.PI * 2; path.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
  // build as segments skipping the gap
  const segs = []; let cur = [];
  for (const p of path) { const a = Math.atan2(p[1], p[0]); const d = Math.abs(Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA))); if (d < 0.2) { if (cur.length > 1) segs.push(cur); cur = []; } else cur.push(p); }
  if (cur.length > 1) segs.push(cur);
  let k = 0; for (const s of segs) { I.register('vedika' + k, A.vedika(s, { h: 1.5, spacing: 1.6 }), { mats: { stone: M.weatheredStone } }); I.put('vedika' + k, sx, sy - 0.1, sz, 0, 1); k++; }
  // upper terrace railing on the medhi
  const up = []; for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; up.push([Math.cos(a) * R * 1.16, Math.sin(a) * R * 1.16]); }
  I.register('vedikaUp', A.vedika(up, { h: 1.0, spacing: 1.2 }), { mats: { stone: M.weatheredStone } }); I.put('vedikaUp', sx, sy + R * 0.15, sz, 0, 1);
  // stairs from ground to medhi terrace (facing gap direction)
  const st = new A.AB(); const nSt = 10;
  for (let i = 0; i < nSt; i++) st.add(new THREE.BoxGeometry(6, (i + 1) * (R * 0.15) / nSt, 0.7), 'stone', [0, (i + 1) * R * 0.15 / nSt / 2, (nSt - i) * 0.7]);
  st.add(new THREE.BoxGeometry(0.5, R * 0.15 + 0.9, nSt * 0.7 + 0.5), 'stone', [3.2, R * 0.075 + 0.2, nSt * 0.35]).add(new THREE.BoxGeometry(0.5, R * 0.15 + 0.9, nSt * 0.7 + 0.5), 'stone', [-3.2, R * 0.075 + 0.2, nSt * 0.35]);
  I.register('stairs', st.build(), { mats: { stone: M.weatheredStone } });
  const sd = new THREE.Vector2(1, -1).normalize();
  I.put('stairs', sx + sd.x * R * 1.18, sy - 0.15, sz + sd.y * R * 1.18, Math.atan2(sd.x, sd.y), 1);
  // ---- composition relative to the shot-3 camera (NE of stupa, looking SW at the stairs)
  const CAM = { x: sx + 33, z: sz - 33 }; const f = new THREE.Vector2(-1, 1).normalize(); const L = new THREE.Vector2(0.7071, 0.7071); // left of view
  const at = (fw, lf) => [CAM.x + f.x * fw + L.x * lf, CAM.z + f.y * fw + L.y * lf];
  const faceStupa = Math.atan2(f.x, f.y);
  // Ashoka pillar with four lions, square railing (front-left)
  const [px, pz] = at(19, 9.5); ref.pois.hillPillar = new THREE.Vector3(px, height(px, pz), pz);
  I.register('pillarHill', A.ashokaPillar({ height: 14, capital: 'four' }), { mats: { stone: M.polishedSandstone } });
  I.ground('pillarHill', px, pz, 0.9, 1, { dy: -0.1 });
  I.ground('plinth', px, pz, 0.9, [2.6, 0.7, 2.6], { dy: 0.1 });
  const sq = [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6], [-2.6, -2.6]];
  I.register('pillarRail', A.vedika(sq, { h: 1.1, spacing: 1.3 }), { mats: { stone: M.paleStone } }); I.ground('pillarRail', px, pz, faceStupa, 1, { dy: -0.1 });
  // thatched rest pavilion with a seated monk (far left)
  const pv = new A.AB();
  pv.add(new THREE.BoxGeometry(7, 0.5, 6), 'stone', [0, 0.25, 0]);
  for (const [x, z] of [[-3, -2.6], [-3, 2.6], [3, -2.6], [3, 2.6]]) pv.add(new THREE.CylinderGeometry(0.15, 0.18, 3.2, 8), 'log', [x, 1.85, z]);
  pv.add(A.curvedRoof(9, 8, 2, 0.12, 5), 'thatch', [0, 3.3, 0]); pv.add(new THREE.BoxGeometry(2.4, 0.4, 1.4), 'stone', [0.6, 0.7, 0.2]);
  I.register('restPav', pv.build(), {});
  const [pvx, pvz] = at(21, 12.5); I.ground('restPav', pvx, pvz, faceStupa + 0.3, 1);
  person(pvx, pvz, faceStupa + Math.PI / 2 - 0.6, { type: 'monk', pose: 'sit', y: height(pvx, pvz) + 0.9 });
  { const [x, z] = at(20, 10.5); person(x, z, faceStupa - 0.9, { type: 'man', pose: 'sit', y: height(x, z) + 0.5 }); }
  { const [x, z] = at(10.5, 9); person(x, z, faceStupa + Math.PI - 0.6, { type: 'soldier', pose: 'stand' }); }
  { const [x, z] = at(12, 10.5); person(x, z, faceStupa + Math.PI - 0.9, { type: 'man', pose: 'stand' }); }
  { const [x, z] = at(17, 7); person(x, z, faceStupa + 0.2, { type: 'man', pose: 'walk' }); person(x - 1, z + 0.4, faceStupa, { type: 'man', pose: 'stand' }); }
  // pilgrims walking up the path toward the stairs
  const walkers = [[6.5, 1.0, 'monk'], [7.8, -0.4, 'monk'], [5.2, -2.6, 'man'], [7.0, -3.4, 'woman'], [8.6, -4.2, 'man'], [9.8, -4.6, 'woman'], [3.6, -3.6, 'woman'], [11.5, -5.2, 'man']];
  for (const [fw, lf, t] of walkers) { const [x, z] = at(fw, lf); person(x, z, faceStupa + (lf < -2 ? 0.25 : 0.05), { type: t, pose: 'walk' }); }
  // pilgrims circumambulating at the base & monks on the terrace
  for (let i = 0; i < 12; i++) { const a = gapA + 0.5 + i * 0.42; const rr2 = R * 1.18 + 2.4; person(sx + Math.cos(a) * rr2, sz + Math.sin(a) * rr2, -a, { type: i % 3 ? 'monk' : 'man', pose: 'walk' }); }
  for (let i = 0; i < 8; i++) { const a = gapA - 0.9 + i * 0.25 + (i > 3 ? 0.9 : 0); person(sx + Math.cos(a) * R * 1.11, sz + Math.sin(a) * R * 1.11, -a + Math.PI / 2, { type: i % 4 ? 'monk' : 'man', pose: 'stand', y: sy + R * 0.15 - 0.2 }); }
  // rocks (granite slabs), grass, trees
  const r = rng(91);
  for (let i = 0; i < 220; i++) { const a = r() * 6.28, d = 30 + r() * 110; const x = sx + Math.cos(a) * d, z = sz + Math.sin(a) * d; I.ground('rock' + (i % 4), x, z, r() * 6, 0.4 + r() * 1.6, { dy: -0.25 }); }
  for (let i = 0; i < 9000; i++) { const a = r() * 6.28, d = R * 1.18 + 4 + Math.pow(r(), 1.6) * 110; const x = sx + Math.cos(a) * d, z = sz + Math.sin(a) * d; const [cx2, cz2] = at(4, 0); if (Math.hypot(x - cx2, z - cz2) < 3) continue; I.ground('grass', x, z, r() * 6, 0.7 + r() * 0.8); }
  for (const [fw, lf, s] of [[4, 2.6, 1.2], [6, 3.9, 2.0], [9, 6.2, 2.6], [5, 1.5, 0.6], [12, 7.5, 1.8], [3, 1.7, 0.5], [7.5, 5.0, 1.0], [3.2, 2.4, 0.8], [2.4, 1.2, 0.7], [5.5, 4.6, 1.6]]) { const [x, z] = at(fw, lf); I.ground('rock' + ((fw * 3 | 0) % 4), x, z, fw * 2, s, { dy: -0.06 * s }); }
  // denser grass along the path edges (the edging stones read as stamped discs and were removed)
  for (let i = 0; i < 260; i++) { const fw = 2 + r() * 26, lf = (r() < 0.5 ? 1 : -1) * (1.8 + r() * 3.5); const [x, z] = at(fw, lf); I.ground('grass', x, z, r() * 6, 0.8 + r() * 0.9); }
  for (let i = 0; i < 60; i++) { const a = r() * 6.28, d = 55 + r() * 150; treeAt(sx + Math.cos(a) * d, sz + Math.sin(a) * d, 0.9); }
  for (let i = 0; i < 900; i++) { const a = r() * 6.28, d = 260 + r() * 1400; const x = sx + Math.cos(a) * d, z = sz + Math.sin(a) * d; if (height(x, z) < 0.3 || Math.abs(x - 880) < 120 && Math.abs(z - 270) < 120 || (x > -300 && x < 400 && z > -520 && z < 160)) continue; treeAt(x, z, 1.1, d > 500); }
  // big overhanging tree near the camera (top right) and one far left
  { const [x, z] = at(5, -9); I.ground('treeBig', x, z, 2.0, 1.0); }
  { const [x, z] = at(22, 30); I.ground('treeBig2', x, z, 0.4, 1.0); }
  { const [x, z] = at(14, 17); I.ground('treeBig2', x, z, 2.4, 1.05); } // framing tree at the left edge (R03)
  for (const [fw, lf, t] of [[12, 0.6, 'man'], [13, -0.8, 'woman'], [14.5, 0.2, 'monk'], [16, -0.5, 'man'], [10.5, -1.6, 'woman'], [17.5, 0.8, 'monk'], [9, 1.4, 'man'], [15, 1.6, 'woman']]) { const [x, z] = at(fw, lf); person(x, z, faceStupa + (r() - 0.5) * 0.3, { type: t, pose: 'walk' }); }
  { const [x, z] = at(9, 26); treeAt(x, z, 1.1); }
}

// ---------------- BRICK TOWN STREET ----------------
function buildTown(G, I, M, ref, person, treeAt, oxCart, mahoutElephant) {
  const sx = 880; // street centre x; street runs north (-z) from z=360 to gate at z=180
  const gz = 250; ref.pois.townGate = new THREE.Vector3(sx, 0.4, gz);
  // ---- fortified brick wall with gate tower block and pavilions
  const wb = new A.AB();
  const wallH = 10, gateW = 7, gateH = 7.5;
  wb.add(new THREE.BoxGeometry(18, 16, 12), 'brick', [0, 8, 0]); // gate block
  wb.add(new THREE.BoxGeometry(gateW, gateH, 12.4), 'passage', [0, gateH / 2, 0]); // passage (lit tunnel)
  wb.add(new THREE.BoxGeometry(gateW + 1.2, 0.8, 12.6), 'timber', [0, gateH + 0.4, 0]);
  for (let i = 0; i < 8; i++) wb.add(new THREE.BoxGeometry(1.2, 1.4, 1.2), 'brick', [-8 + i * 2.28, 16.7, 6]).add(new THREE.BoxGeometry(1.2, 1.4, 1.2), 'brick', [-8 + i * 2.28, 16.7, -6]);
  for (const s of [-1, 1]) {
    wb.add(new THREE.BoxGeometry(9, 19, 10), 'brick', [s * 13, 9.5, 0]); // flanking towers
    for (let i = 0; i < 4; i++) wb.add(new THREE.BoxGeometry(1.2, 1.4, 1.2), 'brick', [s * 13 - 3.6 + i * 2.4, 19.7, 5]);
    // pavilion on top of towers
    for (const [x, z] of [[-3, -3], [-3, 3], [3, -3], [3, 3]]) wb.add(new THREE.CylinderGeometry(0.22, 0.25, 3.4, 8), 'timber', [s * 13 + x, 20.7, z]);
    wb.add(new THREE.BoxGeometry(8, 0.4, 8), 'timber', [s * 13, 22.5, 0]); wb.add(A.curvedRoof(10.5, 10.5, 3.6, 0.2, 6), 'tiles', [s * 13, 22.6, 0]);
    for (let i = 0; i < 26; i++) wb.add(new THREE.BoxGeometry(0.06, 0.8, 0.06), 'timber', [s * 13 - 3.8 + i * 0.3, 19.8, 3.9]);
    // long curtain walls
    wb.add(new THREE.BoxGeometry(90, wallH, 6), 'brick', [s * (17.5 + 45), wallH / 2, 0]);
    for (let i = 0; i < 38; i++) wb.add(new THREE.BoxGeometry(1.1, 1.3, 1.1), 'brick', [s * (18.5 + i * 2.35), wallH + 0.65, 2.6]);
  }
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) wb.add(new THREE.BoxGeometry(0.8, 1.2, 0.3), 'dark', [s * 13 + (i - 1) * 2.5, 13, 5.05]);
  I.register('townGate', wb.build(), { mats: { brick: M.brickPale, tiles: M.roofTilesRed, passage: new THREE.MeshStandardMaterial({ color: 0x9a8268, roughness: 1, emissive: 0x3a2c1c }) } });
  I.put('townGate', sx, 0.3, gz, 0, 1.15);
  // banners on poles in the street
  I.register('bannerW', { banner: new THREE.PlaneGeometry(1.4, 3.6, 4, 8) }, { mats: { banner: M.bannerWhite } });
  for (const [x, z, h] of [[sx - 3, 300, 12], [sx + 2, 278, 10], [sx - 1, 288, 11]]) { I.put('pole', x, 0.4 + h / 2, z, 0, [1, h, 1]); I.put('bannerW', x + 0.75, 0.4 + h - 2.2, z, 0.4, 1); }
  // ---- buildings along both sides
  const bl = (name, opts) => I.register(name, A.house(opts), { mats: { tiles: M.roofTilesRed } });
  bl('tA', { w: 12, d: 9, h: 7.5, style: 'balcony', wall: 'plasterPink', seed: 11, roof: 'tiles' });
  bl('tB', { w: 10, d: 9, h: 7, style: 'balcony', wall: 'plaster', seed: 12, roof: 'tiles' });
  bl('tC', { w: 11, d: 9, h: 6.5, style: 'flat', wall: 'plasterPink', seed: 13 });
  bl('tD', { w: 9, d: 8, h: 8.5, style: 'hip', wall: 'plaster', seed: 14, roof: 'tiles' });
  I.register('trim', { trimRed: new THREE.BoxGeometry(1, 1, 1) }, { mats: { trimRed: M.trimRed } });
  const kinds = ['tA', 'tB', 'tD', 'tA'];
  // left side (west) faces east, right side faces west. Street half-width ~9
  let z = 352; let i = 0;
  while (z > gz + 16) { const k = kinds[i % 4]; const w = { tA: 12, tB: 10, tC: 11, tD: 9 }[k];
    I.put(k, sx - 12.5, 0.4, z - w / 2, Math.PI / 2, 1); I.put('trim', sx - 12.5 + 4.62, 0.85, z - w / 2, 0, [0.12, 0.9, w]); z -= w + 0.4; i++; }
  z = 340; i = 2;
  while (z > gz + 16) { const k = kinds[i % 4]; const w = { tA: 12, tB: 10, tC: 11, tD: 9 }[k];
    I.put(k, sx + 13.5, 0.4, z - w / 2, -Math.PI / 2, 1); z -= w + 0.4; i++; }
  // pots, baskets and grain sacks along both street edges
  I.register('streetGoods', (() => { const g = new A.AB(); const rr = rng(8); for (let q = 0; q < 7; q++) g.add(A.lathe([[0, 0], [0.18 + rr() * 0.08, 0.05], [0.26, 0.22], [0.16, 0.42], [0.1, 0.46], [0.12, 0.5]], 12), q % 3 ? 'clay' : 'basket', [(rr() - 0.5) * 1.6, 0, (rr() - 0.5) * 1.2], [0, rr() * 6, 0], 0.7 + rr() * 0.6); for (let q = 0; q < 3; q++) { const sk = new THREE.SphereGeometry(0.3, 10, 8); sk.scale(1, 0.75, 1.3); g.add(sk, 'sack', [(rr() - 0.5) * 1.4, 0.2, (rr() - 0.5) * 1.0]); } return g.build(); })(), {});
  { const rg = rng(19); for (let zz = 350; zz > gz + 20; zz -= 4.5) for (const s of [-1, 1]) { if (s < 0 && zz < 346 && zz > 296) continue; I.ground('streetGoods', sx + s * (s < 0 ? 5.6 : 6.6), zz + (rg() - 0.5) * 2, rg() * 6, 1); } }
  // stalls & awnings in front of buildings, hanging textiles
  I.register('awning', { thatch: new THREE.PlaneGeometry(1, 1), pole: new THREE.CylinderGeometry(0.06, 0.07, 1, 6) }, {});
  const clothG = new THREE.PlaneGeometry(0.7, 1.8, 2, 6); { const p = clothG.attributes.position; for (let q = 0; q < p.count; q++) p.setZ(q, Math.sin(p.getY(q) * 3) * 0.04); clothG.computeVertexNormals(); }
  I.register('textile', { cloth: clothG }, { mats: { cloth: new THREE.MeshStandardMaterial({ color: 0xffffff, map: M.cloth, side: THREE.DoubleSide, roughness: 0.9 }) }, colors: { cloth: (k) => C(pick(rng(k * 3 + 1), ['#3a5a9a', '#c83a2a', '#d8a030', '#7a3a7a', '#2a7a6a', '#e07a2a', '#e8d8b0', '#a02a5a'])) } });
  for (let zz = 345; zz > gz + 25; zz -= 7) {
    for (const s of [-1, 1]) {
      const xFace = sx + s * (s < 0 ? 7.6 : 8.6);
      if (s < 0 && zz < 346 && zz > 296) continue; // keep pillar area clear
      I.ground(s < 0 ? 'stall' : 'stall2', xFace + s * -0.5, zz, s < 0 ? Math.PI / 2 : -Math.PI / 2, 1);
      if ((zz | 0) % 3 === 0) for (let q = 0; q < 5; q++) I.put('textile', xFace - s * 1.0, 2.0, zz - 1.6 + q * 0.75, s < 0 ? Math.PI / 2 : -Math.PI / 2, 1);
    }
  }
  // left foreground shopfront with textiles & brass pots (ref 4 left)
  I.register('shopL', A.stall({ w: 7, d: 3.5, seed: 21 }), {}); I.ground('shopL', sx - 8.6, 352, Math.PI / 2, 1.1);
  for (let q = 0; q < 10; q++) I.put('textile', sx - 9.0, 2.3, 348.5 + q * 0.75, Math.PI / 2, 1.1);
  // ---- inscribed pillar with single lion, stone railing
  const px = sx - 4.7, pz = 329.5; ref.pois.townPillar = new THREE.Vector3(px, 0.4, pz);
  I.register('pillarTown', A.ashokaPillar({ height: 9.6, capital: 'one', inscribed: true, girth: 1.85 }), { mats: { stone: M.polishedSandstone, inscr: M.inscription } });
  I.put('pillarTown', px, 0.4, pz, -Math.PI / 2 + 0.25, 1);
  I.put('plinth', px, 0.55, pz, 0, [4.4, 0.7, 4.4]);
  const rail = new A.AB(); const sq = [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6], [-3.6, -3.6]];
  rail.merge({ parts: Object.fromEntries(Object.entries(A.vedika(sq, { h: 1.0, spacing: 1.2 })).map(([k, g]) => [k, [g]])) });
  for (const [x, zq] of [[-3.6, -3.6], [3.6, -3.6], [3.6, 3.6], [-3.6, 3.6], [0, 3.6], [3.6, 0], [0, -3.6], [-3.6, 0]]) rail.add(new THREE.SphereGeometry(0.17, 12, 8), 'stone', [x, 1.22, zq]);
  I.register('pillarRail2', rail.build(), { mats: { stone: M.pinkStone } }); I.put('pillarRail2', px, 0.4, pz, 0, 1.2);
  // big neem tree behind the pillar canopy over top-left
  I.ground('treeBig', sx - 14, 316, 0.3, 1.05);
  // ---- crowd: people reading the pillar, monks, merchants, soldiers marching, elephants, ox cart
  const Y = null;
  person(px + 2.0, pz + 4.2, Math.PI + 0.3, { type: 'man', pose: 'stand', y: Y });
  person(px + 0.9, pz + 4.7, Math.PI, { type: 'man', pose: 'stand', y: Y, s: 0.7 });
  person(px + 2.6, pz + 2.6, -Math.PI / 2 - 0.4, { type: 'monk', pose: 'stand', y: Y });
  person(px + 3.4, pz + 3.4, -Math.PI / 2 - 0.6, { type: 'monk', pose: 'stand', y: Y });
  person(px + 4.4, pz + 4.6, -Math.PI / 2 - 0.9, { type: 'man', pose: 'stand', y: Y, col: { accent: C('#f0e8d8') } });
  person(sx + 0.5, 333, 0.6, { type: 'noble', pose: 'stand', y: Y }); person(sx - 1.2, 334, -0.3, { type: 'man', pose: 'stand', y: Y });
  person(sx + 3.0, 334, Math.PI + 0.3, { type: 'man', pose: 'walk', y: Y });
  for (let q = 0; q < 6; q++) person(sx + 1.0 + (q % 2) * 1.4, 324 - Math.floor(q / 2) * 2.6, 0.05, { type: 'soldier', pose: 'walk', y: Y });
  person(sx + 10.5, 338, -0.3, { type: 'woman', pose: 'walk', y: Y }); person(sx + 10.8, 342, 0.2, { type: 'woman', pose: 'stand', y: Y });
  person(sx - 9.6, 344, Math.PI / 2, { type: 'man', pose: 'stand', y: Y }); person(sx - 8.8, 340, -Math.PI / 2 - 0.2, { type: 'woman', pose: 'stand', y: Y });
  oxCart(sx - 2.2, 297, 0.05, 'sacks');
  mahoutElephant(sx + 6.0, 303, -0.5, 'elephantH'); mahoutElephant(sx + 4, 292, 0.05, 'elephant'); mahoutElephant(sx + 1, 276, 0.1, 'elephant');
  const r = rng(51);
  const clearOf = (x, z) => Math.hypot(x - (sx + 6.0), z - 303) < 4.0 || (Math.abs(x - (sx - 2.2)) < 2.2 && z > 293 && z < 307);
  // foreground crowd between the camera and the pillar (R04 lower half)
  for (let q = 0; q < 26; q++) { const zz = 331 + r() * 10, xx = sx - 3 + r() * 13; if (Math.hypot(xx - px, zz - pz) < 4.6 || clearOf(xx, zz)) continue; person(xx, zz, r() < 0.55 ? Math.PI + (r() - 0.5) * 0.9 : (r() - 0.5) * 0.9, { y: Y, type: pick(r, ['man', 'man', 'woman', 'woman', 'monk', 'soldier', 'noble', 'scribe']) }); }
  for (let q = 0; q < 170; q++) { const zz = 262 + r() * 78, xx = sx - 4.5 + r() * 10; if (clearOf(xx, zz)) continue; person(xx, zz, r() < 0.5 ? (r() - 0.5) * 0.8 : Math.PI + (r() - 0.5) * 0.8, { y: Y, type: pick(r, ['man', 'man', 'woman', 'woman', 'woman', 'monk', 'soldier', 'noble', 'scribe']) }); }
  for (let q = 0; q < 16; q++) person(sx - 4 + r() * 8, 284 - r() * 18, Math.PI, { type: 'soldier', pose: 'walk', y: Y });
  // town outskirts houses (fill around street, behind facades)
  const r2 = rng(61);
  for (let q = 0; q < 70; q++) { const xx = sx - 80 + r2() * 170, zz = gz + 10 + r2() * 170; if (Math.abs(xx - sx) < 21) continue; I.put(pick(r2, ['tA', 'tB', 'tC', 'tD']), xx, 0.4, zz, Math.round(r2() * 4) * Math.PI / 2, 1); }
  for (let q = 0; q < 26; q++) treeAt(sx - 90 + r2() * 190, gz - 20 - r2() * 80, 1.0);
  // hill path with monk procession (visible above the gate, ref 4)
  for (let q = 0; q < 14; q++) { const t = q / 14; const xx = 925 + t * 65, zz = 215 - t * 110; person(xx + Math.sin(q) * 2, zz, Math.PI - 0.4, { type: q % 4 ? 'monk' : 'man', pose: 'walk' }); }
  // hilltop pavilion to the right of the stupa (ref 4)
  const hp = new A.AB();
  hp.add(new THREE.BoxGeometry(22, 1.2, 12), 'stone', [0, 0.6, 0]);
  for (let q = 0; q <= 7; q++) for (const zq of [-5, 5]) hp.add(new THREE.CylinderGeometry(0.3, 0.35, 4, 8), 'timber', [-10 + q * 20 / 7, 3.2, zq]);
  hp.add(new THREE.BoxGeometry(22, 0.5, 12), 'timber', [0, 5.4, 0]); hp.add(A.curvedRoof(25, 15, 4, 0.15, 6), 'tiles', [0, 5.6, 0]);
  for (let q = 0; q < 70; q++) hp.add(new THREE.BoxGeometry(0.07, 0.9, 0.07), 'timber', [-10.5 + q * 0.3, 1.65, 6]);
  I.register('hillPav', hp.build(), { mats: { stone: M.paleStone, tiles: M.roofTilesRed } });
  const hpx = HILL2.x + 28, hpz = HILL2.z + 4;
  I.register('stupaWhite', A.stupa({ R: 11 }), { mats: { dome: M.plaster, plaster: M.plaster, stone: M.weatheredStone, medhi: M.plaster } });
  I.ground('stupaWhite', HILL2.x, HILL2.z, 0, 1, { dy: -0.3 });
  for (let q = 0; q < 24; q++) { const a = r2() * 6.28, d = 20 + r2() * 60; treeAt(HILL2.x + Math.cos(a) * d, HILL2.z + Math.sin(a) * d, 1.0); } I.ground('hillPav', hpx, hpz, -0.3, 1, { dy: -0.5 });
}
