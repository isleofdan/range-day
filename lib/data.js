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

// Each sight's kind, and what a screen needs to draw that kind (range-day-twelve).
// iron: a front post (or a ball on a stem) and either a rear ring or a rear
// notch; dot: a red dot; magnifier: a glass behind a dot; scope: a magnified
// tube with a reticle; seeall: the SeeAll Open Sight, a triangle whose tip is
// the aim point over a glowing field, no post and no ring.
const KINDS = {
  iron: ['clickMoa', 'windageClickMoa', 'clicks', 'frontPostMoa', 'apertureMoa'],
  dot: ['clickMoa', 'windageClickMoa', 'clicks', 'dotMoa'],
  magnifier: ['magnification'],
  scope: ['clickMoa', 'windageClickMoa', 'clicks', 'reticle'],
  seeall: ['clickMoa', 'windageClickMoa', 'clicks', 'reticle.triangleWidthMoa', 'reticle.triangleHeightMoa', 'reticle.lineBelowTipMoa', 'reticle.fieldWidthMoa'],
};
const TREE = ['lineMoa', 'centerDotMoa', 'openingMoa', 'breakMoa', 'hashSpacingMoa', 'shortHashMoa', 'longHashMoa', 'numberedEveryMoa', 'mainLineToMoa', 'upperStem.toMoa', 'upperStem.midBarMoa', 'stemBars.everyFourMoa', 'stemBars.midMoa', 'holdoverEveryMoa', 'holdoverToMoa', 'holdoverHalfWidthPerMoa', 'dotRowSmallMoa', 'dotRowLargeMoa', 'stemToMoa', 'labelHeightMoa'];
const BDC = ['centerDotMoa', 'circleInnerMoa', 'circleOuterMoa', 'circleGapDeg', 'lineMoa', 'fineLineToMoa', 'postFromMoa', 'postMoa', 'postMarkMoa', 'postMarkLengthMoa', 'hashSpacingMoa', 'shortHashMoa', 'longHashMoa', 'numbers', 'dropMarks', 'dropLongMoa', 'dropShortMoa', 'ladderFromMoa', 'ladderToMoa', 'ladderMarkMoa', 'ladderNumberedMoa', 'ladderNumbers', 'lowerPostFromMoa', 'labelHeightMoa', 'litColor'];
function checkSights(sights) {
  const bad = [];
  const at = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);
  for (const [id, s] of Object.entries(sights)) {
    if (id.startsWith('_')) continue;
    if (!KINDS[s.kind]) { bad.push(`sights.${id}.kind: '${s.kind}' is not a kind of sight: ${Object.keys(KINDS).join(', ')}`); continue; }
    for (const p of KINDS[s.kind]) if (at(s, p) === undefined) bad.push(`sights.${id}: a sight of kind '${s.kind}' needs ${p}`);
    if (s.kind === 'seeall' && ('frontPostMoa' in s || 'apertureMoa' in s)) bad.push(`sights.${id}: a SeeAll has no front post and no ring`);
    if (s.kind === 'iron' && s.frontBead && !s.stemWidthMoa) bad.push(`sights.${id}: a ball or bead front needs stemWidthMoa`);
    if (s.apertures && (!Array.isArray(s.apertures) || s.apertures.some((a) => !a || !a.name || a.apertureMoa === undefined))) bad.push(`sights.${id}.apertures: each rear peep needs its name and apertureMoa`);
    // range-day-thirteen: a scope of the collection names its mount, which rails it fits and its center's height over the rail;
    // a chevron reticle its base's width and its height; a crosshair says which of the maker's marks are not drawn.
    if (s.collection && (s.kind !== 'scope' || !s.mount || !s.mount.name || !Array.isArray(s.mount.fits) || !s.mount.fits.length || !s.mount.centerOverRailIn)) bad.push(`sights.${id}: a scope of the collection needs mount.name, mount.fits and mount.centerOverRailIn`);
    if (s.reticle && s.reticle.kind === 'chevron' && (!s.reticle.chevronBaseWidthMoa || !s.reticle.chevronHeightMoa)) bad.push(`sights.${id}.reticle: a chevron needs chevronBaseWidthMoa and chevronHeightMoa`);
    // range-day-fourteen: a tree reticle (the PR2-MOA) needs every figure its drawing is built from; a chevron's drop lines each
    // their place and width, with the chevron's depth, line, post and the lines' thickness.
    // range-day-fourteen-c: the EBR-9 BDC (the Vortex) needs every figure its drawing is built from, each drop mark its place
    if (s.reticle && s.reticle.kind === 'bdc') {
      for (const p of BDC) if (s.reticle[p] === undefined) bad.push(`sights.${id}.reticle: a bdc reticle needs ${p}`);
      (s.reticle.dropMarks || []).forEach((m, i) => { if (!m || m.belowMoa === undefined) bad.push(`sights.${id}.reticle.dropMarks[${i}]: each drop mark needs belowMoa`); });
    }
    if (s.reticle && s.reticle.kind === 'tree') for (const p of TREE) if (at(s.reticle, p) === undefined) bad.push(`sights.${id}.reticle: a tree reticle needs ${p}`);
    if (s.reticle && s.reticle.kind === 'chevron' && s.reticle.dropLines) {
      for (const p of ['chevronDepthMoa', 'chevronLineMoa', 'stemTopMoa', 'stemWidthMoa', 'dropLineThicknessMoa', 'labelHeightMoa']) if (s.reticle[p] === undefined) bad.push(`sights.${id}.reticle: a chevron with drop lines needs ${p}`);
      if (!['red', 'green'].includes(s.reticle.litColor)) bad.push(`sights.${id}.reticle: a chevron with drop lines names its lit colour, litColor 'red' or 'green' (its maker's sheet)`);
      s.reticle.dropLines.forEach((l, i) => { for (const p of ['meters', 'belowTipMoa', 'widthMoa']) if (!l || l[p] === undefined) bad.push(`sights.${id}.reticle.dropLines[${i}]: each drop line needs ${p}`); });
    }
    if (s.reticle && s.reticle.kind === 'crosshair' && typeof s.reticle.marksNotDrawn !== 'string') bad.push(`sights.${id}.reticle: a crosshair says in marksNotDrawn which of the maker's marks are left out, and why`);
    if (s.reticle && s.reticle.focalPlane === 'second' && !s.reticle.trueAtPower) bad.push(`sights.${id}.reticle: a second-focal-plane reticle needs trueAtPower, the power its marks are true at`);
  }
  return bad;
}

function load() {
  const raw = {};
  for (const f of FILES) raw[f] = JSON.parse(fs.readFileSync(path.join(DIR, `${f}.json`), 'utf8'));
  const problems = [];
  for (const f of FILES) {
    // Strings that explain (name, notes, model names) are free; numbers are not.
    problems.push(...check(raw[f], f));
  }
  problems.push(...checkSights(raw.sights));
  return { raw, flat: flatten(raw), problems };
}

module.exports = { load, check, checkSights, flatten, KINDS, FILES, DIR };
