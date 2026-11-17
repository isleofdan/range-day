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
const settle = (page, ms) => page.waitForTimeout(ms);
const SCREENS = [
  { name: 'home', path: '/', expect: 'This is ', act: (page) => page.waitForSelector('.choice') },
  { name: 'status', path: '/status', expect: 'alive since ' },
  { name: 'zero-before', path: ZERO, expect: 'center of the group', act: async (page) => { await page.waitForSelector('#fire5'); await page.click('#fire5'); await settle(page, 200); } },
  { name: 'zero-after', path: ZERO, expect: 'Saved zero', act: async (page) => {
    await page.waitForSelector('#fire5'); await page.click('#fire5'); await settle(page, 100);
    for (let i = 0; i < 40; i++) await page.click('#el-up');
    for (let i = 0; i < 12; i++) await page.click('#wd-left');
    await page.click('#fresh'); await page.click('#fire5'); await page.click('#save'); await settle(page, 200);
  } },
  { name: 'line-scope-2x', path: PIRU, expect: 'Firing line', act: async (page) => { await page.waitForSelector('#fire'); await page.evaluate(() => RangeDayLine.setZoom(2)); await settle(page, 400); } },
  { name: 'line-scope-7x', path: PIRU, expect: 'Zoom 7', act: async (page) => { await page.waitForSelector('#fire'); await page.evaluate(() => RangeDayLine.setZoom(7)); await settle(page, 400); } },
  { name: 'line-irons-600', path: '/line?course=angeles-sylmar&rifle=bcm-ar15&load=federal-gmm-69', expect: '600 yards', act: async (page) => { await page.waitForSelector('#fire'); await page.selectOption('#plate', '5'); await settle(page, 400); } },
  { name: 'line-miss-dust', path: PIRU, expect: 'Miss', act: async (page) => {
    // Unzeroed, the first shot at 200 yards lands well low: a miss, with its dust.
    await page.waitForSelector('#fire'); await page.evaluate(() => { localStorage.removeItem('range-day:sight:molot-vepr-54r:utg-2-7x44'); localStorage.removeItem('range-day:zero:molot-vepr-54r:sb-174-hpbt'); localStorage.removeItem('range-day:log:molot-vepr-54r:sb-174-hpbt'); RangeDayLine.setZoom(7); });
    await page.reload(); await page.waitForSelector('#fire'); await page.evaluate(() => RangeDayLine.setZoom(7)); await page.click('#fire'); await settle(page, 1400);
  } },
  { name: 'line-shot-log', path: PIRU, expect: 'miss:', act: async (page) => { await page.waitForSelector('#fire'); await page.evaluate(() => document.getElementById('log').scrollIntoView()); await settle(page, 200); } },
  { name: 'line-conditions-on', path: PIRU, expect: 'Wind, near stretch', act: async (page) => { await page.waitForSelector('#fire'); await page.check('#show-conditions'); await page.evaluate(() => document.getElementById('conditions').scrollIntoView()); await settle(page, 200); } },
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
