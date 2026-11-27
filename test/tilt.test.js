'use strict';
// range-day-sixteen: tilt aiming on the firing line. The tilt reading's maths with made-up orientations (public/tilt.js), and
// the firing line in a real browser, signing in through the form, fed made-up orientations through its test door
// (RangeDayLine.feedOrientation, as the browser's deviceorientation event would give them). No real sensor is read here: whether
// tilt aiming is steady in the hand is for Dan's phone to show.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const T = require('../public/tilt.js');
const seed = require('./playback-seed');
const { PHONES, SIGHTS, measure, meets } = require('./line-reach');

const root = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 8995);
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() { for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } } throw new Error('server never answered'); }

// --- the maths ---------------------------------------------------------------------------------------------
const D = Math.PI / 180;
// A rotation matrix back to the alpha, beta, gamma the browser gives for it (the spec's ranges: beta in [-180, 180), gamma in
// [-90, 90)). Near the upright phone (beta near 90) these swing: beta folds back and gamma and alpha jump by 180 degrees.
function eulerOf(R) {
  const n = (x) => { let y = ((x + 180) % 360 + 360) % 360 - 180; if (y === 180) y = -180; return y; };
  if (R[2][2] >= 0) return { alpha: n(Math.atan2(-R[0][1], R[1][1]) / D), beta: n(Math.asin(Math.max(-1, Math.min(1, R[2][1]))) / D), gamma: Math.atan2(-R[2][0], R[2][2]) / D };
  return { alpha: n(Math.atan2(R[0][1], -R[1][1]) / D), beta: n(180 - Math.asin(Math.max(-1, Math.min(1, R[2][1]))) / D), gamma: Math.atan2(R[2][0], -R[2][2]) / D };
}
// The upright phone swept through vertical: its back from 6 degrees below level to 6 above, turned 30 degrees and with the
// screen leaned 5 degrees about its own face (as a hand holds it), in steps of a twentieth of a degree, each step as the browser
// reports it. The phone itself moves smoothly; the reported alpha and gamma flip by about 180 degrees as it passes upright.
const mul = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const lean = (deg) => { const c = Math.cos(deg * D), s = Math.sin(deg * D); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const PHONE = Array.from({ length: 241 }, (_, i) => mul(T.rotation(30, 84 + i * 0.05, 0), lean(5)));
const SWEEP = PHONE.map(eulerOf);
const angleDeg = (R1, R2) => { const a = T.back(R1), b = T.back(R2); return Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / D; };

test('range-day-sixteen step 1: the made-up readings of the upright sweep do swing (gamma and alpha jump by about 180 degrees between two neighboring readings as the phone passes upright), and each gives back the phone\'s own rotation, so the sweep is the hard case', () => {
  let gj = 0, aj = 0;
  for (let i = 1; i < SWEEP.length; i++) { gj = Math.max(gj, Math.abs(SWEEP[i].gamma - SWEEP[i - 1].gamma)); aj = Math.max(aj, Math.abs(((SWEEP[i].alpha - SWEEP[i - 1].alpha + 540) % 360) - 180)); }
  assert.ok(gj > 170 && aj > 170, `gamma jumps ${gj.toFixed(1)}, alpha ${aj.toFixed(1)} degrees`);
  SWEEP.forEach((e, i) => { const R = T.rotation(e.alpha, e.beta, e.gamma); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(R[r][c] - PHONE[i][r][c]) < 1e-9); });
});

test('range-day-sixteen step 1 and verify: through the upright sweep the pointing moves smoothly: no jump between two neighboring readings beyond the step itself, at true angle', () => {
  const R0 = T.rotation(SWEEP[0].alpha, SWEEP[0].beta, SWEEP[0].gamma);
  const pts = SWEEP.map((e) => T.offset(R0, T.rotation(e.alpha, e.beta, e.gamma), 0));
  let worst = 0; for (let i = 1; i < pts.length; i++) worst = Math.max(worst, Math.hypot(pts[i].right - pts[i - 1].right, pts[i].up - pts[i - 1].up) * 60);
  // each step turns the back by 0.05 degrees about the leaned axis: 3 minutes of angle; nothing more between two readings
  assert.ok(worst <= 3.01, `largest jump ${worst.toFixed(3)} minutes of angle`);
  const last = pts[pts.length - 1], swept = angleDeg(PHONE[0], PHONE[PHONE.length - 1]);
  assert.ok(Math.abs(Math.hypot(last.right, last.up) - swept) < 0.01, `${swept.toFixed(3)} degrees swept: ${JSON.stringify(last)}`);
  console.log(`# upright sweep: largest jump between neighboring readings ${worst.toFixed(3)} minutes of angle at true angle (step 3.000)`);
});

