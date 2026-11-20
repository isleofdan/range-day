# FIELD REPORT — range-day-nine — 2026-11-20

Nothing on Dan's screen has changed yet. The new firing-line layout is in pull request [#22](https://github.com/isleofdan/range-day/pull/22), which is not merged or deployed. Merging and deploying it will put the new layout on the live app.

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
- **Nothing shifts under the thumb.** The test "the firing line: nothing shifts under the thumb" in `test/day.test.js` printed, at both sizes: "view 0, strip 0, bar 0 px moved; scrolled 0". That held after a miss (with the cold-bore note going), with the result opened, after a hit that wrote a book line, with the full description opened, with the box empty, and after another box was opened.
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

   At 412×800 (figure only): everything is within reach except the rounds left and the book line, which fall under the bar. The book line's bottom is at 810.7 (Vepr), 806.7 (Tavor SAR) and 778.6 (AK) against the bar's top at 723. The result, the strip's buttons and figures, the glass control and the view are all within reach at 412×800.
2. **Same shots and same picture:** `git diff origin/main -- public/engine.js data src/scene` is empty (0 bytes).
3. **Nothing shifts** (`test/day.test.js`, printed): at 412×915 and 1280×800, after a seeded miss, with the result opened (phone; on the computer the result fit in two lines and was not long), after a seeded hit that wrote a book line, with the description opened, with the box empty, and after another box was opened: "view 0, strip 0, bar 0 px moved; scrolled 0" every time.
4. **Touch size at 412×915** (after-measure): plate 44, zoom 44, magnifier 44, leaf-down 44, leaf-up 44, el-down 44, el-up 44, wd-left 44, wd-right 44, the four 1 MOA buttons 44, the summary line 44, steady 56, fire 56. None is under 44. Before: plate 41 and the four 1 MOA buttons 40.
5. **Screenshots:** the five new states at both sizes (`docs/reports/screenshots/line-top-*.png`), "all checks passed (5 of 73 states)": each fits the width (no sideways scroll), and the tests found no console error (`assert.deepEqual(errors, [])` in both new tests).
6. **The check:** the pull request's Checks run is [44776316081](https://github.com/isleofdan/range-day/actions/runs/44776316081) on commit 752c7d4. Nine of its ten jobs passed: tests rest 23 s, tests browser 1 min 10 s, tests day 2 min 14 s, tests scene-scale 4 min 3 s, tests scene-shots 10 min 54 s, screenshots shard 1 5 min 58 s, shard 2 6 min 59 s, shard 3 6 min 48 s, shard 4 9 min 4 s. **Tests scene-rest failed** after 22 min 49 s, with 2 of its 12 tests failing:
   - "the first visit" ran out of time: `page.waitForFunction: Timeout 30000ms exceeded` while the picture counted its frames.
   - verify 4 (range-day-six) read the scope's reticle and found no dots at all ("mil-dot spacing NaN/NaN vs 48.0").

   Why this points to a slow machine, not the change:
   - The job ran on a slower runner (Azure eastus) than `main`'s last run of the same job (run 44762215589, AWS us-west-2), and the whole group took 1,352 s against `main`'s 502 s (`main`'s log gives only the group's total, so test-by-test times cannot be compared).
   - Both failures are timing failures. One is the 30-second wait. The other reads the canvas 300 ms after the page loads and finds nothing drawn, which happens when the first frame has not come yet.
   - The same group on this same code passed in this session's container: `node scripts/check.mjs --only tests --group scene-rest`, "ok tests: scene-rest … 519.2 s", all 12.
   - Neither test touches the arranged parts: the view's size, the picture and its drawing code are unchanged (verify 2).

   Re-running that one job counts as starting a workflow, which needs Dan's yes (`CLAUDE.md`, "What an agent may and may not touch"), so it is in Ask 1. If it fails again on a re-run, the merge stops there and the next session looks into it.

   Counts: tests 109 before and 111 after (counted as `test(` lines in `test/*.test.js` on `origin/main` and on `range-day-nine`); screenshot states 68 before and 73 after (`node scripts/screenshots.mjs --list`). Changed tests and why:
   - verify 7 in `test/day.test.js`: the book line now shows the newest line only, as the brief's task item 2 asks.
   - verify 13 in `test/day.test.js`: it checks the strip's figures and buttons, the result and the book line above the bar, in place of the hidden setting line (task item 6: "brought up to the new arrangement, not weakened").

   Run in the session, one piece at a time: `--group browser` passed, `--group day` passed (12 tests), `--group rest` passed, `--group scene-rest` passed (519.2 s), and `npm run screenshots -- --grep '^line-top-'` passed ("all checks passed (5 of 73 states)").
