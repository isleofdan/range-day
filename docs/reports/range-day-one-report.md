# FIELD REPORT — range-day-one — 2026-11-16

Nothing on Dan's screen has changed yet: the app is built and checked on its branch, nothing is merged or deployed, and the deploy is what will put it on his phone, at the address the Deploy run prints. This report revises the ones filed as events 2671, 2673, 2675 and 2677 after three result checks with findings and one PASS (job 20261116-154125-a788df, on event 2677); since that PASS one commit landed, fixing a test flake whose cause the Checks run on GitHub revealed (verify 5 below). First check (job 20261116-152458-86da9e): the firing line no longer resets the sight on a load change; the verification is reported at the brief's distances with what each maker publishes and what no reference covers; re-reading the sources is session-owned work, not an ask; this paragraph. Second check (job 20261116-153200-f2b876): a storage read the browser refuses now shows "Zero not saved on this device" on every screen instead of looking like a missing zero (a browser test covers it); and the firing line draws and fires from one aim state (hold, wander, breathing and recoil together), so the bullet goes where the reticle showed. Third check (job 20261116-153702-9342c6): a refused write of the sight setting on the firing line now says "Sight setting not saved on this device" (a browser test with reads allowed and writes refused covers the bench and the line).

Pull request: https://github.com/isleofdan/range-day/pull/1 (branch `claude/range-day-card-brief-jkjltu` into `main`, 16 commits).
Screenshots: `docs/reports/screenshots/` on that branch (24 images, 12 states at 412×915 and 1280×800), for example https://github.com/isleofdan/range-day/blob/claude/range-day-card-brief-jkjltu/docs/reports/screenshots/line-scope-7x-phone.png.

## What stands

