'use strict';
// The near targets and the spotting scope (brief range-day-ten, task item 10
// and verify 2 to 5), in a real browser signing in through the form: a seeded
// shot at each new target lands where the engine says and its row names its
// target; a paper shot writes no book line, a first shot at paper writes the
// cold-bore line; the holes and the steel's marks are still there after a
// reload; a fresh paper and its undo; the scope's view width at its lowest
// and highest power is the data's field of view; Fire does nothing at the
// scope; going to the scope and back moves nothing; and the scene draws each
// new target where the plain drawing does, through the rifle's sights and
// through the scope. Needs Playwright's browser; where it is missing these
// are skipped and say so (the Checks workflow has it).
//   node --test test/near.test.js   (scripts/check.mjs, group "near")

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const E = require('../public/engine.js');
const { flat } = require('../lib/data').load();
const { PHONES } = require('./line-reach.js');

const root = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 8975);
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";

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
  await page.evaluate(() => localStorage.clear());
  return { page, context, errors };
}
const setPicture = (page, p) => page.evaluate((v) => { localStorage.removeItem('range-day:day:open'); localStorage.setItem('range-day:picture', JSON.stringify(v)); }, p);
const AR = 'course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193';
const VEPR = 'course=cta-piru&rifle=molot-vepr-54r&sight=utg-2-7x44&load=sb-174-hpbt';
const line = async (page, q) => {
  await page.goto(`${base}/line?${q}`, { timeout: 120000 }); await page.waitForSelector('#fire', { timeout: 120000 });
  await page.waitForFunction(() => window.RangeDayLine && (RangeDayLine.scene || RangeDayLine.sceneFailed || (!RangeDayLine.sceneLoading && RangeDayLine.picture === 'plain')), null, { timeout: 120000 });
};
async function seededShot(page, seed) {
  const before = await page.evaluate(() => RangeDayLine.log.length);
  await page.evaluate((s) => RangeDayLine.fire(s), seed);
  await page.waitForFunction((n) => RangeDayLine.log.length > n, before, { timeout: 30000 });
  return page.evaluate(() => RangeDayLine.log[RangeDayLine.log.length - 1]);
}
// The engine's own figure for a seeded shot from the hold, in Node: the same inputs the page gives it (public/line.js, fire).
function engineShot({ rifleId, sightId, loadId, t, weather, seed, setting, hold }) {
  const rifle = flat.rifles[rifleId], sight = flat.sights[sightId], load = flat.loads[loadId];
  const r = E.shoot({ rand: E.seeded(seed), load, drag: flat.physics.dragTables, powder: flat.physics.powderTemperature,
    rifle: { sightHeightIn: rifle.sightHeightIn[sightId], boreOffsetMoa: { up: rifle.boreOffsetMoa.up, right: rifle.boreOffsetMoa.right } },
    sight: { clickMoa: sight.clickMoa, windageClickMoa: sight.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
    targetYards: t.yards, targetRiseFt: t.riseFt, conditions: { altitudeFt: weather.altitudeFt, tempF: weather.tempF, pressureInHg: weather.pressureInHg, humidity: weather.humidity }, wind: weather.wind, t0: 0 });
  const ipm = E.inchesPerMoa(t.yards);
  return r.reached ? { upIn: r.hit.upIn + hold.up * ipm, rightIn: r.hit.rightIn + hold.right * ipm } : null;
}

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('range-day-ten verify 2: twenty seeded shots at each new target (paper at 50 and 100 yards on both courses, the canyon\'s 100-yard steel) land where the engine says, and each row names its target', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 1280, height: 800 });
  const lines = [];
  for (const [courseId, q, rifleId, sightId, loadId] of [['angeles-sylmar', AR, 'bcm-ar15', 'ar-irons', 'imi-m193'], ['cta-piru', VEPR, 'molot-vepr-54r', 'utg-2-7x44', 'sb-174-hpbt']]) {
    await setPicture(page, 'plain');
    await line(page, q);
    const targets = (await page.evaluate(() => RangeDayLine.targets)).filter((t) => t.key.startsWith('near-'));
    assert.equal(targets.length, flat.courses[courseId].near.length);
    for (const t of targets) {
      await page.evaluate((k) => RangeDayLine.setTarget(k), t.key);
      const hold = { up: 3, right: -1 };
      await page.evaluate(([u, r]) => RangeDayLine.setHold(u, r), [hold.up, hold.right]);
      let worst = 0, onIt = 0;
      for (let i = 0; i < 20; i++) {
        await page.evaluate(() => { if (RangeDayLine.day.box.left < 2) RD.openAnotherBox(RangeDayLine.day); });
        const seed = 1000 + i;
        const row = await seededShot(page, seed);
        const day = await page.evaluate(() => ({ weather: RangeDayLine.weather, setting: RangeDayLine.setting, last: RangeDayLine.day.shots[RangeDayLine.day.shots.length - 1] }));
        const e = engineShot({ rifleId, sightId, loadId, t, weather: day.weather, seed, setting: day.setting, hold });
        assert.ok(e, `${courseId} ${t.kind} ${t.yards}: the engine's bullet reaches`);
        const d = Math.max(Math.abs(row.upIn - e.upIn), Math.abs(row.rightIn - e.rightIn));
        worst = Math.max(worst, d);
        assert.ok(d < 1e-6, `${courseId} ${t.kind} ${t.yards} seed ${seed}: the row's landing ${row.upIn}, ${row.rightIn} is the engine's ${e.upIn}, ${e.rightIn}`);
        assert.equal(row.target, t.kind, 'the log row names its target');
        assert.equal(day.last.target, t.kind, 'the day\'s shot names its target');
        assert.equal(day.last.yards, t.yards);
        if (row.hit) onIt++;
      }
      lines.push(`${courseId} ${t.kind} ${t.yards} yd (${t.widthIn} x ${t.heightIn} in, rise ${t.riseFt} ft, ${t.lateralYd} yd sideways): 20 seeded shots, largest difference from the engine ${worst.toExponential(1)} in, ${onIt} on the ${t.kind === 'paper' ? 'sheet' : 'plate'}`);
    }
  }
  assert.deepEqual(errors, []);
  await context.close();
  console.log('  ' + lines.join('\n  '));
});

