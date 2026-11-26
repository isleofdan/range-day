// The live app in a real browser (range-day-sixteen; brief check finding: a deploy's success does not prove the page drew).
// Signs in through the sign-in form as a person would, opens the firing line, and checks that it drew: the plain picture's
// view canvas holds a real drawing (many colours, not blank), the 3D picture loads without falling back to plain, the Aim
// switch is on the screen, and the browser logged no error. Saves a screenshot of each picture to prod-check/.
//   BASE=https://range-day-dan.fly.dev APP_PASSWORD=... node scripts/prod-check.mjs
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.env.BASE, pass = process.env.APP_PASSWORD;
if (!base || !pass) { console.error('BASE and APP_PASSWORD are needed'); process.exit(2); }
mkdirSync('prod-check', { recursive: true });
const failures = [];
const say = (s) => console.log(s);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`page error: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${new URL(r.url()).pathname}`); });

await page.goto(`${base}/login`);
await page.fill('#passphrase', pass);
await page.click('button[type=submit]');
await page.waitForURL(`${base}/`, { timeout: 30000 });
say('signed in through the form: yes');

// 1. The plain picture: its view canvas is a 2D drawing the page can read back.
await page.evaluate(() => localStorage.setItem('range-day:picture', JSON.stringify('plain')));
await page.goto(`${base}/line`);
await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.geometry, null, { timeout: 30000 });
await page.waitForTimeout(1500);
const plain = await page.evaluate(() => {
  const c = document.getElementById('view'), g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
  const colours = new Set(); let opaque = 0;
  for (let i = 0; i < d.length; i += 4 * 97) { if (d[i + 3] > 0) opaque++; colours.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`); }
  return { w: c.width, h: c.height, colours: colours.size, opaque, picture: RangeDayLine.picture, aim: document.getElementById('aim-mode') && document.getElementById('aim-mode').textContent, fire: Boolean(document.getElementById('fire')), intro: document.getElementById('line-short').textContent };
});
say(`plain picture: view ${plain.w}x${plain.h}, ${plain.colours} colours in the sample, ${plain.opaque} drawn samples; Aim switch "${plain.aim}"; Fire ${plain.fire ? 'shown' : 'missing'}; short line "${plain.intro}"`);
if (plain.picture !== 'plain') failures.push(`the plain picture did not open (${plain.picture})`);
if (plain.colours < 20 || plain.opaque < 100) failures.push('the plain view did not draw');
if (plain.aim !== 'Aim: drag') failures.push(`the Aim switch reads "${plain.aim}"`);
if (!plain.fire) failures.push('Fire is missing');
await page.screenshot({ path: 'prod-check/line-plain.png' });

// 2. The 3D picture (Full): it loads and draws without falling back to plain.
// The canyon course has the 3D picture (data/courses.json, pictureReady); the day open from step 1 is on another course,
// so it is packed up first, as Pack up would, to let the address choose the course.
await page.evaluate(() => { localStorage.setItem('range-day:picture', JSON.stringify('full')); localStorage.removeItem('range-day:day:open'); });
await page.goto(`${base}/line?course=cta-piru`);
await page.waitForFunction(() => window.RangeDayLine && RangeDayLine.geometry, null, { timeout: 30000 });
await page.waitForFunction(() => !RangeDayLine.sceneLoading && (RangeDayLine.scene || RangeDayLine.sceneFailed), null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);
const full = await page.evaluate(() => ({ picture: RangeDayLine.picture, failed: RangeDayLine.sceneFailed, note: document.getElementById('picture-note').textContent }));
say(`full picture: ${full.picture}${full.failed ? ', fell back to plain' : ''}${full.note ? ` ("${full.note}")` : ''}`);
if (full.picture !== 'full' || full.failed) failures.push(`the full picture did not draw (${full.picture}${full.note ? `: ${full.note}` : ''})`);
await page.screenshot({ path: 'prod-check/line-full.png' });

say(`browser errors: ${errors.length ? errors.join(' | ') : 'none'}`);
if (errors.length) failures.push(`${errors.length} browser error(s)`);
await browser.close();
say(failures.length ? `PRODUCTION CHECK FAILED: ${failures.join('; ')}` : 'production check: the firing line drew, with no browser error');
process.exit(failures.length ? 1 : 0);
