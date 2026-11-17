# Plan

## Decisions (range-day-one, 16 Nov 2026)

- **Crash reporting is off for now.** The Sentry token that `docs/NEW-APP.md`
  step 4 needs (`/data/home/dan/.config/sentry/auth-token`) lives on the
  rented Linux machine only, and this app was built in a cloud session on
  Dan's instruction. `SENTRY_DSN` in `fly.toml` stays empty, so nothing is
  sent. Turning it on is an ask for the origin chat: a later session on the
  machine follows step 4.

- **One engine, in `public/engine.js`,** loaded by the pages as a script and
  by the tests as a module, so there is one set of maths. Fourth-order
  Runge-Kutta at 1 ms steps; ICAO standard air for the drag coefficients
  (the convention the makers' own tables follow, as the two reference
  checks show).
- **The data file is the only place a number lives**, each figure with its
  source and the date read or an estimate with its basis; `lib/data.js`
  refuses a bare number. This session read maker pages through the search
  engine's indexed text, because the cloud session's network allows web
  search but no page fetches; every source note says so.
- **Drag tables** come from the open-source py-ballisticcalc library's copy
  of the standard G1 and G7 functions, at a named commit, because
  jbmballistics.com could not be reached; the engine is checked against
  two makers' published tables to confirm them.
- **Sellier & Bellot's 174 gr 7.62x54R load uses its G7 figure** (0.240),
  because the maker's own drop table follows it to 1,000 m within 0.06
  MOA, while their G1 figure (0.477) only matches to about 700 m.
- **The Vepr's barrel is 20.5 in** in the data: the importer lists the
  thumbhole-stock model with 16.5, 20.5 and 23.2 in barrels and the brief
  describes a long barrel of about 18 in; the nearest listed length is
  used, marked an estimate.
- **A rifle needs zeroing because of its own offset** (`boreOffsetMoa` in
  `data/rifles.json`, a fixed estimate per rifle), not because of a random
  draw: so a saved zero means something and tests can repeat it.
- **Two courses, two pairings:** the canyon course (modeled on California
  Tactical Academy, Piru; steel 200 to 1,000 yards, the far plates up a
  slope set by one value, `farPlateRiseFt` = 200) with the Vepr and the
  UTG scope; the rifle line (modeled on Angeles Shooting Ranges, Sylmar;
  steel 100 to 600, level) with the AR-15 and iron sights. The other five
  rifles, the red dots, the magnifier and the drop reticle are in the data
  for later sessions.
- **The home page keeps the line "This is Range Day"**, because the kit's
  Deploy workflow greps the signed-in page for it.

## Decisions inherited from the kit (starting-kit-one, 2 Oct 2026)

- **What the kit is.** A floor, not a framework: the smallest folder that
  carries a sign-in page, a deploy, a status page, the notes files and the
  reports folder. Every new app of Dan's is copied from it.
- **Stack.** The one the three live apps share (`isleofdan/miwa-english`,
  `isleofdan/hebrew-reader`, `isleofdan/french-ear`): one plain Node 22
  server, plain HTML and CSS, no build step, no web framework, a
  `node:22-slim` Docker image, one Fly machine in Tokyo (`nrt`). The
  only runtime dependencies are the two Sentry packages (`@sentry/node`,
  `@sentry/browser`, crash reporting, kit-crash-one); Playwright only for
  screenshots.
- **The app's name** lives in `app.json` (`name`, `title`) and nowhere else.
  The Fly app is `<name>-dan`. The cookie's name comes from it too.
- **Gate.** One passphrase (`APP_PASSWORD`), a signed 30-day cookie
  (`COOKIE_SECRET`), spaces and line breaks at either end ignored, five
  wrong tries lock that address for 15 minutes. Fail closed when either is
  unset. Never HTTP basic auth.
- **Deploy.** By hand only (Actions tab, "Deploy"). Creates the app if
  missing; sets `APP_PASSWORD` from the repository secret every run; makes
  `COOKIE_SECRET` once and keeps it; one machine, `shared-cpu-1x`, 256 MB,
  always on. Then proves itself: `/alive` answers, and signing in through
  the form reaches the sample screen.
