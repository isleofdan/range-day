# FIELD REPORT — range-day-nineteen — 28 Nov 2026

The expansion's first four rifles are built: the Tikka T3x CTR in 6.5
Creedmoor, JP Enterprises' JP-15 in 6mm ARC, the IWI Tavor 7 in
7.62x51 and the Vudoo V-22 Ravage in .22 LR, with match ammunition for
the three new calibers. All of it is in pull request
[#64](https://github.com/isleofdan/range-day/pull/64), which waits for
Dan's typed line to merge, write the four gun records and deploy.
Nothing is live yet.

Executor: a Claude Code cloud session (Dan opened it from the Wall card
`range-day`; permission mode Auto, as the session's own record states).
Independent checker: the Codex result checker through the Spine tool
`check_result` (its verdict under "Verify results").

## What stands

- **Ammunition** (`data/loads.json`, step 1): six loads, every figure
  with its source or its estimate's basis. The 6.5 Creedmoor loads
  are Hornady Match 140 gr ELD Match (#81500: 2,710 fps from a 24 in
  test barrel, G7 0.326) and 147 gr ELD Match (#81501: 2,695 fps,
  G7 0.351). The 6mm ARC loads are Hornady Match 108 gr ELD Match
  (#81608: 2,750 fps from 24 in, G7 0.27) and Hornady BLACK 105 gr
  BTHP (#81604: 2,750 fps, G1 0.530, no G7 published). The 7.62x51
  loads are Federal Gold Medal Match 168 gr (GM308M: 2,650 fps from
  24 in, G7 0.224) and Hornady Match 168 gr ELD Match (#80966:
  2,700 fps, G7 0.263). All come in boxes of 20.
- **Speed per inch of barrel** (`data/workbench.json`), each sourced:
  6.5 Creedmoor 22 ft/s (RifleShooter's cut-down tests), 6mm ARC 15 ft/s
  (Shooting Illustrated: the 108 gr load ran 2,661 fps from an 18 in AR,
  against 2,750 fps rated from 24 in), 7.62x51 22.7 ft/s (RifleShooter,
  28 to 16.5 in). These set each load's speed from the rifle's own barrel:
  the JP-15's loads 2,660 fps; the Tavor 7's 2,480 (Federal) and 2,530
  (Hornady); the Tikka's need no change (24 in, the test barrel).
- **Tikka T3x CTR, 6.5 Creedmoor** (step 2): 24 in barrel (Tikka sells
  20 and 24 in), factory Picatinny rail 0.55 in over the bore (an
  owner's measurement, marked an estimate), no iron sights; opens on the
  Leupold Mark 5HD; first course the canyon.
- **JP Enterprises JP-15, 6mm ARC** (step 3): 18 in Supermatch barrel,
  AR-15 rail 1.21 in over the bore (as the BCM), no iron sights; opens on
  the Leupold Mark 5HD.
- **IWI Tavor 7, 7.62x51** (step 4): 16.5 in barrel (IWI also sells a
  20 in conversion kit; both on the workbench). American Rifleman: "the
  Tavor 7 does not come equipped with iron sights", so it opens on the
  Vortex Razor 1-10. Rail 2.25 in over the bore, the same basis as the
  two Tavors.
- **Vudoo V-22 Ravage, .22 LR** (step 5): 16.5 in barrel (Vudoo's page
  lists 16.5, 18, 20 and 22 in; all four are on the workbench); Vudoo's
  Picatinny scope base, about 1 in over the bore (an estimate from the
  Remington 700 footprint), so it takes every collection mount, unlike
  the set's Remington .22. It shares the .22's CCI load.
- **A rifle with no sights of its own** (`lib/guns.js`, step 2): an
  empty `sights` list is accepted only with a Picatinny `scopeMount`. Such
  a rifle offers the four collection scopes, and its `defaultSight` may be
  a collection scope. Every existing rifle's behavior is unchanged, and
  `test/fitted-strikes.json` passes byte for byte.
- **Home** (step 6): the four stand under "More rifles". The card after
  the first seven ("More rifles ›, 4 more") swaps the list in the same
  place. The last card ("‹ The first seven") goes back, and when the
  picked rifle is in the other list, that card names it. The list holding
  the picked rifle is the one shown on opening. "The whole set" lists the
  four under their own heading, saying "No sights of its own. From the
  scope collection: …".
- **Gun records** (step 7): each new rifle's record says `whose: "no
  one's: one of the game's expansion rifles"` (`game.expansion: true`).
  The seven stay "Dan's". `npm run gun-records -- <ids>` prints only the
  rifles named, so the four can be written without sending the seven
  again (an upsert of the seven would send their game sections
  unchanged, but this keeps the write to what changed). Nothing was
  written to the Spine in this session.
- **Tests** (step 8): `test/expansion.test.js`, 8 tests: the four rifles'
  figures, collection and heights; each load's speed from the rifle's
  barrel; Hornady's 6.5 Creedmoor table; and, in a browser, each rifle
  picked under "More rifles", zeroed at the bench and fired on the line
  through its default collection scope. Tests that counted seven rifles
  or sixteen loads now count from the data file and check the seven by
  name.

## UI review (per screen touched)

Home with "More rifles" (`home-more-rifles`, `home`):
1. **Frequent action** (pick one of the seven) is unchanged and in the
   same place; picking a new rifle takes one more tap.
2. **Recovery**: "‹ The first seven" goes back; nothing is lost.
3. **Finding**: the dashed "More rifles ›" card sits in the empty cell
   beside the .22, where it adds no height.
4. **Orientation**: the "More rifles" heading. A picked rifle out of view
   is named on the swap card ("7 rifles · IWI Tavor X95 picked").
5. **Feedback**: the list swaps at once.
6. **Interruption**: none.
7. **Thumb reach**: both doors stay wholly on a 412×915 screen. They end
   at 873 px with the seven (as on main) and at 810 to 826 px with the
   four (`test/browser.test.js` verify 11, all eleven rifles).
8. **Defaults**: the list holding the remembered rifle opens.

A new rifle's sight choice (`home-tikka-sight`):
1. **Frequent action**: one Sight list, as for every rifle.
2. **Recovery**: pick another scope.
3. **Finding**: the scopes sit under "From the scope collection".
4. **Orientation**: the zero line names the scope.
5. **Feedback**: the zero line changes at once.
6. **Interruption**: none.
7. **Thumb reach**: unchanged.
8. **Defaults**: the rifle's default scope comes first.

The line through the Leupold on the Tikka (`line-tikka-scope`, 10x) and
the workbench with the Tikka (`workbench-tikka`): questions 1 to 8 as on
main. These screens are unchanged and driven by the data: the barrels
are 20 and 24 in, and the four collection scopes are offered with their
mounts.

Not added: a separate home page or tab for the expansion. It would be one
more place to look, and the swap keeps one screen. No new screen beyond
what the data drives. Dan's own request behind this: the locked
expansion of more rifles, calibers and optics (card `range-day`, the
research chat's note).

Screenshots, each at 412×915 (`-phone`), 378×762 (`-small`) and
1280×800 (`-computer`), are in `docs/reports/screenshots/`:
`home-more-rifles-*`, `home-tikka-sight-*`, `line-tikka-scope-*`,
`workbench-tikka-*`, and `home-*` (the seven with the new card).

## What the brief got wrong

- "For the Tavor 7 the existing 7.62x51 loads apply": the set had no
  7.62x51 load (its 7.62 loads are 7.62x39 and 7.62x54R). Two were
  added, Federal's and Hornady's 168 gr match loads, in place of the one
  .308 match load the brief asked for. 7.62x51 also needed a speed per
  inch on the workbench.
- "JP SCR-11, 6mm ARC": no SCR-11 in 6mm ARC was found. Listings show
  it in 5.56, .223 Wylde, .224 Valkyrie, 6.5 Grendel, .300 Blackout and
  .22 LR. JP's 6mm ARC rifle is the JP-15 (see the divergences).
- "Vudoo V-22 Ravage … with a Picatinny rail": Vudoo's page says "scope
  base" (0 to 60 MOA). Its bases are sold as Picatinny rail sections
  ("~5.75\" of Picatinny rail"), which is what the entry cites.

## Deliberate divergences

- **The JP-15 instead of the SCR-11.** The wave's pick was "a JP
  Enterprises-style precision AR in 6mm ARC" (the research note). The
  JP-15 is JP's own 6mm ARC rifle, sold with an 18 in Supermatch barrel.
- **The Tikka's barrel is 24 in.** Tikka's own page could not be read
  (no tikka.com page came up in the indexed text), so which length it
  leads with is unknown. 24 in is the test barrel of both Hornady loads,
  so their speeds need no adjustment. Both 20 and 24 in are on the
  workbench.
- **Home's two lists take turns in one place, not one long list.** Main
  leaves 42 px under the doors on a 412×915 screen. Two more rows of
  cards and a heading would push the doors off it, which the 412×915
  test refuses.
- **The Vudoo's rail height, the Tikka's and the Tavor 7's** are
  estimates with their bases. No maker publishes one.
- **The 6.5 Creedmoor table check compares drop within 0.2 minute of
  angle and speed within 1.5%.** The other makers' checks use under
  10 ft/s for speed; Hornady's figures sit up to 27 ft/s (1.3%) under
  the engine's at 500 yd, while the drop agrees within 0.12 minute of
  angle. Hornady's table comes from its own drag model.
- **The browser checks compare with the browser's own engine.** The
  Vudoo's strike differed from the test machine's engine in the 14th
  decimal place. Each shot is compared with the engine as the page runs
  it, to every digit, and the two engines agree within a billionth of an
  inch, as `test/scope22.test.js` does.

## Verify results

1. **Tests.** On `main` (`2418c76`) before any change, without the
   browser: 196 tests, 109 passed, 87 skipped (the browser tests), 0
   failed. On the branch: 205 tests (196, plus 8 in
   `test/expansion.test.js`, plus 1 in `test/guns.test.js`).
   RESULTS_TESTS
   `test/fitted-strikes.json` is unchanged (the pull request's diff does
   not touch it), and `test/workbench.test.js` "verify 2" passes: the
   seven rifles strike where they did, to every digit.
2. **Hornady's 6.5 Creedmoor 140 gr table** (200 yd zero, sight 1.5 in,
   ICAO air, G7 0.326, 2,710 fps), drop against Hornady's, and the
   speed:
   - 100 yd: 1.9 against 1.9 in (−0.01 MOA); 2,570 against 2,564 fps.
   - 200 yd: 0.0 against 0 in (0.00 MOA); 2,433 against 2,422 fps.
   - 300 yd: −7.8 against −7.8 in (0.01 MOA); 2,301 against 2,285 fps.
   - 400 yd: −22.1 against −22.3 in (0.05 MOA); 2,173 against 2,152 fps.
   - 500 yd: −43.8 against −44.4 in (0.12 MOA); 2,050 against 2,023 fps.

   The table as a calculator page relays Hornady's published figures
   (search text); the 100 yd speed is also in a retailer's copy of
   Hornady's figures.
3. **Each rifle zeroed and fired through a collection scope**
   (`test/expansion.test.js`, in a browser, signing in through the
   form). Each bench hole is the engine's, and each zero was saved; each
   line shot at 100 yd is the engine's, to every digit:
   - Tikka, Leupold, Hornady 140: bench −7.57, −1.63 in; line
     −6.735959552834662 in up, −1.0902742326583033 in right,
     0.11474587343201592 s.
   - JP-15, Leupold, Hornady 108: bench −7.9, 1.44; line
     −6.87298622209147, 2.1244081526491465, 0.11709611549346341 s.
   - Tavor 7, Vortex Razor 1-10, Federal 168: bench −10.83, −2.69; line
     −9.805517685879966, −1.996166315177192, 0.12717409913307576 s.
   - Vudoo, Leupold, CCI: bench −22.65, −1.3; line −21.21524412070416,
     −0.161549689839563, 0.31036024303147963 s.

   The weather is drawn per day, so these figures change from run to
   run; the equality does not. The Tavor 7 has no iron sights, so there
   is no irons shot.
4. **The guns line after the deploy.** The Spine holds 12 gun records (7
   rifles, 5 pistols; Deploy run 30's line). Once the four are written,
   the line should read: "guns from the Spine: 16 records, 11 in the
   game, 5 not modeled · … · differs from data/rifles.json: none". The
   deployed run's own line is to be recorded word for word after Dan's
   line, in the notes pull request.
5. **Screens**: the states listed under the UI review, at 412×915,
   378×762 and 1280×800; every state shows its text and fits the width
   (`npm run screenshots` with those states: "all checks passed").

RESULTS_CHECK

## Numbered asks

1. Merge #64, write the four gun records, deploy, then merge the notes?
   Recommended: yes. If yes, type:

```
yes, merge and deploy range-day-nineteen, write the four gun records, then merge its notes
```

## What the next session needs

- The two multi-caliber rifles (Barrett MRAD MK22 and Blaser R8): a
  barrel that changes a rifle's caliber is a new workbench mechanic.
  After them, the three new collection scopes (Vortex Razor HD Gen III
  6-36x56, Nightforce ATACR 7-35x56, ZCO ZC527 5-27x56). `lib/guns.js`
  already accepts a rifle with no sights of its own.
- Open: Tikka's own page for which CTR barrel it leads with; the three
  estimated rail heights, if a maker or an owner publishes one.

## Closing message to Dan

Four new rifles are built and waiting on your yes: the Tikka T3x CTR (6.5 Creedmoor), JP's JP-15 (6mm ARC; JP sells no SCR-11 in that caliber), the IWI Tavor 7 (.308) and the Vudoo V-22 (.22). On home they sit under "More rifles". None comes with iron sights, so each opens on a collection scope.

Needed from you:

1. Merge, write the four gun records, deploy, then merge the notes? Recommended: yes. If yes, type:

```
yes, merge and deploy range-day-nineteen, write the four gun records, then merge its notes
```
