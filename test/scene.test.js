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
const E = require('../public/engine.js');

const root = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT) || 8961; // scripts/check.mjs gives each piece of this file its own port
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";

const PIRU = '/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
// range-day-eleven: the Vepr carries the UTG BugBuster 3-9x32 in place of the 2-7x44 the game modeled before. The picture
// measures below that compare with a stored before-file (docs/reports/picture-before.txt, ground-before.txt) or that look for a
// flaw at the old scope's highest power keep the view they were measured at: the old 7x view (14 ft × 2/7 = 4 ft at 100 yards,
// 45.8 minutes of angle across) and the old 21x test view (14 ft × 2/21 = 1.33 ft), reached through the
// page's zoom door on the new scope's own field-of-view rule, as the 21x test view always was. A test view, not a sight in the game.
const VEPR_SCOPE = flat.sights['utg-bugbuster-3-9x32'];
const powerFor = (ftAt100) => { const z = VEPR_SCOPE.zoom, f = VEPR_SCOPE.fovFtAt100, p = Math.log(f.low / f.high) / Math.log(z.high / z.low); return z.low * Math.pow(f.low / ftAt100, 1 / p); };
const OLD7 = powerFor((14 * 2) / 7), OLD21 = powerFor((14 * 2) / 21);
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
// ready: the scene built and its photographed ground surfaces settled (range-day-eight), or the scene failed, or Plain shown
const sceneReady = async (page) => { await page.waitForFunction(() => RangeDayLine.scene || RangeDayLine.sceneFailed || (!RangeDayLine.sceneLoading && RangeDayLine.picture === 'plain'), null, { timeout: 90000 }); await page.waitForFunction(() => !RangeDayLine.scene || !RangeDayLine.scene.materials || RangeDayLine.scene.materials.settled, null, { timeout: 90000 }); };
async function seededShot(page, seed) {
  const before = await page.evaluate(() => RangeDayLine.log.length);
  await page.evaluate((s) => RangeDayLine.fire(s), seed);
  // Waits until the shot has landed (up to 90 s), not a fixed 10 s: on a slow runner a flight under the Full picture took longer,
  // the next shots were refused while three were in the air, and the box never emptied (range-day-nine-b, Checks run 44839550566).
  await page.waitForFunction((b) => RangeDayLine.log.length > b && RangeDayLine.pending === 0, before, { timeout: 90000 });
  const log = await page.evaluate(() => RangeDayLine.log); return log[log.length - 1];
}
// After the frame loop is stopped (requestAnimationFrame replaced), two real frames pass, so the loop's last frame, already
// scheduled, has drawn the state just set. A fixed wait of 300 ms was not always enough on a slow runner: verify 4 read a
// blank view there ("mil-dot spacing NaN/NaN", Checks run 44776316081).
const framesPassed = (page) => page.evaluate(() => new Promise((r) => { const raf = window.__raf || window.requestAnimationFrame.bind(window); raf(() => raf(() => r())); }));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('verify 2: same scale: for every canyon plate at 3x and 9x through the Vepr\'s scope (range-day-eleven: its BugBuster 3-9x32; 2x and 7x before) and at 1x through its irons, the scene puts the plate\'s centre within 1 pixel of the plain drawing, at both sizes', { skip }, async () => {
  let worstOn = 0, worstAll = 0, worstWhere = '';
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    await setPicture(page, 'full');
    for (const [name, path, zoom] of [['scope 3x', `${PIRU}&sight=utg-bugbuster-3-9x32`, 3], ['scope 9x', `${PIRU}&sight=utg-bugbuster-3-9x32`, 9], ['irons 1x', `${PIRU}&sight=vepr-irons`, null]]) {
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
    await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32`); await page.waitForSelector('#fire');
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
    ['February midday', `${PIRU}&sight=utg-bugbuster-3-9x32&month=2&time=midday`, [
      ['sky, as high as the roof lets the view go (18 degrees up)', { yaw: 0, pitch: 18, fov: 4 }, P.green.sky, true],
      ['sunlit hillside (the headwall, 700 m, facing the noon sun; a 50 m patch)', { aim: [0, -700], fov: 4 }, P.green.sunlitSlope, true],
      ['dirt floor in sun (60 m out)', { aim: [3, -60], fov: 6 }, P.green.floor, true],
      ['scrub on the left wall (450 m)', { aim: [-140, -450], fov: 2.5 }, P.green.scrub, false, 'the measured scrub is a grey-green; the drawn scrub keeps more of the photograph\'s warmth, so its blue channel runs darker'],
      ['sunlit brush (the three bushes nearest the line of fire, 250 to 350 m out, each at 0.3 degrees)', { brush: true, fov: 0.3 }, P.green.scrub, false, 'a bush is lit on one side and shaded on the other; the measured scrub colour is a whole hillside\'s'],
      ['the 600-yard plate\'s red paint through the scope at 7x', { plate: 4, fov: 45.8 / 60, glass: true }, P.paintRedInSun, true]]],
    ['September afternoon', `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=afternoon`, [
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
    await page.evaluate(() => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; }); await wait(300); await framesPassed(page);
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
    await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32`); await page.waitForSelector('#fire'); await sceneReady(page);
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
  await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32`); await page.waitForSelector('#fire'); await sceneReady(page);
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
  await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32&month=7&time=afternoon`); await page.waitForSelector('#fire'); await sceneReady(page);
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
  await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32`); await page.waitForSelector('#fire'); await sceneReady(page);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('range-day:picture') || 'null') !== null, null, { timeout: 90000 }); // 90 s, not 30: two seconds of the picture's own clock took longer than 30 on a slow runner (Checks run 44776316081)
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
  await page.evaluate(() => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; }); await wait(300); await framesPassed(page);
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
  // range-day-twelve: the Vepr's front is a ball on a stem; this row, half way down the notch, crosses the stem
  const postMoa = v.frontBead ? v.stemWidthMoa : v.frontPostMoa;
  console.log(`  Vepr irons: drawn notch ${r.notch.toFixed(1)} px (data ${v.notchMoa} MOA × ${r.k.toFixed(3)} px/MOA = ${(v.notchMoa * r.k).toFixed(1)} px), drawn ${v.frontBead ? 'stem' : 'post'} ${r.post.toFixed(1)} px (data ${postMoa} MOA = ${(postMoa * r.k).toFixed(1)} px); threshold ${r.thr} between the notch's lightest ${r.la} and the steel ${r.ls}`);
  assert.ok(Math.abs(r.notch - v.notchMoa * r.k) <= 2.5, `notch ${r.notch.toFixed(1)} vs ${(v.notchMoa * r.k).toFixed(1)}`);
  assert.ok(Math.abs(r.post - postMoa * r.k) <= 1.5, `post ${r.post.toFixed(1)} vs ${(postMoa * r.k).toFixed(1)}`);
  // the Vepr's scope at the old 7x view (a test view since range-day-eleven: at the BugBuster's own 9x the dots are 8 to 14 px apart
  // and drawn 1.2 px in radius, too small for this row's measure; the spacing is dotSpacingMoa × the view's scale at every power)
  await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32`); await page.waitForSelector('#fire'); await sceneReady(page);
  await page.evaluate((z) => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; RangeDayLine.setZoom(z); RangeDayLine.setHold(8, 0); }, OLD7); await wait(300); await framesPassed(page); // range-day-twelve: held 8 MOA over the plate, so the dots (closer at this view since they stand at their true angle) are read against the hillside, not the steel
  r = await page.evaluate(() => {
    const c = document.getElementById('view'), g = c.getContext('2d'), size = RangeDayLine.geometry.viewPx, cx = size / 2, cy = size / 2;
    const lum = (d, x) => 0.299 * d[x * 4] + 0.587 * d[x * 4 + 1] + 0.114 * d[x * 4 + 2];
    const d = g.getImageData(0, cy + 2, size, 1).data; // just under the crosshair: the dots' lower halves
    const dots = []; let start = -1; for (let x = 0; x <= size; x++) { const dark = x < size && lum(d, x) < 70; if (dark && start < 0) start = x; if (!dark && start >= 0) { dots.push((start + x - 1) / 2); start = -1; } }
    const right = dots.filter((x) => x > cx + 2 && x < cx + size * 0.4), left = dots.filter((x) => x < cx - 2 && x > cx - size * 0.4);
    return { k: RangeDayLine.geometry.pxPerMoa, first: right[0] - cx, firstLeft: cx - left[left.length - 1], spacing: right.length > 1 ? right[1] - right[0] : null, milDotPx: RangeDayLine.geometry.milDotPx };
  });
  // range-day-twelve: the dots are true at 10x (second focal plane, the maker's manual), so at this view's power they stand 10 / power milliradians apart
  const ret = S['utg-bugbuster-3-9x32'].reticle, dot = ret.dotSpacingMoa * ret.trueAtPower / OLD7;
  assert.ok(Math.abs(r.milDotPx - dot * r.k) < 1e-6, 'the drawn spacing is the data\'s at this power');
  console.log(`  Vepr scope at the old 7x view (${OLD7.toFixed(1)}x on the BugBuster's rule): first mil-dot ${r.first.toFixed(1)} px right and ${r.firstLeft.toFixed(1)} px left of the centre, the next ${r.spacing && r.spacing.toFixed(1)} px on (data ${dot} MOA × ${r.k.toFixed(3)} = ${(dot * r.k).toFixed(1)} px)`);
  assert.ok(Math.abs(r.first - dot * r.k) <= 1.5 && Math.abs(r.firstLeft - dot * r.k) <= 1.5, `mil-dot spacing ${r.first}/${r.firstLeft} vs ${(dot * r.k).toFixed(1)}`);
  // the Tavor's iron sights (ring and post) on the rifle line: the post's width at the row just under the centre
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=iwi-tavor-sar&sight=fab-flipup&load=imi-m193`); // range-day-twelve: the FAB sights took the Tavor irons' place await page.waitForSelector('#fire'); await sceneReady(page);
  await page.evaluate(() => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; RangeDayLine.setHold(0, 0); }); await wait(300); await framesPassed(page);
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
  console.log(`  Tavor FAB sights: drawn post ${r.post.toFixed(1)} px (data ${S['fab-flipup'].frontPostMoa} MOA × ${r.k.toFixed(3)} = ${(S['fab-flipup'].frontPostMoa * r.k).toFixed(1)} px)`);
  assert.ok(Math.abs(r.post - S['fab-flipup'].frontPostMoa * r.k) <= 1.5, `Tavor post ${r.post.toFixed(1)} vs ${(S['fab-flipup'].frontPostMoa * r.k).toFixed(1)}`);
  // the Tavor's red dot at 300 yards on the rifle line
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193`); await page.waitForSelector('#fire'); await sceneReady(page);
  await page.evaluate(() => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; RangeDayLine.setHold(0, 0); }); await wait(300); await framesPassed(page);
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

