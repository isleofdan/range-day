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
// A record (range-day-fifteen): { id, name, fields: { gameId?, kind, caliber,
// whose, game?, notes? } }. kind is 'rifle' or 'pistol'; caliber a string, or
// null when Dan has not said; whose "Dan's". The game keys a rifle by
// fields.gameId (the id in data/rifles.json that saved zeroes, logs and days
// are keyed by), never by the record's own id, which the Spine derives from
// the record's type and name. A record with no game section is a gun the game
// does not model: skipped and counted, never refused. A record with a game
// section and no gameId is refused by name. Every other section (story,
// library, mine, measured) is ignored and never written anywhere.
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
const OPTIONAL = ['sightLeaf', 'scopeMount', 'expansion'];
// The kinds of scope rail a rifle can have (range-day-thirteen): every mount of the scope collection clamps a Picatinny rail; a
// rimfire's grooved receiver takes none of them.
const RAILS = ['picatinny', 'rimfire-dovetail'];
// A collection scope's height over the bore on a rifle must fall in this band, in inches: a figure outside it is a typing slip.
const COLLECTION_HEIGHT_IN = [1.5, 5];

class RecordError extends Error {}

const list = (xs) => xs.join(', ');

// Checks one record against the game's data (raw: the loaded data files
// with their sources, so the figures can be checked). Returns the flat
// rifle entry the screens use, or throws a RecordError naming the gun.
// The kinds of gun a record can be.
const KINDS = ['rifle', 'pistol'];
const ID = /^[a-z][a-z0-9-]*$/;

// The name a refusal gives a gun: its game id when it has one, else its name, else the record's own id.
function whoIs(record) {
  const f = record && record.fields;
  if (f && typeof f.gameId === 'string' && f.gameId) return f.gameId;
  if (record && typeof record.name === 'string' && record.name.trim()) return record.name;
  return String(record && record.id);
}

function checkRecord(record, raw) {
  const who = `gun '${whoIs(record)}'`;
  const fail = (msg) => { throw new RecordError(`${who}: ${msg}`); };
  if (!record || typeof record !== 'object') fail('is not a record object');
  if (typeof record.name !== 'string' || !record.name.trim()) fail('has no name');
  const f = record.fields;
  if (!f || typeof f !== 'object') fail('has no fields');
  const game = f.game;
  if (!game || typeof game !== 'object') fail('has no fields.game section');
  if (f.gameId == null) fail(`has a game section but no fields.gameId; it needs the rifle's id in data/rifles.json, one of: ${list(Object.keys(raw.rifles).filter((k) => !k.startsWith('_')))}`);
  if (typeof f.gameId !== 'string' || !ID.test(f.gameId)) fail(`gameId ${JSON.stringify(f.gameId)} must be lowercase letters, digits and hyphens`);
  if (!KINDS.includes(f.kind)) fail(`kind ${JSON.stringify(f.kind)} is not one of: ${list(KINDS)}`);
  if (f.caliber !== null && typeof f.caliber !== 'string') fail('caliber must be a string such as "5.56x45", or null when not known');
  if (typeof f.whose !== 'string' || !f.whose.trim()) fail('whose must say whose gun it is, such as "Dan\'s"');
  for (const k of REQUIRED) if (!(k in game)) fail(`game section lacks '${k}'; it needs: ${list(REQUIRED)}`);
  for (const k of Object.keys(game)) if (!REQUIRED.includes(k) && !OPTIONAL.includes(k)) fail(`game section has an unknown field '${k}'; the fields are: ${list([...REQUIRED, ...OPTIONAL])}`);
  // Every number a sourced figure or an estimate.
  const problems = data.check(game, 'game');
  if (problems.length) fail(problems[0]);
  const sightIds = Object.keys(raw.sights).filter((k) => !k.startsWith('_'));
  const loadIds = Object.keys(raw.loads).filter((k) => !k.startsWith('_'));
  const courseIds = Object.keys(raw.courses).filter((k) => !k.startsWith('_'));
  if (typeof game.caliber !== 'string') fail('caliber must be a string such as "5.56x45"');
  if (f.caliber !== game.caliber) fail(`the record's caliber ${JSON.stringify(f.caliber)} is not its game section's ${JSON.stringify(game.caliber)}`);
  if (typeof game.playable !== 'boolean') fail('playable must be true or false');
  // range-day-nineteen: a rifle sold with no sights of its own (the expansion's Tikka, for one) has an empty list and aims
  // through the scope collection; it needs a rail that takes the collection, checked below with its defaultSight.
  if (!Array.isArray(game.sights)) fail('sights must be a list of sight ids');
  if (!game.sights.length && !(game.scopeMount && game.scopeMount.rail === 'picatinny')) fail('sights is empty: a rifle with no sights of its own needs a scopeMount whose rail takes the scope collection (picatinny)');
  for (const s of game.sights) if (!raw.sights[s]) fail(`sight '${s}' is not in the game's data: ${list(sightIds)}`);
  if (!Array.isArray(game.loads) || !game.loads.length) fail('loads must be a list of load ids');
  for (const l of game.loads) if (!raw.loads[l]) fail(`load '${l}' is not in the game's data: ${list(loadIds)}`);
  for (const l of game.loads) {
    const cal = data.flatten(raw.loads[l]).caliber;
    if (cal !== game.caliber) fail(`load '${l}' is ${cal}, not the gun's ${game.caliber}`);
  }
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
  // The scope collection (range-day-thirteen): the scopes marked `collection` in data/sights.json move among the rifles. A rifle
  // offers each one whose mount takes its rail, after its own sights; the scope's height over the bore on it is the rail's height
  // plus the mount's (each a sourced figure or an estimate, checked above and in data/sights.json), checked against a band here.
  const collection = [];
  const heights = {};
  if (game.scopeMount != null) {
    const m = game.scopeMount;
    if (typeof m !== 'object' || !RAILS.includes(m.rail)) fail(`scopeMount.rail must be one of: ${list(RAILS)}`);
    if (typeof m.words !== 'string' || !m.words.trim()) fail('scopeMount needs words: how a scope is mounted on it');
    for (const [id, sRaw] of Object.entries(raw.sights)) {
      if (id.startsWith('_') || !sRaw.collection || game.sights.includes(id)) continue;
      const s = data.flatten(sRaw);
      if (!s.mount || !Array.isArray(s.mount.fits) || !s.mount.fits.includes(m.rail)) continue;
      if (!m.railHeightOverBoreIn) fail(`scopeMount has no railHeightOverBoreIn, so the collection scope '${id}' it takes has no height over the bore`);
      const h = Math.round((data.flatten(m.railHeightOverBoreIn) + s.mount.centerOverRailIn) * 1000) / 1000;
      if (!(h >= COLLECTION_HEIGHT_IN[0] && h <= COLLECTION_HEIGHT_IN[1])) fail(`the collection scope '${id}' would sit ${h} in over the bore (rail ${data.flatten(m.railHeightOverBoreIn)} + mount ${s.mount.centerOverRailIn}), outside ${COLLECTION_HEIGHT_IN.join(' to ')} in`);
      collection.push(id); heights[id] = h;
    }
  }
  // defaultSight is one of its own sights, or (range-day-nineteen) a collection scope it carries.
  if (!game.sights.includes(game.defaultSight) && !collection.includes(game.defaultSight)) fail(`defaultSight '${game.defaultSight}' is not one of its sights: ${list([...game.sights, ...collection])}`);
  if (game.expansion != null && game.expansion !== true) fail('expansion must be true, or left out');
  const flat = data.flatten(game);
  flat.name = record.name;
  // What the screens read: the rifle's own sights, then the collection's scopes it carries (`collection` names which), each with
  // its height over the bore in sightHeightIn, so every screen treats a collection scope as a sight of the rifle.
  flat.collection = collection;
  flat.sights = [...flat.sights, ...collection];
  flat.sightHeightIn = { ...flat.sightHeightIn, ...heights };
  return flat;
}

