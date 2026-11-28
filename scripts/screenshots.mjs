// Drives the app in a real browser and saves every screen at phone size
// (412×915) and computer size (1280×800) into docs/reports/screenshots/.
// It signs in the way a person does: it opens the sign-in page and types
// the passphrase (with a space after it, as a phone keyboard adds) into the
// form. Never pre-supplied credentials. Along the way it checks no screen
// scrolls sideways.
//   npm run screenshots                 every state, both sizes
//   npm run screenshots -- --shard 2/4  the states whose index leaves 1 when
//       divided by 4 (every fourth state from the second), both sizes: the
//       four shards together are every state once; scripts/check.mjs and the
//       Checks workflow run the shards side by side
//   --grep '^ground-'                   only the states whose names match (a
//       before-and-after pair by hand; the check runs every state)
//   --port 8923                         the server's port (one per shard
//       running at once); --list prints the state names and stops
// Every state's seconds are printed, so the slow ones can be seen.
// An app adds its own screens to SCREENS.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'reports', 'screenshots');
mkdirSync(out, { recursive: true });

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const [shardIx, shardOf] = arg('--shard', '1/1').split('/').map(Number);
if (!(shardIx >= 1 && shardOf >= 1 && shardIx <= shardOf)) { console.error(`--shard wants i/n with 1 <= i <= n, not ${arg('--shard')}`); process.exit(2); }
export const PORT = Number(arg('--port', 8921));
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const SIZES = { phone: { width: 412, height: 915 }, computer: { width: 1280, height: 800 }, small: { width: 378, height: 762 } }; // small: only the states marked small (range-day-seventeen: the workbench's screens)
// Range Day's screens. `act` drives the screen into the state the brief asks
// to see before the screenshot; `expect` is text the screen must show.
const PIRU = '/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
// range-day-eleven: the ground states below keep the views they were made at, the old 2-7x44's 7x view (4 ft at 100 yards)
// and its 21x test view (1.33 ft), reached through the page's zoom door on the BugBuster's own field-of-view rule (test/scene.test.js
// verify 6 measures the same views against docs/reports/ground-before.txt). Test views, not a sight in the game.
const VEPR_SCOPE = JSON.parse(readFileSync(join(root, 'data', 'sights.json'), 'utf8'))['utg-bugbuster-3-9x32'];
const powerFor = (ftAt100) => { const z = VEPR_SCOPE.zoom, f = VEPR_SCOPE.fovFtAt100, p = Math.log(f.low.value / f.high.value) / Math.log(z.high.value / z.low.value); return z.low.value * Math.pow(f.low.value / ftAt100, 1 / p); };
const OLD7 = powerFor((14 * 2) / 7), OLD21 = powerFor((14 * 2) / 21);
const ZERO = '/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
const SYLMAR = '/line?course=angeles-sylmar';
const settle = (page, ms) => page.waitForTimeout(ms);
// The firing line is ready when its picture is: the scene built (Full or Light) and its photographed ground surfaces settled (range-day-eight), or Plain shown.
const ready = async (page) => { await page.waitForSelector('#fire'); await page.waitForFunction(() => window.RangeDayLine && (RangeDayLine.scene || RangeDayLine.sceneFailed || (!RangeDayLine.sceneLoading && RangeDayLine.picture === 'plain')), null, { timeout: 90000 }); await page.waitForFunction(() => !RangeDayLine.scene || !RangeDayLine.scene.materials || RangeDayLine.scene.materials.settled, null, { timeout: 90000 }); await settle(page, 400); };
const plate = async (page, ix) => { await ready(page); await page.selectOption('#plate', String(ix)); await settle(page, 400); };
// Clears what this device keeps for a rifle and sight, so a state starts from the middle.
const fresh = (page, rifle, sight) => page.evaluate(([r, s]) => { for (const k of Object.keys(localStorage)) if (k.startsWith(`range-day:sight:${r}:${s}`) || k.startsWith(`range-day:zero:${r}:`) || k.startsWith(`range-day:log:${r}:`)) localStorage.removeItem(k); }, [rifle, sight]);
// Closes the open day, so a screen opens on the choice its address makes (an open day with shots wins over the address). Every screen starts that way unless it says keepDay.
const noDay = (page) => page.evaluate(() => { localStorage.removeItem('range-day:day:open'); localStorage.removeItem('range-day:day:packed'); for (const k of Object.keys(localStorage)) if (k.startsWith('range-day:supply:')) localStorage.removeItem(k); localStorage.setItem('range-day:picture', JSON.stringify('full')); localStorage.removeItem('range-day:aim'); }); // a fresh day, a full zeroing supply and the Full picture before each state (a state that wants another picture sets it); aiming by drag (range-day-sixteen)
const picture = (page, v) => page.evaluate((p) => localStorage.setItem('range-day:picture', JSON.stringify(p)), v);
// The shot just fired has landed (the picture's clock runs slower than the wall's where frames are slow, so the flight is waited out, not timed).
const landed = (page) => page.waitForFunction(() => RangeDayLine.pending === 0, null, { timeout: 30000 });
// A seeded shot through the page's own door, landed.
async function seededShot(page, seed) {
  const before = await page.evaluate(() => RangeDayLine.log.length);
  await page.evaluate((s) => RangeDayLine.fire(s), seed);
  for (let i = 0; i < 150; i++) { await settle(page, 60); if ((await page.evaluate(() => RangeDayLine.log.length)) > before) break; }
  const log = await page.evaluate(() => RangeDayLine.log); return log[log.length - 1];
}
// A seeded hit on the chosen plate: the first shot shows where the seed lands, the hold is moved so the same seed lands on the center.
async function seededHit(page, seed) {
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  const probe = await seededShot(page, seed);
  const ipm = probe.yards * 36 * (Math.PI / (180 * 60));
  await page.evaluate(([u, r]) => RangeDayLine.setHold(u, r), [-probe.upIn / ipm, -probe.rightIn / ipm]);
  return seededShot(page, seed);
}
// n presses of a knob button, as its pointerdown handler takes them (game.js, holdRepeat: a press moves one click), dispatched
// from inside the page: a Playwright click waits for two steady frames before each press, and under the Full picture drawn
// in software a frame takes seconds (41 presses took 10 minutes on the runner, range-day-seven).
const press = (page, sel, n) => page.evaluate(([sel, n]) => { const b = document.querySelector(sel); for (let i = 0; i < n; i++) { b.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1, bubbles: true })); b.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: 1, bubbles: true })); } }, [sel, n]);
const AR = '/line?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193';
const SCREENS = [
  { name: 'home', path: '/?rifle=iwi-x95', expect: 'When: time of day', act: (page) => page.waitForSelector('.rifle.picked[data-rifle="iwi-x95"]') },
  // A day is open (shots fired at the bench): home shows the day first, with the doors back into it.
  { name: 'home-day-open', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193', expect: 'A day is open', act: async (page) => { await page.waitForSelector('#fire5'); await page.click('#fire5'); await page.goto(`${base}/`); await page.waitForSelector('#day-card'); } },
  // The bench in the middle of a day: a group fired, the rounds left beside the setting.
  { name: 'zero-mid-day', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193', expect: 'zeroing supply: 15 of 20 left', act: async (page) => { await page.evaluate(() => localStorage.removeItem('range-day:supply:bcm-ar15:imi-m193')); await page.reload(); await page.waitForSelector('#fire5'); await page.click('#fire5'); await settle(page, 200); } },
  // The bench with the zeroing supply used up: the bench stays, "Open another box" is offered.
  // range-day-thirteen: the bench on one screen: empty; a fresh paper hung after a group, its way back where Fresh paper stood; the
  // old paper put back; on a rifle with a sliding leaf (the leaf's control a short scroll below). After a group, after a save and
  // with the supply empty are zero-before, zero-after and zero-supply-empty.
  { name: 'zero-empty', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193', expect: 'No shots yet', act: (page) => page.waitForSelector('#fire5') },
  { name: 'zero-fresh-paper', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193', expect: 'Put the old paper back', act: async (page) => { await page.waitForSelector('#fire5'); await page.click('#fire5'); await page.click('#fresh'); await settle(page, 200); } },
  { name: 'zero-old-paper-back', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193', expect: 'The old paper is back at 100 yards, with its 5 holes', act: async (page) => { await page.waitForSelector('#fire5'); await page.click('#fire5'); await page.click('#fresh'); await page.click('#fresh'); await settle(page, 200); } },
  { name: 'zero-leaf', path: '/zero?course=angeles-sylmar&rifle=ak-545&sight=ak545-ball&load=hornady-545-60', expect: 'Rear leaf', act: async (page) => { await page.waitForSelector('#fire5'); await page.click('#fire5'); await settle(page, 200); } },
  { name: 'zero-supply-empty', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193', expect: 'Open another box to go on', act: async (page) => { await page.evaluate(() => localStorage.removeItem('range-day:supply:bcm-ar15:imi-m193')); await page.reload(); await page.waitForSelector('#fire5'); for (let i = 0; i < 4; i++) await page.click('#fire5'); await settle(page, 200); } },
  // The firing line before the day's first shot: the cold-bore line showing.
  { name: 'line-first-shot', path: AR, expect: 'first shot is next', act: (page) => plate(page, 0) },
  // After a hit: the book line filled.
  { name: 'line-after-hit', path: AR, expect: 'Written in the book', act: async (page) => { await plate(page, 0); await seededHit(page, 11); await settle(page, 300); } },
  // A plate with nothing in the book yet.
  { name: 'line-nothing-in-book', path: AR, expect: 'nothing in the book at 600 yards yet', act: async (page) => { await plate(page, 0); await seededHit(page, 12); await plate(page, 5); } },
  // The wind call changed.
  { name: 'line-wind-call', path: AR, expect: 'mph from the left', act: async (page) => { await plate(page, 2); await page.click('[data-wind-from="left"]'); await page.click('#wind-more'); await page.click('#wind-more'); await settle(page, 200); } },
  // The box empty: twenty shots at the 100-yard plate; the line stays and offers another box.
  { name: 'line-box-empty', path: AR, expect: 'open another box to go on', act: async (page) => { await plate(page, 0); for (let i = 0; i < 20; i++) await seededShot(page, 200 + i); await settle(page, 300); } },
  // The day's page of a finished day (the one just shot, packed up after its box).
  { name: 'day-finished', path: AR, expect: 'packed up early', act: async (page) => { await plate(page, 0); for (let i = 0; i < 20; i++) await seededShot(page, 300 + i); await page.click('#pack-up'); await page.waitForURL(/\/day\?id=/, { timeout: 10000 }); await page.waitForSelector('#shots tbody tr'); } },
  // The book page with several distances, one struck line and a note.
  { name: 'book-several', path: AR, expect: 'Restore', act: async (page) => {
    await ready(page); await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k.startsWith('range-day:book:') || k.startsWith('range-day:cold-bore:')) localStorage.removeItem(k); });
    for (const ix of [0, 1, 2]) { await plate(page, ix); await seededHit(page, 400 + ix); }
    await page.goto(`${base}/book?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('.entry');
    await page.fill('.entry .note', 'wind picked up after this one'); await page.press('.entry .note', 'Tab');
    await page.click('.entry .strike'); await page.waitForSelector('.entry.struck'); await settle(page, 200);
  } },
  // The book page with no hits.
  { name: 'book-empty', path: '/book?course=angeles-sylmar&rifle=remington-22&sight=rem-irons&load=cci-sv-40', expect: 'Nothing in this book yet', act: (page) => page.waitForSelector('#pages') },
  // The cold-bore record with several days: three days, each begun with a shot at a plate.
  { name: 'cold-bore-several', path: AR, expect: 'The cold-bore record', act: async (page) => {
    for (let dayN = 0; dayN < 3; dayN++) { await noDay(page); await page.goto(`${base}${AR}`); await plate(page, dayN); await seededShot(page, 500 + dayN); }
    await page.goto(`${base}/book?course=angeles-sylmar&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#cold table');
  } },
  // A January morning and a July afternoon on the canyon course through the Vepr's scope.
  { name: 'line-january-morning', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=1&time=morning`, expect: 'January morning', act: (page) => plate(page, 4) },
  { name: 'line-july-afternoon', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=7&time=afternoon`, expect: 'July afternoon', act: (page) => plate(page, 4) },
  // The canyon course's picture (range-day-five): through the Vepr's scope at 3x and 9x (2x and 7x on the 2-7x44 before range-day-eleven) and through its irons at 1x, in February at midday and in September in the afternoon.
  { name: 'line-feb-midday-3x', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=2&time=midday`, expect: 'February midday', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(3)); await settle(page, 400); } },
  { name: 'line-feb-midday-9x', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=2&time=midday`, expect: 'February midday', act: async (page) => { await plate(page, 8); await page.evaluate(() => RangeDayLine.setZoom(9)); await settle(page, 400); } },
  { name: 'line-feb-midday-irons', path: `${PIRU}&sight=vepr-irons&month=2&time=midday`, expect: 'February midday', act: (page) => plate(page, 4) },
  { name: 'line-sep-afternoon-3x', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(3)); await settle(page, 400); } },
  { name: 'line-sep-afternoon-9x', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await plate(page, 8); await page.evaluate(() => RangeDayLine.setZoom(9)); await settle(page, 400); } },
  { name: 'line-sep-afternoon-irons', path: `${PIRU}&sight=vepr-irons&month=9&time=afternoon`, expect: 'September afternoon', act: (page) => plate(page, 4) },
  // range-day-six: the other two of each day's measured states (3x on the 1,000-yard plate, 9x on the 600-yard plate; 2x and 7x before range-day-eleven), and the 200-yard plate among the numbered boards at 4x.
  { name: 'line-feb-midday-3x-1000', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=2&time=midday`, expect: 'February midday', act: async (page) => { await plate(page, 8); await page.evaluate(() => RangeDayLine.setZoom(3)); await settle(page, 400); } },
  { name: 'line-feb-midday-9x-600', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=2&time=midday`, expect: 'February midday', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(9)); await settle(page, 400); } },
  { name: 'line-sep-afternoon-3x-1000', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await plate(page, 8); await page.evaluate(() => RangeDayLine.setZoom(3)); await settle(page, 400); } },
  { name: 'line-sep-afternoon-9x-600', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(9)); await settle(page, 400); } },
  { name: 'line-sep-boards-200', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=midday`, expect: 'September midday', act: async (page) => { await plate(page, 0); await page.evaluate(() => RangeDayLine.setZoom(4)); await settle(page, 400); } },
  // range-day-seven: the same boards through the scope at its highest power, where the posts' dotted lines showed on Dan's phone.
  { name: 'line-sep-boards-200-9x', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=midday`, expect: 'September midday', act: async (page) => { await plate(page, 0); await page.evaluate(() => RangeDayLine.setZoom(9)); await settle(page, 400); } },
  // A hit with its strike mark on the plate, at 9x.
  // (the sight is dialled onto the probe shot with the knobs, as a shooter would, so the plate stays at the reticle when the second shot chips it)
  { name: 'line-hit-strike', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=midday`, expect: 'Hit', act: async (page) => {
    await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-bugbuster-3-9x32'); await page.reload(); await plate(page, 0); await page.evaluate(() => RangeDayLine.setZoom(9));
    await page.evaluate(() => RangeDayLine.setHold(0, 0));
    const probe = await seededShot(page, 21);
    const ipm = 200 * 36 * (Math.PI / (180 * 60));
    const el = -probe.upIn / ipm, wd = -probe.rightIn / ipm; // minutes of angle to dial
    await press(page, el > 0 ? '#el-up-moa' : '#el-down-moa', Math.floor(Math.abs(el)));
    await press(page, el > 0 ? '#el-up' : '#el-down', Math.round((Math.abs(el) % 1) / 0.25));
    await press(page, wd > 0 ? '#wd-right-moa' : '#wd-left-moa', Math.floor(Math.abs(wd)));
    await press(page, wd > 0 ? '#wd-right' : '#wd-left', Math.round((Math.abs(wd) % 1) / 0.25));
    await seededShot(page, 21); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 3500);
  } },
  // The Light picture beside the Full one (the same view as line-sep-afternoon-3x).
  { name: 'line-light-3x', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await picture(page, 'light'); await page.reload(); await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(3)); await settle(page, 400); } },
  // The Plain fallback: a browser without 3D shows the plain picture and the one line (its own browser context, with 3D switched off).
  { name: 'line-plain-fallback', path: `${PIRU}&sight=utg-bugbuster-3-9x32&month=9&time=afternoon`, expect: 'could not draw the full picture', no3d: true, act: async (page) => { await page.evaluate(() => localStorage.removeItem('range-day:picture')); await page.reload(); await plate(page, 4); } },
  // The setting: Picture, with the conditions switch.
  { name: 'line-picture-setting', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: 'Picture', act: async (page) => { await ready(page); await page.evaluate(() => document.getElementById('picture').scrollIntoView()); await settle(page, 200); } },
  { name: 'status', path: '/status', expect: 'alive since ' },
  { name: 'zero-before', path: ZERO, expect: 'center of the group', act: async (page) => { await page.waitForSelector('#fire5'); await page.click('#fire5'); await settle(page, 200); } },
  { name: 'zero-after', path: ZERO, expect: 'Saved zero', act: async (page) => {
    await page.waitForSelector('#fire5'); await page.click('#fire5'); await settle(page, 100);
    for (let i = 0; i < 10; i++) await page.click('#el-up-moa');
    for (let i = 0; i < 12; i++) await page.click('#wd-left');
    await page.click('#fresh'); await page.click('#fire5'); await page.click('#save'); await settle(page, 200);
  } },
  // The bench with the red dot at 50 yards, a zero saved: walk the group to the center from the readout, as a shooter does.
  { name: 'zero-dot-50', path: '/zero?course=angeles-sylmar&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193', expect: 'Saved zero for IMI M193', act: async (page) => {
    await page.waitForSelector('#fire5'); await fresh(page, 'iwi-tavor-sar', 'pa-md25'); await page.reload(); await page.waitForSelector('#fire5');
    await page.selectOption('#distance', '50');
    for (let round = 0; round < 3; round++) {
      await page.click('#fresh'); await page.click('#fire5');
      const t = await page.textContent('#group');
      const m = /center of the group (level|[\d.]+ in (?:low|high)), (centered|[\d.]+ in (?:right|left))/.exec(t);
      const up = m[1] === 'level' ? 0 : parseFloat(m[1]) * (m[1].includes('high') ? 1 : -1), right = m[2] === 'centered' ? 0 : parseFloat(m[2]) * (m[2].includes('right') ? 1 : -1);
      const el = Math.round(-up / (0.5 * 0.5236)), wd = Math.round(-right / (0.5 * 0.5236)); // 0.5 MOA clicks, 0.52 in per MOA at 50 yd
      for (let i = 0; i < Math.abs(el); i++) await page.click(el > 0 ? '#el-up' : '#el-down');
      for (let i = 0; i < Math.abs(wd); i++) await page.click(wd > 0 ? '#wd-right' : '#wd-left');
    }
    await page.click('#fresh'); await page.click('#fire5'); await page.click('#save'); await settle(page, 200);
  } },
  { name: 'line-dot-300', path: `${SYLMAR}&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193`, expect: 'Magnifier out', act: (page) => plate(page, 2) },
  { name: 'line-magnifier-300', path: `${SYLMAR}&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193`, expect: 'Magnifier in (3×)', act: async (page) => { await plate(page, 2); await page.click('#magnifier'); await settle(page, 400); } },
  { name: 'line-acss-400', path: `${SYLMAR}&rifle=ak-762&sight=pa-3x-acss&load=silver-bear-123`, expect: '400 yards', act: (page) => plate(page, 3) },
  // range-day-twelve: the leaf state is the 5.45 rifle's (behind its ball post): the 7.62x39 rifle's KNS rear peep replaced its leaf.
  { name: 'line-ak-leaf', path: `${SYLMAR}&rifle=ak-545&sight=ak545-ball&load=hornady-545-60`, expect: 'Leaf 3 (300 m', act: async (page) => { await ready(page); await fresh(page, 'ak-545', 'ak545-ball'); await page.reload(); await plate(page, 2); await page.click('#leaf-up'); await page.click('#leaf-up'); await settle(page, 300); } },
  { name: 'line-vepr-irons-600', path: '/line?course=cta-piru&rifle=molot-vepr-54r&sight=vepr-irons&load=sb-174-hpbt', expect: 'Vepr iron sights', act: (page) => plate(page, 4) },
  { name: 'line-tavor-irons-200', path: `${SYLMAR}&rifle=iwi-x95&sight=fab-flipup&load=imi-m193`, expect: 'FAB Defense flip-up sights', act: (page) => plate(page, 1) }, // range-day-twelve: the FAB sights took the Tavor irons' place
  // range-day-twelve: each sight fitted to the rifles on the 100-yard steel (the first plate on the rifle line; the canyon's near plate);
  // the SeeAll on the 50-yard paper; the sight chooser on a Tavor, its list shown open (a page's own drop-down list is drawn by the
  // browser outside the page and is not in a screenshot, so the list is shown at full length for the picture); the Vepr's scope at
  // 3x and 9x on the same plate, its dots further apart at 3x (second focal plane, true at 10x).
  { name: 'line-troy-100', path: `${SYLMAR}&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193`, expect: 'Troy folding BattleSights', act: (page) => plate(page, 0) },
  { name: 'line-troy-100-small', path: `${SYLMAR}&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193`, expect: 'Small rear aperture', act: async (page) => { await ready(page); await fresh(page, 'bcm-ar15', 'troy-battlesights'); await page.reload(); await plate(page, 0); await page.click('#aperture'); await settle(page, 300); } }, // range-day-twelve-b: the small peep up
  { name: 'line-fab-100', path: `${SYLMAR}&rifle=iwi-tavor-sar&sight=fab-flipup&load=imi-m193`, expect: 'FAB Defense flip-up sights', act: (page) => plate(page, 0) },
  { name: 'line-seeall-100', path: `${SYLMAR}&rifle=iwi-tavor-sar&sight=seeall-gen1&load=imi-m193`, expect: 'SeeAll Open Sight', act: (page) => plate(page, 0) },
  { name: 'line-seeall-paper-50', path: `${SYLMAR}&rifle=iwi-tavor-sar&sight=seeall-gen1&load=imi-m193`, expect: '50 yards (paper)', act: (page) => target(page, 'near-0') },
  { name: 'line-kns-peep-100', path: `${SYLMAR}&rifle=ak-762&sight=ak762-kns-peep&load=silver-bear-123`, expect: 'KNS adjustable rear peep', act: (page) => plate(page, 0) },
  { name: 'line-ak545-ball-100', path: `${SYLMAR}&rifle=ak-545&sight=ak545-ball&load=hornady-545-60`, expect: 'AK ball front post', act: (page) => plate(page, 0) },
  { name: 'line-ak545-xs-100', path: `${SYLMAR}&rifle=ak-545&sight=ak545-xs&load=hornady-545-60`, expect: 'XS tritium stripe front post', act: (page) => plate(page, 0) },
  { name: 'line-vepr-ball-100', path: '/line?course=cta-piru&rifle=molot-vepr-54r&sight=vepr-irons&load=sb-174-hpbt', expect: 'Vepr iron sights', act: (page) => target(page, 'near-2') },
  { name: 'home-sight-chooser-tavor', path: '/?rifle=iwi-tavor-sar', expect: 'SeeAll Open Sight', act: async (page) => { await page.waitForSelector('.rifle.picked[data-rifle="iwi-tavor-sar"]'); await page.evaluate(() => { const s = document.getElementById('sight'); s.size = s.options.length; s.scrollIntoView({ block: 'center' }); }); await settle(page, 200); } },
  // range-day-thirteen: the scope collection on the BCM at 100 yards; the two zooms at their highest power on the 600-yard plate;
  // the Leupold on an AK-type rifle; the chooser on the BCM, its list shown at full length (as for the Tavor above).
  { name: 'line-acog-100', path: `${SYLMAR}&rifle=bcm-ar15&sight=trijicon-acog-ta31f&load=imi-m193`, expect: 'Trijicon ACOG 4x32', act: (page) => plate(page, 0) },
  // range-day-fourteen: the green ACOG (TA31F-G), the same marks lit green
  { name: 'line-acog-g-100', path: `${SYLMAR}&rifle=bcm-ar15&sight=trijicon-acog-ta31f-g&load=imi-m193`, expect: 'TA31F-G', act: (page) => plate(page, 0) },
  { name: 'line-vortex-1x-100', path: `${SYLMAR}&rifle=bcm-ar15&sight=vortex-razor-1-10&load=imi-m193`, expect: 'Vortex Razor HD Gen III', act: async (page) => { await plate(page, 0); await page.evaluate(() => RangeDayLine.setZoom(1)); await settle(page, 400); } },
  { name: 'line-vortex-10x-600', path: `${SYLMAR}&rifle=bcm-ar15&sight=vortex-razor-1-10&load=imi-m193`, expect: 'Vortex Razor HD Gen III', act: async (page) => { await plate(page, 5); await page.evaluate(() => RangeDayLine.setZoom(10)); await settle(page, 400); } },
  { name: 'line-leupold-5x-100', path: `${SYLMAR}&rifle=bcm-ar15&sight=leupold-mark5hd-5-25&load=imi-m193`, expect: 'Leupold Mark 5HD', act: async (page) => { await plate(page, 0); await page.evaluate(() => RangeDayLine.setZoom(5)); await settle(page, 400); } },
  { name: 'line-leupold-25x-600', path: `${SYLMAR}&rifle=bcm-ar15&sight=leupold-mark5hd-5-25&load=imi-m193`, expect: 'Leupold Mark 5HD', act: async (page) => { await plate(page, 5); await page.evaluate(() => RangeDayLine.setZoom(25)); await settle(page, 400); } },
  { name: 'line-ak-leupold-300', path: `${SYLMAR}&rifle=ak-762&sight=leupold-mark5hd-5-25&load=silver-bear-123`, expect: 'Leupold Mark 5HD', act: async (page) => { await plate(page, 2); await page.evaluate(() => RangeDayLine.setZoom(15)); await settle(page, 400); } },
  { name: 'home-sight-chooser-bcm', path: '/?rifle=bcm-ar15', expect: 'Leupold Mark 5HD 5-25x56', act: async (page) => { await page.waitForSelector('.rifle.picked[data-rifle="bcm-ar15"]'); await page.evaluate(() => { const s = document.getElementById('sight'); s.size = s.options.length + 1; s.scrollIntoView({ block: 'center' }); }); await settle(page, 200); } },
  { name: 'line-bugbuster-dots-3x', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: '3×', act: async (page) => { await plate(page, 2); await page.evaluate(() => { RangeDayLine.setZoom(3); RangeDayLine.setHold(0, 0); }); await settle(page, 400); } },
  { name: 'line-bugbuster-dots-9x', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: '9×', act: async (page) => { await plate(page, 2); await page.evaluate(() => { RangeDayLine.setZoom(9); RangeDayLine.setHold(0, 0); }); await settle(page, 400); } },
  { name: 'line-22-100', path: `${SYLMAR}&rifle=remington-22&sight=rem-irons&load=cci-sv-40`, expect: 'Open rimfire sights', act: (page) => plate(page, 0) },
  { name: 'line-knob-stop', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: 'end of its travel', act: async (page) => { await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-bugbuster-3-9x32'); await page.reload(); await ready(page); await press(page, '#el-up-moa', 41); await settle(page, 200); } },
  { name: 'line-scope-3x', path: PIRU, expect: 'Firing line', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(3)); await settle(page, 400); } },
  { name: 'line-scope-9x', path: PIRU, expect: 'Zoom 9', act: async (page) => { await ready(page); await page.evaluate(() => RangeDayLine.setZoom(9)); await settle(page, 400); } },
  // range-day-eleven: the Vepr's BugBuster at its highest power on the 600-yard plate (at 3x it is line-scope-3x).
  { name: 'line-scope-9x-600', path: PIRU, expect: 'Zoom 9', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(9)); await settle(page, 400); } },
  { name: 'line-canyon-irons', path: '/line?course=cta-piru&rifle=molot-vepr-54r&sight=vepr-irons&load=sb-174-hpbt', expect: 'Canyon course', act: (page) => plate(page, 4) },
  { name: 'line-irons-600', path: `${SYLMAR}&rifle=bcm-ar15&load=federal-gmm-69`, expect: '600 yards', act: (page) => plate(page, 5) },
  { name: 'line-rifle-line-irons', path: `${SYLMAR}&rifle=bcm-ar15&sight=troy-battlesights&load=imi-m193`, expect: 'Rifle line', act: (page) => plate(page, 2) },
  // Unzeroed, the first shot at 200 yards lands well low: a miss, with its dust, at 3x and at 9x.
  { name: 'line-miss-dust-3x', path: PIRU, expect: 'Miss', act: async (page) => {
    await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-bugbuster-3-9x32');
    await page.reload(); await ready(page); await page.evaluate(() => RangeDayLine.setZoom(3)); await page.click('#fire'); await landed(page); await settle(page, 300);
  } },
  { name: 'line-miss-dust', path: PIRU, expect: 'Miss', act: async (page) => {
    await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-bugbuster-3-9x32');
    await page.reload(); await ready(page); await page.evaluate(() => RangeDayLine.setZoom(9)); await page.click('#fire'); await landed(page); await settle(page, 300);
  } },
  // The shot log with a miss in it: the state fires its own unzeroed shot (it used to show the miss an earlier state had left in the rifle's log, which a shard running alone has not).
  { name: 'line-shot-log', path: PIRU, expect: 'miss:', act: async (page) => { await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-bugbuster-3-9x32'); await page.reload(); await ready(page); await seededShot(page, 31); await page.evaluate(() => document.getElementById('log').scrollIntoView()); await settle(page, 200); } },
  { name: 'line-conditions-on', path: PIRU, expect: 'Wind, near stretch', act: async (page) => { await ready(page); await page.check('#show-conditions'); await page.evaluate(() => document.getElementById('conditions').scrollIntoView()); await settle(page, 200); } },
  // range-day-nine: the firing line arranged for shooting, with the page at its top: before the first shot, after a miss, after a
  // hit, with the short line opened over the page, and scrolled down to the wind call.
  { name: 'line-top-first-shot', path: AR, expect: 'Drag the view to hold off the target', act: async (page) => { await plate(page, 0); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 200); } },
  { name: 'line-top-after-miss', path: AR, expect: 'Miss', act: async (page) => { await plate(page, 0); await page.evaluate(() => RangeDayLine.setHold(0, 60)); await seededShot(page, 41); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 300); } },
  { name: 'line-top-after-hit', path: AR, expect: 'Written in the book', act: async (page) => { await plate(page, 0); await seededHit(page, 42); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 300); } },
  { name: 'line-top-short-opened', path: AR, expect: 'BCM AR-15 carbine, 5.56 with', act: async (page) => { await plate(page, 0); await page.evaluate(() => window.scrollTo(0, 0)); await page.click('#line-head'); await page.waitForSelector('#line-full:not([hidden])'); await settle(page, 200); } },
  { name: 'line-top-scrolled-wind', path: AR, expect: 'Wind as you read it', act: async (page) => { await plate(page, 0); await page.evaluate(() => document.getElementById('windcall').scrollIntoView({ block: 'center' })); await settle(page, 300); } },
  // range-day-sixteen: tilt aiming, fed made-up readings (no real sensor here): the firing line with "Aim: tilt" and Center, the
  // hold a little off the plate's center; and the Setting section with the gearing and the steadiness line after a small wobble.
  { name: 'line-aim-tilt', path: AR, expect: 'Tilt the phone to hold off the target', act: async (page) => { await plate(page, 0); await page.click('#aim-mode'); await page.waitForFunction(() => RangeDayLine.aimMode === 'tilt'); await page.evaluate(() => { const t0 = performance.now() / 1000; RangeDayLine.feedOrientation(0, 90, 0, t0); for (let i = 1; i <= 60; i++) RangeDayLine.feedOrientation(-0.05, 90.03, 0, t0 + i / 60); }); await settle(page, 300); } },
  { name: 'line-aim-steadiness', path: AR, expect: 'Tilt steadiness: the aim moved about', act: async (page) => { await plate(page, 0); await page.click('#aim-mode'); await page.waitForFunction(() => RangeDayLine.aimMode === 'tilt'); await page.evaluate(() => new Promise((done) => { let i = 0; const t = setInterval(() => { RangeDayLine.feedOrientation(0.04 * Math.sin(i / 4), 90 + 0.03 * Math.cos(i / 5), 0, performance.now() / 1000); if (++i > 80) { clearInterval(t); done(); } }, 16); })); await page.waitForFunction(() => /moved about/.test(document.getElementById('steadiness').textContent)); await page.evaluate(() => document.getElementById('gearing').scrollIntoView({ block: 'center' })); await settle(page, 200); } },
  // range-day-sixteen, after Dan's walkthrough: a shot log of 300 rows, Setting above it, the steadiness reading over the view.
  { name: 'line-long-log', path: AR, expect: 'Tilt steadiness: the aim moved about', act: async (page) => { await page.evaluate(() => { const k = 'range-day:log:bcm-ar15:troy-battlesights:imi-m193'; localStorage.setItem(k, JSON.stringify(Array.from({ length: 300 }, (_, i) => ({ n: i + 1, yards: 300, target: 'steel', el: 12, wd: -3, zoom: 7, heldUp: 0.5, heldRight: -1.2, hit: i % 2 === 0, where: i % 2 === 0 ? 'hit (2.1 in high, 0.8 in right of center)' : 'miss: 14 in low, 3 in left', call: null, conditionsShown: false, aim: 'tilt' })))); }); await page.reload(); await ready(page); await plate(page, 0); await page.click('#aim-mode'); await page.waitForFunction(() => RangeDayLine.aimMode === 'tilt'); await page.evaluate(() => new Promise((done) => { let i = 0; const t = setInterval(() => { RangeDayLine.feedOrientation(0.04 * Math.sin(i / 4), 90 + 0.03 * Math.cos(i / 5), 0, performance.now() / 1000); if (++i > 80) { clearInterval(t); done(); } }, 16); })); await page.waitForFunction(() => /^Steadiness:/.test(document.getElementById('steadiness-near').textContent)); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 200); } },
];
// range-day-ten: the near targets and the spotting scope. A group on paper: the first seeded shot shows where the seed lands, the
// hold is moved so the seeds land about the sheet's center, then five seeded shots; the steel's marks the same way.
const target = async (page, key) => { await ready(page); await page.evaluate((k) => RangeDayLine.setTarget(k), key); await settle(page, 300); };
async function groupOn(page, key, seeds) {
  await target(page, key);
  await page.evaluate(() => RangeDayLine.setHold(0, 0));
  const probe = await seededShot(page, seeds[0]);
  const ipm = probe.yards * 36 * (Math.PI / (180 * 60));
  await page.evaluate(([u, r]) => RangeDayLine.setHold(u, r), [-probe.upIn / ipm, -probe.rightIn / ipm]);
  for (const sd of seeds) await seededShot(page, sd);
  await landed(page);
}
const spot = async (page, power) => { await page.click('#spotting'); await page.evaluate((m) => RangeDayLine.setSpotZoom(m), power); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 1500); };
SCREENS.push(
  { name: 'near-paper-50-clean', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: '50 yards (paper)', act: async (page) => { await target(page, 'near-0'); await page.evaluate(() => RangeDayLine.setZoom(9)); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 800); } },
  { name: 'near-paper-50-group', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: 'On paper at 50 yards', act: async (page) => { await ready(page); await page.evaluate(() => RangeDayLine.setZoom(9)); await groupOn(page, 'near-0', [501, 502, 503, 504, 505]); await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForFunction(() => RangeDayLine.recoilMoa < 0.2, null, { timeout: 120000 }); await settle(page, 400); } },
  { name: 'spot-paper-50-25x', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: 'Back to the rifle', act: async (page) => { await groupOn(page, 'near-0', [501, 502, 503, 504, 505]); await spot(page, 25); } },
  { name: 'spot-paper-50-125x', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: 'Back to the rifle', act: async (page) => { await groupOn(page, 'near-0', [501, 502, 503, 504, 505]); await spot(page, 125); } },
  { name: 'spot-steel-100-marks', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: 'Back to the rifle', act: async (page) => { await groupOn(page, 'near-2', [511, 512]); await spot(page, 125); } },
  { name: 'spot-plate-600-125x', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: 'Back to the rifle', act: async (page) => { await target(page, '4'); await spot(page, 125); } },
  { name: 'spot-plate-1000-125x', path: `${PIRU}&sight=utg-bugbuster-3-9x32`, expect: 'Back to the rifle', act: async (page) => { await target(page, '8'); await spot(page, 125); } },
  { name: 'spot-rifle-line-paper-50', path: AR, expect: 'Back to the rifle', act: async (page) => { await groupOn(page, 'near-0', [521, 522, 523, 524, 525]); await spot(page, 40); } },
);
// range-day-eight: the ground, on Full and on Light, February midday and September afternoon: the floor through the
// Vepr's irons at 1x aimed at the 200-yard plate; the 600- and 1,000-yard plates' hillsides through its scope at 7x; and
// the 600-yard hillside through a test view three times stronger (the scope's own field-of-view rule carried to 21x through
// the page's zoom door; a test view only, not a sight in the game).
for (const pic of ['full', 'light']) for (const [day, q, words] of [['feb', 'month=2&time=midday', 'February midday'], ['sep', 'month=9&time=afternoon', 'September afternoon']]) {
  const set = async (page) => { await picture(page, pic); await page.reload(); };
  SCREENS.push(
    { name: `ground-${pic}-${day}-floor-irons`, path: `${PIRU}&sight=vepr-irons&${q}`, expect: words, act: async (page) => { await set(page); await plate(page, 0); } },
    { name: `ground-${pic}-${day}-600-7x`, path: `${PIRU}&sight=utg-bugbuster-3-9x32&${q}`, expect: words, act: async (page) => { await set(page); await plate(page, 4); await page.evaluate((z) => RangeDayLine.setZoom(z), OLD7); await settle(page, 400); } },
    { name: `ground-${pic}-${day}-1000-7x`, path: `${PIRU}&sight=utg-bugbuster-3-9x32&${q}`, expect: words, act: async (page) => { await set(page); await plate(page, 8); await page.evaluate((z) => RangeDayLine.setZoom(z), OLD7); await settle(page, 400); } },
    { name: `ground-${pic}-${day}-600-21x`, path: `${PIRU}&sight=utg-bugbuster-3-9x32&${q}`, expect: words, act: async (page) => { await set(page); await plate(page, 4); await page.evaluate((z) => RangeDayLine.setZoom(z), OLD21); await settle(page, 400); } },
  );
}

// range-day-fourteen: a day played back through the spotting scope. The seeded day (test/playback-seed.js: five shots on the firing
// line, three on steel, one on paper, one miss, and one at the bench) is written into the day the firing line opens, then played
// back under the Full picture; each state pauses the playback at its moment.
const PB_SEED = createRequire(import.meta.url)('../test/playback-seed.js');
const pbOpen = async (page, shots) => {
  await page.goto(`${base}${PB_SEED.LINE}`); await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.day);
  const id = await page.evaluate(PB_SEED.seedInPage, shots || PB_SEED.seedShots(Date.now() - 300000));
  await page.goto(`${base}/playback?id=${encodeURIComponent(id)}`);
  return id;
};
const pbReady = async (page) => { await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.playback && (RangeDayLine.scene || RangeDayLine.sceneFailed || (!RangeDayLine.sceneLoading && RangeDayLine.picture === 'plain')), null, { timeout: 90000 }); await page.waitForFunction(() => !RangeDayLine.scene || !RangeDayLine.scene.materials || RangeDayLine.scene.materials.settled, null, { timeout: 90000 }); };
// paused at the moment `at(events)` (seconds along the day); `run` plays the last `run` seconds up to it, so a swing or dust is under way
const pbAt = async (page, at, run = 0) => {
  await pbReady(page);
  const ev = await page.evaluate(() => RangeDayLine.playback.events);
  const t = at(ev);
  await page.evaluate(([t, run]) => { RangeDayLine.playback.pause(); RangeDayLine.playback.seek(t - run); if (run) RangeDayLine.playback.play(); }, [t, run]);
  if (run) await page.waitForFunction((t) => RangeDayLine.playback.clock >= t, t, { timeout: 60000 });
  await page.evaluate(() => { RangeDayLine.playback.pause(); window.scrollTo(0, 0); });
  await settle(page, 600);
};
SCREENS.push(
  { name: 'playback-empty', path: '/', expect: 'No shots on the firing line that day', act: async (page) => { await pbOpen(page, PB_SEED.seedShots(Date.now() - 300000).filter((x) => x.place === 'bench')); await page.waitForSelector('#play-empty:not([hidden])'); } },
  { name: 'playback-steel', path: '/', expect: 'Shot 2 of 5: 300 yards', act: async (page) => { await pbOpen(page); await pbAt(page, (ev) => ev[1].strikeT + 0.4, 0.8); } },
  { name: 'playback-paper', path: '/', expect: 'on paper', act: async (page) => { await pbOpen(page); await pbAt(page, (ev) => ev[2].strikeT + 0.5); } },
  { name: 'playback-miss-dust', path: '/', expect: 'miss:', act: async (page) => { await pbOpen(page); await pbAt(page, (ev) => ev[3].strikeT + 0.5, 1.0); } },
  { name: 'playback-trace', path: '/', expect: 'on its way', act: async (page) => { await pbOpen(page); await pbAt(page, (ev) => ev[4].fireT + ev[4].flightS * 0.55); } },
  { name: 'playback-paused', path: '/', expect: 'Play', act: async (page) => { await pbOpen(page); await pbAt(page, (ev) => ev[0].viewT + 0.8); } },
  { name: 'playback-end', path: '/', expect: 'The end of the day', act: async (page) => { await pbOpen(page); await pbAt(page, (ev) => 1e9); } },
  { name: 'day-play-control', path: '/', expect: 'Play this day back', act: async (page) => { const id = await pbOpen(page); await page.goto(`${base}/day?id=${encodeURIComponent(id)}`); await page.waitForSelector('#play-back'); } },
);

// range-day-seventeen: the workbench, home's chooser showing a build, and the book's comparison. Each starts with no builds and
// takes its build away after (builds and their records), so no other state sees one.
const noBuilds = (page) => page.evaluate(() => { for (const k of Object.keys(localStorage)) if (k === 'range-day:builds' || /^range-day:[^:]+:b-/.test(k) || /^range-day:last:b-/.test(k) || (k === 'range-day:last' && /"b-/.test(localStorage.getItem(k)))) localStorage.removeItem(k); });
const WB_MOUNT = JSON.parse(readFileSync(join(root, 'data', 'workbench.json'), 'utf8')).mounts['vortex-razor-1-10'].find((m) => /PR34-L/.test(m.name)).name;
async function wbChange(page) {
  await page.waitForSelector('#changes table');
  await page.selectOption('#barrel', '20');
  await page.click('#mounts summary');
  await page.selectOption('#mount-vortex-razor-1-10', WB_MOUNT);
}
async function wbMake(page) {
  await page.goto(`${base}/workbench?rifle=bcm-ar15`);
  await wbChange(page); await page.fill('#name', '20 in, low rings'); await page.click('#make'); await page.waitForSelector('#made a');
  return page.evaluate(() => JSON.parse(localStorage.getItem('range-day:builds')).slice(-1)[0].id);
}
const bookLines = (page, id) => page.evaluate((b) => {
  const line = (rifle, day, n, yards, el) => RD.addBookLine(rifle, 'troy-battlesights', 'imi-m193', { id: `${day}:${n}`, day, n, at: `2026-11-2${n}T09:00:00.000Z`, on: `2026-11-2${n}`, course: 'angeles-sylmar', yards, elevationClicks: el, windageClicks: 0, elevationMoa: el * 1.33, windageMoa: 0, leaf: null, zero: { zeroYards: 100, elevationClicks: 2, windageClicks: 0, leafIx: null, leaf: null, elevationMoa: 2.66 }, heldUpMoa: 0, heldRightMoa: 0, tempF: 60, windCall: null, upIn: 1, rightIn: 0, struck: false, note: '' });
  line(b, 'shot-b', 1, 300, 6); line(b, 'shot-b', 2, 400, 9);
  line('bcm-ar15', 'shot-a', 3, 300, 7); line('bcm-ar15', 'shot-a', 4, 500, 14);
}, id);
// The BCM's own book page, set aside while a comparison state runs (an earlier state, book-several, writes real hits there) and
// put back after, so each comparison shows only its own lines and no later state sees a change.
const BCM_BOOK = 'range-day:book:bcm-ar15:troy-battlesights:imi-m193';
const setBookAside = (page) => page.evaluate((k) => { const v = localStorage.getItem(k); localStorage.removeItem(k); if (v !== null) sessionStorage.setItem('aside', v); else sessionStorage.removeItem('aside'); }, BCM_BOOK);
const putBookBack = (page) => page.evaluate((k) => { const v = sessionStorage.getItem('aside'); if (v !== null) localStorage.setItem(k, v); else localStorage.removeItem(k); sessionStorage.removeItem('aside'); }, BCM_BOOK);
SCREENS.push(
  { name: 'workbench-empty', small: true, path: '/', expect: 'No builds yet', act: async (page) => { await noBuilds(page); await page.goto(`${base}/workbench?rifle=bcm-ar15`); await page.waitForSelector('#changes table'); } },
  { name: 'workbench-changed', small: true, path: '/', expect: '3,166 feet per second', act: async (page) => { await noBuilds(page); await page.goto(`${base}/workbench?rifle=bcm-ar15`); await wbChange(page); } },
  { name: 'workbench-made', small: true, path: '/', expect: 'It starts unzeroed', after: noBuilds, act: async (page) => { await noBuilds(page); await wbMake(page); await page.evaluate(() => window.scrollTo(0, 0)); } },
  { name: 'workbench-removed', small: true, path: '/', expect: 'Put it back', after: noBuilds, act: async (page) => { await noBuilds(page); await wbMake(page); await page.click('.entry.build .remove'); await page.waitForSelector('.entry.removed'); await page.evaluate(() => document.getElementById('builds').scrollIntoView()); } },
  { name: 'home-build-chooser', small: true, path: '/', expect: 'Version:', after: noBuilds, act: async (page) => { await noBuilds(page); const id = await wbMake(page); await page.goto(`${base}/?rifle=${id}`); await page.waitForSelector('#builds-of .chip.picked'); } },
  { name: 'book-compare-empty', small: true, path: '/', expect: 'No hits on steel yet with either', after: async (page) => { await putBookBack(page); await noBuilds(page); }, act: async (page) => { await noBuilds(page); await setBookAside(page); const id = await wbMake(page); await page.goto(`${base}/book?course=angeles-sylmar&rifle=${id}&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#compare-box:not([hidden])'); await page.evaluate(() => document.getElementById('compare-box').scrollIntoView()); } },
  { name: 'book-compare', small: true, path: '/', expect: 'Beside another version', after: async (page) => { await putBookBack(page); await noBuilds(page); }, act: async (page) => { await noBuilds(page); await setBookAside(page); const id = await wbMake(page); await bookLines(page, id); await page.goto(`${base}/book?course=angeles-sylmar&rifle=${id}&sight=troy-battlesights&load=imi-m193`); await page.waitForSelector('#compare-table table'); await page.evaluate(() => document.getElementById('compare-box').scrollIntoView()); } },
);

