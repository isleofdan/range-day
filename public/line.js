'use strict';
/* The firing line: the view through the sight. The aim wanders the way a
   rested rifle does (small, slow, worse just after a shot); the player
   drags to hold off, holds Steady, presses Fire. The bullet takes its real
   flight time through the engine; a miss throws dust where it landed, a hit
   rings late by the flight time plus the sound's trip back. Recoil knocks
   the view off the plate for a moment. No drop or wind figure is given:
   wind shows only as heat shimmer leaning, brush moving and the dust's
   drift, unless the setting "Show the conditions" is on.

   World coordinates on screen: minutes of angle (MOA) right and up of the
   aimed plate's center. The view's center is the reticle. */
(async function () {
  const E = RD.E;
  const d = await RD.data();
  const q = RD.qs();
  const courseId = d.courses[q.course] ? q.course : 'cta-piru';
  const course = { id: courseId, ...d.courses[courseId] };
  const rifleId = d.rifles[q.rifle] && d.rifles[q.rifle].playable ? q.rifle : (courseId === 'cta-piru' ? 'molot-vepr-54r' : 'bcm-ar15');
  const rifle = d.rifles[rifleId];
  const sightId = rifleId === 'molot-vepr-54r' ? 'utg-2-7x44' : 'ar-irons';
  const sight = d.sights[sightId];
  let loadId = rifle.loads.includes(q.load) ? q.load : rifle.loads[0];
  const day = RD.day(course, d.weather);
  const plates = course.plates;
  let plateIx = 0;
  let mag = sight.zoom.low;
  let setting = RD.getSight(rifleId, sightId);
  const seed = RD.hash(courseId);
  const terrainRand = E.seeded(seed);
  const $ = (id) => document.getElementById(id);

  // If a zero is saved for this rifle and load, the sight starts there.
  function applyZero() {
    const z = RD.getZero(rifleId, loadId);
    if (z) { setting = { elevationClicks: z.elevationClicks, windageClicks: z.windageClicks }; RD.setSight(rifleId, sightId, setting); }
    showSetting(); zeroNote();
  }
  // The note under the knobs: where the sight stands against this load's saved zero.
  function zeroNote() {
    const z = RD.getZero(rifleId, loadId);
    const btn = $('use-zero');
    if (!z) { $('zero-note').textContent = 'No zero saved for this load: the sight is wherever it was last left. The zero bench is the place to fix that.'; btn.hidden = true; return; }
    const at = z.elevationClicks === setting.elevationClicks && z.windageClicks === setting.windageClicks;
    $('zero-note').textContent = at ? `Sight at the saved ${z.zeroYards}-yard zero for this load. Every click from here is yours.` : `The sight is not at this load's saved ${z.zeroYards}-yard zero (elevation ${RD.clicksText(z.elevationClicks, sight.clickMoa, 'up', 'down')}, windage ${RD.clicksText(z.windageClicks, sight.windageClickMoa, 'right', 'left')}); it stays where you left it.`;
    btn.hidden = at;
  }

  $('intro').textContent = `${course.name}. ${rifle.name} with ${sight.name}. Steel ${plates[0].yards} to ${plates[plates.length - 1].yards} yards${course.farPlateRiseFt ? ', the far plates up the slope' : ''}.`;
  $('plate').innerHTML = plates.map((p, i) => `<option value="${i}">${p.yards} yards (${p.widthIn} × ${p.heightIn} in steel)</option>`).join('');
  $('load').innerHTML = rifle.loads.map((l) => `<option value="${l}"${l === loadId ? ' selected' : ''}>${RD.esc(d.loads[l].name)}</option>`).join('');
  $('to-zero').href = `/zero?course=${courseId}&rifle=${rifleId}&load=${loadId}`;
  if (sight.zoom.high === sight.zoom.low) $('zoomrow').hidden = true;
  else { $('zoom').min = sight.zoom.low; $('zoom').max = sight.zoom.high; $('zoom').value = mag; }
  const zoomText = () => { $('zoom-text').textContent = `${mag}×`; };
  zoomText();

  // --- state of the view ----------------------------------------------------------------
  const hold = { up: 0, right: 0 };      // where the player holds the reticle, MOA from the plate center
  const wander = { up: 0, right: 0, vu: 0, vr: 0 };
  const recoil = { up: 0, right: 0 };
  let steady = false, lastShotAt = -10, now = 0, last = performance.now() / 1000;
  const dust = [];                         // {rightMoa, upMoa, bornAt, yards}
  const pending = [];                      // shots in flight
  const marks = [];                        // {plateIx, rightIn, upIn, at} paint splashes on plates
  let log = RD.getLog(rifleId, loadId);
  let flash = 0;

  const canvas = $('view');
  let view = RD.fitCanvas(canvas, 640);
  window.addEventListener('resize', () => { view = RD.fitCanvas(canvas, 640); });
  const plate = () => plates[plateIx];
  const inchPerMoa = (y) => E.inchesPerMoa(y);
  const riseOf = (p) => course.farPlateRiseFt * (p.yards / course.steelTo);
  const losAngle = (p) => Math.atan2(riseOf(p), p.yards * 3);
  // The plate's rectangle in MOA.
  const plateMoa = (p) => ({ w: p.widthIn / inchPerMoa(p.yards), h: p.heightIn / inchPerMoa(p.yards) });
  // Where a plate sits, in MOA relative to the aimed plate's center.
  function plateAt(p) {
    const a = plate();
    const up = ((losAngle(p) - losAngle(a)) * 180 * 60) / Math.PI;
    const right = ((p.lateralYd / p.yards - a.lateralYd / a.yards) * 180 * 60) / Math.PI;
    return { up, right };
  }
  const pxPerMoa = () => view.size / RD.fovMoa(sight, mag);
  const center = () => ({ up: hold.up + wander.up + recoil.up, right: hold.right + wander.right + recoil.right });
  const toScreen = (rightMoa, upMoa) => { const c = center(), k = pxPerMoa(); return [view.size / 2 + (rightMoa - c.right) * k, view.size / 2 - (upMoa - c.up) * k]; };

  // --- the aim's wander: slow, small, worse after a shot, calmer when held steady ----------
  function stepWander(dt) {
    const since = now - lastShotAt;
    const amp = 0.35 * (steady ? 0.35 : 1) * (1 + 3 * Math.exp(-Math.max(0, since) / 2.5)) * (sightId === 'ar-irons' ? 1.3 : 1);
    const tau = 1.2;
    for (const [v, x] of [['vu', 'up'], ['vr', 'right']]) {
      wander[v] += (-wander[v] / tau) * dt + amp * Math.sqrt(dt) * E.gaussian() * 0.9;
      wander[x] += wander[v] * dt * 0.6 - (wander[x] / 3) * dt; // pulled back toward the hold; rested, about 0.23 MOA either way
    }
    const breathe = steady ? 0 : 0.25 * Math.sin((2 * Math.PI * now) / 4.2);
    wander.breath = breathe;
    const k = Math.exp(-dt / (0.22 * rifle.recoilFactor));
    recoil.up *= k; recoil.right *= k;
  }

  // --- drawing -------------------------------------------------------------------------
  const ridge = Array.from({ length: 64 }, () => terrainRand());
  const brush = Array.from({ length: 160 }, () => ({ az: (terrainRand() - 0.5) * 700, up: -4 - terrainRand() * terrainRand() * 260, s: 0.6 + terrainRand() * 1.2, ph: terrainRand() * 6.3 }));
  const far = Array.from({ length: 40 }, () => terrainRand());
  const profile = (arr, azMoa, amp, wavelength) => { const i = (azMoa / wavelength) % arr.length; const a = Math.floor(((i % arr.length) + arr.length) % arr.length), b = (a + 1) % arr.length; const f = ((i % 1) + 1) % 1; return (arr[a] * (1 - f) + arr[b] * f) * amp; };
  const crossMph = () => RD.crosswindMph(day.wind[Math.min(2, Math.floor((plate().yards / course.steelTo) * 3))]);

  function draw() {
    const { g, size } = view;
    const k = pxPerMoa();
    const c = center();
    g.save();
    // sky
    const sky = g.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, '#9fc2e6'); sky.addColorStop(1, '#e7e3d2');
    g.fillStyle = sky; g.fillRect(0, 0, size, size);
    // far hills: a blue-grey ridge well above the plates
    g.fillStyle = '#9e9276';
    g.beginPath(); g.moveTo(0, size);
    for (let x = 0; x <= size; x += 8) { const az = c.right + (x - size / 2) / k; const up = 60 + profile(far, az + 4000, 120, 90); g.lineTo(x, size / 2 - (up - c.up) * k); }
    g.lineTo(size, size); g.closePath(); g.fill();
    // the main slope: dry brown, its top edge a little above the plates' line
    const slope = g.createLinearGradient(0, 0, 0, size);
    slope.addColorStop(0, '#b08a5a'); slope.addColorStop(1, '#8a6a42');
    g.fillStyle = slope;
    g.beginPath(); g.moveTo(0, size);
    for (let x = 0; x <= size; x += 6) { const az = c.right + (x - size / 2) / k; const up = 9 + profile(ridge, az, 22, 55); g.lineTo(x, size / 2 - (up - c.up) * k); }
    g.lineTo(size, size); g.closePath(); g.fill();
    // brush: dark dabs that sway with the wind
    const wind = crossMph();
    for (const b of brush) {
      const sway = Math.sin(now * (1.5 + b.s) + b.ph) * wind * 0.12 * b.s;
      const [x, y] = toScreen(b.az + sway, b.up);
      if (x < -20 || x > size + 20 || y < -20 || y > size + 20) continue;
      const r = Math.max(1.5, 5 * b.s * k / 7);
      g.fillStyle = '#4f5a2f'; g.beginPath(); g.ellipse(x, y, r, r * 0.7, 0, 0, 7); g.fill();
    }
    // the plates on their posts, each at its real angular size
    plates.forEach((p, i) => {
      const at = plateAt(p), m = plateMoa(p);
      const [x, y] = toScreen(at.right, at.up);
      const w = Math.max(1, m.w * k), h = Math.max(1, m.h * k);
      g.fillStyle = '#5a4a3a'; g.fillRect(x - Math.max(0.5, w * 0.06), y + h / 2, Math.max(1, w * 0.12), h * 0.9);
      g.fillStyle = i === plateIx ? '#d9d6cf' : '#b9b5ad'; g.fillRect(x - w / 2, y - h / 2, w, h);
      g.strokeStyle = '#3a3a3a'; g.lineWidth = Math.min(1.5, w * 0.05); g.strokeRect(x - w / 2, y - h / 2, w, h);
      for (const mk of marks) if (mk.plateIx === i) { const [mx, my] = toScreen(at.right + mk.rightIn / inchPerMoa(p.yards), at.up + mk.upIn / inchPerMoa(p.yards)); g.fillStyle = '#f3f1ea'; g.beginPath(); g.arc(mx, my, Math.max(1, 0.5 * k / 1.047), 0, 7); g.fill(); }
    });
    // dust from misses: rises, drifts with the wind, fades
    for (const p of dust) {
      const age = now - p.bornAt;
      if (age > 3) continue;
      const scale = 36 / inchPerMoa(p.yards); // a 3-foot puff
      for (let j = 0; j < 7; j++) {
        const jr = ((j * 37) % 11) / 11 - 0.5, ju = ((j * 53) % 7) / 7;
        const drift = (wind * 1.4667 * age) / (p.yards * 3) * 3438; // ft/s × s over the distance, in MOA
        const [x, y] = toScreen(p.rightMoa + jr * scale * (1 + age) + drift, p.upMoa + ju * scale * (0.5 + age * 0.8));
        g.fillStyle = `rgba(222, 200, 160, ${Math.max(0, 0.9 - age / 3.2)})`;
        g.beginPath(); g.arc(x, y, Math.max(2, scale * k * 0.5 * (0.6 + age)), 0, Math.PI * 2); g.fill();
      }
    }
    // heat shimmer leaning with the wind (seen through magnification)
    if (mag >= 2.5) {
      g.strokeStyle = 'rgba(255,255,255,0.10)'; g.lineWidth = 1.2;
      for (let i = 0; i < 14; i++) {
        const y0 = size * 0.45 + i * (size * 0.04);
        g.beginPath();
        for (let x = 0; x <= size; x += 10) { const yy = y0 + Math.sin(x / 18 + now * 6 + i) * 2.2 + (x - size / 2) * (-wind * 0.006); g.lineTo(x, yy); }
        g.stroke();
      }
    }
    // muzzle flash and blur right after a shot
    if (flash > 0) { g.fillStyle = `rgba(255, 230, 180, ${flash})`; g.fillRect(0, 0, size, size); }
    g.restore();
    drawSight(g, size, k);
  }

  function drawSight(g, size, k) {
    const cx = size / 2, cy = size / 2;
    if (sight.kind === 'scope') {
      // the tube: black outside the circle
      g.save(); g.beginPath(); g.rect(0, 0, size, size); g.arc(cx, cy, cx - 4, 0, Math.PI * 2, true); g.fillStyle = '#050505'; g.fill('evenodd'); g.restore();
      g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, cx - 4, 0, Math.PI * 2); g.stroke();
      // mil-dot reticle: fine crosshair, dots every 3.44 MOA, heavy posts outside
      const dot = sight.reticle.dotSpacingMoa * k;
      g.strokeStyle = '#111'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(0, cy); g.lineTo(size, cy); g.moveTo(cx, 0); g.lineTo(cx, size); g.stroke();
      g.fillStyle = '#111';
      for (let i = 1; i <= 5; i++) for (const [x, y] of [[cx + i * dot, cy], [cx - i * dot, cy], [cx, cy + i * dot], [cx, cy - i * dot]]) { g.beginPath(); g.arc(x, y, Math.max(1.2, 0.2 * k), 0, 7); g.fill(); }
      g.lineWidth = Math.max(3, 1.0 * k);
      const post = 5.5 * dot;
      g.beginPath(); g.moveTo(0, cy); g.lineTo(cx - post, cy); g.moveTo(cx + post, cy); g.lineTo(size, cy); g.moveTo(cx, 0); g.lineTo(cx, cy - post); g.moveTo(cx, cy + post); g.lineTo(cx, size); g.stroke();
    } else {
      // iron sights: the rear aperture's circle, dark and soft around it; the front post rising to the center
      const r = (sight.apertureMoa * k) / 2;
      const ring = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.25);
      ring.addColorStop(0, 'rgba(0,0,0,0)'); ring.addColorStop(1, 'rgba(0,0,0,0.97)');
      g.fillStyle = ring; g.fillRect(0, 0, size, size);
      const w = sight.frontPostMoa * k;
      g.fillStyle = '#141414';
      g.fillRect(cx - w / 2, cy, w, size);
      // the post's protective wings, blurred by nearness to the eye
      g.fillStyle = 'rgba(20,20,20,0.35)';
      g.fillRect(cx - w * 2.6, cy - w * 0.4, w * 0.5, size); g.fillRect(cx + w * 2.1, cy - w * 0.4, w * 0.5, size);
    }
  }

  // --- the shot -----------------------------------------------------------------------------
  function fire() {
    if (pending.length > 2) return;
    const p = plate(), load = d.loads[loadId];
    // Where the reticle points, in MOA from the plate's center, at the trigger pull.
    const aimUp = hold.up + wander.up + wander.breath, aimRight = hold.right + wander.right;
    const r = E.shoot({
      load, drag: d.physics.dragTables,
      rifle: { sightHeightIn: rifle.sightHeightIn[sightId], boreOffsetMoa: rifle.boreOffsetMoa },
      sight: { clickMoa: sight.clickMoa, windageClickMoa: sight.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
      targetYards: p.yards, targetRiseFt: riseOf(p), conditions: RD.conditionsOf(day), wind: day.wind, t0: now,
    });
    RD.shotSound(1);
    flash = 0.9;
    recoil.up += 14 * rifle.recoilFactor * (0.8 + Math.random() * 0.4); recoil.right += 4 * rifle.recoilFactor * (0.5 + Math.random());
    lastShotAt = now;
    const ipm = inchPerMoa(p.yards);
    const entry = { n: log.length + 1, yards: p.yards, el: setting.elevationClicks, wd: setting.windageClicks, zoom: mag, heldUp: Math.round(aimUp * 10) / 10, heldRight: Math.round(aimRight * 10) / 10 };
    if (!r.reached) {
      entry.where = 'into the ground before the plate'; entry.hit = false;
      pending.push({ at: now + r.timeS, entry, rightMoa: aimRight, upMoa: -(p.heightIn / ipm) * 2, yards: p.yards, hit: false, dist: p.yards });
    } else {
      // The bullet lands where the reticle pointed plus the engine's offset.
      const upIn = r.hit.upIn + aimUp * ipm, rightIn = r.hit.rightIn + aimRight * ipm;
      const hit = Math.abs(upIn) <= p.heightIn / 2 && Math.abs(rightIn) <= p.widthIn / 2;
      entry.hit = hit; entry.where = hit ? `hit (${RD.whereText(upIn, rightIn)} of center)` : `miss: ${RD.whereText(upIn, rightIn)}`;
      entry.upIn = Math.round(upIn * 10) / 10; entry.rightIn = Math.round(rightIn * 10) / 10;
      pending.push({ at: now + r.timeS, entry, rightMoa: rightIn / ipm, upMoa: upIn / ipm, yards: p.yards, hit, upIn, rightIn, dist: p.yards, mach: r.mach });
    }
    $('result').textContent = `Shot ${entry.n} away at ${p.yards} yards…`;
  }
  function land(s) {
    const soundBack = (s.dist * 3) / E.speedOfSound(day.tempF);
    if (s.hit) { marks.push({ plateIx, rightIn: s.rightIn, upIn: s.upIn, at: now }); RD.ringSound(soundBack, Math.max(0.15, 1 - s.dist / 1300)); }
    else { dust.push({ rightMoa: s.rightMoa, upMoa: s.upMoa, bornAt: now, yards: s.yards }); RD.thudSound(soundBack, Math.max(0.05, 0.5 - s.dist / 2500)); }
    log.push(s.entry);
    if (!RD.setLog(rifleId, loadId, log)) $('zero-note').textContent = 'Shot log not saved on this device (storage is off); it holds for this page only.';
    const sub = s.mach != null && s.mach < 1.2 ? ` The bullet arrived at Mach ${s.mach.toFixed(2)}${s.mach < 1 ? ', below the speed of sound' : ', nearly down to the speed of sound'}.` : '';
    $('result').innerHTML = s.hit ? `<strong>Hit</strong> at ${s.dist} yards, ${RD.esc(RD.whereText(s.upIn, s.rightIn))} of center. The ring comes back ${soundBack.toFixed(1)} s later.${sub}` : `<strong>Miss</strong> at ${s.dist} yards: ${RD.esc(s.entry.where.replace('miss: ', ''))}. Watch the dust.${sub}`;
    renderLog();
  }
  function renderLog() {
    const body = $('log').querySelector('tbody');
    body.innerHTML = log.slice().reverse().map((e) => `<tr class="${e.hit ? 'hit' : 'miss'}"><td>${e.n}</td><td>${e.yards}</td><td>${RD.sign(e.el)}</td><td>${RD.sign(e.wd)}</td><td>${e.zoom}×</td><td>${heldText(e)}</td><td>${RD.esc(e.where)}</td></tr>`).join('');
  }
  const heldText = (e) => (Math.abs(e.heldUp) < 0.3 && Math.abs(e.heldRight) < 0.3) ? 'center' : `${Math.abs(e.heldUp).toFixed(1)} ${e.heldUp > 0 ? 'high' : 'low'}, ${Math.abs(e.heldRight).toFixed(1)} ${e.heldRight > 0 ? 'right' : 'left'} (MOA)`;

  // --- the setting: Show the conditions -----------------------------------------------------------
  function conditions() {
    const on = RD.showConditions();
    $('show-conditions').checked = on;
    if (!on) { $('conditions').textContent = ''; return; }
    const p = plate(), load = d.loads[loadId];
    const base = { load, drag: d.physics.dragTables, sightHeightIn: rifle.sightHeightIn[sightId], elevationMoa: setting.elevationClicks * sight.clickMoa + rifle.boreOffsetMoa.up, windageMoa: setting.windageClicks * sight.windageClickMoa + rifle.boreOffsetMoa.right, targetYards: p.yards, targetRiseFt: riseOf(p), conditions: RD.conditionsOf(day), t0: now };
    const still = E.fly({ ...base, wind: [] }), windy = E.fly({ ...base, wind: day.wind });
    const lines = [
      `Air: ${day.tempF} F, ${day.pressureInHg} inHg at ${day.altitudeFt} ft, humidity ${Math.round(day.humidity * 100)}%.`,
      ...day.wind.map((w, i) => `Wind, ${['near', 'middle', 'far'][i]} stretch (${Math.round(w.fromYards)}–${Math.min(Math.round(w.toYards), course.steelTo)} yd): ${w.speedMph} mph ${RD.windWord(w.fromDegrees)}, gusting ${w.gustMph} mph every ${w.periodS} s.`),
      still.reached ? `Engine, ${p.yards} yd, this sight setting, no spread: ${RD.whereText(still.hit.upIn, still.hit.rightIn)} of the aim with no wind; with the wind ${RD.whereText(windy.hit.upIn, windy.hit.rightIn)} (drift ${(windy.hit.rightIn - still.hit.rightIn).toFixed(1)} in). Flight ${still.timeS.toFixed(2)} s, ${still.speedFps.toFixed(0)} fps at the plate (Mach ${still.mach.toFixed(2)}).` : `Engine: with this sight setting the bullet does not reach ${p.yards} yards.`,
      `Plate ${p.yards} yd sits ${riseOf(p).toFixed(0)} ft above the line (${((losAngle(p) * 180) / Math.PI).toFixed(1)}°); 1 MOA there is ${inchPerMoa(p.yards).toFixed(1)} in.`,
    ];
    $('conditions').textContent = lines.join('\n');
  }

  // --- controls -----------------------------------------------------------------------------------------
  function showSetting() {
    $('el-text').textContent = RD.clicksText(setting.elevationClicks, sight.clickMoa, 'up', 'down');
    $('wd-text').textContent = RD.clicksText(setting.windageClicks, sight.windageClickMoa, 'right', 'left');
    conditions();
  }
  function turn(which, delta) {
    const next = setting[which] + delta;
    if (Math.abs(next) > sight.clicks) { $('result').textContent = `That knob is at the end of its travel (${sight.clicks} clicks).`; return; }
    setting = { ...setting, [which]: next };
    RD.clickSound(); RD.setSight(rifleId, sightId, setting); showSetting(); zeroNote();
  }
  $('el-up').addEventListener('click', () => turn('elevationClicks', 1));
  $('el-down').addEventListener('click', () => turn('elevationClicks', -1));
  $('wd-right').addEventListener('click', () => turn('windageClicks', 1));
  $('wd-left').addEventListener('click', () => turn('windageClicks', -1));
  $('plate').addEventListener('change', (e) => { plateIx = Number(e.target.value); hold.up = 0; hold.right = 0; conditions(); });
  // Changing the load keeps the sight where it is (the brief's rule); restoring
  // that load's saved zero is the player's own press on the button below.
  $('load').addEventListener('change', (e) => { loadId = e.target.value; log = RD.getLog(rifleId, loadId); renderLog(); zeroNote(); $('to-zero').href = `/zero?course=${courseId}&rifle=${rifleId}&load=${loadId}`; conditions(); });
  $('use-zero').addEventListener('click', () => { const z = RD.getZero(rifleId, loadId); if (!z) return; setting = { elevationClicks: z.elevationClicks, windageClicks: z.windageClicks }; RD.setSight(rifleId, sightId, setting); RD.clickSound(); showSetting(); zeroNote(); });
  $('zoom').addEventListener('input', (e) => { mag = Number(e.target.value); zoomText(); });
  $('show-conditions').addEventListener('change', (e) => { RD.setShowConditions(e.target.checked); conditions(); });
  $('clear-log').addEventListener('click', () => { log = []; RD.setLog(rifleId, loadId, log); renderLog(); });
  const steadyOn = () => { steady = true; $('steady').classList.add('on'); };
  const steadyOff = () => { steady = false; $('steady').classList.remove('on'); };
  $('steady').addEventListener('pointerdown', (e) => { e.preventDefault(); steadyOn(); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('steady').addEventListener(ev, steadyOff);
  $('fire').addEventListener('click', () => { RD.audio(); fire(); });
  // Dragging the view moves the hold.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, up: hold.up, right: hold.right }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!drag) return; const k = pxPerMoa(); hold.right = drag.right - (e.clientX - drag.x) / k; hold.up = drag.up + (e.clientY - drag.y) / k; });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { drag = null; });
  window.addEventListener('keydown', (e) => { if (e.key === ' ' && document.activeElement === document.body) { e.preventDefault(); fire(); } });

  // --- the loop ------------------------------------------------------------------------------------------
  function frame() {
    const t = performance.now() / 1000;
    const dt = Math.min(0.05, t - last); last = t; now += dt;
    stepWander(dt);
    flash = Math.max(0, flash - dt * 4);
    for (let i = pending.length - 1; i >= 0; i--) if (now >= pending[i].at) land(pending.splice(i, 1)[0]);
    for (let i = dust.length - 1; i >= 0; i--) if (now - dust[i].bornAt > 3) dust.splice(i, 1);
    draw();
    requestAnimationFrame(frame);
  }
  applyZero(); renderLog(); conditions();
  requestAnimationFrame(frame);
  // For the screenshot run and tests: a way to read the state without guessing.
  window.RangeDayLine = { fire, get log() { return log; }, get pending() { return pending.length; }, get setting() { return setting; }, setHold(up, right) { hold.up = up; hold.right = right; }, setZoom(m) { mag = m; $('zoom').value = m; zoomText(); }, get plate() { return plate(); }, get day() { return day; } };
}());
