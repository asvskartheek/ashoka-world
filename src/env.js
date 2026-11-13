import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { fbm } from './textures.js';

// ---------------- world height field ----------------
export const RIVER = [[-900, 900], [-520, 350], [-330, 0], [-300, -300], [-250, -650], [-120, -1100], [150, -1800], [500, -2700], [900, -4000]];
export const MOAT = { x0: -300, x1: 340, z0: 7, z1: 37 };
export const HILL = { x: 1000, z: -120, h: 55, r: 210, top: 48 };
export const HILL2 = { x: 950, z: 92, h: 44, r: 84, top: 40 };
export const WATER_Y = -0.7;

function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return [Math.hypot(px - ax - t * dx, pz - az - t * dz), t];
}
export function riverDist(x, z) {
  let best = 1e9; for (let i = 0; i < RIVER.length - 1; i++) { const [d] = distSeg(x, z, ...RIVER[i], ...RIVER[i + 1]); if (d < best) best = d; }
  // gentle meander offset
  return best + Math.sin(z * 0.004) * 20;
}
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function riverHalfWidth(z) { return 105 + Math.sin(z * 0.0021) * 25 + (z < -1500 ? (-1500 - z) * 0.05 : 0); }

export function height(x, z) {
  let h = (fbm(x * 0.002 + 50, z * 0.002 + 50, 4, 4096) - 0.5) * 4;
  // distant rolling hills / ridgelines
  const far = Math.hypot(x - 300, z + 100);
  h += smooth(1500, 4200, far) * (fbm(x * 0.0006, z * 0.0006, 4, 4096) * 420 - 110) + smooth(3000, 7000, far) * 160;
  // the stupa hill
  const d2 = Math.hypot(x - HILL2.x, z - HILL2.z);
  const hill2 = HILL2.h * Math.exp(-Math.pow(d2 / HILL2.r, 2.2)) * (0.9 + fbm(x * 0.013 + 5, z * 0.013, 4, 4096) * 0.2);
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  const hill = HILL.h * Math.exp(-Math.pow(dh / HILL.r, 2.2)) * (0.85 + fbm(x * 0.01, z * 0.01, 4, 4096) * 0.3);
  h += Math.min(hill, HILL.top + (hill - HILL.top) * 0.08);
  // flatten city & town platforms
  const city = (x > -260 && x < 360 && z > -520 && z < 120) ? 1 : 0;
  h += Math.min(hill2, HILL2.top + (hill2 - HILL2.top) * 0.08);
  if (city) h = h * 0.1 + 0.4;
  const townF = 1 - smooth(110, 175, Math.hypot(x - 880, z - 300));
  h = THREE.MathUtils.lerp(h, h * 0.1 + 0.4, townF);
  // river channel
  const rd = riverDist(x, z), hw = riverHalfWidth(z);
  h = THREE.MathUtils.lerp(-4.5, h, smooth(hw - 25, hw + 30, rd));
  // moat
  const mz1 = THREE.MathUtils.lerp(13, MOAT.z1, smooth(-3, 8, x));
  if (x > MOAT.x0 && x < MOAT.x1 && z > MOAT.z0 - 4 && z < mz1 + 4) {
    const e = Math.min(z - MOAT.z0, mz1 - z, x - MOAT.x0 + 40, MOAT.x1 - x);
    h = THREE.MathUtils.lerp(h, -3.2, smooth(-3, 3, e));
  }
  return h;
}

// Ground mask painted on a canvas: R = bare earth/roads, B = wet margins. Covers the detailed band.
export const MASK = { x0: -700, x1: 1400, z0: -800, z1: 600 };
export function makeGroundMask(paintFn) {
  const W = 2100, H = 1400; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = 'rgb(0,0,0)'; g.fillRect(0, 0, W, H);
  const tx = (x) => (x - MASK.x0) / (MASK.x1 - MASK.x0) * W, tz = (z) => (z - MASK.z0) / (MASK.z1 - MASK.z0) * H, ts = (s) => s / (MASK.x1 - MASK.x0) * W;
  paintFn({ g, tx, tz, ts });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.flipY = false; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; return t;
}

