'use strict';
// range-day-nineteen: the expansion's first four rifles (data/rifles.json, expansion): the Tikka T3x CTR (6.5 Creedmoor), the
// JP Enterprises JP-15 (6mm ARC), the IWI Tavor 7 (7.62x51) and the Vudoo V-22 Ravage (.22 LR). Without a browser: the
// figures, the scope collection each carries, the gun records, and the 6.5 Creedmoor load against Hornady's own table. In a real
// browser, signing in through the form: each rifle picked under "More rifles", zeroed at the bench and fired on the line through
// a collection scope, the strike the engine's own figure to every digit. Needs Playwright's browser; where it is missing the
// browser tests are skipped and say so (the Checks workflow has it).
//   node --test test/expansion.test.js

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { raw, flat } = require('../lib/data').load();
const guns = require('../lib/guns');
const E = require('../public/engine.js');

const root = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 8995);
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";
const rifles = guns.fromFiles(raw);
const FOUR = ['tikka-t3x-ctr', 'jp-15-6arc', 'iwi-tavor-7', 'vudoo-v22-ravage'];
const COLLECTION = ['trijicon-acog-ta31f', 'trijicon-acog-ta31f-g', 'vortex-razor-1-10', 'leupold-mark5hd-5-25'];
const ICAO = { altitudeFt: 0, tempF: 59, pressureInHg: 29.92, humidity: 0 };

// --- the figures, no browser -------------------------------------------------------------------------------------------------
test('range-day-nineteen steps 2 to 5: the four are in the set after the seven, marked expansion rifles, each with its caliber\'s loads, no sights of its own and the whole scope collection, its default a collection scope at the rail\'s height plus the mount\'s', () => {
  const ids = Object.keys(rifles);
  assert.deepEqual(ids.slice(7), FOUR);
  const want = {
    'tikka-t3x-ctr': ['6.5 Creedmoor', 24, 'leupold-mark5hd-5-25', ['hornady-65cm-140-eldm', 'hornady-65cm-147-eldm'], 0.55],
    'jp-15-6arc': ['6mm ARC', 18, 'leupold-mark5hd-5-25', ['hornady-6arc-108-eldm', 'hornady-6arc-105-bthp'], 1.21],
    'iwi-tavor-7': ['7.62x51', 16.5, 'vortex-razor-1-10', ['federal-gm308m-168', 'hornady-308-168-eldm'], 2.25],
    'vudoo-v22-ravage': ['.22 LR', 16.5, 'leupold-mark5hd-5-25', ['cci-sv-40'], 1],
  };
  for (const id of FOUR) {
    const r = rifles[id], [cal, barrel, def, loads, rail] = want[id];
    assert.equal(r.expansion, true, id);
    assert.equal(r.playable, true, id);
    assert.equal(r.caliber, cal, id); assert.equal(r.barrelIn, barrel, id);
    assert.deepEqual(raw.rifles[id].sights, [], `${id}: no sights of its own`);
    assert.deepEqual(r.collection, COLLECTION, `${id}: the whole collection`);
    assert.deepEqual(r.sights, COLLECTION);
    assert.equal(r.defaultSight, def, id);
    assert.deepEqual(r.loads, loads, id);
    for (const l of loads) assert.equal(flat.loads[l].caliber, cal, `${id}: ${l}`);
    assert.equal(r.scopeMount.rail, 'picatinny');
    assert.equal(r.scopeMount.railHeightOverBoreIn, rail, id);
    for (const s of COLLECTION) assert.equal(r.sightHeightIn[s], Math.round((rail + flat.sights[s].mount.centerOverRailIn) * 1000) / 1000, `${id}: ${s}`);
    // the workbench: the rifle's own barrel among the lengths sold, a speed per inch for its caliber
    assert.ok(flat.workbench.barrels[id].includes(barrel), `${id}: its own barrel on the workbench`);
    assert.ok(typeof flat.workbench.fpsPerInch[cal] === 'number', `${id}: ${cal} speed per inch`);
  }
  // the Tavor 7 is sold with no iron sights (American Rifleman, cited in its entry): it opens on a scope, unlike the two Tavors
  assert.match(raw.rifles['iwi-tavor-7'].scopeMount.words, /does not come equipped with iron sights/);
  // the Vudoo takes the collection; the set's Remington .22 still takes none of it
  assert.deepEqual(rifles['remington-22'].collection, []);
  // a rifle with no sights of its own and a rail that takes no collection is refused by name
  const rec = guns.toRecord('tikka-t3x-ctr', raw.rifles['tikka-t3x-ctr']);
  const bad = JSON.parse(JSON.stringify(rec)); bad.fields.game.scopeMount.rail = 'rimfire-dovetail';
  assert.throws(() => guns.fromRecords([bad], raw), /^Error: gun 'tikka-t3x-ctr': sights is empty: a rifle with no sights of its own needs a scopeMount whose rail takes the scope collection \(picatinny\)$/);
  const bad2 = JSON.parse(JSON.stringify(rec)); bad2.fields.game.defaultSight = 'pa-md25';
  assert.throws(() => guns.fromRecords([bad2], raw), /defaultSight 'pa-md25' is not one of its sights: trijicon-acog-ta31f, trijicon-acog-ta31f-g, vortex-razor-1-10, leupold-mark5hd-5-25$/);
});

