# FIELD REPORT — range-day-nine — 2026-11-20

Nothing on Dan's screen has changed yet. The new firing-line layout is in pull request [#22](https://github.com/isleofdan/range-day/pull/22), which is not merged or deployed. Merging and deploying it will put the new layout on the live app.

(Second filing: corrected for result check 20261120-171610-ecf799, findings 1–4, and carrying the green Checks run. Findings and fixes: 1, the 412×800 figure now says the 1 MOA buttons for the scope and dot fall under the bar; 2, verify 3 now gives the three boxes' places before and after, printed by the test (commit 875a99d); 3, the close-out order is stated as the repository's fixed sequence; 4, the picture work's pause is stated as Dan's word of 21 Nov 2026.)

## What stands

How this session ran: a Claude Code cloud session on `isleofdan/range-day`. The container has no `/data/home/dan/FACTS.md`, so it is the cloud and not the Linux machine. Permission mode: auto (from the session's own record, `permission_mode: auto`; this session changed no permission setting). Builder model: `claude-opus-5-5` (the session's record, `session_context.model` and `last_served_model`). Independent checker: the Codex result checker, through Spine's `check_result`.

- **One measure for the firing line's layout** (`scripts/line-layout.mjs`, `test/line-reach.js`). It signs in through the form, opens the firing line with the page at its top, and prints for each item on the within-reach list whether its whole box is on screen and, on the phone, above the Steady and Fire bar. It also gives the bar's own checks, the view's size and every button's height. Before any other file changed, it was run on `main` (commit 4f4ebc8) and saved as `docs/reports/line-layout-before.txt`. The result: at 412×915, the result line, the sight's glass control and every elevation and windage button sat below the bottom of the screen for all three sights (verdict "NOT within reach" six times out of six).
- **The firing line rearranged** (`public/line.html`, `public/line.js`, `public/app.css`, commit 94ea7c5). On a phone, from the top, without scrolling:
  - a one-line summary, e.g. "BCM AR-15 carbine, 55 gr, Rifle line · 58 F, November morning". A tap opens the full description over the page and a second tap closes it.
  - the plate picker, with the sight's glass control beside it: the zoom, the magnifier, or the rear leaf.
  - the view, at its old size.
  - where the last shot went, in two lines. A longer result is marked ▾ and opens over the page on a tap. When the box is empty, "Open another box" stands beside it.
  - the sight strip: elevation and windage settings, the one-click buttons, and the 1 MOA buttons, with the rounds left under it.
  - the book's newest line for this distance.
  - Steady and Fire, fixed at the bottom.

  Below, a short scroll away: the wind call, the cold-bore note, the zero note and its button, "The day" (the book, the day so far, Pack up), the shot log with "Clear the log", and then the settings. On a computer the same list stands in a column beside the view, and Steady and Fire sit at the foot of that column. `docs/reports/line-layout-after.txt`: "every held sight-and-size pair within reach".
- **Nothing shifts under the thumb.** The test "the firing line: nothing shifts under the thumb" in `test/day.test.js` printed, at both sizes: "moved view 0, strip 0, bar 0 px; scrolled 0". That held after a miss (with the cold-bore note going), with the result opened, after a hit that wrote a book line, with the full description opened, with the box empty, and after another box was opened.
- **Same shots, same picture:** `git diff origin/main -- public/engine.js data src/scene | wc -c` gives `0`. The view is 380×380 pixels at 412×915 and 640×640 at 1280×800, as before (both measure files).
- **No new stored record.** The folds are not remembered; nothing in `docs/RECORDS.md` changes.

## UI review (per screen touched)

One screen changed: the firing line (`/line`).

1. **Speed of the frequent action (fire, read, turn the sight, fire again):** all of it now happens on one screen at 412×915, with no scroll between reading where the shot went and turning the sight (`line-top-after-miss-phone.png`).
2. **Recovery:** both folds close with a second tap, and new text closes them by itself. "Open another box" shows beside the result as soon as the box is empty.
3. **Finding the tool:** the sight's own glass control sits beside the plate picker instead of three screens down. A longer result or book line carries a ▾ mark.
4. **Orientation:** the one-line summary names the rifle, the load, the course, the temperature and the day. The full description is one tap away.
5. **Feedback:** where the shot went shows directly under the view, inside the screen, after every shot.
6. **Interruption:** none is added. The folds open over the page and never push it, and the page never scrolls by itself.
7. **Thumb reach:** Steady and Fire stay lowest and largest (56 px). Every button on the within-reach list is 44 px or taller (verify 4). Pack up and Clear the log stay in the scroll area, away from the bar.
8. **Defaults and prefill:** unchanged. The wind call still starts from the last one.

