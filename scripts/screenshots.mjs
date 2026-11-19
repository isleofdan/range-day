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
//   --port 8923                         the server's port (one per shard
//       running at once); --list prints the state names and stops
// Every state's seconds are printed, so the slow ones can be seen.
// An app adds its own screens to SCREENS.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
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
const SIZES = { phone: { width: 412, height: 915 }, computer: { width: 1280, height: 800 } };
// Range Day's screens. `act` drives the screen into the state the brief asks
// to see before the screenshot; `expect` is text the screen must show.
const PIRU = '/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
const ZERO = '/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
const SYLMAR = '/line?course=angeles-sylmar';
const settle = (page, ms) => page.waitForTimeout(ms);
// The firing line is ready when its picture is: the scene built (Full or Light), or Plain shown.
const ready = async (page) => { await page.waitForSelector('#fire'); await page.waitForFunction(() => window.RangeDayLine && (RangeDayLine.scene || RangeDayLine.sceneFailed || (!RangeDayLine.sceneLoading && RangeDayLine.picture === 'plain')), null, { timeout: 90000 }); await settle(page, 400); };
const plate = async (page, ix) => { await ready(page); await page.selectOption('#plate', String(ix)); await settle(page, 400); };
// Clears what this device keeps for a rifle and sight, so a state starts from the middle.
const fresh = (page, rifle, sight) => page.evaluate(([r, s]) => { for (const k of Object.keys(localStorage)) if (k.startsWith(`range-day:sight:${r}:${s}`) || k.startsWith(`range-day:zero:${r}:`) || k.startsWith(`range-day:log:${r}:`)) localStorage.removeItem(k); }, [rifle, sight]);
// Closes the open day, so a screen opens on the choice its address makes (an open day with shots wins over the address). Every screen starts that way unless it says keepDay.
const noDay = (page) => page.evaluate(() => { localStorage.removeItem('range-day:day:open'); localStorage.removeItem('range-day:day:packed'); for (const k of Object.keys(localStorage)) if (k.startsWith('range-day:supply:')) localStorage.removeItem(k); localStorage.setItem('range-day:picture', JSON.stringify('full')); }); // a fresh day, a full zeroing supply and the Full picture before each state (a state that wants another picture sets it)
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
const AR = '/line?course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193';
const SCREENS = [
  { name: 'home', path: '/?rifle=iwi-x95', expect: 'When: time of day', act: (page) => page.waitForSelector('.rifle.picked[data-rifle="iwi-x95"]') },
  // A day is open (shots fired at the bench): home shows the day first, with the doors back into it.
  { name: 'home-day-open', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193', expect: 'A day is open', act: async (page) => { await page.waitForSelector('#fire5'); await page.click('#fire5'); await page.goto(`${base}/`); await page.waitForSelector('#day-card'); } },
  // The bench in the middle of a day: a group fired, the rounds left beside the setting.
  { name: 'zero-mid-day', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193', expect: 'zeroing supply: 15 of 20 left', act: async (page) => { await page.evaluate(() => localStorage.removeItem('range-day:supply:bcm-ar15:imi-m193')); await page.reload(); await page.waitForSelector('#fire5'); await page.click('#fire5'); await settle(page, 200); } },
  // The bench with the zeroing supply used up: the bench stays, "Open another box" is offered.
  { name: 'zero-supply-empty', path: '/zero?course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193', expect: 'Open another box to go on', act: async (page) => { await page.evaluate(() => localStorage.removeItem('range-day:supply:bcm-ar15:imi-m193')); await page.reload(); await page.waitForSelector('#fire5'); for (let i = 0; i < 4; i++) await page.click('#fire5'); await settle(page, 200); } },
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
    await page.goto(`${base}/book?course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193`); await page.waitForSelector('.entry');
    await page.fill('.entry .note', 'wind picked up after this one'); await page.press('.entry .note', 'Tab');
    await page.click('.entry .strike'); await page.waitForSelector('.entry.struck'); await settle(page, 200);
  } },
  // The book page with no hits.
  { name: 'book-empty', path: '/book?course=angeles-sylmar&rifle=remington-22&sight=rem-irons&load=cci-sv-40', expect: 'Nothing in this book yet', act: (page) => page.waitForSelector('#pages') },
  // The cold-bore record with several days: three days, each begun with a shot at a plate.
  { name: 'cold-bore-several', path: AR, expect: 'The cold-bore record', act: async (page) => {
    for (let dayN = 0; dayN < 3; dayN++) { await noDay(page); await page.goto(`${base}${AR}`); await plate(page, dayN); await seededShot(page, 500 + dayN); }
    await page.goto(`${base}/book?course=angeles-sylmar&rifle=bcm-ar15&sight=ar-irons&load=imi-m193`); await page.waitForSelector('#cold table');
  } },
  // A January morning and a July afternoon on the canyon course through the Vepr's scope.
  { name: 'line-january-morning', path: `${PIRU}&sight=utg-2-7x44&month=1&time=morning`, expect: 'January morning', act: (page) => plate(page, 4) },
  { name: 'line-july-afternoon', path: `${PIRU}&sight=utg-2-7x44&month=7&time=afternoon`, expect: 'July afternoon', act: (page) => plate(page, 4) },
  // The canyon course's picture (range-day-five): through the Vepr's scope at 2x and 7x and through its irons at 1x, in February at midday and in September in the afternoon.
  { name: 'line-feb-midday-2x', path: `${PIRU}&sight=utg-2-7x44&month=2&time=midday`, expect: 'February midday', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(2)); await settle(page, 400); } },
  { name: 'line-feb-midday-7x', path: `${PIRU}&sight=utg-2-7x44&month=2&time=midday`, expect: 'February midday', act: async (page) => { await plate(page, 8); await page.evaluate(() => RangeDayLine.setZoom(7)); await settle(page, 400); } },
  { name: 'line-feb-midday-irons', path: `${PIRU}&sight=vepr-irons&month=2&time=midday`, expect: 'February midday', act: (page) => plate(page, 4) },
  { name: 'line-sep-afternoon-2x', path: `${PIRU}&sight=utg-2-7x44&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(2)); await settle(page, 400); } },
  { name: 'line-sep-afternoon-7x', path: `${PIRU}&sight=utg-2-7x44&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await plate(page, 8); await page.evaluate(() => RangeDayLine.setZoom(7)); await settle(page, 400); } },
  { name: 'line-sep-afternoon-irons', path: `${PIRU}&sight=vepr-irons&month=9&time=afternoon`, expect: 'September afternoon', act: (page) => plate(page, 4) },
  // range-day-six: the other two of each day's measured states (2x on the 1,000-yard plate, 7x on the 600-yard plate), and the 200-yard plate among the numbered boards at 4x.
  { name: 'line-feb-midday-2x-1000', path: `${PIRU}&sight=utg-2-7x44&month=2&time=midday`, expect: 'February midday', act: async (page) => { await plate(page, 8); await page.evaluate(() => RangeDayLine.setZoom(2)); await settle(page, 400); } },
  { name: 'line-feb-midday-7x-600', path: `${PIRU}&sight=utg-2-7x44&month=2&time=midday`, expect: 'February midday', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(7)); await settle(page, 400); } },
  { name: 'line-sep-afternoon-2x-1000', path: `${PIRU}&sight=utg-2-7x44&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await plate(page, 8); await page.evaluate(() => RangeDayLine.setZoom(2)); await settle(page, 400); } },
  { name: 'line-sep-afternoon-7x-600', path: `${PIRU}&sight=utg-2-7x44&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(7)); await settle(page, 400); } },
  { name: 'line-sep-boards-200', path: `${PIRU}&sight=utg-2-7x44&month=9&time=midday`, expect: 'September midday', act: async (page) => { await plate(page, 0); await page.evaluate(() => RangeDayLine.setZoom(4)); await settle(page, 400); } },
  // A hit with its strike mark on the plate, at 7x.
  // (the sight is dialled onto the probe shot with the knobs, as a shooter would, so the plate stays at the reticle when the second shot chips it)
  { name: 'line-hit-strike', path: `${PIRU}&sight=utg-2-7x44&month=9&time=midday`, expect: 'Hit', act: async (page) => {
    await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-2-7x44'); await page.reload(); await plate(page, 0); await page.evaluate(() => RangeDayLine.setZoom(7));
    await page.evaluate(() => RangeDayLine.setHold(0, 0));
    const probe = await seededShot(page, 21);
    const ipm = 200 * 36 * (Math.PI / (180 * 60));
    const el = -probe.upIn / ipm, wd = -probe.rightIn / ipm; // minutes of angle to dial
    for (let i = 0; i < Math.floor(Math.abs(el)); i++) await page.click(el > 0 ? '#el-up-moa' : '#el-down-moa');
    for (let i = 0; i < Math.round((Math.abs(el) % 1) / 0.25); i++) await page.click(el > 0 ? '#el-up' : '#el-down');
    for (let i = 0; i < Math.floor(Math.abs(wd)); i++) await page.click(wd > 0 ? '#wd-right-moa' : '#wd-left-moa');
    for (let i = 0; i < Math.round((Math.abs(wd) % 1) / 0.25); i++) await page.click(wd > 0 ? '#wd-right' : '#wd-left');
    await seededShot(page, 21); await page.evaluate(() => window.scrollTo(0, 0)); await settle(page, 3500);
  } },
  // The Light picture beside the Full one (the same view as line-sep-afternoon-2x).
  { name: 'line-light-2x', path: `${PIRU}&sight=utg-2-7x44&month=9&time=afternoon`, expect: 'September afternoon', act: async (page) => { await picture(page, 'light'); await page.reload(); await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(2)); await settle(page, 400); } },
  // The Plain fallback: a browser without 3D shows the plain picture and the one line (its own browser context, with 3D switched off).
  { name: 'line-plain-fallback', path: `${PIRU}&sight=utg-2-7x44&month=9&time=afternoon`, expect: 'could not draw the full picture', no3d: true, act: async (page) => { await page.evaluate(() => localStorage.removeItem('range-day:picture')); await page.reload(); await plate(page, 4); } },
  // The setting: Picture, with the conditions switch.
  { name: 'line-picture-setting', path: `${PIRU}&sight=utg-2-7x44`, expect: 'Picture', act: async (page) => { await ready(page); await page.evaluate(() => document.getElementById('picture').scrollIntoView()); await settle(page, 200); } },
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
  { name: 'line-ak-leaf', path: `${SYLMAR}&rifle=ak-762&sight=ak-irons&load=silver-bear-123`, expect: 'Leaf 3 (300 m', act: async (page) => { await ready(page); await fresh(page, 'ak-762', 'ak-irons'); await page.reload(); await plate(page, 2); await page.click('#leaf-up'); await page.click('#leaf-up'); await settle(page, 300); } },
  { name: 'line-vepr-irons-600', path: '/line?course=cta-piru&rifle=molot-vepr-54r&sight=vepr-irons&load=sb-174-hpbt', expect: 'Vepr iron sights', act: (page) => plate(page, 4) },
  { name: 'line-tavor-irons-200', path: `${SYLMAR}&rifle=iwi-x95&sight=tavor-irons&load=imi-m193`, expect: 'Tavor folding iron sights', act: (page) => plate(page, 1) },
  { name: 'line-22-100', path: `${SYLMAR}&rifle=remington-22&sight=rem-irons&load=cci-sv-40`, expect: 'Open rimfire sights', act: (page) => plate(page, 0) },
  { name: 'line-knob-stop', path: `${PIRU}&sight=utg-2-7x44`, expect: 'end of its travel', act: async (page) => { await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-2-7x44'); await page.reload(); await ready(page); for (let i = 0; i < 41; i++) await page.click('#el-up-moa'); await settle(page, 200); } },
  { name: 'line-scope-2x', path: PIRU, expect: 'Firing line', act: async (page) => { await plate(page, 4); await page.evaluate(() => RangeDayLine.setZoom(2)); await settle(page, 400); } },
  { name: 'line-scope-7x', path: PIRU, expect: 'Zoom 7', act: async (page) => { await ready(page); await page.evaluate(() => RangeDayLine.setZoom(7)); await settle(page, 400); } },
  { name: 'line-canyon-irons', path: '/line?course=cta-piru&rifle=molot-vepr-54r&sight=vepr-irons&load=sb-174-hpbt', expect: 'Canyon course', act: (page) => plate(page, 4) },
  { name: 'line-irons-600', path: `${SYLMAR}&rifle=bcm-ar15&load=federal-gmm-69`, expect: '600 yards', act: (page) => plate(page, 5) },
  { name: 'line-rifle-line-irons', path: `${SYLMAR}&rifle=bcm-ar15&sight=ar-irons&load=imi-m193`, expect: 'Rifle line', act: (page) => plate(page, 2) },
  // Unzeroed, the first shot at 200 yards lands well low: a miss, with its dust, at 2x and at 7x.
  { name: 'line-miss-dust-2x', path: PIRU, expect: 'Miss', act: async (page) => {
    await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-2-7x44');
    await page.reload(); await ready(page); await page.evaluate(() => RangeDayLine.setZoom(2)); await page.click('#fire'); await landed(page); await settle(page, 300);
  } },
  { name: 'line-miss-dust', path: PIRU, expect: 'Miss', act: async (page) => {
    await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-2-7x44');
    await page.reload(); await ready(page); await page.evaluate(() => RangeDayLine.setZoom(7)); await page.click('#fire'); await landed(page); await settle(page, 300);
  } },
  { name: 'line-shot-log', path: PIRU, expect: 'miss:', act: async (page) => { await ready(page); await page.evaluate(() => document.getElementById('log').scrollIntoView()); await settle(page, 200); } },
  { name: 'line-conditions-on', path: PIRU, expect: 'Wind, near stretch', act: async (page) => { await ready(page); await page.check('#show-conditions'); await page.evaluate(() => document.getElementById('conditions').scrollIntoView()); await settle(page, 200); } },
];

const SHARD = SCREENS.filter((_, i) => i % shardOf === shardIx - 1);
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

  for (const s of SHARD) {
    const started = Date.now();
    let p = page, ctx = null;
    if (s.no3d) {
      // a browser that cannot draw 3D: its own context, signed in through the form, with the 3D contexts refused
      ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: size === 'phone', hasTouch: size === 'phone' });
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
    if (ctx) await ctx.close();
    console.log(`time ${size}: ${s.name} ${((Date.now() - started) / 1000).toFixed(1)} s`);
  }
  await context.close();
}
await browser.close();
console.log(failed ? `${failed} check(s) failed` : `all checks passed (${SHARD.length} of ${SCREENS.length} states${shardOf > 1 ? `, shard ${shardIx}/${shardOf}` : ''}); screenshots in ${out}`);
process.exit(failed ? 1 : 0);
