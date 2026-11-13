// Procedural asset library. Each asset = { partKey: BufferGeometry } merged per material, ready for instancing.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './textures.js';

const V3 = THREE.Vector3;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();

function clean(g) {
  let n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
  return n;
}
export class AB {
  constructor() { this.parts = {}; }
  add(geo, key, pos = [0, 0, 0], rot = [0, 0, 0], scl = [1, 1, 1]) {
    const g = geo.clone();
    _m.compose(new V3(...pos), _q.setFromEuler(_e.set(...rot)), new V3(...(typeof scl === 'number' ? [scl, scl, scl] : scl)));
    g.applyMatrix4(_m); (this.parts[key] ||= []).push(clean(g)); return this;
  }
  addM(geo, key, matrix) { const g = geo.clone(); g.applyMatrix4(matrix); (this.parts[key] ||= []).push(clean(g)); return this; }
  merge(other, pos = [0, 0, 0], rot = [0, 0, 0], scl = 1) {
    _m.compose(new V3(...pos), _q.setFromEuler(_e.set(...rot)), new V3(...(typeof scl === 'number' ? [scl, scl, scl] : scl)));
    for (const [k, gs] of Object.entries(other.parts)) for (const g of gs) { const c = g.clone(); c.applyMatrix4(_m); (this.parts[k] ||= []).push(c); }
    return this;
  }
  build() { const o = {}; for (const [k, gs] of Object.entries(this.parts)) o[k] = mergeGeometries(gs); return o; }
}

// ---------- geometry helpers ----------
// tube with radius varying along t: rFn(t)
export function taperTube(points, rFn, seg = 12, radial = 8) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new V3(...p)));
  const g = new THREE.TubeGeometry(curve, seg, 1, radial, false);
  const pos = g.attributes.position; const frames = curve.computeFrenetFrames(seg, false);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg; const c = curve.getPointAt(t); const r = rFn(t);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j; const v = new V3().fromBufferAttribute(pos, k).sub(c).multiplyScalar(r).add(c);
      pos.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals(); return g;
}
export function lathe(profile, seg = 24, phiStart = 0, phiLength = Math.PI * 2) { return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg, phiStart, phiLength); }
// hipped roof: footprint w (x) x d (z), height h, at y=0 base
export function hipRoof(w, d, h, ridgeFrac = 1) {
  const r = Math.max(0, w - d) * 0.5 * ridgeFrac;
  const A = [-w / 2, 0, d / 2], B = [w / 2, 0, d / 2], C = [w / 2, 0, -d / 2], D = [-w / 2, 0, -d / 2], R1 = [-r, h, 0], R2 = [r, h, 0];
  const tris = [A, B, R2, A, R2, R1, C, D, R1, C, R1, R2, B, C, R2, D, A, R1];
  const pos = new Float32Array(tris.flat()); const uv = new Float32Array(tris.length * 2);
  for (let i = 0; i < tris.length; i++) { const p = tris[i]; const face = Math.floor(i / 6); uv[i * 2] = (face < 2 ? p[0] : p[2]) * 0.25; uv[i * 2 + 1] = (Math.abs(face < 2 ? p[2] : p[0]) + p[1]) * 0.25; }
  // fix uv for end triangles (indices 12..17)
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.computeVertexNormals(); return g;
}
// curved (Indian/Chinese-like) roof skirt: same as hip roof but with sagging slope; built from grid
export function curvedRoof(w, d, h, sag = 0.25, segs = 8) {
  const g = new THREE.BufferGeometry(); const P = [], U = [];
  const r = Math.max(0, w - d) * 0.5;
  // four faces, each a grid from eave (t=0) to ridge (t=1)
  const faces = [
    (s, t) => [THREE.MathUtils.lerp(-w / 2, -r, t) + s * THREE.MathUtils.lerp(w, 2 * r, t), 0, THREE.MathUtils.lerp(d / 2, 0, t)],
    (s, t) => [THREE.MathUtils.lerp(w / 2, r, t) - s * THREE.MathUtils.lerp(w, 2 * r, t), 0, THREE.MathUtils.lerp(-d / 2, 0, t)],
    (s, t) => [THREE.MathUtils.lerp(w / 2, r, t), 0, THREE.MathUtils.lerp(d / 2, 0, t) - s * THREE.MathUtils.lerp(d, 0, t)],
    (s, t) => [THREE.MathUtils.lerp(-w / 2, -r, t), 0, THREE.MathUtils.lerp(-d / 2, 0, t) + s * THREE.MathUtils.lerp(d, 0, t)],
  ];
  for (const [fi, f] of faces.entries()) for (let i = 0; i < segs; i++) for (let j = 0; j < segs; j++) {
    const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i, j + 1]];
    for (const [a, b] of q) {
      const s = a / segs, t = b / segs; const p = f(s, t);
      p[1] = h * (t - sag * Math.sin(t * Math.PI)); P.push(...p);
      U.push((fi < 2 ? p[0] : p[2]) * 0.3, t * Math.hypot(d / 2, h) * 0.3);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.computeVertexNormals(); return g;
}
export function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
export function cyl(r0, r1, h, s = 12) { return new THREE.CylinderGeometry(r0, r1, h, s); }
export function sph(r, w = 16, h = 12) { return new THREE.SphereGeometry(r, w, h); }
// displace sphere-ish geometry by noise for organic shapes
export function noisify(g, amp, freq = 3, seed = 1) {
  const p = g.attributes.position; const r = rng(seed); const o = [r() * 10, r() * 10, r() * 10];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const n = Math.sin(x * freq + o[0]) * Math.sin(y * freq * 1.3 + o[1]) * Math.sin(z * freq * 0.9 + o[2]);
    const l = Math.hypot(x, y, z) || 1; const k = 1 + n * amp / l;
    p.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals(); return g;
}

