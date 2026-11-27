# FIELD REPORT — range-day-sixteen — 26 Nov 2026

Nothing on Dan's screen has changed yet: the change is in pull request
[#54](https://github.com/isleofdan/range-day/pull/54), not merged or
deployed. Once it is deployed, the firing line will have an **Aim** switch
in its top row.

(Corrected after result check jobs 20261126-063126-a95578, which asked for the ask to stand without waiting on a later event, 20261126-062701-0501a4, which asked for this paragraph first, and 20261126-060638-facc05: the within-reach measurements are given for each size and mode, and the out-of-brief test fix is out of #54 again (`0d0a630`). Before that, after job 20261126-052901-6316d8: the steadiness line now shows the true-angle figure at every gearing. Earlier: job 20261126-050833-10edaf could not read the code, so the report's measures and pictures left pull request #54.)

## What stands

- **A second way to aim on the firing line: tilting the phone.** One tap on
  **Aim: drag** in the top row (between the short line and **Spotting
  scope**) switches to **Aim: tilt**; a second tap switches back. In tilt
  mode the hold follows where the phone points, and **Center** appears
  beside the switch: one tap makes where the phone points now the
  target's center. The line under the view reads "Tilt the phone to hold
  off the target." in place of "Drag the view…". A drag on the view does
  not move the hold in tilt mode. Switching back to drag keeps the hold
  where the tilt left it. Choosing another target sets the hold to zero
  there, and where the phone points becomes its center.
- **Only the way the hold moves changes.** The tilt writes the same `hold`
  the drag writes (`public/line.js`, "tilt aiming"); the wander, breathing,
  recoil, Steady, Fire and the engine are untouched. At the spotting scope
  the drag moves the scope exactly as before in both modes and the tilt
  moves nothing; back at the rifle the hold is where it was. Playback shows
  no switch and the tilt moves nothing there.
- **The tilt reading** (`public/tilt.js`, new): how far, in degrees right and
  up, the back of the phone points from where it pointed at the last
  centering. It is worked out from the whole rotation the browser gives
  (alpha, beta and gamma together), read in the phone's own axes as they
  were at the centering, never from beta or gamma alone. So the phone held
  upright, as a scope is held, reads smoothly: the test sweeps a made-up
  upright phone through vertical with its screen leaned 5 degrees, where
  the browser's reported angles flip by about 180 degrees between two
  neighboring readings, and the hold moves by no more than each step.
  It also reads the same flat on a table. If the screen turns, it
  re-centers. Smoothing: a one-pole low-pass with a 50 ms time constant
  (a slow sweep lags the phone by about 50 ms).
- **Which sensor:** the code uses the browser's `deviceorientation` event
  (MDN: widely available, secure pages only; the live app is https). It
  does not use `RelativeOrientationSensor`. I could not read Chrome's own
  documentation on which of the two Chrome on Android gives, or what
  backs `deviceorientation` there: this session's network refused
  developer.chrome.com, chromestatus.com and w3c.github.io. The event was
  chosen because MDN lists it as widely available and it needs no
  separate sensor permission on most browsers. Whether it works and is
  steady on Dan's phone is for his walkthrough to show.
- **Permission:** where the browser has `DeviceOrientationEvent.requestPermission`
  (the test browser, Chromium 158, has it), the tap on the switch asks.
- **When tilt cannot work, the screen says so and stays on drag:** no
  readings within one second ("This device gives no tilt readings, so the
  aim stays on drag."), or permission refused ("Tilt was not allowed in
  the browser, so the aim stays on drag."). A visit that opens in tilt
  mode asks too; a browser that wants a tap first says "Tilt needs a tap
  on "Aim: drag" to be allowed in this browser, so the aim stays on drag."
- **Remembered on the device:** key `aim`, `{ "mode": "drag"|"tilt",
  "gearing": 1|4|10|20 }` (`public/game.js`: `getAim`, `setAim`,
  `aimReadFailed`; `docs/RECORDS.md`). First visit: drag at a tenth. A
  refused write shows "The way of aiming is not saved on this device…" in
  the Setting section.
- **Setting section** (a short scroll down): "How far the aim moves when
  the phone tilts": True angle, A quarter, A tenth (default), A twentieth.
  In tilt mode, updated about once a second: "Tilt steadiness: the aim
  moved about N minutes of angle over the last 3 seconds (M at true
  angle)." N is the largest distance between any two points of the tilt's
  own share of the hold over the last 3 seconds, at the gearing in use;
  M is the same at true angle, shown at every gearing (at true angle the
  two are equal; the test checks both cases).
- **Screen stays awake** in tilt mode while the page is visible (screen wake
  lock, asked again on return to the page, released on drag; a refusal is
  ignored).
- **Each shot says how it was aimed:** `aim: "drag"` or `"tilt"` on the shot
  log row and the day's shot (`docs/RECORDS.md`); a record without it was
  drag. Book, cold-bore record and day otherwise unchanged.
- `server.js` serves `/tilt.js` behind sign-in, with the game's other scripts.
- **Tests:** `test/tilt.test.js`, 10 tests: 3 on the maths with made-up
  readings, 7 in a real browser signing in through the form. Two
  screenshot states: `line-aim-tilt`, `line-aim-steadiness`.
  `scripts/line-layout.mjs --aim tilt` measures the firing line in tilt
  mode.

## UI review (the firing line, the one screen changed)

Screenshots at Dan's phone size (378×762), in
`docs/reports/range-day-sixteen/` (carried by the notes pull request, with
this report; the change's pull request holds only the change): `1-drag-378x762.png` (first visit, drag),
`2-tilt-378x762.png` (tilt on, Center showing), `3-tilt-after-shot-378x762.png`
(a shot fired in tilt mode), `4-after-center-378x762.png` (after Center),
`5-no-readings-378x762.png` (after a mistake: tilt on a device with no
readings). At 412×915 and 1280×800: `docs/reports/screenshots/line-aim-tilt-*.png`
and `line-aim-steadiness-*.png`.

1. **Speed of the frequent action:** switching is one tap on a button at the
   top; recentering is one tap beside it.
2. **Recovery:** one tap switches back; switching back keeps the hold; Center
   puts the sight back on the target.
3. **Finding the tool:** the switch says what is on ("Aim: drag"/"Aim: tilt")
   and sits in the top row with the other mode button (Spotting scope).
4. **Orientation:** the switch is filled in the game's color while tilt is on;
   the line under the view says which way to aim.
5. **Feedback:** the view moves as the phone tilts; the steadiness line gives
   a number once a second; a failed switch says why in the line under the
   view.
6. **Interruption:** none added; the fallback line replaces the line under
   the view only when the switch fails.
7. **Thumb reach:** both buttons 44 px tall, at the top of the screen, more
   than 100 px from Steady and Fire at every size; nothing moved under the
   bar. The steadiness line and gearing are a short scroll down, as the
   brief set.
8. **Defaults:** drag on the first visit; a tenth gearing; the last choice
   remembered.

What I did not add, and why: no landscape layout (the brief's rule); no
tilt at the spotting scope or in playback (out of scope); no change to the
wander or Steady in tilt mode (Dan's to say after he has tried it). Which
of the eight Dan's request came from: 1 and 3 (a switch between the two
ways of aiming, his words: "The toggle over to tilting the phone to aim").

One cost seen on the screenshots: on Dan's phone in tilt mode the short
line at the top shrinks to the rifle's first word ("Molo…", "BCM…") to make
room for Center; a tap still opens the full description.

## What the brief got wrong

- **The branch name.** The brief named `claude/range-day-sixteen`; this
  cloud session may push only to its assigned branch,
  `ccr-6d28eeff-txft9m`, so the work is there.
- **"Commit after each numbered step."** Steps 2 to 8 went in one commit
  (`a6b1310`): they touch the same few lines of `public/line.js` and were
  written and tested together. Step 1 and step 9 are their own commits.
- **The screenshot-state count.** The range-day-fifteen note was read in the
  brief as 113; the list before this session has 114 (`node
  scripts/screenshots.mjs --list` on `06ffd9f`), 116 after.
- **"Find out from the browser's own documentation"** which sensor Chrome on
  Android gives: not possible from this session (the hosts were refused;
  see "What stands").
- **Pushing with `gh pr create`:** this environment has no `gh`; the pull
  request was opened through the GitHub connector.

## Deliberate divergences

- **The report's measures and pictures go in the notes pull request**, not
  the change's. They were first pushed with the change (`227dbc2`); the
  first result check (job 20261126-050833-10edaf) could not read the code
  because its copy of the change was cut off after those files, which sort
  first. They were taken out of #54 in the next commit and will come back
  in the notes pull request with this report.

- The **Aim switch and Center sit in the top row**, between the short line
  and Spotting scope, rather than in a row of their own, so the view keeps
  all its height on Dan's phone (0 px given up). The short line gives up
  the width.
- The test browser here is the machine's Chromium 158 at Playwright's
  expected path, run headless-shell, because the repository's Playwright
  expects a browser build this machine does not have. With the full
  browser, existing tests failed before any change (the first run listed
  9 before I stopped it) on a request for `/favicon.ico` that the headless
  shell does not make; with the headless shell the one I re-ran passes.
  Nothing in the repository was changed for this.

## Verify results

- **Tests:** before any change, 164 tests: 97 passed, 67 skipped (the
  browser tests, before I pointed them at this machine's browser), 0
  failed. After: 174 tests (the 10 new ones); the full local run with the
  browser, and the pull request's checks, are under "Full runs" below.
- **Full runs:** the pull request's checks passed in full on `227dbc2`
  (run 45757124986), `ccfa308` (run 45759914967) and `5a53679` (run
  [45764126318](https://github.com/isleofdan/range-day/actions/runs/45764126318));
  on `0b77c86` (run 45762397221) one old test failed on a timing race in
  the test itself (see "Found, not fixed here"). On the head, `0d0a630` (the
  same code as `0b77c86`), all 13 jobs passed: run
  [45766335825](https://github.com/isleofdan/range-day/actions/runs/45766335825). Each run: the 9 test groups (the new `test/tilt.test.js` runs in
  "rest", which lists it) and the 4 screenshot shards. On this machine the
  10 new tests pass with the browser (`node --test test/tilt.test.js`:
  10 of 10), and the whole suite with the browser, run on `ebd34c6`, gives
  174 tests, 174 passed, 0 failed, 0 skipped; after the steadiness fix the
  10 tilt tests pass again here (10 of 10, with the new true-angle case).
- **Screenshot states:** 114 before, 116 after.
- **Result checks.** Job 20261126-050833-10edaf could not read the code
  (its copy was cut off; see the divergences). Job 20261126-052901-6316d8
  found the steadiness line left out the true-angle figure at true-angle
  gearing; fixed in `0b77c86`, with a test. Job 20261126-060638-facc05
  asked for the within-reach measurements by size and mode (the table
  below) and for the out-of-brief test fix to leave #54 (`0d0a630`). Jobs
  20261126-062701-0501a4 and 20261126-063126-a95578 asked for the report's
  first paragraph and the wording of the ask; both done in this report.
  Job 20261126-063434-da5f88 on this report: **PASS**.
- **Within reach** (`scripts/line-layout.mjs`, printed in full to
  `docs/reports/range-day-sixteen/line-layout-before.txt`,
  `line-layout-drag.txt`, `line-layout-tilt.txt`, in the notes pull
  request). Page at its top, pixels from the top of the screen; the
  positions are the Vepr scope's, one of the 38 sights measured at each
  size:

  | Mode, size | Sights within reach | View (px) | Aim switch | Center | Book line | Steady and Fire bar from |
  | - | - | - | - | - | - | - |
  | drag, 412×915 | 38 of 38 | 380 | 46.5–90.5 | not shown | 723.5–755.8 | 846 |
  | drag, 412×830 | 38 of 38 | 380 | 46.5–90.5 | not shown | 723.5–755.8 | 761 |
  | drag, 378×762 | 38 of 38 | 314 (scopes), 346 (irons) | 46.5–90.5 | not shown | 657.5–689.8 | 693 |
  | tilt, 412×915 | 38 of 38 | 380 | 46.5–90.5 | 46.5–90.5 | 723.5–755.8 | 846 |
  | tilt, 412×830 | 38 of 38 | 380 | 46.5–90.5 | 46.5–90.5 | 723.5–755.8 | 761 |
  | tilt, 378×762 | 38 of 38 | 314 (scopes), 346 (irons) | 46.5–90.5 | 46.5–90.5 | 657.5–689.8 | 693 |

  **The view gave up 0 px at 378×762** (and at every other size): all 190
  view measures in `line-layout-before.txt` (the code before this session,
  `06ffd9f`) equal those after, in both modes.
- **Upright sweep:** the largest jump in the hold between two neighboring
  made-up readings, at true angle, is **3.002 minutes of angle** for a step
  of 3.000 (0.05 degree), both in the maths alone and in the page.
- **Smoothing delay:** 50 ms (time constant 0.05 s; the test checks the
  one-pole response after 50 ms).
- **What I could not prove:** no real motion sensor was read in this
  session. Every tilt here is a made-up reading fed through the page's test
  door. Whether tilt aiming works and is steady is for Dan's phone to show.

## Found, not fixed here

- `test/scene.test.js`, the range-day-six test "verify 4": the two waits
  for the Tavor's firing line (`await page.waitForSelector('#fire');
  await sceneReady(page);`) stand inside the comment at the end of the
  `page.goto` line, so they never run and the test sometimes reads the page
  before it has loaded ("RangeDayLine is not defined", Checks run
  45762397221). The fix is to move them out of the comment (made and
  tested here as `5a53679`, then taken out of #54 as outside this brief;
  this session can push only its own branch, so it is in no pull request).
  Until it is fixed, a Checks run can fail on it at random.

## Asks

1. Merge pull request #54 and deploy Range Day with it: yes or no.
   Recommended: yes.

## What the next session needs

- The one-line test fix under "Found, not fixed here", in its own pull
  request.

- What Dan finds with tilt aiming goes back to the Personal Shipyard chat
  that planned this session (whether the hand should replace the wander,
  firing from outside hardware).
- The workbench, pistols in the game and their targets, and the .22's own
  scope stay as the card has them, each planned by a Personal Shipyard
  chat. The picture work stays paused and the plate flicker set aside.

## Environment

- Surface: `/data/home/dan/FACTS.md` does not exist here: this is a cloud
  session, not the Linux machine.
- Permission mode: Auto (the session's own notice says auto mode is active;
  no status line is visible to me).
- Route: Claude Code cloud session, builder Claude; independent checker the
  Codex result check.

## Closing message to Dan

Tilt aiming is built and all its checks passed (pull request #54). Nothing
on your phone has changed yet.

**Needed from you**

1. Yes or no: merge and deploy range-day-sixteen? The game restarts for
   about a minute; your saved days and zeros stay; the firing line gains
   the Aim switch. For yes, type:

```
yes, merge and deploy range-day-sixteen, then merge its notes
```

## After the merge (addendum, 26–27 Nov 2026)

- **Merged and deployed.** Pull request #54 squash-merged as `738416d`; Deploy run 26
  ([45845486381](https://github.com/isleofdan/range-day/actions/runs/45845486381)) green: alive line, sign-in
  through the form, `/scene.min.js` in the image, a crash reaching Sentry.
- **Brief check finding 3 (event 3070): the live firing line in a real browser.** This session cannot reach the live
  site (the cloud proxy refuses it) and holds no passphrase, so the check became a workflow: pull request
  [#55](https://github.com/isleofdan/range-day/pull/55), merged as `94f6e01` on Dan's yes. `scripts/prod-check.mjs` signs in
  through the form, opens the firing line under the Plain picture (the view must show at least 20 colours and 100 drawn
  samples, the Aim switch and Fire), then under Full (the picture must stay Full and the scene must not fail), and fails on
  any page error, console error or HTTP status 400 or above. Run 1
  ([45888829854](https://github.com/isleofdan/range-day/actions/runs/45888829854)): signed in; plain view 380×380, 78 colours
  in the sample, 1489 drawn samples, "Aim: drag", Fire shown; full picture full; browser errors none. Screenshots in the
  run's `prod-check` artifact.
- **What Dan saw on his phone.** Step 1: tilting moves the view ("View follows"). Step 2: Center brings the sight back
  ("yes"). He then reported "The steady button doesn't work for phone orientation aiming": Steady did what it does in
  drag mode, which is small next to a real hand. On his yes, pull request
  [#56](https://github.com/isleofdan/range-day/pull/56) (merged as `2bbb41b`, Deploy run 27,
  [45905227504](https://github.com/isleofdan/range-day/actions/runs/45905227504), green) smooths the tilt over 400 ms instead
  of 50 ms while Steady is held; two new tests; independent result check PASS (job 20261126-215619-f84240, after one
  finding on this note's date line). #56 also carries the scene test's wait fix from "Found, not fixed here", because that
  test failed on #56's own run with the same "RangeDayLine is not defined". Dan on the deployed fix: Steady calms the sight
  ("yes").
- **Step 3, the steadiness line, Dan's two numbers (true angle, minutes of angle over 3 seconds):** phone flat on a table
  **3328.9**; in the hand, aiming, **56.5** (about 0.9 degree of sway, about 5.7 minutes of angle on screen at the default
  tenth). The table figure is not the phone's noise: laid flat, the phone points about 90 degrees from where the aim was
  centered, and there the right-and-up reading (atan2 over the forward part, which is near zero) runs away, so tiny
  movements read as huge ones. Found, not fixed here: the steadiness line should measure the spread as the angle between
  pointing directions, so it holds at any distance from the centering.
- **Found on the walkthrough: the Setting section sits below the shot log,** which grows with every shot, so the
  steadiness line was under several hundred rows on Dan's phone. Every screenshot state starts from an empty log, so the
  layout checks never saw it. Proposed to Dan: Setting above the log, the steadiness line under the view in tilt mode,
  and a test with a 300-shot log; waiting on his yes.
- **Dan's correction, recorded:** a line for Dan to type went into a chat reply as inline code, not a fenced block (third
  instance; the report check in `test/report-shape.test.js` reads reports only). Filed for the reply guard on the Wall card
  Shipyard shared notes (event 3086).

## The Setting move (addendum, 27 Nov 2026)

- **On Dan's yes ("yes, build, merge and deploy the Setting move"):** pull request
  [#58](https://github.com/isleofdan/range-day/pull/58), merged as `591df8c`; Deploy run 28
  ([45945691797](https://github.com/isleofdan/range-day/actions/runs/45945691797)) green. Setting stands above the shot log;
  in tilt mode a "Steadiness" reading shows over the bottom edge of the view; the steadiness measure is the largest angle
  between the last 3 seconds' unsmoothed pointing directions, so it holds at any distance from the centering. Two new tests
  (the flat-table case; a 300-row log at the three phone sizes) and a screenshot state, `line-long-log` (117 states).
  Independent result check PASS (job 20261127-051101-1f486d) after three rounds of findings: a bench test fix kept out of
  scope, the Setting steadiness line added to the long-log test, the two measures compared on the same readings.
- **The first Checks run caught a real fault:** at 378×762 the reading ran 5 px past the screen's edge in the Checks
  browser's font; it now wraps inside the view, and the widest reading is tested.
- **What Dan saw after the deploy** (true angle, minutes of angle over 3 seconds): in the hand **49.5** (56.5 the day
  before); flat on the table read at once **4085.9**, read again after 10 untouched seconds **5.3**. The first table
  reading still held the moment the phone was laid down: the window is 3 seconds and the steps said to wait 5, which
  is too short once reading time is counted. The sensor itself, lying still, moves about 0.09 degree; Dan's hold about
  0.8 degree.
- **Found, not fixed here:** `test/bench.test.js` verify 8 failed once on #58's first run: its sign-in helper clears the
  device before the home page has written the last rifle, so that write can land in the test's "every key held before"
  snapshot. The one-line wait (`dd5dd68`, local branch `bench-race-fix`) goes in its own pull request.
