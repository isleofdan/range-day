'use strict';
// The zero bench's within-reach list (brief range-day-thirteen, task items 1 to 5), and the one function that measures it in the
// page: the bench's twin of test/line-reach.js. scripts/bench-layout.mjs prints it; test/bench.test.js holds it. Not a test file
// itself (no ".test.js").

// The sizes the list is held at: the two phones the firing line is held at (412×915, the kit's phone; 412×830), Dan's own phone
// as measured from his screenshot (378×762, range-day-thirteen-b) and a computer (1280×800).
const SIZES = [[412, 915], [412, 830], [378, 762], [1280, 800]];

// Every sight of every playable rifle on the bench (the magnifier is not a sight of its own there), each on its rifle's first
// course with its first load; the rifle set and each rifle's sights as the server serves them (lib/guns.js), so a sight a rifle
// gains is held to the same reach.
const raw = require('../lib/data').load().raw;
const rifles = require('../lib/guns').fromFiles(raw);
const sights = require('../lib/data').flatten(raw.sights);
const SIGHTS = [];
for (const [rifleId, rifle] of Object.entries(rifles)) {
  if (!rifle.playable) continue;
  for (const sightId of rifle.sights.filter((x) => sights[x].kind !== 'magnifier')) {
    SIGHTS.push({ name: `${rifle.name} with the ${sights[sightId].name.replace(/ \(.*\)$/, '')}`, q: `course=${rifle.firstCourse}&rifle=${rifleId}&sight=${sightId}&load=${rifle.loads[0]}`, rifleId, sightId });
  }
}

// The controls of task item 1, by id: each must be wholly on the first screen; the buttons among them must not touch.
const LIST = [
  ['short line', '#bench-short'], ['paper at', '#distance'], ['paper', '#view'], ['where the last group landed', '#group'],
  ['elevation setting', '#el-text'], ['elevation 1 MOA down', '#el-down-moa'], ['elevation one click down', '#el-down'], ['elevation one click up', '#el-up'], ['elevation 1 MOA up', '#el-up-moa'],
  ['windage setting', '#wd-text'], ['windage 1 MOA left', '#wd-left-moa'], ['windage one click left', '#wd-left'], ['windage one click right', '#wd-right'], ['windage 1 MOA right', '#wd-right-moa'],
  ['the knobs\' note', '#knob-note'], ['Fresh paper', '#fresh'], ['Save this zero', '#save'], ['the save\'s note', '#pair-note'], ['the zeroing supply', '#rounds'],
  ['Fire one', '#fire1'], ['Fire five', '#fire5'], ['Open another box', '#another-box'],
];
const BUTTONS = ['#distance', '#el-down-moa', '#el-down', '#el-up', '#el-up-moa', '#wd-left-moa', '#wd-left', '#wd-right', '#wd-right-moa', '#fresh', '#save', '#fire1', '#fire5', '#another-box'];

// Runs inside the page (page.evaluate(measure, [LIST, BUTTONS])): each item's box, whether it is shown and wholly inside the screen;
// the buttons' boxes; every pair of shown buttons closer than 2 px (touching or overlapping); the paper's size; the page's scroll.
function measure([list, buttons]) {
  const q = (s) => document.querySelector(s);
  const r1 = (v) => Math.round(v * 10) / 10;
  const box = (el) => { const b = el.getBoundingClientRect(); return { top: r1(b.top), bottom: r1(b.bottom), left: r1(b.left), right: r1(b.right), width: r1(b.width), height: r1(b.height) }; };
  const w = window.innerWidth, h = window.innerHeight;
  const shown = (el) => el && !el.hidden && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  const items = list.map(([name, sel]) => {
    const el = q(sel);
    if (!shown(el)) return { name, sel, shown: false };
    const b = box(el);
    return { name, sel, shown: true, box: b, inside: b.top >= 0 && b.bottom <= h && b.left >= 0 && b.right <= w };
  });
  // A coarse button hidden for a sight that clicks a whole minute keeps its place (visibility hidden): its box still counts as a place.
  const btns = buttons.map((sel) => ({ sel, el: q(sel) })).filter((b) => b.el && !b.el.hidden && b.el.offsetParent !== null).map((b) => ({ sel: b.sel, box: box(b.el), seen: getComputedStyle(b.el).visibility !== 'hidden' }));
  const touching = [];
  for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
    const a = btns[i].box, b = btns[j].box;
    if (!btns[i].seen || !btns[j].seen) continue;
    const gapX = Math.max(b.left - a.right, a.left - b.right), gapY = Math.max(b.top - a.bottom, a.top - b.bottom);
    if (Math.max(gapX, gapY) < 2) touching.push(`${btns[i].sel} and ${btns[j].sel}`);
  }
  const paper = box(q('#view'));
  const fire = q('#fire1') && box(q('#fire1'));
  return { w, h, wide: w >= 900, scrollY: window.scrollY, scrollWidth: document.documentElement.scrollWidth, paper: { width: paper.width, height: paper.height }, fireBottom: fire ? fire.bottom : null, items, buttons: btns.map((b) => ({ sel: b.sel, box: b.box })), touching };
}

// Whether a measure meets task item 1: every shown item wholly inside the screen, the page at its top, no two buttons touching,
// the paper square, at least 300 px on a phone; no sideways scroll.
function meets(m) {
  const bad = [];
  for (const it of m.items) if (it.shown && !it.inside) bad.push(`${it.name} not wholly on the first screen (${it.box.top}-${it.box.bottom} of ${m.h})`);
  for (const t of m.touching) bad.push(`buttons touch: ${t}`);
  if (m.scrollY !== 0) bad.push(`the page is scrolled ${m.scrollY}`);
  if (m.paper.width !== m.paper.height) bad.push(`the paper is not square (${m.paper.width}x${m.paper.height})`);
  if (!m.wide && m.paper.width < 300) bad.push(`the paper is ${m.paper.width} px wide, under 300`);
  if (m.scrollWidth > m.w) bad.push(`sideways scroll (${m.scrollWidth} > ${m.w})`);
  return bad;
}

module.exports = { SIZES, SIGHTS, LIST, BUTTONS, measure, meets };