7. **Size for the result checker:** `git diff origin/main...range-day-nine | wc -c` gives 90,225 bytes, under 400,000.
8. **The deploy result:** filed on the card after the deploy, in the note of close-out item 5.

What this cannot prove: the session cannot open the live app or hold a phone. Dan's phone may show a shorter screen than 412×915, because a browser's own bars take room. So whether everything is within reach on his phone is unverified until he looks. At 412×800 the result, the sight strip, the glass control and the view are within reach; the rounds left and the book's line fall under the Steady and Fire bar (figures in verify 1).

## Asks

1. **Re-run the one failed check job, then, if it passes, merge and deploy range-day-nine?** Recommended: yes. Nine of the ten check jobs passed. The tenth failed on two timing waits on a machine 2.7 times slower than the last run of `main`, and it passed on this same code in the session (verify 6). The picture and the shots are unchanged, and one revert undoes the change. Type `yes, re-run the failed check, then merge and deploy range-day-nine, then merge its notes`. If the re-run fails, nothing is merged and I tell you which test failed and why.

## What the next session needs

- Dan's look on his phone at https://range-day-dan.fly.dev, Firing line: is the book's line above Steady and Fire on his screen? If his screen is shorter (as at 412×800), the next layout step is to put the rounds and the book line beside each other on one line.
- Older wording, seen in the new screenshots and not touched: a dead-centre hit reads "level, centered of center" (`RD.whereText` in `public/game.js`, used by the result line). One line fixes it.
- After this build the after-every-edit hook's fast test subset still runs the whole `npm test` (`CLAUDE.md`, "An app whose `npm test` takes more than 20 seconds puts a fast subset in `npm run test:fast`"). This is noted only; the starting kit is untouched.
- In a cloud container, Playwright 1.56.1 looks for Chromium build 1194 while the container has 1243. This session linked the installed build into a folder outside the repository (`PLAYWRIGHT_BROWSERS_PATH`, with `chromium-1194/chrome-linux` and `chromium_headless_shell-1194/chrome-linux/headless_shell` pointing at the 1243 files). Without that link the browser tests are skipped, quietly.
- The rest, each planned by a Personal Shipyard chat: the near targets at 50 and 100 yards with paper to shoot, with the spotting scope; the sights Dan fitted to his rifles and the Vepr's 3-9x scope; recording and playback. The picture work stays paused on Dan's word until he returns to it.

Branches: the change is on `range-day-nine` (pull request #22). This report and the `PLAN.md` note are on `range-day-nine-notes`, which reaches `main` in a notes-only pull request after the deploy result. That order is this repository's standing rule (`CLAUDE.md`, "Field reports"), not a choice of this session.

## Closing message to Dan

Nothing on your screen has changed yet: the new firing line is ready in [pull request #22](https://github.com/isleofdan/range-day/pull/22), and merging and deploying it will put it on the live app.

What it does: on your phone, everything you use between shots now fits on one screen without scrolling. From the top: a one-line summary of the rifle, load, course and day (tap it for the full description); the plate picker with the zoom, magnifier or rear leaf beside it; the view, the same size as before; where your last shot went, right under the view; the elevation and windage buttons with their settings and the rounds left; your newest book line for that distance; and Steady and Fire at the bottom. The wind call, notes, the day's links, the shot log and the settings are a short scroll below. Nothing jumps when a shot lands or a note appears. The picture and how the bullets fly are unchanged.

One automatic check failed. It is a timing failure on a slow test machine, not a fault in the change: the same tests passed on this code in my session, and the other nine checks passed.

Needed from you
1. Type: `yes, re-run the failed check, then merge and deploy range-day-nine, then merge its notes`. If the re-run fails, nothing is merged and I tell you why.