test('verify 5 (range-day-six): sharpness through the scope at 7x (since range-day-eleven the old 2-7x44\'s 7x view, 4 ft at 100 yards, as a test view on the BugBuster) on the 600- and 1,000-yard plates, Full, both widths, against docs/reports/picture-before.txt: no state lower than it started (the aim of at least double is printed, met or missed); and the gain is ground, not grain: with the aim moved 2 minutes of angle the same patch of hillside, re-found by its ground position, differs by less than 8 of 255 in median brightness', { skip }, async () => {
  const before = require('node:fs').readFileSync(path.join(root, 'docs', 'reports', 'picture-before.txt'), 'utf8');
  const was = (width, day, state) => { const m = new RegExp(`^${width} px, full, ${day}, ${state}: sharpness ([\\d.]+)`, 'm').exec(before); return m ? Number(m[1]) : null; };
  for (const [width, viewport] of [[412, { width: 412, height: 915 }], [1280, { width: 1280, height: 800 }]]) {
    const { page, context } = await signedIn(viewport);
    await setPicture(page, 'full');
    for (const [day, q] of [['February midday', 'month=2&time=midday'], ['September afternoon', 'month=9&time=afternoon']]) {
      await page.evaluate(() => localStorage.removeItem('range-day:day:open'));
      await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32&${q}`); await page.waitForSelector('#fire'); await sceneReady(page);
      assert.equal(await page.evaluate(() => RangeDayLine.picture), 'full');
      await page.evaluate(() => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; }); await wait(300); await framesPassed(page);
      for (const [name, ix] of [['scope 7x, 600 yd', 4], ['scope 7x, 1000 yd', 8]]) {
        const now = await sharpness(page, ix, OLD7), old = was(width, day, name);
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

// --- range-day-seven -----------------------------------------------------------------------------

// One depth step at a distance z (metres) for the picture's depth buffer: z² × (1/near − 1/far) / (2^bits − 1).
const depthStep = (z, D) => (z * z * (1 / D.cameraNearM - 1 / D.cameraFarM)) / (2 ** D.bits - 1);

// The boards' sheets and posts and the plates and their posts, from the scene's own geometry: for each board the sheet's z
// and its two posts' nearest face; for each plate the back of the plate and its post's nearest face (metres, z toward the
// shooter, so "behind" is smaller z).
const postsBehind = (page) => page.evaluate(() => {
  const s = RangeDayLine.scene, out = { boards: [], plates: [], near: s.camera.near, far: s.camera.far };
  let sheets = null, posts = null;
  s.scene.traverse((o) => { if (o.name === 'boards') sheets = o; if (o.name === 'board-posts') posts = o; });
  const pa = sheets.geometry.attributes.position, pz = [];
  const half = posts.geometry.parameters.depth / 2, a = posts.instanceMatrix.array;
  for (let i = 0; i < posts.count; i++) pz.push({ x: a[i * 16 + 12], z: a[i * 16 + 14] + half });
  for (let b = 0; b < pa.count / 4; b++) {
    const x0 = pa.getX(b * 4), x1 = pa.getX(b * 4 + 1), z = pa.getZ(b * 4), y0 = pa.getY(b * 4), y1 = pa.getY(b * 4 + 2);
    const mine = pz.filter((p) => p.x > Math.min(x0, x1) && p.x < Math.max(x0, x1) && Math.abs(p.z - z) < 1);
    out.boards.push({ x: (x0 + x1) / 2, z, y0, y1, w: Math.abs(x1 - x0), behind: mine.map((p) => z - p.z) });
  }
  s.scene.traverse((o) => { if (/^plate-post-\d+$/.test(o.name)) { const i = Number(o.name.split('-')[2]); let plate = null; s.scene.traverse((q) => { if (q.name === `plate-${i}`) plate = q; }); const back = new (plate.position.constructor)(); plate.getWorldPosition(back); const t = plate.geometry.parameters.depth; out.plates.push({ i, behind: (back.z - t / 2) - (o.position.z + o.geometry.parameters.depth / 2) }); } });
  return out;
});

test('verify 7 (range-day-seven): every board\'s two posts and every plate\'s post stand behind what they hold by at least the data\'s stand-off, which is at least stepsApart depth steps at the farthest row and the farthest plate for the camera\'s own near and far', { skip }, async () => {
  const D = flat.look.depth, T = flat.look.things;
  const { page, context } = await signedIn({ width: 412, height: 915 });
  await setPicture(page, 'full');
  await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32`); await page.waitForSelector('#fire'); await sceneReady(page);
  const g = await postsBehind(page);
  assert.equal(g.near, D.cameraNearM, 'the camera\'s near plane is the data\'s'); assert.equal(g.far, D.cameraFarM, 'the camera\'s far plane is the data\'s');
  const farRowM = Math.max(...T.boardRowsYards) * 0.9144, farPlateM = Math.max(...flat.courses['cta-piru'].plates.map((p) => p.yards)) * 0.9144;
  const stepRow = depthStep(farRowM, D), stepPlate = depthStep(farPlateM, D);
  console.log(`  one depth step (${D.bits} bits, near ${D.cameraNearM} m, far ${D.cameraFarM} m): ${(stepRow * 100).toFixed(2)} cm at the farthest board row (${farRowM.toFixed(1)} m), ${(stepPlate * 100).toFixed(1)} cm at the farthest plate (${farPlateM.toFixed(1)} m); ${D.stepsApart} steps: ${(D.stepsApart * stepRow * 100).toFixed(1)} cm and ${(D.stepsApart * stepPlate * 100).toFixed(1)} cm; the data's stand-offs ${D.boardPostStandOffM * 100} cm and ${D.platePostStandOffM * 100} cm`);
  assert.ok(D.boardPostStandOffM >= D.stepsApart * stepRow, `the boards' stand-off ${D.boardPostStandOffM} is under ${D.stepsApart} steps (${(D.stepsApart * stepRow).toFixed(4)})`);
  assert.ok(D.platePostStandOffM >= D.stepsApart * stepPlate, `the plates' stand-off ${D.platePostStandOffM} is under ${D.stepsApart} steps (${(D.stepsApart * stepPlate).toFixed(4)})`);
  assert.ok(g.boards.length >= 90, `${g.boards.length} boards`);
  let least = Infinity;
  for (const b of g.boards) { assert.equal(b.behind.length, 2, `a board at x ${b.x.toFixed(2)} z ${b.z.toFixed(1)} has ${b.behind.length} posts`); for (const d of b.behind) least = Math.min(least, d); }
  assert.ok(least >= D.boardPostStandOffM - 1e-4, `a board's post's nearest face is ${(least * 100).toFixed(2)} cm behind its sheet, under the data's ${D.boardPostStandOffM * 100} cm`);
  // every steel target the picture holds: the plates and, since range-day-ten, the near steel (the canyon's 100-yard plate); each one's post is held to the stand-off below
  assert.equal(g.plates.length, flat.courses['cta-piru'].plates.length + flat.courses['cta-piru'].near.filter((t) => t.kind === 'steel').length);
  const leastPlate = Math.min(...g.plates.map((p) => p.behind));
  assert.ok(leastPlate >= D.platePostStandOffM - 1e-4, `a plate's post's nearest face is ${(leastPlate * 100).toFixed(2)} cm behind the plate's back, under the data's ${D.platePostStandOffM * 100} cm`);
  console.log(`  ${g.boards.length} boards, each with two posts, the nearest face at least ${(least * 100).toFixed(2)} cm behind its sheet (was 0.5 cm); ${g.plates.length} plates, the post's nearest face at least ${(leastPlate * 100).toFixed(1)} cm behind the plate's back (was 0.14 cm behind its front face, inside the steel)`);
  await context.close();
});

// The share of dark pixels down a column inside each board's face of a row, read off the scene canvas: the column where the
// right post stands (0.35 of the board's width right of its middle), from 30 to 85 percent of the board's height, the
// stretch of the post that lies behind the sheet above the blue number (its top row is 27 percent up) and below the
// post's top (89 percent up); the paper target's rings and holes end short of this column. A post showing through the
// sheet puts dark pixels here. Each frame is drawn twice, with the posts and with them hidden, and a pixel counts only when
// it is dark with the posts and light without them: what the first row's notch hides of a board, or a bullet hole on its
// paper, is the same in both and is not counted.
async function darkInBoards(page, rowYd, frames) {
  return page.evaluate(([rowYd, frames]) => {
    const s = RangeDayLine.scene, eye = 4 * 0.3048;
    let sheets = null, posts = null; s.scene.traverse((o) => { if (o.name === 'boards') sheets = o; if (o.name === 'board-posts') posts = o; });
    const pa = sheets.geometry.attributes.position, boards = [];
    for (let b = 0; b < pa.count / 4; b++) { const z = pa.getZ(b * 4); if (Math.abs(-z - rowYd * 0.9144) < 1) boards.push({ x: (pa.getX(b * 4) + pa.getX(b * 4 + 1)) / 2, w: Math.abs(pa.getX(b * 4 + 1) - pa.getX(b * 4)), y0: pa.getY(b * 4), y1: pa.getY(b * 4 + 2), z }); }
    boards.sort((p, q) => p.x - q.x);
    const mid = boards[Math.floor(boards.length / 2)];
    const yaw0 = (Math.atan2(mid.x, -mid.z) * 180) / Math.PI, pitch0 = (Math.atan2((mid.y0 + mid.y1) / 2 - eye, -mid.z) * 180) / Math.PI;
    const fov = RangeDayLine.fovMoa / 60;
    const sc = document.getElementById('scene'), c = document.createElement('canvas'); c.width = sc.width; c.height = sc.height; const g = c.getContext('2d');
    let dark = 0, all = 0, worst = 0; const perBoard = [];
    const grab = (f, withPosts) => { posts.visible = withPosts; s.render(f * 0.05 + 1); g.drawImage(sc, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    for (let f = 0; f < frames; f++) {
      // the aim wanders a little, as a held rifle does: a fraction of a minute of angle each frame
      s.setView({ yawDeg: yaw0 + 0.4 * Math.sin(f * 1.7) / 60, pitchDeg: pitch0 + 0.3 * Math.cos(f * 2.3) / 60, fovDeg: fov, glass: true, windMph: 0 });
      const withP = grab(f, true), without = grab(f, false), k = c.width / s.size;
      const lum = (d, i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      for (const b of boards) {
        const [sx, syTop] = s.project(b.x + 0.35 * b.w, b.y0 + 0.85 * (b.y1 - b.y0), b.z), [, syBot] = s.project(b.x + 0.35 * b.w, b.y0 + 0.3 * (b.y1 - b.y0), b.z);
        if (sx < 8 || sx > s.size - 8 || syTop < 8 || syBot > s.size - 8) continue;
        let bd = 0, ba = 0;
        for (let y = Math.ceil(syTop * k); y <= Math.floor(syBot * k); y++) { const i = (y * c.width + Math.round(sx * k)) * 4; ba++; if (lum(withP, i) < 110 && lum(without, i) >= 110) bd++; }
        dark += bd; all += ba; if (ba) worst = Math.max(worst, bd / ba); perBoard.push(ba);
      }
    }
    posts.visible = true;
    return { dark, all, worst, boards: perBoard.length / frames, frames, pxPerBoard: perBoard.length ? Math.round(perBoard.reduce((a, b) => a + b, 0) / perBoard.length) : 0 };
  }, [rowYd, frames]);
}

test('verify 8 (range-day-seven): through the Vepr\'s scope at 7x (since range-day-eleven the old scope\'s 7x view as a test view) on each board row (100, 200 and 400 yards), over twelve frames with the aim wandering, on Full and on Light at both sizes, no dark column shows inside a board\'s face where its post stands', { skip }, async () => {
  const bad = [];
  for (const picture of ['full', 'light']) for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context } = await signedIn(viewport);
    await setPicture(page, picture);
    await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=midday`); await page.waitForSelector('#fire'); await sceneReady(page);
    assert.equal(await page.evaluate(() => RangeDayLine.picture), picture);
    await page.evaluate((z) => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; RangeDayLine.setZoom(z); }, OLD7); await wait(300); await framesPassed(page);
    for (const rowYd of flat.look.things.boardRowsYards) {
      const r = await darkInBoards(page, rowYd, 12);
      const share = r.all ? r.dark / r.all : 0;
      console.log(`  ${picture}, ${sizeName}, ${rowYd}-yard row: ${r.boards.toFixed(0)} boards in the view, ${r.pxPerBoard} px read down each post's column, ${r.frames} frames: ${(share * 100).toFixed(2)} percent dark only with the posts (worst board and frame ${(r.worst * 100).toFixed(1)} percent)`);
      if (!(r.all > 0)) bad.push(`${picture}, ${sizeName}, ${rowYd} yd: no board in the view`);
      else if (!(share < 0.02 && r.worst < 0.1)) bad.push(`${picture}, ${sizeName}, ${rowYd} yd: ${(share * 100).toFixed(2)} percent of the pixels down the posts' columns are dark only with the posts drawn (worst ${(r.worst * 100).toFixed(1)} percent): a post shows through a board`);
    }
    await context.close();
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

// --- range-day-eight: the photographed ground ----------------------------------------------------------------------

const GM = require('../scripts/ground-measure.cjs');
const inPage = (body) => `(${body})`;

test('verify 8 (range-day-eight): a material that fails to load: with the floor\'s colour picture answering 404, the scene still draws, the floor is drawn with its plain palette colour (the other five materials loaded), and no console error is thrown but that request\'s', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  const floorFile = `/${flat.terrain.surfaces.floor.light.color.file}`;
  await page.route(`**${floorFile}`, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"not found"}' }));
  await setPicture(page, 'light');
  await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=afternoon`); await page.waitForSelector('#fire'); await sceneReady(page);
  assert.equal(await page.evaluate(() => RangeDayLine.picture), 'light', 'the scene drew');
  const m = await page.evaluate(() => RangeDayLine.scene.materials);
  console.log(`  materials: loaded ${m.loaded.join(', ')}; failed ${m.failed.join('; ')}`);
  assert.deepEqual(m.loaded.slice().sort(), ['dry-grass', 'green-grass', 'rock', 'scree', 'scrub-litter']);
  assert.equal(m.failed.length, 1); assert.match(m.failed[0], /^floor: /);
  await page.selectOption('#plate', '0'); await wait(500);
  const others = errors.filter((e) => !/404|Failed to load resource/.test(e));
  console.log(`  console errors: ${errors.length ? errors.join(' | ') : 'none'}`);
  assert.deepEqual(others, [], 'no error but the failed request\'s');
  await context.close();
});

test('verify 5 (range-day-eight): no visible repeat: on the floor and on a hillside at 7x (the old scope\'s 7x view, a test view since range-day-eleven) the picture matches itself shifted by one material width hardly more than at other shifts, as laid; laid in a plain grid it matches clearly more (the measure fails a plain grid); both copies of each material, each at its own width', { skip }, async () => {
  const { page, context } = await signedIn({ width: 1280, height: 800 });
  await setPicture(page, 'full');
  for (const [day, q, grass] of [['February midday', 'month=2&time=midday', 'green-grass'], ['September afternoon', 'month=9&time=afternoon', 'dry-grass']]) {
    await page.evaluate(() => localStorage.removeItem('range-day:day:open'));
    await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32&${q}`); await page.waitForSelector('#fire'); await sceneReady(page);
    await page.evaluate((z) => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; window.RD_SCENE_DEBUG = 'noshimmer'; RangeDayLine.setZoom(z); }, OLD7); await wait(300); await framesPassed(page);
    const fov7 = await page.evaluate(() => RangeDayLine.fovMoa / 60);
    const beside = await page.evaluate(() => { const w = RangeDayLine.scene.plateWorld(4); return [w.x + 20, w.z]; });
    // each material is laid twice, at its own size and at macroScale times it: each copy is slid by its own width while the other stays put (sliding both at once, the one not at its own width diluted the plain grid's match: 0.29 and 0.45 on the runner)
    const M = flat.look.ground.materials, K = flat.look.ground.macroScale;
    for (const [name, aimAt, fov, sizeM, big] of [['the floor, 40 m out at 1x', [2, -40], 6.68, M.floor.sizeM, false], ['the floor, 40 m out at 1x, the larger copy', [2, -40], 6.68, M.floor.sizeM * K, true], ['the hillside beside the 600-yard plate at 7x', beside, fov7, M[grass].sizeM, false], ['the hillside beside the 600-yard plate at 7x, the larger copy', beside, fov7, M[grass].sizeM * K, true]]) {
      const r = {};
      for (const plain of [true, false]) r[plain ? 'plain' : 'laid'] = await page.evaluate(([src, P, f, size, pl, bg]) => { const repeat = eval(src); const s = RangeDayLine.scene; s.setPlainGrid(pl); const out = repeat(P, size, f, f < 3, bg); s.setPlainGrid(false); return out; }, [inPage(GM.repeat.toString()), aimAt, fov, sizeM, plain, big]);
      // the share of the material's own fine texture that comes back at one width: the boards, the light and the survey's relief do not slide with the materials and match at every step, so the score is the rise at one width over what the other steps leave
      const score = (x) => (x.at1 - x.others) / Math.max(1e-6, 1 - x.others);
      console.log(`  ${day}, ${name}: plain grid ${score(r.plain).toFixed(3)} (${r.plain.at1.toFixed(3)} at one width, ${r.plain.others.toFixed(3)} elsewhere); as laid ${score(r.laid).toFixed(3)} (${r.laid.at1.toFixed(3)}, ${r.laid.others.toFixed(3)})`);
      assert.ok(score(r.plain) > 0.5, `${day}, ${name}: the measure sees the plain grid's repeat (${score(r.plain).toFixed(3)})`);
      assert.ok(score(r.laid) < 0.5 * score(r.plain), `${day}, ${name}: as laid, the repeat is under half the plain grid's (${score(r.laid).toFixed(3)} against ${score(r.plain).toFixed(3)})`);
    }
  }
  await context.close();
});

