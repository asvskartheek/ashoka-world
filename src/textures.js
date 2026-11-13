// Procedural texture library — every texture is painted at load time on a canvas. No external assets.
import * as THREE from 'three';

// ---------- seeded RNG + value noise ----------
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e9) / 1e9; };
}
const PERM = new Uint8Array(512);
{ const r = rng(1337); const p = [...Array(256).keys()]; for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const fade = t => t * t * (3 - 2 * t);
export function vnoise(x, y, period = 256) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const h = (a, b) => PERM[(PERM[((a % period) + period) % period & 255] + (((b % period) + period) % period & 255)) & 511] / 255;
  const u = fade(xf), v = fade(yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// tileable fbm: freq must divide evenly into the period
export function fbm(x, y, oct = 5, period = 8) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, period * f); n += a; a *= 0.5; f *= 2; }
  return s / n;
}

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function finish(c, { srgb = true, repeat = 1, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}
// paint per-pixel with function (u,v) -> [r,g,b] (0..255)
function paint(c, fn) {
  const g = c.getContext('2d', { willReadFrequently: true }); const img = g.createImageData(c.width, c.height); const d = img.data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const o = (y * c.width + x) * 4; const col = fn(x / c.width, y / c.height, x, y);
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3] ?? 255;
  }
  g.putImageData(img, 0, 0); return g;
}
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const clamp = (x, a = 0, b = 255) => Math.max(a, Math.min(b, x));

