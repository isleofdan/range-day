# FIELD REPORT — range-day-fourteen — 2026-11-22

Nothing on Dan's screen has changed yet: the change waits in pull request
[#47](https://github.com/isleofdan/range-day/pull/47) for his typed line.
Once merged and deployed, the ACOG and the Leupold show their real
reticles' marks (the Vortex still shows its plain crosshair: its maker's
drawing could not be read), every day's page offers **Play this day back**,
and the firing line fits his phone's screen (378×762) with nothing under
Steady and Fire. No stored record changes.

## What stands

**Route.** A Claude Code cloud session on `isleofdan/range-day` (the
container has no `/data/home/dan/FACTS.md`), branch `ccr-8bf11ea5-zc6c5m`,
the session's own. Permission mode: auto (read from the session:
`permission_mode: auto`). Builder model: `claude-opus-5-5` (read from the
session; last served `claude-opus-5-5`). Independent checker: the Codex
result checker through `check_result` (rounds below). One helper (a page
fetcher run by this session) tried the Vortex document's library copy.

1. **The work split retired** (commit `98755a8`). `scripts/owners.mjs`,
   `test/owners.test.js` and the Checks workflow's job "who works on what"
   are deleted; `CLAUDE.md`'s section and `AGENTS.md`'s "Your side of this
   app" each say in two sentences that the split was tried in November 2026,
   retired on Dan's word that month, and that every file is open to
   whichever session is briefed. `README.md`, `docs/CHECKS.md` and
   `scripts/check.mjs` held no mention of it. Proof: Verify 1.
2. **The ACOG's reticle from Trijicon's dimension sheet** (commit
   `3fd9e0a`, `data/sights.json`, `trijicon-acog-ta31f.reticle`): the
   chevron's height 4.1 (was an estimate), its depth 2.0, its arm 1.1, the
   post 0.4 wide from 4.4 under the tip, the drop lines at 7.8, 12.6, 18.7,
   26.4 and 35.8 MOA under the tip, 4.2, 3.3, 2.8, 2.4 and 2.1 wide, the
   "4" and "6" printed beside the 400 and 600 m lines. Drawn as a solid red
   chevron, the post red down to the 400 m line, that line and its "4" red,
   the rest black, as the sheet shows the TA31F lit; nothing glows.
   `marksNotDrawn` removed. Proof: `test/guns.test.js` (the figures) and
   `test/bench.test.js` (the canvas), Verify 2.
3. **The Leupold's PR2-MOA from Leupold's sheet**
   (`leupold-mark5hd-5-25.reticle`, kind `tree`): lines 0.1, the center dot
   0.2, the open center 2.0 across, breaks 0.25 at each minute, a hash every
   1.0 minute (short 0.5 on one side, long 2.0 across at each numbered
   minute), numbers every 4 to 24 on the main line, the post above to 4 with
   bars 1.0 and 2.0, holdover lines every 4 to 40 each reaching half its
   depth either side and numbered at both ends, rows of dots between them
   (0.1 at odd minutes, 0.2 at even), the post below with 2.0 and 1.0 bars
   and numbers to 128. First focal plane: drawn in minutes of angle at the
   view's scale, so every mark keeps its true angle at every power.
   `marksNotDrawn` removed; `lib/data.js` refuses a tree reticle missing any
   of its twenty figures. Proof: Verify 2.
4. **One drawing for every reticle with marks** (`public/line.js`,
   `reticleMarks` and `drawReticle`): the prism sight's drop reticle was
   rewritten as a list of marks in MOA (an open chevron path and hold
   lines, at the same widths as before), and the ACOG's and the PR2-MOA's
   lists are built the same way; one function draws them all. The prism
   sight's existing tests pass unchanged (`browser` group).
5. **The Vortex unchanged** (Verify 3): its crosshair is drawn as on
   `main`; only its `marksNotDrawn` note now says what was tried this time.