test('range-day-sixteen step 1: turning right and tilting the top back read as right and up, upright, flat on a table and with the screen turned', () => {
  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const up0 = T.rotation(0, 90, 0);
  let o = T.offset(up0, T.rotation(-2, 90, 0), 0); assert.ok(near(o.right, 2) && near(o.up, 0), JSON.stringify(o));
  o = T.offset(up0, T.rotation(0, 92, 0), 0); assert.ok(near(o.right, 0) && near(o.up, 2), JSON.stringify(o));
  const flat = T.rotation(0, 0, 0);
  o = T.offset(flat, T.rotation(0, 3, 0), 0); assert.ok(near(o.up, 3) && near(o.right, 0), JSON.stringify(o));
  // the screen turned a quarter (landscape): the phone's top points to the screen's left, so tilting the top back swings the aim left
  o = T.offset(up0, T.rotation(0, 92, 0), 90); assert.ok(near(o.right, -2) && near(o.up, 0), JSON.stringify(o));
  // smoothing: a one-pole low-pass of 50 ms: after 50 ms of a held step it has come about 63% of the way
  const r = T.reader(); r.feed({ alpha: 0, beta: 90, gamma: 0, t: 0 }); let last = null;
  for (let i = 1; i <= 50; i++) last = r.feed({ alpha: -1, beta: 90, gamma: 0, t: i / 1000 });
  assert.ok(Math.abs(last.right - (1 - Math.exp(-1))) < 0.01, `after 50 ms: ${last.right}`);
  assert.equal(T.TAU_S, 0.05);
});

