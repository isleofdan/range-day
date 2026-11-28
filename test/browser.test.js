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
  await noDay(page);
  return { page, context, errors };
}
// Closes any day left open by an earlier test, so a screen opens on the choice its address makes (an open day with shots wins over the address).
// Closes any day left open by an earlier test, and opens the plain picture: these tests are about the bench, the line's
// figures and the records, which are the same under every picture (test/scene.test.js proves that and the picture itself);
// the test browser draws 3D in software, which would only slow them.
const noDay = (page) => page.evaluate(() => { try { localStorage.removeItem('range-day:day:open'); localStorage.removeItem('range-day:day:packed'); localStorage.setItem('range-day:picture', JSON.stringify('plain')); } catch {} });
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
  // Walk the group onto the center: the readout says where it is, the clicks are 0.25 MOA. Three groups of five
  // and a final five: the whole box of 20 of the zeroing supply (the bench's own rounds; the day's box is for the steel).
  for (let round = 0; round < 3; round++) {
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
  // range-day-thirteen: with the zeroing supply empty, Open another box stands where Fire stands, so Fire is in the page but not seen
  await page.reload(); await page.waitForSelector('#fire5', { state: 'attached' }); await page.waitForFunction(() => window.RangeDayZero);
  assert.equal(await page.textContent('#el-text'), el, 'the sight setting survives a reload');
  assert.match(await page.textContent('#saved'), /Saved zero for Sellier & Bellot 174 gr.*100 yards/);
  await noDay(page); // home shows the picks and the zero line when no day is open (the day stays open now that the box does not end it)
  await page.goto(`${base}/?rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('.rifle');
  assert.match(await page.textContent('#zero'), /Zeroed at 100 yards/);
  // Change the load (a day is one load, so the other load is a new day from home): the sight stays, and each group lands where the engine puts its load in its day's air.
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire5', { state: 'attached' }); await page.waitForFunction(() => window.RangeDayZero);
  assert.equal(await page.textContent('#el-text'), el, 'changing nothing keeps the sight');
  assert.match(await page.textContent('#intro'), /Sellier & Bellot 174 gr/, 'the load is the day\'s: named, not chosen, while the day is open');
  assert.equal(await page.$('#load'), null, 'no load select on the bench: one box, one load');
  await page.selectOption('#distance', '200');
  await page.click('#another-box'); // the supply's first box went on the zero; the bench stays and another box is opened
  assert.match(await page.textContent('#rounds'), /zeroing supply: 20 of 20 left \(box 2\)/);
  await page.click('#fresh'); await page.click('#fire5');
  const same = await groupCenter(page);
  const day1 = await page.evaluate(() => RangeDayZero.day.weather);
  await noDay(page);
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=wolf-203-sp`); await page.waitForSelector('#fire5');
  assert.equal(await page.textContent('#el-text'), el, 'the other load, a new day: the sight is where it was left');
  await page.selectOption('#distance', '200');
  await page.click('#fresh'); await page.click('#fire5');
  const other = await groupCenter(page);
  const day2 = await page.evaluate(() => RangeDayZero.day.weather);
  // The engine's own figure for the difference, with the same sight, each load in its own day's air, no spread.
  const setting = await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:sight:molot-vepr-54r:utg-bugbuster-3-9x32')));
  const rifle = flat.rifles['molot-vepr-54r'], sight = flat.sights['utg-bugbuster-3-9x32'];
  const common = { drag: flat.physics.dragTables, powder: flat.physics.powderTemperature, sightHeightIn: rifle.sightHeightIn['utg-bugbuster-3-9x32'], elevationMoa: setting.elevationClicks * sight.clickMoa + rifle.boreOffsetMoa.up, windageMoa: setting.windageClicks * sight.windageClickMoa + rifle.boreOffsetMoa.right, targetYards: 200 };
  const cond = (w) => ({ altitudeFt: w.altitudeFt, tempF: w.tempF, pressureInHg: w.pressureInHg, humidity: w.humidity });
  const a = E.fly({ ...common, load: flat.loads['sb-174-hpbt'], conditions: cond(day1), wind: day1.wind }), b = E.fly({ ...common, load: flat.loads['wolf-203-sp'], conditions: cond(day2), wind: day2.wind });
  const predicted = b.hit.upIn - a.hit.upIn;
  console.log(`  load change at 200 yd, same sight (two days, ${day1.tempF} and ${day2.tempF} F): the 203 gr group landed ${(other.up - same.up).toFixed(1)} in from the 174 gr group; the engine's figure ${predicted.toFixed(1)} in`);
  assert.ok(Math.abs(predicted) > 1, 'the two loads differ at 200 yards');
  assert.ok(Math.abs((other.up - same.up) - predicted) < 4, `moved ${other.up - same.up}, engine ${predicted}`);
  // On the firing line too: the load is the day's; the saved zero is a button when the sight has left it.
  await noDay(page);
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  const lineEl = await page.textContent('#el-text');
  assert.equal(lineEl, el, 'the firing line opens at the saved zero for the arriving load');
  assert.equal(await page.$('#load'), null, 'no load select on the firing line either');
  assert.ok(await page.isHidden('#use-zero'), 'at the saved zero: no button');
  await page.click('#el-up'); await page.click('#el-up');
  assert.ok(await page.isVisible('#use-zero'), 'the saved zero is offered as a button once the sight has left it');
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
  // range-day-thirteen: the knobs' words stand by their rows, on the first screen
  assert.match(await page.textContent('#knob-note'), /Sight setting not saved on this device/);
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
    for (const p of ['/', '/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt', '/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt', '/line?course=angeles-sylmar&rifle=bcm-ar15&load=imi-m193', '/day', '/book?course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt']) {
      await page.goto(`${base}${p}`);
      await page.waitForSelector(p === '/' ? '.rifle' : p === '/day' ? '#facts' : p.startsWith('/book') ? '#pages' : '#el-up');
      // the firing line's script fits its canvas to the screen when it runs (the HTML's canvas is 400 px wide until then); the width is read once the page's own script has run, not between the HTML and the script (with other checks loading the machine, range-day-seven saw the read land in that gap)
      if (p.startsWith('/line')) await page.waitForFunction(() => Boolean(window.RangeDayLine), null, { timeout: 30000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${p} at ${viewport.width}: no sideways scroll`);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
});

test('verify 6: a zero and a log written in the old form (per rifle and load) for the Vepr show on home, the bench and the line; the AR-15\'s, made with its old iron sights, stay stored and are not the Troy sights\' (range-day-twelve)', { skip }, async () => {
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
  // range-day-twelve: the AR's old zero was made with its old iron sights; the Troy sights that took their place click differently, so it is not theirs.
  assert.match(await page.textContent('.rifle[data-rifle="bcm-ar15"] .rmark'), /no zero saved/);
  assert.match(await page.textContent('.rifle[data-rifle="iwi-x95"] .rmark'), /no zero saved/);
  assert.match(await page.textContent('#zero'), /Zeroed at 100 yards with the UTG.*\+31 clicks/);
  // The bench and the line, by the old address form (no sight): the Vepr opens with its scope at that zero.
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire5');
  assert.match(await page.textContent('#saved'), /Saved zero for Sellier & Bellot 174 gr.*100 yards, elevation \+31 clicks/);
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  // range-day-eleven: the zero was made with the 2-7x44 the game modeled before; the BugBuster that took its place carries it.
  assert.match(await page.textContent('#intro'), /UTG BugBuster 3-9x32/);
  assert.match(await page.textContent('#el-text'), /\+31 clicks/);
  assert.match(await page.textContent('#log tbody'), /9\.0 in low/);
  // The AR: its old zero and log were made with the old iron sights, so the Troy sights open unzeroed with an empty log (range-day-twelve);
  // the old records are still in place, read as nothing else's.
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=bcm-ar15&load=federal-gmm-69`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#intro'), /Troy folding BattleSights/);
  assert.match(await page.textContent('#zero-note'), /No zero saved/);
  assert.doesNotMatch(await page.textContent('#log'), /hit \(level, centered/);
  const keys = await page.evaluate(() => Object.keys(localStorage).sort());
  for (const k of ['range-day:zero:molot-vepr-54r:sb-174-hpbt', 'range-day:zero:molot-vepr-54r:utg-bugbuster-3-9x32:sb-174-hpbt', 'range-day:log:molot-vepr-54r:utg-bugbuster-3-9x32:sb-174-hpbt', 'range-day:zero:bcm-ar15:federal-gmm-69', 'range-day:log:bcm-ar15:federal-gmm-69']) assert.ok(keys.includes(k), `${k} is stored`);
  for (const k of ['range-day:zero:bcm-ar15:troy-battlesights:federal-gmm-69', 'range-day:log:bcm-ar15:troy-battlesights:federal-gmm-69']) assert.ok(!keys.includes(k), `nothing of the old irons is written forward as ${k}`);
  // The old Vepr zero was made with the scope: the Vepr's irons have no zero.
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&sight=vepr-irons&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#zero-note'), /No zero saved/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 7: the old addresses without a sight open the Vepr with its scope on the line and the bench', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  assert.match(await page.textContent("#intro"), /Molot Vepr, 7.62x54R with UTG BugBuster 3-9x32/);
  assert.ok(await page.isVisible('#zoom'), 'the scope has its zoom');
  await page.goto(`${base}/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt`); await page.waitForSelector('#fire5');
  assert.match(await page.textContent('#intro'), /Molot Vepr, 7.62x54R, UTG BugBuster 3-9x32/);
  assert.match(await page.textContent('#click-help'), /0\.25 MOA/);
  // The installed app's start page, bare: it opens, with the last rifle picked.
  await page.goto(`${base}/`); await page.waitForSelector('.rifle.picked');
  assert.equal(await page.getAttribute('.rifle.picked', 'data-rifle'), 'molot-vepr-54r');
  assert.match(await page.getAttribute('#go-line', 'href'), /sight=utg-bugbuster-3-9x32/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('home remembers each rifle\'s sight: pick the Tavor SAR, choose a sight that is not its first (range-day-twelve: the SeeAll; it was the irons, which are now its first), pick another rifle, pick the SAR again, that sight is still chosen', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/`); await page.waitForSelector('.rifle');
  await page.click('.rifle[data-rifle="iwi-tavor-sar"]'); await page.waitForSelector('.rifle.picked[data-rifle="iwi-tavor-sar"]');
  await page.selectOption('#sight', 'seeall-gen1');
  await page.selectOption('#load', 'federal-gmm-69');
  await page.click('.rifle[data-rifle="molot-vepr-54r"]'); await page.waitForSelector('.rifle.picked[data-rifle="molot-vepr-54r"]');
  assert.equal(await page.inputValue('#sight'), 'utg-bugbuster-3-9x32', 'the Vepr opens with its own last sight (its default on a new device)');
  await page.click('.rifle[data-rifle="iwi-tavor-sar"]'); await page.waitForSelector('.rifle.picked[data-rifle="iwi-tavor-sar"]');
  assert.equal(await page.inputValue('#sight'), 'seeall-gen1', 'the SAR comes back with the sight it was left with');
  assert.equal(await page.inputValue('#load'), 'federal-gmm-69', 'and its load');
  assert.match(await page.getAttribute('#go-line', 'href'), /sight=seeall-gen1/);
  // A reload keeps it too; an old-style address for the same rifle still opens its default sight.
  await page.reload(); await page.waitForSelector('.rifle.picked[data-rifle="iwi-tavor-sar"]');
  assert.equal(await page.inputValue('#sight'), 'seeall-gen1');
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=iwi-tavor-sar&load=imi-m193`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#intro'), /FAB Defense flip-up sights/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('on a wide screen the Steady and Fire bar stands beside the view and covers none of it', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 1280, height: 800 });
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  const r = await page.evaluate(() => { const b = (s) => document.querySelector(s).getBoundingClientRect().toJSON(); return { view: b('#view'), bar: b('.firebar'), fire: b('#fire'), w: window.innerWidth, h: window.innerHeight }; });
  const overlap = !(r.bar.left >= r.view.right || r.bar.right <= r.view.left || r.bar.top >= r.view.bottom || r.bar.bottom <= r.view.top);
  console.log(`  1280x800: view ${r.view.left.toFixed(0)}-${r.view.right.toFixed(0)} x ${r.view.top.toFixed(0)}-${r.view.bottom.toFixed(0)}; bar ${r.bar.left.toFixed(0)}-${r.bar.right.toFixed(0)} x ${r.bar.top.toFixed(0)}-${r.bar.bottom.toFixed(0)}`);
  assert.equal(overlap, false, 'the bar does not cover the view');
  assert.ok(r.bar.right <= r.w && r.fire.bottom <= r.h, 'the bar is inside the screen');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 11: home at 412x915, each of the seven rifles chosen in turn: both doors and the zero line are inside the screen without scrolling (range-day-nineteen: and each of the four under "More rifles", reached by its card and back)', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  await page.goto(`${base}/`); await page.waitForSelector('.rifle');
  const rifles = await page.$$eval('.rifle[data-rifle]', (els) => els.map((e) => e.dataset.rifle));
  assert.equal(rifles.length, 7);
  assert.equal(await page.textContent('.rifle.turn .rname'), 'More rifles ›');
  await page.click('.rifle.turn'); await page.waitForSelector('.rifles-head');
  assert.equal(await page.textContent('.rifles-head'), 'More rifles');
  const more = await page.$$eval('.rifle[data-rifle]', (els) => els.map((e) => e.dataset.rifle));
  assert.deepEqual(more, ['tikka-t3x-ctr', 'jp-15-6arc', 'iwi-tavor-7', 'vudoo-v22-ravage']);
  await page.click('.rifle.turn'); await page.waitForSelector('.rifle[data-rifle="bcm-ar15"]');
  const lines = [];
  for (const id of [...rifles, ...more]) {
    if (more.includes(id) && !(await page.$(`.rifle[data-rifle="${id}"]`))) await page.click('.rifle.turn');
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

test('verify 10: turning the Vepr\'s scope 30 MOA, its full travel (range-day-eleven: the BugBuster\'s 120 clicks each way; it was 40 MOA on the 2-7x44): the coarse buttons in 30 presses, a held fine button in seconds; the limit stops it and the screen says so', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  await page.evaluate(() => { localStorage.removeItem('range-day:sight:molot-vepr-54r:utg-bugbuster-3-9x32'); localStorage.removeItem('range-day:zero:molot-vepr-54r:utg-bugbuster-3-9x32:sb-174-hpbt'); localStorage.removeItem('range-day:zero:molot-vepr-54r:sb-174-hpbt'); });
  await page.reload(); await page.waitForSelector('#fire');
  const clicks = async () => page.evaluate(() => RangeDayLine.setting.elevationClicks);
  assert.equal(await clicks(), 0);
  // The coarse pair: one whole MOA a press (4 clicks on this scope).
  let presses = 0;
  while ((await clicks()) < 120) { await page.click('#el-up-moa'); presses++; if (presses > 200) break; }
  assert.equal(presses, 30, '30 MOA in 30 presses of the coarse button');
  assert.equal(await clicks(), 120, 'the data\'s limit: 120 clicks each way');
  assert.match(await page.textContent('#result'), /end of its travel/);
  await page.click('#el-up-moa');
  assert.equal(await clicks(), 120, 'the limit stops the knob');
  assert.match(await page.textContent('#result'), /end of its travel \(120 clicks/);
  assert.match(await page.textContent('#setting-line'), /Elevation \+120 clicks \(30 MOA up\)/);
  // Back to the middle, then hold the fine button and time it.
  await page.evaluate(() => { localStorage.removeItem('range-day:sight:molot-vepr-54r:utg-bugbuster-3-9x32'); });
  await page.reload(); await page.waitForSelector('#fire');
  assert.equal(await clicks(), 0);
  const box = await page.locator('#el-up').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const t0 = Date.now();
  await page.mouse.down();
  let held = 0;
  for (let i = 0; i < 300; i++) { await wait(50); if ((await clicks()) >= 120) { held = (Date.now() - t0) / 1000; break; } }
  await page.mouse.up();
  const after = await clicks();
  console.log(`  Vepr scope, 30 MOA up: ${presses} presses of the 1-MOA button; a held click button reached 120 clicks in ${held.toFixed(1)} s`);
  assert.equal(after, 120, 'the held button ran to the limit and stopped there');
  assert.ok(held > 2 && held < 15, `held ${held} s`);
  assert.match(await page.textContent('#result'), /end of its travel/);
  // A single tap is one click, never two.
  await page.click('#el-down');
  assert.equal(await clicks(), 119);
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
  // The iron sights on the same rifle: not zeroed. (The bench's day is closed first: home shows an open day with shots instead of the picks.)
  await noDay(page);
  await page.goto(`${base}/?rifle=iwi-tavor-sar&sight=fab-flipup&load=imi-m193`); await page.waitForSelector('.rifle');
  assert.match(await page.textContent('#zero'), /Not zeroed yet with the FAB Defense flip-up sights/);
  await page.goto(`${base}/line?${SAR}&sight=fab-flipup`); await page.waitForSelector('#fire');
  assert.match(await page.textContent('#zero-note'), /No zero saved/);
  // The dot again: the zero is there, on home and on the line.
  await noDay(page);
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
  // (range-day-twelve: on the 5.45 rifle's ball post; the 7.62x39 rifle's KNS rear peep replaced its sliding leaf)
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=ak-545&sight=ak545-ball&load=hornady-545-60`); await page.waitForSelector('#fire');
  await page.evaluate(() => { localStorage.removeItem('range-day:sight:ak-545:ak545-ball'); });
  await page.reload(); await page.waitForSelector('#fire');
  await page.selectOption('#plate', '1');
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  const a = await seededShot(page, 9);
  await page.click('#leaf-up');
  assert.match(await page.textContent('#setting-line'), /Leaf 2 \(200 m\)/);
  const geom = await page.evaluate(() => RangeDayLine.geometry);
  const b = await seededShot(page, 9);
  const movedMoa = (b.upIn - a.upIn) / E.inchesPerMoa(a.yards);
  const leafMoa = flat.sights['ak545-ball'].leaf.moaAbove100[1].moaAbove100;
  lines.push(`leaf 1 to 2 at ${a.yards} yd: the strike moved ${(b.upIn - a.upIn).toFixed(1)} in, ${movedMoa.toFixed(2)} MOA, ${(movedMoa * geom.pxPerMoa).toFixed(2)} px at the view's scale; data ${leafMoa} MOA, ${(leafMoa * geom.pxPerMoa).toFixed(2)} px`);
  assert.equal(geom.leafMoa, leafMoa);
  assert.ok(Math.abs(movedMoa - leafMoa) * geom.pxPerMoa <= 1, lines[lines.length - 1]);
  assert.equal(b.leaf, 200, 'the log row records the leaf');
  console.log('  ' + lines.join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 12: on both courses the plates stand apart through the widest view, and the engine is given the height the drawing uses', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const lines = [];
  for (const [path, rifle] of [['/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt', 'Vepr, scope at 3x'], ['/line?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193', 'AR-15, Troy iron sights']]) {
    await noDay(page);
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
      // Since range-day-five the plates stand where the surveyed ground puts them, so no order is imposed; they only never overlap.
      for (let j = 0; j < i; j++) {
        const sep = Math.hypot(a.upMoa - angles[j].upMoa, a.rightMoa - angles[j].rightMoa);
        assert.ok(sep >= 5, `${angles[j].yards} and ${a.yards} yd are ${sep.toFixed(1)} MOA apart`);
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

test('on a phone, Fire works from a second finger while the first holds Steady, and holding Steady selects no text', { skip }, async () => {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/login`); await page.fill('#passphrase', PASS); await page.click('button[type=submit]'); await page.waitForURL(`${base}/`);
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#fire');
  await page.evaluate(() => { localStorage.removeItem('range-day:log:bcm-ar15:troy-battlesights:imi-m193'); });
  await page.reload(); await page.waitForSelector('#fire');
  // Finger one lands on Steady and stays; finger two taps Fire. A phone gives the second finger pointer events but no click.
  const result = await page.evaluate(async () => {
    const steady = document.getElementById('steady'), fire = document.getElementById('fire');
    const ev = (type, target, id, primary) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: id, pointerType: 'touch', isPrimary: primary, button: 0, buttons: 1 }));
    ev('pointerdown', steady, 1, true);
    const held = steady.classList.contains('on');
    const before = RangeDayLine.log.length + RangeDayLine.pending;
    ev('pointerdown', fire, 2, false); ev('pointerup', fire, 2, false);
    const firedWhileHeld = (RangeDayLine.log.length + RangeDayLine.pending) > before;
    const stillHeld = steady.classList.contains('on');
    ev('pointerup', steady, 1, true);
    const released = !steady.classList.contains('on');
    const sel = getComputedStyle(steady).userSelect || getComputedStyle(steady).webkitUserSelect;
    return { held, firedWhileHeld, stillHeld, released, sel, touchAction: getComputedStyle(fire).touchAction };
  });
  console.log(`  phone: Steady held ${result.held}, Fire from a second finger ${result.firedWhileHeld}, Steady still held after it ${result.stillHeld}, released on lift ${result.released}; user-select ${result.sel}, touch-action ${result.touchAction}`);
  assert.equal(result.held, true); assert.equal(result.firedWhileHeld, true, 'Fire works while Steady is held'); assert.equal(result.stillHeld, true); assert.equal(result.released, true);
  assert.equal(result.sel, 'none', 'the Steady label cannot be selected'); assert.equal(result.touchAction, 'none');
  // A real tap on Fire (Playwright's touch tap) still fires exactly once.
  const before = await page.evaluate(() => RangeDayLine.log.length + RangeDayLine.pending);
  await page.tap('#fire');
  await wait(300);
  const after = await page.evaluate(() => RangeDayLine.log.length + RangeDayLine.pending);
  assert.equal(after - before, 1, 'one tap, one shot');
  assert.deepEqual(errors, []);
  await context.close();
});

// --- range-day-twelve: the sights fitted to the rifles --------------------------------------------------------------------
// Each new sight on the firing line, the plain picture under it, the frame loop stopped so the aim holds still: what is drawn,
// read from the canvas's own pixels, against the data's angles at the view's scale (k pixels per MOA).
const NEW_SIGHTS = [
  ['bcm-ar15', 'troy-battlesights', 'imi-m193', 'angeles-sylmar'], ['iwi-tavor-sar', 'fab-flipup', 'imi-m193', 'angeles-sylmar'], ['iwi-x95', 'fab-flipup', 'imi-m193', 'angeles-sylmar'],
  ['iwi-tavor-sar', 'seeall-gen1', 'imi-m193', 'angeles-sylmar'], ['ak-762', 'ak762-kns-peep', 'silver-bear-123', 'angeles-sylmar'], ['ak-545', 'ak545-ball', 'hornady-545-60', 'angeles-sylmar'],
  ['ak-545', 'ak545-xs', 'hornady-545-60', 'angeles-sylmar'], ['molot-vepr-54r', 'vepr-irons', 'sb-174-hpbt', 'cta-piru'],
];
// The aim held well above the first plate, in open sky, so each part of the sight is read against an even light (a plate or a
// hillside behind the centre would be read as part of the sight); the frame loop stopped so the aim holds still.
const SKY_UP = 260;
const still = (page) => page.evaluate(async (up) => { RangeDayLine.setHold(up, 0); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); window.requestAnimationFrame = () => 0; }, SKY_UP);
// Measures the drawn sight in the page: the runs of dark (or bright) pixels on rows of the canvas, to a fraction of a pixel.
function readSight() {
  const c = document.getElementById('view'), g = c.getContext('2d'), G = RangeDayLine.geometry, size = G.viewPx, cx = size / 2, cy = size / 2;
  const lum = (d, x) => 0.299 * d[x * 4] + 0.587 * d[x * 4 + 1] + 0.114 * d[x * 4 + 2];
  const row = (y) => { const d = g.getImageData(0, Math.round(y), size, 1).data; const L = []; for (let x = 0; x < size; x++) L.push(lum(d, x)); return L; };
  const col = (x) => { const d = g.getImageData(Math.round(x), 0, 1, size).data; const L = []; for (let y = 0; y < size; y++) L.push(lum(d, y)); return L; };
  // the width of the run around `at` on the far side of thr (dark: below it), each edge where L crosses thr, to a fraction of a pixel
  const run = (L, at, thr, dark = true) => {
    const inside = (v) => (dark ? v < thr : v > thr);
    const edge = (step) => { let x = Math.round(at); while (x > 0 && x < L.length - 1 && inside(L[x])) x += step; const a = L[x - step], b = L[x]; return x - step + step * ((thr - a) / (b - a)); };
    const r = edge(1), l = edge(-1); return { width: r - l, mid: (r + l) / 2 };
  };
  const span = (L, a, b) => L.slice(Math.max(0, Math.round(a)), Math.min(L.length, Math.round(b)));
  const out = { k: G.pxPerMoa, size, G, sky: row(cy - 6)[Math.round(cx)] };
  if (G.triangle) {
    // the SeeAll: the first dark row down the centre column (the tip), and the triangle's width on a row inside the glowing block
    const C = col(cx), bg = C[Math.round(cy - 20)];
    let tip = null; for (let y = Math.round(cy - 15); y < cy + 15; y++) if (C[y] < bg / 2) { tip = y; break; }
    const L = row(cy + G.triangle.heightPx * 0.8), green = L[Math.round(cx + G.triangle.fieldPx * 0.3)];
    const w = run(L, cx, green / 2);
    return { ...out, tipY: tip, triW: w.width, triMid: w.mid };
  }
  // the front: a post's or a ball's width on the row through it, against the light either side of it (inside the ring, or in the notch)
  const frontRow = G.stemPx ? cy + G.frontPx / 2 : cy + Math.min(8, (G.notchDepthPx || 16) * 0.4);
  const F = row(frontRow), window = Math.max(G.frontPx * 1.4, 4);
  const light = Math.max(...span(F, cx - window, cx + window)), darkest = Math.min(...span(F, cx - 1, cx + 2));
  out.front = run(F, cx, (light + darkest) / 2).width;
  out.frontLight = light;
  if (G.stemPx) { const T = row(cy + Math.max(G.frontPx * 1.5, (G.notchDepthPx || 0) * 0.5)); const tl = Math.max(...span(T, cx - window, cx + window)); out.stem = run(T, cx, (tl + Math.min(...span(T, cx - 1, cx + 2))) / 2).width; }
  if (G.ringPx) {
    // the ring: on the row 0.6 of its radius above the centre, the chord between the half-dark points is 1.6 times the radius
    const R = G.ringPx / 2, A = row(cy - 0.6 * R), inner = A[Math.round(cx)], outer = Math.min(A[Math.max(1, Math.round(cx - R * 1.8))], A[Math.min(size - 2, Math.round(cx + R * 1.8))]); // dark beside the ring: inside a peep's leaf too
    out.ring = (2 * run(A, cx, (inner + outer) / 2, false).width) / 1.6; // the diameter
  }
  if (G.rearBodyPx) {
    // a peep's leaf: the dark band across a row under the ring, between the world either side
    const B = row(cy + G.ringPx), mid = B[Math.round(cx + G.ringPx)], side = Math.max(B[2], B[size - 3]);
    out.leafW = run(B, cx + G.ringPx, (mid + side) / 2).width;
  }
  if (G.hoodPx) {
    // a round hood: the light inside it on the row 2 px above the post's top (nearly its full inside diameter there)
    const H = row(cy - 2), inside = H[Math.round(cx)], wall = H[Math.round(cx + G.hoodPx / 2 + G.hoodWallPx / 2)];
    const w = run(H, cx, (inside + wall) / 2, false).width, rr = G.hoodPx / 2;
    out.hood = 2 * Math.sqrt((w / 2) ** 2 + 2 * 2); // back from the chord 2 px above the centre to the diameter
    out.hoodChord = w; void rr;
  }
  if (G.earGapPx) {
    // the guards: the light between them on the row 2 px above the post's top (below the guards' tops)
    const E2 = row(cy - 2), lightGap = E2[Math.round(cx)], dark = E2[Math.round(cx + G.earGapPx / 2 + G.earPx / 2)];
    out.earGap = run(E2, cx, (lightGap + dark) / 2, false).width;
  }
  if (G.stripePx) { const S2 = row(cy + (G.notchDepthPx || 16) * 0.5); out.stripe = run(S2, cx, (S2[Math.round(cx)] + S2[Math.round(cx - G.frontPx * 0.35)]) / 2, false).width; }
  if (G.notchDepthPx && !G.ringPx) {
    // the notch: whether any light shows beside the front in it (a front as wide as the notch fills it)
    const N = row(cy + G.notchDepthPx * 0.5), half = (G.notchDepthPx * 24) / 22 / 2; // the notch's half-width: notchMoa is 24 to notchDepthMoa's 22
    const clear = (G.stripePx || 0) / 2 + 2; // the glowing stripe is bright by design: left out
    out.notchLight = Math.max(...span(N, cx - half, cx - clear), ...span(N, cx + clear, cx + half));
  }
  return out;
}

test('range-day-twelve verify 3: each new sight as drawn, read from the canvas at 412 and 1280 px wide, against the data\'s angles at the view\'s scale', { skip }, async () => {
  const lines = []; let worst = 0;
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    for (const [rifle, sight, load, course] of NEW_SIGHTS) {
      await page.goto(`${base}/line?course=${course}&rifle=${rifle}&sight=${sight}&load=${load}`); await page.waitForSelector('#fire');
      await still(page);
      const r = await page.evaluate(readSight);
      const S = flat.sights[sight], k = r.k, half = r.G.viewPx / 2;
      const pairs = [];
      if (r.triW != null) pairs.push(['the triangle\'s tip, below the aim point', r.tipY - half, 0, 1], ['the triangle\'s width at 0.8 of its height', r.triW, S.reticle.triangleWidthMoa * 0.8 * k, 1], ['the triangle\'s middle, beside the aim point', r.triMid - half, 0, 1]);
      else {
        const filled = S.notchMoa && S.frontPostMoa >= S.notchMoa;
        if (filled) { lines.push(`${sizeName} ${rifle} ${sight}: the post (${(S.frontPostMoa * k).toFixed(2)} px) fills the notch (${(S.notchMoa * k).toFixed(2)} px): no light beside it, the brightest pixel there ${r.notchLight.toFixed(0)} against the sky's ${r.sky.toFixed(0)}`); assert.ok(r.notchLight < r.sky / 2, `${sight}: no light beside the post in the notch`); }
        else pairs.push([S.frontBead ? 'ball' : 'post', r.front, S.frontPostMoa * k, 1.5]);
        if (r.stem != null) pairs.push(['stem', r.stem, S.stemWidthMoa * k, 1.5]);
        if (r.ring != null) pairs.push(['ring', r.ring, S.apertureMoa * k, Math.max(2, S.apertureMoa * k * 0.06)]);
        if (r.leafW != null) pairs.push(['the peep\'s leaf', r.leafW, S.rearBody.widthMoa * k, 2]);
        // the guards are read where the ring shows them; a guard outside the ring is hidden by it, as through the real peep
        if (r.earGap != null && S.frontEars.gapMoa < S.apertureMoa * 0.8) pairs.push(['gap between the guards', r.earGap, S.frontEars.gapMoa * k, 1.5]);
        else if (r.earGap != null) lines.push(`${sizeName} ${rifle} ${sight}: the guards (${(S.frontEars.gapMoa * k).toFixed(2)} px apart) stand outside the ring (${(S.apertureMoa * k).toFixed(2)} px): hidden by it`);
        if (r.hood != null) pairs.push(['inside of the round hood', r.hood, S.frontHood.innerMoa * k, 1.5]);
        if (r.stripe != null) pairs.push(['glowing stripe', r.stripe, S.frontStripeMoa * k, 1.5]);
      }
      for (const [what, drawn, data, tol] of pairs) {
        const diff = Math.abs(drawn - data);
        lines.push(`${sizeName} ${rifle} ${sight}: ${what} drawn ${drawn.toFixed(2)} px, data ${data.toFixed(2)} px, difference ${diff.toFixed(2)} px`);
        assert.ok(diff <= tol, lines[lines.length - 1]);
        if (!/ring/.test(what)) worst = Math.max(worst, diff);
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(`  largest difference, fronts, guards, stripe and triangle: ${worst.toFixed(2)} px\n  ` + lines.join('\n  '));
});

test('range-day-twelve verify 4: same scale through each new sight: where the drawing puts the near paper and a far plate, against the angles from the data at the drawn aim, at 412 and 1280 px wide', { skip }, async () => {
  const MOA = Math.PI / (180 * 60);
  const ang = (t) => ({ up: Math.atan2(t.riseFt, t.yards * 3) / MOA, right: Math.atan2(t.lateralYd, t.yards) / MOA });
  const lines = []; let worst = 0, checked = 0;
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    for (const [rifle, sight, load, course] of NEW_SIGHTS) {
      const c = flat.courses[course], far = c.plates.length - 1;
      await page.goto(`${base}/line?course=${course}&rifle=${rifle}&sight=${sight}&load=${load}`); await page.waitForSelector('#fire');
      for (const [aimed, key, t, a] of [['near-0', 'near-0', c.near[0], c.near[0]], [String(far), String(far), c.plates[far], c.plates[far]]]) {
        await page.evaluate((kk) => { RangeDayLine.setTarget(kk); RangeDayLine.setHold(0, 0); }, aimed);
        await page.waitForTimeout(250);
        const r = await page.evaluate((kk) => { const g = RangeDayLine.geometry; return { on: RangeDayLine.targetOnScreen(kk).plain, k: g.pxPerMoa, size: g.viewPx, aim: g.aim, paper: RangeDayLine.drawnPaper(kk) }; }, key);
        // a paper sheet: where the frame that drew it put its centre, at that frame's aim; a plate: where the drawing places it now
        const at = key.startsWith('near') && r.paper ? { x: r.paper.x, y: r.paper.y, aim: { right: r.paper.aimRight, up: r.paper.aimUp }, k: r.paper.pxPerMoa } : { x: r.on[0], y: r.on[1], aim: r.aim, k: r.k };
        const A = ang(a), T = ang(t);
        const ex = r.size / 2 + (T.right - A.right - at.aim.right) * at.k, ey = r.size / 2 - (T.up - A.up - at.aim.up) * at.k;
        const off = Math.hypot(at.x - ex, at.y - ey);
        lines.push(`${sizeName} ${sight} on ${rifle}, ${t.yards} yd ${key.startsWith('near') ? 'paper' : 'plate'}: drawn ${at.x.toFixed(2)}, ${at.y.toFixed(2)}; angles ${ex.toFixed(2)}, ${ey.toFixed(2)}; ${off.toFixed(3)} px`);
        assert.ok(off <= 1, lines[lines.length - 1]);
        worst = Math.max(worst, off); checked++;
      }
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  assert.equal(checked, NEW_SIGHTS.length * 2 * 2);
  console.log(`  ${checked} targets checked, largest difference ${worst.toFixed(3)} px\n  ` + lines.join('\n  '));
});

test('range-day-twelve verify 6: the BugBuster\'s dots stand at their true angle for the power in use (second focal plane, true at 10x): drawn spacing in pixels at 3x, 6x and 9x, read from the canvas, against the data', { skip }, async () => {
  const ret = flat.sights['utg-bugbuster-3-9x32'].reticle;
  const lines = [];
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt`); await page.waitForSelector('#fire');
    const spacing = {};
    for (const power of [3, 6, 9]) {
      await page.evaluate(([p, up]) => { RangeDayLine.setZoom(p); RangeDayLine.setHold(up, 0); }, [power, 400 / power]);
      await page.waitForTimeout(300);
      const r = await page.evaluate(() => {
        const c = document.getElementById('view'), g = c.getContext('2d'), G = RangeDayLine.geometry, size = G.viewPx, cx = size / 2, cy = size / 2;
        // down the vertical line of the crosshair: the line is a thin grey there, each dot a darker spot on it
        const d = g.getImageData(Math.round(cx), 0, 1, size).data, L = [];
        for (let y = 0; y < size; y++) L.push(0.299 * d[y * 4] + 0.587 * d[y * 4 + 1] + 0.114 * d[y * 4 + 2]);
        const seg = L.slice(Math.round(cy + 3), Math.round(cy + 5 * G.milDotPx)).sort((a, b) => a - b), sky = seg[Math.floor(seg.length / 2)]; // the line's own grey, inside the five dots: the middle value
        const dots = []; let start = -1;
        for (let y = Math.round(cy + 3); y < size; y++) { const dark = L[y] < sky * 0.6; if (dark && start < 0) start = y; if (!dark && start >= 0) { dots.push((start + y - 1) / 2); start = -1; } }
        return { k: G.pxPerMoa, milDotPx: G.milDotPx, dots: dots.slice(0, 3), cy };
      });
      const want = ((ret.dotSpacingMoa * ret.trueAtPower) / power) * r.k;
      const first = r.dots[0] - r.cy, next = r.dots[1] - r.dots[0];
      lines.push(`${sizeName} ${power}x: dots drawn ${first.toFixed(2)} px below the centre and ${next.toFixed(2)} px apart; data ${(ret.dotSpacingMoa * ret.trueAtPower / power).toFixed(2)} MOA × ${r.k.toFixed(3)} px/MOA = ${want.toFixed(2)} px`);
      assert.ok(Math.abs(r.milDotPx - want) < 1e-6, 'the drawing is asked for the data\'s spacing');
      assert.ok(Math.abs(first - want) <= 1 && Math.abs(next - want) <= 1, lines[lines.length - 1]);
      spacing[power] = (ret.dotSpacingMoa * ret.trueAtPower) / power;
    }
    assert.ok(Math.abs(spacing[3] - 3 * spacing[9]) < 1e-9, 'at 3x three times as far apart in angle as at 9x');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('  ' + lines.join('\n  '));
});

test('range-day-twelve task items 3 and 4: a control that does not apply is not shown (the SeeAll: no leaf, no zoom, no magnifier; the KNS rear peep: no leaf); the bench says where each new sight adjusts and by how much; the sight chooser on a Tavor lists its four', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const shown = (sel) => page.evaluate((s) => { const el = document.querySelector(s); return Boolean(el && !el.hidden && el.offsetParent !== null); }, sel);
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=iwi-tavor-sar&sight=seeall-gen1&load=imi-m193`); await page.waitForSelector('#fire');
  assert.deepEqual([await shown('#zoomrow'), await shown('#magrow'), await shown('#leafrow')], [false, false, false], 'the SeeAll: no zoom, no magnifier, no leaf');
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=ak-762&sight=ak762-kns-peep&load=silver-bear-123`); await page.waitForSelector('#fire');
  assert.equal(await shown('#leafrow'), false, 'the KNS rear peep replaced the leaf');
  await page.goto(`${base}/line?course=angeles-sylmar&rifle=ak-545&sight=ak545-xs&load=hornady-545-60`); await page.waitForSelector('#fire');
  assert.equal(await shown('#leafrow'), true, 'the 5.45 rifle keeps its sliding leaf behind the XS post');
  const helps = [];
  for (const [rifle, sight, load, words] of [['iwi-tavor-sar', 'seeall-gen1', 'imi-m193', /One step \(a sixteenth of a turn of its screw\) of elevation moves the strike 0\.95 MOA.*two screws on the sight, no clicks/],
    ['bcm-ar15', 'troy-battlesights', 'imi-m193', /One click of elevation moves the strike 1\.33 MOA.*windage 0\.5 MOA.*front post \(an A2 post/], ['ak-762', 'ak762-kns-peep', 'silver-bear-123', /both on the rear peep/]]) {
    await page.goto(`${base}/zero?course=angeles-sylmar&rifle=${rifle}&sight=${sight}&load=${load}`); await page.waitForSelector('#fire5');
    const t = await page.textContent('#click-help'); helps.push(`${sight}: ${t}`);
    assert.match(t, words);
  }
  await noDay(page);
  await page.goto(`${base}/?rifle=iwi-tavor-sar`); await page.waitForSelector('.rifle.picked[data-rifle="iwi-tavor-sar"]');
  const opts = await page.$$eval('#sight option', (o) => o.map((x) => x.textContent));
  // range-day-thirteen: then the scope collection's three, under their own heading
  // (range-day-fourteen: four since the green ACOG joined the collection)
  assert.equal(opts.length, 7, 'the irons, the dot (with its magnifier behind it) and the SeeAll; then the collection\'s four');
  assert.deepEqual(await page.$$eval('#sight > option', (o) => o.map((x) => x.value)), ['fab-flipup', 'pa-md25', 'seeall-gen1'], 'its own three first');
  assert.match(opts.join(' | '), /FAB Defense flip-up sights.*Primary Arms SLx MD-25.*SeeAll Open Sight/);
  console.log('  ' + helps.join('\n  ') + '\n  Tavor SAR sight chooser: ' + opts.join(' | '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-twelve-b: the Troy and the FAB rear sights flip between their two peeps: the drawn ring is each peep\'s data, read from the canvas at 412 and 1280 px; the choice is kept on the device; the same seeded shot lands in the same place with either peep', { skip }, async () => {
  const lines = [];
  for (const [sizeName, viewport] of [['phone', { width: 412, height: 915 }], ['computer', { width: 1280, height: 800 }]]) {
    const { page, context, errors } = await signedIn(viewport);
    for (const [rifle, sight] of [['bcm-ar15', 'troy-battlesights'], ['iwi-tavor-sar', 'fab-flipup']]) {
      const q = `course=angeles-sylmar&rifle=${rifle}&sight=${sight}&load=imi-m193`;
      await noDay(page); // the shots on the rifle before opened a day, which would keep the line on that rifle
      await page.goto(`${base}/line?${q}`); await page.waitForSelector('#fire');
      await page.evaluate(([r, s]) => { localStorage.removeItem(`range-day:sight:${r}:${s}`); }, [rifle, sight]);
      await page.reload(); await page.waitForSelector('#fire');
      assert.ok(await page.isVisible('#aperture'), `${sight}: the flip is shown`);
      assert.match(await page.textContent('#aperture'), /^Large rear aperture/);
      await page.selectOption('#plate', '0'); await page.evaluate(() => RangeDayLine.setHold(0, 0));
      const a = await seededShot(page, 21);
      const S = flat.sights[sight];
      for (const [ix, name] of [[0, 'large'], [1, 'small']]) {
        // the frame loop was stopped for the first measure: a fresh page, then the flip
        if (ix === 1) { await page.reload(); await page.waitForSelector('#fire'); await page.click('#aperture'); assert.match(await page.textContent('#aperture'), /^Small rear aperture/); assert.match(await page.textContent('#setting-line'), /Small rear aperture/); }
        await still(page);
        const r = await page.evaluate(readSight);
        const data = S.apertures[ix].apertureMoa * r.k;
        lines.push(`${sizeName} ${sight} ${name} peep: ring drawn ${r.ring.toFixed(2)} px, data ${data.toFixed(2)} px`);
        assert.equal(r.G.aperture, name);
        assert.ok(Math.abs(r.ring - data) <= Math.max(2, data * 0.06), lines[lines.length - 1]);
      }
      // kept on the device, and the shot does not move with the peep
      await page.reload(); await page.waitForSelector('#fire');
      assert.match(await page.textContent('#aperture'), /^Small rear aperture/, 'the small peep is still up after a reload');
      assert.equal((await page.evaluate(([r, s]) => JSON.parse(localStorage.getItem(`range-day:sight:${r}:${s}`)), [rifle, sight])).aperture, 1);
      await page.selectOption('#plate', '0'); await page.evaluate(() => RangeDayLine.setHold(0, 0));
      const b = await seededShot(page, 21);
      lines.push(`${sizeName} ${sight}: the same seeded shot, large peep ${a.upIn.toFixed(2)} in up ${a.rightIn.toFixed(2)} in right; small peep ${b.upIn.toFixed(2)}, ${b.rightIn.toFixed(2)}`);
      assert.equal(b.upIn, a.upIn); assert.equal(b.rightIn, a.rightIn);
    }
    // a sight with one rear peep has no flip
    await noDay(page);
    await page.goto(`${base}/line?course=angeles-sylmar&rifle=ak-762&sight=ak762-kns-peep&load=silver-bear-123`); await page.waitForSelector('#fire');
    assert.equal(await page.isVisible('#aperture'), false);
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('  ' + lines.join('\n  '));
});
