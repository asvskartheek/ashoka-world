# Version log

From round 9 on, the detailed ledger is `cook/ROUNDS.md` (Cook Loop). This file keeps one line per version.

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
| v0.9 | [v0.9](versions/v0.9/compare.jpg) | Cook round 09: colour and light matched to measured per-region deltas (S01 saturation +0.29 to -0.05). Critic median raw 48 / calibrated 67. |
| v0.10 | [v0.10](versions/v0.10/compare.jpg) | Cook round 10: S04 street restructure (second stupa hill, narrower street, closer gate, bigger pillar, mixed crowd). Regression: squashed lion capital. Raw 43 / calibrated 62. |
| v0.11 | [v0.11](versions/v0.11/compare.jpg) | Cook round 11: pillar girth parameter (lion capital fixed), open hall with hanging banner. Raw 46 / calibrated 65. |
| v0.12 | [v0.12](versions/v0.12/compare.jpg) | Cook round 12: flat north horizon, near-bank ground mask bug fixed, murky moat, thin chhatra discs, bluer S03 sky. Not separately scored. |
| v0.13 | [v0.13](versions/v0.13/compare.jpg) | Cook round 13: S02 hall in depth (longer lens, throne one bay deeper, carved throne, bigger king, column rings, chauri, gong, warm floor). Raw 48.5 / calibrated 67.5, best so far. |
| v0.14 | [v0.14](versions/v0.14/compare.jpg) | Cook round 14: S01 near bank rebuilt to R01's layout (diagonal bridge, market road, huts and timber yard in frame), taller watchtowers, orange sun disc, greener city. Raw 47 / calibrated 66. |
| v0.15 | [v0.15](versions/v0.15/compare.jpg) | Cook round 15: new procedural people (anatomy, faces, hair, turbans, real drapery) from a parallel builder; S03 reframed; S04 pillar closer with foreground crowd and street goods; S01 golden light and boats; S02 garden court. Raw 53 / calibrated 72, best so far. |
| v0.16 | [v0.16](versions/v0.16/compare.jpg) | Cook round 16: procedural materials upgrade from a parallel builder (teak grain and flutes, weathered plaster, barrel tiles, bark, brick courses, polished sandstone, layered thatch); S02 scribes and king; S03 dry grass. Raw 55 / calibrated 74, best so far. |
| v0.17 | [v0.17](versions/v0.17/compare.jpg) | Cook round 17: S04 elephant to foreground, S03 taller terrace, S01 thinner haze. Regression on S04. Raw 50 / calibrated 69. |
| v0.18 | [v0.18](versions/v0.18/compare.jpg) | Cook round 18: S04 regression fixed (higher camera, railing at frame bottom, elephant mid-distance). Raw 53 / calibrated 72. |
| v0.19 | [v0.19](versions/v0.19/compare.jpg) | Cook round 19: S02 daylight, glossier floor, smaller banner; bluer skies. Raw 52 / calibrated 71. |
| v0.20 | [v0.20](versions/v0.20/compare.jpg) | Cook round 20: GTAO ambient occlusion, sculpted lion capitals (builder). Raw 51 / calibrated 70 (critics split by 10-20 points). |
| v0.21 | [v0.21](versions/v0.21/compare.jpg) | Cook round 21: physical skin and cloth sheen, larger sun disc, S03 path ground. Raw 55.8 / calibrated 75 (median of 3 critics), best so far. |
| v0.22 | [v0.22](versions/v0.22/compare.jpg) | Cook round 22: S04 blue sky with white clouds, lit gate passage, softer dado; S02 shallower dais. Raw 55.9 / calibrated 75 (median of 3), best so far. |
| v0.23 | [v0.23](versions/v0.23/compare.jpg) | Cook round 23: close-range seated people (builder), darker skin, white-clad king, denser S01 city and boats. Raw 54 / calibrated 73. |
| v0.24 | [v0.24](versions/v0.24/compare.jpg) | Cook round 24: S02 reframed like R02 (huge foreground monks and scribes, seated eye height). Raw 56.1 / calibrated 75, best so far. |
| v0.25 | [v0.25](versions/v0.25/compare.jpg) | Cook round 25: S04 directional sun and shopfront textiles. Raw 52.7 / calibrated 72 (unchanged shots dropped 4 to 5 points: critic noise). |
| v0.26 | [v0.26](versions/v0.26/compare.jpg) | Cook round 26: rebuilt timber gatehouse and braced watchtowers (builder), S03 overhanging canopy, S04 stall in frame. Raw 59.3 / calibrated 78, best so far. |
| v0.27 | [v0.27](versions/v0.27/compare.jpg) | Cook round 27: atmosphere and lens pass, accumulation renderer (spp 8), set dressing. Raw 53 / calibrated 72; A/B: S03 better, S01 and S02 worse (haze, cold floor). |
| v0.28 | [v0.28](versions/v0.28/compare.jpg) | Cook round 28: S01 lighter haze, S02 warmer floor (keeps accumulation, atmosphere, set dressing). Raw 60.1 / calibrated 79, best so far. |