// range-day-eighteen: the .22's own scope, the Primary Arms CLx 1-6x24 (home, the bench, the line at both ends of its zoom, the
// workbench with the .22). Each starts with the scope's records cleared, so it opens unzeroed at the middle of its clicks.
const R22 = 'course=angeles-sylmar&rifle=remington-22&sight=pa-clx-1-6x24&load=cci-sv-40';
const nearestSteel = (page) => page.evaluate(() => { const o = [...document.querySelectorAll('#plate option')]; return o.find((x) => /steel/.test(x.textContent)).value; });
SCREENS.push(
  { name: 'home-22-scope', small: true, path: '/?rifle=remington-22', expect: 'Primary Arms CLx 1-6x24', act: async (page) => { await page.waitForSelector('.rifle.picked[data-rifle="remington-22"]'); await page.selectOption('#sight', 'pa-clx-1-6x24'); await settle(page, 300); } },
  { name: 'zero-22-scope', small: true, path: `/zero?${R22}`, expect: 'Primary Arms CLx', act: async (page) => { await fresh(page, 'remington-22', 'pa-clx-1-6x24'); await page.reload(); await page.waitForSelector('#fire5'); } },
  { name: 'line-22-scope-1x', small: true, path: `/line?${R22}`, expect: 'Zoom', act: async (page) => { await fresh(page, 'remington-22', 'pa-clx-1-6x24'); await page.reload(); await ready(page); await page.selectOption('#plate', await nearestSteel(page)); await page.evaluate(() => RangeDayLine.setZoom(1)); await settle(page, 500); } },
  { name: 'line-22-scope-6x', small: true, path: `/line?${R22}`, expect: 'Zoom', act: async (page) => { await fresh(page, 'remington-22', 'pa-clx-1-6x24'); await page.reload(); await ready(page); await page.selectOption('#plate', await nearestSteel(page)); await page.evaluate(() => RangeDayLine.setZoom(6)); await settle(page, 500); } },
  { name: 'workbench-22', small: true, path: '/', expect: 'Primary Arms CLx', act: async (page) => { await noBuilds(page); await page.goto(`${base}/workbench?rifle=remington-22`); await page.waitForSelector('#changes table'); } },
);

