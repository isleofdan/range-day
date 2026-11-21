# Range Day

A long-range target-shooting game for one player, on a phone or a
computer. It recreates shooting at steel plates from 100 to 1,000 yards
in dry, brown, brushy canyon hills, on two courses modeled on public
ranges north of Los Angeles. The realism is in the physics and the
sights, not in the graphics: every bullet is flown step by step through
one physics engine (gravity, drag from the standard G1 or G7 tables, the
range's air, wind in three stretches that gusts, a target above or below
the shooter by geometry, the sight's height, the load's spread), and the
player looks through the rifle's real sight, zeroes it on paper in real
clicks, then works out the drop and the wind for each distance himself.

## The screens

- **A day at the range** is one course, one rifle, one load and a box
  of that load for the steel (the box the maker sells it in, `boxCount` in
  `data/loads.json`), on a day drawn for a month and a time of day
  (morning, midday, afternoon) from `data/weather.json`: cool calm
  mornings, hot gusty afternoons, the seasons, and now and then a Santa
  Ana day in the cooler months. Going through either door on home starts
  the day; the weather is drawn once and kept for the whole day; every
  shot at steel comes out of the box, and when it is empty the screen
  stays and offers **Open another box**, which goes on with the same day;
  **Pack up** ends the day (reversible from the day's page until another
  day starts). The zero bench fires from its own **zeroing supply** per
  rifle and load, kept from one day to the next, with its own "Open
  another box"; nothing moves you off a screen by itself. The open day is
  kept on the device, so closing the app and coming back resumes it; a day
  left open is closed by itself when the app is next opened on a later
  date. The day is told
  in words and one number ("A cool November morning, 52 F"), never the
  wind. The finished day is kept with every shot and shown on **the day's
  page** (`/day`).
- **The data book** (`/book`): one page per rifle, sight and load, built
  only from the player's own hits on steel. Each hit writes one line by
  itself when the bullet lands: the date, the course, the distance, the
  sight's setting (clicks and minutes of angle, the leaf, the saved zero
  it was counted from), the hold, the day's temperature, the wind call
  and where on the plate it hit. A miss writes nothing; a shot fired with
  "Show the conditions" on writes nothing. Lines are grouped by distance,
  newest first, the come-up shown as minutes of angle from the saved
  zero; a line can be struck out and restored, and takes a note; one line
  per distance counts the span of his own unstruck settings and
  temperatures. On the firing line, one line under the sight setting
  shows the book for the plate chosen. "Save a copy" and "Load a copy"
  move the book, the cold-bore records, the days and the zeros between
  the phone and the computer as one file. The game still never gives the
  drop.
- **The cold-bore record**: the first shot of a day, when fired at a
  plate, is kept apart as a running record for that rifle and load, hit
  or miss; it sits at the top of the book page.
- **The wind call**: on the firing line the player states the wind as he
  reads it (left, right, none, or not called, and miles an hour) before
  he fires; the call is written into the shot's row and never changed.
  The game does not grade it.
- **Home** (`/`): pick the rifle (seven: an AR-15, a Tavor SAR, a Tavor
  X95, an AK-pattern rifle in 7.62x39, one in 5.45x39, a Molot Vepr in
  7.62x54R and a bolt-action .22), then the sight among the ones that
  rifle carries, the load and the course, each on its own. The rifle
  list says which rifles have a zero saved on this device; the zero line
  says where this rifle, sight and load stand ("not zeroed yet" sends
  you to the bench); **When** is the time of day and the month. The last
  choice on this device is picked when the page opens. While a day with
  shots is open, home shows that day first, with the doors back into it:
  the rifle, load and course are fixed, the sight can be changed. Two courses: the canyon course (steel every 100 yards from
  200 to 1,000, up the slope, and since range-day-ten paper at 50 and 100
  yards and a plate at 100) and the rifle line (100 to 600, up a gentle
  rise, and paper at 50 and 100).
