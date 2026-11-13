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
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const gss = (x, s) => Math.exp(-(x * x) / (2 * s * s));
const mix = (a, b, t) => a + (b - a) * t;
const toV = (p) => (p.isVector3 ? p.clone() : new V3(...p));
const pwl = (keys, t) => { if (t <= keys[0][0]) return keys[0][1]; for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const [t0, a] = keys[i - 1], [t1, b] = keys[i]; return mix(a, b, (t - t0) / (t1 - t0)); } return keys[keys.length - 1][1]; };
// parametric grid surface: fn(u,v) -> [x,y,z]. Outward normal = du x dv (flip to reverse). closeU averages seam normals.
function surf(fn, nu, nv, { closeU = false, flat = false, uS = 1, vS = 1, flip = false } = {}) {
  const n1 = (nu + 1) * (nv + 1), P = new Float32Array(n1 * 3), UV = new Float32Array(n1 * 2), I = [];
  let k = 0;
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++, k++) { const p = fn(i / nu, j / nv); P[k * 3] = p[0]; P[k * 3 + 1] = p[1]; P[k * 3 + 2] = p[2]; UV[k * 2] = i / nu * uS; UV[k * 2 + 1] = j / nv * vS; }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; if (flip) I.push(a, c, b, b, c, d); else I.push(a, b, c, b, d, c); }
  let g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); g.setIndex(I);
  if (flat) { g = g.toNonIndexed(); g.computeVertexNormals(); return g; }
  g.computeVertexNormals();
  if (closeU) {
    const n = g.attributes.normal;
    for (let j = 0; j <= nv; j++) { const a = j * (nu + 1), b = a + nu; const x = n.getX(a) + n.getX(b), y = n.getY(a) + n.getY(b), z = n.getZ(a) + n.getZ(b); const l = Math.hypot(x, y, z) || 1; n.setXYZ(a, x / l, y / l, z / l); n.setXYZ(b, x / l, y / l, z / l); }
  }
  return g;
}
// tube along a curve with parallel-transported frames; rFn(v, radialDir, u) -> radius
function tubeSurf(pts, rFn, nu = 10, nv = 20, { closed = false, uS = 1, vS = 2 } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(toV), closed, 'centripetal');
  const fr = []; let N = null;
  for (let j = 0; j <= nv; j++) {
    const t = j / nv, p = curve.getPointAt(t), T = curve.getTangentAt(t).normalize();
    if (!N) { const up = Math.abs(T.y) < 0.95 ? new V3(0, 1, 0) : new V3(1, 0, 0); N = up.clone().sub(T.clone().multiplyScalar(up.dot(T))).normalize(); }
    else N.sub(T.clone().multiplyScalar(N.dot(T))).normalize();
    fr.push([p, N.clone(), new V3().crossVectors(T, N)]);
  }
  const d = new V3();
  return surf((u, v) => { const [p, n, b] = fr[Math.round(v * nv)]; const a = u * Math.PI * 2; d.copy(n).multiplyScalar(Math.cos(a)).addScaledVector(b, Math.sin(a)); const r = rFn(v, d, u); return [p.x + d.x * r, p.y + d.y * r, p.z + d.z * r]; }, nu, nv, { closeU: true, uS, vS });
}
// pleated / flat cloth panel hanging along a path; 'side' = across-panel direction hint
function panel(pts, wFn, { pleats = 0, depth = 0.012, side = [1, 0, 0], nv = 14, out = null } = {}) {
  const curve = new THREE.CatmullRomCurve3(pts.map(toV), false, 'centripetal'); const S0 = toV(side).normalize();
  const fr = [];
  for (let j = 0; j <= nv; j++) { const p = curve.getPointAt(j / nv), T = curve.getTangentAt(j / nv); let N = new V3().crossVectors(T, S0).normalize(); if (out && N.dot(toV(out)) < 0) N.negate(); fr.push([p, N, new V3().crossVectors(N, T).normalize().multiplyScalar(Math.sign(S0.dot(new V3().crossVectors(N, T))) || 1)]); }
  const nu = pleats ? pleats * 2 : 4;
  return surf((u, v) => { const [p, n, s] = fr[Math.round(v * nv)]; const w = wFn(v); const zig = pleats ? (Math.round(u * nu) % 2 ? depth : -depth * 0.3) * (0.35 + 0.65 * v) : 0; return p.clone().addScaledVector(s, (u - 0.5) * w).addScaledVector(n, zig).toArray(); }, nu, nv, { flat: !!pleats, vS: 2 });
}
function keyInterp(K, y) {
  if (y <= K[0][0]) return K[0].slice(1); const L = K.length; if (y >= K[L - 1][0]) return K[L - 1].slice(1);
  let i = 0; while (K[i + 1][0] < y) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(L - 1, i + 2)]; const t = (y - k1[0]) / (k2[0] - k1[0]);
  const o = []; for (let c = 1; c < k1.length; c++) { const p0 = k0[c], p1 = k1[c], p2 = k2[c], p3 = k3[c]; o.push(0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t)); }
  return o;
}
// torso key rings relative to hip-joint height: [y, half width, front depth, back depth, z shift]
const TK_M = [[-0.13, 0.095, 0.065, 0.08, -0.01], [-0.07, 0.146, 0.09, 0.11, -0.012], [0.02, 0.16, 0.094, 0.112, -0.006], [0.1, 0.15, 0.094, 0.095, 0], [0.18, 0.138, 0.098, 0.084, 0], [0.28, 0.148, 0.104, 0.09, 0], [0.37, 0.163, 0.114, 0.096, 0.004], [0.44, 0.172, 0.108, 0.1, 0], [0.49, 0.158, 0.084, 0.094, -0.01], [0.535, 0.108, 0.062, 0.072, -0.016], [0.575, 0.056, 0.05, 0.054, -0.012]];
const TK_F = [[-0.13, 0.1, 0.07, 0.088, -0.012], [-0.07, 0.158, 0.094, 0.122, -0.014], [0.02, 0.166, 0.094, 0.115, -0.008], [0.1, 0.142, 0.09, 0.09, 0], [0.19, 0.12, 0.085, 0.076, 0], [0.28, 0.132, 0.09, 0.08, 0], [0.37, 0.142, 0.098, 0.086, 0.004], [0.44, 0.15, 0.094, 0.088, 0], [0.49, 0.146, 0.078, 0.085, -0.01], [0.53, 0.104, 0.058, 0.068, -0.014], [0.565, 0.05, 0.045, 0.049, -0.012]];
function torsoRel(B, th, y, off = 0) {
  const k = keyInterp(B.K, y); const a = k[0] * B.bw, bf = k[1] + B.belly * gss(y - 0.15, 0.08), bb = k[2], dz = k[3];
  const s = Math.sin(th), c = Math.cos(th);
  const sx = Math.sign(s) * Math.abs(s) ** 0.82, sz = Math.sign(c) * Math.abs(c) ** 0.82;
  const x = sx * a, z = sz * (c > 0 ? bf : bb) + dz;
  const ax = Math.abs(x), front = Math.max(0, c), back = Math.max(0, -c);
  let push = 0;
  if (B.fem) push += B.bust * gss(ax - 0.068, 0.036) * gss(y - 0.36, 0.038) * front;
  else push += (0.017 * gss(ax - 0.066, 0.045) * gss(y - 0.415, 0.03) - 0.006 * gss(x, 0.01) * gss(y - 0.4, 0.06)) * front * B.musc - 0.005 * gss(x, 0.012) * gss(y - 0.25, 0.12) * front + 0.004 * gss(ax - 0.035, 0.02) * gss(y - 0.27, 0.05) * front * B.musc - 0.004 * gss(x, 0.006) * gss(y - 0.19, 0.008) * front;
  push += 0.008 * gss(ax - 0.075, 0.04) * gss(y - 0.43, 0.05) * back - 0.007 * gss(x, 0.016) * sstep(0.04, 0.16, y) * sstep(0.56, 0.44, y) * back;
  push += 0.006 * gss(y - 0.512, 0.012) * gss(ax - 0.06, 0.035) * front;
  const r = push + off; const nx = s / Math.max(a, 0.01), nz = c / Math.max(c > 0 ? bf : bb, 0.01); const nl = Math.hypot(nx, nz) || 1;
  return [x + nx / nl * r, y, z + nz / nl * r];
}
// ---- head (local coords, centre of skull, +z = face)
const HA = (u) => { const w = 2 * u - 1; return Math.PI * (0.45 * w + 0.55 * w * w * w); }; // azimuth, dense at the face
const HP = (v) => 0.001 + (Math.PI - 0.002) * (v + 0.1 * Math.sin(2 * Math.PI * v)); // polar, dense at the face
function headPt(H, a, pol, off = 0) {
  const sp = Math.sin(pol), x = Math.sin(a) * sp, y = Math.cos(pol), z = Math.cos(a) * sp;
  const ra = 0.077 * H.w, rb = 0.11, rc = z > 0 ? 0.094 : 0.104;
  let X = x * ra, Y = y * rb, Z = z * rc;
  const low = sstep(0.0, -0.105, Y);
  X *= (1 - low * (0.26 - 0.1 * H.jaw)) * (1 + 0.05 * gss(Y - 0.035, 0.04));
  if (z < 0) Z *= 1 - 0.5 * sstep(-0.02, -0.1, Y);
  if (z > 0) { Z -= 0.03 * x * x * z; Z *= 1 - 0.12 * low; }
  if (Y > 0.02) Z -= 0.006 * sstep(0.02, 0.1, Y) * z; // forehead slopes back
  if (z > 0.2) {
    const fx = X, fy = Y, ax = Math.abs(fx); let dz = 0;
    dz -= 0.012 * gss(ax - 0.031, 0.013) * gss(fy - 0.01, 0.0105); // eye sockets
    dz += 0.006 * gss(fy - 0.031, 0.008) * gss(fx, 0.035) * H.brow; // brow ridge
    const nt = sstep(0.028, -0.033, fy);
    let nA = 0; if (fy < 0.03 && fy > -0.05) nA = (0.003 + 0.021 * nt * nt) * (fy < -0.033 ? sstep(-0.047, -0.033, fy) : 1);
    dz += nA * H.nose * gss(fx, 0.0055 + 0.006 * nt);
    dz += 0.007 * gss(ax - 0.014, 0.0055) * gss(fy + 0.035, 0.006); // nostril wings
    dz += 0.0045 * gss(fy + 0.057, 0.0055) * gss(fx, 0.017) * H.lips; // upper lip
    dz += 0.0045 * gss(fy + 0.07, 0.006) * gss(fx, 0.015) * H.lips; // lower lip
    dz -= 0.003 * gss(fy + 0.083, 0.005) * gss(fx, 0.02);
    dz += 0.008 * gss(fy + 0.096, 0.012) * gss(fx, 0.021) * H.chin; // chin
    dz -= 0.004 * gss(ax - 0.045, 0.012) * gss(fy + 0.045, 0.02); // under-cheek
    Z += dz * sstep(0.2, 0.55, z);
    X += 0.005 * Math.sign(X) * gss(fy + 0.002, 0.016) * gss(z - 0.55, 0.2); // cheekbones
  }
  if (off) { const nx = x / ra, ny = y / rb, nz = z / rc, l = Math.hypot(nx, ny, nz); X += nx / l * off; Y += ny / l * off; Z += nz / l * off; }
  return [X, Y, Z];
}
const HAIRLINE = [[0, 1.06], [0.45, 1.1], [0.8, 1.2], [1.12, 1.38], [1.22, 1.62], [1.36, 1.62], [1.45, 1.36], [1.75, 1.38], [2.1, 1.75], [2.6, 1.98], [Math.PI, 2.05]];
const BEARDTOP = [[0, 2.36], [0.22, 2.3], [0.42, 2.02], [0.8, 1.78], [1.2, 1.62], [1.45, 1.55]];
function buildHead(type, r, pose) {
  const hb = new AB(); const fem = type === 'woman';
  const H = { w: fem ? 0.95 : 0.98 + r() * 0.06, jaw: fem ? 0.2 : 0.5 + r() * 0.5, nose: 0.85 + r() * 0.35, chin: fem ? 0.8 : 0.9 + r() * 0.4, brow: fem ? 0.6 : 1 + r() * 0.3, lips: fem ? 1.2 : 1 };
  hb.add(surf((u, v) => headPt(H, HA(u), HP(v)), 40, 30, { closeU: true, flip: true }), 'skin');
  // eyes, lids, lips, ears
  const brows = type !== 'monk' || r() < 0.5;
  for (const side of [-1, 1]) {
    const pe = new V3(...headPt(H, side * 0.37, 1.462)); const ne = new V3(side * 0.25, 0.08, 1).normalize();
    const eye = sph(0.0115, 10, 8); eye.scale(1.3, 0.75, 1); hb.add(eye, 'eye', pe.clone().addScaledVector(ne, -0.0078).toArray(), [0, side * 0.3, 0]);
    if (brows) hb.add(tubeSurf([0.17, 0.32, 0.47, 0.6].map((a, i) => headPt(H, side * a, 1.25 + i * i * 0.012, 0.0015)), (v) => (fem ? 0.0022 : 0.003) * (1 - 0.5 * v), 5, 8), 'hair');
    const ep = new V3(...headPt(H, side * 1.62, 1.6, 0.002));
    const ear = sph(1, 10, 8); ear.scale(0.009, 0.031, 0.02); hb.add(ear, 'skin', ep.toArray(), [0, side * 0.35, -side * 0.08]);
    const rim = new THREE.TorusGeometry(0.019, 0.0045, 5, 12, Math.PI * 1.3); rim.scale(0.7, 1.4, 1); hb.add(rim, 'skin', ep.clone().add(new V3(side * 0.006, 0.004, -0.003)).toArray(), [0, side * Math.PI / 2 + side * 0.35, Math.PI * 0.35]);
    if (fem || type === 'noble') hb.add(sph(0.009, 8, 6), 'gold', ep.clone().add(new V3(side * 0.006, -0.036, 0)).toArray());
  }
  const ul = sph(1, 12, 6); ul.scale(0.0175, 0.0035, 0.005); hb.add(ul, 'lips', headPt(H, 0, 2.09, -0.003));
  const ll = sph(1, 12, 6); ll.scale(0.016, 0.0045, 0.005); hb.add(ll, 'lips', headPt(H, 0, 2.2, -0.003));
  // hair
  const hairShell = (lineFn, th, key, nu = 40, nv = 14, extra = null) => hb.add(surf((u, v) => {
    const a = (u - 0.5) * 2 * Math.PI, pm = lineFn(a); const pol = 0.001 + v * (pm - 0.001);
    let t = th(v, a); const p = headPt(H, a, pol, t); if (extra) extra(p, a, v); return p;
  }, nu, nv, { closeU: true, flip: true, uS: 2, vS: 2 }), key);
  const hl = (a) => pwl(HAIRLINE, Math.abs(a));
  const style = type === 'monk' ? 'shaved' : fem ? 'bun' : type === 'scribe' ? (r() < 0.7 ? 'topknot' : 'short') : type === 'noble' ? 'long' : ['short', 'short', 'topknot', 'long', 'curly'][Math.floor(r() * 5)];
  if (style === 'shaved') { if (r() < 0.4) hairShell(hl, () => 0.0022, 'stubble', 44, 12); }
  else {
    const thick = style === 'curly' ? 0.012 : style === 'short' ? 0.007 : 0.009;
    const crv = style === 'curly' ? r() * 10 : 0;
    hairShell((a) => hl(a) + (fem || style === 'long' ? 0.06 + 0.12 * sstep(1.2, 2.6, Math.abs(a)) : 0), (v, a) => thick * (0.3 + 0.7 * sstep(1, 0.55, v)) * (fem ? 1.2 : 1),
      'hair', 36, 12, (p, a, v) => {
        if (crv) { const k = 1 + 0.06 * Math.sin(p[0] * 160 + crv) * Math.sin(p[1] * 150) * Math.sin(p[2] * 170); p[0] *= k; p[1] *= k; p[2] *= k; }
        if (fem || style === 'long') { const part = gss(p[0], 0.004) * sstep(-0.02, 0.06, p[2]) * 0.004; p[1] -= part; }
      });
    if (style === 'bun' || style === 'topknot' || style === 'long') {
      const bun = noisify(sph(1, 14, 10), 0.08, 3, 3); const bs = style === 'topknot' ? 0.04 : 0.047;
      bun.scale(bs, bs * 0.85, bs);
      const at = style === 'topknot' ? [0, 0.105, -0.03] : style === 'long' ? [0, 0.02, -0.112] : [0, r() < 0.5 ? 0.0 : 0.05, -0.115];
      hb.add(bun, 'hair', at);
      if (style !== 'topknot') hb.add(new THREE.TorusGeometry(bs * 0.75, 0.006, 5, 14), fem ? 'gold' : 'hair', [at[0], at[1], at[2] + 0.025]);
    }
  }
  // beard & moustache
  const beard = !fem && type !== 'monk' && (type === 'noble' || type === 'soldier' ? r() < 0.75 : r() < 0.45);
  const mous = !fem && type !== 'monk' && (beard || r() < 0.6);
  if (beard) {
    const bt = 0.006 + r() * 0.01, chinL = r() * 0.025;
    hb.add(surf((u, v) => { const a = (u - 0.5) * 2 * 1.5; const p0 = pwl(BEARDTOP, Math.abs(a)); const pol = mix(p0, 2.95, v); const p = headPt(H, a, pol, bt * (0.25 + 0.75 * sstep(0, 0.3, v))); p[1] -= chinL * gss(a, 0.45) * sstep(0.2, 0.6, v); return p; }, 24, 10, { flip: true, uS: 2, vS: 1 }), 'hair');
  } else if (!fem && type !== 'monk') hb.add(surf((u, v) => { const a = (u - 0.5) * 2 * 1.45; const pol = mix(pwl(BEARDTOP, Math.abs(a)) - 0.05, 2.9, v); return headPt(H, a, pol, 0.0012); }, 22, 8, { flip: true }), 'stubble');
  if (mous) { const pts = [-0.5, -0.3, 0, 0.3, 0.5].map(a => { const p = headPt(H, a, 2.0 + Math.abs(a) * 0.22, 0.004); return p; }); hb.add(tubeSurf(pts, (v) => 0.0045 * (0.4 + 0.6 * Math.sin(v * Math.PI)), 6, 12), 'hair'); }
  // turban
  const turban = type === 'soldier' || type === 'noble' || (type === 'man' && r() < 0.5) || (type === 'scribe' && r() < 0.2);
  if (turban) {
    const big = type === 'noble' ? 1.25 : type === 'soldier' ? 0.9 : 1 + r() * 0.2;
    const tl = (a) => mix(1.2, 1.62, sstep(0.3, 2.6, Math.abs(a)));
    hb.add(surf((u, v) => { const a = (u - 0.5) * 2 * Math.PI; const pol = 0.001 + v * (tl(a) - 0.001); const p = headPt(H, a, pol, 0.018 + 0.02 * big * (1 - v)); p[1] += 0.028 * big * (1 - v) * (1 - v); return p; }, 36, 12, { closeU: true, flip: true, uS: 3, vS: 2 }), 'accent');
    const nb = type === 'soldier' ? 3 : 4;
    for (let k = 0; k < nb; k++) {
      const sgn = k % 2 ? 1 : -1, tilt = (0.12 + r() * 0.08) * sgn, base = k / nb;
      const pts = []; for (let i = 0; i < 24; i++) { const a = -Math.PI + i / 24 * Math.PI * 2; const pol = tl(a) - 0.06 - base * mix(0.85, 0.55, sstep(0, 2.6, Math.abs(a))) + tilt * Math.sin(a); const p = headPt(H, a, Math.max(0.25, pol), 0.022 + 0.01 * big); p[1] += 0.01 * base * big; pts.push(p); }
      hb.add(tubeSurf(pts, (v, d, u) => 0.016 + 0.004 * Math.sin(v * 37 + k), 6, 28, { closed: true, uS: 1, vS: 6 }), 'accent');
    }
    if (type === 'noble') {
      const pts = []; for (let i = 0; i < 24; i++) { const a = -Math.PI + i / 24 * Math.PI * 2; pts.push(headPt(H, a, tl(a) - 0.05, 0.05)); }
      hb.add(tubeSurf(pts, () => 0.007, 6, 36, { closed: true }), 'gold');
      const j = headPt(H, 0, 0.75, 0.06); hb.add(sph(0.018, 10, 8), 'gold', j); const pl = new THREE.ConeGeometry(0.014, 0.07, 8); hb.add(pl, 'gold', [j[0], j[1] + 0.04, j[2] - 0.01], [-0.2, 0, 0]);
    }
  }
  return hb;
}
function buildHand(side, fem) {
  const g = new AB(); const k = fem ? 0.88 : 1;
  const palm = sph(1, 10, 8); palm.scale(0.041 * k, 0.05 * k, 0.017 * k); g.add(palm, 'skin', [0, 0.045 * k, 0]);
  const fing = sph(1, 10, 8); fing.scale(0.037 * k, 0.045 * k, 0.012 * k); g.add(fing, 'skin', [0, 0.1 * k, 0.008 * k], [0.35, 0, 0]);
  g.add(tubeSurf([[side * 0.026 * k, 0.025 * k, 0.008], [side * 0.042 * k, 0.055 * k, 0.02 * k], [side * 0.04 * k, 0.08 * k, 0.03 * k]], (v) => 0.011 * k * (1 - 0.3 * v), 6, 6), 'skin');
  return g;
}
function buildFoot(fem) {
  const k = fem ? 0.9 : 1; const g = sph(1, 16, 10); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const t = (z + 1) / 2;
    const w = (0.03 + 0.019 * Math.sin(Math.PI * Math.min(1, t * 1.25))) * k * (t > 0.85 ? 1 - (t - 0.85) * 1.2 : 1);
    const hh = mix(0.07, 0.02, sstep(0.12, 0.92, t)) * k;
    p.setXYZ(i, x * w + (t - 0.5) * 0.012, (y > 0 ? y * hh : y * 0.012) + 0.012, mix(-0.055, 0.19, t) * k);
  }
  g.computeVertexNormals(); return g;
}
function ik(A, C, L1, L2, pole) {
  const a = toV(A), c = toV(C); const d = c.clone().sub(a); let D = d.length(); const mx = (L1 + L2) * 0.995;
  if (D > mx) { d.setLength(mx); c.copy(a).add(d); D = mx; }
  const dir = d.clone().normalize(); const x = (L1 * L1 - L2 * L2 + D * D) / (2 * D); const hh = Math.sqrt(Math.max(0, L1 * L1 - x * x));
  const pv = toV(pole); const p = pv.sub(dir.clone().multiplyScalar(pv.dot(dir))).normalize();
  return [a.clone().addScaledVector(dir, x).addScaledVector(p, hh), c];
}
const basisM = (o, Y, Z) => { const y = toV(Y).normalize(); const z = toV(Z); z.sub(y.clone().multiplyScalar(z.dot(y))).normalize(); const x = new V3().crossVectors(y, z); return new THREE.Matrix4().makeBasis(x, y, z).setPosition(toV(o)); };
const footM = (o, F, U) => { const z = toV(F).normalize(); const y = toV(U); y.sub(z.clone().multiplyScalar(y.dot(z))).normalize(); const x = new V3().crossVectors(y, z); return new THREE.Matrix4().makeBasis(x, y, z).setPosition(toV(o)); };

