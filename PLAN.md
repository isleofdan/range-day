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

### range-day-seven — 19 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** three stacked pull requests. Change A (#16, into `main`): the
  picture file `public/scene.min.js` is built from `src/scene/` wherever it
  is needed (`npm test`, `npm run screenshots`, `npm run check`, `npm run
  dev`, the Deploy workflow, the `Dockerfile`'s first stage, whose second
  stage copies it in and fails if it is missing), written whole and renamed
  into place; the check runs in pieces side by side, nothing dropped
  (`scripts/check.mjs`: six test groups, `test/scene.test.js` in three by
  test name, and four screenshot shards, `scripts/screenshots.mjs --shard`),
  each piece its own job on GitHub's runner, which keeps Playwright's
  browser between runs; the whole run took 6 min 50 s on the runner against
  31 to 60 minutes before, so the job limit is 14 minutes; the deploy proves
  `/scene.min.js` answers signed in with more than 300,000 bytes. Change B
  (#17, into A): the stored picture file leaves the repository and joins
  `.gitignore`. Change C (#18, into B): every board's two posts and every
  plate's post stand clear behind what they hold by a figure in
  `data/look.json` (`depth`: the camera's near and far, now read from the
  data; 24 bits; four depth steps at the farthest row, 6.5 cm, and the
  farthest plate, 40 cm), so the dark posts no longer show through the white
  boards in flickering dots (Dan's phone, 19 Nov 2026); proven by a
  geometry test that fails on `main`, a dark-column test through the scope
  over twelve frames on every board row (whole columns dark at 400 yards
  before, none after), and
  one new screenshot state (the boards at 7x). 101 tests, 52 screenshot
  states. Report: `docs/reports/range-day-seven-report.md`.
- **Decided:** the Checks workflow runs on pull requests and pushes to
  `main`, not on every branch push (the pull request's run checked the same
  commit a second time before); two screenshot states press their knobs
  from inside the page (a Playwright click waited for two steady frames,
  seconds each under the software-drawn picture: 41 presses took 10 minutes
  on the runner) and `line-shot-log` fires its own shot (it leaned on a miss
  an earlier state had left, which a shard running alone has not); the
  sideways-scroll test waits for the firing line's script before reading the
  width; `test/scene.test.js` is cut by test name, not into files; the
  camera's near and far planes live in `data/look.json` because the posts'
  stand-off is worked out from them; the stand-off is four depth steps (two
  so the surfaces never round together, two for a pixel's samples).
- **Next session needs:** the ground redone with photographed surfaces;
  the firing line's text and controls; the iron sights; each planned by a
  Personal Shipyard chat. The after-every-edit hook cannot run this app's
  tests in 30 s (`npm run test:fast`, a small build). The firing line's
  canvas is 400 px wide until its script fits it (a CSS cap would end the
  moment of sideways scroll on a slow phone). For the starting kit: the
  notes-only skip, the pieces-side-by-side check and the browser cache
  belong in its workflow too. The look at the deployed boards on Dan's phone.

### range-day-six — 19 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** the canyon course's picture reads closer to a photograph of
  the place, pull request #12 (branch `range-day-six`): every pixel of
  a hillside is lit from the survey's own slopes (a normal map built from
  the 1 m heights, and from the 10 m heights beyond), so gullies, ribs and
  terraces show in the light and in shadow; the ground is sorted, pixel by
  pixel, into packed dirt, grass, scrub, bare rock and loose scree by the
  slope's steepness, the photograph's colour and the season; surface
  detail made in code (clumps, stones, rills, clods, grains, blades) is
  laid over the ground at three scales fixed to the ground, each scale
  fading out once a screen pixel covers many of its texels, so a stronger
  glass later still finds detail; the photograph is never magnified past
  its own pixels; where the sun's ray clears the ground is recorded in
  metres, so the edge of shade is clean; creases are darker; the air pales
  and blues things by their true distance and brightens toward the sun
  (in the last pass, from the depth); the brush is chaparral of three
  kinds, lit on one side and shaded on the other, each with its soft
  shadow, with grass tufts and stones on the floor inside 150 yards; the
  plates are worn steel on heaped mounds, the boards weathered on frames,
  the shelter has its corrugated roof and slab. The scene is drawn in
  linear light to a half-float texture with multisampled edges on Full,
  and the last pass applies the camera's exposure and ACES tone curve (the
  scene used to be drawn clipped into an 8-bit texture with no tone curve,
  which was most of the washed, flat look); through the scope the middle
  keeps its contrast and colour; the iron sights are out-of-focus dark
  steel with a sheen, the post's faces lit and shaded; the dot has its
  housing edge and tint. Every sight's angles are unchanged (verify 4
  measures them off the canvas). `scripts/picture-measure.mjs` reads the
  picture's sharpness, patch colours and frame time in a real browser;
  `docs/reports/picture-before.txt` and `picture-after.txt` are its
  readings. 99 tests, 51 screenshot states. The result check could not pass: the checker reads the pull request's diff cut at 400,000 bytes, and the committed 600 KB picture bundle fills it before the source files; stopping committing the bundle is a small build of its own. The Checks job's limit was raised to 60 minutes in pull request #13 on Dan's yes, after the runner cut #12's run at 25; the repeated run passed in 59 minutes, so the check must be made lighter before the next picture session.
- **Decided:** the sky's hue is pulled toward the season's measured sky
  colour (`skyTintShare` in `data/look.json`), because the physical sky
  model lit by a white sun draws a paler, greyer blue at 18 degrees up
  than the photographs show, and the Look check holds the sky to the
  measured colour; a face steeper than 45 degrees reads as rock or scree
  (38 made the grassy canyon walls rock); the photograph is sampled no
  finer than 3 of its pixels and the ground's sorting no finer than 6
  (its compression showed as blocks through 7x); a detail scale fades out
  past 12 texels a pixel; the ground mesh's rows always reach the far
  square's edge (on Light the old row count stopped the ground short of
  the 1,000-yard plate, which hung in the sky); no CC0 material scan was
  used: the detail is made in code, as the brief allows, because finding
  one needs a run of the Terrain workflow on GitHub's runner, which a
  session starts only on Dan's yes and the brief forbade routing to him;
  the Light picture keeps the same ground at half the relief's fineness,
  two detail scales, 1,200 bushes, no multisampling and no shadow map.
