# FIELD REPORT — range-day-fifteen — 2026-11-25

The game on Dan's phone looks the same. What is new on his screen is his guns in the Spine: twelve records on the Spine's records page, seven of them carrying the game's figures. Pull request [#52](https://github.com/isleofdan/range-day/pull/52) is merged as `a132f32` and deployed (Deploy run 25, [45722913828](https://github.com/isleofdan/range-day/actions/runs/45722913828), success, 85 s): the live game reads its rifles from those records.

Route: a Claude Code cloud session (no `/data/home/dan/FACTS.md` here: `ls` answered "No such file or directory"), permission mode not readable from inside this session (its status line is not shown to it), though edits, commits and the push ran without a prompt, as Auto mode does; builder Claude (this session); independent checker the Codex result check (`check_result`). Branch `ccr-f2ea3998-tpyxa0`.

## What stands

- **The record's shape** (`lib/guns.js`, `docs/RECORDS.md`; commit `baa0036`): a gun record is `{ id, name, fields: { gameId?, kind, caliber, whose, game?, notes? } }`. `checkRecord` refuses, by name and with the valid values, a `game` section without `gameId` (listing the seven ids), a `gameId` that is not lowercase letters, digits and hyphens, a `kind` other than `rifle` or `pistol`, a `caliber` that is neither a string nor `null`, no `whose`, and a record `caliber` different from its game section's. `fromRecords` keys the set by `fields.gameId`, skips and counts every record without a `game` section, and fills `{ records, inGame, notModeled }`. `toRecord(id, entry)` writes `gameId: id`, `kind: "rifle"`, the entry's `caliber`, `whose: "Dan's"` and the entry less its name as `game`. Four new tests in `test/guns.test.js`.
- **`npm run gun-records`** (`scripts/gun-records.mjs`; commit `e9d3679`) prints `{ records: [{ type: "gun", name, fields }] }` for the seven rifles, exactly as `toRecord` makes them; a test compares every row with `toRecord`.
- **Twelve gun records in the Spine**, written with `import_records` (seven from the script's output, the five pistols as the brief lists them) and read back with `list_records` (`type` `gun`): `state` `ok`, twelve items, seven with a `game` section, five without. Every call answered `rejected: []`; inserted 1, 1, 1, 2, 1 and 6. The Spine's ids are 12-character hashes, not readable slugs:

  | Gun | Spine id | gameId |
  | - | - | - |
  | BCM AR-15 carbine, 5.56 | `ce1a836513f8` | `bcm-ar15` |
  | IWI Tavor SAR, 5.56 | `788a4a5098c6` | `iwi-tavor-sar` |
  | IWI Tavor X95, 5.56 | `7ab769cee86d` | `iwi-x95` |
  | AK-pattern rifle, 7.62x39 | `4e6701ae0893` | `ak-762` |
  | AK-pattern rifle, 5.45x39 | `31a05e3d15d9` | `ak-545` |
  | Molot Vepr, 7.62x54R | `59a0a721364f` | `molot-vepr-54r` |
  | Remington bolt-action .22 LR, heavy barrel | `d704abeedbbf` | `remington-22` |
  | IWI Jericho 941 | `ae0abc6ec718` | (pistol) |
  | Springfield XD-S | `6b4d6299a251` | (pistol) |
  | Springfield XD (first of two) | `02033ac03ad6` | (pistol) |
  | Springfield XD (second of two) | `ee1cf3cb136c` | (pistol) |
  | Dan Wesson 1911 | `6669089a36a7` | (pistol, `.45 ACP`, with the note) |

  The Spine answers each record's fields with their keys sorted alphabetically; lists keep their order. No screen reads a rifle's figures by key order (a search of `public/*.js` for `Object.keys`/`Object.entries` over `sightHeightIn` or `boreOffsetMoa` found none), and the comparison below ignores key order only.
- **The server reads the Spine** (`lib/spine-guns.js`, `server.js`, `fly.toml`; commit `6c58047`). `fly.toml` sets `SPINE_GUNS_URL = "http://spine-dan.internal:8080/internal/records?type=gun"`. The server reads it once before it starts listening, limit 5 seconds (`AbortSignal.timeout`), then every 10 minutes in the background; the items go through `fromRecords`. A failed read, or a set the check refuses, keeps the last set accepted from the Spine, or, with none yet, takes the whole set from `data/rifles.json`; never a mix. Every call goes through `lib/upstream.js` (service `Spine`), so the status page shows the last failure. With `GUN_RECORDS_FILE` set (tests, local runs) that file wins as before; with neither set, the file is used and nothing is called. The new open route `/alive/guns` answers one line, for example `guns from the Spine: 12 records, 7 in the game, 5 not modeled · read in 140 ms (limit 5000 ms) at … · differs from data/rifles.json: none`, or `guns from data/rifles.json, fell back: the Spine read at … failed after … ms: <reason>`; after a later failure it adds `the last read … failed …: <reason>; keeping the set read at …`. It carries no figure of any gun. `/alive` is unchanged (a test reads it).
- **Tests of the limit, both ways** (`test/spine-guns.test.js`; commits `1414622` and `a2fc8e2`), against a stand-in Spine: one that never answers, so the game listens after 5,063 ms on `guns from data/rifles.json, fell back: … failed after 5004 ms: no answer within 5000 ms`; one that answers after 2 seconds, so the game uses its set (read in 2,036 ms; its changed barrel figure is served, and `bcm-ar15` is listed as a difference); a refused record, an empty list, an answer that is not JSON, a 403 and a refused connection, each falling back with its reason (`gun 'iwi-x95': defaultSight 'troy-battlesights' is not one of its sights: fab-flipup, pa-md25, seeall-gen1`; `gun records: the list is empty; …`; `the Spine's answer is not JSON: <html>…`; `the Spine answered 403: …`; `no answer: ECONNREFUSED`); a set equal to the file reads `none` whatever the key order; after one accepted read, a read that never answers and then an empty list each keep the accepted set, with the reason, and the next good read is used again.
- **The deploy says where the guns came from** (`.github/workflows/deploy.yml`; commit `7bc4181`): the step "Say where the guns came from", after "Check the alive line", prints `/alive/guns` and writes a warning annotation, never a failure, when the line is not from the Spine, shows a difference, or the route does not answer. A test runs the step's own shell against a stand-in `curl` in all five cases.
- **The rule for later sessions** (`CLAUDE.md`, "Range Day's own rules"; commit `85dc132`), and `/alive/guns` added to the gate rule's list of open routes.
- Pull request [#52](https://github.com/isleofdan/range-day/pull/52), merged as `a132f32` on Dan's line (below), deployed by Deploy run 25 (success).

## What the brief got wrong

1. "`main` is live at `f245d82`" and "Pull request #51 … is open and waits for Dan": when this session read the card, #51 had merged as `d114a29` (card `range-day`, event 3042), and the branch started from `d114a29`.
2. "Work on a branch named `claude/range-day-fifteen`": this cloud session may push only to `ccr-f2ea3998-tpyxa0` (its own setup); the work is there.
3. "open the pull request with `gh pr create`": this cloud session has no `gh`; the pull request was opened with the GitHub connector.
4. "a Spine record written in bulk gets an id the Spine derives from its type and name": true, but the id is a 12-character hash (`ce1a836513f8`), not a readable slug.
5. Section 4, item 6: the card `spine` carries no note by `session:spine-gun-shelf` yet (its newest notes are the brief and the checker's findings, events 3028 to 3040), so the route was taken from the spine-gun-shelf brief, event 3040. If that session's "For Range Day" section differs, it wins and the next close-out note says so.
6. The card shows no brief check PASS for this brief (the last check on the card, event 3039, gave findings for event 3037; event 3041 was filed after it with no check). Recorded as found; the work followed event 3041.

## Deliberate divergences

1. **The read-back check of the figures is by code at deploy, by eye now.** `list_records` returned the twelve records into this conversation; comparing them with `data/rifles.json` by code needed them on disk, which would have meant retyping 18 KB. The rifles were sent from the script's output and the Spine rejected none; the code comparison is `/alive/guns` after the deploy ("differs from data/rifles.json: none" expected), which reads the same records whole.
2. **Five calls to `import_records`, not one.** The whole set in one call (18 KB) did not reach the tool intact; the rifles went one or two per call.
3. **`/alive/guns` is a new open route.** The brief asks for it; it is added to `CLAUDE.md`'s gate list and holds no figure of any gun.
4. **The report's link on the card points at the report's place on `main`**, which answers once the notes-only pull request merges (`CLAUDE.md`, "Field reports", puts the report in that pull request, after the deploy).
5. Existing tests that built a test record by changing its `id` now also change its `fields.gameId` (`test/guns.test.js`, `test/day.test.js`), since the game keys rifles by `gameId`.
6. **Verify's last item, the production Deploy's "where the guns came from" line and its read time beside the 5-second limit, is recorded after the deploy, not in this version.** The deploy runs only after Dan's yes, which is asked only after this report's result check passes, so the line cannot exist while this report is checked. After the deploy it is quoted word for word, with its read time beside the limit, in this report's "Verify results" as it goes to `main` in the notes-only pull request and in the card's close-out note. If it says the set fell back to the file, the cause is found from its reason (the Spine's door not deployed, the two apps not on one Fly private network, or a record refused) and named, with the lasting fix, as an ask with a recommended answer before that version is final.
7. **The new tests' passphrase is made fresh each run** (`crypto.randomBytes`), after the result check found a fixed passphrase in a test line; the older tests' fixed test passphrase is left as it was (not this session's change).

## Verify results

- `npm ci` and `npm test` on a clean checkout before any change: 153 tests, 86 pass, 0 fail, 67 skipped (the browser tests; this machine has no Playwright browser, and the Checks workflow runs them).
- After: 164 tests (11 new: 4 in `test/guns.test.js`, 7 in `test/spine-guns.test.js`), 97 pass, 0 fail, the same 67 skipped.
- Screenshot states: unchanged in number, since no screen changes and `scripts/screenshots.mjs` is untouched (113 states, range-day-fourteen's count).
- Pull request checks: Checks run 214 ([45716936141](https://github.com/isleofdan/range-day/actions/runs/45716936141)) on `70ce6bd`, success, 22:53 to 23:16 UTC (every test group and screenshot shard, the browser tests included). The head is now `a2fc8e2` (the test passphrase); its Checks run is named in the close-out note, and the merge waits for it to be green.
- `node --test test/spine-guns.test.js` on `a2fc8e2`: 7 tests, 7 pass.
- The twelve records read back as in "What stands".
- **Result check:** two runs gave findings about this report and one test line (jobs `20261125-231829-ac717d` on event 3049, `20261125-231948-2f4d84` on event 3051); every finding is answered in this version: the result check's outcome is stated here, the production Deploy line is named as divergence 6, and the test passphrase is now made fresh each run (commit `a2fc8e2`). This version goes back to the check.
- **The production Deploy's "where the guns came from" line** (Deploy run 25, step "Say where the guns came from", no warning):

  ```
  guns from the Spine: 12 records, 7 in the game, 5 not modeled · read in 2581 ms (limit 5000 ms) at 2026-11-25T23:39:38Z · differs from data/rifles.json: none
  ```

  The Spine was the source; twelve records, seven in the game, five not modeled; no rifle's figures differ from `data/rifles.json`, which is the by-code read-back divergence 1 promised. The one request kind, this read, took **2,581 ms against its 5,000 ms limit**: about half the limit, on the first read after the machine started (the alive line says it started at 23:39:38Z, the same second). Likely cause, not checked from here: the first connection's cost across Dan's private network (the name lookup and the connection to the Spine's machine, which may itself have been waking). If a later start ever goes past the limit, the game takes `data/rifles.json` with the reason and picks the Spine's set up on the next 10-minute read, so no player sees a fault; `/alive/guns` and the status page show it. No change is recommended until a slower read is seen.
- **Merge and deploy:** Dan's line, typed in this session: "yes, merge and deploy range-day-fifteen, then merge its notes". The result check had not passed (divergence 6: its standing item was this line itself); Dan said yes knowing that.

## Asks

None. The merge and deploy were asked and answered; the line above closes the last verify item.

## What the next session needs

- The live game reads its rifles from the Spine (Deploy run 25's line above). A change to a rifle's figures goes in `data/rifles.json` and its Spine record in the same session (`CLAUDE.md`), then `/alive/guns` after the deploy must show no difference.
- The next work, each planned by a Personal Shipyard chat: the workbench; pistols in the game and their targets (their records now exist, with no `game` section); the .22's own scope. The picture work stays paused and the plate flicker set aside, on Dan's word.

## For other sessions

**The gun record.** A gun record is the Spine record of type `gun`: `{ id, name, fields: { gameId?, kind, caliber, whose, game?, notes? } }`. `kind` is `rifle` or `pistol`; `caliber` a string, or `null` when Dan has not said; `whose` is `"Dan's"`; `notes` optional words. `game`, when present, is the game's figures for the gun, field for field one entry of Range Day's `data/rifles.json` less its name, and then `gameId` is required: the rifle's id in that file, by which the game keys the rifle and every saved zero, shot log and day. The record's own `id` is the Spine's, a hash of its type and name. A record without `game` is a gun the game does not model; Range Day skips and counts it.

**Changing a rifle's figures.** A change to a rifle's figures is made in `data/rifles.json`, where the checks prove it, and, in the same session, written to that gun's Spine record with `import_records`, after reading the record with `list_records` and changing only its `game` section, keeping every other field (`npm run gun-records` prints the section as the file makes it). After the deploy, `/alive/guns` must show "differs from data/rifles.json: none".

## Closing message to Dan

The game on your phone looks the same, but it now reads its rifles from your gun records in the Spine. The deploy confirmed it: twelve guns read, seven in the game, and the figures match the game's own file exactly. You can see the records at https://spine-dan.fly.dev/?type=gun. Please don't change a rifle's game figures there; those go through a session.

Needed from you: nothing to decide. The next work (the workbench, pistols in the game, the .22's own scope) starts when you open it.
