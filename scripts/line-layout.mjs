// The firing line's layout, measured (brief range-day-nine, task item 1).
// Signs in through the form, opens the firing line with the page at its top
// at 412×915, at 412×830 (Dan's own phone, measured from his screenshots),
// and at 1280×800 (and 412×760 as a figure only: a phone whose browser bars take more room) for three sights (the Vepr's scope, the Tavor SAR's
// dot, the AK's irons), and prints for each element of the within-reach list
// whether its whole box is inside the screen and, on the phone, above the
// Steady and Fire bar; the bar's own checks; the view's size in pixels; and
// every button's touch height at 412×915. The Plain picture is used: the
// layout is the same under every picture and the measure is quicker.
//   node scripts/line-layout.mjs [--port 8925] [--aim tilt] > docs/reports/line-layout-after.txt
// range-day-sixteen: --aim tilt measures the firing line in tilt mode ("Aim: tilt" and Center shown), fed one made-up reading.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SIGHTS, measure, meets } = require('../test/line-reach.js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const PORT = Number(arg('--port', 8925));
const AIM = arg('--aim', 'drag');
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const SIZES = [['phone', 412, 915, true], ['phone, 830 high', 412, 830, true], ["Dan's phone (range-day-fourteen, measured)", 378, 762, true], ['computer', 1280, 800, true], ['short phone (figure only)', 412, 760, false]];

const server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => server.kill());
for (let i = 0; ; i++) { try { await fetch(`${base}/alive`); break; } catch { if (i > 100) throw new Error('server never answered'); await new Promise((r) => setTimeout(r, 50)); } }

const yn = (v) => (v == null ? 'n/a' : v ? 'yes' : 'no');
const out = [];
const say = (s) => { out.push(s); console.log(s); };
let failures = 0;
say(`Firing line layout, page at its top, Plain picture, aiming by ${AIM}. Commit ${process.env.GIT_COMMIT || '(working tree)'}.`);
const browser = await chromium.launch();
for (const [size, width, height, held] of SIZES) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 900, hasTouch: width < 900 });
  if (AIM === 'tilt') await context.grantPermissions(['accelerometer', 'gyroscope']);
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.fill('#passphrase', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  for (const s of SIGHTS) {
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('range-day:picture', JSON.stringify('plain')); });
    await page.goto(`${base}/line?${s.q}`);
    await page.waitForSelector('#fire');
    await page.waitForFunction(() => window.RangeDayLine);
    if (AIM === 'tilt') { await page.click('#aim-mode'); await page.waitForFunction(() => RangeDayLine.aimMode === 'tilt'); await page.evaluate(() => RangeDayLine.feedOrientation(0, 90, 0, performance.now() / 1000)); }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const m = await page.evaluate(measure, s.glass);
    say('');
    say(`== ${size} ${width}x${height} — ${s.name}`);
    say(`view: ${m.view.width} x ${m.view.height} px, top at ${m.view.top}; page scrolled ${m.scrollY}`);
    for (const it of m.items) {
      if (!it.shown) { say(`  ${it.name}: not shown for this sight`); continue; }
      say(`  ${it.name}: ${it.box.top}-${it.box.bottom}; inside the screen ${yn(it.inside)}${m.wide ? '' : `; above the bar ${yn(it.aboveBar)}`}`);
    }
    say(`  coarse buttons (1 MOA): ${m.coarse.length ? m.coarse.map((c) => `${c.id} ${c.box.top}-${c.box.bottom}`).join(', ') : 'not shown for this sight'}; within reach ${yn(m.coarseInStrip)}`);
    if (m.wide) say(`  Steady and Fire bar: ${m.bar.left}-${m.bar.right} x ${m.bar.top}-${m.bar.bottom}; beside the view covering none of it ${yn(m.barChecks.besideView)}; inside the screen ${yn(m.barChecks.inside)}`);
    else say(`  Steady and Fire bar: from ${m.bar.top} to ${m.bar.bottom}; fixed at the bottom inside the screen ${yn(m.barChecks.fixedAtBottom)}`);
    if (width === 412 && height <= 915 && held) say(`  touch heights: ${m.touch.map((t) => `${t.id} ${t.height}`).join(', ')}; under 44: ${m.touch.filter((t) => t.height < 44).map((t) => t.id).join(', ') || 'none'}`);
    const bad = meets(m);
    say(`  verdict: ${bad.length ? `NOT within reach — ${bad.join('; ')}` : 'everything within reach'}${held ? '' : ' (figure only)'}`);
    if (held && bad.length) failures++;
  }
  await context.close();
}
await browser.close();
say('');
say(failures ? `${failures} sight-and-size pair(s) not within reach` : 'every held sight-and-size pair within reach');
process.exit(0);