// --- the firing line --------------------------------------------------------------------------------------
async function signedIn(viewport, opts = {}) {
  const context = await browser.newContext({ viewport: viewport || { width: 412, height: 915 }, deviceScaleFactor: 1, isMobile: (viewport || { width: 412 }).width < 900, hasTouch: (viewport || { width: 412 }).width < 900 });
  if (opts.grant !== false) await context.grantPermissions(['accelerometer', 'gyroscope']);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/login`);
  await page.fill('#passphrase', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('range-day:picture', JSON.stringify('plain')); });
  if (opts.init) await context.addInitScript(opts.init);
  return { page, context, errors };
}
const VEPR = '/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt';
async function line(page, q) { await page.goto(`${base}${q && q.startsWith('/') ? q : `/line?${q || ''}`}`); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.feedOrientation); }
// Tilt on, with a first reading inside the second (as a phone would give dozens): answers when the mode reads tilt.
async function tiltOn(page) {
  await page.click('#aim-mode');
  await page.waitForFunction(() => RangeDayLine.aimMode === 'tilt');
  await page.evaluate(() => RangeDayLine.feedOrientation(0, 90, 0, 0));
}
// Made-up readings from the page's own clock: the reading, then a run of the same so the 50 ms smoothing settles.
const hold = (page, a, b, g) => page.evaluate(([a, b, g]) => { const t0 = performance.now() / 1000; for (let i = 1; i <= 120; i++) RangeDayLine.feedOrientation(a, b, g, t0 + i / 60); return RangeDayLine.hold; }, [a, b, g]);
const near = (a, b, tol) => Math.abs(a - b) <= (tol || 0.01);
const same = (h1, h2, what) => assert.ok(near(h1.up, h2.up, 1e-6) && near(h1.right, h2.right, 1e-6), `${what || 'the hold'}: ${JSON.stringify(h1)} against ${JSON.stringify(h2)}`);

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('range-day-sixteen steps 2 and 3: tilt moves the hold by the degrees times 60 over the gearing (1, 4, 10, 20; 10 at first); a drag moves it only in drag mode; Center zeroes it; switching back to drag keeps it; the instruction line says which', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, VEPR);
  assert.equal(await page.evaluate(() => RangeDayLine.aimMode), 'drag');
  assert.equal(await page.textContent('#aim-mode'), 'Aim: drag');
  assert.equal(await page.isVisible('#aim-center'), false);
  assert.match(await page.textContent('#result'), /^Drag the view to hold off the target/);
  // drag mode: a drag on the view moves the hold
  const box = await page.locator('#view').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 + 20, { steps: 4 }); await page.mouse.up();
  const dragged = await page.evaluate(() => RangeDayLine.hold);
  assert.ok(dragged.right > 0 && dragged.up > 0, `the drag moved the hold: ${JSON.stringify(dragged)}`);
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  await tiltOn(page);
  assert.equal(await page.textContent('#aim-mode'), 'Aim: tilt');
  assert.equal(await page.isVisible('#aim-center'), true);
  assert.match(await page.textContent('#result'), /^Tilt the phone to hold off the target/);
  assert.equal(await page.evaluate(() => RangeDayLine.gearing), 10);
  for (const g of [1, 4, 10, 20]) {
    await page.evaluate((g) => RangeDayLine.setGearing(g), g);
    await hold(page, 0, 90, 0); await page.click('#aim-center'); await hold(page, 0, 90, 0);
    const h = await hold(page, -1, 91, 0); // one degree right and one up
    assert.ok(near(h.right, 60 / g, 0.02) && near(h.up, 60 / g, 0.02), `gearing ${g}: ${JSON.stringify(h)} (expected ${60 / g} each)`);
  }
  // tilt mode: a drag does not move the hold
  const before = await page.evaluate(() => RangeDayLine.hold);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2 + 60, { steps: 4 }); await page.mouse.up();
  assert.deepEqual(await page.evaluate(() => RangeDayLine.hold), before);
  // Center: the present direction is the target's center
  await page.click('#aim-center');
  same(await hold(page, -1, 91, 0), { up: 0, right: 0 });
  const moved = await hold(page, -1.5, 91, 0);
  assert.ok(near(moved.right, 1.5) && near(moved.up, 0), JSON.stringify(moved));
  // another target re-centers: the hold goes to zero there, and the phone's present direction is its center
  await page.evaluate(() => RangeDayLine.setTarget('2'));
  same(await hold(page, -1.5, 91, 0), { up: 0, right: 0 });
  await hold(page, -2.5, 91, 0);
  // back to drag keeps the hold where the tilt left it
  const left = await page.evaluate(() => RangeDayLine.hold);
  await page.click('#aim-mode');
  assert.equal(await page.evaluate(() => RangeDayLine.aimMode), 'drag');
  assert.deepEqual(await page.evaluate(() => RangeDayLine.hold), left);
  assert.match(await page.textContent('#result'), /^Drag the view to hold off the target/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-sixteen step 9 and verify: the upright phone swept through vertical in the page: the hold moves smoothly, with no jump between neighboring readings, at true angle', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, VEPR);
  await tiltOn(page);
  await page.evaluate(() => RangeDayLine.setGearing(1));
  const holds = await page.evaluate((sweep) => {
    const t0 = performance.now() / 1000, out = [];
    for (let k = 0; k < 30; k++) RangeDayLine.feedOrientation(sweep[0].alpha, sweep[0].beta, sweep[0].gamma, t0 + k / 60);
    RangeDayLine.center();
    // each reading held for 15 ms of readings so the 50 ms smoothing follows a slow sweep
    sweep.forEach((e, i) => { for (let k = 0; k < 4; k++) RangeDayLine.feedOrientation(e.alpha, e.beta, e.gamma, t0 + 1 + (i * 4 + k) / 240); out.push(RangeDayLine.hold); });
    const e = sweep[sweep.length - 1]; // held at the end until the smoothing settles
    for (let k = 1; k <= 60; k++) RangeDayLine.feedOrientation(e.alpha, e.beta, e.gamma, t0 + 1 + sweep.length * 4 / 240 + k / 60);
    out.push(RangeDayLine.hold);
    return out;
  }, SWEEP);
  let worst = 0; for (let i = 1; i < holds.length - 1; i++) worst = Math.max(worst, Math.hypot(holds[i].right - holds[i - 1].right, holds[i].up - holds[i - 1].up)); // the last is the settled hold, not a neighbor
  assert.ok(worst <= 3.05, `largest jump in the hold ${worst.toFixed(3)} minutes of angle`);
  const end = holds[holds.length - 1], swept = angleDeg(PHONE[0], PHONE[PHONE.length - 1]) * 60;
  assert.ok(Math.abs(Math.hypot(end.right, end.up) - swept) < 2, `${swept.toFixed(1)} minutes of angle swept: ${JSON.stringify(end)}`);
  console.log(`# upright sweep in the page: largest jump in the hold ${worst.toFixed(3)} minutes of angle at true angle`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-sixteen step 2: at the spotting scope the tilt moves nothing and the drag moves the scope, in both modes; back at the rifle the hold is where it was; playback is untouched by tilt and shows no switch', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, VEPR);
  await tiltOn(page);
  await hold(page, -1, 91, 0);
  const atRifle = await page.evaluate(() => RangeDayLine.hold);
  await page.evaluate(() => RangeDayLine.setSpotting(true));
  const scope0 = await page.evaluate(() => RangeDayLine.geometry.aim);
  await hold(page, -5, 95, 0);
  assert.deepEqual(await page.evaluate(() => RangeDayLine.geometry.aim), scope0, 'the tilt moved nothing at the scope');
  assert.deepEqual(await page.evaluate(() => RangeDayLine.hold), atRifle, 'nor the rifle\'s hold');
  const box = await page.locator('#view').boundingBox();
  await page.mouse.move(box.x + 200, box.y + 200); await page.mouse.down(); await page.mouse.move(box.x + 150, box.y + 230, { steps: 3 }); await page.mouse.up();
  const scope1 = await page.evaluate(() => RangeDayLine.geometry.aim);
  assert.ok(scope1.right > scope0.right && scope1.up > scope0.up, `the drag moved the scope: ${JSON.stringify(scope1)}`);
  await page.click('#back-to-rifle');
  same(await hold(page, -5, 95, 0), atRifle, 'back at the rifle the phone\'s present direction is the hold as it was');
  // playback
  await page.evaluate(() => { localStorage.removeItem('range-day:day:open'); });
  await page.goto(`${base}${seed.LINE}`); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.day);
  const id = await page.evaluate(seed.seedInPage, seed.seedShots(Date.now() - 300000));
  await page.evaluate(() => localStorage.setItem('range-day:aim', JSON.stringify({ mode: 'tilt', gearing: 1 })));
  await page.goto(`${base}/playback?id=${encodeURIComponent(id)}`); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.playback);
  await page.evaluate(() => RangeDayLine.playback.pause());
  assert.equal(await page.isVisible('#aim-mode'), false);
  const pb0 = await page.evaluate(() => RangeDayLine.geometry.aim);
  await page.evaluate(() => { for (let i = 0; i < 60; i++) RangeDayLine.feedOrientation(-5, 95, 0, i / 60); });
  assert.deepEqual(await page.evaluate(() => RangeDayLine.geometry.aim), pb0);
  assert.equal(await page.evaluate(() => RangeDayLine.aimMode), 'drag', 'playback never turns tilt on');
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-sixteen step 4: no readings within a second goes back to drag with its line; a refused permission goes back with its line; never a silent switch', { skip }, async () => {
  const a = await signedIn();
  await line(a.page, VEPR);
  await a.page.click('#aim-mode');
  await a.page.waitForFunction(() => RangeDayLine.aimMode === 'tilt');
  await a.page.waitForFunction(() => RangeDayLine.aimMode === 'drag', null, { timeout: 3000 });
  assert.equal(await a.page.textContent('#result'), 'This device gives no tilt readings, so the aim stays on drag.');
  assert.equal(await a.page.textContent('#aim-mode'), 'Aim: drag');
  assert.equal(await a.page.isVisible('#aim-center'), false);
  // remembered: the fall back is stored as drag
  assert.deepEqual(await a.page.evaluate(() => JSON.parse(localStorage.getItem('range-day:aim'))), { mode: 'drag', gearing: 10 });
  assert.deepEqual(a.errors, []);
  await a.context.close();
  // a browser that asks permission, and is refused
  const b = await signedIn(null, { grant: false, init: () => { window.DeviceOrientationEvent.requestPermission = () => Promise.resolve('denied'); } });
  await line(b.page, VEPR);
  await b.page.click('#aim-mode');
  await b.page.waitForFunction(() => document.getElementById('result').textContent.startsWith('Tilt was not'));
  assert.equal(await b.page.textContent('#result'), 'Tilt was not allowed in the browser, so the aim stays on drag.');
  assert.equal(await b.page.evaluate(() => RangeDayLine.aimMode), 'drag');
  assert.deepEqual(b.errors, []);
  await b.context.close();
});

