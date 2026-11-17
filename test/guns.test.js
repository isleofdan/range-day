'use strict';
// The gun-record seam (lib/guns.js): the game's own data passes through it
// unchanged, a bad record is refused by name with the valid values, a file
// of records named by GUN_RECORDS_FILE is what the server serves, and no
// screen names a rifle by its id (brief range-day-three, verify 4).
//   npm test

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const data = require('../lib/data');
const guns = require('../lib/guns');

const { raw, flat } = data.load();
const root = path.join(__dirname, '..');

test('fromFiles() yields the same seven rifles the screens had before, figure for figure', () => {
  const set = guns.fromFiles(raw);
  const ids = Object.keys(flat.rifles).filter((k) => !k.startsWith('_'));
  assert.deepEqual(Object.keys(set), ids, 'the same rifles in the same order');
  for (const id of ids) assert.deepStrictEqual(set[id], flat.rifles[id], id);
  assert.equal(set['molot-vepr-54r'].firstCourse, 'cta-piru');
  assert.deepEqual(set['ak-545'].sightLeaf, { 'ak-irons': 'leaf545' });
});

test('a bare number, an unknown sight, a defaultSight it does not carry, a missing sight height: each refused, naming the gun, the fault and the valid values', () => {
  const base = guns.toRecord('bcm-ar15', raw.rifles['bcm-ar15']);
  const broken = (change) => { const r = JSON.parse(JSON.stringify(base)); r.id = 'x'; change(r.fields.game); return r; };
  const refuse = (r) => { try { guns.fromRecords([r], raw); } catch (e) { assert.ok(e instanceof guns.RecordError, e.message); return e.message; } assert.fail('accepted a bad record'); };
  const messages = [
    refuse(broken((g) => { g.barrelIn = 16; })),
    refuse(broken((g) => { g.sights = ['ar-irons', 'foo']; g.sightHeightIn.foo = { value: 1, estimate: 'a basis long enough to count here' }; })),
    refuse(broken((g) => { g.defaultSight = 'pa-md25'; })),
    refuse(broken((g) => { delete g.sightHeightIn['ar-irons']; })),
  ];
  console.log('  ' + messages.join('\n  '));
  assert.match(messages[0], /^gun 'x': game\.barrelIn: a bare number; wrap it as \{value, source\} or \{value, estimate\}$/);
  assert.match(messages[1], /^gun 'x': sight 'foo' is not in the game's data: ar-irons, tavor-irons, ak-irons, vepr-irons, rem-irons, pa-md25, pa-magnifier, pa-3x-acss, utg-2-7x44$/);
  assert.match(messages[2], /^gun 'x': defaultSight 'pa-md25' is not one of its sights: ar-irons$/);
  assert.match(messages[3], /^gun 'x': no sightHeightIn for sight 'ar-irons'; it carries: ar-irons$/);
  // And the rest of the shape: an unknown load, a wrong caliber, a course that does not exist, a leaf table the sight lacks, a duplicate.
  assert.match(refuse(broken((g) => { g.loads = ['imi-m193', 'nope']; })), /load 'nope' is not in the game's data: /);
  assert.match(refuse(broken((g) => { g.loads = ['sb-124']; })), /load 'sb-124' is 7.62x39, not the gun's 5.56x45/);
  assert.match(refuse(broken((g) => { g.firstCourse = 'moon'; })), /firstCourse 'moon' is not a course: cta-piru, angeles-sylmar/);
  assert.match(refuse(broken((g) => { g.sightLeaf = { 'ar-irons': 'leaf' }; })), /sightLeaf for 'ar-irons' names 'leaf', which is not a leaf table on that sight: it has none/);
  assert.match(refuse(broken((g) => { g.extra = 1; })), /unknown field 'extra'/);
  assert.throws(() => guns.fromRecords([base, base], raw), /appears twice/);
  assert.throws(() => guns.fromRecords([], raw), /the list is empty/);
  assert.throws(() => guns.fromRecords({ not: 'a list' }, raw), /expected a list of records, got object/);
});

test('no screen names a rifle by its id: public/*.js holds none of the ids in data/rifles.json', () => {
  const ids = Object.keys(flat.rifles).filter((k) => !k.startsWith('_'));
  for (const f of fs.readdirSync(path.join(root, 'public')).filter((f) => f.endsWith('.js'))) {
    const text = fs.readFileSync(path.join(root, 'public', f), 'utf8');
    for (const id of ids) assert.ok(!text.includes(id), `${f} names the rifle '${id}'`);
  }
});

test('with GUN_RECORDS_FILE naming a file with an eighth gun, the server serves eight rifles, the eighth with its own figures; a bad file stops it with the reason', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'range-day-guns-'));
  const records = Object.entries(raw.rifles).filter(([id]) => !id.startsWith('_')).map(([id, e]) => guns.toRecord(id, e));
  const eighth = JSON.parse(JSON.stringify(guns.toRecord('bcm-ar15', raw.rifles['bcm-ar15'])));
  eighth.id = 'test-carbine'; eighth.name = 'Test carbine, 5.56';
  eighth.fields.game.sightHeightIn['ar-irons'] = { value: 3.4, estimate: 'a made-up height for the test, higher than the AR\'s own' };
  eighth.fields.game.firstCourse = 'cta-piru';
  records.push(eighth);
  const file = path.join(dir, 'guns.json');
  fs.writeFileSync(file, JSON.stringify(records));
  const PORT = 8951;
  const server = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT), APP_PASSWORD: 'open sesame', COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '', GUN_RECORDS_FILE: file }, stdio: ['ignore', 'ignore', 'inherit'] });
  try {
    for (let i = 0; i < 100; i++) { try { await fetch(`http://127.0.0.1:${PORT}/alive`); break; } catch { await new Promise((r) => setTimeout(r, 50)); } }
    const login = await fetch(`http://127.0.0.1:${PORT}/login`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'passphrase=open+sesame&next=%2F' });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const d = await (await fetch(`http://127.0.0.1:${PORT}/api/data`, { headers: { cookie, accept: 'application/json' } })).json();
    assert.equal(Object.keys(d.rifles).length, 8);
    assert.equal(d.rifles['test-carbine'].name, 'Test carbine, 5.56');
    assert.equal(d.rifles['test-carbine'].sightHeightIn['ar-irons'], 3.4);
    assert.equal(d.rifles['test-carbine'].firstCourse, 'cta-piru');
    assert.equal(d.rifles['bcm-ar15'].sightHeightIn['ar-irons'], 2.6, 'the AR itself is unchanged');
  } finally { server.kill(); }
  // A file with a bad record: the server stops and says why.
  const bad = JSON.parse(JSON.stringify(records)); bad[7].fields.game.defaultSight = 'utg-2-7x44';
  fs.writeFileSync(path.join(dir, 'bad.json'), JSON.stringify(bad));
  const stopped = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT + 1), APP_PASSWORD: 'open sesame', COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '', GUN_RECORDS_FILE: path.join(dir, 'bad.json') }, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  stopped.stderr.on('data', (c) => { err += c; });
  const code = await new Promise((r) => stopped.on('exit', r));
  assert.notEqual(code, 0);
  assert.match(err, /gun 'test-carbine': defaultSight 'utg-2-7x44' is not one of its sights: ar-irons/);
  fs.rmSync(dir, { recursive: true, force: true });
});
