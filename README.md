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
  200 to 1,000, up the slope) and the rifle line (100 to 600, up a
  gentle rise).
- **Zero bench** (`/zero`): a 36-inch paper with a 1-inch grid at 25, 50,
  100 or 200 yards. Fire a group, read where it lands, turn the sight's
  elevation and windage in its real clicks (a press is one click, holding
  repeats, a second pair moves a whole minute of angle on the finer
  sights), fire again, press **Save this zero**. The zero is saved on the
  device for that rifle, sight and load. Changing the load keeps the
  sight where it is, so the group moves as it would in life.
- **Firing line** (`/line`): the view through the sight. A scope zooms
  across its real range with its mil-dot reticle; the 3x prism sight
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
  knocks the view off for a moment. One line under the view always states
  the sight's setting. No drop or wind figure is given: the wind shows
  only as heat shimmer leaning, brush moving and the dust's drift. A shot
  log lists each shot's distance, sight setting, leaf, hold and where it
  landed. One setting, off by default, **Show the conditions**, prints the
  true wind, temperature and the engine's drop, for learning.

One MOA is a minute of angle, 1/60 of a degree, about 1 inch at 100
yards; sights click in MOA.

## Where the numbers come from

`data/` holds every figure the game uses: each load's speed, drag figure,
drag model and box, each rifle's barrel length and sight height, each sight's
click value, dot size, reticle marks or leaf settings (each setting's
angle derived with the engine from the service load the leaf was cut
for), each course's plates (distance, size, height above the firing line
and place across the view), the dust's size, the weather by course, month
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
`npm run check` runs every check (`npm test`, then `npm run screenshots`,
which saves the screens at both sizes into `docs/reports/screenshots/`).
They also run by themselves after every edit an agent makes and on every
push and pull request: `docs/CHECKS.md`. What an agent may and may not
touch: `CLAUDE.md`. What the shop is for: `SIGN.md`.
