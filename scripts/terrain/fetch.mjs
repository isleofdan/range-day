// Fetches the surveyed ground and the aerial photograph of each range from
// two US government services (public domain), on GitHub's runner (a cloud
// session's network refuses both; .github/workflows/terrain.yml runs this
// and commits what it writes). For each range, a square 2.5 km on a side
// centered on the range's public map position:
//   - heights at 1 m from the USGS 3D Elevation Program (the finest the
//     service holds here: the 2024 "CA_LosAngeles_B23" lidar, chosen by
//     name from the service's own catalog), as a 16-bit PNG with a stated
//     step and offset;
//   - a coarser 10 km square of heights at 10 m for the hills beyond the
//     square, which the view sees above the far plates;
//   - the USGS NAIP photograph at the service's largest answer, 4,000
//     pixels (0.625 m), as JPEG, and a 1,024-pixel copy for the Light
//     picture.
// data/terrain.json records every file: the service, the exact request,
// the date fetched, the data's own spacing and capture date as the service
// reports them, the license and the bytes. Files are named with their
// content hash, so a browser can keep them for a year.
import { mkdirSync, writeFileSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RANGES, SERVICES, toUtm, get, getJson } from './lib.mjs';
import { readTiff, png16, readPng16, jpegSize } from './image.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(root, 'public', 'terrain');
mkdirSync(outDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const LICENSE = 'US government work, public domain (USGS 3DEP and USDA NAIP, distributed by The National Map without restriction)';
const SIDE_M = 2500, NEAR_SPACING_M = 1, FAR_SIDE_M = 10000, FAR_SPACING_M = 10, PHOTO_MAX_PX = 4000, LIGHT_PX = 1024;

const fig = (value, url, note) => ({ value, source: { url, read: today, note } });
const hash8 = (buf) => createHash('sha1').update(buf).digest('hex').slice(0, 8);
const written = [];
function writeNamed(base, ext, buf) {
  const name = `${base}-${hash8(buf)}.${ext}`;
  writeFileSync(join(outDir, name), buf);
  written.push(name);
  return name;
}

// The catalog's items over a square, with every field the service gives.
async function catalog(service, u, half) {
  const q = new URLSearchParams({ f: 'json', geometry: JSON.stringify({ xmin: u.e - half, ymin: u.n - half, xmax: u.e + half, ymax: u.n + half, spatialReference: { wkid: service.wkid } }), geometryType: 'esriGeometryEnvelope', inSR: String(service.wkid), spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'false' });
  const url = `${service.url}/query?${q}`;
  const r = await getJson(url);
  if (r.error) throw new Error(`catalog: ${JSON.stringify(r.error)}`);
  return { url, items: (r.features || []).map((f) => f.attributes) };
}
const dateOf = (ms) => (ms == null ? null : new Date(ms).toISOString().slice(0, 10));

// Heights over a square: one export, parsed, as Float32 with the grid's map origin.
async function exportHeights(u, half, spacing, extra = {}) {
  const px = Math.round((2 * half) / spacing);
  const p = new URLSearchParams({ f: 'image', bbox: `${u.e - half},${u.n - half},${u.e + half},${u.n + half}`, bboxSR: String(SERVICES.heights.wkid), imageSR: String(SERVICES.heights.wkid), size: `${px},${px}`, ...SERVICES.heights.exportParams, ...extra });
  const url = `${SERVICES.heights.url}/exportImage?${p}`;
  const { bytes } = await get(url);
  const t = readTiff(bytes);
  if (t.width !== px || t.height !== px) throw new Error(`heights came back ${t.width}×${t.height}, asked ${px}×${px}`);
  return { ...t, url, spacing, originE: t.tie ? t.tie[3] : u.e - half, originN: t.tie ? t.tie[4] : u.n + half, tiffBytes: bytes.length };
}

// A Float32 grid as a 16-bit PNG: value = round((h - offset) / step).
function encodeHeights(t, step) {
  let min = Infinity, max = -Infinity, holes = 0;
  const bad = (v) => !Number.isFinite(v) || (t.noData != null && Math.abs(v - t.noData) < 1e-3) || v < -500 || v > 9000;
  for (const v of t.data) { if (bad(v)) { holes++; continue; } if (v < min) min = v; if (v > max) max = v; }
  const offset = Math.floor(min) - 1;
  if ((max - offset) / step > 65535) throw new Error(`height span ${max - offset} m does not fit 16 bits at ${step} m`);
  const px = new Uint16Array(t.data.length);
  for (let i = 0; i < px.length; i++) { const v = bad(t.data[i]) ? min : t.data[i]; px[i] = Math.round((v - offset) / step); }
  const buf = png16(t.width, t.height, px);
  const back = readPng16(buf);
  for (let i = 0; i < px.length; i += 997) if (back.pixels[i] !== px[i]) throw new Error('the PNG does not read back as written');
  return { buf, offset, step, min, max, holes };
}

const terrain = { _about: 'The surveyed ground and the aerial photograph of each range, fetched by scripts/terrain/fetch.mjs on GitHub\'s runner (the Terrain workflow) from two US government services, public domain. Each file is named with its content hash and served under /terrain/ with a one-year cache header. Heights are 16-bit PNGs: metres above sea level = pixel × stepM + offsetM, the top-left pixel\'s centre at (originE + spacingM/2, originN − spacingM/2) in NAD83 / UTM zone 11N (EPSG 26911), rows running south. The photograph covers the same square as the near heights. Every figure here is a reading of the service\'s own answer on the date given.' };
const summary = [];

for (const r of RANGES) {
  console.log(`\n=== ${r.id} (${r.name})`);
  const u = toUtm(r.lat, r.lon);
  const half = SIDE_M / 2;
  const rec = { name: r.name, center: { lat: fig(r.lat, 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.lat + ',' + r.lon), 'the range\'s public map position (Google Places, read 19 Nov 2026 by the chat that wrote the brief)'), lon: fig(r.lon, 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(r.lat + ',' + r.lon), 'the same'), easting: fig(Math.round(u.e * 10) / 10, 'https://pubs.usgs.gov/pp/1395/report.pdf', 'NAD83 / UTM zone 11N easting of the map position, by Snyder\'s series (scripts/terrain/lib.mjs, toUtm)'), northing: fig(Math.round(u.n * 10) / 10, 'https://pubs.usgs.gov/pp/1395/report.pdf', 'the same, northing'), zone: 11, wkid: 26911 } };

  // --- the near heights: the finest dataset the catalog holds over the square ---
  const cat = await catalog(SERVICES.heights, u, half);
  const fine = cat.items.filter((it) => it.Category === 1 && it.LowPS != null);
  const finest = Math.min(...fine.map((it) => it.LowPS));
  const byName = {};
  for (const it of fine.filter((it) => it.LowPS === finest)) (byName[it.Name] ??= []).push(it);
  // Among the finest datasets, the one the service itself ranks first ("Best", lowest wins, its own sort field).
  const chosen = Object.values(byName).sort((a, b) => Math.min(...a.map((x) => x.Best)) - Math.min(...b.map((x) => x.Best)))[0];
  const ids = chosen.map((it) => it.OBJECTID);
  console.log(`  heights: finest spacing ${finest} m; datasets at that spacing: ${Object.keys(byName).join(', ')}; using ${chosen[0].Name} (${chosen[0].title}), items ${ids.join(',')}, acquired ${dateOf(chosen[0].AcquisitionDate)}`);
  const spacing = Math.max(NEAR_SPACING_M, finest);
  const near = await exportHeights(u, half, spacing, { mosaicRule: JSON.stringify({ mosaicMethod: 'esriMosaicLockRaster', lockRasterIds: ids, ascending: true, mosaicOperation: 'MT_FIRST' }) });
  const enc = encodeHeights(near, 0.02);
  console.log(`  heights: ${near.width}×${near.height} at ${spacing} m, ${near.tiffBytes} bytes of TIFF, ${enc.min.toFixed(1)}..${enc.max.toFixed(1)} m, ${enc.holes} holes, PNG ${enc.buf.length} bytes, origin E ${near.originE} N ${near.originN}`);
  const nearName = writeNamed(`${r.id}-heights`, 'png', enc.buf);
  rec.heights = {
    file: `terrain/${nearName}`, service: SERVICES.heights.url, request: near.url, fetched: today, dataset: chosen[0].title || chosen[0].Name, datasetName: chosen[0].Name, catalogRequest: cat.url, captureDate: dateOf(chosen[0].AcquisitionDate), publishedDate: chosen[0].pubdate ? String(chosen[0].pubdate) : null, verticalDatum: chosen[0].VerticalDatum, license: LICENSE,
    width: fig(near.width, near.url, 'pixels across'), height: fig(near.height, near.url, 'pixels down'), spacingM: fig(spacing, cat.url, `the service's LowPS for this dataset, the finest it holds over the square (${finest} m)`),
    originE: fig(near.originE, near.url, 'the TIFF\'s ModelTiepoint: the top-left corner of the square, easting'), originN: fig(near.originN, near.url, 'the same, northing'),
    stepM: fig(enc.step, near.url, 'metres per pixel count in the PNG (chosen so the span fits 16 bits with 2 cm steps)'), offsetM: fig(enc.offset, near.url, 'metres added to pixel × stepM: one below the lowest height in the square'),
    minM: fig(Math.round(enc.min * 100) / 100, near.url, 'the lowest height in the square'), maxM: fig(Math.round(enc.max * 100) / 100, near.url, 'the highest'), holes: fig(enc.holes, near.url, 'pixels the service marked as no data, filled with the lowest height'),
    bytes: fig(enc.buf.length, near.url, 'the PNG\'s size'),
  };

  // --- the far heights: the service's own mosaic over 10 km at 10 m ---
  const far = await exportHeights(u, FAR_SIDE_M / 2, FAR_SPACING_M);
  const encFar = encodeHeights(far, 0.1);
  console.log(`  far heights: ${far.width}×${far.height} at ${FAR_SPACING_M} m, ${encFar.min.toFixed(1)}..${encFar.max.toFixed(1)} m, ${encFar.holes} holes, PNG ${encFar.buf.length} bytes`);
  const farName = writeNamed(`${r.id}-heights-far`, 'png', encFar.buf);
  rec.heightsFar = {
    file: `terrain/${farName}`, service: SERVICES.heights.url, request: far.url, fetched: today, dataset: 'the service\'s own mosaic (its default "Best" ordering over every dataset it holds here)', license: LICENSE,
    width: fig(far.width, far.url, 'pixels across'), height: fig(far.height, far.url, 'pixels down'), spacingM: fig(FAR_SPACING_M, far.url, 'the requested spacing: 10 km across 1,000 pixels'),
    originE: fig(far.originE, far.url, 'the top-left corner, easting'), originN: fig(far.originN, far.url, 'the same, northing'),
    stepM: fig(encFar.step, far.url, 'metres per pixel count'), offsetM: fig(encFar.offset, far.url, 'metres added to pixel × stepM'),
    minM: fig(Math.round(encFar.min * 100) / 100, far.url, 'the lowest height'), maxM: fig(Math.round(encFar.max * 100) / 100, far.url, 'the highest'), holes: fig(encFar.holes, far.url, 'no-data pixels, filled with the lowest height'),
    bytes: fig(encFar.buf.length, far.url, 'the PNG\'s size'),
  };

  // --- the photograph ---
  const pcat = await catalog(SERVICES.photo, u, half);
  const tiles = pcat.items.filter((it) => it.Category === 1 && it.acquisition_date);
  const dates = [...new Set(tiles.map((it) => dateOf(it.acquisition_date)))];
  const res = [...new Set(tiles.map((it) => `${it.resolution_value} ${it.resolution_units}`))];
  console.log(`  photo: ${tiles.length} tile(s) ${tiles.map((t) => t.Name).join(', ')}; captured ${dates.join(', ')}; native ${res.join(', ')}`);
  for (const [tag, px] of [['photo', PHOTO_MAX_PX], ['photoLight', LIGHT_PX]]) {
    const p = new URLSearchParams({ f: 'image', bbox: `${u.e - half},${u.n - half},${u.e + half},${u.n + half}`, bboxSR: String(SERVICES.photo.wkid), imageSR: String(SERVICES.photo.wkid), size: `${px},${px}`, renderingRule: JSON.stringify({ rasterFunction: 'NaturalColor' }), ...SERVICES.photo.exportParams });
    const url = `${SERVICES.photo.url}/exportImage?${p}`;
    const { bytes } = await get(url);
    const size = jpegSize(bytes);
    if (!size || size.width !== px) throw new Error(`photo came back ${JSON.stringify(size)}, asked ${px}`);
    const name = writeNamed(`${r.id}-${tag === 'photo' ? 'photo' : 'photo-light'}`, 'jpg', Buffer.from(bytes));
    console.log(`  ${tag}: ${size.width}×${size.height}, ${bytes.length} bytes`);
    rec[tag] = {
      file: `terrain/${name}`, service: SERVICES.photo.url, request: url, fetched: today, tiles: tiles.map((t) => t.Name), captureDate: dates.join(', '), catalogRequest: pcat.url, license: LICENSE,
      width: fig(size.width, url, 'pixels across'), height: fig(size.height, url, 'pixels down'),
      spacingM: fig(SIDE_M / px, url, tag === 'photo' ? `the square's 2,500 m across the service's largest answer, ${px} pixels (its native spacing is ${res.join(', ')}; maxImageWidth is ${PHOTO_MAX_PX})` : 'a small copy for the Light picture'),
      nativeSpacingM: fig(tiles[0] ? tiles[0].resolution_value : 0.6, pcat.url, 'resolution_value of the tiles, as the catalog reports it'),
      originE: fig(u.e - half, url, 'the top-left corner, easting (the requested bbox)'), originN: fig(u.n + half, url, 'the same, northing'),
      bytes: fig(bytes.length, url, 'the JPEG\'s size'),
    };
  }
  terrain[r.id] = rec;
  summary.push(`${r.id}: heights ${spacing} m (${chosen[0].Name}, ${dateOf(chosen[0].AcquisitionDate)}), far ${FAR_SPACING_M} m, photo ${SIDE_M / PHOTO_MAX_PX} m (${dates.join(', ')})`);
}

// Old files of ours that nothing names any more are removed, so the folder holds one set.
for (const f of readdirSync(outDir)) if (!written.includes(f)) { unlinkSync(join(outDir, f)); console.log(`  removed stale ${f}`); }
writeFileSync(join(root, 'data', 'terrain.json'), JSON.stringify(terrain, null, 1) + '\n');
let total = 0;
for (const f of readdirSync(outDir)) total += (await import('node:fs')).statSync(join(outDir, f)).size;
console.log(`\nwritten: ${written.join(', ')}\ntotal ${total} bytes (${(total / 1048576).toFixed(1)} MB) in public/terrain\n${summary.join('\n')}`);
if (!existsSync(join(root, 'data', 'terrain.json'))) throw new Error('terrain.json not written');
