// range-day-twelve verify 7: both zoom sliders' lengths and their gaps to the right edge, on the two phone sizes and the computer,
// signing in through the form. Run from the repository's root: node docs/reports/range-day-twelve/sliders.mjs
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
const PORT = 8931, base = `http://127.0.0.1:${PORT}`, PASS = 'open sesame';
const server = spawn('node', ['server.js'], { env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: 'ignore' });
for (let i = 0; ; i++) { try { await fetch(`${base}/alive`); break; } catch { if (i > 100) throw new Error('no server'); await new Promise((r) => setTimeout(r, 50)); } }
const browser = await chromium.launch();
for (const [w, h] of [[412, 915], [412, 830], [1280, 800]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 900, hasTouch: w < 900 });
  const page = await context.newPage();
  await page.goto(`${base}/login`); await page.fill('#passphrase', PASS); await page.click('button[type=submit]'); await page.waitForURL(`${base}/`);
  await page.evaluate(() => localStorage.setItem('range-day:picture', JSON.stringify('plain')));
  await page.goto(`${base}/line?course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt`); await page.waitForSelector('#fire');
  const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { width: r.width, right: r.right }; }, sel);
  const zoom = await box('#zoom');
  await page.evaluate(() => RangeDayLine.setSpotting(true)); await page.waitForTimeout(300);
  const spot = await box('#spot-zoom');
  console.log(`${w}x${h}: rifle scope's zoom slider ${zoom.width.toFixed(0)} px long, ends ${(w - zoom.right).toFixed(0)} px from the right edge; spotting scope's slider ${spot.width.toFixed(0)} px long, ends ${(w - spot.right).toFixed(0)} px from the right edge`);
  await context.close();
}
await browser.close(); server.kill();