- **Zero bench** (`/zero`): a 36-inch paper with a 1-inch grid at 25, 50,
  100 or 200 yards. Fire a group, read where it lands, turn the sight's
  elevation and windage in its real clicks (a press is one click, holding
  repeats, a second pair moves a whole minute of angle on the finer
  sights), fire again, press **Save this zero**. The zero is saved on the
  device for that rifle, sight and load. Changing the load keeps the
  sight where it is, so the group moves as it would in life.
- **Firing line** (`/line`): the view through the sight. On the canyon
  course the view is a 3D picture of the real place (below, "The
  picture"); on the rifle line it is still the flat drawing. A scope zooms
  across its real range with its mil-dot reticle (the Vepr's is its real UTG BugBuster 3-9x32 since range-day-eleven; the game modeled a 2-7x44 before; a scope's view is the maker's field of view at each end of its zoom, and between them a power of the magnification fitted through both); the 3x prism sight
  shows its drop reticle (chevron and hold marks, drawn from the data);
  the red dot is an unmagnified window with a 2 MOA dot, and on the Tavor
  SAR a magnifier flips in behind it; the iron sights show a ring and
  post, or a notch and post with a sliding rear leaf whose settings (in
  hundreds of meters) raise the bore by the derived angle. The plates
  stand on their own berms up the hillside, each with a yardage board,
  paler with distance. The aim wanders the way a rested rifle does; drag
  to hold off, hold **Steady**, press **Fire**. The bullet takes its real
  flight time; a miss throws a puff of dust of real size where it landed,
  a hit rings late by the flight time plus the sound's trip back. Recoil
  knocks the view off for a moment. No drop or wind figure is given: the
  wind shows only as heat shimmer leaning, brush moving and the dust's
  drift. A shot log lists each shot's distance, sight setting, leaf, hold
  and where it landed. One setting, off by default, **Show the
  conditions**, prints the true wind, temperature and the engine's drop,
  for learning.

  **Paper at 50 and 100 yards, and the spotting scope** (range-day-ten).
  Both courses have paper at 50 and 100 yards, and the canyon course a 12 ×
  18 inch steel plate at 100 yards; the target picker lists them first, as
  "50 yards (paper)", "100 yards (paper)" and "100 yards (12 × 18 in
  steel)". Each stands at its own place on the surveyed ground
  (`data/courses.json`, `near`; `scripts/place-near.mjs` works
  the places out): on the canyon the paper hangs on a board of the
  50-yard group and of the 100-yard row, where the picture already drew
  boards. The paper is the game's own drawing of a dark sight-in sheet: a
  1-inch grid, a center aiming mark and four smaller marks toward the
  corners; a bullet through it leaves its hole with a bright yellow burst
  around it (`data/look.json`, `paper`), drawn by one function for every
  picture. A shot at paper flies through the engine like any other; on the
  sheet it says where, in inches from the nearest aiming mark ("On paper
  at 50 yards, 1.2 in high, 0.4 in left from the center mark"); paper
  does not ring, writes no book line (the book holds hits on steel), and
  the day's first shot at paper still goes in the cold-bore record (hit
  meaning on the sheet). The holes on a sheet are that day's shots at it,
  rebuilt from the open day, so a reload loses none; **Hang a fresh
  paper**, a short scroll below and shown only for paper, clears the sheet
  from that moment (no shot is deleted), and its message offers **Put the
  old paper back**. **Spotting scope**, at the right end of the short line's row at the top (range-day-ten-b: beside the sight's glass control it cramped the zoom slider),
  turns the view to a tripod scope (25 to 125 power since range-day-eleven, modeled on the Barska Benchmark 25-125x88; 20 to 60 before; its field of view from
  the maker's page, `data/spotting.json`) pointed at the chosen target: no
  reticle, the view still, a drag moves it, its zoom in the glass control's
  place; the sight strip still turns the rifle's sight. Steady and Fire
  give way to **Back to the rifle** in the same place, so nothing is fired
  from the scope. It shows the day's holes on paper and the marks each hit
  left on steel, rebuilt from the day, and a shot still in the air lands
  in its view; it prints no group size, circle or caption. A hit within
  half an inch both ways now reads "dead on the center".

  **How the firing line is arranged** (range-day-nine). What a shooter
  needs between shots is within reach without scrolling; what is set
  before a shot, or read after a string, is a short scroll below. On a
  phone, from the top: one short line (the rifle, the load's weight, the
  course and the day, temperature first; a tap opens the full description
  over the page, a second tap closes it); the target picker with the
  sight's own glass beside it (the zoom, the magnifier, or the rear leaf)
  and **Spotting scope** at the right end of the short line above (on a
  phone the picker has a fixed width and the zoom sliders end 40 pixels in
  from the screen's edge, clear of Android's edge-swipe back gesture);
  the view, the same size as before; **where the last shot went**, held to
  two lines (a longer one is marked ▾ and opens over the page on a tap;
  "Open another box" stands beside it when the box is empty); **the sight
  strip**: elevation and windage, each named on its box's top edge, with
  its setting on one line, its two one-click buttons and its two 1 MOA
  buttons, every button at least 44 pixels tall; the book's newest line
  for this distance, on one line (▾ opens the rest of it; older lines are
  in the book, one tap on its link); then **Steady** and **Fire**, fixed
  at the bottom, the lowest and largest controls, with the rounds left
  under the word Fire (range-day-nine-b: so the list fits a phone 830
  pixels tall, the height of Dan's own). Below,
  in this order: the wind call, the cold-bore note, the zero note and "Set
  the sight to this load's saved zero", "The day" (the book, the day so
  far, Pack up), the shot log with "Clear the log", and the settings
  (Show the conditions, Picture). On a computer (1,100 pixels wide and
  over) the same list stands in a column beside the view, with Steady and
  Fire at the column's foot covering nothing. Nothing that opens or
  changes (a shot's result, the cold-bore note going, "Open another box",
  a folded part opened) moves the view, the strip or Steady and Fire, and
  the page never scrolls by itself. The setting's full sentence
  ("Elevation … · Windage …", with the leaf or the magnifier) is still in
  the page for screen readers, shown on screen by the strip's own figures.

One MOA is a minute of angle, 1/60 of a degree, about 1 inch at 100
yards; sights click in MOA.

## The picture

Since range-day-five the canyon course's firing line is drawn as a 3D
scene of the real range (`public/scene.min.js`, built from `src/scene/`
with the three library by `scripts/build-scene.mjs`): the ground is the
US Geological Survey's 1 m lidar survey of the place, coloured from the
USGS aerial photograph of May 2022 and re-tinted to the season's measured
colours (green from February to April, straw and tan from June to
November); the hills beyond come from the survey at 10 m; the sun stands
where NOAA's formula puts it for the middle day of the day's month at the
morning, midday or afternoon clock hour, the ground throws its own
shadows, and the sky is a physical model that goes hazy with the day's
humidity; the red plates stand at their surveyed places in front of dirt
mounds, chipped where they are hit and swinging on a hit; the white
numbered boards stand in their rows; brush stands where the photograph is
dark with scrub and sways with the wind; through a scope the picture is
round, with a soft warm rim, a little softness and bleached highlights;
heat shimmer grows with distance, temperature and magnification and leans
with the wind. `docs/LOOK.md` is what photographs of the two ranges
show, as words and measured colours; `data/look.json` holds the picture's
figures, each with its basis.

Since range-day-six the picture is drawn to read as a photograph of the
place as far as a phone browser can: every pixel of a hillside is lit from
the survey's own slopes (a normal map built from the 1 m heights, and
from the 10 m heights beyond), so gullies, ribs and terraces show in the
light and in shadow; the ground is sorted, pixel by pixel, into packed
dirt, grass, scrub, bare rock and loose scree by the slope's steepness,
the photograph's colour and the season, each with its own colour,
roughness and small relief; surface detail (made in code until
range-day-eight, photographed since: see below) is laid over the ground
fixed to the ground, so the 1,000-yard hillside through 7x shows texture
instead of blur and the floor at 50 yards shows gravel and tire tracks,
and a stronger glass later still finds detail; the photograph itself is
never magnified past its own pixels (its compression would show as
blocks). Where the sun's ray clears the ground is recorded in metres, so
the edge between sun and shade is clean; creases are darker; the air
pales and blues things with their true distance and brightens toward the
sun. The brush is chaparral of three kinds (low sage, taller chamise-like
shrubs, dry grass clumps), lit on the sun's side and shaded on the other,
each with its soft shadow on the ground, merging into the hillside's
texture at a distance; grass tufts and stones stand on the floor inside
150 yards. The plates are steel with worn edges and old chips, on heaped
dirt mounds; the boards are weathered, on frames, with paper targets and
holes; the shelter has its corrugated roof, posts, bench and slab. The
scene is drawn in linear light to a half-float texture (where the
browser has it) with edges smoothed by multisampling on Full, and the
last pass applies the camera's exposure and tone curve; through the
scope the middle of the picture keeps its contrast and colour, with
softness and a touch of colour fringe only toward the edge; the iron
sights are painted as out-of-focus dark steel with a sheen from the sky,
the front post sharper with a sunlit and a shaded face, their angles
unchanged. `scripts/picture-measure.mjs` measures the picture
(sharpness, the colours of named patches, the frame time) in a real
browser; `docs/reports/picture-before.txt` and `picture-after.txt` are
its readings before and after range-day-six.