// A list of records in, the rifle set out: an object keyed by each record's
// fields.gameId, in the records' order, each entry flat (figures as their
// values) as the screens read it from /api/data. raw is the game's own data
// (lib/data.load().raw). A record with no game section is a gun the game does
// not model: skipped and counted, never refused. count, when given, is filled
// with { records, inGame, notModeled }.
function fromRecords(records, raw, count) {
  if (!Array.isArray(records)) throw new RecordError(`gun records: expected a list of records, got ${records === null ? 'null' : typeof records}`);
  if (!records.length) throw new RecordError('gun records: the list is empty; the game needs at least one gun');
  const set = {};
  let notModeled = 0;
  for (const r of records) {
    if (r && typeof r === 'object' && (!r.fields || typeof r.fields !== 'object' || r.fields.game == null)) { notModeled += 1; continue; }
    const flat = checkRecord(r, raw);
    const id = r.fields.gameId;
    if (set[id]) throw new RecordError(`gun '${id}': appears twice in the records`);
    set[id] = flat;
  }
  if (!Object.keys(set).length) throw new RecordError(`gun records: none of the ${records.length} records has a game section; the game needs at least one gun it models`);
  if (!Object.values(set).some((g) => g.playable)) throw new RecordError('gun records: no gun is playable; at least one needs playable: true');
  if (count) Object.assign(count, { records: records.length, inGame: Object.keys(set).length, notModeled });
  return set;
}

// data/rifles.json, entry by entry, wrapped as records and checked the same way.
function fromFiles(raw) {
  const r = raw || data.load().raw;
  const records = Object.entries(r.rifles).filter(([id]) => !id.startsWith('_')).map(([id, entry]) => toRecord(id, entry));
  return fromRecords(records, r);
}

// One rifles.json entry as a gun record (the shape the Spine keeps): its game
// id, a rifle, the entry's caliber, whose it is, and the entry itself (less its
// name, which is the record's) as the game section. range-day-nineteen: an
// entry marked `expansion` is one of the game's expansion rifles, owned by no one,
// and its record says so in `whose`.
const EXPANSION_WHOSE = 'no one\'s: one of the game\'s expansion rifles';
function toRecord(id, entry) {
  const { name, ...game } = entry;
  return { id, name, fields: { gameId: id, kind: 'rifle', caliber: entry.caliber, whose: entry.expansion ? EXPANSION_WHOSE : "Dan's", game } };
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

module.exports = { fromRecords, fromFiles, toRecord, checkRecord, load, RecordError, REQUIRED, OPTIONAL, RAILS, COLLECTION_HEIGHT_IN, KINDS, EXPANSION_WHOSE };