test('range-day-ten verify 4: records: a paper shot\'s row and a steel shot\'s row name their target, an old row without one reads as steel; a paper shot writes no book line; the day\'s first shot, at paper, writes the cold-bore line with hit meaning on the sheet; a steel hit writes its book line', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  await setPicture(page, 'plain');
  await line(page, AR);
  const counts = () => page.evaluate(() => ({ book: RD.getBook('bcm-ar15', 'ar-irons', 'imi-m193').length, cold: RD.getColdBore('bcm-ar15', 'imi-m193').length }));
  const c0 = await counts();
  // the day's first shot, at the 50-yard paper, aimed at the sheet's center (seeded, held where the probe says)
  await page.evaluate(() => RangeDayLine.setTarget('near-0'));
  const paper = await seededShot(page, 7);
  assert.equal(paper.target, 'paper');
  assert.equal(paper.hit, true, `the first paper shot lands on the sheet: ${JSON.stringify(paper)}`);
  assert.match(paper.where, /^on paper \(.* from the (center|upper left|upper right|lower left|lower right) mark\)$|^on paper \(dead on the .* mark\)$/);
  assert.match(await page.textContent('#result'), /^On paper at 50 yards, /);
  const c1 = await counts();
  const coldLine = (await page.evaluate(() => RD.getColdBore('bcm-ar15', 'imi-m193')))[0];
  assert.equal(c1.book, c0.book, 'a paper shot writes no book line');
  assert.equal(c1.cold, c0.cold + 1, 'the day\'s first shot, at paper, writes the cold-bore line');
  assert.equal(coldLine.target, 'paper'); assert.equal(coldLine.hit, true, 'hit means on the sheet');
  // a steel hit at the 100-yard plate (key "0"): one book line, no cold-bore line (not the first shot)
  await page.evaluate(() => RangeDayLine.setTarget('0'));
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  const probe = await seededShot(page, 8);
  const ipm = E.inchesPerMoa(100);
  await page.evaluate(([u, r]) => RangeDayLine.setHold(u, r), [-probe.upIn / ipm, -probe.rightIn / ipm]);
  const steel = await seededShot(page, 8);
  assert.equal(steel.target, 'steel'); assert.equal(steel.hit, true);
  assert.match(steel.where, /^hit \(dead on the center\)$/, `a dead-center hit reads "dead on the center", not "level, centered of center": ${steel.where}`);
  const c2 = await counts();
  assert.equal(c2.book, c1.book + 1, 'a steel hit writes one book line');
  assert.equal(c2.cold, c1.cold);
  const rows = await page.evaluate(() => RangeDayLine.day.shots.map((s) => ({ n: s.n, target: s.target, yards: s.yards, hit: s.hit })));
  // an old row without a target reads as steel: a day shot written before range-day-ten is a steel mark, never a hole
  const old = await page.evaluate(() => { const day = { shots: [{ n: 1, place: 'line', yards: 100, hit: true, reached: true, upIn: 1, rightIn: 1 }] }; return { kind: RD.kindOf({ kind: day.shots[0].target }), marks: RD.steelMarks(day, { yards: 100 }).length, holes: RD.paperHoles(day, { yards: 100, widthIn: 12, heightIn: 18 }).length }; });
  assert.deepEqual(old, { kind: 'steel', marks: 1, holes: 0 });
  assert.deepEqual(errors, []);
  await context.close();
  console.log(`  paper row: ${JSON.stringify(paper)}\n  steel row: ${JSON.stringify(steel)}\n  the day's shots: ${JSON.stringify(rows)}\n  book lines ${c0.book} → ${c1.book} (paper shot) → ${c2.book} (steel hit); cold-bore lines ${c0.cold} → ${c1.cold} → ${c2.cold}; cold-bore line: ${JSON.stringify(coldLine)}\n  an old row without a target: ${JSON.stringify(old)}`);
});