test('range-day-nineteen step 1: each new load\'s speed is the maker\'s from the rifle\'s own barrel, by the caliber\'s speed per inch where the barrel is not the maker\'s test barrel', () => {
  const lines = [];
  for (const id of FOUR.filter((x) => x !== 'vudoo-v22-ravage')) {
    const r = rifles[id];
    for (const l of r.loads) {
      const L = flat.loads[l];
      const want = Math.round(L.makerFps - (L.makerBarrelIn - r.barrelIn) * flat.workbench.fpsPerInch[r.caliber]);
      assert.equal(L.muzzleFps, want, `${l}: ${L.makerFps} fps from ${L.makerBarrelIn} in, ${r.barrelIn} in here`);
      lines.push(`${l}: ${L.makerFps} fps from ${L.makerBarrelIn} in -> ${L.muzzleFps} fps from the ${r.name}'s ${r.barrelIn} in`);
    }
  }
  console.log('  ' + lines.join('\n  '));
});

// Hornady Match 6.5 Creedmoor 140 gr ELD Match (#81500): Hornady's published table, 200 yd zero, the sight 1.5 in over the
// bore (the table's -1.5 in at the muzzle), as a calculator page relays it with "Hornady published data"
// (https://www.thecalcs.com/calculators/diy-outdoors-hobbies/hornady-ballistics-calculator, search text, read 2026-11-28: "2,710
// −1.5" | 2,564 +1.9" | 2,422 0.0" | 2,285 −7.8" | 2,152 −22.3" | 2,023 −44.4""); the 100-yard speed, 2,564 fps, is also
// in a retailer's copy of Hornady's figures (https://www.sportsmans.com/.../hornady-match-65-creedmoor-140gr-eld-rifle-ammo-20-rounds/p/1428411).
const HORNADY_65 = { 100: [1.9, 2564], 200: [0, 2422], 300: [-7.8, 2285], 400: [-22.3, 2152], 500: [-44.4, 2023] };
test('range-day-nineteen step 8: Hornady 140 gr ELD Match 6.5 Creedmoor against Hornady\'s table, G7 0.326, drop within 0.2 MOA to 500 yd (the tolerance the other makers\' checks use); the speeds within 1.5%', () => {
  const load = flat.loads['hornady-65cm-140-eldm'];
  assert.deepEqual([load.muzzleFps, load.bc, load.dragModel], [2710, 0.326, 'G7']);
  const base = { load, drag: flat.physics.dragTables, conditions: ICAO, wind: [], sightHeightIn: 1.5 };
  const el = E.zeroElevationMoa(base, 200);
  const lines = [];
  for (const y of Object.keys(HORNADY_65).map(Number)) {
    const r = E.fly({ ...base, elevationMoa: el, windageMoa: 0, targetYards: y });
    const [drop, v] = HORNADY_65[y];
    const diff = (r.hit.upIn - drop) / E.inchesPerMoa(y);
    lines.push(`${y} yd: drop ${r.hit.upIn.toFixed(1)} vs Hornady ${drop} in (${diff.toFixed(2)} MOA); ${r.speedFps.toFixed(0)} vs ${v} fps (${((r.speedFps - v) / v * 100).toFixed(1)}%)`);
    assert.ok(Math.abs(diff) <= 0.2, lines[lines.length - 1]);
    assert.ok(Math.abs(r.speedFps - v) / v < 0.015, lines[lines.length - 1]);
  }
  console.log('  Hornady 6.5 Creedmoor 140 gr ELD Match (G7 0.326, 2,710 fps, ICAO air, sight 1.5 in, 200 yd zero):\n    ' + lines.join('\n    '));
});

