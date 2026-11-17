'use strict';
// The one physics engine (public/engine.js), checked against the makers'
// own published tables and for the behaviors the game relies on. The
// numbers these print go into the field report's "Verify" section.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const E = require('../public/engine.js');
const { flat } = require('../lib/data').load();

const drag = flat.physics.dragTables;
const ICAO = { altitudeFt: 0, tempF: 59, pressureInHg: 29.92, humidity: 0 };
const moa = (inches, yards) => inches / E.inchesPerMoa(yards);

test('standard air: ICAO sea level density, and thinner air higher up and warmer', () => {
  const a = E.air(ICAO);
  assert.ok(Math.abs(a.density - 0.0764742) < 0.0003, `density ${a.density}`);
  assert.ok(Math.abs(a.mach1 - 1116.4) < 1, `speed of sound ${a.mach1}`);
  assert.ok(E.air({ altitudeFt: 5000, tempF: 59 }).density < a.density);
  assert.ok(E.air({ altitudeFt: 0, tempF: 95 }).density < a.density);
  assert.ok(E.air({ altitudeFt: 0, tempF: 59, pressureInHg: 29.92, humidity: 1 }).density < a.density, 'humid air is thinner');
});

// Sellier & Bellot 174 gr HPBT 7.62x54R: the maker's own table, 100 m zero,
// published to 1,000 m (data/loads.json, sb-174-hpbt, makerFps note).
const SB = { 50: -0.4, 100: 0, 200: -13.6, 300: -49.3, 400: -111.3, 500: -204.7, 600: -336, 700: -515, 800: -751, 900: -1060, 1000: -1459 };
const SB_V = { 100: 727, 200: 668, 300: 612, 400: 559 };
test('reference 1: S&B 174 gr 7.62x54R against the maker\'s table, G7 0.240, within 0.2 MOA to 600 yd and 0.5 at 1,000 yd', () => {
  const load = { muzzleFps: 788 / 0.3048, bc: 0.240, dragModel: 'G7' };
  const base = { load, drag, conditions: ICAO, wind: [], sightHeightIn: 2.0 };
  const el = E.zeroElevationMoa(base, 100 / 0.9144);
  const lines = [];
  for (const m of Object.keys(SB).map(Number)) {
    const yards = m / 0.9144;
    const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: yards });
    const diff = moa(r.hit.upIn - SB[m] / 2.54, yards);
    lines.push(`${m} m: engine ${(r.hit.upIn * 2.54).toFixed(1)} cm, S&B ${SB[m]} cm, ${diff.toFixed(2)} MOA`);
    assert.ok(Math.abs(diff) <= (yards <= 600 ? 0.2 : 0.5), lines[lines.length - 1]);
    if (SB_V[m]) assert.ok(Math.abs(r.speedFps * 0.3048 - SB_V[m]) < 3, `${m} m speed ${(r.speedFps * 0.3048).toFixed(0)} vs ${SB_V[m]} m/s`);
  }
  console.log('  S&B 174 gr (G7 0.240, sight 2.0 in, 100 m zero):\n    ' + lines.join('\n    '));
});

// The same load on S&B's US page, in yards with a 100 yd zero: rows at the brief's own distances.
const SB_YD = { 100: 0, 300: -15.1, 600: -104, 1000: -439 };
test('reference 1, in yards: S&B\'s US-page table at 100, 300, 600 and 1,000 yd, with the engine\'s 10 mph drift beside it (S&B publish no drift)', () => {
  const load = { muzzleFps: 2585, bc: 0.240, dragModel: 'G7' };
  const base = { load, drag, conditions: ICAO, wind: [], sightHeightIn: 2.0 };
  const el = E.zeroElevationMoa(base, 100);
  const lines = [];
  for (const y of Object.keys(SB_YD).map(Number)) {
    const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: y });
    const w = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: y, wind: [{ fromYards: 0, toYards: 2000, speedMph: 10, fromDegrees: 270 }] });
    const diff = moa(r.hit.upIn - SB_YD[y], y);
    lines.push(`${y} yd: drop ${r.hit.upIn.toFixed(1)} vs S&B ${SB_YD[y]} in (${diff.toFixed(2)} MOA); engine drift ${w.hit.rightIn.toFixed(1)} in; ${r.speedFps.toFixed(0)} fps`);
    assert.ok(Math.abs(diff) <= (y <= 600 ? 0.2 : 0.5), lines[lines.length - 1]);
  }
  console.log('  S&B 174 gr, yards table (100 yd zero):\n    ' + lines.join('\n    '));
});