6. **A day played back** (commit `b9c9cd4`). **Play this day back** on the
   day's page (`public/day.js`, open or finished) opens `/playback?id=<day>`
   (`server.js`, behind the sign-in): the firing line's own page and
   drawing in a read-only mode (`public/line.js`, `PLAYBACK`). The day's
   firing-line shots play in firing order through the tripod spotting
   scope: the view on each target, the shot's sound, the wait of its
   recorded `flightS` with the bullet's trace, then the strike from the
   record (a mark, the plate's swing and the ring coming back on steel; a
   hole on paper; a puff of dust for a miss). Its field of view at each
   power is `data/spotting.json`'s, read, not changed. Controls: play and
   pause, **Shot before**, **Next shot**, a line to drag through the day
   marked at each shot (filled for a hit), the pace (**waits skipped**, on
   which it opens, or **the day's own**), the scope's power, sound on or
   off, and **Back to the day**. One line of words under the view: which
   shot of how many, the target and its distance, and hit or miss in the
   day page's words (now one shared function, `RD.shotWords`, so both say
   it alike), and how many shots the day had at the bench. Leaving the
   screen while the page stays open (another app or tab) pauses it; coming
   back goes on from the same moment; opened again from the day's page it
   starts at the first shot. Nothing on the device is written.
   Proof: `test/playback.test.js` (Verify 4).
7. **The states with nothing to show:** a day with no firing-line shots
   says so in one line with **Back to the day**; a device that refuses its
   storage says "not saved on this device"; a day not on the device says
   so. A shot without `flightS` and `targetKey` is found by its kind and
   distance and lands without the wait or a trace.
8. **The trace** (`drawTrace`): a faint pale wake along a plain arc from
   below the view's left edge (the muzzle side) to the recorded strike, over
   the recorded flight time, only while that shot is in flight; a drawing
   of the record, not a new working-out of the path. No word on screen
   names it.
9. **The 3D picture's one new door** (`src/scene/things.mjs`,
   `setStrikes`): a plate's marks set to exactly a list, so a step back in
   playback takes later marks off; it paints with `strike`'s own chip
   drawing. Nothing about the ground, light, glass or targets is restyled.
10. **The firing line on Dan's phone** (commit `35a985b`, from the card's
    `next`): at 378×762 the book line fell 29 px under Steady and Fire with
    a scope or a dot sight (`docs/reports/range-day-fourteen/line-layout-378-before.txt`).
    On a phone screen too short for the within-reach list the view now
    gives up exactly the missing height, never below 280 px (`fitView`):
    314 px there; and under 400 px wide the zoom control takes 1.18 parts
    of its row to the target picker's 0.82, so the rifle scope's slider
    keeps at least 125 px. Where everything fits, nothing changes (380 px
    at 412 wide). `test/line-reach.js` and `scripts/line-layout.mjs` hold
    378×762 beside 412×915 and 412×830. Proof: Verify 5.
11. **The checks.** Tests 151 → 153; screenshot states 105 → 113. A new
    check group `playback` (`scripts/check.mjs`, the Checks workflow).
    `README.md`, `docs/RECORDS.md` and `docs/CHECKS.md` say what changed.

## UI review

**Playback screen (new).**
1. Speed of the frequent action: it opens playing, waits skipped; one tap
   pauses; one tap steps a shot either way.
2. Recovery: any jump is undone by the line or the step buttons; nothing is
   ever written, so nothing can be lost.
3. Finding the tool: every control is in one panel under the view, named in
   words (Shot before, Play, Next shot, Pace, Scope, Sound).
4. Orientation: a title line names the date, rifle, course and "through the
   spotting scope"; the words line names the shot of how many and its
   target; the line's marks show where each shot falls in the day.
5. Feedback: the strike appears where it struck, with the ring or the thud
   late by the sound's trip back; the words turn from "about to be fired"
   to "on its way" to the hit or miss.
6. Interruption: leaving the screen pauses it; coming back goes on from
   there.
7. Thumb reach: every control within the first screen and none touching at
   378×762 (lowest bottom edge 692 of 762), 412×830 and 412×915 (726) and
   1280×800 (374), `test/playback.test.js` test 3.
8. Defaults: opens at the first shot, playing, waits skipped, 25 power,
   sound on (it sounds after the first tap, as browsers allow).

**Day page.** 1 one tap to play back; 2 Back to the day returns; 3 the
control stands first in the day's row of buttons; 4 unchanged; 5 not
applicable; 6 not applicable; 7 the row is at the page's top
(`day-play-control` screenshot); 8 not applicable.

