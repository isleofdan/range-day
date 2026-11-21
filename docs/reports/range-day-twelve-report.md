# FIELD REPORT — range-day-twelve — 2026-11-21

Nothing on Dan's screen has changed yet: the change waits in pull request
[#36](https://github.com/isleofdan/range-day/pull/36) for his typed line.
Once merged and deployed, the firing line shows the sights fitted to the
rifles: the Troy folding sights on the AR-15, the FAB Defense flip-ups and
the SeeAll on both Tavors, the KNS ball post and rear peep on the 7.62x39
rifle, the ball post or the XS stripe post on the 5.45 rifle, the ball post
on the Vepr's irons, and the Vepr scope's dots at their true angle for the
power in use. The AR-15, both Tavors and the 7.62x39 rifle will need zeroing
again with their new sights. The 5.45 rifle keeps its zero with the ball post
(its opening sight); its second choice, the XS stripe post, starts
unzeroed. The Vepr's zeros do not move.

## What stands

**Route.** A Claude Code cloud session on `isleofdan/range-day` (the
container has no `/data/home/dan/FACTS.md`), branch
`claude/range-day-card-brief-xmfvcf`, the session's own. Permission mode:
auto (read from the session: `permission_mode: auto`). Builder model:
`claude-opus-5-5` (read from the session). Independent checker: the Codex
result checker through `check_result` (rounds below). Three research
helpers (subagents of this session) searched the web for the makers'
figures; every figure they found was re-read before use, and the BugBuster's
focal-plane line was searched again by this session itself.

1. **Each sight's figures, in `data/sights.json`** (six new entries, the
   Vepr's irons changed in place, the BugBuster's reticle extended; the
   table under Verify 2). Every figure is `{value, source}` or
   `{value, estimate}`. `lib/data.js` now checks each sight's kind
   (`iron`, `dot`, `magnifier`, `scope`, `seeall`) and what that kind needs
   (diff: `lib/data.js`, `checkSights`; `test/data.test.js`, "range-day-twelve:
   the sights fitted to the rifles", which also proves the refusals).
2. **Which rifle carries which sight, in `data/rifles.json`**: the AR-15
   `troy-battlesights`; both Tavors `fab-flipup` (opening sight), `pa-md25`,
   `seeall-gen1` (and the SAR its magnifier); the 7.62x39 rifle
   `ak762-kns-peep` and its prism sight; the 5.45 rifle `ak545-ball`
   (opening sight) and `ak545-xs`; the Vepr `vepr-irons` (same id) and its
   scope (still the opening sight). Each sight's height over the bore has
   its own figure and basis. `ar-irons`, `tavor-irons` and `ak-irons` stay
   in the data, marked `retired`. No gun record names a sight outside the
   data; `test/guns.test.js`'s list of known sights names the six new ones
   (diff: `test/guns.test.js`).
3. **The records** (rule: the same click on both adjustments and the same
   height over the bore, or nothing carries): the 5.45 rifle's ball post
   carries the old AK irons' zero, setting, log and book (`carriesRecordsOf`);
   the AR-15, both Tavors and the 7.62x39 rifle start unzeroed, their old
   records stored and readable under the old name (the book page lists the
   old sight, "(no longer on this rifle)", while it holds lines: diff
   `public/book.js`); the Vepr's irons keep their id, so nothing moves. A
   record from before any sight could be chosen now follows the sight it
   was made with, not the rifle's new default (`tookThePlaceOf`,
   `oldRecordsSightOf` in `public/game.js`). Proved by `test/day.test.js`
   "range-day-twelve verify 5" (Verify 5 below).
4. **What the eye sees** (`public/line.js`): one drawing for every iron
   front (`drawFront`): a flat post; a ball on a stem; a post with a
   glowing stripe drawn as a plain bright bar; guards either side at their
   own gap and width. The ring sights draw the data's ring; the KNS peep
   draws only its leaf dark around the hole (it stands far from the eye).
   The SeeAll (`drawSeeAll`): a glowing block in the lower half, a black
   line on its top edge, a black triangle across the line, its tip at the
   aim point. Present drawing style only. Proved by `test/browser.test.js`
   "range-day-twelve verify 3" (Verify 3 below).
