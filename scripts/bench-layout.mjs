// The zero bench's layout, measured (brief range-day-thirteen, task item 5): the bench's twin of scripts/line-layout.mjs.
// Signs in through the form, opens the bench with the page at its top at 412×915, at 412×830 (Dan's own phone) and at 1280×800,
// for every sight of every rifle (the scope collection included: test/bench-reach.js), and prints each control's box, whether it
// is wholly on the first screen, every pair of buttons that touch, the paper's size and where Fire's bottom edge stands against the
// screen's height. test/bench.test.js holds the same list.
//   node scripts/bench-layout.mjs [--port 8926] > docs/reports/bench-layout-after.txt
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { SIZES, SIGHTS, LIST, BUTTONS, measure, meets } = require('../test/bench-reach.js');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const PORT = Number(arg('--port', 8926));
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;

const server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => server.kill());
for (let i = 0; ; i++) { try { await fetch(`${base}/alive`); break; } catch { if (i > 100) throw new Error('server never answered'); await new Promise((r) => setTimeout(r, 50)); } }

let failures = 0;
console.log(`Zero bench layout, page at its top. Commit ${process.env.GIT_COMMIT || '(working tree)'}. Boxes are top-bottom, left-right in CSS pixels.`);
const browser = await chromium.launch();
for (const [width, height] of SIZES) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 900, hasTouch: width < 900 });
  const page = await context.newPage();
  await page.goto(`${base}/login`);
  await page.fill('#passphrase', PASS);
  await page.click('button[type=submit]');
  await page.waitForURL(`${base}/`);
  for (const s of SIGHTS) {
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('range-day:picture', JSON.stringify('plain')); });
    await page.goto(`${base}/zero?${s.q}`);
    await page.waitForSelector('#fire5');
    await page.waitForFunction(() => window.RangeDayZero);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(150);
    const m = await page.evaluate(measure, [LIST, BUTTONS]);
    console.log('');
    console.log(`== ${width}x${height} — ${s.name}`);
    console.log(`paper: ${m.paper.width} x ${m.paper.height} px; Fire's bottom edge at ${m.fireBottom} of ${height}; page scrolled ${m.scrollY}`);
    for (const it of m.items) console.log(it.shown ? `  ${it.name}: ${it.box.top}-${it.box.bottom}, ${it.box.left}-${it.box.right}; on the first screen ${it.inside ? 'yes' : 'no'}` : `  ${it.name}: not shown`);
    const bad = meets(m);
    console.log(`  buttons touching: ${m.touching.length ? m.touching.join('; ') : 'none'}`);
    console.log(`  verdict: ${bad.length ? `NOT within reach — ${bad.join('; ')}` : 'everything within reach'}`);
    if (bad.length) failures++;
  }
  await context.close();
}
await browser.close();
console.log('');
console.log(failures ? `${failures} sight-and-size pair(s) not within reach` : 'every sight-and-size pair within reach');
process.exit(0);
