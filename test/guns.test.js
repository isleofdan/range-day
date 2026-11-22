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
  // range-day-thirteen: each rifle also offers the scope collection's scopes it can carry, after its own sights; apart from those
  // (`collection`, the longer `sights`, their heights in `sightHeightIn`, held by the test below) every figure is the file's.
  for (const id of ids) {
    const { collection, ...rest } = set[id];
    const own = { ...rest, sights: rest.sights.filter((x) => !collection.includes(x)), sightHeightIn: Object.fromEntries(Object.entries(rest.sightHeightIn).filter(([x]) => !collection.includes(x))) };
    assert.deepStrictEqual(own, flat.rifles[id], id);
    assert.deepEqual(rest.sights.slice(0, flat.rifles[id].sights.length), flat.rifles[id].sights, `${id}: its own sights first, in their order`);
  }
  assert.equal(set['molot-vepr-54r'].firstCourse, 'cta-piru');
  // range-day-twelve: the 5.45 rifle's two sights each carry the 5.45's own leaf as their own, so it names no leaf table (sightLeaf is still checked below)
  assert.equal(set['ak-545'].sightLeaf, undefined);
  for (const s of set['ak-545'].sights.filter((x) => !set['ak-545'].collection.includes(x))) assert.deepEqual(flat.sights[s].leaf.settingsMeters, flat.sights['ak-irons'].leaf545.settingsMeters, s);
});

