'use strict';
// The zero bench: a paper target with a 1-inch grid at 25, 50, 100 or 200
// yards. The rifle rests on the bench and is aimed at the center; each
// shot flies through the engine with the sight as set, the rifle's own
// offset, the load's spread and the day's air, and the hole is drawn where
// it lands. The player turns the sight in real clicks and saves the zero
// when satisfied. Every shot comes out of the day's box; the day is one
// load, so the load is fixed here while the day is open.
(async function () {
  const E = RD.E;
  const d = await RD.data();
  const q = RD.qs();
  const entered = RD.enterDay(d, RD.chooseFrom(d, q), q);
  const c = entered.c;
  let day = entered.day;
  const { courseId, rifleId, sightId } = c;
  const course = { id: courseId, ...d.courses[courseId] };
  const rifle = d.rifles[rifleId];
  const sight = d.sights[sightId];
  // A sliding rear leaf (the AK-pattern rifles and the Vepr's irons): its settings and each one's angle, from the rifle's record.
  const leaf = RD.leafOf(d, rifleId, sightId);
  const loadId = c.loadId;
  RD.remember(c);
  const weather = day.weather;
  let distance = 100;
  let setting = RD.getSight(rifleId, sightId);
  // The holes in the paper at the chosen distance (range-day-thirteen): read from the day's own record, which holds every bench shot
  // with its distance, its sight and where it struck, so a reload or a return to the page mid-group shows them again. They are the
  // bench shots at this distance with this sight since the last fresh paper there (the day's freshPaper marker "bench:<yards>", the
  // same marker the firing line's paper keeps under "<yards>": RD.hangFreshPaper).
  const paperKey = () => `bench:${distance}`;
  const benchHoles = () => {
    const since = (day && day.freshPaper && day.freshPaper[paperKey()]) || 0;
    return ((day && day.shots) || []).filter((s) => s.place === 'bench' && s.yards === distance && s.sight === sightId && s.reached && typeof s.upIn === 'number' && (s.n || 0) > since)
      .map((s) => ({ upIn: s.upIn, rightIn: s.rightIn, loadId }));
  };
  let holes = benchHoles(); // {upIn, rightIn, loadId}

  const $ = (id) => document.getElementById(id);
  const knobNote = (t) => { $('knob-note').textContent = t; if (t) $('pair-note').textContent = ''; };
  $('intro').textContent = `${rifle.name}, ${sight.name}, ${d.loads[loadId].name}. Aim is the center of the paper (36 inches square); the grid is 1 inch.`;
  // The short line at the top: the rifle, the sight and the load in a few words (their full names are in the words below).
  const grains = /(\d+ gr)\b/.exec(d.loads[loadId].name);
  $('bench-short').innerHTML = `<span>${RD.esc(`${rifle.name.split(',')[0]} · ${sight.name.replace(/ \(.*\)$/, '').replace(/, .*$/, '')} · ${grains ? `${d.loads[loadId].name.split(' ')[0]} ${grains[1]}` : d.loads[loadId].name.replace(/ \(.*\)$/, '')}`)}</span>`;
  const dayLine = () => {
    let t = RD.dayWords(weather, d.weather);
    if (entered.redirected) t += ` A day is already open with the ${rifle.name} and ${d.loads[loadId].name} on the ${course.name.replace(/ \(modeled on.*\)$/, '')}, so that day is shown, not the one the address asked for.`;
    if (!entered.saved || RD.dayReadFailed()) t += ' The day is not saved on this device (the browser refused its storage); it holds while this page is open.';
    $('day-line').textContent = t;
  };
  dayLine();
  $('distance').innerHTML = course.zeroYards.map((y) => `<option value="${y}"${y === distance ? ' selected' : ''}>${y} yards</option>`).join('');
  $('sight-name').textContent = sight.name;
  // Where each adjustment is, in the sight's own words (data/sights.json, adjustWords; range-day-twelve); the SeeAll's screws have
  // no clicks, so one step of its knob is a sixteenth of a turn.
  const step = sight.kind === 'seeall' ? 'step (a sixteenth of a turn of its screw)' : 'click';
  $('click-help').textContent = `One ${step} of elevation moves the strike ${sight.clickMoa} MOA (about ${(sight.clickMoa * E.inchesPerMoa(100)).toFixed(1)} inches at 100 yards); one ${step.replace(/ \(.*/, '')} of windage ${sight.windageClickMoa} MOA. ${sight.adjustWords || (sight.kind === 'iron' ? 'Elevation is the front post; windage is the rear drum.' : 'The scope\'s turrets.')}`;
  $('to-line').href = `/line${RD.params(c)}`;
  $('to-day').href = `/day?id=${encodeURIComponent(day.id)}`;

  // The paper is square and as large as the screen leaves it once everything else within reach is in place: on a phone the
  // width, or less on a short screen; on a computer the height beside the column. Never under 240 px or over 640 px.
  const canvas = $('view');
  function fitPaper() {
    const reach = document.querySelector('.benchreach'), wrap = canvas.parentElement;
    const wide = window.matchMedia('(min-width: 900px)').matches;
    const top = reach.getBoundingClientRect().top + window.scrollY;
    let w;
    if (wide) w = Math.min(640, window.innerHeight - top - 12, reach.clientWidth - 380 - 20);
    else {
      const others = reach.offsetHeight - wrap.offsetHeight;
      w = Math.min(wrap.clientWidth, window.innerHeight - top - others - 6 - 8);
    }
    w = Math.round(Math.max(240, Math.min(640, w)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, size: w };
  }
  canvas.style.width = '240px'; canvas.style.height = '240px';
  let view = fitPaper();
  window.addEventListener('resize', () => { view = fitPaper(); draw(); });

  // The paper: 36 inches square, 1-inch grid, a 2-inch black square at the
  // center and heavier lines every 6 inches. Scale: the paper fills the view.
  function draw() {
    const { g, size } = view;
    const paperIn = 36, px = size / (paperIn + 4);
    g.fillStyle = '#6b5a3e'; g.fillRect(0, 0, size, size); // the backer
    const ox = 2 * px, oy = 2 * px;
    g.fillStyle = '#f4efe2'; g.fillRect(ox, oy, paperIn * px, paperIn * px);
    g.strokeStyle = '#b9b2a0'; g.lineWidth = 1;
    for (let i = 0; i <= paperIn; i++) {
      g.beginPath(); g.moveTo(ox + i * px, oy); g.lineTo(ox + i * px, oy + paperIn * px); g.stroke();
      g.beginPath(); g.moveTo(ox, oy + i * px); g.lineTo(ox + paperIn * px, oy + i * px); g.stroke();
    }
    g.strokeStyle = '#7d7664'; g.lineWidth = 1.5;
    for (let i = 0; i <= paperIn; i += 6) {
      g.beginPath(); g.moveTo(ox + i * px, oy); g.lineTo(ox + i * px, oy + paperIn * px); g.stroke();
      g.beginPath(); g.moveTo(ox, oy + i * px); g.lineTo(ox + paperIn * px, oy + i * px); g.stroke();
    }
    const cx = ox + (paperIn / 2) * px, cy = oy + (paperIn / 2) * px;
    g.fillStyle = '#1d1d1b'; g.fillRect(cx - px, cy - px, 2 * px, 2 * px);
    g.fillStyle = '#f4efe2'; g.fillRect(cx - px * 0.15, cy - px * 0.15, px * 0.3, px * 0.3);
    // the inch labels (range-day-thirteen-b: they were grey on the brown backer, 9 px, and the left ones were cut at a 378-px phone's
    // edge): along the bottom in the cream of the paper on the backer; up the left side inside the paper, dark, just above each
    // heavy line, so nothing is cut at any width and the bottom row keeps the corners
    const fs = Math.max(10, Math.min(14, px * 0.85));
    g.font = `600 ${fs}px system-ui, sans-serif`; g.textBaseline = 'middle';
    g.fillStyle = '#efe6d2'; g.textAlign = 'center';
    for (let i = -18; i <= 18; i += 6) g.fillText(String(i), cx + i * px, oy + paperIn * px + px);
    g.fillStyle = '#5a5444'; g.textAlign = 'left'; g.textBaseline = 'bottom';
    for (let i = -12; i <= 12; i += 6) if (i) g.fillText(String(-i), ox + 3, cy + i * px - 2);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    // holes: the bullet's own diameter
    const cal = d.loads[loadId].caliber.startsWith('7.62') ? 0.31 : d.loads[loadId].caliber.startsWith('.22') ? 0.22 : 0.224;
    for (const h of holes) {
      const x = cx + h.rightIn * px, y = cy - h.upIn * px;
      if (x < 0 || x > size || y < 0 || y > size) continue;
      const onPaper = x >= ox && x <= ox + paperIn * px && y >= oy && y <= oy + paperIn * px;
      // on the paper a clean hole; on the backer a torn spot
      g.beginPath(); g.arc(x, y, Math.max(2, (cal / 2) * px * 1.6), 0, Math.PI * 2); g.fillStyle = onPaper ? '#2a2621' : '#3a2f22'; g.fill();
      g.beginPath(); g.arc(x, y, Math.max(1.2, (cal / 2) * px), 0, Math.PI * 2); g.fillStyle = onPaper ? '#6b5a3e' : '#1f1812'; g.fill();
    }
  }

  // The zeroing supply: the bench's own rounds, kept across days for this rifle and load; the day's box is for the steel.
  let supply = RD.getSupply(d, rifleId, loadId);
  const supplyEmpty = () => supply.left <= 0;
  const rounds = () => {
    $('rounds').textContent = RD.supplyText(supply) + (RD.supplyReadFailed(rifleId, loadId) ? ' (not saved on this device)' : '');
    $('fire1').disabled = supplyEmpty(); $('fire5').disabled = supplyEmpty(); $('another-box-row').hidden = !supplyEmpty();
  };
  function fire(n) {
    if (supplyEmpty()) { $('group').textContent = `The zeroing supply is empty: the box of ${supply.size} is used up. Open another box to go on.`; return; }
    const took = RD.takeSupply(d, rifleId, loadId, n);
    supply = took.supply;
    const out = took.out;
    if (!took.saved) $('saved').textContent = 'The zeroing supply is not saved on this device (the browser refused its storage); it holds while this page is open.';
    if (paperBack) { paperBack = null; freshButton(); pairNote(''); } // the way back lasts until the next shot
    if (!out) { rounds(); return; }
    const load = d.loads[loadId];
    RD.shotSound(0.5);
    for (let i = 0; i < out; i++) {
      const r = E.shoot({
        load, drag: d.physics.dragTables, powder: d.physics.powderTemperature,
        rifle: { sightHeightIn: rifle.sightHeightIn[sightId], boreOffsetMoa: { up: rifle.boreOffsetMoa.up + leafMoa(), right: rifle.boreOffsetMoa.right } },
        sight: { clickMoa: sight.clickMoa, windageClickMoa: sight.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
        targetYards: distance, targetRiseFt: 0, conditions: RD.conditionsOf(weather), wind: weather.wind, t0: performance.now() / 1000,
      });
      const shot = { place: 'bench', yards: distance, sight: sightId, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks, leaf: leaf ? leaf.settingsMeters[setting.leafIx || 0] : null, reached: r.reached, upIn: r.reached ? Math.round(r.hit.upIn * 100) / 100 : null, rightIn: r.reached ? Math.round(r.hit.rightIn * 100) / 100 : null };
      const rec = RD.recordShot(day, shot);
      if (!rec.saved) $('saved').textContent = 'The day is not saved on this device (the browser refused its storage); it holds while this page is open.';
      // the hole as the day holds it (rounded to a hundredth of an inch), so the paper shown now is the paper a reload shows
      if (r.reached) holes.push({ upIn: shot.upIn, rightIn: shot.rightIn, loadId });
    }
    draw(); readout(); rounds();
    if (supplyEmpty()) $('group').textContent += ` That was the last round of the zeroing supply's box of ${supply.size}. Open another box to go on; the day is not over.`;
  }
  function readout() {
    const mine = holes.filter((h) => h.loadId === loadId);
    if (!mine.length) { $('group').textContent = holes.length ? 'The holes on the paper are from another load. Fire a group with this one.' : 'No shots yet. Fire a group, read where it lands against the center, then turn the sight.'; return; }
    const last = mine.slice(-5);
    const up = last.reduce((s, h) => s + h.upIn, 0) / last.length, right = last.reduce((s, h) => s + h.rightIn, 0) / last.length;
    let far = 0;
    for (const a of last) for (const b of last) far = Math.max(far, Math.hypot(a.upIn - b.upIn, a.rightIn - b.rightIn));
    const off = holes.length - holes.filter((h) => Math.abs(h.upIn) <= 18 && Math.abs(h.rightIn) <= 18).length;
    $('group').textContent = `Last ${last.length} shot${last.length > 1 ? 's' : ''} at ${distance} yards: center of the group ${RD.whereText(up, right)}; spread ${far.toFixed(1)} inches (${(far / E.inchesPerMoa(distance)).toFixed(1)} MOA).${off ? ` ${off} shot${off > 1 ? 's' : ''} missed the paper (the paper is 36 inches square; the backer shows them).` : ''}`;
  }
  // The leaf's angle above its 100 m setting, which the bore takes like any click: through the engine, as part of the elevation.
  const leafMoa = () => (leaf ? leaf.moaAbove100[setting.leafIx || 0].moaAbove100 : 0);
  function showSetting() {
    $('el-text').textContent = RD.clicksText(setting.elevationClicks, sight.clickMoa, 'up', 'down');
    $('wd-text').textContent = RD.clicksText(setting.windageClicks, sight.windageClickMoa, 'right', 'left');
    $('setting-line').textContent = RD.settingLine(setting, sight, leaf ? `Leaf ${RD.leafText(leaf, setting.leafIx || 0)}` : '');
    if (leaf) $('leaf-text').textContent = RD.leafText(leaf, setting.leafIx || 0);
  }
  // The knobs: a press is one click, holding repeats, the coarse pair moves a whole MOA; the limits stop them.
  RD.wireKnobs(document, sight, () => setting, (which, next) => {
    setting = { ...setting, [which]: next };
    RD.clickSound();
    knobNote(RD.setSight(rifleId, sightId, setting) ? '' : 'Sight setting not saved on this device (storage is off); it holds for this page only.');
    showSetting();
  }, (text) => { knobNote(text); });
  if (leaf) {
    $('leafrow').hidden = false;
    const moveLeaf = (delta) => {
      const ix = (setting.leafIx || 0) + delta;
      if (ix < 0 || ix >= leaf.settingsMeters.length) { $('saved').textContent = `The leaf is at the end of its slide (${leaf.settingsMeters[ix < 0 ? 0 : leaf.settingsMeters.length - 1]} m).`; return; }
      setting = { ...setting, leafIx: ix }; RD.clickSound(); showSetting();
      if (!RD.setSight(rifleId, sightId, setting)) $('saved').textContent = 'Sight setting not saved on this device (storage is off); it holds for this page only.';
    };
    $('leaf-up').addEventListener('click', () => moveLeaf(1));
    $('leaf-down').addEventListener('click', () => moveLeaf(-1));
  }
  $('fire1').addEventListener('click', () => fire(1));
  $('fire5').addEventListener('click', () => fire(5));
  // Fresh paper, and its one-tap way back (the firing line's: RD.hangFreshPaper and RD.putOldPaperBack, a marker in the day; no
  // shot is deleted). The way back stands where Fresh paper stood, until the next shot or another distance.
  let paperBack = null; // the marker Fresh paper replaced, while the old paper can be put back
  // The knobs' words and the save's words share one slot between the rows that cause them (range-day-thirteen-b): whichever
  // spoke last shows, the other is cleared.
  const pairNote = (t) => { $('pair-note').textContent = t; if (t) $('knob-note').textContent = ''; };
  function freshButton() { $('fresh').textContent = paperBack ? 'Put the old paper back' : 'Fresh paper'; }
  $('fresh').addEventListener('click', () => {
    if (paperBack) {
      const saved = RD.putOldPaperBack(day, paperKey(), paperBack.before);
      paperBack = null; holes = benchHoles(); draw(); readout(); freshButton();
      pairNote(saved ? `The old paper is back at ${distance} yards, with its ${holes.length} hole${holes.length === 1 ? '' : 's'}.` : 'The old paper is back while this page is open, not saved on this device.');
      return;
    }
    const shown = holes.length;
    const r = RD.hangFreshPaper(day, paperKey());
    paperBack = { before: r.before };
    holes = benchHoles(); draw(); readout(); freshButton();
    pairNote(r.saved ? `A fresh paper at ${distance} yards; the old one had ${shown} hole${shown === 1 ? '' : 's'}, every shot kept in the day.` : 'The fresh paper is not saved on this device (storage refused); it holds while this page is open.');
  });
  $('distance').addEventListener('change', (e) => { distance = Number(e.target.value); paperBack = null; freshButton(); pairNote(''); holes = benchHoles(); draw(); readout(); });
  $('save').addEventListener('click', () => {
    const z = { elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks, zeroYards: distance, sight: sightId, savedAt: new Date().toISOString() };
    if (leaf) z.leafIx = setting.leafIx || 0;
    if (RD.setZero(rifleId, sightId, loadId, z)) {
      showSaved();
      pairNote(`Zero saved at ${distance} yards: elevation ${RD.sign(z.elevationClicks) || '0'}, windage ${RD.sign(z.windageClicks) || '0'} clicks${leaf ? `, leaf ${leaf.settingsMeters[z.leafIx] / 100}` : ''}.`);
    } else {
      $('saved').textContent = 'Zero not saved on this device: the browser refused to store it. The sight setting still holds while this page is open.';
      pairNote('Zero not saved on this device: the browser refused to store it.');
    }
  });
  $('pack-up').addEventListener('click', () => {
    const packed = RD.packUp();
    location.href = packed ? `/day?id=${encodeURIComponent(packed.id)}` : '/';
  });
  $('another-box').addEventListener('click', () => {
    const opened = RD.openSupplyBox(d, rifleId, loadId);
    supply = opened.supply; rounds();
    $('group').textContent = opened.saved ? `Box ${supply.opened} of ${d.loads[loadId].name} opened for zeroing: ${supply.left} rounds.` : 'The box could not be saved on this device (the browser refused its storage); it holds while this page is open.';
  });
  function showSaved() {
    const z = RD.getZero(rifleId, sightId, loadId);
    if (z === RD.store.FAILED) { $('saved').textContent = 'Zero not saved on this device: the browser refused to read its storage. The sight setting holds while this page is open.'; return; }
    $('saved').textContent = z ? `Saved zero for ${d.loads[loadId].name}: ${z.zeroYards} yards, elevation ${RD.clicksText(z.elevationClicks, sight.clickMoa, 'up', 'down')}, windage ${RD.clicksText(z.windageClicks, sight.windageClickMoa, 'right', 'left')}${leaf && z.leafIx != null ? `, leaf ${RD.leafText(leaf, z.leafIx)}` : ''}.` : `No zero saved yet for ${d.loads[loadId].name} with this sight.`;
  }
  function conditions() {
    if (!RD.showConditions()) { $('conditions').textContent = ''; return; }
    const w = weather.wind[0];
    $('conditions').textContent = `Conditions (the setting "Show the conditions" is on): ${weather.tempF} F, ${weather.pressureInHg} inHg, humidity ${Math.round(weather.humidity * 100)}%, wind at the bench ${w.speedMph} mph ${RD.windWord(w.fromDegrees)}${weather.santaAna ? ', a Santa Ana day' : ''}.`;
  }
  showSetting(); showSaved(); conditions(); rounds(); view = fitPaper(); draw(); readout();
  if (RD.sightReadFailed(rifleId, sightId)) $('group').textContent = 'The browser refused to read its storage: the sight starts at its middle and nothing saves on this device while that lasts.';
  // Where the last group landed holds two lines in a slot of fixed height; a longer text is marked and opens on a tap over what is
  // below it, so nothing under the thumb moves (the firing line's way, range-day-nine). New text closes it again.
  {
    const el = $('group');
    const measure = () => { const open = el.classList.contains('open'); el.classList.remove('open'); el.classList.toggle('long', el.scrollHeight > el.clientHeight + 1); if (open && el.classList.contains('long')) el.classList.add('open'); };
    new MutationObserver(() => { el.classList.remove('open'); measure(); }).observe(el, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', measure);
    el.addEventListener('click', () => { if (el.classList.contains('open')) el.classList.remove('open'); else if (el.classList.contains('long')) el.classList.add('open'); });
    measure();
  }
  // For the tests: the day as this page holds it.
  window.RangeDayZero = { get day() { return day; }, get setting() { return setting; }, get holes() { return holes; }, get distance() { return distance; }, get paperPx() { return view.size; } };
}());