test('range-day-sixteen steps 5 and 6: the way of aiming and the gearing are remembered across a reload (the first visit is drag); a device that remembers tilt but gives no readings follows step 4; a refused write says so; the steadiness line shows only in tilt mode, at the gearing and at true angle', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, VEPR);
  assert.equal(await page.evaluate(() => localStorage.getItem('range-day:aim')), null, 'nothing stored on the first visit');
  await tiltOn(page);
  await page.selectOption('#gearing', '4');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:aim'))), { mode: 'tilt', gearing: 4 });
  // the steadiness line: a hand's wobble of a tenth of a degree either way, over the last 3 seconds
  assert.equal(await page.isVisible('#steadiness'), true);
  await page.evaluate(() => { const t0 = performance.now() / 1000; for (let i = 0; i < 120; i++) RangeDayLine.feedOrientation(0.1 * Math.sin(i / 5), 90, 0, t0 + i / 60); });
  await page.waitForFunction(() => /moved about/.test(document.getElementById('steadiness').textContent), null, { timeout: 3000 });
  const st = await page.textContent('#steadiness');
  const m = /moved about ([\d.]+) minutes of angle over the last 3 seconds \(([\d.]+) at true angle\)\./.exec(st);
  assert.ok(m, st);
  assert.ok(near(Number(m[1]) * 4, Number(m[2]), 0.25), st);
  // at true angle both figures still show, and they are the same
  await page.selectOption('#gearing', '1');
  await page.evaluate(() => { const t0 = performance.now() / 1000; for (let i = 0; i < 120; i++) RangeDayLine.feedOrientation(0.1 * Math.sin(i / 5), 90, 0, t0 + i / 60); });
  await page.waitForFunction(() => /moved about/.test(document.getElementById('steadiness').textContent), null, { timeout: 3000 });
  const st1 = await page.textContent('#steadiness');
  const m1 = /moved about ([\d.]+) minutes of angle over the last 3 seconds \(([\d.]+) at true angle\)\./.exec(st1);
  assert.ok(m1 && m1[1] === m1[2], st1);
  await page.selectOption('#gearing', '4');
  // reload: still tilt at a quarter; readings keep it on
  await page.reload(); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.feedOrientation);
  await page.waitForFunction(() => RangeDayLine.aimMode === 'tilt');
  await page.evaluate(() => RangeDayLine.feedOrientation(0, 90, 0, performance.now() / 1000));
  await wait(1300);
  assert.equal(await page.evaluate(() => RangeDayLine.aimMode), 'tilt');
  assert.equal(await page.inputValue('#gearing'), '4');
  // reload with no readings: back to drag with its line
  await page.reload(); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.feedOrientation);
  await page.waitForFunction(() => RangeDayLine.aimMode === 'drag' && /no tilt readings/.test(document.getElementById('result').textContent), null, { timeout: 4000 });
  // drag mode: no steadiness line
  assert.equal(await page.isVisible('#steadiness'), false);
  assert.deepEqual(errors, []);
  await context.close();
  // a browser that reads but refuses to write
  const r = await signedIn(null, { init: () => {
    const real = window.localStorage;
    const half = { getItem: (k) => real.getItem(k), setItem() { throw new Error('write refused'); }, removeItem() { throw new Error('write refused'); }, key: (i) => real.key(i), get length() { return real.length; } };
    Object.defineProperty(window, 'localStorage', { get: () => half });
  } });
  await line(r.page, VEPR);
  await tiltOn(r.page);
  assert.equal(await r.page.textContent('#aim-note'), 'The way of aiming is not saved on this device (the browser refused its storage); it holds while this page is open.');
  assert.deepEqual(r.errors, []);
  await r.context.close();
});