- **Next session needs:** the rifle line's own picture at the same
  quality (its berm, lane signs, pipe frames and beams, then
  `pictureReady`); the near targets with shootable paper together with the
  spotting scope; recording and playback; each planned by a Personal
  Shipyard chat. The look at the deployed picture on Dan's phone
  (production rendering is unverified from the cloud session). Report:
  `docs/reports/range-day-six-report.md`.

### range-day-five — 18 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** the canyon course's firing line is a 3D picture of the real
  place, pull request #10 (branch `ccr-f981108b-yg0v0x`): the ground
  from the USGS 1 m lidar survey (the 2024 "CA_LosAngeles_B23" dataset)
  and the hills beyond at 10 m, coloured from the USGS aerial photograph
  of 4 May 2022 re-tinted to the season's measured palette, fetched by the
  new Terrain workflow on GitHub's runner (`scripts/terrain/`, recorded
  file by file in `data/terrain.json`, 17.1 MB in `public/terrain/`, each
  name carrying its content hash, served with a one-year cache header);
  the sun from NOAA's formula for the day's month and time, the ground's
  own shadows from the heights, a shadow map for the boards, plates and
  roof; a physical sky hazier on a humid day; the red plates at their
  surveyed places on dirt mounds, chipped where hit; the numbered boards
  in their rows; the shelter's roof; brush where the photograph is dark
  with scrub, swaying with the wind; heat shimmer and the scope's glass.
  Three pictures, one setting (`picture`, on the device): Full, Light,
  Plain; the first visit counts frames for two seconds; a browser without
  3D shows Plain and says so. The one change to what a shot does: each
  course's `altitudeFt` and every plate's `riseFt` and `lateralYd` are
  surveyed now (canyon firing position 1,040 ft, was 850; the 1,000-yard
  plate 591 ft above the eye, was 200; rifle line 1,680 ft, was 1,500),
  from a firing position and bearing of fire read off the photograph.
  The rifle line keeps the Plain picture (`pictureReady` false: its own
  things are not drawn yet). 97 tests, 46 screenshot states. Merged as `b62d299` on Dan's typed line after three result checks (two rounds of findings, each fixed; the third PASS, job 20261118-200109-4d71ee) and deployed by Deploy run 44414949499 (green, 86 s). Production rendering is unverified from the session (its proxy refuses the address); the Deploy run's alive check and sign-in passed.