// anisotropic tileable value noise / fbm: separate integer periods for x and y
export function vnoise2(x, y, px, py) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const X0 = ((xi % px) + px) % px & 255, X1 = (((xi + 1) % px) + px) % px & 255, Y0 = ((yi % py) + py) % py & 255, Y1 = (((yi + 1) % py) + py) % py & 255;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = PERM[PERM[X0] + Y0] / 255, b = PERM[PERM[X1] + Y0] / 255, c = PERM[PERM[X0] + Y1] / 255, d = PERM[PERM[X1] + Y1] / 255;
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm2(x, y, oct, px, py) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise2(x * f, y * f, px * f, py * f); n += a; a *= 0.5; f *= 2; }
  return s / n;
}
// tileable Worley noise: returns {f1, f2, id} for point (u,v) in [0,1), grid nx*ny with one jittered point per cell
function worleyGrid(nx, ny, seed) { const r = rng(seed); const P = new Float32Array(nx * ny * 3); for (let i = 0; i < nx * ny; i++) { P[i * 3] = r(); P[i * 3 + 1] = r(); P[i * 3 + 2] = r(); } return { nx, ny, P }; }
function worley(G, u, v, sx = 1, sy = 1) {
  const { nx, ny, P } = G; const x = u * nx, y = v * ny; const cx = Math.floor(x), cy = Math.floor(y);
  let f1 = 1e9, f2 = 1e9, id = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = cx + i, gy = cy + j; const wx = ((gx % nx) + nx) % nx, wy = ((gy % ny) + ny) % ny; const k = (wy * nx + wx) * 3;
    const dx = (gx + P[k] - x) * sx, dy = (gy + P[k + 1] - y) * sy; const d = Math.sqrt(dx * dx + dy * dy);
    if (d < f1) { f2 = f1; f1 = d; id = P[k + 2]; } else if (d < f2) f2 = d;
  }
  return { f1, f2, id };
}
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
// low-frequency field cache: evaluate fn(u,v) on an rx*ry grid once, then sample bilinearly with wrap (much cheaper than per-pixel fbm)
function LF(rx, ry, fn) {
  const A = new Float32Array(rx * ry);
  for (let j = 0; j < ry; j++) for (let i = 0; i < rx; i++) A[j * rx + i] = fn(i / rx, j / ry);
  return (u, v) => {
    const x = (u - Math.floor(u)) * rx, y = (v - Math.floor(v)) * ry; const xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
    const x1 = xi + 1 === rx ? 0 : xi + 1, y1 = yi + 1 === ry ? 0 : yi + 1;
    const a = A[yi * rx + xi], b = A[yi * rx + x1], c = A[y1 * rx + xi], d = A[y1 * rx + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}
// write a Float32 field (0..1) into a grey canvas
function grey(c, F) {
  const g = c.getContext('2d', { willReadFrequently: true }); const img = g.createImageData(c.width, c.height); const d = img.data;
  for (let i = 0; i < F.length; i++) { const h = clamp(F[i] * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = h; d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); return c;
}
// tangent-space normal map from a tileable height field (canvas y down = texture v down)
function normalFromHeight(H, w, h, strength = 4) {
  const c = canvas(w, h); const g = c.getContext('2d', { willReadFrequently: true }); const img = g.createImageData(w, h); const d = img.data;
  for (let y = 0; y < h; y++) {
    const ym = ((y - 1 + h) % h) * w, yp = ((y + 1) % h) * w, y0 = y * w;
    for (let x = 0; x < w; x++) {
      const xm = (x - 1 + w) % w, xp = (x + 1) % w;
      const dx = (H[y0 + xp] - H[y0 + xm]) * strength, dy = (H[yp + x] - H[ym + x]) * strength;
      const nx = -dx, ny = dy, l = Math.sqrt(nx * nx + ny * ny + 1); const o = (y0 + x) * 4;
      d[o] = (nx / l * 0.5 + 0.5) * 255; d[o + 1] = (ny / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0); return c;
}
// paint an RGB canvas from a Float32 rgb array
function rgbCanvas(c, C) {
  const g = c.getContext('2d', { willReadFrequently: true }); const img = g.createImageData(c.width, c.height); const d = img.data; const n = c.width * c.height;
  for (let i = 0; i < n; i++) { d[i * 4] = clamp(C[i * 3]); d[i * 4 + 1] = clamp(C[i * 3 + 1]); d[i * 4 + 2] = clamp(C[i * 3 + 2]); d[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); return c;
}
// bundle colour/height/roughness arrays into textures
function pack(w, h, C, H, R, { nStrength = 4, bump = true } = {}) {
  const out = { map: finish(rgbCanvas(canvas(w, h), C)), normal: finish(normalFromHeight(H, w, h, nStrength), { srgb: false }) };
  if (bump) out.bump = finish(grey(canvas(w, h), H), { srgb: false });
  if (R) out.rough = finish(grey(canvas(w, h), R), { srgb: false });
  return out;
}

// ---------- textures ----------
// Fired brick wall. Returns {map, bump}
export function brickTex({ size = 512, rows = 16, cols = 6, base = [168, 92, 62], var_ = 40, mortar = [176, 150, 120], weathering = 0.4, seed = 3 } = {}) {
  const r = rng(seed); const c = canvas(size), hb = canvas(size);
  const bh = size / rows, bw = size / cols, mw = Math.max(1.5, size / 220);
  const tint = []; for (let i = 0; i < rows * cols * 2; i++) tint.push([(r() - 0.5) * var_, (r() - 0.5) * var_ * 0.7, (r() - 0.5) * var_ * 0.5, r()]);
  const H = [];
  paint(c, (u, v, x, y) => {
    const row = Math.floor(y / bh); const off = (row % 2) * bw * 0.5; const xx = (x + off) % size;
    const col = Math.floor(xx / bw); const lx = xx - col * bw, ly = y - row * bh;
    const edge = Math.min(lx, bw - lx, ly, bh - ly);
    const n = fbm(u * 16, v * 16, 4, 16), n2 = fbm(u * 64, v * 64, 2, 64);
    const t = tint[(row * cols + col) % tint.length];
    let h, colr;
    const isMortar = edge < mw + n2 * 1.5;
    if (isMortar) { colr = mortar.map(m => m * (0.8 + n * 0.3)); h = 0.15 + n2 * 0.1; }
    else {
      const burnt = t[3] > 0.85 ? 0.7 : 1; // occasional dark over-fired brick
      colr = [base[0] + t[0], base[1] + t[1], base[2] + t[2]].map(q => q * burnt * (0.78 + n * 0.35 + (n2 - 0.5) * 0.15));
      const wash = Math.max(0, fbm(u * 3, v * 3, 3, 3) - 0.55) * weathering * 3; // pale lime staining
      colr = mixc(colr, [190, 175, 150], clamp(wash, 0, 0.6));
      h = 0.6 + Math.min(edge / 4, 1) * 0.3 + n2 * 0.1;
    }
    H.push(h); return colr.map(q => clamp(q));
  });
  let i = 0; paint(hb, () => { const h = H[i++] * 255; return [h, h, h]; });
  return { map: finish(c), bump: finish(hb, { srgb: false }) };
}

// Weathered log / timber with lengthwise grain (u across, v along)
export function woodTex({ size = 512, base = [110, 78, 50], dark = [58, 40, 26], light = [150, 115, 78], rings = 18, seed = 5, polish = false } = {}) {
  const c = canvas(size), hb = canvas(size); const H = [];
  paint(c, (u, v) => {
    const w = fbm(u * 4, v * 1, 4, 4) * 2.0;
    const g = Math.sin((u * rings + w * 3) * Math.PI * 2) * 0.5 + 0.5;
    const fine = fbm(u * 64, v * 4, 3, 64);
    const knot = Math.max(0, 1 - Math.hypot((u - 0.3) * 6, (v - 0.6) * 3)) ** 3;
    let col = mixc(dark, base, Math.pow(g, 0.6)); col = mixc(col, light, fine * 0.5);
    col = mixc(col, dark, knot * 0.8);
    if (!polish) col = mixc(col, [125, 118, 105], fbm(u * 6, v * 2, 3, 6) * 0.35); // greying weathering
    H.push(0.4 + g * 0.3 + fine * 0.3);
    return col.map(q => clamp(q));
  });
  let i = 0; paint(hb, () => { const h = H[i++] * 255; return [h, h, h]; });
  return { map: finish(c), bump: finish(hb, { srgb: false }) };
}

// Wood with readable grain. Vertical grain by default (a = across, b = along); horiz: grain runs along u.
// flutes: number of vertical flutes across the tile; carve: carved bead bands; weather: grey checked timber; polish: lacquer.
export function grainWood({ w = 512, h = 1024, dark = [64, 26, 12], mid = [128, 58, 26], light = [178, 96, 46], rings = 22, flutes = 0, carve = false, horiz = false, weather = 0, polish = false, knots = 2, seed = 7 } = {}) {
  const r = rng(seed); const N = w * h; const C = new Float32Array(N * 3), H = new Float32Array(N), R = new Float32Array(N);
  const so = Math.floor(r() * 50);
  const fWarp = LF(128, 64, (a, b) => fbm2(a * 3 + so, b * 1, 4, 3, 1)), fWarp2 = LF(256, 64, (a, b) => fbm2(a * 8, b * 2 + so, 3, 8, 2));
  const fStreak = LF(128, 32, (a, b) => fbm2(a * 5 + so, b * 0.5, 3, 5, 1)), fRough = LF(64, 64, (a, b) => fbm2(a * 4, b * 2 + 9, 3, 4, 2));
  const fW = weather ? LF(128, 64, (a, b) => fbm2(a * 4 + 3, b * 1.5, 4, 4, 2)) : null;
  const K = []; for (let i = 0; i < knots; i++) K.push([r(), r(), 0.012 + r() * 0.02]);
  // drying checks (splits along the grain), stamped into a mask
  const CK = new Float32Array(N);
  if (weather) for (let i = 0; i < 70; i++) {
    const ca = r(), cb = r(), cl = 0.04 + r() * 0.22, steps = Math.ceil(cl * 2 * Math.max(w, h));
    for (let s2 = 0; s2 <= steps; s2++) {
      const db = -cl + 2 * cl * s2 / steps, wd = 0.003 * (1 - Math.abs(db) / cl), aa = ca + Math.sin(db * 40) * 0.003;
      for (let da = -wd; da <= wd; da += 0.5 / Math.max(w, h)) {
        const A = fract(aa + da), B = fract(cb + db); const x = Math.floor((horiz ? B : A) * w), y = Math.floor((horiz ? A : B) * h);
        CK[y * w + x] = 1;
      }
    }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h; const a = horiz ? v : u, b = horiz ? u : v;
    let kn = 0, kd = 1; for (const [ka, kb, kr] of K) { let da = a - ka, db = b - kb; da -= Math.round(da); db -= Math.round(db); const d = Math.hypot(da, db * 0.35) / kr; if (d < kd) kd = d; kn += Math.exp(-d * d * 0.8); }
    const gx = a * rings + fWarp(a, b) * 3.2 + kn * 0.9 + fWarp2(a, b) * 0.5;
    const ring = fract(gx);
    const late = sstep(0.55, 0.85, ring) * (1 - sstep(0.9, 1.0, ring));
    const fibre = vnoise2(a * 300, b * 5 + so, 300, 5) * 0.6 + vnoise2(a * 120, b * 2, 120, 2) * 0.4;
    const streak = fStreak(a, b);
    const pore = Math.pow(vnoise2(a * 500, b * 40, 500, 40), 6);
    let t = 0.55 + (streak - 0.5) * 1.3 - late * 0.45 + (fibre - 0.5) * 0.35;
    t = Math.max(0, Math.min(1, t));
    let col = t < 0.5 ? mixc(dark, mid, t * 2) : mixc(mid, light, (t - 0.5) * 2);
    col = mixc(col, dark, Math.min(1, kd < 1 ? (1 - kd) * 0.9 : 0) + pore * 0.4);
    let hh = 0.5 - late * 0.08 + (fibre - 0.5) * 0.12 - pore * 0.1 + (kd < 1 ? (1 - kd) * 0.15 : 0);
    let rough = polish ? 0.3 + late * 0.18 + pore * 0.3 + (fRough(a, b) - 0.5) * 0.3 : 0.8;
    if (flutes) {
      const f = fract(u * flutes), prof = Math.sin(f * Math.PI); // concave flute between sharp arrises
      hh -= Math.sqrt(prof) * 1.6;
      col = col.map(q => q * (0.8 + 0.2 * (1 - prof * 0.7)));
      const arris = 1 - sstep(0, 0.06, Math.min(f, 1 - f)); col = mixc(col, light, arris * 0.3);
    }
    if (carve) {
      // carved band: two grooves framing a row of beads, twice per tile in v
      const cv = fract(v * 2), dv = Math.abs(cv - 0.5);
      const groove = Math.exp(-((dv - 0.17) ** 2) / 0.00025) + Math.exp(-((dv - 0.25) ** 2) / 0.0002);
      const beadU = fract(u * 14) - 0.5, bead = dv < 0.13 ? Math.max(0, 1 - Math.hypot(beadU * 1.3, (cv - 0.5) * 9.5)) : 0;
      const fillet = dv < 0.13 ? 1 : 0;
      hh += -groove * 0.5 + Math.sqrt(bead) * 0.6 - fillet * 0.15;
      col = col.map(q => q * (1 - groove * 0.45 - fillet * (1 - Math.sqrt(bead)) * 0.3));
      rough += groove * 0.2;
    }
    const i = y * w + x;
    if (weather) {
      const gw = sstep(0.35, 0.75, fW(a, b)) * weather;
      col = mixc(col, [128, 120, 108].map(q => q * (0.8 + fibre * 0.4)), gw * 0.75);
      if (CK[i]) { col = col.map(q => q * 0.35); hh -= 0.4; }
      rough = 0.78 + gw * 0.15 + (fibre - 0.5) * 0.1;
    }
    C[i * 3] = col[0]; C[i * 3 + 1] = col[1]; C[i * 3 + 2] = col[2]; H[i] = hh; R[i] = clamp(rough, 0.05, 1);
  }
  return pack(w, h, C, H, R, { nStrength: 6 });
}

// Rough bark for palisade logs / trunks: long vertical ridges split by deep fissures, knots, grey weathering. u around, v along.
export function barkTex({ w = 512, h = 1024, seed = 5, brown = [100, 76, 56], grey = [134, 124, 108], fissure = [26, 19, 15] } = {}) {
  const r = rng(seed); const N = w * h; const C = new Float32Array(N * 3), H = new Float32Array(N), R = new Float32Array(N);
  const G = worleyGrid(11, 4, seed * 7 + 1), G2 = worleyGrid(22, 9, seed * 7 + 2);
  const fWu = LF(64, 128, (u, v) => fbm2(u * 4, v * 2, 3, 4, 2)), fWv = LF(64, 64, (u, v) => fbm2(u * 3 + 5, v * 3, 2, 3, 3)), fWt = LF(64, 64, (u, v) => fbm2(u * 3, v * 2, 3, 3, 2));
  // anisotropic Voronoi: returns edge distance and how vertical the boundary is
  const vor = (Gd, u, v, sy) => {
    const { nx, ny, P } = Gd; const x = u * nx, y = v * ny; const cx = Math.floor(x), cy = Math.floor(y);
    let f1 = 1e9, f2 = 1e9, ax = 0, ay = 0, bx = 0, by = 0, id = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j; const k = ((((gy % ny) + ny) % ny) * nx + (((gx % nx) + nx) % nx)) * 3;
      const dx = gx + P[k] - x, dy = (gy + P[k + 1] - y) * sy; const d = dx * dx + dy * dy;
      if (d < f1) { f2 = f1; bx = ax; by = ay; f1 = d; ax = dx; ay = dy; id = P[k + 2]; } else if (d < f2) { f2 = d; bx = dx; by = dy; }
    }
    const ex = bx - ax, ey = by - ay; const vert = Math.abs(ex) / (Math.hypot(ex, ey) + 1e-6);
    return { e: Math.sqrt(f2) - Math.sqrt(f1), vert, id };
  };
  const K = []; for (let i = 0; i < 3; i++) K.push([r(), r(), 0.035 + r() * 0.03]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = x / w, v = y / h;
    const wu = fract(u + (fWu(u, v) - 0.5) * 0.07), wv = fract(v + (fWv(u, v) - 0.5) * 0.05);
    const c1 = vor(G, wu, wv, 0.45), c2 = vor(G2, wu, wv, 0.5);
    const vw1 = sstep(0.25, 0.75, c1.vert), vw2 = sstep(0.4, 0.85, c2.vert);
    const fis = (1 - sstep(0.02, 0.2, c1.e)) * (0.25 + 0.75 * vw1), fis2 = (1 - sstep(0.0, 0.09, c2.e)) * 0.6 * vw2;
    const fibre = vnoise2(u * 160, v * 10, 160, 10), fine = vnoise2(u * 64, v * 64, 64, 64);
    let kn = 0, ring = 0; for (const [ku, kv, kr] of K) { let du = u - ku, dv = v - kv; du -= Math.round(du); dv -= Math.round(dv); const d = Math.hypot(du, dv * 0.5) / kr; kn = Math.max(kn, 1 - sstep(0.3, 0.55, d)); ring = Math.max(ring, Math.exp(-((d - 0.75) ** 2) / 0.04)); }
    let hh = 0.75 - fis * 0.75 - fis2 * 0.3 + (fibre - 0.5) * 0.15 + (fine - 0.5) * 0.08;
    hh += ring * 0.35 - kn * 0.25;
    const wthr = sstep(0.35, 0.7, fWt(u, v) * 0.7 + c1.id * 0.3 + (hh - 0.5) * 0.3);
    let col = mixc(brown, grey, wthr);
    col = col.map(q => q * (0.88 + c1.id * 0.2 + (fibre - 0.5) * 0.3 + (fine - 0.5) * 0.12));
    const fCol = mixc(fissure, [80, 52, 36], sstep(0.6, 1, vnoise2(u * 30, v * 6, 30, 6)) * 0.6);
    col = mixc(col, fCol, Math.min(1, fis * 0.95 + fis2 * 0.6));
    col = mixc(col, [50, 36, 26], kn * 0.85); col = mixc(col, [140, 112, 86], ring * 0.25);
    const i = y * w + x; C[i * 3] = col[0]; C[i * 3 + 1] = col[1]; C[i * 3 + 2] = col[2]; H[i] = hh; R[i] = 0.82 + fis * 0.15;
  }
  return pack(w, h, C, H, R, { nStrength: 8 });
}

// Barrel (pan-and-cover) terracotta roof tiles. u along the eave, v up the slope (canvas bottom = eave).
export function barrelTiles({ size = 1024, cols = 14, rows = 10, base = [150, 82, 56], seed = 12, moss = 0.6 } = {}) {
  const r = rng(seed); const N = size * size; const C = new Float32Array(N * 3), H = new Float32Array(N), R = new Float32Array(N);
  const tint = []; for (let i = 0; i < cols * rows * 2; i++) tint.push([0.72 + r() * 0.45, (r() - 0.5) * 0.14, r()]);
  const fN = LF(256, 256, (u, v) => fbm2(u * 16, v * 16, 4, 16, 16)), fS = LF(64, 64, (u, v) => fbm2(u * 3 + 4, v * 3, 3, 3, 3)), fM = LF(128, 128, (u, v) => fbm2(u * 6 + 11, v * 6, 4, 6, 6));
  const cw = 0.29;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size; const cu = u * cols, col_i = Math.floor(cu), fu = cu - col_i;
    const du = (fu - 0.5) / cw; const onCover = Math.abs(du) < 1;
    const rowF = v * rows + (onCover ? 0 : 0.5), row_i = Math.floor(rowF), fv = rowF - row_i; // fv: 0 upslope .. 1 lip (downslope)
    const t = tint[((onCover ? 0 : 1) * cols * rows + (row_i % rows) * cols + col_i) % tint.length];
    const n = fN(u, v), n2 = vnoise2(u * 128, v * 128, 128, 128);
    let hh, ao;
    if (onCover) {
      const prof = Math.sqrt(Math.max(0, 1 - du * du));
      hh = 0.45 + prof * 0.5 + fv * 0.08; ao = 0.55 + 0.45 * Math.pow(prof, 0.5);
    } else {
      const pu = fu < 0.5 ? (fu + 0.5 - cw) / (1 - 2 * cw) : (fu - 0.5 - cw) / (1 - 2 * cw);
      const pp = Math.abs(fract(pu) - 0.5) * 2;
      hh = 0.08 + pp * pp * 0.22 + fv * 0.06; ao = 0.45 + 0.35 * (1 - pp);
    }
    const lipShadow = sstep(0.0, onCover ? 0.18 : 0.25, fv);
    const lip = fv > 0.93 ? 0.85 : 1;
    ao *= 0.55 + 0.45 * lipShadow; hh -= (1 - lipShadow) * 0.08;
    let colr = base.map((q, k) => q * t[0] * (1 + (k === 0 ? t[1] : k === 2 ? -t[1] : 0)) * (0.86 + n * 0.24 + (n2 - 0.5) * 0.1) * lip);
    if (t[2] > 0.93) colr = colr.map(q => q * 0.72);
    const soot = sstep(0.45, 0.8, fS(u, v)) * 0.55;
    colr = mixc(colr, [62, 54, 48], soot * 0.6);
    const mm = sstep(0.5, 0.78, fM(u, v) + (onCover ? -0.08 : 0.1) + (1 - lipShadow) * 0.15) * moss;
    colr = mixc(colr, [78, 84, 48].map(q => q * (0.75 + n2 * 0.5)), mm * 0.85);
    if (Math.pow(n2, 9) > 0.35 && onCover) colr = mixc(colr, [176, 168, 140], 0.6);
    colr = colr.map(q => q * ao);
    const i = y * size + x; C[i * 3] = colr[0]; C[i * 3 + 1] = colr[1]; C[i * 3 + 2] = colr[2]; H[i] = hh + (n2 - 0.5) * 0.04; R[i] = 0.72 + mm * 0.25 + (1 - ao) * 0.1;
  }
  return pack(size, size, C, H, R, { nStrength: 7 });
}

// Weathered lime plaster over brick: mottling, stains, rain streaks, cracks, spalled patches exposing brick. canvas top = world top.
export function plasterWall({ size = 1024, base = [220, 198, 168], seed = 17, brick = [168, 96, 62], spall = 0.5 } = {}) {
  const r = rng(seed); const N = size * size; const C = new Float32Array(N * 3), H = new Float32Array(N), R = new Float32Array(N);
  const cc = canvas(size); const g = cc.getContext('2d', { willReadFrequently: true }); g.fillStyle = '#000'; g.fillRect(0, 0, size, size); g.strokeStyle = '#fff'; g.lineCap = 'round';
  const crack = (x, y, a, len, wdt, depth) => {
    g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < len; i++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 4; y += Math.sin(a) * 4; g.lineTo(x, y); if (depth < 2 && r() < 0.04) { g.stroke(); crack(x, y, a + (r() - 0.5) * 2, len * 0.4, wdt * 0.7, depth + 1); g.lineWidth = wdt; g.beginPath(); g.moveTo(x, y); } }
    g.stroke();
  };
  for (let k = 0; k < 12; k++) crack(r() * size, r() * size, Math.PI / 2 + (r() - 0.5) * 1.6, 20 + r() * 45, 1 + r() * 1.3, 0);
  const crackD = g.getImageData(0, 0, size, size).data;
  const fN = LF(256, 256, (u, v) => fbm2(u * 5, v * 5, 5, 5, 5)), fSt = LF(64, 64, (u, v) => fbm2(u * 3 + 7, v * 3, 4, 3, 3)), fGs = LF(64, 64, (u, v) => fbm2(u * 4 + 2, v * 4 + 9, 4, 4, 4));
  const fSk = LF(512, 32, (u, v) => fbm2(u * 40, v * 1.5, 3, 40, 1) * 0.8 + vnoise2(u * 90, v * 3, 90, 3) * 0.2), fSkM = LF(64, 32, (u, v) => fbm2(u * 6 + 3, v * 2, 2, 6, 2));
  const fSp = LF(128, 128, (u, v) => fbm2(u * 3 + 21, v * 3, 5, 3, 3));
  const rowsB = 52, bh = size / rowsB; const tints = []; for (let i = 0; i < 4000; i++) tints.push(0.75 + r() * 0.4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = y * size + x;
    const n = fN(u, v), n2 = vnoise2(u * 90, v * 90, 90, 90), n3 = vnoise2(u * 300, v * 300, 300, 300);
    let col = base.map(q => q * (0.9 + (n - 0.5) * 0.22 + (n2 - 0.5) * 0.06 + (n3 - 0.5) * 0.04));
    const st = sstep(0.5, 0.75, fSt(u, v)); col = mixc(col, [172, 136, 100], st * 0.38);
    const gs = sstep(0.55, 0.8, fGs(u, v)); col = mixc(col, [128, 122, 108], gs * 0.3);
    // rain streaks running down from the top (vertical noise, stronger toward the top of the tile = top of wall bands)
    const sk = sstep(0.5, 0.75, fSk(u, v + n * 0.05)) * sstep(0.3, 0.6, fSkM(u, v));
    col = mixc(col, [106, 92, 74], sk * 0.6);
    let hh = 0.6 + (n - 0.5) * 0.25 + (n2 - 0.5) * 0.12 + (n3 - 0.5) * 0.06, rough = 0.9 + (n3 - 0.5) * 0.1;
    const sp = fSp(u, v) + (n2 - 0.5) * 0.06 + (n3 - 0.5) * 0.02;
    const thr = 0.775 - spall * 0.04;
    if (sp > thr) {
      const row = Math.floor(v * rowsB), off = (row % 2) * 0.5, bu = u * 9 + off, bc = Math.floor(bu);
      const lu = bu - bc, lv = v * rowsB - row;
      const mort = Math.min(lu * size / 9, (1 - lu) * size / 9, lv * bh, (1 - lv) * bh) < 1.8 + n3;
      const tb = tints[(row * 9 + (bc % 9)) % tints.length];
      const bcol = mort ? [176, 156, 128].map(q => q * (0.8 + n3 * 0.2)) : brick.map(q => q * tb * (0.85 + n3 * 0.3));
      const edge = sstep(thr + 0.005, thr + 0.025, sp);
      col = mixc([214, 202, 182], bcol, edge);
      hh = 0.2 + (mort ? -0.08 : 0.08) * edge + (1 - edge) * 0.35;
      rough = 0.95;
    } else if (sp > thr - 0.03) { col = col.map(q => q * (0.88 + (sp - thr + 0.03) * 2)); }
    const ck = crackD[i * 4] / 255; if (ck > 0.1) { col = col.map(q => q * (1 - ck * 0.6)); hh -= ck * 0.3; }
    C[i * 3] = col[0]; C[i * 3 + 1] = col[1]; C[i * 3 + 2] = col[2]; H[i] = hh; R[i] = rough;
  }
  return pack(size, size, C, H, R, { nStrength: 5 });
}

// Fired brick with irregular courses, per-brick warm colour variation, chipped edges, recessed mortar, weathering patches.
export function brickWall({ size = 512, rows = 16, cols = 6, pal = [[146, 72, 42], [176, 96, 56], [192, 124, 80], [168, 110, 76]], mortar = [182, 162, 132], lime = 0.4, dark = 0.5, seed = 3 } = {}) {
  const r = rng(seed); const N = size * size; const C = new Float32Array(N * 3), H = new Float32Array(N), R = new Float32Array(N);
  const rh = []; let tot = 0; for (let i = 0; i < rows; i++) { const q = 0.82 + r() * 0.36; rh.push(q); tot += q; }
  const rowY = [0]; for (let i = 0; i < rows; i++) rowY.push(rowY[i] + rh[i] / tot * size);
  const joints = []; for (let i = 0; i < rows; i++) { const L = []; let t = 0; while (t < cols - 0.3) { L.push(t); t += 0.7 + r() * 0.6; } const sc = cols / t; const off = r(); joints.push(L.map(q => ((q * sc / cols + off) % 1) * size).sort((a, b) => a - b)); }
  const bt = []; for (let i = 0; i < 4096; i++) { const a = r(); const p = a < 0.3 ? 0 : a < 0.65 ? 1 : a < 0.85 ? 2 : 3; const k = r(); bt.push([p, 0.8 + k * 0.3, r(), r()]); }
  const fN = LF(128, 128, (u, v) => fbm2(u * 8, v * 8, 4, 8, 8)), fD = LF(64, 64, (u, v) => fbm2(u * 3 + 5, v * 3, 4, 3, 3)), fL = LF(64, 64, (u, v) => fbm2(u * 4 + 13, v * 2, 4, 4, 2));
  const mw = Math.max(1.6, size / 300);
  let row = 0;
  for (let y = 0; y < size; y++) {
    while (y >= rowY[row + 1]) row++;
    const J = joints[row]; const y0 = rowY[row], y1 = rowY[row + 1];
    let bi = -1;
    for (let x = 0; x < size; x++) {
      while (bi + 1 < J.length && x >= J[bi + 1]) bi++;
      const u = x / size, v = y / size, i = y * size + x;
      const xa = bi < 0 ? J[J.length - 1] - size : J[bi], xb = bi + 1 < J.length ? J[bi + 1] : J[0] + size;
      const n2 = vnoise2(u * 96, v * 96, 96, 96), n3 = vnoise2(u * 260, v * 260, 260, 260), n = fN(u, v);
      const ex = Math.min(x - xa, xb - x), ey = Math.min(y - y0, y1 - y); const e = Math.min(ex, ey) - (n2 - 0.5) * 2.2 - (n3 - 0.5) * 1.2;
      const t = bt[((row * 97 + (bi + J.length) % J.length) * 13) % bt.length];
      let col, hh, rough;
      if (e < mw) { col = mortar.map(q => q * (0.78 + n * 0.25 + (n3 - 0.5) * 0.2)); hh = 0.12 + n3 * 0.08; rough = 0.95; }
      else {
        const p0 = pal[t[0]], p1 = pal[(t[0] + 1) % pal.length];
        col = mixc(p0, p1, t[2] * 0.5).map(q => q * t[1] * (0.86 + (n2 - 0.5) * 0.2 + (n3 - 0.5) * 0.14 + (n - 0.5) * 0.2));
        if (t[3] > 0.93) col = col.map(q => q * 0.66);
        const bev = sstep(mw, mw + 4, e); hh = 0.45 + bev * 0.4 + (n3 - 0.5) * 0.1 + (n2 - 0.5) * 0.08; rough = 0.85 + (n3 - 0.5) * 0.1;
        col = col.map(q => q * (0.8 + 0.2 * bev));
      }
      const dk = sstep(0.55, 0.8, fD(u, v)) * dark; col = mixc(col, [92, 62, 48], dk * 0.55);
      const lw = sstep(0.6, 0.85, fL(u, v)) * lime; col = mixc(col, [204, 190, 164], lw * 0.6);
      C[i * 3] = col[0]; C[i * 3 + 1] = col[1]; C[i * 3 + 2] = col[2]; H[i] = hh; R[i] = rough;
    }
  }
  return pack(size, size, C, H, R, { nStrength: 5 });
}

// Polished Chunar sandstone: warm buff, faint bedding and veins, speckle; low roughness with smudges.
export function sandstoneTex({ size = 1024, base = [210, 168, 118], seed = 13 } = {}) {
  const N = size * size; const C = new Float32Array(N * 3), H = new Float32Array(N), R = new Float32Array(N);
  const fN = LF(256, 256, (u, v) => fbm2(u * 4, v * 4, 5, 4, 4)), fB = LF(64, 64, (u, v) => fbm2(u * 3, v * 3, 3, 3, 3)), fI = LF(128, 128, (u, v) => fbm2(u * 6 + 3, v * 6, 3, 6, 6)), fR = LF(64, 64, (u, v) => fbm2(u * 5 + 9, v * 5, 3, 5, 5));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size, i = y * size + x;
    const n = fN(u, v), n2 = vnoise2(u * 200, v * 200, 200, 200), n3 = vnoise2(u * 500, v * 500, 500, 500);
    const bed = Math.sin((v * 5 + fB(u, v) * 1.6) * Math.PI * 2) * 0.5 + 0.5;
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 2 + v * 3 + n * 3) * Math.PI)), 30);
    let col = base.map(q => q * (0.92 + (n - 0.5) * 0.18 + (bed - 0.5) * 0.025 + (n2 - 0.5) * 0.05));
    col = mixc(col, [176, 116, 74], sstep(0.6, 0.8, fI(u, v)) * 0.22);
    col = mixc(col, [150, 108, 74], vein * 0.3);
    if (n3 > 0.9) col = col.map(q => q * 0.88); else if (n3 < 0.07) col = col.map(q => Math.min(255, q * 1.06));
    C[i * 3] = col[0]; C[i * 3 + 1] = col[1]; C[i * 3 + 2] = col[2]; H[i] = 0.5 + (n2 - 0.5) * 0.15 - vein * 0.1; R[i] = 0.2 + sstep(0.4, 0.8, fR(u, v)) * 0.22 + vein * 0.1;
  }
  return pack(size, size, C, H, R, { nStrength: 2 });
}