test('range-day-sixteen steps 7 and 8: tilt mode holds a screen wake lock and drag lets it go; a shot fired in each mode carries its aim in the log and in the day', { skip }, async () => {
  const { page, context, errors } = await signedIn(null, { init: () => {
    // a wake lock the test can see (the test browser's own is refused without a visible screen)
    const sentinel = () => { const s = new EventTarget(); s.released = false; s.release = () => { s.released = true; s.dispatchEvent(new Event('release')); return Promise.resolve(); }; return s; };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: () => Promise.resolve(sentinel()) } });
  } });
  await line(page, VEPR);
  await page.evaluate(() => RangeDayLine.fire(7)); await page.evaluate(() => RangeDayLine.landAll());
  await tiltOn(page);
  await page.waitForFunction(() => RangeDayLine.wakeLock);
  await page.evaluate(() => RangeDayLine.fire(7)); await page.evaluate(() => RangeDayLine.landAll());
  const log = await page.evaluate(() => RangeDayLine.log.map((e) => e.aim));
  const day = await page.evaluate(() => RangeDayLine.day.shots.map((s) => s.aim));
  assert.deepEqual(log.slice(-2), ['drag', 'tilt']);
  assert.deepEqual(day.slice(-2), ['drag', 'tilt']);
  await page.click('#aim-mode');
  assert.equal(await page.evaluate(() => RangeDayLine.wakeLock), false);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-sixteen step 3 and verify: the within-reach list, the Aim switch and Center included, holds at the three phone sizes in tilt mode for every sight (drag mode: test/day.test.js), and neither touches Steady and Fire', { skip }, async () => {
  for (const [w, h] of PHONES) {
    const { page, context, errors } = await signedIn({ width: w, height: h });
    for (const s of SIGHTS) {
      await page.evaluate(() => { localStorage.removeItem('range-day:day:open'); localStorage.removeItem('range-day:day:packed'); localStorage.removeItem('range-day:aim'); });
      await line(page, s.q);
      await tiltOn(page);
      await page.evaluate(() => window.scrollTo(0, 0));
      await wait(100);
      const m = await page.evaluate(measure, s.glass);
      assert.deepEqual(meets(m), [], `${w}x${h}, ${s.name}`);
      for (const name of ['aim switch', 'center']) assert.equal(m.items.find((i) => i.name === name).shown, true, `${name} shown`);
      for (const t of m.touch) assert.ok(t.height >= 44, `${s.name}: #${t.id} is ${t.height} px tall`);
      const gap = await page.evaluate(() => { const bar = document.querySelector('.firebar').getBoundingClientRect(); return ['aim-mode', 'aim-center'].map((id) => bar.top - document.getElementById(id).getBoundingClientRect().bottom); });
      for (const g of gap) assert.ok(g > 100, `${w}x${h}: far from Steady and Fire (${g} px)`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});

// Steady in tilt mode (range-day-sixteen, after Dan on his phone: "The steady button doesn't work for phone orientation aiming").
test('range-day-sixteen Steady: the reader smooths with the time it is given (TAU_STEADY_S, 400 ms, while Steady is held; TAU_S, 50 ms, otherwise): a sudden one-degree turn shows about 86% after 0.1 s at 50 ms and about 22% at 400 ms, and both settle on the same degree', () => {
  const run = (tau) => {
    const r = T.reader();
    r.feed({ alpha: 0, beta: 90, gamma: 0, t: 0 }, 0, tau);
    const seen = [];
    for (let i = 1; i <= 120; i++) seen.push(r.feed({ alpha: -1, beta: 90, gamma: 0, t: i / 60 }, 0, tau).right);
    return seen;
  };
  const quick = run(undefined), steady = run(T.TAU_STEADY_S);
  assert.equal(T.TAU_S, 0.05); assert.equal(T.TAU_STEADY_S, 0.4);
  const want = (tau) => 1 - Math.exp(-0.1 / tau);
  // after 6 readings at 60 a second (0.1 s)
  assert.ok(near(quick[5], want(0.05), 0.01), `50 ms: ${quick[5]}`);
  assert.ok(near(steady[5], want(0.4), 0.01), `400 ms: ${steady[5]}`);
  // two seconds on, both have arrived at the same degree: Steady slows the sight, it never moves where it ends up
  assert.ok(near(quick[119], 1, 0.001) && near(steady[119], 1, 0.01), `${quick[119]} ${steady[119]}`);
});

test('range-day-sixteen Steady: on the firing line in tilt mode, pressing and holding the Steady button calms a hand\'s tremor in the hold to under a third of what it is without, and a shot fired then goes from the smoothed hold the sight shows; in drag mode a drag moves the hold the same with Steady held or not', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, VEPR);
  await tiltOn(page);
  // a tremor of a tenth of a degree, eight times a second, for two seconds: the hold's spread over the last second, in MOA
  const tremor = () => page.evaluate(() => {
    const t0 = performance.now() / 1000, out = [];
    for (let i = 1; i <= 120; i++) { RangeDayLine.feedOrientation(0.1 * Math.sin(2 * Math.PI * 8 * i / 60), 90, 0.1 * Math.cos(2 * Math.PI * 8 * i / 60), t0 + i / 60); if (i > 60) out.push(RangeDayLine.hold); }
    const ups = out.map((h) => h.up), rights = out.map((h) => h.right);
    return Math.max(Math.max(...ups) - Math.min(...ups), Math.max(...rights) - Math.min(...rights));
  });
  const without = await tremor();
  // the real button, pressed and held as a finger would
  const b = await page.locator('#steady').boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
  assert.equal(await page.evaluate(() => RangeDayLine.steady), true);
  const held = await tremor();
  assert.ok(without > 0.3, `without Steady the tremor shows: ${without} MOA`);
  assert.ok(held < without / 3, `Steady held: ${held} MOA against ${without} MOA without`);
  // a shot fired while Steady is held goes from the smoothed hold the sight shows (plus the game's small wander, under a minute of angle)
  const shown = await page.evaluate(() => RangeDayLine.hold);
  await page.evaluate(() => RangeDayLine.fire()); await page.evaluate(() => RangeDayLine.landAll());
  const shot = await page.evaluate(() => RangeDayLine.log[RangeDayLine.log.length - 1]);
  assert.equal(shot.aim, 'tilt');
  assert.ok(near(shot.heldUp, shown.up, 1) && near(shot.heldRight, shown.right, 1), `shot held ${shot.heldUp}, ${shot.heldRight}; the sight showed ${JSON.stringify(shown)}`);
  await page.mouse.up();
  assert.equal(await page.evaluate(() => RangeDayLine.steady), false);
  // drag mode is as it was: the same drag moves the hold the same, Steady held or not
  await page.click('#aim-mode');
  await page.waitForFunction(() => RangeDayLine.aimMode === 'drag');
  const box = await page.locator('#view').boundingBox();
  const drag = async () => { await page.evaluate(() => RangeDayLine.setHold(0, 0)); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 - 40, box.y + box.height / 2 + 20, { steps: 4 }); await page.mouse.up(); return page.evaluate(() => RangeDayLine.hold); };
  const free = await drag();
  await page.evaluate(() => RangeDayLine.setSteady(true));
  const steadied = await drag();
  await page.evaluate(() => RangeDayLine.setSteady(false));
  same(free, steadied, 'a drag with Steady held');
  assert.deepEqual(errors, []);
  await context.close();
});

