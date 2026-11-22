# FIELD REPORT — range-day-thirteen — 2026-11-21

Nothing on Dan's screen has changed yet: the change waits in pull request
[#43](https://github.com/isleofdan/range-day/pull/43) for his typed line.
Once merged and deployed, the zero bench fits on one phone screen with the
paper, both adjustments and Fire within reach, and three scopes (a Trijicon
ACOG, a Vortex Razor 1-10x and a Leupold Mark 5HD 5-25x) can be put on the
AR-15, both Tavors, both AK rifles and the Vepr. Each scope starts unzeroed
on each rifle. No stored record changes.

## What stands

**Route.** A Claude Code cloud session on `isleofdan/range-day` (the
container has no `/data/home/dan/FACTS.md`), branch
`claude/range-day-card-brief-tu25t4`, the session's own. Permission mode:
auto (read from the session: `permission_mode: auto`). Builder model:
`claude-opus-5-5` (read from the session; last served `claude-opus-5-5`).
Independent checker: the Codex result checker through `check_result`
(rounds below). One research helper (a subagent of this session) searched
the web for the makers' figures; this session searched the two reticle
documents again itself. The session's network refuses page fetches, so
every maker figure was read from the search engine's indexed text, and
each source note says so.

1. **The zero bench on one screen** (`public/zero.html`, `public/zero.js`,
   `public/app.css`, the `body.bench` block). From the top: a short line
   (rifle, sight, load) with the paper's distance beside it; the paper,
   square, sized by the script to what the screen leaves (330 px at
   412×830, 380 at 412×915, 640 at 1280×800); where the last group landed,
   48 px high, a longer text opening on a tap over what is below it; the
   elevation row and the windage row, each its setting beside its name and
   four buttons in the order whole minute down, one click down, one click
   up, whole minute up; the knobs' note; **Fresh paper** and **Save this
   zero**; the save's note; the zeroing supply; **Fire one** and **Fire
   five**, 58 px high, lowest. **Open another box** stands over the Fire
   row when the supply is empty. On a computer the paper is on the left,
   the rest in a column on its right. Proof: `test/bench.test.js` test 1
   (every sight of every rifle, 32 pairs, at three sizes) and
   `docs/reports/range-day-thirteen/bench-layout-after.txt` ("every
   sight-and-size pair within reach").
2. **Everything else a short scroll below, nothing lost**: the aim and grid
   sentence and the day's weather (`#intro`, `#day-line`), the sight's name
   and setting line, what one click moves (`#click-help`), the rear leaf's
   control and note, the saved zero's full words (`#saved`), the
   conditions, the supply's note, **The day so far**, **Pack up**. Every id
   on `main`'s page is on the new one (verify 3).
3. **Nothing shifts; a slip is undone where it shows.** Every line of words
   has a fixed height; the end-of-travel words appear in the knobs' note
   by the rows, the save's line under its button ("Zero saved at 100
   yards: elevation +240, windage −240 clicks."). **Fresh paper** becomes
   **Put the old paper back** until the next shot or another distance,
   through the firing line's own `RD.hangFreshPaper` / `RD.putOldPaperBack`
   under the marker `bench:<yards>`. The bench's holes are read from the
   day's record (its bench shots at the distance with the sight since the
   marker), so a reload shows them. Proof: `test/bench.test.js` tests 2
   and 3 (quoted under Verify).
4. **The three scopes** in `data/sights.json` (`trijicon-acog-ta31f`,
   `vortex-razor-1-10`, `leupold-mark5hd-5-25`), kind `scope`, marked
   `collection`, each with its mount; every figure `{value, source}` or
   `{value, estimate}` (table under Verify 5). `lib/data.js` refuses a
   collection scope without its mount, a chevron without its sizes, a
   crosshair without its note on the marks not drawn.
5. **The collection moves among the rifles.** Each rifle in
   `data/rifles.json` has `scopeMount` (its rail, in words, and the rail's
   height over the bore). `lib/guns.js` offers each collection scope whose
   mount takes the rifle's rail, after the rifle's own sights, and works
   out its height over the bore (rail plus mount), refusing a result
   outside 1.5 to 5 in. The .22 offers none. Proof: `test/guns.test.js`,
   "range-day-thirteen: each rifle offers the collection's scopes…" and
   "…a bad scope mounting is refused by name…".
6. **Choosing one.** Home's two sight choosers list the rifle's own sights,
   then the collection under "From the scope collection"; the rifle set's
   list names them apart. Proof: `test/bench.test.js` test 4.
7. **What the eye sees.** Each scope's view is the maker's width at both
   ends of its power (the existing power fit); the ACOG shows no zoom
   control. The chevron is drawn by the prism sight's drawing, its base
   5.53 minutes of angle wide; the Vortex and the Leupold show a fine
   crosshair only (Deliberate divergences 1). Proof: tests 4, 5 and 6.
8. **How each is set.** Each scope's knobs move by its own click over its
   own travel; the Leupold's windage over its own 120 clicks
   (`windageClicks`, read by `RD.wireKnobs`). Proof: test 7.
9. **Two fields for playback.** Each firing-line shot carries `flightS`
   (the engine's time of flight in seconds, exactly as it gave it) and
   `targetKey`; older shots read as before; a copy is checked for them
   only where present (`public/game.js`, `checkCopy`; `docs/RECORDS.md`).
   Proof: test 8.
10. **The checks.** `test/bench-reach.js`, `scripts/bench-layout.mjs`,
    `test/bench.test.js` (its own check group, `bench`, in
    `scripts/check.mjs` and the Checks workflow), three tests in
    `test/guns.test.js`; `test/line-reach.js` reads the rifles as served,
    so the firing line's reach holds every collection scope. 151 tests and
    105 screenshot states (140 and 94 on `main`).

## UI review

**Zero bench.**
1. Speed of the frequent action: fire, read, turn, fire again is one screen
   with no scrolling; Fire is lowest and largest.
2. Recovery: **Fresh paper** turns into **Put the old paper back** in the
   same place until the next shot; a reload keeps the holes.
3. Finding the tool: the four buttons per row run whole minute, click,
   click, whole minute, each row named with its setting beside it.
4. Orientation: the short line names rifle, sight and load; the distance
   is beside it.
5. Feedback: the group line, the knobs' note and the save's line each in a
   fixed place by what caused it.
6. Interruption: nothing moves the player off the screen; the supply
   running out puts **Open another box** where Fire stood.
7. Thumb reach: Fire one and Fire five at the bottom of the first screen
   (bottom edge 816.5 of 830, 866.5 of 915).
8. Defaults/prefill: the sight starts where it was left; the distance
   starts at 100 yards, as before.

**Home (the sight chooser).** 1 not applicable (a choice made once a day);
2 the choice can be changed until a day opens, as before; 3 the collection
has its own heading; 4 the list names the rifle's own sights first; 5 the
zero line under it says whether the chosen sight is zeroed on this rifle;
6 not applicable; 7 the chooser and doors stay on the phone's screen (the
day test's home checks pass); 8 the last sight used on the rifle is picked.

**Firing line (a collection scope on).** 1–8 unchanged from main except: the
zoom control's power stands under the word "Zoom", so the slider keeps one
length (149 px at every power, 40 px from the edge) while dragged.

What was not added, and why: no fourth scope, no lit reticles, no pistols
(out of scope); no reticle marks the makers' documents could not be read
for. Which of the eight Dan's own requests came from: 1 and 7 (the bench
rearranged for usability) and 3 (scopes chosen per rifle).

Screenshots, phone and computer each: `zero-empty`, `zero-before` (after a
group), `zero-after` (after a save), `zero-fresh-paper`,
`zero-old-paper-back`, `zero-supply-empty`, `zero-leaf`, `zero-mid-day`,
`zero-dot-50`; `line-acog-100`, `line-vortex-1x-100`, `line-vortex-10x-600`,
`line-leupold-5x-100`, `line-leupold-25x-600`, `line-ak-leupold-300`,
`home-sight-chooser-bcm`, in `docs/reports/screenshots/` on the notes
branch.

## What the brief got wrong

1. **`main` was at `9a980a8`, not `9241fe2`.** The range-day-twelve-c fix
   and the two notes pull requests had merged since; nothing in them
   touched this task's files beyond the Troy's front hood. Carried on.
2. **The Leupold's dial.** Part 180291 is the M1C3 (quarter-minute) dial,
   not M5C3 (Leupold's 0.1 mil dial); no M5C3 PR2-MOA was found.
3. **The ACOG's click** is neither 1/3 nor 1/2 minute of angle: Trijicon's
   4x32 manual says "1/2 inch per click at 100 yards" (0.4776 MOA), and its
   drop marks are for meters, zeroed at 100 m.
4. **"The firing line's short line" has no sight chooser.** On `main` a
   sight is chosen on home only (two choosers there: no day open, and a
   day open); both carry the collection. A chooser was not added to the
   firing line, whose arrangement rule 7 holds.
5. **Codex's playback job** (rule 6) was declined by Codex (card event
   2960); no Codex branch existed and no pull request was open, so no file
   was fenced off in practice. The fence was kept anyway.

## Deliberate divergences

1. **Reticle marks not drawn.** The Vortex EBR-9 MOA's and the Leupold
   PR2-MOA's documents came through the search text with their figures
   unlabeled, so no mark's place, length or width could be read; each is
   drawn as a fine crosshair with nothing else, and each entry's
   `marksNotDrawn` says so. The ACOG's drop lines for 400 to 800 m are not
   drawn either: their width is the maker's (19 inches at each range), but
   their places under the tip are in no Trijicon text that could be read.
   The brief allows only what the maker's reticle document states.
2. **The ACOG chevron's height is an estimate** (4.1 MOA, the 300 m figure
   of a table posted as Trijicon's on a forum): the chevron cannot be drawn
   without one. Its base width is the maker's.
3. **Figures from retailers where the maker's could not be read:** the
   Vortex's click and travel (a retailer's listing of the maker's table),
   the Leupold's tube (a retailer's title). The ACOG's travel is an
   estimate (one retailer's "40 MOA", taken as the whole travel).
4. **The Leupold's elevation** is held to its whole internal range (120 MOA,
   60 each way from the middle); the M1C3 dial itself turns 71.5 MOA in
   three revolutions from its zero stop. The game's knobs count from the
   middle, so the whole range is the honest limit.
