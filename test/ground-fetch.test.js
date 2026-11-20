// The ground-surface fetch (scripts/ground/fetch.mjs) run end to end on
// saved answers, so the one real run on GitHub's runner is not spent on a
// typing mistake: the license read, the listing, the choosing, the naming,
// the md5 check and the record. The Poly Haven answers follow the shapes in
// the library's own API description (github.com/Poly-Haven/Public-API,
// swagger.yml: the `assets` example, `searchResults`, `textureFiles`); the
// ambientCG answer is a guess at its listing, which the fetch reads
// generically (its description could not be read from the session).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { run } from '../scripts/ground/fetch.mjs';
import { SURFACES, pickPolyHaven, polyHavenFiles, ambientAssets, ambientMaps, cc0Sentences, pageText, candidateDir } from '../scripts/ground/lib.mjs';

const enc = (s) => new TextEncoder().encode(typeof s === 'string' ? s : JSON.stringify(s));
const md5 = (b) => createHash('md5').update(b).digest('hex');
const asset = (name, extra = {}) => ({ name, type: 1, download_count: 100, categories: ['terrain'], category: 'Ground & Terrain/Soil & Mud/Compacted Soil', tags: ['dirt'], attributes: { surface_use: 'ground', origin: 'natural', setting: 'outdoor' }, max_resolution: [8192, 8192], dimensions: [2000, 2000], ...extra });
const tree = (id) => ({
  blend: { '2k': { blend: { url: `https://dl.polyhaven.org/${id}.blend`, md5: 'x', size: 1 } } },
  Diffuse: { '1k': { jpg: { url: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/${id}/${id}_diff_1k.jpg`, md5: md5(enc(`${id}-diff-1k`)), size: 9 } }, '2k': { jpg: { url: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/${id}/${id}_diff_2k.jpg`, md5: md5(enc(`${id}-diff-2k`)), size: 9 }, png: { url: 'x.png', md5: 'y', size: 1 } }, '4k': { jpg: { url: 'x4', md5: 'z', size: 1 } } },
  nor_gl: { '2k': { jpg: { url: `https://dl.polyhaven.org/${id}_nor_gl_2k.jpg`, md5: md5(enc(`${id}-nor-2k`)), size: 9 } } },
  nor_dx: { '2k': { jpg: { url: 'dx', md5: 'q', size: 1 } } },
  Rough: { '2k': { jpg: { url: `https://dl.polyhaven.org/${id}_rough_2k.jpg`, md5: 'wrong-on-purpose', size: 9 } } },
  Displacement: { '2k': { png: { url: `https://dl.polyhaven.org/${id}_disp_2k.png`, md5: md5(enc(`${id}-disp-2k`)), size: 9 } } },
});

