// Camera + lighting presets matched to each reference image.
export const SHOTS = {
  1: { name: 'city_gate_sunset', pos: [-4, 42, 104], target: [2, 9.2, -3], fov: 38,
       sun: { az: 152, el: 3.2 }, light: { az: 62, el: 11 }, sky: { zenith: 0x5a6a9a, horizon: 0xf0b8a0, band: 0xffa070, bandAmt: 0.9, glow: 2.2, sunCol: 0xffc890, intensity: 1.3 }, exposure: 0.85, cloud: 0.6,
       fog: { color: 0xe8b8a0, density: 0.00022 }, shadow: { center: [40, 0, -120], size: 420 },
       grade: { lift: [0.03, 0.01, 0.02], gain: [1.08, 0.98, 0.9], sat: 1.12, contrast: 1.06 }, sunInt: 3.2, sunCol: 0xffb07a, hemi: 0.5 },
  2: { name: 'palace_hall', pos: [134.2, 4.6, -307.8], target: [158, 3.7, -316.5], fov: 62,
       sun: { az: -140, el: 34 }, env: 0.6, sky: { zenith: 0x4a7ac8, horizon: 0xd8e4ee, glow: 0.4, intensity: 1.3 }, exposure: 0.75, cloud: 0.62,
       fog: { color: 0xc8d4dc, density: 0.0012 }, shadow: { center: [130, 0, -315], size: 110 },
       grade: { lift: [0.03, 0.015, 0.0], gain: [1.1, 1.0, 0.86], sat: 1.12, contrast: 1.06 }, sunInt: 5.0, sunCol: 0xffd8a8, hemi: 0.7 },
  3: { name: 'stupa_hill', pos: [1027, 0, -147], target: [1004, 0, -124], eye: 1.7, tdy: 7.5, fov: 58,
       sun: { az: 95, el: 38 }, sky: { zenith: 0x4a78c4, horizon: 0xd4e0ea, glow: 0.4, intensity: 1.35 }, exposure: 0.5, cloud: 0.64,
       fog: { color: 0xb8cce0, density: 0.00012 }, shadow: { center: [1020, 0, -140], size: 140 },
       grade: { lift: [0.01, 0.01, 0.02], gain: [1.03, 1.0, 0.96], sat: 1.06, contrast: 1.05 }, sunInt: 4.2, sunCol: 0xfff2dc, hemi: 0.8 },
  4: { name: 'market_street', pos: [879, 2.1, 340], target: [884, 7.5, 250], fov: 60,
       sun: { az: 135, el: 52 }, sky: { zenith: 0x5282c8, horizon: 0xdce6ee, glow: 0.4, intensity: 1.35 }, exposure: 0.5, cloud: 0.64,
       fog: { color: 0xc0d0e2, density: 0.00025 }, shadow: { center: [885, 0, 280], size: 160 },
       grade: { lift: [0.02, 0.015, 0.01], gain: [1.05, 1.0, 0.94], sat: 1.06, contrast: 1.05 }, sunInt: 4.5, sunCol: 0xfff0d8, hemi: 0.85 },
};
