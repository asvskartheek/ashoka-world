# Cook ledger: Ashoka World

Rounds 1 to 8 happened before the Cook skill was adopted. They are back-filled from the session (outputs in `versions/`). From round 9 on, every round follows the Cook Loop.

Started: 2026-11-12 23:31 UTC (this rebuild; a first session before that was lost)
Time: floor 8h (from 2026-11-13 06:20 UTC) | cap none
Bar: composition 99.9 | light 99.9 | color 99.9 | materials 99.9 | detail 99.9 | motion 9/10
Calibration offset: +19 (user: v0.8 = 65%; round-08 critic median 46)
Usage: Max plan, about 20% per hour, never 100%
Gate: stills approved no | final render not started
Best so far: round 09, `cook/stills/r09/`

## Decisions

Made without asking, one line each.
- 2026-11-13 Adopted the Cook skill (LEONXLNX/cook @ b23cac6) at the user's request; vendored into `.claude/skills/cook`.
- 2026-11-13 `cook/` is committed to the project repo, because the user asked for every version and its outputs to be recorded on GitHub (the repo is the user's own; the references are the user's own images).
- 2026-11-13 Rendering is software WebGL (SwiftShader) on 4 CPU cores in a cloud container: about 20 to 50 s per still at 1448×1086, measured.

- 2026-11-13 06:20 Repo not made public yet: all earlier commits carry the user's personal email as author; rewriting them needs a force-push, which the harness blocked as destructive. New commits use the GitHub no-reply address. Publishing waits for the user's decision.

## User feedback inbox

Exact words. Close an item only when a still or clip proves it.
- 2026-11-13 06:20 "continue at 8hrs. v0.8 is at 65%. we have max use upto 20%/hr its ok. we'll discuss rendering later once crossing 99.2%. visibility public" | intake | done except visibility (blocked, see Decisions)
- 2026-11-12 "99.9% match to references in composition/scale/materials/colors, cinematic realism, detailed everywhere, realistic water/waterfalls" | standing | open
- 2026-11-12 "1-minute cinematic 4K 30fps showcase video, slow camera moves, no text, impressive opening, free licensed music with artist credit" | ship | open
- 2026-11-13 "We will talk about rendering budgets later, and 5 reference images I will give for you later." | open (5 references pending)
- 2026-11-13 "Keep a record of the versions and version outputs somewhere in the GitHub." | done, proof: `VERSIONS.md`, `versions/`, this ledger

---

## Rounds 01 to 07 (back-filled, pre-Cook)

See `VERSIONS.md` for one line per round. Outputs survive only for round 07 (`versions/v0.7/`). No critics were run. Scores were not recorded.

## Round 08 (back-filled, pre-Cook)

Focus: S02 hall composition, S03 foreground, user request to continue.
Changes: hall camera 14 m from the throne, smaller dais, floor reflections, lotus pot, scribes with scroll desks, monk rows; stupa-hill boulders and about 900 countryside trees; gatehouse ×1.2; town crowd doubled.
Stills: `cook/stills/r08/` | Side by side: `cook/compare/r08/all.jpg`
Scores: not measured (no critics in pre-Cook rounds).
Measured (tools/color_check.py, render minus reference, 4×4 grid):
- S01: saturation +0.291 (worst +0.488), brightness -0.136 (worst -0.341)
- S02: saturation +0.005 (worst +0.357), brightness -0.090 (worst -0.367)
- S03: saturation +0.029 (worst +0.314), brightness -0.066 (worst -0.231)
- S04: saturation +0.027 (worst +0.191), brightness -0.099 (worst -0.301)
- Render: 41 / 49 / 23 / 25 s per still (S01 to S04) at 1448×1086, 1 sample.
Next focus: round 09, first Cook round, after intake.

## Calibration (round 08)

3 fresh-context critics (general-purpose, sonnet, haiku), images and rubric only. Medians, eyeballed:

| Shot | Comp | Light | Color | Materials | Detail | Mean |
|---|---|---|---|---|---|---|
| S01 | 62 | 45 | 48 | 35 | 30 | 44 |
| S02 | 60 | 50 | 55 | 30 | 28 | 45 |
| S03 | 70 | 50 | 55 | 45 | 38 | 52 |
| S04 | 55 | 45 | 50 | 35 | 30 | 43 |

