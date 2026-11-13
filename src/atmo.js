// Photographic atmosphere + lens post passes (linear HDR, before bloom / tone mapping).
//   DepthGrabPass : right after RenderPass, converts the scene depth (all opaque + alpha-tested geometry,
//                   foliage included) into a float view-distance target; sky stays at 1e7.
//   AtmoPass      : height fog with analytic sun in-scatter (Henyey-Greenstein forward lobe tinted by the
//                   sun colour, isotropic part tinted by the horizon) + depth-masked radial god rays.
//   LensPass      : halation (wide red-biased glow on highlights) + large-radius local contrast,
//                   from one blur pyramid (rgb = bright pass, alpha = log luminance).
// Parameters come per shot from SHOTS[n].atmo (shots.js); the shot is identified from the camera position
// because main.js does not pass the shot to the composer. Missing keys fall back to ATMO_DEFAULTS.
import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { SHOTS } from './shots.js';

export const ATMO_DEFAULTS = {
  // height fog: extinction(y) = density * exp(-falloff * (y - base)) + floor   [per metre]
  density: 0.0002, falloff: 0.01, base: 0, floor: 0.0,
  ext: [1, 1, 1],          // per-channel extinction scale (blue > red = aerial perspective)
  amb: null,               // isotropic in-scatter colour (hex); null = mix of scene fog colour and sky horizon
  ambMix: 0.5,             // 0 = scene.fog.color, 1 = sky horizon * sky intensity
  ambK: 1.0,               // isotropic in-scatter gain
  sunK: 0.06,              // sun in-scatter gain (phase is normalised so isotropic = 1)
  g: 0.75,                 // HG anisotropy of the sun lobe
  g2: 0.3, lobe2: 0.4,     // a second, wider forward lobe (weight relative to the first)
  skyFog: 0.35,            // fog applied to sky pixels (horizon haze), as a fraction
  skySun: 0.5,             // sun-lobe scale on sky pixels
  skyDist: 6000,           // ray length used for sky pixels
  maxDist: 12000,
  // god rays (applied only when the sun is on screen or within `raysMargin` of it, in uv)
  rays: 0, raysDecay: 0.965, raysLen: 0.9, raysThr: 0.6, raysSpread: 0.35, raysMargin: 0.25, raysDepth: 0.98,
  // halation + local contrast
  hal: 0.0, halThr: 1.2, halTint: [1.0, 0.42, 0.18],
  lc: 0.0, lcClamp: 0.6,
  // display-referred grade additions (applied in the existing grade pass)
  shadowTint: [0, 0, 0], highTint: [0, 0, 0],
};

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const mat = (uniforms, fs) => new THREE.ShaderMaterial({ uniforms, vertexShader: VS, fragmentShader: fs, depthTest: false, depthWrite: false, blending: THREE.NoBlending });
const v3 = (a) => new THREE.Vector3(...a);
const LUM = 'const vec3 LW = vec3(0.2126, 0.7152, 0.0722);';

globalThis.__SHOTS = SHOTS; // debug/tuning hook: lets a harness edit presets live

export function shotAtmo(camera) {
  let best = null, bd = 60;
  for (const k in SHOTS) {
    const S = SHOTS[k]; const d = Math.hypot(camera.position.x - S.pos[0], camera.position.z - S.pos[2]);
    if (d < bd) { bd = d; best = S; }
  }
  return { ...ATMO_DEFAULTS, ...(best?.atmo || {}) };
}

function findSky(scene) {
  let sky = null;
  scene.traverse((o) => { if (!sky && o.material?.uniforms?.sunPosition && o.material.uniforms.horizon) sky = o; });
  return sky;
}

// ---------------- depth -> view distance ----------------
export class DepthGrabPass extends Pass {
  constructor(camera, w, h) {
    super(); this.needsSwap = false; this.camera = camera;
    this.target = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false });
    this.material = mat({ tDepth: { value: null }, projInv: { value: new THREE.Matrix4() } }, `
      uniform sampler2D tDepth; uniform mat4 projInv; varying vec2 vUv;
      void main(){
        float d = texture2D(tDepth, vUv).x;
        vec4 v = projInv * vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); v.xyz /= v.w;
        gl_FragColor = vec4(d >= 0.999999 ? 1e7 : length(v.xyz), 0.0, 0.0, 1.0);
      }`);
    this.fsQuad = new FullScreenQuad(this.material);
  }
  setSize(w, h) { this.target.setSize(w, h); }
  render(renderer, writeBuffer, readBuffer) {
    if (!readBuffer.depthTexture) return;
    this.material.uniforms.tDepth.value = readBuffer.depthTexture;
    this.material.uniforms.projInv.value.copy(this.camera.projectionMatrixInverse);
    renderer.setRenderTarget(this.target); this.fsQuad.render(renderer);
  }
}

