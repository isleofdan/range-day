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
  assert.equal(Object.keys(flat.loads).filter((k) => !k.startsWith('_')).length, 22); // range-day-nineteen: six loads for the three new calibers
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
    assert.ok(typeof c.altitudeFt === 'number', id);
    for (const p of c.plates) assert.ok(typeof p.riseFt === 'number' && typeof p.lateralYd === 'number', `${id}: ${p.yards} yd has its own height and sideways place`);
  }
  // Since range-day-five the heights are surveyed: each plate's riseFt is sourced to the terrain record, and each course's
  // altitudeFt is the surveyed ground at the firing position (test/terrain.test.js checks the figures against the heights themselves).
  for (const [id, c] of Object.entries(raw.courses)) {
    if (id.startsWith('_')) continue;
    assert.match(c.altitudeFt.source.note, /surveyed/, `${id}: altitudeFt is surveyed`);
    assert.ok(c.firing && typeof c.firing.bearingDeg.value === 'number' && typeof c.firing.easting.value === 'number', `${id}: a firing position and a bearing of fire`);
    for (const p of c.plates) { assert.match(p.riseFt.source.note, /surveyed ground/, `${id}: ${p.yards.value} yd riseFt is surveyed`); assert.match(p.lateralYd.source.note, /line of sight/, `${id}: ${p.yards.value} yd lateralYd is surveyed and says why it stands there`); assert.match(p.position.easting.estimate, /NAIP photograph of 20\d\d-\d\d-\d\d/, `${id}: ${p.yards.value} yd position cites the photograph`); }
  }
});

test('the plates stand apart: no two centers within 5 MOA of each other as seen from the firing line (the surveyed ground decides their order)', () => {
  const MOA = Math.PI / (180 * 60);
  for (const [id, c] of Object.entries(flat.courses)) {
    if (id.startsWith('_')) continue;
    // range-day-ten: the near targets (paper at 50 and 100 yards, and the canyon's 100-yard steel) stand apart from every plate too.
    const ang = [...(c.near || []), ...c.plates].map((p) => ({ yards: `${p.yards} ${p.kind || 'steel'}`, up: Math.atan2(p.riseFt, p.yards * 3) / MOA, right: Math.atan2(p.lateralYd, p.yards) / MOA }));
    for (let i = 0; i < ang.length; i++) for (let j = i + 1; j < ang.length; j++) {
      const sep = Math.hypot(ang[i].up - ang[j].up, ang[i].right - ang[j].right);
      assert.ok(sep >= 5, `${id}: ${ang[i].yards} and ${ang[j].yards} yd are ${sep.toFixed(1)} MOA apart`);
    }
  }
});

