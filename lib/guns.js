'use strict';
// The seam between the game and its gun records. A gun record is one
// record per gun, kept outside this repository by a later build; the game
// reads only its `game` section, which is, field for field, one entry of
// data/rifles.json. Today the records come from that file (fromFiles); when
// the environment variable GUN_RECORDS_FILE names a JSON file of records,
// the server reads them from there instead (fromRecords). One path either
// way: fromFiles wraps each entry as a record and passes it through
// fromRecords, so the same check runs on both.
//
// A record: { id, name, fields: { game: {...} } }. Every other section
// (story, library, mine, measured) is ignored and never written anywhere.
//
// A bad record is refused by name, with the fault and the valid values,
// because a later build will feed records through here and needs to know
// what to fix: "gun 'x': defaultSight 'foo' is not one of its sights: a, b".

const path = require('node:path');
const fs = require('node:fs');
const data = require('./data');

// The fields a game section must carry. Each figure follows the data
// file's rule: {value, source: {url, read}} or {value, estimate: "<basis>"}.
const REQUIRED = ['caliber', 'playable', 'barrelIn', 'sightHeightIn', 'boreOffsetMoa', 'recoilFactor', 'sights', 'defaultSight', 'loads', 'firstCourse'];
const OPTIONAL = ['sightLeaf'];

class RecordError extends Error {}

const list = (xs) => xs.join(', ');

// Checks one record against the game's data (raw: the loaded data files
// with their sources, so the figures can be checked). Returns the flat
// rifle entry the screens use, or throws a RecordError naming the gun.
function checkRecord(record, raw) {
  const who = `gun '${record && record.id}'`;
  const fail = (msg) => { throw new RecordError(`${who}: ${msg}`); };
  if (!record || typeof record !== 'object') fail('is not a record object');
  if (typeof record.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(record.id)) fail(`id ${JSON.stringify(record.id)} must be lowercase letters, digits and hyphens`);
  if (typeof record.name !== 'string' || !record.name.trim()) fail('has no name');
  const game = record.fields && record.fields.game;
  if (!game || typeof game !== 'object') fail('has no fields.game section');
  for (const k of REQUIRED) if (!(k in game)) fail(`game section lacks '${k}'; it needs: ${list(REQUIRED)}`);
  for (const k of Object.keys(game)) if (!REQUIRED.includes(k) && !OPTIONAL.includes(k)) fail(`game section has an unknown field '${k}'; the fields are: ${list([...REQUIRED, ...OPTIONAL])}`);
  // Every number a sourced figure or an estimate.
  const problems = data.check(game, 'game');
  if (problems.length) fail(problems[0]);
  const sightIds = Object.keys(raw.sights).filter((k) => !k.startsWith('_'));
  const loadIds = Object.keys(raw.loads).filter((k) => !k.startsWith('_'));
  const courseIds = Object.keys(raw.courses).filter((k) => !k.startsWith('_'));
  if (typeof game.caliber !== 'string') fail('caliber must be a string such as "5.56x45"');
  if (typeof game.playable !== 'boolean') fail('playable must be true or false');
  if (!Array.isArray(game.sights) || !game.sights.length) fail('sights must be a list of sight ids');
  for (const s of game.sights) if (!raw.sights[s]) fail(`sight '${s}' is not in the game's data: ${list(sightIds)}`);
  if (!Array.isArray(game.loads) || !game.loads.length) fail('loads must be a list of load ids');
  for (const l of game.loads) if (!raw.loads[l]) fail(`load '${l}' is not in the game's data: ${list(loadIds)}`);
  for (const l of game.loads) {
    const cal = data.flatten(raw.loads[l]).caliber;
    if (cal !== game.caliber) fail(`load '${l}' is ${cal}, not the gun's ${game.caliber}`);
  }
  if (!game.sights.includes(game.defaultSight)) fail(`defaultSight '${game.defaultSight}' is not one of its sights: ${list(game.sights)}`);
  if (!game.sightHeightIn || typeof game.sightHeightIn !== 'object') fail('sightHeightIn must be an object of sight id to figure');
  for (const s of game.sights) if (!(s in game.sightHeightIn)) fail(`no sightHeightIn for sight '${s}'; it carries: ${list(game.sights)}`);
  for (const s of Object.keys(game.sightHeightIn)) if (!game.sights.includes(s)) fail(`sightHeightIn names '${s}', which is not one of its sights: ${list(game.sights)}`);
  if (!game.boreOffsetMoa || !('up' in game.boreOffsetMoa) || !('right' in game.boreOffsetMoa)) fail('boreOffsetMoa needs {up, right}');
  if (!raw.courses[game.firstCourse]) fail(`firstCourse '${game.firstCourse}' is not a course: ${list(courseIds)}`);
  if (game.sightLeaf != null) {
    if (typeof game.sightLeaf !== 'object') fail('sightLeaf must be an object of sight id to the name of a leaf table on that sight');
    for (const [s, key] of Object.entries(game.sightLeaf)) {
      if (!game.sights.includes(s)) fail(`sightLeaf names '${s}', which is not one of its sights: ${list(game.sights)}`);
      const tables = Object.keys(raw.sights[s]).filter((k) => /^leaf/.test(k));
      if (!tables.includes(key)) fail(`sightLeaf for '${s}' names '${key}', which is not a leaf table on that sight: ${tables.length ? list(tables) : 'it has none'}`);
    }
  }
  const flat = data.flatten(game);
  flat.name = record.name;
  return flat;
}

// A list of records in, the rifle set out: an object keyed by id, in the
// records' order, each entry flat (figures as their values) as the screens
// read it from /api/data. raw is the game's own data (lib/data.load().raw).
function fromRecords(records, raw) {
  if (!Array.isArray(records)) throw new RecordError(`gun records: expected a list of records, got ${records === null ? 'null' : typeof records}`);
  if (!records.length) throw new RecordError('gun records: the list is empty; the game needs at least one gun');
  const set = {};
  for (const r of records) {
    const flat = checkRecord(r, raw);
    if (set[r.id]) throw new RecordError(`gun '${r.id}': appears twice in the records`);
    set[r.id] = flat;
  }
  if (!Object.values(set).some((g) => g.playable)) throw new RecordError('gun records: no gun is playable; at least one needs playable: true');
  return set;
}

// data/rifles.json, entry by entry, wrapped as records and checked the same way.
function fromFiles(raw) {
  const r = raw || data.load().raw;
  const records = Object.entries(r.rifles).filter(([id]) => !id.startsWith('_')).map(([id, entry]) => toRecord(id, entry));
  return fromRecords(records, r);
}

// One rifles.json entry as a gun record (the shape the later build keeps).
function toRecord(id, entry) {
  const { name, ...game } = entry;
  return { id, name, fields: { game } };
}

// The rifle set the server serves: from the file GUN_RECORDS_FILE names,
// else from data/rifles.json. Throws with the first refusal's message.
function load(raw, env = process.env) {
  const file = env.GUN_RECORDS_FILE;
  if (!file) return { rifles: fromFiles(raw), from: 'data/rifles.json' };
  const full = path.resolve(file);
  let parsed;
  try { parsed = JSON.parse(fs.readFileSync(full, 'utf8')); } catch (e) { throw new RecordError(`GUN_RECORDS_FILE ${full}: ${e.message}`); }
  const records = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.records) ? parsed.records : parsed;
  return { rifles: fromRecords(records, raw), from: full };
}

module.exports = { fromRecords, fromFiles, toRecord, checkRecord, load, RecordError, REQUIRED, OPTIONAL };
