# What the app keeps, written down

Range Day keeps everything on the device it runs on, in the browser's
`localStorage`, under keys that start with `range-day:`. Nothing is kept
on the server. Every read and write is wrapped: a browser that refuses
its storage makes a screen say "not saved on this device" instead of
breaking. The code that reads and writes these records is
`public/game.js`; the names below are the keys after the `range-day:`
prefix. This document describes formats only.

A rifle, a sight, a load and a course are named by their ids in the
game's data (`data/rifles.json`, `data/sights.json`, `data/loads.json`,
`data/courses.json`), for example `bcm-ar15`, `ar-irons`, `imi-m193`,
`angeles-sylmar`. Clicks are the sight's own clicks from its middle;
minutes of angle (MOA) are 1/60 of a degree, about 1 inch at 100 yards;
inches are measured square to the line of sight at the target, up and
right positive; a date `on` is the device's local day, `YYYY-MM-DD`.

A scope of the scope collection (range-day-thirteen: `trijicon-acog-ta31f`,
`vortex-razor-1-10`, `leupold-mark5hd-5-25`) is a sight like any other in
these keys: its setting, zeros, log and book lines are kept under the rifle
it is on (`sight:bcm-ar15:vortex-razor-1-10`, `zero:iwi-x95:vortex-razor-1-10:imi-m193`).
So a scope moved to another rifle starts unzeroed there, and keeps its zero
on the rifle it left. No new key; no record of any other sight changes.

## The records

### The sight setting: `sight:<rifle>:<sight>`