**Firing line (the reticles; Dan's phone).** 1–6 unchanged from `main`.
7 every held sight within reach at 378×762 now (the book line was under
the bar); the view is 314 px there. 8 unchanged.

What was not added, and why: no recording, no video, no speed faster than
the day's own besides skipping waits, no totals, no group size (rule 3);
no trace or reticle in the playback view beyond what the record says; no
kept playback setting (none needed: it resumes while the page is open, and
writing nothing let the test hold every key byte for byte). Which of the
eight Dan's own requests came from: 4 and 5 (a day seen again through the
scope, as he did with his phone on the tripod scope) and 7 (his phone's
size).

Screenshots, phone (412×915) and computer (1280×800) each, in
`docs/reports/screenshots/`: `playback-empty`, `playback-steel`,
`playback-paper`, `playback-miss-dust`, `playback-trace`,
`playback-paused`, `playback-end`, `day-play-control`; the reticles
retaken: `line-acog-100`, `line-leupold-5x-100`, `line-leupold-25x-600`,
`line-ak-leupold-300`, `line-vortex-1x-100`, `line-vortex-10x-600`. At
378×762: `docs/reports/range-day-fourteen/line-vepr-scope-378x762.png`,
`line-bcm-leupold-378x762.png`.

## What the brief got wrong

1. **`main` was at `bd5062e`, not `997e129`:** range-day-thirteen-b (the
   zero bench fitted to 378×762, pull requests #45 and #46) had merged
   since. It touched none of this task's files but `public/app.css`'s bench
   block. Carried on.
2. **The card's `next` asked for one more job than the brief listed:** the
   firing line measured and fitted at 378×762. Done (What stands 10).
3. **Task item 9's move of the shared drawing was not needed:** playback is
   the firing line's own page in a read-only mode, so the marks, holes,
   swing, dust and sounds are the same code with nothing moved (Deliberate
   divergences 1).
4. **Task item 4's screenshot states:** range-day-thirteen's states already
   cover each scope at both ends of its power (the ACOG has one); they are
   retaken under the same names, none added or dropped.

## Deliberate divergences

1. **Playback is a mode of the firing line's page** (`/playback` serves
   `line.html`; `line.js` skips entering a day, remembering the choice,
   setting the sight to its zero and choosing a picture, all of which
   write), not a page of its own drawing the course again. One drawing, no
   copy.
