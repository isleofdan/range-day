// Every check, ending with one line that names what failed. Uses only what
// Node ships with.
//   npm run check              syntax, tests, screenshots (the full run)
//   npm run check -- --fast    syntax and tests only
//   node scripts/check.mjs --hook
//       the fast checks, as Claude Code's after-every-edit hook runs them
//       (.claude/settings.json): silent when they pass; when one fails,
//       its output goes to stderr and the exit code is 2, which is how a
//       PostToolUse hook shows a failure to the session.
// Since range-day-seven the slow checks run side by side (range-day-six's
// run took 35 minutes here and an hour on GitHub's runner, one file after
// another with three cores idle), and the Checks workflow runs each piece
// as its own job on its own runner:
//   --only tests --group scene      one group of test files (the groups are
//       TEST_GROUPS below: each browser-heavy file alone, the rest together)
//   --only screenshots --shard 2/4  one shard of the screenshot states
//       (scripts/screenshots.mjs --shard), every state once across the shards
//   --jobs 2                        how many pieces run at once here
//       (default JOBS below); --shards 4 how many screenshot shards (default
//       SHARDS). Every job runs the syntax check too; it takes a second.
// Nothing is dropped: every test file and every screenshot state that ran
// one after another runs in exactly one piece. Before the tests and the
// screenshots the picture file public/scene.min.js is built once from
// src/scene/ (scripts/build-scene.mjs); the pieces reuse it.
// Screenshots need Playwright's browser. Where it is missing (some
// machines) they are skipped and the verdict says so; in GitHub Actions
// (CI set) a missing browser is a failure.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, openSync, closeSync, statSync, unlinkSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir, availableParallelism } from 'node:os';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback; };
const hook = argv.includes('--hook');
const fast = hook || argv.includes('--fast');
const only = arg('--only', null);
const group = arg('--group', null);
const shard = arg('--shard', null);
// Pieces running at once: two here by default. Three browser files drawing 3D in software at once starve each other's
// clocks (range-day-five), and on GitHub's runner each piece is its own job on its own machine.
const JOBS = Number(arg('--jobs', Math.max(1, Math.min(2, availableParallelism()))));
export const SHARDS = Number(arg('--shards', 4));

// The test files in groups that run side by side: each file that drives a browser through 3D alone (they are the slow
// ones and each starts its own server on its own port), everything else together. A new test file lands in "rest".
// test/scene.test.js is itself three pieces, cut by test name (Node's --test-name-pattern): its verify 3 (twenty seeded
// shots flown under three pictures) took 396 s and its verify 2 (every plate at every zoom, both sizes) 228 s of the
// file's 728 s in the cloud session (range-day-seven); the third piece is every other test in the file (Node's
// --test-skip-pattern with the first two's pattern), so a new test there lands in it and no test is left out.
export const TEST_GROUPS = {
  'scene-shots': { files: ['test/scene.test.js'], pattern: '^verify 3:' },
  'scene-scale': { files: ['test/scene.test.js'], pattern: '^verify 2:' },
  'scene-rest': { files: ['test/scene.test.js'], skip: '^verify [23]:' },
  day: { files: ['test/day.test.js'] },
  browser: { files: ['test/browser.test.js'] },
};
TEST_GROUPS.rest = { files: readdirSync(join(root, 'test')).filter((f) => f.endsWith('.test.js')).map((f) => `test/${f}`).filter((f) => !Object.values(TEST_GROUPS).flatMap((g) => g.files).includes(f)).sort() };

// Edits made side by side fire the hook side by side; the tests start a
// server on a fixed port, so a second run would fail for no real reason.
// While one run holds the lock, another skips quietly.
let lock;
if (hook) {
  lock = join(tmpdir(), `kit-check-${createHash('sha1').update(root).digest('hex').slice(0, 12)}.lock`);
  try { if (Date.now() - statSync(lock).mtimeMs > 120000) unlinkSync(lock); } catch {}
  try { closeSync(openSync(lock, 'wx')); } catch { process.exit(0); }
  process.on('exit', () => { try { unlinkSync(lock); } catch {} });
}

const say = (line) => (hook ? process.stderr : process.stdout).write(line + '\n');
const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', env: process.env });
// A piece run in its own process, its output kept, its seconds counted.
const piece = (name, args) => new Promise((resolve) => {
  const started = Date.now();
  const kid = spawn(process.execPath, args, { cwd: root, env: process.env });
  let output = '';
  kid.stdout.on('data', (d) => { output += d; }); kid.stderr.on('data', (d) => { output += d; });
  kid.on('close', (status) => resolve({ name, status, output, seconds: (Date.now() - started) / 1000 }));
});
// Pieces run at most JOBS at a time, in the order given, every one to its end.
async function pieces(list) {
  const results = []; let next = 0;
  await Promise.all(Array.from({ length: Math.min(JOBS, list.length) }, async () => { while (next < list.length) { const p = list[next++]; results.push(await piece(p.name, p.args)); } }));
  return results;
}
const nodeTest = ({ files, pattern, skip }) => ['--test', '--test-concurrency=1', ...(pattern ? [`--test-name-pattern=${pattern}`] : []), ...(skip ? [`--test-skip-pattern=${skip}`] : []), ...files];

function jsFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...jsFiles(path));
    else if (/\.(js|mjs|cjs)$/.test(entry.name)) found.push(path);
  }
  return found;
}