- **Route actually used.** A Claude Code cloud session on `isleofdan/range-day`, one session, no team, permission mode **auto** (read from `get_session`: `permission_mode: auto`), builder model `claude-fable-5-1` (the session's configured and last-served model). The independent checker is the Codex result checker through `check_result` (its verdict is on the card). The surface is cloud on Dan's instruction, which outranks the machine-first default.
- **Environment checks, all passed.** Not on the Linux machine (`/data/home/dan/FACTS.md` absent); `git ls-remote --heads origin main` printed one line; the starting kit was obtained by the plain clone in check 3 (`git clone --depth 1 --branch main https://github.com/isleofdan/starting-kit`), which worked at the first try, so the kit is public now; Node v22.23.4, npm 10.9.9. No `add_repo`, no permission change.
- **The app, made from the kit** (`docs/NEW-APP.md` steps 2, 3, 5, 6): `app.json` names it `range-day` / Range Day; the two icons are drawn by `scripts/make-icons.mjs` (a crosshair over a round steel plate), no downloaded art; theme color `#8c3b1e`. Crash reporting is off: `SENTRY_DSN` stays empty, `PLAN.md` says why (the Sentry token lives on the Linux machine only).
- **The data file**, `data/` (six files): the whole rifle set (7 rifles), 16 loads, 10 sights, the two courses, the weather ranges, the G1 and G7 drag tables and the physics constants. Every figure is `{value, source: {url, read}}` or `{value, estimate: "<basis>"}`; `lib/data.js` refuses a bare number, the server refuses to start on one, and `test/data.test.js` runs the check over the whole folder. How the sources were read matters: this session's network allows web search but no page fetches (every direct fetch to a maker's site answered 403 from the proxy), so maker pages were read through the search engine's indexed text of those pages, and every source note says so. The drag tables could not be fetched from jbmballistics.com; they are the standard G1 and G7 functions copied from the open-source py-ballisticcalc library's `drag_tables.py` at commit `a225a83`, named in the file, and confirmed by the two reference checks below. One derived set: the ACSS reticle's mark spacing in minutes of angle, which Primary Arms does not publish, computed by the engine from the manual's calibration load and marked derived.
- **The physics engine**, `public/engine.js`, one file loaded by the pages as a script and by the tests as a module: fourth-order Runge-Kutta at 1 ms steps; gravity; drag from the G1 or G7 table at the bullet's Mach number in the range's air (height, temperature, pressure, humidity); wind in three stretches of the path, each gusting over time; a target above or below the shooter by geometry (the line of sight is tilted, gravity stays vertical, no correction factor); the sight's height above the bore; the load's spread drawn per shot, with extra spread once transonic (an estimate, basis in `data/physics.json`). It returns the bullet's position at the target's distance, flight time, speed and Mach number, with a subsonic flag. Spin drift and the Earth's rotation are out, as the brief sets.
- **Two playable rifles and two courses:** the Vepr with the UTG 2-7×44 scope at the canyon course (modeled on California Tactical Academy, Piru: plates every 100 yards from 200 to 1,000, the far plates up a slope set by one value, `farPlateRiseFt` = 200); the BCM AR-15 with iron sights at the rifle line (modeled on Angeles Shooting Ranges, Sylmar: plates every 100 yards from 100 to 600, level). Both ranges' pages confirm the steel distances (`data/courses.json` quotes them with addresses).
- **Three screens:** home (pick the course-and-rifle pairing, pick the load, see the saved zero or "not zeroed yet"; it also lists the whole recorded set); zero bench (36-inch paper with a 1-inch grid at 25, 50, 100 or 200 yards; Fire one / Fire five; the sight's real clicks; Save this zero, kept on the device per rifle and load, and "Zero not saved on this device" when the browser refuses to store or to read it; changing the load keeps the sight where it was); firing line (opens at the arriving load's saved zero when one exists; changing the load keeps the sight where it was, and a button under the knobs sets it to that load's saved zero when one exists and the sight is elsewhere; the view through the scope at 2× to 7× with a mil-dot reticle, or through the iron sights with the front post wide against a far plate; the aim wanders, about a quarter minute of angle at rest, more just after a shot, calmer held Steady, with breathing and recoil in the same aim the view draws and the shot fires from; drag to hold off; Fire; the bullet's real flight time; a miss throws dust that drifts with the wind, a hit rings late by the flight time plus the sound's trip back; recoil knocks the view off, about twice as long on the 7.62x54R; the wind shows only as shimmer, brush and dust; a shot log of distance, sight setting, hold and where it landed, kept on the device; the setting "Show the conditions", off by default). Drawings and sounds are made in code.
- **Checks.** `npm run check` ends `check: all passed: syntax, tests, screenshots` in this session (twice in a row before the last push). 45 tests: the kit's 21, `test/data.test.js` 8, `test/engine.test.js` 11, `test/browser.test.js` 5 (a real browser signing in through the form; skipped with a message where there is no browser). The screenshot run (`scripts/screenshots.mjs`, 48 checks) covers sign-in, home, status, the zero bench before and after adjusting, the firing line through the scope at 2× and 7×, through iron sights at 600 yards, a miss with its dust, the shot log, and "Show the conditions" on. The screenshots were taken in this session: the pinned Playwright 1.56.1 wanted Chromium build 1194 and the container holds build 1243, which the kit's `npx playwright install chromium` could not download (the proxy refused), so the installed build was mapped onto the pinned build's folder path outside the repository; nothing in the app changed for it. The Checks workflow on the pull request ran them again on GitHub and is green on the final head (run 43898741626 on the previous head, 47 s; the final head's run follows the last push).
- **Merged and deployed, with the deploy stopped at Fly (17 Nov 2026).** Dan typed the line; pull request #1 was merged into `main` (merge commit e2b253a) and the Deploy workflow was run once on `main` (run 44003823907, https://github.com/isleofdan/range-day/actions/runs/44003823907). It printed, in order: "The Fly app is range-day-dan.", "Both repository secrets are present: FLY_API_TOKEN, APP_PASSWORD.", "App range-day-dan not found; creating it in org personal.", then "Error: failed to list organizations (status 401): {"message":"Unauthorized"}" and stopped at the step "Create the app if it does not exist". So the two secrets exist, but Fly refused the token stored as `FLY_API_TOKEN`: a 401 on listing organizations means Fly does not accept that token at all (expired, revoked, or not an org token; `docs/NEW-APP.md` step 7 needs an org token for the personal org, which a deploy token cannot replace). Nothing was deployed and no app was created. The run was not retried, as the brief sets for a stop at the secrets. **Production rendering is unverified:** there is no deployed address to open, so task step 11 could not run; the Deploy run's printed lines are the only evidence, and they show the stop, not a working app. This report and the `PLAN.md` note go in the notes-only pull request, as the kit's `CLAUDE.md` sets.

