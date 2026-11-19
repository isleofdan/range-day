// Measures the firing line's picture, before and after a change, from the
// scene's own canvas (not the sight's), in a real browser signing in through
// the form: (a) sharpness, the mean absolute difference in brightness between
// neighbouring pixels, across and down, over the middle 40 percent of the
// view; (b) the median colour of named patches (the ones the Look check
// samples, plus sunlit brush); (c) the median time of 60 frames. States: the
// Vepr's scope at 2x and 7x on the 600- and 1,000-yard plates and its irons at
// 1x on the 600-yard plate, each on a February midday and a September
// afternoon, at 412 and 1,280 pixels wide, on Full and on Light.
//   node scripts/picture-measure.mjs > docs/reports/picture-before.txt
// The test browser draws in software; frame times are its, not a phone's.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8963;
const PASS = 'open sesame';
const base = `http://127.0.0.1:${PORT}`;
const look = JSON.parse(readFileSync(join(root, 'data', 'look.json'), 'utf8'));
const P = look.palette['cta-piru'];
const hexOf = (o) => o.value;
const PIRU = '/line?course=cta-piru&rifle=molot-vepr-54r&load=sb-174-hpbt';
const DAYS = [
  { name: 'February midday', q: 'month=2&time=midday', patches: [
    ['sky, 18 degrees up', { yaw: 0, pitch: 18, fov: 4 }, hexOf(P.green.sky)],
    ['sunlit hillside (the headwall, 700 m)', { aim: [0, -700], fov: 4 }, hexOf(P.green.sunlitSlope)],
    ['dirt floor in sun (60 m)', { aim: [3, -60], fov: 6 }, hexOf(P.green.floor)],
    ['scrub on the left wall (450 m)', { aim: [-140, -450], fov: 2.5 }, hexOf(P.green.scrub)],
    ['sunlit brush (three bushes 250 to 350 m out, each at 0.3 degrees)', { brush: true, fov: 0.3 }, hexOf(P.green.scrub)],
    ['the 600-yard plate\'s red paint through the scope at 7x', { plate: 4, fov: 45.8 / 60, glass: true, n: 10 }, hexOf(P.paintRedInSun)]] },
  { name: 'September afternoon', q: 'month=9&time=afternoon', patches: [
    ['sky, 18 degrees up', { yaw: 0, pitch: 18, fov: 4 }, hexOf(P.dry.sky)],
    ['sunlit dry slope (the right wall, 600 m)', { aim: [150, -600], fov: 4 }, hexOf(P.dry.sunlitSlope)],
    ['dirt floor in sun (60 m)', { aim: [3, -60], fov: 6 }, hexOf(P.dry.floor)],
    ['scrub on the left wall (450 m)', { aim: [-140, -450], fov: 2.5 }, hexOf(P.dry.scrub)],
    ['sunlit brush (three bushes 250 to 350 m out, each at 0.3 degrees)', { brush: true, fov: 0.3 }, hexOf(P.dry.scrub)],
    ['the 600-yard plate\'s red paint through the scope at 7x', { plate: 4, fov: 45.8 / 60, glass: true, n: 10 }, hexOf(P.paintRedInSun)]] },
];
const STATES = [
  { name: 'scope 2x, 600 yd', sight: 'utg-2-7x44', zoom: 2, plate: 4 },
  { name: 'scope 2x, 1000 yd', sight: 'utg-2-7x44', zoom: 2, plate: 8 },
  { name: 'scope 7x, 600 yd', sight: 'utg-2-7x44', zoom: 7, plate: 4 },
  { name: 'scope 7x, 1000 yd', sight: 'utg-2-7x44', zoom: 7, plate: 8 },
  { name: 'irons 1x, 600 yd', sight: 'vepr-irons', zoom: null, plate: 4 },
];
const WIDTHS = [[412, { width: 412, height: 915 }], [1280, { width: 1280, height: 800 }]];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

const server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: PASS, COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => server.kill());
for (let i = 0; ; i++) { try { await fetch(`${base}/alive`); break; } catch { if (i > 100) throw new Error('server never answered'); await new Promise((r) => setTimeout(r, 50)); } }

// In the page: aim the scene by the sight's own figures, draw one frame, read the scene canvas.
const inPage = {
  aim: (v) => {
    const s = RangeDayLine.scene, eye = 4 * 0.3048;
    let yaw = v.yaw || 0, pitch = v.pitch || 0;
    if (v.aim) { const g = s.groundAt(v.aim[0], v.aim[1]); yaw = (Math.atan2(v.aim[0], -v.aim[1]) * 180) / Math.PI; pitch = (Math.atan2(g - eye, -v.aim[1]) * 180) / Math.PI; }
    if (v.plate != null) { const w = s.plateWorld(v.plate); yaw = (Math.atan2(w.x, -w.z) * 180) / Math.PI; pitch = (Math.atan2(w.y - eye, -w.z) * 180) / Math.PI; }
    if (v.world) { const w = v.world; yaw = (Math.atan2(w[0], -w[2]) * 180) / Math.PI; pitch = (Math.atan2(w[1] - eye, -w[2]) * 180) / Math.PI; }
    s.setView({ yawDeg: yaw, pitchDeg: pitch, fovDeg: v.fov, glass: Boolean(v.glass), windMph: 0 });
  },
  read: () => { const sc = document.getElementById('scene'); const c = document.createElement('canvas'); c.width = sc.width; c.height = sc.height; const g = c.getContext('2d'); g.drawImage(sc, 0, 0); return { g, w: sc.width, h: sc.height }; },
};
const fn = (body) => new Function('...args', `${Object.entries(inPage).map(([k, f]) => `const ${k} = ${f.toString()};`).join('\n')}\nreturn (${body})(...args);`);

