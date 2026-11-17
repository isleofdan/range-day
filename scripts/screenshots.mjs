// Drives the app in a real browser and saves every screen at phone size
// (412×915) and computer size (1280×800) into docs/reports/screenshots/.
// It signs in the way a person does: it opens the sign-in page and types
// the passphrase (with a space after it, as a phone keyboard adds) into the
// form. Never pre-supplied credentials. Along the way it checks no screen
// scrolls sideways.
//   npm run screenshots
// An app adds its own screens to SCREENS.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'reports', 'screenshots');
mkdirSync(out, { recursive: true });

const PORT = 8921;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const SIZES = { phone: { width: 412, height: 915 }, computer: { width: 1280, height: 800 } };
// Range Day's screens. `act` drives the screen into the state the brief asks
// to see before the screenshot; `expect` is text the screen must show.
const PIRU = '/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
const ZERO = '/zero?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
const SYLMAR = '/line?course=angeles-sylmar';
const settle = (page, ms) => page.waitForTimeout(ms);
const ready = (page) => page.waitForSelector('#fire');
const plate = async (page, ix) => { await ready(page); await page.selectOption('#plate', String(ix)); await settle(page, 400); };
// Clears what this device keeps for a rifle and sight, so a state starts from the middle.
const fresh = (page, rifle, sight) => page.evaluate(([r, s]) => { for (const k of Object.keys(localStorage)) if (k.startsWith(`range-day:sight:${r}:${s}`) || k.startsWith(`range-day:zero:${r}:`) || k.startsWith(`range-day:log:${r}:`)) localStorage.removeItem(k); }, [rifle, sight]);
const SCREENS = [
  { name: 'home', path: '/?rifle=iwi-x95', expect: 'This is ', act: (page) => page.waitForSelector('.rifle.picked[data-rifle="iwi-x95"]') },
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
    await page.reload(); await ready(page); await page.evaluate(() => RangeDayLine.setZoom(2)); await page.click('#fire'); await settle(page, 1100);
  } },
  { name: 'line-miss-dust', path: PIRU, expect: 'Miss', act: async (page) => {
    await ready(page); await fresh(page, 'molot-vepr-54r', 'utg-2-7x44');
    await page.reload(); await ready(page); await page.evaluate(() => RangeDayLine.setZoom(7)); await page.click('#fire'); await settle(page, 1100);
  } },
  { name: 'line-shot-log', path: PIRU, expect: 'miss:', act: async (page) => { await ready(page); await page.evaluate(() => document.getElementById('log').scrollIntoView()); await settle(page, 200); } },
  { name: 'line-conditions-on', path: PIRU, expect: 'Wind, near stretch', act: async (page) => { await ready(page); await page.check('#show-conditions'); await page.evaluate(() => document.getElementById('conditions').scrollIntoView()); await settle(page, 200); } },
];

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

  for (const s of SCREENS) {
    await page.goto(`${base}${s.path}`);
    if (s.act) await s.act(page);
    const text = await page.textContent('body');
    check(`${size}: ${s.name} shows "${s.expect.trim()}"`, text.includes(s.expect));
    check(`${size}: ${s.name} fits the width`, await noSideways(page));
    await page.screenshot({ path: join(out, `${s.name}-${size}.png`) });
  }
  await context.close();
}
await browser.close();
console.log(failed ? `${failed} check(s) failed` : `all checks passed; screenshots in ${out}`);
process.exit(failed ? 1 : 0);