test('range-day-ten verify 4: the holes in the paper and the marks on the steel are rebuilt from the day: the same count after a reload, in the plain drawing and the 3D picture alike; a fresh paper clears the sheet, keeps every shot, and its undo puts the old paper back, also across a reload', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  await setPicture(page, 'plain');
  await line(page, VEPR);
  await page.evaluate(() => RangeDayLine.setTarget('near-0'));
  await page.evaluate(() => RangeDayLine.setHold(8, -2));
  for (let i = 0; i < 5; i++) await seededShot(page, 300 + i);
  await page.evaluate(() => RangeDayLine.setTarget('near-2'));
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  const probe = await seededShot(page, 400);
  const ipm = E.inchesPerMoa(100);
  await page.evaluate(([u, r]) => RangeDayLine.setHold(u, r), [-probe.upIn / ipm, -probe.rightIn / ipm]);
  await seededShot(page, 400); await seededShot(page, 400);
  const count = () => page.evaluate(() => ({ holes: RangeDayLine.holes('near-0').length, marks: RangeDayLine.steelMarks('near-2').length, shots: RangeDayLine.day.shots.length }));
  const before = await count();
  assert.equal(before.holes, 5); assert.ok(before.marks >= 2, `two hits marked: ${before.marks}`);
  await page.reload(); await line(page, VEPR);
  const after = await count();
  assert.deepEqual(after, before, 'the same holes and marks after a reload');
  // the 3D picture rebuilds them too (its paper texture is painted from the same holes; the steel's strikes are put back quietly)
  await page.evaluate(() => localStorage.setItem('range-day:picture', JSON.stringify('full')));
  await line(page, VEPR);
  assert.equal(await page.evaluate(() => RangeDayLine.picture), 'full');
  assert.deepEqual(await count(), before, 'the same in the 3D picture');
  // a fresh paper, then its undo
  await page.evaluate(() => RangeDayLine.setTarget('near-0'));
  assert.ok(await page.isVisible('#fresh-paper'), 'the control shows when a paper is chosen');
  await page.click('#fresh-paper');
  let now = await count();
  assert.equal(now.holes, 0, 'a fresh paper shows no holes'); assert.equal(now.shots, before.shots, 'no shot is deleted');
  assert.match(await page.textContent('#paper-note'), /A fresh paper hangs at 50 yards; the old one had 5 holes/);
  await page.click('#old-paper');
  assert.equal((await count()).holes, 5, '"Put the old paper back" undoes the fresh paper');
  assert.match(await page.textContent('#paper-note'), /The old paper is back at 50 yards, with its 5 holes/);
  // hung again, it holds across a reload; a shot after it shows on the fresh sheet alone
  await page.click('#fresh-paper');
  await page.reload(); await line(page, VEPR); await page.evaluate(() => RangeDayLine.setTarget('near-0'));
  assert.equal((await count()).holes, 0, 'the fresh paper holds across a reload');
  await page.evaluate(() => RangeDayLine.setHold(8, -2));
  await seededShot(page, 300);
  now = await count();
  assert.equal(now.holes, 1, 'a shot after the fresh paper shows on it'); assert.equal(now.shots, before.shots + 1);
  await page.evaluate(() => RangeDayLine.setTarget('0'));
  assert.ok(await page.isHidden('#paper-row'), 'the control is not shown for steel');
  assert.deepEqual(errors.filter((e) => !/swiftshader|GPU stall|PCFSoftShadowMap/i.test(e)), []);
  await context.close();
  console.log(`  holes and marks before a reload ${JSON.stringify(before)}, after ${JSON.stringify(after)}`);
});