// ---------- PEOPLE ----------
// flat ribbon along a curve (sashes, drapes). 'away' = point the ribbon faces away from (body axis)
export function ribbon(points, width, away = [0, null, 0], seg = 24, wFn = () => 1) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new V3(...p)));
  const P = [], U = [], I = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const ax = new V3(away[0], away[1] === null ? p.y : away[1], away[2]);
    const n = p.clone().sub(ax); n.y *= 0.2; n.normalize();
    const bi = new V3().crossVectors(tan, n).normalize().multiplyScalar(width * 0.5 * wFn(t));
    const ripple = n.clone().multiplyScalar(Math.sin(t * 23) * 0.006);
    P.push(...p.clone().add(bi).add(ripple).toArray(), ...p.clone().sub(bi).add(ripple).toArray()); U.push(0, t * 4, 1, t * 4);
    if (i < seg) { const k = i * 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals(); return g;
}
// lathe garment with vertical folds
function garmentLathe(profile, seg = 28, folds = 11, amp = 0.05, phiStart = 0, phiLength = Math.PI * 2, zScale = 0.8) {
  const g = lathe(profile, seg, phiStart, phiLength); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x);
    const k = 1 + amp * Math.sin(a * folds + y * 2.1) * Math.min(1, Math.max(0, (1.05 - y) * 2.2));
    p.setXYZ(i, x * k, y, z * k * zScale);
  }
  g.computeVertexNormals(); return g;
}
const limb = (a, b, r0, r1, bulge = 0, seg = 8) => {
  const A = new V3(...a), B = new V3(...b); const m = A.clone().lerp(B, 0.5);
  return taperTube([a, m.toArray(), b], t => r0 + (r1 - r0) * t + bulge * Math.sin(Math.min(1, t * 1.6) * Math.PI), seg, 10);
};
// type: man | monk | woman | soldier | noble | scribe ; pose: stand | walk | sit | throne
export function human({ type = 'man', pose = 'stand', seed = 1, h = 1.7 } = {}) {
  const r = rng(seed); const b = new AB(); const s = h / 1.7;
  const sit = pose === 'sit' || pose === 'throne';
  const fem = type === 'woman';
  const sw = pose === 'walk' ? 0.32 * (0.85 + r() * 0.3) : (r() - 0.5) * 0.08; // stride angle
  const hipY = pose === 'throne' ? 0.52 : pose === 'sit' ? 0.14 : 0.93;
  const hipW = fem ? 0.1 : 0.09;
  // ---------------- legs (skin) & feet
  const legs = [];
  for (const side of [-1, 1]) {
    let hip = [side * hipW, hipY, 0], knee, ankle, toe;
    if (!sit) {
      const a = side * sw; const bend = pose === 'walk' && side * sw < 0 ? 0.25 : 0.05;
      knee = [side * (hipW + 0.005), hipY - 0.44 * Math.cos(a), 0.44 * Math.sin(a)];
      ankle = [side * (hipW + 0.01), knee[1] - 0.42 * Math.cos(a - bend), knee[2] + 0.42 * Math.sin(a - bend)];
      ankle[1] = Math.max(ankle[1], 0.07);
      toe = [ankle[0], 0.03, ankle[2] + 0.14];
    } else if (pose === 'sit') {
      knee = [side * 0.36, 0.13, 0.26]; ankle = [-side * 0.12, 0.08, 0.36]; toe = [-side * 0.24, 0.06, 0.34];
    } else { knee = [side * 0.13, 0.52, 0.44]; ankle = [side * 0.13, 0.08, 0.5]; toe = [side * 0.13, 0.03, 0.64]; }
    b.add(limb(hip, knee, 0.085, 0.058, 0.008), 'skin'); b.add(limb(knee, ankle, 0.056, 0.036, 0.014), 'skin');
    b.add(sph(0.058, 10, 8), 'skin', knee);
    const foot = sph(0.05, 10, 8); foot.scale(0.85, 0.55, 2.0); const fz = new V3(...toe).sub(new V3(...ankle));
    b.add(foot, 'skin', [(ankle[0] + toe[0]) / 2, 0.035, (ankle[2] + toe[2]) / 2], [0, Math.atan2(fz.x, fz.z), 0]);
    legs.push({ hip, knee, ankle });
  }
  // ---------------- torso
  const ty = sit ? hipY + 0.06 : 0.98;
  const torsoProf = fem ? [[0, 0], [0.165, 0], [0.15, 0.12], [0.135, 0.22], [0.16, 0.33], [0.165, 0.4], [0.15, 0.46], [0.08, 0.5], [0, 0.5]]
                        : [[0, 0], [0.155, 0], [0.15, 0.12], [0.16, 0.25], [0.18, 0.37], [0.19, 0.43], [0.15, 0.48], [0.07, 0.51], [0, 0.51]];
  const torso = lathe(torsoProf, 24); torso.scale(1, 1, 0.66); b.add(torso, 'skin', [0, ty, 0]);
  if (!fem) for (const side of [-1, 1]) { const pec = sph(0.075, 10, 8); pec.scale(1.1, 0.75, 0.5); b.add(pec, 'skin', [side * 0.075, ty + 0.36, 0.085]); }
  else for (const side of [-1, 1]) { const br = sph(0.065, 10, 8); br.scale(1, 0.9, 0.8); b.add(br, 'shawl', [side * 0.07, ty + 0.34, 0.08]); }
  const shY = ty + 0.45, shX = fem ? 0.17 : 0.2;
  for (const side of [-1, 1]) b.add(sph(0.062, 10, 8), 'skin', [side * shX, shY, 0]);
  // ---------------- arms
  const armPose = (side) => {
    if (pose === 'throne' && side === -1) return { e: [side * 0.32, shY - 0.15, 0.2], w: [side * 0.42, shY - 0.02, 0.44] };
    if (pose === 'throne') return { e: [side * 0.3, shY - 0.27, 0.06], w: [side * 0.3, shY - 0.33, 0.32] };
    if (pose === 'sit') return { e: [side * 0.25, shY - 0.27, 0.06], w: [side * 0.2, shY - 0.4, 0.3] };
    if (type === 'scribe') return { e: [side * 0.24, shY - 0.26, 0.1], w: [side * 0.12, shY - 0.3, 0.35] };
    const a = pose === 'walk' ? -side * sw * 0.9 : (r() - 0.5) * 0.15;
    const e = [side * (shX + 0.035), shY - 0.28 * Math.cos(a), 0.28 * Math.sin(a)];
    const fb = 0.15 + r() * 0.25; return { e, w: [side * (shX + 0.03), e[1] - 0.26 * Math.cos(a + fb), e[2] + 0.26 * Math.sin(a + fb)] };
  };
  for (const side of [-1, 1]) {
    const sh = [side * shX, shY, 0]; const { e, w } = armPose(side);
    b.add(limb(sh, e, 0.052, 0.04, 0.008), 'skin'); b.add(limb(e, w, 0.04, 0.028, 0.006), 'skin'); b.add(sph(0.04, 8, 6), 'skin', e);
    const dir = new V3(...w).sub(new V3(...e)).normalize(); const hand = sph(0.045, 10, 8); hand.scale(0.75, 1.35, 0.42);
    const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir.clone().negate());
    b.addM(hand, 'skin', new THREE.Matrix4().compose(new V3(...w).addScaledVector(dir, 0.055), q, new V3(1, 1, 1)));
    if (type === 'noble' || fem || r() < 0.3) { const bang = new THREE.TorusGeometry(0.034, 0.008, 6, 14); b.addM(bang, 'gold', new THREE.Matrix4().compose(new V3(...w), new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), dir), new V3(1, 1, 1))); }
    if (type === 'noble') { const arm = new THREE.TorusGeometry(0.05, 0.01, 6, 14); const d2 = new V3(...e).sub(new V3(...sh)).normalize(); b.addM(arm, 'gold', new THREE.Matrix4().compose(new V3(...sh).lerp(new V3(...e), 0.55), new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d2), new V3(1, 1, 1))); }
    if (type === 'monk' && side === 1) { b.add(limb(sh, e, 0.075, 0.062), 'garment'); b.add(limb(e, new V3(...e).lerp(new V3(...w), 0.7).toArray(), 0.064, 0.055), 'garment'); }
    if (type === 'soldier' && side === 1) { b.add(cyl(0.012, 0.012, 2.3, 6), 'pole', [w[0], w[1] + 0.55, w[2] + 0.04]); b.add(new THREE.ConeGeometry(0.03, 0.22, 6), 'iron', [w[0], w[1] + 1.8, w[2] + 0.04]); }
    if (type === 'soldier' && side === -1) { const shd = cyl(0.3, 0.3, 0.035, 24); b.add(shd, 'prop', [w[0] - 0.06, w[1] + 0.12, w[2] + 0.05], [Math.PI / 2, 0, 0.25]); b.add(sph(0.06, 8, 6), 'prop', [w[0] - 0.06, w[1] + 0.12, w[2] + 0.09]); b.add(new THREE.TorusGeometry(0.29, 0.02, 6, 24), 'iron', [w[0] - 0.06, w[1] + 0.12, w[2] + 0.07], [0, 0.25, 0]); }
  }
  // ---------------- garments
  const knee0 = legs[0].knee, knee1 = legs[1].knee;
  if (!sit) {
    if (type === 'monk' || fem || type === 'noble') {
      // long wrap to the ankles (robe / sari / long dhoti), slightly flared, with folds
      const hem = 0.07, top = fem ? 1.08 : (type === 'monk' ? 1.43 : 1.06);
      const prof = type === 'monk'
        ? [[0, hem], [0.27, hem], [0.25, 0.35], [0.21, 0.75], [0.2, 0.98], [0.19, 1.15], [0.205, 1.32], [0.13, 1.42], [0.0, 1.44]]
        : [[0, hem], [0.25, hem], [0.22, 0.4], [0.19, 0.8], [0.175, top - 0.08], [0.17, top], [0, top]];
      const g = garmentLathe(prof, 30, 13, 0.06, type === 'monk' ? -0.55 : 0, type === 'monk' ? Math.PI * 2 - 0.9 : Math.PI * 2, 0.78);
      g.rotateZ(-sw * 0.0); b.add(g, 'garment', [0, 0, 0.0], [0, type === 'monk' ? -Math.PI / 2 : 0, 0]);
      if (fem) for (let k = 0; k < 7; k++) b.add(box(0.025, 0.85, 0.035), 'garment', [-0.06 + k * 0.02, 0.5, 0.17 - Math.abs(k - 3) * 0.004]); // sari pleats
    } else {
      // dhoti: waist wrap + loose cloth around each thigh to just below the knee, front pleat
      const wrap = garmentLathe([[0, 0.78], [0.2, 0.78], [0.19, 0.92], [0.175, 1.06], [0, 1.06]], 24, 9, 0.05); b.add(wrap, 'garment');
      const len = type === 'soldier' ? 0.55 : 0.85;
      for (const L of legs) { const end = new V3(...L.hip).lerp(new V3(...L.knee), len).toArray(); if (type !== 'soldier') { end[1] -= 0.08; } b.add(limb([L.hip[0], L.hip[1] + 0.05, L.hip[2]], end, 0.12, 0.095, 0.01), 'garment'); }
      b.add(ribbon([[0.02, 1.0, 0.15], [0.03, 0.75, 0.17], [0.02, type === 'soldier' ? 0.55 : 0.35, 0.16]], 0.13, [0, null, 0], 10), 'garment');
      b.add(new THREE.TorusGeometry(0.17, 0.02, 6, 20), 'garment', [0, 1.05, 0], [Math.PI / 2, 0, 0], [1, 0.72, 1]); // waist roll
    }
  } else {
    // seated: lap cloth over thighs
    const lap = sph(0.3, 18, 12); lap.scale(1.25, 0.38, 1.05); b.add(lap, 'garment', [0, hipY + 0.04, pose === 'throne' ? 0.18 : 0.12]);
    for (const L of legs) b.add(limb(L.hip, L.knee, 0.115, 0.1), 'garment');
    if (type === 'monk') { const g = garmentLathe([[0, 0.02], [0.4, 0.02], [0.3, 0.18], [0.2, 0.42], [0.2, 0.6], [0.13, 0.7], [0, 0.72]], 28, 11, 0.05, -0.55, Math.PI * 2 - 0.9, 0.85); b.add(g, 'garment', [0, hipY - 0.12, 0.02], [0, -Math.PI / 2, 0]); }
    if (pose === 'throne') for (const L of legs) b.add(limb(L.knee, [L.ankle[0], 0.15, L.ankle[2]], 0.08, 0.07), 'garment');
  }
  // upper body cloth
  if (fem) { // choli + pallu over left shoulder and down the back
    b.add(lathe([[0, 0.3], [0.17, 0.3], [0.175, 0.4], [0.16, 0.46], [0, 0.46]], 20), 'shawl', [0, ty, 0], [0, 0, 0], [1, 1, 0.7]);
    b.add(ribbon([[0.16, 1.0, 0.13], [0.05, 1.18, 0.15], [-0.12, 1.36, 0.1], [-0.17, 1.44, 0], [-0.13, 1.3, -0.12], [-0.08, 0.9, -0.15]], 0.22, [0, null, 0], 26), 'shawl');
  } else if (type === 'soldier') {
    b.add(lathe([[0, 0.02], [0.175, 0.02], [0.18, 0.2], [0.195, 0.36], [0.2, 0.43], [0, 0.43]], 20), 'garment', [0, ty, 0], [0, 0, 0], [1, 1, 0.72]);
    b.add(ribbon([[0.18, ty + 0.44, 0.02], [0.03, ty + 0.3, 0.14], [-0.15, ty + 0.06, 0.1]], 0.06), 'shawl'); b.add(ribbon([[-0.18, ty + 0.44, 0.02], [-0.03, ty + 0.3, 0.14], [0.15, ty + 0.06, 0.1]], 0.06), 'shawl');
    b.add(new THREE.TorusGeometry(0.175, 0.03, 6, 20), 'shawl', [0, ty + 0.04, 0], [Math.PI / 2, 0, 0], [1, 0.74, 1]);
  } else if (type === 'monk') {
    b.add(ribbon([[-0.22, shY + 0.02, 0.0], [-0.12, shY - 0.05, 0.13], [0.05, ty + 0.25, 0.15], [0.17, ty + 0.05, 0.12]], 0.2, [0, null, 0], 20), 'garment');
    b.add(ribbon([[-0.21, shY + 0.03, 0], [-0.15, shY - 0.1, -0.13], [0.0, ty + 0.15, -0.16], [0.15, ty - 0.02, -0.12]], 0.22, [0, null, 0], 20), 'garment');
  } else { // uttariya: shawl over left shoulder, across chest and down the back
    const k = type === 'scribe' || type === 'noble' || r() < 0.65;
    if (k) {
      b.add(ribbon([[0.17, ty + 0.0, 0.12], [0.02, ty + 0.25, 0.155], [-0.14, shY - 0.03, 0.09], [-0.2, shY + 0.04, -0.02], [-0.12, ty + 0.25, -0.15], [0.12, ty + 0.0, -0.12]], 0.15, [0, null, 0], 30), 'shawl');
      b.add(ribbon([[-0.21, shY + 0.02, 0.03], [-0.25, shY - 0.2, 0.06], [-0.24, ty + 0.0, 0.08]], 0.13, [0, null, 0], 10), 'shawl');
    }
  }
  // ---------------- neck & head
  const hy = shY + 0.2;
  b.add(cyl(0.048, 0.056, 0.14, 12), 'skin', [0, shY + 0.07, 0.005]);
  const skull = sph(0.1, 24, 18); skull.scale(0.9, 1.08, 1.04); b.add(skull, 'skin', [0, hy + 0.015, -0.008]);
  const jaw = sph(0.075, 18, 12); jaw.scale(0.95, 0.85, 1.0); b.add(jaw, 'skin', [0, hy - 0.05, 0.03]);
  b.add(new THREE.ConeGeometry(0.02, 0.055, 6), 'skin', [0, hy - 0.012, 0.1], [Math.PI / 2 + 0.35, 0, 0], [1, 1, 0.8]);
  for (const side of [-1, 1]) {
    const ear = sph(0.024, 8, 6); ear.scale(0.4, 1.0, 0.65); b.add(ear, 'skin', [side * 0.09, hy, -0.005]);
    b.add(sph(0.012, 8, 6), 'eye', [side * 0.034, hy + 0.012, 0.087]);
    b.add(box(0.035, 0.008, 0.012), 'hair', [side * 0.035, hy + 0.033, 0.09], [0, 0, side * -0.12]);
  }
  b.add(box(0.035, 0.009, 0.01), 'lips', [0, hy - 0.05, 0.098]);
  if (!fem && type !== 'monk' && (r() < 0.5 || type === 'noble' || type === 'soldier')) { const beard = sph(0.075, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55); beard.scale(0.98, 1.0, 1.04); b.add(beard, 'hair', [0, hy - 0.035, 0.012]); b.add(box(0.055, 0.012, 0.012), 'hair', [0, hy - 0.035, 0.1]); }
  if (type !== 'monk') {
    const cap = sph(0.104, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5); cap.scale(0.93, 1.12, 1.08); b.add(cap, 'hair', [0, hy + 0.025, -0.012]);
    const back = sph(0.098, 14, 10, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.45); back.scale(0.95, 1.1, 1.05); b.add(back, 'hair', [0, hy + 0.01, -0.02], [0, Math.PI, 0]);
  } else { const stub = sph(0.102, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.42); stub.scale(0.91, 1.09, 1.05); b.add(stub, 'stubble', [0, hy + 0.016, -0.008]); }
  if (fem || type === 'scribe' || (type === 'man' && r() < 0.25)) b.add(sph(0.05, 12, 8), 'hair', [0, hy + (fem ? 0.0 : 0.08), -0.1]);
  const turban = type === 'soldier' || type === 'noble' || (type === 'man' && r() < 0.45);
  if (turban) {
    for (let k = 0; k < 3; k++) b.add(new THREE.TorusGeometry(0.088 - k * 0.012, 0.03, 8, 20), 'accent', [0, hy + 0.06 + k * 0.035, -0.012], [Math.PI / 2 + 0.15, 0, k * 0.4], [1, 1.1, 1]);
    const top = sph(0.085, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2); top.scale(1, type === 'noble' ? 1.1 : 0.8, 1.1); b.add(top, 'accent', [0, hy + 0.1, -0.012]);
    if (type === 'noble') { b.add(sph(0.022, 8, 6), 'gold', [0, hy + 0.13, 0.085]); b.add(new THREE.TorusGeometry(0.1, 0.01, 6, 20), 'gold', [0, hy + 0.06, -0.012], [Math.PI / 2 + 0.15, 0, 0], [1, 1.1, 1]); }
  }
  if (type === 'noble' || fem) b.add(new THREE.TorusGeometry(0.09, 0.012, 6, 24), 'gold', [0, shY + 0.0, 0.035], [Math.PI / 2 - 0.5, 0, 0], [1.05, 1, 1]);
  if (fem) for (const side of [-1, 1]) b.add(sph(0.012, 6, 4), 'gold', [side * 0.09, hy - 0.04, 0]);
  // contact shadow decal
  const cs = new THREE.PlaneGeometry(sit ? 1.0 : 0.75, sit ? 1.0 : 0.75); cs.rotateX(-Math.PI / 2); b.add(cs, 'contact', [0, 0.012, sit ? 0.12 : 0.03]);
  const o = b.build(); for (const g of Object.values(o)) g.scale(s, s, s); return o;
}