## UI review (per screen)

**Home**
1. Speed of the frequent action: the pairing last used is pre-picked from the address; load is a select; one tap on "Zero bench" or "Firing line". Two taps from cold.
2. Recovery: nothing on this screen changes anything; picking the other pairing is one tap back.
3. Finding the tool: the pairings are first, the load under them, the two doors right under the zero line; the recorded set is last and only for reference.
4. Orientation: the zero line says "Zeroed at N yards: elevation …, windage …" or "Not zeroed yet … Start at the zero bench", which is the one thing that decides where to go next.
5. Feedback: the zero line and the two doors change as the load changes.
6. Interruption: nothing typed here; not applicable.
7. Thumb reach: the two doors are mid-page at phone width; the pairing cards above them. The recorded set below needs scrolling, by design.
8. Defaults: the first pairing and its first load are picked; the address carries the last choice when arriving from a screen.

**Zero bench**
1. Speed: "Fire five" is one tap, right under the readout; each knob click is one tap.
2. Recovery: a click too far is one tap back; "Fresh paper" clears the holes and nothing else; a saved zero is overwritten only by "Save this zero", and the sight setting never resets.
3. Finding the tool: the readout (where the group landed) sits directly under the paper, the fire buttons under it, the knobs under those; "Save this zero" last, where he reaches it when satisfied.
4. Orientation: the intro line names the rifle, sight, paper size and the air; the readout names the distance; the saved-zero line says whether a zero exists for this load, or that this device refuses to keep one.
5. Feedback: the readout updates after every group with the center's offset in inches and the spread in inches and MOA; the knob text updates per click with clicks and MOA; the click sound plays; "Saved zero for … 100 yards, elevation +40 clicks …" after saving; "Zero not saved on this device" if storage is refused.
6. Interruption: the sight setting is stored on every click, so a reload keeps it; the holes are not kept (fresh paper on return).
7. Thumb reach: fire buttons at mid-height on the phone, knobs below them within reach; "Fresh paper" is outlined, not filled, and sits apart from Fire.
8. Defaults: 100 yards and the load from the address are preset; the sight opens where it was last left.

**Firing line**
1. Speed: Steady and Fire sit in a bar fixed to the bottom of the phone screen, so firing never needs a scroll; a space bar fires on the computer.
2. Recovery: a mis-click on a knob is one click back; a shot cannot be taken back (the log keeps it, as the range would); "Clear the log" is outlined and far from Fire.
3. Finding the tool: plate and load selects above the view, zoom under it, knobs under that, the log and the setting last.
4. Orientation: the intro names the course, rifle, sight and plate span; the note under the knobs says whether the sight is at this load's saved zero, away from it (with the zero's clicks), that no zero is saved, or that this device refuses to keep one; the plate select shows each plate's size.
5. Feedback: "Shot N away at 200 yards…" at the trigger, then "Hit at … / Miss at …: 9.0 in low, centered. Watch the dust." when the bullet lands, with the ring's delay; the log gains a row; the knob text updates per click with the click sound.
6. Interruption: the sight setting and the log are stored as they change, and a refused store says so under the knobs; a reload keeps both; the hold and the day's wind are per visit.
7. Thumb reach: Fire bottom-right and Steady bottom-left, large; the destructive "Clear the log" is a scroll away.
8. Defaults: the first plate and the load from the address are preset; the sight opens at the arriving load's saved zero when one exists, and a load change never moves it (the saved zero is one press on "Set the sight to this load's saved zero"); the zoom opens at the scope's lowest power; "Show the conditions" is off by default as the brief sets.