// Layered straw thatch: overlapping courses of straw bundles with ragged butt ends and dark gaps. canvas top = ridge.
export function thatchLayered({ size = 512, courses = 8, seed = 9, base = [160, 128, 84] } = {}) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = `rgb(${base.map(q => q * 0.25 | 0)})`; g.fillRect(0, 0, size, size);
  const ch = size / courses; const NB = 8;
  const seg = (P, x, y, x2, y2) => { for (const dx of [-size, 0, size]) { if (x + dx < -20 || x + dx > size + 20) continue; for (const dy of [-size, 0, size]) { if (Math.max(y, y2) + dy < 0 || Math.min(y, y2) + dy > size) continue; P.moveTo(x + dx, y + dy); P.lineTo(x2 + dx, y2 + dy); } } };
  for (let k = courses; k >= 1; k--) { // eave course first; upper courses overlap it
    const yEnd = k * ch;
    for (const dy of [0, -size, size]) {
      const gr = g.createLinearGradient(0, yEnd + dy - 2, 0, yEnd + dy + ch * 0.5); gr.addColorStop(0, 'rgba(20,13,6,0.9)'); gr.addColorStop(1, 'rgba(20,13,6,0)');
      g.fillStyle = gr; g.fillRect(0, yEnd + dy - 2, size, ch * 0.5 + 2);
    }
    const PC = []; for (let q = 0; q < NB; q++) PC.push(new Path2D());
    for (let b = 0; b < 30; b++) {
      const bx = (b + r() * 0.7) / 30 * size, bw = size / 30 * (1.2 + r() * 0.8), bEnd = yEnd + (r() - 0.35) * ch * 0.35, grey = r();
      const bBucket = 2 + Math.floor(r() * (NB - 4));
      for (let s2 = 0; s2 < 140; s2++) {
        const x = bx + (r() - 0.5) * bw, y1 = bEnd - ch * (1.1 + r() * 0.5), y2 = bEnd + (r() - 0.5) * ch * 0.4, lean = (r() - 0.5) * 7;
        const q = Math.max(0, Math.min(NB - 1, bBucket + Math.floor((r() - 0.5) * 7)));
        seg(PC[q], x, y1, x + lean, y2);
      }
    }
    for (let q = 0; q < NB; q++) {
      const kq = 0.7 + q / (NB - 1) * 0.45; let col = base.map(z => z * kq); if (q % 2 === 0) col = mixc(col, [138, 128, 108], 0.5);
      g.strokeStyle = `rgba(${clamp(col[0]) | 0},${clamp(col[1]) | 0},${clamp(col[2]) | 0},0.9)`; g.lineWidth = 0.7 + (q % 3) * 0.3; g.stroke(PC[q]);
    }
  }
  const img = g.getImageData(0, 0, size, size), d = img.data;
  const fN = LF(64, 64, (u, v) => fbm2(u * 4, v * 4, 3, 4, 4)), fG = LF(64, 64, (u, v) => fbm2(u * 3 + 7, v * 3, 3, 3, 3));
  const H = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const u = (i % size) / size, v = ((i / size) | 0) / size; const n = fN(u, v), gq = sstep(0.5, 0.75, fG(u, v));
    const k = 0.82 + n * 0.3; let rr = d[i * 4] * k, gg = d[i * 4 + 1] * k, bb = d[i * 4 + 2] * k * 0.97;
    const L = (rr + gg + bb) / 3; rr = mix(rr, L * 0.95, gq * 0.5); gg = mix(gg, L * 0.93, gq * 0.5); bb = mix(bb, L * 0.86, gq * 0.5); // grey weathered patches
    H[i] = Math.pow((d[i * 4] + d[i * 4 + 1]) / 400, 0.8); // luminance as height: gaps and shadows sit low
    d[i * 4] = rr; d[i * 4 + 1] = gg; d[i * 4 + 2] = bb;
  }
  g.putImageData(img, 0, 0);
  return { map: finish(c), normal: finish(normalFromHeight(H, size, size, 4), { srgb: false }), bump: finish(grey(canvas(size), H), { srgb: false }) };
}