console.log(`picture-measure: ${new Date().toISOString().slice(0, 10)}, test browser (software 3D), scene canvas only`);
const browser = await chromium.launch();
for (const [width, viewport] of WIDTHS) for (const picture of ['full', 'light']) for (const day of DAYS) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${base}/login`); await page.fill('#passphrase', PASS); await page.click('button[type=submit]'); await page.waitForURL(`${base}/`);
  await page.evaluate((p) => { try { localStorage.removeItem('range-day:day:open'); localStorage.removeItem('range-day:day:packed'); localStorage.setItem('range-day:picture', JSON.stringify(p)); } catch {} }, picture);
  let patchesDone = false;
  for (const sightId of ['utg-2-7x44', 'vepr-irons']) {
    await page.evaluate(() => localStorage.removeItem('range-day:day:open'));
    await page.goto(`${base}${PIRU}&sight=${sightId}&${day.q}`); await page.waitForSelector('#fire');
    await page.waitForFunction(() => RangeDayLine.scene || RangeDayLine.sceneFailed || (!RangeDayLine.sceneLoading && RangeDayLine.picture === 'plain'), null, { timeout: 120000 });
    const up = await page.evaluate(() => Boolean(RangeDayLine.scene) && RangeDayLine.picture);
    if (up !== picture) { console.log(`${width} px, ${picture}, ${day.name}: the ${picture} picture did not come up (${up})`); continue; }
    const size = await page.evaluate(() => RangeDayLine.scene.size);
    // the frame time: 60 frames of the line's own loop, as the first visit counts them
    const frameMs = await page.evaluate(() => new Promise((res) => { const t = []; let last = 0; const f = (now) => { if (last) t.push(now - last); last = now; if (t.length < 60) requestAnimationFrame(f); else res(t.sort((a, b) => a - b)[30]); }; requestAnimationFrame(f); }));
    await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); await page.waitForTimeout(200);
    for (const st of STATES.filter((s) => s.sight === sightId)) {
      await page.selectOption('#plate', String(st.plate));
      if (st.zoom) await page.evaluate((z) => RangeDayLine.setZoom(z), st.zoom);
      const r = await page.evaluate(fn(`(st) => {
        const fov = RangeDayLine.fovMoa / 60;
        aim({ plate: st.plate, fov, glass: st.zoom != null });
        RangeDayLine.scene.render(3);
        const { g, w, h } = read();
        const x0 = Math.round(w * 0.3), y0 = Math.round(h * 0.3), n = Math.round(w * 0.4), m = Math.round(h * 0.4);
        const d = g.getImageData(x0, y0, n, m).data;
        const L = (i) => 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        let sum = 0, cnt = 0;
        for (let y = 0; y < m; y++) for (let x = 0; x < n; x++) { const i = (y * n + x) * 4; if (x + 1 < n) { sum += Math.abs(L(i) - L(i + 4)); cnt++; } if (y + 1 < m) { sum += Math.abs(L(i) - L(i + n * 4)); cnt++; } }
        return { sharp: sum / cnt, fov };
      }`), st);
      console.log(`${width} px, ${picture}, ${day.name}, ${st.name}: sharpness ${r.sharp.toFixed(2)}, view ${size} px at ${r.fov.toFixed(2)} degrees, median frame ${frameMs.toFixed(1)} ms`);
    }
    if (!patchesDone && sightId === 'utg-2-7x44') {
      patchesDone = true;
      for (const [name, v, target] of day.patches) {
        const rgb = await page.evaluate(fn(`([v]) => {
          const median = (g, cx, cy, n) => { const d = g.getImageData(Math.round(cx - n / 2), Math.round(cy - n / 2), n, n).data; const ch = [[], [], []]; for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); } return ch.map((a) => a.sort((x, y) => x - y)[a.length >> 1]); };
          const s = RangeDayLine.scene;
          if (v.brush) {
            // the bushes: every instanced mesh in the scene, its instances' places
            const spots = [];
            s.scene.traverse((o) => { if (o.isInstancedMesh && o.count > 10) { const a = o.instanceMatrix.array; for (let i = 0; i < o.count; i++) { const x = a[i * 16 + 12], y = a[i * 16 + 13], z = a[i * 16 + 14], sy = Math.hypot(a[i * 16 + 4], a[i * 16 + 5], a[i * 16 + 6]); const d = Math.hypot(x, z); if (d > 250 && d < 350 && Math.abs(x) < 120) spots.push([x, y + sy * 0.45, z, Math.abs(x)]); } } });
            spots.sort((p, q) => p[3] - q[3]);
            const all = [[], [], []];
            for (const w of spots.slice(0, 3)) { aim({ world: w, fov: v.fov }); s.render(3); const { g, w: W, h: H } = read(); const mm = median(g, W / 2, H / 2, Math.round(W * 0.25)); mm.forEach((c, i) => all[i].push(c)); }
            if (!spots.length) return null;
            return all.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
          }
          aim(v); s.render(3);
          const { g, w, h } = read();
          return median(g, w / 2, h / 2, v.n || Math.round(w * 0.25));
        }`), [v]);
        const t = hex(target);
        console.log(`${width} px, ${picture}, ${day.name}, patch ${name}: ${rgb ? `rendered ${rgb.join(',')}, measured ${target} = ${t.join(',')}, difference ${rgb.map((c, i) => (c - t[i] >= 0 ? '+' : '') + (c - t[i])).join(',')}` : 'no bush found'}`);
      }
    }
  }
  await context.close();
}
await browser.close();
process.exit(0);