// ---------------- fog + in-scatter + god rays ----------------
export class AtmoPass extends Pass {
  constructor(scene, camera, depthPass, grade, w, h) {
    super(); this.scene = scene; this.camera = camera; this.depthPass = depthPass; this.grade = grade;
    this.rt = new THREE.WebGLRenderTarget(Math.ceil(w / 4), Math.ceil(h / 4), { type: THREE.HalfFloatType, depthBuffer: false });
    const common = { tColor: { value: null }, tDist: { value: null }, projInv: { value: new THREE.Matrix4() }, camWorld: { value: new THREE.Matrix4() }, camPos: { value: new THREE.Vector3() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color() } };
    this.raysMat = mat({ ...common, sunUv: { value: new THREE.Vector2() }, aspect: { value: w / h }, decay: { value: 0.96 }, len: { value: 0.9 }, thr: { value: 0.6 }, spread: { value: 0.35 }, depthCut: { value: 0.98 } }, `
      uniform sampler2D tColor, tDist; uniform vec2 sunUv; uniform float aspect, decay, len, thr, spread, depthCut; varying vec2 vUv; ${LUM}
      float m(vec2 uv){
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
        float sky = step(1e6 * depthCut, texture2D(tDist, uv).x);
        vec2 q = (uv - sunUv) * vec2(aspect, 1.0);
        float l = dot(texture2D(tColor, uv).rgb, LW);
        return sky * max(l - thr, 0.0) * exp(-dot(q, q) / (spread * spread));
      }
      void main(){
        const int N = 72;
        vec2 dl = (vUv - sunUv) * len / float(N);
        vec2 uv = vUv; float w = 1.0, s = 0.0, wsum = 0.0;
        float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        uv -= dl * jit;
        for (int i = 0; i < N; i++) { s += m(uv) * w; wsum += w; w *= decay; uv -= dl; }
        gl_FragColor = vec4(vec3(s / max(wsum, 1e-3)), 1.0);
      }`);
    this.mat = mat({ ...common, tRays: { value: this.rt.texture }, rays: { value: 0 },
      density: { value: 0 }, falloff: { value: 0.01 }, base: { value: 0 }, floorD: { value: 0 }, ext: { value: new THREE.Vector3(1, 1, 1) },
      amb: { value: new THREE.Color() }, sunK: { value: 0 }, g: { value: 0.75 }, g2: { value: 0.3 }, lobe2: { value: 0.4 }, skyFog: { value: 0.35 }, skySun: { value: 0.5 }, skyDist: { value: 6000 }, maxDist: { value: 12000 } }, `
      uniform sampler2D tColor, tDist, tRays; uniform mat4 projInv, camWorld; uniform vec3 camPos, sunDir, sunCol, ext, amb;
      uniform float skySun, rays, density, falloff, base, floorD, sunK, g, g2, lobe2, skyFog, skyDist, maxDist; varying vec2 vUv;
      float hg(float mu, float g){ float k = 1.0 + g * g - 2.0 * g * mu; return (1.0 - g * g) / (k * sqrt(k)); }
      void main(){
        vec3 c = texture2D(tColor, vUv).rgb;
        float dist = texture2D(tDist, vUv).x;
        bool isSky = dist > 1e6;
        vec4 v = projInv * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec3 rd = normalize((camWorld * vec4(normalize(v.xyz / v.w), 0.0)).xyz);
        float t = isSky ? skyDist : min(dist, maxDist);
        // analytic optical depth of exponential height fog along the ray
        float x = falloff * rd.y * t;
        float f = abs(x) < 1e-4 ? 1.0 - 0.5 * x : (1.0 - exp(-x)) / x;
        float tau = density * exp(-falloff * (camPos.y - base)) * f * t;
        // sky pixels: only the height-fog part (horizon haze), scaled; the sky shader already draws the sun glow
        if (isSky) tau *= skyFog; else tau += floorD * t;
        vec3 T = exp(-tau * ext);
        float mu = dot(rd, sunDir);
        float ph = (hg(mu, g) + lobe2 * hg(mu, g2)) / (1.0 + lobe2);
        // the sun lobe fades when the sun sinks below the horizon line of the ray
        vec3 Lin = amb + sunCol * sunK * (isSky ? skySun : 1.0) * ph * smoothstep(-0.08, 0.02, sunDir.y);
        c = c * T + Lin * (1.0 - T);
        c += texture2D(tRays, vUv).rgb * sunCol * rays;
        gl_FragColor = vec4(c, 1.0);
      }`);
    this.fsQuad = new FullScreenQuad(this.mat); this.raysQuad = new FullScreenQuad(this.raysMat);
    this.sunUv = new THREE.Vector2(); this._v = new THREE.Vector3();
  }
  setSize(w, h) { this.rt.setSize(Math.ceil(w / 4), Math.ceil(h / 4)); this.raysMat.uniforms.aspect.value = w / h; }
  render(renderer, writeBuffer, readBuffer) {
    const A = shotAtmo(this.camera); this.params = A;
    if (!this.sky) this.sky = findSky(this.scene);
    const su = this.sky?.material.uniforms;
    const cam = this.camera; cam.updateMatrixWorld();
    for (const m of [this.mat, this.raysMat]) {
      const u = m.uniforms;
      u.tColor.value = readBuffer.texture; u.tDist.value = this.depthPass.target.texture;
      u.projInv.value.copy(cam.projectionMatrixInverse); u.camWorld.value.copy(cam.matrixWorld); u.camPos.value.setFromMatrixPosition(cam.matrixWorld);
      if (su) { u.sunDir.value.copy(su.sunPosition.value).normalize(); u.sunCol.value.copy(su.sunCol.value); }
    }
    const u = this.mat.uniforms;
    u.density.value = A.density; u.falloff.value = A.falloff; u.base.value = A.base; u.floorD.value = A.floor; u.ext.value.set(...A.ext);
    if (A.amb != null) u.amb.value.set(A.amb);
    else {
      const fogC = this.scene.fog ? this.scene.fog.color : new THREE.Color(0xcccccc);
      const hor = su ? su.horizon.value.clone().multiplyScalar(su.intensity.value) : fogC;
      u.amb.value.copy(fogC).lerp(hor, A.ambMix);
    }
    u.amb.value.multiplyScalar(A.ambK);
    u.sunK.value = A.sunK; u.g.value = A.g; u.g2.value = A.g2; u.lobe2.value = A.lobe2; u.skyFog.value = A.skyFog; u.skySun.value = A.skySun; u.skyDist.value = A.skyDist; u.maxDist.value = A.maxDist;
    // god rays: project the sun, skip when it is behind the camera or far off screen
    let raysOn = false;
    if (A.rays > 0 && su) {
      const p = this._v.copy(u.sunDir.value).multiplyScalar(10000).add(u.camPos.value);
      const vp = p.clone().applyMatrix4(cam.matrixWorldInverse);
      if (vp.z < 0) {
        p.project(cam); this.sunUv.set(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
        const mg = A.raysMargin; raysOn = this.sunUv.x > -mg && this.sunUv.x < 1 + mg && this.sunUv.y > -mg && this.sunUv.y < 1 + mg;
      }
    }
    u.rays.value = raysOn ? A.rays : 0;
    if (raysOn) {
      const r = this.raysMat.uniforms; r.sunUv.value.copy(this.sunUv); r.decay.value = A.raysDecay; r.len.value = A.raysLen; r.thr.value = A.raysThr; r.spread.value = A.raysSpread; r.depthCut.value = A.raysDepth;
      renderer.setRenderTarget(this.rt); this.raysQuad.render(renderer);
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer); this.fsQuad.render(renderer);
    // grade additions for the display-referred grade pass
    if (this.grade) { const g = this.grade.uniforms; g.shadowTint.value.set(...A.shadowTint); g.highTint.value.set(...A.highTint); }
  }
}

// ---------------- halation + local contrast ----------------
export class LensPass extends Pass {
  constructor(atmo, w, h) {
    super(); this.atmo = atmo; this.levels = [];
    let lw = w, lh = h;
    for (let i = 0; i < 6; i++) { lw = Math.max(1, Math.ceil(lw / 2)); lh = Math.max(1, Math.ceil(lh / 2)); this.levels.push({ d: this._rt(lw, lh), u: this._rt(lw, lh) }); }
    this.prefilter = mat({ tColor: { value: null }, thr: { value: 1 }, texel: { value: new THREE.Vector2() } }, `
      uniform sampler2D tColor; uniform float thr; uniform vec2 texel; varying vec2 vUv; ${LUM}
      void main(){
        vec3 s = vec3(0.0); float ll = 0.0;
        for (int j = 0; j < 4; j++) { vec2 o = vec2(j == 1 || j == 3 ? 1.0 : -1.0, j >= 2 ? 1.0 : -1.0) * texel * 0.5;
          vec3 c = texture2D(tColor, vUv + o).rgb; float l = dot(c, LW);
          s += c * max(l - thr, 0.0) / max(l, 1e-4); ll += log(max(l, 1e-4)); }
        gl_FragColor = vec4(s * 0.25, ll * 0.25);
      }`);
    this.down = mat({ tSrc: { value: null }, texel: { value: new THREE.Vector2() } }, `
      uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
      void main(){
        vec4 s = texture2D(tSrc, vUv) * 0.25;
        s += texture2D(tSrc, vUv + texel * vec2(-1.0, -1.0)) * 0.1875; s += texture2D(tSrc, vUv + texel * vec2(1.0, -1.0)) * 0.1875;
        s += texture2D(tSrc, vUv + texel * vec2(-1.0, 1.0)) * 0.1875; s += texture2D(tSrc, vUv + texel * vec2(1.0, 1.0)) * 0.1875;
        gl_FragColor = s;
      }`);
    this.up = mat({ tLow: { value: null }, tCur: { value: null }, texel: { value: new THREE.Vector2() }, k: { value: 0.5 } }, `
      uniform sampler2D tLow, tCur; uniform vec2 texel; uniform float k; varying vec2 vUv;
      void main(){
        vec4 s = texture2D(tLow, vUv) * 4.0;
        s += (texture2D(tLow, vUv + vec2(texel.x, 0.0)) + texture2D(tLow, vUv - vec2(texel.x, 0.0)) + texture2D(tLow, vUv + vec2(0.0, texel.y)) + texture2D(tLow, vUv - vec2(0.0, texel.y))) * 2.0;
        s += texture2D(tLow, vUv + texel) + texture2D(tLow, vUv - texel) + texture2D(tLow, vUv + vec2(texel.x, -texel.y)) + texture2D(tLow, vUv - vec2(texel.x, -texel.y));
        gl_FragColor = mix(s / 16.0, texture2D(tCur, vUv), k);
      }`);
    this.comp = mat({ tColor: { value: null }, tBlur: { value: null }, hal: { value: 0 }, halTint: { value: new THREE.Vector3() }, lc: { value: 0 }, lcClamp: { value: 0.6 } }, `
      uniform sampler2D tColor, tBlur; uniform float hal, lc, lcClamp; uniform vec3 halTint; varying vec2 vUv; ${LUM}
      void main(){
        vec3 c = texture2D(tColor, vUv).rgb; vec4 b = texture2D(tBlur, vUv);
        float l = max(dot(c, LW), 1e-4);
        // local contrast: push luminance away from its large-radius (log) average
        float dl = clamp(log(l) - b.a, -2.0, 2.0);
        c *= exp(clamp(lc * dl, -lcClamp, lcClamp));
        c += b.rgb * halTint * hal;
        gl_FragColor = vec4(c, 1.0);
      }`);
    this.q = new FullScreenQuad(null);
  }
  _rt(w, h) { return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); }
  setSize(w, h) { let lw = w, lh = h; for (const L of this.levels) { lw = Math.max(1, Math.ceil(lw / 2)); lh = Math.max(1, Math.ceil(lh / 2)); L.d.setSize(lw, lh); L.u.setSize(lw, lh); } }
  _draw(renderer, m, target) { this.q.material = m; renderer.setRenderTarget(target); this.q.render(renderer); }
  render(renderer, writeBuffer, readBuffer) {
    const A = this.atmo.params || ATMO_DEFAULTS;
    const out = this.renderToScreen ? null : writeBuffer;
    if (!(A.hal > 0) && !(A.lc > 0)) { this.comp.uniforms.tColor.value = readBuffer.texture; this.comp.uniforms.tBlur.value = null; this.comp.uniforms.hal.value = 0; this.comp.uniforms.lc.value = 0; this._draw(renderer, this.comp, out); return; }
    const L = this.levels;
    const p = this.prefilter.uniforms; p.tColor.value = readBuffer.texture; p.thr.value = A.halThr; p.texel.value.set(1 / readBuffer.width, 1 / readBuffer.height);
    this._draw(renderer, this.prefilter, L[0].d);
    for (let i = 1; i < L.length; i++) { const d = this.down.uniforms; d.tSrc.value = L[i - 1].d.texture; d.texel.value.set(1 / L[i - 1].d.width, 1 / L[i - 1].d.height); this._draw(renderer, this.down, L[i].d); }
    // progressive tent upsample down to 1/4 res; coarse levels dominate (wide halation, large-radius local mean)
    let low = L[L.length - 1].d;
    for (let i = L.length - 2; i >= 1; i--) {
      const u = this.up.uniforms; u.tLow.value = low.texture; u.tCur.value = L[i].d.texture; u.texel.value.set(1 / low.width, 1 / low.height); u.k.value = 0.3;
      this._draw(renderer, this.up, L[i].u); low = L[i].u;
    }
    const c = this.comp.uniforms; c.tColor.value = readBuffer.texture; c.tBlur.value = low.texture; c.hal.value = A.hal; c.halTint.value.set(...A.halTint); c.lc.value = A.lc; c.lcClamp.value = A.lcClamp;
    this._draw(renderer, this.comp, out);
  }
}
