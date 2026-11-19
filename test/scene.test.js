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
const PORT = Number(process.env.TEST_PORT) || 8961; // scripts/check.mjs gives each piece of this file its own port
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
      ['sunlit hillside (the headwall, 700 m, facing the noon sun; a 50 m patch)', { aim: [0, -700], fov: 4 }, P.green.sunlitSlope, true],
      ['dirt floor in sun (60 m out)', { aim: [3, -60], fov: 6 }, P.green.floor, true],
      ['scrub on the left wall (450 m)', { aim: [-140, -450], fov: 2.5 }, P.green.scrub, false, 'the measured scrub is a grey-green; the drawn scrub keeps more of the photograph\'s warmth, so its blue channel runs darker'],
      ['sunlit brush (the three bushes nearest the line of fire, 250 to 350 m out, each at 0.3 degrees)', { brush: true, fov: 0.3 }, P.green.scrub, false, 'a bush is lit on one side and shaded on the other; the measured scrub colour is a whole hillside\'s'],
      ['the 600-yard plate\'s red paint through the scope at 7x', { plate: 4, fov: 45.8 / 60, glass: true }, P.paintRedInSun, true]]],
    ['September afternoon', `${PIRU}&sight=utg-2-7x44&month=9&time=afternoon`, [
      ['sky, as high as the roof lets the view go (18 degrees up)', { yaw: 0, pitch: 18, fov: 4 }, P.dry.sky, true],
      ['sunlit dry slope (the right wall, 600 m, facing the afternoon sun; a 40 m patch)', { aim: [150, -600], fov: 4 }, P.dry.sunlitSlope, true],
      ['dirt floor in sun (60 m out)', { aim: [3, -60], fov: 6 }, P.dry.floor, false, 'at half past three the floor is lit at a low angle; the photograph it was measured from was taken at 15:43 with the floor in fuller sun'],
      ['scrub on the left wall (450 m)', { aim: [-140, -450], fov: 2.5 }, P.dry.scrub, false, 'the dry scrub colour is an estimate, not a measurement; the left wall is in the afternoon sun\'s shade'],
      ['sunlit brush (the three bushes nearest the line of fire, 250 to 350 m out, each at 0.3 degrees)', { brush: true, fov: 0.3 }, P.dry.scrub, false, 'a bush is lit on one side and shaded on the other; the dry scrub colour is itself an estimate'],
      ['the 600-yard plate\'s red paint through the scope at 7x', { plate: 4, fov: 45.8 / 60, glass: true }, P.paintRedInSun, false, 'the plate faces the shooter and the afternoon sun stands almost beside it, so it is side-lit, not in strong sun as the measured paint was']]],
  ];
  const { page, context } = await signedIn({ width: 1280, height: 800 });
  await setPicture(page, 'full');
  for (const [day, path, samples] of STATES) {
    await page.evaluate(() => localStorage.removeItem('range-day:day:open')); // a new day for the new month and time (a day with no shot stays open otherwise)
    await page.goto(`${base}${path}`); await page.waitForSelector('#fire'); await sceneReady(page);
    assert.ok(await page.evaluate(() => Boolean(RangeDayLine.scene)), `${day}: the scene is up`);
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); await wait(300);
    console.log(`  ${day}:`);
    for (const [name, v, target, must, why] of samples) {
      const rgb = await page.evaluate(([v]) => {
        const s = RangeDayLine.scene, eye = 4 * 0.3048;
        const median = (g, cx, cy, n) => { const d = g.getImageData(Math.round(cx - n / 2), Math.round(cy - n / 2), n, n).data; const ch = [[], [], []]; for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); } return ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]); };
        const read = () => { const sc = document.getElementById('scene'); const c = document.createElement('canvas'); c.width = sc.width; c.height = sc.height; const g = c.getContext('2d'); g.drawImage(sc, 0, 0); return { g, w: sc.width, h: sc.height }; };
        const aimAt = (yaw, pitch, fov, glass) => { s.setView({ yawDeg: yaw, pitchDeg: pitch, fovDeg: fov, glass: Boolean(glass), windMph: 0 }); s.render(3); };
        if (v.brush) {
          // the bushes: the instanced meshes of the scene, their instances' places; the three nearest the line of fire between 250 and 350 m
          const spots = [];
          s.scene.traverse((o) => { if (o.isInstancedMesh && /^brush-(sage|chamise)/.test(o.name)) { const a = o.instanceMatrix.array; for (let i = 0; i < o.count; i++) { const x = a[i * 16 + 12], y = a[i * 16 + 13], z = a[i * 16 + 14], sy = Math.hypot(a[i * 16 + 4], a[i * 16 + 5], a[i * 16 + 6]); const d = Math.hypot(x, z); if (d > 250 && d < 350 && Math.abs(x) < 120) spots.push([x, y + sy * 0.45, z, Math.abs(x)]); } } });
          spots.sort((p, q) => p[3] - q[3]);
          const all = [[], [], []];
          for (const w of spots.slice(0, 3)) { aimAt((Math.atan2(w[0], -w[2]) * 180) / Math.PI, (Math.atan2(w[1] - eye, -w[2]) * 180) / Math.PI, v.fov, false); const { g, w: W, h: H } = read(); median(g, W / 2, H / 2, Math.round(W * 0.25)).forEach((c, i) => all[i].push(c)); }
          return spots.length ? all.map((a) => a.sort((x, y) => x - y)[a.length >> 1]) : null;
        }
        let yaw = v.yaw || 0, pitch = v.pitch || 0;
        if (v.aim) { const g = s.groundAt(v.aim[0], v.aim[1]); yaw = (Math.atan2(v.aim[0], -v.aim[1]) * 180) / Math.PI; pitch = (Math.atan2(g - eye, -v.aim[1]) * 180) / Math.PI; }
        if (v.plate != null) { const w = s.plateWorld(v.plate); yaw = (Math.atan2(w.x, -w.z) * 180) / Math.PI; pitch = (Math.atan2(w.y - eye, -w.z) * 180) / Math.PI; }
        aimAt(yaw, pitch, v.fov, v.glass);
        const { g, w, h } = read();
        return median(g, w / 2, h / 2, v.plate != null ? 10 : Math.round(w * 0.25));
      }, [v]);
      if (!rgb) { console.log(`    ${name}: no bush found`); continue; }
      const t = hex(target), diff = rgb.map((c, i) => c - t[i]);
      const within = diff.every((x) => Math.abs(x) <= 40);
      console.log(`    ${name}: rendered ${rgb.join(',')}, measured ${target} = ${t.join(',')}, difference ${diff.map((x) => (x >= 0 ? '+' : '') + x).join(',')}${within ? '' : ` — not within 40: ${why}`}`);
      if (must) assert.ok(within, `${day}, ${name}: ${diff.join(',')}`);
      if (v.brush) { const lum = (c) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]; assert.ok(lum(rgb) >= lum(t) / 2, `${day}, ${name}: brightness ${lum(rgb).toFixed(0)} is under half the measured scrub's ${lum(t).toFixed(0)}`); }
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