test('a bare number, an unknown sight, a defaultSight it does not carry, a missing sight height: each refused, naming the gun, the fault and the valid values', () => {
  const base = guns.toRecord('bcm-ar15', raw.rifles['bcm-ar15']);
  const broken = (change) => { const r = JSON.parse(JSON.stringify(base)); r.id = 'x'; change(r.fields.game); return r; };
  const refuse = (r) => { try { guns.fromRecords([r], raw); } catch (e) { assert.ok(e instanceof guns.RecordError, e.message); return e.message; } assert.fail('accepted a bad record'); };
  const messages = [
    refuse(broken((g) => { g.barrelIn = 16; })),
    refuse(broken((g) => { g.sights = ['troy-battlesights', 'foo']; g.sightHeightIn.foo = { value: 1, estimate: 'a basis long enough to count here' }; })),
    refuse(broken((g) => { g.defaultSight = 'pa-md25'; })),
    refuse(broken((g) => { delete g.sightHeightIn['troy-battlesights']; })),
  ];
  console.log('  ' + messages.join('\n  '));
  assert.match(messages[0], /^gun 'x': game\.barrelIn: a bare number; wrap it as \{value, source\} or \{value, estimate\}$/);
  assert.match(messages[1], /^gun 'x': sight 'foo' is not in the game's data: ar-irons, tavor-irons, ak-irons, vepr-irons, rem-irons, pa-md25, pa-magnifier, pa-3x-acss, utg-2-7x44, utg-bugbuster-3-9x32, troy-battlesights, fab-flipup, seeall-gen1, ak762-kns-peep, ak545-ball, ak545-xs, trijicon-acog-ta31f, trijicon-acog-ta31f-g, vortex-razor-1-10, leupold-mark5hd-5-25$/); // range-day-thirteen: the collection scopes are in the data (range-day-fourteen: and the green ACOG)
  assert.match(messages[2], /^gun 'x': defaultSight 'pa-md25' is not one of its sights: troy-battlesights$/);
  assert.match(messages[3], /^gun 'x': no sightHeightIn for sight 'troy-battlesights'; it carries: troy-battlesights$/);
  // And the rest of the shape: an unknown load, a wrong caliber, a course that does not exist, a leaf table the sight lacks, a duplicate.
  assert.match(refuse(broken((g) => { g.loads = ['imi-m193', 'nope']; })), /load 'nope' is not in the game's data: /);
  assert.match(refuse(broken((g) => { g.loads = ['sb-124']; })), /load 'sb-124' is 7.62x39, not the gun's 5.56x45/);
  assert.match(refuse(broken((g) => { g.firstCourse = 'moon'; })), /firstCourse 'moon' is not a course: cta-piru, angeles-sylmar/);
  assert.match(refuse(broken((g) => { g.sightLeaf = { 'troy-battlesights': 'leaf' }; })), /sightLeaf for 'troy-battlesights' names 'leaf', which is not a leaf table on that sight: it has none/);
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
  eighth.fields.game.sightHeightIn['troy-battlesights'] = { value: 3.4, estimate: 'a made-up height for the test, higher than the AR\'s own' };
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
    assert.equal(d.rifles['test-carbine'].sightHeightIn['troy-battlesights'], 3.4);
    assert.equal(d.rifles['test-carbine'].firstCourse, 'cta-piru');
    assert.equal(d.rifles['bcm-ar15'].sightHeightIn['troy-battlesights'], 2.6, 'the AR itself is unchanged');
  } finally { server.kill(); }
  // A file with a bad record: the server stops and says why.
  const bad = JSON.parse(JSON.stringify(records)); bad[7].fields.game.defaultSight = 'utg-2-7x44';
  fs.writeFileSync(path.join(dir, 'bad.json'), JSON.stringify(bad));
  const stopped = spawn('node', ['server.js'], { cwd: root, env: { ...process.env, PORT: String(PORT + 1), APP_PASSWORD: 'open sesame', COOKIE_SECRET: 'x'.repeat(64), COOKIE_INSECURE: '1', SENTRY_DSN: '', GUN_RECORDS_FILE: path.join(dir, 'bad.json') }, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  stopped.stderr.on('data', (c) => { err += c; });
  const code = await new Promise((r) => stopped.on('exit', r));
  assert.notEqual(code, 0);
  assert.match(err, /gun 'test-carbine': defaultSight 'utg-2-7x44' is not one of its sights: troy-battlesights/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// range-day-thirteen: the scope collection, moved among the rifles (task items 6 and 7).
const COLLECTION = ['trijicon-acog-ta31f', 'trijicon-acog-ta31f-g', 'vortex-razor-1-10', 'leupold-mark5hd-5-25']; // range-day-fourteen: the green ACOG
test('range-day-thirteen: each rifle offers the collection\'s scopes its scope mounting takes, each at its rail\'s height over the bore plus its mount\'s; the .22 offers none; no rifle\'s opening sight or own sights change', () => {
  const set = guns.fromFiles(raw);
  const lines = [];
  for (const [id, r] of Object.entries(set)) {
    const f = flat.rifles[id];
    assert.equal(r.defaultSight, f.defaultSight, `${id}: its opening sight is unchanged`);
    for (const s of f.sights) assert.ok(r.sights.includes(s), `${id}: still offers ${s}`);
    if (f.scopeMount.rail === 'rimfire-dovetail') { assert.deepEqual(r.collection, [], `${id}: a grooved rimfire receiver takes none of the collection's mounts`); lines.push(`${id}: none (${f.scopeMount.rail})`); continue; }
    assert.deepEqual(r.collection, COLLECTION, `${id}: every collection scope, in the file's order`);
    for (const c of COLLECTION) {
      const want = Math.round((f.scopeMount.railHeightOverBoreIn + flat.sights[c].mount.centerOverRailIn) * 1000) / 1000;
      assert.equal(r.sightHeightIn[c], want, `${id} ${c}`);
      lines.push(`${id} ${c}: ${f.scopeMount.railHeightOverBoreIn} + ${flat.sights[c].mount.centerOverRailIn} = ${r.sightHeightIn[c]} in`);
    }
  }
  console.log('  ' + lines.join('\n  '));
});

test('range-day-thirteen: a bad scope mounting is refused by name: an unknown rail, no words, a rail height that puts a scope outside 1.5 to 5 in, a Picatinny rail with no height', () => {
  const base = guns.toRecord('bcm-ar15', raw.rifles['bcm-ar15']);
  const broken = (f) => { const r = JSON.parse(JSON.stringify(base)); r.id = 'x'; f(r.fields.game); return r; };
  const refuse = (r) => { try { guns.checkRecord(r, raw); } catch (e) { return e.message; } assert.fail('accepted'); };
  assert.match(refuse(broken((g) => { g.scopeMount.rail = 'weaver'; })), /^gun 'x': scopeMount.rail must be one of: picatinny, rimfire-dovetail$/);
  assert.match(refuse(broken((g) => { g.scopeMount.words = ''; })), /scopeMount needs words/);
  assert.match(refuse(broken((g) => { g.scopeMount.railHeightOverBoreIn = { value: 12, estimate: 'a slip of the finger, for the test' }; })), /the collection scope 'trijicon-acog-ta31f' would sit 13.535 in over the bore/);
  assert.match(refuse(broken((g) => { delete g.scopeMount.railHeightOverBoreIn; })), /scopeMount has no railHeightOverBoreIn/);
  assert.match(refuse(broken((g) => { g.scopeMount.railHeightOverBoreIn = 1.21; })), /a bare number/);
});

test('range-day-thirteen: the three scopes\' figures, each from its maker\'s page or manual or an estimate with its basis, as the report\'s table gives them; a collection scope without its mount, a chevron without its sizes, a drop line without its place, a tree without a figure and a crosshair without its note are refused (range-day-fourteen: the ACOG\'s and the Leupold\'s marks from the makers\' sheets)', () => {
  const S = flat.sights;
  const want = {
    'trijicon-acog-ta31f': { clickMoa: 0.4776, windageClickMoa: 0.4776, clicks: 42, zoom: { low: 4, high: 4 }, fovFtAt100: { low: 36.69, high: 36.69 }, mount: 1.535, reticle: 'chevron' },
    'trijicon-acog-ta31f-g': { clickMoa: 0.4776, windageClickMoa: 0.4776, clicks: 42, zoom: { low: 4, high: 4 }, fovFtAt100: { low: 36.69, high: 36.69 }, mount: 1.535, reticle: 'chevron' },
    'vortex-razor-1-10': { clickMoa: 0.25, windageClickMoa: 0.25, clicks: 240, zoom: { low: 1, high: 10 }, fovFtAt100: { low: 116, high: 11.7 }, mount: 1.574, reticle: 'crosshair' },
    'leupold-mark5hd-5-25': { clickMoa: 0.25, windageClickMoa: 0.25, clicks: 240, windageClicks: 120, zoom: { low: 5, high: 25 }, fovFtAt100: { low: 20.4, high: 4.2 }, mount: 1.5, reticle: 'tree' },
  };
  for (const [id, w] of Object.entries(want)) {
    const s = S[id];
    assert.equal(s.kind, 'scope'); assert.equal(s.collection, true);
    for (const k of ['clickMoa', 'windageClickMoa', 'clicks', 'windageClicks']) if (k in w) assert.equal(s[k], w[k], `${id} ${k}`);
    assert.deepEqual(s.zoom, w.zoom, id); assert.deepEqual(s.fovFtAt100, w.fovFtAt100, id);
    assert.equal(s.mount.centerOverRailIn, w.mount, id); assert.deepEqual(s.mount.fits, ['picatinny'], id);
    assert.equal(s.reticle.kind, w.reticle, id);
    // every figure of the entry carries a source with its page, or an estimate with its basis
    assert.deepEqual(data.check(raw.sights[id], id), [], id);
  }
  assert.equal(S['trijicon-acog-ta31f'].reticle.chevronBaseWidthMoa, 5.53);
  // range-day-fourteen: the chevron's height and its drop lines are Trijicon's dimension sheet's figures; the PR2-MOA's marks Leupold's sheet's
  const A = S['trijicon-acog-ta31f'].reticle, rawA = raw.sights['trijicon-acog-ta31f'].reticle;
  assert.match(rawA.chevronHeightMoa.source.url, /trijicon\.com\/.*223_Chevron_Reticle_Dimensions4x32\.pdf/, 'the chevron\'s height is the maker\'s sheet\'s');
  assert.deepEqual([A.chevronHeightMoa, A.chevronDepthMoa, A.chevronLineMoa, A.stemTopMoa, A.stemWidthMoa], [4.1, 2.0, 1.1, 4.4, 0.4]);
  assert.deepEqual(A.dropLines.map((l) => [l.meters, l.belowTipMoa, l.widthMoa, l.label || null]), [[400, 7.8, 4.2, '4'], [500, 12.6, 3.3, null], [600, 18.7, 2.8, '6'], [700, 26.4, 2.4, null], [800, 35.8, 2.1, null]]);
  assert.equal(A.marksNotDrawn, undefined, 'the ACOG\'s marks are in');
  // the TA31F-G: the same sheet's drawing, every mark the TA31F's, lit green (Dan, 22 Nov 2026: "Green Trijicon too please")
  const AG = S['trijicon-acog-ta31f-g'].reticle;
  assert.deepEqual({ ...AG, lit: undefined, litColor: undefined }, { ...A, lit: undefined, litColor: undefined }, 'the TA31F-G\'s marks are the TA31F\'s');
  assert.deepEqual([A.litColor, AG.litColor], ['red', 'green']);
  const P = S['leupold-mark5hd-5-25'].reticle;
  assert.deepEqual([P.lineMoa, P.centerDotMoa, P.openingMoa, P.breakMoa, P.hashSpacingMoa, P.shortHashMoa, P.longHashMoa, P.numberedEveryMoa, P.dotRowSmallMoa, P.dotRowLargeMoa, P.upperStem.midBarMoa, P.stemBars.everyFourMoa, P.stemBars.midMoa], [0.1, 0.2, 2.0, 0.25, 1.0, 0.5, 2.0, 4.0, 0.1, 0.2, 1.0, 2.0, 1.0]);
  for (const f of ['lineMoa', 'centerDotMoa', 'openingMoa', 'breakMoa', 'longHashMoa']) assert.match(raw.sights['leupold-mark5hd-5-25'].reticle[f].source.url, /leupold\.com\/.*FFP_PR2-MOA_Reticle_Spec_Sheet\.pdf/, f);
  assert.equal(P.marksNotDrawn, undefined, 'the Leupold\'s marks are in');
  assert.equal(typeof S['vortex-razor-1-10'].reticle.marksNotDrawn, 'string', 'the Vortex\'s drawing could not be read; its crosshair stays');
  for (const id of ['vortex-razor-1-10', 'leupold-mark5hd-5-25']) assert.equal(S[id].reticle.focalPlane, 'first', id);
  const bad = (f) => { const s = JSON.parse(JSON.stringify(raw.sights)); f(s); return data.checkSights(s); };
  assert.match(bad((s) => { delete s['vortex-razor-1-10'].mount; }).join(), /sights.vortex-razor-1-10: a scope of the collection needs mount.name, mount.fits and mount.centerOverRailIn/);
  assert.match(bad((s) => { delete s['trijicon-acog-ta31f'].reticle.chevronHeightMoa; }).join(), /a chevron needs chevronBaseWidthMoa and chevronHeightMoa/);
  assert.match(bad((s) => { delete s['vortex-razor-1-10'].reticle.marksNotDrawn; }).join(), /a crosshair says in marksNotDrawn/);
  assert.match(bad((s) => { s['trijicon-acog-ta31f-g'].reticle.litColor = 'blue'; }).join(), /names its lit colour, litColor 'red' or 'green'/);
  assert.match(bad((s) => { delete s['leupold-mark5hd-5-25'].reticle.openingMoa; }).join(), /a tree reticle needs openingMoa/);
  assert.match(bad((s) => { delete s['trijicon-acog-ta31f'].reticle.dropLines[2].belowTipMoa; }).join(), /dropLines\[2\]: each drop line needs belowTipMoa/);
});