5. **How each sight is set**: each moves by its own steps over its own
   travel through the existing knobs; the bench says where each adjusts in
   the sight's own words (`adjustWords`; the SeeAll's step is a sixteenth of
   a turn of its screw). The SeeAll shows no zoom, magnifier or leaf; the
   KNS peep shows no leaf (it replaces the leaf); the 5.45 rifle keeps its
   leaf behind both fronts. Proved by `test/browser.test.js` "range-day-twelve
   task items 3 and 4".
6. **The BugBuster's dots**: the maker's manual states "All current UTG
   scopes have second focal plane reticles." and "All reticles are
   calibrated at 10x magnification." Recorded as `focalPlane: "second"` and
   `trueAtPower: 10`, sourced; the dots are drawn 3.44 MOA × 10 / power
   apart. Proved by `test/browser.test.js` "range-day-twelve verify 6".
7. **Tests, states and words**: 137 tests (130 before), 93 screenshot
   states (82 before). `README.md`, `docs/RECORDS.md` and `docs/CHECKS.md`
   say what changed.

## UI review

Screens changed: the firing line (each new sight), the zero bench (its
words), the book page (old sights listed), home (the Tavors' chooser lists
the SeeAll).

1. Speed of the frequent action (aim and fire): unchanged; the new sights
   use the same knobs, Steady and Fire.
2. Recovery: a wrong sight is one choice away on home or the firing line's
   short line; nothing stored is lost (records test).
3. Finding the tool: the SeeAll is listed with the Tavors' sights by name;
   the bench names where each sight adjusts.
4. Orientation: the short line names the rifle; the intro names the sight.
5. Feedback: the knob's setting line and end-of-travel words as before.
6. Interruption: none added.
7. Thumb reach: every sight of every rifle now held to the reach list at
   412×915, 412×830 and 1280×800 (Verify 7).
8. Defaults: each rifle opens with a sight of the kind it opened with; a
   new sight starts at its middle, unzeroed where nothing carries.
- Not added: a control to choose between the Troy's or the FAB's two rear
  peeps (the game has one ring per sight; the large one is drawn), and any
  polish of the drawings (the picture work is paused).
- From Dan's own requests: 3 (finding the sights he fitted by name) and 8
  (which sight each rifle opens with).

Screenshots (both sizes, in `docs/reports/screenshots/` on the notes
branch): `line-troy-100`, `line-fab-100`, `line-seeall-100`,
`line-seeall-paper-50`, `line-kns-peep-100`, `line-ak545-ball-100`,
`line-ak545-xs-100`, `line-vepr-ball-100`, `home-sight-chooser-tavor`,
`line-bugbuster-dots-3x`, `line-bugbuster-dots-9x`; the moved states
`line-ak-leaf` (the 5.45's leaf), `line-tavor-irons-200` (the FAB sights)
and every AR-15 state (the Troy sights).

## What the brief got wrong

1. **"Do not change any file on the picture list."** The task's own change
   breaks three measures in `test/scene.test.js`, a picture-side file: it
   measured the Tavor irons (now replaced), the Vepr's flat front post (now
   a ball on a stem) and the BugBuster's dots at a fixed spacing (now true
   for the power). Each was changed to read the figure from the data it
   already measured against, and the dots' row is read 8 MOA over the
   plate, where they no longer run into the steel. range-day-eleven did the
   same for the same reason. Nothing about the picture changed.
2. **Item 5 assumed the dots are true at the scope's top power.** The
   maker says 10x, above the BugBuster's 9x: at no power is the spacing
   exactly a milliradian (1.11 at 9x, 3.33 at 3x).
3. **Item 2 and the old records**: a record from before every sight could
   be chosen is read as the rifle's default sight's. With the AR-15's
   default now the Troy sights, the old AR iron sights' range-day-one zero
   and log would have been read as the Troy's. The brief did not foresee
   this; fixed with `tookThePlaceOf` (deliberate divergence 6).