test('reference 1, note: with S&B\'s G1 figure the same table is matched only to 700 m; the G7 figure is the one their table follows', () => {
  const load = { muzzleFps: 788 / 0.3048, bc: 0.477, dragModel: 'G1' };
  const base = { load, drag, conditions: ICAO, wind: [], sightHeightIn: 2.0 };
  const el = E.zeroElevationMoa(base, 100 / 0.9144);
  const at = (m) => moa(E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: m / 0.9144 }).hit.upIn - SB[m] / 2.54, m / 0.9144);
  assert.ok(Math.abs(at(600)) < 0.1);
  assert.ok(Math.abs(at(1000)) > 0.5);
});

// Federal GM223M 69 gr: Federal's table, 200 yd zero, sights 1.5 in, 10 mph crosswind.
const FED = { 100: [1.7, 1.0, 2642], 200: [0, 4.3, 2353], 300: [-8.1, 10.3, 2084], 400: [-24.1, 19.3, 1832], 500: [-51.0, 32.4, 1604] };
test('reference 2: Federal 69 gr 5.56 against Federal\'s table, G1 0.301, drop and 10 mph drift within 0.2 MOA to 500 yd (Federal publishes no farther)', () => {
  const load = { muzzleFps: 2950, bc: 0.301, dragModel: 'G1' };
  const base = { load, drag, conditions: ICAO, sightHeightIn: 1.5 };
  const el = E.zeroElevationMoa({ ...base, wind: [] }, 200);
  const lines = [];
  for (const y of Object.keys(FED).map(Number)) {
    const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: y, wind: [{ fromYards: 0, toYards: 2000, speedMph: 10, fromDegrees: 270 }] });
    const [drop, drift, v] = FED[y];
    const dd = moa(r.hit.upIn - drop, y), dw = moa(r.hit.rightIn - drift, y);
    lines.push(`${y} yd: drop ${r.hit.upIn.toFixed(1)} vs ${drop} in (${dd.toFixed(2)} MOA), drift ${r.hit.rightIn.toFixed(1)} vs ${drift} in (${dw.toFixed(2)} MOA), ${r.speedFps.toFixed(0)} vs ${v} fps`);
    assert.ok(Math.abs(dd) <= 0.2 && Math.abs(dw) <= 0.2, lines[lines.length - 1]);
    assert.ok(Math.abs(r.speedFps - v) < 25, lines[lines.length - 1]);
  }
  console.log('  Federal GM223M (G1 0.301, sight 1.5 in, 200 yd zero, 10 mph from the left):\n    ' + lines.join('\n    '));
});

test('wind from the left pushes the bullet right; a wind only in the far stretch moves it less than the same wind all the way', () => {
  const load = flat.loads['sb-174-hpbt'];
  const base = { load, drag, conditions: ICAO, sightHeightIn: 3, elevationMoa: 30, windageMoa: 0, targetYards: 1000 };
  const all = E.fly({ ...base, wind: [{ fromYards: 0, toYards: 2000, speedMph: 10, fromDegrees: 270 }] });
  const far = E.fly({ ...base, wind: [{ fromYards: 0, toYards: 700, speedMph: 0, fromDegrees: 270 }, { fromYards: 700, toYards: 2000, speedMph: 10, fromDegrees: 270 }] });
  const none = E.fly({ ...base, wind: [] });
  assert.ok(all.hit.rightIn > 60, `drift ${all.hit.rightIn}`);
  assert.ok(far.hit.rightIn > 0 && far.hit.rightIn < all.hit.rightIn / 2, `far-only drift ${far.hit.rightIn}`);
  assert.ok(Math.abs(none.hit.rightIn) < 0.01);
  const right = E.fly({ ...base, wind: [{ fromYards: 0, toYards: 2000, speedMph: 10, fromDegrees: 90 }] });
  assert.ok(Math.abs(right.hit.rightIn + all.hit.rightIn) < 0.5, 'mirror');
});