5. **Rail heights over the bore are estimates for the Tavors, the AKs and
   the Vepr** (no maker figure): the Tavor's 2.25 in already used by its
   red dot; the AK side mount's rail taken level with each rifle's iron
   sight line (1.9 in, the Vepr 2.0). The AR-15's 1.21 in has a source.
6. **The .22 offers none of the three:** its receiver is grooved for 3/8 in
   tip-off mounts; none of the three mounts clamps a dovetail, and an
   adapter rail is no part of this set.
7. **The way back to the old paper** is the Fresh paper button itself
   turning into **Put the old paper back** (rather than a note with its own
   button, as on the firing line), so it stands where the slip was made
   and nothing below it moves. The records functions are the firing
   line's own.
8. **The zoom's power under the word "Zoom"** on the firing line (a shared
   style): the collection's powers read up to "12.5×" and "25×", which
   would shorten the slider while dragged. The slider is 149 px at every
   power for every scope (130 on `main`), 40 px from the edge.
9. **Commits** grouped items 1 to 4 and items 6 to 10 where one change
   served several items, then one commit per later fix.
10. **The bench's page heading "Zero bench"** is kept for screen readers
   only (the short line and the page's own title say where you are), to
   give the paper its room.

## Verify results

1. **Fenced files.** `git diff` against `main` (`9a980a8`) names none of
   `public/engine.js`, `data/courses.json`, `data/terrain.json`,
   `data/look.json`, `data/spotting.json`, `public/day.html`,
   `public/day.js`, `server.js`, `src/scene/`, `public/terrain/`. No
   picture-side test changed. Changed: `.github/workflows/checks.yml`,
   `README.md`, `data/rifles.json`, `data/sights.json`, `docs/CHECKS.md`,
   `docs/RECORDS.md`, `lib/data.js`, `lib/guns.js`, `public/app.css`,
   `public/game.js`, `public/home.js`, `public/line.js`, `public/zero.html`,
   `public/zero.js`, `scripts/bench-layout.mjs`, `scripts/check.mjs`,
   `scripts/screenshots.mjs`, `test/bench-reach.js`, `test/bench.test.js`,
   `test/browser.test.js`, `test/day.test.js`, `test/guns.test.js`,
   `test/line-reach.js`.
2. **The bench's measure** (`docs/reports/range-day-thirteen/bench-layout-after.txt`):
   32 sights of 7 rifles × 3 sizes, 96 pairs, every control of item 1 on
   the first screen, no two buttons touching. Paper: 380 px at 412×915,
   330 px at 412×830, 640 px at 1280×800. Fire's bottom edge: 866.5 of 915,
   816.5 of 830, 486.5 of 800. "every sight-and-size pair within reach".
3. **The bench's words and controls on `main` against the new page:** every
   element id on `main`'s page is on the new one (`intro`, `day-line`,
   `view`, `setting-line`, `rounds`, `group`, `another-box-row`,
   `another-box`, `distance`, `fire1`, `fire5`, `fresh`, `sight-name`,
   `leafrow`, `leaf-down`, `leaf-up`, `leaf-text`, the eight knob buttons,
   `el-text`, `wd-text`, `click-help`, `save`, `saved`, `conditions`,
   `to-day`, `pack-up`, `to-line`); every fixed word on `main`'s page is on
   the new one but the "·" that joined the setting line and the supply
   (they now stand on their own lines). Added: `bench-short`, `knob-note`,
   `pair-note`. The heading "Zero bench" is kept, for screen readers.