test('range-day-ten: each course has paper at 50 and 100 yards, the canyon a 12 by 18 in steel plate at 100; every near target says paper or steel, carries its own surveyed height and place, and a target without the word reads as steel', () => {
  const kindOf = (t) => t.kind || 'steel';
  for (const [id, c] of Object.entries(flat.courses)) {
    if (id.startsWith('_')) continue;
    assert.ok(Array.isArray(c.near), `${id}: a list of near targets`);
    const paper = c.near.filter((t) => t.kind === 'paper').map((t) => t.yards);
    assert.deepEqual(paper, [50, 100], `${id}: paper at 50 and 100 yards`);
    for (const t of c.near) {
      assert.ok(['paper', 'steel'].includes(t.kind), `${id} ${t.yards}: kind is paper or steel, not ${t.kind}`);
      for (const f of ['yards', 'widthIn', 'heightIn', 'riseFt', 'lateralYd']) assert.equal(typeof t[f], 'number', `${id} ${t.yards} ${t.kind}: ${f}`);
      assert.equal(t.widthIn, 12); assert.equal(t.heightIn, 18);
    }
    // every steel 100-yard target on the course, near or plate: the canyon gains one, the rifle line already had one
    const steel100 = [...c.near.filter((t) => t.kind === 'steel'), ...c.plates.filter((p) => kindOf(p) === 'steel')].filter((t) => t.yards === 100);
    assert.equal(steel100.length, 1, `${id}: one steel plate at 100 yards`);
    assert.equal(steel100[0].widthIn, 12); assert.equal(steel100[0].heightIn, 18);
    for (const p of c.plates) assert.equal(kindOf(p), 'steel', `${id} ${p.yards}: a plate without the word reads as steel`);
  }
  for (const [id, c] of Object.entries(raw.courses)) {
    if (id.startsWith('_')) continue;
    for (const t of c.near) { assert.match(t.riseFt.source.note, /surveyed ground/, `${id} ${t.yards.value} ${t.kind}: riseFt is surveyed`); assert.match(t.lateralYd.source.note, /line of sight/, `${id} ${t.yards.value} ${t.kind}: lateralYd says why it stands there`); }
  }
  // the paper's own figures and the spotting scope's, each in the data
  for (const k of ['gridIn', 'centreMarkIn', 'cornerMarkIn', 'cornerMarkRightIn', 'cornerMarkUpIn', 'burstRifleIn', 'burstRimfireIn', 'boardFootAboveGroundM', 'sheetCentreAboveBoardFootIn', 'nearGroupMoundM']) assert.equal(typeof flat.look.paper[k], 'number', `look.paper.${k}`);
  // range-day-eleven: a stronger scope, 25-125x: its top at 100x or more, its bottom at 30x or lower so near paper is easy to find
  assert.deepEqual(flat.spotting.zoom, { low: 25, high: 125 });
  assert.ok(flat.spotting.zoom.high >= 100 && flat.spotting.zoom.low <= 30);
  for (const end of ['low', 'high']) for (const k of ['zoom', 'fovFtAt1000']) assert.match(raw.spotting[k][end].source.url, /^https:\/\/shop\.barska\.com\//, `spotting.${k}.${end} is the maker's figure`);
  assert.ok(flat.spotting.fovFtAt1000.low > flat.spotting.fovFtAt1000.high, 'the field narrows as the power rises');
  assert.match(raw.spotting.fovFtAt1000.low.source.url, /^https:\/\//);
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
  for (const id of ['ak-irons', 'vepr-irons', 'rem-irons']) assert.ok(flat.sights[id].notchMoa > 10 && flat.sights[id].notchDepthMoa > 0 && flat.sights[id].apertureMoa === 0, `${id}: a notch with a depth, no ring`);
  assert.ok(flat.sights['rem-irons'].stemWidthMoa > 0 && flat.sights['rem-irons'].stemWidthMoa < flat.sights['rem-irons'].frontPostMoa, 'the bead stands on a thinner stem');
  assert.ok(flat.sights['pa-3x-acss'].reticle.chevronHalfWidthMoa > 0 && flat.sights['pa-3x-acss'].reticle.markHalfWidthMoa > 0, 'the drop reticle has its drawn widths in the data');
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

test('the scenery the firing line draws has its sizes in the data: berm, post, yardage board, brush, ground', () => {
  const S = flat.physics.scenery;
  for (const k of ['bermWidthFt', 'bermHeightFt', 'postHeightShareOfPlate', 'boardWidthIn', 'boardHeightIn', 'boardAboveGroundIn', 'boardRightOfPlateIn', 'brushNearestYd', 'groundRoughnessFt']) assert.ok(typeof S[k] === 'number' && S[k] > 0, k);
  assert.ok(S.brushHeightFt.low > 0 && S.brushHeightFt.high > S.brushHeightFt.low);
  assert.match(raw.physics.scenery.bermWidthFt.estimate, /neither range publishes/);
});

test('the raw data keeps the page address and the date read beside every sourced figure', () => {
  const s = raw.loads['sb-174-hpbt'].makerFps.source;
  assert.match(s.url, /^https:\/\/www\.sellierbellot\.us\//);
  assert.equal(s.read, '2026-11-16');
  assert.match(raw.loads['imi-m193'].bc.estimate, /IMI publishes no ballistic coefficient/);
});

test('range-day-eleven: the Vepr carries its real scope, the UTG BugBuster 3-9x32, each figure from the maker or an estimate with its basis; the 2-7x44 stays in the data for old records, offered by no rifle; the new scope carries the old one\'s records only because both click alike and sit at the same height', () => {
  const s = flat.sights['utg-bugbuster-3-9x32'], r = raw.sights['utg-bugbuster-3-9x32'];
  assert.equal(s.kind, 'scope');
  assert.deepEqual(s.zoom, { low: 3, high: 9 });
  assert.deepEqual(s.fovFtAt100, { low: 37.7, high: 14 });
  assert.equal(s.clickMoa, 0.25); assert.equal(s.windageClickMoa, 0.25); assert.equal(s.clicks, 120);
  for (const f of [r.clickMoa, r.windageClickMoa, r.zoom.low, r.zoom.high, r.fovFtAt100.low, r.fovFtAt100.high]) assert.match(f.source.url, /^https:\/\/www\.leapers\.com\//, 'from the maker\'s page');
  assert.match(r.clicks.source.note, /30 MOA up and 30 MOA down/);
  assert.equal(s.reticle.kind, 'mil-dot');
  const v = flat.rifles['molot-vepr-54r'];
  assert.deepEqual(v.sights, ['vepr-irons', 'utg-bugbuster-3-9x32']);
  assert.equal(v.defaultSight, 'utg-bugbuster-3-9x32');
  assert.match(raw.rifles['molot-vepr-54r'].sightHeightIn['utg-bugbuster-3-9x32'].estimate, /side-rail mount/);
  assert.ok(flat.sights['utg-2-7x44'], 'the old scope stays in the data');
  assert.match(flat.sights['utg-2-7x44'].retired, /no rifle offers/);
  for (const [id, rifle] of Object.entries(flat.rifles)) if (!id.startsWith('_')) assert.ok(!rifle.sights.includes('utg-2-7x44'), `${id} does not offer the 2-7x44`);
  // the carry-forward's two deciding figures: the same click on both turrets, and the same height over the bore (3.0 in before, data/rifles.json at main 270fdea)
  assert.equal(s.carriesRecordsOf.sight, 'utg-2-7x44');
  assert.equal(flat.sights['utg-2-7x44'].clickMoa, s.clickMoa); assert.equal(flat.sights['utg-2-7x44'].windageClickMoa, s.windageClickMoa);
  assert.equal(v.sightHeightIn['utg-bugbuster-3-9x32'], 3);
});

test('range-day-twelve: the sights fitted to the rifles: each figure from a page or an estimate with its basis; each rifle opens with a sight of the kind it opened with; a sight carries the records of the one it replaced only where both click alike and sit at the same height over the bore', () => {
  const S = flat.sights, Rr = flat.rifles, rawS = raw.sights;
  const NEW = ['troy-battlesights', 'fab-flipup', 'seeall-gen1', 'ak762-kns-peep', 'ak545-ball', 'ak545-xs'];
  const MOA = 10800 / Math.PI;
  for (const id of NEW) {
    assert.ok(S[id], `${id} is in the data`);
    assert.ok(typeof rawS[id].model === 'string' && rawS[id].model.length > 40, `${id} names its model and why`);
    assert.ok(rawS[id].name.length <= S['pa-3x-acss'].name.length, `${id}'s name is no longer than the longest on main`);
    assert.match(rawS[id].adjustWords, /lev|indage/, `${id} says where it adjusts`);
  }
  // each figure the brief asks for, against its basis
  const T = S['troy-battlesights'];
  assert.equal(T.kind, 'iron');
  assert.deepEqual(T.apertures.map((a) => a.diameterIn), [0.19, 0.07], 'two rear peeps, 0.190 and 0.070 in, from Troy\'s own instructions');
  assert.match(rawS['troy-battlesights'].apertures[0].diameterIn.source.note, /\.190" and \.070"/);
  assert.equal(T.windageClickMoa, 0.5); assert.match(rawS['troy-battlesights'].windageClickMoa.source.note, /1\/2 MOA clicks/);
  assert.ok(Math.abs(T.frontPostMoa - (0.07 / T.sightRadiusIn) * MOA) < 0.01, 'the post\'s angle is its width over the sight radius');
  assert.ok(Math.abs(T.clickMoa - (0.006946 / T.sightRadiusIn) * MOA) < 0.01, 'an A2 post\'s click over this radius');
  assert.ok(T.frontHood && T.frontHood.innerMoa > T.frontPostMoa && !T.frontEars, 'range-day-twelve-b: the HK-style round hood around the post (Dan: "I think it was round")');
  const F = S['fab-flipup'];
  assert.deepEqual(F.apertures.map((a) => a.diameterIn), [0.118, 0.059], '3 mm and 1.5 mm peeps');
  assert.ok(F.frontEars.topAboveMoa > 0 && F.frontEars.gapMoa > F.frontPostMoa, 'tall guards either side of the post');
  const A = S['seeall-gen1'];
  assert.equal(A.kind, 'seeall'); assert.equal(A.frontPostMoa, undefined); assert.equal(A.apertureMoa, undefined);
  assert.deepEqual(A.zoom, { low: 1, high: 1 }, 'it magnifies nothing');
  assert.equal(A.clickMoa, 0.95); assert.match(rawS['seeall-gen1'].clickMoa.source.note, /1\/16 turn/);
  assert.match(rawS['seeall-gen1'].clickMoa.source.url, /^https:\/\/www\.seeallsights\.com\//, 'from the maker\'s instructions');
  assert.ok(A.reticle.lineBelowTipMoa > 0 && A.reticle.lineBelowTipMoa < A.reticle.triangleHeightMoa, 'the line crosses the triangle');
  for (const id of ['ak762-kns-peep', 'ak545-ball', 'vepr-irons']) {
    assert.equal(S[id].frontPostIn, 0.034, `${id}: the KNS ball, 0.034 in`);
    assert.match(rawS[id].frontPostIn.source.note, /AKBALL\.034/);
    assert.ok(S[id].frontBead && S[id].stemWidthMoa < S[id].frontPostMoa, `${id}: a ball on a thinner stem`);
    assert.ok(Math.abs(S[id].frontPostMoa - (0.034 / S[id].sightRadiusIn) * MOA) < 0.01, `${id}: the ball over its sight radius`);
  }
  assert.ok(S['ak762-kns-peep'].apertureMoa > 0 && !S['ak762-kns-peep'].leaf, 'the KNS peep: a ring where the notch was, and no sliding leaf');
  assert.equal(S['ak545-xs'].frontPostIn, 0.105);
  assert.ok(S['ak545-xs'].frontStripeMoa > 0 && S['ak545-xs'].frontStripeMoa < S['ak545-xs'].frontPostMoa, 'a glowing stripe on a wider post');
  for (const id of ['ak545-ball', 'ak545-xs']) assert.deepEqual(S[id].leaf, S['ak-irons'].leaf545, `${id} carries the 5.45's own leaf`);
  // which rifle carries which sight, each opening with a sight of the kind it opened with
  assert.deepEqual(Rr['bcm-ar15'].sights, ['troy-battlesights']);
  for (const r of ['iwi-tavor-sar', 'iwi-x95']) { assert.ok(Rr[r].sights.includes('fab-flipup') && Rr[r].sights.includes('seeall-gen1') && Rr[r].sights.includes('pa-md25'), r); assert.equal(Rr[r].defaultSight, 'fab-flipup'); }
  assert.deepEqual(Rr['iwi-tavor-sar'].sights, ['fab-flipup', 'pa-md25', 'seeall-gen1', 'pa-magnifier']);
  assert.deepEqual(Rr['ak-762'].sights, ['ak762-kns-peep', 'pa-3x-acss']);
  assert.deepEqual(Rr['ak-545'].sights, ['ak545-ball', 'ak545-xs']);
  assert.equal(Rr['molot-vepr-54r'].defaultSight, 'utg-bugbuster-3-9x32');
  for (const [r, rifle] of Object.entries(Rr)) if (!r.startsWith('_')) for (const s of rifle.sights) assert.ok(raw.rifles[r].sightHeightIn[s].source || raw.rifles[r].sightHeightIn[s].estimate.length > 40, `${r}: ${s}'s height has its basis`);
  // the old sights stay in the data, offered by no rifle
  for (const old of ['ar-irons', 'tavor-irons', 'ak-irons']) {
    assert.match(S[old].retired, /no rifle offers/);
    for (const [r, rifle] of Object.entries(Rr)) if (!r.startsWith('_')) assert.ok(!rifle.sights.includes(old), `${r} does not offer ${old}`);
  }
  assert.equal(S['vepr-irons'].retired, undefined, 'the Vepr\'s irons kept their id: not retired');
  // The two figures that decide each rifle's records, against main at fd94354 (data/sights.json and data/rifles.json there):
  // ar-irons 1.75 / 0.75 MOA, 2.6 in on the BCM; tavor-irons 1.5 / 1 MOA, 3.0 in on both Tavors; ak-irons 2 / 2 MOA, 1.9 in on both AKs; vepr-irons 2 / 2 MOA, 2.0 in.
  const before = { 'bcm-ar15': ['ar-irons', 1.75, 0.75, 2.6, 'troy-battlesights'], 'iwi-tavor-sar': ['tavor-irons', 1.5, 1, 3.0, 'fab-flipup'], 'iwi-x95': ['tavor-irons', 1.5, 1, 3.0, 'fab-flipup'],
    'ak-762': ['ak-irons', 2, 2, 1.9, 'ak762-kns-peep'], 'ak-545': ['ak-irons', 2, 2, 1.9, 'ak545-ball'], 'molot-vepr-54r': ['vepr-irons', 2, 2, 2.0, 'vepr-irons'] };
  const decided = {};
  for (const [r, [old, el, wd, h, now]] of Object.entries(before)) {
    assert.equal(S[old].clickMoa, el, `${old}'s click is as it was`); assert.equal(S[old].windageClickMoa, wd);
    const same = S[now].clickMoa === el && S[now].windageClickMoa === wd && Rr[r].sightHeightIn[now] === h;
    decided[r] = now === old ? 'kept its id' : same ? 'carries' : 'starts unzeroed';
    if (now === old) assert.ok(same, `${r}: a sight changed in place keeps its clicks and height`);
    else if (same) assert.equal(S[now].carriesRecordsOf.sight, old, `${r}: ${now} carries ${old}'s records`);
    else assert.ok(!S[now].carriesRecordsOf, `${r}: ${now} clicks or sits differently, so it carries nothing`);
  }
  console.log('  records: ' + Object.entries(decided).map(([r, w]) => `${r} ${w}`).join('; '));
  assert.deepEqual(decided, { 'bcm-ar15': 'starts unzeroed', 'iwi-tavor-sar': 'starts unzeroed', 'iwi-x95': 'starts unzeroed', 'ak-762': 'starts unzeroed', 'ak-545': 'carries', 'molot-vepr-54r': 'kept its id' });
  assert.ok(!S['ak545-xs'].carriesRecordsOf, 'one sight carries the old irons\' records on the 5.45: the ball post that took their place');
  // the kind check refuses a SeeAll with a post, a kind that is not one, and a second-focal-plane reticle without its power
  assert.ok(data.checkSights({ x: { ...JSON.parse(JSON.stringify(S['seeall-gen1'])), frontPostMoa: 5 } }).some((m) => /no front post/.test(m)));
  assert.ok(data.checkSights({ x: { kind: 'laser' } }).some((m) => /not a kind of sight: iron, dot, magnifier, scope, seeall/.test(m)));
  assert.ok(data.checkSights({ x: { kind: 'scope', clickMoa: 1, windageClickMoa: 1, clicks: 1, reticle: { focalPlane: 'second' } } }).some((m) => /trueAtPower/.test(m)));
});

test('range-day-twelve: the BugBuster\'s dots: the maker states a second-focal-plane reticle true at 10x, so at each power p the dots stand 10 / p milliradians apart', () => {
  const r = flat.sights['utg-bugbuster-3-9x32'].reticle, rr = raw.sights['utg-bugbuster-3-9x32'].reticle;
  assert.equal(r.focalPlane, 'second');
  assert.equal(r.trueAtPower, 10);
  assert.match(rr.trueAtPower.source.note, /All current UTG scopes have second focal plane reticles\." and "All reticles are calibrated at 10x magnification\./);
  assert.equal(r.dotSpacingMoa, 3.44);
});