// --- range-day-six -------------------------------------------------------------------------------

// A sight's drawn widths, in pixels, read off the sight's own canvas at the centre row: the dark runs (steel) against the light picture under them.
async function drawnWidths(page) {
  return page.evaluate(() => {
    const c = document.getElementById('view'), g = c.getContext('2d'), size = RangeDayLine.geometry.viewPx, cx = size / 2, cy = size / 2;
    const row = (y) => { const d = g.getImageData(0, Math.round(y), size, 1).data; const out = []; for (let x = 0; x < size; x++) out.push({ l: 0.299 * d[x * 4] + 0.587 * d[x * 4 + 1] + 0.114 * d[x * 4 + 2], r: d[x * 4], g: d[x * 4 + 1], b: d[x * 4 + 2] }); return out; };
    // runs of dark pixels along a row, by a threshold halfway between the picture above the blade and the steel
    const runs = (y, thr) => { const r = row(y); const out = []; let start = -1; for (let x = 0; x <= size; x++) { const dark = x < size && r[x].l < thr; if (dark && start < 0) start = x; if (!dark && start >= 0) { out.push([start, x]); start = -1; } } return out; };
    return { size, pxPerMoa: RangeDayLine.geometry.pxPerMoa, row, runs: (y, thr) => runs(y, thr), lightAbove: row(cy - 30).reduce((s, p) => s + p.l, 0) / size, steel: row(size - 4).slice(2, 12).reduce((s, p) => s + p.l, 0) / 10 };
  });
}

