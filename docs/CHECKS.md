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

## What runs when

| When | What runs | Where it is set |
| - | - | - |
| After every edit or new file an agent makes in Claude Code | syntax, tests | `.claude/settings.json`: a `PostToolUse` hook on `Edit\|Write` running `node scripts/check.mjs --hook`, timeout 30 s |
| On every push and every pull request | syntax, tests, screenshots | `.github/workflows/checks.yml` ("Checks") |
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
- **On a pull request:** the "Checks" mark is green or red. Open it, then
  the step "Run every check"; its last line is the verdict.
- **Where screenshots cannot run:** on a machine without Playwright's
  browser, `npm run check` skips them and says so in its verdict; in
  GitHub Actions a missing browser is a failure.

A failing check is shown only on the pull request and in the agent's own
session. Nothing else: no notification, email, badge or summary.
