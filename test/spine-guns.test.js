'use strict';
// range-day-fifteen step 5: the rifle set read from the Spine (lib/spine-guns.js), against a stand-in Spine.
// The one request kind is this read, with its 5-second limit: at start, a Spine that never answers makes the game
// fall back to data/rifles.json after the limit, with the reason; one that answers after 2 seconds is read and used.
// A refused record, an empty list, an answer that is not JSON and a refused connection each fall back with their
// reason; a set that differs from the file is listed by id on /alive/guns; after one accepted read, a later read that
// fails keeps the accepted set and records the reason.
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const data = require('../lib/data');
const guns = require('../lib/guns');
const spineGuns = require('../lib/spine-guns');

const { raw } = data.load();
const root = path.join(__dirname, '..');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The twelve records as the Spine answers them: its own ids, the seven rifles from toRecord and the five pistols.
const PISTOLS = [
  { name: 'IWI Jericho 941', fields: { kind: 'pistol', caliber: null, whose: "Dan's" } },
  { name: 'Springfield XD-S', fields: { kind: 'pistol', caliber: null, whose: "Dan's" } },
  { name: 'Springfield XD (first of two)', fields: { kind: 'pistol', caliber: null, whose: "Dan's" } },
  { name: 'Springfield XD (second of two)', fields: { kind: 'pistol', caliber: null, whose: "Dan's" } },
  { name: 'Dan Wesson 1911', fields: { kind: 'pistol', caliber: '.45 ACP', whose: "Dan's", notes: 'Model possibly the Discretion; Dan is not sure.' } },
];
function twelve() {
  const rifles = Object.entries(raw.rifles).filter(([id]) => !id.startsWith('_')).map(([id, e]) => guns.toRecord(id, e));
  return [...rifles, ...PISTOLS].map((r, i) => ({ id: `${(i + 1).toString(16).padStart(12, '0')}`, type: 'gun', name: r.name, fields: JSON.parse(JSON.stringify(r.fields)) }));
}

// A stand-in Spine: answer(req, res) decides each answer; set it per test.
async function standIn() {
  const s = { answer: (req, res) => res.end('{}') };
  s.server = http.createServer((req, res) => s.answer(req, res));
  await new Promise((r) => s.server.listen(0, '127.0.0.1', r));
  s.url = `http://127.0.0.1:${s.server.address().port}/internal/records?type=gun`;
  s.close = () => { s.server.closeAllConnections(); return new Promise((r) => s.server.close(r)); };
  return s;
}
const json = (body, delay = 0) => (req, res) => setTimeout(() => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); }, delay);

// The game itself, started against the stand-in, signed in through the form as a person would.
async function game(port, env) {
  const t0 = Date.now();
  const proc = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), APP_PASSWORD: 'open sesame', COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '', GUN_RECORDS_FILE: '', ...env }, stdio: ['ignore', 'ignore', 'inherit'] });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 400; i++) { try { await fetch(`${base}/alive`); break; } catch { await wait(25); } }
  const upAfter = Date.now() - t0;
  const line = (await (await fetch(`${base}/alive/guns`)).text()).trim();
  const login = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passphrase=open+sesame&next=%2F' });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const d = await (await fetch(`${base}/api/data`, { headers: { cookie, accept: 'application/json' } })).json();
  return { proc, upAfter, line, rifles: d.rifles };
}

test('range-day-fifteen: at start, a Spine that never answers makes the game fall back to data/rifles.json after the 5-second limit, with the reason', async () => {
  const spine = await standIn();
  spine.answer = () => {}; // never answers
  const g = await game(8991, { SPINE_GUNS_URL: spine.url });
  try {
    console.log(`  ${g.line} (listening after ${g.upAfter} ms)`);
    assert.ok(g.upAfter >= 5000, `the game waited out the limit before listening (${g.upAfter} ms)`);
    assert.ok(g.upAfter < 9000, `and no longer than the limit and a start (${g.upAfter} ms)`);
    assert.match(g.line, /^guns from data\/rifles\.json, fell back: the Spine read at \S+ failed after 5\d\d\d ms: no answer within 5000 ms$/);
    assert.deepEqual(Object.keys(g.rifles), Object.keys(guns.fromFiles(raw)), 'the whole set from the file');
  } finally { g.proc.kill(); await spine.close(); }
});

test('range-day-fifteen: at start, a Spine that answers after 2 seconds is read and used: twelve records, seven in the game, five not modeled; its changed figure is served and its rifle listed as a difference', async () => {
  const spine = await standIn();
  const records = twelve();
  records[0].fields.game.barrelIn = { value: 18, estimate: 'a stand-in figure for the test, so the set used is seen to be the Spine\'s' };
  spine.answer = json({ items: records, state: 'ok' }, 2000);
  const g = await game(8993, { SPINE_GUNS_URL: spine.url });
  try {
    console.log(`  ${g.line}`);
    assert.match(g.line, /^guns from the Spine: 12 records, 7 in the game, 5 not modeled · read in 2\d\d\d ms \(limit 5000 ms\) at \S+ · differs from data\/rifles\.json: bcm-ar15$/);
    assert.equal(g.rifles['bcm-ar15'].barrelIn, 18, 'the Spine\'s figure is the one served');
    assert.deepEqual(Object.keys(g.rifles), Object.keys(guns.fromFiles(raw)), 'the same seven rifles, keyed by their game ids');
    assert.doesNotMatch(g.line, /\b18\b|barrel|fps|MOA/, 'no figure of any gun on the line');
  } finally { g.proc.kill(); await spine.close(); }
});

