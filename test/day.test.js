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
const noDay = (page) => page.evaluate(() => { localStorage.removeItem('range-day:day:open'); localStorage.removeItem('range-day:day:packed'); });
const AR = 'course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193';
const line = async (page, q, b) => { await page.goto(`${b || base}/line?${q}`); await page.waitForSelector('#fire'); };
const bench = async (page, q) => { await page.goto(`${base}/zero?${q}`); await page.waitForSelector('#fire5'); };
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

test('verify 5: the box: a new day shows the load\'s full box; five on the bench and one at steel leave six fewer; with three left "Fire five" fires three; at none the bench and the line refuse and say the day is over; the day\'s page lists every shot', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await bench(page, AR);
  assert.equal(await page.textContent('#rounds'), '20 of 20 rounds left', 'IMI M193 comes in a box of 20');
  assert.match(await page.textContent('#day-line'), /^A (cold|cool|mild|warm|hot)(, dry)? \w+ (morning|midday|afternoon), \d+ F\.$/);
  await page.click('#fire5');
  assert.equal(await page.textContent('#rounds'), '15 of 20 rounds left');
  await page.click('#to-line'); await page.waitForSelector('#fire');
  assert.equal(await page.textContent('#rounds'), '15 of 20 rounds left', 'the line continues the same day');
  await page.selectOption('#plate', '0');
  await seededShot(page, 1);
  assert.equal(await page.textContent('#rounds'), '14 of 20 rounds left', 'six fewer');
  for (let i = 0; i < 11; i++) await seededShot(page, 2 + i);
  assert.equal(await page.textContent('#rounds'), '3 of 20 rounds left');
  const day = await page.evaluate(() => RangeDayLine.day);
  await page.goto(`${base}/zero?${AR}`); await page.waitForSelector('#fire5');
  assert.equal(await page.textContent('#rounds'), '3 of 20 rounds left');
  await page.click('#fire5');
  const holes = await page.evaluate(() => RangeDayZero.holes.length);
  assert.equal(holes, 3, '"Fire five" with three left fires three');
  assert.match(await page.textContent('#rounds'), /the box of 20 is empty: the day is over/);
  assert.match(await page.textContent('#group'), /last round.*the day is over/);
  assert.ok(await page.isDisabled('#fire5') && await page.isDisabled('#fire1'), 'the bench stops firing');
  const before = await page.evaluate(() => RangeDayZero.holes.length);
  await page.click('#fire1', { force: true }).catch(() => {});
  assert.equal(await page.evaluate(() => RangeDayZero.holes.length), before, 'no more holes');
  // The day's page lists every shot: 5 + 12 + 3 = 20.
  await page.goto(`${base}/day?id=${encodeURIComponent(day.id)}`); await page.waitForSelector('#shots tbody tr');
  assert.equal(await page.$$eval('#shots tbody tr', (r) => r.length), 20);
  assert.match(await page.textContent('#facts'), /a box of 20, 20 fired, 0 left; ended when the box was empty/);
  console.log(`  box of 20: 5 at the bench, 12 at steel, then "Fire five" fired 3; the day's page lists ${await page.$$eval('#shots tbody tr', (r) => r.length)} shots`);
  // The line refuses too, on a day that ends at steel (a finished day is finished: the line opened again is a new day, so the box empties here).
  await line(page, AR);
  assert.equal(await page.textContent('#rounds'), '20 of 20 rounds left', 'a new day: the finished one is kept on its page');
  await page.selectOption('#plate', '0');
  for (let i = 0; i < 20; i++) await seededShot(page, 100 + i);
  assert.match(await page.textContent('#rounds'), /the box of 20 is empty: the day is over/);
  assert.match(await page.textContent('#result'), /The box of 20 is empty: the day is over/);
  const logBefore = await page.evaluate(() => RangeDayLine.log.length + RangeDayLine.pending);
  await page.evaluate(() => RangeDayLine.fire(3));
  await wait(300);
  assert.equal(await page.evaluate(() => RangeDayLine.log.length + RangeDayLine.pending), logBefore, 'nothing fired');
  assert.match(await page.textContent('#result'), /The day is over: the box of 20 is empty/);
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 6: a day stays open across a reload with the same rounds and weather; a day with no shot leaves no record; Pack up, then "Back to the range" restores it', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, 'course=cta-piru&rifle=molot-vepr-54r&sight=utg-2-7x44&load=sb-174-hpbt');
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
  assert.equal(await page2.textContent('#rounds'), '20 of 20 rounds left');
  await page2.goto(`${base}/`); await page2.waitForSelector('.rifle');
  assert.ok(await page2.isHidden('#open-day'), 'home shows the picks: a day with no shot is nothing yet');
  await line(page2, 'course=cta-piru&rifle=molot-vepr-54r&sight=utg-2-7x44&load=sb-174-hpbt');
  assert.equal((await page2.evaluate(() => RangeDayLine.day)).rifle, 'molot-vepr-54r', 'another choice simply replaces the shotless day');
  assert.equal(await page2.evaluate(() => RD.finishedDays().length), daysBefore, 'no record was kept');
  // An address naming another rifle (and a sight the open rifle does not carry) opens the open day, with a sight the open rifle carries, and says so.
  await seededShot(page2, 7);
  await line(page2, 'course=angeles-sylmar&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193');
  const redirected = await page2.evaluate(() => RangeDayLine.day);
  assert.equal(redirected.rifle, 'molot-vepr-54r', 'the open day wins over the address');
  assert.match(await page2.textContent('#intro'), /Molot Vepr.*UTG AccuShot/, 'with a sight the Vepr carries, not the Tavor\'s dot');
  assert.match(await page2.textContent('#day-line'), /A day is already open with the Molot Vepr/);
  assert.ok(await page2.isHidden('#magrow'), 'no magnifier control: the Vepr has none');
  const given = await page2.evaluate(async () => { RangeDayLine.setHold(0, 0); RangeDayLine.fire(8); await new Promise((r) => setTimeout(r, 1500)); return RangeDayLine.lastShotInput; });
  assert.equal(given.sightHeightIn, flat.rifles['molot-vepr-54r'].sightHeightIn['utg-2-7x44'], 'the engine is given the open rifle\'s own sight height');
  // Pack up early, then back to the range.
  const packedDay = await page2.evaluate(() => RangeDayLine.day);
  await page2.click('#pack-up'); await page2.waitForURL(/\/day\?id=/); await page2.waitForSelector('#back');
  assert.match(await page2.textContent('#facts'), /packed up early/);
  assert.equal(await page2.evaluate(() => RD.openDay()), null);
  await page2.click('#back'); await page2.waitForSelector('#fire');
  const restored = await page2.evaluate(() => RangeDayLine.day);
  assert.equal(restored.id, packedDay.id); assert.equal(restored.box.left, 18); assert.equal(restored.endedAt, null);
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
  let lines = await book(page, 'bcm-ar15', 'ar-irons', 'imi-m193');
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
  assert.equal((await book(page, 'bcm-ar15', 'ar-irons', 'imi-m193')).length, written);
  // A hit with "Show the conditions" on writes none; its log row says so.
  await page.check('#show-conditions');
  const shown = await seededHit(page, 12);
  assert.equal((await book(page, 'bcm-ar15', 'ar-irons', 'imi-m193')).length, written, 'nothing written with the conditions shown');
  assert.equal(shown.hit.conditionsShown, true);
  assert.match(await page.textContent('#log tbody tr'), /\(conditions shown\)/);
  assert.match(await page.textContent('#result'), /Not in the book: the conditions were shown/);
  await page.uncheck('#show-conditions');
  // Two more hits, so the line under the setting shows the two newest.
  const more = [await seededHit(page, 13), await seededHit(page, 14)];
  written += more.reduce((n, m) => n + (m.probe.hit ? 1 : 0) + 1, 0);
  lines = await book(page, 'bcm-ar15', 'ar-irons', 'imi-m193');
  assert.equal(lines.length, written);
  const under = await page.textContent('#book-line');
  assert.match(under, /^Book, 100 yards: .*clicks.*held.*wind.*F, \d+ \w{3} \d{4} · .*clicks/);
  assert.equal(under.split(' · ').length, 2, 'two lines, no more');
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
  assert.equal(rec[0].hit, first.hit); assert.equal(rec[0].yards, 100); assert.equal(rec[0].sight, 'ar-irons'); assert.equal(rec[0].load, 'imi-m193');
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
    'range-day:zero:bcm-ar15:ar-irons:imi-m193': { elevationClicks: 3, windageClicks: -1, zeroYards: 100, sight: 'ar-irons', savedAt: '2026-11-17T01:00:00.000Z' },
    'range-day:sight:bcm-ar15:ar-irons': { elevationClicks: 3, windageClicks: -1 },
    'range-day:log:bcm-ar15:ar-irons:imi-m193': [{ n: 1, yards: 200, el: 3, wd: -1, zoom: 1, heldUp: 0, heldRight: 0, hit: true, where: 'hit (level, centered of center)', upIn: 0.2, rightIn: 0.1 }],
    'range-day:show-conditions': false,
    'range-day:last': { rifle: 'bcm-ar15' },
    'range-day:last:bcm-ar15': { sight: 'ar-irons', load: 'imi-m193', course: 'angeles-sylmar' },
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
  // A whole day: 20 shots at steel, then the day is over.
  await page.selectOption('#plate', '0');
  for (let i = 0; i < 20; i++) await seededShot(page, 40 + i);
  assert.match(await page.textContent('#rounds'), /the day is over/);
  const after = await page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, JSON.parse(localStorage.getItem(k))])), Object.keys(before));
  assert.deepStrictEqual(after['range-day:zero:bcm-ar15:ar-irons:imi-m193'], before['range-day:zero:bcm-ar15:ar-irons:imi-m193'], 'the zero is untouched');
  assert.deepStrictEqual(after['range-day:sight:bcm-ar15:ar-irons'], before['range-day:sight:bcm-ar15:ar-irons'], 'the sight setting is untouched');
  assert.deepStrictEqual(after['range-day:log:bcm-ar15:ar-irons:imi-m193'][0], before['range-day:log:bcm-ar15:ar-irons:imi-m193'][0], 'the old log row is still first');
  assert.equal(after['range-day:log:bcm-ar15:ar-irons:imi-m193'].length, 21);
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
  const keysBefore = await page.evaluate(() => Object.keys(localStorage).sort().join(' '));
  for (const bad of ['{"hello": 1}', '{"kind": "range-day copy", "version": 1, "zeros": []}', '[1, 2]', '{"kind": "range-day copy", "version": 2, "zeros": [], "book": [], "cold_bore": [], "days": []}', JSON.stringify(malformed), JSON.stringify(nested)]) {
    reasons.push(await page.evaluate((t) => { try { RD.loadCopy(JSON.parse(t)); return 'accepted'; } catch (e) { return e.message; } }, bad));
  }
  console.log('  refused: ' + reasons.join('\n  refused: '));
  assert.match(reasons[0], /not a Range Day copy: its "kind" is undefined/);
  assert.match(reasons[1], /not a Range Day copy: "book" is missing or not a list/);
  assert.match(reasons[2], /not a Range Day copy: the file does not hold a record/);
  assert.match(reasons[3], /not a Range Day copy: its "version" is 2; this app reads version 1/);
  assert.match(reasons[4], /not a Range Day copy: book\[0\]\.yards is "far"; it must be a number\. Nothing was loaded\./);
  assert.match(reasons[5], /not a Range Day copy: days\[0\]\.shots\[1\] is not a record \(an object with n, place, yards, elevationClicks, windageClicks, hit, reached\)\. Nothing was loaded\./);
  assert.equal(await page.evaluate(() => Object.keys(localStorage).sort().join(' ')), keysBefore, 'a refused file wrote nothing');
  assert.deepEqual(errors, []);
  await context.close();
});