// copy a colour texture with a per-channel multiplier (re-tinted variant that shares the pattern)
export function tinted(tex, mul) {
  const src = tex.image; const c = canvas(src.width, src.height); const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = clamp(d[i] * mul[0]); d[i + 1] = clamp(d[i + 1] * mul[1]); d[i + 2] = clamp(d[i + 2] * mul[2]); }
  g.putImageData(img, 0, 0); const t = finish(c); t.repeat.copy(tex.repeat); return t;
}

// Thatch: dense straw strokes
export function thatchTex({ size = 512, seed = 9, base = [176, 142, 88] } = {}) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = `rgb(${base.map(q => q * 0.55)})`; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 26000; i++) {
    const x = r() * size, y = r() * size, len = 10 + r() * 40, a = (r() - 0.5) * 0.25;
    const k = 0.6 + r() * 0.55;
    g.strokeStyle = `rgba(${clamp(base[0] * k)},${clamp(base[1] * k)},${clamp(base[2] * k * 0.95)},0.85)`;
    g.lineWidth = 0.6 + r() * 1.2; g.beginPath(); g.moveTo(x, y);
    g.lineTo(x + Math.sin(a) * len, y + Math.cos(a) * len); g.stroke();
    for (const dx of [-size, size]) if (x + dx > -50 && x + dx < size + 50) { g.beginPath(); g.moveTo(x + dx, y); g.lineTo(x + dx + Math.sin(a) * len, y + Math.cos(a) * len); g.stroke(); }
  }
  // layered rows of thatch bundles
  for (let y = 0; y < size; y += size / 8) { g.fillStyle = 'rgba(40,28,15,0.35)'; g.fillRect(0, y, size, 3); }
  return { map: finish(c), bump: finish(c, { srgb: false }) };
}