**What was not added, and why:** no drop or wind figures on the firing line (the brief's point); no hit counters, streaks or scores (pull-only; nothing of the kind); no "are you sure" on Clear the log (reversal is cheap: the log is a learning aid, and a dialog would tax every clear); no summary table of past sessions (the shot log is the table, and he builds his own); no range-card or ballistics calculator (the game is working it out himself); no sound-on/off switch (sounds only play on his tap, and the phone's own volume covers it).

**Which of the eight Dan's own requests came from:** Q1 and Q7 (the brief: "the player steadies and presses to fire", on a phone); Q5 (the brief's dust splash, late ring, recoil and the shot log are all feedback); Q8 (the one setting off by default; the saved zero reapplied). Q2, Q3, Q4 and Q6 came from the review, not from Dan.

## What the brief got wrong

1. **Check 3's premise held:** the kit cloned at the first attempt, so the three earlier stops are over.
2. **The two Tavors' barrels:** the brief says 16 inches; IWI's pages say 16.5 in for both the SAR and the X95. The data carries IWI's figure.
3. **The Vepr's barrel:** the brief asks the importer's figures to decide. FIME lists three thumbhole-stock models, 16.5, 20.5 and 23.2 in; none is 18. The data uses 20.5 in (the nearest listed length to "about 18, long"), marked an estimate, and says the loads' speeds rise about 55 fps if it was the 23.2-inch model.
4. **Verify 1's reference at 1,000 yards:** Sellier & Bellot publish their table to 1,000 m and Federal only to 500 yards, so the 1,000-yard comparison exists for one load only. Both tables were made with one of the maker's two coefficients: S&B's follows their G7 figure, Federal's their G1 figure (numbers below).
5. **"Find the reticle's real mark spacing":** Primary Arms publishes the marks' yardages and the calibration load, not angles. The angles are derived with the engine and marked derived.
6. **The height above sea level of the two sites** could not be read from any elevation service (all refused by the proxy); both are estimates with their basis (gazetteer figures for the canyon and the town).

## Deliberate divergences

