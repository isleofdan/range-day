'use strict';
// The day, the book, the wind call and the cold-bore record, in a real
// browser signing in through the form (brief range-day-three, verify 4 to
// 13). Needs Playwright's browser; where it is missing these are skipped
// and say so (the Checks workflow has it).
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const { existsSync, mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const E = require('../public/engine.js');
const data = require('../lib/data');
const guns = require('../lib/guns');
const { raw, flat } = data.load();

const root = path.join(__dirname, '..');
const PORT = 8971;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
let browser = null, server = null, chromium = null;
try { ({ chromium } = require('playwright')); if (!existsSync(chromium.executablePath())) chromium = null; } catch { chromium = null; }
const skip = chromium ? false : "Playwright's browser is missing on this machine; the Checks workflow runs these";

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function up(b) { for (let i = 0; i < 100; i++) { try { await fetch(`${b || base}/alive`); return; } catch { await wait(50); } } throw new Error('server never answered'); }
const env = (extra) => ({ ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '', ...extra });
async function signedIn(viewport, b) {
  const context = await browser.newContext({ viewport: viewport || { width: 412, height: 915 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${b || base}/login`);
  await page.fill('#passphrase', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(`${b || base}/`);
  await page.evaluate(() => localStorage.clear());
  return { page, context, errors };
}
// Closes any day left open by an earlier test, and opens the plain picture: these tests are about the day's records, which are
// the same under every picture (test/scene.test.js proves that and the picture itself); the test browser draws 3D in software.
const noDay = (page) => page.evaluate(() => { localStorage.removeItem('range-day:day:open'); localStorage.removeItem('range-day:day:packed'); localStorage.setItem('range-day:picture', JSON.stringify('plain')); });
const AR = 'course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193';
const line = async (page, q, b) => { await page.goto(`${b || base}/line?${q}`); await page.waitForSelector('#fire'); };
// The bench is ready when its supply line is written, not only when its Fire button is there (Checks run 44916065640: on a cold
// runner the first test read the line 0.6 s in, before the page wrote it).
const bench = async (page, q) => { await page.goto(`${base}/zero?${q}`); await page.waitForSelector('#fire5'); await page.waitForFunction(() => /zeroing supply/.test(document.getElementById('rounds').textContent)); };
// A seeded shot through the page's own door, landed: the last log row.
async function seededShot(page, seed) {
  const before = await page.evaluate(() => RangeDayLine.log.length);
  await page.evaluate((s) => RangeDayLine.fire(s), seed);
  for (let i = 0; i < 150; i++) { await wait(60); if ((await page.evaluate(() => RangeDayLine.log.length)) > before) break; }
  const log = await page.evaluate(() => RangeDayLine.log);
  assert.ok(log.length > before, 'the shot landed');
  return log[log.length - 1];
}
// A seeded hit: the first seeded shot shows where that seed lands; the hold is moved so the same seed lands on the center.
async function seededHit(page, seed) {
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  const probe = await seededShot(page, seed);
  if (probe.upIn == null) throw new Error('the probe did not reach the plate');
  const ipm = E.inchesPerMoa(probe.yards);
  await page.evaluate(([u, r]) => RangeDayLine.setHold(u, r), [-probe.upIn / ipm, -probe.rightIn / ipm]);
  const hit = await seededShot(page, seed);
  assert.equal(hit.hit, true, `the corrected seeded shot hits: ${JSON.stringify(hit)}`);
  return { probe, hit };
}
const book = (page, rifle, sight, load) => page.evaluate(([r, s, l]) => RD.getBook(r, s, l), [rifle, sight, load]);
const cold = (page, rifle, load) => page.evaluate(([r, l]) => RD.getColdBore(r, l), [rifle, load]);

test.before(async () => {
  if (skip) return;
  server = spawn('node', ['server.js'], { cwd: root, env: env(), stdio: ['ignore', 'ignore', 'inherit'] });
  await up();
  browser = await chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); if (server) server.kill(); });

test('verify 5: the box and the zeroing supply: the bench fires from its own supply, kept across days; the day\'s box is for the steel; when either is empty the screen stays and "Open another box" goes on with the same day; the day\'s page counts the boxes; a day left open is closed on the next date', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await bench(page, AR);
  assert.equal(await page.textContent('#rounds'), 'zeroing supply: 20 of 20 left', 'the bench starts with one box of IMI M193 for zeroing');
  assert.match(await page.textContent('#day-line'), /^A (cold|cool|mild|warm|hot)(, dry)? \w+ (morning|midday|afternoon), \d+ F\.$/);
  await page.click('#fire5');
  assert.equal(await page.textContent('#rounds'), 'zeroing supply: 15 of 20 left');
  await page.click('#to-line'); await page.waitForSelector('#fire');
  assert.equal(await page.textContent('#rounds'), '20 of 20 rounds left', 'the day\'s box is untouched by the bench');
  await page.selectOption('#plate', '0');
  for (let i = 0; i < 20; i++) await seededShot(page, 1 + i);
  assert.equal(await page.textContent('#rounds'), 'the box of 20 is empty');
  assert.match(await page.textContent('#result'), /The box of 20 is empty: open another box to go on, or pack up/);
  const day = await page.evaluate(() => RangeDayLine.day);
  assert.equal(day.endedAt, null, 'the empty box does not end the day');
  const logBefore = await page.evaluate(() => RangeDayLine.log.length + RangeDayLine.pending);
  await page.evaluate(() => RangeDayLine.fire(3)); await wait(300);
  assert.equal(await page.evaluate(() => RangeDayLine.log.length + RangeDayLine.pending), logBefore, 'nothing fired from an empty box');
  assert.match(await page.textContent('#result'), /The box of 20 is empty\. Open another box to go on, or pack up/);
  assert.equal(page.url().includes('/day'), false, 'the line stays where it is');
  assert.ok(await page.isVisible('#another-box'), '"Open another box" is offered');
  await page.click('#another-box');
  assert.equal(await page.textContent('#rounds'), '20 of 20 rounds left (box 2)');
  assert.match(await page.textContent('#result'), /Box 2 of IMI M193 .* opened: 20 rounds\. The day goes on\./);
  assert.ok(await page.isHidden('#another-box'));
  await seededShot(page, 50);
  assert.equal(await page.textContent('#rounds'), '19 of 20 rounds left (box 2)');
  assert.equal((await page.evaluate(() => RangeDayLine.day)).id, day.id, 'the same day');
  // The bench: the supply empties, the bench stays, another box for zeroing.
  await page.goto(`${base}/zero?${AR}`); await page.waitForSelector('#fire5');
  assert.equal(await page.textContent('#rounds'), 'zeroing supply: 15 of 20 left', 'the supply is where the bench left it');
  // range-day-thirteen: the paper shows the day's bench shots at this distance since the last fresh paper, read from the day, so the
  // five fired earlier in the day are on it still; three groups add fifteen
  const before = await page.evaluate(() => RangeDayZero.holes.length);
  for (let i = 0; i < 3; i++) await page.click('#fire5');
  const holes = await page.evaluate(() => RangeDayZero.holes.length);
  assert.equal(holes - before, 15, 'three groups: the last "Fire five" fired the five that were left');
  assert.equal(await page.textContent('#rounds'), 'zeroing supply: the box of 20 is empty');
  assert.match(await page.textContent('#group'), /last round of the zeroing supply.*the day is not over/);
  assert.ok(await page.isDisabled('#fire5') && await page.isDisabled('#fire1'), 'the bench stops firing');
  // range-day-thirteen: Open another box now stands over the Fire row, so a press at Fire's place would open a box; the disabled
  // button itself is pressed instead
  await page.$eval('#fire1', (b) => b.click());
  assert.equal(await page.evaluate(() => RangeDayZero.holes.length), holes, 'no more holes');
  assert.equal(page.url().includes('/day'), false, 'the bench stays where it is');
  assert.ok(await page.isVisible('#another-box'));
  await page.click('#another-box');
  assert.equal(await page.textContent('#rounds'), 'zeroing supply: 20 of 20 left (box 2)');
  await page.click('#fire1');
  assert.equal(await page.textContent('#rounds'), 'zeroing supply: 19 of 20 left (box 2)');
  await page.reload(); await page.waitForSelector('#fire5');
  assert.equal(await page.textContent('#rounds'), 'zeroing supply: 19 of 20 left (box 2)', 'the supply survives a reload');
  // The day's page counts the boxes; Pack up ends the day there.
  await page.click('#to-day'); await page.waitForSelector('#shots tbody tr');
  assert.match(await page.textContent('#facts'), /2 boxes of 20 for the steel, 21 fired, 19 left; still open\. 21 shots at the bench \(from the zeroing supply\), 21 at steel/);
  assert.equal(await page.$$eval('#shots tbody tr', (r) => r.length), 42);
  await page.click('#pack-up'); await page.waitForSelector('#back');
  assert.match(await page.textContent('#facts'), /packed up early/);
  console.log(`  the day: ${await page.textContent('#facts')}`);
  // A new day on the bench: the supply is still 19 (box 2); the new day's box is full.
  await bench(page, AR);
  assert.equal(await page.textContent('#rounds'), 'zeroing supply: 19 of 20 left (box 2)', 'the zeroing supply is kept from one day to the next');
  await page.click('#fire1');
  await line(page, AR);
  assert.equal(await page.textContent('#rounds'), '20 of 20 rounds left');
  // A day left open from an earlier date is closed when the app is next opened.
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('range-day:day:open')); d.date = '2026-11-16'; localStorage.setItem('range-day:day:open', JSON.stringify(d)); });
  const daysBefore = await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:days') || '[]').length);
  await page.goto(`${base}/`); await page.waitForSelector('.rifle');
  assert.ok(await page.isHidden('#open-day'), 'home shows the picks, not the old day');
  const days = await page.evaluate(() => JSON.parse(localStorage.getItem('range-day:days') || '[]'));
  assert.equal(days.length, daysBefore + 1); assert.equal(days[0].endedBy, 'left'); assert.equal(days[0].date, '2026-11-16');
  await page.goto(`${base}/day?id=${encodeURIComponent(days[0].id)}`); await page.waitForSelector('#facts');
  assert.match(await page.textContent('#facts'), /left open; closed on the next visit/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 6: a day stays open across a reload with the same rounds and weather; a day with no shot leaves no record; Pack up, then "Back to the range" restores it', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, 'course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt');
  await page.selectOption('#plate', '0');
  await seededShot(page, 5); await seededShot(page, 6);
  const day = await page.evaluate(() => RangeDayLine.day);
  assert.equal(day.box.left, 18);
  // "Close the app": a new tab, home.
  const page2 = await context.newPage();
  await page2.goto(`${base}/`); await page2.waitForSelector('#day-card');
  const card = await page2.textContent('#day-card');
  assert.match(card, /18 of 20 rounds left/); assert.match(card, new RegExp(`${day.weather.tempF} F`)); assert.match(card, /2 shots so far/);
  await page2.click('#day-line'); await page2.waitForSelector('#fire');
  const again = await page2.evaluate(() => RangeDayLine.day);
  assert.equal(again.id, day.id);
  assert.deepStrictEqual(again.weather, day.weather, 'the same wind, the same day');
  assert.equal(await page2.textContent('#rounds'), '18 of 20 rounds left');
  console.log(`  the day resumed: ${day.weather.tempF} F, wind ${day.weather.wind.map((w) => w.speedMph).join('/')} mph, 18 rounds left`);
  // A day with no shot fired leaves no record.
  await noDay(page2);
  const daysBefore = await page2.evaluate(() => RD.finishedDays().length);
  await bench(page2, AR);
  assert.equal(await page2.textContent('#rounds'), 'zeroing supply: 20 of 20 left');
  await page2.goto(`${base}/`); await page2.waitForSelector('.rifle');
  assert.ok(await page2.isHidden('#open-day'), 'home shows the picks: a day with no shot is nothing yet');
  await line(page2, 'course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt');
  assert.equal((await page2.evaluate(() => RangeDayLine.day)).rifle, 'molot-vepr-54r', 'another choice simply replaces the shotless day');
  assert.equal(await page2.evaluate(() => RD.finishedDays().length), daysBefore, 'no record was kept');
  // An address naming another rifle (and a sight the open rifle does not carry) opens the open day, with a sight the open rifle carries, and says so.
  await seededShot(page2, 7);
  await line(page2, 'course=angeles-sylmar&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193');
  const redirected = await page2.evaluate(() => RangeDayLine.day);
  assert.equal(redirected.rifle, 'molot-vepr-54r', 'the open day wins over the address');
  assert.match(await page2.textContent('#intro'), /Molot Vepr.*UTG BugBuster/, 'with a sight the Vepr carries, not the Tavor\'s dot');
  assert.match(await page2.textContent('#day-line'), /A day is already open with the Molot Vepr/);
  assert.ok(await page2.isHidden('#magrow'), 'no magnifier control: the Vepr has none');
  const given = await page2.evaluate(async () => { RangeDayLine.setHold(0, 0); RangeDayLine.fire(8); await new Promise((r) => setTimeout(r, 1500)); return RangeDayLine.lastShotInput; });
  assert.equal(given.sightHeightIn, flat.rifles['molot-vepr-54r'].sightHeightIn['utg-bugbuster-3-9x32'], 'the engine is given the open rifle\'s own sight height');
  // Two bullets in the air at once keep the order they were fired in: the far plate's bullet (nearly two seconds) is fired first, the near plate's lands first.
  await line(page2, 'course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt');
  const nBefore = (await page2.evaluate(() => RangeDayLine.day)).shots.length;
  await page2.evaluate(async () => { RangeDayLine.setHold(0, 0); document.getElementById('plate').value = '8'; document.getElementById('plate').dispatchEvent(new Event('change')); RangeDayLine.fire(31); document.getElementById('plate').value = '0'; document.getElementById('plate').dispatchEvent(new Event('change')); RangeDayLine.fire(32); });
  for (let i = 0; i < 60; i++) { await wait(100); if ((await page2.evaluate(() => RangeDayLine.pending)) === 0) break; }
  const ordered = (await page2.evaluate(() => RangeDayLine.day)).shots.slice(nBefore);
  assert.deepEqual(ordered.map((s) => s.yards), [1000, 200], 'the day keeps the firing order, not the landing order');
  assert.deepEqual(ordered.map((s) => s.n), [nBefore + 1, nBefore + 2]);
  // A shot still in the air when Pack up is pressed is kept, with its result: the far plate's flight is nearly two seconds.
  await line(page2, 'course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt');
  await page2.selectOption('#plate', '8');
  const shotsBefore = (await page2.evaluate(() => RangeDayLine.day)).shots.length;
  await page2.evaluate(() => { RangeDayLine.setHold(0, 0); RangeDayLine.fire(9); });
  assert.equal(await page2.evaluate(() => RangeDayLine.pending), 1, 'the bullet is in the air');
  await page2.click('#pack-up'); await page2.waitForURL(/\/day\?id=/); await page2.waitForSelector('#back');
  const packedEarly = await page2.evaluate(() => RD.finishedDays()[0]);
  assert.equal(packedEarly.shots.length, shotsBefore + 1, 'the shot in flight is in the finished day');
  const lastShot = packedEarly.shots[packedEarly.shots.length - 1];
  assert.equal(lastShot.yards, 1000); assert.equal(typeof lastShot.hit, 'boolean'); assert.equal(typeof lastShot.reached, 'boolean');
  assert.match(await page2.textContent('#shots tbody'), /1000/);
  await page2.click('#back'); await page2.waitForSelector('#fire');
  // Pack up early, then back to the range.
  const packedDay = await page2.evaluate(() => RangeDayLine.day);
  await page2.click('#pack-up'); await page2.waitForURL(/\/day\?id=/); await page2.waitForSelector('#back');
  assert.match(await page2.textContent('#facts'), /packed up early/);
  assert.equal(await page2.evaluate(() => RD.openDay()), null);
  await page2.click('#back'); await page2.waitForSelector('#fire');
  const restored = await page2.evaluate(() => RangeDayLine.day);
  assert.equal(restored.id, packedDay.id); assert.equal(restored.box.left, 15); assert.equal(restored.endedAt, null);
  assert.equal(await page2.evaluate(() => RD.finishedDays().some((x) => x.id === RangeDayLine.day.id)), false, 'it is open again, not finished');
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 7: the book: a seeded hit writes one line with every field; a miss writes none; a hit with the conditions shown writes none and its log row says so; strike and restore survive a reload; the line under the setting; a rifle with no hits shows no setting figure', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, AR);
  await page.selectOption('#plate', '0');
  assert.match(await page.textContent('#book-line'), /nothing in the book at 100 yards yet\.$/);
  const { probe, hit } = await seededHit(page, 11);
  let lines = await book(page, 'bcm-ar15', 'troy-battlesights', 'imi-m193');
  let written = (probe.hit ? 1 : 0) + 1;
  assert.equal(lines.length, written, 'one line per hit, none for a miss');
  const l = lines[lines.length - 1];
  for (const k of ['id', 'day', 'on', 'course', 'yards', 'elevationClicks', 'windageClicks', 'elevationMoa', 'windageMoa', 'leaf', 'zero', 'heldUpMoa', 'heldRightMoa', 'tempF', 'windCall', 'upIn', 'rightIn', 'struck', 'note']) assert.ok(k in l, `the line has ${k}`);
  assert.equal(l.yards, 100); assert.equal(l.course, 'angeles-sylmar'); assert.equal(l.struck, false); assert.equal(l.note, '');
  assert.equal(l.upIn, Math.round(hit.upIn * 100) / 100);
  assert.match(await page.textContent('#result'), /Written in the book/);
  console.log('  book line: ' + JSON.stringify(l));
  // A miss writes nothing.
  await page.evaluate(() => RangeDayLine.setHold(0, 40));
  const miss = await seededShot(page, 11);
  assert.equal(miss.hit, false);
  assert.equal((await book(page, 'bcm-ar15', 'troy-battlesights', 'imi-m193')).length, written);
  // A hit with "Show the conditions" on writes none; its log row says so.
  await page.check('#show-conditions');
  const shown = await seededHit(page, 12);
  assert.equal((await book(page, 'bcm-ar15', 'troy-battlesights', 'imi-m193')).length, written, 'nothing written with the conditions shown');
  assert.equal(shown.hit.conditionsShown, true);
  assert.match(await page.textContent('#log tbody tr'), /\(conditions shown\)/);
  assert.match(await page.textContent('#result'), /Not in the book: the conditions were shown/);
  await page.uncheck('#show-conditions');
  // Two more hits; the line under the view shows the newest one only (range-day-nine: the rest stay in the book, a tap away).
  const more = [await seededHit(page, 13), await seededHit(page, 14)];
  written += more.reduce((n, m) => n + (m.probe.hit ? 1 : 0) + 1, 0);
  lines = await book(page, 'bcm-ar15', 'troy-battlesights', 'imi-m193');
  assert.equal(lines.length, written);
  const under = await page.textContent('#book-line');
  assert.match(under, /^Book, 100 yards: .*clicks.*held.*wind.*F, \d+ \w{3} \d{4}$/);
  assert.equal(under.split(' · ').length, 1, 'one line: the newest');
  const newest = await page.evaluate(() => RD.bookAt('bcm-ar15', 'troy-battlesights', 'imi-m193', 100)[0]);
  const sign = (n) => (n > 0 ? `+${n}` : String(n));
  assert.ok(under.includes(`${sign(newest.elevationClicks)}/${sign(newest.windageClicks)} clicks`), `the newest line (${newest.id}): ${under}`);
  assert.ok(under.includes(`${newest.tempF} F`));
  await page.selectOption('#plate', '5');
  assert.match(await page.textContent('#book-line'), /nothing in the book at 600 yards yet; the nearest lines are at 100 yards below\.$/);
  // Strike and restore on the book page, surviving a reload.
  await page.goto(`${base}/book?${AR}`); await page.waitForSelector('.entry');
  assert.equal(await page.$$eval('.entry', (e) => e.length), written);
  assert.match(await page.textContent('.span'), new RegExp(`^${written} hits: .* minutes (up|down) from the middle \\(no zero saved\\), \\d+ F$`));
  const firstId = await page.getAttribute('.entry', 'data-id');
  await page.click('.entry .strike');
  await page.waitForSelector('.entry.struck');
  await page.reload(); await page.waitForSelector('.entry');
  assert.equal(await page.getAttribute('.entry.struck', 'data-id'), firstId, 'struck, and still struck after a reload');
  assert.match(await page.textContent('.span'), new RegExp(`^${written - 1} hit`), 'the struck line is not counted');
  assert.equal(await page.textContent('.entry.struck .strike'), 'Restore');
  await page.fill('.entry.struck .note', 'a lucky one'); await page.press('.entry.struck .note', 'Tab');
  await page.click('.entry.struck .strike');
  await page.reload(); await page.waitForSelector('.entry');
  assert.equal(await page.$$eval('.entry.struck', (e) => e.length), 0, 'restored');
  assert.equal(await page.inputValue(`.entry[data-id="${firstId}"] .note`), 'a lucky one', 'the note stays');
  // The line under the setting on the line, and the book page, for a rifle with no hits: no setting figure at all.
  await noDay(page);
  await line(page, 'course=angeles-sylmar&rifle=remington-22&sight=rem-irons&load=cci-sv-40');
  const empty = await page.textContent('#book-line');
  assert.match(empty, /nothing in the book at 100 yards yet\.$/);
  assert.doesNotMatch(empty, /clicks|MOA|minutes/);
  await page.goto(`${base}/book?course=angeles-sylmar&rifle=remington-22&sight=rem-irons&load=cci-sv-40`); await page.waitForSelector('#pages');
  const pages = await page.textContent('#pages');
  assert.match(pages, /Nothing in this book yet/); assert.doesNotMatch(pages, /clicks|minutes|\d+ F/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 8: the wind call starts at the last one, a shot fired without touching it carries it, and a call changed after the shot does not change that shot\'s row', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, AR);
  assert.equal(await page.textContent('#wind-call-text'), 'Wind as you read it: not called.');
  await page.click('[data-wind-from="right"]');
  for (let i = 0; i < 3; i++) await page.click('#wind-more');
  assert.equal(await page.textContent('#wind-call-text'), 'Wind as you read it: 8 mph from the right.');
  await page.selectOption('#plate', '0');
  const a = await seededShot(page, 21);
  assert.deepEqual(a.call, { from: 'right', mph: 8 });
  await page.reload(); await page.waitForSelector('#fire');
  assert.equal(await page.textContent('#wind-call-text'), 'Wind as you read it: 8 mph from the right.', 'starts at the last call');
  const b = await seededShot(page, 22);
  assert.deepEqual(b.call, { from: 'right', mph: 8 }, 'an untouched call is carried');
  await page.click('[data-wind-from="left"]'); await page.click('#wind-less');
  assert.equal(await page.textContent('#wind-call-text'), 'Wind as you read it: 7 mph from the left.');
  const log = await page.evaluate(() => RangeDayLine.log);
  assert.deepEqual(log[log.length - 1].call, { from: 'right', mph: 8 }, 'the earlier row is unchanged');
  const day = await page.evaluate(() => RangeDayLine.day);
  assert.deepEqual(day.shots[day.shots.length - 1].windCall, { from: 'right', mph: 8 });
  await page.click('[data-wind-from="none"]');
  const c = await seededShot(page, 23);
  assert.deepEqual(c.call, { from: 'none', mph: 0 });
  await page.click('[data-wind-from="null"]');
  const dd = await seededShot(page, 24);
  assert.equal(dd.call, null, '"not called" is allowed');
  assert.match(await page.textContent('#log tbody tr'), /not called/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 9: the cold-bore record: a day whose first shot is at steel adds one line, hit or miss; the second adds none; a day that begins at the bench adds none and its page says so', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, AR);
  assert.ok(await page.isVisible('#cold-line'));
  assert.equal(await page.textContent('#cold-line'), 'The day\'s first shot is next: it goes in the cold-bore record.');
  await page.selectOption('#plate', '0');
  const first = await seededShot(page, 31);
  let rec = await cold(page, 'bcm-ar15', 'imi-m193');
  assert.equal(rec.length, 1);
  assert.equal(rec[0].hit, first.hit); assert.equal(rec[0].yards, 100); assert.equal(rec[0].sight, 'troy-battlesights'); assert.equal(rec[0].load, 'imi-m193');
  for (const k of ['id', 'day', 'on', 'course', 'sight', 'load', 'yards', 'elevationClicks', 'windageClicks', 'leaf', 'windCall', 'tempF', 'hit', 'upIn', 'rightIn']) assert.ok(k in rec[0], `the cold-bore line has ${k}`);
  assert.ok(await page.isHidden('#cold-line'), 'the notice is gone after the first shot');
  assert.match(await page.textContent('#result'), /first shot: in the cold-bore record/);
  await seededShot(page, 32);
  assert.equal((await cold(page, 'bcm-ar15', 'imi-m193')).length, 1, 'the second shot adds none');
  console.log(`  cold-bore line: ${JSON.stringify(rec[0])}`);
  // A day that begins at the bench.
  await noDay(page);
  await bench(page, AR);
  await page.click('#fire1');
  await page.click('#to-line'); await page.waitForSelector('#fire');
  assert.ok(await page.isHidden('#cold-line'));
  await seededShot(page, 33);
  assert.equal((await cold(page, 'bcm-ar15', 'imi-m193')).length, 1, 'a day begun at the bench adds none');
  await page.click('#to-day'); await page.waitForSelector('#cold');
  assert.equal(await page.textContent('#cold'), 'No cold-bore line: the day began at the bench.');
  // The record is a section at the top of the rifle's book page, newest first.
  await page.goto(`${base}/book?${AR}`); await page.waitForSelector('#cold table');
  assert.equal(await page.$$eval('#cold tbody tr', (r) => r.length), 1);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 10: nothing on the phone is lost: a zero, a sight setting and a log written in today\'s form show on home, the bench and the line, and are still there after a whole day is shot and ended', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const before = {
    'range-day:zero:bcm-ar15:troy-battlesights:imi-m193': { elevationClicks: 3, windageClicks: -1, zeroYards: 100, sight: 'troy-battlesights', savedAt: '2026-11-17T01:00:00.000Z' },
    'range-day:sight:bcm-ar15:troy-battlesights': { elevationClicks: 3, windageClicks: -1 },
    'range-day:log:bcm-ar15:troy-battlesights:imi-m193': [{ n: 1, yards: 200, el: 3, wd: -1, zoom: 1, heldUp: 0, heldRight: 0, hit: true, where: 'hit (level, centered of center)', upIn: 0.2, rightIn: 0.1 }],
    'range-day:show-conditions': false,
    'range-day:last': { rifle: 'bcm-ar15' },
    'range-day:last:bcm-ar15': { sight: 'troy-battlesights', load: 'imi-m193', course: 'angeles-sylmar' },
  };
  await page.evaluate((b) => { for (const [k, v] of Object.entries(b)) localStorage.setItem(k, JSON.stringify(v)); }, before);
  await page.goto(`${base}/`); await page.waitForSelector('.rifle');
  assert.match(await page.textContent('.rifle[data-rifle="bcm-ar15"] .rmark'), /zeroed/);
  assert.match(await page.textContent('#zero'), /Zeroed at 100 yards.*\+3 clicks/);
  await bench(page, AR);
  assert.match(await page.textContent('#saved'), /100 yards, elevation \+3 clicks/);
  assert.match(await page.textContent('#el-text'), /\+3 clicks/);
  await line(page, AR);
  assert.match(await page.textContent('#el-text'), /\+3 clicks/);
  assert.match(await page.textContent('#log tbody'), /hit \(level, centered/);
  // A whole box: 20 shots at steel, then Pack up.
  await page.selectOption('#plate', '0');
  for (let i = 0; i < 20; i++) await seededShot(page, 40 + i);
  assert.match(await page.textContent('#rounds'), /the box of 20 is empty/);
  await page.click('#pack-up'); await page.waitForURL(/\/day\?id=/, { timeout: 10000 });
  const after = await page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, JSON.parse(localStorage.getItem(k))])), Object.keys(before));
  assert.deepStrictEqual(after['range-day:zero:bcm-ar15:troy-battlesights:imi-m193'], before['range-day:zero:bcm-ar15:troy-battlesights:imi-m193'], 'the zero is untouched');
  assert.deepStrictEqual(after['range-day:sight:bcm-ar15:troy-battlesights'], before['range-day:sight:bcm-ar15:troy-battlesights'], 'the sight setting is untouched');
  assert.deepStrictEqual(after['range-day:log:bcm-ar15:troy-battlesights:imi-m193'][0], before['range-day:log:bcm-ar15:troy-battlesights:imi-m193'][0], 'the old log row is still first');
  assert.equal(after['range-day:log:bcm-ar15:troy-battlesights:imi-m193'].length, 21);
  assert.equal(after['range-day:show-conditions'], false);
  assert.deepStrictEqual(after['range-day:last:bcm-ar15'], before['range-day:last:bcm-ar15']);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 11: "Save a copy" after a day with hits, then "Load a copy" on an empty device gives the same book, cold-bore record, day and zero; loading it twice adds nothing; a file that is not a copy is refused with its reason', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  // A zero at the bench (one day), then a day with hits at steel (its first shot at a plate: a cold-bore line) that also fires a bench group afterwards.
  await bench(page, AR);
  await page.click('#fire1'); await page.click('#save');
  await noDay(page);
  await line(page, AR);
  await page.selectOption('#plate', '0');
  await seededHit(page, 51); await seededHit(page, 52);
  await page.click('#to-zero'); await page.waitForSelector('#fire5'); await page.click('#fire5'); // bench shots in the same day: no hit flag on them
  await page.click('#pack-up'); await page.waitForURL(/\/day\?id=/);
  assert.equal(await page.evaluate(() => RD.finishedDays()[0].shots.filter((s) => s.place === 'bench').length), 5, 'the day holds five bench shots');
  await page.goto(`${base}/book?${AR}`); await page.waitForSelector('.entry');
  const bookText = await page.textContent('#pages'), coldText = await page.textContent('#cold');
  const copy = await page.evaluate(() => RangeDayBook.copy);
  const hits = await page.evaluate(() => RD.finishedDays()[0].shots.filter((s) => s.book).length);
  assert.equal(copy.kind, 'range-day copy'); assert.equal(copy.book.length, hits); assert.ok(hits >= 2); assert.equal(copy.cold_bore.length, 1); assert.equal(copy.days.length, 1); assert.equal(copy.zeros.length, 1);
  for (const k of ['rifle', 'sight', 'load', 'zeroYards', 'elevationClicks', 'windageClicks', 'leafIx', 'saved_on']) assert.ok(k in copy.zeros[0], `a zero in the copy has ${k}`);
  for (const k of ['rifle', 'sight', 'load', 'on', 'course', 'yards', 'elevationClicks', 'windageClicks', 'elevationMoa', 'windageMoa', 'leaf', 'zero', 'heldUpMoa', 'heldRightMoa', 'tempF', 'windCall', 'upIn', 'rightIn', 'struck', 'note']) assert.ok(k in copy.book[0], `a book line in the copy has ${k}`);
  for (const k of ['rifle', 'on', 'course', 'sight', 'load', 'yards', 'elevationClicks', 'windageClicks', 'leaf', 'windCall', 'tempF', 'hit', 'upIn', 'rightIn']) assert.ok(k in copy.cold_bore[0], `a cold-bore line in the copy has ${k}`);
  const text = JSON.stringify(copy);
  // An empty device.
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await page.waitForSelector('#pages');
  assert.match(await page.textContent('#pages'), /Nothing in this book yet/);
  const added = await page.evaluate((t) => RangeDayBook.loadText(t), text);
  assert.deepEqual(added.added, { zeros: 1, book: hits, cold_bore: 1, days: 1 });
  await page.reload(); await page.waitForSelector('.entry');
  assert.equal(await page.textContent('#pages'), bookText, 'the same book page');
  assert.equal(await page.textContent('#cold'), coldText, 'the same cold-bore record');
  const twice = await page.evaluate((t) => RangeDayBook.loadText(t), text);
  assert.deepEqual(twice.added, { zeros: 0, book: 0, cold_bore: 0, days: 0 }, 'loading twice adds nothing');
  await page.goto(`${base}/day`); await page.waitForSelector('#shots tbody tr');
  assert.match(await page.textContent('#facts'), /packed up early/);
  await noDay(page);
  await bench(page, AR);
  assert.match(await page.textContent('#saved'), /Saved zero for IMI M193.*100 yards/, 'the zero came back');
  // Not a copy.
  const reasons = [];
  const malformed = JSON.parse(text); malformed.book[0].yards = 'far';
  const nested = JSON.parse(text); nested.days[0].shots[1] = null;
  const landing = JSON.parse(text); const reachedShot = landing.days[0].shots.find((s) => s.reached); reachedShot.upIn = 'high';
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort().join(' '));
  for (const bad of ['{"hello": 1}', '{"kind": "range-day copy", "version": 1, "zeros": []}', '[1, 2]', '{"kind": "range-day copy", "version": 2, "zeros": [], "book": [], "cold_bore": [], "days": []}', JSON.stringify(malformed), JSON.stringify(nested), JSON.stringify(landing)]) {
    reasons.push(await page.evaluate((t) => { try { RD.loadCopy(JSON.parse(t)); return 'accepted'; } catch (e) { return e.message; } }, bad));
  }
  console.log('  refused: ' + reasons.join('\n  refused: '));
  assert.match(reasons[0], /not a Range Day copy: its "kind" is undefined/);
  assert.match(reasons[1], /not a Range Day copy: "book" is missing or not a list/);
  assert.match(reasons[2], /not a Range Day copy: the file does not hold a record/);
  assert.match(reasons[3], /not a Range Day copy: its "version" is 2; this app reads version 1/);
  assert.match(reasons[4], /not a Range Day copy: book\[0\]\.yards is "far"; it must be a number\. Nothing was loaded\./);
  assert.match(reasons[5], /not a Range Day copy: days\[0\]\.shots\[1\] is not a record \(an object with n, place, yards, elevationClicks, windageClicks, reached, upIn, rightIn\)\. Nothing was loaded\./);
  assert.match(reasons[6], /not a Range Day copy: days\[0\]\.shots\[\d+\]\.upIn is "high"; it must be a number or null\. Nothing was loaded\./);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).sort().join(' ')), keysBefore, 'a refused file wrote nothing');
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 12: the old addresses still open the Vepr with its scope, and start a day', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, 'course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt');
  assert.match(await page.textContent("#intro"), /Molot Vepr, 7.62x54R with UTG BugBuster 3-9x32/);
  const day = await page.evaluate(() => RangeDayLine.day);
  assert.equal(day.rifle, 'molot-vepr-54r'); assert.equal(day.load, 'sb-174-hpbt'); assert.equal(day.course, 'cta-piru'); assert.equal(day.box.size, 20);
  await bench(page, 'course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt');
  assert.match(await page.textContent('#intro'), /Molot Vepr, 7.62x54R, UTG BugBuster 3-9x32/);
  assert.equal((await page.evaluate(() => RangeDayZero.day)).id, day.id, 'the same day');
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 13: the phone: home with no day open shows the picks, When and both doors without scrolling for each rifle; home with a day open shows the day and its doors; the line shows the rounds, the setting and the book line with the view', { skip }, async () => {
  const { page, context, errors } = await signedIn({ width: 412, height: 915 });
  const inside = async (sels) => page.evaluate((ss) => { const h = window.innerHeight, w = window.innerWidth; return { scrollY: window.scrollY, boxes: ss.map((s) => { const b = document.querySelector(s).getBoundingClientRect(); return { sel: s, top: b.top, bottom: b.bottom, ok: b.top >= 0 && b.bottom <= h && b.left >= 0 && b.right <= w }; }) }; }, sels);
  await page.goto(`${base}/`); await page.waitForSelector('.rifle');
  const lines = [];
  for (const id of await page.$$eval('.rifle', (els) => els.map((e) => e.dataset.rifle))) {
    await page.click(`.rifle[data-rifle="${id}"]`); await page.waitForSelector(`.rifle.picked[data-rifle="${id}"]`);
    const r = await inside(['#sight', '#load', '#course', '#time', '#month', '#zero', '#go-zero', '#go-line']);
    assert.equal(r.scrollY, 0);
    for (const b of r.boxes) assert.ok(b.ok, `${id}: ${b.sel} at ${b.top.toFixed(0)}-${b.bottom.toFixed(0)} inside 915`);
    lines.push(`${id}: When bottom ${r.boxes[4].bottom.toFixed(0)}, zero line bottom ${r.boxes[5].bottom.toFixed(0)}, doors bottom ${r.boxes[7].bottom.toFixed(0)} of 915`);
    assert.match(await page.getAttribute('#go-book', 'href'), new RegExp(`rifle=${id}&`), 'the book link follows the rifle picked');
  }
  // The book link follows the sight and the load too.
  await page.click('.rifle[data-rifle="iwi-tavor-sar"]'); await page.waitForSelector('.rifle.picked[data-rifle="iwi-tavor-sar"]');
  await page.selectOption('#sight', 'pa-md25'); await page.selectOption('#load', 'federal-gmm-69');
  assert.match(await page.getAttribute('#go-book', 'href'), /rifle=iwi-tavor-sar&sight=pa-md25&load=federal-gmm-69/);
  // A day open: home shows the day, its sight pick and its doors.
  await line(page, AR); await page.selectOption('#plate', '0'); await seededShot(page, 61);
  // range-day-nine: the setting shows in the strip's own figures (#el-text, #wd-text) beside its buttons, with the rounds, the result and the book line, all above the bar.
  await page.evaluate(() => window.scrollTo(0, 0));
  const r1 = await inside(['#view', '#rounds', '#el-text', '#wd-text', '#el-up', '#wd-right', '#result', '#book-line']);
  const barTop = await page.evaluate(() => document.querySelector('.firebar').getBoundingClientRect().top);
  for (const b of r1.boxes) assert.ok(b.ok && (b.sel === '#rounds' ? b.top >= barTop : b.bottom <= barTop), `firing line: ${b.sel} at ${b.top.toFixed(0)}-${b.bottom.toFixed(0)} ${b.sel === '#rounds' ? 'inside' : 'above'} the Steady/Fire bar at ${barTop.toFixed(0)}`);
  assert.ok(await page.evaluate(() => document.getElementById('fire').contains(document.getElementById('rounds'))), 'the rounds left stand in the Fire button');
  assert.match(await page.textContent('#el-text'), /clicks/); assert.match(await page.textContent('#setting-line'), /^Elevation .* · Windage /);
  lines.push(`firing line: view ${r1.boxes[0].top.toFixed(0)}-${r1.boxes[0].bottom.toFixed(0)}, result bottom ${r1.boxes[6].bottom.toFixed(0)}, setting and buttons bottom ${r1.boxes[5].bottom.toFixed(0)}, rounds bottom ${r1.boxes[1].bottom.toFixed(0)}, book line bottom ${r1.boxes[7].bottom.toFixed(0)}, the Steady/Fire bar from ${barTop.toFixed(0)}, of 915`);
  await page.goto(`${base}/`); await page.waitForSelector('#day-card');
  const r2 = await inside(['#day-card', '#day-sight', '#day-zero', '#day-line', '#pack-up']);
  for (const b of r2.boxes) assert.ok(b.ok, `home with a day: ${b.sel} inside 915`);
  lines.push(`home with a day open: card bottom ${r2.boxes[0].bottom.toFixed(0)}, doors bottom ${r2.boxes[3].bottom.toFixed(0)}, Pack up bottom ${r2.boxes[4].bottom.toFixed(0)} of 915`);
  console.log('  ' + lines.join('\n  '));
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 4 (browser): with GUN_RECORDS_FILE naming a file with an eighth gun, home shows it after signing in through the form, and a seeded shot with it gives the engine that record\'s sight height', { skip }, async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'range-day-guns-'));
  const records = Object.entries(raw.rifles).filter(([id]) => !id.startsWith('_')).map(([id, e]) => guns.toRecord(id, e));
  const eighth = JSON.parse(JSON.stringify(guns.toRecord('bcm-ar15', raw.rifles['bcm-ar15'])));
  eighth.id = 'test-carbine'; eighth.fields.gameId = 'test-carbine'; eighth.name = 'Test carbine, 5.56';
  eighth.fields.game.sightHeightIn['troy-battlesights'] = { value: 3.4, estimate: 'a made-up height for the test, higher than the AR\'s own' };
  eighth.fields.game.firstCourse = 'cta-piru';
  records.push(eighth);
  writeFileSync(path.join(dir, 'guns.json'), JSON.stringify(records));
  const port = PORT + 1, b = `http://127.0.0.1:${port}`;
  const second = spawn('node', ['server.js'], { cwd: root, env: env({ PORT: String(port), GUN_RECORDS_FILE: path.join(dir, 'guns.json') }), stdio: ['ignore', 'ignore', 'inherit'] });
  try {
    await up(b);
    const { page, context, errors } = await signedIn(null, b);
    await page.goto(`${b}/`); await page.waitForSelector('.rifle');
    assert.equal(await page.$$eval('.rifle', (e) => e.length), 8);
    assert.equal(await page.textContent('.rifle[data-rifle="test-carbine"] .rname'), 'Test carbine, 5.56');
    await page.click('.rifle[data-rifle="test-carbine"]'); await page.waitForSelector('.rifle.picked[data-rifle="test-carbine"]');
    assert.equal(await page.inputValue('#course'), 'cta-piru', 'its first course from the record');
    await line(page, 'course=angeles-sylmar&rifle=test-carbine&sight=troy-battlesights&load=imi-m193', b);
    await page.selectOption('#plate', '0');
    await seededShot(page, 71);
    const given = await page.evaluate(() => RangeDayLine.lastShotInput);
    assert.equal(given.sightHeightIn, 3.4, 'the engine was given the record\'s sight height');
    assert.equal(Math.round(given.muzzleFps), flat.loads['imi-m193'].muzzleFps + flat.physics.powderTemperature.fpsPerDegreeF * (given.tempF - flat.physics.powderTemperature.referenceTempF), 'and the day\'s muzzle speed');
    assert.deepEqual(errors, []);
    await context.close();
  } finally { second.kill(); rmSync(dir, { recursive: true, force: true }); }
});

// range-day-nine: the firing line arranged for shooting (brief range-day-nine, task items 2, 4 and 5).
const { PHONES, SIGHTS, measure: measureReach, meets } = require('./line-reach');
test('the firing line within reach: for the Vepr\'s scope, the Tavor SAR\'s dot and the AK\'s irons (range-day-twelve: and every other sight of every rifle), at 412x915 every item of the within-reach list is inside the screen above the Steady and Fire bar, and at 1280x800 inside the screen with the bar beside the view; the view keeps its size', { skip }, async () => {
  const lines = [];
  // the view is the screen's width less the page's margins (380 px on a 412 px phone), except on a phone too short for the list,
  // where it gives up the height the list needs and is held to at least 300 px (range-day-fourteen: 378x762)
  for (const [w, h, viewPx] of [...PHONES.map(([pw, ph]) => [pw, ph, ph >= 830 ? pw - 32 : null]), [1280, 800, 640]]) {
    const { page, context, errors } = await signedIn({ width: w, height: h });
    for (const s of SIGHTS) {
      await noDay(page);
      await line(page, s.q);
      await page.evaluate(() => window.scrollTo(0, 0));
      const m = await page.evaluate(measureReach, s.glass);
      const bad = meets(m);
      lines.push(`${w}x${h} ${s.name}: view ${m.view.width}x${m.view.height}; ${m.items.filter((i) => i.shown).length} items; ${bad.length ? bad.join('; ') : 'all within reach'}`);
      assert.deepEqual(bad, [], `${w}x${h}, ${s.name}`);
      if (s.glass) assert.equal(m.items.find((i) => i.name === 'sight\'s glass control').shown, true, `${s.name}: its glass control is shown`);
      if (viewPx) { assert.equal(m.view.width, viewPx); assert.equal(m.view.height, viewPx); } else { assert.ok(m.view.width >= 300 && m.view.width <= w - 32, `${w}x${h}: the view ${m.view.width} px, at least 300`); assert.equal(m.view.height, m.view.width); }
      assert.equal(m.scrollY, 0);
      if (w < 900) for (const t of m.touch) assert.ok(t.height >= 44, `${s.name}: #${t.id} is ${t.height} px tall, under 44`);
      // The coarse buttons, where the sight has them, are in the strip, within reach too.
      if (m.coarse.length) assert.equal(m.coarseInStrip, true, `${s.name}: the 1 MOA buttons within reach`);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scroll');
      // A clamped fold has no vertical padding: a clamped text overflows into padding, which showed the top of a third line under the book line on Dan's phone.
      const pads = await page.evaluate(() => ['result', 'book-line'].map((id) => { const c = getComputedStyle(document.getElementById(id)); return `${id} ${c.paddingTop} ${c.paddingBottom}`; }));
      assert.deepEqual(pads, ['result 0px 0px', 'book-line 0px 0px']);
    }
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('  ' + lines.join('\n  '));
});

test('the firing line: nothing shifts under the thumb: the view, the sight strip and the Steady and Fire bar keep their places through a seeded miss, a seeded hit that writes a book line, the cold-bore note going, the box running empty and another opened, and each folded part opened; the page never scrolls by itself', { skip }, async () => {
  const lines = [];
  for (const [w, h] of [[412, 915], [1280, 800]]) {
    const { page, context, errors } = await signedIn({ width: w, height: h });
    await noDay(page);
    await line(page, SIGHTS[0].q);
    await page.evaluate(() => window.scrollTo(0, 0));
    const places = () => page.evaluate(() => { const b = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10); }; return { view: b('#view'), strip: b('.strip'), bar: b('.firebar'), scrollY: window.scrollY }; });
    const start = await places();
    lines.push(`${w}x${h} before (left, top, width, height): view [${start.view.join(', ')}], strip [${start.strip.join(', ')}], bar [${start.bar.join(', ')}]`);
    const same = async (what) => {
      const now = await places();
      const d = ['view', 'strip', 'bar'].map((k) => now[k].map((v, i) => Math.abs(v - start[k][i])).reduce((a, b) => Math.max(a, b), 0));
      const at = (k) => `${k} [${now[k].join(', ')}]`; // left, top, width, height in pixels
      lines.push(`${w}x${h} ${what}: ${at('view')}, ${at('strip')}, ${at('bar')}; moved view ${d[0]}, strip ${d[1]}, bar ${d[2]} px; scrolled ${now.scrollY}`);
      assert.deepEqual(d, [0, 0, 0], `${w}x${h} ${what}: ${JSON.stringify(now)} against ${JSON.stringify(start)}`);
      assert.equal(now.scrollY, 0, `${w}x${h} ${what}: the page did not scroll`);
    };
    assert.ok(await page.isVisible('#cold-line'), 'the cold-bore note shows before the first shot');
    // A seeded miss, the day's first shot: the cold-bore note goes, the result arrives.
    await page.evaluate(() => RangeDayLine.setHold(0, 60));
    const miss = await seededShot(page, 81);
    assert.equal(miss.hit, false);
    assert.ok(await page.isHidden('#cold-line'));
    await same('after a seeded miss (the cold-bore note gone)');
    // The result's fold opened (a longer result than two lines opens over what is below it) and closed. On the phone the first
    // shot's result (where it landed, "Watch the dust", the cold-bore note) is longer than two lines; wider, it may fit.
    const long = await page.evaluate(() => document.getElementById('result').classList.contains('long'));
    if (w === 412) assert.equal(long, true, 'the first shot\'s result is longer than two lines and is marked');
    if (long) {
      await page.click('#result');
      assert.equal(await page.evaluate(() => document.getElementById('result').classList.contains('open')), true);
      await same('with the result opened');
      await page.click('#result');
      assert.equal(await page.evaluate(() => document.getElementById('result').classList.contains('open')), false);
    }
    // A seeded hit that writes a book line.
    const before = (await book(page, 'molot-vepr-54r', 'utg-bugbuster-3-9x32', 'sb-174-hpbt')).length;
    await seededHit(page, 82);
    assert.ok((await book(page, 'molot-vepr-54r', 'utg-bugbuster-3-9x32', 'sb-174-hpbt')).length > before, 'a book line was written');
    assert.match(await page.textContent('#book-line'), /^Book, 200 yards: /);
    await same('after a seeded hit that wrote a book line');
    // The short line opened, then closed.
    await page.click('#line-head');
    assert.ok(await page.isVisible('#line-full')); assert.match(await page.textContent('#line-full'), /Molot Vepr, 7.62x54R with UTG BugBuster/);
    await same('with the full description opened');
    await page.click('#line-head');
    assert.ok(await page.isHidden('#line-full'));
    // The box runs empty: "Open another box" shows beside the result; opened, it goes.
    await page.evaluate(() => RD.takeRounds(RangeDayLine.day, RangeDayLine.day.box.left - 1));
    await seededShot(page, 83);
    assert.ok(await page.isVisible('#another-box'), '"Open another box" is offered');
    const ab = await page.evaluate(() => { const r = document.getElementById('another-box').getBoundingClientRect(), f = document.querySelector('.firebar').getBoundingClientRect(); return { bottom: r.bottom, barTop: f.top, h: window.innerHeight }; });
    assert.ok(ab.bottom <= ab.h && (w > 1000 || ab.bottom <= ab.barTop), `"Open another box" within reach: ${JSON.stringify(ab)}`);
    await same('with the box empty and "Open another box" shown');
    await page.click('#another-box');
    assert.ok(await page.isHidden('#another-box'));
    await same('after another box was opened');
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log('  ' + lines.join('\n  '));
});

test('range-day-eleven verify 5: a device that kept a zero, a sight setting, a shot log and a book line under the Vepr\'s old scope (the 2-7x44) finds them all under the BugBuster that took its place, by the old address and the new; the old records stay stored, byte for byte; a copy of the book holds each once', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const OLD = 'utg-2-7x44', NEW = 'utg-bugbuster-3-9x32', R = 'molot-vepr-54r', L = 'sb-174-hpbt';
  const bookLine = { id: 'old-day:1', day: 'old-day', on: '2026-11-20', at: '2026-11-20T17:00:00.000Z', n: 1, course: 'cta-piru', yards: 600, target: 'steel', elevationClicks: 52, windageClicks: 3, elevationMoa: 13, windageMoa: 0.75, leaf: null, zero: { zeroYards: 100, elevationClicks: 31, windageClicks: -13 }, heldUpMoa: 0, heldRightMoa: 0, tempF: 61, windCall: null, upIn: 1.2, rightIn: -0.8, struck: false, note: 'kept under the old scope' };
  const seeded = {
    [`range-day:sight:${R}:${OLD}`]: { elevationClicks: 47, windageClicks: -9 },
    [`range-day:zero:${R}:${OLD}:${L}`]: { elevationClicks: 31, windageClicks: -13, zeroYards: 100, sight: OLD, savedAt: '2026-11-20T16:00:00.000Z' },
    [`range-day:log:${R}:${OLD}:${L}`]: [{ n: 1, yards: 600, el: 52, wd: 3, zoom: 7, heldUp: 0, heldRight: 0, hit: true, where: 'hit (1.2 in high, 0.8 in left of center)', upIn: 1.2, rightIn: -0.8 }],
    [`range-day:book:${R}:${OLD}:${L}`]: [bookLine],
  };
  await page.evaluate((s) => { localStorage.clear(); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); }, seeded);
  const before = await page.evaluate(() => Object.keys(localStorage).sort());
  // The sight setting as it was left on the old scope is the BugBuster's (read before the line opens, which starts the sight at the zero).
  await page.goto(`${base}/`); await page.waitForSelector('.rifle');
  assert.deepEqual(await page.evaluate(async ([r, s]) => { await RD.data(); return RD.getSight(r, s); }, [R, NEW]), { elevationClicks: 47, windageClicks: -9 });
  const carriedSetting = await page.evaluate((k) => localStorage.getItem(k), `range-day:sight:${R}:${NEW}`);
  assert.equal(carriedSetting, JSON.stringify(seeded[`range-day:sight:${R}:${OLD}`]), 'written forward under the BugBuster');
  // The old address, naming the old scope: the line opens the BugBuster, its sight at the old zero (as the line always starts a saved zero), and the old log.
  await line(page, `course=cta-piru&rifle=${R}&sight=${OLD}&load=${L}`);
  assert.match(await page.textContent('#intro'), /UTG BugBuster 3-9x32/);
  assert.match(await page.textContent('#el-text'), /\+31 clicks/, 'the sight starts at the saved zero');
  assert.match(await page.textContent('#wd-text'), /−13 clicks \(3\.25 MOA left\)/);
  assert.match(await page.textContent('#zero-note'), /saved 100-yard zero/, 'the saved zero');
  assert.match(await page.textContent('#log tbody'), /1\.2 in high/, 'the log');
  // The new address too, and the bench.
  await line(page, `course=cta-piru&rifle=${R}&sight=${NEW}&load=${L}`);
  assert.match(await page.textContent('#el-text'), /\+31 clicks/);
  assert.match(await page.textContent('#log tbody'), /1\.2 in high/);
  await bench(page, `course=cta-piru&rifle=${R}&sight=${NEW}&load=${L}`);
  assert.match(await page.textContent('#saved'), /100 yards, elevation \+31 clicks/);
  // The book page, by the old address: the old line is on the BugBuster's page.
  await page.goto(`${base}/book?course=cta-piru&rifle=${R}&sight=${OLD}&load=${L}`); await page.waitForSelector('#pages');
  assert.equal(await page.inputValue('#sight'), NEW);
  assert.equal(await page.locator('#pages .entry').count(), 1, 'the old book line');
  assert.deepEqual((await book(page, R, NEW, L)).map((l) => l.id), [bookLine.id]);
  // Every old record is still stored as it was; the new ones hold the same.
  const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  for (const [k, v] of Object.entries(seeded)) {
    assert.equal(after[k], JSON.stringify(v), `${k} is stored, unchanged`);
    // the sight setting has since moved to the zero on the line, as a setting does; the rest still hold what was carried
    if (!k.startsWith('range-day:sight:')) assert.equal(after[k.replace(`:${OLD}`, `:${NEW}`)], JSON.stringify(v), `${k.replace(`:${OLD}`, `:${NEW}`)} carries it`);
    else assert.ok(after[k.replace(`:${OLD}`, `:${NEW}`)], 'the BugBuster\'s setting is stored');
  }
  console.log(`  stored keys before: ${before.join(', ')}`);
  console.log(`  stored keys after:  ${Object.keys(after).join(', ')}`);
  // The copy file: the zero and the book line once each, under the BugBuster.
  const copy = await page.evaluate(() => RD.makeCopy());
  assert.deepEqual(copy.zeros.filter((z) => z.rifle === R).map((z) => z.sight), [NEW]);
  assert.deepEqual(copy.book.filter((l) => l.rifle === R).map((l) => `${l.sight} ${l.id}`), [`${NEW} ${bookLine.id}`]);
  // The Vepr's irons are not the old scope: nothing is carried to them.
  await line(page, `course=cta-piru&rifle=${R}&sight=vepr-irons&load=${L}`);
  assert.match(await page.textContent('#zero-note'), /No zero saved/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('range-day-twelve verify 5: for each rifle whose sight changed, a device that kept a zero, a sight setting, a shot log and a book line under the old sight: where the new sight clicks alike and sits at the same height they are its own (the 5.45 rifle\'s ball post); where it does not they stay readable under the old name and the new sight starts unzeroed (the BCM, both Tavors, the 7.62x39 rifle); where the sight kept its id nothing moves (the Vepr\'s irons). Old records stay stored, byte for byte.', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  const CASES = [
    { rifle: 'bcm-ar15', old: 'ar-irons', now: 'troy-battlesights', load: 'imi-m193', course: 'angeles-sylmar', carried: false },
    { rifle: 'iwi-tavor-sar', old: 'tavor-irons', now: 'fab-flipup', load: 'imi-m193', course: 'angeles-sylmar', carried: false },
    { rifle: 'iwi-x95', old: 'tavor-irons', now: 'fab-flipup', load: 'imi-m193', course: 'angeles-sylmar', carried: false },
    { rifle: 'ak-762', old: 'ak-irons', now: 'ak762-kns-peep', load: 'silver-bear-123', course: 'angeles-sylmar', carried: false },
    { rifle: 'ak-545', old: 'ak-irons', now: 'ak545-ball', load: 'hornady-545-60', course: 'angeles-sylmar', carried: true },
    { rifle: 'molot-vepr-54r', old: 'vepr-irons', now: 'vepr-irons', load: 'sb-174-hpbt', course: 'cta-piru', carried: true },
  ];
  const lineOf = (c) => ({ id: `old-day-${c.rifle}:1`, day: `old-day-${c.rifle}`, on: '2026-11-20', at: '2026-11-20T17:00:00.000Z', n: 1, course: c.course, yards: 200, target: 'steel', elevationClicks: 3, windageClicks: -2, elevationMoa: 6, windageMoa: -4, leaf: null, zero: { zeroYards: 100, elevationClicks: 2, windageClicks: -2 }, heldUpMoa: 0, heldRightMoa: 0, tempF: 60, windCall: null, upIn: 0.7, rightIn: -0.4, struck: false, note: '' });
  const seeded = {};
  for (const c of CASES) {
    seeded[`range-day:sight:${c.rifle}:${c.old}`] = { elevationClicks: 5, windageClicks: -3 };
    seeded[`range-day:zero:${c.rifle}:${c.old}:${c.load}`] = { elevationClicks: 2, windageClicks: -2, zeroYards: 100, sight: c.old, savedAt: '2026-11-20T16:00:00.000Z' };
    seeded[`range-day:log:${c.rifle}:${c.old}:${c.load}`] = [{ n: 1, yards: 200, el: 3, wd: -2, zoom: 1, heldUp: 0, heldRight: 0, hit: true, where: 'hit (0.7 in high, 0.4 in left of center)', upIn: 0.7, rightIn: -0.4 }];
    seeded[`range-day:book:${c.rifle}:${c.old}:${c.load}`] = [lineOf(c)];
  }
  await page.evaluate((s) => { localStorage.clear(); localStorage.setItem('range-day:picture', JSON.stringify('plain')); for (const [k, v] of Object.entries(s)) localStorage.setItem(k, JSON.stringify(v)); }, seeded);
  const before = await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'range-day:picture').sort());
  const report = [];
  for (const c of CASES) {
    await line(page, `course=${c.course}&rifle=${c.rifle}&sight=${c.old}&load=${c.load}`); // the old address
    const intro = await page.textContent('#intro'), note = await page.textContent('#zero-note'), log = await page.textContent('#log');
    assert.match(intro, new RegExp(flat.sights[c.now].name.replace(/ \(.*\)$/, '').replace(/[()]/g, '.')), `${c.rifle}: the old address opens the sight now on the rifle`);
    const S = flat.sights[c.now], O = flat.sights[c.old], H = flat.rifles[c.rifle].sightHeightIn[c.now];
    const figures = `click ${O.clickMoa}/${O.windageClickMoa} MOA before, ${S.clickMoa}/${S.windageClickMoa} now; height over the bore ${c.old === c.now ? H : { 'ar-irons': 2.6, 'tavor-irons': 3, 'ak-irons': 1.9 }[c.old]} in before, ${H} in now`;
    if (c.carried) {
      assert.match(note, /saved 100-yard zero/, `${c.rifle}: the zero is the new sight's`);
      assert.match(await page.textContent('#el-text'), /\+2 clicks/);
      assert.match(log, /0\.7 in high/, `${c.rifle}: the log is the new sight's`);
      assert.deepEqual((await book(page, c.rifle, c.now, c.load)).map((l) => l.id), [lineOf(c).id], `${c.rifle}: the book line is the new sight's`);
    } else {
      assert.match(note, /No zero saved/, `${c.rifle}: the new sight starts unzeroed`);
      assert.doesNotMatch(log, /0\.7 in high/, `${c.rifle}: the old log is not the new sight's`);
      assert.deepEqual(await book(page, c.rifle, c.now, c.load), []);
      // the old book page stays readable, under the old sight's name
      await page.goto(`${base}/book?course=${c.course}&rifle=${c.rifle}&sight=${c.old}&load=${c.load}`); await page.waitForSelector('#pages');
      assert.equal(await page.inputValue('#sight'), c.old, `${c.rifle}: the book opens the old sight's page`);
      assert.match(await page.textContent('#sight'), /no longer on this rifle/);
      assert.equal(await page.locator('#pages .entry').count(), 1, `${c.rifle}: the old book line`);
    }
    report.push(`${c.rifle}: ${c.old === c.now ? `${c.now} kept its id: nothing moves` : c.carried ? `${c.now} carries ${c.old}` : `${c.now} starts unzeroed; ${c.old}'s records stay readable under its name`} (${figures})`);
  }
  const after = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
  for (const [k, v] of Object.entries(seeded)) if (!k.startsWith('range-day:sight:')) assert.equal(after[k], JSON.stringify(v), `${k} is stored, unchanged`);
  for (const c of CASES.filter((x) => !x.carried)) for (const p of ['zero', 'log', 'book']) assert.equal(after[`range-day:${p}:${c.rifle}:${c.now}:${c.load}`], undefined, `nothing of ${c.old} is written forward as ${c.now} on ${c.rifle}`);
  const copy = await page.evaluate(() => RD.makeCopy());
  for (const c of CASES) assert.deepEqual(copy.book.filter((l) => l.rifle === c.rifle).map((l) => l.sight), [c.carried ? c.now : c.old], `${c.rifle}: the copy holds the book line once, under ${c.carried ? 'the sight that carries it' : 'the old name'}`);
  console.log('  ' + report.join('\n  '));
  console.log(`  stored keys before: ${before.join(', ')}`);
  console.log(`  stored keys after:  ${Object.keys(after).filter((k) => !/^range-day:(picture|day|days|last|when|supply|wind-call)/.test(k)).join(', ')}`);
  console.log(`  rifles that need zeroing again: ${CASES.filter((c) => !c.carried).map((c) => c.rifle).join(', ')}`);
  assert.deepEqual(errors, []);
  await context.close();
});