test('range-day-ten verify 3 and 5: the spotting scope: its view is the data\'s field of view at its lowest and highest power; Fire, Steady and the keyboard do nothing there; a shot in the air lands in its view; going to the scope and back moves the view, the sight strip and the bar by 0 pixels at 412x830, 412x915 and 1280x800, and every new button is at least 44 pixels tall', { skip }, async () => {
  const lines = [];
  const S = flat.spotting;
  for (const [w, h] of [...PHONES, [1280, 800]]) {
    const { page, context, errors } = await signedIn({ width: w, height: h });
    await setPicture(page, 'plain');
    await line(page, VEPR);
    await page.evaluate(() => window.scrollTo(0, 0));
    const places = () => page.evaluate(() => { const b = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10); }; return { view: b('#view'), strip: b('.strip'), bar: b('.firebar'), pick: b('.pick'), scrollY: window.scrollY }; });
    const start = await places();
    const moved = (now) => ['view', 'strip', 'bar', 'pick'].map((k) => now[k].map((v, i) => Math.abs(v - start[k][i])).reduce((a, b) => Math.max(a, b), 0));
    await page.click('#spotting');
    assert.equal(await page.evaluate(() => RangeDayLine.spotting), true);
    const at = await places();
    assert.deepEqual(moved(at), [0, 0, 0, 0], `${w}x${h}: going to the scope moved nothing: ${JSON.stringify(at)} against ${JSON.stringify(start)}`);
    assert.equal(at.scrollY, 0);
    // the view at the lowest and highest power: its width in pixels covers exactly the data's field of view
    const widths = [];
    for (const m of [S.zoom.low, S.zoom.high]) {
      await page.evaluate((z) => RangeDayLine.setSpotZoom(z), m);
      const g = await page.evaluate(() => ({ k: RangeDayLine.geometry.pxPerMoa, px: RangeDayLine.geometry.viewPx, fov: RangeDayLine.fovMoa }));
      const dataMoa = ((m === S.zoom.low ? S.fovFtAt1000.low : S.fovFtAt1000.high) * 12) / E.inchesPerMoa(1000);
      assert.ok(Math.abs(g.fov - dataMoa) < 1e-9, `${m}x: the view spans ${g.fov} MOA, the data's ${dataMoa}`);
      assert.ok(Math.abs(g.k * dataMoa - g.px) < 1e-6, `${m}x: the data's field of view is ${g.k * dataMoa} px, the view ${g.px} px`);
      widths.push(`${m}x: ${g.px} px across = ${dataMoa.toFixed(2)} MOA (${m === S.zoom.low ? S.fovFtAt1000.low : S.fovFtAt1000.high} ft at 1,000 yards), ${g.k.toFixed(3)} px per MOA`);
    }
    // Fire, Steady and the keyboard do nothing at the scope; "Back to the rifle" stands in the bar where they stood
    const rounds0 = await page.evaluate(() => [RangeDayLine.log.length, RangeDayLine.day.box.left, RangeDayLine.pending]);
    await page.evaluate(() => { const f = document.getElementById('fire'); f.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 3, bubbles: true })); f.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); RangeDayLine.fire(5); document.body.focus(); window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' })); });
    assert.deepEqual(await page.evaluate(() => [RangeDayLine.log.length, RangeDayLine.day.box.left, RangeDayLine.pending]), rounds0, 'nothing was fired from the scope');
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('fire')).visibility), 'hidden');
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('steady')).visibility), 'hidden');
    const back = await page.evaluate(() => { const b = document.getElementById('back-to-rifle').getBoundingClientRect(), f = document.querySelector('.firebar').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, height: b.height, barTop: f.top, barBottom: f.bottom }; });
    assert.ok(back.height >= 44 && back.top >= back.barTop && back.bottom <= back.barBottom, `"Back to the rifle" stands in the bar: ${JSON.stringify(back)}`);
    const heights = await page.evaluate(() => ['spotting', 'spot-zoom', 'back-to-rifle'].map((id) => [id, Math.round(document.getElementById(id).getBoundingClientRect().height * 10) / 10]));
    for (const [id, ht] of heights) assert.ok(ht >= 44, `${w}x${h}: #${id} is ${ht} px tall`);
    // back by the bar's button, then there and back by the control beside the glass
    await page.click('#back-to-rifle');
    assert.equal(await page.evaluate(() => RangeDayLine.spotting), false);
    assert.deepEqual(moved(await places()), [0, 0, 0, 0], `${w}x${h}: back to the rifle moved nothing`);
    await page.click('#spotting'); await page.click('#spotting');
    assert.deepEqual(moved(await places()), [0, 0, 0, 0], `${w}x${h}: there and back by the control moved nothing`);
    // a shot in the air when he goes to the scope lands in its view: fired at the 1,000-yard plate, then the scope
    await page.evaluate(() => { RangeDayLine.setTarget('8'); RangeDayLine.setHold(0, 0); RangeDayLine.fire(77); });
    await page.click('#spotting');
    await page.waitForFunction(() => RangeDayLine.pending === 0, null, { timeout: 30000 });
    const landed = await page.evaluate(() => RangeDayLine.log[RangeDayLine.log.length - 1]);
    assert.equal(landed.yards, 1000, 'the shot fired before going to the scope landed while at the scope');
    assert.deepEqual(moved(await places()), [0, 0, 0, 0]);
    assert.deepEqual(errors, []);
    lines.push(`${w}x${h}: to the scope and back, moved view/strip/bar/picker ${moved(await places()).join('/')} px; ${widths.join('; ')}; buttons ${heights.map(([id, ht]) => `#${id} ${ht}`).join(', ')}`);
    await context.close();
  }
  console.log('  ' + lines.join('\n  '));
});