test('verify 4 (range-day-six): the sights\' angles are unchanged: for the Vepr\'s irons and scope and the Tavor\'s red dot, the drawn notch, post, reticle spacing and dot in pixels equal the data\'s minutes of angle times the view\'s pixels per minute, within 1.5 px (the blurred notch within 2.5)', { skip }, async () => {
  const { page, context } = await signedIn({ width: 1280, height: 800 });
  await setPicture(page, 'plain'); // the plain drawing under the sight: a light picture to read the dark steel against
  const S = flat.sights;
  // the Vepr's iron sights: notch and post
  await page.goto(`${base}${PIRU}&sight=vepr-irons`); await page.waitForSelector('#fire'); await sceneReady(page);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); await wait(300);
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  let r = await page.evaluate(() => {
    const c = document.getElementById('view'), g = c.getContext('2d'), size = RangeDayLine.geometry.viewPx, cx = size / 2, cy = size / 2;
    const lum = (d, x) => 0.299 * d[x * 4] + 0.587 * d[x * 4 + 1] + 0.114 * d[x * 4 + 2];
    const above = g.getImageData(0, cy - 40, size, 1).data, steel = g.getImageData(4, size - 6, 10, 1).data;
    let la = 0; for (let x = 0; x < size; x++) la += lum(above, x) / size; let ls = 0; for (let x = 0; x < 10; x++) ls += lum(steel, x) / 10;
    const thr = (la + ls) / 2;
    // the row halfway down the notch (clear of the blade's blurred top edge); the threshold halfway between the notch's lightest pixel and the steel
    const depth = RangeDayLine.geometry.notchDepthPx || 0;
    const d = g.getImageData(0, Math.round(cy + depth * 0.5), size, 1).data;
    let lightest = 0; for (let x = cx - 40; x < cx + 40; x++) lightest = Math.max(lightest, lum(d, x));
    let steelRow = 0; for (let x = 10; x < 30; x++) steelRow += lum(d, x) / 20; // the blade's face on this same row, well away from the notch (its sheen varies down the blade)
    const thr2 = (lightest + steelRow) / 2;
    const L = []; for (let x = 0; x < size; x++) L.push(lum(d, x));
    // from the centre outward: the post (dark), the notch's light gap, the blade (dark); each edge where the brightness crosses the threshold, to a fraction of a pixel
    const cross = (from, step, wantDark) => { let x = from; while (x > 0 && x < size - 1 && (L[x] < thr2) !== wantDark) x += step; const a = L[x - step], b = L[x]; return x - step + step * ((thr2 - a) / (b - a)); };
    const postRight = cross(cx, 1, false), notchRight = cross(Math.ceil(postRight) + 1, 1, true);
    const postLeft = cross(cx, -1, false), notchLeft = cross(Math.floor(postLeft) - 1, -1, true);
    return { k: RangeDayLine.geometry.pxPerMoa, post: postRight - postLeft, notch: notchRight - notchLeft, thr: thr2.toFixed(0), la: lightest.toFixed(0), ls: steelRow.toFixed(0) };
  });
  const v = S['vepr-irons'];
  console.log(`  Vepr irons: drawn notch ${r.notch.toFixed(1)} px (data ${v.notchMoa} MOA × ${r.k.toFixed(3)} px/MOA = ${(v.notchMoa * r.k).toFixed(1)} px), drawn post ${r.post.toFixed(1)} px (data ${v.frontPostMoa} MOA = ${(v.frontPostMoa * r.k).toFixed(1)} px); threshold ${r.thr} between the notch's lightest ${r.la} and the steel ${r.ls}`);
  assert.ok(Math.abs(r.notch - v.notchMoa * r.k) <= 2.5, `notch ${r.notch.toFixed(1)} vs ${(v.notchMoa * r.k).toFixed(1)}`);
  assert.ok(Math.abs(r.post - v.frontPostMoa * r.k) <= 1.5, `post ${r.post.toFixed(1)} vs ${(v.frontPostMoa * r.k).toFixed(1)}`);
  // the Vepr's scope at 7x: the mil-dot reticle's dot spacing
  await page.goto(`${base}${PIRU}&sight=utg-2-7x44`); await page.waitForSelector('#fire'); await sceneReady(page);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; RangeDayLine.setZoom(7); RangeDayLine.setHold(0, 0); }); await wait(300);
  r = await page.evaluate(() => {
    const c = document.getElementById('view'), g = c.getContext('2d'), size = RangeDayLine.geometry.viewPx, cx = size / 2, cy = size / 2;
    const lum = (d, x) => 0.299 * d[x * 4] + 0.587 * d[x * 4 + 1] + 0.114 * d[x * 4 + 2];
    const d = g.getImageData(0, cy + 2, size, 1).data; // just under the crosshair: the dots' lower halves
    const dots = []; let start = -1; for (let x = 0; x <= size; x++) { const dark = x < size && lum(d, x) < 70; if (dark && start < 0) start = x; if (!dark && start >= 0) { dots.push((start + x - 1) / 2); start = -1; } }
    const right = dots.filter((x) => x > cx + 2 && x < cx + size * 0.4), left = dots.filter((x) => x < cx - 2 && x > cx - size * 0.4);
    return { k: RangeDayLine.geometry.pxPerMoa, first: right[0] - cx, firstLeft: cx - left[left.length - 1], spacing: right.length > 1 ? right[1] - right[0] : null };
  });
  const dot = S['utg-2-7x44'].reticle.dotSpacingMoa;
  console.log(`  Vepr scope at 7x: first mil-dot ${r.first.toFixed(1)} px right and ${r.firstLeft.toFixed(1)} px left of the centre, the next ${r.spacing && r.spacing.toFixed(1)} px on (data ${dot} MOA × ${r.k.toFixed(3)} = ${(dot * r.k).toFixed(1)} px)`);
  assert.ok(Math.abs(r.first - dot * r.k) <= 1.5 && Math.abs(r.firstLeft - dot * r.k) <= 1.5, `mil-dot spacing ${r.first}/${r.firstLeft} vs ${(dot * r.k).toFixed(1)}`);
  // the Tavor's iron sights (ring and post) on the rifle line: the post's width at the row just under the centre
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=iwi-tavor-sar&sight=tavor-irons&load=imi-m193`); await page.waitForSelector('#fire'); await sceneReady(page);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; RangeDayLine.setHold(0, 0); }); await wait(300);
  r = await page.evaluate(() => {
    const c = document.getElementById('view'), g = c.getContext('2d'), size = RangeDayLine.geometry.viewPx, cx = size / 2, cy = size / 2;
    const lum = (d, x) => 0.299 * d[x * 4] + 0.587 * d[x * 4 + 1] + 0.114 * d[x * 4 + 2];
    const d = g.getImageData(0, cy + 8, size, 1).data; const L = []; for (let x = 0; x < size; x++) L.push(lum(d, x));
    const lightest = (L[Math.round(cx - 30)] + L[Math.round(cx + 30)]) / 2; // the ground beside the post on this row
    let steel = 1e9; for (let x = cx - 8; x < cx + 8; x++) steel = Math.min(steel, L[x]);
    const thr = (lightest + steel) / 2;
    const cross = (from, step) => { let x = from; while (x > 0 && x < size - 1 && L[x] < thr) x += step; const a = L[x - step], b = L[x]; return x - step + step * ((thr - a) / (b - a)); };
    return { k: RangeDayLine.geometry.pxPerMoa, post: cross(cx, 1) - cross(cx, -1) };
  });
  console.log(`  Tavor irons: drawn post ${r.post.toFixed(1)} px (data ${S['tavor-irons'].frontPostMoa} MOA × ${r.k.toFixed(3)} = ${(S['tavor-irons'].frontPostMoa * r.k).toFixed(1)} px)`);
  assert.ok(Math.abs(r.post - S['tavor-irons'].frontPostMoa * r.k) <= 1.5, `Tavor post ${r.post.toFixed(1)} vs ${(S['tavor-irons'].frontPostMoa * r.k).toFixed(1)}`);
  // the Tavor's red dot at 300 yards on the rifle line
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193`); await page.waitForSelector('#fire'); await sceneReady(page);
  await page.evaluate(() => { window.requestAnimationFrame = () => 0; RangeDayLine.setHold(0, 0); }); await wait(300);
  r = await page.evaluate(() => {
    const c = document.getElementById('view'), g = c.getContext('2d'), size = RangeDayLine.geometry.viewPx, cx = size / 2, cy = size / 2;
    const d = g.getImageData(0, cy, size, 1).data;
    let l = cx, rr = cx; const red = (x) => d[x * 4] > 200 && d[x * 4 + 1] < 110 && d[x * 4 + 2] < 110;
    while (l > 0 && red(l - 1)) l--; while (rr < size - 1 && red(rr + 1)) rr++;
    return { k: RangeDayLine.geometry.pxPerMoa, dot: rr - l + 1, dotPx: RangeDayLine.geometry.dotPx };
  });
  console.log(`  Tavor red dot: drawn ${r.dot} px across (data ${S['pa-md25'].dotMoa} MOA × ${r.k.toFixed(3)} = ${r.dotPx.toFixed(1)} px; the dot's thin bloom adds up to 2.4 px)`);
  assert.ok(r.dot >= r.dotPx - 1.5 && r.dot <= r.dotPx + 3, `dot ${r.dot} vs ${r.dotPx.toFixed(1)}`);
  await context.close();
});