test('uphill is geometry: the 1,000-yard plate 200 ft up needs less elevation than level, and gravity is unchanged', () => {
  const load = flat.loads['sb-174-hpbt'];
  const base = { load, drag, conditions: { altitudeFt: 850, tempF: 85, humidity: 0.25 }, sightHeightIn: 3, wind: [], targetYards: 1000 };
  const el = E.zeroElevationMoa(base, 100);
  const level = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetRiseFt: 0 });
  const up = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetRiseFt: 200 });
  console.log(`  1,000 yd, S&B 174 gr from the Vepr, 100 yd zero: level ${level.hit.upIn.toFixed(1)} in (${moa(level.hit.upIn, 1000).toFixed(2)} MOA); 200 ft up ${up.hit.upIn.toFixed(1)} in (${moa(up.hit.upIn, 1000).toFixed(2)} MOA); flight ${level.timeS.toFixed(2)} s, ${level.speedFps.toFixed(0)} fps at the plate, Mach ${level.mach.toFixed(2)}`);
  assert.ok(up.hit.upIn > level.hit.upIn, 'uphill shot lands higher against the line of sight');
  assert.ok(up.hit.upIn - level.hit.upIn < 8, 'but only a little: the slope is 3.8 degrees');
  assert.ok(Math.abs(up.lineOfSightAngle - Math.atan2(200, 3000)) < 1e-9);
});

test('verify 3, the Tavor dot\'s height: M193 zeroed at 50 yd, where it crosses the line of sight again across the sources\' band, and at the data\'s 3.89 in', () => {
  const load = flat.loads['imi-m193'];
  const base = { load, drag, conditions: ICAO, wind: [] };
  const lines = [];
  for (const sh of [2.6, 3.0, 3.21, 3.75, 3.89]) {
    const el = E.zeroElevationMoa({ ...base, sightHeightIn: sh }, 50);
    const x = E.secondCrossingYards({ ...base, sightHeightIn: sh }, el, 600);
    lines.push(`sight ${sh} in: second crossing at ${x ? x.toFixed(0) : 'none'} yd`);
    assert.ok(x > 150 && x < 400, lines[lines.length - 1]);
    if (sh === 3.89) assert.ok(Math.abs(x - 300) < 5, `at the data's height the second crossing is within 5 yd of 300: ${x}`);
  }
  const chosen = flat.rifles['iwi-x95'].sightHeightIn['pa-md25'];
  assert.equal(chosen, 3.89);
  console.log('  IMI M193 at ' + load.muzzleFps + ' fps, 50 yd zero (the data uses ' + chosen + ' in on both Tavors):\n    ' + lines.join('\n    '));
});

test('a shot through shoot() repeats with the same seed and scatters with the load\'s spread', () => {
  const load = flat.loads['federal-gmm-69'];
  const rifle = { sightHeightIn: 2.6, boreOffsetMoa: { up: 0, right: 0 } };
  const sight = { clickMoa: 1.75, windageClickMoa: 0.75, elevationClicks: 0, windageClicks: 0 };
  const base = { load, drag, rifle, sight, conditions: ICAO, wind: [], targetYards: 100 };
  const a = E.shoot({ ...base, rand: E.seeded(7) });
  const b = E.shoot({ ...base, rand: E.seeded(7) });
  assert.deepEqual(a.hit, b.hit);
  const rand = E.seeded(1);
  const hits = Array.from({ length: 40 }, () => E.shoot({ ...base, rand }).hit);
  const mean = hits.reduce((s, h) => s + h.upIn, 0) / hits.length;
  const sd = Math.sqrt(hits.reduce((s, h) => s + (h.upIn - mean) ** 2, 0) / hits.length);
  const expected = E.inchesPerMoa(100) * E.spreadSigmaMoa(load.spreadMoa, null);
  assert.ok(sd > expected * 0.6 && sd < expected * 1.5, `sd ${sd.toFixed(3)} in vs sigma ${expected.toFixed(3)}`);
});

test('the sight\'s clicks move the strike by the click value', () => {
  const load = flat.loads['federal-gmm-69'];
  const rifle = { sightHeightIn: 2.6, boreOffsetMoa: { up: 0, right: 0 } };
  const base = { load, drag, rifle, conditions: ICAO, wind: [], targetYards: 100, rand: () => 0.5 };
  const z = E.shoot({ ...base, sight: { clickMoa: 1.75, windageClickMoa: 0.75, elevationClicks: 0, windageClicks: 0 } });
  const up = E.shoot({ ...base, sight: { clickMoa: 1.75, windageClickMoa: 0.75, elevationClicks: 4, windageClicks: 0 } });
  const right = E.shoot({ ...base, sight: { clickMoa: 1.75, windageClickMoa: 0.75, elevationClicks: 0, windageClicks: -2 } });
  assert.ok(Math.abs((up.hit.upIn - z.hit.upIn) - 4 * 1.75 * E.inchesPerMoa(100)) < 0.05);
  assert.ok(Math.abs((right.hit.rightIn - z.hit.rightIn) + 2 * 0.75 * E.inchesPerMoa(100)) < 0.05);
});

