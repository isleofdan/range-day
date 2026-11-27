'use strict';
// range-day-seventeen in a real browser, signing in through the form: the workbench page (step 4), a build at the bench and
// the line (step 5, verify 3 and 4), the records of an existing player left untouched (verify 5), the comparison on the book
// (step 6), and no drop shown (verify 6). Needs Playwright's browser; where it is missing these are skipped and say so (the
// Checks workflow has it).
//   node --test test/workbench-browser.test.js

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { raw, flat } = require('../lib/data').load();
const guns = require('../lib/guns');
const SEED = require('./playback-seed');

const root = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 8989);
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";
const rifles = guns.fromFiles(raw);
const VORTEX = 'vortex-razor-1-10';
const LOW = flat.workbench.mounts[VORTEX].find((m) => /PR34-L/.test(m.name)); // the Vortex Pro Series low rings, 0.95 in
// The build these tests make: the 5.56 carbine with a 20-inch barrel and the Vortex in the low rings. Its two figures, worked
// out here from the data files, not from public/builds.js: M193 from 20 in is the maker's own figure; the scope's height is the
// rail's plus the mount's.
const WANT_FPS = flat.loads['imi-m193'].makerFps; // 3166, from makerBarrelIn 20
const WANT_HEIGHT = Math.round((rifles['bcm-ar15'].scopeMount.railHeightOverBoreIn + LOW.centerOverRailIn) * 1000) / 1000;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() { for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } } throw new Error('server never answered'); }
const fresh = (page) => page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('range-day:picture', JSON.stringify('plain')); } catch {} });
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
  await page.waitForFunction(() => document.querySelector('#set li')); // home's last-used write has landed (test/bench.test.js)
  await fresh(page);
  return { page, context, errors };
}
const workbench = async (page, q = '') => { await page.goto(`${base}/workbench${q}`); await page.waitForSelector('#changes table'); };
// Makes the build on the page as the player does: the rifle, the barrel, the Vortex's mount, a name. Answers its id.
async function makeBuild(page, name) {
  await workbench(page, '?rifle=bcm-ar15');
  await page.selectOption('#barrel', '20');
  await page.click('#mounts summary');
  await page.selectOption(`#mount-${VORTEX}`, LOW.name);
  await page.fill('#name', name);
  await page.click('#make');
  await page.waitForSelector('#made a');
  return page.evaluate(() => JSON.parse(localStorage.getItem('range-day:builds')).slice(-1)[0].id);
}
const all = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('range-day-seventeen step 4 and verify 3: the workbench opens on the rifle as fitted with nothing changed; a 20-inch barrel shows IMI M193 at 3,166 feet per second, the engine\'s input on the line; making the build is changing one thing and naming it', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await workbench(page, '?rifle=bcm-ar15');
  assert.equal(await page.inputValue('#barrel'), '16', 'the length as fitted is already chosen');
  assert.equal(await page.isDisabled('#make'), true, 'nothing changed: nothing to make');
  assert.match(await page.textContent('#changes'), /Nothing changed yet/);
  await page.selectOption('#barrel', '20');
  assert.equal(await page.isDisabled('#make'), false);
  assert.equal(await page.inputValue('#name'), '20 in barrel', 'a name is offered from the change');
  const rows = await page.$$eval('#changes tbody tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
  const m193 = rows.find((r) => /^IMI M193 55 gr: muzzle speed/.test(r[0]));
  assert.deepEqual(m193.slice(1), ['3,066 feet per second', '3,166 feet per second']);
  assert.equal(WANT_FPS, 3166);
  assert.match(await page.textContent('#changes'), /25 feet per second more for each inch of barrel added/);
  // made with one change and the offered name
  await page.click('#make');
  await page.waitForSelector('#made a');
  assert.match(await page.textContent('#made'), /Made “20 in barrel”\. It starts unzeroed/);
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:builds'))[0].id);
  // on the line, the engine is given that figure (adjusted for the day's temperature by the engine itself, as for every load)
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=${id}&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#fire'); await page.waitForFunction(() => window.RangeDayLine);
  const r = await page.evaluate(() => { RangeDayLine.setHold(0, 0); RangeDayLine.fire(3); RangeDayLine.landAll(); const w = RD.openDay().weather; return { input: RangeDayLine.lastShotInput, tempF: w.tempF }; });
  const powder = flat.physics.powderTemperature;
  const expected = 3166 + powder.fpsPerDegreeF * (r.tempF - powder.referenceTempF);
  assert.ok(Math.abs(r.input.muzzleFps - expected) < 1e-9, `the line's input ${r.input.muzzleFps} is 3,166 at ${powder.referenceTempF} F moved to ${r.tempF} F: ${expected}`);
  console.log(`  workbench: M193 ${m193[1]} as fitted, ${m193[2]} with 20 in; the line's engine input ${r.input.muzzleFps.toFixed(2)} fps at ${r.tempF} F (3,166 at ${powder.referenceTempF} F)`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-seventeen verify 4: a build\'s shot is the engine\'s shot: at the bench and on the line, the screen\'s result equals the engine\'s own figure for the build\'s speed (3,166 feet per second) and sight height (the Vortex in low rings)', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const id = await makeBuild(page, 'low and long');
  const q = `course=angeles-sylmar&rifle=${id}&sight=${VORTEX}&load=imi-m193`;
  // The bench: the draw fixed (every random draw 0.5) and the clock fixed, so the engine's own figure can be worked out again here.
  await page.goto(`${base}/zero?${q}`); await page.waitForSelector('#fire5'); await page.waitForFunction(() => window.RangeDayZero && /zeroing supply/.test(document.getElementById('rounds').textContent));
  const bench = await page.evaluate(([fps, h]) => {
    Math.random = () => 0.5; performance.now = () => 1000;
    document.getElementById('fire1').click();
    const d = RangeDayZero.day, shot = d.shots[d.shots.length - 1], w = d.weather;
    return { shot, w, distance: RangeDayZero.distance, setting: RangeDayZero.setting };
  }, [WANT_FPS, WANT_HEIGHT]);
  const E = require('../public/engine.js');
  const R = rifles['bcm-ar15'], S = flat.sights[VORTEX];
  const engineAt = (yards, setting, w, extra) => E.shoot({
    load: { ...flat.loads['imi-m193'], muzzleFps: WANT_FPS }, drag: flat.physics.dragTables, powder: flat.physics.powderTemperature,
    rifle: { sightHeightIn: WANT_HEIGHT, boreOffsetMoa: { up: R.boreOffsetMoa.up, right: R.boreOffsetMoa.right } },
    sight: { clickMoa: S.clickMoa, windageClickMoa: S.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
    conditions: { altitudeFt: w.altitudeFt, tempF: w.tempF, pressureInHg: w.pressureInHg, humidity: w.humidity }, wind: w.wind, targetYards: yards, ...extra });
  const eb = engineAt(bench.distance, bench.setting, bench.w, { targetRiseFt: 0, t0: 1, rand: () => 0.5 });
  assert.equal(bench.shot.upIn, Math.round(eb.hit.upIn * 100) / 100, 'the bench\'s hole, up');
  assert.equal(bench.shot.rightIn, Math.round(eb.hit.rightIn * 100) / 100, 'the bench\'s hole, right');
  // the same shot with the rifle as fitted's figures lands elsewhere: the build's two figures are what moved it
  const fitted = E.shoot({ load: flat.loads['imi-m193'], drag: flat.physics.dragTables, powder: flat.physics.powderTemperature, rifle: { sightHeightIn: R.sightHeightIn[VORTEX], boreOffsetMoa: R.boreOffsetMoa }, sight: { clickMoa: S.clickMoa, windageClickMoa: S.windageClickMoa, elevationClicks: 0, windageClicks: 0 }, conditions: { altitudeFt: bench.w.altitudeFt, tempF: bench.w.tempF, pressureInHg: bench.w.pressureInHg, humidity: bench.w.humidity }, wind: bench.w.wind, targetYards: bench.distance, targetRiseFt: 0, t0: 1, rand: () => 0.5 });
  assert.notEqual(Math.round(fitted.hit.upIn * 100) / 100, bench.shot.upIn, 'the rifle as fitted would land elsewhere');
  // The line: a seeded shot at a plate, the hold at the center.
  await page.goto(`${base}/line?${q}`); await page.waitForSelector('#fire'); await page.waitForFunction(() => window.RangeDayLine);
  const line = await page.evaluate(() => { RangeDayLine.setTarget('2'); RangeDayLine.setHold(0, 0); RangeDayLine.fire(9); RangeDayLine.landAll(); const d = RD.openDay(); return { shot: d.shots[d.shots.length - 1], row: RangeDayLine.log[RangeDayLine.log.length - 1], input: RangeDayLine.lastShotInput, w: d.weather, setting: RangeDayLine.setting }; });
  assert.equal(line.input.sightHeightIn, WANT_HEIGHT, 'the engine is given the build\'s sight height');
  // the engine's own figure, worked out by the same engine in the same browser (Node's maths can differ in the 13th digit)
  const el = await page.evaluate(([fps, h, rifle, sight, input, setting, w]) => { const E = RangeDayEngine; return RD.data().then((d) => E.shoot({
    load: { ...d.loads['imi-m193'], muzzleFps: fps }, drag: d.physics.dragTables, powder: d.physics.powderTemperature,
    rifle: { sightHeightIn: h, boreOffsetMoa: { up: rifle.boreOffsetMoa.up, right: rifle.boreOffsetMoa.right } },
    sight: { clickMoa: sight.clickMoa, windageClickMoa: sight.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
    conditions: RD.conditionsOf(w), wind: w.wind, targetYards: input.targetYards, targetRiseFt: input.targetRiseFt, t0: 0, rand: E.seeded(9) })); }, [WANT_FPS, WANT_HEIGHT, R, S, line.input, line.setting, line.w]);
  const node = engineAt(line.input.targetYards, line.setting, line.w, { targetRiseFt: line.input.targetRiseFt, t0: 0, rand: E.seeded(9) });
  assert.ok(Math.abs(node.hit.upIn - el.hit.upIn) < 1e-9 && Math.abs(node.timeS - el.timeS) < 1e-12, 'Node\'s engine agrees with the browser\'s');
  assert.equal(line.shot.flightS, el.timeS, 'the time of flight is the engine\'s, every digit');
  assert.equal(line.row.upIn, el.hit.upIn, 'where it landed, up: the engine\'s, every digit');
  assert.equal(line.row.rightIn, el.hit.rightIn, 'where it landed, right: the engine\'s, every digit');
  assert.equal(line.shot.upIn, Math.round(el.hit.upIn * 100) / 100);
  console.log(`  bench at ${bench.distance} yd: hole ${bench.shot.upIn}, ${bench.shot.rightIn} in; the engine for 3,166 fps and ${WANT_HEIGHT} in: ${Math.round(eb.hit.upIn * 100) / 100}, ${Math.round(eb.hit.rightIn * 100) / 100} in (the rifle as fitted: ${Math.round(fitted.hit.upIn * 100) / 100} in up)`);
  console.log(`  line at ${line.input.targetYards} yd: ${line.row.upIn} in up, ${line.row.rightIn} in right, ${line.shot.flightS} s; the engine: ${el.hit.upIn}, ${el.hit.rightIn}, ${el.timeS} s`);
  // the day and the shot name the build
  assert.equal((await page.evaluate(() => RD.openDay().rifle)), id);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-seventeen verify 5: an existing player\'s records are untouched: seeded as the bench and playback tests seed them, then a build made, zeroed, fired at the bench and the line, removed and put back: every record key held before is the same, byte for byte', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  // The device as main left it: the bench test's records of the BCM's own sight (test/bench.test.js, verify 8) and the playback
  // test's day of the Vepr (test/playback-seed.js), packed up, with its book.
  await page.evaluate(() => { localStorage.setItem('range-day:zero:bcm-ar15:troy-battlesights:imi-m193', JSON.stringify({ elevationClicks: 2, windageClicks: -1, zeroYards: 100, sight: 'troy-battlesights', savedAt: '2026-11-20T10:00:00.000Z' })); localStorage.setItem('range-day:sight:bcm-ar15:troy-battlesights', JSON.stringify({ elevationClicks: 2, windageClicks: -1 })); });
  await page.goto(`${base}${SEED.LINE}`); await page.waitForSelector('#fire');
  await page.evaluate(SEED.seedInPage, SEED.seedShots(Date.parse('2026-11-20T09:00:00Z')));
  await page.evaluate(() => { localStorage.setItem('range-day:book:molot-vepr-54r:utg-bugbuster-3-9x32:sb-174-hpbt', JSON.stringify([{ id: 'seed:2', day: 'seed', n: 2, at: '2026-11-20T09:01:00.000Z', on: '2026-11-20', course: 'cta-piru', yards: 200, elevationClicks: 2, windageClicks: 0, elevationMoa: 0.5, windageMoa: 0, leaf: null, zero: null, heldUpMoa: 0, heldRightMoa: 0, tempF: 50, windCall: null, upIn: 2.1, rightIn: -1.4, struck: false, note: '' }])); RD.packUp(); });
  // The records held before. What a visit rewrites by design is left out and named: the last-used choices (last, last:<rifle>,
  // when) and the marker of the last packed-up day (day:packed), which a new day clears; the open day, which is a new day's.
  const CHOICES = /^range-day:(last(:.*)?|when|day:packed|day:open|picture)$/;
  const before = Object.fromEntries(Object.entries(await all(page)).filter(([k]) => !CHOICES.test(k)));
  assert.ok(Object.keys(before).length >= 4, Object.keys(before).join(', '));
  const id = await makeBuild(page, 'long');
  // zeroed and fired at the bench
  await page.goto(`${base}/zero?course=angeles-sylmar&rifle=${id}&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#fire5'); await page.waitForFunction(() => window.RangeDayZero && /zeroing supply/.test(document.getElementById('rounds').textContent));
  assert.match(await page.textContent('#saved'), /No zero saved yet/, 'a build starts unzeroed');
  await page.click('#fire5'); await page.click('#el-up'); await page.click('#save');
  // fired on the line; the build's day stays open (packing it up would add it to the list of finished days, the build's own day)
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=${id}&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#fire'); await page.waitForFunction(() => window.RangeDayLine);
  await page.evaluate(() => { RangeDayLine.setTarget('0'); RangeDayLine.setHold(0, 0); RangeDayLine.fire(4); RangeDayLine.fire(5); RangeDayLine.landAll(); });
  // removed, then put back, on the workbench
  await workbench(page);
  await page.click('.entry.build .remove');
  assert.equal(await page.$('.entry.build'), null, 'off the list');
  await page.goto(`${base}/`); await page.waitForSelector('#set li');
  assert.equal(await page.$(`#builds-of [data-rifle="${id}"]`), null, 'off home\'s list');
  await workbench(page);
  await page.click('.entry.removed .restore');
  assert.ok(await page.$(`.entry.build[data-build="${id}"]`), 'back on the list');
  const after = await all(page);
  for (const [k, v] of Object.entries(before)) assert.equal(after[k], v, `${k} unchanged, byte for byte`);
  const added = Object.keys(after).filter((k) => !(k in before) && !CHOICES.test(k)).sort();
  for (const k of added) assert.ok(k === 'range-day:builds' || k.includes(`:${id}:`) || k.endsWith(`:${id}`), `a key added is the build's own: ${k}`);
  // the build's day holds its shots at the bench and the line, naming the build
  const open = JSON.parse(after['range-day:day:open']);
  assert.equal(open.rifle, id);
  assert.deepEqual([...new Set(open.shots.map((x) => x.place))].sort(), ['bench', 'line']);
  console.log(`  keys held before (${Object.keys(before).length}), each the same after: ${Object.keys(before).sort().join(', ')}\n  keys the build added: ${added.join(', ')}`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-seventeen step 6 and verify 6: no drop is given: with no shots the workbench and the book\'s comparison show no figure from a flight; with hits, the comparison lines up only the player\'s own lines, blank where none', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const id = await makeBuild(page, 'compare');
  // No shots: the workbench's words and the comparison's carry no drop, come-up, zero setting or point of impact.
  const FLIGHT = /\b(drop|come-?up|holdover|hold over|point of impact|zero setting|lands?|strike|MOA|minutes? of angle|clicks?)\b/i;
  const wbText = await page.textContent('main');
  assert.doesNotMatch(wbText.replace(/It goes to the zero bench and the firing line like any rifle, starting unzeroed; what the change does shows where your shots land and in your own book\./, ''), FLIGHT);
  // every number on the workbench is a fact of the rifle or the build: a barrel length, a speed from the data, a height, a mount's
  const numbers = new Set([...flat.workbench.barrels['bcm-ar15'], ...Object.values(rifles['bcm-ar15'].sightHeightIn), WANT_HEIGHT, rifles['bcm-ar15'].scopeMount.railHeightOverBoreIn, ...Object.values(flat.workbench.mounts).flat().map((m) => m.centerOverRailIn), ...rifles['bcm-ar15'].loads.flatMap((l) => [flat.loads[l].muzzleFps, flat.loads[l].muzzleFps + 100]), 25, 26, 16.5, 34, 35, 3, 4, 1, 0, 2.6, 10, 24, 5, 51, 9].map(Number));
  // the figures: every cell of each table but the first column (which names the load or the sight)
  const strays = (await page.$$eval('#changes td:not(:first-child), #builds td:not(:first-child)', (tds) => tds.map((e) => e.textContent).join(' '))).match(/\d[\d,]*(\.\d+)?/g).map((s) => Number(s.replace(/,/g, ''))).filter((n) => !numbers.has(n));
  assert.deepEqual([...new Set(strays)], [], `no number on the workbench but the rifle's and the build's facts: ${[...new Set(strays)].join(', ')}`);
  await page.goto(`${base}/book?course=angeles-sylmar&rifle=${id}&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#intro:not(:empty)');
  assert.equal(await page.isHidden('#compare-box'), false);
  assert.match(await page.textContent('#compare-table'), /No hits on steel yet with either/);
  assert.doesNotMatch(await page.textContent('#compare-box'), FLIGHT);
  // Hits: one at 300 on the build's page, two at 300 and one at 500 on the rifle as fitted's, written as the line writes them.
  await page.evaluate(([b]) => {
    const line = (day, n, yards, el) => ({ id: `${day}:${n}`, day, n, at: `2026-11-2${n}T09:00:00.000Z`, on: `2026-11-2${n}`, course: 'angeles-sylmar', yards, elevationClicks: el, windageClicks: 0, elevationMoa: el * 1.33, windageMoa: 0, leaf: null, zero: { zeroYards: 100, elevationClicks: 2, windageClicks: 0, leafIx: null, leaf: null, elevationMoa: 2.66 }, heldUpMoa: 0, heldRightMoa: 0, tempF: 60, windCall: null, upIn: 1, rightIn: 0, struck: false, note: '' });
    RD.addBookLine(b, 'troy-battlesights', 'imi-m193', line('db', 1, 300, 6));
    RD.addBookLine('bcm-ar15', 'troy-battlesights', 'imi-m193', line('da', 2, 300, 7));
    RD.addBookLine('bcm-ar15', 'troy-battlesights', 'imi-m193', line('da', 3, 500, 14));
  }, [id]);
  await page.reload(); await page.waitForSelector('#compare-table table');
  const rows = await page.$$eval('#compare-table tbody tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
  assert.deepEqual(rows.map((r) => r[0]), ['300', '500'], 'distances lined up');
  assert.match(rows[0][1], /^5\.32 minutes of angle up/); assert.match(rows[0][2], /^6\.65 minutes of angle up/);
  assert.equal(rows[1][1], '', 'blank where the build has no line');
  assert.match(rows[1][2], /^15\.96 minutes of angle up/);
  console.log('  ' + rows.map((r) => `${r[0]} yd | build: ${r[1] || '(blank)'} | as fitted: ${r[2] || '(blank)'}`).join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-seventeen step 3: the copy file carries the builds: saved with a build and its book line, loaded on an empty device, the build is back under its id with its line; loading twice adds nothing; a copy without builds still loads', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const id = await makeBuild(page, 'copied');
  await page.goto(`${base}/book?course=angeles-sylmar&rifle=${id}&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#intro:not(:empty)');
  await page.evaluate((b) => RD.addBookLine(b, 'troy-battlesights', 'imi-m193', { id: 'cp:1', day: 'cp', n: 1, at: '2026-11-21T09:00:00.000Z', on: '2026-11-21', course: 'angeles-sylmar', yards: 300, elevationClicks: 6, windageClicks: 0, elevationMoa: 7.98, windageMoa: 0, leaf: null, zero: null, heldUpMoa: 0, heldRightMoa: 0, tempF: 60, windCall: null, upIn: 1, rightIn: 0, struck: false, note: '' }), id);
  const text = JSON.stringify(await page.evaluate(() => RangeDayBook.copy));
  assert.equal(JSON.parse(text).builds.length, 1);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForSelector('#intro:not(:empty)');
  const r = await page.evaluate((t) => RangeDayBook.loadText(t), text);
  assert.equal(r.buildsAdded, 1); assert.deepEqual(r.added, { zeros: 0, book: 1, cold_bore: 0, days: 0 }, 'the four counts keep their old shape');
  const back = await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:builds')));
  assert.equal(back[0].id, id); assert.equal(back[0].barrelIn, 20);
  await page.reload(); await page.waitForSelector('.entry');
  assert.match(await page.textContent('#intro'), /build “copied”/);
  const twice = await page.evaluate((t) => RangeDayBook.loadText(t), text);
  assert.equal(twice.buildsAdded, 0); assert.equal(twice.added.book, 0);
  const old = JSON.parse(text); delete old.builds;
  assert.equal(await page.evaluate((t) => { try { RD.checkCopy(JSON.parse(t)); return 'ok'; } catch (e) { return e.message; } }, JSON.stringify(old)), 'ok', 'a copy from before has no builds and loads');
  const bad = JSON.parse(text); bad.builds[0].barrelIn = 'long';
  assert.match(await page.evaluate((t) => { try { RD.checkCopy(JSON.parse(t)); return 'ok'; } catch (e) { return e.message; } }, JSON.stringify(bad)), /builds\[0\]\.barrelIn is "long"/);
  assert.deepEqual(errors, []);
  await context.close();
});