// ---------- ANIMALS ----------
export function elephant({ seed = 1, caparison = true, howdah = false } = {}) {
  const b = new AB(); const r = rng(seed);
  const body = sph(1, 28, 20); body.scale(1.15, 1.2, 1.75); noisify(body, 0.04, 3, seed); b.add(body, 'skin', [0, 2.15, 0]);
  const rump = sph(1, 20, 14); rump.scale(1.05, 1.1, 0.9); b.add(rump, 'skin', [0, 2.1, -1.0]);
  const head = sph(0.85, 24, 18); head.scale(0.95, 1.05, 0.9); noisify(head, 0.03, 4, seed + 1); b.add(head, 'skin', [0, 2.75, 1.85]);
  for (const s of [-1, 1]) b.add(sph(0.32, 12, 10), 'skin', [s * 0.32, 3.35, 2.05]); // twin domes of forehead (Asian elephant)
  b.add(taperTube([[0, 2.55, 2.55], [0, 2.0, 2.85], [0, 1.2, 2.85], [0, 0.55, 2.65], [0.05, 0.25, 2.8]], t => 0.3 * (1 - t * 0.7), 24, 12), 'skin');
  for (const s of [-1, 1]) {
    const ear = sph(0.65, 16, 12); ear.scale(0.18, 1, 0.85); noisify(ear, 0.05, 5, seed + s); b.add(ear, 'skin', [s * 0.82, 2.65, 1.45], [0, s * 0.35, 0]);
    b.add(taperTube([[s * 0.35, 2.15, 2.45], [s * 0.4, 1.85, 2.85], [s * 0.38, 1.85, 3.15]], t => 0.07 * (1 - t * 0.85), 10, 8), 'ivory');
  }
  for (const [x, z] of [[0.6, 1.0], [-0.6, 1.0], [0.6, -1.1], [-0.6, -1.1]]) {
    const leg = lathe([[0.0, 0], [0.33, 0], [0.31, 0.15], [0.3, 0.8], [0.36, 1.4], [0.45, 1.9], [0, 1.9]], 14);
    const ph = r() * 0.15 - 0.07; b.add(leg, 'skin', [x, 0, z + ph * 3], [ph, 0, 0]);
    b.add(cyl(0.34, 0.34, 0.05, 14), 'nail', [x, 0.03, z + ph * 3 + 0.02]);
  }
  b.add(taperTube([[0, 2.6, -1.85], [0, 2.0, -2.0], [0, 1.2, -2.0]], t => 0.06 * (1 - t * 0.6), 8, 6), 'skin');
  if (caparison) {
    const cap = new THREE.CylinderGeometry(1.24, 1.32, 2.4, 24, 1, true, -Math.PI * 0.42, Math.PI * 0.84);
    b.add(cap, 'cloth', [0, 2.35, -0.25], [Math.PI / 2, 0, Math.PI / 2], [1, 1, 1.05]);
    const trim = new THREE.CylinderGeometry(1.27, 1.35, 2.42, 24, 1, true, -Math.PI * 0.44, Math.PI * 0.06);
    b.add(trim, 'trim', [0, 2.35, -0.25], [Math.PI / 2, 0, Math.PI / 2]);
    const trim2 = trim.clone(); b.add(trim2, 'trim', [0, 2.35, -0.25], [Math.PI / 2, 0, Math.PI / 2], [-1, 1, 1]);
    const head = sph(0.88, 16, 12, -Math.PI * 0.3, Math.PI * 0.6, 0.2, 1.1); b.add(head, 'trim', [0, 2.77, 1.86], [0, 0, 0], [0.98, 1.06, 0.92]);
  }
  if (howdah) {
    b.add(box(1.5, 0.08, 1.6), 'wood', [0, 3.45, -0.2]);
    for (const [x, z] of [[0.7, 0.55], [-0.7, 0.55], [0.7, -0.95], [-0.7, -0.95]]) b.add(cyl(0.04, 0.04, 0.6, 6), 'wood', [x, 3.75, z]);
    b.add(box(1.5, 0.3, 0.05), 'wood', [0, 3.65, 0.58]); b.add(box(1.5, 0.3, 0.05), 'wood', [0, 3.65, -0.98]);
    b.add(box(0.05, 0.3, 1.6), 'wood', [0.74, 3.65, -0.2]); b.add(box(0.05, 0.3, 1.6), 'wood', [-0.74, 3.65, -0.2]);
  }
  return b.build();
}
export function ox({ seed = 1 } = {}) {
  const b = new AB(); const r = rng(seed);
  const body = sph(1, 20, 14); body.scale(0.42, 0.48, 1.0); noisify(body, 0.02, 4, seed); b.add(body, 'skin', [0, 1.05, 0]);
  const hump = sph(0.25, 12, 8); hump.scale(1, 1, 1.4); b.add(hump, 'skin', [0, 1.45, 0.55]);
  const dew = sph(0.25, 12, 8); dew.scale(0.5, 1.2, 1); b.add(dew, 'skin', [0, 0.85, 0.85]);
  const neck = cyl(0.22, 0.3, 0.6, 12); b.add(neck, 'skin', [0, 1.25, 0.95], [-0.9, 0, 0]);
  const head = sph(1, 14, 10); head.scale(0.17, 0.2, 0.32); b.add(head, 'skin', [0, 1.3, 1.25], [0.5, 0, 0]);
  b.add(sph(0.11, 10, 8), 'dark', [0, 1.13, 1.5]);
  for (const s of [-1, 1]) {
    b.add(taperTube([[s * 0.1, 1.5, 1.15], [s * 0.22, 1.7, 1.1], [s * 0.2, 1.88, 1.18]], t => 0.04 * (1 - t * 0.8), 8, 6), 'horn');
    const ear = sph(0.09, 8, 6); ear.scale(1, 0.4, 0.6); b.add(ear, 'skin', [s * 0.2, 1.42, 1.1]);
  }
  for (const [x, z] of [[0.2, 0.6], [-0.2, 0.6], [0.2, -0.65], [-0.2, -0.65]]) {
    const ph = r() * 0.3 - 0.15; b.add(lathe([[0, 0], [0.05, 0], [0.045, 0.1], [0.05, 0.5], [0.09, 0.85], [0, 0.85]], 8), 'skin', [x, 0, z], [ph, 0, 0]);
    b.add(cyl(0.055, 0.06, 0.06, 8), 'dark', [x, 0.03, z]);
  }
  b.add(taperTube([[0, 1.2, -0.95], [0, 0.9, -1.0], [0, 0.45, -1.0]], t => 0.025, 6, 5), 'skin');
  return b.build();
}
export function cart({ load = 'sacks', seed = 1 } = {}) {
  const b = new AB(); const r = rng(seed);
  b.add(box(1.6, 0.1, 2.4), 'wood', [0, 1.0, 0]);
  for (const s of [-1, 1]) {
    b.add(box(0.06, 0.5, 2.4), 'wood', [s * 0.8, 1.25, 0]);
    const wheel = new THREE.TorusGeometry(0.62, 0.06, 8, 24); b.add(wheel, 'wood', [s * 0.92, 0.66, 0], [0, Math.PI / 2, 0]);
    for (let i = 0; i < 8; i++) b.add(cyl(0.025, 0.025, 1.2, 5), 'wood', [s * 0.92, 0.66, 0], [i / 8 * Math.PI, 0, 0]);
    b.add(cyl(0.12, 0.12, 0.2, 10), 'wood', [s * 0.92, 0.66, 0], [0, 0, Math.PI / 2]);
  }
  b.add(cyl(0.05, 0.05, 2.0, 6), 'wood', [0, 0.66, 0], [0, 0, Math.PI / 2]);
  b.add(box(0.1, 0.1, 3.0), 'wood', [0, 0.95, 2.4], [0.12, 0, 0]);
  b.add(cyl(0.05, 0.05, 1.8, 6), 'wood', [0, 1.55, 3.6], [0, 0, Math.PI / 2]); // yoke
  if (load === 'sacks') for (let i = 0; i < 16; i++) { const g = sph(0.32, 10, 8); g.scale(1, 0.7, 1.35); noisify(g, 0.04, 6, i); b.add(g, 'sack', [(i % 2 - 0.5) * 0.7, 1.25 + Math.floor(i / 6) * 0.35, ((i >> 1) % 3 - 1) * 0.75 + r() * 0.1]); }
  if (load === 'pots') for (let i = 0; i < 10; i++) b.add(lathe([[0, 0], [0.18, 0.05], [0.24, 0.2], [0.16, 0.38], [0.1, 0.42], [0.12, 0.45]], 12), 'clay', [(i % 3 - 1) * 0.5, 1.05, (Math.floor(i / 3) - 1.5) * 0.55]);
  return b.build();
}