// Sharpness: the mean absolute difference in brightness between neighbouring pixels over the middle 40 percent of the scene canvas, the same figure scripts/picture-measure.mjs prints.
async function sharpness(page, plateIx, zoom) {
  await page.selectOption('#plate', String(plateIx));
  await page.evaluate((z) => RangeDayLine.setZoom(z), zoom);
  return page.evaluate(() => {
    const s = RangeDayLine.scene, eye = 4 * 0.3048, w = s.plateWorld(Number(document.getElementById('plate').value));
    s.setView({ yawDeg: (Math.atan2(w.x, -w.z) * 180) / Math.PI, pitchDeg: (Math.atan2(w.y - eye, -w.z) * 180) / Math.PI, fovDeg: RangeDayLine.fovMoa / 60, glass: true, windMph: 0 }); s.render(3);
    const sc = document.getElementById('scene'); const c = document.createElement('canvas'); c.width = sc.width; c.height = sc.height; const g = c.getContext('2d'); g.drawImage(sc, 0, 0);
    const x0 = Math.round(sc.width * 0.3), y0 = Math.round(sc.height * 0.3), n = Math.round(sc.width * 0.4), m = Math.round(sc.height * 0.4);
    const d = g.getImageData(x0, y0, n, m).data; const L = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    let sum = 0, cnt = 0;
    for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) { const i = (y * n + x) * 4; if (x + 1 < n) { sum += Math.abs(L(i) - L(i + 4)); cnt++; } if (y + 1 < m) { sum += Math.abs(L(i) - L(i + n * 4)); cnt++; } }
    return sum / cnt;
  });
}