test('range-day-ten verify 3: same scale: the scene puts each new canyon target\'s centre within 1 pixel of the plain drawing through the Vepr\'s scope at 2x and 7x, its irons at 1x, and the spotting scope at 20x and 60x, at both sizes', { skip }, async () => {
  const lines = [];
  let worst = 0;
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    for (const [name, sight, zoom, spot] of [['scope 2x', 'utg-2-7x44', 2, null], ['scope 7x', 'utg-2-7x44', 7, null], ['irons 1x', 'vepr-irons', null, null], ['spotting scope 20x', 'utg-2-7x44', null, 20], ['spotting scope 60x', 'utg-2-7x44', null, 60]]) {
      await setPicture(page, 'full');
      await line(page, `course=cta-piru&rifle=molot-vepr-54r&sight=${sight}&load=sb-174-hpbt`);
      assert.equal(await page.evaluate(() => RangeDayLine.picture), 'full');
      if (zoom) await page.evaluate((z) => RangeDayLine.setZoom(z), zoom);
      if (spot) { await page.evaluate((z) => { RangeDayLine.setSpotting(true); RangeDayLine.setSpotZoom(z); }, spot); }
      for (const key of ['near-0', 'near-1', 'near-2']) {
        await page.evaluate((k) => RangeDayLine.setTarget(k), key);
        const r = await page.evaluate((k) => ({ ...RangeDayLine.targetOnScreen(k), size: RangeDayLine.geometry.viewPx }), key);
        const d = Math.hypot(r.plain[0] - r.scene[0], r.plain[1] - r.scene[1]);
        assert.ok(d <= 1, `${sizeName} ${name} ${key}: ${d.toFixed(2)} px apart (plain ${r.plain}, scene ${r.scene})`);
        worst = Math.max(worst, d);
        lines.push(`${sizeName} ${name} ${key}: ${d.toFixed(3)} px`);
      }
    }
    assert.deepEqual(errors.filter((e) => !/swiftshader|GPU stall|PCFSoftShadowMap/i.test(e)), []);
    await context.close();
  }
  console.log(`  largest difference ${worst.toFixed(3)} px\n  ` + lines.join('\n  '));
});

