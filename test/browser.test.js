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
  await page.goto(`${base}/?rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('.choice');
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
  await page.waitForSelector('.choice');
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
      await page.waitForSelector(p === '/' ? '.choice' : '#el-up');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${p} at ${viewport.width}: no sideways scroll`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});