- **Decided:** the heights are fetched in 500-pixel tiles (one request
  for the whole square answered 502 and then an empty image); the plates
  at 500, 700 and 800 yards on the canyon course and 300, 500 and 600 on
  the rifle line stand sideways of the line of fire, on the nearest ground
  the firing position can see at their true distance, because the
  surveyed ground hides the line to them; the 10 km far square of heights
  was added beyond the brief's 2.5 km so the ridges behind the far plates
  are drawn; close-up detail is made in code (no CC0 scan source was
  reached through npm or the runner); the camera looks along (tan right,
  tan up, −1) so a plate sits where the plain drawing puts it to within
  0.07 px; the palette colours are albedo and the light's strength is a
  figure of the data, measured against the photographs' colours;
  `CLAUDE.md`'s drawings rule is amended as the brief ordered, with the
  quoted instruction's attribution kept as the brief's exact text (the
  brief check's third finding; `CLAUDE.md` already names the same person in
  its other rules, and the ownership rule is untouched); the knobs are
  untouched (the two older browser test files open the plain picture, since
  the test browser's software 3D starved a held knob's clock); the session
  went on after one auto-mode refusal of a compound command by doing its
  allowed parts one at a time, and says so in the report. Dan, after the
  report: the rifle line's picture is its own build; the colours stay as
  they are; the drawings rule keeps the brief's exact wording.
- **Next session needs:** the rifle line's own things (the long sand
  berm, the lane signs, the pipe target frames) before its `pictureReady`
  turns on; the gun-record build, planned by a Personal Shipyard chat; the look at the deployed picture on
  Dan's phone (production rendering is unverified from the cloud session);
  the Sentry DSN from the Linux machine (unchanged). Report:
  `docs/reports/range-day-five-report.md`.

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
  green. Merged as `44945f8` on Dan's typed line after one result check
  (PASS, job 20261117-145803-5234aa) and deployed by Deploy run
  44112027183 (green, 59 s). Production rendering is unverified from the
  session (its proxy refuses the address, "CONNECT tunnel failed,
  response 403"); the Deploy run's alive check passed. Report:
  `docs/reports/range-day-four-report.md`.
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

### range-day-eight — 20 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** pull request #20: the canyon course's ground takes its
  close-up surface from six CC0 material scans (Poly Haven
  dry_ground_rocks, withered_grass, rock_face_03, gravel_ground_01;
  ambientCG Grass001, Ground106), fetched by the one download run Dan
  allowed (Ground workflow run 44711714459; every candidate kept on the
  scratch branch `range-day-eight-fetch`), recorded in
  `data/terrain.json` (`surfaces`), laid by hex tiling at their own size
  and five times it, lit by the sun; `detailTextures` retired. The ground
  is placed from the firing position: its full map northing in a 32-bit
  float stepped every 0.25 m and smeared all fine pattern into the
  streaks Dan saw. Full is within the frame-time limit at 412 pixels;
  Light is over it through the irons (+42 to +45 percent); the bushes'
  colour patch and two February Light patches measure farther than
  before (report, verify 4).
- **Decided:** trilinear filtering only (anisotropic doubled the cost in
  the test browser); rough ground's own shade as a figure per kind of
  ground (`ground.sunCut`); Light reads colour only; the Checks jobs'
  limit is 28 minutes; the Ground workflow runs only on `…-fetch`
  branches, and any further download needs Dan's yes.
- **Next session needs:** Dan's look on his phone (the floor through the
  irons, a far hillside at 7x). Then, each planned by a Personal Shipyard
  chat: anisotropic filtering if the phone draws Full smoothly; a simpler
  Light path for its frame time; the firing line's text and controls; the
  iron sights; the rifle line's picture. Report:
  `docs/reports/range-day-eight-report.md`.

### range-day-nine — 20 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** pull request #22: the firing line arranged for shooting.
  On a phone, within reach without scrolling: a one-line summary (a tap
  opens the full description over the page), the plate with the sight's
  glass beside it, the view at its old size, where the last shot went in
  two lines (opens on a tap; "Open another box" beside it), the sight
  strip with every button 44 px or more and the rounds left, the book's
  newest line, then Steady and Fire. The wind call, notes, the day's links,
  the log and the settings are a scroll below. On a computer, a column
  beside the view. Nothing that opens or changes moves the view, the
  strip or the bar (measured 0 px). The picture and the shots are
  unchanged.
- **Decided:** the measure lives in `test/line-reach.js` and
  `scripts/line-layout.mjs`; `#setting-line` stays in the page, hidden on
  screen, for screen readers and the tests; the book's line shows the
  newest line only; the column beside the view starts at 1,100 px.
