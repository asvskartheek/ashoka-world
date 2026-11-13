import * as THREE from 'three';
import * as T from './textures.js';

// ---------------------------------------------------------------------------------------------
// Shader patching. Every patched material keeps its config in mat.userData.patch and gets one
// onBeforeCompile built from it, so worldUV() and weather() compose in any order.
// ---------------------------------------------------------------------------------------------
const WX_NOISE = () => T.weatherNoise();
// debug view: ?wxdbg=1 paints (macro, streak, dust) into the albedo, ?wxdbg=2 paints the cavity term
const WX_DBG = typeof location !== 'undefined' ? +(new URLSearchParams(location.search).get('wxdbg') || 0) : 0;

// Box-projected world-space UVs (works with InstancedMesh): no stretching on scaled instances.
// Texture "up" follows world up on walls. Applies to map, bump, normal and roughness maps.
// opts.grime = { h, amt, col }: darken the lowest h metres of each instance (splash-back grime / rising damp).
export function worldUV(mat, scale = 0.5, opts = {}) {
  const P = (mat.userData.patch ||= {});
  P.wuv = scale; P.grime = opts.grime || null;
  return installPatch(mat);
}

// Weathering layer (world space, so it differs per building and per instance):
//   macro  albedo multiplier amplitude from 3-20 m noise + a per-instance hash (0.0-0.3)
//   rough  roughness variation amplitude (adds, follows macro)
//   dust   { h: band height m (0.3-1.2 after noise), amt, col: linear rgb } warm splash band at the base of each wall column
//   streak darkening amplitude of vertical rain streaks hanging below the top of each wall column (eaves, sills)
//   cav    cavity darkening from the material's own height texture (opts.height or mat.bumpMap)
//   detail { amt, scale } fine box-projected detail bump (one fetch + screen derivatives)
// Geometry gets a per-vertex attribute aWx = (metres below the top, metres above the bottom) of its xz column,
// added lazily the first time a mesh draws with the material.
export function weather(mat, o = {}) {
  const P = (mat.userData.patch ||= {});
  P.wx = { macro: 0.18, rough: 0.08, dust: { h: 0.8, amt: 0.45, col: [0.40, 0.31, 0.21] }, streak: 0.3, cav: 0.35, detail: null, height: null, tint: 1, ...o };
  if (o.dust !== undefined) P.wx.dust = o.dust && { h: 0.8, amt: 0.45, col: [0.40, 0.31, 0.21], ...o.dust };
  mat.onBeforeRender = wxOnBeforeRender;
  return installPatch(mat);
}

// per-vertex column extents: (top - y, y - bottom) + 1 in local units; 0 = unknown (attribute not bound yet).
// three caches a VAO per geometry+program, so the attribute must never appear in the middle of a frame (nested
// renders such as reflections included): geometries met in a draw are queued, and the queue (plus, once, every
// weathered geometry in the scene) is attached at the start of the next outermost scene render, before projection
// uploads buffers.
const wxQueue = new Set();
function wxAttach(geometry) {
  if (geometry && !geometry.attributes.aWx && geometry.attributes.position) geometry.setAttribute('aWx', wxColumns(geometry.attributes.position));
}
const wxIsMat = (m) => !!(m && m.userData && m.userData.patch && m.userData.patch.wx);
function wxHookScene(scene) {
  if (!scene || !scene.isScene || scene.userData.wxHooked) return;
  scene.userData.wxHooked = true; let depth = 1, first = true; // hooked from inside a draw of this scene
  const pb = scene.onBeforeRender, pa = scene.onAfterRender;
  scene.onBeforeRender = function (...a) {
    if (depth++ === 0) {
      if (first) { first = false; scene.traverse((o) => { if (o.isMesh && [].concat(o.material).some(wxIsMat)) wxAttach(o.geometry); }); }
      for (const g of wxQueue) wxAttach(g); wxQueue.clear();
    }
    return pb.apply(this, a);
  };
  scene.onAfterRender = function (...a) { depth = Math.max(0, depth - 1); return pa.apply(this, a); };
}
function wxOnBeforeRender(renderer, scene, camera, geometry) {
  wxHookScene(scene);
  if (geometry && !geometry.attributes.aWx) wxQueue.add(geometry);
}
function wxColumns(pos, cell = 0.6) {
  const n = pos.count, key = new Int32Array(n), top = new Map(), bot = new Map();
  for (let i = 0; i < n; i++) {
    const k = (Math.floor(pos.getX(i) / cell) * 73856093) ^ (Math.floor(pos.getZ(i) / cell) * 19349663); key[i] = k;
    const y = pos.getY(i); const t = top.get(k); if (t === undefined || y > t) top.set(k, y); const b = bot.get(k); if (b === undefined || y < b) bot.set(k, y);
  }
  const a = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const y = pos.getY(i); a[i * 2] = top.get(key[i]) - y + 1; a[i * 2 + 1] = y - bot.get(key[i]) + 1; }
  return new THREE.BufferAttribute(a, 2);
}

