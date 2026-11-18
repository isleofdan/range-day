'use strict';
/* What the screens share: the game's data (from /api/data), the things kept
   on this device (the sight settings, saved zeros, the shot log, the open
   day and the finished days, the data book, the cold-bore record, the wind
   call, the one setting), the day's weather, the sounds, and small helpers.
   Every bullet still flies through /engine.js; nothing here does physics.
   The records this file keeps, their keys and shapes: docs/RECORDS.md. */
window.RD = (function () {
  const E = window.RangeDayEngine;

  // --- data ------------------------------------------------------------------
  let DATA = null;
  async function data() {
    if (!DATA) DATA = await (await fetch('/api/data', { headers: { accept: 'application/json' } })).json();
    defaultSightOf = (rifle) => (DATA.rifles[rifle] ? DATA.rifles[rifle].defaultSight : null);
    return DATA;
  }
  const rifleIds = (d) => Object.keys(d.rifles).filter((k) => !k.startsWith('_') && d.rifles[k].playable);

  // --- what lives on this device -------------------------------------------------
  // Every read and write is wrapped: a browser that refuses storage (a
  // private window, a full disk) must not break a screen; it shows
  // "not saved on this device" instead.
  // A read that the browser refuses answers FAILED, never null, so a screen
  // can say "not saved on this device" instead of "no zero saved yet".
  const FAILED = Object.freeze({ failed: true });
  const store = {
    FAILED,
    get(key) { try { const v = localStorage.getItem(`range-day:${key}`); return v ? JSON.parse(v) : null; } catch { return FAILED; } },
    set(key, value) { try { localStorage.setItem(`range-day:${key}`, JSON.stringify(value)); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(`range-day:${key}`); return true; } catch { return false; } },
    keys() { try { return Object.keys(localStorage).filter((k) => k.startsWith('range-day:')).map((k) => k.slice('range-day:'.length)); } catch { return FAILED; } },
  };
  const ok = (v) => v && v !== FAILED;
  // The sight as it is physically set on the rifle (clicks from the middle;
  // on a sight with a sliding leaf, which setting the leaf is at; on the dot
  // with a magnifier behind it, whether the magnifier is flipped in).
  const sightKey = (rifle, sight) => `sight:${rifle}:${sight}`;
  const getSight = (rifle, sight) => { const v = store.get(sightKey(rifle, sight)); return ok(v) ? { elevationClicks: 0, windageClicks: 0, ...v } : { elevationClicks: 0, windageClicks: 0 }; };
  const sightReadFailed = (rifle, sight) => store.get(sightKey(rifle, sight)) === FAILED;
  const setSight = (rifle, sight, v) => store.set(sightKey(rifle, sight), v);

  // A saved zero belongs to a rifle, a sight and a load (several sights can
  // sit on one rifle); so does the shot log. Before every sight could be
  // chosen (range-day-one) both were kept per rifle and load, the zero
  // recording which sight made it. Those records keep working: when nothing
  // is stored in the new form, the old record is read for the sight it
  // names (a log: for the rifle's sight of that time, defaultSight in
  // data/rifles.json), written forward, and left in place.
  const zeroKey = (rifle, sight, load) => `zero:${rifle}:${sight}:${load}`;
  const oldZeroKey = (rifle, load) => `zero:${rifle}:${load}`;
  const logKey = (rifle, sight, load) => `log:${rifle}:${sight}:${load}`;
  const oldLogKey = (rifle, load) => `log:${rifle}:${load}`;
  let defaultSightOf = () => null; // set once the data is loaded (data() below)
  function getZero(rifle, sight, load) {
    const v = store.get(zeroKey(rifle, sight, load));
    if (v) return v; // a record, or FAILED
    const old = store.get(oldZeroKey(rifle, load));
    if (!old || old === FAILED) return old === FAILED ? FAILED : null;
    const madeWith = old.sight || defaultSightOf(rifle);
    if (madeWith !== sight) return null;
    store.set(zeroKey(rifle, sight, load), old); // forward; the old record stays
    return old;
  }
  const setZero = (rifle, sight, load, v) => store.set(zeroKey(rifle, sight, load), v);
  function getLog(rifle, sight, load) {
    const v = store.get(logKey(rifle, sight, load));
    if (Array.isArray(v)) return v;
    if (v === FAILED) return [];
    if (sight !== defaultSightOf(rifle)) return [];
    const old = store.get(oldLogKey(rifle, load));
    if (!Array.isArray(old)) return [];
    store.set(logKey(rifle, sight, load), old);
    return old;
  }
  const setLog = (rifle, sight, load, v) => store.set(logKey(rifle, sight, load), v);
  // Whether any zero is saved on this device for a rifle (any sight, any load): for the home screen's list.
  function zeroCount(rifle, rifleData) {
    let n = 0;
    for (const sight of rifleData.sights) for (const load of rifleData.loads) { const z = getZero(rifle, sight, load); if (z && z !== FAILED) n++; }
    return n;
  }
  // What was last used on this device: the rifle, and per rifle its sight, load and course; the time of day; the wind call.
  const getLast = () => { const v = store.get('last'); return ok(v) ? v : null; };
  const setLast = (v) => store.set('last', v);
  const getLastFor = (rifle) => { const v = store.get(`last:${rifle}`); return ok(v) ? v : null; };
  const setLastFor = (rifle, v) => store.set(`last:${rifle}`, v);
  const showConditions = () => store.get('show-conditions') === true;
  const setShowConditions = (on) => store.set('show-conditions', on === true);
  // The picture on the firing line: full, light or plain; null until the first visit has chosen (docs/RECORDS.md).
  const PICTURES = ['full', 'light', 'plain'];
  const getPicture = () => { const v = store.get('picture'); return PICTURES.includes(v) ? v : null; };
  const pictureReadFailed = () => store.get('picture') === FAILED;
  const setPicture = (v) => store.set('picture', v);
  const TIMES = ['morning', 'midday', 'afternoon'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const getWhen = () => { const v = store.get('when'); return ok(v) && TIMES.includes(v.timeOfDay) ? v : { timeOfDay: 'morning' }; };
  const setWhen = (v) => store.set('when', v);
  const thisMonth = () => new Date().getMonth() + 1;
  // The wind call: where from ('left', 'right', 'none'; null = not called) and how strong, in miles an hour.
  const getWindCall = () => { const v = store.get('wind-call'); return ok(v) ? { from: v.from == null ? null : v.from, mph: Number(v.mph) || 0 } : { from: null, mph: 5 }; };
  const setWindCall = (v) => store.set('wind-call', v);
  const windCallText = (w) => (!w || w.from == null ? 'not called' : w.from === 'none' ? 'no wind' : `${w.mph} mph from the ${w.from}`);

  // --- the day's weather ----------------------------------------------------------------
  // A day is drawn from data/weather.json for a course, a month (1 to 12)
  // and a time of day (morning, midday, afternoon): the temperature between
  // the month's mean low and high, the humidity, the wind in three stretches
  // of the path that differ from one another and gust, and, with the
  // month's chance, a Santa Ana day (dry, warm, windy, strongest in the
  // morning). The random source is an argument so a test can repeat a day.
  function drawDay(course, weather, month, timeOfDay, rand) {
    const r = rand || Math.random;
    const between = (lo, hi) => lo + (hi - lo) * r();
    const m = weather.courses[course.id].months[(month || thisMonth()) - 1];
    const tod = weather.timesOfDay[TIMES.includes(timeOfDay) ? timeOfDay : 'morning'];
    const santaAna = r() < m.santaAnaChance;
    const sa = weather.santaAna;
    let tempF = m.lowF + tod.tempAt * (m.highF - m.lowF) + between(-weather.dayToDaySpreadF, weather.dayToDaySpreadF);
    if (santaAna) tempF += sa.tempAboveNormalF;
    tempF = Math.round(tempF);
    const humidity = Math.round((santaAna ? between(sa.humidity.low, sa.humidity.high) : Math.max(weather.humidityBounds.low, Math.min(weather.humidityBounds.high, m.humidity + tod.humidityShift + between(-weather.humiditySpread, weather.humiditySpread)))) * 100) / 100;
    const speedMph = Math.round((santaAna ? between(sa.windMph.low, sa.windMph.high) * sa.windFactorByTime[tod.name] : m.windMph * tod.windFactor * between(weather.windSpread.low, weather.windSpread.high)) * 10) / 10;
    const [a, b, c, d] = weather.windFromDegrees;
    const fromDegrees = Math.round(r() < 0.5 ? between(a, b) : between(c, d));
    const v = weather.stretchVariation;
    const stretch = (from, to, factor) => {
      const speed = Math.round(speedMph * (1 + factor * between(-v, v)) * 10) / 10;
      return {
        fromYards: from, toYards: to, speedMph: speed,
        fromDegrees: Math.round(fromDegrees + between(-weather.stretchDirectionWobbleDegrees, weather.stretchDirectionWobbleDegrees)),
        gustMph: Math.round((santaAna ? between(sa.gustMph.low, sa.gustMph.high) : speed * between(weather.gustShare.low, weather.gustShare.high)) * 10) / 10,
        periodS: Math.round(between(weather.gustPeriodS.low, weather.gustPeriodS.high)),
        phase: between(0, 6.28),
      };
    };
    const far = course.steelTo;
    return {
      course: course.id, month: month || thisMonth(), timeOfDay: tod.name, santaAna,
      tempF, humidity, altitudeFt: course.altitudeFt,
      pressureInHg: Math.round(E.pressureAt(course.altitudeFt) * 100) / 100,
      speedMph, fromDegrees,
      wind: [stretch(0, far / 3, 0.6), stretch(far / 3, (2 * far) / 3, 0.8), stretch((2 * far) / 3, 100000, 1.0)],
    };
  }
  const conditionsOf = (w) => ({ altitudeFt: w.altitudeFt, tempF: w.tempF, pressureInHg: w.pressureInHg, humidity: w.humidity });
  // "A cool November morning, 52 F": the month, the time of day and the
  // temperature, the way a shooter would know the day. Never the wind.
  function dayWords(w, weather) {
    const t = weather.words;
    const word = w.tempF < t.coldBelowF ? 'cold' : w.tempF < t.coolBelowF ? 'cool' : w.tempF < t.mildBelowF ? 'mild' : w.tempF < t.warmBelowF ? 'warm' : 'hot';
    const dry = w.humidity < t.dryBelow ? ', dry' : '';
    return `A ${word}${dry} ${MONTHS[w.month - 1]} ${w.timeOfDay}, ${w.tempF} F.`;
  }

  // --- a day at the range ---------------------------------------------------------------
  // One day is one course, one rifle and one load, with a box of that load
  // for the steel (another box can be opened when it is empty), on a day
  // drawn above. The open day is kept on the device (day:open), so closing
  // the app and coming back resumes it. A day in which no shot was fired
  // leaves no record. "Pack up" finishes the day and keeps it (days), with
  // every shot; a day left open is finished by itself when the app is next
  // opened on a later date. The bench fires from the zeroing supply, not
  // from the day's box (see below).
  const localDate = (d) => { const x = d || new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const openDay = () => {
    const v = store.get('day:open');
    if (!ok(v)) return null;
    if (v.date && v.date !== localDate()) { // a day left open from an earlier date: a new date is a new visit
      if (v.shots && v.shots.length) finishDay(v, 'left'); else store.remove('day:open');
      return null;
    }
    return v;
  };
  const dayReadFailed = () => store.get('day:open') === FAILED;
  const saveOpenDay = (day) => store.set('day:open', day);
  const hasShots = (day) => Boolean(day && day.shots && day.shots.length);
  const finishedDays = () => { const v = store.get('days'); return Array.isArray(v) ? v : []; };
  const dayById = (id) => (openDay() && openDay().id === id ? openDay() : finishedDays().find((x) => x.id === id) || null);
  function startDay(d, c, month, timeOfDay, rand) {
    const course = { id: c.courseId, ...d.courses[c.courseId] };
    const now = new Date();
    const day = {
      id: `${localDate(now)}-${now.getTime().toString(36)}`,
      startedAt: now.toISOString(), date: localDate(now),
      course: c.courseId, rifle: c.rifleId, load: c.loadId,
      month: month || thisMonth(), timeOfDay: TIMES.includes(timeOfDay) ? timeOfDay : 'morning',
      weather: drawDay(course, d.weather, month || thisMonth(), timeOfDay, rand),
      box: { size: d.loads[c.loadId].boxCount, left: d.loads[c.loadId].boxCount, opened: 1 },
      shots: [], firstShotPlace: null, endedAt: null, endedBy: null,
    };
    store.remove('day:packed');
    setWhen({ timeOfDay: day.timeOfDay });
    const saved = saveOpenDay(day);
    return { day, saved };
  }
  // The bench and the line call this on opening: the open day if one has
  // shots (its rifle, load and course win over the address, and `redirected`
  // says the address asked for something else), else a day for the choice
  // made (a shotless open day for another choice is dropped: a mistaken tap
  // costs nothing). The month and time of day come from the address (home's
  // doors carry them) or from what was last used.
  function enterDay(d, c, q) {
    const open = openDay();
    const same = (day) => day.rifle === c.rifleId && day.load === c.loadId && day.course === c.courseId;
    if (open && hasShots(open)) {
      if (same(open)) return { day: open, c, redirected: false, saved: true, fresh: false };
      // The address asked for something else: the open day wins, and every choice that depends on
      // the rifle (the sight, the magnifier) is resolved against the open day's rifle, not the address's.
      const rifle = d.rifles[open.rifle];
      const playable = rifle.sights.filter((s) => d.sights[s].kind !== 'magnifier');
      const sightId = playable.includes(c.sightId) ? c.sightId : chooseFrom(d, { rifle: open.rifle, remembered: true }).sightId;
      const magnifierId = rifle.sights.find((s) => d.sights[s].kind === 'magnifier') || null;
      return { day: open, c: { ...c, rifleId: open.rifle, loadId: open.load, courseId: open.course, sightId, magnifierId }, redirected: true, saved: true, fresh: false };
    }
    if (open && same(open) && !open.endedAt) return { day: open, c, redirected: false, saved: true, fresh: false };
    const month = Number(q && q.month) >= 1 && Number(q.month) <= 12 ? Number(q.month) : thisMonth();
    const timeOfDay = q && TIMES.includes(q.time) ? q.time : getWhen().timeOfDay;
    const { day, saved } = startDay(d, c, month, timeOfDay);
    return { day, c, redirected: false, saved, fresh: true };
  }
  // Takes up to n rounds out of the day's box (the steel's); answers how many came out (0 when it is empty).
  function takeRounds(day, n) {
    if (!day || day.endedAt) return 0;
    const out = Math.max(0, Math.min(n, day.box.left));
    day.box.left -= out;
    saveOpenDay(day);
    return out;
  }
  // Opens another box of the load for the steel: the day goes on. An old record without a count is one box.
  function openAnotherBox(day) {
    if (!day || day.endedAt) return false;
    day.box.opened = (day.box.opened || 1) + 1;
    day.box.left += day.box.size;
    return saveOpenDay(day);
  }
  const boxesOpened = (day) => (day.box.opened || 1);
  const roundsFired = (day) => boxesOpened(day) * day.box.size - day.box.left;
  // The zeroing supply: the bench's own rounds, per rifle and load, kept on
  // the device across days (zeroing is not done afresh on every visit). It
  // starts as one box of the load; another box can be opened when it is
  // empty. It is not part of the day's box and not in a copy.
  const supplyKey = (rifle, load) => `supply:${rifle}:${load}`;
  function getSupply(d, rifle, load) {
    const v = store.get(supplyKey(rifle, load));
    if (ok(v) && typeof v.left === 'number') return v;
    return { size: d.loads[load].boxCount, left: d.loads[load].boxCount, opened: 1 };
  }
  const supplyReadFailed = (rifle, load) => store.get(supplyKey(rifle, load)) === FAILED;
  // Takes up to n rounds out of the supply; answers { out, saved }.
  function takeSupply(d, rifle, load, n) {
    const s = getSupply(d, rifle, load);
    const out = Math.max(0, Math.min(n, s.left));
    s.left -= out;
    return { out, saved: store.set(supplyKey(rifle, load), s), supply: s };
  }
  function openSupplyBox(d, rifle, load) {
    const s = getSupply(d, rifle, load);
    s.opened = (s.opened || 1) + 1; s.left += s.size;
    return { saved: store.set(supplyKey(rifle, load), s), supply: s };
  }
  const supplyText = (s) => (s.left > 0 ? `zeroing supply: ${s.left} of ${s.size} left${(s.opened || 1) > 1 ? ` (box ${s.opened})` : ''}` : `zeroing supply: the box of ${s.size} is empty`);
  // Writes one shot into the day (place 'bench' or 'line'). The box emptying no longer ends the day: another box can be opened.
  function recordShot(day, shot) {
    if (!day) return { saved: false };
    // The number is the shot's place in the day's firing order: given at the trigger pull by the
    // firing line (a bench shot has none in flight, so it is simply the next); the list stays in that order.
    if (typeof shot.n !== 'number') shot.n = day.shots.reduce((m, x) => Math.max(m, x.n || 0), 0) + 1;
    shot.at = new Date().toISOString();
    if (!day.firstShotPlace || shot.n === 1) day.firstShotPlace = shot.place;
    day.shots.push(shot);
    day.shots.sort((a, b) => a.n - b.n);
    return { saved: saveOpenDay(day), ended: false };
  }
  // Moves the open day to the finished days. by: 'packed' (Pack up, which "Back to the range" can undo), 'left' (left open past
  // its date, closed on the next visit) or, in records from before boxes could be reopened, 'empty' (the box ran out).
  function finishDay(day, by) {
    day.endedAt = new Date().toISOString(); day.endedBy = by;
    const days = finishedDays().filter((x) => x.id !== day.id);
    days.unshift(day);
    store.set('days', days);
    store.remove('day:open');
    if (by === 'packed') store.set('day:packed', day.id); else store.remove('day:packed');
    return day;
  }
  // Pack up early, from home, the bench or the line. A day with no shot leaves no record.
  function packUp() {
    const day = openDay();
    if (!day) return null;
    if (!hasShots(day)) { store.remove('day:open'); return null; }
    return finishDay(day, 'packed');
  }
  // "Back to the range": the last packed-up day is open again, until another day is started.
  const packedDayId = () => { const v = store.get('day:packed'); return typeof v === 'string' ? v : null; };
  function restorePacked() {
    const id = packedDayId();
    if (!id || openDay()) return null;
    const days = finishedDays();
    const day = days.find((x) => x.id === id);
    if (!day) return null;
    day.endedAt = null; day.endedBy = null;
    store.set('days', days.filter((x) => x.id !== id));
    store.remove('day:packed');
    saveOpenDay(day);
    return day;
  }

  // --- the data book -----------------------------------------------------------------------
  // One page per rifle, sight and load; one line per hit on steel, written by
  // itself when the bullet lands, with the field names of the gun record's
  // `measured` section so a copy of the book can be taken as it is. A line can
  // be struck out and restored, and takes a note. Nothing here comes from the
  // engine's prediction: only what the player's own hits were.
  const bookKey = (rifle, sight, load) => `book:${rifle}:${sight}:${load}`;
  const getBook = (rifle, sight, load) => { const v = store.get(bookKey(rifle, sight, load)); return Array.isArray(v) ? v : []; };
  const bookReadFailed = (rifle, sight, load) => store.get(bookKey(rifle, sight, load)) === FAILED;
  function addBookLine(rifle, sight, load, line) {
    const lines = getBook(rifle, sight, load);
    if (lines.some((l) => l.id === line.id)) return true;
    lines.push({ struck: false, note: '', ...line });
    return store.set(bookKey(rifle, sight, load), lines);
  }
  function changeBookLine(rifle, sight, load, id, patch) {
    const lines = getBook(rifle, sight, load);
    const l = lines.find((x) => x.id === id);
    if (!l) return false;
    Object.assign(l, patch);
    return store.set(bookKey(rifle, sight, load), lines);
  }
  // Newest first, for every list of lines (the book page, the line under the
  // setting, the cold-bore record): by the moment the shot landed (`at`),
  // then by the shot's number in its day (`n`), as numbers; a line from an
  // older copy without them falls back to its date and the number in its id.
  const shotNumber = (l) => (typeof l.n === 'number' ? l.n : Number((String(l.id || '').split(':')[1]) || 0));
  const when = (l) => l.at || `${l.on || ''}T00:00:00.000Z`;
  function newestFirst(a, b) {
    if (when(a) !== when(b)) return when(a) < when(b) ? 1 : -1;
    if ((a.day || '') !== (b.day || '')) return (a.day || '') < (b.day || '') ? 1 : -1;
    return shotNumber(b) - shotNumber(a);
  }
  // The unstruck lines at a distance, newest first.
  const bookAt = (rifle, sight, load, yards) => getBook(rifle, sight, load).filter((l) => !l.struck && l.yards === yards).sort(newestFirst);
  // The distances that have unstruck lines, nearest below and above a distance.
  function bookNeighbours(rifle, sight, load, yards) {
    const ds = [...new Set(getBook(rifle, sight, load).filter((l) => !l.struck).map((l) => l.yards))].sort((a, b) => a - b);
    return { below: ds.filter((y) => y < yards).pop() ?? null, above: ds.find((y) => y > yards) ?? null, all: ds };
  }
  // The come-up in minutes of angle: the shot's elevation (clicks and, on a
  // sight with a sliding leaf, the leaf's own angle) less the saved zero's
  // (its clicks and the leaf setting it was saved with); from the sight's
  // middle where no zero was saved.
  function comeUpMoa(line, clickMoa) {
    const shotMoa = typeof line.elevationMoa === 'number' ? line.elevationMoa : line.elevationClicks * clickMoa;
    if (!line.zero) return Math.round(shotMoa * 100) / 100;
    const zeroMoa = typeof line.zero.elevationMoa === 'number' ? line.zero.elevationMoa : line.zero.elevationClicks * clickMoa;
    return Math.round((shotMoa - zeroMoa) * 100) / 100;
  }
  function comeUpText(line, clickMoa) {
    const up = comeUpMoa(line, clickMoa);
    if (line.zero) return `${Math.abs(up)} minutes of angle ${up >= 0 ? 'up' : 'down'} from the ${line.zero.zeroYards}-yard zero`;
    return `${Math.abs(up)} minutes of angle ${up >= 0 ? 'up' : 'down'} from the middle (no zero saved)`;
  }

  // --- the cold-bore record -----------------------------------------------------------------
  // The first shot of a day, when it is fired at a plate (not at the bench): one line per day, per rifle and load.
  const coldKey = (rifle, load) => `cold-bore:${rifle}:${load}`;
  const getColdBore = (rifle, load) => { const v = store.get(coldKey(rifle, load)); return Array.isArray(v) ? v : []; };
  function addColdBore(rifle, load, line) {
    const lines = getColdBore(rifle, load);
    if (lines.some((l) => l.id === line.id)) return true;
    lines.push(line);
    return store.set(coldKey(rifle, load), lines);
  }

  // --- a copy of everything, for moving the book between the phone and the computer ------------
  // The file holds every book page, the cold-bore records, the finished days
  // and the saved zeros on this device, each line with its rifle, sight and
  // load. Loading adds what this device lacks and never replaces or removes a
  // line already here. The shape: docs/RECORDS.md, "The copy file".
  const COPY_KIND = 'range-day copy';
  function makeCopy() {
    const keys = store.keys();
    const out = { kind: COPY_KIND, version: 1, savedAt: new Date().toISOString(), zeros: [], book: [], cold_bore: [], days: finishedDays() };
    if (keys === FAILED) return out;
    for (const k of keys) {
      const p = k.split(':');
      if (p[0] === 'zero' && p.length === 4) { const z = store.get(k); if (ok(z)) out.zeros.push({ rifle: p[1], sight: p[2], load: p[3], zeroYards: z.zeroYards, elevationClicks: z.elevationClicks, windageClicks: z.windageClicks, leafIx: z.leafIx ?? null, saved_on: z.savedAt || null }); }
      if (p[0] === 'zero' && p.length === 3) { const z = store.get(k); if (ok(z) && z.sight && !keys.includes(`zero:${p[1]}:${z.sight}:${p[2]}`)) out.zeros.push({ rifle: p[1], sight: z.sight, load: p[2], zeroYards: z.zeroYards, elevationClicks: z.elevationClicks, windageClicks: z.windageClicks, leafIx: z.leafIx ?? null, saved_on: z.savedAt || null }); }
      if (p[0] === 'book' && p.length === 4) { const b = store.get(k); if (Array.isArray(b)) for (const l of b) out.book.push({ rifle: p[1], sight: p[2], load: p[3], ...l }); }
      if (p[0] === 'cold-bore' && p.length === 3) { const b = store.get(k); if (Array.isArray(b)) for (const l of b) out.cold_bore.push({ rifle: p[1], load: p[2], ...l }); }
    }
    return out;
  }
  // The shape every line of a copy must have: field name to the kind of value.
  const SHAPES = {
    zeros: { rifle: 'string', sight: 'string', load: 'string', zeroYards: 'number', elevationClicks: 'number', windageClicks: 'number' },
    book: { rifle: 'string', sight: 'string', load: 'string', id: 'string', day: 'string', on: 'string', course: 'string', yards: 'number', elevationClicks: 'number', windageClicks: 'number', elevationMoa: 'number', windageMoa: 'number', leaf: 'number|null', zero: 'object|null', heldUpMoa: 'number', heldRightMoa: 'number', tempF: 'number', windCall: 'object|null', upIn: 'number', rightIn: 'number', struck: 'boolean', note: 'string' },
    cold_bore: { rifle: 'string', load: 'string', id: 'string', day: 'string', on: 'string', course: 'string', sight: 'string', yards: 'number', elevationClicks: 'number', windageClicks: 'number', leaf: 'number|null', windCall: 'object|null', tempF: 'number', hit: 'boolean', upIn: 'number|null', rightIn: 'number|null' },
    days: { id: 'string', startedAt: 'string', date: 'string', course: 'string', rifle: 'string', load: 'string', month: 'number', timeOfDay: 'string', shots: 'array', box: 'object', weather: 'object' },
  };
  // Inside a day: the box, the weather (with its three stretches of wind) and every shot.
  const DAY_SHAPES = {
    box: { size: 'number', left: 'number' },
    weather: { tempF: 'number', humidity: 'number', altitudeFt: 'number', pressureInHg: 'number', wind: 'array' },
    windStretch: { fromYards: 'number', toYards: 'number', speedMph: 'number', fromDegrees: 'number' },
    zero: { zeroYards: 'number', elevationClicks: 'number', windageClicks: 'number' }, // a book line's saved zero
    windCall: { from: 'string', mph: 'number' }, // a stated call; null is "not called"
    shot: { n: 'number', place: 'string', yards: 'number', elevationClicks: 'number', windageClicks: 'number', reached: 'boolean', upIn: 'number|null', rightIn: 'number|null' },
    lineShot: { hit: 'boolean', heldUpMoa: 'number', heldRightMoa: 'number' }, // a shot at steel has these too; a bench shot has no hit
  };
  const PLACES = ['bench', 'line'];
  const COPY_VERSIONS = [1];
  // Checks a whole copy before anything is written: throws an Error naming
  // the faulty field and what it must be, so a bad file loads nothing.
  function checkCopy(obj) {
    const notACopy = (why) => new Error(`This is not a Range Day copy: ${why}`);
    const isOne = (v, kind) => (kind === 'null' ? v === null : kind === 'array' ? Array.isArray(v) : kind === 'object' ? Boolean(v && typeof v === 'object' && !Array.isArray(v)) : (typeof v === kind && !(kind === 'number' && Number.isNaN(v))));
    const isKind = (v, kind) => kind.split('|').some((k) => isOne(v, k));
    const kindName = (kind) => kind.split('|').map((k) => (k === 'array' ? 'a list' : k === 'object' ? 'an object' : k === 'null' ? 'null' : `a ${k}`)).join(' or ');
    // Checks one record against a shape; `at` is its path in the file, for the message.
    const checkRecord = (rec, shape, at) => {
      if (!isKind(rec, 'object')) throw notACopy(`${at} is not a record (an object with ${Object.keys(shape).join(', ')}). Nothing was loaded.`);
      for (const [field, kind] of Object.entries(shape)) {
        const v = rec[field];
        if (!isKind(v, kind)) throw notACopy(`${at}.${field} is ${v === undefined ? 'missing' : JSON.stringify(v)}; it must be ${kindName(kind)}. Nothing was loaded.`);
      }
    };
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw notACopy('the file does not hold a record (an object with "kind", "version", "zeros", "book", "cold_bore" and "days").');
    if (obj.kind !== COPY_KIND) throw notACopy(`its "kind" is ${JSON.stringify(obj.kind)}, not "${COPY_KIND}".`);
    if (!COPY_VERSIONS.includes(obj.version)) throw notACopy(`its "version" is ${JSON.stringify(obj.version)}; this app reads version ${COPY_VERSIONS.join(', ')}.`);
    for (const k of ['zeros', 'book', 'cold_bore', 'days']) if (!Array.isArray(obj[k])) throw notACopy(`"${k}" is missing or not a list.`);
    for (const [list, shape] of Object.entries(SHAPES)) obj[list].forEach((rec, i) => checkRecord(rec, shape, `${list}[${i}]`));
    // Inside a book line: its saved zero and its wind call, where not null; inside a cold-bore line, its wind call.
    obj.book.forEach((l, i) => { if (l.zero) checkRecord(l.zero, DAY_SHAPES.zero, `book[${i}].zero`); if (l.windCall) checkRecord(l.windCall, DAY_SHAPES.windCall, `book[${i}].windCall`); });
    obj.cold_bore.forEach((l, i) => { if (l.windCall) checkRecord(l.windCall, DAY_SHAPES.windCall, `cold_bore[${i}].windCall`); });
    // A day's inside: the box, the weather and its wind, every shot.
    obj.days.forEach((day, i) => {
      const at = `days[${i}]`;
      checkRecord(day.box, DAY_SHAPES.box, `${at}.box`);
      if (day.box.opened !== undefined && !isKind(day.box.opened, 'number')) throw notACopy(`${at}.box.opened is ${JSON.stringify(day.box.opened)}; it must be a number (the boxes opened) or absent. Nothing was loaded.`);
      checkRecord(day.weather, DAY_SHAPES.weather, `${at}.weather`);
      if (day.weather.wind.length !== 3) throw notACopy(`${at}.weather.wind has ${day.weather.wind.length} stretches; it must have 3. Nothing was loaded.`);
      day.weather.wind.forEach((w, j) => checkRecord(w, DAY_SHAPES.windStretch, `${at}.weather.wind[${j}]`));
      if (!TIMES.includes(day.timeOfDay)) throw notACopy(`${at}.timeOfDay is ${JSON.stringify(day.timeOfDay)}; it must be one of ${TIMES.join(', ')}. Nothing was loaded.`);
      if (!(day.month >= 1 && day.month <= 12)) throw notACopy(`${at}.month is ${JSON.stringify(day.month)}; it must be 1 to 12. Nothing was loaded.`);
      day.shots.forEach((s, j) => {
        checkRecord(s, DAY_SHAPES.shot, `${at}.shots[${j}]`);
        if (!PLACES.includes(s.place)) throw notACopy(`${at}.shots[${j}].place is ${JSON.stringify(s.place)}; it must be one of ${PLACES.join(', ')}. Nothing was loaded.`);
        if (s.place === 'line') checkRecord(s, DAY_SHAPES.lineShot, `${at}.shots[${j}]`);
        // Where it landed: a shot that reached has both coordinates in inches; one that went into the ground has null for both.
        for (const f of ['upIn', 'rightIn']) {
          if (s.reached && typeof s[f] !== 'number') throw notACopy(`${at}.shots[${j}].${f} is ${JSON.stringify(s[f])}; a shot that reached must have it as a number. Nothing was loaded.`);
          if (!s.reached && s[f] !== null) throw notACopy(`${at}.shots[${j}].${f} is ${JSON.stringify(s[f])}; a shot that did not reach must have it as null. Nothing was loaded.`);
        }
      });
    });
    return true;
  }
  // Checks a parsed file whole, then adds what is missing. Throws an Error with the reason for a file that is not a copy; then nothing was written.
  function loadCopy(obj) {
    checkCopy(obj);
    const added = { zeros: 0, book: 0, cold_bore: 0, days: 0 };
    let failed = false;
    for (const z of obj.zeros) {
      if (ok(getZero(z.rifle, z.sight, z.load))) continue; // never replace a zero already here
      const rec = { elevationClicks: z.elevationClicks, windageClicks: z.windageClicks || 0, zeroYards: z.zeroYards, sight: z.sight, savedAt: z.saved_on || new Date().toISOString() };
      if (z.leafIx != null) rec.leafIx = z.leafIx;
      if (setZero(z.rifle, z.sight, z.load, rec)) added.zeros++; else failed = true;
    }
    for (const l of obj.book) {
      const { rifle, sight, load, ...line } = l;
      if (getBook(rifle, sight, load).some((x) => x.id === line.id)) continue;
      if (addBookLine(rifle, sight, load, line)) added.book++; else failed = true;
    }
    for (const l of obj.cold_bore) {
      const { rifle, load, ...line } = l;
      if (getColdBore(rifle, load).some((x) => x.id === line.id)) continue;
      if (addColdBore(rifle, load, line)) added.cold_bore++; else failed = true;
    }
    const days = finishedDays();
    const open = openDay();
    let changed = false;
    for (const d of obj.days) {
      if (days.some((x) => x.id === d.id) || (open && open.id === d.id)) continue;
      days.push(d); added.days++; changed = true;
    }
    if (changed) { days.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1)); if (!store.set('days', days)) failed = true; }
    return { added, failed };
  }

  // --- sounds, made in code ---------------------------------------------------------
  let ctx = null;
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function noise(seconds) {
    const c = audio(); if (!c) return null;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; return src;
  }
  // The shot: a sharp crack (noise, filtered) over a low thump.
  function shotSound(loudness = 1) {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const n = noise(0.5); if (!n) return;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.4);
    const g = c.createGain(); g.gain.setValueAtTime(0.9 * loudness, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    n.connect(f).connect(g).connect(c.destination); n.start(t);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const og = c.createGain(); og.gain.setValueAtTime(0.8 * loudness, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(og).connect(c.destination); o.start(t); o.stop(t + 0.4);
  }
  // Steel ringing: a few inharmonic partials, decaying, faint with distance.
  function ringSound(delayS, loudness = 1) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + Math.max(0, delayS);
    for (const [freq, amp, decay] of [[1180, 0.5, 1.6], [1870, 0.3, 1.2], [2740, 0.2, 0.8], [620, 0.25, 1.8]]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp * loudness, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + decay + 0.05);
    }
  }
  // A dull thud for a miss into the dirt, late by the sound's trip back.
  function thudSound(delayS, loudness = 0.4) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + Math.max(0, delayS);
    const n = noise(0.25); if (!n) return;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = c.createGain(); g.gain.setValueAtTime(loudness, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n.connect(f).connect(g).connect(c.destination); n.start(t);
  }
  // A turret click.
  function clickSound() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const n = noise(0.03); if (!n) return;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 2;
    const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    n.connect(f).connect(g).connect(c.destination); n.start(t);
  }

  // --- what the address asks for -----------------------------------------------------------
  // course, rifle, sight and load from the address (or from a pick on home,
  // with remembered: true); a missing or unknown piece falls back to the
  // last used with that rifle on this device, then to the rifle's own
  // record (an address without a sight opens the sight the rifle had
  // before every sight could be chosen, so old links still work; a new
  // device opens the first playable rifle in the set, on its first course).
  function chooseFrom(d, q) {
    const last = getLast();
    const ids = rifleIds(d);
    const rifleId = ids.includes(q.rifle) ? q.rifle : (last && ids.includes(last.rifle) ? last.rifle : ids[0]);
    const rifle = d.rifles[rifleId];
    const lastFor = getLastFor(rifleId) || {};
    const playableSights = rifle.sights.filter((s) => d.sights[s].kind !== 'magnifier');
    // An address naming a rifle but no sight (an old link, a bookmark) opens the rifle's default sight;
    // a pick on home (q.remembered) opens the sight last used with that rifle on this device.
    const sightId = playableSights.includes(q.sight) ? q.sight
      : (q.rifle && !q.sight && !q.remembered) ? rifle.defaultSight
      : (playableSights.includes(lastFor.sight) ? lastFor.sight : rifle.defaultSight);
    const loadId = rifle.loads.includes(q.load) ? q.load : (rifle.loads.includes(lastFor.load) ? lastFor.load : rifle.loads[0]);
    const courseId = d.courses[q.course] ? q.course : (d.courses[lastFor.course] ? lastFor.course : rifle.firstCourse);
    return { rifleId, sightId, loadId, courseId, magnifierId: rifle.sights.find((s) => d.sights[s].kind === 'magnifier') || null };
  }
  const params = (c) => `?course=${c.courseId}&rifle=${c.rifleId}&sight=${c.sightId}&load=${c.loadId}`;
  // Remember the choice, for next time on this device.
  function remember(c) { setLast({ rifle: c.rifleId }); setLastFor(c.rifleId, { sight: c.sightId, load: c.loadId, course: c.courseId }); }
  // The sliding rear leaf an iron sight has on this rifle (the rifle's record names a table where the sight has more than one), or null.
  function leafOf(d, rifleId, sightId) {
    const sight = d.sights[sightId];
    if (!sight || sight.kind !== 'iron') return null;
    const key = (d.rifles[rifleId].sightLeaf || {})[sightId] || 'leaf';
    return sight[key] || null;
  }

  // --- a knob: press for one step; press and hold to repeat, speeding up -------------------------------
  // The first step comes on the press (never on the click, so a tap is one
  // step, not two); from 400 ms on it repeats, each repeat a little faster,
  // down to about 30 steps a second. Enter or the space bar step once.
  function holdRepeat(button, step) {
    let timer = null;
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const go = (delay) => { timer = setTimeout(() => { step(); go(Math.max(30, delay * 0.75)); }, delay); };
    button.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); stop(); step(); go(400); try { button.setPointerCapture(e.pointerId); } catch {} });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(ev, stop);
    button.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(); } });
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // Wires the two knobs of a screen: a press moves one click; press and hold
  // repeats; a second, coarser pair moves one whole MOA where the click is
  // finer than that (hidden otherwise). The limits in the data stop the knob,
  // and `say` is given the sentence when it is at its stop. `apply(which,
  // nextClicks)` is the screen's own setter.
  function wireKnobs(doc, sight, getSetting, apply, say) {
    const $ = (id) => doc.getElementById(id);
    const limit = sight.clicks;
    const perMoa = (which) => Math.round(1 / (which === 'elevationClicks' ? sight.clickMoa : sight.windageClickMoa));
    const coarse = sight.clickMoa < 1 || sight.windageClickMoa < 1;
    for (const el of doc.querySelectorAll('.pair.coarse')) el.hidden = !coarse;
    const turn = (which, delta) => {
      const cur = getSetting()[which] || 0;
      let next = Math.max(-limit, Math.min(limit, cur + delta));
      const name = which === 'elevationClicks' ? 'elevation' : 'windage';
      if (next === cur) { say(`The ${name} knob is at the end of its travel (${limit} clicks, ${moaOf(limit, which === 'elevationClicks' ? sight.clickMoa : sight.windageClickMoa)} MOA from the middle).`); return; }
      apply(which, next);
      if (Math.abs(next) === limit) say(`The ${name} knob is now at the end of its travel (${limit} clicks).`);
    };
    holdRepeat($('el-up'), () => turn('elevationClicks', 1));
    holdRepeat($('el-down'), () => turn('elevationClicks', -1));
    holdRepeat($('wd-right'), () => turn('windageClicks', 1));
    holdRepeat($('wd-left'), () => turn('windageClicks', -1));
    if (coarse) {
      holdRepeat($('el-up-moa'), () => turn('elevationClicks', perMoa('elevationClicks')));
      holdRepeat($('el-down-moa'), () => turn('elevationClicks', -perMoa('elevationClicks')));
      holdRepeat($('wd-right-moa'), () => turn('windageClicks', perMoa('windageClicks')));
      holdRepeat($('wd-left-moa'), () => turn('windageClicks', -perMoa('windageClicks')));
    }
    return turn;
  }

  // The wind-call control on the firing line: four buttons for where the
  // wind comes from (none, left, right, not called) and a pair for how
  // strong, in miles an hour. It starts at the last call on this device;
  // `onChange` is told each change. The call is read with getWindCall().
  function wireWindCall(doc, onChange) {
    const $ = (id) => doc.getElementById(id);
    let call = getWindCall();
    const show = () => {
      for (const b of doc.querySelectorAll('[data-wind-from]')) b.classList.toggle('on', (b.dataset.windFrom === 'null' ? null : b.dataset.windFrom) === call.from);
      $('wind-mph-row').hidden = !(call.from === 'left' || call.from === 'right');
      $('wind-mph').textContent = `${call.mph} mph`;
      $('wind-call-text').textContent = `Wind as you read it: ${windCallText(call)}.`;
    };
    const change = (next) => { call = next; setWindCall(call); show(); if (onChange) onChange(call); };
    for (const b of doc.querySelectorAll('[data-wind-from]')) b.addEventListener('click', () => change({ ...call, from: b.dataset.windFrom === 'null' ? null : b.dataset.windFrom }));
    holdRepeat($('wind-less'), () => { if (call.mph > 0) change({ ...call, mph: call.mph - 1 }); });
    holdRepeat($('wind-more'), () => { if (call.mph < 40) change({ ...call, mph: call.mph + 1 }); });
    show();
    return () => call;
  }

  // --- helpers -------------------------------------------------------------------------
  const qs = () => Object.fromEntries(new URLSearchParams(location.search));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  const moaOf = (clicks, per) => Math.round(clicks * per * 100) / 100;
  // "+12 clicks (3 MOA up)"
  function clicksText(clicks, per, upWord, downWord) {
    if (!clicks) return '0 clicks (middle)';
    return `${sign(clicks)} clicks (${moaOf(Math.abs(clicks), per)} MOA ${clicks > 0 ? upWord : downWord})`;
  }
  // The one line under the view: "Elevation +12 clicks (3 MOA up) · Windage 0 clicks (middle)" plus the leaf or the magnifier.
  function settingLine(setting, sight, extra) {
    const parts = [`Elevation ${clicksText(setting.elevationClicks, sight.clickMoa, 'up', 'down')}`, `Windage ${clicksText(setting.windageClicks, sight.windageClickMoa, 'right', 'left')}`];
    if (extra) parts.push(extra);
    return parts.join(' · ');
  }
  // "14 of 20 rounds left", "the box is empty: the day is over"
  const roundsText = (day) => (!day ? '' : day.box.left > 0 ? `${day.box.left} of ${day.box.size} rounds left${boxesOpened(day) > 1 ? ` (box ${boxesOpened(day)})` : ''}` : `the box of ${day.box.size} is empty`);
  const boxesText = (day) => (boxesOpened(day) > 1 ? `${boxesOpened(day)} boxes of ${day.box.size}` : `a box of ${day.box.size}`);
  // A leaf setting's name: "3 (300 m)", or "П (300 m, the battle setting)".
  function leafText(leaf, ix) {
    const m = leaf.settingsMeters[ix];
    const battle = leaf.battleSettingMeters === m ? ', the "П" battle setting' : '';
    return `${m / 100} (${m} m${battle})`;
  }
  // "7 in low, 12 in right" from an offset in inches against the aim point
  function whereText(upIn, rightIn) {
    const v = Math.abs(upIn) < 0.5 ? 'level' : `${Math.abs(upIn).toFixed(upIn > 10 ? 0 : 1)} in ${upIn > 0 ? 'high' : 'low'}`;
    const h = Math.abs(rightIn) < 0.5 ? 'centered' : `${Math.abs(rightIn).toFixed(Math.abs(rightIn) > 10 ? 0 : 1)} in ${rightIn > 0 ? 'right' : 'left'}`;
    return `${v}, ${h}`;
  }
  // "0.5 high, 1.2 right (MOA)" from a hold in minutes of angle
  const heldText = (up, right) => ((Math.abs(up) < 0.3 && Math.abs(right) < 0.3) ? 'center' : `${Math.abs(up).toFixed(1)} ${up > 0 ? 'high' : 'low'}, ${Math.abs(right).toFixed(1)} ${right > 0 ? 'right' : 'left'} (MOA)`);
  // "17 Nov 2026" from a date string
  const dateText = (iso) => { const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso); return Number.isNaN(d.getTime()) ? iso : `${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };
  const windWord = (deg) => {
    const d = ((deg % 360) + 360) % 360;
    if (d < 22.5 || d >= 337.5) return 'head-on';
    if (d < 67.5) return 'from the front right';
    if (d < 112.5) return 'from the right';
    if (d < 157.5) return 'from the back right';
    if (d < 202.5) return 'from behind';
    if (d < 247.5) return 'from the back left';
    if (d < 292.5) return 'from the left';
    return 'from the front left';
  };
  // The crosswind part, in mph, positive pushing the bullet right (wind from the left).
  const crosswindMph = (stretch) => -stretch.speedMph * Math.sin((stretch.fromDegrees * Math.PI) / 180);
  // Field of view, in MOA across the view, at a magnification between the sight's low and high.
  function fovMoa(sight, mag) {
    const lo = sight.zoom.low, hi = sight.zoom.high;
    const ft = hi === lo ? sight.fovFtAt100.low : sight.fovFtAt100.low * (lo / mag); // a scope's field shrinks with magnification
    return (ft * 12) / E.inchesPerMoa(100);
  }
  // Fits a square canvas to its container, at the device's pixel ratio.
  function fitCanvas(canvas, maxPx) {
    const w = Math.min(canvas.parentElement.clientWidth, maxPx || 640);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, size: w };
  }
  // A small seeded random for the drawn terrain, so a course looks the same each visit.
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  // Hands the browser a file to save.
  function download(name, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  return { E, data, rifleIds, store, getSight, sightReadFailed, setSight, getZero, setZero, getLog, setLog, zeroCount, getLast, setLast, getLastFor, setLastFor, getWhen, setWhen, thisMonth, TIMES, MONTHS, getWindCall, setWindCall, windCallText, wireWindCall, chooseFrom, params, remember, leafOf, holdRepeat, wireKnobs, settingLine, roundsText, leafText, showConditions, setShowConditions, PICTURES, getPicture, pictureReadFailed, setPicture, drawDay, conditionsOf, dayWords, localDate, openDay, dayReadFailed, hasShots, finishedDays, dayById, startDay, enterDay, takeRounds, openAnotherBox, boxesOpened, roundsFired, boxesText, getSupply, supplyReadFailed, takeSupply, openSupplyBox, supplyText, recordShot, finishDay, packUp, packedDayId, restorePacked, bookKey, getBook, bookReadFailed, addBookLine, changeBookLine, bookAt, bookNeighbours, newestFirst, comeUpMoa, comeUpText, getColdBore, addColdBore, makeCopy, checkCopy, loadCopy, COPY_KIND, audio, shotSound, ringSound, thudSound, clickSound, qs, esc, sign, moaOf, clicksText, whereText, heldText, dateText, windWord, crosswindMph, fovMoa, fitCanvas, hash, download };
}());
