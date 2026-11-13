# Version log

Each version keeps its approval stills and a reference-vs-render comparison in `versions/vX.Y/`.
Shots: 1 = city gate at sunset, 2 = palace audience hall, 3 = stupa hill with Ashoka pillar, 4 = market street with inscribed pillar.
Render times are per frame at 1448×1086 in headless Chromium with software WebGL (SwiftShader, 4 CPU cores).

| Version | Outputs | Summary |
|---|---|---|
| v0.0 | lost | First session: texture/material library and render pipeline. Lost when the cloud container was reset. |
| v0.1 | not kept | Rebuild from scratch. Textures, materials, asset library (people, elephants, oxen, carts, trees, pillars, stupa, towers, gatehouse, houses, stalls, boats), terrain, water, sky, world layout, four shot cameras. |
| v0.2 | not kept | Shot 1 camera solved from the reference landmarks (horizon, gate, moat). Moat narrowed left of the bridge so the market sits on the near bank. Ground mask Y-flip fixed (streets were rendering as grass). Hall garden moved north. |
| v0.3 | not kept | Shot 1 key light swung to light the wall face. Hall camera moved out of a column. Stupa camera pulled in to about 38 m. Cooler skies, less fog. |
| v0.4 | not kept | Replaced the physical sky with an art-directed gradient sky (blue daytime, pink/orange sunset). Stupa proportions corrected (lower drum, slimmer harmika). Stone toned from white to weathered beige. |
| v0.5 | not kept | Hall re-blocked with people placed around the camera and kept clear of columns. Throne-side figures orientation fixed. Hall column spacing 7.2 m. |
| v0.6 | not kept | Fixed a black rectangle artefact (NaN pixels spread by the bloom mip chain; added a NaN-scrub pass). Found true render times (15–35 s per frame). |
| v0.7 | [v0.7](versions/v0.7/compare.jpg) | New human generator: tapered anatomical limbs, jaw, nose, brows and lips, draped dhoti, robe, sari pleats, ribbon sashes, jewellery, contact shadows. Shadow bias fixed so legs cast shadows. Finer grass, distant ridgelines, warmer hall grading. |
| v0.8 | [v0.8](versions/v0.8/compare.jpg) | Hall: camera 14 m from the throne, smaller dais, polished-floor reflections, lotus pot at the steps, scribes with scroll desks, monks in rows at left. Stupa hill: granite boulders framing the left foreground, about 900 more countryside trees. City: gatehouse scaled up 1.2×. Town: crowd doubled, howdah elephant moved to the right foreground. |
