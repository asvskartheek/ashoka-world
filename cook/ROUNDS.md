# Cook ledger: Ashoka World

Rounds 1 to 8 happened before the Cook skill was adopted. They are back-filled from the session (outputs in `versions/`). From round 9 on, every round follows the Cook Loop.

Started: 2026-11-12 23:31 UTC (this rebuild; a first session before that was lost)
Time: floor 8h (from 2026-11-13 06:20 UTC) | cap none
Bar: composition 99.9 | light 99.9 | color 99.9 | materials 99.9 | detail 99.9 | motion 9/10
Calibration offset: pending (user: v0.8 = 65%; offset = 65 minus round-08 critic median)
Usage: Max plan, about 20% per hour, never 100%
Gate: stills approved no | final render not started
Best so far: round 08, `cook/stills/r08/`, commit 802912b

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
