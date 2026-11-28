# FIELD REPORT — range-day-eighteen — 28 Nov 2026

The .22 has its own scope: a Primary Arms CLx 1-6x24 with the ACSS 22LR
G2 reticle, the second sight choice on the .22 after its open sights.
Pull request [#62](https://github.com/isleofdan/range-day/pull/62) holds
all of it; it is not merged. Nothing on Dan's screen has changed yet: the
live game shows the scope only after the merge and the deploy, which wait
on his typed line.

Executor: a Claude Code cloud session (Dan opened it from the Wall card
`range-day`; permission mode Auto, as the session's own notices state).
Independent checker: the Codex result checker through the Spine tool
`check_result` (its verdict under "Verify results").

## What stands

- **The scope's figures** (`data/sights.json`, `pa-clx-1-6x24`), each
  with its source: one click is half a minute of angle on both turrets,
  120 clicks each way (the maker's 120 MOA of travel); 1 to 6 power; the
  view 113.5 ft across at 100 yards at 1 power and 18.8 ft at 6 power;
  a 30 mm tube. The maker's product pages could not be opened from this
  session (the network refuses primaryarms.com), so these were read
  from the search engine's indexed text, and each source note says so.
- **The reticle**, the ACSS 22LR G2, drawn from the maker's reticle
  manual, which Dan downloaded and gave to the session. The manual's
  drawing is made of vector outlines, so each mark was measured from
  the outlines' own coordinates (`pdfplumber`), not by eye. The scale
  is the manual's own: the 125- and 175-yard stadia are each "the
  diameter of a clay pigeon (~4.3")" at their distance, 3.286 and 2.347
  minutes of angle, and both give the same scale, 7.6713 drawing units
  to the minute. The second drawing in the manual, at another size,
  gives every figure the same to the thousandth. What is drawn: a red
  1.0-minute dot; a fine line (0.4 minute thick) from 2.86 minutes either
  side, turning into heavy posts (1.5 minutes) at 18.96; no line above
  the center; a post below from 1.60 minutes (the 75-yard hold) to 19.45;
  five stadia lines at 4.29, 7.49, 11.08, 14.97 and 18.96 minutes, 4.29,
  3.28, 2.73, 2.35 and 2.04 minutes wide, the 100, 150 and 200 drawn as
  barbells with 1.0-minute end ticks; a 0.6-minute wind dot either side
  of each, at 2.79, 3.39, 4.09, 4.69 and 5.19 minutes; and the lower heavy
  post from its point at 23.55 minutes, full width at 24.30. It is in the
  second focal plane, true at 6 power (the manual: "holds are for MAX
  MAGNIFICATION ONLY"), so at 1 power every mark stands six times as far
  out. No distance or word is written on the glass: the manual's "100 y"
  and "5 mph" labels explain its drawing and are not part of the reticle.
- **The mount and the height** (`data/rifles.json`, `remington-22`,
  `scopeMount.ownScope`): Warne 731M rimfire rings, 30 mm, medium, which
  clamp a 3/8-inch dovetail; their saddle stands 0.400 in over the
  dovetail (Warne's dimension B). The scope's center is 0.591 in over the
  saddle (half the 30 mm tube), and the receiver's top 0.5 in over the
  bore (an estimate: the rifle's model is not identified; Remington's
  bolt rimfire receivers are round, about an inch across, bore on the
  axis). Height over the bore: 0.4 + 0.591 + 0.5 = 1.491 in, entered as
  an estimate with that sum written out, and worked out again by
  `test/scope22.test.js`. The `scopeMount` words now say the .22 has its
  own scope in its own rings and still takes none of the collection.
- **The rifle offers the scope**: `remington-22` `sights` is now
  `rem-irons`, `pa-clx-1-6x24`; `defaultSight` stays `rem-irons`. Home,
  the bench, the line, a day, the book, playback and the copy file read
  sights through the rifle's list, so the scope works in each as the
  Vepr's own scope does; no screen needed a change for it. A workbench
  build of the .22 carries the scope at the same height; the workbench
  offers no mount for it and now says so ("Its own scope, the Primary
  Arms CLx 1-6×24 SFP scope, stays in its own rings in every build").
- **The drawing** (`public/line.js`): a second-focal-plane reticle's
  marks are now drawn at the power in use (`sfpScale`, the rule the
  BugBuster's mil-dots already followed), and a new marks drawing,
  `ladderMarks`, draws the G2 from its figures. `lib/data.js` refuses a
  ladder reticle missing any figure it is drawn from.
- **Two screen repairs** from the review of range-day-seventeen:
  - The workbench's closed mount picker shows the height first and a
    short name (`short` in `data/workbench.json`, e.g. "0.95 in · Pro
    rings, Low"), and the full name with "its center … in over the rail"
    stands under the picker. Widest choice 289 px in a 308 px picker at
    378 wide.
  - Home with a build picked: the rifle names, card padding and zero
    line a size smaller only while the Version row shows, so Zero bench
    and Firing line end at 825 px of 915 here, and on the Checks machine,
    whose font is wider, inside 915 with at least 16 px under them.
- **Notes**: `README.md` (the .22's scope in plain words) and
  `docs/RECORDS.md` (the `scopeMount.ownScope` field of the gun record's
  `game` section). No stored key changed.
- **The gun record in the Spine** is not written yet: it waits for Dan's
  typed line, after the merge and before the Deploy workflow (task
  step 4). `lib/spine-guns.js` confirms the order is safe: when a read is
  refused (the deployed game before this change does not know the sight
  `pa-clx-1-6x24`), the server "keeps the last whole set it accepted from
  the Spine" (lines 11 to 13, 77 to 78), so the live game is not hurt in
  the minutes between the record write and the deploy.

## UI review (per screen touched)

Home with the .22 (`home-22-scope`): 1 frequent action (pick the scope)
is one choice in the Sight list, as for every rifle; 2 recovery: pick the
open sights back, nothing is lost; 3 finding: the scope is listed under
the open sights by its maker's name; 4 orientation: the zero line says
"Not zeroed yet with the Primary Arms CLx…"; 5 feedback: the zero line
changes at once; 6 interruption: none; 7 thumb reach: unchanged layout;
8 defaults: the open sights stay first, the last choice is remembered.

The bench through the scope (`zero-22-scope`): the bench shows the
paper, not the view through the sight, so it has no power to show (see
"What the brief got wrong"); the clicks are the scope's (half a minute),
and the help line says so. Questions 1 to 8 as on main: unchanged.

The line through the scope (`line-22-scope-1x`, `line-22-scope-6x`):
1 frequent action (zoom) is the same slider; 2 recovery: slide back;
3 finding: unchanged; 4 orientation: the zoom shows its power; 5 feedback:
the reticle's marks spread as the power falls, as a second-focal-plane
reticle does; 6 none; 7 unchanged; 8 opens at 1 power like every
variable scope. At 6 power the reticle is small against the view, as in
the maker's own drawing of the whole field (manual page 2).

The workbench with the .22 (`workbench-22`) and a mount picker closed
(`workbench-changed`): 1 choosing a mount reads the height first;
2 recovery unchanged; 3 the full name stands under the picker; 4 to 8
unchanged. Home with a build picked (`home-build-chooser`): 7 the two
doors are inside a 412×915 screen with room under them.

Not added: a label of distances beside the reticle's holds (the game
never gives the drop), and a mount choice for the .22's own scope (not
asked for). Dan's own requests behind these: the scope (his "22 scope,
please"); the two repairs came from his walkthrough of the workbench.

Screenshots, each at 412×915 (phone), 378×762 (small) and 1280×800
(computer), in `docs/reports/screenshots/`, committed in #62 (the two
repaired states, `workbench-changed-*` and `home-build-chooser-*`, taken
again after the repairs in commit `8ddb051`): `home-22-scope-*`,
`zero-22-scope-*`, `line-22-scope-1x-*`, `line-22-scope-6x-*`,
`workbench-22-*`, `workbench-changed-*`, `home-build-chooser-*`.

## What the brief got wrong

- "the bench through the scope at lowest and at highest power": the zero
  bench draws the paper with its grid, not a view through the sight, so
  it has no power; one bench screenshot per size stands for both.
- The maker's site: the brief expected it could be fetched or read
  through indexed text; the product figures came from indexed text, but
  the reticle's measures are not in any indexed text. They came from the
  manual Dan downloaded on the session's ask.
- The `.22`'s "zero, sight setting and book line" seed (verify 6): no
  existing test seeds the .22's open sights with all of these; the test
  makes its own, in the stored shapes of `docs/RECORDS.md`, with a shot
  log as well.

## Deliberate divergences

- **The model, by the brief's rule**: the maker sells the CLx 1-6x24 SFP
  with two reticles, the ACSS 22LR G2 and an illuminated duplex; neither
  has marks cut for a centerfire cartridge, so the rule's first clause
  does not choose between them. The G2 is modeled: it is cut for the
  .22's own cartridge, and its maker's reticle manual could be read in
  full. Until Dan sent the manual the branch carried the duplex (a fine
  crosshair with the 2-minute dot, its posts left out for want of a
  figure); the G2 replaced it before any merge.
- Steps 2 and 3 share one commit for the data (`2228094`): the rifle's
  height for a sight it does not carry is refused by `lib/guns.js`, so
  the height and the sight list cannot stand apart. Step 3's code is its
  own commit (`8e7aac8`).
- Home's repair shrinks the rifle cards' text and padding only while the
  Version row shows; with no build picked home is as it was.

## Verify results

1. **Tests.** On `main` (`3b44601`) before any change, without the
   browser: 189 tests, 108 passed, 81 skipped (the browser tests), 0
   failed. With this container's browser pointed at the tests (the
   installed Playwright wants build 1194, the container has 1243; linked
   by name), the branch's own run reached 123 tests with none failing
   before it was stopped for time; the proof is the Checks workflow.
   On the branch: 196 tests (189 + 7 in `test/scope22.test.js`).
   Checks run [46099042351](https://github.com/isleofdan/range-day/actions/runs/46099042351) on `5202636`, the pull request's head: all 13 jobs passed (the 9 test groups and the 4 screenshot shards). Two earlier runs failed and were fixed in this pull request: run 46097095351 (home's doors 1.4 px from the foot of the screen in the Checks machine's wider font; fixed in `56d6520`) and run 46097387243 (a test name with an unescaped apostrophe, my slip; fixed in `063c132`).
2. **Nothing moved for what existed**: `test/workbench.test.js`
   "verify 2" (the seven rifles' strikes with their default sights,
   `test/fitted-strikes.json`, from range-day-seventeen) passes unchanged;
   the .22 with its open sights strikes at 600 yards −1005.9581946033571
   in, as on main.
3. **The scope's shot is the engine's shot** (`scope22` verify 3): at the
   bench at 100 yards the hole −22.1, −0.51 in, the engine's figure for
   1.491 in over the bore −22.1, −0.51 in (the open sights' 0.9 in would
   put it at −21.51); on the line at 100 yards −20.896286202034815 in up,
   0.36745451057803513 in right, 0.31264497937197316 s, the engine's
   the same to every digit.
4. **A click is the maker's click** (verify 4): 8 clicks up moved the
   hole 4.18 in at 100 yards, 3.992 minutes of angle (the maker's 8 ×
   0.5 = 4); 6 right moved it 3.14 in, 2.998 (the maker's 3).
5. **The glass is the maker's glass** (verify 5): at 1 power the view is
   1300.614 minutes across, the maker's 113.5 ft at 100 yards; at 6 power
   215.432, the maker's 18.8 ft (to 1e-9, the existing scopes'
   tolerance). The center dot covers 1.00 minute at 6 power and 5.98 at 1
   power. At 6 power the five stadia read off the canvas are 8, 6, 6, 4
   and 4 px wide against their figures 7.6, 5.8, 4.8, 4.1 and 3.6 px (a
   whole-pixel drawing; within 1.5 px).
6. **Old records untouched** (verify 6): the four keys held before (the
   .22's open sights' zero, sight setting, shot log and book page) are
   the same byte for byte after the scope is picked, zeroed and fired;
   the keys added are the scope's own (`zero`, `sight`, `log`) and the
   zeroing supply. The scope started unzeroed at the middle of its
   clicks.
7. **No drop given** (verify 7): the bench and the line with the scope
   and no shots show no drop, come-up, holdover or "lands at" (the
   setting "Show the conditions"'s own label excepted); the reticle
   writes no figure or word (0 text marks at 1 and 6 power).
8. **Screens**: the states listed under the UI review, at 412×915,
   378×762 and 1280×800; every state fits the width.
9. **After the deploy**: not reached; it cannot be before Dan's line
   (merge, gun record, deploy). The Deploy run's guns line and the
   Production check result go into the notes-only pull request after the
   deploy, as `CLAUDE.md` orders it.

Result check: the first check (job 20261128-025346-b3f2c2) returned
four findings: the first paragraph did not say Dan's screen is unchanged
(fixed above); two repaired screens' pictures were not in the pull
request (taken again and committed); the report and the `PLAN.md` note
were not in the pull request (both added to #62; the brief asks for every
change in one pull request, and the notes-only pull request after the
deploy then adds the deploy's results, the order `CLAUDE.md` fixes); and
item 9 above, which only the deploy can answer. Second check: on this
report.

## Numbered asks

1. Merge, write the .22's gun record in the Spine, deploy, then merge
   the notes. Recommended: yes; every check on #62 is green.

## What the next session needs

- After the deploy: the Deploy run's line about the guns must read
  "differs from data/rifles.json: none", and the Production check green.
- Dan's look on his phone: the .22 with the scope on home, the bench,
  the line at 1 and 6 power.
- Open: a second-focal-plane scope's holds are true only at 6 power; the
  game draws them as the maker's glass does at every power and says
  nothing more.

## Closing message to Dan

The .22 has its own scope: the Primary Arms CLx 1-6x24 with the ACSS 22LR G2 reticle, drawn from the manual you sent. Pull request #62; all 13 checks are green.

Needed from you:
1. Type this line to merge, write the .22's gun record, deploy, and merge the notes:

```
yes, merge and deploy range-day-eighteen, write the .22's gun record, then merge its notes
```
