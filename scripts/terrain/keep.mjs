// Keeps what a ground-fetching run did not fetch, and refuses to commit a
// deletion (range-day-eleven, on Dan's yes to Ask 2 of range-day-ten: on
// range-day-ten's branch a Terrain run committed a data/terrain.json without
// its "surfaces" part and deleted the 24 surface photographs, because its
// commit step staged the whole folder, deletions included).
//
//   mergeTerrain(before, fetched)   the record to write: every top-level part
//       of the old data/terrain.json kept as it was, each part this run
//       fetched put in its place (the run fetches the two ranges and _about;
//       "surfaces" is never among them).
//   writeResults({ root, fetched, written, listFile })   writes that merged
//       record, removes nothing, and lists the paths the run wrote (the
//       record and its own new files) in listFile, one per line, for the
//       commit step to stage by name.
//   deletionProblems({ deleted, beforeKeys, afterKeys })   the guard's rule:
//       every file the staged change removes and every top-level part of
//       data/terrain.json it drops, by name.
//
//   node scripts/terrain/keep.mjs guard <path>...   run between the fetch and
//       the commit: reads the staged change against HEAD under the paths
//       given and fails, naming the items, if it removes any file or drops
//       any top-level part of data/terrain.json. The Terrain and the Ground
//       workflows both run it.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export function mergeTerrain(before, fetched) {
  const out = {};
  for (const k of Object.keys(before || {})) out[k] = Object.prototype.hasOwnProperty.call(fetched, k) ? fetched[k] : before[k];
  for (const k of Object.keys(fetched)) if (!(k in out)) out[k] = fetched[k];
  return out;
}

// The JSON text of the merged record. A part kept from before is written back
// in the same layout as before (JSON.stringify(…, null, 1)), so its bytes in
// the file are the bytes it had.
export function writeResults({ root, fetched, written = [], listFile = null }) {
  const file = join(root, 'data', 'terrain.json');
  const before = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
  const merged = mergeTerrain(before, fetched);
  writeFileSync(file, JSON.stringify(merged, null, 1) + '\n');
  const paths = ['data/terrain.json', ...written.map((f) => relative(root, f).split('\\').join('/'))];
  if (listFile) writeFileSync(listFile, paths.join('\n') + '\n');
  return { merged, paths };
}

export function deletionProblems({ deleted = [], beforeKeys = [], afterKeys = null }) {
  const problems = deleted.map((f) => `removes the file ${f}`);
  if (afterKeys) for (const k of beforeKeys) if (!afterKeys.includes(k)) problems.push(`drops the part "${k}" of data/terrain.json`);
  return problems;
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const keysAt = (cwd, spec) => { try { return Object.keys(JSON.parse(git(['show', spec], cwd))); } catch { return null; } };

// The staged change in the repository at cwd, under paths, read against HEAD.
export function guard(cwd, paths) {
  const deleted = git(['diff', '--cached', '--name-only', '--diff-filter=D', 'HEAD', '--', ...paths], cwd).split('\n').filter(Boolean);
  const beforeKeys = keysAt(cwd, 'HEAD:data/terrain.json') || [];
  const watchesRecord = paths.some((p) => p === 'data/terrain.json' || p === 'data' || p === 'data/' || p === '.');
  const afterKeys = watchesRecord ? keysAt(cwd, ':data/terrain.json') || [] : null;
  return deletionProblems({ deleted, beforeKeys, afterKeys });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...paths] = process.argv.slice(2);
  if (cmd !== 'guard' || !paths.length) { console.error('usage: node scripts/terrain/keep.mjs guard <path>...'); process.exit(2); }
  const problems = guard(process.cwd(), paths);
  if (problems.length) {
    console.error(`REFUSED: the staged change would delete what this run did not fetch:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`guard: no file removed and no part of data/terrain.json dropped under ${paths.join(', ')}`);
}