What I did not add: no new control, no remembered fold, and no figure the engine works out ("the game never gives the drop"). Which of the eight Dan's request came from: 1, 3 and 7. He asked for "what I'd naturally want to have immediate access to when shooting, and what I wouldn't mind having to scroll a bit to find."

Screenshots (`docs/reports/screenshots/`, both sizes): `line-top-first-shot` (before any shot), `line-top-after-miss` (after a mistake), `line-top-after-hit` (after the frequent action, with the book filled in), `line-top-short-opened` (the description opened), `line-top-scrolled-wind` (the scroll area). For comparison, the old page as `main` has it is in `line-after-hit-phone.png` and `line-wind-call-phone.png` (the committed copies are main's layout; those states still run in every Checks run against the new layout, which does not commit its images).

## What the brief got wrong

1. **Task item 1** asks the measure to report "the short line" on the page as `main` has it, but there is no short line on `main`. The before-measure uses the description paragraph (`.dayline`) in its place, and `test/line-reach.js` says so.
2. **The brief check's finding 1** (job 20261120-161325-7ae7f8) says the brief should send this work to the Linux machine. `CLAUDE.md` ("Choosing an executor and review lane") says "Cloud is the default for suitable new work", and Dan's own words in the brief chose the cloud. The session ran in the cloud.
3. **The brief check's finding 2** says the Terrain and Ground workflows' state was unsourced. Read this session from GitHub: Terrain last ran on 18 Nov 2026 (run 44414935561, success) and Ground ran once on 20 Nov 2026 (run 44711714459, success). This session started neither, and its pushes started no run of either.
4. **The brief check's finding 3** warns that auto mode may refuse the production deploy. That only matters after Dan's typed line. If auto mode refuses the deploy, I stop there and report the step and the name of the rule that refused it.
5. **Not the brief's error, but cost a step:** the container's copy of `main` was stale (4fababb, from range-day-four). My first branch started from it, and I moved the branch to 4f4ebc8 before any work. A session that branches without fetching first would build on a page three sessions old.

## Deliberate divergences

1. **"Open another box" stands beside the result, not under it.** Under it would push the sight strip down when it appears, which item 5 forbids. Beside it, it is still on screen without scrolling (the test checks this).
2. **The separate setting line (`#setting-line`) is kept, but hidden on screen.** Tests read it (browser verify 10, verify 5 for the magnifier, verify 8 for the leaf), and so do the screenshot checks ("Magnifier out", "Leaf 3 (300 m"). Its words are shown on screen by the strip's own figures and by the glass control (magnifier in or out; the leaf's setting). Screen readers still read the full sentence. It sits in `.strip .setting`, next to the rounds left.
3. **The heading "Firing line" is kept, hidden on screen**, for screen readers and for the screenshot state that checks for it.
4. **The rear leaf's explanation** ("the sliding range setting; the number is hundreds of meters") moved into the opened description. Beside the plate there is room only for "Rear leaf 3 (300 m)" and the two buttons.
5. **The summary line leaves out the day's adjective ("cool") and puts the temperature first**, so a phone cuts the month off the end rather than the temperature. The full sentence is in the opened description.
6. **The book's line shows the newest line only.** Older lines stay in the book, one tap away on its link (the brief allowed either). Verify 7 now holds "one line: the newest" instead of "two lines, no more".
7. **Computer layout: the column beside the view starts at 1,100 px wide** (the old Steady and Fire breakpoint) and is 408 px wide. A 300 px column squeezed the windage buttons past its edge. Below the view, the page keeps to the view's width, so the bar never covers the wind call.
8. **The note that the picture fell back to Plain** moved to the top of the scroll area, so its appearance cannot push the view.
9. **Commits:** items 2–5 are one commit (94ea7c5), because they are one arrangement and splitting them would leave half-arranged pages. The new screenshot states went in with the words (752c7d4).

## Verify results