- **No database in the kit.** The kit stores nothing. An app that keeps
  records adds SQLite on a volume exactly as the three apps do
  (`docs/NEW-APP.md`, "When the app keeps records").
- **Pull-only.** Nothing pushes at Dan: no notifications, reminders,
  streaks, badges, daily goals.

## Close-out notes

(Each session appends its own, in order.)

### range-day-four — 17 Nov 2026 (the same cloud session, on Dan's words in it)

- **Stands:** the box no longer ends the day, pull request #8 (branch
  `claude/range-day-card-brief-g7vyih`, restarted from `main`): when the
  box at the steel empties the firing line stays and offers "Open another
  box", which adds a box to the same day (`box.opened` counts them; the
  day's page says "2 boxes of 20 for the steel"); the zero bench fires
  from its own zeroing supply per rifle and load
  (`supply:<rifle>:<load>`), kept from one day to the next, with its own
  "Open another box"; a day ends by Pack up, or by itself when the app is
  next opened on a later date (`endedBy: "left"`). Nothing moves the
  player off a screen on a timer. 85 tests, 37 screenshot states, Checks
  green. Report: `docs/reports/range-day-four-report.md`.
- **Decided:** Dan's rule replaces range-day-three's "when the last round
  is fired the day is over" ("I seem to keep getting thrown out of zero
  bench in the middle of working there"; "give me a separate supply for
  zeroing, since one doesn't typically need to do an entirely new zeroing
  each visit to the range"); the supply starts as one box of the load and
  is not in the copy file; "Open another box" sits under the message that
  the box is empty, on both screens.
- **Next session needs:** unchanged from range-day-three; the supply is
  one more record for the gun-record build.

### range-day-three — 17 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** the day and the book, pull request #6 (branch
  `claude/range-day-card-brief-g7vyih`): a day at the range is one course,
  one rifle, one load and one box (each load's `boxCount`, sourced), on a
  day drawn by month and time of day from `data/weather.json` (twelve
  months per course from Santa Clarita's and Fillmore's published
  figures; morning, midday, afternoon; a Santa Ana day with its monthly
  chance), kept on the device and resumed, ended when the box empties or
  by "Pack up" (reversed by "Back to the range"), kept with every shot
  and shown on `/day`; the data book (`/book`): one line per hit on
  steel, by itself, grouped by distance with the come-up from the saved
  zero, strike-out, notes, the span line, the book line under the sight
  setting on the firing line, "Save a copy" and "Load a copy"; the wind
  call, written into each shot's row; the cold-bore record; muzzle speed
  following the day's temperature (one figure in `data/physics.json`,
  applied in one place in the engine); the gun-record seam (`lib/guns.js`:
  `fromRecords`, `fromFiles`, `load`, `GUN_RECORDS_FILE`); no screen names
  a rifle by its id. 85 tests, 36 screenshot states at both sizes, Checks
  green. `docs/RECORDS.md` lists every record the app keeps. Merged as
  `e0848d7` on Dan's typed line after nine result checks (eight rounds of
  findings, each fixed; the ninth PASS, job 20261117-141137-618b20) and
  deployed by Deploy run 44102133656 (green, 102 s). Production rendering
  is unverified from the session (its proxy refuses the address with
  "CONNECT tunnel failed, response 403"); the Deploy run's alive check and
  the Checks run are the proof until Dan's phone is.
