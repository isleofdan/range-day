# Checks

What checks the app has, when each runs, how long each takes, and how to
read a failure. Added to the kit by kit-checks-one (2 Oct 2026).
The Checks workflow finishes in about 25 seconds on main
([run 37118463557](https://github.com/isleofdan/starting-kit/actions/runs/37118463557),
3 Oct 2026).
OpenRig team runs on 3 Oct 2026 finished in 23 to 25 seconds (runs
[37121710156](https://github.com/isleofdan/starting-kit/actions/runs/37121710156),
[37121711964](https://github.com/isleofdan/starting-kit/actions/runs/37121711964),
[37123222228](https://github.com/isleofdan/starting-kit/actions/runs/37123222228)).
The 3 Oct 2026 afternoon run used a fresh builder on the faster CPU.

## The checks

| Check | What it proves |
| - | - |
| syntax | Every `.js`, `.mjs` and `.cjs` file outside `node_modules` parses (`node --check`, file by file). |
| tests | `npm test`: the kit's 21 (the gate, the alive line, the status page, `lib/upstream.js`, crash reporting) plus Range Day's: `test/data.test.js` (8: every figure sourced or an estimate with its basis, cross-references, the drag tables' shape), `test/engine.test.js` (10: the engine against Sellier & Bellot's and Federal's published tables, wind, uphill geometry, the X95 crossing figure, repeatability, clicks, the transonic reading at Piru's far plate) and `test/browser.test.js` (3, in a real browser signing in through the form: the zero holds across a reload and moves with the load by the engine's figure; the firing line gives no hit when the engine says miss at a plate's edge; every screen at both sizes with no sideways scroll). The browser tests are skipped, and say so, where Playwright's browser is missing. 42 tests in all (range-day-one, 16 Nov 2026); 63 after range-day-two; 85 after range-day-three (17 Nov 2026), unchanged in count by range-day-four (the box that can be reopened and the zeroing supply, tested inside verify 5 of `test/day.test.js`), which added `test/guns.test.js` (4: the gun-record seam, the four refusals, no rifle id in a screen, a file of records served), `test/weather.test.js` (6: the weather's shape, the seeded draw, the brief's table of days, the muzzle-speed rule, the boxes) and `test/day.test.js` (10, in a real browser: the box, a day staying open, the book, the wind call, the cold-bore record, nothing lost, the copy file, old links, the phone, an eighth gun from a file); 97 after range-day-five (18 Nov 2026), which added `test/terrain.test.js` (5: the terrain files and their record, the surveyed figures against the heights themselves and the line of sight, the engine's elevation on the old and the new figures, the sun, the committed picture bundle) and `test/scene.test.js` (7, in a real browser: the scene within a pixel of the plain drawing at every zoom and both sizes, the same shots under every picture, the colours against the measured palette, the weight and the cache, the Plain fallback, no wind figure, the first visit's choice); 99 after range-day-six (19 Nov 2026), which added to `test/scene.test.js` verify 4 (the sights' drawn notch, post, reticle spacing and dot in pixels against the data's angles) and verify 5 (the sharpness through the scope at 7x against `docs/reports/picture-before.txt`, and that the detail is fixed to the ground); the files run one at a time (`--test-concurrency=1`), because three browser files at once starve each other's clocks in a software-drawn 3D. |
| screenshots | `npm run screenshots`: every screen at phone (412×915) and computer (1280×800) size, signing in through the form, with no sideways scrolling: sign-in, home with and without a day open, status, the zero bench before and after adjusting and in the middle of a day, the firing line through every sight, before the day's first shot, after a hit, with nothing in the book, with the wind call changed, with the box empty, on a January morning and a July afternoon, a miss with its dust, the shot log, "Show the conditions" on, the day's page, the book with several distances and with none, the cold-bore record, the bench with its zeroing supply used up (37 states, 74 images, 152 checks; range-day-four, 17 Nov 2026); range-day-five adds the canyon course's picture through the scope at 2x and 7x and through irons at 1x in February at midday and September in the afternoon, a hit with its strike mark, the Light picture beside the Full, the Plain fallback in a browser without 3D, and the Picture setting (46 states, 92 images, 188 checks, 18 Nov 2026); range-day-six adds the other two of each day's measured states (2x on the 1,000-yard plate, 7x on the 600-yard plate) and the 200-yard plate among the boards at 4x (51 states, 102 images, 208 checks, 19 Nov 2026). Needs Playwright's browser. |

`npm run check` runs all three in that order, stops at the first failure,
and ends with one line: `check: all passed: …`, or
`check: FAILED at <check> (<seconds> s): <what failed>`, naming the file
that does not parse, the test that failed, or the screenshot check that
failed. `npm run check -- --fast` runs syntax and tests only.

A check a session writes to prove something is committed, and the report
names its file next to the count it produced ("25 checks,
`scripts/review-check-test.mjs`"). A count from a check that was not
committed is not a result.

## How the check runs since range-day-seven (19 Nov 2026)

The picture file `public/scene.min.js` is **built, not stored**: it is not
in the repository. `scripts/build-scene.mjs` bundles `src/scene/` with the
three library (0.2 s) and writes the file whole, renaming it into place.
Every path that serves or tests the app builds it first: `npm start`, `npm test` and
`npm run screenshots` through `package.json`'s `prestart`, `pretest` and
`prescreenshots` (the image's own command is `node server.js`, with the
file already built into it); `npm run check` once, before the tests and the
screenshots; `npm run dev`; the Deploy workflow through its `npm test`; the
image in the `Dockerfile`'s first stage (which has the development
packages; the second stage installs the runtime packages only and copies
the built file in, and the image build fails if it is missing or empty).
`test/terrain.test.js` proves it: a copy stored in the repository would
have to equal a fresh build; with none stored, a build produces the file
and the server serves it behind the cookie with more than 300,000 bytes.
The Deploy workflow proves the same on the live app after the sign-in
proof: `/scene.min.js` answers 200 with more than 300,000 bytes, or the run
fails saying the picture file is missing from the image.

The check runs **in pieces, side by side**; nothing is dropped. The tests
are in six groups (`scripts/check.mjs`, `TEST_GROUPS`): `test/scene.test.js`
in three pieces by test name (`scene-shots`, its verify 3; `scene-scale`,
its verify 2; `scene-rest`, every other test in the file, by Node's skip
pattern, so a new test there is never left out; each piece's server on its
own port, `TEST_PORT`), `test/day.test.js` (`day`) and
`test/browser.test.js` (`browser`) each alone, and every other test file
together (`rest`; a new file lands there). The screenshot states are in
four shards (`scripts/screenshots.mjs --shard i/4`: every fourth state, at
both sizes; the four together are every state once). By hand, `npm run
check` runs the pieces two at a time (`--jobs`), because three browsers
drawing 3D in software at once starve each other's clocks;
`node scripts/check.mjs --only tests --group scene-rest` (or `scene-shots`,
`scene-scale`, `day`, `browser`, `rest`) or
`--only screenshots --shard 2/4` runs one piece, with the syntax check.
Every state's seconds are printed. In the Checks workflow each piece is its
own job on its own runner (a matrix of six test groups and four screenshot
shards, ten jobs), so the run's time is the slowest piece's, not the sum;
the workflow runs on pull requests and on pushes to `main` (a push to a
branch no longer runs a second copy of the pull request's check). The
runner keeps Playwright's browser between runs by the package lock's hash.

Times (19 Nov 2026): in the cloud session, `npm run check` one piece after
another on `main` took 40 min 34 s (tests 770 s, screenshots
1,662 s); in pieces two at a time about 20 minutes, each piece on its own:
tests scene-shots 396 s, scene-scale 228 s, scene-rest 118 s, day 73 s,
browser 55 s, rest 3 s; screenshot shards 265 s, 323 s, 356 s and 210 s. On
GitHub's runner the one job took 31 to 60 minutes across the six runs of
19 Nov 2026 (runs 44478788151 at 60 min, 44486790550 at 38, 44487064556 at 53, 44492956485 at 32, 44492979855 at 48 and 44493011946 at 48, each one job); the pieces took 6 min 50 s from the push to the last job's end, the slowest job 6 min 47 s (tests, scene-shots), then screenshots shard 2 at 5 min 10 s, shard 3 at 4 min 35 s, shard 1 at 3 min 51 s, tests scene-scale at 3 min 27 s, shard 4 at 3 min 19 s, scene-rest at 2 min 9 s, browser at 1 min 14 s, day at 1 min 13 s, rest at 21 s, each with its install (run
44559608576), so the job limit is 22 minutes: twice the slowest job seen, which
varies run to run on the runner (the tests scene-shots job took 6 min 47 s,
8 min 11 s and 10 min 47 s on three runs of the same code, 19 Nov 2026).

## The firing line's arrangement (range-day-nine, 20 Nov 2026)

What a shooter needs between shots is held within reach by measure, not by
eye. `test/line-reach.js` (not a test file itself) holds the within-reach
list and the one function that measures it in the page: the short line,
the target picker, the sight's glass control (zoom, magnifier or rear
leaf), the view, where the last shot went, elevation and windage with
their settings and one-click buttons, the rounds left and the book's line;
for each, whether its whole box is inside the screen and, on a phone,
above the Steady and Fire bar; for the bar, on a phone whether it is fixed
at the bottom inside the screen and on a computer whether it stands
beside the view covering none of it; the view's size; and every button's
touch height. Two tests in `test/day.test.js` hold it:

- **"the firing line within reach"**: for the Vepr with its scope, the
  Tavor SAR with its dot and the AK with its irons, at 412×915, at
  412×830 (Dan's own phone, measured from his screenshots of 21 Nov 2026,
  where the book line had fallen under Steady and Fire) and at 1280×800,
  page at its top: every item within reach, the 1 MOA buttons
  too where the sight has them, every button at least 44 pixels tall on
  the phone, the view 380 and 640 pixels square as before, no sideways
  scroll; and neither text slot has vertical padding (a clamped text
  overflows into padding, which showed the top of a third line under the
  book line on Dan's phone).
- **"nothing shifts under the thumb"**: the places of the view, the sight
  strip and the bar, read before and after a seeded miss (the cold-bore
  note going), the result's fold opened, a seeded hit that writes a book
  line, the full description opened, the box running empty ("Open another
  box" shown, within reach) and another box opened, at both sizes: every
  difference 0 pixels, and the page never scrolled by itself.

`node scripts/line-layout.mjs` prints the same measure, signing in through
the form, at 412×915, 1280×800 and 412×800 (a figure only: a phone whose
browser bars take room); `docs/reports/line-layout-before.txt` is the page
on `main` before the change, `line-layout-after.txt` after. The screenshot
states `line-top-first-shot`, `line-top-after-miss`, `line-top-after-hit`,
`line-top-short-opened` and `line-top-scrolled-wind` show the page at both
sizes. Verify 7 now holds that the book's line under the view is the
newest line only, and verify 13 that the result, the strip's figures and
buttons, the rounds and the book line are above the bar. 111 tests and 73
screenshot states after this build (109 and 68 before).

## The near targets and the spotting scope (range-day-ten, 21 Nov 2026)

`test/near.test.js` (its own check group, `near`, so the other groups keep
their times) holds the new parts in a real browser, signing in through the
form:

- **twenty seeded shots at each new target** (paper at 50 and 100 yards on
  both courses, the canyon's 100-yard steel) land exactly where the
  engine, run in the test with the same inputs, says, and each log row and
  day shot names its target;
- **records**: the day's first shot, at paper, writes the cold-bore line
  (its `hit` meaning on the sheet) and no book line; a steel hit writes its
  book line; a dead-center hit reads "dead on the center"; a shot row
  from before range-day-ten (no target) reads as steel;
- **holes and marks rebuilt from the day**: five holes and the steel's
  marks are the same after a reload, under the plain drawing and the 3D
  picture; **Hang a fresh paper** clears the sheet and deletes no shot,
  **Put the old paper back** undoes it, a fresh paper holds across a
  reload and a later shot shows on it alone;
- **the spotting scope**: at its lowest and highest power the view spans
  exactly the maker's field of view (108 and 60 ft at 1,000 yards); Fire,
  Steady, Enter, the space bar and the page's own fire door fire nothing
  there; "Back to the rifle" stands in the bar; a shot in the air lands
  while at the scope; going there and back moves the view, the sight
  strip, the bar and the picker row by 0 pixels at 412×830, 412×915 and
  1280×800; every new button is 44 pixels tall or more; and (range-day-ten-b, after
  Dan found the zoom cramped on his phone) the spotting scope's zoom slider is
  at least 100 px wide and the rifle scope's at least 110 px (they were 57 and
  70 px with the scope's button beside them; it now stands in the short line's
  row); since range-day-ten-c at least 110 and 125 px, and on a phone both
  sliders end at least 40 px in from the screen's right edge, clear of
  Android's edge-swipe back gesture, which Dan's phone read from a drag near
  the edge;
- **same scale**: the 3D picture puts each new canyon target's center
  within 1 pixel of the plain drawing through the Vepr's scope at 2x and
  7x, its irons, and the spotting scope at 20x and 60x, at both sizes.

`test/data.test.js` holds the new data's shape (paper at 50 and 100 yards
on both courses, one 12 × 18 in steel plate at 100, every near target
paper or steel, a plate without the word steel, the paper's and the
scope's figures); its "the plates stand apart" test now includes the near
targets. `test/terrain.test.js` (verify 4) checks every near target's
height against the surveyed ground and its line of sight. The
within-reach list (`test/line-reach.js`) gains **Spotting scope**, and the
touch heights the new buttons. Eight new screenshot states, at both sizes:
`near-paper-50-clean`, `near-paper-50-group`, `spot-paper-50-20x`,
`spot-paper-50-60x`, `spot-steel-100-marks`, `spot-plate-600-60x`,
`spot-plate-1000-60x`, `spot-rifle-line-paper-50`.

## The ground's surfaces (range-day-eight, 20 Nov 2026)

What the checks hold the photographed ground to, and where its files come
from:

- **The files and their records** (`test/terrain.test.js`, "the ground
  surfaces"): six materials, each with the library's own CC0 sentence, its
  license page, its own page, the download run, the date, the candidates
  and why this one; every shipped file's bytes and content hash match its
  record; each has a ground size in `data/look.json`; together they stay
  within 5,000,000 bytes on Full and 1,500,000 on Light
  (`look.picture.groundBytesFull`, `groundBytesLight`).
- **The fetch itself** (`test/ground-fetch.test.js`, 4 tests): the
  download script `scripts/ground/fetch.mjs` run end to end on saved
  answers shaped like the libraries' own (Poly Haven's published API
  description; ambientCG's read generically): the license read, the
  choosing, the naming, the checksums, the record, a library that does not
  answer, no library answering.
- **No visible repeat** (`test/scene.test.js`, verify 5 of range-day-eight):
  the materials slid along the ground by exactly one copy's width match
  themselves almost not at all as laid, and nearly perfectly in a plain
  grid; the measure is `scripts/ground-measure.cjs`, `repeat`.
- **Detail** (verify 6 of range-day-eight): the local contrast on the floor
  at 1x and on a hillside at 7x and at 21x, Full and Light, both days, both
  widths, never lower than `docs/reports/ground-before.txt`.
- **A failed material** (verify 8 of range-day-eight): with one picture
  answering 404 the scene still draws, that kind of ground takes its plain
  colour, and no other console error appears.
- **The pictures**: 16 screenshot states named `ground-…` (Full and Light,
  February midday and September afternoon; the floor through the irons at
  1x, the 600- and 1,000-yard hillsides at 7x, the 600-yard hillside at
  21x, a test view through the page's zoom door, not a sight in the game).

The download ran once, on GitHub's runner, by the Ground workflow
(`.github/workflows/ground.yml`): it runs only on a push to a branch named
`…-fetch` that touches `scripts/ground/`, so neither a pull request nor
`main` ever starts it, and it commits only to that scratch branch. A new
download needs Dan's yes first.

The jobs' limit is 28 minutes since range-day-eight: on its pull request's
run of 20 Nov 2026 (44739943613) the slowest job, tests scene-shots, took
13 min 52 s (the same piece took 8 min 21 s on the run before, 44737304008:
the runner varies), over the 11 minutes at which the limit is set to twice
the slowest job seen.

## What runs when

| When | What runs | Where it is set |
| - | - | - |
| After every edit or new file an agent makes in Claude Code | syntax, tests | `.claude/settings.json`: a `PostToolUse` hook on `Edit\|Write` running `node scripts/check.mjs --hook`, timeout 30 s |
| On every pull request, and every push to `main`, that touches anything but notes (Markdown files and `docs/reports/`) | syntax, tests, screenshots, in eight jobs at once | `.github/workflows/checks.yml` ("Checks"); a notes-only push or pull request runs nothing, since the code it would prove is unchanged; a push to a branch runs nothing of its own, its pull request's run checks the commit |
| By hand | any of them | `npm run check`, `npm test`, `npm run screenshots` |

Only checks that finish in a few seconds run after every edit; the
screenshots start a browser and run on push and pull request only.

On this app the browser tests make `npm test` take about 14 s in a cloud session (16 Nov 2026); the hook's limit is 30 s. Since range-day-five the scene tests draw 3D in the test browser, which in a cloud session has no GPU: `npm test` takes several minutes there and `npm run check` about a quarter of an hour; the Checks workflow's limit was 25 minutes; it is 60 since range-day-six, because the second pass of the picture (multisampling, a half-float texture, the survey's normal map and three detail scales, all drawn in software on the runner) took `npm run check` from 18.6 to 34.5 minutes in the cloud session, and the runner's run of that branch was cut off at 25 minutes (run 44471604325, 19 Nov 2026). An app whose `npm test` takes more than 20 seconds puts a fast subset in
`npm run test:fast` and points the hook at it; the full set runs in the
Checks workflow. The hook's limit is 30 seconds.

## Measured times

On the rented Linux machine (`agent-machine-dan`, Node 24.21.0), 2 Oct
2026, with bash's `time`, three runs each:

| Run | Time here | Runs in |
| - | - | - |
| `npm test` alone | 0.87 s, 0.79 s, 0.72 s | hook and workflow |
| syntax, inside `npm run check` | 0.34 s, 0.38 s, 0.38 s | hook and workflow |
| tests, inside `npm run check` | 0.61 s, 0.67 s, 0.68 s | hook and workflow |
| the hook's command (`--hook`: syntax and tests) | 1.17 s, 1.19 s, 1.20 s | hook |
| `npm run check -- --fast` | 1.34 s, 1.39 s, 1.67 s | by hand |
| `npm run check` (screenshots skipped here) | 1.57 s, 1.67 s, 1.67 s | by hand |
| `npm run screenshots` | not measured here: this machine has no Playwright browser | workflow only |

## Reading a failure

- **In the session, after an edit:** the hook is silent when the checks
  pass. When one fails it prints the failing output and the
  `check: FAILED at …` line and exits 2, which Claude Code shows to the
  session next to the edit (the edit itself has already happened). Fix the
  cause; the next edit runs the checks again. Two edits at once never run
  the checks side by side: the second skips while the first runs.
- **On a pull request:** the "Checks" marks are green or red, one per
  piece (`tests (scene)`, `screenshots (shard 2 of 4)`, …). Open a red one,
  then its last step; its last line is the verdict and names the piece.
- **Where screenshots cannot run:** on a machine without Playwright's
  browser, `npm run check` skips them and says so in its verdict; in
  GitHub Actions a missing browser is a failure.

A failing check is shown only on the pull request and in the agent's own
session. Nothing else: no notification, email, badge or summary.