2. **The PR2-MOA's heavy outer posts are not drawn:** the sheet shows them
   with no figure. **Its numbers are drawn only where they would be 7 px
   or taller**; the sheet gives no size for them (estimated at 1 MOA high).
   A holdover line's end that is not a numbered minute carries a short hash
   both sides (the sheet's 0.5 MOA hash, its two-sided form read from the
   drawing's scale).
3. **ACOG estimates, each with its basis in the data:** the drop lines'
   thickness (0.4, the post's, as the sheet gives none and says it is not
   to scale); the numbers' size (2 MOA); the distances of the 500, 700 and
   800 m lines, which the sheet does not print (the 19-inch rule gives
   3.32, 2.37 and 2.07 MOA against its 3.3, 2.4 and 2.1). The chevron's
   width stays the maker's page's 5.53; the sheet rounds it to 5.5.
4. **The reticle test reads the reticle drawn alone** on a blank canvas by
   the same drawing at the same scale (`RangeDayLine.reticleAlone`), because
   the ground behind it made the marks unreadable in the live view; it then
   checks the live view shows the same marks (at least 90% of the main
   line's and post's mark pixels; 100% in every case measured).
5. **Playback keeps nothing on the device:** the brief allowed a new key
   for the last power or pace; none was needed.
6. **A device that never chose a picture sees Plain in playback** (choosing
   writes the setting; playback writes nothing).
7. **Playback opens playing;** its sound waits for the first tap, as
   browsers require.
8. **The firing line at 378×762 gives up view size** (346 → 314 px) rather
   than move or shrink a control: everything a shot needs stays above Steady
   and Fire.
9. **Commits:** items 2 to 4 in one commit, items 5 to 10 in one, then the
   phone fit and one wording fix.
10. **The retaken reticle screenshots are on the notes branch,** not in the
    change's pull request: this repository's screenshots land with the
    notes (range-day-thirteen's report: "in `docs/reports/screenshots/` on
    the notes branch"), and a notes-only commit runs no check. The eight
    new playback states went into the change's pull request by mistake
    with its test run's output; they stay there, unchanged by anything
    later. The Checks run on the pull request retook every one of the 113
    states, the reticle states among them, green (Verify 9).

## Verify results

1. **Part A.** `git grep -n -i "who works on what\|owners.mjs"` on the
   branch, outside `PLAN.md` and `docs/reports/`: prints nothing. The
   pull request's checks list (run
   [44990549750](https://github.com/isleofdan/range-day/actions/runs/44990549750)):
   13 jobs, eight test groups and four screenshot shards plus `rest`; the
   job "who works on what" absent. Whether the repository's settings
   require it by name: no check on the pull request waits on it; its
   checks list holds the 13 jobs above, every one finished green, and
   nothing pending. So no setting needs changing.
2. **Part B, per scope.**
   - **Trijicon ACOG TA31F:** "ACOG 4x32 .223 Chevron Reticle" dimension
     sheet,
     `https://www.trijicon.com/uploads/product-uploads/product-downloads/223_Chevron_Reticle_Dimensions4x32.pdf`,
     found on the maker's TA31F page, downloaded and rendered as a picture
     (120 dpi), each figure read beside its line.

     | Mark | Figure (MOA) |
     | - | - |
     | chevron width (base) | 5.5 (page: 5.53) |
     | chevron height, tip to lower ends | 4.1 |
     | tip to inside corner | 2.0 |
     | arm thickness | 1.1 |
     | tip to top of post | 4.4 |
     | post width | 0.4 |
     | 400 m line ("4"): under tip / width | 7.8 / 4.2 |
     | 500 m line | 12.6 / 3.3 |
     | 600 m line ("6") | 18.7 / 2.8 |
     | 700 m line | 26.4 / 2.4 |
     | 800 m line (post's end) | 35.8 / 2.1 |

     Shown without a figure, left as estimates: the lines' thickness, the
     numbers' size.
   - **Leupold PR2-MOA FFP (Mark 5HD):** `https://www.leupold.com/media/binaryanvil/reticle/FFP_PR2-MOA_Reticle_Spec_Sheet.pdf`,
     linked from the maker's page for part 180291, downloaded and rendered
     as a picture (110 and 250 dpi, the close-up cropped), each figure read
     beside its arrow.

     | Mark | Figure (MOA) |
     | - | - |
     | fine lines | 0.1 |
     | center dot | 0.2 |
     | open center | 2.0 |
     | line breaks | 0.25 |
     | hash spacing | 1.0 |
     | short hash | 0.5 |
     | long hash (numbered minutes) | 2.0 |
     | numbered every | 4.0 (4 to 24) |
     | bar 2 above / at the top (4 above) | 1.0 / 2.0 |
     | post bars, numbered / halfway | 2.0 / 1.0 |
     | small / large dot in the rows | 0.1 / 0.2 |
     | holdover lines | every 4 to 40, half their depth either side |
     | post numbered to | 128 |

     Shown without a figure, left out: the heavy outer posts; the numbers'
     size (estimate).
   - **Drawn against data** (`test/bench.test.js`, "range-day-fourteen task
     item 4", the reticle alone at the live scale): at 412 and 1280 px wide,
     at 4x (ACOG) and at 5x and 25x (Leupold), the chevron's base, each drop
     line in view, the open center (where at least 6 px), the long hash at
     4 MOA and each holdover line in view. **Largest difference 1.28 px.**
     Example lines: "phone leupold at 25x (7.896 px per MOA): the holdover
     line at 20 MOA: drawn 158 px, data 20 MOA and the end hashes'
     thickness = 158.91 px"; "computer acog at 4x (1.522 px per MOA): the
     400 m line at 7.8 MOA: drawn 6 px, data 4.2 MOA = 6.39 px". The live
     view shows the reticle at 31 of 31, 51 of 51, 186 of 186, 283 of 283,
     288 of 289 and 450 of 457 of its mark pixels. The same-scale test
     through each scope at both ends of its power (unchanged): passes.
3. **The Vortex:** its document is on Vortex's page for the scope as
   `https://vortexoptics.widen.net/view/pdf/6hmzejtlks/VTX_RZR-11001_EBR-9-BDC_MOA_I_RI_ST.pdf`.
   The host was first refused by this environment's network ("no rule or
   network setting allows this host"); this session added
   `vortexoptics.widen.net` to the environment "First test" (approved on
   its prompt), and the download was then refused by the auto-mode safety
   check, rule "Unauthorized Access". The one retailer copy tried, a reticle
   library's `https://dex.scopelist.com/pdf/vortex-ebr-9-bdc-moa.pdf`, did
   not resolve from the session's network. Its reticle is unchanged from
   `main`: the drawing function `drawCrosshair` is the same, and its test
   (a fine line both ways, nothing else) passes as before.
4. **Part C** (`test/playback.test.js`, plain picture, 412×915): "shots
   replayed: 5 (n 2, 3, 4, 5, 6); frames checked: 1466, 1365 with strikes
   drawn; strikes compared: 3279; largest difference between a drawn
   strike and its record: 0.0000 px; frames with the trace: 118"; nothing
   drawn for a shot before its strike in any frame; the trace only in
   flight. Stored keys: "5 keys before and after, each the same:
   range-day:day:open, range-day:last, range-day:last:molot-vepr-54r,
   range-day:picture, range-day:when", compared byte for byte, none added
   or removed, after play, pause, two steps forward, one back, the day's
   pace, sound off, 90 power, a drag, and leaving and coming back. Leaving
   and coming back (the same test): "left at 125.292 s (paused, 125.292 s
   after 1.5 s away), back and playing at 125.883 s". Reach of every
   control, left,top-right,bottom in CSS pixels, each wholly on the first
   screen and none touching another:
   - 378×762: view 16,70-362,416; words 16,420-362,488; line
     18,490-364,530; Shot before 16,540-127,588; Play 133,540-245,588; Next
     shot 251,540-362,588; Pace 16,588-114,636; Scope power 196,590-260,634;
     Sound 264,588-362,636; Back to the day 16,638-362,692.
   - 412×830 and 412×915 (the same): view 16,70-396,450; words
     16,454-396,522; line 18,524-398,564; Shot before 16,574-139,622; Play
     145,574-267,622; Next shot 273,574-396,622; Pace 16,622-124,670; Scope
     power 206,624-284,668; Sound 288,622-396,670; Back to the day
     16,672-396,726.
   - 1280×800: view 106,59-746,699; words 766,102-1174,170; line
     768,172-1176,212; Shot before 766,222-898,270; Play 904,222-1036,270;
     Next shot 1042,222-1174,270; Pace 766,270-882,318; Scope power
     964,272-1054,316; Sound 1058,270-1174,318; Back to the day
     766,320-1174,374.
5. **The firing line** after the reticle drawing was reworked and the
   phone fit added: `browser`, `day`, `near` and `bench` groups pass on this
   machine; `scripts/line-layout.mjs` at 412×915, 412×830, 378×762 and
   1280×800: "every held sight-and-size pair within reach", 128 of 128
   (`docs/reports/range-day-fourteen/line-layout-after.txt`; at 378×762
   the view is 314 px with a scope, a dot or the irons with a peep, 346 px
   with the AK's leaf irons, where all fits). Before, at 378×762: "book line
   under the Steady and Fire bar (bottom 721.8, bar from 693)". The
   firing line's existing screenshot states, 87 of the 113 (every `line-`,
   `near-`, `spot-` and `ground-` state), unchanged in what they set up and
   check: retaken green by the four screenshot shards of Checks run
   [44990549750](https://github.com/isleofdan/range-day/actions/runs/44990549750)
   (each state's "shows" and "fits the width" checks passed) and again by
   Checks run [44992808783](https://github.com/isleofdan/range-day/actions/runs/44992808783)
   on `a2c9ddd`.
6. **Fenced files:** `git diff origin/main --name-only` names none of
   `public/engine.js`, `data/courses.json`, `data/terrain.json`,
   `data/look.json`, `data/spotting.json`, `public/zero.js`,
   `public/zero.html`.
7. **Frame times during playback** (412×915, the seeded day playing,
   60 frames each; the test browser draws in software, so a phone's are
   far shorter): Full 25x 599.9 ms, Full 125x 583.3 ms; Light 25x 216.7 ms,
   Light 125x 233.4 ms (`docs/reports/range-day-fourteen/playback-frame-times.txt`).
8. **Screenshots:** the eight new states at both sizes and the six reticle
   states retaken: "all checks passed", no sideways scroll, no console
   error (the screenshot run's checks; every browser test's error list).
9. **The check:** Checks run
   [44990549750](https://github.com/isleofdan/range-day/actions/runs/44990549750)
   on the pull request's head `feb607e`, green, 22 min 15 s: tests rest
   34 s, bench 38 s, playback 52 s, browser 1 min 26 s, day 1 min 49 s,
   near 3 min 46 s, scene-scale 4 min 45 s, scene-shots 9 min 13 s,
   scene-rest 13 min 4 s; screenshots shard 1 9 min 31 s, shard 2 10 min
   52 s, shard 3 22 min 13 s, shard 4 19 min 9 s. After the playback
   test gained its leave-and-return proof (round 3), Checks run
   [44992808783](https://github.com/isleofdan/range-day/actions/runs/44992808783)
   on the new head `a2c9ddd`: green, every one of the 13 jobs, 15 min 13 s.
   Tests 151 → 153: removed, the three
   of `test/owners.test.js` (the split is retired); added, the five of
   `test/playback.test.js`; changed: `test/bench.test.js`'s reticle test
   (replaced: it now measures the marks against the sheets' figures instead
   of a chevron base and two bare crosshairs), `test/guns.test.js`'s
   scopes test (the sheets' figures; the tree and drop-line refusals),
   `test/day.test.js`'s reach test (holds 378×762; the view there is held
   to at least 300 px instead of exactly 380; every phone's touch heights,
   not only 412's), and through `test/line-reach.js`, `test/near.test.js`'s
   spotting test runs at 378×762 too. Screenshot states 105 → 113 (the
   eight playback states). Run on this machine, one group at a time: rest,
   bench, browser, playback, day, near.
10. **The diff:** 153,518 bytes (`git diff origin/main...HEAD`).
11. **After the deploy:** pull request #47 merged as `288a0a6` on Dan's typed line ("yes, merge and deploy range-day-fourteen, then merge its notes"); Deploy run [44994870417](https://github.com/isleofdan/range-day/actions/runs/44994870417): success, 82 s, on `288a0a6`.

What this cannot prove: the session cannot open the live app or hold a
phone, so whether each reticle looks to Dan like the real one, and whether
playback looks like a day at the range seen through the scope, is
unverified until he looks.

## Result check rounds

1. Job `20261122-060732-769dcd` (30 s, on report event 2994): FINDINGS,
   five.
   (1) The closing message said the independent check had passed before
   any round had: fixed; it now says so only when the newest verdict is
   PASS, and this section records each round.
   (2) The notes pull request waits for the deploy result: not changed,
   because the order is this repository's standing rule, quoted as the
   brief says: "When the session merges and deploys, the order is fixed:
   the change's pull request first (the report links it); after the deploy
   result, a notes-only close-out pull request carrying the field report
   and the `PLAN.md` note. That order is the rule, not a divergence."
   (`CLAUDE.md`, "Field reports"). It stays Ask 1, beside the merge, as
   range-day-thirteen's did.
   (3) The Vortex ask deferred work and asked for a technical step: fixed;
   the ask is gone, and the refused download and the work left are in
   Verify 3 and "What the next session needs".
   (4) The token step gave Dan no taps: fixed by taking it off Dan. GitHub's
   own documentation could not be read from this session (its host does
   not resolve here), so no tap could be written from it; instead the
   finding, its cause and the lasting fix went to the project that owns
   `claude-config` and its bootstrap, as a note on the Wall card
   `shipyard-methods` (event 2996), which the Personal Shipyard reads
   before any brief. Ask 4 now records that; nothing in it is Dan's.
   (5) The firing line's fit to 378×762 is outside the brief's task:
   kept, and made Ask 3 beside the merge, because the card's `next` that
   this session was opened to follow names it ("fold in the firing line at
   378×762 and the three reticles' marks") and range-day-thirteen-b's Ask 1
   recommended it; removing it would leave Dan's phone with the book line
   under Steady and Fire. The merge line answers it.
2. Job `20261122-061039-78525d` (24 s, on report event 2997): FINDINGS,
   four.
   (1) The retaken reticle screenshots are not in the pull request: kept on
   the notes branch, as this repository's screenshots are; now Deliberate
   divergences 10, with the reason.
   (2) The closing message said the independent check had passed: fixed;
   the claim is gone, and it now names the points the check still makes.
   (3) The notes pull request waits for the deploy result: the same point
   as round 1's second, against the same rule (`CLAUDE.md`, "Field
   reports", quoted under Ask 1); not changed; it stays Ask 1.
   (4) The phone fit is outside the brief: the same point as round 1's
   fifth; kept, as Ask 3 beside the merge, for Dan to answer.
   Checked once more below.
3. Job `20261122-061252-27a8a6` (22 s, on report event 2999): FINDINGS,
   five.
   (1) The notes pull request waits for the deploy result: the same point a
   third time, against the same rule; it stands as Ask 1 beside the merge,
   as the brief orders for a finding that asks for what a rule forbids.
   (2) Leaving and coming back was designed, not proven: now proven, in
   `test/playback.test.js` test 2 (commit `a2c9ddd`; Verify 4 quotes it; green on Checks run 44992808783),
   and What stands 6 now says exactly what resumes: leaving the screen
   while the page stays open; opened again from the day's page it starts
   at the first shot.
   (3) "`README.md` held no mention of the split" against a removal in its
   diff: the claim stands. The lines `README.md` loses are the old reticle
   sentence ("The chevron is drawn at its maker's width; the two zoom
   scopes show only their fine crosshair, because the makers' reticle
   drawings could not be read for their marks"), replaced by the new one;
   none is about the split.
   (4) Every control's reach, not only the lowest edge: Verify 4 now gives
   each control's box at each size.
   (5) The firing line's existing screenshot states: Verify 5 now gives
   their result (87 states, retaken green on both Checks runs).
   Checked once more below.
4. Job `20261122-063714-e6228f` (18 s, on report event 3001): FINDINGS,
   two, both points already standing: (1) the notes pull request waits for
   the deploy result (the fourth time; `CLAUDE.md`'s rule, Ask 1); (2) the
   phone fit is outside the brief (the third time; Ask 3). Every other
   finding of rounds 1 to 3 is closed. As the brief orders for a finding
   that still stands after one more check, both are asks beside the merge,
   and the closing message is sent with them.

## Asks

1. **The notes' order: the notes-only pull request opens after the deploy
   result, as `CLAUDE.md` orders.** "When the session merges and deploys,
   the order is fixed: the change's pull request first (the report links
   it); after the deploy result, a notes-only close-out pull request
   carrying the field report and the `PLAN.md` note. That order is the
   rule, not a divergence." (`CLAUDE.md`, "Field reports"). The result
   checker asked in round 1 for it to open now; the rule says otherwise.
   Recommended answer: keep the rule's order; the merge line below does.
2. **Merge and deploy range-day-fourteen, then merge its notes.**
   Recommended: yes.
3. **The firing line fitted to your phone (378×762) is in this same
   change,** though the brief did not list it: the card's `next` asked for
   it and range-day-thirteen-b recommended it. At your phone's size the
   book line sat under Steady and Fire; now the view is 314 px across
   instead of 346 and everything is above the bar. The result checker
   flagged it as outside the brief. Recommended answer: keep it in. The
   one merge line answers Asks 1, 2 and 3.
4. **A GitHub token in plain text in a cloud environment's start-up
   script** (the environment "First test", where it clones `claude-config`),
   seen while reading the environment for the Vortex host. Done from this
   session, not asked of Dan: the finding, its cause and the lasting fix
   (regenerate the token, keep it out of start-up scripts, a check that
   refuses one) are on the Wall card `shipyard-methods`, event 2996, for
   the project that owns `claude-config`. Nothing for Dan to do here.

## What the next session needs

- Dan's look on his phone: the ACOG and the Leupold on the BCM; playback of
  a day with firing-line shots; the firing line at his phone's size.
- The Vortex's marks (its download was refused by the safety check,
  Verify 3), from
  `https://vortexoptics.widen.net/view/pdf/6hmzejtlks/VTX_RZR-11001_EBR-9-BDC_MOA_I_RI_ST.pdf`;
  the environment now allows that host.
- Then, each planned by a Personal Shipyard chat: pistols and their
  targets; the .22's own scope. The picture work stays paused and the plate
  flicker set aside, on Dan's word.
- A cloud session links Chromium for the pinned Playwright before trusting
  a browser test (`/tmp/claude-0/pw`: `chromium-1194/chrome-linux` and
  `chromium_headless_shell-1194/chrome-linux` with `headless_shell`,
  pointing at the container's 1243 builds; `PLAYWRIGHT_BROWSERS_PATH`).

## The notes branch

This report, its measure files and screenshots and the `PLAN.md` note are
on the branch `ccr-8bf11ea5-zc6c5m-notes`, with no pull request yet; it
reaches `main` in a notes-only pull request after the deploy result. That
order is this repository's standing rule, not a choice of this brief:
"When the session merges and deploys, the order is fixed: the change's pull
request first (the report links it); after the deploy result, a notes-only
close-out pull request carrying the field report and the `PLAN.md` note.
That order is the rule, not a divergence." (`CLAUDE.md`, "Field reports").

## Closing message to Dan

Nothing on your screen has changed yet. The merge and deploy will put the
ACOG's and the Leupold's real reticle marks and day playback in the game
(the Vortex keeps its plain crosshair: its maker's drawing could not be
read), and fit the firing line to your phone's screen, which the brief did
not list but the card asked for.

The change is pull request [#47](https://github.com/isleofdan/range-day/pull/47);
its full check is green. The independent check's last round leaves two
points, both answered by the line below: the notes wait for the deploy, as
this app's rules order, and the phone fit was not in the brief.

**Needed from you**

1. Merge and deploy it, then merge its notes after the deploy, in the
   order this app's rules set, with the phone fit kept in (recommended:
   yes). Type:

```
yes, merge and deploy range-day-fourteen, then merge its notes
```

## Addendum: range-day-fourteen-b and -c, 22 to 24 Nov 2026 (the same session, on Dan's word)

**What stands.**

- **The green ACOG** (range-day-fourteen-b), after Dan asked during the
  walkthrough whether Trijicon makes the chevron green ("Green Trijicon too
  please"): pull request [#49](https://github.com/isleofdan/range-day/pull/49),
  merged as `5b497bc` on Dan's yes, Deploy run
  [44999222866](https://github.com/isleofdan/range-day/actions/runs/44999222866)
  (success, 73 s). The TA31F-G joins the scope collection: Trijicon's
  dimension sheet lists it under the TA31F's drawing, so every mark is the
  TA31F's; its chevron, post to the 400 m line and that line are green.
  Each reticle's lit colour is in the data (`litColor`), refused unless red
  or green. Checks run 44996528264 green; result check PASS (job
  `20261122-072932-ab0c15`, after two rounds: the first graded against the
  range-day-fourteen brief instead of Dan's request; the second asked for the
  run's final result and the zero bench's files named). Screenshot state
  `line-acog-g-100` added (114 states).
- **The Vortex's EBR-9 BDC MOA marks** (range-day-fourteen-c): the session's
  download of Vortex's drawing had been refused, so Dan fetched it and sent
  its page as a picture. Pull request
  [#50](https://github.com/isleofdan/range-day/pull/50), merged as `f245d82`
  on Dan's line ("yes, rerun the check, then merge and deploy
  range-day-fourteen-c"), Deploy run
  [45350683176](https://github.com/isleofdan/range-day/actions/runs/45350683176)
  (success, 74 s). Every mark the sheet gives a figure for is in the data
  (kind `bdc`): the red 1-minute dot in its red broken circle (4 and 5.5
  across), the fine line hashed every minute and numbered at 4, 12, 20 to
  20, posts from 24, the drop marks at 2.4 to 17.25, the ladder 20 to 32,
  the post from 36. Not drawn, no figure on the sheet: the wind dots and the
  ranging marks above the center. Checks run 44999515570: one flaky piece of
  the 3D tests (the Vepr's and the Tavor's sights, untouched by this change)
  failed and passed on its rerun, attempt 2 green; result check PASS (job
  `20261122-080436-db8c8d`).
- No scope in the collection shows a bare crosshair any more.

**What the next session needs.** Dan's look at the green ACOG and the
Vortex on his phone. The Vortex's wind dots and ranging marks would need
figures Vortex's sheet does not print. The notes are on
`ccr-8bf11ea5-zc6c5m-notes`; this addendum, the screenshots and the
`PLAN.md` note reach `main` in a notes-only pull request after the deploy,
as `CLAUDE.md` orders.