1. **The measure, before and after** (`docs/reports/line-layout-before.txt`, `line-layout-after.txt`):

   | Size | Sight | Before: within reach | After: within reach | Bar check before / after | View before → after |
   | - | - | - | - | - | - |
   | 412×915 | Vepr scope (zoom) | no (glass control, result, 6 strip items off screen) | yes, all 13 | fixed at bottom: yes / yes | 380×380 → 380×380 |
   | 412×915 | Tavor SAR dot (magnifier) | no (same) | yes, all 13 | yes / yes | 380×380 → 380×380 |
   | 412×915 | AK irons (rear leaf) | no (same) | yes, all 13 | yes / yes | 380×380 → 380×380 |
   | 1280×800 | Vepr scope | no (view ends at 917, all below it off screen) | yes | beside the view: yes / yes | 640×640 → 640×640 |
   | 1280×800 | Tavor SAR dot | no | yes | yes / yes | 640×640 → 640×640 |
   | 1280×800 | AK irons | no | yes | yes / yes | 640×640 → 640×640 |

   At 412×800 (figure only), the bar's top is at 723:
   - For the scope and the dot, the 1 MOA buttons end under the bar (699.3–743.3 and 695.3–739.3).
   - The rounds left end under it too (771.3, 767.3 and 739.2 for the three sights).
   - The book line ends at 810.7 (Vepr), 806.7 (Tavor SAR) and 778.6 (AK).
   - Within reach at 412×800: the summary line, the plate, the glass control, the view, the result, the settings, and the one-click elevation and windage buttons.
2. **Same shots and same picture:** `git diff origin/main -- public/engine.js data src/scene` is empty (0 bytes).
3. **Nothing shifts** (`test/day.test.js`, "nothing shifts under the thumb", printed; each place is left, top, width, height in pixels):
   - **412×915, before:** view [16, 156.5, 380, 380], strip [16, 604.5, 380, 168], bar [0, 838, 412, 77].
   - **The same places at 412×915** after a seeded miss (the cold-bore note gone), with the result opened, after a seeded hit that wrote a book line, with the full description opened, with the box empty and "Open another box" shown, and after another box was opened. Each time: "moved view 0, strip 0, bar 0 px; scrolled 0".
   - **1280×800, before:** view [106, 62.5, 640, 640], strip [766, 280.5, 408, 168], bar [766, 694, 408, 82].
   - **The same places at 1280×800** after the same steps (the result fit in two lines there, so it had no fold to open). Each time: moved 0, 0, 0; scrolled 0.
4. **Touch size at 412×915** (after-measure): plate 44, zoom 44, magnifier 44, leaf-down 44, leaf-up 44, el-down 44, el-up 44, wd-left 44, wd-right 44, the four 1 MOA buttons 44, the summary line 44, steady 56, fire 56. None is under 44. Before: plate 41 and the four 1 MOA buttons 40.
5. **Screenshots:** the five new states at both sizes (`docs/reports/screenshots/line-top-*.png`), "all checks passed (5 of 73 states)": each fits the width (no sideways scroll), and the tests found no console error (`assert.deepEqual(errors, [])` in both new tests).
6. **The check:** the pull request's latest Checks run is [44781816992](https://github.com/isleofdan/range-day/actions/runs/44781816992) on commit 875a99d, and it is **green: all ten jobs passed**. Times:
   - tests: rest 27 s, browser 1 min 23 s, day 1 min 22 s, scene-scale 4 min 29 s, scene-shots 8 min 22 s, scene-rest 8 min 46 s.
   - screenshots: shard 1 6 min 5 s, shard 2 6 min 55 s, shard 3 10 min 15 s, shard 4 7 min 6 s.

   The run before it, [44776316081](https://github.com/isleofdan/range-day/actions/runs/44776316081) on commit 752c7d4, failed one job: tests scene-rest, 22 min 49 s, 2 of 12 tests. "The first visit" hit `page.waitForFunction: Timeout 30000ms exceeded`, and verify 4 (range-day-six) found no reticle dots: "mil-dot spacing NaN/NaN vs 48.0". Both are timing failures on a slower machine (Azure eastus, 1,352 s for the group, against 502 s on `main`'s last run, 44762215589, on AWS us-west-2). The same group passed:
   - in this session, at 519.2 s;
   - in the green run above, at 8 min 46 s, after a change that touched only another test's printed output (commit 875a99d, `test/day.test.js`).

   Nothing was re-run by hand.

   Counts: tests 109 before and 111 after (counted as `test(` lines in `test/*.test.js` on `origin/main` and on `range-day-nine`); screenshot states 68 before and 73 after (`node scripts/screenshots.mjs --list`). Changed tests and why:
   - verify 7 in `test/day.test.js`: the book line now shows the newest line only, as the brief's task item 2 asks.
   - verify 13 in `test/day.test.js`: it checks the strip's figures and buttons, the result and the book line above the bar, in place of the hidden setting line (task item 6: "brought up to the new arrangement, not weakened").

   Run in the session, one piece at a time: `--group browser` passed, `--group day` passed (12 tests), `--group rest` passed, `--group scene-rest` passed (519.2 s), and `npm run screenshots -- --grep '^line-top-'` passed ("all checks passed (5 of 73 states)").
7. **Size for the result checker:** `git diff origin/main...range-day-nine | wc -c` gives 90527 bytes on commit 875a99d, under 400,000.
8. **The deploy result:** filed on the card after the deploy, in the note of close-out item 5.

What this cannot prove: the session cannot open the live app or hold a phone. Dan's phone may show a shorter screen than 412×915, because a browser's own bars take room. So this session has not verified that everything is within reach on his phone. At 412×800 the result, the settings, the one-click buttons, the glass control and the view are within reach; the 1 MOA buttons (scope and dot), the rounds left and the book's line fall under the Steady and Fire bar (figures in verify 1).

## Asks

1. **Merge and deploy range-day-nine?** Recommended: yes. All ten check jobs pass on the pull request (run 44781816992), the picture and the shots are unchanged (verify 2), and one revert undoes the change. Type `yes, merge and deploy range-day-nine, then merge its notes`.

## What the next session needs

- Dan's look on his phone at https://range-day-dan.fly.dev, Firing line: is the book's line above Steady and Fire on his screen? If his screen is shorter (as at 412×800), the next layout step is to put the rounds and the book line beside each other on one line.
- Older wording, seen in the new screenshots and not touched: a dead-centre hit reads "level, centered of center" (`RD.whereText` in `public/game.js`, used by the result line). One line fixes it.
- After this build the after-every-edit hook's fast test subset still runs the whole `npm test` (`CLAUDE.md`, "An app whose `npm test` takes more than 20 seconds puts a fast subset in `npm run test:fast`"). This is noted only; the starting kit is untouched.
- In a cloud container, Playwright 1.56.1 looks for Chromium build 1194 while the container has 1243. This session linked the installed build into a folder outside the repository (`PLAYWRIGHT_BROWSERS_PATH`, with `chromium-1194/chrome-linux` and `chromium_headless_shell-1194/chrome-linux/headless_shell` pointing at the 1243 files). Without that link the browser tests are skipped, quietly.
- The rest, each planned by a Personal Shipyard chat: the near targets at 50 and 100 yards with paper to shoot, with the spotting scope; the sights Dan fitted to his rifles and the Vepr's 3-9x scope; recording and playback. The picture work (the ground, the Light picture's speed, the iron sights' look, the rifle line's picture) is paused on Dan's word of 21 Nov 2026, and is not in that list.