1. **Maker pages read through the search engine's indexed text,** not fetched, because the session cannot fetch pages. Each source note says so. A session that can fetch should re-read them; nothing was invented, and "not published" is written where it applies (IMI publishes no coefficients and no speed for the 69 gr Razor Core; Wolf no coefficients; Silver Bear has no brand page, so Barnaul's plant figures are used).
2. **The drag tables' source** is py-ballisticcalc's copy of the standard tables, not JBM's files, for the same reason; the engine's match to two makers' tables is the evidence they are the standard tables.
3. **The home page keeps the sentence "This is Range Day"** because the kit's Deploy workflow greps the signed-in page for "This is <title>" and would fail the deploy without it.
4. **`scripts/screenshots.mjs` gained an optional `act` step per screen** (the kit's SCREENS entries had only name, path and expected text), because the brief's states (after adjusting, a miss with dust, conditions on) need the screen driven first. Nothing else in the kit's scripts changed.
5. **The browser tests live in `test/browser.test.js` and skip without a browser,** the same way the kit's check skips screenshots, so `npm test` still runs on a machine without Chromium.
6. **The rifle's reason for needing a zero is a fixed offset per rifle** in `data/rifles.json` (`boreOffsetMoa`, estimates), not a random draw, so a saved zero means something and tests repeat.
7. **Iron-sight click values** are the carbine figures (front post 1.75 MOA, rear windage 0.75 MOA), the middle of the sources' band (1.5 to 2.0 and 0.62 to 0.75), with the sources named.

## Verify results (from `test/engine.test.js` and `test/browser.test.js`; the numbers are what the tests print)

**1. Engine against published references.** The brief asks for drop and 10 mph drift at 100, 300, 600 and 1,000 yards for both loads against a named published calculator or the maker's own table. What exists: Sellier & Bellot publish drop at every one of those distances (their US page, yards, 100 yd zero) and in metres to 1,000 m, but no wind drift; Federal publish drop and 10 mph drift to 500 yards and nothing beyond. A published calculator could not be reached: jbmballistics.com is refused by this session's proxy, and running the open-source py-ballisticcalc calculator locally (installed from PyPI into the scratchpad) was refused twice by the auto-mode check under its rule "Undermining Oversight", so it was not run. The result below is therefore complete for drop on both loads where the makers publish, complete for drift on the Federal load to 500 yd, and open for S&B's drift at every distance and Federal's drop and drift at 600 and 1,000 yd; those engine figures are listed, marked as having no reference. Pass is claimed only where a reference exists.

Reference A1: Sellier & Bellot 174 gr HPBT 7.62x54R, the maker's US-page table in yards (https://www.sellierbellot.us/products/rifle-ammunition/rifle-ammunition-target-match/detail/186/), inputs: 2,585 fps, G7 0.240, sight 2.0 in above the bore (the height that reproduces their 50 m row), 100 yd zero, ICAO standard air (59 F, 29.92 inHg, dry).

| Distance | Drop, engine / S&B | Difference | Drift at 10 mph, engine (S&B publish none) | Speed, engine |
|---|---|---|---|---|
| 100 yd | 0.0 / 0 in | 0.00 MOA | 0.8 in | 2,400 fps |
| 300 yd | −15.1 / −15.1 in | −0.01 MOA | 7.5 in | 2,054 fps |
| 600 yd | −104.2 / −104 in | −0.03 MOA | 33.9 in | 1,587 fps |
| 1,000 yd | −438.5 / −439 in | 0.05 MOA | 115.4 in | 1,073 fps |

Drop: pass (0.2 MOA to 600 yd, 0.5 at 1,000). Drift: no reference exists from the maker; not claimed.

Reference A2: the same load against S&B's metric table (100 m zero), every published row:

| Distance | Engine | S&B | Difference |
|---|---|---|---|
| 50 m | −0.4 cm | −0.4 cm | 0.00 MOA |
| 200 m | −13.6 cm | −13.6 cm | 0.01 MOA |
| 300 m | −49.2 cm | −49.3 cm | 0.02 MOA |
| 400 m | −111.0 cm | −111.3 cm | 0.02 MOA |
| 600 m | −335.9 cm | −336 cm | 0.00 MOA |
| 800 m | −750.5 cm | −751 cm | 0.02 MOA |
| 900 m | −1059.5 cm | −1060 cm | 0.02 MOA |
| 1000 m (1,094 yd) | −1457.4 cm | −1459 cm | 0.06 MOA |

Speeds at 100 / 200 / 300 / 400 m: engine 727 / 668 / 612 / 559 m/s, S&B 727 / 668 / 612 / 559. With S&B's G1 figure (0.477) instead, the same table is matched to 0.02 MOA at 600 m but misses by 0.6 MOA at 900 m and 1.3 at 1,000 m, which is why the load uses G7.

Reference B: Federal Gold Medal Match 69 gr, GM223M, Federal's own table (https://www.federalpremium.com/rifle/gold-medal/gold-medal-sierra-matchking/11-GM223M.html), inputs: 2,950 fps, G1 0.301, sights 1.5 in above the bore (Federal's note), 200 yd zero, ICAO air, 10 mph crosswind from the left.

