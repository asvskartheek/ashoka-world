import * as THREE from 'three';
import * as T from './textures.js';

// Box-projected world-space UVs (works with InstancedMesh): no stretching on scaled instances.
// Texture "up" follows world up on walls. Applies to map, bump, normal and roughness maps.
// opts.grime = { h, amt, col }: darken the lowest h metres of each instance (splash-back grime / rising damp).
export function worldUV(mat, scale = 0.5, opts = {}) {
  const gr = opts.grime;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWuvScale = { value: scale };
    let pre = 'uniform float uWuvScale;\n';
    if (gr) { pre += 'varying float vGrimeY;\nvarying vec3 vGrimeP;\n'; sh.uniforms.uGrime = { value: new THREE.Vector4(gr.h, gr.amt, 0, 0) }; sh.uniforms.uGrimeCol = { value: new THREE.Color(...(gr.col || [0.42, 0.36, 0.3])) }; }
    sh.vertexShader = pre + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      {
        mat4 wm = modelMatrix;
        #ifdef USE_INSTANCING
          wm = modelMatrix * instanceMatrix;
        #endif
        vec3 wp = (wm * vec4(transformed, 1.0)).xyz;
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
        #endif
        ${gr ? 'vGrimeY = wp.y - (wm * vec4(0.0, 0.0, 0.0, 1.0)).y; vGrimeP = wp;' : ''}
      }`);
    if (gr) {
      sh.fragmentShader = 'uniform vec4 uGrime;\nuniform vec3 uGrimeCol;\nvarying float vGrimeY;\nvarying vec3 vGrimeP;\n' +
        'float gHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
        'float gNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gHash(i), gHash(i + vec2(1, 0)), f.x), mix(gHash(i + vec2(0, 1)), gHash(i + vec2(1, 1)), f.x), f.y); }\n' +
        sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        {
          float hz = vGrimeP.x + vGrimeP.z;
          float gn = gNoise(vec2(hz * 1.3, 0.0)) * 0.6 + gNoise(vec2(hz * 5.0, vGrimeP.y * 3.0)) * 0.4;
          float gy = vGrimeY - (gn - 0.5) * uGrime.x * 0.9;
          float g = 1.0 - smoothstep(0.0, uGrime.x, gy);
          float tide = exp(-pow((gy - uGrime.x * 0.95) / (uGrime.x * 0.12), 2.0)) * 0.35;
          diffuseColor.rgb *= mix(vec3(1.0), uGrimeCol, clamp(g * g * uGrime.y + tide * uGrime.y, 0.0, 1.0));
        }`);
    }
  };
  mat.customProgramCacheKey = () => 'wuv' + scale + (gr ? 'g' + gr.h + '_' + gr.amt : '');
  return mat;
}

const rep = (mat, x, y) => { for (const k of ['map', 'normalMap', 'roughnessMap', 'bumpMap']) if (mat[k]) mat[k].repeat.set(x, y); return mat; };