4. **The brief check of this brief** (event 2941) returned two findings
   that were not acted on: (1) run on the machine rather than the cloud:
   Dan's own words and `CLAUDE.md` put this work in the cloud; (2) the
   production deploy may be refused by auto mode: the brief already says to
   stop and report if it is.
5. **"The sight chooser open on a Tavor"**: a page's drop-down list is
   drawn by the browser outside the page and is not in a screenshot; the
   state shows the list at full length instead (set for the picture only).
6. **Environment check 4** passes only after linking: the pinned Playwright
   looks for `chromium-1194`, the container has `chromium-1243`; linked
   outside the repository (`/tmp/claude-0/pw`, `PLAYWRIGHT_BROWSERS_PATH`).
   Until then every browser test is skipped while the check reports "all
   passed".

## Deliberate divergences

1. **The KNS rear peep replaces the sliding leaf.** KNS does not say so;
   inferred from "drop-in" for the AKM-style rear sight and the photographs
   (a leaf with a peep hole and a wheel). So the 7.62x39 rifle has no leaf:
   distance is clicks (20 each way, 0.5 MOA) or hold.
2. **One rear ring per sight.** The Troy and the FAB rears have two peeps
   each; both are recorded (`apertures`), the large one is drawn.
3. **The FAB's tall guards stand outside its 3 mm peep** (172 MOA apart,
   the ring 116 MOA): they are drawn, and hidden by the ring, as through
   the real peep.
4. **The XS post fills the AK's rear notch** (24.26 MOA against 24 MOA):
   no light shows beside it, as the post and a standard notch would look.
   Its width is therefore proved by the absence of light in the notch, not
   by a measured edge.
5. **One sight carries the 5.45 rifle's old records**: the ball post that
   took the old irons' place. The XS post clicks alike and sits at the same
   height, but starts new.
6. **Records from before any sight could be chosen** follow the sight they
   were made with (`public/game.js`, `oldRecordsSightOf`; `data/sights.json`,
   `tookThePlaceOf`). `test/browser.test.js` "verify 6: a zero and a log
   written in the old form …" changed and renamed: the AR-15's range-day-one
   zero and log stay stored and are not the Troy sights'.
7. **The reach list holds every sight of every rifle** (14, was 3), and a
   sight without a glass control names none; the test's assertion that the
   glass control is shown applies only where there is one.
