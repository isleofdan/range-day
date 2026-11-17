'use strict';
// The screens in a real browser, signing in through the form: the zero
// holds across a reload and moves with the load by the engine's own figure
// (brief, verify 4); the firing line gives no hit when the engine says
// miss, at a plate's edge (verify 5). Needs Playwright's browser; where
// it is missing these are skipped and say so (the Checks workflow has it).
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const E = require('../public/engine.js');
const { flat } = require('../lib/data').load();

const root = path.join(__dirname, '..');
const PORT = 8941;
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
  return { page, context, errors };
}
const groupCenter = async (page) => {
  const t = await page.textContent('#group');
  const m = /center of the group ([\d.]+) in (low|high), ([\d.]+) in (right|left)|center of the group (level|[\d.]+ in (?:low|high)), (centered|[\d.]+ in (?:right|left))/.exec(t);
  assert.ok(m, `readout: ${t}`);
  const num = (s, pos) => (s === 'level' || s === 'centered' ? 0 : parseFloat(s) * (s.includes(pos) ? 1 : -1));
  if (m[1]) return { up: parseFloat(m[1]) * (m[2] === 'high' ? 1 : -1), right: parseFloat(m[3]) * (m[4] === 'right' ? 1 : -1) };
  return { up: num(m[5], 'high'), right: num(m[6], 'right') };
};

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('verify 4: zero the Vepr at 100 yards, reload, the zero is still there; change the load, the group moves by the engine\'s figure', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`);
  await page.waitForSelector('#fire5');
  // Walk the group onto the center: the readout says where it is, the clicks are 0.25 MOA.
  for (let round = 0; round < 4; round++) {
    await page.click('#fresh'); await page.click('#fire5');
    const c = await groupCenter(page);
    const elClicks = Math.round(-c.up / (0.25 * E.inchesPerMoa(100)));
    const wdClicks = Math.round(-c.right / (0.25 * E.inchesPerMoa(100)));
    for (let i = 0; i < Math.abs(elClicks); i++) await page.click(elClicks > 0 ? '#el-up' : '#el-down');
    for (let i = 0; i < Math.abs(wdClicks); i++) await page.click(wdClicks > 0 ? '#wd-right' : '#wd-left');
  }
  await page.click('#fresh'); await page.click('#fire5');
  const centered = await groupCenter(page);
  assert.ok(Math.abs(centered.up) < 2 && Math.abs(centered.right) < 2, `group ${JSON.stringify(centered)} should be near the center at 100 yards`);
  await page.click('#save');
  const savedText = await page.textContent('#saved');
  assert.match(savedText, /Saved zero for Sellier & Bellot 174 gr.*100 yards/);
  const el = await page.textContent('#el-text');
  // Reload: still there, on the bench and on the home screen.
  await page.reload(); await page.waitForSelector('#fire5');
  assert.equal(await page.textContent('#el-text'), el, 'the sight setting survives a reload');
  assert.match(await page.textContent('#saved'), /Saved zero for Sellier & Bellot 174 gr.*100 yards/);
  await page.goto(`${base}/?rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('.rifle');
  assert.match(await page.textContent('#zero'), /Zeroed at 100 yards/);
  // Change the load: the sight stays, the group lands where the engine puts the other load.
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire5');
  assert.equal(await page.textContent('#el-text'), el, 'changing nothing keeps the sight');
  await page.selectOption('#load', 'wolf-203-sp');
  assert.equal(await page.textContent('#el-text'), el, 'changing the load keeps the sight where it was');
  await page.selectOption('#distance', '200');
  await page.click('#fresh'); await page.click('#fire5');
  const other = await groupCenter(page);
  await page.selectOption('#load', 'sb-174-hpbt');
  await page.click('#fresh'); await page.click('#fire5');
  const same = await groupCenter(page);
  // The engine's own figure for the difference, with the same sight and air, no spread.
  const day = await page.evaluate(() => JSON.parse(sessionStorage.getItem('range-day:day:cta-piru')));
  const setting = await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:sight:molot-vepr-54r:utg-2-7x44')));
  const rifle = flat.rifles['molot-vepr-54r'], sight = flat.sights['utg-2-7x44'];
  const common = { drag: flat.physics.dragTables, sightHeightIn: rifle.sightHeightIn['utg-2-7x44'], elevationMoa: setting.elevationClicks * sight.clickMoa + rifle.boreOffsetMoa.up, windageMoa: setting.windageClicks * sight.windageClickMoa + rifle.boreOffsetMoa.right, targetYards: 200, conditions: { altitudeFt: day.altitudeFt, tempF: day.tempF, pressureInHg: day.pressureInHg, humidity: day.humidity }, wind: day.wind };
  const a = E.fly({ ...common, load: flat.loads['sb-174-hpbt'] }), b = E.fly({ ...common, load: flat.loads['wolf-203-sp'] });
  const predicted = b.hit.upIn - a.hit.upIn;
  console.log(`  load change at 200 yd, same sight: the 203 gr group landed ${(other.up - same.up).toFixed(1)} in from the 174 gr group; the engine's figure ${predicted.toFixed(1)} in`);
  assert.ok(Math.abs(predicted) > 1, 'the two loads differ at 200 yards');
  assert.ok(Math.abs((other.up - same.up) - predicted) < 4, `moved ${other.up - same.up}, engine ${predicted}`);
  // On the firing line too: changing the load keeps the sight; the saved zero is a button.
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  const lineEl = await page.textContent('#el-text');
  assert.equal(lineEl, el, 'the firing line opens at the saved zero for the arriving load');
  await page.click('#el-up'); await page.click('#el-up');
  const moved = await page.textContent('#el-text');
  await page.selectOption('#load', 'wolf-203-sp');
  assert.equal(await page.textContent('#el-text'), moved, 'changing the load on the firing line keeps the sight where it was');
  assert.ok(await page.isHidden('#use-zero'), 'no saved zero for the other load: no button');
  await page.selectOption('#load', 'sb-174-hpbt');
  assert.equal(await page.textContent('#el-text'), moved, 'changing back keeps the sight too');
  assert.ok(await page.isVisible('#use-zero'), 'the saved zero is offered as a button');
  await page.click('#use-zero');
  assert.equal(await page.textContent('#el-text'), el, 'the button sets the sight to the saved zero');
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 5: the firing line gives no hit when the engine says miss, at a plate\'s edge', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=bcm-ar15&load=federal-gmm-69`);
  await page.waitForSelector('#fire');
  await page.evaluate(() => { localStorage.removeItem('range-day:log:bcm-ar15:federal-gmm-69'); });
  await page.reload(); await page.waitForSelector('#fire');
  await page.selectOption('#plate', '0');
  const plate = await page.evaluate(() => RangeDayLine.plate);
  const ipm = E.inchesPerMoa(plate.yards);
  // First shot: whatever the sight does, read where it landed; then hold so
  // the next shot lands about the right edge, and the one after well outside
  // it (4 MOA past, beyond what the settled wander and the spread can move it). The
  // hold is the only thing that changes; the hit flag must follow the plate's
  // edges exactly, whatever the random parts did.
  const shoot = async (holdUp, holdRight) => {
    await page.evaluate(([u, r]) => RangeDayLine.setHold(u, r), [holdUp, holdRight]);
    await wait(2600); // let the aim settle after the last shot, as a shooter would
    const before = await page.evaluate(() => RangeDayLine.log.length);
    await page.evaluate(() => RangeDayLine.fire());
    for (let i = 0; i < 150; i++) { await wait(100); if ((await page.evaluate(() => RangeDayLine.log.length)) > before) break; }
    const log = await page.evaluate(() => RangeDayLine.log);
    return log[log.length - 1];
  };
  const first = await shoot(0, 0);
  assert.ok(first && typeof first.upIn === 'number', `first shot logged: ${JSON.stringify(first)}`);
  // Where the bullet lands against the plate, in MOA, when the reticle is on the center (the wander is small and random; allow for it).
  const baseUp = first.upIn / ipm - first.heldUp, baseRight = first.rightIn / ipm - first.heldRight;
  const edge = plate.widthIn / 2 / ipm;
  const inside = await shoot(-baseUp, edge - 0.8 - baseRight);
  const outside = await shoot(-baseUp, edge + 4 - baseRight);
  for (const s of [first, inside, outside]) {
    const rect = Math.abs(s.upIn) <= plate.heightIn / 2 && Math.abs(s.rightIn) <= plate.widthIn / 2;
    assert.equal(s.hit, rect, `hit flag matches the plate's edges exactly: ${JSON.stringify(s)}`);
  }
  console.log(`  ${plate.yards} yd plate ${plate.widthIn}x${plate.heightIn} in: near-edge shot ${inside.hit ? 'hit' : 'miss'} at ${inside.rightIn} in; outside-edge shot ${outside.hit ? 'hit' : 'miss'} at ${outside.rightIn} in`);
  assert.equal(outside.hit, false, 'outside the edge is a miss');
  assert.deepEqual(errors, []);
  await context.close();
});