test('the far plate at Piru: the 174 gr match load arrives right at the sound barrier at 1,000 yd; the 180 gr soft point is well below it', () => {
  const base = { drag, conditions: { altitudeFt: 850, tempF: 85 }, sightHeightIn: 3, elevationMoa: 40, windageMoa: 0, wind: [], targetYards: 1000, targetRiseFt: 200 };
  const match = E.fly({ ...base, load: flat.loads['sb-174-hpbt'] });
  const sp = E.fly({ ...base, load: flat.loads['sb-180-sp'] });
  console.log(`  1,000 yd plate at Piru: 174 gr match Mach ${match.mach.toFixed(2)} (${match.speedFps.toFixed(0)} fps); 180 gr soft point Mach ${sp.mach.toFixed(2)} (${sp.speedFps.toFixed(0)} fps)`);
  assert.ok(match.reached && match.mach > 0.9 && match.mach < 1.05 && match.transonic, `match Mach ${match.mach}`);
  assert.ok(sp.reached && sp.subsonic && sp.mach < 0.9, `soft point Mach ${sp.mach}`);
});

test('subsonic start: the .22 at 100 yd scatters with its own spread, no multiplier; the S&B 174 gr at 1,000 yd still gets the transonic factor', () => {
  const rifle = { sightHeightIn: 0.9, boreOffsetMoa: { up: 0, right: 0 } };
  const sight = { clickMoa: 3, windageClickMoa: 3, elevationClicks: 0, windageClicks: 0 };
  // The .22: leaves the barrel at Mach 0.96, arrives at 100 yd near Mach 0.8.
  const twentyTwo = flat.loads['cci-sv-40'];
  const base22 = { load: twentyTwo, drag, rifle, sight, conditions: ICAO, wind: [], targetYards: 100 };
  const one = E.shoot({ ...base22, rand: E.seeded(3) });
  assert.ok(one.reached && one.subsonic && one.startedSupersonic === false, `the .22 arrives subsonic (Mach ${one.mach.toFixed(2)}) having started below Mach 1.2`);
  const rand = E.seeded(11);
  const hits = Array.from({ length: 60 }, () => E.shoot({ ...base22, rand }).hit);
  const mean = hits.reduce((s, h) => s + h.upIn, 0) / hits.length;
  const sd = Math.sqrt(hits.reduce((s, h) => s + (h.upIn - mean) ** 2, 0) / hits.length);
  const own = E.inchesPerMoa(100) * (twentyTwo.spreadMoa / 3.06);
  console.log(`  .22 at 100 yd: per-axis scatter ${sd.toFixed(2)} in; the load's own figure ${own.toFixed(2)} in (with the subsonic multiplier it would be ${(own * 2.5).toFixed(2)})`);
  assert.ok(sd > own * 0.65 && sd < own * 1.45, `sd ${sd.toFixed(3)} vs own sigma ${own.toFixed(3)}: no multiplier`);
  assert.equal(E.spreadSigmaMoa(1.5, 0.8, 0.96), 1.5 / 3.06, 'spreadSigmaMoa: a bullet that started subsonic keeps its own sigma');
  assert.equal(E.spreadSigmaMoa(1.5, 0.8, 2.3), (1.5 / 3.06) * 2.5, 'spreadSigmaMoa: one that started supersonic and arrived subsonic gets the factor');
  assert.equal(E.spreadSigmaMoa(1.5, 1.1, 2.3), (1.5 / 3.06) * 1.5, 'transonic factor');
  // The match load at the far plate: starts at Mach 2.26, arrives at Mach 0.97: the transonic factor applies as before.
  const match = flat.loads['sb-174-hpbt'];
  const baseM = { load: match, drag, rifle: { sightHeightIn: 3, boreOffsetMoa: { up: 0, right: 0 } }, sight: { clickMoa: 0.25, windageClickMoa: 0.25, elevationClicks: 180, windageClicks: 0 }, conditions: { altitudeFt: 850, tempF: 85 }, wind: [], targetYards: 1000, targetRiseFt: 200 };
  const far = E.shoot({ ...baseM, rand: E.seeded(5) });
  assert.ok(far.reached && far.transonic && far.startedSupersonic === true, `match load Mach ${far.mach.toFixed(2)} at 1,000 yd, started supersonic`);
  const randM = E.seeded(13);
  const farHits = Array.from({ length: 60 }, () => E.shoot({ ...baseM, rand: randM }).hit);
  const meanM = farHits.reduce((s, h) => s + h.upIn, 0) / farHits.length;
  const sdM = Math.sqrt(farHits.reduce((s, h) => s + (h.upIn - meanM) ** 2, 0) / farHits.length);
  const ownM = E.inchesPerMoa(1000) * (match.spreadMoa / 3.06);
  const factor = far.mach < 1 ? 2.5 : 1.5;
  console.log(`  S&B 174 gr at 1,000 yd (Mach ${far.mach.toFixed(2)}): per-axis scatter ${sdM.toFixed(1)} in; own figure ${ownM.toFixed(1)} in, with the factor ${(ownM * factor).toFixed(1)} in`);
  assert.ok(sdM > ownM * 1.15, `sd ${sdM.toFixed(2)} should exceed the load's own ${ownM.toFixed(2)}: the factor still applies`);
});

