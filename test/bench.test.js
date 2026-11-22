'use strict';
// range-day-thirteen in a real browser, signing in through the form: the zero bench on one screen (task items 1 to 5) and the
// scope collection on the line and the bench (task items 7 to 10), and the two new fields of a firing-line shot (task item 11).
// Needs Playwright's browser; where it is missing these are skipped and say so (the Checks workflow has it).
//   node --test test/bench.test.js

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { raw, flat } = require('../lib/data').load();
const guns = require('../lib/guns');
const { SIZES, SIGHTS, LIST, BUTTONS, measure, meets } = require('./bench-reach');

const root = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 8981);
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";
const rifles = guns.fromFiles(raw);
const COLLECTION = ['trijicon-acog-ta31f', 'vortex-razor-1-10', 'leupold-mark5hd-5-25'];
const AR = 'course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() { for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } } throw new Error('server never answered'); }
// A fresh device: nothing stored but the Plain picture (the bench draws no 3D; on the line the figures are the same under every picture).
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
  await fresh(page);
  return { page, context, errors };
}
const bench = async (page, q) => { await page.goto(`${base}/zero?${q}`); await page.waitForSelector('#fire5'); await page.waitForFunction(() => window.RangeDayZero && /zeroing supply/.test(document.getElementById('rounds').textContent)); await page.evaluate(() => window.scrollTo(0, 0)); };
const line = async (page, q) => { await page.goto(`${base}/line?${q}`); await page.waitForSelector('#fire'); await page.waitForFunction(() => window.RangeDayLine); };
const boxes = (page) => page.evaluate((sels) => Object.fromEntries(sels.map((s) => { const el = document.querySelector(s); if (!el || el.hidden || el.offsetParent === null) return [s, null]; const b = el.getBoundingClientRect(); return [s, [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10)]; })), [...BUTTONS, '#view', '#group', '#knob-note', '#pair-note', '#rounds']);

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('range-day-thirteen items 1, 3 and 5: the bench within reach: for every sight of every rifle (the collection included), at 412x915, 412x830 and 1280x800, with the page at its top, the paper, the group line, both adjustment rows, Fresh paper, Save this zero, Fire one and Fire five are wholly on the screen, no two buttons touch, the paper is square and at least 300 px on a phone', { skip }, async () => {
  const lines = [];
  assert.ok(SIGHTS.length >= 14 + 18, `every sight of every rifle, the collection included (${SIGHTS.length})`);
  for (const [w, h] of SIZES) {
    const { page, context, errors } = await signedIn({ width: w, height: h });
    for (const s of SIGHTS) {
      await fresh(page);
      await bench(page, s.q);
      const m = await page.evaluate(measure, [LIST, BUTTONS]);
      const bad = meets(m);
      lines.push(`${w}x${h} ${s.name}: paper ${m.paper.width} px; Fire's bottom ${m.fireBottom} of ${h}; ${bad.length ? bad.join('; ') : 'all within reach'}`);
      assert.deepEqual(bad, [], `${w}x${h}, ${s.name}`);
      for (const name of ['paper', 'where the last group landed', 'elevation one click up', 'windage one click right', 'Fresh paper', 'Save this zero', 'Fire one', 'Fire five']) assert.equal(m.items.find((i) => i.name === name).shown, true, `${s.name}: ${name} shown`);
      if (w === 412) for (const b of m.buttons) assert.ok(b.box.height >= 44, `${s.name}: ${b.sel} is ${b.box.height} px tall, under 44`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('  ' + lines.join('\n  '));
});

test('range-day-thirteen item 4: nothing shifts: every button, the paper and the lines of words keep their places through a group fired, a knob run to the end of its travel, a zero saved, a fresh paper hung and the old one put back, and the supply running empty; Open another box stands where Fire stood; the page never scrolls', { skip }, async () => {
  const lines = [];
  for (const [w, h] of [[412, 830], [1280, 800]]) {
    const { page, context, errors } = await signedIn({ width: w, height: h });
    // The Vortex on the BCM: quarter-minute clicks, 240 each way, so the setting's words are at their longest near the end.
    await page.evaluate(() => localStorage.setItem('range-day:sight:bcm-ar15:vortex-razor-1-10', JSON.stringify({ elevationClicks: 239, windageClicks: -238 })));
    await bench(page, 'course=angeles-sylmar&rifle=bcm-ar15&sight=vortex-razor-1-10&load=imi-m193');
    const start = await boxes(page);
    const same = async (what, opened) => {
      const now = await boxes(page);
      // an opened group line opens over what is below it, by design: it is left out of the comparison while open
      const moved = BUTTONS.concat(['#view', '#knob-note', '#pair-note', '#rounds'], opened ? [] : ['#group']).filter((s) => start[s] && now[s] && JSON.stringify(start[s]) !== JSON.stringify(now[s]));
      lines.push(`${w}x${h} ${what}: ${moved.length ? `moved: ${moved.map((s) => `${s} ${JSON.stringify(start[s])} -> ${JSON.stringify(now[s])}`).join(', ')}` : 'nothing moved'}; scrolled ${await page.evaluate(() => window.scrollY)}`);
      assert.deepEqual(moved, [], lines[lines.length - 1]);
      assert.equal(await page.evaluate(() => window.scrollY), 0);
    };
    await page.click('#fire5'); await same('after a group of five');
    await page.click('#el-up'); await page.click('#el-up');
    assert.match(await page.textContent('#knob-note'), /elevation knob is at the end of its travel \(240 clicks, 60 MOA from the middle\)/);
    assert.match(await page.textContent('#el-text'), /\+240 clicks \(60 MOA up\)/);
    await same('the elevation knob at the end of its travel, its words beside the rows');
    await page.click('#wd-left'); await page.click('#wd-left'); await page.click('#wd-left');
    assert.match(await page.textContent('#wd-text'), /−240 clicks \(60 MOA left\)/);
    await same('the windage at −240 clicks, its longest words');
    await page.click('#save');
    assert.match(await page.textContent('#pair-note'), /^Zero saved at 100 yards: elevation \+240, windage −240 clicks\.$/);
    assert.match(await page.textContent('#saved'), /Saved zero for IMI M193 55 gr.*100 yards, elevation \+240 clicks/);
    await same('after Save this zero, its line naming the distance and both settings');
    await page.click('#fresh');
    assert.equal(await page.textContent('#fresh'), 'Put the old paper back');
    assert.equal(await page.evaluate(() => RangeDayZero.holes.length), 0);
    await same('after Fresh paper (the way back where it stood)');
    await page.click('#fresh');
    assert.equal(await page.textContent('#fresh'), 'Fresh paper');
    assert.match(await page.textContent('#pair-note'), /The old paper is back at 100 yards, with its 5 holes\./);
    await same('the old paper put back');
    await page.click('#fresh'); await page.click('#fire1');
    assert.equal(await page.textContent('#fresh'), 'Fresh paper', 'the way back lasts until the next shot');
    assert.equal(await page.evaluate(() => RangeDayZero.holes.length), 1, 'the new paper has the one hole');
    await same('a shot on a fresh paper: the button is Fresh paper again');
    if (await page.evaluate(() => document.getElementById('group').classList.contains('long'))) { await page.click('#group'); await same('with the group line opened over what is below it', true); await page.click('#group'); await same('the group line closed again'); }
    for (let i = 0; i < 3; i++) await page.click('#fire5');
    assert.ok(await page.isVisible('#another-box'));
    assert.match(await page.textContent('#rounds'), /the box of 20 is empty/);
    const fireBox = start['#fire1'], another = (await boxes(page))['#another-box'];
    assert.ok(another[1] === fireBox[1] && another[3] === fireBox[3], `Open another box stands in the Fire row: ${another} against ${fireBox}`);
    await same('the supply empty, Open another box where Fire stands');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('  ' + lines.join('\n  '));
});

test('range-day-thirteen item 4 and verify 4: a reload mid-group shows the same holes, read from the day; Fresh paper is kept across a reload; the stored keys before and after the reload are the same', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await bench(page, AR);
  await page.click('#fire5'); await page.click('#fire1');
  const before = await page.evaluate(() => ({ holes: RangeDayZero.holes.map((h) => [h.upIn, h.rightIn]), keys: Object.keys(localStorage).sort() }));
  assert.equal(before.holes.length, 6);
  await bench(page, AR);
  const after = await page.evaluate(() => ({ holes: RangeDayZero.holes.map((h) => [h.upIn, h.rightIn]), keys: Object.keys(localStorage).sort() }));
  assert.deepEqual(after.holes, before.holes, 'the same six holes, to the hundredth of an inch');
  assert.deepEqual(after.keys, before.keys, 'no key added or lost by the reload');
  // Another distance shows its own paper; back at 100 the six are there.
  await page.selectOption('#distance', '50');
  assert.equal(await page.evaluate(() => RangeDayZero.holes.length), 0);
  await page.selectOption('#distance', '100');
  assert.equal(await page.evaluate(() => RangeDayZero.holes.length), 6);
  await page.click('#fresh');
  await bench(page, AR);
  const day = await page.evaluate(() => RangeDayZero.day);
  assert.equal(await page.evaluate(() => RangeDayZero.holes.length), 0, 'the fresh paper is kept');
  assert.equal(day.freshPaper['bench:100'], 6, 'its marker is the last shot\'s number, under "bench:100"');
  assert.equal(day.shots.length, 6, 'no shot deleted');
  console.log(`  holes before the reload: ${JSON.stringify(before.holes)}\n  holes after:  ${JSON.stringify(after.holes)}\n  keys: ${after.keys.join(', ')}`);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-thirteen items 8 and 9: home\'s chooser on the BCM lists its own sight, then "From the scope collection" with the three; the .22 lists none; on the line each scope\'s view is the maker\'s width at each end of its power, the fixed 4 power shows no zoom, a leaf is not shown while a scope is on', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/?rifle=bcm-ar15`); await page.waitForSelector('.rifle.picked[data-rifle="bcm-ar15"]');
  const groups = await page.$$eval('#sight > *', (els) => els.map((e) => (e.tagName === 'OPTGROUP' ? { group: e.label, options: [...e.children].map((o) => o.value) } : e.value)));
  assert.deepEqual(groups, ['troy-battlesights', { group: 'From the scope collection', options: COLLECTION }]);
  await page.goto(`${base}/?rifle=remington-22`); await page.waitForSelector('.rifle.picked[data-rifle="remington-22"]');
  assert.equal(await page.$$eval('#sight optgroup', (g) => g.length), 0, 'the .22 offers none of the collection');
  const lines = [];
  const E = require('../public/engine.js');
  for (const id of COLLECTION) {
    const S = flat.sights[id];
    await line(page, `course=angeles-sylmar&rifle=bcm-ar15&sight=${id}&load=imi-m193`);
    assert.equal(await page.isVisible('#zoomrow'), S.zoom.high > S.zoom.low, `${id}: a zoom control only where the power changes`);
    for (const [end, m] of [['low', S.zoom.low], ['high', S.zoom.high]]) {
      await page.evaluate((z) => RangeDayLine.setZoom(z), m);
      const fov = await page.evaluate(() => RangeDayLine.fovMoa);
      const want = (S.fovFtAt100[end] * 12) / E.inchesPerMoa(100);
      lines.push(`${id} at ${m}x: view ${fov.toFixed(3)} MOA across, the maker's ${S.fovFtAt100[end]} ft at 100 yards is ${want.toFixed(3)} MOA`);
      assert.ok(Math.abs(fov - want) < 1e-9, lines[lines.length - 1]);
    }
  }
  await line(page, `course=angeles-sylmar&rifle=ak-545&sight=vortex-razor-1-10&load=hornady-545-60`);
  assert.equal(await page.isVisible('#leafrow'), false, 'no leaf with a scope on the 5.45 rifle');
  await bench(page, `course=angeles-sylmar&rifle=ak-545&sight=vortex-razor-1-10&load=hornady-545-60`);
  assert.equal(await page.isVisible('#leafrow'), false, 'nor on the bench');
  console.log('  ' + lines.join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-thirteen verify 7: each scope\'s reticle drawn against its data, read from the canvas, at 412 and 1280 px wide at the lowest and highest power: the ACOG\'s chevron (its base\'s width and its height); the two first-focal-plane crosshairs, a fine line through the center and no mark', { skip }, async () => {
  const lines = []; let worst = 0;
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    for (const id of COLLECTION) {
      const S = flat.sights[id];
      await line(page, `course=cta-piru&rifle=molot-vepr-54r&sight=${id}&load=sb-174-hpbt`);
      for (const power of [S.zoom.low, S.zoom.high]) {
        // held high into the sky over the far plates, so the reticle stands on plain sky
        await page.evaluate(([p, up]) => { RangeDayLine.setZoom(p); RangeDayLine.setHold(up, 0); }, [power, 0.6 * (S.fovFtAt100.low * 12 / 1.047) / (power / S.zoom.low) ** 0.5]);
        await page.waitForTimeout(250);
        const r = await page.evaluate(() => {
          const c = document.getElementById('view'), g = c.getContext('2d'), G = RangeDayLine.geometry, size = G.viewPx, cx = size / 2, cy = size / 2;
          const dpr = c.width / size;
          const med = (xs) => xs.slice().sort((a2, b2) => a2 - b2)[Math.floor(xs.length / 2)];
          const lum = (x, y) => { const d = g.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return 0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]; };
          const sky = lum(cx + size * 0.2, cy - size * 0.2);
          // the darkest pixels in the row at the chevron's base (or 10 px under the center): their span
          // dark against the row's own background, read just outside the window (the sky brightens upward)
          const row = (y, f = 0.55, half = size * 0.3) => { const all = []; for (let x = Math.round(cx - half - 8); x <= Math.round(cx + half + 8); x++) all.push(lum(x, y)); const bg = all.sort((a2, b2) => a2 - b2)[Math.floor(all.length / 2)]; const xs = []; for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) if (lum(x, y) < bg * f) xs.push(x); return xs; };
          // the chevron's base: its two lower ends, the darker pixels in the rows across the base's height (a line of 1.2 px, smoothed), each
          // against its row's own background (the middle value of the row around it)
          const base = G.chevronPx ? [-1, 0, 1].flatMap((dy) => row(cy + G.chevronPx.heightPx + dy, 0.7, G.chevronPx.widthPx / 2 + 4)).sort((a, b) => a - b) : null;
          return { G, sky, size, cx, cy, baseRow: base, // a fine line: a pixel darker than both its neighbours 3 px off by a third, in the row 10 px under the center
            under: (() => { const y = cy + 10, xs = []; for (let x = Math.round(cx - 30); x <= Math.round(cx + 30); x++) if (lum(x, y) < 0.7 * Math.min(lum(x - 3, y), lum(x + 3, y))) xs.push(x); return xs; })(),
            // the horizontal line at 30% out to the right against the column around it, the vertical line 30% up against the row around it
            right: [lum(cx + size * 0.3, cy), med(Array.from({ length: 17 }, (_, i) => lum(cx + size * 0.3, cy - 8 + i)))], above: [lum(cx, cy - size * 0.3), med(Array.from({ length: 17 }, (_, i) => lum(cx - 8 + i, cy - size * 0.3)))] };
        });
        const k = r.G.pxPerMoa;
        if (S.reticle.kind === 'chevron') {
          const wantW = S.reticle.chevronBaseWidthMoa * k, wantH = S.reticle.chevronHeightMoa * k;
          const drawnW = r.baseRow.length ? r.baseRow[r.baseRow.length - 1] - r.baseRow[0] : 0;
          const diff = Math.abs(drawnW - wantW);
          lines.push(`${sizeName} ${id} at ${power}x: the chevron's base drawn ${drawnW.toFixed(1)} px wide at ${wantH.toFixed(2)} px under the tip; data ${S.reticle.chevronBaseWidthMoa} × ${k.toFixed(3)} = ${wantW.toFixed(2)} px wide, ${S.reticle.chevronHeightMoa} MOA = ${wantH.toFixed(2)} px high; difference ${diff.toFixed(2)} px`);
          assert.ok(Math.abs(r.G.chevronPx.widthPx - wantW) < 1e-9 && Math.abs(r.G.chevronPx.heightPx - wantH) < 1e-9, 'the drawing is asked for the data\'s sizes');
          assert.ok(diff <= 2, lines[lines.length - 1]);
          worst = Math.max(worst, diff);
        } else {
          // a fine dark line through the center both ways; nothing else: the row 10 px under the center is dark only where the vertical line crosses it
          lines.push(`${sizeName} ${id} at ${power}x: crosshair dark at the right (${r.right[0].toFixed(0)} against ${r.right[1].toFixed(0)} around it) and above (${r.above[0].toFixed(0)} against ${r.above[1].toFixed(0)}); the row 10 px under the center dark at ${JSON.stringify(r.under)} only (the center is ${r.cx}); ${k.toFixed(3)} px per MOA`);
          assert.ok(r.right[0] < r.right[1] * 0.7 && r.above[0] < r.above[1] * 0.7, lines[lines.length - 1]);
          assert.ok(r.under.length >= 1 && r.under.length <= 3 && r.under.every((x) => Math.abs(x - r.cx) <= 1.5), lines[lines.length - 1]);
          assert.equal(r.G.crosshair, true);
        }
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`  largest difference, the chevron: ${worst.toFixed(2)} px\n  ` + lines.join('\n  '));
});

test('range-day-thirteen: same scale through each scope: where the drawing puts the near paper and a far plate, against the angles from the data at the drawn aim, at the lowest and highest power, at 412 and 1280 px wide', { skip }, async () => {
  const MOA = Math.PI / (180 * 60);
  const ang = (t) => ({ up: Math.atan2(t.riseFt, t.yards * 3) / MOA, right: Math.atan2(t.lateralYd, t.yards) / MOA });
  const lines = []; let worst = 0, checked = 0;
  const c = flat.courses['cta-piru'], far = c.plates.length - 1;
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    for (const id of COLLECTION) {
      const S = flat.sights[id];
      await line(page, `course=cta-piru&rifle=molot-vepr-54r&sight=${id}&load=sb-174-hpbt`);
      for (const power of [...new Set([S.zoom.low, S.zoom.high])]) {
        for (const [key, t] of [['near-0', c.near[0]], [String(far), c.plates[far]]]) {
          await page.evaluate(([kk, p]) => { RangeDayLine.setTarget(kk); RangeDayLine.setZoom(p); RangeDayLine.setHold(0, 0); }, [key, power]);
          await page.waitForTimeout(250);
          const r = await page.evaluate((kk) => { const g = RangeDayLine.geometry; return { on: RangeDayLine.targetOnScreen(kk).plain, k: g.pxPerMoa, size: g.viewPx, aim: g.aim, paper: RangeDayLine.drawnPaper(kk) }; }, key);
          const at = key.startsWith('near') && r.paper ? { x: r.paper.x, y: r.paper.y, aim: { right: r.paper.aimRight, up: r.paper.aimUp }, k: r.paper.pxPerMoa } : { x: r.on[0], y: r.on[1], aim: r.aim, k: r.k };
          const A = ang(t);
          const ex = r.size / 2 + (A.right - A.right - at.aim.right) * at.k, ey = r.size / 2 - (A.up - A.up - at.aim.up) * at.k;
          const off = Math.hypot(at.x - ex, at.y - ey);
          lines.push(`${sizeName} ${id} at ${power}x, ${t.yards} yd ${key.startsWith('near') ? 'paper' : 'plate'}: drawn ${at.x.toFixed(2)}, ${at.y.toFixed(2)}; angles ${ex.toFixed(2)}, ${ey.toFixed(2)}; ${off.toFixed(3)} px`);
          assert.ok(off <= 1, lines[lines.length - 1]);
          worst = Math.max(worst, off); checked++;
        }
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`  ${checked} targets checked, largest difference ${worst.toFixed(3)} px\n  ` + lines.join('\n  '));
});

test('range-day-thirteen verify 8: for each of the three collection scopes, a zero saved with it on the BCM is not read on the X95: the X95 starts unzeroed with it, the BCM\'s zero untouched; every key the device held before (a zero and a setting of the BCM\'s own sight) is unchanged, byte for byte, none left out; each scope clicks by its own click over its own travel on the bench', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  // a device as main left it: a zero and a setting of the BCM's own sight
  await page.evaluate(() => { localStorage.setItem('range-day:zero:bcm-ar15:troy-battlesights:imi-m193', JSON.stringify({ elevationClicks: 2, windageClicks: -1, zeroYards: 100, sight: 'troy-battlesights', savedAt: '2026-11-20T10:00:00.000Z' })); localStorage.setItem('range-day:sight:bcm-ar15:troy-battlesights', JSON.stringify({ elevationClicks: 2, windageClicks: -1 })); });
  const old = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
  // Every key the device held before is compared byte for byte after each scope, none left out; the keys the visits add are listed.
  const lines = [`keys held before, each compared byte for byte: ${Object.keys(old).sort().join(', ')}`];
  const zeros = {};
  for (const [i, id] of COLLECTION.entries()) {
    await page.evaluate(() => { localStorage.removeItem('range-day:day:open'); });
    await bench(page, `course=angeles-sylmar&rifle=bcm-ar15&sight=${id}&load=imi-m193`);
    for (let j = 0; j < i + 2; j++) await page.click('#el-up');
    await page.click('#save');
    zeros[id] = await page.evaluate((s) => localStorage.getItem(`range-day:zero:bcm-ar15:${s}:imi-m193`), id);
    assert.match(zeros[id], new RegExp(`"elevationClicks":${i + 2}`), id);
    await page.evaluate(() => { localStorage.removeItem('range-day:day:open'); });
    await bench(page, `course=angeles-sylmar&rifle=iwi-x95&sight=${id}&load=imi-m193`);
    assert.match(await page.textContent('#saved'), /No zero saved yet for IMI M193 55 gr.* with this sight/, `${id} on the X95`);
    assert.equal(await page.textContent('#el-text'), '0 clicks (middle)', `${id} on the X95 starts at its middle`);
    const keys = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])));
    assert.equal(keys[`range-day:zero:iwi-x95:${id}:imi-m193`], undefined, `${id}: nothing written for the X95`);
    for (const done of COLLECTION.slice(0, i + 1)) assert.equal(keys[`range-day:zero:bcm-ar15:${done}:imi-m193`], zeros[done], `${done}: the BCM's zero untouched`);
    for (const [k, v] of Object.entries(old)) assert.equal(keys[k], v, `${k} unchanged, byte for byte`);
    lines.push(`${id}: zero saved on the BCM (elevation +${i + 2}); on the X95 "No zero saved yet", at its middle, no key written; the BCM's zeros and every earlier record unchanged`);
  }
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  lines.push(`stored keys after: ${keys.join(', ')}`, `keys added by the visits: ${keys.filter((k) => !(k in old)).join(', ')}`);
  // each scope's own click on the bench: one press moves its setting's words by its own click in MOA
  for (const id of COLLECTION) {
    const S = flat.sights[id];
    await bench(page, `course=angeles-sylmar&rifle=bcm-ar15&sight=${id}&load=imi-m193`);
    await page.evaluate((s) => localStorage.removeItem(`range-day:sight:bcm-ar15:${s}`), id);
    await bench(page, `course=angeles-sylmar&rifle=bcm-ar15&sight=${id}&load=imi-m193`);
    await page.click('#el-up');
    const want = `+1 clicks (${Math.round(S.clickMoa * 100) / 100} MOA up)`;
    assert.equal(await page.textContent('#el-text'), want, id);
    lines.push(`${id}: one click up reads "${want}"; travel ${S.clicks} clicks each way${S.windageClicks ? `, windage ${S.windageClicks}` : ''}`);
  }
  console.log('  ' + lines.join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-thirteen item 11: a firing-line shot carries its time of flight as the engine gave it and its target\'s key; an old day without them still reads on the day\'s page and in a copy', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, AR);
  for (const key of ['near-0', '2']) {
    await page.evaluate((k) => { RangeDayLine.setTarget(k); RangeDayLine.setHold(0, 0); RangeDayLine.fire(7); RangeDayLine.landAll(); }, key);
    const r = await page.evaluate(() => ({ shot: RangeDayLine.day.shots[RangeDayLine.day.shots.length - 1], input: RangeDayLine.lastShotInput }));
    assert.equal(r.shot.targetKey, key);
    assert.equal(r.shot.flightS, r.input.timeS, 'exactly the engine\'s figure, not rounded');
    assert.ok(r.shot.flightS > 0.05 && r.shot.flightS < 1.5, `${key}: ${r.shot.flightS} s`);
    console.log(`  shot at ${key}: flightS ${r.shot.flightS}, the engine's timeS ${r.input.timeS}`);
  }
  // packed up, with both fields taken off its shots, as a day from before: it still reads on the day's page and in a copy
  const copyNew = await page.evaluate(() => { try { RD.checkCopy(RD.makeCopy()); return 'ok'; } catch (e) { return e.message; } });
  await page.evaluate(() => { RD.packUp(); const days = JSON.parse(localStorage.getItem('range-day:days')); for (const s of days[0].shots) { delete s.flightS; delete s.targetKey; } localStorage.setItem('range-day:days', JSON.stringify(days)); });
  await page.goto(`${base}/day`); await page.waitForSelector('#facts');
  assert.match(await page.textContent('#facts'), /at steel/);
  const copyOld = await page.evaluate(() => { try { RD.checkCopy(RD.makeCopy()); return 'ok'; } catch (e) { return e.message; } });
  assert.deepEqual([copyNew, copyOld], ['ok', 'ok'], 'a copy with the new fields and one without both load');
  const bad = await page.evaluate(() => { const c = RD.makeCopy(); c.days[0].shots.find((x) => x.place === 'line').flightS = 'slow'; try { RD.checkCopy(c); return 'accepted'; } catch (e) { return e.message; } });
  assert.match(bad, /flightS is "slow"; where present it must be the time of flight in seconds/);
  assert.deepEqual(errors, []);
  await context.close();
});