// --- in a browser ------------------------------------------------------------------------------------------------------------
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() { for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } } throw new Error('server never answered'); }
async function signedIn(viewport) {
  const context = await browser.newContext({ viewport: viewport || { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/login`);
  await page.fill('#passphrase', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  await page.waitForFunction(() => document.querySelector('#set li'));
  await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('range-day:picture', JSON.stringify('plain')); } catch {} });
  return { page, context, errors };
}
const engineFor = (rifleId, sightId, loadId, yards, setting, w, extra) => {
  const R = rifles[rifleId], S = flat.sights[sightId];
  return E.shoot({
    load: flat.loads[loadId], drag: flat.physics.dragTables, powder: flat.physics.powderTemperature,
    rifle: { sightHeightIn: R.sightHeightIn[sightId], boreOffsetMoa: { up: R.boreOffsetMoa.up, right: R.boreOffsetMoa.right } },
    sight: { clickMoa: S.clickMoa, windageClickMoa: S.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
    conditions: { altitudeFt: w.altitudeFt, tempF: w.tempF, pressureInHg: w.pressureInHg, humidity: w.humidity }, wind: w.wind, targetYards: yards, ...extra });
};

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

for (const id of FOUR) {
  test(`range-day-nineteen verify 3, ${id}: picked under "More rifles", its sight choice is the scope collection with its default picked; a zero saved at the bench; a shot on the line through the scope lands where the engine says, to every digit`, { skip }, async () => {
    const R = rifles[id], SIGHT = R.defaultSight, LOAD = R.loads[0];
    const { page, context, errors } = await signedIn();
    await page.goto(`${base}/`); await page.waitForSelector('.rifle.turn');
    await page.click('.rifle.turn'); await page.waitForSelector('.rifles-head');
    await page.click(`.rifle[data-rifle="${id}"]`); await page.waitForSelector(`.rifle.picked[data-rifle="${id}"]`);
    assert.deepEqual(await page.$$eval('#sight option', (o) => o.map((x) => x.value)), COLLECTION, 'only the collection');
    assert.equal(await page.$eval('#sight optgroup', (g) => g.label), 'From the scope collection');
    assert.equal(await page.inputValue('#sight'), SIGHT, 'its default scope is picked');
    assert.match(await page.textContent('#zero'), /Not zeroed yet/);
    // the bench: one shot with every random draw at 0.5 and the clock fixed, the hole the engine's; then a zero saved
    const q = `course=${R.firstCourse}&rifle=${id}&sight=${SIGHT}&load=${LOAD}`;
    await page.goto(`${base}/zero?${q}`); await page.waitForSelector('#fire5'); await page.waitForFunction(() => window.RangeDayZero && /zeroing supply/.test(document.getElementById('rounds').textContent));
    const b = await page.evaluate(() => { Math.random = () => 0.5; performance.now = () => 1000; document.getElementById('fire1').click(); const d = RangeDayZero.day; return { shot: d.shots[d.shots.length - 1], w: d.weather, distance: RangeDayZero.distance, setting: { ...RangeDayZero.setting } }; });
    const eb = engineFor(id, SIGHT, LOAD, b.distance, b.setting, b.w, { targetRiseFt: 0, t0: 1, rand: () => 0.5 });
    assert.equal(b.shot.upIn, Math.round(eb.hit.upIn * 100) / 100, 'the bench\'s hole, up');
    assert.equal(b.shot.rightIn, Math.round(eb.hit.rightIn * 100) / 100, 'the bench\'s hole, right');
    await page.click('#el-up'); await page.click('#save');
    assert.match(await page.textContent('#saved'), new RegExp(`Saved zero for ${flat.loads[LOAD].name.replace(/[()#]/g, '.').slice(0, 20)}`));
    // the line: the nearest steel, the hold on its center, the strike the engine's to every digit
    await page.goto(`${base}/line?${q}`); await page.waitForSelector('#fire'); await page.waitForFunction(() => window.RangeDayLine);
    const l = await page.evaluate(() => { RangeDayLine.setTarget(RangeDayLine.targets.find((t) => t.kind === 'steel').key); RangeDayLine.setHold(0, 0); RangeDayLine.fire(9); RangeDayLine.landAll(); const d = RD.openDay(); return { shot: d.shots[d.shots.length - 1], row: RangeDayLine.log[RangeDayLine.log.length - 1], input: RangeDayLine.lastShotInput, w: d.weather, setting: RangeDayLine.setting }; });
    assert.equal(l.input.sightHeightIn, R.sightHeightIn[SIGHT], 'the engine is given the scope\'s height over the bore on this rifle');
    assert.equal(l.setting.elevationClicks, b.setting.elevationClicks + 1, 'the line opens on the saved zero');
    // the browser's own engine (public/engine.js as the page has it), as test/scope22.test.js does; Node's agrees to 1e-9 in
    const el = await page.evaluate(([R, S, h, input, setting, w, load]) => { const E = RangeDayEngine; return RD.data().then((d) => E.shoot({
      load: d.loads[load], drag: d.physics.dragTables, powder: d.physics.powderTemperature,
      rifle: { sightHeightIn: h, boreOffsetMoa: { up: R.boreOffsetMoa.up, right: R.boreOffsetMoa.right } },
      sight: { clickMoa: S.clickMoa, windageClickMoa: S.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
      conditions: RD.conditionsOf(w), wind: w.wind, targetYards: input.targetYards, targetRiseFt: input.targetRiseFt, t0: 0, rand: E.seeded(9) })); }, [R, flat.sights[SIGHT], R.sightHeightIn[SIGHT], l.input, l.setting, l.w, LOAD]);
    const node = engineFor(id, SIGHT, LOAD, l.input.targetYards, l.setting, l.w, { targetRiseFt: l.input.targetRiseFt, t0: 0, rand: E.seeded(9) });
    assert.ok(Math.abs(node.hit.upIn - el.hit.upIn) < 1e-9 && Math.abs(node.hit.rightIn - el.hit.rightIn) < 1e-9, 'Node\'s engine agrees with the browser\'s');
    assert.equal(l.row.upIn, el.hit.upIn, 'where it landed, up: the engine\'s, every digit');
    assert.equal(l.row.rightIn, el.hit.rightIn, 'where it landed, right: the engine\'s, every digit');
    assert.equal(l.shot.flightS, el.timeS, 'the time of flight is the engine\'s');
    assert.equal(l.shot.sight, SIGHT); assert.equal(l.shot.rifle || id, id);
    console.log(`  ${id} (${SIGHT}, ${LOAD}): bench at ${b.distance} yd: hole ${b.shot.upIn}, ${b.shot.rightIn} in, the engine's ${Math.round(eb.hit.upIn * 100) / 100}, ${Math.round(eb.hit.rightIn * 100) / 100}; line at ${l.input.targetYards} yd: ${l.row.upIn} in up, ${l.row.rightIn} in right, ${l.shot.flightS} s; the engine: ${el.hit.upIn}, ${el.hit.rightIn}, ${el.timeS} s`);
    assert.deepEqual(errors, []);
    await context.close();
  });
}

test('range-day-nineteen step 6: home\'s "The whole set" lists the four under their own heading, saying they have no sights of their own', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/`); await page.waitForSelector('#set-more li');
  assert.equal(await page.$$eval('#set li', (l) => l.length), 7);
  assert.equal(await page.$$eval('#set-more li', (l) => l.length), 4);
  assert.equal(await page.isVisible('#set-more-head'), true);
  for (const t of await page.$$eval('#set-more li', (l) => l.map((x) => x.textContent))) assert.match(t, /No sights of its own\. From the scope collection: /);
  assert.deepEqual(errors, []);
  await context.close();
});