- **Next session needs:** Dan's look on his phone (is the book line above
  the bar on his screen?); "level, centered of center" in the result's
  words; then, each planned by a Personal Shipyard chat: the near targets
  with paper and the spotting scope; the sights Dan fitted; recording.
  The picture work stays paused on Dan's word. Report:
  `docs/reports/range-day-nine-report.md`.

### range-day-nine-b — 21 Nov 2026 (same session, from Dan's phone)

- **Stands:** pull request #24: the firing line fits a phone 830 pixels
  tall (Dan's own, from his screenshots). The rounds left are under the
  word Fire, each setting takes one line, the book line holds one line,
  and no third line peeks under it.
- **Decided:** the within-reach test holds 412×830 as well as 412×915;
  the text slots carry no vertical padding (tested).
- **Next session needs:** Dan's look again. At 412×760 the book line
  still falls under the bar; the next lever is the view's size on short
  screens, which only Dan can open (the picture work is paused).

### range-day-ten — 21 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** pull request #27: paper at 50 and 100 yards on both
  courses and a 12 × 18 in steel plate at 100 yards on the canyon
  (`data/courses.json`, `near`, placed on the survey by
  `scripts/place-near.mjs`); the paper is one drawing for every picture
  (`RD.drawPaper`: dark sheet, 1-inch grid, five aiming marks, a bright
  burst around each hole); a shot at paper answers from the nearest
  aiming mark, writes no book line, and the day's first one goes in the
  cold-bore record; every shot row says `target`; holes and steel marks
  are rebuilt from the open day; "Hang a fresh paper" and "Put the old
  paper back". The tripod spotting scope (`data/spotting.json`, 20–60x,
  the maker's field of view at both ends): beside the glass control, no
  reticle, a still view, a drag moves it; "Back to the rifle" replaces
  Steady and Fire in the bar. 118 tests, 81 screenshot states (111 and 73
  before). Merged as `dddb27c` on Dan's typed line after four result checks (seven findings fixed; one point, raised twice, conflicts with this file's notes order and was put to Dan as Ask 1, who kept the order) and deployed by Deploy run 44877510234 (green, 79 s; the picture file answered 200 with 617,204 bytes, sign-in 303, crash test 500).
- **Decided:** the near targets are their own list so the plates keep
  their indices; the scope's width between its ends follows a power of
  the magnification through both published figures; the picker's label
  is "Target"; the new browser tests run as their own check group
  (`near`); nothing goes in `scripts/terrain/` (a push touching it starts
  the Terrain workflow, which on this branch committed a
  `data/terrain.json` without the ground surfaces and deleted their 24
  photographs; reverted, Ask 2 of the report).
- **Next session needs:** Dan's look on his phone (the 50-yard paper, the
  scope at 20x and 60x, a far plate); the Terrain workflow made safe
  before anything touches `scripts/terrain/`; then, each planned by a
  Personal Shipyard chat: the sights Dan fitted and the Vepr's 3-9x
  scope; recording and playback. The picture work stays paused on Dan's
  word. Report: `docs/reports/range-day-ten-report.md`.

### range-day-ten-b — 21 Nov 2026 (same session, from Dan's phone)

- **Stands:** pull request #29, merged as `33ee1a6`, deployed by Deploy
  run 44885172332: the spotting scope's button stands at the right end of
  the short line's row, so the zoom sliders are not cramped (on a 412-px
  phone 120 and 107 px, were 70 and 57).
- **Decided:** the sliders' widths are held by `test/near.test.js`.
- **Next session needs:** Dan's three items, on the card: Ask 2 (the
  Terrain workflow keeps what it did not fetch), a more powerful spotting
  scope, the UTG scope's strength; each planned by a Personal Shipyard chat.

### range-day-ten-c — 21 Nov 2026 (same session, from Dan's phone)

- **Stands:** pull request #31, merged as `ed25048`, deployed by Deploy
  run 44887696828: on a phone both zoom sliders end at least 40 px from
  the screen's right edge, clear of Android's edge-swipe back gesture, and
  are longer (130 and 117 px, were 120 and 107).