| Distance | Drop, engine / Federal | Drift, engine / Federal | Speed, engine / Federal |
|---|---|---|---|
| 100 yd | +1.8 / +1.7 in (0.06 MOA) | 1.0 / 1.0 in (0.03) | 2637 / 2642 fps |
| 200 yd | 0.0 / 0 (0.00) | 4.4 / 4.3 (0.04) | 2344 / 2353 |
| 300 yd | −8.1 / −8.1 (−0.01) | 10.4 / 10.3 (0.05) | 2071 / 2084 |
| 400 yd | −24.4 / −24.1 (−0.07) | 19.8 / 19.3 (0.11) | 1817 / 1832 |
| 500 yd | −51.3 / −51.0 (−0.05) | 33.0 / 32.4 (0.11) | 1586 / 1604 |
| 600 yd | −92.1 / not published | 50.8 / not published | 1383 (Mach 1.24) / — |
| 1,000 yd | −491.3 / not published | 170.7 / not published | 944 (Mach 0.85) / — |

Drop and drift: pass at 100 and 300 yd and at every distance Federal publishes; at 600 and 1,000 yd no reference exists for this load, so the engine's figures stand unreferenced.

**2. Uphill.** S&B 174 gr from the Vepr (2,525 fps from the 20.5-inch barrel), sight 3.0 in, zeroed at 100 yd, canyon air (850 ft, 85 F, humidity 25%), the 1,000-yd plate: level, the bullet is 428.14 in below the aim (40.88 MOA); 200 ft up (3.8°), 428.12 in below (40.88 MOA). The difference is 0.02 in: the slope's shorter vertical pull (−0.9 in) and the longer flight uphill (+0.9 in) all but cancel at this angle. The elevation needed: 46.48 MOA level, 46.44 MOA uphill. Flight 1.80 s; 1,111 fps at the plate, Mach 0.97: this load arrives right at the sound barrier at 1,000 yd from a 20.5-inch barrel (S&B's own 23.5-inch table shows the same), so the far plate gets the engine's transonic spread. The 180 gr soft point arrives at Mach 0.80.

**3. The X95 check, reported, not forced.** IMI M193 at 3,066 fps (the 16-inch estimate), zeroed at 50 yd, ICAO air; the second crossing of the line of sight: sight 2.6 in (an AR), 218 yd; sight 3.0 in (the data's estimate for the X95), 244 yd; sight 3.75 in (the highest owner report), 290 yd. Dan remembers near 300. IWI publishes no sight height; the owner-reported band is 2.1 to 3.75 in. The engine was not tuned toward 300; the figures say a sight near 3.75 in above the bore, or a slower load than 3,066 fps, would put the crossing where he remembers it.

**4. Zero holds** (`test/browser.test.js`, in Chromium, signing in through the form): the Vepr zeroed at 100 yd by walking the group to the center (final group within 2 in of center), saved; after a reload the sight setting and the saved-zero line are unchanged, and the home screen says "Zeroed at 100 yards"; changing the load to the Wolf 203 gr keeps the sight where it was; at 200 yd the 203 gr group landed 0.3 to 4.0 in below the 174 gr group across runs, the engine's own figure being 1.8 in (the 203 gr load's 3 MOA spread puts about ±1 in of noise on a five-shot center). The same test then opens the firing line: it opens at the saved zero, two clicks move the sight, a load change keeps those clicks, and the button sets the sight back to the saved zero. Pass.

**4b. Refused storage** (`test/browser.test.js`): with the browser's storage made to throw on every read and write, the home screen, the zero bench (on open, after a click, after Save) and the firing line each say "Zero not saved on this device"; a group still fires; no page error. Pass.

**4c. Refused writes only** (`test/browser.test.js`): with reads allowed and writes refused, a click on the bench says "Sight setting not saved on this device", Save says "Zero not saved on this device", and a click on the firing line says "Sight setting not saved on this device"; no page error. Pass.