// The picture file, built once before the tests and the screenshots (what npm test's pretest does for a run by hand).
let sceneBuilt = false;
function buildScene() {
  if (sceneBuilt) return { ok: true };
  const r = run(process.execPath, [join(root, 'scripts', 'build-scene.mjs')]);
  if (r.status !== 0) return { ok: false, output: r.stdout + r.stderr, detail: 'public/scene.min.js did not build' };
  sceneBuilt = true;
  if (!hook) say(`built public/scene.min.js (${statSync(join(root, 'public', 'scene.min.js')).size} bytes)`);
  return { ok: true };
}
// The failed tests by name, from Node's own reporter ("✖ <name>" or "not ok N - <name>").
const failedTests = (output) => [...new Set([...output.matchAll(/^\s*(?:✖|not ok \d+ -) (.+?)(?: \(\d[\d.]*ms\))?$/gm)].map((m) => m[1]))].filter((name) => !/^failing tests:?$/.test(name));

const checks = [
  {
    name: 'syntax',
    run() {
      const bad = [];
      for (const file of jsFiles(root)) {
        const r = run(process.execPath, ['--check', file]);
        if (r.status !== 0) bad.push({ file: relative(root, file), error: r.stderr.trim() });
      }
      if (!bad.length) return { ok: true };
      return { ok: false, output: bad.map((b) => b.error).join('\n\n'), detail: `does not parse: ${bad.map((b) => b.file).join(', ')}` };
    },
  },
  {
    name: 'tests',
    async run() {
      const built = buildScene(); if (!built.ok) return built;
      const names = group ? [group] : Object.keys(TEST_GROUPS);
      if (group && !TEST_GROUPS[group]) return { ok: false, output: '', detail: `no test group "${group}" (${Object.keys(TEST_GROUPS).join(', ')})` };
      const results = await pieces(names.map((n) => ({ name: n, args: nodeTest(TEST_GROUPS[n]) })));
      for (const r of results) if (!hook) say(`  ${r.status === 0 ? 'ok  ' : 'FAIL'} tests: ${r.name} (${TEST_GROUPS[r.name].files.join(', ')}${TEST_GROUPS[r.name].pattern ? `, tests matching /${TEST_GROUPS[r.name].pattern}/` : ''}${TEST_GROUPS[r.name].skip ? `, tests not matching /${TEST_GROUPS[r.name].skip}/` : ''}) ${r.seconds.toFixed(1)} s`);
      const bad = results.filter((r) => r.status !== 0);
      if (!bad.length) return { ok: true };
      const output = bad.map((r) => r.output).join('\n');
      const failed = failedTests(output);
      return { ok: false, output, detail: failed.length ? `failed: ${failed.join('; ')}` : `tests exited ${bad.map((r) => `${r.name}: ${r.status}`).join(', ')}` };
    },
  },
  {
    name: 'screenshots',
    slow: true,
    async run() {
      let browser = null;
      try { browser = (await import('playwright')).chromium.executablePath(); } catch {}
      if (!browser || !existsSync(browser)) {
        if (process.env.CI) return { ok: false, output: '', detail: "Playwright's browser is missing (npx playwright install chromium)" };
        return { ok: true, skipped: 'no browser on this machine; the Checks workflow runs them' };
      }
      const built = buildScene(); if (!built.ok) return built;
      const shards = shard ? [shard] : Array.from({ length: SHARDS }, (_, i) => `${i + 1}/${SHARDS}`);
      const results = await pieces(shards.map((s) => ({ name: s, args: [join(root, 'scripts', 'screenshots.mjs'), '--shard', s, '--port', String(8921 + Number(s.split('/')[0]) - 1)] })));
      for (const r of results) {
        if (hook) continue;
        for (const m of r.output.matchAll(/^time (.+)$/gm)) say(`    ${m[1]}`);
        say(`  ${r.status === 0 ? 'ok  ' : 'FAIL'} screenshots: shard ${r.name} ${r.seconds.toFixed(1)} s`);
      }
      const bad = results.filter((r) => r.status !== 0);
      if (!bad.length) return { ok: true };
      const output = bad.map((r) => r.output).join('\n');
      const failed = [...output.matchAll(/^FAIL (.+)$/gm)].map((m) => m[1]);
      return { ok: false, output, detail: failed.length ? `failed: ${failed.join('; ')}` : `screenshots exited ${bad.map((r) => `${r.name}: ${r.status}`).join(', ')}` };
    },
  },
];

const passed = [];
const skipped = [];
if (process.argv[1] === fileURLToPath(import.meta.url)) for (const check of checks) {
  if (fast && check.slow) continue;
  if (only && check.name !== 'syntax' && check.name !== only) continue;
  const started = Date.now();
  const result = await check.run();
  const seconds = ((Date.now() - started) / 1000).toFixed(2);
  if (!result.ok) {
    if (result.output) say(result.output.trimEnd());
    say(`check: FAILED at ${check.name} (${seconds} s): ${result.detail}`);
    process.exit(hook ? 2 : 1);
  }
  if (result.skipped) { skipped.push(`${check.name} (${result.skipped})`); if (!hook) say(`skip ${check.name}: ${result.skipped}`); continue; }
  passed.push(check.name + (check.name === 'tests' && group ? ` (${group})` : check.name === 'screenshots' && shard ? ` (shard ${shard})` : ''));
  if (!hook) say(`ok   ${check.name} (${seconds} s)`);
}
if (process.argv[1] === fileURLToPath(import.meta.url) && !hook) say(`check: all passed: ${passed.join(', ')}${skipped.length ? `; skipped ${skipped.join(', ')}` : ''}`);
