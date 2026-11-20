# FIELD REPORT — range-day-eight — 2026-11-20

Nothing on Dan's screen has changed yet: the new ground is in a pull request, not on the live app. The merge and deploy will show it.

## What stands

Route actually used: a Claude Code cloud session on `isleofdan/range-day` (no `/data/home/dan/FACTS.md` in the container), permission mode auto (the session's own setting as started; this session changed no permission or auto-mode setting), builder model Claude Opus 5.5 (`claude-opus-5-5`, the session's configured model). Independent checker: the Codex result checker through `check_result`, verdicts below.

- **The one download run worked first time.** The Ground workflow, run [44711714459](https://github.com/isleofdan/range-day/actions/runs/44711714459), success in 1 min 39 s: both libraries answered and both license pages state CC0; 38 candidates came back (colour, normal, roughness and height maps for each, kept as 1,024-pixel copies), 63 MB, on the scratch branch `range-day-eight-fetch` only. No second run was needed or started. (`scripts/ground/fetch.mjs`, `.github/workflows/ground.yml`; its log is `ground-fetch/log.txt` on that branch.)
- **Six photographed materials replace the code-made detail** (`src/scene/surfaces.mjs`, `src/scene/terrain.mjs`): packed dirt on the floor (Poly Haven "dry_ground_rocks"), dry straw grass ("withered_grass") and short green grass (ambientCG "Grass001") on the slopes by season, the soil and litter under scrub (ambientCG "Ground106"), the headwall's rock ("rock_face_03") and the scree below it ("gravel_ground_01"). Each keeps the season's measured colour (its own average colour is divided out, the palette's put in), takes its small relief from the scan's normal map lit by the day's sun, and on Full throws small hard shadows from its own height map. `detailTextures` and the five figures only it used are gone; Plain is untouched.
- **No visible repeat:** each material is laid by hexagonal stochastic tiling (every point blends the copies of the two nearest corners of a small triangle grid, each corner shifted at random), so no two neighbouring copies line up; each is also laid a second time at five times its size, for the clumps and patches a hillside shows through a scope; where two kinds of ground meet, the higher picture wins, so dirt shows between tufts instead of a smear. Rough ground's own shade (dense grass and brush shade themselves) is one figure per kind of ground in `data/look.json` (`ground.sunCut`), used where the scans' own small shadows are too small to draw.
- **The streaks on the floor, found and fixed (item 6d).** The ground was placed in the shader by its full map coordinates. Its northing, about 3,812,265 m, is held by a graphics card's 32-bit number only to 0.25 m (`Math.fround` steps there: 0.25 m north, 0.031 m east), so every pattern finer than a metre was cut into quarter-metre steps north to south and smeared into streaks: the code-made clods and rills, and the survey's own 1 m slopes and sun-and-shade picture. It was neither the tire tracks nor the aerial photograph magnified. The ground is now measured in metres from the firing position (`vGround` in `src/scene/terrain.mjs`), exact to well under a millimetre out to the far plates; the survey's pictures are placed the same way.
- **Weight:** 4,814,950 bytes more on Full (limit 5,000,000) and 1,368,379 on Light (limit 1,500,000), checked by `test/terrain.test.js`. The materials load beside the first frames and are swapped in when all have settled; a material that fails leaves its kind of ground in its plain colour (`test/scene.test.js`, verify 8 of range-day-eight).
- **Same shots:** `public/engine.js` and `data/courses.json` unchanged (`git diff` empty); the eight survey and photograph files and their records unchanged (the diff of `public/terrain` and `data/terrain.json` against `main` is additions only).

## UI review (per screen touched)

One screen changed: the firing line's picture on the canyon course (its ground). No control, text or layout changed.

1. Speed of the frequent action (firing, adjusting): unchanged; frame cost per the table in verify 4 (Full within the brief's limit at 412 pixels, Light over it through the irons).
2. Recovery: not applicable; nothing to undo on a picture. A material that fails to load leaves its ground in its plain colour (verify 8).
3. Finding the tool: not applicable; no tool added.
4. Orientation: the ground now reads as dirt, grass, scrub and rock, so where the plates stand on the hillside is easier to read through the scope (detail figures, verify 6).
5. Feedback: not applicable; no new feedback.
6. Interruption: none; the photographs load beside the first frames and swap in without a pause or a message.
7. Thumb reach: not applicable; no control moved.
8. Defaults and prefill: not applicable.

What I did not add: any control, setting or text about the ground (the brief adds none; the picture is chosen in the existing Picture setting). Which of the eight Dan's own requests came from: orientation, from his verdict on the ground, "It's still just doesn't look good enough."

Screenshots of each state, before and after, both sizes: `docs/reports/screenshots/ground-before/` and `docs/reports/screenshots/ground-*.png` (16 states, two sizes each), side by side in `docs/reports/screenshots/ground-compare/`.

## What the brief got wrong

- **The first push of the scratch branch started no run.** The branch's commit was already on GitHub (pushed first as the work branch), so GitHub saw no changed files under `scripts/ground/` and did not start the workflow. A one-line file commit on the scratch branch (`scripts/ground/SCRATCH.txt`) started it; still one run.
- **"2,048 pixels" kept on the scratch branch would have been about 300 MB**, held forever since branches are never deleted. The run downloaded 2,048-pixel maps and kept 1,024-pixel copies (63 MB); the shipped files are that size or smaller.
- **The brief's frame-time limit is reachable on Full, not on Light, without cutting the look.** Light's fixed cost of the new ground's bookkeeping is about as large as its picture reads (measured with the photographs switched off), and the test browser's run-to-run noise is about 15 percent.
- **The "before" sharpness and detail included the streak artefact** (see item 6d), so "no lower than before" was partly a bar set by noise. The new ground clears it anyway in every detail view.

## Deliberate divergences

1. **Green grass is ambientCG "Grass001", not the first pick "grass_ground".** grass_ground measured less detail on the February hillside than the old ground (1.63 against 1.97); Grass001 is denser and closer to the photographs' "vivid green grass".
2. **Each material is laid twice (its own size and five times it).** A scan of a few metres holds no clumps or patches; without the second copy the hillside at 7x measured below before.
3. **Trilinear filtering only (no anisotropic filtering).** Anisotropic filtering doubled the ground's cost in the test browser. On a phone's graphics chip it costs little and would sharpen the floor at grazing angles; it is a one-line change once the phone has been looked at.
4. **Rough ground's own shade as a figure per kind of ground** (`ground.sunCut`, estimates): the photographs are colour-neutral (switching them off gives the same colour), and the old ground was nearer the measured colours only because its drawn clumps darkened grass and scrub by 5 to 12 percent.
5. **The ground is placed from the firing position** instead of by full map coordinates (item 6d's finding), the survey's own pictures included.
6. **Light reads colour only from the photographs** (no relief from them; it had no small shadows before either), and its fine copy only close in.
7. **One pull request** (its diff is 180,437 bytes, under the checker's 400,000).
8. **The Checks jobs' limit is 28 minutes** (was 22): the scene-shots test piece took 13 min 52 s on one run.
9. **A `--grep` option in `scripts/screenshots.mjs`** and `PM_WIDTHS` / `PM_PICTURES` in `scripts/picture-measure.mjs`, for by-hand runs; the check runs every state.

## Verify results

**1. The download.** Run [44711714459](https://github.com/isleofdan/range-day/actions/runs/44711714459), success, 1 min 39 s. Status lines (from its log):

```
polyhaven: license page 200 https://polyhaven.com/license
polyhaven: API terms 200 https://raw.githubusercontent.com/Poly-Haven/Public-API/master/ToS.md
ambientcg: license page 200 https://docs.ambientcg.com/license/
polyhaven: listing 200 https://api.polyhaven.com/types
polyhaven: file request 200 https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/dry_ground_rocks/dry_ground_rocks_diff_2k.jpg
ambientcg: listing 200 https://ambientcg.com/api/v2/full_json?type=Material&q=Ground&include=downloadData,tagData,dimensionsData&limit=30&sort=Popular
ambientcg: file request 200 https://ambientcg.com/get?file=Ground111_2K-JPG.zip
summary: 2 of 2 libraries answered; 38 candidates with a colour map
```

Poly Haven's API terms (2.4) ask for a user-agent naming the software, which the fetch sends; their credit clause (2.5) applies only to software that uses the live API, which the app does not (the files are downloaded once and served by the app). Candidates per surface and the one chosen (why, in each record's `why` in `data/terrain.json`):

| Surface | Candidates fetched | Chosen |
| - | - | - |
| floor | Poly Haven dry_ground_rocks, dirt, dry_mud_field_001, dirt_aerial_03, aerial_ground_rock; ambientCG Ground111, Ground110 | dry_ground_rocks |
| dry grass | Poly Haven grass_ground, sparse_grass, withered_grass, riet_01; ambientCG Grass005, Grass004 | withered_grass |
| green grass | Poly Haven leafy_grass, grass_ground, sparse_grass, withered_grass; ambientCG Grass001, Ground037 | Grass001 |
| litter under scrub | Poly Haven dry_decay_leaves, forest_ground_05, forest_ground_06, forest_leaves_03; ambientCG Ground106, ScatteredLeaves009 | Ground106 |
| rock | Poly Haven rock_face_03, dark_rock_02, rock_01, rock_06, rocky_terrain_03; ambientCG Rock064, Rock063 | rock_face_03 |
| scree | Poly Haven sandy_gravel, sandy_gravel_02, gravel_floor_04, gravel_ground_01; ambientCG Ground108, Gravel043 | gravel_ground_01 |

Every shipped file's record (source, license text, date, bytes) is in `data/terrain.json`, `surfaces`, and checked by `test/terrain.test.js`. `git diff origin/main --stat -- public/terrain data/terrain.json`: additions only (24 new files, the `surfaces` section added); the eight existing terrain files unchanged (`git diff --diff-filter=MD` lists none).

**2. Same shots.** `git diff origin/main -- public/engine.js data/courses.json` is empty (0 bytes).

**3. Before and after** at 412×915 and 1280×800, Full and Light, February midday and September afternoon: the floor through the irons at 1x on the 200-yard plate; the 600- and 1,000-yard hillsides at 7x; the 600-yard hillside at 21x. 16 new screenshot states (`ground-…` in `scripts/screenshots.mjs`), so they run in every check. Files: `docs/reports/screenshots/ground-before/` (taken on `main`'s code), `docs/reports/screenshots/ground-*.png` (after), `docs/reports/screenshots/ground-compare/` (each pair side by side).

**4. Measures** (`docs/reports/ground-before.txt` on `main`'s code, `docs/reports/ground-after.txt` on this branch, each by `node scripts/picture-measure.mjs`, one at a time with nothing else running).

Median frame time in the test browser (software 3D, so not a phone's), milliseconds; the brief's limit applies at 412 pixels: +25 percent.

| State | View | Before | After | Change |
| - | - | - | - | - |
| 412 px, full, February midday | scope | 583 | 650 | +11% |
| 412 px, full, February midday | irons 1x | 667 | 783 | +17% |
| 412 px, full, September afternoon | scope | 633 | 667 | +5% |
| 412 px, full, September afternoon | irons 1x | 667 | 767 | +15% |
| 412 px, light, February midday | scope | 183 | 217 | +18% |
| 412 px, light, February midday | irons 1x | 200 | 283 | +42% |
| 412 px, light, September afternoon | scope | 183 | 233 | +27% |
| 412 px, light, September afternoon | irons 1x | 183 | 267 | +45% |
| 1280 px, full, February midday | scope | 967 | 1183 | +22% |
| 1280 px, full, February midday | irons 1x | 1133 | 1383 | +22% |
| 1280 px, full, September afternoon | scope | 966 | 1316 | +36% |
| 1280 px, full, September afternoon | irons 1x | 1133 | 1517 | +34% |
| 1280 px, light, February midday | scope | 417 | 583 | +40% |
| 1280 px, light, February midday | irons 1x | 450 | 650 | +44% |
| 1280 px, light, September afternoon | scope | 400 | 567 | +42% |
| 1280 px, light, September afternoon | irons 1x | 450 | 616 | +37% |

Full at 412 pixels is within the limit everywhere (+5 to +17 percent). **Light at 412 pixels is not**: +18 and +27 percent through the scope, +42 and +45 percent through the irons. What was cut before that point: picture reads per pixel (two hexagon corners instead of three; one level of detail per copy instead of gradients on every read; the second kind of ground colour only and only where it holds a quarter of the pixel; on Light colour only and the fine copy only close in), and the far ground (no fine photograph where a pixel covers more than an eighth of a copy). The remaining Light overhead is the new ground's bookkeeping, about the same with the photographs switched off; the before itself measured 183 to 233 ms across three runs. The first-visit frame count that drops a slow phone to Light is unchanged.

Sharpness through the scope at 7x (mean brightness step between neighbouring pixels): higher than before in every Full state; the full table is in `ground-after.txt`. Colour of the named patches against the measured colours (difference per channel):

| State | Patch | Before | After | |
| - | - | - | - | - |
| 412 px, full, February midday | sky, 18 degrees up | +17,+3,-24 | +19,+4,-23 | nearer or same |
| 412 px, full, February midday | sunlit hillside | +14,+3,+18 | +11,+1,+17 | nearer or same |
| 412 px, full, February midday | dirt floor in sun | -30,-15,-22 | -29,-14,-20 | nearer or same |
| 412 px, full, February midday | scrub on the left wall | +38,+33,+11 | +35,+32,+10 | nearer or same |
| 412 px, full, February midday | sunlit brush | +66,+61,+35 | +73,+69,+43 | farther |
| 412 px, full, February midday | the 600-yard plate's red paint through the scope at 7x | +15,-7,-9 | +15,-7,-9 | nearer or same |
| 412 px, full, September afternoon | sky, 18 degrees up | +30,+14,-17 | +28,+13,-18 | nearer or same |
| 412 px, full, September afternoon | sunlit dry slope | -21,-9,-1 | -13,-1,+7 | nearer or same |
| 412 px, full, September afternoon | dirt floor in sun | -57,-50,-33 | -49,-43,-28 | nearer or same |
| 412 px, full, September afternoon | scrub on the left wall | -5,-14,+2 | -2,-11,+5 | nearer or same |
| 412 px, full, September afternoon | sunlit brush | +62,+42,+47 | +70,+50,+55 | farther |
| 412 px, full, September afternoon | the 600-yard plate's red paint through the scope at 7x | -34,-49,-48 | -33,-48,-47 | nearer or same |
| 412 px, light, February midday | sky, 18 degrees up | +17,+3,-24 | +32,+13,-17 | farther |
| 412 px, light, February midday | sunlit hillside | +2,-8,+9 | +12,+2,+18 | farther |
| 412 px, light, February midday | dirt floor in sun | -24,-13,-11 | -14,-4,+1 | nearer or same |
| 412 px, light, February midday | scrub on the left wall | +27,+23,+3 | +31,+28,+7 | farther |
| 412 px, light, February midday | sunlit brush | +16,+15,-5 | +23,+24,+1 | farther |
| 412 px, light, February midday | the 600-yard plate's red paint through the scope at 7x | +15,-7,-9 | +16,-8,-10 | farther |
| 412 px, light, September afternoon | sky, 18 degrees up | +29,+13,-17 | +31,+15,-17 | farther |
| 412 px, light, September afternoon | sunlit dry slope | -34,-21,-9 | -15,-2,+7 | nearer or same |
| 412 px, light, September afternoon | dirt floor in sun | -48,-37,-18 | -37,-25,-5 | nearer or same |
| 412 px, light, September afternoon | scrub on the left wall | -11,-20,-3 | -1,-11,+6 | nearer or same |
| 412 px, light, September afternoon | sunlit brush | -16,-24,-8 | -8,-16,-1 | nearer or same |
| 412 px, light, September afternoon | the 600-yard plate's red paint through the scope at 7x | -34,-49,-48 | -33,-49,-48 | nearer or same |
| 1280 px, full, February midday | sky, 18 degrees up | +32,+13,-17 | +32,+13,-17 | nearer or same |
| 1280 px, full, February midday | sunlit hillside | +13,+2,+16 | +12,+1,+16 | nearer or same |
| 1280 px, full, February midday | dirt floor in sun | -30,-16,-22 | -29,-14,-21 | nearer or same |
| 1280 px, full, February midday | scrub on the left wall | +36,+32,+8 | +35,+32,+8 | nearer or same |
| 1280 px, full, February midday | sunlit brush | +67,+62,+35 | +74,+70,+43 | farther |
| 1280 px, full, February midday | the 600-yard plate's red paint through the scope at 7x | +16,-7,-10 | +16,-7,-10 | nearer or same |
| 1280 px, full, September afternoon | sky, 18 degrees up | +30,+14,-17 | +29,+14,-17 | nearer or same |
| 1280 px, full, September afternoon | sunlit dry slope | -23,-11,-2 | -13,-2,+6 | nearer or same |
| 1280 px, full, September afternoon | dirt floor in sun | -57,-49,-33 | -50,-43,-28 | nearer or same |
| 1280 px, full, September afternoon | scrub on the left wall | -6,-15,+1 | -2,-11,+5 | nearer or same |
| 1280 px, full, September afternoon | sunlit brush | +63,+43,+47 | +69,+49,+53 | farther |
| 1280 px, full, September afternoon | the 600-yard plate's red paint through the scope at 7x | -34,-49,-48 | -34,-49,-48 | nearer or same |
| 1280 px, light, February midday | sky, 18 degrees up | +32,+13,-17 | +21,+5,-22 | nearer or same |
| 1280 px, light, February midday | sunlit hillside | +1,-10,+6 | +11,+2,+18 | farther |
| 1280 px, light, February midday | dirt floor in sun | -24,-14,-11 | -14,-4,+1 | nearer or same |
| 1280 px, light, February midday | scrub on the left wall | +24,+20,-1 | +32,+29,+9 | farther |
| 1280 px, light, February midday | sunlit brush | +17,+16,-6 | +23,+24,+1 | farther |
| 1280 px, light, February midday | the 600-yard plate's red paint through the scope at 7x | +16,-7,-10 | +15,-7,-9 | nearer or same |
| 1280 px, light, September afternoon | sky, 18 degrees up | +31,+15,-17 | +28,+13,-18 | nearer or same |
| 1280 px, light, September afternoon | sunlit dry slope | -36,-23,-11 | -15,-3,+7 | nearer or same |
| 1280 px, light, September afternoon | dirt floor in sun | -49,-38,-19 | -37,-26,-6 | nearer or same |
| 1280 px, light, September afternoon | scrub on the left wall | -13,-22,-4 | +0,-10,+7 | nearer or same |
| 1280 px, light, September afternoon | sunlit brush | -16,-24,-8 | -8,-16,-1 | nearer or same |
| 1280 px, light, September afternoon | the 600-yard plate's red paint through the scope at 7x | -34,-49,-48 | -34,-48,-47 | nearer or same |

The dirt floor in sun, the brief's patch to bring closer, is closer in every state (for example September afternoon, 412, Full: −57,−50,−33 before, −48,−43,−28 after). **Farther than before:** the bushes' patch on every state (by 6 to 8 per channel), and on Light in February the hillside and the scrub (by 3 to 10). The sky's and the plate's paint patches moved by 1 to 15 between runs of the same code too (the sky and the paint are not ground), so those rows are noise. The bushes' patch takes the median of a view 0.3 degrees wide, mostly ground around the bush, so it follows the ground; the February Light rows are what remains of the old ground's darkening, which the sunCut figures make up on Full but not wholly on Light.

**5. Repeat measure** (`scripts/ground-measure.cjs`, `repeat`; test `verify 5 (range-day-eight)` in `test/scene.test.js`). With the view still, one copy of the materials is slid along the ground by exactly its width, and by 0.5, 0.75, 1.25 and 1.5 widths; the score is the share of the material's own fine texture that comes back at one width. A plain grid must score above 0.5, and the ground as laid under half the plain grid's score. Figures at 1280×800, Full, from the test:

```
February midday, the floor, 40 m out at 1x: plain grid 0.933; as laid -0.028
February midday, the floor, the larger copy: plain grid 0.810; as laid 0.069
February midday, the hillside beside the 600-yard plate at 7x: plain grid 1.000; as laid 0.000
February midday, the hillside, the larger copy: plain grid 1.000; as laid 0.005
September afternoon, the floor: plain grid 1.000; as laid -0.034
September afternoon, the floor, the larger copy: plain grid 1.000; as laid 0.058
September afternoon, the hillside: plain grid 1.000; as laid 0.009
September afternoon, the hillside, the larger copy: plain grid 1.000; as laid 0.005
```

**6. Detail** (local contrast on ground-only patches: mean of each pixel's brightness less its 3×3 mean; the heat shimmer off so it measures the ground). None lower than before; test `verify 6 (range-day-eight)` holds every row.

| State | Patch | Before | After |
| - | - | - | - |
| 412 px, full, February midday | floor at 1x, 25 m out | 2.02 | 3.38 |
| 412 px, full, February midday | hillside 20 m right of the 600-yard plate at 7x | 1.97 | 2.52 |
| 412 px, full, February midday | the same hillside at 21x | 1.30 | 6.39 |
| 412 px, full, September afternoon | floor at 1x, 25 m out | 2.37 | 3.61 |
| 412 px, full, September afternoon | hillside 20 m right of the 600-yard plate at 7x | 2.42 | 3.38 |
| 412 px, full, September afternoon | the same hillside at 21x | 2.28 | 5.14 |
| 412 px, light, February midday | floor at 1x, 25 m out | 2.16 | 3.62 |
| 412 px, light, February midday | hillside 20 m right of the 600-yard plate at 7x | 2.30 | 2.83 |
| 412 px, light, February midday | the same hillside at 21x | 1.87 | 4.81 |
| 412 px, light, September afternoon | floor at 1x, 25 m out | 2.61 | 3.76 |
| 412 px, light, September afternoon | hillside 20 m right of the 600-yard plate at 7x | 2.55 | 2.76 |
| 412 px, light, September afternoon | the same hillside at 21x | 2.29 | 5.09 |
| 1280 px, full, February midday | floor at 1x, 25 m out | 2.03 | 4.10 |
| 1280 px, full, February midday | hillside 20 m right of the 600-yard plate at 7x | 1.93 | 3.84 |
| 1280 px, full, February midday | the same hillside at 21x | 1.36 | 7.46 |
| 1280 px, full, September afternoon | floor at 1x, 25 m out | 2.45 | 4.36 |
| 1280 px, full, September afternoon | hillside 20 m right of the 600-yard plate at 7x | 2.38 | 4.35 |
| 1280 px, full, September afternoon | the same hillside at 21x | 2.21 | 5.75 |
| 1280 px, light, February midday | floor at 1x, 25 m out | 2.31 | 4.52 |
| 1280 px, light, February midday | hillside 20 m right of the 600-yard plate at 7x | 2.29 | 3.68 |
| 1280 px, light, February midday | the same hillside at 21x | 1.95 | 5.27 |
| 1280 px, light, September afternoon | floor at 1x, 25 m out | 2.86 | 4.69 |
| 1280 px, light, September afternoon | hillside 20 m right of the 600-yard plate at 7x | 2.44 | 3.86 |
| 1280 px, light, September afternoon | the same hillside at 21x | 2.33 | 3.80 |

**7. Weight.** Bytes downloaded for the canyon course's `/terrain/` files, before 8,196,503 on Full and 5,533,473 on Light (3 files), after 13,011,453 and 6,901,852 (15 files): +4,814,950 and +1,368,379, within the 5,000,000 and 1,500,000 limits (`data/look.json`, `picture.groundBytesFull`, `groundBytesLight`). Every new file is served with `cache-control: public, max-age=31536000, immutable` and a second load transfers 0 bytes for it (`verify 7` in `test/scene.test.js`, which checks every `/terrain/` file).

**8. A failed material.** With the floor's colour picture answering 404, the scene draws, five materials load, the floor takes its plain colour, and the only console error is that request's ("Failed to load resource: the server responded with a status of 404") (`verify 8 (range-day-eight)`).

**9. The check.** On GitHub's runner, the pull request's head commit b03452b, Checks run [44742932329](https://github.com/isleofdan/range-day/actions/runs/44742932329): all 10 pieces green: tests rest 36 s, day 1 min 31 s, browser 1 min 12 s, scene-scale 4 min 22 s, scene-shots 7 min 43 s, scene-rest 8 min 54 s; screenshots shards 5 min 26 s, 9 min 45 s, 6 min 47 s, 7 min 2 s. The slowest job on the run before (44739943613) was scene-shots at 13 min 52 s, over 11 minutes, so the jobs' limit is now 28 minutes (twice that). Tests: 101 before, 109 after (+4 `test/ground-fetch.test.js`, +1 `test/terrain.test.js` "the ground surfaces", +3 `test/scene.test.js`: verify 5, 6 and 8 of range-day-eight); no test removed or changed in what it checks; three test files wait for the materials to settle before measuring (`sceneReady` in `test/scene.test.js`, `ready` in `scripts/screenshots.mjs`, the wait in `scripts/picture-measure.mjs`). Screenshot states: 52 before, 68 after (+16 `ground-…`). In this cloud session: every test piece passed run one at a time (`npm run check -- --jobs 1`: scene-shots 657.5 s, scene-scale 304.8 s, scene-rest 693.6 s, day 54.9 s, browser 50.8 s, rest 3.6 s); run two at a time, two tests in scene-rest timed out (the first visit; the sights' angles reading an all-black picture) and passed when run alone, so that was the container's load. The full local screenshot pass was stopped: the runner's run above passed all 68 states at both sizes on the same commit; the 16 new states were run here for the report (all checks passed, two shards side by side). **The brief's line `check: all passed: syntax, tests, screenshots` from one local `npm run check` was not produced in this session**; the runner's green run is the evidence.

**10. The diff** for the checker: `gh pr diff 20 | wc -c` gave 180,437 bytes (under 400,000), so one pull request.

**11.** The Deploy run's result line: in the card note after the deploy.

What this cannot prove: the test browser draws in software and the session cannot open the live app, so how the ground looks and how fast it draws on Dan's phone is unverified until he looks.

Independent check: the Codex result checker, verdicts recorded on the card (see the closing note).

## Asks

1. **Merge and deploy?** Recommended: yes. Full meets every limit; Light's frame time and two of its February colours miss by the amounts above, reported, not hidden. To go ahead, type `yes, merge and deploy range-day-eight, then merge its notes`.

## What the next session needs

- Dan's look on his phone: the floor through the iron sights, then a far hillside through the scope at 7x. What he says decides the next ground work, which a Personal Shipyard chat plans.
- If the phone draws Full smoothly: anisotropic filtering on the materials (`src/scene/surfaces.mjs`, `t.anisotropy`), which the software test browser could not afford, would sharpen the floor at grazing angles.
- Light: its remaining overhead is the new ground's per-pixel bookkeeping, not picture reads; a separate, simpler Light shader path would bring it under the limit.
- The bushes take part of their measured colour from the ground around them; a later look at the brush (planned separately) should measure them on bush pixels only.
- The heat shimmer, at 21x, shows as a regular ripple over the ground; it grows with magnification by design, so a stronger glass, if one is ever added, needs it looked at.
- Next work, each planned by a Personal Shipyard chat: the firing line's text and controls; the iron sights; the rifle line's picture; the fast test subset for the after-every-edit hook; the notes-only skip, the pieces-side-by-side check and the browser cache carried into the starting kit.

## Closing message to Dan

Nothing on your screen has changed yet: the merge and deploy will show the new ground.

The canyon course's ground is now made from photographs of real ground (dirt, dry and green grass, the litter under the brush, rock, scree), all free-to-use public-domain scans, fetched in the one download run you allowed. The smeared streaks on the floor had one cause, now fixed: the picture placed the ground by coordinates too large for the graphics card to hold finer than a quarter of a metre.

The ground is sharper than before in every view the brief named, with no visible repeat, and no shot changes. Two misses, measured and in the report: the Light picture draws up to 45% slower than before through the iron sights (the limit was 25%), and a few colour patches on Light in February sit further from the photographs' measured colours.

Pull request: https://github.com/isleofdan/range-day/pull/20

Needed from you
1. Type `yes, merge and deploy range-day-eight, then merge its notes` to put the new ground on the live app (recommended).