const WX_GLSL_COMMON = `
uniform sampler2D tWx;
uniform vec4 uWx0; // macro, dust h, dust amt, streak
uniform vec4 uWx1; // cavity, detail amt, detail scale, rough
uniform vec3 uWxDust;
uniform float uWxTint;
uniform vec4 uWxPatch; // rgb multiplier, threshold
varying vec3 vWxP; varying vec3 vWxN; varying vec3 vWxO; varying vec3 vWxC; // C = (m below top, m above bottom, known)
`;

function installPatch(mat) {
  const P = mat.userData.patch, gr = P.grime, wx = P.wx, wuv = P.wuv;
  const hasWuv = wuv !== undefined && wuv !== null;
  mat.onBeforeCompile = (sh) => {
    let vpre = '', fpre = '', vbody = '';
    if (hasWuv) { sh.uniforms.uWuvScale = { value: wuv }; vpre += 'uniform float uWuvScale;\n'; }
    if (gr) { vpre += 'varying float vGrimeY;\nvarying vec3 vGrimeP;\n'; sh.uniforms.uGrime = { value: new THREE.Vector4(gr.h, gr.amt, 0, 0) }; sh.uniforms.uGrimeCol = { value: new THREE.Color(...(gr.col || [0.42, 0.36, 0.3])) }; }
    if (wx) {
      const H = wx.height || mat.bumpMap;
      Object.assign(sh.uniforms, {
        tWx: { value: WX_NOISE() },
        uWx0: { value: new THREE.Vector4(wx.macro, wx.dust ? wx.dust.h : 0, wx.dust ? wx.dust.amt : 0, wx.streak) },
        uWx1: { value: new THREE.Vector4(H ? wx.cav : 0, wx.detail ? wx.detail.amt : 0, wx.detail ? wx.detail.scale : 1, wx.rough) },
        uWxDust: { value: new THREE.Vector3(...(wx.dust ? wx.dust.col : [0, 0, 0])) },
        uWxTint: { value: wx.tint },
        uWxPatch: { value: new THREE.Vector4(...(wx.patch ? [...wx.patch.col, wx.patch.thr] : [1, 1, 1, 2])) },
      });
      if (H) sh.uniforms.tWxH = { value: H };
      vpre += WX_GLSL_COMMON + 'attribute vec2 aWx;\n';
    }
    vbody += `
      mat4 wm = modelMatrix;
      #ifdef USE_INSTANCING
        wm = modelMatrix * instanceMatrix;
      #endif
      vec3 wp = (wm * vec4(transformed, 1.0)).xyz;`;
    if (hasWuv) vbody += `
      vec3 wn = abs(normalize(mat3(wm) * objectNormal));
      vec2 wuv = wn.y > max(wn.x, wn.z) ? wp.xz : (wn.x > wn.z ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y));
      wuv *= uWuvScale;
      #ifdef USE_MAP
        vMapUv = wuv;
      #endif
      #ifdef USE_BUMPMAP
        vBumpMapUv = wuv;
      #endif
      #ifdef USE_NORMALMAP
        vNormalMapUv = wuv;
      #endif
      #ifdef USE_ROUGHNESSMAP
        vRoughnessMapUv = wuv;
      #endif
      #ifdef USE_AOMAP
        vAoMapUv = wuv;
      #endif`;
    if (gr) vbody += '\n      vGrimeY = wp.y - (wm * vec4(0.0, 0.0, 0.0, 1.0)).y; vGrimeP = wp;';
    if (wx) vbody += `
      vWxP = wp; vWxN = normalize(mat3(wm) * objectNormal); vWxO = (wm * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      float wsy = length(wm[1].xyz);
      vWxC = vec3((aWx - 1.0) * wsy, step(0.5, aWx.x));`;
    sh.vertexShader = vpre + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>\n      {${vbody}\n      }`);

    let fs = sh.fragmentShader;
    if (gr) {
      fpre += 'uniform vec4 uGrime;\nuniform vec3 uGrimeCol;\nvarying float vGrimeY;\nvarying vec3 vGrimeP;\n' +
        'float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
        'float gNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }\n';
      fs = fs.replace('#include <map_fragment>', `#include <map_fragment>
        {
          float hz = vGrimeP.x + vGrimeP.z;
          float gn = gNoise(vec2(hz * 1.3, 0.0)) * 0.6 + gNoise(vec2(hz * 5.0, vGrimeP.y * 3.0)) * 0.4;
          float gy = vGrimeY - (gn - 0.5) * uGrime.x * 0.9;
          float g = 1.0 - smoothstep(0.0, uGrime.x, gy);
          float tide = exp(-pow((gy - uGrime.x * 0.95) / (uGrime.x * 0.12), 2.0)) * 0.35;
          diffuseColor.rgb *= mix(vec3(1.0), uGrimeCol, clamp(g * g * uGrime.y + tide * uGrime.y, 0.0, 1.0));
        }`);
    }
    if (wx) {
      const H = !!(wx.height || mat.bumpMap);
      fpre += WX_GLSL_COMMON + (H ? 'uniform sampler2D tWxH;\n#define WX_CAV\n' : '') + (wx.detail ? '#define WX_DETAIL\n' : '') + (wx.patch ? '#define WX_PATCH\n' : '') + `
float wxMacro = 0.0, wxDust = 0.0, wxStreak = 0.0, wxCav = 0.0;
vec3 wxPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float fd) {
  vec3 sx = normalize(dFdx(surf_pos)), sy = normalize(dFdy(surf_pos));
  vec3 r1 = cross(sy, surf_norm), r2 = cross(surf_norm, sx);
  float det = dot(sx, r1) * fd;
  vec3 g = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surf_norm - g);
}
`;
      // albedo: after map + instance colour
      fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 P = vWxP; vec3 N = normalize(vWxN);
          float ih = fract(sin(dot(floor(vWxO.xz * 0.5) + 0.37, vec2(12.9898, 78.233))) * 43758.5453);
          vec2 mp = vec2(P.x + P.z * 0.31 + P.y * 0.23, P.z - P.x * 0.27 + P.y * 0.61);
          float m1 = texture2D(tWx, mp * (1.0 / 19.0)).r, m2 = texture2D(tWx, mp * (1.0 / 6.3) + 0.37).g, m3 = texture2D(tWx, mp * (1.0 / 2.9) + 0.71).r;
          wxMacro = (m1 - 0.5) * 1.0 + (m2 - 0.5) * 0.7 + (m3 - 0.5) * 0.35 + (ih - 0.5) * 0.6;
          vec3 c = diffuseColor.rgb;
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          // brighter patches read sun-bleached (slightly greyer), darker ones damp and warmer
          c *= 1.0 + uWx0.x * wxMacro;
          // independent warm/cool drift (ochre wash vs grey lime), mean-neutral
          float m4 = texture2D(tWx, mp * (1.0 / 11.0) + 0.53).g;
          c *= 1.0 + vec3(0.07, 0.0, -0.12) * ((m4 - 0.5) * 6.0 * uWx0.x * uWxTint);
          c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), clamp(wxMacro * uWx0.x * 1.2 * uWxTint, -0.25, 0.25));
          #ifdef WX_PATCH
            // blotches of soot / age (roofs): thresholded 1-4 m noise with a ragged edge
            float pm = texture2D(tWx, mp * (1.0 / 4.3) + 0.19).r * 0.7 + texture2D(tWx, mp * (1.0 / 1.1) + 0.61).b * 0.3;
            c *= mix(vec3(1.0), uWxPatch.rgb, smoothstep(uWxPatch.w, uWxPatch.w + 0.14, pm));
          #endif
          // cavity: local height below its blurred neighbourhood
          #if defined(WX_CAV) && defined(USE_MAP)
            float hh = texture2D(tWxH, vMapUv).r, hb = textureLod(tWxH, vMapUv, 4.0).r;
            wxCav = clamp((hb - hh) * 3.0, -1.0, 1.0);
            c *= 1.0 - uWx1.x * max(wxCav, 0.0) + uWx1.x * 0.25 * max(-wxCav, 0.0);
          #endif
          // eave / sill streaks hanging below the top of each wall column
          float vert = 1.0 - smoothstep(0.3, 0.65, abs(N.y));
          vec2 tdir = normalize(vec2(-N.z, N.x) + 1e-4);
          float hc = dot(P.xz, tdir);
          float s1 = texture2D(tWx, vec2(hc * 0.11, P.y * 0.03)).a * 0.65 + texture2D(tWx, vec2(hc * 0.29 + 0.4, P.y * 0.05)).a * 0.35;
          float s2 = texture2D(tWx, vec2(hc * 0.07 + 0.5, 0.21)).g;
          float slen = 0.8 + 3.5 * s2;
          float below = vWxC.x;
          float fall = vWxC.z * (exp(-below / slen) * smoothstep(0.35, 0.7, s1) + exp(-below / 0.35) * 0.5);
          fall += 0.25 * smoothstep(0.5, 0.8, s1) * smoothstep(0.35, 0.7, s2); // general rain wash
          wxStreak = clamp(uWx0.w * vert * fall, 0.0, 0.85);
          c = mix(c, c * vec3(0.52, 0.48, 0.44), wxStreak);
          // dust and splash band at the base of each column (only for columns standing near the instance base)
          if (uWx0.z > 0.0) {
            float hcol = vWxC.y;
            float base = (P.y - hcol) - vWxO.y;
            float gate = vWxC.z * (1.0 - smoothstep(1.0, 2.2, base)) * (1.0 - smoothstep(0.5, 0.9, N.y));
            float hz = P.x + P.z;
            float e = texture2D(tWx, vec2(hz * 0.21, 0.13)).r * 0.6 + texture2D(tWx, vec2(hz * 0.9, P.y * 0.6)).b * 0.4;
            float dh = uWx0.y * (0.45 + 1.1 * e);
            float sp = texture2D(tWx, vec2(hz, P.y) * 2.3).b;
            wxDust = (1.0 - smoothstep(dh * 0.35, dh, hcol + (sp - 0.5) * 0.25)) * gate;
            vec3 dc = uWxDust * (0.9 + 0.2 * e);
            c = mix(c, dc, wxDust * uWx0.z);
          }
          diffuseColor.rgb = c;
          ${WX_DBG === 1 ? 'diffuseColor.rgb = vec3(wxMacro * 0.8 + 0.5, wxStreak * 2.0, wxDust);' : ''}
          ${WX_DBG === 2 ? 'diffuseColor.rgb = vec3(max(wxCav, 0.0), max(-wxCav, 0.0), vWxC.z);' : ''}
        }`);
      fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * (1.0 + uWx1.w * wxMacro) + wxDust * uWx0.z * 0.35 + wxStreak * 0.1 + max(wxCav, 0.0) * uWx1.x * 0.2, 0.04, 1.0);`);
      fs = fs.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        #ifdef WX_DETAIL
        {
          vec3 an = abs(vWxN);
          vec2 duv = an.y > max(an.x, an.z) ? vWxP.xz : (an.x > an.z ? vWxP.zy : vWxP.xy);
          float hd = texture2D(tWx, duv * uWx1.z).b * 0.65 + texture2D(tWx, duv * uWx1.z * 3.7 + 0.3).b * 0.35;
          normal = wxPerturb(-vViewPosition, normal, vec2(dFdx(hd), dFdy(hd)) * uWx1.y, faceDirection);
        }
        #endif`);
    }
    sh.fragmentShader = fpre + fs;
  };
  const key = 'p' + (hasWuv ? 'w' + wuv : '') + (gr ? 'g' + gr.h + '_' + gr.amt : '') + (wx ? 'x' + (wx.height || mat.bumpMap ? 'c' : '') + (wx.detail ? 'd' : '') + (wx.patch ? 'p' : '') : '');
  mat.customProgramCacheKey = () => key;
  return mat;
}

