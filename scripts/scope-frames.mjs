// The spotting scope's speed (range-day-ten, verify 6): the median time of
// 60 frames of the firing line's own loop on the 1,000-yard canyon plate,
// through the spotting scope at its highest power and through the Vepr's
// scope at its highest power (range-day-eleven: the 25-125x at 125x and the Vepr's BugBuster at 9x; 60x and 7x before), under Full and Light, at 412 and 1280 pixels wide. Signs in
// through the form. The test browser draws in software: its frame times are
// its own, not a phone's; the figures compare the two views, they do not
// predict a phone.
//   node scripts/scope-frames.mjs [--port 8951]
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const PORT = Number(arg('--port', 8951)), PASS = 'open sesame', base = `http://127.0.0.1:${PORT}`;
const server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => server.kill());
for (let i = 0; ; i++) { try { await fetch(`${base}/alive`); break; } catch { if (i > 100) throw new Error('server never answered'); await new Promise((r) => setTimeout(r, 50)); } }
const browser = await chromium.launch();
const median = (page) => page.evaluate(() => new Promise((res) => { const t = []; let last = 0; const f = (now) => { if (last) t.push(now - last); last = now; if (t.length < 60) requestAnimationFrame(f); else res(t.sort((a, b) => a - b)[30]); }; requestAnimationFrame(f); }));
for (const width of [412, 1280]) {
  const context = await browser.newContext({ viewport: { width, height: width === 412 ? 915 : 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${base}/login`); await page.fill('#passphrase', PASS); await page.click('button[type=submit]'); await page.waitForURL(`${base}/`);
  for (const picture of ['full', 'light']) {
    await page.evaluate((p) => { localStorage.clear(); localStorage.setItem('range-day:picture', JSON.stringify(p)); }, picture);
    await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt`, { timeout: 120000 });
    await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.scene && RangeDayLine.scene.materials && RangeDayLine.scene.materials.settled, null, { timeout: 180000 });
    await page.evaluate(() => { RangeDayLine.setTarget('8'); RangeDayLine.setZoom(9); });
    await page.waitForTimeout(1500);
    const rifle = await median(page);
    await page.evaluate(() => { RangeDayLine.setSpotting(true); RangeDayLine.setSpotZoom(Number(document.getElementById('spot-zoom').max)); });
    await page.waitForTimeout(1500);
    const spot = await median(page);
    console.log(`${width} px, ${picture}, the 1,000-yard plate: median frame through the Vepr's scope at 9x ${rifle.toFixed(1)} ms; through the spotting scope at 125x ${spot.toFixed(1)} ms (${spot > rifle ? '+' : ''}${(((spot - rifle) / rifle) * 100).toFixed(0)} percent)`);
  }
  await context.close();
}
await browser.close();
process.exit(0);