test('range-day-fifteen: a set equal to the file reads "differs from data/rifles.json: none", whatever order the Spine gives the keys', async () => {
  const records = twelve();
  // The Spine answers objects with their keys sorted; the comparison ignores key order, never list order.
  const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v);
  const sorted = records.map(sortKeys);
  assert.deepEqual(spineGuns.differences(sorted, raw), []);
  const moved = JSON.parse(JSON.stringify(sorted)); moved[1].fields.game.sights.reverse();
  assert.deepEqual(spineGuns.differences(moved, raw), ['iwi-tavor-sar']);
  const lacking = sorted.filter((r) => r.fields.gameId !== 'remington-22');
  assert.deepEqual(spineGuns.differences(lacking, raw), ['remington-22 (not in the Spine)']);
});

test('range-day-fifteen: a refused record, an empty list, an answer that is not JSON, a refusal and a refused connection each fall back to the file, each with its reason', async () => {
  const spine = await standIn();
  const cases = [
    ['a refused record', (() => { const r = twelve(); r[2].fields.game.defaultSight = 'troy-battlesights'; return json({ items: r, state: 'ok' }); })(), /^guns from data\/rifles\.json, fell back: .* failed after \d+ ms: gun 'iwi-x95': defaultSight 'troy-battlesights' is not one of its sights: fab-flipup, pa-md25, seeall-gen1/],
    ['an empty list', json({ items: [], state: 'no data' }), /fell back: .*: gun records: the list is empty; the game needs at least one gun$/],
    ['not JSON', (req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html>a proxy page</html>'); }, /fell back: .*: the Spine's answer is not JSON: <html>a proxy page<\/html>$/],
    ['a refusal', (req, res) => { res.writeHead(403); res.end('not on the private network'); }, /fell back: .*: the Spine answered 403: not on the private network$/],
  ];
  try {
    for (const [what, answer, expect] of cases) {
      spine.answer = answer;
      let served = null;
      const r = spineGuns.reader({ url: spine.url, raw, onSet: (s) => { served = s; } });
      await r.start();
      console.log(`  ${what}: ${r.line()}`);
      assert.match(r.line(), expect, what);
      assert.equal(r.state().from, 'file', what);
      assert.deepStrictEqual(served, guns.fromFiles(raw), `${what}: the whole set from the file`);
    }
  } finally { await spine.close(); }
  // A refused connection: a port that was open a moment ago and now has nothing listening (never one a pooled connection knows).
  const gone = http.createServer();
  await new Promise((r) => gone.listen(0, '127.0.0.1', r));
  const port = gone.address().port;
  await new Promise((r) => gone.close(r));
  const r = spineGuns.reader({ url: `http://127.0.0.1:${port}/internal/records?type=gun`, raw });
  await r.start();
  console.log(`  a refused connection: ${r.line()}`);
  assert.match(r.line(), /fell back: .*: no answer: ECONNREFUSED$/);
  assert.equal(r.state().from, 'file');
});

test('range-day-fifteen: after one accepted read, a later read that fails keeps the accepted set and records the reason; the next good read is used again', async () => {
  const spine = await standIn();
  const records = twelve();
  records[0].fields.game.barrelIn = { value: 18, estimate: 'a stand-in figure for the test, so the set kept is seen to be the Spine\'s' };
  spine.answer = json({ items: records, state: 'ok' });
  let served = null;
  const r = spineGuns.reader({ url: spine.url, raw, limitMs: 500, onSet: (s) => { served = s; } });
  try {
    await r.start();
    assert.equal(r.state().from, 'spine');
    assert.equal(served['bcm-ar15'].barrelIn, 18);
    spine.answer = () => {}; // now it never answers
    assert.equal(await r.readOnce(), false);
    console.log(`  ${r.line()}`);
    assert.equal(r.state().from, 'spine', 'still the Spine\'s set');
    assert.equal(served['bcm-ar15'].barrelIn, 18, 'the accepted set is kept, never the file\'s');
    assert.match(r.line(), /^guns from the Spine: 12 records, 7 in the game, 5 not modeled · .* · the last read, at \S+, failed after \d+ ms: no answer within 500 ms; keeping the set read at \S+$/);
    spine.answer = json({ items: [], state: 'no data' });
    assert.equal(await r.readOnce(), false);
    assert.match(r.line(), /failed after \d+ ms: gun records: the list is empty; .*; keeping the set read at/);
    assert.equal(served['bcm-ar15'].barrelIn, 18);
    spine.answer = json({ items: twelve(), state: 'ok' });
    assert.equal(await r.readOnce(), true);
    assert.equal(served['bcm-ar15'].barrelIn, 16, 'the next good read is used');
    assert.doesNotMatch(r.line(), /failed/);
  } finally { await spine.close(); }
});

test('range-day-fifteen: with SPINE_GUNS_URL unset nothing is called and the set is the file\'s; /alive itself is unchanged', async () => {
  let called = 0;
  const realFetch = global.fetch;
  global.fetch = (...a) => { called += 1; return realFetch(...a); };
  try {
    const r = spineGuns.reader({ url: '', raw });
    await r.start();
    r.every();
    assert.equal(called, 0);
    assert.equal(r.line(), 'guns from data/rifles.json: SPINE_GUNS_URL is not set, so the Spine is not read');
  } finally { global.fetch = realFetch; }
  const g = await game(8995, { SPINE_GUNS_URL: '' });
  try {
    assert.equal(g.line, 'guns from data/rifles.json: SPINE_GUNS_URL is not set, so the Spine is not read');
    const alive = (await (await fetch('http://127.0.0.1:8995/alive')).text());
    assert.match(alive, /^alive since \S+ · \S+\n$/);
  } finally { g.proc.kill(); }
});
