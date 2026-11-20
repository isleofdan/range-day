// Fetches candidate photographed ground surfaces (CC0 material scans) from
// two libraries, Poly Haven and ambientCG, on GitHub's runner (a cloud
// session's network refuses both), in one run: the Ground workflow
// (.github/workflows/ground.yml) runs this on a push of the scratch branch
// and commits what it writes, in ground-fetch/, to that branch only.
//
// In one run it: prints, per library, the status of its license page, of its
// listing and of one file request; reads each library's own listing to find
// candidates for the six surfaces in lib.mjs; downloads for each surface up
// to four candidates from Poly Haven and two from ambientCG (colour, normal,
// roughness and height maps, 2,048 pixels or the nearest size offered, JPEG
// where offered); keeps each map as a 1,024-pixel JPEG copy (the shipped
// files are that size or smaller, and the scratch branch stays a few tens of
// megabytes); and records, for every file, its address, its checksum as
// downloaded, the library's license text as fetched, the date and the bytes,
// in ground-fetch/manifest.json. A library that does not answer is logged
// and skipped; the run fails only if no library answers.
//
// The network and the image tools are passed in, so test/ground-fetch.test.js
// runs the whole fetch on saved answers before the one real run.
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { SURFACES, PER_SURFACE, MAPS, LIBRARIES, pageText, cc0Sentences, pickPolyHaven, polyHavenFiles, ambientAssets, ambientMaps, candidateDir } from './lib.mjs';

const KEEP_PX = 1024;
// Poly Haven's API terms, 2.4: "all API calls must be made with a unique "Referer" header or user-agent that matches your software name".
export const USER_AGENT = 'range-day-ground-fetch/1 (one download run of CC0 ground scans for a personal game)';