// Terracotta / wooden shingle roof tiles
export function tileTex({ size = 512, rows = 12, cols = 10, base = [112, 78, 56], seed = 11 } = {}) {
  const r = rng(seed); const c = canvas(size), hb = canvas(size); const H = [];
  const tints = []; for (let i = 0; i < 400; i++) tints.push((r() - 0.5) * 0.3);
  paint(c, (u, v, x, y) => {
    const row = Math.floor(v * rows); const off = (row % 2) * 0.5;
    const cu = (u * cols + off) % 1, rv = (v * rows) % 1;
    const curve = Math.sin(cu * Math.PI); // barrel tile shading
    const t = tints[(row * cols + Math.floor(u * cols + off)) % 400];
    const n = fbm(u * 16, v * 16, 4, 16);
    const lip = rv > 0.88 ? 0.55 : 1;
    const s = (0.55 + curve * 0.45) * lip * (0.85 + n * 0.3) * (1 + t);
    H.push(curve * 0.7 + (1 - rv) * 0.3);
    return mixc(base.map(q => q * s), [120, 120, 112], Math.max(0, n - 0.6) * 1.2).map(q => clamp(q));
  });
  let i = 0; paint(hb, () => { const h = H[i++] * 255; return [h, h, h]; });
  return { map: finish(c), bump: finish(hb, { srgb: false }) };
}