// ---------- VEGETATION ----------
// broad-leaf tree (neem / peepal / banyan look). Returns parts: bark, leaves
export function tree({ seed = 1, height = 9, spread = 1, cards = 520, leafSize = 1.1, lean = 0 } = {}) {
  const r = rng(seed); const b = new AB(); const tips = [];
  function branch(p0, dir, len, rad, depth) {
    const p1 = p0.clone().add(dir.clone().multiplyScalar(len));
    const mid = p0.clone().lerp(p1, 0.5).add(new V3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(len * 0.15));
    b.add(taperTube([p0.toArray(), mid.toArray(), p1.toArray()], t => rad * (1 - t * 0.45), depth === 0 ? 8 : 4, depth === 0 ? 10 : 6), 'bark');
    if (depth >= 3 || rad < 0.04) { tips.push(p1); return; }
    const n = depth === 0 ? 4 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2 + i / n * Math.PI * 2;
      const up = depth === 0 ? 0.6 + r() * 0.3 : 0.3 + r() * 0.5;
      const d = new V3(Math.cos(a) * spread, up, Math.sin(a) * spread).normalize().lerp(dir, 0.25).normalize();
      branch(p1.clone().lerp(p0, r() * 0.25), d, len * (0.55 + r() * 0.2), rad * 0.55, depth + 1);
    }
    if (depth > 0) tips.push(p1);
  }
  const trunkH = height * 0.38;
  // root flare
  b.add(lathe([[0, 0], [height * 0.06, 0], [height * 0.04, 0.3], [height * 0.033, 0.8], [0, 0.8]], 10), 'bark', [0, -0.2, 0]);
  branch(new V3(0, 0, 0), new V3(lean, 1, 0).normalize(), trunkH, height * 0.035, 0);
  const plane = new THREE.PlaneGeometry(leafSize, leafSize);
  const per = Math.ceil(cards / tips.length);
  for (const tip of tips) for (let i = 0; i < per; i++) {
    const o = new V3(r() - 0.5, (r() - 0.35) * 0.8, r() - 0.5).multiplyScalar(height * 0.28 * (0.4 + r() * 0.6));
    b.add(plane, 'leaves', tip.clone().add(o).toArray(), [r() * 6, r() * 6, r() * 6], 0.7 + r() * 0.8);
  }
  return b.build();
}
export function cypress({ seed = 1, height = 7, cards = 220 } = {}) {
  const r = rng(seed); const b = new AB();
  b.add(cyl(0.08, 0.14, height * 0.9, 6), 'bark', [0, height * 0.45, 0]);
  const plane = new THREE.PlaneGeometry(0.9, 0.9);
  for (let i = 0; i < cards; i++) {
    const t = r(); const y = 0.6 + t * (height - 0.6); const rad = (1 - t) * height * 0.16 + 0.15;
    const a = r() * Math.PI * 2; const rr = rad * Math.sqrt(r());
    b.add(plane, 'leaves', [Math.cos(a) * rr, y, Math.sin(a) * rr], [r() * 6, r() * 6, r() * 6], 0.8 + r() * 0.5);
  }
  return b.build();
}
export function palm({ seed = 1, height = 11 } = {}) {
  const r = rng(seed); const b = new AB(); const lean = (r() - 0.5) * 0.4;
  const top = [lean * height, height, 0];
  b.add(taperTube([[0, 0, 0], [lean * height * 0.3, height * 0.5, 0], top], t => 0.2 - t * 0.06, 12, 8), 'bark');
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2 + r() * 0.3, droop = 0.5 + r() * 0.6, L = 3.2;
    const pts = [top, [top[0] + Math.cos(a) * L * 0.5, top[1] + 0.5, Math.sin(a) * L * 0.5], [top[0] + Math.cos(a) * L, top[1] - droop * 1.5, Math.sin(a) * L]];
    const leaf = taperTube(pts, t => 0.32 * Math.sin(t * Math.PI) + 0.02, 10, 4); leaf.scale(1, 0.25, 1);
    b.add(leaf, 'leaves');
  }
  return b.build();
}
// cheap far-LOD tree canopy blob
export function blobTree({ seed = 1, height = 9 } = {}) {
  const r = rng(seed); const b = new AB();
  b.add(cyl(0.15, 0.25, height * 0.5, 5), 'bark', [0, height * 0.25, 0]);
  for (let i = 0; i < 4; i++) { const g = new THREE.IcosahedronGeometry(height * (0.22 + r() * 0.1), 1); noisify(g, height * 0.04, 1.5, seed + i); b.add(g, 'blob', [(r() - 0.5) * height * 0.35, height * (0.62 + r() * 0.2), (r() - 0.5) * height * 0.35]); }
  return b.build();
}
export function shrub({ seed = 1, size = 1.2 } = {}) {
  const r = rng(seed); const b = new AB(); const plane = new THREE.PlaneGeometry(0.7, 0.7);
  for (let i = 0; i < 40; i++) { const a = r() * Math.PI * 2, rr = r() * size * 0.6; b.add(plane, 'leaves', [Math.cos(a) * rr, r() * size * 0.8 + 0.2, Math.sin(a) * rr], [r() * 6, r() * 6, r() * 6], 0.6 + r() * 0.5); }
  return b.build();
}
export function grassClump({ seed = 1 } = {}) {
  const r = rng(seed); const b = new AB();
  for (let i = 0; i < 22; i++) { const hgt = 0.18 + r() * 0.32; const bl = new THREE.ConeGeometry(0.011, hgt, 3); bl.translate(0, hgt / 2, 0); b.add(bl, 'grass', [(r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4], [(r() - 0.5) * 0.9, r() * 3, (r() - 0.5) * 0.9]); }
  return b.build();
}
export function rockGeo(seed = 1, s = 1) { const g = new THREE.IcosahedronGeometry(s, 3); noisify(g, s * 0.18, 3.1 / s, seed); noisify(g, s * 0.05, 9 / s, seed + 7); g.scale(1.5, 0.42, 1.1); return g; }

// ---------- MAURYAN MONUMENTS ----------
// stylised seated lion (faces +z), approx 1 unit tall
export function lion({ seed = 1 } = {}) {
  const b = new AB();
  const body = sph(1, 16, 12); body.scale(0.22, 0.28, 0.42); b.add(body, 'stone', [0, 0.35, -0.12], [0.5, 0, 0]);
  const mane = sph(0.27, 20, 16); noisify(mane, 0.03, 18, seed); mane.scale(1, 1.05, 0.9); b.add(mane, 'stone', [0, 0.62, 0.1]);
  // mane flame-locks
  for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; const c = new THREE.ConeGeometry(0.05, 0.14, 5); b.add(c, 'stone', [Math.cos(a) * 0.24, 0.62 + Math.sin(a) * 0.25, 0.08], [Math.PI / 2 - 0.2, 0, a - Math.PI / 2], [1, 1, 0.6]); }
  const head = sph(0.15, 16, 12); head.scale(1, 0.95, 1.05); b.add(head, 'stone', [0, 0.66, 0.28]);
  const snout = sph(0.08, 12, 8); snout.scale(1.1, 0.8, 1.2); b.add(snout, 'stone', [0, 0.6, 0.41]);
  b.add(box(0.12, 0.03, 0.08), 'stone', [0, 0.54, 0.4]); // open jaw
  for (const s of [-1, 1]) {
    b.add(sph(0.04, 6, 5), 'stone', [s * 0.1, 0.79, 0.25]);
    b.add(cyl(0.05, 0.045, 0.46, 8), 'stone', [s * 0.11, 0.22, 0.3]);
    b.add(sph(0.06, 8, 6), 'stone', [s * 0.11, 0.03, 0.35], [0, 0, 0], [1, 0.6, 1.4]);
    const haunch = sph(0.15, 10, 8); haunch.scale(0.8, 1, 1.3); b.add(haunch, 'stone', [s * 0.14, 0.17, -0.28]);
  }
  return b.build();
}
// Ashokan pillar. capital: 'four' (4 lions) or 'one' (single standing lion)
export function ashokaPillar({ height = 12, capital = 'four', inscribed = false, girth = 1 } = {}) {
  const hr = height * girth; // radial scale: thicker pillars keep their capital proportions
  const b = new AB(); const shaftH = height * 0.82;
  b.add(cyl(hr * 0.035, hr * 0.044, shaftH, 32), inscribed ? 'inscr' : 'stone', [0, shaftH / 2, 0]);
  let y = shaftH;
  // bell (inverted lotus) with petals
  const bell = lathe([[hr * 0.034, 0], [hr * 0.05, 0.02 * height], [hr * 0.058, 0.05 * height], [hr * 0.05, 0.07 * height], [hr * 0.033, 0.08 * height], [0, 0.08 * height]], 32);
  b.add(bell, 'stone', [0, y, 0]);
  for (let i = 0; i < 24; i++) b.add(box(hr * 0.006, height * 0.07, hr * 0.004), 'stone', [Math.cos(i / 24 * Math.PI * 2) * hr * 0.051, y + height * 0.035, Math.sin(i / 24 * Math.PI * 2) * hr * 0.051], [0, -i / 24 * Math.PI * 2 + Math.PI / 2, 0.15]);
  y += height * 0.08;
  b.add(cyl(hr * 0.032, hr * 0.032, height * 0.012, 24), 'stone', [0, y, 0]); y += height * 0.012;
  // abacus drum with chakra + animals relief
  const abH = height * (capital === 'one' ? 0.045 : 0.035), abR = hr * (capital === 'one' ? 0.052 : 0.047);
  b.add(cyl(abR, abR, abH, 32), 'stone', [0, y + abH / 2, 0]);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const wheel = new THREE.TorusGeometry(abH * 0.35, abH * 0.06, 6, 20); b.add(wheel, 'stone', [Math.cos(a) * abR, y + abH / 2, Math.sin(a) * abR], [0, Math.PI / 2 - a, 0]);
    for (let k = 0; k < 8; k++) b.add(box(abH * 0.04, abH * 0.65, abH * 0.04), 'stone', [Math.cos(a) * abR, y + abH / 2, Math.sin(a) * abR], [0, Math.PI / 2 - a, 0]).add(box(abH * 0.04, abH * 0.65, abH * 0.04), 'stone', [Math.cos(a) * abR, y + abH / 2, Math.sin(a) * abR], [k / 8 * Math.PI, Math.PI / 2 - a, 0]);
    // small animal between wheels
    const a2 = a + Math.PI / 4; const an = sph(abH * 0.3, 8, 6); an.scale(1.8, 1, 0.5);
    b.add(an, 'stone', [Math.cos(a2) * abR, y + abH / 2, Math.sin(a2) * abR], [0, Math.PI / 2 - a2, 0]);
  }
  y += abH;
  const L = lion({});
  if (capital === 'four') {
    const s = hr * 0.075;
    for (let i = 0; i < 4; i++) b.merge(new AB().merge({ parts: Object.fromEntries(Object.entries(L).map(([k, g]) => [k, [g]])) }), [Math.sin(i / 4 * Math.PI * 2) * s * 0.28, y, Math.cos(i / 4 * Math.PI * 2) * s * 0.28], [0, i / 4 * Math.PI * 2, 0], s);
  } else {
    const s = hr * 0.09; // single standing lion
    const st = new AB();
    const body = sph(1, 18, 12); body.scale(0.2, 0.22, 0.5); st.add(body, 'stone', [0, 0.55, 0]);
    const mane = sph(0.25, 18, 14); noisify(mane, 0.03, 16, 3); st.add(mane, 'stone', [0, 0.72, 0.35]);
    const head = sph(0.14, 14, 10); st.add(head, 'stone', [0, 0.8, 0.52]); st.add(sph(0.07, 10, 8), 'stone', [0, 0.74, 0.64], [0, 0, 0], [1.1, 0.8, 1.2]);
    for (const [x, z] of [[0.1, 0.35], [-0.1, 0.35], [0.1, -0.35], [-0.1, -0.35]]) st.add(cyl(0.05, 0.045, 0.45, 8), 'stone', [x, 0.22, z]);
    st.add(taperTube([[0, 0.6, -0.48], [0, 0.4, -0.6], [0.05, 0.15, -0.6]], () => 0.025, 6, 5), 'stone');
    b.merge(st, [0, y, 0], [0, 0, 0], s);
  }
  return b.build();
}