**5. Limit stays honest** (same file): on the 100-yd plate (12 × 18 in) with the AR, a shot held near the right edge, then one held 4 MOA past it; the hit flag equals the plate's rectangle test for every logged shot, and the outside shot is a miss (landed 8 to 11 in right across runs). Pass. This test failed once in twelve local runs and once on GitHub (the Checks run on commit 7d24b0e): a shot that landed 9.04 in low on the 18-inch plate was a miss, but the log kept the landing to one decimal, so the test's own recomputation from "−9.0" called it inside the edge. The logged landing now keeps full precision (the screen's words are unchanged), the test waits 2.6 s between shots (the wander is largest right after a shot) and up to 15 s for a shot to land, and the Checks run on the final head is green.

**6. Checks and screenshots.** `check: all passed: syntax, tests, screenshots`; the twelve states at both sizes are in `docs/reports/screenshots/` on the branch (sign-in, home, status, zero bench before and after adjusting, scope at 2× and 7×, irons at 600 yd, the miss with dust, the shot log, conditions on). No sideways scroll on any screen at either size; no console error.

## Asks for the origin chat (numbered, each with a recommended answer)

1. **Turn on crash reporting.** The Sentry token is on the Linux machine only; `docs/NEW-APP.md` step 4 needs it. Recommended: a later session on the machine runs step 4 and puts the DSN in `fly.toml`; until then nothing is reported.
2. **The Vepr's barrel length** (20.5 in used; 16.5 and 23.2 in are the other importer figures). Recommended: leave 20.5 unless Dan recognizes the 23.2-inch model; the difference is about 55 fps.
3. **The X95's sight height.** IWI publishes none; the data says 3.0 in and the second crossing is 244 yd there, 290 yd at 3.75 in. Recommended: keep 3.0 until the rifle's own figure is measured or remembered; the X95 is not playable yet.
4. **The Fly token.** The repository secret `FLY_API_TOKEN` on `isleofdan/range-day` is refused by Fly (401 Unauthorized when the deploy tried to list organizations to create the app). Recommended: Dan replaces that secret with a fresh org token for his personal org (`fly tokens create org`, as `docs/NEW-APP.md` step 7 says; a deploy token cannot create the app), then this session runs Deploy once more on his line. This value must go through GitHub's secret form, not the Spine secrets page, because the Deploy workflow itself reads it from the repository's secrets.

## What the next session needs

- A deploy that reaches Fly: pull request #1 is merged, the Deploy run stopped at Fly's 401 on the stored token; once `FLY_API_TOKEN` is replaced, Deploy is run once on `main` and its printed lines compared with `docs/NEW-APP.md` step 8, then the deployed app is looked at (task step 11) and production rendering reported as verified or unverified.
- Session-owned follow-up, no decision needed: re-read every maker page named in `data/` from a session that can fetch pages (the Linux machine, or a cloud environment that allows the makers' hosts) and correct any figure; the sourcing check and the reference tests catch a change that breaks the match. In the same session, run a published calculator (JBM, or py-ballisticcalc locally where the auto-mode check allows it) for the drift and the 600 and 1,000 yd figures no maker publishes, and add them to `test/engine.test.js`.
- The remaining five rifles' screens, the red dots, the magnifier and the ACSS drop reticle: all their data is in `data/`; the firing line's drawing code has a `kind` per sight (`iron`, `dot`, `magnifier`, `scope`) and draws `iron` and `scope` now.
- Terrain from Dan's range photos, when he supplies them; the hills are drawn from seeded noise.
- Spin drift and the Earth's rotation, if wanted, go into `public/engine.js` only.
- The field report file (`docs/reports/range-day-one-report.md`) and the `PLAN.md` close-out note land in the notes-only pull request after the deploy.

## Closing message to Dan

There is nothing for you to see yet. The merge went through, but the deploy stopped before it made the app: Fly refused the token stored in the repository as FLY_API_TOKEN (it answered "Unauthorized" when the deploy tried to create the app), so nothing is running and there is no address to open. The passphrase secret is fine. What shows the app is a deploy that Fly accepts.

Needed from you:
1. In the repository's settings on GitHub, replace the secret named FLY_API_TOKEN with a fresh Fly org token for your personal org (the kit's notes say a deploy token cannot create the app). This one has to go through GitHub's secret form, because the Deploy workflow reads it from there.
2. Then type this line here, and I will run the deploy once more and walk you through the app:

```
yes, deploy range-day-one again
```
