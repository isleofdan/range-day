// Places the near targets (range-day-ten) on the surveyed ground, the way
// range-day-five placed the steel: from the firing position along the
// bearing of fire, at the target's distance and its sideways place, the
// ground's height read from the committed 1 m heights (data/terrain.json).
// Prints, for each near target in data/courses.json, the ground under it,
// its centre's height above the eye (riseFt), its map position, the least
// clearance of the line of sight over the ground, and its angular distance
// from every other target as seen from the firing line. It writes nothing;
// the figures it prints are the ones written into data/courses.json, and
// test/terrain.test.js checks them against the heights themselves.
//   node scripts/place-near.mjs
// (It lives outside scripts/terrain/ on purpose: a push touching that folder starts the Terrain
// workflow, which fetches the ground again and commits to the branch that pushed.)
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { readPng16 } from './terrain/image.mjs';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { flat } = require(join(root, 'lib', 'data.js')).load();
const YD = 0.9144, FT = 0.3048, IN = 0.0254, MOA = Math.PI / (180 * 60);

export function heightsOf(id) {
  const r = flat.terrain[id].heights;
  const { width, height, pixels } = readPng16(readFileSync(join(root, 'public', r.file)));
  const at = (ix, iy) => pixels[Math.min(height - 1, Math.max(0, iy)) * width + Math.min(width - 1, Math.max(0, ix))] * r.stepM + r.offsetM;
  return { heightAt(e, n) { const fx = (e - r.originE) / r.spacingM - 0.5, fy = (r.originN - n) / r.spacingM - 0.5; const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0; return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty; } };
}
export const pointOn = (c, yd, latYd) => { const b = (c.firing.bearingDeg * Math.PI) / 180; const f = yd * YD, x = latYd * YD; return { e: c.firing.easting + f * Math.sin(b) + x * Math.cos(b), n: c.firing.northing + f * Math.cos(b) - x * Math.sin(b) }; };
// The centre of a target above its own ground, in metres: a steel plate on its post (the post at heightIn × the plate's share, then
// half the plate); a paper sheet on its board (data/look.json, paper: the board's foot above the ground, the mound it may stand on, the
// sheet's centre above the board's foot).
export function centreAboveGroundM(t, look, physics) {
  if ((t.kind || 'steel') === 'steel') return (t.heightIn * physics.scenery.postHeightShareOfPlate + t.heightIn / 2) * IN;
  const P = look.paper;
  return (t.onMoundM || 0) + P.boardFootAboveGroundM + P.sheetCentreAboveBoardFootIn * IN;
}

// One target's place: the ground under it, its centre's height above the eye, its map position, and the least clearance of the
// line of sight from the eye to its centre over the surveyed ground (and where along the line).
export function place(id, t, h = heightsOf(id)) {
  const c = flat.courses[id];
  const g0 = h.heightAt(c.firing.easting, c.firing.northing), eye = flat.look.eyeHeightFt * FT;
  const q = pointOn(c, t.yards, t.lateralYd);
  const ground = h.heightAt(q.e, q.n);
  const rise = (ground + centreAboveGroundM(t, flat.look, flat.physics) - (g0 + eye)) / FT;
  let least = Infinity, where = 0;
  const target = g0 + eye + rise * FT;
  for (let d = 3; d < t.yards * YD - 1; d += 1) { const s = pointOn(c, d / YD, (t.lateralYd * d) / (t.yards * YD)); const los = g0 + eye + (target - (g0 + eye)) * (d / (t.yards * YD)); const cl = los - h.heightAt(s.e, s.n); if (cl < least) { least = cl; where = d; } }
  return { g0, ground, rise, e: q.e, n: q.n, leastFt: least / FT, whereYd: Math.round(where / YD) };
}

const all = (c) => [...(c.near || []), ...c.plates];
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) for (const id of ['cta-piru', 'angeles-sylmar']) {
  const c = flat.courses[id], h = heightsOf(id);
  console.log(`${id}:`);
  for (const t of c.near || []) {
    const { ground, g0, rise, e, n, leastFt, whereYd } = place(id, t, h);
    const q = { e, n }, least = leastFt * FT, where = whereYd * YD;
    const ang = (p, r) => ({ up: Math.atan2(r, p.yards * 3) / MOA, right: Math.atan2(p.lateralYd, p.yards) / MOA });
    const me = ang(t, rise);
    const seps = all(c).filter((o) => o !== t).map((o) => { const a = ang(o, o === t ? rise : (o.riseFt ?? 0)); return `${o.yards}${(o.kind || 'steel')[0]} ${Math.hypot(a.up - me.up, a.right - me.right).toFixed(0)}`; });
    console.log(`  ${t.kind} ${t.yards} yd at ${t.lateralYd} yd sideways: ground ${ground.toFixed(2)} m (${((ground - g0) / FT).toFixed(1)} ft above the firing position's), riseFt ${rise.toFixed(1)} (data ${t.riseFt}), E ${q.e.toFixed(1)} N ${q.n.toFixed(1)}, least clearance ${(least / FT).toFixed(1)} ft at ${Math.round(where / YD)} yd; MOA from: ${seps.join(', ')}`);
  }
}