Branches and the close-out order: the change is on `range-day-nine` (pull request #22). This report and the `PLAN.md` note are on `range-day-nine-notes`. The order on Dan's typed line is fixed by this repository's standing rule (`CLAUDE.md`, "Field reports"), not by this session:
1. Merge pull request #22.
2. The Deploy run.
3. A notes-only pull request from `range-day-nine-notes`, which then differs from `main` only by this report and the `PLAN.md` note, merged.

## Result check rounds

1. Job 20261120-171610-ecf799 (report event 2883): FINDINGS, 4 findings, all on the report; each is fixed as listed at the top of this filing.
2. Job 20261120-173010-dc4b73 (report event 2885): PASS.

## Closing message to Dan (draft; sent only after a PASS)

Nothing on your screen has changed yet: the new firing line is ready in [pull request #22](https://github.com/isleofdan/range-day/pull/22), and merging and deploying it will put it on the live app.

What it does: on your phone, everything you use between shots now fits on one screen without scrolling. From the top: a one-line summary of the rifle, load, course and day (tap it for the full description); the plate picker with the zoom, magnifier or rear leaf beside it; the view, the same size as before; where your last shot went, right under the view; the elevation and windage buttons with their settings and the rounds left; your newest book line for that distance; and Steady and Fire at the bottom. The wind call, notes, the day's links, the shot log and the settings are a short scroll below. Nothing jumps when a shot lands or a note appears. The picture and how the bullets fly are unchanged.

All the automatic checks pass.

Needed from you
1. Type: `yes, merge and deploy range-day-nine, then merge its notes`.

# FIELD REPORT — range-day-nine-b — 2026-11-21

Nothing on Dan's screen has changed yet: this follow-up is in pull request [#24](https://github.com/isleofdan/range-day/pull/24), not merged or deployed; merging and deploying it will show it.

This is the second change of session range-day-nine, made after the first was merged and deployed. Dan looked at the live firing line on his phone and sent two screenshots.

## Where each task item of the brief stands

Items 1 to 7 of the brief were done in pull request [#22](https://github.com/isleofdan/range-day/pull/22), merged as 6f72061 and deployed (Deploy run 44836938388). The record is the range-day-nine report above.
- Item 1, the measure: `scripts/line-layout.mjs`, and `docs/reports/line-layout-before.txt` from `main` before any change. #24 adds `docs/reports/line-layout-before-nine-b.txt`, the live page (38b5702) measured before #24 at all sizes including Dan's.
- Items 2 to 5: the within-reach arrangement, the scroll area's order, the computer layout and "nothing shifts" (`public/line.js`'s folds, `public/app.css`'s fixed-height slots and wide-screen column).
- Item 6: the two new tests and the five `line-top-*` screenshot states.
- Item 7: README and `docs/CHECKS.md`.

#24 changes only what Dan's phone showed was short of item 2 at his screen's height. It keeps items 3 to 7 as merged: the scroll area's order, the computer layout and the folds' code are untouched. It brings the tests (`test/line-reach.js`, `test/day.test.js`), the screenshots, the measure and the two documents up to date.

## What stands

Route: the same Claude Code cloud session, permission mode auto, builder model claude-opus-5-5. Independent checker: the Codex result checker.

Dan's words with his screenshots: "The book line isn't visible at first when I open the firing line … a little bit cut off, but with a button that allows me to expand it."
- His screen is about 830 CSS pixels tall (992×2000 pixels at 2.41 device pixels per CSS pixel), not the 915 the first change was held at. So the book line sat under Steady and Fire. The before-measure shows it: at 412×830 the book line's bottom was at 810.7 (Vepr), 806.7 (Tavor SAR) and 778.6 (AK), against the bar's top at 753 (`line-layout-before-nine-b.txt`).
- The top of a third line ("2026") showed under the clipped book line. A clamped text overflows into its box's padding, and the slots had padding.

What #24 changes (`public/line.html`, `public/app.css`, commit c9cabbf):
- The rounds left (same text) stand under the word **Fire**.
- Elevation and Windage are named on their box's top edge, so each setting takes one line.
- The book line holds one line, and ▾ opens the rest.
- The gaps, the top bar's link padding and the bar's padding are trimmed. Steady and Fire are 52 px tall.
- The text slots' space above and below the text is transparent border, not padding.

The view is unchanged (380 and 640 px square). `git diff origin/main -- public/engine.js data src/scene` is empty.

The lasting fix:
- `test/line-reach.js` holds the within-reach list at **412×830, Dan's phone**, as well as 412×915.
- The "within reach" test asserts that neither text slot has vertical padding.
- `scripts/line-layout.mjs` measures 412×830.
- Three picture tests that failed on fixed waits on slow runners are fixed in their own pull request, [#25](https://github.com/isleofdan/range-day/pull/25) (verify 6 below). #24 carried that fix in commit b7ef52e until result check round 3, finding 3, found `test/scene.test.js` outside this brief's scope. Commit 9ee1e68 took it out of #24.

## UI review (the firing line)

1. **Speed of the frequent action:** on Dan's 830-pixel screen, reading the result, turning the sight and firing all happen without a scroll (verify 1).
2. **Recovery:** unchanged. The folds close with a second tap, and "Open another box" stands beside the result.
3. **Finding the tool:** each knob's name sits on its box's edge. The ▾ on the one-line book line says there is more.
4. **Orientation:** unchanged: the one-line summary at the top.
5. **Feedback:** where the shot went shows under the view. The rounds left change under the word Fire at the press.
6. **Interruption:** none added. Nothing moves (verify 3).
7. **Thumb reach:** Steady and Fire are lowest and largest (52 px). Every other button is 44 px (verify 4).
8. **Defaults and prefill:** unchanged.

What I did not add: no new control or record. Which of the eight Dan's report came from: 1 and 7 (the book line under the bar), and 5 (the clipped third line read as an error).

Screenshots (`docs/reports/screenshots/`, both sizes, retaken for #24): `line-top-first-shot` (empty: no shot yet), `line-top-after-miss` (after a mistake), `line-top-after-hit` (after the frequent action), `line-top-short-opened`, `line-top-scrolled-wind`. Dan's own two screenshots of 21 Nov 2026 are the "before" at his phone width.

## What the earlier report got wrong

It held the layout at 412×915 only and gave 412×800 "as a figure only". The real phone was between the two, and that figure was not held by any test.

## Deliberate divergences

The first five are about what this pull request leaves out, named as the result checker asked (round 2, findings 1–5). The reason is the same for all five: the item was carried out in #22, which is merged and live, and #24 is a correction on top of it, not a second copy.

1. **Task item 1:** #24 does not add `docs/reports/line-layout-before.txt`. That file, the measure of `main` before any change, was committed first in #22 (commit ab3c3d3) and is on `main`. #24 adds `line-layout-before-nine-b.txt`, the measure of the live page before #24. Both are in verify 1 below.
2. **Task item 3:** #24 does not change the order below the within-reach list. #22 set it (wind call, cold-bore note, zero note, the day, the log, the settings), and #24 keeps it.
3. **Task item 4:** #24 does not set up the computer layout. #22 did (the column beside the view at 1,100 px and over). #24 keeps it and measures it (verify 1).
4. **Task item 5:** #24 does not add the steadiness behaviour. #22 did (the fixed-height slots and the folds that open over the page). #24 keeps it, and its test still holds it (verify 3).
5. **Task item 6:** #24 adds no new test. The two tests item 6 asks for were added in #22. #24 makes them stricter: the within-reach test now also holds 412×830 and checks that the text slots have no vertical padding.

Then the changes #24 makes on purpose:

6. The rounds left moved from beside the sight strip (task item 2) into the Fire button, because the strip and the book line did not fit Dan's screen with the rounds on their own line. Verify 13 holds the rounds inside the Fire button.
7. The book line holds one line, not two (the brief allowed "one or two lines").
8. Steady and Fire are 52 px tall, from 56. They are still the largest controls on the page.

## Verify results

1. **The measure.** Three files:
   - `docs/reports/line-layout-before.txt`: the original `main` before any change, 4f4ebc8.
   - `docs/reports/line-layout-before-nine-b.txt`: the live page before #24, 38b5702.
   - `docs/reports/line-layout-after.txt`: #24.

   The original `main` at 4f4ebc8, before range-day-nine (`line-layout-before.txt`), element by element. The yes and no are the same for all three sights (the Vepr's scope, the Tavor SAR's dot, the AK's irons); the file gives each sight's pixel places.

   | Element | 412×915: inside the screen | 412×915: above the bar | 1280×800: inside the screen |
   | - | - | - | - |
   | short line (then the description) | yes | yes | yes |
   | plate picker | yes | yes | yes |
   | sight's glass control | no | no | no |
   | view | yes | yes | no (277–917 of 800) |
   | where the last shot went | no | no | no |
   | elevation setting, down, up | no | no | no |
   | windage setting, left, right | no | no | no |
   | rounds left | yes | yes | no |
   | book line | yes | yes | no |
   | 1 MOA buttons (scope and dot) | no | no | no |

   The bar's own checks before:
   - 412×915: fixed at the bottom inside the screen, yes, from 838, for all three sights.
   - 1280×800: beside the view covering none of it, yes, and inside the screen, yes (990–1190 × 628–776), for all three sights.
   - The view: 380×380 and 640×640.

   The live page before #24, and #24 itself:

   | Size | Sight | Before | After | Bar before → after | View before → after |
   | - | - | - | - | - | - |
   | 412×915 | Vepr scope | all within reach | all within reach | fixed at bottom, top 838 → 846 | 380×380 → 380×380 |
   | 412×915 | Tavor SAR dot | all within reach | all within reach | 838 → 846 | 380×380 → 380×380 |
   | 412×915 | AK irons | all within reach | all within reach | 838 → 846 | 380×380 → 380×380 |
   | 412×830 | Vepr scope | no: rounds left (771.3) and book line (810.7) under the bar | all within reach (book line bottom 755.8) | 753 → 761 | 380×380 → 380×380 |
   | 412×830 | Tavor SAR dot | no: rounds left (767.3) and book line (806.7) under the bar | all within reach (751.8) | 753 → 761 | 380×380 → 380×380 |
   | 412×830 | AK irons | no: book line (778.6) under the bar | all within reach (723.6) | 753 → 761 | 380×380 → 380×380 |
   | 1280×800 | all three | all within reach, bar beside the view | the same | 694–776 → 706–776, beside the view covering none of it | 640×640 → 640×640 |

   At **412×800** (figure only, as the brief asks), after #24 the bar's top is at 731:
   - Vepr: the book line's bottom is at 755.8, under the bar; everything else is within reach.
   - Tavor SAR: the book line's bottom is at 751.8, under the bar; everything else is within reach.
   - AK: everything is within reach.

   At 412×760 (figure only), the book line falls under the bar (bottom 755.8, 751.8 and 723.6 against 691). Before #24, the strip's buttons fell under it as well.
2. **Same shots and same picture:** `git diff origin/main -- public/engine.js data src/scene` is empty.
3. **Nothing shifts** (`test/day.test.js`, "nothing shifts under the thumb", run on #24; places are left, top, width, height in pixels):
   - 412x915 before (left, top, width, height): view [16, 146.5, 380, 380], strip [16, 589.5, 380, 130], bar [0, 846, 412, 69]
   - 412x915 after a seeded miss (the cold-bore note gone): view [16, 146.5, 380, 380], strip [16, 589.5, 380, 130], bar [0, 846, 412, 69]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 412x915 with the result opened: view [16, 146.5, 380, 380], strip [16, 589.5, 380, 130], bar [0, 846, 412, 69]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 412x915 after a seeded hit that wrote a book line: view [16, 146.5, 380, 380], strip [16, 589.5, 380, 130], bar [0, 846, 412, 69]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 412x915 with the full description opened: view [16, 146.5, 380, 380], strip [16, 589.5, 380, 130], bar [0, 846, 412, 69]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 412x915 with the box empty and "Open another box" shown: view [16, 146.5, 380, 380], strip [16, 589.5, 380, 130], bar [0, 846, 412, 69]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 412x915 after another box was opened: view [16, 146.5, 380, 380], strip [16, 589.5, 380, 130], bar [0, 846, 412, 69]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 1280x800 before (left, top, width, height): view [106, 58.5, 640, 640], strip [766, 273.5, 408, 130], bar [766, 706, 408, 70]
   - 1280x800 after a seeded miss (the cold-bore note gone): view [106, 58.5, 640, 640], strip [766, 273.5, 408, 130], bar [766, 706, 408, 70]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 1280x800 after a seeded hit that wrote a book line: view [106, 58.5, 640, 640], strip [766, 273.5, 408, 130], bar [766, 706, 408, 70]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 1280x800 with the full description opened: view [106, 58.5, 640, 640], strip [766, 273.5, 408, 130], bar [766, 706, 408, 70]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 1280x800 with the box empty and "Open another box" shown: view [106, 58.5, 640, 640], strip [766, 273.5, 408, 130], bar [766, 706, 408, 70]; moved view 0, strip 0, bar 0 px; scrolled 0
   - 1280x800 after another box was opened: view [106, 58.5, 640, 640], strip [766, 273.5, 408, 130], bar [766, 706, 408, 70]; moved view 0, strip 0, bar 0 px; scrolled 0
4. **Touch heights** (`line-layout-after.txt`), the same at 412×915 and 412×830:
   - Vepr scope: plate 44, zoom 44, el-down 44, el-up 44, wd-left 44, wd-right 44, el-down-moa 44, el-up-moa 44, wd-left-moa 44, wd-right-moa 44, line-head 44, steady 52, fire 52.
   - Tavor SAR dot: plate 44, magnifier 44, and the same strip, summary, Steady and Fire.
   - AK irons: plate 44, leaf-down 44, leaf-up 44, el-down 44, el-up 44, wd-left 44, wd-right 44, line-head 44, steady 52, fire 52.
   - None is under 44.
5. **Screenshots and errors:**
   - `npm run screenshots -- --grep '^line-top-'`: "all checks passed (5 of 73 states)". Each state's "fits the width" check passed, so there is no sideways scroll.
   - The Checks run below ran all 73 states at both sizes, each with that check.
   - No console error: both firing-line tests assert `errors` is empty, and they passed.
6. **The Checks runs** on #24:
   - [44839550566](https://github.com/isleofdan/range-day/actions/runs/44839550566) on c9cabbf: 9 of 10 jobs passed. Tests scene-shots failed after 11 min 16 s: verify 3 could not click "Open another box" ("element is not visible").
     - Cause: that test gave each seeded shot at most 10 s to land. On a slow runner, under the Full picture, a shot took longer. The page refuses a shot while three are in the air, so the box never emptied.
     - It was the second Checks run in the session to fail on a fixed wait (the first was 44776316081). So the waits were fixed in commit b7ef52e (`test/scene.test.js`, test code only):
       - a seeded shot waits until it has landed (up to 90 s);
       - after the frame loop stops, the tests wait for two real frames instead of 300 ms;
       - the first visit waits 90 s instead of 30.
     - All three passed in the session (verify 4: "first mil-dot 47.5 px right and 48.5 px left of the centre … 48.0 px").
   - [44841130824](https://github.com/isleofdan/range-day/actions/runs/44841130824) on b7ef52e: **green, all ten jobs**.
     - Tests: rest 38 s, day 1 min 23 s, browser 1 min 25 s, scene-scale 4 min 34 s, scene-shots 8 min 7 s, scene-rest 8 min 52 s.
     - Screenshots: shard 1 5 min 54 s, shard 2 6 min 49 s, shard 3 8 min 26 s, shard 4 7 min 17 s.
   - Commit f774c87 added only the before-measure file. Its run, [44842823187](https://github.com/isleofdan/range-day/actions/runs/44842823187), is **green, all ten jobs**:
     - tests: rest 23 s, browser 1 min 27 s, day 2 min 2 s, scene-scale 4 min 34 s, scene-shots 7 min 48 s, scene-rest 8 min 56 s;
     - screenshots: shard 1 5 min 51 s, shard 2 6 min 57 s, shard 3 6 min 49 s, shard 4 6 min 57 s.
   - Commit 9ee1e68, the pull request's latest, takes the picture tests' wait fix back out (it is in #25). Its run, [44844321697](https://github.com/isleofdan/range-day/actions/runs/44844321697), is **green, all ten jobs**:
     - tests: rest 1 min 49 s, browser 1 min 11 s, day 1 min 33 s, scene-scale 4 min 20 s, scene-shots 8 min 25 s, scene-rest 11 min 19 s;
     - screenshots: shard 1 6 min 0 s, shard 2 9 min 3 s, shard 3 6 min 53 s, shard 4 6 min 5 s.
   - #25's own run, [44844341913](https://github.com/isleofdan/range-day/actions/runs/44844341913) on 0623aff, is **green, all ten jobs** (slowest: tests scene-rest, 8 min 59 s).
   - Counts: tests 111 before #24 and 111 after; screenshot states 73 before and 73 after. Before range-day-nine they were 109 and 68.
7. **Size:** the pull request's own diff, `gh pr diff 24 | wc -c` (fetched here as the same diff from GitHub's API, since this container has no `gh`): 69,015 bytes on 9ee1e68, under 400,000.
8. **The deploy result:** not in this report, by the brief's own order. Its close-out item 5 runs the Deploy workflow only on Dan's typed line, and then says: "Then file one short note on the card as `session:range-day-nine` (what was merged, the Deploy run's result line)". The line goes in that note after the deploy, as #22's did (card event 2887: "Deploy run 44836938388: completed, success").

What this cannot prove: the session cannot hold Dan's phone. 830 is measured from his screenshots; a browser with more of its own bars showing leaves less room.

## Asks

1. Merge and deploy range-day-nine-b (#24), and merge the picture tests' wait fix (#25, test code only, no deploy of its own)? Recommended: yes to both. Type `yes, merge and deploy range-day-nine-b, merge the test-wait fix, then merge its notes`.

## What the next session needs

- If Dan's phone ever shows less than 830 pixels, the next lever is the view's size on short screens, which belongs to the picture work Dan has paused.
- Otherwise as in the range-day-nine report.

Branches and the close-out order: the change is on `range-day-nine-b` (#24); the picture tests' waits are on `range-day-test-waits` (#25); this addendum and the `PLAN.md` note are on `range-day-nine-b-notes`. The order on Dan's typed line is fixed by this repository's standing rule (`CLAUDE.md`, "Field reports"), not by this session:
1. Merge #24, then #25.
2. The Deploy run.
3. A notes-only pull request from `range-day-nine-b-notes`, which then differs from `main` only by this addendum and the `PLAN.md` note, merged.

## Result check rounds

1. Job 20261121-001558-e62c3f (card event 2888): FINDINGS, 11.
   - 1–5 read #24 against the whole brief. Answered by "Where each task item of the brief stands" and the new before-measure, commit f774c87.
   - 6–11 asked for full figures. Answered in verify 1, 3, 4, 5 and 7 and in the UI review.
2. Job 20261121-002727-643ec9 (card event 2890): FINDINGS, 10.
   - 1–5: named as deliberate divergences 1–5.
   - 6: the original `main` figures were added to verify 1.
   - 7: the 412×800 figure was added.
   - 8: every job's time on the latest run, and the before counts, were added.
   - 9: the pull request's own diff size was added.
   - 10: this check is run again, and the closing message is sent only once the newest verdict is PASS.
3. Job 20261121-002945-690da1 (card event 2892): FINDINGS, 3.
   - 1: the original measure is now given element by element in verify 1.
   - 2: the deploy line comes after the deploy, by the brief's close-out item 5, quoted in verify 8.
   - 3: `test/scene.test.js` is out of #24 (commit 9ee1e68) and in its own pull request, #25.
4. Job 20261121-004414-6c153d (card event 2894): FINDINGS, 2.
   - 1: the closing message below is a draft. It is sent to Dan only after a PASS, which will be recorded here.
   - 2: the close-out order is stated as the repository's fixed sequence, in the words the range-day-nine report passed with.

## Closing message to Dan (draft; sent only after a PASS)

Nothing on your screen has changed yet: the fix is ready in pull request #24, and merging and deploying it will put it on the live app. On a screen your phone's height, everything now fits above Steady and Fire, and the third line no longer peeks out. The rounds left show under the word Fire, and your book line is one line (tap ▾ for the rest). All the automatic checks pass.

A separate small fix makes three picture tests wait properly on slow test machines; it's test code only.

Needed from you
1. Type: `yes, merge and deploy range-day-nine-b, merge the test-wait fix, then merge its notes`.