- **Decided:** one load per day, so the bench and the line have no load
  select (the load is named in the day block); a finished day is
  finished: the line opened again starts a new day with the same picks;
  a day with no shot leaves no record and is replaced by another choice;
  an open day with shots wins over an address and says so; a new device
  opens the first playable rifle in the set (the AR-15; the brief's rule);
  the muzzle-speed figure is 1 fps per degree F from 70 F for every load,
  an estimate until a maker publishes one; the Santa Ana day's chance,
  wind, humidity and warmth are from published counts and the National
  Weather Service's scale; the time-of-day wind shares are estimates
  (neither site publishes an hourly climatology); home's doors carry the
  month and time of day; the copy file's lines carry their rifle, sight
  and load beside the `measured` names; sight ids left the screens too
  (`aimWanderFactor`, `frontBead` in the data).
- **Next session needs:** the gun-record build (the names in the report's
  "For the gun-record build"); the look at the deployed app from a session
  that can open range-day-dan.fly.dev; photographs of the ranges; the
  re-read of the maker pages; crash reporting from the Linux machine
  (unchanged). Report: `docs/reports/range-day-three-report.md`.

### range-day-two — 17 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** all seven rifles playable and every sight drawn, merged into
  `main` by pull request #3 on Dan's typed line (squash commit 880454e)
  and deployed by Deploy run 44047985012 (green, 66 s): a zero and a shot
  log per rifle, sight and load, with records in the old per-rifle form
  read forward and left in place; home picking rifle, sight, load and
  course on their own, remembering the last choice per rifle; the red
  dot, the magnifier that flips in behind it, the 3x drop reticle, the
  notch sights with their sliding leaf, the .22's open sights and the
  Tavor's folding sights, each drawn from the data's angles; knobs that
  repeat when held, with a coarse whole-minute pair and the setting
  always under the view; the dust at its real size; each plate on its own
  berm at its own height, placed by angle, with a yardage board, hazier
  with distance. 63 tests, 23 screenshot states at both sizes, five
  makers' tables matched. Production rendering is unverified from the
  session (its proxy refuses the address); the Deploy run and the Checks
  run on GitHub are the evidence.
- **Decided:** the Tavor dot sits 3.89 in over the bore (the top of the
  sources' band, the height that puts the 50-yard zero's second crossing
  with M193 at 299 yd, nearest Dan's remembered zero); each rear leaf's
  angles are derived by the engine from the military ball load its scale
  was cut for (M43, 7N6, LPS) and marked derived; the transonic and
  subsonic spread factors apply only to a bullet that left the barrel
  above Mach 1.2; every size a drawing needs (the dust, the berms, the
  yardage boards, the brush, the notch and reticle widths) lives in the
  data as an estimate with its basis, because the result checks held the
  brief's rule to the drawing too; each rifle has a `defaultSight` (the
  Vepr's scope, the others' irons) that an address without a sight still
  opens; one value for the whole slope (`farPlateRiseFt`) is replaced by a
  height per plate, the 1,000-yard plate staying 200 ft up; on a screen
  1,100 px or wider the Steady/Fire bar stands beside the view.
- **Next session needs:** the look at the deployed app from a session
  that can open range-day-dan.fly.dev; the re-read of every maker page
  from a session that can fetch pages; photographs of the two ranges to
  set each plate's height and place; crash reporting from the Linux
  machine (unchanged). Report:
  `docs/reports/range-day-two-report.md`.

### range-day-one — 17 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** the app made from the kit, merged into `main` by pull
  request #1 on Dan's typed line: the sourced data file (7 rifles, 16
  loads, 10 sights, two courses, weather, the G1 and G7 tables), one
  physics engine checked against Sellier & Bellot's and Federal's
  published tables, the home, zero bench and firing line screens, 45
  tests and the screenshot run at both sizes. The Deploy workflow was
  run once and stopped at "Create the app if it does not exist": Fly
  answered 401 Unauthorized to the stored `FLY_API_TOKEN`. Nothing is
  deployed; production rendering is unverified.
- **Decided:** see "Decisions (range-day-one)" above: one engine, every
  figure sourced or an estimate, G7 for the S&B match load, the Vepr at
  20.5 in, a fixed offset per rifle, two courses and two pairings, the
  home page keeps "This is Range Day". From the result checks: a load
  change never moves the sight (a button restores a saved zero); a
  refused storage read or write says "not saved on this device"; one aim
  state is drawn and fired.
- **Next session needs:** a valid `FLY_API_TOKEN` (an org token for the
  personal org) in the repository's secrets, then one Deploy run on
  `main` and the look at the deployed app; the rest is in
  `docs/reports/range-day-one-report.md`, "What the next session needs".

### starting-kit-one — 2 Oct 2026

