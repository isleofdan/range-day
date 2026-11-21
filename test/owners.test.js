// The work split (scripts/owners.mjs, CLAUDE.md "Who works on what"): a
// Codex branch may not change the files that hold or compute the real
// rifles' figures; every such file named in the list exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { REAL, PICTURE, sideOf, refused } from '../scripts/owners.mjs';

test('every file and folder in the split exists', () => {
  for (const p of [...REAL, ...PICTURE]) assert.ok(existsSync(new URL(`../${p}`, import.meta.url)), p);
});

test('a Codex branch is refused the real-figure files and nothing else', () => {
  const files = ['src/scene/things.mjs', 'public/engine.js', 'data/rifles.json', 'public/line.js', 'README.md'];
  assert.deepEqual(refused('codex/plate-flicker', files), ['public/engine.js', 'data/rifles.json']);
  assert.deepEqual(refused('range-day-eleven', files), []);
  assert.deepEqual(refused('codex/x', ['src/scene/index.mjs', 'data/look.json']), []);
});

test('sides', () => {
  assert.equal(sideOf('src/scene/post.mjs'), 'picture');
  assert.equal(sideOf('data/loads.json'), 'real');
  assert.equal(sideOf('public/game.js'), 'shared');
  assert.equal(sideOf('scripts/owners.mjs'), 'real');
});