function fakeNet({ ambientUp = true, polyLicenseUp = true } = {}) {
  const asked = [];
  const listing = {
    dry_dirt_01: asset('Dry Dirt 01', { download_count: 50 }),
    dirt_aerial_02: asset('Aerial Dirt 02', { attributes: { aerial: true }, dimensions: [30000, 30000], download_count: 10 }),
    brown_mud_03: asset('Brown Mud 03', { download_count: 900 }),
    rocky_dirt_04: asset('Rocky Dirt 04', { download_count: 70 }),
    packed_soil_05: asset('Packed Soil 05', { download_count: 80 }),
    an_hdri: { name: 'Not a texture', type: 0 },
  };
  const get = async (url) => {
    asked.push(url);
    const ok = (body) => ({ status: 200, ok: true, bytes: enc(body) });
    if (url === 'https://polyhaven.com/license') return polyLicenseUp ? ok('<html><script>var x="CC0"</script><h1>License</h1><p>All assets on Poly Haven are licensed as CC0 and can be used for any purpose.</p><p>Public API</p></html>') : { status: 403, ok: false, bytes: enc('blocked') };
    if (url.endsWith('/ToS.md')) return ok('While our 3D assets themselves are published under the CC0 license, and the code for this API is licensed as AGPL, access is covered by these terms.');
    if (url.startsWith('https://docs.ambientcg.com/license')) return ambientUp ? ok('<p>All assets on ambientCG are provided under the Creative Commons CC0 1.0 Universal License.</p>') : { status: 0, ok: false, bytes: enc('') };
    if (url.startsWith('https://ambientcg.com')) {
      if (!ambientUp) throw new Error('getaddrinfo ENOTFOUND ambientcg.com');
      if (url.includes('/api/v2/full_json')) return ok({ foundAssets: [
        { assetId: 'Ground054', displayName: 'Ground 054', tags: ['ground', 'dirt'], downloadFolders: { default: { downloadFiletypeCategories: { zip: { downloads: [{ attribute: '1K-JPG', fullDownloadPath: 'https://ambientcg.com/get?file=Ground054_1K-JPG.zip' }, { attribute: '2K-JPG', fullDownloadPath: 'https://ambientcg.com/get?file=Ground054_2K-JPG.zip' }] } } } } },
        { assetId: 'Ground037', displayName: 'Ground 037', tags: [{ name: 'ground' }] },
        { assetId: 'Ground099', displayName: 'Ground 099' }] });
      if (url.includes('get?file=')) return ok(`zip:${url}`);
    }
    if (url === 'https://api.polyhaven.com/types') return ok(['hdris', 'textures', 'models']);
    if (url.startsWith('https://api.polyhaven.com/assets?')) return ok(listing);
    if (url.startsWith('https://api.polyhaven.com/search?')) return ok({ query: 'x', total: 3, results: [{ slug: 'packed_soil_05', score: 0.7 }, { slug: 'dry_dirt_01', score: 0.6 }, { slug: 'not_listed', score: 0.5 }, { slug: 'rocky_dirt_04', score: 0.4 }] });
    if (url.startsWith('https://api.polyhaven.com/files/')) return ok(tree(decodeURIComponent(url.split('/files/')[1])));
    if (url.startsWith('https://dl.polyhaven.org/')) { const m = /\/([a-z_0-9]+?)_(diff|nor_gl|rough|disp)_(\dk)\.(jpg|png)$/.exec(url); return ok(`${m[1]}-${m[2].replace('_gl', '')}-${m[3]}`); }
    return { status: 404, ok: false, bytes: enc('not found') };
  };
  return { get, asked };
}
const tools = { resize: (b, px) => enc(`kept ${px}: ${Buffer.from(b).toString('utf8')}`), unzip: (b) => ({ 'Ground054_2K-JPG_Color.jpg': enc('c'), 'Ground054_2K-JPG_NormalGL.jpg': enc('n'), 'Ground054_2K-JPG_NormalDX.jpg': enc('d'), 'Ground054_2K-JPG_Roughness.jpg': enc('r'), 'Ground054_2K-JPG_Displacement.jpg': enc('h'), 'Ground054.usdc': enc('u') }) };

