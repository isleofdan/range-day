'use strict';
// range-day-seventeen: the workbench. The figures a build needs (data/workbench.json), the build arithmetic
// (public/builds.js), and verify 2 and 3 of the brief, without a browser. The browser half (the workbench page, a build at
// the bench and the line, the records left untouched, no drop shown) is test/workbench-browser.test.js.
//   node --test test/workbench.test.js

const test = require('node:test');
const assert = require('node:assert');
const E = require('../public/engine.js');
const B = require('../public/builds.js');
const { raw, flat } = require('../lib/data').load();
const guns = require('../lib/guns');
const MAIN = require('./fitted-strikes.json');

// The data as /api/data serves it: the flat files, with the rifle set from the gun records' path.
const served = () => ({ ...JSON.parse(JSON.stringify(flat)), rifles: JSON.parse(JSON.stringify(guns.fromFiles(raw))) });
const RIFLES = Object.keys(guns.fromFiles(raw));

test('range-day-seventeen step 2: every figure the workbench reads is sourced or an estimate with its basis, and lib/data.js loads data/workbench.json', () => {
  const d = require('../lib/data');
  assert.ok(d.FILES.includes('workbench'));
  assert.deepEqual(d.check(raw.workbench, 'workbench'), []);
  // the check refuses a bare number here as anywhere
  assert.equal(d.check({ barrels: { x: [16] } }).length, 1);
});

test('range-day-seventeen step 2: a speed per inch of barrel for the caliber of every load in the set', () => {
  const w = flat.workbench;
  const calibers = [...new Set(RIFLES.map((id) => flat.rifles[id].caliber))];
  for (const c of calibers) assert.equal(typeof w.fpsPerInch[c], 'number', `fpsPerInch for ${c}`);
  // 5.56: the figure the loads' own estimates already state (data/loads.json, imi-m193: 25 feet per second per inch)
  assert.equal(w.fpsPerInch['5.56x45'], 25);
  assert.match(raw.loads['imi-m193'].muzzleFps.estimate, /25 feet per second per inch/);
});

test('range-day-seventeen step 2: each of the seven rifles offers barrel lengths, its own length among them; each collection scope offers mounts, the one it came in first', () => {
  const w = flat.workbench;
  for (const id of RIFLES) {
    const lengths = w.barrels[id];
    assert.ok(Array.isArray(lengths) && lengths.length >= 1, `${id}: barrel lengths`);
    assert.ok(lengths.includes(flat.rifles[id].barrelIn), `${id}: its own ${flat.rifles[id].barrelIn} in is offered`);
    for (const l of lengths) assert.ok(l >= 14 && l <= 30, `${id}: ${l} in is a rifle barrel`);
    assert.equal(new Set(lengths).size, lengths.length, `${id}: no length twice`);
  }
  const collection = Object.keys(flat.sights).filter((k) => !k.startsWith('_') && flat.sights[k].collection);
  assert.deepEqual(Object.keys(w.mounts).sort(), collection.sort(), 'a list for every scope of the collection, and only those');
  for (const s of collection) {
    const m = w.mounts[s];
    assert.equal(m[0].name, flat.sights[s].mount.name, `${s}: the mount it came in comes first`);
    assert.equal(m[0].centerOverRailIn, flat.sights[s].mount.centerOverRailIn, `${s}: at the same height`);
    const heights = m.map((x) => x.centerOverRailIn);
    assert.equal(new Set(heights).size, heights.length, `${s}: no height twice`);
    for (const h of heights) assert.ok(h > 0.5 && h < 3, `${s}: ${h} in over the rail`);
  }
  // range-day-seventeen result check: the .22's model is not identified, so its lengths (sold in other Remington models) are estimates
  for (const b of raw.workbench.barrels['remington-22']) assert.ok(typeof b.estimate === 'string' && !b.source, `.22 ${b.value} in: an estimate with its basis`);
  // iron sights and sights fixed to the rifle offer no height choice
  for (const [id, list] of Object.entries(w.mounts)) assert.equal(flat.sights[id].collection, true, id);
});