// Stupa (Sanchi-style). Dome radius R
export function stupa({ R = 16 } = {}) {
  const b = new AB();
  const drumH = R * 0.11;
  b.add(cyl(R * 1.18, R * 1.2, drumH, 64), 'medhi', [0, drumH / 2, 0]); // medhi terrace
  b.add(cyl(R * 1.19, R * 1.19, R * 0.06, 64), 'stone', [0, drumH + R * 0.03, 0]);
  const dome = new THREE.SphereGeometry(R, 72, 36, 0, Math.PI * 2, 0, Math.PI * 0.5); dome.scale(1, 0.86, 1);
  // UV: so bricks wrap horizontally with sensible scale
  const uv = dome.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 14, uv.getY(i) * 3.5);
  b.add(dome, 'dome', [0, drumH, 0]);
  const band = cyl(R * 1.005, R * 1.01, R * 0.12, 64, 1); b.add(band, 'plaster', [0, drumH + R * 0.06, 0]);
  const top = drumH + R * 0.86;
  // harmika: square railing box
  const hw = R * 0.4, hh = R * 0.13;
  b.add(box(hw * 0.9, hh * 0.3, hw * 0.9), 'stone', [0, top + hh * 0.05, 0]);
  const railSide = (rot) => {
    const rb = new AB();
    for (let i = 0; i <= 6; i++) rb.add(box(hw * 0.06, hh, hw * 0.06), 'stone', [-hw / 2 + i * hw / 6, hh / 2, hw / 2]);
    for (let k = 0; k < 3; k++) rb.add(box(hw, hh * 0.09, hw * 0.03), 'stone', [0, hh * (0.25 + k * 0.25), hw / 2]);
    rb.add(box(hw * 1.06, hh * 0.14, hw * 0.08), 'stone', [0, hh, hw / 2]);
    b.merge(rb, [0, top, 0], [0, rot, 0]);
  };
  for (let i = 0; i < 4; i++) railSide(i * Math.PI / 2);
  // chhatra: pole with three discs
  b.add(cyl(R * 0.02, R * 0.024, R * 0.86, 12), 'stone', [0, top + R * 0.43, 0]);
  [[0.24, 0.36], [0.2, 0.6], [0.16, 0.82]].forEach(([rr, yy]) => {
    b.add(cyl(R * rr * 0.98, R * rr, R * 0.016, 40), 'stone', [0, top + R * yy, 0]);
    b.add(cyl(R * 0.035, R * 0.06, R * 0.03, 16), 'stone', [0, top + R * yy - R * 0.02, 0]);
  });
  return b.build();
}
// vedika railing along a polyline (array of [x,z]), height h; posts with 3 lens-shaped crossbars + coping
export function vedika(path, { h = 1.4, spacing = 1.1, closed = false } = {}) {
  const b = new AB(); const pts = closed ? [...path, path[0]] : path;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1]; const L = Math.hypot(x1 - x0, z1 - z0); const a = Math.atan2(z1 - z0, x1 - x0);
    const n = Math.max(1, Math.round(L / spacing));
    for (let k = 0; k < n; k++) { const t = k / n; b.add(box(0.2, h, 0.2), 'stone', [x0 + (x1 - x0) * t, h / 2, z0 + (z1 - z0) * t], [0, -a, 0]); }
    for (let k = 0; k < 3; k++) { const bar = cyl(0.09, 0.09, L, 6); bar.scale(1, 1, 0.45); b.add(bar, 'stone', [(x0 + x1) / 2, h * (0.27 + k * 0.24), (z0 + z1) / 2], [0, -a, Math.PI / 2]); }
    const cop = cyl(0.15, 0.15, L + 0.15, 8); cop.scale(1, 1, 0.8); b.add(cop, 'stone', [(x0 + x1) / 2, h + 0.08, (z0 + z1) / 2], [0, -a, Math.PI / 2]);
  }
  return b.build();
}

