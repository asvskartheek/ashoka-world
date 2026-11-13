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
  const warm = new THREE.Color(S.sunCol); cu.sunCol.value.copy(warm).multiplyScalar(S.sun.el < 10 ? 1.3 : 1.05); cu.shade.value.copy(S.sun.el < 10 ? new THREE.Color(0x8a6a80) : new THREE.Color(0xd0d8e4));
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
  scene.fog = new THREE.FogExp2(S.fog.color, S.fog.density);
  // environment lighting from the sky
  const envScene = new THREE.Scene(); const sk2 = sky.clone(); sk2.material = sky.material; envScene.add(sk2);
  const rt = pmrem.fromScene(envScene, 0, 1, 20000); scene.environment = rt.texture; scene.environmentIntensity = S.env ?? 0.45;
  const ao = S.ao || { radius: 1.0, intensity: 0.85 };
  gtao.updateGtaoMaterial({ radius: ao.radius, distanceExponent: 1.4, thickness: ao.thickness ?? 1.5, scale: 1.0, samples: 16 }); gtao.blendIntensity = ao.intensity;
  const g = grade.uniforms; g.lift.value.set(...S.grade.lift); g.gain.value.set(...S.grade.gain); g.sat.value = S.grade.sat; g.contrast.value = S.grade.contrast;
}
window.renderShot = async (id, time = 0) => {
  const S = SHOTS[id]; applyShot(S);
  if (world.ref.hallReflector) world.ref.hallReflector.visible = id == 2;
  water.material.uniforms.time.value = time; clouds.material.uniforms.time.value = time;
  const t1 = performance.now(); comp.render(); comp.render(); const gl = renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  log('rendered shot', id, (performance.now() - t1) | 0, 'ms');
  return true;
};
window.__dbg = { scene, clouds, water, sky, renderer, comp, camera, sun, hemi };
window.__ready = true; log('ready', (performance.now() - t0) | 0);