function axisSamples(c0, c1, step, ext, growth) {
  const a = []; for (let v = c0; v <= c1; v += step) a.push(v);
  let s = step, v = c1; while (v < c1 + ext) { s *= growth; v += s; a.push(v); }
  s = step; v = c0; const pre = []; while (v > c0 - ext) { s *= growth; v -= s; pre.unshift(v); }
  return [...pre, ...a];
}
export function buildTerrain(M, maskTex) {
  const xs = axisSamples(-520, 1260, 2.2, 9000, 1.045), zs = axisSamples(-680, 460, 2.2, 9000, 1.045);
  const nx = xs.length, nz = zs.length; const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; pos[k] = xs[i]; pos[k + 2] = zs[j]; pos[k + 1] = height(xs[i], zs[j]); }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let o = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx.set([a, c, b, b, c, d], o); o += 6; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.97 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { tDirt: { value: M.ground.dirt }, tGrass: { value: M.ground.grass }, tMask: { value: maskTex }, tRock: { value: M.rock.map },
      maskMin: { value: new THREE.Vector2(MASK.x0, MASK.z0) }, maskMax: { value: new THREE.Vector2(MASK.x1, MASK.z1) } });
    sh.vertexShader = 'varying vec3 vWPos; varying vec3 vWN;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n vWPos = (modelMatrix * vec4(transformed,1.0)).xyz; vWN = normal;');
    sh.fragmentShader = `uniform sampler2D tDirt, tGrass, tMask, tRock; uniform vec2 maskMin, maskMax; varying vec3 vWPos; varying vec3 vWN;\n` +
      sh.fragmentShader.replace('#include <map_fragment>', `
      vec2 wuv = vWPos.xz;
      vec3 dirt = texture2D(tDirt, wuv * 0.21).rgb * 0.55 + texture2D(tDirt, wuv * 0.031).rgb * 0.45;
      vec3 grass = texture2D(tGrass, wuv * 0.17).rgb * 0.5 + texture2D(tGrass, wuv * 0.023).rgb * 0.5;
      float big = texture2D(tGrass, wuv * 0.0021).g;
      grass *= 0.75 + big * 0.6;
      float dryH = smoothstep(4.0, 25.0, vWPos.y) * 0.75;
      grass = mix(grass, vec3(0.42, 0.37, 0.22) * (0.8 + big * 0.4), dryH);
      vec2 muv = (vWPos.xz - maskMin) / (maskMax - maskMin);
      vec4 m = (muv.x > 0.0 && muv.x < 1.0 && muv.y > 0.0 && muv.y < 1.0) ? texture2D(tMask, muv) : vec4(0.0);
      float nz = texture2D(tDirt, wuv * 0.013).r;
      float dirtAmt = smoothstep(0.25, 0.75, m.r + (nz - 0.5) * 0.5);
      dirtAmt = max(dirtAmt, smoothstep(0.62, 0.8, big) * 0.6);
      vec3 col = mix(grass, dirt, dirtAmt);
      float slope = 1.0 - normalize(vWN).y;
      vec3 rock = texture2D(tRock, wuv * 0.08).rgb;
      col = mix(col, rock * 0.9, smoothstep(0.18, 0.35, slope));
      float wet = max(m.b, smoothstep(0.6, -0.4, vWPos.y));
      col = mix(col, col * vec3(0.48, 0.45, 0.4), wet);
      // distant fields: patchwork of crop colours
      float far = smoothstep(1500.0, 2600.0, length(vWPos.xz - vec2(300.0, -100.0)));
      vec3 fields = mix(vec3(0.33, 0.38, 0.17), vec3(0.55, 0.5, 0.3), step(0.5, fract(sin(dot(floor(wuv / 180.0), vec2(12.9, 78.2))) * 43758.5)));
      col = mix(col, mix(col, fields, 0.5), far);
      diffuseColor.rgb *= col;
      `);
  };
  const mesh = new THREE.Mesh(geo, mat); mesh.receiveShadow = true; mesh.name = 'terrain';
  return mesh;
}

export function buildWater(M) {
  const geo = new THREE.PlaneGeometry(20000, 20000);
  const w = new Water(geo, { textureWidth: 1024, textureHeight: 1024, waterNormals: M.waterNormals, sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xffffff, waterColor: 0x3a5058, distortionScale: 2.2, fog: true, alpha: 1 });
  M.waterNormals.repeat.set(1, 1);
  w.rotation.x = -Math.PI / 2; w.position.y = WATER_Y; w.material.uniforms.size.value = 6;
  return w;
}