const GREP = arg('--grep', null) ? new RegExp(arg('--grep')) : null; // --grep <pattern>: only the states whose names match (for a before-and-after pair by hand; the check runs every state)
const SHARD = SCREENS.filter((_, i) => i % shardOf === shardIx - 1).filter((s) => !GREP || GREP.test(s.name));
if (process.argv.includes('--list')) { for (const s of SHARD) console.log(s.name); process.exit(0); }

const server = spawn('node', ['server.js'], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1' },
  stdio: ['ignore', 'ignore', 'inherit'],
});
process.on('exit', () => server.kill());
for (let i = 0; ; i++) {
  try { await fetch(`${base}/alive`); break; } catch { if (i > 100) throw new Error('server never answered'); await new Promise((r) => setTimeout(r, 50)); }
}

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!ok) failed++; };
const noSideways = async (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const browser = await chromium.launch();
for (const [size, viewport] of Object.entries(SIZES)) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: size === 'phone', hasTouch: size === 'phone' });
  await context.grantPermissions(['accelerometer', 'gyroscope']); // range-day-sixteen: tilt aiming reads the motion sensor (fed made-up readings below)
  const page = await context.newPage();

  await page.goto(`${base}/`);
  check(`${size}: a stranger lands on sign-in`, new URL(page.url()).pathname === '/login');
  await page.screenshot({ path: join(out, `signin-${size}.png`) });
  check(`${size}: sign-in fits the width`, await noSideways(page));

  await page.fill('#passphrase', 'wrong');
  await page.click('button[type=submit]');
  check(`${size}: a wrong passphrase is refused on screen`, (await page.textContent('#msg')).includes('not right'));

  await page.fill('#passphrase', `${PASS} `);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  check(`${size}: the passphrase typed into the form signs in`, true);

  for (const s of SHARD.filter((x) => size !== 'small' || x.small)) {
    const started = Date.now();
    let p = page, ctx = null;
    if (s.no3d) {
      // a browser that cannot draw 3D: its own context, signed in through the form, with the 3D contexts refused
      ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: size === 'phone', hasTouch: size === 'phone' });
      await ctx.grantPermissions(['accelerometer', 'gyroscope']);
      await ctx.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (type, ...rest) { if (type === 'webgl2' || type === 'webgl') return null; return orig.call(this, type, ...rest); }; });
      p = await ctx.newPage();
      await p.goto(`${base}/login`); await p.fill('#passphrase', PASS); await p.click('button[type=submit]'); await p.waitForURL(`${base}/`);
    }
    if (!s.keepDay) await noDay(p);
    await p.goto(`${base}${s.path}`);
    if (s.act) await s.act(p);
    const text = await p.textContent('body');
    check(`${size}: ${s.name} shows "${s.expect.trim()}"`, text.includes(s.expect));
    check(`${size}: ${s.name} fits the width`, await noSideways(p));
    await p.screenshot({ path: join(out, `${s.name}-${size}.png`) });
    if (s.after) await s.after(p);
    if (ctx) await ctx.close();
    console.log(`time ${size}: ${s.name} ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  await context.close();
}
await browser.close();
console.log(failed ? `${failed} check(s) failed` : `all checks passed (${SHARD.length} of ${SCREENS.length} states${shardOf > 1 ? `, shard ${shardIx}/${shardOf}` : ''}); screenshots in ${out}`);
process.exit(failed ? 1 : 0);
