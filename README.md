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

- **Home** (`/`): pick a course and rifle (two pairings now: the canyon
  course with a 7.62x54R Vepr and a UTG 2-7x scope; the rifle line with
  an AR-15 and its iron sights), pick the load, see the saved zero for
  that rifle and load or "not zeroed yet".
- **Zero bench** (`/zero`): a 36-inch paper with a 1-inch grid at 25, 50,
  100 or 200 yards. Fire a group, read where it lands, turn the sight's
  elevation and windage in its real click values, fire again, press
  **Save this zero**. The zero is saved on the device for that rifle and
  load. Changing the load keeps the sight where it is, so the group moves
  as it would in life.
- **Firing line** (`/line`): the view through the sight. The scope zooms
  across its real range; the iron sights show the front post, wide
  against a far plate. The aim wanders the way a rested rifle does; drag
  to hold off, hold **Steady**, press **Fire**. The bullet takes its real
  flight time; a miss throws dust where it landed, a hit rings late by the
  flight time plus the sound's trip back. Recoil knocks the view off for a
  moment. No drop or wind figure is given: the wind shows only as heat
  shimmer leaning, brush moving and the dust's drift. A shot log lists each
  shot's distance, sight setting, hold and where it landed. One setting,
  off by default, **Show the conditions**, prints the true wind,
  temperature and the engine's drop, for learning.

One MOA is a minute of angle, 1/60 of a degree, about 1 inch at 100
yards; sights click in MOA.

## Where the numbers come from

`data/` holds every figure the game uses: each load's speed, drag figure
and drag model, each rifle's barrel length and sight height, each sight's
click value, each course's plates and height above sea level, and the
weather ranges. Every figure carries the maker's page address and the
date it was read, or the word "estimate" and its basis. `lib/data.js`
refuses a bare number, and `npm test` runs that check over the whole
folder. The engine is `public/engine.js`; `test/engine.test.js` checks
it against two makers' own published trajectory tables.

Nothing in this repository says whose rifles these are; the rifle set is
described as a set of rifles, and the ranges appear as the public
businesses they are.

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