export async function run({ get, tools, outDir, today, runId = null, log = console.log }) {
  rmSync(outDir, { recursive: true, force: true });
  for (const d of ['', 'raw', 'licenses', 'candidates']) mkdirSync(join(outDir, d), { recursive: true });
  const lines = [];
  const say = (s) => { lines.push(s); log(s); };
  const saveRaw = (name, text) => writeFileSync(join(outDir, 'raw', name), text);
  const md5 = (b) => createHash('md5').update(b).digest('hex');
  const manifest = { fetched: today, run: runId, keptPx: KEEP_PX, userAgent: USER_AGENT, libraries: {}, surfaces: Object.fromEntries(SURFACES.map((s) => [s.id, { words: s.words, candidates: [] }])) };
  const byKey = new Map();

  // 1. Each library's license page, and (Poly Haven) its API terms: status, the text as fetched, the CC0 sentences.
  for (const [lib, L] of Object.entries(LIBRARIES)) {
    const info = { name: L.name, licensePage: null, status: {}, license: null, answered: false };
    manifest.libraries[lib] = info;
    for (const [i, page] of L.licensePages.entries()) {
      const r = await get(page).catch((e) => ({ status: 0, error: e.message }));
      info.status[`licensePage${i + 1}`] = r.status;
      say(`${lib}: license page ${r.status || 'no answer'} ${page}${r.error ? ` (${r.error})` : ''}`);
      if (!r.ok) continue;
      const text = pageText(Buffer.from(r.bytes).toString('utf8'));
      writeFileSync(join(outDir, 'licenses', `${lib}-license-${i + 1}.txt`), text);
      const cc0 = cc0Sentences(text);
      say(`${lib}: ${page} ${cc0 ? 'states CC0' : 'does not state CC0'}`);
      if (cc0) { info.license = cc0; info.licensePage = page; break; }
    }
    if (!info.license) say(`${lib}: no page of the library was read as stating CC0: nothing from this library ships`);
    if (L.apiTermsPage) {
      const t = await get(L.apiTermsPage).catch((e) => ({ status: 0, error: e.message }));
      info.status.apiTerms = t.status;
      say(`${lib}: API terms ${t.status || 'no answer'} ${L.apiTermsPage}`);
      if (t.ok) { writeFileSync(join(outDir, 'licenses', `${lib}-api-terms.txt`), Buffer.from(t.bytes).toString('utf8')); info.apiTerms = L.apiTermsPage; }
    }
  }

  // 2. Poly Haven: per surface, its categories' listings and its search's ranking; then each candidate's file tree and maps.
  const ph = manifest.libraries.polyhaven;
  {
    const t = await get(`${LIBRARIES.polyhaven.api}/types`).catch((e) => ({ status: 0, error: e.message }));
    ph.status.listing = t.status;
    say(`polyhaven: listing ${t.status || 'no answer'} ${LIBRARIES.polyhaven.api}/types`);
    ph.answered = Boolean(t.ok);
  }
  if (ph.answered) for (const s of SURFACES) {
    const listings = [];
    for (const cat of s.ph.categories) {
      const url = `${LIBRARIES.polyhaven.api}/assets?type=textures&category=${encodeURIComponent(cat)}`;
      const r = await get(url).catch((e) => ({ status: 0, error: e.message }));
      if (!r.ok) { say(`polyhaven: ${s.id}: listing ${cat} answered ${r.status || r.error}`); continue; }
      const text = Buffer.from(r.bytes).toString('utf8'); saveRaw(`polyhaven-assets-${cat.replace(/\//g, '_')}.json`, text);
      try { listings.push(JSON.parse(text)); } catch { say(`polyhaven: ${s.id}: listing ${cat} was not JSON`); }
    }
    let search = null;
    { const url = `${LIBRARIES.polyhaven.api}/search?q=${encodeURIComponent(s.ph.q)}&t=textures&min=0&limit=200`; const r = await get(url).catch((e) => ({ status: 0, error: e.message })); if (r.ok) { const text = Buffer.from(r.bytes).toString('utf8'); saveRaw(`polyhaven-search-${s.id}.json`, text); try { search = JSON.parse(text); } catch {} } else say(`polyhaven: ${s.id}: search answered ${r.status || r.error}; ranked by downloads instead`); }
    const picks = pickPolyHaven(listings, search, PER_SURFACE.polyhaven);
    say(`polyhaven: ${s.id}: ${listings.reduce((n, l) => n + Object.keys(l || {}).length, 0)} listed, picked ${picks.map((p) => p.id).join(', ') || 'none'}`);
    for (const c of picks) await candidate(c, s, async () => {
      const r = await get(`${LIBRARIES.polyhaven.api}/files/${encodeURIComponent(c.id)}`);
      if (!r.ok) throw new Error(`file list answered ${r.status}`);
      const text = Buffer.from(r.bytes).toString('utf8'); saveRaw(`polyhaven-files-${c.id}.json`, text);
      const files = polyHavenFiles(JSON.parse(text));
      if (!files.color) throw new Error(`no colour map in the file list (keys: ${Object.keys(JSON.parse(text)).join(', ')})`);
      const got = {};
      for (const [map, f] of Object.entries(files)) {
        const d = await get(f.url);
        if (ph.status.file == null) { ph.status.file = d.status; say(`polyhaven: file request ${d.status} ${f.url}`); }
        if (!d.ok) { say(`polyhaven: ${c.id}: ${map} answered ${d.status}`); continue; }
        const sum = md5(d.bytes);
        got[map] = { bytes: d.bytes, source: { url: f.url, md5: sum, md5Listed: f.md5, md5Matches: f.md5 ? f.md5 === sum : null, bytes: d.bytes.length, resolution: f.resolution, format: f.format, mapKey: f.key } };
      }
      return got;
    });
  }

  // 3. ambientCG: per surface, its search; each candidate's 2K-JPG zip, unpacked.
  const acg = manifest.libraries.ambientcg;
  for (const s of SURFACES) {
    const seen = new Set();
    const assets = [];
    for (const q of s.acg) {
      const url = `${LIBRARIES.ambientcg.api}?type=Material&q=${encodeURIComponent(q)}&include=downloadData,tagData,dimensionsData&limit=30&sort=Popular`;
      const r = await get(url).catch((e) => ({ status: 0, error: e.message }));
      if (acg.status.listing == null) { acg.status.listing = r.status; say(`ambientcg: listing ${r.status || 'no answer'} ${url}${r.error ? ` (${r.error})` : ''}`); }
      if (!r.ok) continue;
      acg.answered = true;
      const text = Buffer.from(r.bytes).toString('utf8'); saveRaw(`ambientcg-${s.id}-${q.replace(/\W+/g, '_')}.json`, text);
      try { for (const a of ambientAssets(JSON.parse(text))) if (!seen.has(a.id)) { seen.add(a.id); assets.push(a); } } catch { say(`ambientcg: ${s.id}: listing for "${q}" was not JSON`); }
    }
    if (!acg.answered) continue;
    const picks = assets.filter((a) => !byKey.has(`ambientcg:${a.id}`)).slice(0, PER_SURFACE.ambientcg);
    say(`ambientcg: ${s.id}: ${assets.length} listed, picked ${picks.map((p) => p.id).join(', ') || 'none'}`);
    for (const a of picks) await candidate({ library: 'ambientcg', id: a.id, name: a.name, page: `https://ambientcg.com/view?id=${encodeURIComponent(a.id)}`, tags: a.tags, groundMm: null, dimensionX: a.dimensionX, dimensionY: a.dimensionY, zipGuessed: a.zipGuessed }, s, async () => {
      const d = await get(a.zip);
      if (acg.status.file == null) { acg.status.file = d.status; say(`ambientcg: file request ${d.status} ${a.zip}`); }
      if (!d.ok) throw new Error(`zip answered ${d.status}`);
      const sum = md5(d.bytes);
      const got = {};
      const inside = tools.unzip(d.bytes);
      const maps = ambientMaps(Object.keys(inside));
      for (const [map, name] of Object.entries(maps)) got[map] = { bytes: inside[name], source: { url: a.zip, inZip: name, zipMd5: sum, zipBytes: d.bytes.length, bytes: inside[name].length } };
      if (!got.color) throw new Error(`no colour map in the zip (files: ${Object.keys(inside).join(', ')})`);
      return got;
    });
  }

  // One candidate: fetch its maps (once, however many surfaces want it), keep 1,024-pixel copies, record each file.
  async function candidate(c, s, fetchMaps) {
    const key = `${c.library}:${c.id}`;
    if (byKey.has(key)) { manifest.surfaces[s.id].candidates.push({ ...byKey.get(key), alsoFor: true }); return; }
    const lib = manifest.libraries[c.library];
    if (!lib.license) { say(`${c.library}: ${c.id}: skipped, the license page was not read as CC0`); return; }
    const dir = candidateDir(c, s.id);
    const rec = { ...c, dir: `candidates/${dir}`, license: lib.license, licensePage: lib.licensePage, fetched: today, files: {} };
    try {
      const got = await fetchMaps();
      mkdirSync(join(outDir, 'candidates', dir), { recursive: true });
      for (const map of MAPS) {
        if (!got[map]) continue;
        const kept = tools.resize(got[map].bytes, KEEP_PX);
        writeFileSync(join(outDir, 'candidates', dir, `${map}.jpg`), kept);
        rec.files[map] = { file: `candidates/${dir}/${map}.jpg`, keptBytes: kept.length, ...got[map].source };
      }
      say(`${c.library}: ${s.id}: ${c.id}: ${Object.keys(rec.files).join(', ')}`);
    } catch (e) { rec.error = e.message; say(`${c.library}: ${s.id}: ${c.id}: FAILED ${e.message}`); }
    byKey.set(key, rec);
    manifest.surfaces[s.id].candidates.push(rec);
  }

  const answered = Object.values(manifest.libraries).filter((l) => l.answered).length;
  const usable = Object.values(manifest.surfaces).reduce((n, s) => n + s.candidates.filter((c) => c.files && c.files.color).length, 0);
  manifest.summary = { librariesAnswered: answered, candidatesWithColour: usable };
  say(`summary: ${answered} of 2 libraries answered; ${usable} candidates with a colour map`);
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  writeFileSync(join(outDir, 'log.txt'), lines.join('\n') + '\n');
  return { answered, usable, manifest };
}

