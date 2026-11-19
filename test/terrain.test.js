'use strict';
// The surveyed ground (range-day-five): the terrain files are what
// data/terrain.json says they are and fit the budget; every plate's surveyed
// height and sideways place in data/courses.json follow from the heights
// themselves (verify 4); the line of sight to every plate is clear; the sun's
// noon height follows 90 − latitude + declination (verify 5); the engine's
// elevation for the far plates on the old and the new figures; and the
// picture bundle is built from its source (a stored copy equals a fresh
// build; with none stored, the build is served).
//   npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const E = require('../public/engine.js');
const { raw, flat } = require('../lib/data').load();

const root = path.join(__dirname, '..');
const YD = 0.9144, FT = 0.3048, IN = 0.0254;
const COURSES = ['cta-piru', 'angeles-sylmar'];

let image, sun;
test.before(async () => { image = await import('../scripts/terrain/image.mjs'); sun = await import('../src/scene/sun.mjs'); });

// The heights of a course as a sampler over the map, from the committed PNG.
function heightsOf(id, key = 'heights') {
  const r = flat.terrain[id][key];
  const { width, height, pixels } = image.readPng16(fs.readFileSync(path.join(root, 'public', r.file)));
  assert.equal(width, r.width); assert.equal(height, r.height);
  const at = (ix, iy) => pixels[Math.min(height - 1, Math.max(0, iy)) * width + Math.min(width - 1, Math.max(0, ix))] * r.stepM + r.offsetM;
  return { ...r, at, heightAt(e, n) { const fx = (e - r.originE) / r.spacingM - 0.5, fy = (r.originN - n) / r.spacingM - 0.5; const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty; } };
}
const pointOn = (c, yd, latYd) => { const b = (c.firing.bearingDeg * Math.PI) / 180; const f = yd * YD, x = latYd * YD; return { e: c.firing.easting + f * Math.sin(b) + x * Math.cos(b), n: c.firing.northing + f * Math.cos(b) - x * Math.sin(b) }; };