// Sandstone / dressed stone (polished option for Mauryan pillars)
export function stoneTex({ size = 512, base = [196, 160, 112], seed = 13, polish = false, blocks = 0 } = {}) {
  const c = canvas(size), hb = canvas(size); const H = [];
  const fN = LF(256, 256, (u, v) => fbm(u * 6, v * 6, 6, 6));
  paint(c, (u, v) => {
    const n = fN(u, v), n2 = fbm(u * 40, v * 40, 2, 40);
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 3 + n * 4) * Math.PI)), 12);
    let col = base.map(q => q * (0.82 + n * 0.3 + (n2 - 0.5) * (polish ? 0.05 : 0.18)));
    col = mixc(col, base.map(q => q * 0.7), vein * 0.35);
    let h = n * 0.5 + n2 * 0.5;
    if (blocks) { const bu = (u * blocks) % 1, bv = (v * blocks * 2) % 1; const e = Math.min(bu, 1 - bu, bv, 1 - bv); if (e < 0.012) { col = col.map(q => q * 0.6); h = 0.1; } }
    H.push(h); return col.map(q => clamp(q));
  });
  let i = 0; paint(hb, () => { const h = H[i++] * 255; return [h, h, h]; });
  return { map: finish(c), bump: finish(hb, { srgb: false }) };
}