Since range-day-eight the ground's close-up surface is photographed, not
drawn: each kind of ground (packed dirt on the floor, dry straw grass and
short green grass on the slopes, the bare soil and litter under the sage
scrub, the pale eroded rock of the headwall, the loose scree below it)
takes its colour pattern and its small relief from a material scan, a
photograph of a few metres of real ground with its bumps measured. Each
scan is laid so that no repeat shows (the ground is cut into small
triangles, each corner shifting the picture by its own random amount, the
three blended and leaning to the higher picture, so dirt shows between
tufts and stones stand out of grit), keeps the season's measured colour
(its own average colour is taken out and the palette's put in), and has
its bumps lit by the day's sun, with small hard shadows on Full. The
pictures load beside the first frames; until they arrive, or if one
fails, that kind of ground is drawn in its plain measured colour. The
ground is now placed from the firing position in metres instead of by its
full map coordinates, whose northing (about 3.8 million metres) a
graphics card holds only to a quarter of a metre: anything finer laid by
those coordinates was cut into quarter-metre steps north to south and
smeared into streaks.

Since range-day-seven the picture's script is built, not stored: the
repository holds `src/scene/` only, and `public/scene.min.js` is bundled
from it (0.2 s) by every path that serves or tests the app: `npm test`,
`npm run screenshots`, `npm run check`, `npm run dev`, the Deploy workflow
and the first stage of the `Dockerfile`, whose second stage copies the
built file into the image and fails if it is missing. The checks run in
pieces side by side, each its own job on GitHub's runner (`docs/CHECKS.md`).

Three pictures, one setting (under "Setting" on the firing line, kept on
the device): **Full**, **Light** (the same ground at half the relief's
fineness, the ground's photographed surfaces at half their size and
without their small shadows, fewer bushes, a smaller
photograph, no multisampling and no shadow map, for a slower phone) and
**Plain** (the flat drawing).
The first visit draws Full for two seconds and keeps Full or Light by how
fast the device drew it; a browser that cannot draw 3D shows Plain and
says so in one line. Under every picture the same course data goes to the
engine and a shot lands the same way; the scene draws each plate where
the flat drawing does, at the same angular scale, so the sight's marks
mean the same thing.

Where the ground comes from: `data/terrain.json` records, for each range,
the heights (USGS 3D Elevation Program, 1 m, the 2024 "CA_LosAngeles_B23"
lidar), the hills beyond (10 m), and the photograph (USGS NAIP, 0.6 m,
captured 4 May 2022), each with the exact request, the date fetched, the
data's own spacing and capture date, the license (US government work,
public domain) and the bytes; the files sit in `public/terrain/` under
names carrying their content hash and are served with a one-year cache
header, so a second visit downloads none of them. They are fetched by the
Terrain workflow (`.github/workflows/terrain.yml`, `scripts/terrain/`) on
GitHub's own runner, because a cloud session's network refuses the two
services; the workflow commits what it fetches to the branch that pushed.
Each course's firing position and bearing of fire were read off the
photograph (the long roofed shelter); each plate's height and sideways
place follow from the surveyed ground, on the line of fire where the
ground gives a clear line of sight, else on the nearest visible ground
sideways at its true distance (`data/courses.json` says which, and why).