const rep = (mat, x, y) => { for (const k of ['map', 'normalMap', 'roughnessMap', 'bumpMap']) if (mat[k]) mat[k].repeat.set(x, y); return mat; };

// weathering presets
const WX_ROOFPATCH = { col: [0.66, 0.62, 0.6], thr: 0.58 };
const WX_PLASTER = { macro: 0.3, rough: 0.1, streak: 0.75, cav: 0.5, dust: { h: 0.9, amt: 0.55 }, detail: { amt: 1.2, scale: 1.3 } };
const WX_STONE = { macro: 0.2, rough: 0.12, streak: 0.5, cav: 0.5, dust: { h: 0.6, amt: 0.4 }, detail: { amt: 0.8, scale: 2.0 } };

export function buildMaterials() {
  const M = {};
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const V = (x, y = x) => new THREE.Vector2(x, y);
  const pbr = (t, ns = 1, o = {}) => ({ map: t.map, normalMap: t.normal, normalScale: V(ns), roughnessMap: t.rough, roughness: 1, ...o });

  // --- brick: irregular courses, warm brown-orange per-brick variation, recessed mortar
  const brick = T.brickWall({ size: 512, rows: 16, cols: 6, seed: 3, lime: 0.25, dark: 0.55 });
  M.brick = weather(worldUV(std(pbr(brick, 1.1)), 0.45, { grime: { h: 0.9, amt: 0.5 } }), { macro: 0.22, streak: 0.55, cav: 0.4, height: brick.bump, dust: { h: 0.7, amt: 0.4 } });
  const brickPale = T.brickWall({ size: 512, rows: 16, cols: 6, seed: 31, pal: [[176, 114, 76], [196, 138, 96], [184, 124, 86], [158, 98, 64]], mortar: [196, 180, 152], lime: 0.6, dark: 0.4 });
  M.brickPale = weather(worldUV(std(pbr(brickPale, 1.1)), 0.45, { grime: { h: 0.9, amt: 0.45 } }), { macro: 0.22, streak: 0.55, cav: 0.4, height: brickPale.bump, dust: { h: 0.7, amt: 0.4 } });
  const stupaBrick = T.brickWall({ size: 1024, rows: 30, cols: 9, seed: 33, pal: [[150, 80, 48], [176, 100, 62], [190, 120, 78], [164, 94, 60]], mortar: [194, 174, 144], lime: 0.35, dark: 0.6 });
  M.stupaBrick = std(pbr(stupaBrick, 1.2));

  // --- wood
  const logs = T.barkTex({ seed: 5 });
  M.log = weather(rep(std(pbr(logs, 1.4)), 1, 3), { macro: 0.22, streak: 0.3, cav: 0.4, height: logs.bump, dust: { h: 0.6, amt: 0.35 } });
  const timber = T.grainWood({ w: 512, h: 512, rings: 9, weather: 1, knots: 3, dark: [56, 38, 24], mid: [112, 80, 54], light: [152, 116, 80], seed: 6 });
  M.timber = weather(worldUV(std(pbr(timber, 1.0)), 0.6), { macro: 0.25, streak: 0.4, cav: 0.4, height: timber.bump, dust: { h: 0.5, amt: 0.3 } });
  M.timberUV = std(pbr(timber, 1.0));
  const teak = T.grainWood({ w: 512, h: 1024, rings: 20, flutes: 12, polish: true, dark: [70, 28, 12], mid: [142, 66, 28], light: [196, 112, 54], seed: 7 });
  M.polishedWood = weather(rep(phys(pbr(teak, 0.9, { clearcoat: 0.6, clearcoatRoughness: 0.16, metalness: 0.0 })), 2, 3), { macro: 0.06, rough: 0.15, streak: 0.05, cav: 0.15, height: teak.bump, tint: 0, dust: { h: 0.4, amt: 0.15 } });
  const carved = T.grainWood({ w: 512, h: 512, rings: 12, horiz: true, carve: true, polish: true, dark: [52, 22, 10], mid: [110, 50, 24], light: [160, 86, 42], seed: 8 });
  M.carvedWood = worldUV(phys(pbr(carved, 1.1, { clearcoat: 0.35, clearcoatRoughness: 0.3 })), 1.2);

  // --- roofs
  const thatch = T.thatchLayered({});
  M.thatch = weather(std({ map: thatch.map, color: 0xd2c2a6, normalMap: thatch.normal, normalScale: V(1.6), roughness: 1 }), { macro: 0.28, streak: 0, cav: 0.4, height: thatch.bump, dust: null, patch: { col: [0.7, 0.68, 0.66], thr: 0.6 } });
  const tilesRed = T.barrelTiles({ base: [160, 86, 58], seed: 12, moss: 0.5 });
  M.roofTilesRed = weather(std(pbr(tilesRed, 1.3)), { macro: 0.3, rough: 0.1, streak: 0, cav: 0.5, height: tilesRed.bump, dust: null, patch: WX_ROOFPATCH });
  const tilesMap = T.tinted(tilesRed.map, [0.74, 0.86, 0.95]);
  M.roofTiles = weather(std({ ...pbr(tilesRed, 1.3), map: tilesMap, side: THREE.DoubleSide }), { macro: 0.3, rough: 0.1, streak: 0, cav: 0.5, height: tilesRed.bump, dust: null, patch: WX_ROOFPATCH });

  // --- stone
  const sand = T.sandstoneTex({ size: 512, base: [214, 160, 104], seed: 13 });
  M.polishedSandstone = rep(phys(pbr(sand, 0.5, { clearcoat: 0.35, clearcoatRoughness: 0.22 })), 1, 3);
  const sandRough = T.stoneTex({ base: [200, 182, 150], seed: 14, blocks: 4 });
  M.stone = weather(worldUV(std({ map: sandRough.map, bumpMap: sandRough.bump, bumpScale: 1.5, roughness: 0.9 }), 0.4), { ...WX_STONE });
  const marble = T.stoneTex({ base: [214, 204, 186], seed: 15, blocks: 2 });
  M.paleStone = weather(worldUV(std({ map: marble.map, bumpMap: marble.bump, bumpScale: 1, roughness: 0.6, color: 0xddd0bc }), 0.35), { ...WX_STONE, macro: 0.1, streak: 0.22, cav: 0.3, detail: { amt: 0.45, scale: 2.0 } });
  M.weatheredStone = weather(worldUV(std({ map: marble.map, bumpMap: marble.bump, bumpScale: 1.2, roughness: 0.85, color: 0xcabba4 }), 0.35), { ...WX_STONE, macro: 0.18, streak: 0.4 });
  const baseSt = T.stoneTex({ base: [196, 184, 162], seed: 41 });
  M.baseStone = weather(worldUV(std({ map: baseSt.map, bumpMap: baseSt.bump, bumpScale: 2, roughness: 0.8 }), 0.5), { ...WX_STONE });
  const rock = T.stoneTex({ base: [128, 118, 104], seed: 16 });
  M.rock = worldUV(std({ map: rock.map, bumpMap: rock.bump, bumpScale: 5, roughness: 0.95, color: 0xd6c8b4 }), 0.35);
  const pinkStone = T.stoneTex({ base: [196, 140, 108], seed: 18, polish: true });
  M.pinkStone = worldUV(std({ map: pinkStone.map, bumpMap: pinkStone.bump, bumpScale: 0.6, roughness: 0.5 }), 0.5);

  // --- weathered lime plaster (pink variant shares the pattern)
  const plaster = T.plasterWall({ base: [222, 200, 170], seed: 17 });
  M.plaster = weather(worldUV(std(pbr(plaster, 0.9)), 0.22, { grime: { h: 1.1, amt: 0.55 } }), { ...WX_PLASTER, height: plaster.bump });
  M.plasterPink = weather(worldUV(std({ ...pbr(plaster, 0.9), map: T.tinted(plaster.map, [1.0, 0.93, 0.9]) }), 0.22, { grime: { h: 1.1, amt: 0.55 } }), { ...WX_PLASTER, height: plaster.bump });
  M.trimRed = std({ color: 0x8a4a36, roughness: 0.9 });
  M.mud = weather(worldUV(std({ map: plaster.map, color: 0xb88a62, roughness: 1 }), 0.3), { ...WX_PLASTER, macro: 0.22, height: plaster.bump, dust: { h: 1.0, amt: 0.5 } });

  const floor = T.floorTex({});
  M.hallFloor = std({ map: floor.map, roughnessMap: floor.rough, roughness: 1, metalness: 0.0, color: 0xd9b48c });
  M.hallFloor.envMapIntensity = 0.35; M.hallFloor.map.repeat.set(7, 7); M.hallFloor.roughnessMap.repeat.set(7, 7);

  M.cloth = T.clothTex({});
  const mkCloth = (color, extra = {}) => std({ color, map: M.cloth, roughness: 0.9, ...extra });
  M.clothWhite = mkCloth(0xe8dfcc); M.clothSaffron = mkCloth(0xc8641e); M.clothMaroon = mkCloth(0x7a2420);
  M.clothRed = mkCloth(0xa02a24); M.clothGold = mkCloth(0xd4a038);
  M.skin = std({ color: 0x8a5a3c, roughness: 0.6 });
  M.hair = std({ color: 0x15100c, roughness: 0.7 });
  M.gold = std({ color: 0xd8a84a, metalness: 1, roughness: 0.3 });
  M.bronze = std({ color: 0x9a7040, metalness: 1, roughness: 0.42 });
  M.iron = std({ color: 0x55555a, metalness: 0.9, roughness: 0.5 });
  M.dark = std({ color: 0x14100c, roughness: 1 });
  M.elephant = std({ color: 0x5a5550, roughness: 0.95, bumpMap: rock.bump, bumpScale: 2 });
  M.ox = std({ color: 0xe6e0d6, roughness: 0.85 });
  M.horn = std({ color: 0x3a3028, roughness: 0.6 });
  M.ivory = std({ color: 0xeee6d0, roughness: 0.4 });
  M.straw = std({ color: 0xc8a868, map: thatch.map, roughness: 1 });
  M.sack = std({ color: 0xc8b088, map: M.cloth, roughness: 1 });
  M.banner = std({ map: T.chakraTex({}), roughness: 0.85, side: THREE.DoubleSide });
  M.bannerWhite = std({ map: T.chakraTex({ bg: [236, 228, 210], fg: [200, 150, 40] }), roughness: 0.85, side: THREE.DoubleSide });
  M.bannerHall = std({ map: T.chakraTex({ bg: [232, 216, 186], fg: [140, 40, 36] }), roughness: 0.85, side: THREE.DoubleSide });
  const inscr = T.inscriptionTex({ bg: sand.map.image });
  M.inscription = phys({ map: inscr, bumpMap: inscr.userData.bump, bumpScale: 1.2, roughnessMap: sand.rough, roughness: 1, clearcoat: 0.35, clearcoatRoughness: 0.22 });
  M.fabric = (c) => std({ color: c, map: M.cloth, roughness: 0.9, side: THREE.DoubleSide });

  const leaf = T.leafTex({});
  M.leaves = std({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: 0xffffff });
  const leaf2 = T.leafTex({ hue: [60, 92, 36], seed: 24, dryness: 0.05 });
  M.leavesDark = std({ map: leaf2, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
  M.bark = std({ map: logs.map, color: 0xa09080, normalMap: logs.normal, normalScale: V(1.4), roughness: 1 });
  M.foliageBlob = std({ color: 0x4f6a2c, roughness: 0.9 }); // far LOD canopy

  M.waterNormals = T.waterNormals({});
  M.ground = T.groundDetail({});
  return M;
}