test('verify 5 (range-day-six): sharpness through the scope at 7x on the 600- and 1,000-yard plates, Full, both widths, against docs/reports/picture-before.txt: no state lower than it started (the aim of at least double is printed, met or missed); and the gain is ground, not grain: with the aim moved 2 minutes of angle the same patch of hillside, re-found by its ground position, differs by less than 8 of 255 in median brightness', { skip }, async () => {
  const before = require('node:fs').readFileSync(path.join(root, 'docs', 'reports', 'picture-before.txt'), 'utf8');
  const was = (width, day, state) => { const m = new RegExp(`^${width} px, full, ${day}, ${state}: sharpness ([\\d.]+)`, 'm').exec(before); return m ? Number(m[1]) : null; };
  for (const [width, viewport] of [[412, { width: 412, height: 915 }], [1280, { width: 1280, height: 800 }]]) {
    const { page, context } = await signedIn(viewport);
    await setPicture(page, 'full');
    for (const [day, q] of [['February midday', 'month=2&time=midday'], ['September afternoon', 'month=9&time=afternoon']]) {
      await page.evaluate(() => localStorage.removeItem('range-day:day:open'));
      await page.goto(`${base}${PIRU}&sight=utg-2-7x44&${q}`); await page.waitForSelector('#fire'); await sceneReady(page);
      assert.equal(await page.evaluate(() => RangeDayLine.picture), 'full');
      await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); await wait(300);
      for (const [name, ix] of [['scope 7x, 600 yd', 4], ['scope 7x, 1000 yd', 8]]) {
        const now = await sharpness(page, ix, 7), old = was(width, day, name);
        console.log(`  ${width} px, ${day}, ${name}: sharpness ${now.toFixed(2)}, was ${old === null ? 'unmeasured' : old.toFixed(2)}${old === null ? '' : now >= 2 * old ? ' (at least double: the aim met)' : ` (${(now / old).toFixed(2)} times: the aim of double missed)`}`);
        if (old !== null) assert.ok(now >= old, `${width} px, ${day}, ${name}: ${now.toFixed(2)} is lower than it started (${old.toFixed(2)})`);
      }
      // ground, not grain: the hillside patch under the 1,000-yard plate's view, then the aim moved 2 MOA right and the same patch re-found 2 MOA left of the centre
      const r = await page.evaluate(() => {
        const s = RangeDayLine.scene, eye = 4 * 0.3048, w = s.plateWorld(8);
        const yaw = (Math.atan2(w.x, -w.z) * 180) / Math.PI, pitch = (Math.atan2(w.y - eye, -w.z) * 180) / Math.PI - 0.15, fov = RangeDayLine.fovMoa / 60;
        const sc = document.getElementById('scene'), k = sc.width / (fov * 60);
        const median = (dx) => { s.setView({ yawDeg: yaw + dx / 60, pitchDeg: pitch, fovDeg: fov, glass: false, windMph: 0 }); s.render(3); const c = document.createElement('canvas'); c.width = sc.width; c.height = sc.height; const g = c.getContext('2d'); g.drawImage(sc, 0, 0); const n = 20, d = g.getImageData(Math.round(sc.width / 2 - dx * k - n / 2), Math.round(sc.height / 2 - n / 2), n, n).data; const a = []; for (let i = 0; i < d.length; i += 4) a.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]); return a.sort((x, y) => x - y)[a.length >> 1]; };
        const a = median(0), b = median(2);
        return { a, b, k };
      });
      console.log(`  ${width} px, ${day}: the hillside patch below the 1,000-yard plate: median brightness ${r.a.toFixed(1)} at the centre, ${r.b.toFixed(1)} re-found ${(2 * r.k).toFixed(0)} px left after moving the aim 2 MOA right (difference ${Math.abs(r.a - r.b).toFixed(1)})`);
      assert.ok(Math.abs(r.a - r.b) < 8, `${width} px, ${day}: the patch moved by ${Math.abs(r.a - r.b).toFixed(1)}`);
    }
    await context.close();
  }
});