- **Decided:** the gap and the lengths are held by `test/near.test.js`.
  The work is split between Claude (the real rifles' figures) and Codex
  (the picture): pull request #32, `CLAUDE.md` "Who works on what".
- **Next session needs:** the plate-flicker bug (on the card; Codex's
  side), with Dan's screen recording if he has sent one; Dan's items
  already on the card.

### range-day-eleven — 21 Nov 2026

- **Stands:** pull request #34, merged as `0793892` on Dan's typed line and deployed by Deploy run 44902508221 (green, 72 s; the alive line, sign-in through the form, the picture file and crash reporting all checked by the run): the ground-fetching
  workflows cannot delete what they did not fetch (Terrain starts only by
  hand, never on `main`; the fetch keeps every part and file it did not
  fetch, `scripts/terrain/keep.mjs`; both workflows stage by name without
  removals, and a guard refuses any staged deletion, naming it;
  `test/terrain-keep.test.js`). The Vepr carries its real scope, the UTG
  BugBuster 3-9x32 (SCP-M392AOLWQ: 1/4 MOA clicks, 120 each way, 37.7 to
  14 ft at 100 yards, the maker's figures); the 2-7x44 stays in the data,
  offered by no rifle. The spotting scope is 25-125x, modeled on the
  Barska Benchmark 25-125x88 (54 to 24 ft at 1,000 yards). 130 tests, 82
  screenshot states (121 and 81 before).
- **Decided:** the BugBuster carries the 2-7x44's zeros, settings, logs
  and book lines (same click, same height over the bore), so the Vepr
  needs no new zero; old records stay stored. A scope's view follows a
  power fitted through both published widths (the old proportional rule
  missed the 9x figure). The picture measures compared with a stored
  before-file keep their old view as a test view. The spotting scope's
  power stands under its word, keeping its slider 148 px on a phone.
- **Next session needs:** Dan's look on his phone (the BugBuster at 3x
  and 9x: a far plate is small at 9x, the maker's field of view; the
  spotting scope at 125x); then, each planned by a Personal Shipyard
  chat: the sights Dan fitted, with the reticle question (Ask 2);
  recording and playback. Codex's side: the plate flicker;
  `scripts/picture-measure.mjs` still names the 2-7x44. The picture work
  stays paused on Dan's word. Report:
  `docs/reports/range-day-eleven-report.md`.

### range-day-twelve — 21 Nov 2026 (cloud session, from the Wall card `range-day`)

- **Stands:** pull request #36, merged as `a7e1abc` on Dan's typed line and deployed by Deploy run 44919146708 (green, 62 s; the alive line, sign-in through the form and the picture file checked by the run): the sights fitted
  to the rifles, each figure in `data/sights.json` with its page or an
  estimate with its basis: the Troy folding BattleSights on the AR-15; the
  FAB Defense flip-ups and the SeeAll Open Sight (first generation,
  triangle, a new kind of sight) on both Tavors; the KNS 0.034 in ball post
  and KNS rear peep (no sliding leaf) on the 7.62x39 rifle; the ball post
  or the XS stripe post on the 5.45 rifle; the ball post on the Vepr's
  irons (same id). The BugBuster's dots stand at their true angle: the
  maker says second focal plane, true at 10x. `lib/data.js` checks each
  sight's kind. 137 tests, 93 screenshot states (130 and 82 before).
- **Decided:** records carry only where the new sight clicks alike and sits
  at the same height (the 5.45's ball post); the AR-15, both Tavors and the
  7.62x39 rifle start unzeroed, their old records kept and readable on the
  book page under the old name; a record from before any sight could be
  chosen follows the sight it was made with (`tookThePlaceOf`). One rear
  ring per sight (the large peep). `test/scene.test.js` changed in three
  places to read the new sights from the data.
- **Next session needs:** Dan's look on his phone, sight by sight; the
  AR-15's Troy front (two guards or a round hood: Ask 2); then, each
  planned by a Personal Shipyard chat: recording and playback, the BCM's
  magnified scope once Dan names it, the .22's Primary Arms CLx 1-6x24.
  Codex's side: the plate flicker; `scripts/picture-measure.mjs` still
  names the old scope. The picture work, the drawn sights' look included,
  stays paused on Dan's word. A cloud session must link Chromium for
  Playwright before a browser test's "passed" means anything. Report:
  `docs/reports/range-day-twelve-report.md`.

### range-day-twelve-b — 21 Nov 2026 (same session, on Dan's word)

- **Stands:** pull request #39 merged as `9241fe2`, deployed by Deploy run 44922340703 (green, 87 s): the Troy and FAB rear sights flip between their large and small peeps on the firing line, kept on the device, no shot moved. Pull request #38 (`cf8d38a`): a report's line for Dan to type must be a fenced block, checked by `test/report-shape.test.js`. 140 tests, 94 screenshot states.
- **Next session needs:** as range-day-twelve; Dan's look at the flip on his phone. Report addendum in `docs/reports/range-day-twelve-report.md`.

