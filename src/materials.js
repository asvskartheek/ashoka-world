import * as THREE from 'three';
import * as T from './textures.js';

// Box-projected world-space UVs (works with InstancedMesh): no stretching on scaled instances.
export function worldUV(mat, scale = 0.5) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWuvScale = { value: scale };
    sh.vertexShader = 'uniform float uWuvScale;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      {
        mat4 wm = modelMatrix;
        #ifdef USE_INSTANCING
          wm = modelMatrix * instanceMatrix;
        #endif
        vec3 wp = (wm * vec4(transformed, 1.0)).xyz;
        vec3 wn = abs(normalize(mat3(wm) * objectNormal));
        vec2 wuv = wn.y > max(wn.x, wn.z) ? wp.xz : (wn.x > wn.z ? vec2(wp.z, -wp.y) : vec2(wp.x, -wp.y));
        wuv *= uWuvScale;
        #ifdef USE_MAP
          vMapUv = wuv;
        #endif
        #ifdef USE_BUMPMAP
          vBumpMapUv = wuv;
        #endif
        #ifdef USE_ROUGHNESSMAP
          vRoughnessMapUv = wuv;
        #endif
      }`);
  };
  mat.customProgramCacheKey = () => 'wuv' + scale;
  return mat;
}

export function buildMaterials() {
  const M = {};
  const std = (o) => new THREE.MeshStandardMaterial(o);

  const brick = T.brickTex({ base: [170, 92, 62], seed: 3 });
  M.brick = worldUV(std({ map: brick.map, bumpMap: brick.bump, bumpScale: 1.2, roughness: 0.92 }), 0.45);
  const brickPale = T.brickTex({ base: [182, 120, 86], var_: 30, weathering: 0.8, seed: 31 });
  M.brickPale = worldUV(std({ map: brickPale.map, bumpMap: brickPale.bump, bumpScale: 1.2, roughness: 0.92 }), 0.45);
  const stupaBrick = T.brickTex({ base: [168, 98, 66], rows: 24, cols: 8, var_: 46, weathering: 0.5, seed: 33 });
  M.stupaBrick = std({ map: stupaBrick.map, bumpMap: stupaBrick.bump, bumpScale: 1.5, roughness: 0.95 });

  const logs = T.woodTex({ base: [104, 80, 58], dark: [52, 40, 30], light: [140, 120, 96], rings: 10, seed: 5 });
  M.log = std({ map: logs.map, bumpMap: logs.bump, bumpScale: 2, roughness: 0.95 });
  const timber = T.woodTex({ base: [118, 82, 52], dark: [60, 40, 25], light: [156, 116, 74], seed: 6 });
  M.timber = worldUV(std({ map: timber.map, bumpMap: timber.bump, bumpScale: 1, roughness: 0.85 }), 0.6);
  M.timberUV = std({ map: timber.map, bumpMap: timber.bump, bumpScale: 1, roughness: 0.85 });
  const polished = T.woodTex({ base: [120, 52, 22], dark: [62, 24, 10], light: [168, 90, 40], rings: 26, seed: 7, polish: true });
  M.polishedWood = std({ map: polished.map, bumpMap: polished.bump, bumpScale: 0.3, roughness: 0.32, metalness: 0.0 });
  M.carvedWood = worldUV(std({ map: polished.map, bumpMap: polished.bump, bumpScale: 0.6, roughness: 0.45, color: 0xb08870 }), 1.2);

  const thatch = T.thatchTex({});
  M.thatch = std({ map: thatch.map, bumpMap: thatch.bump, bumpScale: 3, roughness: 1 });
  const tiles = T.tileTex({ base: [104, 76, 58] });
  M.roofTiles = std({ map: tiles.map, bumpMap: tiles.bump, bumpScale: 2, roughness: 0.85 });
  const tilesRed = T.tileTex({ base: [150, 82, 56], seed: 12 });
  M.roofTilesRed = std({ map: tilesRed.map, bumpMap: tilesRed.bump, bumpScale: 2, roughness: 0.8 });

  const sand = T.stoneTex({ base: [206, 168, 118], polish: true, seed: 13 });
  M.polishedSandstone = std({ map: sand.map, bumpMap: sand.bump, bumpScale: 0.2, roughness: 0.28 });
  const sandRough = T.stoneTex({ base: [200, 182, 150], seed: 14, blocks: 4 });
  M.stone = worldUV(std({ map: sandRough.map, bumpMap: sandRough.bump, bumpScale: 1.5, roughness: 0.9 }), 0.4);
  const marble = T.stoneTex({ base: [214, 204, 186], seed: 15, blocks: 2 });
  M.paleStone = worldUV(std({ map: marble.map, bumpMap: marble.bump, bumpScale: 1, roughness: 0.6, color: 0xddd0bc }), 0.35);
  M.weatheredStone = worldUV(std({ map: marble.map, bumpMap: marble.bump, bumpScale: 1.2, roughness: 0.85, color: 0xcabba4 }), 0.35);
  const baseSt = T.stoneTex({ base: [196, 184, 162], seed: 41 });
  M.baseStone = worldUV(std({ map: baseSt.map, bumpMap: baseSt.bump, bumpScale: 2, roughness: 0.8 }), 0.5);
  const rock = T.stoneTex({ base: [128, 118, 104], seed: 16 });
  M.rock = worldUV(std({ map: rock.map, bumpMap: rock.bump, bumpScale: 4, roughness: 0.95 }), 0.25);
  const pinkStone = T.stoneTex({ base: [196, 140, 108], seed: 18, polish: true });
  M.pinkStone = worldUV(std({ map: pinkStone.map, bumpMap: pinkStone.bump, bumpScale: 0.6, roughness: 0.5 }), 0.5);

  const plaster = T.plasterTex({ base: [218, 196, 166] });
  M.plaster = worldUV(std({ map: plaster.map, bumpMap: plaster.bump, bumpScale: 0.8, roughness: 0.95 }), 0.22);
  const plasterPink = T.plasterTex({ base: [222, 182, 160], seed: 21 });
  M.plasterPink = worldUV(std({ map: plasterPink.map, bumpMap: plasterPink.bump, bumpScale: 0.8, roughness: 0.95 }), 0.22);
  M.trimRed = std({ color: 0x9c3b2c, roughness: 0.85 });
  M.mud = worldUV(std({ map: plaster.map, color: 0xb88a62, roughness: 1 }), 0.3);

  const floor = T.floorTex({});
  M.hallFloor = std({ map: floor.map, roughnessMap: floor.rough, roughness: 1, metalness: 0.0 });
  M.hallFloor.map.repeat.set(10, 10); M.hallFloor.roughnessMap.repeat.set(10, 10);

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
  M.inscription = std({ map: T.inscriptionTex({}), roughness: 0.35 });
  M.fabric = (c) => std({ color: c, map: M.cloth, roughness: 0.9, side: THREE.DoubleSide });

  const leaf = T.leafTex({});
  M.leaves = std({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: 0xffffff });
  const leaf2 = T.leafTex({ hue: [60, 92, 36], seed: 24, dryness: 0.05 });
  M.leavesDark = std({ map: leaf2, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75 });
  M.bark = std({ map: logs.map, color: 0x8a7a68, bumpMap: logs.bump, bumpScale: 3, roughness: 1 });
  M.foliageBlob = std({ color: 0x4f6a2c, roughness: 0.9 }); // far LOD canopy

  M.waterNormals = T.waterNormals({});
  M.ground = T.groundDetail({});
  return M;
}
