// Who works on which files (Dan, 21 Nov 2026: "have you and Codex divide and
// conquer the work on this repo ... keep that side of things [real firearms]
// over here with you and perhaps have Codex work on the more general graphics
// quality stuff"). CLAUDE.md, "Who works on what", states the rule in words;
// this file is the list, and the Checks workflow runs it on every pull
// request.
//
// REAL is every file that holds or computes the real rifles', sights',
// ammunition's and spotting scope's figures, or the records built on them.
// A Codex branch (its name starts with "codex/") may not change any of them:
// the check fails and names the files. PICTURE is the drawing side, which
// Codex leads. Everything else is shared: either side, one open pull request
// at a time, the other side checking the result.
//
//   node scripts/owners.mjs <branch> <base>   checks the branch's changes
//                                             against <base> (a git ref)
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REAL = [
  'public/engine.js',
  'data/rifles.json', 'data/loads.json', 'data/sights.json', 'data/spotting.json',
  'data/physics.json', 'data/weather.json', 'data/courses.json',
  'lib/guns.js', 'lib/data.js',
  'public/zero.js', 'public/zero.html', 'public/book.js', 'public/book.html',
  'test/engine.test.js', 'test/data.test.js', 'test/guns.test.js', 'test/weather.test.js',
  'scripts/place-near.mjs',
  // The split itself and the workflow that runs it, so a branch cannot loosen its own check.
  'scripts/owners.mjs', 'test/owners.test.js', '.github/workflows/checks.yml',
];

export const PICTURE = [
  'src/scene/', 'scripts/build-scene.mjs', 'scripts/terrain/', 'scripts/ground/',
  'scripts/picture-measure.mjs', 'scripts/ground-measure.cjs', 'scripts/scope-frames.mjs',
  'data/look.json', 'data/terrain.json', 'docs/LOOK.md',
  'test/scene.test.js', 'test/terrain.test.js', 'test/ground-fetch.test.js',
  '.github/workflows/terrain.yml', '.github/workflows/ground.yml',
];

const inList = (list, file) => list.some((p) => (p.endsWith('/') ? file.startsWith(p) : file === p));

export function sideOf(file) {
  if (inList(REAL, file)) return 'real';
  if (inList(PICTURE, file)) return 'picture';
  return 'shared';
}

export const isCodexBranch = (branch) => /^codex\//.test(branch || '');

// The files a branch may not change, given its name and its changed files.
export function refused(branch, files) {
  return isCodexBranch(branch) ? files.filter((f) => sideOf(f) === 'real') : [];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [branch, base] = process.argv.slice(2);
  if (!branch || !base) { console.error('usage: node scripts/owners.mjs <branch> <base ref>'); process.exit(2); }
  const files = execFileSync('git', ['diff', '--name-only', `${base}...HEAD`], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const bad = refused(branch, files);
  if (bad.length) {
    console.error(`owners: ${branch} is a Codex branch and changes files that hold or compute the real rifles' figures, which stay with Claude (CLAUDE.md, "Who works on what"):\n  ${bad.join('\n  ')}\nHand that part back: say what is needed on the range-day card, and leave these files as they are.`);
    process.exit(1);
  }
  console.log(`owners: ${files.length} changed file(s) on ${branch}; none outside its side.`);
}
