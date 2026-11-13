# Strategy plan after round 26 (Fable strategist, read-only review)

Estimates, not measurements. Expected total from the five moves: about +10 to +15 raw (85 to 90 calibrated). The strategist's view: 99.2 is not reachable by procedural raster alone; the bold idea is the only route it sees to get meaningfully closer.

Diagnosis (all shots): lighting is one hard PCF sun + constant hemisphere + screen-space GTAO (grey, flat shade, no warm bounce, no soft penumbrae); no anti-aliasing; empty air (single FogExp2: no sun-side in-scatter, no height haze, no depth layering); one tiling texture per surface (no building-scale variation, stains, dust, edge wear, roughness breakup).

Moves, ranked by gain per hour:
1. Photographic atmosphere and lens pass (3-4 h, +3-5): HDR depth-aware post before OutputPass: height fog with sun in-scatter (Mie lobe), radial god rays (S01, S02), halation, local contrast, per-shot grade fitted to reference statistics. Files: src/env.js, src/shots.js.
2. Accumulation renderer (4-6 h, +3-5): average N jittered sub-frames: sub-pixel AA, sun-disc jitter (soft penumbrae), lens-disc DOF, time (motion blur); a shadow-casting sky light that changes direction per sub-frame for real sky occlusion. File: src/main.js.
3. Baked bounce via an irradiance probe volume (5-6 h, +2-4, S02 and S04 most): L1 SH probes per shot in a Data3DTexture, sampled in a shared shader chunk replacing the hemisphere term. New src/gi.js.
4. Weathering layer and rule-based set dressing (6-8 h, +3-4): world-space macro albedo/roughness variation, height-driven dust band, eave streaks, triplanar detail normal; a dress() pass scattering an instanced prop kit along street edges and stall fronts; far-field S01 density; S03/S04 foreground framing.
5. People (8-12 h, +3-5): stage first (no face within about 4 m, near figures from behind, in shade or defocused); then cloth (Verlet drape or deeper pleats, weave normal, sheen), skin wrap lighting, SDF hero heads, crowd variants and clustering.

Bold idea: camera-projected hero frames for the video: one extreme-quality hero frame per shot (colour + depth), re-projected onto the geometry for slow parallax moves, re-rendering live only what moves and compositing by depth.

Process: critic noise (±4) hides 2-3 point gains; use paired A/B forced-choice critics (old vs new, same shot) or about seven critics per round.

Decision (round 27): moves 1 and 2 to two parallel builders (separate files), move 4 set dressing by the owner in src/world.js; paired A/B critics added from round 27.
