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

test('the X95 check for the report: M193 from 16 in, sight 3.0 in, zeroed at 50 yd: where it crosses the line of sight again', () => {
  const load = flat.loads['imi-m193'];
  const base = { load, drag, conditions: ICAO, wind: [] };
  const lines = [];
  for (const sh of [2.6, 3.0, 3.75]) {
    const el = E.zeroElevationMoa({ ...base, sightHeightIn: sh }, 50);
    const x = E.secondCrossingYards({ ...base, sightHeightIn: sh }, el, 600);
    lines.push(`sight ${sh} in: second crossing at ${x ? x.toFixed(0) : 'none'} yd`);
    assert.ok(x > 150 && x < 400, lines[lines.length - 1]);
  }
  console.log('  IMI M193 at ' + load.muzzleFps + ' fps, 50 yd zero:\n    ' + lines.join('\n    '));
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