test('verify 12: the old addresses still open the Vepr with its scope, and start a day', { skip }, async () => {
  const { page, context, errors } = await signedIn();
  await line(page, 'course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt');
  assert.match(await page.textContent("#intro"), /Molot Vepr, 7.62x54R with UTG AccuShot 2-7x44/);
  const day = await page.evaluate(() => RangeDayLine.day);
  assert.equal(day.rifle, 'molot-vepr-54r'); assert.equal(day.load, 'sb-174-hpbt'); assert.equal(day.course, 'cta-piru'); assert.equal(day.box.size, 20);
  await bench(page, 'course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt');
  assert.match(await page.textContent('#intro'), /Molot Vepr, 7.62x54R, UTG AccuShot 2-7x44/);
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
  }
  // A day open: home shows the day, its sight pick and its doors.
  await line(page, AR); await page.selectOption('#plate', '0'); await seededShot(page, 61);
  const r1 = await inside(['#view', '#rounds', '#setting-line', '#book-line']);
  const barTop = await page.evaluate(() => document.querySelector('.firebar').getBoundingClientRect().top);
  for (const b of r1.boxes) assert.ok(b.ok && b.bottom <= barTop, `firing line: ${b.sel} at ${b.top.toFixed(0)}-${b.bottom.toFixed(0)} above the Steady/Fire bar at ${barTop.toFixed(0)}`);
  lines.push(`firing line: view ${r1.boxes[0].top.toFixed(0)}-${r1.boxes[0].bottom.toFixed(0)}, rounds and setting bottom ${r1.boxes[2].bottom.toFixed(0)}, book line bottom ${r1.boxes[3].bottom.toFixed(0)}, the Steady/Fire bar from ${barTop.toFixed(0)}, of 915`);
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
  eighth.id = 'test-carbine'; eighth.name = 'Test carbine, 5.56';
  eighth.fields.game.sightHeightIn['ar-irons'] = { value: 3.4, estimate: 'a made-up height for the test, higher than the AR\'s own' };
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
    await line(page, 'course=angeles-sylmar&rifle=test-carbine&sight=ar-irons&load=imi-m193', b);
    await page.selectOption('#plate', '0');
    await seededShot(page, 71);
    const given = await page.evaluate(() => RangeDayLine.lastShotInput);
    assert.equal(given.sightHeightIn, 3.4, 'the engine was given the record\'s sight height');
    assert.equal(Math.round(given.muzzleFps), flat.loads['imi-m193'].muzzleFps + flat.physics.powderTemperature.fpsPerDegreeF * (given.tempF - flat.physics.powderTemperature.referenceTempF), 'and the day\'s muzzle speed');
    assert.deepEqual(errors, []);
    await context.close();
  } finally { second.kill(); rmSync(dir, { recursive: true, force: true }); }
});