test('verify 6 (range-day-eight): detail on the ground: the local contrast on the floor at 1x and on a hillside at 7x and at 21x (the old scope\'s views, test views since range-day-eleven), Full and Light, both days, at both widths, against docs/reports/ground-before.txt: none lower than before', { skip }, async () => {
  const before = require('node:fs').readFileSync(path.join(root, 'docs', 'reports', 'ground-before.txt'), 'utf8');
  const was = (width, picture, day, name) => { const m = new RegExp(`^${width} px, ${picture}, ${day}, detail ${name.replace(/[()']/g, '.')}: local contrast ([\\d.]+)`, 'm').exec(before); return m ? Number(m[1]) : null; };
  for (const [width, viewport] of [[412, { width: 412, height: 915 }], [1280, { width: 1280, height: 800 }]]) for (const picture of ['full', 'light']) {
    const { page, context } = await signedIn(viewport);
    await setPicture(page, picture);
    for (const [day, q] of [['February midday', 'month=2&time=midday'], ['September afternoon', 'month=9&time=afternoon']]) {
      await page.evaluate(() => localStorage.removeItem('range-day:day:open'));
      await page.goto(`${base}${PIRU}&sight=utg-bugbuster-3-9x32&${q}`); await page.waitForSelector('#fire'); await sceneReady(page);
      await page.evaluate(() => { window.__raf = window.__raf || window.requestAnimationFrame.bind(window); window.requestAnimationFrame = () => 0; window.RD_SCENE_DEBUG = 'noshimmer'; }); await wait(300); await framesPassed(page);
      const fovAt = (z) => page.evaluate((m) => { RangeDayLine.setZoom(m); return RangeDayLine.fovMoa / 60; }, z);
      const fov7 = await fovAt(OLD7), fov21 = await fovAt(OLD21);
      assert.ok(Math.abs(fov7 * 60 - (4 * 12) / E.inchesPerMoa(100)) < 1e-6 && Math.abs(fov21 * 60 - ((28 / 21) * 12) / E.inchesPerMoa(100)) < 1e-6, `the old views: ${fov7 * 60} and ${fov21 * 60} MOA`);
      const beside = await page.evaluate(() => { const w = RangeDayLine.scene.plateWorld(4); return [w.x + 20, w.z]; });
      for (const [name, P, fov] of [['floor at 1x, 25 m out (the irons\' field)', [2, -25], 6.68], ['hillside 20 m right of the 600-yard plate at 7x', beside, fov7], ['the same hillside at 21x (the test view)', beside, fov21]]) {
        const now = await page.evaluate(([src, P, f]) => { const contrast = eval(src); const s = RangeDayLine.scene, eye = 4 * 0.3048, g = s.groundAt(P[0], P[1]); s.setView({ yawDeg: (Math.atan2(P[0], -P[1]) * 180) / Math.PI, pitchDeg: (Math.atan2(g - eye, -P[1]) * 180) / Math.PI, fovDeg: f, glass: f < 3, windMph: 0 }); s.render(3); return contrast(); }, [inPage(GM.contrast.toString()), P, fov]);
        const old = was(width, picture, day, name);
        console.log(`  ${width} px, ${picture}, ${day}, ${name}: local contrast ${now.toFixed(2)}, was ${old === null ? 'unmeasured' : old.toFixed(2)}`);
        assert.notEqual(old, null, `${name}: measured before`);
        assert.ok(now >= old, `${width} px, ${picture}, ${day}, ${name}: ${now.toFixed(2)} is lower than before (${old.toFixed(2)})`);
      }
    }
    await context.close();
  }
});
