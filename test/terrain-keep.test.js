'use strict';
// The ground-fetching workflows keep what they did not fetch and refuse to
// commit a deletion (range-day-eleven, Ask 2 of range-day-ten). Without the
// network: a stand-in fetch result is written over a copy of the committed
// data/terrain.json and the surface photographs in a throwaway git
// repository, and the guard the workflows run reads the staged change.
//   npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const record = JSON.parse(fs.readFileSync(path.join(root, 'data', 'terrain.json'), 'utf8'));
// The surface photographs the "surfaces" part names, as the repository holds them.
const surfaceFiles = [...new Set(JSON.stringify(record.surfaces).match(/terrain\/ground-[^"]+\.jpg/g))];

let keep;
test.before(async () => { keep = await import('../scripts/terrain/keep.mjs'); });

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function scratchRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrain-keep-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.invalid'); git(dir, 'config', 'user.name', 'test');
  fs.mkdirSync(path.join(dir, 'data')); fs.mkdirSync(path.join(dir, 'public', 'terrain'), { recursive: true });
  fs.copyFileSync(path.join(root, 'data', 'terrain.json'), path.join(dir, 'data', 'terrain.json'));
  for (const f of surfaceFiles) fs.copyFileSync(path.join(root, 'public', f), path.join(dir, 'public', f));
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'before');
  return dir;
}
const bytes = (dir, rel) => fs.readFileSync(path.join(dir, rel));
const partText = (obj, k) => JSON.stringify(obj[k], null, 1);

test('terrain keep: there are surface photographs and a "surfaces" part to keep', () => {
  assert.ok(record.surfaces && Object.keys(record.surfaces).length > 1, 'data/terrain.json has a surfaces part');
  assert.equal(surfaceFiles.length, 24, 'the surfaces part names 24 photographs');
  for (const f of surfaceFiles) assert.ok(fs.existsSync(path.join(root, 'public', f)), f);
});

test('terrain keep (keeping): a fetch result without the surfaces leaves every kept file and part byte for byte, and the guard passes', () => {
  const dir = scratchRepo();
  const keptBefore = Object.fromEntries(surfaceFiles.map((f) => [f, bytes(dir, path.join('public', f))]));
  const before = JSON.parse(bytes(dir, 'data/terrain.json'));
  // The stand-in: what fetch.mjs builds in one run (_about and the two ranges), one new heights file written.
  const newFile = path.join(dir, 'public', 'terrain', 'cta-piru-heights-00000000.png');
  fs.writeFileSync(newFile, Buffer.from('stand-in heights'));
  const fetched = { _about: 'stand-in about', 'cta-piru': { heights: { file: 'terrain/cta-piru-heights-00000000.png' } }, 'angeles-sylmar': before['angeles-sylmar'] };
  const listFile = path.join(dir, 'written.txt');
  const { paths } = keep.writeResults({ root: dir, fetched, written: [newFile], listFile });
  assert.deepEqual(paths, ['data/terrain.json', 'public/terrain/cta-piru-heights-00000000.png']);
  assert.deepEqual(fs.readFileSync(listFile, 'utf8').trim().split('\n'), paths);

  const after = JSON.parse(bytes(dir, 'data/terrain.json'));
  assert.deepEqual(Object.keys(after), Object.keys(before), 'the same top-level parts in the same order');
  assert.equal(partText(after, 'surfaces'), partText(before, 'surfaces'), 'the surfaces part is byte for byte as it was');
  assert.ok(bytes(dir, 'data/terrain.json').toString().includes(partText(before, 'surfaces').split('\n').join('\n ')), 'its text in the file is unchanged');
  assert.deepEqual(after['cta-piru'], fetched['cta-piru'], 'the fetched part is the fetch\'s');
  for (const f of surfaceFiles) assert.ok(bytes(dir, path.join('public', f)).equals(keptBefore[f]), `${f} unchanged`);

  // The commit step as the workflow runs it: the listed paths by name, no removals, then the guard.
  git(dir, 'add', '--ignore-removal', '--', ...paths);
  const problems = keep.guard(dir, ['public/terrain', 'data/terrain.json']);
  console.log(`  keeping: guard problems ${JSON.stringify(problems)}; staged ${git(dir, 'diff', '--cached', '--name-status').trim().split('\n').join('; ')}`);
  assert.deepEqual(problems, []);
  const cli = execFileSync(process.execPath, [path.join(root, 'scripts', 'terrain', 'keep.mjs'), 'guard', 'public/terrain', 'data/terrain.json'], { cwd: dir, encoding: 'utf8' });
  assert.match(cli, /^guard: no file removed/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('terrain keep (keeping, any layout): a part the run did not fetch is copied from the old text, so its bytes stay whatever its layout, escaping or number spelling; a part it fetched replaces only its own text', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'terrain-keep-odd-'));
  fs.mkdirSync(path.join(dir, 'data'));
  // Laid out unlike the writer's own JSON.stringify(…, null, 1): two-space and no indent, a space before a colon,
  // an escaped é, a brace, a comma and a bracket inside a string, a number spelled 1.50.
  const kept = '"surfaces":{"floor":{"note":"caf\\u00e9 } , [ \\"quoted\\"","scaleM": 1.50, "list": [1,2 ,3]}}';
  const odd = `{\n  "_about" : "old about",\n  ${kept}\n,"cta-piru": {"heights": {"file": "terrain/old.png"}}\n}\n`;
  fs.writeFileSync(path.join(dir, 'data', 'terrain.json'), odd);
  keep.writeResults({ root: dir, fetched: { _about: 'new about', 'cta-piru': { heights: { file: 'terrain/new.png' } }, 'angeles-sylmar': { heights: { file: 'terrain/a.png' } } } });
  const after = fs.readFileSync(path.join(dir, 'data', 'terrain.json'), 'utf8');
  assert.ok(after.includes(kept), 'the surfaces part\'s text is in the file exactly as it was');
  const parsed = JSON.parse(after);
  assert.deepEqual(Object.keys(parsed), ['_about', 'surfaces', 'cta-piru', 'angeles-sylmar']);
  assert.equal(parsed.surfaces.floor.note, 'café } , [ "quoted"'); assert.equal(parsed.surfaces.floor.scaleM, 1.5);
  assert.equal(parsed._about, 'new about'); assert.equal(parsed['cta-piru'].heights.file, 'terrain/new.png');
  assert.ok(!after.includes('terrain/old.png'), 'the fetched part replaced its own text');
  // and the committed record itself: written back with nothing fetched, or with the same values fetched, it is the same bytes
  const real = fs.readFileSync(path.join(root, 'data', 'terrain.json'), 'utf8');
  assert.equal(keep.spliceTerrain(real, {}), real);
  assert.equal(keep.spliceTerrain(real, { _about: record._about, 'cta-piru': record['cta-piru'], 'angeles-sylmar': record['angeles-sylmar'] }), real);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('terrain keep (refusing): a staged change that removes a surface photograph and drops the surfaces part fails the guard, which names them', () => {
  const dir = scratchRepo();
  // What range-day-ten's branch saw: the record rewritten without "surfaces", the photographs removed, all staged.
  const before = JSON.parse(bytes(dir, 'data/terrain.json'));
  const { surfaces, ...rest } = before;
  fs.writeFileSync(path.join(dir, 'data', 'terrain.json'), JSON.stringify(rest, null, 1) + '\n');
  const gone = surfaceFiles.slice(0, 2);
  for (const f of gone) fs.unlinkSync(path.join(dir, 'public', f));
  git(dir, 'add', '-A', 'public/terrain', 'data/terrain.json');
  const problems = keep.guard(dir, ['public/terrain', 'data/terrain.json']);
  console.log(`  refusing: ${problems.join('; ')}`);
  for (const f of gone) assert.ok(problems.includes(`removes the file public/${f}`), f);
  assert.ok(problems.includes('drops the part "surfaces" of data/terrain.json'));
  assert.equal(problems.length, gone.length + 1);
  let failed = null;
  try { execFileSync(process.execPath, [path.join(root, 'scripts', 'terrain', 'keep.mjs'), 'guard', 'public/terrain', 'data/terrain.json'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); } catch (e) { failed = e; }
  assert.ok(failed, 'the guard exits non-zero');
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /REFUSED/);
  assert.match(failed.stderr, /drops the part "surfaces"/);
  for (const f of gone) assert.ok(failed.stderr.includes(f), f);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('terrain keep (refusing, Ground): the guard fails a staged removal under ground-fetch/', () => {
  const dir = scratchRepo();
  fs.mkdirSync(path.join(dir, 'ground-fetch'));
  fs.writeFileSync(path.join(dir, 'ground-fetch', 'manifest.json'), '{}\n');
  fs.writeFileSync(path.join(dir, 'ground-fetch', 'first-run.jpg'), 'x');
  git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'first run');
  fs.rmSync(path.join(dir, 'ground-fetch'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'ground-fetch'));
  fs.writeFileSync(path.join(dir, 'ground-fetch', 'manifest.json'), '{"second":true}\n');
  // The workflow's own staging keeps the first run's file …
  git(dir, 'add', '--ignore-removal', 'ground-fetch');
  assert.deepEqual(keep.guard(dir, ['ground-fetch', 'public/terrain', 'data/terrain.json']), []);
  // … and a blanket add that stages the removal is refused.
  git(dir, 'add', '-A', 'ground-fetch');
  assert.deepEqual(keep.guard(dir, ['ground-fetch', 'public/terrain', 'data/terrain.json']), ['removes the file ground-fetch/first-run.jpg']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('terrain keep: the workflows start as stated and stage nothing with a blanket add', () => {
  const wf = (n) => fs.readFileSync(path.join(root, '.github', 'workflows', n), 'utf8');
  const terrain = wf('terrain.yml'), ground = wf('ground.yml');
  const on = terrain.slice(terrain.indexOf('\non:'), terrain.indexOf('\npermissions:'));
  assert.match(on, /workflow_dispatch/, 'Terrain starts by hand');
  assert.doesNotMatch(on, /push|pull_request|schedule/, 'no push, pull request or schedule starts Terrain');
  assert.match(terrain, /if: github\.ref_name != 'main'/, 'Terrain never runs on main');
  for (const [name, text] of [['terrain.yml', terrain], ['ground.yml', ground]]) {
    const run = text.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    assert.doesNotMatch(run, /git add (-A|--all|\.)/, `${name} has no blanket add`);
    assert.match(run, /git add --ignore-removal/, `${name} stages without removals`);
    assert.match(run, /node scripts\/terrain\/keep\.mjs guard/, `${name} runs the guard`);
    assert.ok(run.indexOf('keep.mjs guard') < run.indexOf('git commit'), `${name} runs the guard before the commit`);
  }
  assert.match(ground.slice(ground.indexOf('\non:'), ground.indexOf('\npermissions:')), /'\*-fetch'/, 'Ground still runs only on a …-fetch branch');
});
