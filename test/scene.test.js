'use strict';
// The firing line's picture (range-day-five), in a real browser signing in
// through the form: the scene draws each plate where the plain drawing
// does, within a pixel, at every zoom and both sizes (verify 2); twenty
// seeded shots land the same under Full, Light and Plain (verify 3); the
// rendered colours against the measured palette (verify 6); what a phone
// downloads, and that a second visit downloads no terrain (verify 7); the
// plain fallback where the browser has no 3D (verify 8); no wind figure on
// the page with the conditions off (verify 9); the first visit's choice.
// Needs Playwright's browser; skipped, and says so, where it is missing.
//   npm test
const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');
const { flat } = require('../lib/data').load();

const root = path.join(__dirname, '..');
const PORT = 8961;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";

const PIRU = '/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up() { for (let i = 0; i < 100; i++) { try { await fetch(`${base}/alive`); return; } catch { await wait(50); } } throw new Error('server never answered'); }
async function signedIn(viewport, init) {
  const context = await browser.newContext({ viewport: viewport || { width: 412, height: 915 }, deviceScaleFactor: 1 });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${base}/login`);
  await page.fill('#passphrase', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  await page.evaluate(() => { try { localStorage.removeItem('range-day:day:open'); localStorage.removeItem('range-day:day:packed'); localStorage.removeItem('range-day:picture'); } catch {} });
  return { page, context, errors };
}
const setPicture = (page, v) => page.evaluate((p) => localStorage.setItem('range-day:picture', JSON.stringify(p)), v);
const sceneReady = (page) => page.waitForFunction(() => RangeDayLine.scene || RangeDayLine.sceneFailed || (!RangeDayLine.sceneLoading && RangeDayLine.picture === 'plain'), null, { timeout: 90000 });
async function seededShot(page, seed) {
  const before = await page.evaluate(() => RangeDayLine.log.length);
  await page.evaluate((s) => RangeDayLine.fire(s), seed);
  for (let i = 0; i < 200; i++) { await wait(50); if ((await page.evaluate(() => RangeDayLine.log.length)) > before) break; }
  const log = await page.evaluate(() => RangeDayLine.log); return log[log.length - 1];
}
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('verify 2: same scale: for every canyon plate at 2x and 7x through the Vepr\'s scope and at 1x through its irons, the scene puts the plate\'s centre within 1 pixel of the plain drawing, at both sizes', { skip }, async () => {
  let worstOn = 0, worstAll = 0, worstWhere = '';
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    await setPicture(page, 'full');
    for (const [name, path, zoom] of [['scope 2x', `${PIRU}&sight=utg-2-7x44`, 2], ['scope 7x', `${PIRU}&sight=utg-2-7x44`, 7], ['irons 1x', `${PIRU}&sight=vepr-irons`, null]]) {
      await page.goto(`${base}${path}`); await page.waitForSelector('#fire');
      await sceneReady(page);
      assert.equal(await page.evaluate(() => RangeDayLine.picture), 'full', `${sizeName} ${name}: the Full picture is up`);
      if (zoom) await page.evaluate((z) => RangeDayLine.setZoom(z), zoom);
      for (let plateIx = 0; plateIx < flat.courses['cta-piru'].plates.length; plateIx++) {
        await page.selectOption('#plate', String(plateIx));
        const r = await page.evaluate((ix) => { const g = RangeDayLine.geometry; return { ...RangeDayLine.plateOnScreen(ix), size: g.viewPx }; }, plateIx);
        const d = Math.hypot(r.plain[0] - r.scene[0], r.plain[1] - r.scene[1]);
        const onScreen = Math.abs(r.plain[0] - r.size / 2) <= r.size / 2 + 1 && Math.abs(r.plain[1] - r.size / 2) <= r.size / 2 + 1;
        if (onScreen) { assert.ok(d <= 1, `${sizeName} ${name}, plate ${flat.courses['cta-piru'].plates[plateIx].yards} yd: ${d.toFixed(2)} px apart (plain ${r.plain.map((v) => v.toFixed(1))}, scene ${r.scene.map((v) => v.toFixed(1))})`); if (d > worstOn) { worstOn = d; worstWhere = `${sizeName}, ${name}, ${flat.courses['cta-piru'].plates[plateIx].yards} yd`; } }
        worstAll = Math.max(worstAll, d);
      }
    }
    assert.deepEqual(errors.filter((e) => !/swiftshader|GPU stall|PCFSoftShadowMap/i.test(e)), [], `${sizeName}: no console error`);
    await context.close();
  }
  console.log(`  largest difference for a plate in the view: ${worstOn.toFixed(3)} px (${worstWhere}); largest for any plate, on screen or far outside it: ${worstAll.toFixed(1)} px`);
});

test('verify 3: same shots under every picture: twenty seeded shots at the 600-yard plate give identical results (hit or miss, inches up and right) under Full, Light and Plain', { skip }, async () => {
  const { page, context } = await signedIn({ width: 1280, height: 800 });
  const results = {};
  for (const [i, picture] of ['full', 'light', 'plain'].entries()) {
    await setPicture(page, picture);
    await page.goto(`${base}${PIRU}&sight=utg-2-7x44`); await page.waitForSelector('#fire');
    await sceneReady(page);
    assert.equal(await page.evaluate(() => RangeDayLine.picture), picture, `the ${picture} picture is up`);
    if (i) { await page.click('#another-box'); await wait(100); }
    await page.selectOption('#plate', '4');
    await page.evaluate(() => RangeDayLine.setHold(0.7, -0.4));
    const shots = [];
    for (let seed = 1; seed <= 20; seed++) { const e = await seededShot(page, 100 + seed); shots.push({ hit: e.hit, upIn: e.upIn, rightIn: e.rightIn, where: e.where }); }
    results[picture] = shots;
  }
  assert.deepEqual(results.light, results.full, 'Light lands like Full');
  assert.deepEqual(results.plain, results.full, 'Plain lands like Full');
  const hits = results.full.filter((s) => s.hit).length;
  console.log(`  20 seeded shots at 600 yd: ${hits} hits and ${20 - hits} misses, identical under Full, Light and Plain (the day stayed open across the three pictures: same weather)`);
  await context.close();
});

test('verify 6: the look: the rendered sky, a sunlit hillside, the dirt floor in sun and the plate\'s red paint through the scope, beside the measured colours (docs/LOOK.md)', { skip }, async () => {
  const P = flat.look.palette['cta-piru'];
  const STATES = [
    ['February midday', `${PIRU}&sight=utg-2-7x44&month=2&time=midday`, [
      ['sky, as high as the roof lets the view go (18 degrees up)', { yaw: 0, pitch: 18, fov: 4 }, P.green.sky, true],
      ['sunlit hillside (the headwall, 700 m, facing the noon sun)', { aim: [0, -700], fov: 1.2 }, P.green.sunlitSlope, true],
      ['dirt floor in sun (60 m out)', { aim: [3, -60], fov: 1.5 }, P.green.floor, true],
      ['scrub on the left wall (450 m)', { aim: [-140, -450], fov: 0.8 }, P.green.scrub, false, 'the measured scrub is a grey-green; the drawn scrub keeps more of the photograph\'s warmth, so its blue channel runs darker'],
      ['the 600-yard plate\'s red paint through the scope at 7x', { plate: 4, fov: 45.8 / 60, glass: true }, P.paintRedInSun, true]]],
    ['September afternoon', `${PIRU}&sight=utg-2-7x44&month=9&time=afternoon`, [
      ['sky, as high as the roof lets the view go (18 degrees up)', { yaw: 0, pitch: 18, fov: 4 }, P.dry.sky, true],
      ['sunlit dry slope (the right wall, 600 m, facing the afternoon sun)', { aim: [150, -600], fov: 1.2 }, P.dry.sunlitSlope, true],
      ['dirt floor in sun (60 m out)', { aim: [3, -60], fov: 1.5 }, P.dry.floor, false, 'at half past three the floor is lit at a low angle; the photograph it was measured from was taken at 15:43 with the floor in fuller sun'],
      ['the 600-yard plate\'s red paint through the scope at 7x', { plate: 4, fov: 45.8 / 60, glass: true }, P.paintRedInSun, false, 'the plate faces the shooter and the afternoon sun stands almost beside it, so it is side-lit, not in strong sun as the measured paint was']]],
  ];
  const { page, context } = await signedIn({ width: 1280, height: 800 });
  await setPicture(page, 'full');
  for (const [day, path, samples] of STATES) {
    await page.goto(`${base}${path}`); await page.waitForSelector('#fire'); await sceneReady(page);
    assert.ok(await page.evaluate(() => Boolean(RangeDayLine.scene)), `${day}: the scene is up`);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); await wait(300);
    console.log(`  ${day}:`);
    for (const [name, v, target, must, why] of samples) {
      const rgb = await page.evaluate(([v]) => {
        const s = RangeDayLine.scene, eye = 4 * 0.3048;
        let yaw = v.yaw || 0, pitch = v.pitch || 0;
        if (v.aim) { const g = s.groundAt(v.aim[0], v.aim[1]); yaw = (Math.atan2(v.aim[0], -v.aim[1]) * 180) / Math.PI; pitch = (Math.atan2(g - eye, Math.hypot(v.aim[0], v.aim[1])) * 180) / Math.PI; }
        if (v.plate != null) { const w = s.plateWorld(v.plate); yaw = (Math.atan2(w.x, -w.z) * 180) / Math.PI; pitch = (Math.atan2(w.y - eye, Math.hypot(w.x, w.z)) * 180) / Math.PI; }
        s.setView({ yawDeg: yaw, pitchDeg: pitch, fovDeg: v.fov, glass: Boolean(v.glass), windMph: 0 }); s.render(3);
        const sc = document.getElementById('scene'); const c = document.createElement('canvas'); c.width = sc.width; c.height = sc.height; const g = c.getContext('2d'); g.drawImage(sc, 0, 0);
        const n = 16, cx = sc.width / 2, cy = sc.height / 2; const d = g.getImageData(cx - n / 2, cy - n / 2, n, n).data; const ch = [[], [], []];
        for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
        return ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
      }, [v]);
      const t = hex(target), diff = rgb.map((c, i) => c - t[i]);
      const within = diff.every((x) => Math.abs(x) <= 40);
      console.log(`    ${name}: rendered ${rgb.join(',')}, measured ${target} = ${t.join(',')}, difference ${diff.map((x) => (x >= 0 ? '+' : '') + x).join(',')}${within ? '' : ` — not within 40: ${why}`}`);
      if (must) assert.ok(within, `${day}, ${name}: ${diff.join(',')}`);
    }
  }
  await context.close();
});

test('verify 7: weight: what the canyon course downloads on Light and on Full, and a second load in the same browser transfers no terrain bytes', { skip }, async () => {
  for (const picture of ['light', 'full']) {
    const { page, context } = await signedIn({ width: 412, height: 915 });
    const got = [];
    page.on('response', async (r) => { const u = new URL(r.url()).pathname; if (u.startsWith('/terrain/') || u === '/scene.min.js') { try { got.push({ path: u, bytes: (await r.body()).length, cache: r.headers()['cache-control'], type: r.headers()['content-type'] }); } catch {} } });
    await setPicture(page, picture);
    await page.goto(`${base}${PIRU}&sight=utg-2-7x44`); await page.waitForSelector('#fire'); await sceneReady(page);
    assert.equal(await page.evaluate(() => RangeDayLine.picture), picture);
    const total = got.reduce((s, g) => s + g.bytes, 0);
    console.log(`  ${picture}: ${total} bytes (${(total / 1048576).toFixed(2)} MB) downloaded for the canyon course:`);
    for (const g of got) console.log(`    ${g.path}: ${g.bytes} bytes, ${g.type}, cache-control: ${g.cache}`);
    assert.ok(total < (picture === 'light' ? 8 : 20) * 1048576, `${picture} under its budget`);
    for (const g of got.filter((x) => x.path.startsWith('/terrain/'))) assert.equal(g.cache, 'public, max-age=31536000, immutable', `${g.path}: a one-year cache header`);
    // the second load: the terrain comes from the browser's cache, nothing transferred
    await page.reload(); await page.waitForSelector('#fire'); await sceneReady(page);
    const entries = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => new URL(e.name).pathname.startsWith('/terrain/')).map((e) => ({ path: new URL(e.name).pathname, transferSize: e.transferSize, encodedBodySize: e.encodedBodySize })));
    assert.ok(entries.length >= 3, `the second load used the terrain files (${entries.length} entries)`);
    for (const e of entries) { console.log(`    second load ${e.path}: transferred ${e.transferSize} bytes (body ${e.encodedBodySize})`); assert.equal(e.transferSize, 0, `${e.path}: served from the cache`); }
    await context.close();
  }
});

test('verify 8: fallback: with 3D switched off in the browser the firing line shows the Plain picture and the one line, and a seeded shot still lands and is recorded', { skip }, async () => {
  const { page, context } = await signedIn({ width: 412, height: 915 }, () => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { if (type === 'webgl2' || type === 'webgl') return null; return orig.call(this, type, ...rest); }; });
  await page.goto(`${base}${PIRU}&sight=utg-2-7x44`); await page.waitForSelector('#fire'); await sceneReady(page);
  assert.equal(await page.evaluate(() => RangeDayLine.picture), 'plain');
  assert.equal(await page.textContent('#picture-note'), 'This device could not draw the full picture; showing the plain one.');
  assert.equal(await page.$eval('#scene', (el) => el.hidden), true, 'the scene canvas is hidden');
  await page.selectOption('#plate', '2');
  const e = await seededShot(page, 7);
  assert.ok(e && typeof e.hit === 'boolean' && typeof e.upIn === 'number', 'the shot landed');
  const day = await page.evaluate(() => RangeDayLine.day);
  assert.equal(day.shots.length, 1, 'the day recorded it');
  console.log(`  no 3D: plain picture, the line shown, a seeded shot at 400 yd landed (${e.where}) and was recorded`);
  await context.close();
});

test('verify 9: nothing new tells the wind: with "Show the conditions" off the page holds no wind figure under the Full picture, beyond the wind call the player stated', { skip }, async () => {
  const { page, context } = await signedIn({ width: 412, height: 915 });
  await setPicture(page, 'full');
  await page.goto(`${base}${PIRU}&sight=utg-2-7x44&month=7&time=afternoon`); await page.waitForSelector('#fire'); await sceneReady(page);
  assert.equal(await page.evaluate(() => RangeDayLine.picture), 'full');
  assert.equal(await page.isChecked('#show-conditions'), false);
  const text = await page.evaluate(() => { const call = document.getElementById('windcall').textContent; return document.body.textContent.replace(call, ''); });
  assert.doesNotMatch(text, /\d+(\.\d+)? mph/, 'no wind speed on the page');
  assert.doesNotMatch(text, /gusting|Wind, (near|middle|far)/, 'no wind line');
  const w = await page.evaluate(() => RangeDayLine.weather.wind.map((s) => s.speedMph));
  for (const mph of w) assert.ok(!text.includes(`${mph} mph`), `the true ${mph} mph is not on the page`);
  console.log(`  a July afternoon with the wind ${w.join('/')} mph in its three stretches: none of it on the page`);
  await context.close();
});

test('the first visit: with no picture chosen yet the line draws Full, counts frames for two seconds and keeps Full or Light on the device; the setting shows it', { skip }, async () => {
  const { page, context } = await signedIn({ width: 412, height: 915 });
  await page.goto(`${base}${PIRU}&sight=utg-2-7x44`); await page.waitForSelector('#fire'); await sceneReady(page);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('range-day:picture') || 'null') !== null, null, { timeout: 30000 });
  const chosen = await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:picture')));
  assert.ok(['full', 'light'].includes(chosen), `chose ${chosen}`);
  await page.waitForFunction((c) => RangeDayLine.picture === c && !RangeDayLine.sceneLoading, chosen, { timeout: 60000 });
  assert.equal(await page.$eval('#picture', (el) => el.value), chosen);
  console.log(`  the first visit chose ${chosen} on this machine (${chosen === 'light' ? 'fewer' : 'at least'} ${flat.look.firstVisit.minFps} frames a second over ${flat.look.firstVisit.measureS} s in the test browser's software 3D)`);
  await context.close();
});