Where the ground's surfaces come from: `data/terrain.json`, `surfaces`,
records the six material scans, each released under CC0 (a public-domain
dedication) by its library, Poly Haven or ambientCG, with the library's
license sentence as fetched, the scan's own page, the address and
checksum of every map downloaded, the date, the download run, every
candidate considered and why this one was chosen. They were fetched once,
by the Ground workflow (`.github/workflows/ground.yml`,
`scripts/ground/`) on GitHub's runner, which runs only on a push to a
scratch branch named `…-fetch` and commits what it fetches there
(`range-day-eight-fetch` keeps every candidate); the chosen ones were
resized and saved in the session as a colour picture and a relief picture
each, 1,024 pixels for Full and 512 for Light, in `public/terrain/` under
names carrying their content hash. Each scan's ground size is in
`data/look.json`, `ground.materials`.

## Where the numbers come from

`data/` holds every figure the game uses: each load's speed, drag figure,
drag model and box, each rifle's barrel length and sight height, each sight's
click value, dot size, reticle marks or leaf settings (each setting's
angle derived with the engine from the service load the leaf was cut
for), each course's firing position, bearing of fire and plates (distance,
size, surveyed height above the eye and surveyed place across the view),
the dust's size, the picture's figures (`data/look.json`), the surveyed
ground's records (`data/terrain.json`), the weather by course, month
and time of day, and how muzzle speed follows the temperature (one
figure, an estimate from the published rules of thumb, applied in one
place in the engine). Every figure carries the maker's page address and the
date it was read, or the word "estimate" and its basis. `lib/data.js`
refuses a bare number, and `npm test` runs that check over the whole
folder. The engine is `public/engine.js`; `test/engine.test.js` checks
it against five makers' own published trajectory tables (Sellier &
Bellot in 7.62x54R and 7.62x39, Federal in 5.56, Hornady in 5.45x39,
CCI in .22 LR).