test('a browser that refuses storage: every screen says "not saved on this device" instead of breaking', { skip }, async () => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await context.addInitScript(() => {
    const broken = { getItem() { throw new Error('storage refused'); }, setItem() { throw new Error('storage refused'); }, removeItem() { throw new Error('storage refused'); } };
    Object.defineProperty(window, 'localStorage', { get: () => broken });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/login`); await page.fill('#passphrase', PASS); await page.click('button[type=submit]'); await page.waitForURL(`${base}/`);
  await page.waitForSelector('.rifle');
  assert.match(await page.textContent('#zero'), /Zero not saved on this device/);
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire5');
  assert.match(await page.textContent('#saved'), /Zero not saved on this device/);
  await page.click('#el-up');
  assert.match(await page.textContent('#saved'), /not saved on this device/);
  await page.click('#fire5');
  assert.match(await page.textContent('#group'), /Last 5 shots/);
  await page.click('#save');
  assert.match(await page.textContent('#saved'), /Zero not saved on this device/);
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#zero-note'), /Zero not saved on this device/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('a browser that reads but refuses to write: the zero bench and the firing line say the sight setting is not saved', { skip }, async () => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  await context.addInitScript(() => {
    const real = window.localStorage;
    const half = { getItem: (k) => real.getItem(k), setItem() { throw new Error('write refused'); }, removeItem() { throw new Error('write refused'); } };
    Object.defineProperty(window, 'localStorage', { get: () => half });
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/login`); await page.fill('#passphrase', PASS); await page.click('button[type=submit]'); await page.waitForURL(`${base}/`);
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire5');
  await page.click('#el-up');
  assert.match(await page.textContent('#saved'), /Sight setting not saved on this device/);
  await page.click('#save');
  assert.match(await page.textContent('#saved'), /Zero not saved on this device/);
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  await page.click('#el-up');
  assert.match(await page.textContent('#zero-note'), /Sight setting not saved on this device/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('every screen renders at 412x915 and 1280x800 with no sideways scroll and no console error', { skip }, async () => {
  for (const viewport of [{ width: 412, height: 915 }, { width: 1280, height: 800 }]) {
    const { page, context, errors } = await signedIn(viewport);
    for (const p of ['/', '/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt', '/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt', '/line?course=angeles-sylmar&rifle=bcm-ar15&load=imi-m193']) {
      await page.goto(`${base}${p}`);
      await page.waitForSelector(p === '/' ? '.rifle' : '#el-up');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${p} at ${viewport.width}: no sideways scroll`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('verify 6: a zero and a log written in the old form (per rifle and load) for the Vepr and the AR-15 show on home, the bench and the line', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  // Records as range-day-one wrote them: zero:<rifle>:<load> naming its sight, log:<rifle>:<load>.
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('range-day:zero:molot-vepr-54r:sb-174-hpbt', JSON.stringify({ elevationClicks: 31, windageClicks: -13, zeroYards: 100, sight: 'utg-2-7x44', savedAt: '2026-11-16T12:00:00.000Z' }));
    localStorage.setItem('range-day:log:molot-vepr-54r:sb-174-hpbt', JSON.stringify([{ n: 1, yards: 200, el: 31, wd: -13, zoom: 2, heldUp: 0, heldRight: 0, hit: false, where: 'miss: 9.0 in low, centered', upIn: -9.04, rightIn: 0.2 }]));
    localStorage.setItem('range-day:zero:bcm-ar15:federal-gmm-69', JSON.stringify({ elevationClicks: 2, windageClicks: -2, zeroYards: 50, sight: 'ar-irons', savedAt: '2026-11-16T12:00:00.000Z' }));
    localStorage.setItem('range-day:log:bcm-ar15:federal-gmm-69', JSON.stringify([{ n: 1, yards: 100, el: 2, wd: -2, zoom: 1, heldUp: 0, heldRight: 0, hit: true, where: 'hit (level, centered of center)', upIn: 0.3, rightIn: -0.1 }]));
  });
  // Home: the Vepr's rifle button says a zero is saved; the zero line shows it for its scope.
  await page.goto(`${base}/?rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('.rifle');
  assert.match(await page.textContent('.rifle[data-rifle="molot-vepr-54r"] .rmark'), /zeroed/);
  assert.match(await page.textContent('.rifle[data-rifle="bcm-ar15"] .rmark'), /zeroed/);
  assert.match(await page.textContent('.rifle[data-rifle="iwi-x95"] .rmark'), /no zero saved/);
  assert.match(await page.textContent('#zero'), /Zeroed at 100 yards with the UTG.*\+31 clicks/);
  // The bench and the line, by the old address form (no sight): the Vepr opens with its scope at that zero.
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire5');
  assert.match(await page.textContent('#saved'), /Saved zero for Sellier & Bellot 174 gr.*100 yards, elevation \+31 clicks/);
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#intro'), /UTG AccuShot 2-7x44/);
  assert.match(await page.textContent('#el-text'), /\+31 clicks/);
  assert.match(await page.textContent('#log tbody'), /9\.0 in low/);
  // The AR too, and the old records are still in place beside the new ones.
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=bcm-ar15&load=federal-gmm-69`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#el-text'), /\+2 clicks/);
  assert.match(await page.textContent('#log tbody'), /hit \(level, centered/);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  for (const k of ['range-day:zero:molot-vepr-54r:sb-174-hpbt', 'range-day:zero:molot-vepr-54r:utg-2-7x44:sb-174-hpbt', 'range-day:log:molot-vepr-54r:utg-2-7x44:sb-174-hpbt', 'range-day:zero:bcm-ar15:ar-irons:federal-gmm-69', 'range-day:log:bcm-ar15:ar-irons:federal-gmm-69', 'range-day:log:bcm-ar15:federal-gmm-69']) assert.ok(keys.includes(k), `${k} is stored`);
  // The old Vepr zero was made with the scope: the Vepr's irons have no zero.
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&sight=vepr-irons&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#zero-note'), /No zero saved/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 7: the old addresses without a sight open the Vepr with its scope on the line and the bench', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#intro'), /Molot Vepr, 7.62x54R with UTG AccuShot 2-7x44/);
  assert.ok(await page.isVisible('#zoom'), 'the scope has its zoom');
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire5');
  assert.match(await page.textContent('#intro'), /Molot Vepr, 7.62x54R, UTG AccuShot 2-7x44/);
  assert.match(await page.textContent('#click-help'), /0\.25 MOA/);
  // The installed app's start page, bare: it opens, with the last rifle picked.
  await page.goto(`${base}/`); await page.waitForSelector('.rifle.picked');
  assert.equal(await page.getAttribute('.rifle.picked', 'data-rifle'), 'molot-vepr-54r');
  assert.match(await page.getAttribute('#go-line', 'href'), /sight=utg-2-7x44/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 11: home at 412x915, each of the seven rifles chosen in turn: both doors and the zero line are inside the screen without scrolling', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  await page.goto(`${base}/`); await page.waitForSelector('.rifle');
  const rifles = await page.$$eval('.rifle', (els) => els.map((e) => e.dataset.rifle));
  assert.equal(rifles.length, 7);
  const lines = [];
  for (const id of rifles) {
    await page.click(`.rifle[data-rifle="${id}"]`);
    await page.waitForSelector(`.rifle.picked[data-rifle="${id}"]`);
    const r = await page.evaluate(() => {
      const box = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; };
      return { scrollY: window.scrollY, zero: box('#zero'), goZero: box('#go-zero'), goLine: box('#go-line'), h: window.innerHeight, w: window.innerWidth };
    });
    lines.push(`${id}: zero line bottom ${r.zero.bottom.toFixed(0)}, Zero bench bottom ${r.goZero.bottom.toFixed(0)}, Firing line bottom ${r.goLine.bottom.toFixed(0)} of ${r.h}`);
    assert.equal(r.scrollY, 0);
    for (const b of [r.zero, r.goZero, r.goLine]) assert.ok(b.top >= 0 && b.bottom <= r.h && b.left >= 0 && b.right <= r.w, `${id}: ${JSON.stringify(b)} inside ${r.w}x${r.h}`);
  }
  console.log('  ' + lines.join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 10: turning the Vepr\'s scope 40 MOA: the coarse buttons in 40 presses, a held fine button in seconds; the limit stops it and the screen says so', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-2-7x44&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  await page.evaluate(() => { localStorage.removeItem('range-day:sight:molot-vepr-54r:utg-2-7x44'); localStorage.removeItem('range-day:zero:molot-vepr-54r:utg-2-7x44:sb-174-hpbt'); localStorage.removeItem('range-day:zero:molot-vepr-54r:sb-174-hpbt'); });
  await page.reload(); await page.waitForSelector('#fire');
  const clicks = async () => page.evaluate(() => RangeDayLine.setting.elevationClicks);
  assert.equal(await clicks(), 0);
  // The coarse pair: one whole MOA a press (4 clicks on this scope).
  let presses = 0;
  while ((await clicks()) < 160) { await page.click('#el-up-moa'); presses++; if (presses > 200) break; }
  assert.equal(presses, 40, '40 MOA in 40 presses of the coarse button');
  assert.equal(await clicks(), 160, 'the data\'s limit: 160 clicks each way');
  assert.match(await page.textContent('#result'), /end of its travel/);
  await page.click('#el-up-moa');
  assert.equal(await clicks(), 160, 'the limit stops the knob');
  assert.match(await page.textContent('#result'), /end of its travel \(160 clicks/);
  assert.match(await page.textContent('#setting-line'), /Elevation \+160 clicks \(40 MOA up\)/);
  // Back to the middle, then hold the fine button and time it.
  await page.evaluate(() => { localStorage.removeItem('range-day:sight:molot-vepr-54r:utg-2-7x44'); });
  await page.reload(); await page.waitForSelector('#fire');
  assert.equal(await clicks(), 0);
  const box = await page.locator('#el-up').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const t0 = Date.now();
  await page.mouse.down();
  let held = 0;
  for (let i = 0; i < 300; i++) { await wait(50); if ((await clicks()) >= 160) { held = (Date.now() - t0) / 1000; break; } }
  await page.mouse.up();
  const after = await clicks();
  console.log(`  Vepr scope, 40 MOA up: ${presses} presses of the 1-MOA button; a held click button reached 160 clicks in ${held.toFixed(1)} s`);
  assert.equal(after, 160, 'the held button ran to the limit and stopped there');
  assert.ok(held > 2 && held < 15, `held ${held} s`);
  assert.match(await page.textContent('#result'), /end of its travel/);
  // A single tap is one click, never two.
  await page.click('#el-down');
  assert.equal(await clicks(), 159);
  assert.deepEqual(errors, []);
  await context.close();
});

// A seeded shot through the page's own door, landed: the last log row.
async function seededShot(page, seed) {
  const before = await page.evaluate(() => RangeDayLine.log.length);
  await page.evaluate((s) => RangeDayLine.fire(s), seed);
  for (let i = 0; i < 150; i++) { await wait(100); if ((await page.evaluate(() => RangeDayLine.log.length)) > before) break; }
  const log = await page.evaluate(() => RangeDayLine.log);
  return log[log.length - 1];
}

test('verify 5: zero the Tavor SAR with the dot at 50 yd; its irons are not zeroed; the dot is; the magnifier keeps the zero and lands the same seeded shot', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const SAR = 'course=angeles-sylmar&rifle=iwi-tavor-sar&load=imi-m193';
  await page.goto(`${base}/zero?${SAR}&sight=pa-md25`); await page.waitForSelector('#fire5');
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForSelector('#fire5');
  await page.selectOption('#distance', '50');
  for (let round = 0; round < 4; round++) {
    await page.click('#fresh'); await page.click('#fire5');
    const c = await groupCenter(page);
    const elClicks = Math.round(-c.up / (0.5 * E.inchesPerMoa(50)));
    const wdClicks = Math.round(-c.right / (0.5 * E.inchesPerMoa(50)));
    for (let i = 0; i < Math.abs(elClicks); i++) await page.click(elClicks > 0 ? '#el-up' : '#el-down');
    for (let i = 0; i < Math.abs(wdClicks); i++) await page.click(wdClicks > 0 ? '#wd-right' : '#wd-left');
  }
  await page.click('#save');
  assert.match(await page.textContent('#saved'), /Saved zero for IMI M193.*50 yards/);
  const el = await page.textContent('#el-text');
  // The iron sights on the same rifle: not zeroed.
  await page.goto(`${base}/?rifle=iwi-tavor-sar&sight=tavor-irons&load=imi-m193`); await page.waitForSelector('.rifle');
  assert.match(await page.textContent('#zero'), /Not zeroed yet with the Tavor folding iron sights/);
  await page.goto(`${base}/line?${SAR}&sight=tavor-irons`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#zero-note'), /No zero saved/);
  // The dot again: the zero is there, on home and on the line.
  await page.goto(`${base}/?rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193`); await page.waitForSelector('.rifle');
  assert.match(await page.textContent('#zero'), /Zeroed at 50 yards with the Primary Arms SLx MD-25 red dot/);
  await page.goto(`${base}/line?${SAR}&sight=pa-md25`); await page.waitForSelector('#fire');
  assert.equal(await page.textContent('#el-text'), el, 'the line opens the dot at its saved zero');
  assert.match(await page.textContent('#zero-note'), /Sight at the saved 50-yard zero/);
  await page.selectOption('#plate', '2');
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  const out = await seededShot(page, 42);
  // Flip the magnifier in: the same zero, the same clicks; the same seeded shot lands in the same place.
  await page.click('#magnifier');
  assert.match(await page.textContent('#setting-line'), /Magnifier in \(3×\)/);
  assert.equal(await page.textContent('#el-text'), el, 'the magnifier uses the dot\'s setting');
  assert.match(await page.textContent('#zero-note'), /Sight at the saved 50-yard zero/);
  const geomIn = await page.evaluate(() => RangeDayLine.geometry);
  assert.equal(geomIn.magnifierIn, true);
  const inn = await seededShot(page, 42);
  console.log(`  Tavor SAR, dot zeroed at 50 yd (${el}); 300 yd seeded shot: magnifier out ${out.upIn.toFixed(2)} / ${out.rightIn.toFixed(2)} in, in ${inn.upIn.toFixed(2)} / ${inn.rightIn.toFixed(2)} in`);
  assert.ok(Math.abs(out.upIn - inn.upIn) < 1e-6 && Math.abs(out.rightIn - inn.rightIn) < 1e-6, 'the bullet lands in the same place flipped in or out');
  await page.click('#magnifier');
  assert.match(await page.textContent('#setting-line'), /Magnifier out \(1×\)/);
  assert.deepEqual(errors, []);
  await context.close();
});

// Reads the view's own pixels: a run of pixels meeting `test` along a row (axis 'x') or a column (axis 'y').
async function pixelRuns(page, axis, from, to, at, test) {
  return page.evaluate(([axis, from, to, at, src]) => {
    const canvas = document.getElementById('view'), g = canvas.getContext('2d');
    const test = new Function('r', 'g', 'b', 'a', `return ${src};`);
    const runs = []; let run = null;
    for (let i = from; i <= to; i++) {
      const [x, y] = axis === 'x' ? [i, at] : [at, i];
      const [r, gg, b, a] = g.getImageData(x, y, 1, 1).data;
      const on = test(r, gg, b, a);
      if (on && !run) run = { start: i, end: i }; else if (on) run.end = i; else if (run) { runs.push(run); run = null; }
    }
    if (run) runs.push(run);
    return runs;
  }, [axis, from, to, at, test]);
}

test('verify 8: drawn angles are true: the dot\'s width, each drop-reticle mark\'s place below the tip, and the move of the aim with the leaf, each the data\'s MOA times the view\'s scale within one pixel', { skip }, async () => {
  // At device scale 2 the canvas has twice the pixels, so a pixel of the proof is half a screen pixel.
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/login`); await page.fill('#passphrase', PASS); await page.click('button[type=submit]'); await page.waitForURL(`${base}/`);
  const lines = [];
  // 1. The dot, with the magnifier out and in: red pixels across the center row.
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193`); await page.waitForSelector('#fire');
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  for (const flip of [false, true]) {
    if (flip) await page.click('#magnifier');
    await wait(150);
    const geom = await page.evaluate(() => RangeDayLine.geometry);
    const dpr = await page.evaluate(() => Math.min(window.devicePixelRatio, 2));
    const size = await page.evaluate(() => document.getElementById('view').width);
    const runs = await pixelRuns(page, 'x', 0, size - 1, Math.round(size / 2), 'r > 200 && g < 110 && b < 110');
    const dot = runs.find((r) => r.start <= size / 2 && r.end >= size / 2 - 1);
    assert.ok(dot, `a red run across the center: ${JSON.stringify(runs)}`);
    const widthPx = dot.end - dot.start + 1;
    const expected = flat.sights['pa-md25'].dotMoa * geom.pxPerMoa * dpr;
    lines.push(`dot ${flip ? 'through the magnifier' : 'alone'}: drawn ${widthPx} canvas px across, data ${expected.toFixed(1)} (${flat.sights['pa-md25'].dotMoa} MOA at ${(geom.pxPerMoa * dpr).toFixed(2)} px/MOA)`);
    assert.ok(Math.abs(widthPx - expected) <= 1.5, lines[lines.length - 1]);
  }
  // 2. The drop reticle: dark runs down the center column below the tip, one per mark.
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=ak-762&sight=pa-3x-acss&load=silver-bear-123`); await page.waitForSelector('#fire');
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  await page.selectOption('#plate', '1');
  await wait(200);
  {
    const geom = await page.evaluate(() => RangeDayLine.geometry);
    const dpr = await page.evaluate(() => Math.min(window.devicePixelRatio, 2));
    const size = await page.evaluate(() => document.getElementById('view').width);
    const cy = size / 2;
    const runs = await pixelRuns(page, 'y', Math.round(cy + 2), Math.round(cy + 80), Math.round(size / 2), 'r + g + b < 180');
    const marks = flat.sights['pa-3x-acss'].reticle.marksMoaBelowZero.filter((m) => m.yards !== 200); // the 200 hold is the open base of the chevron, not a drawn mark
    assert.equal(runs.length, marks.length, `one dark run per mark: ${JSON.stringify(runs)}`);
    marks.forEach((m, i) => {
      const center = (runs[i].start + runs[i].end) / 2 - cy;
      const expected = m.moaBelowZero * geom.pxPerMoa * dpr;
      lines.push(`mark ${m.yards} yd: drawn ${center.toFixed(1)} canvas px below the tip, data ${expected.toFixed(1)} (${m.moaBelowZero} MOA)`);
      assert.ok(Math.abs(center - expected) <= 1.5, lines[lines.length - 1]);
    });
  }
  // 3. The leaf: the same seeded shot with the leaf at 1 and at 2 moves by the setting's angle, at the view's scale.
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=ak-762&sight=ak-irons&load=silver-bear-123`); await page.waitForSelector('#fire');
  await page.evaluate(() => { localStorage.removeItem('range-day:sight:ak-762:ak-irons'); });
  await page.reload(); await page.waitForSelector('#fire');
  await page.selectOption('#plate', '1');
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  const a = await seededShot(page, 9);
  await page.click('#leaf-up');
  assert.match(await page.textContent('#setting-line'), /Leaf 2 \(200 m\)/);
  const geom = await page.evaluate(() => RangeDayLine.geometry);
  const b = await seededShot(page, 9);
  const movedMoa = (b.upIn - a.upIn) / E.inchesPerMoa(a.yards);
  const leafMoa = flat.sights['ak-irons'].leaf.moaAbove100[1].moaAbove100;
  lines.push(`leaf 1 to 2 at ${a.yards} yd: the strike moved ${(b.upIn - a.upIn).toFixed(1)} in, ${movedMoa.toFixed(2)} MOA, ${(movedMoa * geom.pxPerMoa).toFixed(2)} px at the view's scale; data ${leafMoa} MOA, ${(leafMoa * geom.pxPerMoa).toFixed(2)} px`);
  assert.equal(geom.leafMoa, leafMoa);
  assert.ok(Math.abs(movedMoa - leafMoa) * geom.pxPerMoa <= 1, lines[lines.length - 1]);
  assert.equal(b.leaf, 200, 'the log row records the leaf');
  console.log('  ' + lines.join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 12: on both courses the plates stand apart and in order through the widest view, and the engine is given the height the drawing uses', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const lines = [];
  for (const [path, rifle] of [['/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-2-7x44&load=sb-174-hpbt', 'Vepr, scope at 2x'], ['/line?course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193', 'AR-15, iron sights']]) {
    await page.goto(`${base}${path}`); await page.waitForSelector('#fire');
    await page.evaluate(() => { if (document.getElementById('zoom').min) RangeDayLine.setZoom(Number(document.getElementById('zoom').min)); });
    const angles = await page.evaluate(() => RangeDayLine.plateAngles);
    const fov = await page.evaluate(() => RangeDayLine.fovMoa);
    const courseId = /course=([^&]+)/.exec(path)[1];
    const data = flat.courses[courseId].plates;
    lines.push(`${flat.courses[courseId].name} (${rifle}, ${fov.toFixed(0)} MOA across the view):`);
    for (let i = 0; i < angles.length; i++) {
      const a = angles[i];
      assert.equal(a.riseFt, data[i].riseFt, `${a.yards} yd: the drawing's height is the data's`);
      lines.push(`  ${a.yards} yd: ${a.rightMoa >= 0 ? '+' : ''}${a.rightMoa.toFixed(1)} MOA sideways, ${a.upMoa.toFixed(1)} MOA up, ${a.riseFt} ft high`);
      for (let j = 0; j < i; j++) {
        const sep = Math.hypot(a.upMoa - angles[j].upMoa, a.rightMoa - angles[j].rightMoa);
        assert.ok(sep >= 30, `${angles[j].yards} and ${a.yards} yd are ${sep.toFixed(1)} MOA apart`);
      }
      if (i) {
        assert.ok(a.upMoa - angles[i - 1].upMoa >= 10, `${a.yards} yd sits ${(a.upMoa - angles[i - 1].upMoa).toFixed(1)} MOA above ${angles[i - 1].yards} yd`);
        assert.equal(Math.sign(a.rightMoa - angles[i - 1].rightMoa), Math.sign(angles[1].rightMoa - angles[0].rightMoa), 'the sideways order runs one way');
      }
    }
    // The engine's height for a plate equals the drawing's: fire at the 4th plate and read what the engine was given.
    await page.selectOption('#plate', '3');
    await page.evaluate(() => RangeDayLine.setHold(0, 0));
    await seededShot(page, 3);
    const given = await page.evaluate(() => RangeDayLine.lastShotInput);
    assert.equal(given.targetRiseFt, angles[3].riseFt);
    assert.equal(given.targetRiseFt, data[3].riseFt);
    assert.equal(given.targetYards, data[3].yards);
  }
  console.log('  ' + lines.join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});
