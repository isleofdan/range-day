'use strict';
// range-day-fifteen: the rifle set read from Dan's gun records in the Spine.
//
// The Spine's private listener answers GET <SPINE_GUNS_URL> (in fly.toml:
// http://spine-dan.internal:8080/internal/records?type=gun, open only to
// callers on Dan's Fly private network, no token) with { items, state }, every
// `gun` record whole. The items go through lib/guns.js's fromRecords, the one
// path every rifle takes; a record with no game section (a pistol) is counted
// and skipped.
//
// When a read fails or its set is not accepted (no answer within the limit, a
// refusal, an empty list, an answer that is not JSON, a record the check
// refuses), the game keeps the last whole set it accepted from the Spine; when
// it has none yet, the whole set comes from data/rifles.json. Never a mix of
// the two within one set. The reason is kept for /alive/guns.
//
// The server reads once before it starts listening and again every 10 minutes.

const upstream = require('./upstream');
const guns = require('./guns');

const LIMIT_MS = 5000;
const EVERY_MS = 10 * 60 * 1000;
const SERVICE = 'Spine';

// Two values equal whatever the order of their objects' keys (the Spine keeps
// fields as JSON and answers its keys sorted); lists keep their order.
function same(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
  const ka = Object.keys(a); const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
}

// The game ids whose Spine game section is not the file's entry (less its name),
// with any rifle the file has and the Spine lacks, or the other way round.
function differences(items, raw) {
  const file = Object.fromEntries(Object.entries(raw.rifles).filter(([id]) => !id.startsWith('_')));
  const out = [];
  const seen = new Set();
  for (const r of items) {
    const f = r && r.fields;
    if (!f || f.game == null) continue;
    const id = f.gameId;
    seen.add(id);
    if (!file[id]) { out.push(`${id} (not in data/rifles.json)`); continue; }
    const { name, ...game } = file[id];
    if (!same(f.game, game) || r.name !== name) out.push(id);
  }
  for (const id of Object.keys(file)) if (!seen.has(id)) out.push(`${id} (not in the Spine)`);
  return out;
}

const iso = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z');

// One reader: the set it serves now and what /alive/guns says about it.
//   url: SPINE_GUNS_URL, or empty for the file alone (tests, local runs)
//   raw: lib/data.load().raw
//   onSet(rifles): called whenever the set served changes
function reader({ url, raw, onSet = () => {}, limitMs = LIMIT_MS, everyMs = EVERY_MS }) {
  const fileSet = () => guns.fromFiles(raw);
  const st = {
    from: 'file',            // 'spine' once a set from the Spine is accepted
    rifles: null,
    accepted: null,          // { rifles, records, inGame, notModeled, ms, at, differs }
    lastTry: null,           // { at, ms, ok, reason }
  };

  function serve(rifles, from) { st.rifles = rifles; st.from = from; onSet(rifles); }

  async function readOnce() {
    const started = Date.now();
    const at = new Date();
    const fail = (reason) => {
      st.lastTry = { at, ms: Date.now() - started, ok: false, reason };
      if (!st.accepted && !st.rifles) serve(fileSet(), 'file');
      return false;
    };
    let res;
    try {
      res = await upstream.call(SERVICE, url, { signal: AbortSignal.timeout(limitMs), headers: { accept: 'application/json' } });
    } catch (e) {
      const why = e.name === 'TimeoutError' || e.name === 'AbortError' ? `no answer within ${limitMs} ms` : `no answer: ${e.cause?.code || e.cause?.message || e.message}`;
      if (e.name === 'TimeoutError' || e.name === 'AbortError') upstream.record(SERVICE, null, why);
      return fail(why);
    }
    let text;
    try { text = await res.text(); } catch (e) {
      const why = e.name === 'TimeoutError' || e.name === 'AbortError' ? `no whole answer within ${limitMs} ms` : `the answer broke off: ${e.message}`;
      upstream.record(SERVICE, res.status, why);
      return fail(why);
    }
    if (!res.ok) return fail(`the Spine answered ${res.status}: ${text.slice(0, 200).replace(/\s+/g, ' ').trim() || res.statusText}`);
    let body;
    try { body = JSON.parse(text); } catch {
      const why = `the Spine's answer is not JSON: ${text.slice(0, 80).replace(/\s+/g, ' ').trim()}`;
      upstream.record(SERVICE, res.status, why);
      return fail(why);
    }
    const items = body && body.items;
    const count = {};
    let rifles;
    try {
      rifles = guns.fromRecords(items, raw, count);
    } catch (e) {
      const why = e instanceof guns.RecordError ? e.message : `the records could not be read: ${e.message}`;
      upstream.record(SERVICE, res.status, why);
      return fail(why);
    }
    const ms = Date.now() - started;
    st.accepted = { rifles, ...count, ms, at, differs: differences(items, raw) };
    st.lastTry = { at, ms, ok: true, reason: null };
    serve(rifles, 'spine');
    return true;
  }

  async function start() {
    if (!url) { serve(fileSet(), 'file'); return; }
    await readOnce();
  }

  let timer = null;
  function every() {
    if (!url || timer) return;
    timer = setInterval(() => { readOnce().catch(() => {}); }, everyMs);
    timer.unref();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }

  // The one line /alive/guns answers: where the set came from, how many records, how
  // many in the game and not modeled, how long the read took, when it was read, and the
  // ids whose Spine game section differs from data/rifles.json; or, fallen back, the
  // file and the reason. No figure of any gun.
  function line() {
    if (!url) return 'guns from data/rifles.json: SPINE_GUNS_URL is not set, so the Spine is not read';
    const a = st.accepted; const t = st.lastTry;
    if (a) {
      let s = `guns from the Spine: ${a.records} records, ${a.inGame} in the game, ${a.notModeled} not modeled · read in ${a.ms} ms (limit ${limitMs} ms) at ${iso(a.at)} · differs from data/rifles.json: ${a.differs.length ? a.differs.join(', ') : 'none'}`;
      if (t && !t.ok) s += ` · the last read, at ${iso(t.at)}, failed after ${t.ms} ms: ${t.reason}; keeping the set read at ${iso(a.at)}`;
      return s;
    }
    if (t) return `guns from data/rifles.json, fell back: the Spine read at ${iso(t.at)} failed after ${t.ms} ms: ${t.reason}`;
    return 'guns from data/rifles.json: the Spine has not been read yet';
  }

  return { start, readOnce, every, stop, line, state: () => st };
}

module.exports = { reader, differences, same, LIMIT_MS, EVERY_MS };