test('terrain: every file data/terrain.json names exists with the stated bytes and its content hash in its name; the whole folder is under 30 MB; each record says where it came from', () => {
  let total = 0;
  for (const id of COURSES) for (const key of ['heights', 'heightsFar', 'photo', 'photoLight']) {
    const r = flat.terrain[id][key], rr = raw.terrain[id][key];
    const file = path.join(root, 'public', r.file);
    const bytes = fs.readFileSync(file);
    assert.equal(bytes.length, r.bytes, `${id}.${key}: bytes`);
    const hash = createHash('sha1').update(bytes).digest('hex').slice(0, 8);
    assert.ok(r.file.endsWith(`-${hash}.${key.startsWith('photo') ? 'jpg' : 'png'}`), `${id}.${key}: the name carries the content hash (${r.file})`);
    assert.match(r.service, /^https:\/\/(elevation|imagery)\.nationalmap\.gov\//, `${id}.${key}: a USGS service`);
    assert.match(r.request, /exportImage\?/, `${id}.${key}: the exact request`);
    assert.match(r.license, /public domain/, `${id}.${key}: the license`);
    assert.match(r.fetched, /^\d{4}-\d{2}-\d{2}$/, `${id}.${key}: the date fetched`);
    assert.equal(rr.spacingM.source.read, r.fetched, `${id}.${key}: the spacing is a reading of the service's answer`);
    if (key === 'heights' || key.startsWith('photo')) assert.match(r.captureDate, /^20\d\d-\d\d-\d\d/, `${id}.${key}: the data's own capture date`);
    total += bytes.length;
  }
  for (const f of fs.readdirSync(path.join(root, 'public', 'terrain'))) assert.ok(JSON.stringify(flat.terrain).includes(`terrain/${f}`), `${f} is named in data/terrain.json`);
  console.log(`  terrain: ${total} bytes (${(total / 1048576).toFixed(1)} MB) in public/terrain; canyon course Full ${flat.terrain['cta-piru'].heights.bytes + flat.terrain['cta-piru'].heightsFar.bytes + flat.terrain['cta-piru'].photo.bytes} bytes, Light ${flat.terrain['cta-piru'].heights.bytes + flat.terrain['cta-piru'].heightsFar.bytes + flat.terrain['cta-piru'].photoLight.bytes} bytes`);
  assert.ok(total < 30 * 1048576, 'under 30 MB');
  for (const id of COURSES) { assert.equal(flat.terrain[id].heights.spacingM, 1, `${id}: 1 m heights`); assert.equal(flat.terrain[id].heights.holes, 0, `${id}: no holes`); }
});

test('verify 4: each course\'s altitudeFt is the surveyed ground at the firing position; each plate\'s riseFt is the surveyed ground there plus the plate\'s centre above its ground, less the eye, within 1 ft; the line of sight to every plate clears the ground by at least 1 ft', () => {
  const eye = flat.look.eyeHeightFt * FT, share = flat.physics.scenery.postHeightShareOfPlate;
  for (const id of COURSES) {
    const c = flat.courses[id], h = heightsOf(id);
    const g0 = h.heightAt(c.firing.easting, c.firing.northing);
    assert.ok(Math.abs(g0 - c.firing.groundM) < 0.02, `${id}: groundM ${c.firing.groundM} is the heights' ${g0.toFixed(2)}`);
    assert.equal(c.altitudeFt, Math.round(g0 / FT), `${id}: altitudeFt`);
    console.log(`  ${id}: firing position ${c.firing.lat}, ${c.firing.lon} (E ${c.firing.easting} N ${c.firing.northing}), bearing ${c.firing.bearingDeg}, ground ${g0.toFixed(1)} m = ${c.altitudeFt} ft (was ${id === 'cta-piru' ? 850 : 1500} ft); heights ${h.spacingM} m captured ${h.captureDate}; photo ${flat.terrain[id].photo.spacingM} m captured ${flat.terrain[id].photo.captureDate}`);
    const OLD = { 'cta-piru': { rise: [15, 29, 46, 66, 88, 113, 140, 169, 200], lat: [-6.3, -7.1, -6.3, -3.9, 0, 5.5, 12.6, 21.2, 31.4] }, 'angeles-sylmar': { rise: [1, 4, 9, 16, 25, 36], lat: [2.2, 2.6, 1.3, -1.7, -6.5, -13.1] } }[id];
    console.log('    yards  riseFt old→new  lateralYd old→new  least clearance (ft) at');
    c.plates.forEach((p, i) => {
      const q = pointOn(c, p.yards, p.lateralYd);
      const centreUp = (p.heightIn * share + p.heightIn / 2) * IN;
      const expected = (h.heightAt(q.e, q.n) + centreUp - (g0 + eye)) / FT;
      assert.ok(Math.abs(expected - p.riseFt) <= 1, `${id} ${p.yards} yd: riseFt ${p.riseFt} vs the heights' ${expected.toFixed(1)}`);
      let least = Infinity, where = 0;
      const target = g0 + eye + p.riseFt * FT;
      for (let d = 3; d < p.yards * YD - 1; d += 1) { const s = pointOn(c, d / YD, (p.lateralYd * d) / (p.yards * YD)); const los = g0 + eye + (target - (g0 + eye)) * (d / (p.yards * YD)); const cl = los - h.heightAt(s.e, s.n); if (cl < least) { least = cl; where = d; } }
      assert.ok(least >= 1 * FT, `${id} ${p.yards} yd: the line of sight clears the ground by ${(least / FT).toFixed(1)} ft at ${Math.round(where / YD)} yd`);
      console.log(`    ${String(p.yards).padStart(5)}  ${String(OLD.rise[i]).padStart(6)}→${String(p.riseFt).padEnd(4)}  ${String(OLD.lat[i]).padStart(8)}→${String(p.lateralYd).padEnd(6)}  ${(least / FT).toFixed(1)} ft at ${Math.round(where / YD)} yd`);
    });
  }
});

test('verify 4: the engine\'s elevation for the 1,000-yard canyon plate and the 600-yard rifle-line plate on the old figures and on the new, same load and air', () => {
  const cases = [['cta-piru', 1000, 'molot-vepr-54r', 'utg-2-7x44', 'sb-174-hpbt', { riseFt: 200, altitudeFt: 850 }], ['angeles-sylmar', 600, 'bcm-ar15', 'ar-irons', 'imi-m193', { riseFt: 36, altitudeFt: 1500 }]];
  for (const [id, yards, rifleId, sightId, loadId, old] of cases) {
    const c = flat.courses[id], p = c.plates.find((x) => x.yards === yards), rifle = flat.rifles[rifleId], load = flat.loads[loadId];
    const air = { tempF: 70, pressureInHg: 29.92 - (c.altitudeFt / 1000) * 1.0, humidity: 0.4 };
    const moaFor = (riseFt, altitudeFt) => {
      // the elevation (MOA above the bore's line) that puts the bullet on the plate's centre, by halving
      let lo = -20, hi = 120;
      for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; const r = E.fly({ load, drag: flat.physics.dragTables, powder: flat.physics.powderTemperature, sightHeightIn: rifle.sightHeightIn[sightId], elevationMoa: mid, windageMoa: 0, targetYards: yards, targetRiseFt: riseFt, conditions: { ...air, altitudeFt }, wind: [] }); if (!r.reached || r.hit.upIn < 0) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    };
    const before = moaFor(old.riseFt, old.altitudeFt), after = moaFor(p.riseFt, c.altitudeFt);
    console.log(`  ${id} ${yards} yd, ${load.name.replace(/ \(.*$/, '')}: elevation ${before.toFixed(1)} MOA on the old figures (rise ${old.riseFt} ft, ${old.altitudeFt} ft), ${after.toFixed(1)} MOA on the surveyed (rise ${p.riseFt} ft, ${c.altitudeFt} ft)`);
    assert.ok(Number.isFinite(before) && Number.isFinite(after));
    assert.notEqual(before.toFixed(1), after.toFixed(1), 'the surveyed ground changes the shot');
  }
});

test('verify 5: at the canyon course the computed noon elevation for the middle of February, June and September is within 0.5 degree of 90 − latitude + declination; the afternoon sun stands in the western half of the sky and the morning sun in the eastern', () => {
  const c = flat.courses['cta-piru'], lat = c.firing.lat, lon = c.firing.lon;
  for (const month of [2, 6, 9]) {
    const noon = sun.noonElevation({ lat, month, day: flat.look.monthDay });
    // the declination from the same tables, read at local noon
    const mid = sun.sunPosition({ lat, lon, month, day: flat.look.monthDay, hour: 12 });
    const expected = 90 - lat + mid.declination;
    assert.ok(Math.abs(noon - expected) < 0.5, `month ${month}: noon ${noon.toFixed(2)} vs ${expected.toFixed(2)}`);
    const am = sun.sunPosition({ lat, lon, month, day: flat.look.monthDay, hour: flat.look.clockHour.morning });
    const pm = sun.sunPosition({ lat, lon, month, day: flat.look.monthDay, hour: flat.look.clockHour.afternoon });
    assert.ok(am.azimuth > 0 && am.azimuth < 180, `month ${month}: morning sun in the east (azimuth ${am.azimuth.toFixed(0)})`);
    assert.ok(pm.azimuth > 180 && pm.azimuth < 360, `month ${month}: afternoon sun in the west (azimuth ${pm.azimuth.toFixed(0)})`);
    console.log(`  month ${month}: noon elevation ${noon.toFixed(2)}° (90 − lat + declination ${expected.toFixed(2)}°); morning ${am.elevation.toFixed(1)}° at azimuth ${am.azimuth.toFixed(0)}°, midday ${sun.sunPosition({ lat, lon, month, day: 15, hour: flat.look.clockHour.midday }).elevation.toFixed(1)}°, afternoon ${pm.elevation.toFixed(1)}° at azimuth ${pm.azimuth.toFixed(0)}°`);
  }
  // NOAA's own figure for 21 June 2026 at this place: the declination is 23.44°
  const solstice = sun.sunPosition({ lat, lon, month: 6, day: 21, hour: 12 });
  assert.ok(Math.abs(solstice.declination - 23.44) < 0.02, `declination at the solstice ${solstice.declination.toFixed(3)}`);
});

test('the picture bundle public/scene.min.js is built, not stored: a copy stored in the repository equals a fresh build; with none stored, a build produces the file and the server serves it behind the cookie (200, more than 300,000 bytes)', async () => {
  const { sceneBundle, OUT } = await import('../scripts/build-scene.mjs');
  const fresh = await sceneBundle();
  assert.ok(fresh.length > 300000 && fresh.length < 1048576, `the bundle is ${fresh.length} bytes`);
  const git = require('node:child_process').spawnSync('git', ['ls-files', '--error-unmatch', 'public/scene.min.js'], { cwd: root, encoding: 'utf8' });
  const stored = git.status === 0;
  if (stored) {
    // the committed text, not the file on disk: npm test's pretest has already rebuilt the file by now, so the disk copy is always fresh
    const committed = require('node:child_process').spawnSync('git', ['show', 'HEAD:public/scene.min.js'], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1048576 }).stdout;
    assert.equal(committed, fresh, 'the stored public/scene.min.js differs from a fresh build (npm run build:scene and commit)');
    console.log(`  a stored copy of public/scene.min.js is in the repository and equals a fresh build (${fresh.length} bytes)`);
    return;
  }
  // nothing stored: a build produces the file (what npm test's pretest and the image's first stage do), and the server serves it
  await sceneBundle({ write: true });
  assert.equal(fs.readFileSync(OUT, 'utf8'), fresh, 'the built file is the build');
  const { spawn } = require('node:child_process');
  const port = 8981, base = `http://127.0.0.1:${port}`;
  const server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), APP_PASSWORD: 'open sesame', COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '' }, stdio: ['ignore', 'ignore', 'inherit'] });
  try {
    for (let i = 0; ; i++) { try { await fetch(`${base}/alive`); break; } catch { if (i > 100) throw new Error('server never answered'); await new Promise((r) => setTimeout(r, 50)); } }
    const stranger = await fetch(`${base}/scene.min.js`, { redirect: 'manual' });
    assert.equal(stranger.status, 303, 'a stranger is sent to sign in');
    const login = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passphrase=open+sesame&next=%2F' });
    const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
    const r = await fetch(`${base}/scene.min.js`, { headers: { cookie } });
    const body = await r.text();
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type') || '', /javascript/);
    assert.ok(body.length > 300000, `served ${body.length} bytes`);
    assert.equal(body, fresh, 'the server serves the build');
    console.log(`  no stored copy: built public/scene.min.js (${fresh.length} bytes) and the server serves it signed in (${r.status}, ${body.length} bytes; a stranger gets ${stranger.status})`);
  } finally { server.kill(); }
});