// ---------------- sky + clouds ----------------
export function buildSky() {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(15000, 64, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { sunPosition: { value: new THREE.Vector3(0, 1, 0) }, zenith: { value: new THREE.Color(0x3a6ab8) }, horizon: { value: new THREE.Color(0xc8d8e8) },
      band: { value: new THREE.Color(0xffc8a0) }, sunCol: { value: new THREE.Color(0xfff0d0) }, glow: { value: 1 }, bandAmt: { value: 0 }, intensity: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 sunPosition, zenith, horizon, band, sunCol; uniform float glow, bandAmt, intensity; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); vec3 s = normalize(sunPosition);
        float h = max(d.y, 0.0);
        vec3 c = mix(horizon, zenith, pow(smoothstep(0.0, 0.75, h), 0.55));
        // warm band near horizon (sunset), strongest toward the sun
        float mu = dot(d, s);
        float toward = smoothstep(-0.6, 1.0, mu);
        c = mix(c, band, bandAmt * exp(-h * 9.0) * (0.35 + 0.65 * toward));
        c += sunCol * glow * (0.35 * pow(max(mu, 0.0), 6.0) + 0.6 * pow(max(mu, 0.0), 60.0));
        c += sunCol * 30.0 * smoothstep(0.99955, 0.9998, mu);
        // below horizon: hazy ground colour
        c = mix(c, horizon * 0.8, smoothstep(0.0, -0.05, d.y));
        gl_FragColor = vec4(c * intensity, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const cloudMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, transparent: true, depthWrite: false, fog: false,
    uniforms: { sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() }, shade: { value: new THREE.Color() }, cover: { value: 0.45 }, time: { value: 0 }, opacity: { value: 1 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
    fragmentShader: `uniform vec3 sunDir, sunCol, shade; uniform float cover, time, opacity; varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<6;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
      void main(){
        if (vDir.y < 0.0) discard;
        vec2 p = vDir.xz / (vDir.y + 0.12) * 1.6 + vec2(time*0.01, 0.0);
        float d = fbm(p) ; float d2 = fbm(p*3.0+7.0);
        float c = smoothstep(cover, cover+0.28, d*0.75 + d2*0.35);
        float thick = smoothstep(cover, cover+0.6, d*0.75 + d2*0.35);
        float mu = max(dot(normalize(vDir), sunDir), 0.0);
        vec3 lit = mix(shade, sunCol, 0.55 + 0.45 * (1.0 - thick)) + sunCol * pow(mu, 8.0) * 0.8 * (1.0 - thick);
        float horizonFade = smoothstep(0.0, 0.12, vDir.y);
        gl_FragColor = vec4(lit, c * horizonFade * opacity);
      }`,
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(14000, 48, 24), cloudMat); clouds.renderOrder = -1;
  return { sky, clouds };
}

// ---------------- post-processing ----------------
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.35 }, lift: { value: new THREE.Vector3(0, 0, 0) }, gain: { value: new THREE.Vector3(1, 1, 1) }, sat: { value: 1.05 }, contrast: { value: 1.05 }, res: { value: new THREE.Vector2(1, 1) }, grain: { value: 0.012 }, seed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float vignette, sat, contrast, grain, seed; uniform vec3 lift, gain; uniform vec2 res; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 d = (vUv - 0.5) * 0.0015;
      vec3 c = vec3(texture2D(tDiffuse, vUv + d).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - d).b);
      c = c * gain + lift * (1.0 - c);
      float l = dot(c, vec3(0.2126,0.7152,0.0722));
      c = mix(vec3(l), c, sat);
      c = (c - 0.5) * contrast + 0.5;
      vec2 q = vUv - 0.5; c *= 1.0 - vignette * dot(q, q) * 1.6;
      c += (h(vUv * res + seed) - 0.5) * grain;
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};
export function buildComposer(renderer, scene, camera, w, h) {
  const comp = new EffectComposer(renderer); comp.setSize(w, h);
  comp.addPass(new RenderPass(scene, camera));
  comp.addPass(new ShaderPass({ uniforms: { tDiffuse: { value: null } }, vertexShader: GradeShader.vertexShader,
    fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0, 0.0, 0.0, 1.0); gl_FragColor = vec4(min(c.rgb, vec3(64.0)), 1.0); }` }));
  const bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.18, 0.5, 0.92); comp.addPass(bloom);
  comp.addPass(new OutputPass());
  const grade = new ShaderPass(GradeShader); grade.uniforms.res.value.set(w, h); comp.addPass(grade);
  return { comp, bloom, grade };
}
