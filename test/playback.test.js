'use strict';
// range-day-fourteen, part C, in a real browser signing in through the form: a day played back through the spotting scope.
// A seeded day of five firing-line shots (three on steel, one on paper, one miss) and one at the bench (test/playback-seed.js)
// is played back; every frame's drawn strikes are read and compared with the records, computed here from the targets' angles and
// the record's inches, not from the page's own sums. Also: every stored key unchanged by a playback; each control within reach;
// the states with nothing to show; a shot recorded before range-day-thirteen; the day page's control.
// Needs Playwright's browser; where it is missing these are skipped and say so (the Checks workflow has it).
//   node --test test/playback.test.js

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const seed = require('./playback-seed');

const root = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 8985);
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() { for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } } throw new Error('server never answered'); }

async function signedIn(viewport, init) {
  const context = await browser.newContext({ viewport: viewport || { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/login`);
  await page.fill('#passphrase', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('range-day:picture', JSON.stringify('plain')); });
  if (init) await context.addInitScript(init);
  return { page, context, errors };
}
// Opens the firing line (which starts the day), writes the seeded shots into it, answers the day's id.
async function seeded(page, shots) {
  await page.goto(`${base}${seed.LINE}`); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.day);
  return page.evaluate(seed.seedInPage, shots || seed.seedShots(Date.now() - 300000));
}
const playback = async (page, id) => { await page.goto(`${base}/playback?id=${encodeURIComponent(id)}`); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.playback); };

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('range-day-fourteen task item 10: the seeded day of five shots played back frame by frame: each strike drawn at the recorded place to within a pixel, nothing drawn for a shot before its moment, the trace only in flight', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  const id = await seeded(page);
  await playback(page, id);
  // every frame, after the page has drawn it: the clock, the shot in view, what was drawn, the scale, the trace
  await page.evaluate(() => { window.__frames = []; const P = RangeDayLine.playback; const tick = () => { const G = RangeDayLine.geometry; window.__frames.push({ clock: P.clock, current: P.current, drawn: P.drawn, k: G.pxPerMoa, size: G.viewPx, trace: P.traceAt, ended: !P.playing }); if (P.playing) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const end = await page.evaluate(() => RangeDayLine.playback.end);
  await page.waitForFunction(() => !RangeDayLine.playback.playing, null, { timeout: (end + 120) * 1000 });
  const { frames, events, targets } = await page.evaluate(() => ({ frames: window.__frames, events: RangeDayLine.playback.events, targets: RangeDayLine.targets }));
  const ipm = await page.evaluate(() => Object.fromEntries(RangeDayLine.targets.map((t) => [t.yards, RangeDayEngine.inchesPerMoa(t.yards)])));
  const MOA = Math.PI / (180 * 60);
  const ang = (t) => ({ up: Math.atan2(t.riseFt, t.yards * 3) / MOA, right: Math.atan2(t.lateralYd, t.yards) / MOA });
  const rec = Object.fromEntries(seed.seedShots(0).filter((s) => s.place === 'line').map((s) => [s.n, s]));
  const byKey = Object.fromEntries(targets.map((t) => [t.key, t]));
  let worst = 0, checked = 0, framesWithStrikes = 0, traceFrames = 0;
  const seen = new Set();
  for (const f of frames) {
    const view = byKey[events[f.current].key], va = ang(view);
    if (f.drawn.length) framesWithStrikes++;
    for (const m of f.drawn) {
      const e = events.find((x) => x.n === m.n), s = rec[m.n], t = byKey[e.key], a = ang(t);
      assert.ok(e.strikeT <= f.clock + 1e-9, `shot ${m.n} drawn at ${f.clock.toFixed(3)} s, before its strike at ${e.strikeT.toFixed(3)} s`);
      const want = [f.size / 2 + (a.right - va.right + s.rightIn / ipm[t.yards]) * f.k, f.size / 2 - (a.up - va.up + s.upIn / ipm[t.yards]) * f.k];
      const diff = Math.hypot(m.x - want[0], m.y - want[1]);
      worst = Math.max(worst, diff); checked++; seen.add(`${m.n}:${m.kind}`);
      assert.ok(diff <= 1, `shot ${m.n} (${m.kind}) drawn ${diff.toFixed(3)} px from its recorded place at ${f.clock.toFixed(3)} s`);
    }
    // every shot landed by now on steel or paper whose place is in the view is drawn (the plain drawing leaves out a sheet
    // wholly outside the view; a miss's dust lasts its life, then is gone)
    for (const e of events) {
      if (e.strikeT > f.clock || !rec[e.n].hit) continue;
      const t = byKey[e.key], a = ang(t), s = rec[e.n];
      const x = f.size / 2 + (a.right - va.right + s.rightIn / ipm[t.yards]) * f.k, y = f.size / 2 - (a.up - va.up + s.upIn / ipm[t.yards]) * f.k;
      if (x >= 0 && x <= f.size && y >= 0 && y <= f.size) assert.ok(f.drawn.some((m) => m.n === e.n), `shot ${e.n} landed at ${e.strikeT.toFixed(3)} s and is drawn at ${f.clock.toFixed(3)} s`);
    }
    const cur = events[f.current];
    if (f.trace) { traceFrames++; assert.ok(cur.flightS && f.clock >= cur.fireT && f.clock < cur.strikeT, `the trace is drawn only while shot ${cur.n} is in flight (${f.clock.toFixed(3)} s)`); }
  }
  assert.deepEqual([...seen].sort(), ['2:mark', '3:mark', '4:hole', '5:dust', '6:mark'], 'the three marks, the hole and the dust were each drawn');
  assert.ok(traceFrames > 0, 'the trace was drawn in flight');
  assert.ok(frames[frames.length - 1].ended && Math.abs(frames[frames.length - 1].clock - end) < 1e-9, 'it played to the end of the day');
  console.log(`  shots replayed: ${events.length} (n ${events.map((e) => e.n).join(', ')}); frames checked: ${frames.length}, ${framesWithStrikes} with strikes drawn; strikes compared: ${checked}; largest difference between a drawn strike and its record: ${worst.toFixed(4)} px; frames with the trace: ${traceFrames}`);
  console.log(`  ${await page.textContent('#play-words')}`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-fourteen task item 10: every stored key byte for byte the same after a playback played, paused, stepped, dragged, slowed to the day\'s pace, zoomed and muted', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  const id = await seeded(page);
  const snap = () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  const before = await snap();
  await playback(page, id);
  await page.waitForTimeout(2500);
  await page.click('#play-pause'); await page.click('#play-next'); await page.click('#play-next'); await page.click('#play-before');
  await page.click('#play-pace'); await page.click('#play-sound');
  await page.locator('#play-power').fill('90');
  await page.locator('#play-line').fill('800');
  await page.click('#play-pause'); await page.waitForTimeout(1500);
  const after = await snap();
  assert.deepEqual(Object.keys(after), Object.keys(before), 'no key added or taken away');
  for (const k of Object.keys(before)) assert.equal(after[k], before[k], `${k} byte for byte the same`);
  console.log(`  ${Object.keys(before).length} keys before and after, each the same: ${Object.keys(before).join(', ')}`);
  assert.equal(await page.evaluate(() => RangeDayLine.playback.pace), 'real');
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-fourteen task item 10: every playback control within reach and none touching another, at 378x762 (Dan\'s phone), 412x830, 412x915 and 1280x800', { skip }, async () => {
  const CONTROLS = ['#view', '#play-words', '#play-line', '#play-before', '#play-pause', '#play-next', '#play-pace', '#play-power', '#play-sound', '#play-to-day'];
  const BUTTONS = ['#play-before', '#play-pause', '#play-next', '#play-pace', '#play-power', '#play-sound', '#play-to-day'];
  const lines = [];
  for (const [w, h] of [[378, 762], [412, 830], [412, 915], [1280, 800]]) {
    const { page, context, errors } = await signedIn({ width: w, height: h });
    const id = await seeded(page);
    await playback(page, id);
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await page.evaluate((sels) => Object.fromEntries(sels.map((s) => { const b = document.querySelector(s).getBoundingClientRect(); return [s, [b.left, b.top, b.right, b.bottom]]; })), CONTROLS);
    for (const s of CONTROLS) { const [l, t, r, b] = box[s]; assert.ok(l >= 0 && t >= 0 && r <= w && b <= h && r - l > 0 && b - t > 0, `${w}x${h}: ${s} at ${box[s].map((v) => v.toFixed(0)).join(',')} is wholly on the first screen`); }
    for (let i = 0; i < BUTTONS.length; i++) for (let j = i + 1; j < BUTTONS.length; j++) { const a = box[BUTTONS[i]], b = box[BUTTONS[j]]; assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], `${w}x${h}: ${BUTTONS[i]} and ${BUTTONS[j]} do not touch`); }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${w}x${h}: no sideways scroll`);
    lines.push(`${w}x${h}: view ${(box['#view'][2] - box['#view'][0]).toFixed(0)} px; lowest control's bottom edge ${Math.max(...BUTTONS.map((s) => box[s][3])).toFixed(1)} of ${h}`);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('  ' + lines.join('\n  '));
});

test('range-day-fourteen task items 7 and 8: a day with no firing-line shots says so in one line with the way back; a device that refuses its storage says "not saved on this device"; a shot recorded before range-day-thirteen is found by its kind and distance and lands without the wait or a trace', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  // only the bench
  const bench = seed.seedShots(Date.now() - 300000).filter((s) => s.place === 'bench');
  let id = await seeded(page, bench);
  await page.goto(`${base}/playback?id=${encodeURIComponent(id)}`); await page.waitForSelector('#play-empty:not([hidden])');
  assert.equal(await page.textContent('#play-empty-text'), 'No shots on the firing line that day (1 at the bench, which are not played back), so there is nothing to play back.');
  assert.equal(await page.getAttribute('#play-empty-back', 'href'), `/day?id=${encodeURIComponent(id)}`);
  assert.equal(await page.isVisible('#view'), false);
  // an old record: no flightS, no targetKey
  const old = seed.seedShots(Date.now() - 300000).map((s) => { const { flightS, targetKey, ...rest } = s; return rest; });
  id = await seeded(page, old);
  await playback(page, id);
  const ev = await page.evaluate(() => RangeDayLine.playback.events);
  assert.deepEqual(ev.map((e) => e.key), ['0', '1', 'near-1', '2', '3'], 'each target found by its kind and distance');
  assert.ok(ev.every((e) => e.flightS === null && e.strikeT === e.fireT), 'no wait for a shot without its flight time');
  await page.evaluate(() => RangeDayLine.playback.pause());
  await page.evaluate((t) => RangeDayLine.playback.seek(t), ev[0].fireT);
  await page.waitForTimeout(200);
  assert.equal(await page.evaluate(() => RangeDayLine.playback.traceAt), null, 'no trace without a flight time');
  assert.deepEqual(errors, []);
  await context.close();
  // storage refused: every read throws
  const refused = await signedIn({ width: 412, height: 915 }, () => { Storage.prototype.getItem = function () { throw new Error('refused'); }; Storage.prototype.setItem = function () { throw new Error('refused'); }; });
  await refused.page.goto(`${base}/playback?id=${encodeURIComponent(id)}`); await refused.page.waitForSelector('#play-empty:not([hidden])');
  assert.match(await refused.page.textContent('#play-empty-text'), /not saved on this device/);
  await refused.context.close();
});

test('range-day-fourteen task item 5: the day\'s page, open or finished, has the one control Play this day back, leading to the playback of that day', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  const id = await seeded(page);
  await page.goto(`${base}/day?id=${encodeURIComponent(id)}`); await page.waitForSelector('#play-back');
  assert.equal(await page.textContent('#play-back'), 'Play this day back');
  assert.equal(await page.getAttribute('#play-back', 'href'), `/playback?id=${encodeURIComponent(id)}`);
  await page.click('#pack-up'); await page.waitForURL(/\/day\?id=/); await page.waitForSelector('#play-back');
  await page.click('#play-back'); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.playback && RangeDayLine.playback.events);
  assert.equal(await page.evaluate(() => RangeDayLine.playback.events.length), 5);
  assert.deepEqual(errors, []);
  await context.close();
});
