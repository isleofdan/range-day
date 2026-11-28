'use strict';
// range-day-eighteen: the .22's own scope, the Primary Arms CLx 1-6x24 (data/sights.json, pa-clx-1-6x24). The figures and the
// height over the bore (no browser); then in a real browser, signing in through the form: the scope's shot is the engine's shot
// (verify 3), a click is the maker's click (verify 4), the glass is the maker's glass and its dot is drawn at the power in use
// (verify 5), old records untouched (verify 6), no drop given (verify 7), and the two screen repairs (step 5). Needs
// Playwright's browser; where it is missing the browser tests are skipped and say so (the Checks workflow has it).
//   node --test test/scope22.test.js

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { raw, flat } = require('../lib/data').load();
const guns = require('../lib/guns');
const B = require('../public/builds.js');
const E = require('../public/engine.js');

const root = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 8991);
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";
const rifles = guns.fromFiles(raw);
const RIFLE = 'remington-22', SCOPE = 'pa-clx-1-6x24', IRONS = 'rem-irons', LOAD = 'cci-sv-40';
const Q = `course=angeles-sylmar&rifle=${RIFLE}&sight=${SCOPE}&load=${LOAD}`;
const R = rifles[RIFLE], S = flat.sights[SCOPE];

// --- the figures, no browser -------------------------------------------------------------------------------------------------
test('range-day-eighteen steps 1 to 3: the CLx\'s figures are the maker\'s, each with its source; its height over the bore is the rings\' saddle, half its tube and the receiver\'s top; the .22 offers it after its open sights, which stay its default; it is not one of the collection', () => {
  const r = raw.sights[SCOPE];
  assert.equal(r.kind, 'scope');
  assert.equal(S.clickMoa, 0.5); assert.equal(S.windageClickMoa, 0.5); assert.equal(S.clicks, 120);
  assert.deepEqual([S.zoom.low, S.zoom.high], [1, 6]); assert.deepEqual([S.fovFtAt100.low, S.fovFtAt100.high], [113.5, 18.8]);
  assert.equal(S.tubeMm, 30);
  for (const k of ['clickMoa', 'windageClickMoa', 'clicks', 'tubeMm']) assert.match(r[k].source.url, /primaryarms\.com/, `${k} is the maker's figure`);
  for (const end of ['low', 'high']) { assert.ok(r.zoom[end].source.url); assert.ok(r.fovFtAt100[end].source.url); }
  assert.equal(S.reticle.focalPlane, 'second'); assert.equal(S.reticle.trueAtPower, 6); assert.equal(S.reticle.centerDotMoa, 2);
  assert.match(S.reticle.marksNotDrawn, /posts/);
  assert.ok(!r.collection, 'not one of the scope collection');
  // the height: the sourced saddle, half the maker's tube, the estimated receiver top
  const own = raw.rifles[RIFLE].scopeMount.ownScope;
  assert.equal(own.sight, SCOPE); assert.match(own.rings, /Warne 731M/);
  assert.match(own.ringsSaddleOverDovetailIn.source.url, /warnescopemounts\.com/);
  assert.ok(own.receiverTopOverBoreIn.estimate);
  const want = Math.round((own.ringsSaddleOverDovetailIn.value + S.tubeMm / 2 / 25.4 + own.receiverTopOverBoreIn.value) * 1000) / 1000;
  assert.equal(R.sightHeightIn[SCOPE], want, `the scope sits ${want} in over the bore`);
  assert.deepEqual(R.sights, [IRONS, SCOPE]); assert.equal(R.defaultSight, IRONS);
  assert.deepEqual(R.collection, [], 'the .22 still offers none of the collection');
  assert.equal(R.sightHeightIn[IRONS], 0.9, 'the open sights keep their height');
  // a workbench build of the .22 has no mount to change for its own scope, and keeps its height in a build
  assert.deepEqual(B.mountableOf(flat, R), []);
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
const bench = async (page, q = Q) => { await page.goto(`${base}/zero?${q}`); await page.waitForSelector('#fire5'); await page.waitForFunction(() => window.RangeDayZero && /zeroing supply/.test(document.getElementById('rounds').textContent)); };
const line = async (page, q = Q) => { await page.goto(`${base}/line?${q}`); await page.waitForSelector('#fire'); await page.waitForFunction(() => window.RangeDayLine); };
const all = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
// one bench shot with every random draw at 0.5 and the clock fixed, so the engine's figure can be worked out again here
const benchShot = (page) => page.evaluate(() => { Math.random = () => 0.5; performance.now = () => 1000; document.getElementById('fire1').click(); const d = RangeDayZero.day; return { shot: d.shots[d.shots.length - 1], w: d.weather, distance: RangeDayZero.distance, setting: { ...RangeDayZero.setting } }; });
const engineAt = (yards, setting, w, extra) => E.shoot({
  load: flat.loads[LOAD], drag: flat.physics.dragTables, powder: flat.physics.powderTemperature,
  rifle: { sightHeightIn: R.sightHeightIn[SCOPE], boreOffsetMoa: { up: R.boreOffsetMoa.up, right: R.boreOffsetMoa.right } },
  sight: { clickMoa: S.clickMoa, windageClickMoa: S.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
  conditions: { altitudeFt: w.altitudeFt, tempF: w.tempF, pressureInHg: w.pressureInHg, humidity: w.humidity }, wind: w.wind, targetYards: yards, ...extra });

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('range-day-eighteen verify 3: the scope\'s shot is the engine\'s shot: at the bench and on the line the screen\'s result equals the engine\'s own figure for the CLx\'s height over the bore', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/?rifle=${RIFLE}`); await page.waitForSelector(`.rifle.picked[data-rifle="${RIFLE}"]`);
  assert.deepEqual(await page.$$eval('#sight option', (o) => o.map((x) => x.value)), [IRONS, SCOPE], 'home offers the open sights, then the scope');
  assert.equal(await page.inputValue('#sight'), IRONS, 'the open sights are picked first');
  await bench(page);
  assert.match(await page.textContent('#saved'), /No zero saved yet/, 'the scope starts unzeroed');
  const b = await benchShot(page);
  const eb = engineAt(b.distance, b.setting, b.w, { targetRiseFt: 0, t0: 1, rand: () => 0.5 });
  assert.equal(b.shot.upIn, Math.round(eb.hit.upIn * 100) / 100, 'the bench\'s hole, up');
  assert.equal(b.shot.rightIn, Math.round(eb.hit.rightIn * 100) / 100, 'the bench\'s hole, right');
  await line(page);
  const l = await page.evaluate(() => { RangeDayLine.setTarget(RangeDayLine.targets.find((t) => t.kind === 'steel').key); RangeDayLine.setHold(0, 0); RangeDayLine.fire(9); RangeDayLine.landAll(); const d = RD.openDay(); return { shot: d.shots[d.shots.length - 1], row: RangeDayLine.log[RangeDayLine.log.length - 1], input: RangeDayLine.lastShotInput, w: d.weather, setting: RangeDayLine.setting }; });
  assert.equal(l.input.sightHeightIn, R.sightHeightIn[SCOPE], 'the engine is given the scope\'s height over the bore');
  const el = await page.evaluate(([rifle, sight, h, input, setting, w, load]) => { const E = RangeDayEngine; return RD.data().then((d) => E.shoot({
    load: d.loads[load], drag: d.physics.dragTables, powder: d.physics.powderTemperature,
    rifle: { sightHeightIn: h, boreOffsetMoa: { up: rifle.boreOffsetMoa.up, right: rifle.boreOffsetMoa.right } },
    sight: { clickMoa: sight.clickMoa, windageClickMoa: sight.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
    conditions: RD.conditionsOf(w), wind: w.wind, targetYards: input.targetYards, targetRiseFt: input.targetRiseFt, t0: 0, rand: E.seeded(9) })); }, [R, S, R.sightHeightIn[SCOPE], l.input, l.setting, l.w, LOAD]);
  const node = engineAt(l.input.targetYards, l.setting, l.w, { targetRiseFt: l.input.targetRiseFt, t0: 0, rand: E.seeded(9) });
  assert.ok(Math.abs(node.hit.upIn - el.hit.upIn) < 1e-9, 'Node\'s engine agrees with the browser\'s');
  assert.equal(l.row.upIn, el.hit.upIn, 'where it landed, up: the engine\'s, every digit');
  assert.equal(l.row.rightIn, el.hit.rightIn, 'where it landed, right: the engine\'s, every digit');
  assert.equal(l.shot.flightS, el.timeS, 'the time of flight is the engine\'s');
  assert.equal(l.shot.sight, SCOPE, 'the shot names the scope');
  // the open sights' height would have put it elsewhere
  const irons = E.shoot({ load: flat.loads[LOAD], drag: flat.physics.dragTables, powder: flat.physics.powderTemperature, rifle: { sightHeightIn: R.sightHeightIn[IRONS], boreOffsetMoa: R.boreOffsetMoa }, sight: { clickMoa: S.clickMoa, windageClickMoa: S.windageClickMoa, elevationClicks: 0, windageClicks: 0 }, conditions: { altitudeFt: b.w.altitudeFt, tempF: b.w.tempF, pressureInHg: b.w.pressureInHg, humidity: b.w.humidity }, wind: b.w.wind, targetYards: b.distance, targetRiseFt: 0, t0: 1, rand: () => 0.5 });
  assert.notEqual(Math.round(irons.hit.upIn * 100) / 100, b.shot.upIn);
  console.log(`  bench at ${b.distance} yd: hole ${b.shot.upIn}, ${b.shot.rightIn} in; the engine for ${R.sightHeightIn[SCOPE]} in: ${Math.round(eb.hit.upIn * 100) / 100}, ${Math.round(eb.hit.rightIn * 100) / 100} in (at the open sights' 0.9 in: ${Math.round(irons.hit.upIn * 100) / 100} in up)`);
  console.log(`  line at ${l.input.targetYards} yd: ${l.row.upIn} in up, ${l.row.rightIn} in right, ${l.shot.flightS} s; the engine: ${el.hit.upIn}, ${el.hit.rightIn}, ${el.timeS} s`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-eighteen verify 4: a click is the maker\'s click: 8 clicks up and 6 right at the bench move the strike by 8 and 6 half-minutes of angle at the bench\'s distance', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await bench(page);
  const a = await benchShot(page);
  for (let i = 0; i < 8; i++) await page.click('#el-up');
  for (let i = 0; i < 6; i++) await page.click('#wd-right');
  const b = await benchShot(page);
  assert.deepEqual([b.setting.elevationClicks - a.setting.elevationClicks, b.setting.windageClicks - a.setting.windageClicks], [8, 6]);
  const inPerMoa = E.inchesPerMoa(a.distance);
  const up = (b.shot.upIn - a.shot.upIn) / inPerMoa, right = (b.shot.rightIn - a.shot.rightIn) / inPerMoa;
  // the bore's angle changes by the clicks; at the bench's distance the strike moves by that angle within a hundredth of an inch's rounding and the flight's own small bend
  assert.ok(Math.abs(up - 8 * S.clickMoa) < 0.04 * 8 * S.clickMoa, `elevation: ${up.toFixed(3)} MOA for 8 clicks of ${S.clickMoa}`);
  assert.ok(Math.abs(right - 6 * S.windageClickMoa) < 0.04 * 6 * S.windageClickMoa, `windage: ${right.toFixed(3)} MOA for 6 clicks of ${S.windageClickMoa}`);
  console.log(`  at ${a.distance} yd: 8 clicks up moved the hole ${(b.shot.upIn - a.shot.upIn).toFixed(2)} in (${up.toFixed(3)} MOA, the maker's 8 x 0.5 = 4); 6 right moved it ${(b.shot.rightIn - a.shot.rightIn).toFixed(2)} in (${right.toFixed(3)} MOA, the maker's 3)`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-eighteen verify 5: the glass is the maker\'s glass: the drawn view at 1x and 6x is the maker\'s field of view; the 2 MOA dot is 2 MOA at 6x and six times that at 1x (second focal plane)', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page);
  const lines = [];
  for (const [end, m] of [['low', S.zoom.low], ['high', S.zoom.high]]) {
    await page.evaluate((z) => RangeDayLine.setZoom(z), m);
    const fov = await page.evaluate(() => RangeDayLine.fovMoa);
    const want = (S.fovFtAt100[end] * 12) / E.inchesPerMoa(100);
    lines.push(`at ${m}x: view ${fov.toFixed(3)} MOA across, the maker's ${S.fovFtAt100[end]} ft at 100 yards is ${want.toFixed(3)} MOA`);
    assert.ok(Math.abs(fov - want) < 1e-9, lines[lines.length - 1]);
    const g = await page.evaluate(() => RangeDayLine.geometry);
    assert.equal(g.crosshair, true);
    const dotMoa = g.centerDotPx / g.pxPerMoa;
    assert.ok(Math.abs(dotMoa - (S.reticle.centerDotMoa * S.reticle.trueAtPower) / m) < 1e-9, `the dot at ${m}x covers ${dotMoa} MOA`);
    lines.push(`  the dot covers ${dotMoa.toFixed(2)} MOA (${g.centerDotPx.toFixed(2)} px)`);
  }
  console.log('  ' + lines.join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-eighteen verify 6: old records are untouched: with a zero, a sight setting, a shot log and a book line for the .22\'s open sights on the device, the scope is picked, zeroed and fired: every key held before is the same, byte for byte; the scope starts unzeroed and carries none of them', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  // the seed (no existing test seeds the .22's open sights with all of these; made here in the stored shapes of docs/RECORDS.md)
  await page.evaluate(([r, s, l]) => {
    localStorage.setItem(`range-day:zero:${r}:${s}:${l}`, JSON.stringify({ elevationClicks: 1, windageClicks: -1, zeroYards: 50, sight: s, savedAt: '2026-11-20T10:00:00.000Z' }));
    localStorage.setItem(`range-day:sight:${r}:${s}`, JSON.stringify({ elevationClicks: 1, windageClicks: -1 }));
    localStorage.setItem(`range-day:log:${r}:${s}:${l}`, JSON.stringify([{ n: 1, yards: 100, hit: true, upIn: 1.2, rightIn: -0.4 }]));
    localStorage.setItem(`range-day:book:${r}:${s}:${l}`, JSON.stringify([{ id: 'seed:1', day: 'seed', n: 1, at: '2026-11-20T09:01:00.000Z', on: '2026-11-20', course: 'angeles-sylmar', yards: 100, elevationClicks: 1, windageClicks: -1, elevationMoa: 3, windageMoa: -3, leaf: null, zero: null, heldUpMoa: 0, heldRightMoa: 0, tempF: 55, windCall: null, upIn: 1.2, rightIn: -0.4, struck: false, note: '' }]));
  }, [RIFLE, IRONS, LOAD]);
  const CHOICES = /^range-day:(last(:.*)?|when|day:packed|day:open|picture)$/;
  const before = Object.fromEntries(Object.entries(await all(page)).filter(([k]) => !CHOICES.test(k)));
  assert.equal(Object.keys(before).length, 4, Object.keys(before).join(', '));
  await page.goto(`${base}/?rifle=${RIFLE}`); await page.waitForSelector(`.rifle.picked[data-rifle="${RIFLE}"]`);
  await page.selectOption('#sight', SCOPE);
  assert.match(await page.textContent('#zero'), /Not zeroed yet/, 'the scope starts unzeroed: no other sight\'s zero is carried');
  await bench(page);
  const setting = await page.evaluate(() => RangeDayZero.setting);
  assert.deepEqual([setting.elevationClicks, setting.windageClicks], [0, 0], 'the scope starts at the middle of its clicks');
  await page.click('#fire5'); await page.click('#el-up'); await page.click('#save');
  await line(page);
  await page.evaluate(() => { RangeDayLine.setTarget(RangeDayLine.targets.find((t) => t.kind === 'steel').key); RangeDayLine.setHold(0, 0); RangeDayLine.fire(4); RangeDayLine.fire(5); RangeDayLine.landAll(); });
  const after = await all(page);
  for (const [k, v] of Object.entries(before)) assert.equal(after[k], v, `${k} unchanged, byte for byte`);
  const added = Object.keys(after).filter((k) => !(k in before) && !CHOICES.test(k)).sort();
  for (const k of added) assert.ok(k.includes(`:${SCOPE}`) || /^range-day:(supply|days|coldbore):/.test(k) || k === 'range-day:days', `a key added is the scope's own or the day's: ${k}`);
  assert.ok(added.includes(`range-day:zero:${RIFLE}:${SCOPE}:${LOAD}`), 'the scope\'s own zero');
  console.log(`  keys held before (${Object.keys(before).length}), each the same after: ${Object.keys(before).sort().join(', ')}\n  keys added: ${added.join(', ')}`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-eighteen verify 7: no drop is given: at the bench and on the line with the scope and no shots fired, no distance or come-up worked out from a flight appears; the reticle carries no figure', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const FLIGHT = /\b(drop|come-?up|holdover|hold over|point of impact|will land|lands? at|should hit)\b/i;
  await bench(page);
  assert.doesNotMatch(await page.textContent('main'), FLIGHT, 'the bench');
  await line(page);
  for (const z of [1, 6]) {
    await page.evaluate((m) => RangeDayLine.setZoom(m), z);
    const text = (await page.textContent('main')).replace(/Show the conditions \([^)]*\)/, ''); // the setting's own label names what it shows
    assert.doesNotMatch(text, FLIGHT, `the line at ${z}x`);
    const g = await page.evaluate(() => RangeDayLine.geometry);
    assert.equal(g.marksPx, null, 'no hold marks on the reticle'); assert.equal(g.reticleKind, 'crosshair');
  }
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-eighteen step 5: the workbench\'s closed mount pickers show the height and a name that tells the choices apart, wholly, at 412 and 378 wide; home with a build picked keeps Zero bench and Firing line wholly on a 412x915 screen with room under them (measured on the Checks machine, whose font is wider than a phone\'s)', { skip }, async () => {
  for (const vp of [{ width: 412, height: 915 }, { width: 378, height: 762 }]) {
    const { page, context, errors } = await signedIn(vp);
    await page.goto(`${base}/workbench?rifle=bcm-ar15`); await page.waitForSelector('#changes table'); await page.click('#mounts summary');
    const fit = await page.evaluate(() => {
      const c = document.createElement('canvas').getContext('2d'), out = [];
      for (const s of document.querySelectorAll('#mounts select')) {
        const cs = getComputedStyle(s); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const room = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 20; // the arrow
        const texts = [...s.options].map((o) => o.text);
        out.push({ scope: s.dataset.scope, room, widest: Math.max(...texts.map((t) => c.measureText(t).width)), texts, full: document.getElementById(`mount-full-${s.dataset.scope}`).textContent });
      }
      return out;
    });
    for (const f of fit) {
      assert.ok(f.widest <= f.room, `${vp.width}: ${f.scope}: every choice fits its closed picker (${f.widest.toFixed(0)} of ${f.room.toFixed(0)} px): ${f.texts.join(' | ')}`);
      assert.equal(new Set(f.texts).size, f.texts.length, 'no two choices read the same');
      for (const t of f.texts) assert.match(t, /^\d+(\.\d+)? in · /, 'the height leads');
      assert.match(f.full, / over the rail$/, 'the full name stands under the picker');
    }
    // home with a build picked
    await page.selectOption('#barrel', '20'); await page.fill('#name', 'long'); await page.click('#make'); await page.waitForSelector('#made a');
    const id = await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:builds')).slice(-1)[0].id);
    await page.goto(`${base}/?rifle=${id}`); await page.waitForSelector('#builds-of .chip.picked');
    const box = await page.evaluate(() => ['go-zero', 'go-line'].map((i) => document.getElementById(i).getBoundingClientRect().bottom));
    if (vp.width === 412) for (const b of box) assert.ok(b <= 915 - 16, `a door ends at ${b} px, with ${915 - b} px under it`);
    console.log(`  ${vp.width}x${vp.height}: widest choice ${Math.max(...fit.map((f) => f.widest)).toFixed(0)} px of ${Math.min(...fit.map((f) => f.room)).toFixed(0)}; home's doors end at ${box.map(Math.round).join(' and ')} px`);
    assert.deepEqual(errors, []);
    await context.close();
  }
});