8. **The ring's measured edge** sits about 3% outside the data's ring (the
   soft dark fade's half-dark point); the test allows 6%.
9. **The leaf test and the `line-ak-leaf` state moved to the 5.45 rifle**
   (behind its ball post): the 7.62x39 rifle's peep has no leaf.

## Verify results

1. `git diff origin/main...HEAD -- public/engine.js data/courses.json
   data/terrain.json data/look.json data/spotting.json public/terrain
   src/scene`: empty (0 bytes).
2. Each new sight (pages read through the search engine's indexed text:
   page fetches from this session are refused, `CONNECT tunnel failed, 403`):

   | Sight | Model and why | Figures with sources | Estimates (basis in the data) | Not found |
   | - | - | - | - | - |
   | Troy (AR-15) | Rear SSIG-FBS-R0BT-00 (round, dual peep), front M4-style SSIG-FBS-FMBT-00: Dan named the Troy folding rear and front; the M4-style front pairs with the round rear | rear peeps 0.190 and 0.070 in, windage 1/2 MOA a click (Troy's instructions); height 2.6 in (AR height) | front click 1.33 MOA (an A2 post, Magpul's per-click figure scaled to an 18.0 in radius); radius 18.0 in; travel 12; guards | Troy's front click (retailers' "0.5 MOA" does not fit an A2 post and was not used), post width (A2 standard 0.070 used) |
   | FAB (both Tavors) | FBS front FX-FBS, RBS rear FX-RBS (set FX-FRBSKIT): polymer flip-ups listed for the Tavor, matching the photographs | peeps 3 mm and 1.5 mm (retailer) | clicks 1 MOA (IWI's own backup set), travel 12, post 0.08 in, radius 10 in, height 3.65 in, guards | any FAB click value, post width, radius |
   | SeeAll (both Tavors) | The Original See All Open Sight Gen-1, triangle | 1/16 turn = 1 in at 100 yd (maker's instructions); 150 in travel (retailer) | triangle 6 × 6 MOA, line 3 MOA under the tip, block 240 MOA wide, height 2.85 in | the triangle's size, the field of view, the height over the rail (one reviewer's 0.75 in body) |
   | KNS ball post (7.62x39, 5.45, Vepr) | AKBALL.034 | 0.034 in ball (retailer page title) | stem 0.020 in; radii (AKM 378 mm; Vepr 19.13 in from the RPK's 555 mm) | stem width, thread, per-turn movement |
   | KNS rear peep (7.62x39) | AK EL-WIN, "for AKM-Style Rear Sight" | windage and elevation at the rear, detented, six inserts (retailer) | 0.5 MOA a click, 20 each way (one buyer's review); peep 2.5 mm; leaf 0.9 in wide | click value, travel, insert sizes, whether the leaf's range settings are kept |
   | XS stripe post (5.45) | AK-2001-6 Tritium Stripe Front | post 0.105 in (retailer), green tritium stripe in a white outline | stripe 0.04 in, 0.02 in under the top | fit on the AK-74 (XS names the AK-47/AKM for this post) |
   | BugBuster dots | SCP-M392AOLWQ | second focal plane, true at 10x (maker's manual) | — | a model-specific mil-dot table |

3. Drawn against data (canvas pixels, `test/browser.test.js` "range-day-twelve
   verify 3"; full lines in `docs/reports/range-day-twelve/browser-tests.txt`):
   for each new sight on each rifle, at 412 and 1280 px wide: the post or
   ball, the stem, the guards' gap, the XS stripe and the SeeAll's triangle
   drawn within 1.07 px of the data (largest: the KNS peep's stem at
   1280 px, 6.31 px against 7.37); the SeeAll's tip 0 px (412) and 1 px
   (1280) below the aim point, its middle 0.54 px beside it; the rings
   1 to 3% wider at their half-dark point than the data's ring (Troy 255.5
   against 247.5 px at 412; FAB 111.0 against 109.8; KNS 23.7 against
   22.8), the soft fade's own edge (divergence 8); the KNS peep's leaf
   209.6 against 209.4 px. The FAB's guards stand outside its ring and are
   hidden by it (divergence 3); the XS post fills the notch: the brightest
   pixel beside it in the notch 46 (412) and 62 (1280) against the sky's
   175 and 156 (divergence 4).
4. Same scale (`test/browser.test.js` "range-day-twelve verify 4"):
   32 targets (the 50-yard paper and the farthest plate, through each of
   the eight sight-and-rifle pairs, at both sizes): drawn where the angles
   put them, largest difference 0.000 px.
5. Records (`test/day.test.js` "range-day-twelve verify 5", full keys in
   `docs/reports/range-day-twelve/day-tests.txt`):
   per rifle, the two deciding figures (click elevation/windage; height
   over the bore) and the case:
   - the AR-15: 1.75/0.75 MOA, 2.6 in before; 1.33/0.5 MOA, 2.6 in now:
     not carried, starts unzeroed;
   - the Tavor SAR and the X95: 1.5/1 MOA, 3.0 in before; 1/1 MOA, 3.65 in
     now: not carried;
   - the 7.62x39 rifle: 2/2 MOA, 1.9 in before; 0.5/0.5 MOA, 1.9 in now:
     not carried;
   - the 5.45 rifle: 2/2 MOA, 1.9 in before and now: carried by the ball
     post;
   - the Vepr's irons: the same id, 2/2 MOA, 2.0 in: nothing moves.
   Stored keys before: the zero, setting, log and book under `ar-irons`,
   `tavor-irons` (both Tavors), `ak-irons` (both AKs) and `vepr-irons`.
   After: all of them unchanged, byte for byte, plus the 5.45 rifle's
   copies under `ak545-ball` (zero, setting, log, book); nothing written
   under the Troy, FAB or KNS peep names. The copy file holds each book
   line once. **Rifles that need zeroing again: the AR-15, the Tavor SAR,
   the Tavor X95 and the 7.62x39 rifle.**
6. The BugBuster's dots: the maker's scope manual (Leapers, a copy at
   https://www.pyramydair.com/airgun-resources/manuals/leapers-Optics-General-Scope-user-manual.pdf;
   the BugBuster 3-9x32 manual carries the same words): "All current UTG
   scopes have second focal plane reticles." and "All reticles are
   calibrated at 10x magnification." Drawn spacing from the canvas:
   3x 10.0 px apart on the phone (data 10.09), 17.0 on the computer
   (16.99); 6x 9.5 (9.42) and 16.0 (15.87); 9x 9.0 (9.05) and 15.5 (15.25).
   In angle: 11.47 MOA at 3x, 5.73 at 6x, 3.82 at 9x: three times as far
   apart at 3x as at 9x.
7. The arrangement (`scripts/line-layout.mjs`, every sight of every rifle,
   `docs/reports/range-day-twelve/line-layout.txt`): every sight of every rifle (14) at 412×915, 412×830 and
   1280×800: 42 of 42 "everything within reach"; at 412×760, a figure only
   as on `main`, the book line falls under the bar on all 14. Both zoom
   sliders keep their lengths and end 40 px or more from the right edge
   (`test/near.test.js`, range-day-ten verify 3 and 5, passed:
   `sliders.txt`), measured (`sliders.mjs`, `sliders-measured.txt`): at
   412×915 and at 412×830 the rifle scope's zoom slider is 130 px long and
   ends 40 px from the right edge, the spotting scope's 148 px long and 40 px
   from the edge (both as on `main`); at 1280×800, 342 px and 360 px, each
   104 px from the edge. Home's doors on a 412×915 phone: bottom 873 px of 915 on
   the AR-15 and the AKs, 849 px on the Tavors (`day-tests.txt`, verify 13,
   passed). Each new name is no longer than the longest on `main` (86
   characters; the longest new one, 63).
8. Screenshots: 93 states at both sizes, all checks passed in the session (shards
   1 to 4: 739, 812, 1,026 and 944 s), no sideways scroll, no console error;
   the KNS peep's state retaken after its fix (1 of 93, passed). The new and
   moved states' images (68) are on the notes branch.
9. The check: Checks run
   [44914324233](https://github.com/isleofdan/range-day/actions/runs/44914324233)
   on `ec26924`, every job green: who works on what 18 s; tests (rest)
   30 s, (browser) 79 s, (day) 125 s, (near) 288 s, (scene-scale) 280 s,
   (scene-rest) 559 s, (scene-shots) 549 s; screenshots shard 1 544 s, 2
   987 s, 3 728 s, 4 668 s. Tests 130 → 137; states 82 → 93. Changed tests
   and why: `test/guns.test.js` (the AR's sight is the Troy's; the 5.45's
   leaf is its sights' own); `test/browser.test.js` verify 6, old-form records (the
   AR's range-day-one zero and log are not the Troy's; renamed to say so), home remembers a sight (the
   SeeAll, not the Tavor irons), the Tavor dot-and-irons test (the FAB
   sights), the leaf test (the 5.45 rifle); `test/day.test.js` and
   `test/near.test.js` (the AR's records under the Troy's name), the reach
   test (every sight; a glass control only where there is one);
   `test/scene.test.js` (What the brief got wrong, 1). In the session the
   pieces were run one at a time; the run on the pull request is the
   proof.
10. The pull request's diff: 18 files, 175,524 bytes (under 400,000).
11. After the deploy: in the card note.

What this cannot prove: the session cannot open the live app or hold a
phone, and it has not seen the real sights, so whether each drawn sight
looks to Dan like the one he fitted is unverified until he looks.

## The notes branch

This report, its screenshots and measure files and the `PLAN.md` note are
on `claude/range-day-card-brief-xmfvcf-notes`, with no pull request yet.
They reach `main` in a notes-only pull request after the deploy result.
That order is this repository's standing rule, not a choice of this
session: `CLAUDE.md`, "Field reports": "When the session merges and
deploys, the order is fixed: the change's pull request first (the report
links it); after the deploy result, a notes-only close-out pull request
carrying the field report and the `PLAN.md` note. That order is the rule,
not a divergence." The result checker has questioned it before and Dan
kept the order both times (range-day-eleven, "Result check rounds" and
Ask 1).

## Result check rounds

Round 1 (job 20261121-145321-21692a, report event 2944): FINDINGS, five.

1. *The report said every check passed while the day tests had failed on
   the newest commit.* Right. Checks run 44916065640 on `f094830` failed
   one day test ("verify 5: the box and the zeroing supply"): it read the
   bench's supply line 0.6 s in, before the page wrote it, on a cold runner
   (it passed on the run before). Fixed in the test helper, not by a
   re-run: the bench helper now waits for that line (`ddd8ca6`). Verify 9
   now names the run on the final commit.
2. *The 5.45 rifle "will not need zeroing again", though its XS post starts
   new.* Right; the first paragraph and the closing message now say the
   ball post keeps the zero and the XS post starts unzeroed.
3. *The notes are held back until after the deploy.* Not changed: that
   order is this repository's rule, quoted under "The notes branch"
   (`CLAUDE.md`, "Field reports": "That order is the rule, not a
   divergence.").
4. *Verify 7 gave no slider lengths or gaps.* Right; measured and added
   (130 and 148 px long, 40 px from the edge, on both phones).
5. *A picture-side file is changed.* Not removed: the brief's rule 6 says
   "Do not change any file on the picture list", and its task items 1 to 3
   replace the three sights that `test/scene.test.js` measured by name and
   by fixed figures. Without the three edits that file's checks fail
   (the Tavor irons are gone, the Vepr's front is a ball, the dots move
   with the power), and a failing check stops the merge (brief section 10,
   item 5). The edits change no measure's method or tolerance and nothing
   about the picture; they read the figures from the data. Quoted here and
   in "What the brief got wrong", 1.

## Asks

1. **Merge and deploy range-day-twelve, then merge its notes?**
   Recommended: yes. Type `yes, merge and deploy range-day-twelve, then
   merge its notes`.
2. **The AR-15's Troy front sight: the one with two guards (M4-style) or
   the round hood (HK-style)?** The game draws the two guards. Recommended:
   keep the two guards unless the round hood is what you remember.

## What the next session needs

- Dan's look on his phone after the deploy, sight by sight (the closing
  walkthrough); anything that does not look like the sight he fitted comes
  back as a picture item (paused) or a figure (Claude's side).
- Next work, each planned by a Personal Shipyard chat: recording and
  playback; the BCM's magnified scope once Dan names it; the .22's Primary
  Arms CLx 1-6x24 (agreed on the card, not in this brief). Codex's side: the
  plate flicker during recoil, with Dan's screen recording;
  `scripts/picture-measure.mjs` still names the old scope. The picture work,
  the look of the drawn sights included, stays paused on Dan's word.
- Playwright in a cloud session: link the container's Chromium (What the
  brief got wrong, 6) before trusting a browser test's "passed".

## Closing message to Dan

Nothing on your screen has changed yet. Merging and deploying puts the
sights you fitted on your rifles, and four of them will need zeroing again
at the zero bench: the AR-15, the Tavor SAR, the Tavor X95 and the 7.62x39
rifle (each new sight clicks differently or sits at another height, so the
old zero in clicks would be wrong; the old records stay kept). The 5.45
rifle keeps its zero with the ball post; its other new choice, the XS
stripe post, starts unzeroed. The Vepr keeps its zeros.

The change is pull request #36:
https://github.com/isleofdan/range-day/pull/36. Every check on it passed.

Needed from you
1. Merge and deploy? If yes, type: `yes, merge and deploy range-day-twelve, then merge its notes`
2. The AR-15's Troy front sight: the game draws the kind with two guards
   either side of the post. If yours had the round hood instead, say so;
   otherwise nothing to do.
