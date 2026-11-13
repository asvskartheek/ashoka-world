// Camera + lighting presets matched to each reference image.
export const SHOTS = {
  1: { name: 'city_gate_sunset', pos: [-4, 42, 104], target: [2, 11.3, -3], fov: 38,
       sun: { az: 161, el: 2.3 }, light: { az: 60, el: 17 }, sky: { zenith: 0x8a98bc, horizon: 0xf6c8b0, band: 0xffb088, bandAmt: 0.8, glow: 2.4, sunCol: 0xffd8a0, intensity: 1.2 }, exposure: 1.15, cloud: 0.62,
       fog: { color: 0xe6cfc4, density: 0.00034 }, shadow: { center: [40, 0, -120], size: 420 },
       grade: { lift: [0.04, 0.025, 0.03], gain: [1.07, 1.0, 0.92], sat: 0.88, contrast: 1.03 }, sunInt: 3.8, sunCol: 0xffbe88, hemi: 0.8 },
  2: { name: 'palace_hall', pos: [148, 4.55, -307.8], target: [158, 4.1, -318.5], fov: 62,
       sun: { az: -140, el: 34 }, env: 0.6, sky: { zenith: 0x4a7ac8, horizon: 0xd8e4ee, glow: 0.4, intensity: 1.3 }, exposure: 0.95, cloud: 0.62,
       fog: { color: 0xc8d4dc, density: 0.0012 }, shadow: { center: [130, 0, -315], size: 110 },
       grade: { lift: [0.05, 0.035, 0.01], gain: [1.1, 1.02, 0.9], sat: 1.0, contrast: 1.02 }, sunInt: 5.0, sunCol: 0xffd8a8, hemi: 1.1 },
  3: { name: 'stupa_hill', pos: [1027, 0, -147], target: [1004, 0, -124], eye: 1.7, tdy: 7.5, fov: 58,
       sun: { az: 95, el: 38 }, sky: { zenith: 0x7aa2d4, horizon: 0xe6e6e0, glow: 0.5, intensity: 1.3 }, exposure: 0.6, cloud: 0.58,
       fog: { color: 0xd8dcd8, density: 0.00024 }, shadow: { center: [1020, 0, -140], size: 140 },
       grade: { lift: [0.03, 0.02, 0.01], gain: [1.08, 1.02, 0.92], sat: 0.95, contrast: 1.02 }, sunInt: 4.4, sunCol: 0xffe6c4, hemi: 0.95 },
  4: { name: 'market_street', pos: [880, 2.2, 346], target: [884, 7.6, 250], fov: 58,
       sun: { az: 135, el: 52 }, sky: { zenith: 0x6a98d4, horizon: 0xe4e8e8, glow: 0.5, intensity: 1.3 }, exposure: 0.62, cloud: 0.6,
       fog: { color: 0xd6dcdc, density: 0.0004 }, shadow: { center: [885, 0, 280], size: 160 },
       grade: { lift: [0.03, 0.02, 0.01], gain: [1.07, 1.02, 0.93], sat: 1.0, contrast: 1.02 }, sunInt: 4.5, sunCol: 0xffe8c8, hemi: 1.05 },
};
