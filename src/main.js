import * as THREE from 'three';
import { buildMaterials } from './materials.js';
import { buildTerrain, buildWater, buildSky, buildComposer, height } from './env.js';
import { buildWorld } from './world.js';
import { SHOTS } from './shots.js';

const q = new URLSearchParams(location.search);
const W = +q.get('w') || 1448, H = +q.get('h') || 1086;
const log = (...a) => { console.log(...a); };
const t0 = performance.now();
const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.setSize(W, H);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, W / H, 0.3, 30000);
const M = buildMaterials(); log('materials', (performance.now() - t0) | 0);
const world = buildWorld(scene, M); log('world', (performance.now() - t0) | 0);
const terrain = buildTerrain(M, world.mask); scene.add(terrain);
const water = buildWater(M); scene.add(water);
const { sky, clouds } = buildSky(); scene.add(sky); scene.add(clouds);
const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.00025; sun.shadow.normalBias = 0.012;
scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0xbfd4ff, 0x8a7050, 0.6); scene.add(hemi);
const { comp, grade, gtao } = buildComposer(renderer, scene, camera, W, H);
const pmrem = new THREE.PMREMGenerator(renderer);
// ---------------- accumulation renderer ----------------
// Average N jittered sub-frames (raw linear HDR) in a float target, then run the post chain once on the average.
// Per sub-frame: sub-pixel projection jitter (AA), sun direction inside a small disc (soft penumbrae), optional lens-disc
// jitter about a focus distance (DOF), a shadow-casting directional "sky light" that samples the sky hemisphere (real sky
// occlusion; it carries a fraction of the hemisphere light's sky term), and a time offset hook (motion blur later).
// URL: ?spp=N (default 8; 1 = legacy single frame), &sky=0..1 (fraction of the hemisphere sky term moved to the sky light), &envsky=0..1 (fraction of the
// environment map's diffuse moved to it), &sundisc=deg (sun disc radius), &focus=m, &aperture=m (lens radius, 0 = pinhole), &shutter=s, &aoscale, &reflevery
const qn = (k, d) => (q.get(k) !== null && q.get(k) !== '' ? +q.get(k) : d);
const ACC = { spp: Math.max(1, Math.round(qn('spp', 8))), sky: qn('sky', 1.0), sunDisc: qn('sundisc', 0.9), reflEvery: Math.max(1, qn('reflevery', 4)), shutter: qn('shutter', 0), aoScale: qn('aoscale', 0.85), env: qn('envsky', 0.5) };
// per-shot lens defaults (focus distance in m, lens radius in m); S.dof in shots.js or URL params override
const DOF = { 2: { focus: 14, aperture: 0.006 }, 4: { focus: 11, aperture: 0.012 } };
const HEMI_SKY = new THREE.Color(0xbfd4ff), HEMI_GROUND = new THREE.Color(0x8a7050);
// sky radiance along direction d, replicating the sky dome shader (env.js buildSky) minus the sun disc; linear RGB
function skyRadiance(d, out) {
  const u = sky.material.uniforms, s = u.sunPosition.value.clone().normalize(), h = Math.max(d.y, 0), sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  out.copy(u.horizon.value).lerp(u.zenith.value, Math.pow(sm(0, 0.75, h), 0.55));
  const mu = d.dot(s); out.lerp(u.band.value, u.bandAmt.value * Math.exp(-h * 9) * (0.35 + 0.65 * sm(-0.6, 1, mu)));
  const m = Math.max(mu, 0); out.add(u.sunCol.value.clone().multiplyScalar(u.glow.value * (0.35 * Math.pow(m, 6) + 0.6 * Math.pow(m, 60))));
  return out.multiplyScalar(u.intensity.value);
}
const skyLight = new THREE.DirectionalLight(HEMI_SKY, 0); skyLight.castShadow = true; skyLight.visible = ACC.spp > 1;
skyLight.shadow.mapSize.set(1024, 1024); skyLight.shadow.bias = -0.0006; skyLight.shadow.normalBias = 0.04;
scene.add(skyLight, skyLight.target);
const accRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.FloatType, depthBuffer: false });
const subRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
const accMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null }, weight: { value: 1 } }, depthTest: false, depthWrite: false,
  blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendEquation: THREE.AddEquation,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tSrc; uniform float weight; varying vec2 vUv; void main(){ vec4 c = texture2D(tSrc, vUv); if (any(isnan(c)) || any(isinf(c))) c = vec4(0.0); gl_FragColor = vec4(min(c.rgb, vec3(64.0)) * weight, weight); }` });
const copyMat = new THREE.ShaderMaterial({ uniforms: { tSrc: { value: null } }, depthTest: false, depthWrite: false, blending: THREE.NoBlending,
  vertexShader: accMat.vertexShader, fragmentShader: `uniform sampler2D tSrc; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(tSrc, vUv).rgb, 1.0); }` });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), accMat); quad.frustumCulled = false;
const quadScene = new THREE.Scene(); quadScene.add(quad); const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const drawQuad = (m, target) => { quad.material = m; renderer.setRenderTarget(target); const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(quadScene, quadCam); renderer.autoClear = ac; };
const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const disc = (u, v) => { const r = Math.sqrt(u), a = 2 * Math.PI * v; return [r * Math.cos(a), r * Math.sin(a)]; };
const renderPass = comp.passes.find(p => p.constructor.name === 'RenderPass' || (p.scene === scene && 'clearDepth' in p));
let shotState = null; // filled by applyShot: light frame for sun/sky jitter
log('setup', (performance.now() - t0) | 0, 'tris approx', countTris());

function countTris() { let n = 0; scene.traverse(o => { if (o.isMesh && o.geometry) { const g = o.geometry; const c = (g.index ? g.index.count : g.attributes.position.count) / 3; n += c * (o.isInstancedMesh ? o.count : 1); } }); return Math.round(n / 1e3) + 'k'; }

export function applyShot(S) {
  const p = new THREE.Vector3(...S.pos), t = new THREE.Vector3(...S.target);
  if (S.eye !== undefined) p.y = height(p.x, p.z) + S.eye;
  if (S.tdy !== undefined) t.y = height(t.x, t.z) + S.tdy;
  camera.position.copy(p); camera.fov = S.fov; camera.lookAt(t); camera.updateProjectionMatrix();
  const az = THREE.MathUtils.degToRad(S.sun.az), el = THREE.MathUtils.degToRad(S.sun.el);
  const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  const u = sky.material.uniforms; u.sunPosition.value.copy(dir);
  u.zenith.value.set(S.sky.zenith); u.horizon.value.set(S.sky.horizon); u.band.value.set(S.sky.band || 0xffc090); u.bandAmt.value = S.sky.bandAmt || 0; u.glow.value = S.sky.glow ?? 1; u.sunCol.value.set(S.sky.sunCol || S.sunCol); u.intensity.value = S.sky.intensity || 1;
  const cu = clouds.material.uniforms; cu.sunDir.value.copy(dir); cu.cover.value = S.cloud;
  const warm = new THREE.Color(S.sunCol); cu.sunCol.value.copy(S.sun.el < 10 ? warm.clone().multiplyScalar(1.3) : new THREE.Color(0xfffaf2)); cu.shade.value.copy(S.sun.el < 10 ? new THREE.Color(0x8a6a80) : new THREE.Color(0xd0d8e4));
  water.material.uniforms.sunDirection.value.copy(dir);
  water.material.uniforms.waterColor.value.set(S.water?.color ?? 0x3a5058); water.material.uniforms.distortionScale.value = S.water?.distortion ?? 2.2;
  renderer.toneMappingExposure = S.exposure;
  const L = S.light || S.sun; const laz = THREE.MathUtils.degToRad(L.az), lel = THREE.MathUtils.degToRad(L.el);
  const ldir = new THREE.Vector3(Math.cos(lel) * Math.sin(laz), Math.sin(lel), Math.cos(lel) * Math.cos(laz));
  const c = new THREE.Vector3(...S.shadow.center); c.y = height(c.x, c.z);
  sun.position.copy(c).addScaledVector(ldir, 1500); sun.target.position.copy(c); sun.target.updateMatrixWorld();
  sun.color.set(S.sunCol); sun.intensity = S.sunInt;
  const sc = sun.shadow.camera; const s = S.shadow.size / 2; sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 100; sc.far = 3500; sc.updateProjectionMatrix();
  hemi.intensity = S.hemi;
  hemi.color.copy(HEMI_SKY); hemi.groundColor.copy(HEMI_GROUND);
  const ss = sun.shadow.camera, kc = skyLight.shadow.camera; kc.left = ss.left; kc.right = ss.right; kc.top = ss.top; kc.bottom = ss.bottom; kc.near = 100; kc.far = 3500; kc.updateProjectionMatrix();
  skyLight.target.position.copy(c); skyLight.target.updateMatrixWorld();
  shotState = { ldir: ldir.clone(), center: c.clone(), hemi: S.hemi, env: S.env ?? 0.45 };
  scene.fog = new THREE.FogExp2(S.fog.color, S.fog.density);
  // environment lighting from the sky
  const envScene = new THREE.Scene(); const sk2 = sky.clone(); sk2.material = sky.material; envScene.add(sk2);
  const rt = pmrem.fromScene(envScene, 0, 1, 20000); scene.environment = rt.texture; scene.environmentIntensity = S.env ?? 0.45;
  const ao = S.ao || { radius: 1.0, intensity: 0.85 };
  gtao.updateGtaoMaterial({ radius: ao.radius, distanceExponent: 1.4, thickness: ao.thickness ?? 1.5, scale: 1.0, samples: 16 }); gtao.blendIntensity = ao.intensity * (ACC.spp > 1 ? ACC.aoScale : 1);
  const g = grade.uniforms; g.lift.value.set(...S.grade.lift); g.gain.value.set(...S.grade.gain); g.sat.value = S.grade.sat; g.contrast.value = S.grade.contrast;
}
// one jittered sub-frame i of N into target (raw linear HDR, no post)
function renderSub(i, N, base, opt, target) {
  const st = shotState; const centre = i === 0; // sub-frame 0 is the unjittered centre sample (its depth feeds the post chain)
  // sub-pixel jitter (box filter, 1 px) from Halton(2,3)
  let ox = centre ? 0 : halton(i, 2) - 0.5, oy = centre ? 0 : halton(i, 3) - 0.5;
  camera.position.copy(base.pos); camera.quaternion.copy(base.quat);
  if (opt.aperture > 0 && !centre) { // lens disc: move the eye, shift the frustum so the focus plane stays put
    const [lx, ly] = disc(halton(i, 5), halton(i, 7)); const dx = lx * opt.aperture, dy = ly * opt.aperture;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(base.quat), up = new THREE.Vector3(0, 1, 0).applyQuaternion(base.quat);
    camera.position.addScaledVector(right, dx).addScaledVector(up, dy);
    const ty = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), tx = ty * camera.aspect;
    ox += -dx / (opt.focus * tx) * W / 2; oy += dy / (opt.focus * ty) * H / 2;
  }
  camera.setViewOffset(W, H, ox, oy, W, H); camera.updateMatrixWorld();
  // sun inside a disc of radius sunDisc degrees around the shot's light direction
  const ld = st.ldir.clone();
  if (!centre && ACC.sunDisc > 0) {
    const t1 = new THREE.Vector3().crossVectors(ld, Math.abs(ld.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize(), t2 = new THREE.Vector3().crossVectors(ld, t1);
    const [a, b] = disc(halton(i, 11), halton(i, 13)); const r = Math.tan(THREE.MathUtils.degToRad(ACC.sunDisc));
    ld.addScaledVector(t1, a * r).addScaledVector(t2, b * r).normalize();
  }
  sun.position.copy(st.center).addScaledVector(ld, 1500);
  // sky light: stratified over the upper hemisphere (uniform in solid angle, elevation >= ~5 deg), random rotation per shot
  const ymin = 0.08, u = (i + base.rot1) / N - Math.floor((i + base.rot1) / N);
  const y = ymin + (1 - ymin) * u, az = i * 2.39996323 + base.rot2 * 6.2832, rr = Math.sqrt(1 - y * y);
  skyLight.position.copy(st.center).add(new THREE.Vector3(rr * Math.sin(az), y, rr * Math.cos(az)).multiplyScalar(1500));
  // uniform sky of up-irradiance f*hemi: radiance L = f*hemi/pi, one direction carries L * solid angle;
  // plus the moved fraction of the environment map's diffuse: its sky radiance along this direction * envIntensity * solid angle
  const omega = 2 * Math.PI * (1 - ymin), sd = new THREE.Vector3(rr * Math.sin(az), y, rr * Math.cos(az));
  skyLight.color.copy(HEMI_SKY).multiplyScalar(opt.sky * st.hemi * omega / Math.PI).add(skyRadiance(sd, new THREE.Color()).multiplyScalar(opt.envSky * st.env * omega));
  skyLight.intensity = 1;
  // time (motion-blur hook; the scene is static except water and clouds)
  const t = base.time + ACC.shutter * ((i + 0.5) / N - 0.5);
  water.material.uniforms.time.value = t; clouds.material.uniforms.time.value = t;
  if (window.__accumTime) window.__accumTime(t);
  // planar reflections are full scene renders: refresh them only every reflEvery sub-frames
  const refl = [water, world.ref.hallReflector].filter(Boolean); const keep = i % ACC.reflEvery === 0;
  const saved = refl.map(r => r.onBeforeRender); if (!keep) refl.forEach(r => { r.onBeforeRender = () => {}; });
  renderer.setRenderTarget(target); renderer.render(scene, camera);
  if (!keep) refl.forEach((r, k) => { r.onBeforeRender = saved[k]; });
}
window.renderShot = async (id, time = 0) => {
  const S = SHOTS[id]; applyShot(S);
  if (world.ref.hallReflector) world.ref.hallReflector.visible = id == 2;
  water.material.uniforms.time.value = time; clouds.material.uniforms.time.value = time;
  const t1 = performance.now(); const gl = renderer.getContext(); const px = new Uint8Array(4);
  const N = ACC.spp;
  if (N <= 1 || !renderPass) {
    comp.render(); comp.render();
  } else {
    const d = S.dof || DOF[id] || {}; const opt = { focus: qn('focus', d.focus ?? 20), aperture: qn('aperture', d.aperture ?? 0), sky: ACC.sky, envSky: S.envSky ?? ACC.env };
    // the sky light takes over fraction opt.sky of the hemisphere sky term and opt.envSky of the environment map;
    // the environment's lower hemisphere (hazy ground, radiance horizon*0.8) is handed to the hemisphere ground term
    const env0 = shotState.env; scene.environmentIntensity = env0 * (1 - opt.envSky);
    const Lg = sky.material.uniforms.horizon.value.clone().multiplyScalar(0.8 * sky.material.uniforms.intensity.value);
    hemi.intensity = 1; hemi.color.copy(HEMI_SKY).multiplyScalar(shotState.hemi * (1 - opt.sky));
    hemi.groundColor.copy(HEMI_GROUND).multiplyScalar(shotState.hemi).add(Lg.multiplyScalar(Math.PI * opt.envSky * env0));
    const base = { pos: camera.position.clone(), quat: camera.quaternion.clone(), time, rot1: halton(id * 7 + 3, 2), rot2: halton(id * 7 + 3, 3) };
    const cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setClearColor(0x000000, 0); renderer.setRenderTarget(accRT); renderer.clear(true, false, false); renderer.setClearColor(cc, ca);
    const centreRT = comp.readBuffer; // the composer's input buffer keeps the centre sample's depth for depth-reading passes
    accMat.uniforms.weight.value = 1 / N;
    for (let i = 0; i < N; i++) {
      const tgt = i === 0 ? centreRT : subRT; const ts = performance.now();
      renderSub(i, N, base, opt, tgt);
      accMat.uniforms.tSrc.value = tgt.texture; drawQuad(accMat, accRT);
      renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      log('  sub', i, (performance.now() - ts) | 0, 'ms');
    }
    // restore the centre camera and lights for the post chain
    camera.position.copy(base.pos); camera.quaternion.copy(base.quat); camera.clearViewOffset(); camera.updateMatrixWorld();
    sun.position.copy(shotState.center).addScaledVector(shotState.ldir, 1500);
    water.material.uniforms.time.value = time; clouds.material.uniforms.time.value = time;
    // post chain once on the average: the render pass only copies the average into its buffer (depth from sub-frame 0 stays)
    const rpRender = renderPass.render;
    renderPass.render = (r, wb, rb) => { copyMat.uniforms.tSrc.value = accRT.texture; drawQuad(copyMat, renderPass.renderToScreen ? null : rb); };
    try { comp.render(); } finally { renderPass.render = rpRender; }
  }
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  log('rendered shot', id, (performance.now() - t1) | 0, 'ms', 'spp', N);
  return true;
};
window.__dbg = { scene, clouds, water, sky, renderer, comp, camera, sun, hemi, skyLight, ACC };
window.__ready = true; log('ready', (performance.now() - t0) | 0);