// type: man | monk | woman | soldier | noble | scribe ; pose: stand | walk | sit | throne
export function human({ type = 'man', pose = 'stand', seed = 1, h = 1.7 } = {}) {
  const r = rng(seed * 7 + 3); const b = new AB(); const s = h / 1.7;
  const sit = pose === 'sit', throne = pose === 'throne', seated = sit || throne;
  const fem = type === 'woman';
  const B = { K: fem ? TK_F : TK_M, fem, bw: 0.95 + r() * 0.1, belly: type === 'noble' ? 0.015 + r() * 0.025 : r() < 0.25 ? r() * 0.025 : 0, bust: 0.03 + r() * 0.012, musc: type === 'soldier' ? 1.3 : 0.8 + r() * 0.4 };
  const hipW = fem ? 0.088 : 0.085, L1 = 0.43, L2 = 0.42;
  // ---------------- skeleton
  const sw = pose === 'walk' ? 0.3 * (0.85 + r() * 0.3) : 0;
  let hipJ = 0.91;
  if (pose === 'walk') hipJ = 0.075 + (L1 + L2) * Math.cos(sw) * 0.995;
  if (sit) hipJ = 0.13; if (throne) hipJ = 0.52;
  const legs = [];
  for (const side of [-1, 1]) {
    const hip = [side * hipW, hipJ, 0]; let ank, pole = [0, 0, 1];
    if (pose === 'stand') ank = [side * (0.1 + r() * 0.03), 0.075, (r() - 0.5) * 0.08];
    else if (pose === 'walk') { const a = side * sw; ank = [side * 0.09, a < 0 ? 0.11 : 0.075, 0.85 * Math.sin(a) - (a < 0 ? 0.03 : 0)]; }
    else if (sit) { ank = side < 0 ? [0.13, 0.075, 0.3] : [-0.14, 0.12, 0.25]; pole = [side, 0.12, 0.35]; }
    else { ank = [side * (0.13 + r() * 0.03), 0.075, 0.44]; pole = [0, 1, 0.4]; }
    const [knee, ankle] = ik(hip, ank, L1, L2, pole);
    legs.push({ side, hip, knee: knee.toArray(), ankle: ankle.toArray() });
  }
  const legR = (t) => pwl([[0, 0.085], [0.25, 0.072], [0.48, 0.052], [0.56, 0.05], [0.68, 0.056], [0.88, 0.038], [1, 0.034]], t) * (fem ? 0.95 : 1);
  for (const L of legs) {
    const H0 = toV(L.hip), K = toV(L.knee), A = toV(L.ankle);
    const pts = [H0.clone().add(new V3(-L.side * 0.02, 0.07, -0.01)), H0, H0.clone().lerp(K, 0.82), K, K.clone().lerp(A, 0.18), A];
    if (!sit) b.add(tubeSurf(pts, (v) => legR(v), 10, 20), 'skin');
    else b.add(tubeSurf([K.clone().lerp(A, 0.3), A], () => 0.042, 8, 4), 'skin');
    // foot
    let F, U = [0, 1, 0], o;
    if (sit) { F = [-L.side, 0, 0.35]; U = [0, 0.5, 1]; }
    else if (pose === 'walk' && L.ankle[1] > 0.09) F = [L.side * 0.1, -0.38, 1];
    else F = [L.side * 0.18, 0, 1];
    const Uv = toV(U); const Fv = toV(F).normalize(); Uv.sub(Fv.clone().multiplyScalar(Uv.dot(Fv))).normalize();
    o = A.clone().addScaledVector(Uv, -0.075 * (fem ? 0.9 : 1));
    b.addM(buildFoot(fem), 'skin', footM(o, F, U));
  }
  // ---------------- torso
  const TP = (th, y, off = 0) => { const p = torsoRel(B, th, y, off); p[1] += hipJ; return p; };
  b.add(surf((u, v) => TP((u - 0.5) * 2 * Math.PI, mix(-0.13, 0.575, v)), 28, 22, { closeU: true }), 'skin');
  // ---------------- arms
  const shY = hipJ + 0.475, shX = torsoRel(B, Math.PI / 2, 0.45)[0] - 0.03;
  const armL1 = fem ? 0.27 : 0.285, armL2 = fem ? 0.24 : 0.255;
  const longSk = type === 'monk' || fem || type === 'noble';
  const armPose = (side) => {
    const S = [side * shX, shY, -0.012];
    if (throne && side === -1) return { W: [-0.36, shY + 0.02, 0.36], pole: [-1, -1, -0.3], pn: [0.2, 0.3, 1], fd: null };
    if (throne) return { W: [0.27, hipJ + 0.12, 0.3], pole: [1, 0, -1], pn: [0, -1, 0] };
    if (sit && type === 'scribe') return side < 0 ? { W: [-0.06, hipJ + 0.22, 0.4], pole: [-1, -0.4, -0.5], pn: [0.6, -0.8, 0] } : { W: [0.1, hipJ + 0.2, 0.36], pole: [1, -0.4, -0.5], pn: [-0.4, 0.6, 0] };
    if (sit && (type === 'monk' || r() < 0.4)) return { W: [side * 0.07, hipJ + 0.11, 0.2], pole: [side, -0.3, -0.5], pn: [0, 1, 0] };
    if (sit) return { W: [side * 0.3, hipJ + 0.12, 0.25], pole: [side, -0.2, -1], pn: [0, -1, 0] };
    if (type === 'soldier' && side === 1) return { W: [0.25, shY - 0.33, 0.16], pole: [1, -0.5, -1], pn: [-1, 0, 0] };
    if (type === 'soldier') return { W: [-0.27, shY - 0.36, 0.12], pole: [-1, -0.3, -1], pn: [-1, 0, 0] };
    const a = pose === 'walk' ? -side * sw * 1.0 : (r() - 0.5) * 0.12;
    const ln = 0.52; return { W: [side * (shX + (fem ? 0.12 : longSk ? 0.09 : 0.06)), shY - ln * Math.cos(a), ln * Math.sin(a) + (longSk ? 0.08 : 0.05)], pole: [side * 0.4, 0, -1], pn: [-side, 0, 0] };
  };
  const arms = [];
  for (const side of [-1, 1]) {
    const S = toV([side * shX, shY, -0.012]); const ap = armPose(side);
    const [E, W] = ik(S, ap.W, armL1, armL2, ap.pole);
    arms.push({ side, S, E, W });
    const k = fem ? 0.84 : (type === 'soldier' ? 1.08 : 1);
    const ud = E.clone().sub(S).normalize(); const pts = [S.clone().addScaledVector(ud, -0.035).add(new V3(-side * 0.012, 0, 0)), S, S.clone().lerp(E, 0.78), E, E.clone().lerp(W, 0.22), W];
    b.add(sph(0.03 * k, 10, 8), 'skin', pts[0].clone().add(new V3(-side * 0.012, -0.004, 0)).toArray());
    b.add(tubeSurf(pts, (v) => k * pwl([[0, 0.032], [0.05, 0.048], [0.1, 0.054], [0.17, 0.053], [0.32, 0.045], [0.5, 0.036], [0.6, 0.04], [0.82, 0.03], [1, 0.025]], v), 11, 22), 'skin');
    const fd = W.clone().sub(E).normalize();
    const hm = basisM(W, fd, toV(ap.pn)); const hand = buildHand(side, fem);
    for (const g of hand.parts.skin) b.addM(g, 'skin', hm);
    if (type === 'noble' || fem || r() < 0.3) { const bang = new THREE.TorusGeometry(0.03, 0.006, 6, 16); b.addM(bang, 'gold', new THREE.Matrix4().compose(W.clone().addScaledVector(fd, -0.012), new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), fd), new V3(1, 1, 1))); }
    if (type === 'noble' || (fem && r() < 0.5)) { const d2 = E.clone().sub(S).normalize(); b.addM(new THREE.TorusGeometry(0.047 * k, 0.008, 6, 16), 'gold', new THREE.Matrix4().compose(S.clone().lerp(E, 0.45), new THREE.Quaternion().setFromUnitVectors(new V3(0, 0, 1), d2), new V3(1, 1, 1))); }
    if (type === 'soldier' && side === 1) { b.add(cyl(0.012, 0.012, 2.3, 6), 'pole', [W.x, W.y + 0.55, W.z + 0.03]); b.add(new THREE.ConeGeometry(0.028, 0.24, 6), 'iron', [W.x, W.y + 1.82, W.z + 0.03]); }
    if (type === 'soldier' && side === -1) {
      const shd = lathe([[0, 0.05], [0.08, 0.045], [0.2, 0.025], [0.29, 0.0], [0.3, -0.01], [0, -0.01]], 28); const c = W.clone().add(new V3(-0.03, 0.06, 0.13));
      b.add(shd, 'prop', c.toArray(), [Math.PI / 2, 0, -0.35]); b.add(new THREE.TorusGeometry(0.295, 0.016, 6, 28), 'iron', c.toArray(), [0, -0.35, 0]); b.add(sph(0.05, 10, 6), 'iron', c.clone().add(new V3(0.02, 0, 0.05)).toArray());
    }
  }
  // ---------------- neck & head
  const HC = new V3(0, hipJ + 0.68, 0.016 + (sit && type === 'scribe' ? 0.04 : 0));
  b.add(tubeSurf([[0, hipJ + 0.44, -0.018], [0, hipJ + 0.56, -0.006], [0, HC.y - 0.03, HC.z - 0.012]], (v) => pwl([[0, 0.075], [0.3, 0.064], [0.45, 0.056], [1, 0.047]], v) * (fem ? 0.9 : 1), 14, 10), 'skin');
  const pitch = sit && type === 'scribe' ? 0.38 : type === 'monk' && sit ? 0.12 : (r() - 0.5) * 0.14, yaw = throne ? -0.25 : (r() - 0.5) * 0.4;
  b.merge(buildHead(type, r, pose), HC.toArray(), [pitch, yaw, 0]);
  // ---------------- garments
  const ph = r() * 6.28, ph2 = r() * 6.28, nf = 9 + Math.floor(r() * 5);
  const legAt = (L, y) => {
    const H0 = L.hip, K = L.knee, A = L.ankle; let x, z, t;
    if (y >= H0[1]) { x = H0[0]; z = H0[2]; t = 0; }
    else if (y >= K[1]) { const f = (H0[1] - y) / Math.max(1e-4, H0[1] - K[1]); x = mix(H0[0], K[0], f); z = mix(H0[2], K[2], f); t = f * 0.5; }
    else if (y >= A[1]) { const f = (K[1] - y) / Math.max(1e-4, K[1] - A[1]); x = mix(K[0], A[0], f); z = mix(K[2], A[2], f); t = 0.5 + f * 0.5; }
    else { x = A[0]; z = A[2]; t = 1; }
    return [x, z, legR(t)];
  };
  const skirtPt = (th, v, o) => {
    const hemY = o.hem + (o.hemWave || 0.012) * Math.sin(2 * th + ph) + (o.hemBack || 0) * Math.max(0, -Math.cos(th));
    const yA = mix(hipJ + o.top, hemY, v), yR = yA - hipJ; const dx = Math.sin(th), dz = Math.cos(th);
    const A = o.A * (0.25 + 0.75 * v);
    const fold = A * (Math.sin(nf * th + ph + yA * 4) + 0.45 * Math.sin(nf * 2.3 * th + ph2 - yA * 3));
    const off = o.off + A * 1.2 + fold + o.flare * v * v + (o.front || 0) * Math.max(0, dz) * v;
    const tp = torsoRel(B, th, Math.max(yR, -0.13), off);
    let best = -1e9, hx = 0, hz = 0;
    for (const L of legs) { const c = legAt(L, yA); const pr = c[0] * dx + c[1] * dz + c[2]; if (pr > best) { best = pr; hx = c[0] + dx * (c[2] + off); hz = c[1] + dz * (c[2] + off); } }
    let w = sstep(-0.02, -0.15, yR); const prT = tp[0] * dx + tp[2] * dz, prH = hx * dx + hz * dz; if (prH > prT) w = Math.max(w, clamp01((prH - prT) / 0.015)); else if (yR > -0.13) w = Math.min(w, 1 - clamp01((prT - prH) / 0.015));
    return [mix(tp[0], hx, w), yA, mix(tp[2], hz, w)];
  };
  const skirt = (key, o, nu = 56, nv = 22) => b.add(surf((u, v) => skirtPt((u - 0.5) * 2 * Math.PI, v, o), nu, nv, { closeU: true, flip: true, uS: 3, vS: 3 }), key);
  const border = (key, o, frac = 0.07) => b.add(surf((u, v) => { const p = skirtPt((u - 0.5) * 2 * Math.PI, 1 - frac + frac * v, { ...o, off: o.off + 0.0025 }); return p; }, 64, 2, { closeU: true, flip: true, uS: 6, vS: 0.3 }), key);
  const hemRoll = (key, o, rad = 0.007) => { const pts = []; for (let i = 0; i < 40; i++) pts.push(skirtPt(-Math.PI + i / 40 * Math.PI * 2, 1, o)); b.add(tubeSurf(pts, () => rad, 5, 48, { closed: true }), key); };
  const waistRoll = (key, y, off, rad = 0.016) => { const pts = []; for (let i = 0; i < 24; i++) pts.push(TP(-Math.PI + i / 24 * Math.PI * 2, y, off)); b.add(tubeSurf(pts, (v) => rad * (1 + 0.25 * Math.sin(v * 31)), 6, 40, { closed: true }), key); };
  const pleatsFront = (key, o, w0 = 0.07, w1 = 0.2, n = 5, th = 0, dep = 0.011) => { const pts = []; for (let i = 0; i <= 5; i++) { const p = skirtPt(th, i / 5, o); p[0] += Math.sin(th) * 0.01; p[2] += Math.cos(th) * 0.01; pts.push(p); } b.add(panel(pts, (v) => mix(w0, w1, v), { pleats: n, depth: dep, out: [Math.sin(th), 0, Math.cos(th)] }), key); };
  // shell on the torso between yLo(th) and yHi(th) (relative y)
  const shell = (key, yLo, yHi, off, A, { th0 = -Math.PI, th1 = Math.PI, nu = 48, nv = 16, diag = 0.6, edge = 0 } = {}) => {
    const fn = (u, v) => { const th = mix(th0, th1, u); const y0 = yLo(th), y1 = Math.min(0.57, yHi(th)); const y = mix(y0, y1, v); const x = Math.sin(th) * 0.17; const q = y - diag * x; const f = A * Math.sin(q * 55 + ph + 2 * Math.sin(th * 3)) * (0.5 + 0.5 * Math.sin(th * 5 + ph2)); return TP(th, y, off + A + f); };
    b.add(surf(fn, nu, nv, { closeU: th1 - th0 > 6, uS: 3, vS: 1.5 }), key);
    if (edge) { const closed = th1 - th0 > 6; const pts = []; const n = 40; for (let i = 0; i < (closed ? n : n + 1); i++) pts.push(fn(i / n, 1)); b.add(tubeSurf(pts, () => edge, 5, 48, { closed }), key); if (edge > 0 && !closed) { } }
    return fn;
  };
  const sleeve = (key, arm, reach = 0.55, rad = 0.066, droop = 0.07) => { const { S, E, W } = arm; b.add(tubeSurf([S.clone().add(new V3(-arm.side * 0.04, 0.045, 0)), S.clone().add(new V3(arm.side * 0.01, 0.01, 0)), S.clone().lerp(E, 0.6), E, E.clone().lerp(W, reach)], (v, d, u) => rad + 0.012 * v + droop * v * Math.max(0, -d.y) ** 2 + 0.005 * Math.sin(u * 31 + v * 9), 14, 18), key); };
  const xs = (th) => Math.sin(th);
  const diagTop = (lo, hi) => (th) => mix(lo, hi, sstep(-0.85, 0.75, xs(th)));

  if (type === 'monk') {
    // under-robe + outer robe (civara) wrapped over the left shoulder, right shoulder bare
    const lowO = { top: 0.12, hem: seated ? 0 : 0.11 + r() * 0.04, off: 0.016, A: 0.012, flare: 0.05 };
    const topFn = diagTop(0.36, 0.62);
    if (!seated) {
      const outO = { top: 0.12, hem: 0.3 + r() * 0.08, off: 0.03, A: 0.014, flare: 0.06, hemWave: 0.03, hemBack: -0.04 };
      skirt('garment', lowO, 48, 18); skirt('garment', outO); hemRoll('garment', outO, 0.008);
      pleatsFront('garment', outO, 0.06, 0.12, 3, 0.2, 0.009);
    }
    shell('garment', () => 0.06, topFn, 0.018, 0.006, { edge: 0.011 });
    sleeve('garment', arms[1], 0.62, 0.064, seated ? 0.04 : 0.07);
    // fold of cloth hanging from the left shoulder down the back
    b.add(panel([TP(Math.PI - 0.75, 0.53, 0.035), TP(Math.PI - 0.6, 0.4, 0.045), TP(Math.PI - 0.5, 0.15, 0.05)], (v) => mix(0.08, 0.16, v), { pleats: 3, depth: 0.012, side: [1, 0, 0], out: [0, 0, -1] }), 'garment');
  } else if (fem) {
    const sk = { top: 0.15, hem: 0.035, off: 0.014, A: 0.01, flare: 0.07, hemWave: 0.008 };
    if (!seated) { skirt('garment', sk); border('accent', sk, 0.06); pleatsFront('garment', sk, 0.06, 0.2, 6); }
    waistRoll('garment', 0.155, 0.012, 0.012);
    // choli
    shell('shawl', () => 0.29, (th) => 0.53 - 0.06 * Math.max(0, Math.cos(th)), 0.008, 0.002, { nv: 10, edge: 0.005 });
    for (const a of arms) b.add(tubeSurf([a.S.clone().add(new V3(-a.side * 0.03, 0.02, 0)), a.S, a.S.clone().lerp(a.E, 0.35)], () => 0.058, 10, 6), 'shawl');
    // pallu: band from the right hip across the chest over the left shoulder, then hanging down the back
    const lo = diagTop(0.17, 0.42), hi = diagTop(0.31, 0.62);
    shell('garment', lo, hi, 0.022, 0.006, { edge: 0.006, diag: 1.3 });
    sleeve('garment', arms[1], 0.04, 0.072, 0.0);
    const a1 = arms[1].S;
    b.add(panel([[a1.x - 0.05, a1.y + 0.05, -0.04], [a1.x - 0.05, a1.y - 0.08, -0.12], [a1.x - 0.07, hipJ, -0.15], [a1.x - 0.08, hipJ - 0.28, -0.13]], (v) => mix(0.12, 0.3, v), { pleats: 4, depth: 0.014, side: [1, 0, 0.3], out: [0, 0, -1] }), 'garment');
  } else if (type === 'soldier') {
    const tu = { top: 0.2, hem: 0.47 + r() * 0.05, off: 0.02, A: 0.01, flare: 0.05, hemWave: 0.015 };
    if (!seated) { skirt('garment', tu, 56, 14); hemRoll('garment', tu, 0.007); }
    shell('garment', () => 0.16, (th) => 0.545 - 0.05 * Math.max(0, Math.cos(th)), 0.012, 0.003, { nv: 14, edge: 0.008 });
    for (const a of arms) b.add(tubeSurf([a.S.clone().add(new V3(-a.side * 0.03, 0.03, 0)), a.S, a.S.clone().lerp(a.E, 0.45)], (v) => 0.064 + 0.008 * v, 10, 6), 'garment');
    // cross belts + waist belt (leather)
    for (const sg of [-1, 1]) shell('shawl', (th) => 0.34 + sg * 0.22 * Math.sin(th) * Math.sign(Math.cos(th) || 1) - 0.022, (th) => 0.34 + sg * 0.22 * Math.sin(th) * Math.sign(Math.cos(th) || 1) + 0.022, 0.02, 0, { nv: 2, nu: 48 });
    shell('shawl', () => 0.16, () => 0.22, 0.026, 0, { nv: 2, nu: 40 });
    b.add(box(0.05, 0.05, 0.015), 'gold', TP(0, 0.19, 0.035));
  } else {
    // dhoti (man / scribe / noble)
    const long = type === 'noble' || (type === 'man' && r() < 0.3);
    const dh = { top: 0.15, hem: long ? 0.06 + r() * 0.03 : type === 'scribe' ? 0.2 + r() * 0.08 : 0.24 + r() * 0.2, off: 0.016, A: 0.011, flare: long ? 0.06 : 0.04, hemWave: 0.02, front: 0.02 };
    if (!seated) {
      skirt('garment', dh); hemRoll('garment', dh, 0.007);
      if (type === 'noble') border('accent', dh, 0.05);
      pleatsFront('garment', dh, 0.045, 0.1, 3, -0.25 + r() * 0.15, 0.008);
    }
    waistRoll('garment', 0.15, 0.016, 0.014);
    // uttariya
    const st = type === 'noble' || type === 'scribe' ? 'sash' : ['sash', 'sash', 'both', 'none', 'none'][Math.floor(r() * 5)];
    if (st === 'sash') {
      const lo = diagTop(0.19, 0.42), hi = diagTop(0.33, 0.62);
      shell('shawl', lo, hi, 0.02, 0.007, { edge: 0.007, diag: 1.3 });
      sleeve('shawl', arms[1], 0.05, 0.064, 0.0);
      const a1 = arms[1].S;
      b.add(panel([[a1.x - 0.05, a1.y + 0.045, 0.03], [a1.x - 0.04, a1.y - 0.1, 0.11], [a1.x - 0.03, hipJ + 0.16, 0.14], [a1.x - 0.02, hipJ - (seated ? 0.05 : 0.25), seated ? 0.17 : 0.215]], (v) => mix(0.1, 0.16, v), { pleats: 3, depth: 0.01, side: [1, 0, 0], out: [0, 0, 1] }), 'shawl');
    } else if (st === 'both') {
      shell('shawl', (th) => mix(0.48, 0.3, Math.max(0, -Math.cos(th))) - 0.08 * Math.abs(Math.sin(th)), () => 0.6, 0.02, 0.006, { edge: 0.007, diag: 0 });
      for (const a of arms) {
        sleeve('shawl', a, 0.0, 0.064, 0.0);
        b.add(panel([[a.S.x * 0.75, a.S.y + 0.05, 0.02], [a.S.x * 0.72, a.S.y - 0.1, 0.11], [a.S.x * 0.7, hipJ + 0.12, 0.125]], (v) => mix(0.08, 0.12, v), { pleats: 2, depth: 0.01, out: [0, 0, 1] }), 'shawl');
      }
    }
  }
  // seated lower garments
  if (sit) {
    // cloth tented over the crossed legs and pooled on the floor (height field in polar coords around the waist)
    const caps = []; for (const L of legs) { caps.push([L.hip, L.knee, 0.085]); caps.push([L.knee, L.ankle, 0.06]); }
    const tent = (x, z) => {
      let hh = 0.012;
      for (const [A, Bp, rr] of caps) {
        const ex = Bp[0] - A[0], ez = Bp[2] - A[2]; const t = clamp01(((x - A[0]) * ex + (z - A[2]) * ez) / (ex * ex + ez * ez));
        const py = mix(A[1], Bp[1], t), dist = Math.hypot(x - A[0] - ex * t, z - A[2] - ez * t);
        hh = Math.max(hh, py + rr + 0.025 - 1.6 * Math.max(0, dist - rr * 0.5));
      }
      return hh;
    };
    const lapCache = new Map();
    const lapPt = (th, v) => {
      const dx = Math.sin(th), dz = Math.cos(th); const s0 = TP(th, 0.13, 0.02);
      let R = lapCache.get(th);
      if (R === undefined) { R = 0.05; while (R < 0.8 && Math.max(tent(s0[0] + dx * R, s0[2] + dz * R), s0[1] - 1.5 * R) > 0.014) R += 0.01; R += 0.03 + 0.02 * Math.sin(7 * th + ph); lapCache.set(th, R); }
      const rho = R * v; const x = s0[0] + dx * rho, z = s0[2] + dz * rho;
      let y = Math.max(tent(x, z), s0[1] - 1.5 * rho);
      const wr = 0.008 * Math.sin(nf * 1.3 * th + ph + rho * 9) * sstep(0.1, 0.5, v);
      if (v === 1) y = 0.006;
      return [x + dx * wr, y + Math.abs(wr) * 0.6, z + dz * wr];
    };
    b.add(surf((u, v) => lapPt((u - 0.5) * 2 * Math.PI, v), 64, 20, { closeU: true, uS: 3, vS: 2 }), 'garment');
    const pts = []; for (let i = 0; i < 48; i++) pts.push(lapPt(-Math.PI + i / 48 * Math.PI * 2, 1)); b.add(tubeSurf(pts, () => 0.008, 5, 64, { closed: true }), 'garment');
    if (type !== 'monk') b.add(surf((u, v) => TP((u - 0.5) * 2 * Math.PI, mix(0.16, -0.12, v), 0.022), 40, 6, { closeU: true }), 'garment');
  }
  if (throne) {
    b.add(surf((u, v) => TP((u - 0.5) * 2 * Math.PI, mix(0.16, -0.13, v), 0.02 + 0.03 * v), 48, 8, { closeU: true }), 'garment');
    const legPt = (L, v) => (v < 0.5 ? toV(L.hip).lerp(toV(L.knee), v * 2) : toV(L.knee).lerp(toV(L.ankle).add(new V3(0, 0.03, 0)), (v - 0.5) * 2));
    const X = new V3(1, 0, 0);
    const loft = (u, v) => {
      const p0 = legPt(legs[0], v), p1 = legPt(legs[1], v); const c = p0.clone().add(p1).multiplyScalar(0.5); const hx = Math.abs(p1.x - p0.x) / 2;
      const T = legPt(legs[0], Math.min(1, v + 0.09)).sub(legPt(legs[0], Math.max(0, v - 0.09))).normalize();
      const Yp = new V3().crossVectors(T, X).normalize(); const th = (u - 0.5) * 2 * Math.PI, sx = Math.sin(th);
      const d = X.clone().multiplyScalar(sx).addScaledVector(Yp, Math.cos(th));
      const rr = legR(v) + 0.026 + 0.03 * v + 0.006 * Math.sin(th * 9 + v * 6 + ph) * (0.4 + v) + 0.03 * Math.max(0, -d.y) * (v < 0.5 ? 1 : 0);
      return c.addScaledVector(X, Math.sign(sx) * hx).addScaledVector(d, rr).toArray();
    };
    b.add(surf(loft, 40, 24, { closeU: true, uS: 3, vS: 3 }), 'garment');
    { const pts = []; for (let i = 0; i < 32; i++) pts.push(loft(i / 32, 1)); b.add(tubeSurf(pts, () => 0.008, 5, 48, { closed: true }), 'accent'); }
    const kz = legs[0].knee[2];
    b.add(panel([[0, hipJ + 0.17, 0.12], [0, hipJ + 0.145, 0.28], [0, hipJ + 0.125, kz + 0.06], [0, hipJ - 0.15, kz + 0.12], [0, 0.07, kz + 0.12]], (v) => mix(0.1, 0.22, v), { pleats: 5, depth: 0.012, out: [0, 1, 1] }), 'garment');
  }
  if (type === 'noble' || fem) { const pts = []; for (let i = 0; i < 20; i++) pts.push(TP(-Math.PI + i / 20 * Math.PI * 2, 0.535 - 0.07 * Math.max(0, Math.cos(-Math.PI + i / 20 * Math.PI * 2)) ** 2, 0.008)); b.add(tubeSurf(pts, () => 0.007, 6, 30, { closed: true }), 'gold'); }
  // contact shadow decal
  const cs = new THREE.PlaneGeometry(seated ? 1.0 : 0.75, seated ? 1.0 : 0.75); cs.rotateX(-Math.PI / 2); b.add(cs, 'contact', [0, 0.012, sit ? 0.12 : 0.03]);
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
  const drumH = R * 0.15;
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