// Lime plaster wall, with grime toward the bottom (v=1 bottom)
export function plasterTex({ size = 512, base = [222, 204, 178], seed = 17 } = {}) {
  const c = canvas(size), hb = canvas(size); const H = [];
  paint(c, (u, v) => {
    const n = fbm(u * 5, v * 5, 5, 5), n2 = fbm(u * 50, v * 50, 2, 50);
    const stain = Math.max(0, fbm(u * 3 + 7, v * 2, 3, 3) - 0.5) * 1.3;
    let col = base.map(q => q * (0.88 + n * 0.16 + (n2 - 0.5) * 0.06));
    col = mixc(col, [160, 120, 90], stain * 0.5);
    H.push(n * 0.6 + n2 * 0.4); return col.map(q => clamp(q));
  });
  let i = 0; paint(hb, () => { const h = H[i++] * 255; return [h, h, h]; });
  return { map: finish(c), bump: finish(hb, { srgb: false }) };
}

// Polished stone floor tiles (palace hall)
export function floorTex({ size = 1024, tiles = 4, seed = 19 } = {}) {
  const r = rng(seed); const c = canvas(size); const rough = canvas(size);
  const tints = []; for (let i = 0; i < 64; i++) tints.push([r() * 0.12 - 0.06, r()]);
  const R = [];
  const fN = LF(512, 512, (u, v) => fbm(u * 8, v * 8, 6, 8));
  paint(c, (u, v) => {
    const tu = Math.floor(u * tiles), tv = Math.floor(v * tiles); const t = tints[(tu * 7 + tv * 3) % 64];
    const lu = (u * tiles) % 1, lv = (v * tiles) % 1; const e = Math.min(lu, 1 - lu, lv, 1 - lv);
    const n = fN(u + t[1] * 1.25, v);
    const vein = Math.pow(1 - Math.abs(Math.sin((u * 5 + v * 2 + n * 5 + t[1] * 3) * Math.PI)), 20);
    let col = [222, 200, 168].map(q => q * (0.86 + n * 0.22 + t[0]));
    col = mixc(col, [150, 130, 112], vein * 0.6);
    if (e < 0.004) col = col.map(q => q * 0.55);
    R.push(e < 0.004 ? 0.9 : 0.12 + n * 0.18);
    return col.map(q => clamp(q));
  });
  let i = 0; paint(rough, () => { const h = R[i++] * 255; return [h, h, h]; });
  return { map: finish(c), rough: finish(rough, { srgb: false }) };
}