// --- verify 2: the new calibers against a maker's table ----------------------------------------------------
// Sellier & Bellot 124 gr FMJ 7.62x39 (SB76239A): the maker's US page in yards (100 yd zero) and the Czech page in
// metres (100 m zero), read through the search engine's indexed text on 2026-11-17 (data/loads.json, sb-124).
const SB39_YD = { 100: [0, null], 200: [-5.7, 1854], 300: [-21.7, 1599] };
const SB39_M = { 100: [0, null], 200: [-19.1, null], 300: [-71.0, 466] };
test('verify 2, 7.62x39: S&B 124 gr against S&B\'s own tables (yards and metres), G1 0.286, within 0.2 MOA', () => {
  const lines = [];
  {
    const load = { muzzleFps: 2421, bc: 0.286, dragModel: 'G1' };
    const base = { load, drag, conditions: ICAO, wind: [], sightHeightIn: 2.0 };
    const el = E.zeroElevationMoa(base, 100);
    for (const y of Object.keys(SB39_YD).map(Number)) {
      const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: y });
      const [drop, v] = SB39_YD[y];
      const diff = moa(r.hit.upIn - drop, y);
      lines.push(`${y} yd: drop ${r.hit.upIn.toFixed(1)} vs S&B ${drop} in (${diff.toFixed(2)} MOA); ${r.speedFps.toFixed(0)}${v ? ` vs ${v}` : ''} fps`);
      assert.ok(Math.abs(diff) <= 0.2, lines[lines.length - 1]);
      if (v) assert.ok(Math.abs(r.speedFps - v) < 20, lines[lines.length - 1]);
    }
  }
  {
    const load = { muzzleFps: 738 / 0.3048, bc: 0.286, dragModel: 'G1' };
    const base = { load, drag, conditions: ICAO, wind: [], sightHeightIn: 2.0 };
    const el = E.zeroElevationMoa(base, 100 / 0.9144);
    for (const m of Object.keys(SB39_M).map(Number)) {
      const y = m / 0.9144;
      const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: y });
      const [drop, v] = SB39_M[m];
      const diff = moa(r.hit.upIn - drop / 2.54, y);
      lines.push(`${m} m: drop ${(r.hit.upIn * 2.54).toFixed(1)} vs S&B ${drop} cm (${diff.toFixed(2)} MOA); ${(r.speedFps * 0.3048).toFixed(0)}${v ? ` vs ${v}` : ''} m/s`);
      assert.ok(Math.abs(diff) <= 0.2, lines[lines.length - 1]);
      if (v) assert.ok(Math.abs(r.speedFps * 0.3048 - v) < 8, lines[lines.length - 1]);
    }
  }
  console.log('  S&B 124 gr 7.62x39 (G1 0.286, sight 2.0 in, 2,421 fps / 738 m/s):\n    ' + lines.join('\n    '));
});