test('range-day-ten verify 3: same scale on the rifle line (its flat drawing): where the drawing put each new paper sheet\'s centre, read from the frame that drew it, is within 1 pixel of the angles from the data at that frame\'s aim, through the AR\'s irons and through the spotting scope at 20x and 60x, aimed at each paper and at the 100-yard plate, at both sizes', { skip }, async () => {
  const MOA = Math.PI / (180 * 60);
  const c = flat.courses['angeles-sylmar'];
  const ang = (t) => ({ up: Math.atan2(t.riseFt, t.yards * 3) / MOA, right: Math.atan2(t.lateralYd, t.yards) / MOA });
  const byKey = { 'near-0': c.near[0], 'near-1': c.near[1], 0: c.plates[0] };
  const lines = [];
  let worst = 0, checked = 0;
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    await setPicture(page, 'plain');
    await line(page, AR);
    for (const [name, spot] of [['irons', null], ['spotting scope 20x', 20], ['spotting scope 60x', 60]]) {
      await page.evaluate((z) => { RangeDayLine.setSpotting(Boolean(z)); if (z) RangeDayLine.setSpotZoom(z); }, spot);
      for (const aimed of ['near-0', 'near-1', '0']) {
        await page.evaluate((k) => RangeDayLine.setTarget(k), aimed);
        await page.waitForTimeout(250); // a frame or more, drawn from this aim
        for (const key of ['near-0', 'near-1']) {
          const d = await page.evaluate((k) => RangeDayLine.drawnPaper(k), key);
          if (!d) continue; // off the canvas this frame: the drawing skips a sheet wholly outside the view
          const a = ang(byKey[aimed]), t = ang(byKey[key]);
          const ex = d.size / 2 + (t.right - a.right - d.aimRight) * d.pxPerMoa, ey = d.size / 2 - (t.up - a.up - d.aimUp) * d.pxPerMoa;
          if (ex < 0 || ex > d.size || ey < 0 || ey > d.size) continue;
          const off = Math.hypot(d.x - ex, d.y - ey);
          assert.ok(off <= 1, `${sizeName} ${name}, aimed at ${aimed}, ${key}: drawn at ${d.x.toFixed(2)}, ${d.y.toFixed(2)}, the angles put it at ${ex.toFixed(2)}, ${ey.toFixed(2)}`);
          worst = Math.max(worst, off); checked++;
          lines.push(`${sizeName} ${name}, aimed at ${aimed}: ${key} ${off.toFixed(3)} px`);
        }
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  assert.ok(checked >= 12, `at least the aimed papers themselves were checked at every sight and size (${checked})`);
  console.log(`  ${checked} sheet centres checked, largest difference ${worst.toFixed(3)} px\n  ` + lines.join('\n  '));
});