// Ground detail (tiles at ~4m) — rgb: dirt, grass handled in shader via mask
export function groundDetail({ size = 1024 } = {}) {
  const dirt = canvas(size), grass = canvas(size);
  const fD = LF(512, 512, (u, v) => fbm(u * 8, v * 8, 6, 8)), fG = LF(512, 512, (u, v) => fbm(u * 8, v * 8, 5, 8)), fY = LF(128, 128, (u, v) => fbm(u * 4 + 3, v * 4, 4, 4));
  paint(dirt, (u, v) => {
    const n = fD(u, v), n2 = fbm(u * 64, v * 64, 2, 64);
    const peb = Math.pow(vnoise(u * 180, v * 180, 180), 8) * 2;
    let col = [178, 140, 104].map(q => q * (0.82 + n * 0.28 + (n2 - 0.5) * 0.18));
    col = mixc(col, [120, 100, 82], clamp(peb, 0, 1));
    return col.map(q => clamp(q));
  });
  paint(grass, (u, v) => {
    const n = fG(u, v), n2 = fbm(u * 128, v * 128, 2, 128);
    const dry = fY(u, v);
    let col = mixc([72, 96, 40], [150, 136, 74], clamp((dry - 0.4) * 2.5, 0, 1));
    col = col.map(q => q * (0.7 + n * 0.35 + (n2 - 0.5) * 0.35));
    return col.map(q => clamp(q));
  });
  return { dirt: finish(dirt), grass: finish(grass) };
}

// Leaf card atlas: cluster of leaves on transparent background
export function leafTex({ size = 256, seed = 23, hue = [70, 110, 40], dryness = 0.15 } = {}) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, size, size);
  for (let i = 0; i < 46; i++) {
    const x = size * (0.15 + r() * 0.7), y = size * (0.15 + r() * 0.7), a = r() * Math.PI * 2, L = size * (0.09 + r() * 0.07);
    const k = 0.65 + r() * 0.6; const dry = r() < dryness;
    const col = dry ? [150 * k, 140 * k, 60 * k] : hue.map(q => q * k);
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `rgb(${col.map(q => clamp(q | 0))})`;
    g.beginPath(); g.ellipse(0, 0, L, L * 0.42, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = `rgba(30,40,15,0.5)`; g.lineWidth = 1; g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke();
    g.restore();
  }
  const t = finish(c, { aniso: 4 }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
}

// Generic cloth weave (multiplied by vertex/instance colour) with soft folds
export function clothTex({ size = 256 } = {}) {
  const c = canvas(size);
  paint(c, (u, v, x, y) => {
    const fold = 0.93 + 0.07 * Math.sin((u * 3 + fbm(u * 2, v * 2, 3, 2) * 2) * Math.PI * 2);
    const weave = ((x + y) % 2) * 0.04;
    const n = fbm(u * 16, v * 16, 3, 16) * 0.12;
    const k = (fold + weave + n) * 230; return [k, k, k];
  });
  return finish(c);
}

// Ashokan-style inscription glyphs (abstract Brahmi-like strokes) on stone
export function inscriptionTex({ w = 1024, h = 1024, base = [214, 172, 124], seed = 29, bg = null } = {}) {
  const r = rng(seed); const src = bg || stoneTex({ size: 256, base, polish: true, seed }).map.image;
  const c = canvas(w, h); const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, w, h);
  const hc = canvas(w, h); const gh = hc.getContext('2d', { willReadFrequently: true }); gh.fillStyle = '#fff'; gh.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(92,54,30,0.62)'; gh.strokeStyle = 'rgba(0,0,0,0.85)';
  for (const G of [g, gh]) { G.lineWidth = 2; G.lineCap = 'round'; }
  const lineH = 26;
  for (let y = 60; y < h - 120; y += lineH) {
    let x = 30 + r() * 10;
    while (x < w - 40) {
      // one glyph: combination of vertical, hook, circle, cross strokes
      const gw = 10 + r() * 6; const kind = Math.floor(r() * 6); const mark = r() < 0.3;
      for (const G of [g, gh]) {
        G.beginPath();
        if (kind === 0) { G.moveTo(x + gw / 2, y); G.lineTo(x + gw / 2, y + 16); G.moveTo(x, y + 6); G.lineTo(x + gw, y + 6); }
        else if (kind === 1) { G.arc(x + gw / 2, y + 8, gw / 2.4, 0, Math.PI * 2); }
        else if (kind === 2) { G.moveTo(x, y); G.lineTo(x + gw / 2, y + 16); G.lineTo(x + gw, y); }
        else if (kind === 3) { G.moveTo(x, y + 16); G.lineTo(x, y); G.lineTo(x + gw, y); G.lineTo(x + gw, y + 10); }
        else if (kind === 4) { G.moveTo(x + gw / 2, y); G.lineTo(x + gw / 2, y + 16); G.arc(x + gw / 2 + 3, y + 12, 3, Math.PI, 0); }
        else { G.moveTo(x, y + 8); G.lineTo(x + gw, y + 8); G.moveTo(x + gw / 3, y); G.lineTo(x + gw / 3, y + 16); }
        if (mark) { G.moveTo(x + gw / 2, y - 3); G.lineTo(x + gw / 2 + 4, y - 6); } // vowel mark
        G.stroke();
      }
      x += gw + 5 + r() * 4; if (r() < 0.08) x += 12;
    }
  }
  const t = finish(c); t.wrapS = THREE.RepeatWrapping; t.userData.bump = finish(hc, { srgb: false }); return t;
}

// Dharma chakra emblem (for banners / capital abacus)
export function chakraTex({ size = 512, bg = [214, 178, 70], fg = [120, 40, 30], cloth = true } = {}) {
  const c = canvas(size); const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = `rgb(${bg})`; g.fillRect(0, 0, size, size);
  if (cloth) { const r = rng(4); for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.05})`; g.fillRect(r() * size, r() * size, 1, r() * 8); } }
  const cx = size / 2, cy = size / 2, R = size * 0.3;
  g.strokeStyle = `rgb(${fg})`; g.lineWidth = size * 0.025;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(cx, cy, R * 0.15, 0, Math.PI * 2); g.stroke();
  g.lineWidth = size * 0.012;
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(cx + Math.cos(a) * R * 0.15, cy + Math.sin(a) * R * 0.15); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
  // border trims
  g.fillStyle = `rgb(${fg})`; g.fillRect(0, 0, size, size * 0.04); g.fillRect(0, size * 0.96, size, size * 0.04);
  return finish(c);
}

// Water normal map (tileable)
export function waterNormals({ size = 512 } = {}) {
  const c = canvas(size); const hgt = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) hgt[y * size + x] = fbm(x / size * 8, y / size * 8, 5, 8) + 0.5 * fbm(x / size * 32, y / size * 32, 2, 32);
  paint(c, (u, v, x, y) => {
    const L = hgt[y * size + ((x - 1 + size) % size)], R = hgt[y * size + ((x + 1) % size)];
    const D = hgt[((y - 1 + size) % size) * size + x], U = hgt[((y + 1) % size) * size + x];
    const nx = (L - R) * 6, ny = (D - U) * 6, nz = 1; const l = Math.hypot(nx, ny, nz);
    return [(nx / l * 0.5 + 0.5) * 255, (ny / l * 0.5 + 0.5) * 255, (nz / l * 0.5 + 0.5) * 255];
  });
  return finish(c, { srgb: false });
}