export function buildMaterials() {
  const M = {};
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const V = (x, y = x) => new THREE.Vector2(x, y);
  const pbr = (t, ns = 1, o = {}) => ({ map: t.map, normalMap: t.normal, normalScale: V(ns), roughnessMap: t.rough, roughness: 1, ...o });

  // --- brick: irregular courses, warm brown-orange per-brick variation, recessed mortar
  const brick = T.brickWall({ size: 512, rows: 16, cols: 6, seed: 3, lime: 0.25, dark: 0.55 });
  M.brick = worldUV(std(pbr(brick, 1.1)), 0.45, { grime: { h: 0.9, amt: 0.5 } });
  const brickPale = T.brickWall({ size: 512, rows: 16, cols: 6, seed: 31, pal: [[176, 114, 76], [196, 138, 96], [184, 124, 86], [158, 98, 64]], mortar: [196, 180, 152], lime: 0.6, dark: 0.4 });
  M.brickPale = worldUV(std(pbr(brickPale, 1.1)), 0.45, { grime: { h: 0.9, amt: 0.45 } });
  const stupaBrick = T.brickWall({ size: 1024, rows: 30, cols: 9, seed: 33, pal: [[150, 80, 48], [176, 100, 62], [190, 120, 78], [164, 94, 60]], mortar: [194, 174, 144], lime: 0.35, dark: 0.6 });
  M.stupaBrick = std(pbr(stupaBrick, 1.2));

  // --- wood
  const logs = T.barkTex({ seed: 5 });
  M.log = rep(std(pbr(logs, 1.4)), 1, 3);
  const timber = T.grainWood({ w: 512, h: 512, rings: 9, weather: 1, knots: 3, dark: [56, 38, 24], mid: [112, 80, 54], light: [152, 116, 80], seed: 6 });
  M.timber = worldUV(std(pbr(timber, 1.0)), 0.6);
  M.timberUV = std(pbr(timber, 1.0));
  const teak = T.grainWood({ w: 512, h: 1024, rings: 20, flutes: 12, polish: true, dark: [70, 28, 12], mid: [142, 66, 28], light: [196, 112, 54], seed: 7 });
  M.polishedWood = rep(phys(pbr(teak, 0.9, { clearcoat: 0.6, clearcoatRoughness: 0.16, metalness: 0.0 })), 2, 3);
  const carved = T.grainWood({ w: 512, h: 512, rings: 12, horiz: true, carve: true, polish: true, dark: [52, 22, 10], mid: [110, 50, 24], light: [160, 86, 42], seed: 8 });
  M.carvedWood = worldUV(phys(pbr(carved, 1.1, { clearcoat: 0.35, clearcoatRoughness: 0.3 })), 1.2);

  // --- roofs
  const thatch = T.thatchLayered({});
  M.thatch = std({ map: thatch.map, color: 0xd2c2a6, normalMap: thatch.normal, normalScale: V(1.6), roughness: 1 });
  const tilesRed = T.barrelTiles({ base: [160, 86, 58], seed: 12, moss: 0.5 });
  M.roofTilesRed = std(pbr(tilesRed, 1.3));
  const tilesMap = T.tinted(tilesRed.map, [0.74, 0.86, 0.95]);
  M.roofTiles = std({ ...pbr(tilesRed, 1.3), map: tilesMap, side: THREE.DoubleSide });

  // --- stone
  const sand = T.sandstoneTex({ size: 512, base: [214, 160, 104], seed: 13 });
  M.polishedSandstone = rep(phys(pbr(sand, 0.5, { clearcoat: 0.35, clearcoatRoughness: 0.22 })), 1, 3);
  const sandRough = T.stoneTex({ base: [200, 182, 150], seed: 14, blocks: 4 });
  M.stone = worldUV(std({ map: sandRough.map, bumpMap: sandRough.bump, bumpScale: 1.5, roughness: 0.9 }), 0.4);
  const marble = T.stoneTex({ base: [214, 204, 186], seed: 15, blocks: 2 });
  M.paleStone = worldUV(std({ map: marble.map, bumpMap: marble.bump, bumpScale: 1, roughness: 0.6, color: 0xddd0bc }), 0.35);
  M.weatheredStone = worldUV(std({ map: marble.map, bumpMap: marble.bump, bumpScale: 1.2, roughness: 0.85, color: 0xcabba4 }), 0.35);
  const baseSt = T.stoneTex({ base: [196, 184, 162], seed: 41 });
  M.baseStone = worldUV(std({ map: baseSt.map, bumpMap: baseSt.bump, bumpScale: 2, roughness: 0.8 }), 0.5);
  const rock = T.stoneTex({ base: [128, 118, 104], seed: 16 });
  M.rock = worldUV(std({ map: rock.map, bumpMap: rock.bump, bumpScale: 5, roughness: 0.95, color: 0xd6c8b4 }), 0.35);
  const pinkStone = T.stoneTex({ base: [196, 140, 108], seed: 18, polish: true });
  M.pinkStone = worldUV(std({ map: pinkStone.map, bumpMap: pinkStone.bump, bumpScale: 0.6, roughness: 0.5 }), 0.5);

  // --- weathered lime plaster (pink variant shares the pattern)
  const plaster = T.plasterWall({ base: [222, 200, 170], seed: 17 });
  M.plaster = worldUV(std(pbr(plaster, 0.9)), 0.22, { grime: { h: 1.1, amt: 0.55 } });
  M.plasterPink = worldUV(std({ ...pbr(plaster, 0.9), map: T.tinted(plaster.map, [1.0, 0.93, 0.9]) }), 0.22, { grime: { h: 1.1, amt: 0.55 } });
  M.trimRed = std({ color: 0x8a4a36, roughness: 0.9 });
  M.mud = worldUV(std({ map: plaster.map, color: 0xb88a62, roughness: 1 }), 0.3);

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
