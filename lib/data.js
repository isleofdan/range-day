'use strict';
// Loads the game's data files (data/*.json) and checks the sourcing rule:
// every figure in the game's data is {value, source: {url, read}} or
// {value, estimate: "<its basis>"}. A bare number is refused at load, so a
// figure from recollection cannot slip in. Also hands the screens a flat
// copy with the values only (flatten), since a screen needs the numbers,
// not the citations.

const fs = require('node:fs');
const path = require('node:path');

const DIR = path.join(__dirname, '..', 'data');
const FILES = ['loads', 'rifles', 'sights', 'courses', 'weather', 'physics', 'look', 'terrain', 'spotting'];

function isFigure(v) {
  return v && typeof v === 'object' && !Array.isArray(v) && 'value' in v;
}

// Walks a data object; every number must sit inside a figure that carries
// a source or an estimate. Returns the list of bad paths.
function check(node, at = '') {
  const bad = [];
  if (typeof node === 'number') { bad.push(`${at}: a bare number; wrap it as {value, source} or {value, estimate}`); return bad; }
  if (Array.isArray(node)) { node.forEach((x, i) => bad.push(...check(x, `${at}[${i}]`))); return bad; }
  if (node && typeof node === 'object') {
    if (isFigure(node)) {
      const hasSource = node.source && typeof node.source.url === 'string' && typeof node.source.read === 'string';
      const hasEstimate = typeof node.estimate === 'string' && node.estimate.length > 10;
      if (!hasSource && !hasEstimate) bad.push(`${at}: a figure with neither a source {url, read} nor an estimate with its basis`);
      return bad;
    }
    for (const [k, v] of Object.entries(node)) bad.push(...check(v, at ? `${at}.${k}` : k));
  }
  return bad;
}

// Figures become their values; everything else is copied.
function flatten(node) {
  if (Array.isArray(node)) return node.map(flatten);
  if (node && typeof node === 'object') {
    if (isFigure(node)) return node.value;
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = flatten(v);
    return out;
  }
  return node;
}

function load() {
  const raw = {};
  for (const f of FILES) raw[f] = JSON.parse(fs.readFileSync(path.join(DIR, `${f}.json`), 'utf8'));
  const problems = [];
  for (const f of FILES) {
    // Strings that explain (name, notes, model names) are free; numbers are not.
    problems.push(...check(raw[f], f));
  }
  return { raw, flat: flatten(raw), problems };
}

module.exports = { load, check, flatten, FILES, DIR };