test('range-day-seventeen verify 2: nothing moved for the rifles as fitted: each rifle\'s strike with its default sight and first load at 100, 300 and 600 yards is main\'s, to every digit', () => {
  const d = B.withBuilds(served(), []);
  const conditions = { altitudeFt: 1500, tempF: 59, pressureInHg: 28.4, humidity: 0.4 };
  const lines = [];
  // range-day-nineteen: the rifles main had are all still here; the expansion's are new and have no strikes on main to keep
  for (const id of Object.keys(MAIN.strikes)) assert.ok(RIFLES.includes(id), `${id} is still in the set`);
  assert.deepEqual(RIFLES.filter((id) => !(id in MAIN.strikes)).filter((id) => !flat.rifles[id].expansion), [], 'every rifle not on main is an expansion rifle');
  for (const id of Object.keys(MAIN.strikes)) {
    const rifle = d.rifles[id];
    const [sightId, loadId] = MAIN.sightLoad[id];
    assert.deepEqual([rifle.defaultSight, rifle.loads[0]], [sightId, loadId], `${id}: the same default sight and first load as main`);
    const sight = d.sights[sightId];
    const load = B.loadFor(d, id, loadId);
    assert.equal(load, d.loads[loadId], `${id}: a rifle as fitted gives the engine the load itself`);
    for (const yards of [100, 300, 600]) {
      const r = E.shoot({ load, drag: d.physics.dragTables, powder: d.physics.powderTemperature,
        rifle: { sightHeightIn: rifle.sightHeightIn[sightId], boreOffsetMoa: { up: rifle.boreOffsetMoa.up, right: rifle.boreOffsetMoa.right } },
        sight: { clickMoa: sight.clickMoa, windageClickMoa: sight.windageClickMoa, elevationClicks: 0, windageClicks: 0 },
        targetYards: yards, targetRiseFt: 0, conditions, wind: [], t0: 0, rand: E.seeded(17) });
      const now = r.reached ? { upIn: r.hit.upIn, rightIn: r.hit.rightIn, timeS: r.timeS } : 'did not reach';
      assert.deepEqual(now, MAIN.strikes[id][yards], `${id} at ${yards} yd`);
      lines.push(`${id} at ${yards} yd: ${typeof now === 'string' ? now : `${now.upIn} in up, ${now.rightIn} in right`} (main: the same)`);
    }
  }
  console.log('  ' + lines.join('\n  '));
});

test('range-day-seventeen verify 3: the 5.56 carbine built with a 20-inch barrel gives IMI M193 the maker\'s own 20-inch speed, 3,166 feet per second', () => {
  const d = served();
  assert.equal(d.loads['imi-m193'].muzzleFps, 3066, 'from the 16-inch barrel');
  assert.equal(d.loads['imi-m193'].makerFps, 3166);
  assert.equal(d.loads['imi-m193'].makerBarrelIn, 20);
  B.withBuilds(d, [{ id: 'b-test20', name: '20 inch', rifle: 'bcm-ar15', barrelIn: 20, mounts: {} }]);
  assert.equal(B.loadFor(d, 'b-test20', 'imi-m193').muzzleFps, 3166);
  assert.equal(d.rifles['b-test20'].loadFps['imi-m193'], 3166);
  // the rule, for each other load: its speed from 16 in, 25 feet per second more per inch added
  for (const l of d.rifles['bcm-ar15'].loads) assert.equal(d.rifles['b-test20'].loadFps[l], Math.round(d.loads[l].muzzleFps + 4 * 25), l);
});

test('range-day-seventeen step 3: a build changes only the barrel, the loads\' speeds and a mounted scope\'s height; the rifle as fitted keeps its entry', () => {
  const d = served();
  const before = JSON.stringify(d.rifles);
  const vortex = d.workbench.mounts['vortex-razor-1-10'];
  B.withBuilds(d, [{ id: 'b-low', name: 'low rings', rifle: 'bcm-ar15', barrelIn: 16, mounts: { 'vortex-razor-1-10': vortex[2].name } }]);
  const b = d.rifles['b-low'], r = d.rifles['bcm-ar15'];
  assert.equal(JSON.stringify(Object.fromEntries(Object.entries(d.rifles).filter(([k]) => k !== 'b-low'))), before, 'every rifle as fitted unchanged');
  assert.equal(b.buildOf, 'bcm-ar15');
  assert.equal(b.sightHeightIn['vortex-razor-1-10'], Math.round((r.scopeMount.railHeightOverBoreIn + vortex[2].centerOverRailIn) * 1000) / 1000);
  for (const s of r.sights) if (s !== 'vortex-razor-1-10') assert.equal(b.sightHeightIn[s], r.sightHeightIn[s], s);
  for (const l of r.loads) assert.equal(B.loadFor(d, 'b-low', l), d.loads[l], `${l}: the same barrel, the load itself`);
  for (const k of ['boreOffsetMoa', 'recoilFactor', 'sights', 'loads', 'defaultSight', 'caliber', 'firstCourse']) assert.deepEqual(b[k], r[k], k);
  // the mount it came in gives the height lib/guns.js gives
  for (const s of r.collection) assert.equal(B.heightIn(d, r, s, B.fittedMount(d, s)), r.sightHeightIn[s], s);
  // a name shortened at its first comma still says which build it is
  assert.equal(b.name, 'BCM AR-15 carbine build “low rings”, 5.56');
  assert.equal(b.name.split(',')[0], 'BCM AR-15 carbine build “low rings”');
  // a build of a build, or of no rifle, is not added
  B.withBuilds(d, [{ id: 'b-x', name: 'x', rifle: 'b-low', barrelIn: 16, mounts: {} }, { id: 'b-y', name: 'y', rifle: 'no-such', barrelIn: 16, mounts: {} }, { id: 'bcm-ar15', name: 'z', rifle: 'bcm-ar15', barrelIn: 16, mounts: {} }]);
  assert.equal(d.rifles['b-x'], undefined); assert.equal(d.rifles['b-y'], undefined); assert.equal(d.rifles['bcm-ar15'], r);
});
