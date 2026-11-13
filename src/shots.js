// Camera + lighting presets matched to each reference image.
export const SHOTS = {
  1: { name: 'city_gate_sunset', ao: { radius: 4.0, intensity: 0.8, thickness: 6 }, pos: [-4, 42, 104], target: [2, 11.3, -3], fov: 38,
       sun: { az: 161, el: 2.3 }, light: { az: 66, el: 10 }, sky: { zenith: 0x6c84c8, horizon: 0xf8b4a4, band: 0xff9068, bandAmt: 0.6, glow: 1.0, sunCol: 0xffb860, intensity: 1.12 }, exposure: 1.15, cloud: 0.62,
       fog: { color: 0xf4dccc, density: 0.00011 }, water: { color: 0x3c5a50, distortion: 4.5 }, shadow: { center: [40, 0, -120], size: 420 },
       grade: { lift: [0.04, 0.025, 0.03], gain: [1.07, 1.0, 0.92], sat: 0.8, contrast: 1.03 }, sunInt: 5.2, sunCol: 0xffb070, hemi: 0.55 },
  2: { name: 'palace_hall', ao: { radius: 1.2, intensity: 0.9 }, pos: [139.8, 4.2, -307.6], target: [151.8, 4.5, -316.6], fov: 54,
       sun: { az: -140, el: 34 }, env: 0.6, sky: { zenith: 0x5a8ad8, horizon: 0xe2ecf4, glow: 0.3, intensity: 1.5 }, exposure: 0.95, cloud: 0.62,
       fog: { color: 0xc8d4dc, density: 0.0012 }, shadow: { center: [130, 0, -315], size: 110 },
       grade: { lift: [0.045, 0.03, 0.0], gain: [1.1, 1.0, 0.86], sat: 1.26, contrast: 1.06 }, sunInt: 5.0, sunCol: 0xffd8a8, hemi: 1.1 },
  3: { name: 'stupa_hill', ao: { radius: 1.2, intensity: 0.85 }, pos: [1033, 0, -153], target: [1004, 0, -124], eye: 2.6, tdy: 7.0, fov: 54,
       sun: { az: 122, el: 40 }, sky: { zenith: 0x4c86d4, horizon: 0xdae6f0, glow: 0.5, intensity: 1.3 }, exposure: 0.6, cloud: 0.55,
       fog: { color: 0xd0dce6, density: 0.00013 }, shadow: { center: [1020, 0, -140], size: 140 },
       grade: { lift: [0.03, 0.02, 0.01], gain: [1.08, 1.02, 0.92], sat: 0.95, contrast: 1.02 }, sunInt: 4.4, sunCol: 0xffe6c4, hemi: 0.95 },
  4: { name: 'market_street', ao: { radius: 1.2, intensity: 0.85 }, pos: [879, 3.3, 340], target: [884, 15.0, 250], fov: 64,
       sun: { az: 140, el: 36 }, env: 0.38, sky: { zenith: 0x4e88d6, horizon: 0xdce8f2, glow: 0.5, intensity: 1.3 }, exposure: 0.96, cloud: 0.6,
       fog: { color: 0xd6dcdc, density: 0.0004 }, shadow: { center: [885, 0, 280], size: 160 },
       grade: { lift: [0.035, 0.025, 0.01], gain: [1.08, 1.02, 0.92], sat: 0.98, contrast: 1.05 }, sunInt: 6.6, sunCol: 0xffd8a8, hemi: 0.55 },
};