Where the sight is physically set: clicks of elevation and windage from
the middle; on a sight with a sliding rear leaf, which setting the leaf
is at (`leafIx`, an index into the leaf's `settingsMeters`); on the dot
with a magnifier, whether the magnifier is flipped in.

```json
{ "elevationClicks": 12, "windageClicks": -3, "leafIx": 2, "magnifier": false }
```

Since range-day-twelve-b, on a rear sight with two peeps (the Troy and the
FAB), `aperture` says which is up: `0` the large, `1` the small; absent is
the large. Both stand in the same plane, so it changes no shot.

```json
{ "elevationClicks": 4, "windageClicks": -2, "aperture": 1 }
```

### The saved zero: `zero:<rifle>:<sight>:<load>`

Saved at the zero bench. `sight` repeats the sight; `leafIx` is present
only for a sight with a leaf.

```json
{ "elevationClicks": 31, "windageClicks": -13, "zeroYards": 100, "sight": "utg-2-7x44", "leafIx": 0, "savedAt": "2026-11-16T12:00:00.000Z" }
```

An older form, `zero:<rifle>:<load>` (from before every sight could be
chosen), is still read for the sight it names and written forward to the
new key; the old record is left in place. (Since range-day-twelve a record
naming a sight the rifle no longer offers, and not carried, is left where
it is: below, "The sights fitted to the rifles".)

### A sight that took another's place (range-day-eleven)

The Vepr's scope was modeled as the UTG 2-7x44 (`utg-2-7x44`) until Dan
said it is a UTG BugBuster 3-9x32 (`utg-bugbuster-3-9x32`). The new
sight's entry in `data/sights.json` names the old one in
`carriesRecordsOf`. Because the two click alike (1/4 MOA on both turrets)
and sit at the same height over the bore (3.0 in, the side-rail mount's),
a zero in clicks is as true on the new scope, so:

- the sight setting, the saved zero, the shot log and the book page kept
  under `…:utg-2-7x44…` are read as the BugBuster's when nothing is
  stored under `…:utg-bugbuster-3-9x32…`, and written forward under that
  name; the old records stay stored as they were;
- a range-day-one zero (`zero:<rifle>:<load>`) naming `utg-2-7x44` is read
  for the BugBuster the same way;
- an address, a last-used record or a day naming `utg-2-7x44` on the Vepr
  opens the BugBuster;
- the copy file lists each such zero and book line once, under the
  BugBuster, where the forwarded copy is stored;
- the cold-bore record and the day's shots keep the sight they name; the
  2-7x44 stays in the data (offered by no rifle), so they still name a
  sight the game knows.

`public/game.js` (`carriedSight`) checks the two click values before it
carries anything; `test/day.test.js` ("range-day-eleven verify 5") proves
it with a device seeded under the old name.

### The sights fitted to the rifles (range-day-twelve)

The iron sights of five rifles were replaced by the ones fitted to them,
and one rifle's irons changed in place. The rule is the one above, sight
by sight on each rifle, decided by the same two figures (the click on both
adjustments, and the height over the bore):

| Rifle | Old sight | New sight | Click (elevation / windage, MOA) | Height over the bore | Records |
| - | - | - | - | - | - |
| the AR-15 | `ar-irons` | `troy-battlesights` | 1.75 / 0.75 then, 1.33 / 0.5 now | 2.6 in, 2.6 in | not carried: start unzeroed |
| the Tavor SAR | `tavor-irons` | `fab-flipup` | 1.5 / 1 then, 1 / 1 now | 3.0 in, 3.65 in | not carried: start unzeroed |
| the Tavor X95 | `tavor-irons` | `fab-flipup` | the same | 3.0 in, 3.65 in | not carried: start unzeroed |
| the 7.62x39 rifle | `ak-irons` | `ak762-kns-peep` | 2 / 2 then, 0.5 / 0.5 now | 1.9 in, 1.9 in | not carried: start unzeroed |
| the 5.45 rifle | `ak-irons` | `ak545-ball` | 2 / 2, 2 / 2 | 1.9 in, 1.9 in | carried (`carriesRecordsOf`) |
| the 5.45 rifle | — | `ak545-xs` | 2 / 2 | 1.9 in | new: starts unzeroed (one sight carries the old records: the ball post that took their place) |
| the Vepr | `vepr-irons` | `vepr-irons` (the ball post, the same id) | 2 / 2, unchanged | 2.0 in, unchanged | nothing moves |

Where nothing is carried, a zero in clicks would be untrue on the new
sight, so the new sight starts unzeroed and the old records stay stored
under the old sight's name: nothing is written forward. They stay
readable: the book page lists a sight the rifle no longer offers, marked
"(no longer on this rifle)", when this device holds book lines under it;
the copy file lists them under the old name; the cold-bore record and the
days keep the sight they name (`ar-irons`, `tavor-irons` and `ak-irons`
stay in the data, marked `retired`). An address or a last-used record
naming an old sight opens the rifle's sight now.

A record from before every sight could be chosen (`zero:<rifle>:<load>`
without a sight, `log:<rifle>:<load>`) belongs to the sight the rifle had
then. Where the default sight has since been replaced, that is the sight
the replacement names: `carriesRecordsOf` where it carries, else
`tookThePlaceOf` (`public/game.js`, `oldRecordsSightOf`). So the AR-15's
range-day-one zero and log, made with the old irons, are not read as the
Troy sights'. `test/day.test.js` ("range-day-twelve verify 5") proves each
case with a device seeded under each old sight.

### The shot log: `log:<rifle>:<sight>:<load>`

Every shot on the firing line with that rifle, sight and load, in order:
a list of rows. `call` is the wind call at the shot (`null` when not
called); `conditionsShown` is true when the setting "Show the
conditions" was on; `day` names the day. Rows from before range-day-three
lack `day`, `tempF`, `call` and `conditionsShown`.

```json
[{ "n": 1, "yards": 300, "el": 12, "wd": -3, "leaf": 300, "zoom": 2, "heldUp": 0.5, "heldRight": -1.2,
   "hit": true, "where": "hit (2.1 in high, 0.8 in right of center)", "upIn": 2.08, "rightIn": 0.83,
   "day": "2026-11-17-mwkoc3x1", "tempF": 52, "call": { "from": "left", "mph": 6 }, "conditionsShown": false }]
```

Since range-day-ten a row says which target it was fired at: `target`
is `"paper"` or `"steel"` (100-yard paper and 100-yard steel are told
apart by it); a row without it is read as steel. On paper `hit` means on
the sheet and `where` says where from the nearest aiming mark ("on paper
(1.2 in high from the center mark)"); off it, "miss: off the paper, …".

The older form `log:<rifle>:<load>` is read for the sight the rifle had
when it was written (its default then; since range-day-twelve, where that
sight was replaced, only for a sight that carries its records) and written
forward, the old record left in place. "Clear the log"
clears only this record.

### The open day: `day:open`

The one day that is open now: one course, one rifle, one load and a box
of that load for the steel, on a day drawn from `data/weather.json` for a
month (1 to 12) and a time of day (`morning`, `midday`, `afternoon`).
`weather` is the draw: the temperature, the humidity, the altitude, the
pressure, the wind in three stretches of the path (each with a gust), and
whether it is a Santa Ana day. `box.left` counts down as shots are fired
at steel; `box.opened` counts the boxes opened in the day ("Open another
box" adds a box when one is empty; a record without the count is one
box). Shots at the bench come from the zeroing supply below, not from
the box. `shots` is every shot of the day in order, at the bench
(`place: "bench"`) or at steel (`place: "line"`); `firstShotPlace` says
where the day's first shot was fired. A day with no shot is dropped
freely. A day left open from an earlier date is finished by itself
(`endedBy: "left"`) when the app is next opened.

```json
{ "id": "2026-11-17-mwkoc3x1", "startedAt": "2026-11-17T09:12:01.000Z", "date": "2026-11-17",
  "course": "angeles-sylmar", "rifle": "bcm-ar15", "load": "imi-m193", "month": 11, "timeOfDay": "morning",
  "weather": { "course": "angeles-sylmar", "month": 11, "timeOfDay": "morning", "santaAna": false,
               "tempF": 52, "humidity": 0.62, "altitudeFt": 1500, "pressureInHg": 28.33, "speedMph": 4.1, "fromDegrees": 290,
               "wind": [{ "fromYards": 0, "toYards": 200, "speedMph": 3.9, "fromDegrees": 275, "gustMph": 1.2, "periodS": 9, "phase": 2.1 }, { "...": "two more stretches" }] },
  "box": { "size": 20, "left": 14, "opened": 1 },
  "shots": [
    { "n": 1, "at": "2026-11-17T09:13:40.000Z", "place": "bench", "yards": 100, "sight": "ar-irons", "elevationClicks": 0, "windageClicks": 0, "leaf": null, "reached": true, "upIn": -7.9, "rightIn": 1.2 },
    { "n": 6, "at": "2026-11-17T09:20:02.000Z", "place": "line", "yards": 300, "sight": "ar-irons", "elevationClicks": 4, "windageClicks": -1,
      "elevationMoa": 7, "windageMoa": -1.75, "leaf": null, "zero": { "zeroYards": 100, "elevationClicks": 3, "windageClicks": -1 },
      "heldUpMoa": 0.5, "heldRightMoa": -1.2, "windCall": { "from": "left", "mph": 6 }, "conditionsShown": false,
      "hit": true, "reached": true, "upIn": 2.08, "rightIn": 0.83, "book": true, "coldBore": true }
  ],
  "firstShotPlace": "bench", "endedAt": null, "endedBy": null }
```

Since range-day-ten each shot at the line carries `target`, `"paper"` or
`"steel"`; a shot without it (every shot before range-day-ten) is read as
steel. On paper `hit` means the bullet went through the sheet, and `book`
is always false (the book holds hits on steel). The holes a sheet shows
and the marks a plate shows are rebuilt from these shots whenever the
firing line opens. `freshPaper` (absent until used) holds, per paper
distance, the number of the last shot of the day when **Hang a fresh
paper** was pressed: the sheet shows only later shots; **Put the old
paper back** sets it back to what it was (or removes it). No shot is ever
deleted.

```json
{ "freshPaper": { "50": 7 },
  "shots": [{ "n": 8, "place": "line", "yards": 50, "target": "paper", "hit": true, "reached": true, "upIn": -1.2, "rightIn": 0.4, "book": false, "coldBore": false, "...": "the other fields as above" }] }
```

Since range-day-thirteen each shot at the line also carries `flightS`, the
bullet's time of flight in seconds exactly as the engine gave it (not rounded),
and `targetKey`, the key of the target it was fired at: a plate's index in
the course's list (`"0"`, `"1"`, …) or a near target's `"near-0"`,
`"near-1"`, …. Both are for playing a day back. Shots written before have
neither and are read as they are; a copy is checked for both only where
they are present. The zero bench's paper keeps its own `freshPaper` marker
per distance under `"bench:<yards>"` (for example `"bench:100"`), set by
**Fresh paper** and undone by **Put the old paper back** in the same way;
the bench's holes are its shots at that distance with that sight since the
marker, read from `shots`, so a reload shows them again.

```json
{ "freshPaper": { "50": 7, "bench:100": 12 },
  "shots": [{ "n": 13, "place": "line", "yards": 300, "target": "steel", "targetKey": "2", "flightS": 0.36265192406949, "...": "the other fields as above" }] }
```

### The finished days: `days`

A list of day records in the shape above, newest first, each with
`endedAt` set and `endedBy` `"packed"` (Pack up), `"left"` (left open
past its date, closed on the next visit) or, in records from before a
box could be reopened, `"empty"` (the box ran out). `day:packed` holds
the id of the last packed-up day, which "Back to the range" on the day's
page reopens until another day is started.

### The zeroing supply: `supply:<rifle>:<load>`

The bench's own rounds for a rifle and load, kept from one day to the
next (a zero is not shot afresh on every visit). It starts as one box of
the load (`size` is the load's `boxCount`); `left` counts down with each
shot at the bench; `opened` counts the boxes opened ("Open another box"
on the bench adds one when it is empty). It is not part of any day's box
and is not in the copy file.

```json
{ "size": 20, "left": 7, "opened": 2 }
```

### The data book: `book:<rifle>:<sight>:<load>`

One line per hit on steel, written when the bullet landed, with the
field names of the gun record's `measured.book` section. `n` is the
shot's number in its day and `at` the moment it landed (lists are
ordered newest first by `at`, then `n`, as numbers); `elevationMoa` is
the shot's whole elevation in minutes of angle (the clicks and, on a
sight with a sliding leaf, the leaf's own angle); `zero` is the saved
zero the sight was counted from at the shot (its clicks, the leaf
setting it was saved with, and its own `elevationMoa`), or `null`; `leaf`
is the rear leaf's setting in meters, or `null`; `windCall` is the call as
stated before the shot, or `null`; `struck` and `note` are the player's
own, changed on the book page. `id` is `<day id>:<shot number>`. The
come-up the book shows is `elevationMoa − zero.elevationMoa`.

```json
[{ "id": "2026-11-17-mwkoc3x1:6", "day": "2026-11-17-mwkoc3x1", "n": 6, "at": "2026-11-17T09:20:03.100Z", "on": "2026-11-17", "course": "angeles-sylmar", "yards": 300,
   "elevationClicks": 4, "windageClicks": -1, "elevationMoa": 7, "windageMoa": -1.75, "leaf": null,
   "zero": { "zeroYards": 100, "elevationClicks": 3, "windageClicks": -1, "leafIx": null, "leaf": null, "elevationMoa": 5.25 },
   "heldUpMoa": 0.5, "heldRightMoa": -1.2, "tempF": 52, "windCall": { "from": "left", "mph": 6 },
   "upIn": 2.08, "rightIn": 0.83, "struck": false, "note": "" }]
```

### The cold-bore record: `cold-bore:<rifle>:<load>`

One line per day whose first shot was fired at a plate (not at the
bench, and not with the conditions shown), hit or miss, with the field
names of the gun record's `measured.cold_bore` section.

```json
[{ "id": "2026-11-17-mwkoc3x1:1", "day": "2026-11-17-mwkoc3x1", "n": 1, "at": "2026-11-17T09:14:02.400Z", "on": "2026-11-17", "course": "angeles-sylmar", "sight": "ar-irons", "load": "imi-m193",
   "yards": 300, "elevationClicks": 4, "windageClicks": -1, "leaf": null, "windCall": { "from": "left", "mph": 6 }, "tempF": 52,
   "hit": false, "upIn": -9.4, "rightIn": 2.1 }]
```

Since range-day-ten a cold-bore line, and a book line, carries `target`:
`"paper"` or `"steel"` (a book line is always steel: the book holds hits
on steel). A cold-bore line at paper has `hit` meaning on the sheet. A line
without `target` is from before range-day-ten and was at steel.

### Small records

| Key | Shape | What it is |
| - | - | - |
| `last` | `{ "rifle": "bcm-ar15" }` | the rifle last used on this device |
| `last:<rifle>` | `{ "sight": "ar-irons", "load": "imi-m193", "course": "angeles-sylmar" }` | that rifle's last sight, load and course |
| `when` | `{ "timeOfDay": "morning" }` | the time of day last used (the month is the device's calendar month unless changed on home) |
| `wind-call` | `{ "from": "left", "mph": 6 }` | the last wind call (`from` is `"left"`, `"right"`, `"none"` or `null` for not called) |
| `show-conditions` | `true` or `false` | the setting "Show the conditions" |
| `picture` | `"full"`, `"light"` or `"plain"` | the picture on the firing line (range-day-five): Full and Light are the 3D scene on the surveyed ground, Plain the flat drawing; absent until the first visit to the firing line has chosen Full or Light by counting frames, or the player has chosen |

## The copy file

"Save a copy" on the book page hands the browser one JSON file holding
every book page, the cold-bore records, the finished days and the saved
zeros on the device, each line carrying its rifle, sight and load.
"Load a copy" reads such a file and adds what the device lacks (by `id`
for lines and days, by rifle, sight and load for zeros); it never
replaces or removes anything already there. The whole file is checked
before anything is written: a file whose `kind` is not
`"range-day copy"`, whose `version` is not 1, whose lists are missing, or
any of whose records lacks a required field or has one of the wrong kind
(for example `book[3].yards` not a number), including a day's box
(its `opened` count, when present, a number),
weather, three stretches of wind and every shot (for example
`days[0].shots[1]` not a record; a shot that reached must carry where it
landed, `upIn` and `rightIn`, as numbers, and one that went into the
ground must carry null for both), is refused with that field named, and
nothing is loaded. The book, cold-bore and
zero lines use the field names of the gun record's `measured` section,
so the file can be taken as it is by the build that keeps records
elsewhere.

```json
{ "kind": "range-day copy", "version": 1, "savedAt": "2026-11-17T10:00:00.000Z",
  "zeros": [{ "rifle": "bcm-ar15", "sight": "ar-irons", "load": "imi-m193", "zeroYards": 100, "elevationClicks": 3, "windageClicks": -1, "leafIx": null, "saved_on": "2026-11-17T09:15:00.000Z" }],
  "book": [{ "rifle": "bcm-ar15", "sight": "ar-irons", "load": "imi-m193", "id": "2026-11-17-mwkoc3x1:6", "...": "the book line's fields" }],
  "cold_bore": [{ "rifle": "bcm-ar15", "load": "imi-m193", "id": "2026-11-17-mwkoc3x1:1", "...": "the cold-bore line's fields" }],
  "days": [{ "id": "2026-11-17-mwkoc3x1", "...": "a finished day record" }] }
```

## The gun record's `game` section, and how `lib/guns.js` checks it

The game takes each rifle from a gun record, one record per gun:
`{ id, name, fields: { game: {...} } }`. Only `id`, `name` and `game` are
read; every other section of a record is ignored and never written
anywhere. `game` is, field for field, one entry of `data/rifles.json`:

| Field | What it is |
| - | - |
| `caliber` | a string, the same as each of its loads' |
| `playable` | `true` or `false` |
| `barrelIn` | a figure: the barrel length the loads' speeds are given for |
| `sightHeightIn` | an object, sight id to figure, one for every sight it carries |
| `boreOffsetMoa` | `{ up, right }`, two figures: the rifle's own offset with the sight at its middle |
| `recoilFactor` | a figure: how hard the view is knocked, 1 being a 5.56 carbine |
| `sights` | a list of sight ids from `data/sights.json` |
| `defaultSight` | one of its sights: the one an address without a sight opens |
| `loads` | a list of load ids from `data/loads.json` |
| `firstCourse` | a course id from `data/courses.json`: the course the rifle opens on the first time on a device |
| `sightLeaf` | optional: an object, sight id to the name of a leaf table on that sight (for example `{ "ak-irons": "leaf545" }`, the 5.45 rifle's until range-day-twelve, whose two sights now carry that leaf as their own); a sight not named uses its own `leaf` |

A figure is `{ "value": <number>, "source": { "url": "...", "read": "YYYY-MM-DD" } }`
or `{ "value": <number>, "estimate": "<its basis>" }`; a bare number is
refused.

`fromRecords(records, raw)` takes a list of records and the game's own
data (`lib/data.load().raw`) and returns the rifle set the screens use
(an object keyed by id, in the records' order, each figure reduced to its
value), or throws a `RecordError` naming the gun, the fault and the
valid values, for example:

- `gun 'x': game.barrelIn: a bare number; wrap it as {value, source} or {value, estimate}`
- `gun 'x': sight 'foo' is not in the game's data: ar-irons, tavor-irons, …, troy-battlesights, fab-flipup, seeall-gen1, ak762-kns-peep, ak545-ball, ak545-xs`
- `gun 'x': defaultSight 'pa-md25' is not one of its sights: troy-battlesights`
- `gun 'x': no sightHeightIn for sight 'troy-battlesights'; it carries: troy-battlesights`
- `gun 'x': load 'sb-124' is 7.62x39, not the gun's 5.56x45`
- `gun 'x': firstCourse 'moon' is not a course: cta-piru, angeles-sylmar`
- `gun 'x': sightLeaf for 'troy-battlesights' names 'leaf', which is not a leaf table on that sight: it has none`

It also refuses a missing or unknown `game` field, a record that appears
twice, an empty list, and a set with no playable gun.

`fromFiles(raw)` wraps each `data/rifles.json` entry as a record
(`toRecord(id, entry)`) and passes it through `fromRecords`, so the one
path is always the path. `load(raw)` is what the server calls: with the
environment variable `GUN_RECORDS_FILE` naming a JSON file (a list of
records, or `{ "records": [...] }`), the set comes from that file; without
it, from `data/rifles.json`. A refused record stops the server with the
message.