// ---------- TIMBER & BRICK ARCHITECTURE ----------
export function palisadeLog({ h = 9, r = 0.22 } = {}) {
  const b = new AB();
  b.add(cyl(r, r * 1.05, h, 9), 'log', [0, h / 2, 0]);
  b.add(new THREE.ConeGeometry(r, r * 2.6, 9), 'log', [0, h + r * 1.3, 0]);
  return b.build();
}
// timber watchtower with log-sheathed base, open gallery and pyramid thatch roof
export function watchtower({ h = 15, w = 6, seed = 1 } = {}) {
  const b = new AB(); const r = rng(seed);
  const deck = h * 0.62;
  // log sheathing on the base
  const n = Math.round(w / 0.42);
  for (let s = 0; s < 4; s++) for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n - 0.5; const hh = deck - 0.2 + r() * 0.4;
    const p = s === 0 ? [t * w, hh / 2, w / 2] : s === 1 ? [t * w, hh / 2, -w / 2] : s === 2 ? [w / 2, hh / 2, t * w] : [-w / 2, hh / 2, t * w];
    b.add(cyl(0.21, 0.23, hh, 7), 'log', p);
  }
  // horizontal binding beams + diagonal bracing
  for (let s = 0; s < 4; s++) { const ang = s * Math.PI / 2; const m = new AB(); m.add(box(w + 0.6, 0.25, 0.25), 'timber', [0, 0, w / 2 + 0.25]); for (const y of [deck * 0.3, deck * 0.65, deck - 0.3]) b.merge(m, [0, y, 0], [0, ang, 0]); const d = new AB(); d.add(box(0.2, Math.hypot(w, deck * 0.35), 0.2), 'timber', [0, 0, w / 2 + 0.38], [0, 0, Math.atan2(w, deck * 0.35)]); b.merge(d, [0, deck * 0.47, 0], [0, ang, 0]); }
  // corner posts rising through gallery
  const gh = h * 0.2;
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { b.add(cyl(0.28, 0.32, deck + gh, 8), 'log', [x * w / 2, (deck + gh) / 2, z * w / 2]); }
  b.add(box(w + 1.2, 0.3, w + 1.2), 'timber', [0, deck + 0.15, 0]);
  // gallery railing slats
  for (let s = 0; s < 4; s++) { const m = new AB(); for (let i = 0; i <= 14; i++) m.add(box(0.1, 1.1, 0.08), 'timber', [-(w + 1) / 2 + i * (w + 1) / 14, 0.55, (w + 1) / 2]); m.add(box(w + 1.2, 0.14, 0.14), 'timber', [0, 1.15, (w + 1) / 2]); m.add(box(w + 1.2, 0.1, 0.1), 'timber', [0, 0.35, (w + 1) / 2]); b.merge(m, [0, deck + 0.3, 0], [0, s * Math.PI / 2, 0]); }
  for (let s = 0; s < 4; s++) { const m = new AB(); for (let k = -1; k <= 1; k += 2) m.add(box(0.14, Math.hypot(w * 0.45, gh * 0.9), 0.14), 'timber', [k * w * 0.22, gh * 0.5, w / 2], [0, 0, k * 0.6]); b.merge(m, [0, deck + 0.3, 0], [0, s * Math.PI / 2, 0]); }
  // pyramid thatch roof with eave
  const roof = new THREE.ConeGeometry((w + 3) * 0.72, h * 0.22, 4, 3, true); roof.rotateY(Math.PI / 4);
  b.add(roof, 'thatch', [0, deck + gh + h * 0.11, 0]);
  b.add(new THREE.ConeGeometry(0.3, 1.0, 6), 'timber', [0, deck + gh + h * 0.22 + 0.4, 0]);
  return b.build();
}
// gatehouse — two flanking timber blocks with passage, two-tier tiled roofs
export function gatehouse({ w = 22, d = 10, h = 13 } = {}) {
  const b = new AB(); const pw = 6; // passage width
  const block = (cx) => {
    const bw = (w - pw) / 2; const n = Math.round(bw / 0.45), nd = Math.round(d / 0.45);
    for (let i = 0; i < n; i++) for (const z of [-d / 2, d / 2]) b.add(cyl(0.22, 0.24, h * 0.55, 7), 'log', [cx - bw / 2 + (i + 0.5) * bw / n, h * 0.275, z]);
    for (let i = 0; i < nd; i++) for (const x of [cx - bw / 2, cx + bw / 2]) b.add(cyl(0.22, 0.24, h * 0.55, 7), 'log', [x, h * 0.275, -d / 2 + (i + 0.5) * d / nd]);
    for (const y of [h * 0.15, h * 0.35, h * 0.52]) { b.add(box(bw + 0.5, 0.3, 0.3), 'timber', [cx, y, d / 2 + 0.25]); b.add(box(bw + 0.5, 0.3, 0.3), 'timber', [cx, y, -d / 2 - 0.25]); }
    for (let k = -1; k <= 1; k += 2) b.add(box(0.25, h * 0.5, 0.25), 'timber', [cx + k * bw * 0.2, h * 0.3, d / 2 + 0.4], [0, 0, k * 0.5]);
  };
  block(-(pw + (w - pw) / 2) / 2 - pw / 4); block((pw + (w - pw) / 2) / 2 + pw / 4);
  // lintel & upper storey over passage
  const y1 = h * 0.55;
  b.add(box(w + 1, 0.6, d + 1), 'timber', [0, y1 + 0.3, 0]);
  // open gallery storey: posts + railing
  const gH = h * 0.22;
  for (let i = 0; i <= 10; i++) for (const z of [-d / 2, d / 2]) b.add(box(0.3, gH, 0.3), 'timber', [-w / 2 + i * w / 10, y1 + 0.6 + gH / 2, z]);
  for (let i = 0; i <= 50; i++) for (const z of [-d / 2 - 0.05, d / 2 + 0.05]) b.add(box(0.08, 1.0, 0.06), 'timber', [-w / 2 + i * w / 50, y1 + 1.1, z]);
  for (const z of [-d / 2 - 0.05, d / 2 + 0.05]) { b.add(box(w, 0.12, 0.12), 'timber', [0, y1 + 1.6, z]); b.add(box(w, 0.1, 0.1), 'timber', [0, y1 + 0.75, z]); }
  // lower roof skirt
  const r1 = curvedRoof(w + 5, d + 5, 2.8, 0.18); b.add(r1, 'tiles', [0, y1 + 0.6 + gH, 0]);
  // upper pavilion and roof
  const y2 = y1 + 0.6 + gH + 1.6;
  for (let i = 0; i <= 6; i++) for (const z of [-d * 0.3, d * 0.3]) b.add(box(0.25, 2.6, 0.25), 'timber', [-w * 0.35 + i * w * 0.7 / 6, y2 + 1.3, z]);
  for (let i = 0; i <= 30; i++) for (const z of [-d * 0.3 - 0.05, d * 0.3 + 0.05]) b.add(box(0.07, 0.8, 0.05), 'timber', [-w * 0.35 + i * w * 0.7 / 30, y2 + 0.45, z]);
  b.add(box(w * 0.72, 0.25, d * 0.62), 'timber', [0, y2, 0]);
  const r2 = curvedRoof(w * 0.95, d * 0.95, 3.4, 0.2); b.add(r2, 'tiles', [0, y2 + 2.6, 0]);
  // gate doors (open)
  for (const s of [-1, 1]) b.add(box(pw * 0.48, y1 - 0.5, 0.25), 'timber', [s * (pw / 2 - 0.1), (y1 - 0.5) / 2, -d / 2 + pw * 0.25], [0, s * 1.3, 0]);
  return b.build();
}
// generic brick/plaster house; style: 'flat' (parapet roof), 'hip' (tile roof), 'balcony' (2-storey w/ wooden balcony)
export function house({ w = 8, d = 7, h = 5, style = 'flat', wall = 'brick', seed = 1, roof = 'tiles' } = {}) {
  const b = new AB(); const r = rng(seed);
  b.add(box(w, h, d), wall, [0, h / 2, 0]);
  b.add(box(w + 0.2, 0.5, d + 0.2), wall === 'plaster' || wall === 'plasterPink' ? 'brick' : 'plaster', [0, 0.25, 0]); // plinth
  // band / cornice
  b.add(box(w + 0.3, 0.25, d + 0.3), 'plaster', [0, h - 0.1, 0]);
  // windows and doors (dark recesses with wooden frames)
  const nw = Math.max(1, Math.floor(w / 2.6));
  for (const side of [1, -1]) for (let i = 0; i < nw; i++) {
    const x = -w / 2 + (i + 0.5) * w / nw; const y = h > 4.5 ? h * 0.68 : h * 0.55;
    b.add(box(0.7, 0.9, 0.12), 'dark', [x, y, side * d / 2]);
    b.add(box(0.9, 0.1, 0.18), 'timber', [x, y + 0.5, side * d / 2]); b.add(box(0.9, 0.1, 0.18), 'timber', [x, y - 0.5, side * d / 2]);
    if (h > 4.5 && i % 2 === 0) { b.add(box(1.1, 2.0, 0.12), 'dark', [x, 1.0 + 0.5, side * d / 2]); b.add(box(1.3, 0.15, 0.2), 'timber', [x, 2.55, side * d / 2]); }
  }
  for (const side of [1, -1]) b.add(box(0.12, 0.8, 0.6), 'dark', [side * w / 2, h * 0.6, 0]);
  if (style === 'flat') {
    b.add(box(w, 0.8, 0.25), wall, [0, h + 0.4, d / 2 - 0.12]); b.add(box(w, 0.8, 0.25), wall, [0, h + 0.4, -d / 2 + 0.12]);
    b.add(box(0.25, 0.8, d), wall, [w / 2 - 0.12, h + 0.4, 0]); b.add(box(0.25, 0.8, d), wall, [-w / 2 + 0.12, h + 0.4, 0]);
    b.add(box(w * 0.98, 0.1, d * 0.98), 'plaster', [0, h + 0.05, 0]);
    if (r() < 0.4) { b.add(box(w * 0.4, 2.2, d * 0.4), wall, [w * 0.2, h + 1.1, -d * 0.2]); b.add(hipRoof(w * 0.5, d * 0.5, 1.2), roof, [w * 0.2, h + 2.2, -d * 0.2]); }
  } else {
    b.add(curvedRoof(w + 1.6, d + 1.6, Math.min(w, d) * 0.38, 0.12, 6), roof, [0, h, 0]);
  }
  if (style === 'balcony') { // projecting wooden balcony on front at upper level
    const by = h * 0.55;
    b.add(box(w * 0.9, 0.2, 1.4), 'timber', [0, by, d / 2 + 0.7]);
    for (let i = 0; i <= Math.round(w * 2.4); i++) b.add(box(0.07, 0.9, 0.07), 'timber', [-w * 0.45 + i * (w * 0.9) / Math.round(w * 2.4), by + 0.55, d / 2 + 1.35]);
    b.add(box(w * 0.9, 0.12, 0.12), 'timber', [0, by + 1.0, d / 2 + 1.35]);
    for (let i = 0; i <= 4; i++) b.add(box(0.18, h - by + 0.4, 0.18), 'timber', [-w * 0.45 + i * w * 0.9 / 4, by + (h - by) / 2, d / 2 + 1.35]);
    for (let i = 0; i <= 4; i++) b.add(box(0.15, 0.15, 1.6), 'timber', [-w * 0.45 + i * w * 0.9 / 4, by - 0.15, d / 2 + 0.6]);
  }
  return b.build();
}
// thatch-roofed mud hut / shed
export function hut({ w = 4, d = 4, h = 2.4, seed = 1, open = false } = {}) {
  const b = new AB(); const r = rng(seed);
  if (!open) { b.add(box(w, h, d), 'mud', [0, h / 2, 0]); b.add(box(0.9, 1.7, 0.1), 'dark', [w * 0.2, 0.85, d / 2]); }
  else for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.add(cyl(0.08, 0.1, h + 0.3, 6), 'pole', [x * w / 2, (h + 0.3) / 2, z * d / 2]);
  // pitched thatch roof (gable) with overhang and slight droop
  const rw = w + 1.4, rd = d + 1.4, rh = 1.3 + r() * 0.4;
  const roof = curvedRoof(rw, rd, rh, 0.1, 5); b.add(roof, 'thatch', [0, h, 0]);
  // ragged eave fringe
  b.add(box(rw, 0.15, 0.15), 'thatch', [0, h - 0.05, rd / 2]); b.add(box(rw, 0.15, 0.15), 'thatch', [0, h - 0.05, -rd / 2]);
  return b.build();
}
// market stall with thatch awning and produce
export function stall({ w = 4, d = 3, seed = 1 } = {}) {
  const b = new AB(); const r = rng(seed); const h = 2.4;
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b.add(cyl(0.07, 0.08, h + (z < 0 ? 0.5 : 0), 6), 'pole', [x * w / 2, (h + (z < 0 ? 0.5 : 0)) / 2, z * d / 2]);
  const roof = new THREE.PlaneGeometry(w + 1.0, d + 1.2, 4, 4); const p = roof.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + (Math.random() - 0.5) * 0.08); roof.computeVertexNormals();
  b.add(roof, 'thatch', [0, h + 0.25, 0], [-Math.PI / 2 + 0.2, 0, 0]);
  b.add(box(w * 0.92, 0.08, d * 0.55), 'wood', [0, 0.85, d * 0.12]);
  for (const [x, z] of [[1, 1], [-1, 1]]) b.add(box(0.08, 0.85, 0.08), 'wood', [x * w * 0.42, 0.42, z * d * 0.32]);
  // produce baskets with goods
  const n = Math.round(w / 0.7);
  for (let i = 0; i < n; i++) {
    const x = -w * 0.4 + i * w * 0.8 / (n - 1 || 1);
    b.add(lathe([[0, 0], [0.22, 0.02], [0.28, 0.18], [0, 0.18]], 10), 'basket', [x, 0.89, d * 0.15]);
    for (let k = 0; k < 6; k++) b.add(sph(0.07 + r() * 0.03, 6, 5), 'goods' + (i % 4), [x + (r() - 0.5) * 0.3, 1.05 + r() * 0.08, d * 0.15 + (r() - 0.5) * 0.3]);
  }
  // ground pots & baskets
  for (let i = 0; i < 4; i++) b.add(lathe([[0, 0], [0.16, 0.05], [0.22, 0.2], [0.14, 0.38], [0.09, 0.42], [0.11, 0.46]], 10), 'clay', [-w / 2 + r() * w, 0, d / 2 + 0.3 + r() * 0.6]);
  return b.build();
}
// river boat with a canopy
export function boat({ L = 10, canopy = true, sail = false } = {}) {
  const b = new AB();
  const hull = sph(1, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2); hull.scale(L * 0.12, 0.9, L * 0.5);
  b.add(hull, 'wood', [0, 0.5, 0]); b.add(box(L * 0.22, 0.08, L * 0.8), 'wood', [0, 0.52, 0]);
  if (canopy) { const c = new THREE.CylinderGeometry(L * 0.13, L * 0.13, L * 0.4, 12, 1, true, -Math.PI / 2, Math.PI); b.add(c, 'thatch', [0, 1.3, 0], [Math.PI / 2, 0, 0]); for (const z of [-1, 1]) for (const x of [-1, 1]) b.add(cyl(0.05, 0.05, 1.1, 5), 'pole', [x * L * 0.11, 1.0, z * L * 0.18]); }
  if (sail) { b.add(cyl(0.08, 0.1, L * 0.8, 6), 'pole', [0, L * 0.4 + 0.5, L * 0.1]); b.add(new THREE.PlaneGeometry(L * 0.35, L * 0.5), 'sail', [0, L * 0.42 + 0.5, L * 0.1 + 0.05]); }
  return b.build();
}
// pile of logs (timber yard)
export function logPile({ n = 30, L = 5, seed = 1 } = {}) {
  const b = new AB(); const r = rng(seed); let row = 0, i = 0, inRow = 9;
  while (i < n) { for (let k = 0; k < inRow && i < n; k++, i++) b.add(cyl(0.16, 0.18, L * (0.85 + r() * 0.3), 8), 'log', [(k - inRow / 2) * 0.34 + row * 0.17, 0.17 + row * 0.29, (r() - 0.5) * 0.4], [Math.PI / 2, (r() - 0.5) * 0.08, 0]); row++; inRow--; if (inRow < 1) break; }
  return b.build();
}
// timber scaffold frame (construction)
export function scaffold({ w = 8, h = 6, d = 3 } = {}) {
  const b = new AB();
  for (let i = 0; i <= 3; i++) for (const z of [0, d]) b.add(cyl(0.1, 0.12, h, 6), 'log', [-w / 2 + i * w / 3, h / 2, z]);
  for (const y of [h * 0.45, h * 0.95]) for (const z of [0, d]) b.add(cyl(0.09, 0.09, w + 0.6, 6), 'log', [0, y, z], [0, 0, Math.PI / 2]);
  for (let i = 0; i <= 3; i++) b.add(cyl(0.08, 0.08, d + 0.5, 6), 'log', [-w / 2 + i * w / 3, h * 0.95, d / 2], [Math.PI / 2, 0, 0]);
  b.add(cyl(0.08, 0.08, Math.hypot(w / 3, h * 0.5), 6), 'log', [-w / 3, h * 0.7, 0], [0, 0, Math.atan2(w / 3, h * 0.5)]);
  return b.build();
}