test('the fetch, on saved answers: both libraries, every surface, every file recorded', async () => {
  const out = mkdtempSync(join(tmpdir(), 'ground-'));
  const net = fakeNet();
  const { answered, usable, manifest } = await run({ get: net.get, tools, outDir: out, today: '2026-11-20', runId: '1', log: () => {} });
  assert.equal(answered, 2);
  assert.ok(usable >= SURFACES.length);
  // Poly Haven's API terms 2.4 (a user-agent naming the software) are met by realGet; the license sentence is the page's own, scripts left out
  assert.match(manifest.libraries.polyhaven.license, /licensed as CC0/);
  assert.doesNotMatch(manifest.libraries.polyhaven.license, /var x/);
  assert.equal(manifest.libraries.polyhaven.licensePage, 'https://polyhaven.com/license');
  assert.match(manifest.libraries.ambientcg.license, /CC0 1\.0/);
  // every surface has at least three candidates with a colour map
  for (const s of SURFACES) assert.ok(manifest.surfaces[s.id].candidates.filter((c) => c.files && c.files.color).length >= 3, s.id);
  const floor = manifest.surfaces.floor.candidates;
  // Poly Haven: the search's order within the categories first, then downloads; the hdri left out; one drone capture added
  assert.deepEqual(floor.filter((c) => c.library === 'polyhaven').map((c) => c.id), ['packed_soil_05', 'dry_dirt_01', 'rocky_dirt_04', 'brown_mud_03', 'dirt_aerial_02']);
  const c = floor[0];
  assert.equal(c.files.color.url, 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/packed_soil_05/packed_soil_05_diff_2k.jpg');
  assert.equal(c.files.color.resolution, '2k');
  assert.equal(c.files.color.md5Matches, true);
  assert.equal(c.files.rough.md5Matches, false, 'a checksum that does not match is recorded as such');
  assert.equal(c.files.height.format, 'png', 'a map offered only as PNG is taken as PNG');
  assert.equal(c.files.normal.mapKey, 'nor_gl');
  assert.equal(c.fetched, '2026-11-20');
  assert.deepEqual(c.groundMm, [2000, 2000]);
  assert.equal(readFileSync(join(out, c.files.color.file), 'utf8'), 'kept 1024: packed_soil_05-diff-2k');
  // a candidate wanted by a second surface is fetched once
  const fileAsks = net.asked.filter((u) => u === 'https://api.polyhaven.com/files/packed_soil_05');
  assert.equal(fileAsks.length, 1);
  assert.ok(manifest.surfaces['dry-grass'].candidates.some((x) => x.id === 'packed_soil_05' && x.alsoFor));
  // ambientCG: the 2K zip address read from the listing, or made from the id; the maps by their suffixes
  const a = floor.find((x) => x.library === 'ambientcg');
  assert.equal(a.id, 'Ground054');
  assert.equal(a.files.color.url, 'https://ambientcg.com/get?file=Ground054_2K-JPG.zip');
  assert.equal(a.files.normal.inZip, 'Ground054_2K-JPG_NormalGL.jpg');
  assert.equal(a.zipGuessed, false);
  // the record and the log are written; the raw answers are kept
  assert.ok(existsSync(join(out, 'manifest.json')) && existsSync(join(out, 'log.txt')));
  assert.ok(existsSync(join(out, 'raw', 'polyhaven-files-packed_soil_05.json')));
  assert.match(readFileSync(join(out, 'log.txt'), 'utf8'), /polyhaven: file request 200/);
});

test('the fetch: a library that does not answer is logged and skipped; the license falls back to the library\'s own terms', async () => {
  const out = mkdtempSync(join(tmpdir(), 'ground-'));
  const net = fakeNet({ ambientUp: false, polyLicenseUp: false });
  const { answered, usable, manifest } = await run({ get: net.get, tools, outDir: out, today: '2026-11-20', log: () => {} });
  assert.equal(answered, 1);
  assert.ok(usable > 0);
  assert.equal(manifest.libraries.polyhaven.licensePage, 'https://raw.githubusercontent.com/Poly-Haven/Public-API/master/ToS.md');
  assert.equal(manifest.libraries.ambientcg.answered, false);
  assert.match(readFileSync(join(out, 'log.txt'), 'utf8'), /ambientcg: listing no answer .*ENOTFOUND/);
});

test('the fetch: no library answering is a failed run', async () => {
  const out = mkdtempSync(join(tmpdir(), 'ground-'));
  const { answered } = await run({ get: async () => { throw new Error('refused'); }, tools, outDir: out, today: '2026-11-20', log: () => {} });
  assert.equal(answered, 0);
});

test('the fetch\'s pieces: page text, CC0 sentences, map choice, names', () => {
  assert.equal(cc0Sentences(pageText('<p>Use anything.</p>')), null);
  assert.match(cc0Sentences('Everything here is CC0. Do what you like.'), /^Everything here is CC0\./);
  const f = polyHavenFiles({ Diffuse: { '4k': { jpg: { url: 'a4' } }, '1k': { jpg: { url: 'a1' } } }, nor_gl: { '8k': { png: { url: 'n8' } } } });
  assert.equal(f.color.url, 'a1', '1k and 4k are as far from 2,048 as each other: the smaller is taken');
  assert.equal(f.normal.url, 'n8');
  assert.deepEqual(Object.keys(ambientMaps(['X_Color.jpg', 'X_NormalDX.jpg'])), ['color']);
  assert.equal(ambientAssets({ a: [{ assetId: 'Rock030' }] })[0].zip, 'https://ambientcg.com/get?file=Rock030_2K-JPG.zip');
  assert.equal(candidateDir({ library: 'polyhaven', id: 'Dry_Dirt 01' }, 'floor'), 'floor--polyhaven--dry-dirt-01');
  assert.equal(pickPolyHaven([{}], null, 4).length, 0);
});
