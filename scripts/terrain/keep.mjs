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
//       commit step to stage by name. A part it did not fetch is copied from
//       the old file's own text (spliceTerrain), so it stays byte for byte
//       whatever its layout or escaping.
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

// The top-level parts of a JSON object's text, each with its own text as
// written: { key, lead (the whitespace before it), core (from its key to the
// end of its value), trail (the whitespace after) }, and the text before the
// first and after the closing brace. Strings are skipped whole, escapes and
// all, so a brace or comma inside one is not read as structure.
export function splitTopLevel(text) {
  const open = text.indexOf('{');
  if (open < 0) throw new Error('not a JSON object');
  const parts = [];
  let depth = 0, start = open + 1, i = open + 1, close = -1;
  const cut = (end) => {
    const raw = text.slice(start, end);
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(raw);
    if (m[2]) parts.push({ key: JSON.parse(m[2].slice(0, m[2].indexOf(':', closingQuote(m[2])))), lead: m[1], core: m[2], trail: m[3] });
  };
  for (; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { i = endOfString(text, i); continue; }
    if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { if (depth === 0) { cut(i); close = i; break; } depth--; }
    else if (c === ',' && depth === 0) { cut(i); start = i + 1; }
  }
  if (close < 0) throw new Error('unclosed JSON object');
  return { head: text.slice(0, open + 1), parts, tail: text.slice(close) };
}
const endOfString = (t, i) => { for (let j = i + 1; j < t.length; j++) { if (t[j] === '\\') j++; else if (t[j] === '"') return j; } throw new Error('unclosed string'); };
const closingQuote = (core) => endOfString(core, core.indexOf('"'));

// The merged record's text: every part the run did not fetch copied from the
// old text as it was; a fetched part that replaces one keeps its place and the
// whitespace around it; a new part goes last. Layout of a fetched part: the
// writer's own, JSON.stringify(…, null, 1) one level in.
export function spliceTerrain(beforeText, fetched) {
  if (!beforeText || !beforeText.trim()) return JSON.stringify(fetched, null, 1) + '\n';
  const { head, parts, tail } = splitTopLevel(beforeText);
  const coreOf = (k) => `${JSON.stringify(k)}: ${JSON.stringify(fetched[k], null, 1).split('\n').join('\n ')}`;
  const out = parts.map((p) => (Object.prototype.hasOwnProperty.call(fetched, p.key) ? { ...p, core: coreOf(p.key) } : p));
  for (const k of Object.keys(fetched)) {
    if (parts.some((p) => p.key === k)) continue;
    const last = out[out.length - 1];
    out.push({ key: k, lead: last ? last.lead : '\n ', core: coreOf(k), trail: last ? last.trail : '\n' });
    if (last) last.trail = '';
  }
  return head + out.map((p) => p.lead + p.core + p.trail).join(',') + tail;
}

export function writeResults({ root, fetched, written = [], listFile = null }) {
  const file = join(root, 'data', 'terrain.json');
  const beforeText = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const text = spliceTerrain(beforeText, fetched);
  const merged = JSON.parse(text);
  writeFileSync(file, text);
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