Raw overall about 46. User estimate for v0.8: 65. Calibration offset: +19 (critics are harsher than the user). Calibrated = raw + 19.

## Round 09

Time: 06:20 to 06:55 UTC | elapsed 0.6h of 8h floor
Usage: not readable
Focus: colour and light in all shots, because the measured colour check showed the largest gaps (S01 +0.29 saturation, all shots too dark).
Changes:
- S01: pastel sunset sky, sat 0.78, exposure up, key light raised to 17°.
- S02 to S04: exposure up 15 to 25%, warmer grades, softer lighter daytime skies, more fill light.
- Stupa brick less saturated, more weathering.
- Harness: `tools/round.sh` (stills, side-by-side, colour check), `tools/color_grid.py` (per-cell deltas).
Stills: `cook/stills/r09/` | Side by side: `cook/compare/r09/all.jpg`
Scores, eyeballed: critic median (3 critics: general-purpose, sonnet, haiku), raw then calibrated (+19)

| Shot | Comp | Light | Color | Materials | Detail | Mean raw | Calibrated | vs r08 |
|---|---|---|---|---|---|---|---|---|
| S01 | 62 | 35 | 50 | 40 | 25 | 42 | 61 | -2 |
| S02 | 60 | 40 | 55 | 35 | 25 | 43 | 62 | -2 |
| S03 | 78 | 55 | 62 | 50 | 38 | 57 | 76 | +5 |
| S04 | 65 | 55 | 58 | 40 | 28 | 49 | 68 | +6 |

Overall raw 48, calibrated 67.
Measured (tools/color_check.py, render minus reference):
- S01: saturation -0.054, brightness -0.046
- S02: saturation -0.103, brightness -0.014
- S03: saturation -0.050, brightness +0.002
- S04: saturation -0.006, brightness -0.029
Top gaps from critics: S01 lost its visible sun (light fell); people and near-field props are the weakest everywhere; S02 back wall and banner are wrong.
Stop check: bar no | floor no | stills approved no | final no -> next round

## Round 10

Time: 06:55 to 07:35 UTC | elapsed 1.3h
Focus: S04 composition (weakest shot by mean at r08), depth over breadth.
Changes:
- New second stupa hill (HILL2) behind the town gate with a white plastered stupa, trees and the hill pavilion; terrain blends smoothly into the town.
- Street narrowed to about 17 m between facades; gate 70 m closer and ×1.15; flat-roof boxes removed from the street front.
- Pillar enlarged and moved to the left third, 19 m from camera; stalls, carts, elephants, crowd moved to the shorter street; crowd types mixed (saris, robes, soldiers, nobles).
- S01 sun moved toward the frame (az 161), sun disc enlarged.
Stills: `cook/stills/r10/` | Side by side: `cook/compare/r10/all.jpg`
Scores, eyeballed: critic median (3 critics), raw then calibrated (+19)

| Shot | Comp | Light | Color | Materials | Detail | Mean raw | Calibrated | vs r09 |
|---|---|---|---|---|---|---|---|---|
| S01 | 60 | 35 | 50 | 30 | 25 | 40 | 59 | -2 |
| S02 | 55 | 30 | 40 | 25 | 25 | 35 | 54 | -8 (render unchanged: critic noise) |
| S03 | 70 | 55 | 60 | 45 | 38 | 54 | 73 | -3 |
| S04 | 55 | 45 | 50 | 35 | 25 | 42 | 61 | -7 |

Overall raw 43, calibrated 62. Lower than r09. Two causes: (1) a real regression, the non-uniform pillar scale squashed the S04 lion capital into a blob; the S01 sun is still just above the frame top. (2) Critic noise: S02 was not changed and dropped 8 points, so the per-round noise is about ±5 to 8. From here, judge trends over two rounds and per-dimension, not a single round mean.
Measured: S01 sat +0.062 bright -0.013; S02 sat -0.103 bright -0.013; S03 sat -0.043 bright -0.003; S04 sat +0.021 bright -0.063.
Top gaps from critics: 1) people and near-field props (all shots, worst in S02); 2) S02 back wall, flat banner, mirror floor, slatted ceiling; 3) S01 no sun, flat foreground lawn, mirror moat.
Best so far: round 09.
Stop check: bar no | floor no | stills approved no | final no -> next round
Next focus: round 11 fixes the regressions (pillar girth parameter, S01 sun framing), then S02 hall in depth.
