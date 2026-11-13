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
  const g = c.getContext('2d'); const img = g.createImageData(c.width, c.height); const d = img.data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    const o = (y * c.width + x) * 4; const col = fn(x / c.width, y / c.height, x, y);
    d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3] ?? 255;
  }
  g.putImageData(img, 0, 0); return g;
}
const mix = (a, b, t) => a + (b - a) * t;
const mixc = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const clamp = (x, a = 0, b = 255) => Math.max(a, Math.min(b, x));

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

// Thatch: dense straw strokes
export function thatchTex({ size = 512, seed = 9, base = [176, 142, 88] } = {}) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d');
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
  paint(c, (u, v) => {
    const n = fbm(u * 6, v * 6, 6, 6), n2 = fbm(u * 40, v * 40, 2, 40);
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
  paint(c, (u, v) => {
    const tu = Math.floor(u * tiles), tv = Math.floor(v * tiles); const t = tints[(tu * 7 + tv * 3) % 64];
    const lu = (u * tiles) % 1, lv = (v * tiles) % 1; const e = Math.min(lu, 1 - lu, lv, 1 - lv);
    const n = fbm(u * 8 + t[1] * 10, v * 8, 6, 8);
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
  paint(dirt, (u, v) => {
    const n = fbm(u * 8, v * 8, 6, 8), n2 = fbm(u * 64, v * 64, 2, 64);
    const peb = Math.pow(vnoise(u * 180, v * 180, 180), 8) * 2;
    let col = [178, 140, 104].map(q => q * (0.82 + n * 0.28 + (n2 - 0.5) * 0.18));
    col = mixc(col, [120, 100, 82], clamp(peb, 0, 1));
    return col.map(q => clamp(q));
  });
  paint(grass, (u, v) => {
    const n = fbm(u * 8, v * 8, 5, 8), n2 = fbm(u * 128, v * 128, 2, 128);
    const dry = fbm(u * 4 + 3, v * 4, 4, 4);
    let col = mixc([72, 96, 40], [150, 136, 74], clamp((dry - 0.4) * 2.5, 0, 1));
    col = col.map(q => q * (0.7 + n * 0.35 + (n2 - 0.5) * 0.35));
    return col.map(q => clamp(q));
  });
  return { dirt: finish(dirt), grass: finish(grass) };
}

// Leaf card atlas: cluster of leaves on transparent background
export function leafTex({ size = 256, seed = 23, hue = [70, 110, 40], dryness = 0.15 } = {}) {
  const r = rng(seed); const c = canvas(size); const g = c.getContext('2d');
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
export function inscriptionTex({ w = 1024, h = 1024, base = [214, 172, 124], seed = 29 } = {}) {
  const r = rng(seed); const s = stoneTex({ size: 256, base, polish: true, seed });
  const c = canvas(w, h); const g = c.getContext('2d');
  g.drawImage(s.map.image, 0, 0, w, h);
  g.strokeStyle = 'rgba(96,58,32,0.5)'; g.lineWidth = 1.5; g.lineCap = 'round';
  const lineH = 26;
  for (let y = 60; y < h - 120; y += lineH) {
    let x = 30 + r() * 10;
    while (x < w - 40) {
      // one glyph: combination of vertical, hook, circle, cross strokes
      const gw = 10 + r() * 6; g.beginPath();
      const kind = Math.floor(r() * 6);
      if (kind === 0) { g.moveTo(x + gw / 2, y); g.lineTo(x + gw / 2, y + 16); g.moveTo(x, y + 6); g.lineTo(x + gw, y + 6); }
      else if (kind === 1) { g.arc(x + gw / 2, y + 8, gw / 2.4, 0, Math.PI * 2); }
      else if (kind === 2) { g.moveTo(x, y); g.lineTo(x + gw / 2, y + 16); g.lineTo(x + gw, y); }
      else if (kind === 3) { g.moveTo(x, y + 16); g.lineTo(x, y); g.lineTo(x + gw, y); g.lineTo(x + gw, y + 10); }
      else if (kind === 4) { g.moveTo(x + gw / 2, y); g.lineTo(x + gw / 2, y + 16); g.arc(x + gw / 2 + 3, y + 12, 3, Math.PI, 0); }
      else { g.moveTo(x, y + 8); g.lineTo(x + gw, y + 8); g.moveTo(x + gw / 3, y); g.lineTo(x + gw / 3, y + 16); }
      if (r() < 0.3) { g.moveTo(x + gw / 2, y - 3); g.lineTo(x + gw / 2 + 4, y - 6); } // vowel mark
      g.stroke(); x += gw + 5 + r() * 4; if (r() < 0.08) x += 12;
    }
  }
  const t = finish(c); t.wrapS = THREE.RepeatWrapping; return t;
}

// Dharma chakra emblem (for banners / capital abacus)
export function chakraTex({ size = 512, bg = [214, 178, 70], fg = [120, 40, 30], cloth = true } = {}) {
  const c = canvas(size); const g = c.getContext('2d');
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