// The real network and image tools, on the runner.
async function realGet(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, redirect: 'follow', signal: AbortSignal.timeout(180000) });
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (res.status >= 500 && i < 2) { await new Promise((r) => setTimeout(r, 5000 * (i + 1))); continue; }
      return { status: res.status, ok: res.ok, bytes, headers: res.headers };
    } catch (e) { if (i === 2) throw e; await new Promise((r) => setTimeout(r, 5000 * (i + 1))); }
  }
}
const realTools = (tmp) => ({
  // ImageMagick: fit inside px × px, JPEG at quality 92, metadata stripped; 16-bit maps to 8 bits
  resize(bytes, px) { const src = join(tmp, 'in.bin'), dst = join(tmp, 'out.jpg'); writeFileSync(src, bytes); execFileSync('convert', [src, '-resize', `${px}x${px}>`, '-depth', '8', '-strip', '-quality', '92', dst]); return readFileSync(dst); },
  unzip(bytes) { const z = join(tmp, 'in.zip'), d = join(tmp, 'unz'); rmSync(d, { recursive: true, force: true }); mkdirSync(d); writeFileSync(z, bytes); execFileSync('unzip', ['-qq', '-o', z, '-d', d]); const out = {}; const walk = (p) => { for (const f of readdirSync(p, { withFileTypes: true })) { const q = join(p, f.name); if (f.isDirectory()) walk(q); else out[f.name] = readFileSync(q); } }; walk(d); return out; },
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const tmp = join(root, '.ground-tmp'); mkdirSync(tmp, { recursive: true });
  const { answered } = await run({ get: realGet, tools: realTools(tmp), outDir: join(root, 'ground-fetch'), today: new Date().toISOString().slice(0, 10), runId: process.env.GITHUB_RUN_ID || null });
  rmSync(tmp, { recursive: true, force: true });
  if (!answered) { console.log('no library answered'); process.exit(1); }
}
