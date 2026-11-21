'use strict';
// The firing line's within-reach list (brief range-day-nine, task item 2), and
// the one function that measures it in the page. scripts/line-layout.mjs prints
// it; test/day.test.js holds it. Not a test file itself (no ".test.js").

// The phone sizes the list is held at: 412×915 (the kit's phone), and 412×830, the height of Dan's own phone measured from
// his screenshots of the firing line on 21 Nov 2026 (992×2000 pixels at 2.41 device pixels per CSS pixel), where the
// book line fell under Steady and Fire.
const PHONES = [[412, 915], [412, 830]];

// The three sights the measure runs for: a scope with its zoom, a dot with its
// magnifier, irons with a rear leaf (the screenshot states line-scope-7x,
// line-magnifier-300 and line-ak-leaf).
const SIGHTS = [
  { name: 'Vepr with its scope (zoom)', q: 'course=cta-piru&rifle=molot-vepr-54r&sight=utg-bugbuster-3-9x32&load=sb-174-hpbt', glass: '#zoomrow' },
  { name: 'Tavor SAR with its dot (magnifier)', q: 'course=angeles-sylmar&rifle=iwi-tavor-sar&sight=pa-md25&load=imi-m193', glass: '#magrow' },
  { name: 'AK with its irons (rear leaf)', q: 'course=angeles-sylmar&rifle=ak-762&sight=ak-irons&load=silver-bear-123', glass: '#leafrow' },
];

// Runs inside the page (page.evaluate(measure, glass)). For each element of the
// within-reach list other than the Steady and Fire bar: its box, whether the
// whole box is inside the screen and whether it is above the bar. For the bar:
// on a narrow screen whether it is fixed at the bottom inside the screen; on a
// wide one whether it stands beside the view and covers none of it. The view's
// size in pixels, the page's scroll, and every button's touch height.
// The short line is #line-head; on the page as it was before range-day-nine it
// is the description paragraph (.dayline), so the before-and-after can be compared.
function measure(glass) {
  const q = (s) => document.querySelector(s);
  const box = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top * 10) / 10, bottom: Math.round(b.bottom * 10) / 10, left: Math.round(b.left * 10) / 10, right: Math.round(b.right * 10) / 10, width: Math.round(b.width * 10) / 10, height: Math.round(b.height * 10) / 10 }; };
  const w = window.innerWidth, h = window.innerHeight;
  const barEl = q('.firebar');
  const bar = box(barEl);
  const view = box(q('#view'));
  const wide = w >= 1100; // public/app.css: the column beside the view from 1100 px
  const shown = (el) => el && !el.hidden && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  const list = [
    ['short line', q('#line-head') || q('.dayline')],
    ['plate picker', q('#plate')],
    ['sight\'s glass control', q(glass)],
    ['spotting scope', q('#spotting')], // range-day-ten: beside the sight's glass control
    ['view', q('#view')],
    ['where the last shot went', q('#result')],
    ['elevation setting', q('#el-text')], ['elevation down', q('#el-down')], ['elevation up', q('#el-up')],
    ['windage setting', q('#wd-text')], ['windage left', q('#wd-left')], ['windage right', q('#wd-right')],
    ['rounds left', q('#rounds')],
    ['book line', q('#book-line')],
  ];
  const coarse = ['#el-down-moa', '#el-up-moa', '#wd-left-moa', '#wd-right-moa'].map((s) => q(s)).filter(shown);
  const items = list.map(([name, el]) => {
    if (!shown(el)) return { name, shown: false };
    const b = box(el);
    const inside = b.top >= 0 && b.bottom <= h && b.left >= 0 && b.right <= w;
    // The rounds left stand inside the Fire button since range-day-nine-b: within reach inside the bar.
    const inBar = barEl.contains(el);
    const aboveBar = wide || inBar ? null : b.bottom <= bar.top + 0.5;
    return { name, shown: true, box: b, inside, aboveBar };
  });
  const coarseBoxes = coarse.map((el) => ({ id: el.id, box: box(el) }));
  const coarseInStrip = coarse.length ? coarseBoxes.every((c) => c.box.top >= 0 && c.box.bottom <= h && (wide || c.box.bottom <= bar.top + 0.5)) : null;
  const fixed = getComputedStyle(barEl).position === 'fixed';
  const barChecks = wide
    ? { besideView: !(bar.left < view.right && bar.right > view.left && bar.top < view.bottom && bar.bottom > view.top), inside: bar.top >= 0 && bar.bottom <= h && bar.left >= 0 && bar.right <= w }
    : { fixedAtBottom: fixed && Math.abs(bar.bottom - h) <= 1 && bar.top >= 0, inside: bar.top >= 0 && bar.bottom <= h && bar.left >= 0 && bar.right <= w };
  // Every button and control a thumb uses in the within-reach list, with its height.
  const touch = ['#plate', '#zoom', '#magnifier', '#leaf-down', '#leaf-up', '#el-down', '#el-up', '#wd-left', '#wd-right', '#el-down-moa', '#el-up-moa', '#wd-left-moa', '#wd-right-moa', '#line-head', '#another-box', '#steady', '#fire', '#spotting', '#spot-zoom', '#back-to-rifle', '#fresh-paper', '#old-paper']
    .map((s) => q(s)).filter(shown).map((el) => ({ id: el.id, height: Math.round(el.getBoundingClientRect().height * 10) / 10 }));
  return { w, h, wide, scrollY: window.scrollY, view: { width: view.width, height: view.height, top: view.top }, bar, barChecks, items, coarse: coarseBoxes, coarseInStrip, touch };
}

// Whether a measure meets task items 2 and 4: every shown item inside the screen (on a phone also above the bar), the bar's own checks.
function meets(m) {
  const bad = [];
  for (const it of m.items) {
    if (!it.shown) continue;
    if (!it.inside) bad.push(`${it.name} not inside the screen (${it.box.top}-${it.box.bottom} of ${m.h})`);
    if (it.aboveBar === false) bad.push(`${it.name} under the Steady and Fire bar (bottom ${it.box.bottom}, bar from ${m.bar.top})`);
  }
  for (const [k, v] of Object.entries(m.barChecks)) if (!v) bad.push(`the bar: ${k} is false`);
  return bad;
}

module.exports = { PHONES, SIGHTS, measure, meets };