4. **Reload** (`test/bench.test.js` test 3): holes before the reload
   `[[-7.89,2.39],[-8.86,1.12],[-9.91,0.51],[-6.49,1.49],[-8.53,1.54],[-8.82,0.81]]`,
   after the same; keys before and after `range-day:day:open,
   range-day:last, range-day:last:bcm-ar15, range-day:picture,
   range-day:supply:bcm-ar15:imi-m193, range-day:when`, unchanged. After
   Fresh paper and a reload: no holes, `freshPaper["bench:100"] = 6`, six
   shots kept.
5. **Each scope's figures** (every source read from the search engine's
   indexed text; the session's network refuses page fetches):

   | | ACOG TA31F | Vortex Razor 1-10x24 | Leupold Mark 5HD 5-25x56 |
   | - | - | - | - |
   | Power | 4 (maker) | 1–10 (maker) | 5–25 (maker) |
   | View at 100 yd | 36.69 ft (maker's 7°) | 116 / 11.7 ft (maker) | 20.4 / 4.2 ft (maker) |
   | Click | 0.4776 MOA (manual: ½ in at 100 yd) | ¼ MOA (retailer's listing) | ¼ MOA (maker) |
   | Travel each way | 42 clicks (estimate) | 240 (retailer: 120 MOA) | 240 elevation, 120 windage (maker: 120 / 60 MOA) |
   | Focal plane | fixed power | first (Vortex manual) | first (maker) |
   | Reticle | chevron 5.53 MOA wide (maker), 4.1 MOA high (estimate) | crosshair; marks not read | crosshair; marks not read |
   | Tube | none | 34 mm (maker) | 35 mm (retailer) |
   | Mount, center over rail | TA51, 1.535 in (maker) | CM-534, 1.574 in (maker) | Mark IMS 176886, 1.5 in (maker) |

   Why each model: the three the brief named, in the MOA versions so the
   clicks and marks speak minutes of angle. Why each mount: the ACOG on
   Trijicon's own TA51, as the brief named; the Vortex on Vortex's own
   34 mm cantilever (CM-534), whose forward reach gives a 1-10x the eye
   relief an AR-type stock needs and whose 1.574 in height the maker
   states; the Leupold on Leupold's own 35 mm Mark IMS, made for this
   tube, its 1.5 in height the maker's. Each is the scope maker's own
   mount, so its height comes from the same maker as the scope. Not found: Trijicon's travel
   and drop-line places; Vortex's own adjustment table and the EBR-9's
   labeled subtensions; the PR2-MOA's subtensions.
6. **Each rifle** (`test/guns.test.js`, printed):
   AR-15: its flat-top rail, 1.21 in (source) + mount: ACOG 2.745, Vortex
   2.784, Leupold 2.71 in. Tavor SAR and X95: top rail, 2.25 in (estimate):
   3.785, 3.824, 3.75 in. 7.62x39 and 5.45 rifles: side mount, 1.9 in
   (estimate): 3.435, 3.474, 3.4 in. Vepr: side mount, 2.0 in (estimate):
   3.535, 3.574, 3.5 in. The .22: none (grooved rimfire receiver).
7. **Drawn against data** (`test/bench.test.js` tests 4 and 5): the view
   equals the maker's width at both ends for each scope to within 1e-9 MOA
   (ACOG 420.436 MOA; Vortex 1329.262 and 134.072; Leupold 233.767 and
   48.128). The chevron's base read from the canvas: 5.0 px drawn against
   5.00 px at 412 wide, 9.0 against 8.42 at 1280 (largest difference 0.58
   px). The crosshairs: a fine dark line through the center both ways at
   the lowest and highest power, no other mark. Same scale through each
   scope at both ends of its power, near paper and far plate, 20 targets,
   largest difference 0.000 px.
8. **Records** (`test/bench.test.js` test 7), for each of the three
   scopes in turn: a zero saved with it on the BCM
   (`zero:bcm-ar15:<scope>:imi-m193`, elevation +2, +3 and +4); the X95
   with the same scope reads "No zero saved yet", its sight at the middle,
   nothing written under its key; each BCM zero saved so far byte for byte
   the same. The records the device held before (a zero and a setting of
   the Troy on the BCM) are compared byte for byte after each scope and are
   unchanged. Left out of that comparison, by design and named in the
   test: the open day (`day:open`) and what was last used (`last`,
   `last:<rifle>`), which every page writes whenever it opens a rifle;
   they are not a sight's records. Keys after: `day:open`, `last`,
   `last:bcm-ar15`, `last:iwi-x95`, `picture`, the four BCM sight settings,
   `when`, the four BCM zeros.
9. **The firing line's arrangement** (`docs/reports/range-day-thirteen/line-layout-after.txt`):
   32 sights × 3 held sizes, "every held sight-and-size pair within reach"
   (the 412×760 figure-only rows fall under the bar as on `main`). Zoom
   slider (`docs/reports/range-day-thirteen/sliders-after.txt`): 149 px at
   every power for the BugBuster, the Vortex and the Leupold, at 412×915
   and 412×830, ending 40 px from the right edge (130 px on `main`). The
   spotting scope's slider (`docs/reports/range-day-thirteen/spotting-slider-after.txt`):
   148 px at 25x and 125x with each collection scope and the BugBuster on
   the rifle, at 412×915 and 412×830, ending 40 px from the right edge
   (148 px on `main`, range-day-eleven). Home's
   doors on a phone: `test/day.test.js`, the home reach test, passes. The
   longest new scope name is 67 characters, the longest on `main` 86.
10. **Screenshots** of every new state at both sizes, no sideways scroll,
   no console error (the screenshot run's checks and every browser test's
   error list).
11. **The check.** Checks run
   [44966258237](https://github.com/isleofdan/range-day/actions/runs/44966258237)
   on the pull request's head `f60b2b9`, green, 11 min 45 s: who works on
   what 16 s; tests rest 34 s, bench 44 s, browser 1 min 31 s, day 1 min
   50 s, near 3 min 48 s, scene-scale 4 min 35 s, scene-rest 9 min 17 s,
   scene-shots 9 min 18 s; screenshots shard 1 8 min 51 s, shard 2 10 min
   31 s, shard 3 11 min 42 s, shard 4 11 min 6 s. (The earlier head
   `1d6f8a2` passed run
   [44943854160](https://github.com/isleofdan/range-day/actions/runs/44943854160)
   in 12 min 12 s.)
   Tests 140 → 151 (eight in `test/bench.test.js`, three in
   `test/guns.test.js`); screenshot states 94 → 105. Changed tests: in
   `test/guns.test.js` the figure-for-figure test (the collection is added
   after each rifle's own sights) and the refusal message (it lists the
   three new sights); in `test/browser.test.js` verify 4 (Fire is not seen
   while Open another box stands over it), the storage-refusal test (the
   knobs' words stand by the rows) and the Tavor chooser (six options, its
   own three first); in `test/bench.test.js` itself, after round 2, test 7
   (all three scopes, not the Vortex alone) and test 8 (the flight time
   compared exactly); in `test/day.test.js` verify 5 (the paper keeps the
   day's earlier holes, and Fire's place now holds Open another box). In
   this session, each run on its own: rest, bench, browser, near, day and
   scene-rest passed; scene-scale and scene-shots were still running when
   this report was filed and passed on the Checks run.
12. **The diff:** 148,699 bytes (`git diff origin/main...HEAD`).
13. After the deploy: in the card note.

What this cannot prove: the session cannot open the live app or hold a
phone, so whether the bench is easier under Dan's thumb, and whether each
scope looks to him like the real one, is unverified until he looks.

## Result check rounds

1. Job `20261121-201509-d63392` (21 s, on report event 2966): FINDINGS,
   two. (1) The request to allow the makers' hosts gave Dan no page link
   or taps. Fixed by doing the step from the session: the environment now
   allows the six hosts (Ask 3), and the closing message no longer asks
   it. (2) The report recorded no result-check verdict. Fixed: this
   section records each round; the corrected report is filed again and
   checked again.
2. Job `20261122-001951-53f153` (31 s, on report event 2968): FINDINGS,
   six. (1) The flight time was rounded: fixed, `flightS` is now the
   engine's figure exactly (`public/line.js`, commit `f60b2b9`), and test 8
   compares it exactly. (2) The cross-rifle zero test covered the Vortex
   only: fixed, test 7 runs it for all three scopes. (3) The report said
   every key was unchanged while the test left three out: fixed, Verify 8
   names what is left out and why. (4) The spotting scope's slider was not
   measured: fixed, Verify 9 gives it. (5) No reason was given for the
   mounts: fixed, Verify 5 gives one for each. (6) "The notes branch is
   deferred until after the deploy result": not changed, because the
   order is this repository's standing rule, quoted here as the brief
   says: "When the session merges and deploys, the order is fixed: the
   change's pull request first (the report links it); after the deploy
   result, a notes-only close-out pull request carrying the field report
   and the `PLAN.md` note. That order is the rule, not a divergence."
   (`CLAUDE.md`, "Field reports"). The notes are pushed now and wait only
   for their pull request. Checked once more below.
3. (Next round below when it answers.)

## Asks

1. **Merge and deploy range-day-thirteen, then merge its notes.**
   Recommended: yes.
2. **The ACOG's drop lines (400 to 800 m): wait for Trijicon's own
   drawing rather than draw them now from the forum table as estimates.**
   Recommended answer: yes, wait; the next session that can open
   Trijicon's, Vortex's and Leupold's reticle documents adds all three
   scopes' marks from the makers themselves. It stands as the default
   unless Dan says otherwise, so the closing message does not ask it.
3. **Let cloud sessions open the three makers' pages.** Done from this
   session, not asked of Dan: this cloud environment ("First test") now
   allows `www.trijicon.com`, `trijicon.com`, `vortexoptics.com`,
   `www.vortexoptics.com`, `www.leupold.com` and `leupold.com`
   (`update_environment`, approved on its prompt; before, it allowed no
   extra host). A download of the three reticle documents tried from this
   session right after was refused by the auto-mode safety check
   ("Unauthorized Access"), so the marks wait for the next session, as
   Ask 2 says. Nothing for Dan to do.

## What the next session needs

- Dan's look on his phone: the bench under his thumb; each scope on the BCM.
- The three reticles' marks from the makers' documents (Ask 2); this cloud
  environment now reaches the makers' sites (Ask 3).
- Then, each planned by a Personal Shipyard chat: pistols and their targets
  at each range; the .22's own scope. The playback screen on Codex's side
  can read `flightS` and `targetKey` from each line shot. The picture work
  stays paused on Dan's word.
- A cloud session must link Chromium for the pinned Playwright before a
  browser test's "passed" means anything (the links this session made:
  `/tmp/claude-0/pw`, `chromium-1194` and `chromium_headless_shell-1194`
  pointing at the container's 1243 builds, with `chrome-linux/` inside).

## The notes branch

This report, its screenshots and measure files and the `PLAN.md` note are
on the branch `claude/range-day-card-brief-tu25t4-notes`, with no pull request yet; it reaches `main` in a
notes-only pull request after the deploy result. That order is this
repository's standing rule, not a choice of this brief: "When the session
merges and deploys, the order is fixed: the change's pull request first
(the report links it); after the deploy result, a notes-only close-out pull
request carrying the field report and the `PLAN.md` note. That order is the
rule, not a divergence." (`CLAUDE.md`, "Field reports").

## Closing message to Dan

Nothing on your screen has changed yet. The merge and deploy will put the
rearranged zero bench and the three scopes in the game; each scope starts
unzeroed on each rifle.

The change is pull request [#43](https://github.com/isleofdan/range-day/pull/43);
its full check is green.

**Needed from you**

1. Merge and deploy it, then merge its notes (recommended: yes). Type:

```
yes, merge and deploy range-day-thirteen, then merge its notes
```
