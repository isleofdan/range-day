'use strict';
// The game's data: every figure sourced or marked an estimate with its
// basis (the rule in the brief, section 5), and the files consistent with
// one another.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const data = require('../lib/data');

const { raw, flat, problems } = data.load();

test('every figure in the data carries a source {url, read} or an estimate with its basis', () => {
  assert.deepEqual(problems, []);
});

test('the sourcing check refuses a bare number and an estimate without a basis', () => {
  assert.equal(data.check({ a: { b: 5 } }).length, 1);
  assert.equal(data.check({ a: { value: 5 } }).length, 1);
  assert.equal(data.check({ a: { value: 5, estimate: 'short' } }).length, 1);
  assert.equal(data.check({ a: { value: 5, estimate: 'a basis long enough to say something' } }).length, 0);
  assert.equal(data.check({ a: { value: 5, source: { url: 'https://x', read: '2026-11-16' } } }).length, 0);
});

test('every rifle names loads and sights that exist, with a sight height for each sight', () => {
  for (const [id, r] of Object.entries(flat.rifles)) {
    if (id.startsWith('_')) continue;
    for (const l of r.loads) assert.ok(flat.loads[l], `${id}: load ${l}`);
    for (const s of r.sights) {
      assert.ok(flat.sights[s], `${id}: sight ${s}`);
      assert.equal(typeof r.sightHeightIn[s], 'number', `${id}: sight height for ${s}`);
    }
    for (const l of r.loads) assert.equal(flat.loads[l].caliber, r.caliber, `${id}: ${l} is ${flat.loads[l].caliber}`);
  }
});

test('every load has a speed, a coefficient with its drag model, and a spread', () => {
  for (const [id, l] of Object.entries(flat.loads)) {
    if (id.startsWith('_')) continue;
    assert.ok(l.muzzleFps > 900 && l.muzzleFps < 3400, `${id}: speed ${l.muzzleFps}`);
    assert.ok(l.bc > 0.1 && l.bc < 0.6, `${id}: bc ${l.bc}`);
    assert.ok(['G1', 'G7'].includes(l.dragModel), `${id}: drag model`);
    assert.ok(l.spreadMoa > 0, `${id}: spread`);
  }
});

test('the whole rifle set is in the data; all seven rifles are playable', () => {
  const ids = Object.keys(flat.rifles).filter((k) => !k.startsWith('_'));
  assert.equal(ids.length, 7);
  assert.deepEqual(ids.filter((k) => flat.rifles[k].playable).sort(), ids.slice().sort());
  assert.equal(Object.keys(flat.loads).filter((k) => !k.startsWith('_')).length, 16);
});

test('the drag tables are the standard shape: Cd peaks just past Mach 1 and is lower well below and well above it', () => {
  for (const name of ['G1', 'G7']) {
    const t = flat.physics.dragTables[name];
    assert.ok(t.length > 50, name);
    const at = (m) => t.find((r) => r[0] === m)[1];
    assert.ok(at(1.2) > at(0.5), `${name}: Cd(1.2) > Cd(0.5)`);
    assert.ok(at(1.2) > at(4.0), `${name}: Cd(1.2) > Cd(4.0)`);
    for (let i = 1; i < t.length; i++) assert.ok(t[i][0] > t[i - 1][0], `${name}: sorted at row ${i}`);
  }
  assert.equal(flat.physics.dragTables.G1[0][1], 0.2629);
});

test('each course has plates every 100 yards to its published steel distance, with zero distances', () => {
  for (const [id, c] of Object.entries(flat.courses)) {
    if (id.startsWith('_')) continue;
    const last = c.plates[c.plates.length - 1].yards;
    assert.equal(last, c.steelTo, id);
    for (let i = 1; i < c.plates.length; i++) assert.equal(c.plates[i].yards - c.plates[i - 1].yards, 100, id);
    assert.deepEqual(c.zeroYards, [25, 50, 100, 200], id);
    assert.ok(typeof c.farPlateRiseFt === 'number' && typeof c.altitudeFt === 'number', id);
  }
  assert.equal(flat.courses['cta-piru'].farPlateRiseFt, 200);
});

test('every sliding leaf names its settings, its service load and a derived angle per setting; every notch sight has a notch width', () => {
  for (const [sightId, leafKey] of [['ak-irons', 'leaf'], ['ak-irons', 'leaf545'], ['vepr-irons', 'leaf']]) {
    const leaf = flat.sights[sightId][leafKey];
    assert.deepEqual(leaf.settingsMeters, [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], `${sightId}.${leafKey}`);
    assert.equal(leaf.moaAbove100.length, 10);
    assert.equal(leaf.moaAbove100[0].moaAbove100, 0);
    for (let i = 1; i < 10; i++) assert.ok(leaf.moaAbove100[i].moaAbove100 > leaf.moaAbove100[i - 1].moaAbove100, `${sightId}.${leafKey}: setting ${i + 1} is higher than ${i}`);
    assert.ok(leaf.serviceLoad.muzzleMps > 600 && leaf.serviceLoad.bc > 0.2, `${sightId}.${leafKey}: service load`);
    assert.match(raw.sights[sightId][leafKey].moaAbove100.estimate, /derived by this app's engine/);
  }
  for (const id of ['ak-irons', 'vepr-irons', 'rem-irons']) assert.ok(flat.sights[id].notchMoa > 10 && flat.sights[id].apertureMoa === 0, `${id}: a notch, no ring`);
  assert.equal(flat.sights['ak-irons'].battleSettingMeters, undefined);
  assert.equal(flat.sights['ak-irons'].leaf.battleSettingMeters, 300);
  assert.equal(flat.sights['ak-irons'].leaf545.battleSettingMeters, 400);
});

test('the Tavor dot sits 3.89 in over the bore on both Tavors, the height in the sources\' band that puts the 50-yard zero\'s second crossing nearest 300 yards', () => {
  assert.equal(flat.rifles['iwi-tavor-sar'].sightHeightIn['pa-md25'], 3.89);
  assert.equal(flat.rifles['iwi-x95'].sightHeightIn['pa-md25'], 3.89);
  assert.equal(flat.rifles['iwi-tavor-sar'].sightHeightIn['pa-magnifier'], 3.89);
  assert.match(raw.rifles['iwi-x95'].sightHeightIn['pa-md25'].estimate, /remembered zero/);
});

test('the raw data keeps the page address and the date read beside every sourced figure', () => {
  const s = raw.loads['sb-174-hpbt'].makerFps.source;
  assert.match(s.url, /^https:\/\/www\.sellierbellot\.us\//);
  assert.equal(s.read, '2026-11-16');
  assert.match(raw.loads['imi-m193'].bc.estimate, /IMI publishes no ballistic coefficient/);
});