Nothing in this repository says whose rifles these are; the rifle set is
described as a set of rifles, and the ranges appear as the public
businesses they are.

## Gun records

The game takes each rifle from a gun record (`lib/guns.js`): the `game`
section of a record is, field for field, one entry of `data/rifles.json`.
The server builds the rifle set from that file, or, when the environment
variable `GUN_RECORDS_FILE` names a JSON file of records, from that file;
a bad record is refused by name with the fault and the valid values.
Every record the app keeps on the device, the copy file and the gun
record's shape: `docs/RECORDS.md`.

## Status page

`/status` shows the "alive since" line (when this copy started and which
version of the code it runs) and the last error from anything outside
the app it called. The app calls nothing outside itself.

## Running it on a computer

    npm install
    APP_PASSWORD=try-me COOKIE_SECRET=any-long-text npm run dev

Then open http://localhost:8080 and sign in with `try-me`.
`npm start`, `npm run dev`, `npm test` and `npm run screenshots` each build
`public/scene.min.js` from `src/scene/` first (it is not stored in the
repository; `npm run build:scene` builds it by itself).
`npm run check` runs every check (the tests in six groups and the
screenshot states in four shards, two pieces at a time; the screenshots are
saved at both sizes into `docs/reports/screenshots/`).
They also run by themselves after every edit an agent makes and on every
push and pull request: `docs/CHECKS.md`. What an agent may and may not
touch: `CLAUDE.md`. What the shop is for: `SIGN.md`.