// The Setting move and the steadiness measure (range-day-sixteen, after Dan's walkthrough: Setting stood under a shot log
// of several hundred rows, and the steadiness line read 3328.9 with the phone flat on a table).
test('range-day-sixteen steadiness: the sway is the largest angle between pointing directions, so it holds far from the centering: centered upright, then laid flat (90 degrees off) and shaken a tenth of a degree, it reads about a tenth of a degree, where the right-and-up spread runs away', () => {
  const r = T.reader();
  r.feed({ alpha: 0, beta: 90, gamma: 0, t: 0 }, 0);
  const dirs = [], pts = [];
  for (let i = 1; i <= 180; i++) {
    const o = r.feed({ alpha: 0, beta: 0.05 * Math.sin(i / 3), gamma: 0.05 * Math.cos(i / 4), t: i / 60 }, 0);
    dirs.push(o.dir); pts.push({ right: o.right, up: o.up });
  }
  const sway = T.sway(dirs);
  assert.ok(sway > 0.05 && sway < 0.2, `flat on the table: ${sway} degrees`);
  assert.ok(T.spread(pts) > 10 * sway, `the old measure ran away there: ${T.spread(pts)} degrees`);
  // and near the centering both measures agree
  const r2 = T.reader();
  r2.feed({ alpha: 0, beta: 90, gamma: 0, t: 0 }, 0);
  const d2 = [], p2 = [];
  for (let i = 1; i <= 180; i++) { const o = r2.feed({ alpha: 0.1 * Math.sin(i / 5), beta: 90, gamma: 0, t: i / 60 }, 0); d2.push(o.dir); p2.push({ right: o.right, up: o.up }); }
  assert.ok(near(T.sway(d2), 0.2, 0.01), `upright: ${T.sway(d2)} degrees for a sweep of a tenth either way`);
  // the old measure on the same unsmoothed readings: degrees right and up from each direction, then their spread
  const raw2 = d2.map(([x, y, z]) => ({ right: Math.atan2(x, -z) * 180 / Math.PI, up: Math.atan2(y, -z) * 180 / Math.PI }));
  assert.ok(near(T.sway(d2), T.spread(raw2), 0.001), `near the centering the two measures agree: sway ${T.sway(d2)}, spread ${T.spread(raw2)}`);
  // two known directions: 1 degree apart
  const a = T.offset(T.rotation(0, 90, 0), T.rotation(0, 90, 0), 0).dir, b = T.offset(T.rotation(0, 90, 0), T.rotation(-1, 90, 0), 0).dir;
  assert.ok(near(T.sway([a, b]), 1, 1e-6), `${T.sway([a, b])}`);
});

