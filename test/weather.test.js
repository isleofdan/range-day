'use strict';
// Days that differ: the weather data's shape, the draw (public/game.js,
// drawDay, run here with a seeded random so a day repeats), the table the
// brief asks for (verify 2), and what a cold and a hot day do to a bullet
// through the engine, with and without the muzzle-speed rule (verify 2, 3).
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('../public/engine.js');
const { raw, flat } = require('../lib/data').load();

// public/game.js is a browser script; run it here with a window that has the engine and nothing else.
function loadRD() {
  const window = { RangeDayEngine: E };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'game.js'), 'utf8'), { window, localStorage: undefined, document: undefined, performance: { now: () => 0 } });
  return window.RD;
}
const RD = loadRD();
const W = flat.weather;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const course = (id) => ({ id, ...flat.courses[id] });

test('each course has twelve months with a low under its high, a humidity, a wind and a Santa Ana chance that is zero from May to August', () => {
  for (const id of ['angeles-sylmar', 'cta-piru']) {
    const months = W.courses[id].months;
    assert.equal(months.length, 12, id);
    months.forEach((m, i) => {
      assert.equal(m.name, MONTHS[i]);
      assert.ok(m.lowF < m.highF - 10, `${id} ${m.name}: low ${m.lowF} under high ${m.highF}`);
      assert.ok(m.humidity > 0.3 && m.humidity < 0.7, `${id} ${m.name}: humidity ${m.humidity}`);
      assert.ok(m.windMph > 3 && m.windMph < 12, `${id} ${m.name}: wind ${m.windMph}`);
      assert.ok(m.santaAnaChance >= 0 && m.santaAnaChance <= 0.25);
      if (i >= 4 && i <= 7) assert.equal(m.santaAnaChance, 0, `${id} ${m.name}: no Santa Ana days in summer`);
    });
    assert.ok(months[6].highF > months[0].highF + 20, `${id}: July is far warmer than January`);
    assert.ok(months[11].windMph > months[7].windMph, `${id}: December is windier than August on average`);
  }
  for (const t of ['morning', 'midday', 'afternoon']) assert.equal(W.timesOfDay[t].name, t);
  assert.ok(W.timesOfDay.morning.windFactor < W.timesOfDay.midday.windFactor && W.timesOfDay.midday.windFactor < W.timesOfDay.afternoon.windFactor, 'mornings calmer, afternoons windier');
  assert.ok(W.timesOfDay.morning.tempAt < W.timesOfDay.afternoon.tempAt);
  assert.ok(W.santaAna.windMph.low >= 15 && W.santaAna.humidity.high <= 0.2);
  // Every month's temperature and wind figure carries its page.
  for (const id of ['angeles-sylmar', 'cta-piru']) for (const m of raw.weather.courses[id].months) {
    assert.match(m.lowF.source.url, /^https:\/\//); assert.match(m.highF.source.url, /^https:\/\//); assert.match(m.windMph.source.url, /^https:\/\/weatherspark\.com\//);
  }
});

test('drawDay takes the month, the time of day and a random source: the same seed draws the same day, and the day carries them', () => {
  const a = RD.drawDay(course('cta-piru'), W, 7, 'afternoon', E.seeded(5));
  const b = RD.drawDay(course('cta-piru'), W, 7, 'afternoon', E.seeded(5));
  assert.deepStrictEqual(a, b);
  assert.equal(a.month, 7); assert.equal(a.timeOfDay, 'afternoon'); assert.equal(a.course, 'cta-piru');
  assert.equal(a.wind.length, 3);
  for (const w of a.wind) { const d = ((w.fromDegrees % 360) + 360) % 360; assert.ok((d > 0 && d < 180) || (d > 180 && d < 360), 'always some crosswind'); assert.ok(w.gustMph > 0); }
  const c = RD.drawDay(course('cta-piru'), W, 1, 'morning', E.seeded(5));
  assert.ok(c.tempF < a.tempF - 20, `a January morning (${c.tempF} F) is far colder than a July afternoon (${a.tempF} F)`);
  assert.match(RD.dayWords(a, W), /^A (warm|hot)(, dry)? July afternoon, \d+ F\.$/);
  assert.match(RD.dayWords(c, W), /^A (cold|cool)(, dry)? January morning, \d+ F\.$/);
});

// The band a day is drawn from, by the data's own rule (no random part).
function band(courseId, month, tod, santaAna) {
  const m = W.courses[courseId].months[month - 1], t = W.timesOfDay[tod];
  const mid = m.lowF + t.tempAt * (m.highF - m.lowF) + (santaAna ? W.santaAna.tempAboveNormalF : 0);
  const temp = [Math.round(mid - W.dayToDaySpreadF), Math.round(mid + W.dayToDaySpreadF)];
  const wind = santaAna ? [W.santaAna.windMph.low * W.santaAna.windFactorByTime[tod], W.santaAna.windMph.high * W.santaAna.windFactorByTime[tod]] : [m.windMph * t.windFactor * W.windSpread.low, m.windMph * t.windFactor * W.windSpread.high];
  return { temp, wind: wind.map((x) => Math.round(x * 10) / 10), chance: m.santaAnaChance };
}

test('verify 2: the table of days, and a January morning\'s highest temperature is below a July afternoon\'s lowest on both courses', () => {
  const lines = [];
  for (const id of ['angeles-sylmar', 'cta-piru']) {
    lines.push(`${flat.courses[id].name}:`);
    const src = raw.weather.courses[id].months;
    for (const month of [1, 4, 7, 10]) for (const tod of ['morning', 'afternoon']) {
      const b = band(id, month, tod, false);
      const sa = band(id, month, tod, true);
      lines.push(`  ${MONTHS[month - 1]} ${tod}: ${b.temp[0]} to ${b.temp[1]} F, wind ${b.wind[0]} to ${b.wind[1]} mph${b.chance ? `; a Santa Ana day with chance ${b.chance}: ${sa.temp[0]} to ${sa.temp[1]} F, wind ${sa.wind[0]} to ${sa.wind[1]} mph` : ''}`);
    }
    lines.push(`  temperatures: ${src[0].lowF.source.url}${src[6].lowF.source.url !== src[0].lowF.source.url ? ` (January to June) and ${src[6].lowF.source.url} (July to December)` : ''}; wind: ${src[0].windMph.source.url}; the time-of-day shares and the spread: estimates in data/weather.json`);
    const janMorning = band(id, 1, 'morning', true), julAfternoon = band(id, 7, 'afternoon', false);
    assert.ok(janMorning.temp[1] < julAfternoon.temp[0], `${id}: January morning at most ${janMorning.temp[1]} F (even a Santa Ana one), July afternoon at least ${julAfternoon.temp[0]} F`);
  }
  console.log('  ' + lines.join('\n  '));
});

test('verify 2 and 3: what the coldest and the hottest day do to a bullet, through the engine, with and without the muzzle-speed rule; a load\'s speed at 40, 59 and 100 F', () => {
  // The coldest and hottest temperatures the data can draw, over both courses, every month, every time of day, Santa Ana days included.
  let coldest = Infinity, hottest = -Infinity;
  for (const id of ['angeles-sylmar', 'cta-piru']) for (let m = 1; m <= 12; m++) for (const t of ['morning', 'midday', 'afternoon']) for (const sa of [false, true]) {
    if (sa && !W.courses[id].months[m - 1].santaAnaChance) continue;
    const b = band(id, m, t, sa); coldest = Math.min(coldest, b.temp[0]); hottest = Math.max(hottest, b.temp[1]);
  }
  const powder = flat.physics.powderTemperature;
  const lines = [`coldest day the data can draw ${coldest} F, hottest ${hottest} F`];
  const drag = flat.physics.dragTables;
  const cases = [
    { name: 'Sellier & Bellot 174 gr at 1,000 yards (canyon course, 850 ft, 0.25 humidity)', load: flat.loads['sb-174-hpbt'], yards: 1000, altitudeFt: 850, sightHeightIn: 3 },
    { name: 'IMI M193 at 500 yards (rifle line, 1,500 ft, 0.25 humidity)', load: flat.loads['imi-m193'], yards: 500, altitudeFt: 1500, sightHeightIn: 2.6 },
  ];
  for (const c of cases) {
    const drop = (tempF, withPowder) => {
      const base = { load: c.load, drag, sightHeightIn: c.sightHeightIn, conditions: { altitudeFt: c.altitudeFt, tempF, humidity: 0.25 }, wind: [], targetYards: c.yards, ...(withPowder ? { powder } : {}) };
      const r = E.fly({ ...base, elevationMoa: 0, windageMoa: 0 });
      return -r.hit.upIn / E.inchesPerMoa(c.yards); // the drop below the line of sight, in MOA, with the bore level with it
    };
    for (const withPowder of [false, true]) {
      const cold = drop(coldest, withPowder), hot = drop(hottest, withPowder);
      lines.push(`${c.name}, ${withPowder ? 'with' : 'without'} the muzzle-speed rule: drop ${cold.toFixed(2)} MOA at ${coldest} F, ${hot.toFixed(2)} MOA at ${hottest} F, a difference of ${(cold - hot).toFixed(2)} MOA`);
      assert.ok(cold > hot, 'the cold day drops more');
    }
    const withRule = drop(coldest, true) - drop(hottest, true), without = drop(coldest, false) - drop(hottest, false);
    assert.ok(withRule > without, 'the muzzle-speed rule adds to the air\'s own effect');
  }
  // Verify 3: the figure, its source, the reference temperature; a load's speed at 40, 59 and 100 F.
  const m193 = flat.loads['imi-m193'];
  const at = (t) => E.muzzleSpeed(m193, E.air({ altitudeFt: 0, tempF: t }), powder);
  lines.push(`muzzle-speed rule: ${powder.fpsPerDegreeF} fps per degree F from ${powder.referenceTempF} F (an estimate; basis in data/physics.json, powderTemperature); IMI M193 (${m193.muzzleFps} fps published): ${at(40).toFixed(0)} fps at 40 F, ${at(59).toFixed(0)} at 59 F, ${at(100).toFixed(0)} at 100 F`);
  assert.equal(at(70), m193.muzzleFps);
  assert.equal(at(40), m193.muzzleFps - 30);
  assert.equal(at(100), m193.muzzleFps + 30);
  assert.equal(E.muzzleSpeed(m193, E.air({ tempF: 40 }), undefined), m193.muzzleFps, 'without a powder figure the speed is the load\'s');
  assert.match(raw.physics.powderTemperature.fpsPerDegreeF.estimate, /precisionrifleblog|americanhunter/);
  console.log('  ' + lines.join('\n  '));
});

test('the book\'s order and come-up: lines sort newest first by the moment and the shot number, not as text; the come-up counts the leaf; a bad copy is refused whole', () => {
  const lines = [9, 10, 2, 11].map((n) => ({ id: `d:${n}`, n, day: 'd', on: '2026-11-17', at: `2026-11-17T10:00:${String(n).padStart(2, '0')}.000Z` }));
  assert.deepEqual(lines.slice().sort(RD.newestFirst).map((l) => l.n), [11, 10, 9, 2]);
  const old = [9, 10].map((n) => ({ id: `d:${n}`, on: '2026-11-16' })); // lines from an older copy: no `at`, no `n`
  assert.deepEqual([...old, lines[2]].sort(RD.newestFirst).map((l) => l.id), ['d:2', 'd:10', 'd:9']);
  // The AK's irons: 2 MOA clicks; the leaf at 3 is 7.04 MOA above the leaf at 1. Zeroed at 100 with the leaf at 1 and +2 clicks; the hit at 300 with the leaf at 3 and the same clicks.
  const leaf = flat.sights['ak-irons'].leaf;
  const zero = { zeroYards: 100, elevationClicks: 2, windageClicks: 0, leafIx: 0, leaf: 100, elevationMoa: 2 * 2 + leaf.moaAbove100[0].moaAbove100 };
  const line = { elevationClicks: 2, windageClicks: 0, leaf: 300, elevationMoa: 2 * 2 + leaf.moaAbove100[2].moaAbove100, zero };
  assert.equal(RD.comeUpMoa(line, 2), Math.round(leaf.moaAbove100[2].moaAbove100 * 100) / 100, 'the leaf\'s angle is the come-up when the clicks are the same');
  assert.match(RD.comeUpText(line, 2), /minutes of angle up from the 100-yard zero$/);
  assert.equal(RD.comeUpMoa({ elevationClicks: 3, elevationMoa: 6, zero: { zeroYards: 100, elevationClicks: 1 } }, 2), 4, 'a zero from an older copy without elevationMoa counts clicks');
  assert.equal(RD.comeUpMoa({ elevationClicks: -1, elevationMoa: -2, zero: null }, 2), -2, 'no zero: from the middle');
  const good = { kind: 'range-day copy', version: 1, zeros: [], book: [{ rifle: 'a', sight: 'b', load: 'c', id: 'd:1', on: '2026-11-17', course: 'x', yards: 100, elevationClicks: 0, windageClicks: 0, upIn: 0, rightIn: 0 }], cold_bore: [], days: [] };
  assert.equal(RD.checkCopy(good), true);
  assert.throws(() => RD.checkCopy({ ...good, version: 3 }), /its "version" is 3; this app reads version 1/);
  assert.throws(() => RD.checkCopy({ ...good, book: [{ ...good.book[0], hit: true, yards: undefined }] }), /book\[0\]\.yards is missing; it must be a number\. Nothing was loaded\./);
  assert.throws(() => RD.checkCopy({ ...good, days: [5] }), /days\[0\] is not a record/);
  // A day's inside is checked too: the box, the weather with its three stretches of wind, every shot.
  const day = RD.startDay({ courses: flat.courses, weather: W, loads: flat.loads }, { courseId: 'cta-piru', rifleId: 'molot-vepr-54r', loadId: 'sb-174-hpbt', sightId: 'utg-2-7x44' }, 7, 'afternoon', E.seeded(3)).day;
  day.shots.push({ n: 1, place: 'line', yards: 600, elevationClicks: 20, windageClicks: 0, hit: false, reached: true });
  assert.equal(RD.checkCopy({ ...good, days: [day] }), true, 'a real day passes');
  const with_ = (change) => { const d = JSON.parse(JSON.stringify(day)); change(d); return { ...good, days: [d] }; };
  assert.throws(() => RD.checkCopy(with_((d) => { d.shots = [null]; })), /days\[0\]\.shots\[0\] is not a record/);
  assert.throws(() => RD.checkCopy(with_((d) => { d.box = {}; })), /days\[0\]\.box\.size is missing; it must be a number\. Nothing was loaded\./);
  assert.throws(() => RD.checkCopy(with_((d) => { d.weather = {}; })), /days\[0\]\.weather\.tempF is missing; it must be a number/);
  assert.throws(() => RD.checkCopy(with_((d) => { d.weather.wind = [d.weather.wind[0]]; })), /weather\.wind has 1 stretches; it must have 3/);
  assert.throws(() => RD.checkCopy(with_((d) => { d.weather.wind[1].speedMph = 'fresh'; })), /weather\.wind\[1\]\.speedMph is "fresh"; it must be a number/);
  assert.throws(() => RD.checkCopy(with_((d) => { d.shots[0].place = 'car park'; })), /shots\[0\]\.place is "car park"; it must be one of bench, line/);
  assert.throws(() => RD.checkCopy(with_((d) => { d.shots[0].yards = '600'; })), /shots\[0\]\.yards is "600"; it must be a number/);
  assert.throws(() => RD.checkCopy(with_((d) => { d.timeOfDay = 'night'; })), /timeOfDay is "night"; it must be one of morning, midday, afternoon/);
});

test('a shot through shoot() with the powder figure starts at the day\'s speed and reports it', () => {
  const r = E.shoot({ load: flat.loads['imi-m193'], drag: flat.physics.dragTables, powder: flat.physics.powderTemperature, rifle: { sightHeightIn: 2.6, boreOffsetMoa: { up: 0, right: 0 } }, sight: { clickMoa: 1, elevationClicks: 5, windageClicks: 0 }, targetYards: 300, conditions: { altitudeFt: 0, tempF: 100 }, wind: [], rand: E.seeded(1) });
  assert.equal(Math.round(r.muzzleFps), flat.loads['imi-m193'].muzzleFps + 30);
});

test('every load has a box, 15 to 50 rounds, with its page or its basis', () => {
  for (const [id, l] of Object.entries(flat.loads)) {
    if (id.startsWith('_')) continue;
    assert.ok([15, 20, 50].includes(l.boxCount), `${id}: box of ${l.boxCount}`);
    const r = raw.loads[id].boxCount;
    assert.ok((r.source && /^https:\/\//.test(r.source.url)) || (r.estimate && r.estimate.length > 20), `${id}: the box has a source or a basis`);
  }
  assert.equal(flat.loads['yugo-m67'].boxCount, 15);
  assert.equal(flat.loads['cci-sv-40'].boxCount, 50);
  console.log('  ' + Object.entries(flat.loads).filter(([id]) => !id.startsWith('_')).map(([id, l]) => `${id}: box of ${l.boxCount} (${raw.loads[id].boxCount.source ? raw.loads[id].boxCount.source.url : 'estimate'})`).join('\n  '));
});
