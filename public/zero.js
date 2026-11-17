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
  let holes = []; // {upIn, rightIn, loadId}

  const $ = (id) => document.getElementById(id);
  $('intro').textContent = `${rifle.name}, ${sight.name}, ${d.loads[loadId].name}. Aim is the center of the paper (36 inches square); the grid is 1 inch.`;
  const dayLine = () => {
    let t = RD.dayWords(weather, d.weather);
    if (entered.redirected) t += ` A day is already open with the ${rifle.name} and ${d.loads[loadId].name} on the ${course.name.replace(/ \(modeled on.*\)$/, '')}, so that day is shown, not the one the address asked for.`;
    if (!entered.saved || RD.dayReadFailed()) t += ' The day is not saved on this device (the browser refused its storage); it holds while this page is open.';
    $('day-line').textContent = t;
  };
  dayLine();
  $('distance').innerHTML = course.zeroYards.map((y) => `<option value="${y}"${y === distance ? ' selected' : ''}>${y} yards</option>`).join('');
  $('sight-name').textContent = sight.name;
  $('click-help').textContent = `One click of elevation moves the strike ${sight.clickMoa} MOA (about ${(sight.clickMoa * E.inchesPerMoa(100)).toFixed(1)} inches at 100 yards); one click of windage ${sight.windageClickMoa} MOA. ${sight.kind === 'iron' ? 'Elevation is the front post; windage is the rear drum.' : 'The scope\'s turrets.'}`;
  $('to-line').href = `/line${RD.params(c)}`;
  $('to-day').href = `/day?id=${encodeURIComponent(day.id)}`;

  const canvas = $('view');
  let view = RD.fitCanvas(canvas, 560);
  window.addEventListener('resize', () => { view = RD.fitCanvas(canvas, 560); draw(); });

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
    // inch labels along the edges
    g.fillStyle = '#7d7664'; g.font = `${Math.max(9, px * 0.6)}px system-ui, sans-serif`; g.textAlign = 'center';
    for (let i = -18; i <= 18; i += 6) { g.fillText(String(i), cx + i * px, oy + paperIn * px + px * 1.2); g.fillText(String(-i), ox - px, cy + i * px + 3); }
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

  // The box: how many are left, and whether the day is over.
  const rounds = () => { $('rounds').textContent = RD.roundsText(day); const over = Boolean(day.endedAt) || day.box.left <= 0; $('fire1').disabled = over; $('fire5').disabled = over; };
  function fire(n) {
    if (day.endedAt || day.box.left <= 0) { $('group').textContent = `The day is over: the box of ${day.box.size} is empty. Pack up is done for you; the day's page has every shot.`; return; }
    const out = RD.takeRounds(day, n);
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
      if (r.reached) holes.push({ upIn: r.hit.upIn, rightIn: r.hit.rightIn, loadId });
      const shot = { place: 'bench', yards: distance, sight: sightId, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks, leaf: leaf ? leaf.settingsMeters[setting.leafIx || 0] : null, reached: r.reached, upIn: r.reached ? Math.round(r.hit.upIn * 100) / 100 : null, rightIn: r.reached ? Math.round(r.hit.rightIn * 100) / 100 : null };
      const rec = RD.recordShot(day, shot, i < out - 1);
      if (!rec.saved) $('saved').textContent = 'The day is not saved on this device (the browser refused its storage); it holds while this page is open.';
    }
    draw(); readout(); rounds();
    if (day.endedAt) $('group').textContent += ` That was the last round: the box of ${day.box.size} is empty and the day is over. The day's page has every shot.`;
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
    if (!RD.setSight(rifleId, sightId, setting)) $('saved').textContent = 'Sight setting not saved on this device (storage is off); it holds for this page only.';
    showSetting();
  }, (text) => { $('saved').textContent = text; });
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
  $('fresh').addEventListener('click', () => { holes = []; draw(); readout(); });
  $('distance').addEventListener('change', (e) => { distance = Number(e.target.value); holes = []; draw(); readout(); });
  $('save').addEventListener('click', () => {
    const z = { elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks, zeroYards: distance, sight: sightId, savedAt: new Date().toISOString() };
    if (leaf) z.leafIx = setting.leafIx || 0;
    if (RD.setZero(rifleId, sightId, loadId, z)) showSaved(); else $('saved').textContent = 'Zero not saved on this device: the browser refused to store it. The sight setting still holds while this page is open.';
  });
  $('pack-up').addEventListener('click', () => {
    const packed = RD.packUp();
    location.href = packed ? `/day?id=${encodeURIComponent(packed.id)}` : '/';
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
  showSetting(); showSaved(); conditions(); draw(); readout(); rounds();
  if (RD.sightReadFailed(rifleId, sightId)) $('group').textContent = 'The browser refused to read its storage: the sight starts at its middle and nothing saves on this device while that lasts.';
  // For the tests: the day as this page holds it.
  window.RangeDayZero = { get day() { return day; }, get setting() { return setting; }, get holes() { return holes; } };
}());