// Hornady BLACK 5.45x39 60 gr V-MAX (#81246): Hornady's table on its product page (200 yd zero), read 2026-11-17. The
// table is reproduced with Army Standard Metro air (59 F, 29.53 inHg, 78% humidity) and the sight 1.75 in over the
// bore; under ICAO air the drop at 500 yd is 0.25 MOA off, so those are the inputs the table follows.
const HORNADY = { 100: [1.9, 2495], 200: [0, 2202], 300: [-9.1, 1929], 400: [-27.7, 1679], 500: [-58.6, 1457] };
test('verify 2, 5.45x39: Hornady 60 gr V-MAX against Hornady\'s table, G1 0.285, within 0.2 MOA to 500 yd', () => {
  const load = { muzzleFps: 2810, bc: 0.285, dragModel: 'G1' };
  const base = { load, drag, conditions: { altitudeFt: 0, tempF: 59, pressureInHg: 29.53, humidity: 0.78 }, wind: [], sightHeightIn: 1.75 };
  const el = E.zeroElevationMoa(base, 200);
  const lines = [];
  for (const y of Object.keys(HORNADY).map(Number)) {
    const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: y });
    const [drop, v] = HORNADY[y];
    const diff = moa(r.hit.upIn - drop, y);
    lines.push(`${y} yd: drop ${r.hit.upIn.toFixed(1)} vs Hornady ${drop} in (${diff.toFixed(2)} MOA); ${r.speedFps.toFixed(0)} vs ${v} fps`);
    assert.ok(Math.abs(diff) <= 0.2, lines[lines.length - 1]);
    assert.ok(Math.abs(r.speedFps - v) < 10, lines[lines.length - 1]);
  }
  console.log('  Hornady 5.45x39 60 gr (G1 0.285, Army Standard Metro air, sight 1.75 in, 200 yd zero):\n    ' + lines.join('\n    '));
});

// CCI Standard Velocity 40 gr (#0035): CCI's own table (100 yd zero, sights 1.5 in above the bore), read 2026-11-17.
const CCI = { 25: [2.2, null], 50: [3.8, 977], 75: [3.1, 940], 100: [0, 908] };
test('verify 2, .22 LR: CCI Standard Velocity 40 gr against CCI\'s table, G1 0.12, within 0.2 MOA to 100 yd', () => {
  const load = flat.loads['cci-sv-40'];
  const base = { load, drag, conditions: ICAO, wind: [], sightHeightIn: 1.5 };
  const el = E.zeroElevationMoa(base, 100);
  const lines = [];
  for (const y of Object.keys(CCI).map(Number)) {
    const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: y });
    const [drop, v] = CCI[y];
    const diff = moa(r.hit.upIn - drop, y);
    lines.push(`${y} yd: ${r.hit.upIn.toFixed(2)} vs CCI ${drop} in (${diff.toFixed(2)} MOA); ${r.speedFps.toFixed(0)}${v ? ` vs ${v}` : ''} fps`);
    assert.ok(Math.abs(diff) <= 0.2, lines[lines.length - 1]);
    if (v) assert.ok(Math.abs(r.speedFps - v) < 6, lines[lines.length - 1]);
  }
  console.log(`  CCI .22 LR 40 gr (G1 ${load.bc}, ${load.muzzleFps} fps, sight 1.5 in, 100 yd zero):\n    ` + lines.join('\n    '));
});

// --- verify 9: the drop reticle with the set's loads, reported, not forced ----------------------------------------
test('verify 9: zeroed at 50 yd on the chevron tip with each 7.62x39 load, where the bullet lands when each mark is held on the plate (a table, no pass or fail)', () => {
  const sight = flat.sights['pa-3x-acss'], rifle = flat.rifles['ak-762'];
  const lines = [];
  for (const loadId of rifle.loads) {
    const load = flat.loads[loadId];
    const base = { load, drag, conditions: ICAO, wind: [], sightHeightIn: rifle.sightHeightIn['pa-3x-acss'] };
    const el = E.zeroElevationMoa(base, sight.reticle.zeroYards);
    const cells = sight.reticle.marksMoaBelowZero.map((m) => {
      const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: m.yards });
      // holding the mark on the plate: the bullet sits where it is against the zero line, plus the mark's angle below it
      const vsMark = r.hit.upIn + m.moaBelowZero * E.inchesPerMoa(m.yards);
      return `${m.yards} yd ${vsMark >= 0 ? '+' : ''}${vsMark.toFixed(1)} in`;
    });
    lines.push(`${load.name} (${load.muzzleFps} fps): ${cells.join(', ')}`);
    assert.ok(cells.length === 6);
  }
  console.log('  ACSS marks held on the plate, 50 yd zero on the tip, sight 3.0 in, standard air (+ high, - low):\n    ' + lines.join('\n    '));
});