- **Stands:** the kit, built and proven on a computer in a cloud session:
  sign-in page (30-day cookie, spaces ignored, rate limited), sample screen,
  status page with the alive line and the last outside error, 8 checks
  passing, screenshots at 412×915 and 1280×800 signing in through the form,
  the deploy and remove workflows (their proof steps run against a local
  copy), and `docs/NEW-APP.md`, followed literally to make a working
  `proof-app`. Not yet proven: the deploy on Fly (the first run after the
  merge; the Docker image is first built there, as this sandbox has no
  Docker daemon).
- **Decided:** the shared stack of the three apps with no database and no
  runtime dependencies; the app's name only in `app.json`; deploy by hand
  only; one `shared-cpu-1x` 256 MB machine; `main` created on GitHub from a
  one-file base commit, because the repository was empty and the work
  branch could not be merged into a branch that did not exist.
- **Next session needs:** the repository's default branch set to `main` and
  the repository marked as a template (both are settings this cloud
  session's proxy refuses: https://github.com/isleofdan/starting-kit/settings).
  Until the default is `main`, `docs/NEW-APP.md` clones `--branch main`
  explicitly.

### kit-checks-one — 2 Oct 2026

- **Stands:** checks and permission rules in the kit, so every app copied
  from it gets both. `npm run check` runs syntax (`node --check`), tests
  and screenshots in order and ends with a one-line verdict naming what
  failed. Syntax and tests (about 1.2 s on the rented Linux machine) run by
  themselves after every edit an agent makes (a Claude Code hook in
  `.claude/settings.json`); everything runs on every push and pull request
  (the "Checks" workflow). `.claude/settings.json` also holds the rules for
  what an agent may and may not touch, and `CLAUDE.md` says the same in
  words. `docs/CHECKS.md` says what runs when, with measured times.
  `docs/NEW-APP.md` says a new app inherits both, which lines narrow for a
  real audience, and how an older app adopts them. Proven on a scratch
  `proof-app`: a broken test fails the check by name; the hook fired by
  itself after an edit and showed the failure to the session; `flyctl
  deploy` and `git push origin main` were refused.
- **Decided:** the default rules: an agent may edit, run checks, commit,
  push its own branch and open a pull request; it asks before merging,
  starting a workflow, or a direct GitHub request; it never runs `fly`,
  publishes to npm, pushes to `main`, deletes branches, or changes
  repository secrets or settings. Screenshots are skipped, and said so,
  where a machine has no browser; in GitHub Actions that is a failure.
- **Next session needs:** see `docs/reports/kit-checks-one-report.md`,
  "What the next session needs".

### the-sign-one — 1 Oct 2026

- **Stands:** `SIGN.md` at the kit's root: Dan's one-page statement of
  what his software shop is for, copied byte for byte from the brief on
  the wall card `the-sign`. `README.md` and `CLAUDE.md` each gained one
  line pointing to it. Because the copy step in `docs/NEW-APP.md` copies
  the whole kit, every new app carries `SIGN.md` without further steps.
- **Decided:** the sign is Dan's text and is never edited by a session;
  apps that already exist pick it up only when Dan wants it there.
- **Next session needs:** nothing from this one. See
  `docs/reports/the-sign-one-report.md`.

### checks-stall-one — 2 Oct 2026

- **Stands:** the "Checks" workflow installs Chromium without
  `--with-deps`; the first run on the branch was green in 21 s with all
  three checks.
- **Decided:** the stall was never about `main`: `--with-deps` downloaded
  ~32 MB of fonts from Ubuntu's mirror, which crawled on some runners,
  pull-request runs included. Dropped rather than cached.
- **Next session needs:** see `docs/reports/checks-stall-one-report.md`
  (the runner image moves to Ubuntu 26 from 19 Oct 2026).

### audit-kit-fixes — 7 Oct 2026

- **Stands:** fixes 3, 14 and 15 of the production-system audit are in the
  kit's rules and checks text: fix 3 in `CLAUDE.md` ("Field reports"),
  fixes 14 and 15 in `docs/CHECKS.md` ("What runs when", "The checks"),
  each copied word for word from the audit. They wait for the last-merge
  session to merge the pull request.
- **Decided:** one commit per fix; nothing else in the kit changed.
- **Next session needs:** the pull request, which the supervising session
  opens.

## Close-out: installable-by-default — 2026-10-23 (cloud, from the Personal Shipyard thread "Phone install for Spine and all web apps")

Dan, 23 Oct 2026: "I want all web apps we create in all Claude projects to be installable as Chrome phone apps by default, except when there's a reason they shouldn't be made as such." The kit now carries it, so every app copied from it starts installable: `/manifest.webmanifest` (from `app.json`'s title, `id` and `start_url` `/`, standalone), `public/sw.js` (keeps nothing; the app is the live site), `public/install.js`, two placeholder icons; all five open without the cookie, as Chrome fetches them without it. Every screen carries the four head lines. Rule in `CLAUDE.md` (Building) and `docs/NEW-APP.md` step 3 (replace the icons). Pattern from isleofdan/kanji-study kanji-three. Proof: `npm test` 10 pass (two new); Chrome's `Page.getInstallabilityErrors` empty on `/` after signing in through the form, in a non-incognito profile. Report: `docs/reports/installable-by-default-report.md`.

**Lesson added, same day (install scopes).** `CLAUDE.md` now says one installed app per scope: Chrome on Android treats a page inside an installed app's scope as already installed, so several apps from one site each get their own page as `scope`, only the page at `/` keeps `/`, and it is installed last. Origin: Spine pull requests #28 and #29. Dan: "Capture as a generic lesson to apply across all projects when making Chrome apps to install to prevent this problem."

**Lesson corrected, same day.** The "one installed app per scope" rule above was wrong: separate scopes did not let a second page of Spine install on Dan's phone. `CLAUDE.md` now says one site is one installed app, extra icons are manifest `shortcuts`, a truly separate app needs its own origin, and browser-install claims come from a cited doc or a phone test, never memory.


## Close-out: kit-crash-one — 2026-10-26 (agent-machine-dan, OpenRig team, from the Personal Shipyard toolkit thread)

Every app made from the kit now reports its own crashes to Sentry, switched on only by a `SENTRY_DSN` in `fly.toml` (empty in the kit, so the kit and `npm test` send nothing); Sentry calls the Spine, which files one Wall card per issue. Server: `lib/crash.js`; browser: committed `public/sentry.min.js` plus `public/crash.js`; test route `POST /crash-test`; deploy step "Check a crash reaches Sentry". **Decided:** the scrub is a keep-list (only the error, how it was caught and its code location leave the app), with Sentry 11's `dataCollection` off and six gathering integrations skipped, because the checker found the reader's recipe sending five source lines per frame and machine data. The two Sentry packages are the kit's only runtime dependencies. Tests 10 → 21. **Next session needs:** this pull request merged; the first app made from the kit follows `docs/NEW-APP.md` step 4 for its DSN. Report: `docs/reports/kit-crash-one-report.md`.

## Local draft: model-neutral-policy - 2026-10-30
Verified native ChatGPT/Codex cloud is the proposed default for new suitable coding work, with specific exceptions, independent review and safe handoff. Claude/OpenRig remains available; authorization and privacy rules stay binding. Local-only draft; semantic reviewer replay and independent review pending. See docs/reports/model-neutral-policy-report.md. Nothing merged, installed or deployed.

Local independent-review correction: output-schema/PR-head evidence and secure
secret handoff tightened; 128 offline checks pass, 17 semantic cases prepared.
Rollout remains blocked on companion Spine compatibility and native instruction
loading/enforcement validation. No publication or live changes.

## Local companion preparation - 2026-10-30
Native-mode Spine compatibility and explicit root AGENTS.md entries are prepared
locally. Real-code loopback contract tests pass; native runtime enforcement and
semantic reviewer tests remain separate validation steps. No live changes.

## Local preparation: Checks runner compatibility - 2026-10-30
Pin Checks to ubuntu-24.04 after verifying the latest successful run used 24.04 and the unchanged Playwright 1.56.1 rejects the new 26.04 runner. Tests, dependencies and triggers remain unchanged. Local assertions pass; new hosted validation and publication remain pending independent review and confirmed scope. See docs/reports/checks-runner-compatibility-report.md. No merge, deployment or restart.