test('range-day-sixteen Setting move: with a shot log of 300 rows, Setting stands above the log at the three phone sizes; in tilt mode the steadiness reading shows over the view without scrolling, inside the screen and the within-reach list still holds; it is hidden in drag mode and at the spotting scope', { skip }, async () => {
  const rows = Array.from({ length: 300 }, (_, i) => ({ n: i + 1, yards: 300, target: 'steel', el: 12, wd: -3, zoom: 7, heldUp: 0.5, heldRight: -1.2, hit: i % 2 === 0, where: i % 2 === 0 ? 'hit (2.1 in high, 0.8 in right of center)' : 'miss: 14 in low, 3 in left', upIn: 2.1, rightIn: 0.8, call: null, conditionsShown: false, aim: 'tilt' }));
  for (const [w, h] of PHONES) {
    const { page, context, errors } = await signedIn({ width: w, height: h });
    await page.evaluate((v) => localStorage.setItem('range-day:log:molot-vepr-54r:utg-bugbuster-3-9x32:sb-174-hpbt', JSON.stringify(v)), rows);
    await line(page, VEPR);
    assert.equal(await page.evaluate(() => document.querySelectorAll('#log tbody tr').length), 300, 'the 300 rows are drawn');
    const order = await page.evaluate(() => {
      const top = (el) => el.getBoundingClientRect().top + window.scrollY;
      const setting = [...document.querySelectorAll('h2')].find((x) => x.textContent === 'Setting');
      return { setting: top(setting), gearing: top(document.getElementById('gearing')), log: top(document.getElementById('log')) };
    });
    assert.ok(order.setting < order.log && order.gearing < order.log, `${w}x${h}: Setting at ${order.setting} px, the log at ${order.log} px`);
    assert.equal(await page.isVisible('#steadiness-near'), false, 'hidden in drag mode');
    await tiltOn(page);
    await page.evaluate(() => { const t0 = performance.now() / 1000; for (let i = 0; i < 120; i++) RangeDayLine.feedOrientation(0.1 * Math.sin(i / 5), 90, 0, t0 + i / 60); });
    await page.waitForFunction(() => /^Steadiness: [\d.]+ MOA in 3 s \([\d.]+ at true angle\)$/.test(document.getElementById('steadiness-near').textContent), null, { timeout: 3000 });
    const steadyAt = await page.evaluate(() => { const top = (el) => el.getBoundingClientRect().top + window.scrollY; const el = document.getElementById('steadiness'); return { shown: !el.hidden && el.offsetParent !== null, top: top(el), log: top(document.getElementById('log')) }; });
    assert.ok(steadyAt.shown && steadyAt.top < steadyAt.log, `${w}x${h}: the steadiness line in Setting stands above the log ${JSON.stringify(steadyAt)}`);
    await page.evaluate(() => window.scrollTo(0, 0)); await wait(100);
    const near_ = await page.evaluate(() => { const b = document.getElementById('steadiness-near').getBoundingClientRect(), v = document.getElementById('view').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, view: { top: v.top, bottom: v.bottom, left: v.left, right: v.right } }; });
    assert.ok(near_.top >= 0 && near_.bottom <= h && near_.left >= 0 && near_.right <= w, `${w}x${h}: inside the screen ${JSON.stringify(near_)}`);
    assert.ok(near_.top >= near_.view.top && near_.bottom <= near_.view.bottom && near_.left >= near_.view.left && near_.right <= near_.view.right, `${w}x${h}: over the view ${JSON.stringify(near_)}`);
    const m = await page.evaluate(measure, '#zoomrow');
    assert.deepEqual(meets(m), [], `${w}x${h}: the within-reach list with the reading shown`);
    // the widest reading it can show (a runaway figure, as on Dan's table) still stays inside the view: it wraps, never spills
    const wide = await page.evaluate(() => { const el = document.getElementById('steadiness-near'); el.textContent = 'Steadiness: 3328.9 MOA in 3 s (33289.0 at true angle)'; const b = el.getBoundingClientRect(), v = document.getElementById('view').getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, view: { left: v.left, right: v.right, top: v.top, bottom: v.bottom } }; });
    assert.ok(wide.left >= wide.view.left && wide.right <= wide.view.right && wide.top >= wide.view.top && wide.bottom <= wide.view.bottom, `${w}x${h}: the widest reading inside the view ${JSON.stringify(wide)}`);
    await page.click('#spotting');
    assert.equal(await page.isVisible('#steadiness-near'), false, 'hidden at the spotting scope');
    await page.click('#back-to-rifle');
    assert.equal(await page.isVisible('#steadiness-near'), true, 'back at the rifle');
    await page.click('#aim-mode');
    await page.waitForFunction(() => RangeDayLine.aimMode === 'drag');
    assert.equal(await page.isVisible('#steadiness-near'), false, 'hidden back in drag mode');
    assert.deepEqual(errors, []);
    await context.close();
  }
});
