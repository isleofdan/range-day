'use strict';
/* The firing line: the view through the sight. The aim wanders the way a
   rested rifle does (small, slow, worse just after a shot); the player
   drags to hold off, holds Steady, presses Fire. The bullet takes its real
   flight time through the engine; a miss throws dust where it landed, a hit
   rings late by the flight time plus the sound's trip back. Recoil knocks
   the view off the plate for a moment. No drop or wind figure is given:
   wind shows only as heat shimmer leaning, brush moving and the dust's
   drift, unless the setting "Show the conditions" is on.

   Every shot comes out of the day's box (one load, so the load is fixed
   while the day is open); when the box is empty the day is over. A hit on
   steel writes one line in the data book by itself; the day's first shot
   at a plate goes in the cold-bore record; the wind call stated before the
   shot is written into its row and never changed.

   World coordinates on screen: minutes of angle (MOA) right and up of the
   aimed plate's center. The view's center is the reticle. */
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
  // The targets (range-day-ten): the steel plates every 100 yards (course.plates, in their order: the 3D picture and the tests count
  // them by index) and the near targets (course.near: paper at 50 and 100 yards, and on the canyon a 100-yard plate). The picker
  // lists the near ones first; each option's value is the target's key: a plate keeps its index ("0", "1", …), a near target is
  // "near-0", "near-1", …. A target says paper or steel; one without the word is steel.
  const plates = course.plates;
  const P = d.look.paper;
  const targets = [...(course.near || []).map((t, i) => ({ ...t, kind: RD.kindOf(t), key: `near-${i}` })), ...plates.map((p, i) => ({ ...p, kind: 'steel', key: String(i) }))];
  // The 3D picture's steel: the plates in their order, then the near steel; its paper: the near paper.
  const steelTargets = [...targets.filter((t) => t.kind === 'steel' && !t.key.startsWith('near')), ...targets.filter((t) => t.kind === 'steel' && t.key.startsWith('near'))];
  steelTargets.forEach((t, i) => { t.steelIx = i; });
  const paperTargets = targets.filter((t) => t.kind === 'paper');
  paperTargets.forEach((t, j) => { t.paperIx = j; });
  let target = targets.find((t) => t.key === '0'); // the first plate, as before the near targets
  let mag = sight.zoom.low;
  let setting = RD.getSight(rifleId, sightId);
  // The magnifier behind the dot (the Tavor SAR): flipped in or out. It has no
  // adjustments and no zero of its own; it only magnifies the dot's view.
  const magnifier = c.magnifierId && sight.kind === 'dot' ? d.sights[c.magnifierId] : null;
  const magnifierIn = () => Boolean(magnifier && setting.magnifier);
  const seed = RD.hash(courseId);
  const terrainRand = E.seeded(seed);
  const $ = (id) => document.getElementById(id);

  // If a zero is saved for this rifle and load, the sight starts there.
  function applyZero() {
    const z = RD.getZero(rifleId, sightId, loadId);
    let written = true;
    if (z && z !== RD.store.FAILED) { setting = { ...setting, elevationClicks: z.elevationClicks, windageClicks: z.windageClicks, ...(leaf && z.leafIx != null ? { leafIx: z.leafIx } : {}) }; written = RD.setSight(rifleId, sightId, setting); }
    showSetting(); zeroNote();
    if (!written) $('zero-note').textContent = 'Sight setting not saved on this device: the browser refused to store it. It holds while this page is open.';
  }
  // The note under the knobs: where the sight stands against this load's saved zero.
  function zeroNote() {
    const z = RD.getZero(rifleId, sightId, loadId);
    const btn = $('use-zero');
    if (z === RD.store.FAILED) { $('zero-note').textContent = 'Zero not saved on this device: the browser refused to read its storage. The sight starts at its middle and holds while this page is open.'; btn.hidden = true; return; }
    if (!z) { $('zero-note').textContent = 'No zero saved for this load: the sight is wherever it was last left. The zero bench is the place to fix that.'; btn.hidden = true; return; }
    const at = z.elevationClicks === setting.elevationClicks && z.windageClicks === setting.windageClicks && (!leaf || (z.leafIx || 0) === (setting.leafIx || 0));
    $('zero-note').textContent = at ? `Sight at the saved ${z.zeroYards}-yard zero for this load. Every click from here is yours.` : `The sight is not at this load's saved ${z.zeroYards}-yard zero (elevation ${RD.clicksText(z.elevationClicks, sight.clickMoa, 'up', 'down')}, windage ${RD.clicksText(z.windageClicks, sight.windageClickMoa, 'right', 'left')}); it stays where you left it.`;
    btn.hidden = at;
  }

  const steelYards = steelTargets.map((t) => t.yards), paperYards = paperTargets.map((t) => t.yards);
  $('intro').textContent = `${course.name.replace(/ \(modeled on.*\)$/, '')}, ${paperYards.length ? `paper at ${paperYards.join(' and ')} yards, ` : ''}steel ${Math.min(...steelYards)} to ${Math.max(...steelYards)} yards. ${rifle.name} with ${sight.name.replace(/ \(.*\)$/, '')}, ${d.loads[loadId].name.replace(/ \(.*\)$/, '')}.`;
  // The day in words and one number: the month, the time of day, the temperature. Never the wind.
  const dayLine = () => {
    let t = RD.dayWords(weather, d.weather);
    if (entered.redirected) t += ` A day is already open with the ${rifle.name} and ${d.loads[loadId].name} on the ${course.name.replace(/ \(modeled on.*\)$/, '')}, so that day is shown, not the one the address asked for.`;
    if (!entered.saved || RD.dayReadFailed()) t += ' The day is not saved on this device (the browser refused its storage); it holds while this page is open.';
    $('day-line').textContent = t;
    lineShort(t !== RD.dayWords(weather, d.weather));
  };
  // The short line at the top (range-day-nine): the rifle, the load's weight, the course and the day in a few words; a tap opens the
  // full description above over the page and a second tap closes it. A note about the day (another day shown, storage refused) is flagged here.
  function lineShort(note) {
    const grains = /(\d+ gr)\b/.exec(d.loads[loadId].name);
    const words = `${rifle.name.split(',')[0]}, ${grains ? grains[1] : d.loads[loadId].name.replace(/ \(.*\)$/, '')}, ${course.name.replace(/ \(.*\)$/, '')} · ${weather.tempF} F, ${RD.dayWords(weather, d.weather).replace(/^A (\w+)(, dry)? /, '').replace(/, -?\d+ F\.$/, '')}`; // "44 F, November morning": the temperature first, so a narrow screen cuts the month, not the figure
    $('line-short').textContent = note ? `A note on this day (tap to read) · ${words}` : words;
  }
  $('line-head').addEventListener('click', () => {
    const open = $('line-full').hidden;
    $('line-full').hidden = !open; $('line-head').setAttribute('aria-expanded', String(open));
  });
  dayLine();
  $('plate').innerHTML = targets.map((t) => `<option value="${t.key}">${t.yards} yards (${t.kind === 'paper' ? 'paper' : `${t.widthIn} × ${t.heightIn} in steel`})</option>`).join('');
  $('plate').value = target.key;
  const zeroHref = () => `/zero${RD.params(c)}`;
  $('to-zero').href = zeroHref();
  $('to-book').href = `/book${RD.params(c)}`;
  $('to-day').href = `/day?id=${encodeURIComponent(day.id)}`;
  if (sight.zoom.high === sight.zoom.low) $('zoomrow').hidden = true;
  else { $('zoom').min = sight.zoom.low; $('zoom').max = sight.zoom.high; $('zoom').value = mag; }
  const zoomText = () => { $('zoom-text').textContent = `${mag}×`; };
  zoomText();

  // --- state of the view ----------------------------------------------------------------
  const hold = { up: 0, right: 0 };      // where the player holds the reticle, MOA from the plate center
  const wander = { up: 0, right: 0, vu: 0, vr: 0, breath: 0 };
  const recoil = { up: 0, right: 0 };
  let steady = false, lastShotAt = -10, now = 0, last = performance.now() / 1000;
  const dust = [];                         // {rightMoa, upMoa, bornAt, yards}
  const pending = [];                      // shots in flight
  // The marks on the steel and the holes in the paper are read from the open day (RD.steelMarks, RD.paperHoles), so a reload loses none.
  let log = RD.getLog(rifleId, sightId, loadId);
  let flash = 0;
  let lastShotInput = null;
  let windCall = RD.wireWindCall(document); // a function answering the call as it stands

  const canvas = $('view');
  let view = RD.fitCanvas(canvas, 640);
  window.addEventListener('resize', () => { view = RD.fitCanvas(canvas, 640); if (typeof fitScene === 'function') fitScene(); });
  const plate = () => target;
  const inchPerMoa = (y) => E.inchesPerMoa(y);
  // Each plate's own height above the firing line (data/courses.json, riseFt):
  // the engine is given it (targetRiseFt) and the drawing uses the same figure.
  const riseOf = (p) => p.riseFt;
  const losAngle = (p) => Math.atan2(riseOf(p), p.yards * 3);
  const sideAngle = (p) => Math.atan2(p.lateralYd, p.yards);
  const toMoa = (rad) => (rad * 180 * 60) / Math.PI;
  // The plate's rectangle in MOA.
  const plateMoa = (p) => ({ w: p.widthIn / inchPerMoa(p.yards), h: p.heightIn / inchPerMoa(p.yards) });
  // Where a plate sits, in MOA relative to the aimed plate's center: by its
  // angle as seen from the firing line, sideways and upward.
  function plateAt(p) {
    const a = plate();
    return { up: toMoa(losAngle(p) - losAngle(a)), right: toMoa(sideAngle(p) - sideAngle(a)) };
  }
  // The ground: the plates stand on it, so between plates it runs straight
  // from one plate's height to the next (from the firing line's own level at
  // 0 yards, and on past the last plate at the last stretch's slope).
  function groundRiseFt(yards) {
    const pts = [{ yards: 0, riseFt: 0 }, ...plates];
    for (let i = 1; i < pts.length; i++) if (yards <= pts[i].yards) { const a = pts[i - 1], b = pts[i]; return a.riseFt + ((b.riseFt - a.riseFt) * (yards - a.yards)) / (b.yards - a.yards); }
    const a = pts[pts.length - 2], b = pts[pts.length - 1];
    return b.riseFt + ((b.riseFt - a.riseFt) * (yards - b.yards)) / (b.yards - a.yards);
  }
  const groundUpMoa = (yards) => toMoa(Math.atan2(groundRiseFt(yards), yards * 3) - losAngle(plate()));
  // Haze: things pale toward the sky's colour with distance.
  const hazeOf = (yards) => Math.max(0, Math.min(0.62, 0.05 + 0.5 * (yards / 1000)));
  const mix = (a, b, f) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',')})`;
  const HAZE = [205, 200, 190];
  // The field of view across the drawn view, in MOA: the sight's at this zoom; the magnifier's when it is flipped in.
  const fovMoa = () => (magnifierIn() ? (magnifier.fovFtAt100.high * 12) / E.inchesPerMoa(100) : RD.fovMoa(sight, mag));
  const viewMag = () => (magnifierIn() ? magnifier.magnification : mag);
  const pxPerMoa = () => view.size / fovMoa();
  // Where the reticle points right now: the hold, the wander, the breathing
  // and the recoil. The view is drawn from this and the shot is fired from
  // this, the same state, so the bullet goes where the sight showed.
  const center = () => ({ up: hold.up + wander.up + wander.breath + recoil.up, right: hold.right + wander.right + recoil.right });
  const toScreen = (rightMoa, upMoa) => { const c = center(), k = pxPerMoa(); return [view.size / 2 + (rightMoa - c.right) * k, view.size / 2 - (upMoa - c.up) * k]; };

  // --- the aim's wander: slow, small, worse after a shot, calmer when held steady ----------
  function stepWander(dt) {
    const since = now - lastShotAt;
    const amp = 0.35 * (steady ? 0.35 : 1) * (1 + 3 * Math.exp(-Math.max(0, since) / 2.5)) * (sight.aimWanderFactor || 1);
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
  const far = Array.from({ length: 40 }, () => terrainRand());
  // The real sizes of the berms, boards and brush (data/physics.json, scenery).
  const S = d.physics.scenery;
  // Brush: each bush stands at its own distance on the ground, a few feet
  // tall, so it shrinks with distance by the same scale as the plates.
  const farYards = plates[plates.length - 1].yards;
  const brush = Array.from({ length: 220 }, () => {
    const yards = S.brushNearestYd + Math.sqrt(terrainRand()) * (farYards + 300);
    return { yards, sideMoa: (terrainRand() - 0.5) * 2 * toMoa(Math.atan2(40 + yards * 0.25, yards)), ft: S.brushHeightFt.low + terrainRand() * (S.brushHeightFt.high - S.brushHeightFt.low), ph: terrainRand() * 6.3, lift: terrainRand() * 0.6 };
  }).sort((a, b) => b.yards - a.yards);
  const profile = (arr, azMoa, amp, wavelength) => { const i = (azMoa / wavelength) % arr.length; const a = Math.floor(((i % arr.length) + arr.length) % arr.length), b = (a + 1) % arr.length; const f = ((i % 1) + 1) % 1; return (arr[a] * (1 - f) + arr[b] * f) * amp; };
  const crossMph = () => RD.crosswindMph(weather.wind[Math.min(2, Math.floor((plate().yards / course.steelTo) * 3))]);
  // The sideways angle of the aimed plate, so the scene's own azimuths (from straight downrange) line up with the view.
  const azOf = (sideMoa) => sideMoa - toMoa(sideAngle(plate()));
  // The holes shown on a paper, as the drawing takes them.
  const load = d.loads[loadId];
  const holesOf = (t) => RD.paperHoles(day, t).map((s) => ({ upIn: s.upIn, rightIn: s.rightIn, holeIn: RD.holeIn(load), burstIn: RD.burstIn(load, P), seed: RD.hash(`${day.id}:${s.n}`) }));

  // --- the picture: Full, Light or Plain ---------------------------------------------------------
  // Full and Light are the 3D scene (public/scene.min.js) on the surveyed
  // ground, drawn in the canvas under this one at exactly this view's
  // angular scale; Plain is the drawing below. The setting lives on the
  // device; the first visit picks Full or Light by counting frames; a
  // browser that cannot draw 3D, or a scene that fails, shows Plain and
  // says so. Under every picture the same plate data goes to the engine.
  const sceneCanvas = $('scene');
  let scene = null, picture = RD.getPicture(), sceneLoading = false, measuring = null, sceneFailed = false;
  const sceneOn = () => Boolean(scene);
  const pictureNote = (text) => { $('picture-note').textContent = text; $('picture-note').hidden = !text; };
  const canScene = Boolean(d.terrain && d.terrain[courseId] && course.firing && course.pictureReady === true && d.look);
  function fitScene() { const dpr = Math.min(window.devicePixelRatio || 1, 2); sceneCanvas.style.width = `${view.size}px`; sceneCanvas.style.height = `${view.size}px`; if (scene) scene.resize(view.size, dpr); }
  const loadSceneScript = () => new Promise((resolve, reject) => { if (window.RangeDayScene) return resolve(); const el = document.createElement('script'); el.src = '/scene.min.js'; el.onload = resolve; el.onerror = () => reject(new Error('the picture\'s script did not load')); document.head.appendChild(el); });
  async function startScene(quality) {
    if (!canScene) { showPlain('This course has no full picture yet; showing the plain one.'); return; }
    sceneLoading = true;
    try {
      await loadSceneScript();
      if (!window.RangeDayScene.canDraw()) throw new Error('no 3D context');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const next = await window.RangeDayScene.create({ canvas: sceneCanvas, size: view.size, dpr, course: { ...course, plates: steelTargets, papers: paperTargets }, paintPaper: (g, wPx, hPx, t, holes) => RD.drawPaper(g, wPx / 2, hPx / 2, wPx / t.widthIn, t.widthIn, t.heightIn, holes, P), terrain: d.terrain[courseId], surfaces: d.terrain.surfaces, look: d.look, physics: d.physics, weather, month: day.month, timeOfDay: day.timeOfDay, quality });
      if (scene) scene.dispose();
      scene = next;
      // the day's marks on the steel and holes in the paper, as they stand: the picture is new, the day is not
      for (const t of steelTargets) for (const m of RD.steelMarks(day, t)) scene.strike(t.steelIx, m.upIn, m.rightIn, true);
      for (const t of paperTargets) scene.setPaper(t.paperIx, holesOf(t));
      sceneCanvas.hidden = false; canvas.parentElement.classList.add('scene-on');
      pictureNote('');
    } catch (e) {
      sceneFailed = true;
      showPlain('This device could not draw the full picture; showing the plain one.');
      if (window.Sentry && window.Sentry.captureException) try { window.Sentry.captureException(e); } catch {}
    }
    sceneLoading = false;
  }
  function showPlain(note) {
    if (scene) { scene.dispose(); scene = null; }
    sceneCanvas.hidden = true; canvas.parentElement.classList.remove('scene-on');
    pictureNote(note || '');
  }
  // The first visit: draw Full for two seconds, count the frames, keep Full or fall back to Light; the choice is kept on the device.
  function choosePicture() {
    const F = d.look && d.look.firstVisit;
    if (picture === 'plain' || !canScene) { showPlain(''); $('picture').value = picture || 'plain'; return; }
    if (picture) { $('picture').value = picture; startScene(picture); return; }
    $('picture').value = 'full';
    startScene('full').then(() => { if (scene) measuring = { until: now + F.measureS, frames: 0, start: now }; });
  }
  function measured() {
    const F = d.look.firstVisit;
    const fps = measuring.frames / Math.max(0.5, now - measuring.start);
    measuring = null;
    picture = fps < F.minFps ? 'light' : 'full';
    if (!RD.setPicture(picture)) pictureNote('The picture setting is not saved on this device (the browser refused its storage).');
    $('picture').value = picture;
    if (picture === 'light') startScene('light');
  }
  $('picture').addEventListener('change', (e) => {
    picture = e.target.value; measuring = null;
    if (!RD.setPicture(picture)) pictureNote('The picture setting is not saved on this device (the browser refused its storage).');
    if (picture === 'plain') showPlain(''); else startScene(picture);
  });
  if (RD.pictureReadFailed()) pictureNote('The picture setting could not be read on this device (the browser refused its storage); the plain picture is shown.');
  // The 3D view: the sight's own aim, as absolute angles from the line of fire.
  function syncScene() {
    if (!scene) return;
    const c = center(), a = plate();
    scene.setView({ yawDeg: (toMoa(sideAngle(a)) + c.right) / 60, pitchDeg: (toMoa(losAngle(a)) + c.up) / 60, fovDeg: fovMoa() / 60, glass: sight.kind === 'scope' || magnifierIn(), windMph: crossMph() });
  }

  function draw() {
    const { g, size } = view;
    const k = pxPerMoa();
    const c = center();
    g.save();
    if (sceneOn()) {
      // The scene below draws the ground, the sky, the plates and the brush at this same scale; this canvas draws only what moves on top of it.
      // A scene that fails in a frame (a lost 3D context, a thrown shader) falls to the plain picture, with the one line, and this frame draws plain.
      let drawn = false;
      try { syncScene(); scene.render(now); drawn = true; } catch (e) {
        sceneFailed = true; measuring = null;
        showPlain('This device could not draw the full picture; showing the plain one.');
        if (window.Sentry && window.Sentry.captureException) try { window.Sentry.captureException(e); } catch {}
      }
      if (drawn) {
        g.clearRect(0, 0, size, size);
        if (measuring) { measuring.frames++; if (now >= measuring.until) measured(); }
        drawDust(g, size, k);
        if (flash > 0) { g.fillStyle = `rgba(255, 230, 180, ${flash})`; g.fillRect(0, 0, size, size); }
        g.restore();
        drawSight(g, size, k);
        return;
      }
    }
    // sky
    const sky = g.createLinearGradient(0, 0, 0, size);
    sky.addColorStop(0, '#9fc2e6'); sky.addColorStop(1, '#e7e3d2');
    g.fillStyle = sky; g.fillRect(0, 0, size, size);
    // far hills: a pale ridge well above the last plates
    const farTop = groundUpMoa(farYards * 1.6);
    g.fillStyle = mix([158, 146, 118], HAZE, 0.55);
    g.beginPath(); g.moveTo(0, size);
    for (let x = 0; x <= size; x += 8) { const az = c.right + (x - size / 2) / k; const up = farTop + 40 + profile(far, az + 4000, 110, 90); g.lineTo(x, size / 2 - (up - c.up) * k); }
    g.lineTo(size, size); g.closePath(); g.fill();
    // the ground, in bands from far to near: each band's top edge is the
    // ground's angle at that distance, paler and hazier the farther it is
    const bands = [];
    for (let y = farYards * 1.6; y >= 40; y -= y > 400 ? 50 : 25) bands.push(y);
    for (const y of bands) {
      const up = groundUpMoa(y);
      const amp = (S.groundRoughnessFt * 12) / inchPerMoa(y); // the ground's unevenness, at that distance
      const base = y > 150 ? [176, 138, 90] : [150, 114, 70];
      g.fillStyle = mix(base, HAZE, hazeOf(y));
      g.beginPath(); g.moveTo(0, size);
      for (let x = 0; x <= size; x += 6) { const az = c.right + (x - size / 2) / k; g.lineTo(x, size / 2 - (up + profile(ridge, az * (y / 300) + y, amp, 40) - c.up) * k); }
      g.lineTo(size, size); g.closePath(); g.fill();
    }
    const wind = crossMph();
    // each plate's bare dirt berm, behind the plate, at its own distance
    steelTargets.forEach((p) => {
      const at = plateAt(p), ipm = inchPerMoa(p.yards), m = plateMoa(p);
      const bermW = (S.bermWidthFt * 12) / ipm, bermH = (S.bermHeightFt * 12) / ipm;
      const foot = at.up - m.h / 2 - m.h * S.postHeightShareOfPlate; // the post's foot, where the plate's ground is
      const [x, y] = toScreen(at.right, foot);
      g.fillStyle = mix([128, 96, 62], HAZE, hazeOf(p.yards));
      g.beginPath(); g.ellipse(x, y + bermH * k * 0.15, Math.max(2, (bermW / 2) * k), Math.max(1, bermH * k), 0, Math.PI, 0); g.fill();
    });
    // brush: dark dabs standing on the ground at their distance, swaying with the wind
    for (const b of brush) {
      const sway = Math.sin(now * (1.5 + b.ft * 0.3) + b.ph) * wind * 0.004 * (300 / b.yards);
      const hMoa = (b.ft * 12) / inchPerMoa(b.yards);
      const [x, y] = toScreen(azOf(b.sideMoa) + sway, groundUpMoa(b.yards) + hMoa * (0.5 + b.lift));
      if (x < -20 || x > size + 20 || y < -20 || y > size + 20) continue;
      const r = Math.max(0.6, hMoa * k * 0.5);
      g.fillStyle = mix([79, 90, 47], HAZE, hazeOf(b.yards)); g.beginPath(); g.ellipse(x, y, r * 1.1, r * 0.8, 0, 0, 7); g.fill();
    }
    // the plates on their posts, each at its real angular size, with a yardage board beside each
    steelTargets.forEach((p) => {
      const at = plateAt(p), m = plateMoa(p), ipm = inchPerMoa(p.yards), haze = hazeOf(p.yards);
      const [x, y] = toScreen(at.right, at.up);
      const w = Math.max(1, m.w * k), h = Math.max(1, m.h * k);
      g.fillStyle = mix([90, 74, 58], HAZE, haze); g.fillRect(x - Math.max(0.5, w * 0.06), y + h / 2, Math.max(1, w * 0.12), h * S.postHeightShareOfPlate);
      g.fillStyle = mix(p === target ? [217, 214, 207] : [185, 181, 173], HAZE, haze); g.fillRect(x - w / 2, y - h / 2, w, h);
      g.strokeStyle = mix([58, 58, 58], HAZE, haze); g.lineWidth = Math.min(1.5, w * 0.05); g.strokeRect(x - w / 2, y - h / 2, w, h);
      // the yardage board, at its real size, beside the plate
      const bw = (S.boardWidthIn / ipm) * k, bh = (S.boardHeightIn / ipm) * k;
      const [bx, by] = toScreen(at.right + m.w / 2 + S.boardRightOfPlateIn / ipm, at.up - m.h / 2 - m.h * S.postHeightShareOfPlate + (S.boardAboveGroundIn + S.boardHeightIn / 2) / ipm);
      g.fillStyle = mix([245, 242, 232], HAZE, haze); g.fillRect(bx, by - bh / 2, bw, bh);
      g.strokeStyle = mix([40, 40, 40], HAZE, haze); g.lineWidth = Math.min(1, bw * 0.03); g.strokeRect(bx, by - bh / 2, bw, bh);
      if (bh >= 7) { g.fillStyle = mix([20, 20, 20], HAZE, haze); g.font = `bold ${bh * 0.72}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(p.yards), bx + bw / 2, by + bh * 0.04); }
      for (const mk of RD.steelMarks(day, p)) { const [mx, my] = toScreen(at.right + mk.rightIn / ipm, at.up + mk.upIn / ipm); g.fillStyle = '#f3f1ea'; g.beginPath(); g.arc(mx, my, Math.max(1, 0.5 * k / 1.047), 0, 7); g.fill(); }
    });
    // the paper (range-day-ten): each sheet on its white board, the board on two dark posts down to its ground, the sheet drawn by
    // the one paper drawing (game.js, drawPaper) with the day's holes, at the view's scale
    paperTargets.forEach((p) => {
      const at = plateAt(p), ipm = inchPerMoa(p.yards), ppi = k / ipm, haze = hazeOf(p.yards);
      const T = d.look.things;
      const footUp = at.up - (P.sheetCentreAboveBoardFootIn / ipm); // the board's foot, MOA
      const groundUp = footUp - ((P.boardFootAboveGroundM + (p.onMoundM || 0)) / 0.0254) / ipm;
      const [bx, bFoot] = toScreen(at.right, footUp);
      const [, gy] = toScreen(at.right, groundUp);
      const bw = T.boardWidthIn * ppi, bh = T.boardHeightIn * ppi;
      if (bx < -bw || bx > size + bw) return;
      g.fillStyle = mix([74, 63, 54], HAZE, haze);
      for (const sx of [-0.35, 0.35]) g.fillRect(bx + sx * bw - Math.max(0.5, ppi), bFoot, Math.max(1, 2 * ppi), Math.max(1, gy - bFoot));
      g.fillStyle = mix([238, 234, 222], HAZE, haze); g.fillRect(bx - bw / 2, bFoot - bh, bw, bh);
      const [sx, sy] = toScreen(at.right, at.up);
      RD.drawPaper(g, sx, sy, ppi, p.widthIn, p.heightIn, holesOf(p), P);
    });
    drawDust(g, size, k);
    // heat shimmer leaning with the wind (seen through magnification)
    if (viewMag() >= 2.5) {
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

  function drawDust(g, size, k) {
    // dust from misses: a puff of the data's size in feet (data/physics.json,
    // dust), drawn through the same scale as the plate at this distance, so
    // it is the same puff at every zoom and through every sight: it grows
    // from startFt to endFt across over lifeS seconds, rises riseFt, drifts
    // with the wind and thins away.
    const D = d.physics.dust;
    const wind = crossMph();
    for (const p of dust) {
      const age = now - p.bornAt;
      const off = p.t ? plateAt(p.t) : { up: 0, right: 0 }; // where the dust's target stands from the one aimed at now
      if (age > D.lifeS) continue;
      const f = age / D.lifeS;
      const ipm = inchPerMoa(p.yards);
      const widthMoa = ((D.startFt + (D.endFt - D.startFt) * f) * 12) / ipm;
      const riseMoa = (D.riseFt * 12 * f) / ipm;
      const drift = (D.driftFraction * wind * 1.4667 * age) / (p.yards * 3) * 3438; // ft/s × s over the distance, in MOA
      const alpha = Math.max(0, 0.85 * (1 - f) * (1 - f * 0.3));
      for (let j = 0; j < 9; j++) {
        const jr = (((j * 37) % 11) / 11 - 0.5) * (0.5 + 0.5 * f), ju = (((j * 53) % 7) / 7) * 0.6 - 0.15;
        const [x, y] = toScreen(off.right + p.rightMoa + jr * widthMoa + drift, off.up + p.upMoa + riseMoa + ju * widthMoa * 0.7);
        const r = Math.max(1.5, widthMoa * k * (0.18 + 0.08 * ((j * 29) % 5) / 5));
        const puff = g.createRadialGradient(x, y, 0, x, y, r);
        puff.addColorStop(0, `rgba(222, 200, 160, ${alpha})`); puff.addColorStop(1, 'rgba(222, 200, 160, 0)');
        g.fillStyle = puff; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      }
    }
  }

  // Every sight picture is a drawing of angles: a mark, a dot or a post is
  // so many MOA wide at the view's scale (k pixels per MOA), nothing more.
  // The bullet still flies through the engine from the sight's setting.
  function drawSight(g, size, k) {
    const cx = size / 2, cy = size / 2;
    if (sight.kind === 'dot') return drawDot(g, size, k, cx, cy);
    if (sight.kind === 'scope') {
      // the tube: black outside the circle
      g.save(); g.beginPath(); g.rect(0, 0, size, size); g.arc(cx, cy, cx - 4, 0, Math.PI * 2, true); g.fillStyle = '#050505'; g.fill('evenodd'); g.restore();
      const tube = g.createRadialGradient(cx, cy, (cx - 4) * 0.93, cx, cy, cx - 4);
      tube.addColorStop(0, 'rgba(0,0,0,0)'); tube.addColorStop(1, 'rgba(0,0,0,0.6)');
      g.fillStyle = tube; g.beginPath(); g.arc(cx, cy, cx - 4, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, cx - 4, 0, Math.PI * 2); g.stroke();
      if (sight.reticle && sight.reticle.kind === 'mil-dot') return drawMilDot(g, size, k, cx, cy);
      if (sight.reticle && sight.reticle.marksMoaBelowZero) return drawDropReticle(g, size, k, cx, cy);
      return;
    }
    if (sight.apertureMoa > 0) return drawRingAndPost(g, size, k, cx, cy);
    return drawNotchAndPost(g, size, k, cx, cy);
  }

  // Open sights: the rear notch, soft because it is near the eye, its top
  // edge level with the center; the front post standing in the notch with
  // its top at the center, light either side of it. A bead-fronted sight
  // (the .22) has a round bead on a thinner stem. The notch's width and
  // depth, the post's width and the stem's width are the data's minutes of
  // angle at the view's scale. The
  // leaf behind the notch is not drawn: raising it raises the whole rear
  // sight, and the shooter re-aligns post and notch, so the picture is the
  // same and only the bore's angle changes (through the engine).
  // Which side of the front post the sun lights: the sun's side of the line of fire when the picture knows the sun; else the left.
  const sunOnRight = () => { if (!scene || !scene.sun || !course.firing) return false; const rel = ((scene.sun.azimuth - course.firing.bearingDeg) % 360 + 360) % 360; return rel < 180; };
  // Dark steel close to the eye, out of focus: a soft sheen from the sky down its face.
  const steelFace = (g, x0, y0, x1, y1) => { const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, '#2c2e30'); gr.addColorStop(0.35, '#1b1a17'); gr.addColorStop(1, '#100f0c'); g.fillStyle = gr; g.fillRect(x0, y0, x1 - x0, y1 - y0); };
  function drawNotchAndPost(g, size, k, cx, cy) {
    const notchW = sight.notchMoa * k, depth = sight.notchDepthMoa * k;
    const postW = sight.frontPostMoa * k;
    const bead = Boolean(sight.frontBead);
    const blur = size * 0.009; // the rear sight is a hand's length from the eye: well out of focus
    // the rear sight blade: everything below the center line, except the notch, is its dark face; blurred, so the notch's corners round and the edges soften, its angles unchanged
    g.save();
    if ('filter' in g) g.filter = `blur(${blur.toFixed(1)}px)`;
    steelFace(g, -blur * 2, cy, cx - notchW / 2, size + blur * 2);
    steelFace(g, cx + notchW / 2, cy, size + blur * 2, size + blur * 2);
    steelFace(g, cx - notchW / 2, cy + depth, cx + notchW / 2, size + blur * 2);
    // the blade's top edge catches the sky: a thin paler line along it
    g.fillStyle = 'rgba(120,128,136,0.35)';
    g.fillRect(-blur * 2, cy, cx - notchW / 2 + blur * 2, blur * 0.6); g.fillRect(cx + notchW / 2, cy, cx, blur * 0.6);
    g.restore();
    // the blade's shoulders fade upward a little: nearness to the eye
    const haze = g.createLinearGradient(0, cy - notchW * 0.25, 0, cy);
    haze.addColorStop(0, 'rgba(23,21,15,0)'); haze.addColorStop(1, 'rgba(23,21,15,0.3)');
    g.fillStyle = haze; g.fillRect(0, cy - notchW * 0.25, size, notchW * 0.25);
    // the front post (or bead and stem), sharper, its top at the center, one face in the sun and one in shade
    g.save();
    if ('filter' in g) g.filter = `blur(${(size * 0.0016).toFixed(2)}px)`;
    const lit = sunOnRight();
    const faces = (x, w, y0) => { const gr = g.createLinearGradient(x, 0, x + w, 0); gr.addColorStop(0, lit ? '#0b0b0b' : '#30302d'); gr.addColorStop(0.5, '#141413'); gr.addColorStop(1, lit ? '#30302d' : '#0b0b0b'); g.fillStyle = gr; g.fillRect(x, y0, w, size); };
    if (bead) {
      const stemW = sight.stemWidthMoa * k;
      faces(cx - stemW / 2, stemW, cy + postW * 0.45);
      const bg = g.createRadialGradient(cx - postW * 0.2 * (lit ? -1 : 1), cy + postW * 0.4, 0, cx, cy + postW / 2, postW / 2);
      bg.addColorStop(0, '#3a3a36'); bg.addColorStop(1, '#0d0d0d');
      g.fillStyle = bg; g.beginPath(); g.arc(cx, cy + postW / 2, postW / 2, 0, Math.PI * 2); g.fill();
    } else {
      faces(cx - postW / 2, postW, cy);
      g.fillStyle = 'rgba(150,150,145,0.5)'; g.fillRect(cx - postW / 2, cy, postW, Math.max(0.6, size * 0.0015));
    }
    g.restore();
  }

  // A red dot: an unmagnified view through a round window, the dot covering
  // the data's minutes of angle at every distance. No crosshair, no marks.
  // Outside the window the world is still there (the other eye sees it),
  // dimmed by the sight's body; with the magnifier flipped in, the view is
  // a tube: black outside, the window and the dot both magnified. The glass
  // carries a faint tint and the housing's edge a darker rim.
  function drawDot(g, size, k, cx, cy) {
    const r = cx - 4;
    g.save(); g.beginPath(); g.rect(0, 0, size, size); g.arc(cx, cy, r, 0, Math.PI * 2, true);
    g.fillStyle = magnifierIn() ? '#050505' : 'rgba(30, 26, 22, 0.82)'; g.fill('evenodd'); g.restore();
    // the housing's edge: a dark rim shading inward, with a thin paler line where the metal catches the light
    const rim = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r);
    rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(0.7, 'rgba(0,0,0,0.25)'); rim.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.9)'; g.lineWidth = magnifierIn() ? 3 : 6; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(110,112,115,0.35)'; g.lineWidth = 1; g.beginPath(); g.arc(cx, cy, r - (magnifierIn() ? 1.5 : 3), 0, Math.PI * 2); g.stroke();
    // a faint tint on the glass, a touch bluer and a little brighter toward the top where it reflects the sky
    const tint = g.createLinearGradient(0, cy - r, 0, cy + r);
    tint.addColorStop(0, 'rgba(140, 170, 255, 0.09)'); tint.addColorStop(1, 'rgba(120, 150, 255, 0.04)');
    g.fillStyle = tint; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    const dot = sight.dotMoa * k; // the dot's width: the data's MOA at the view's scale, however small
    g.fillStyle = 'rgba(255, 60, 40, 0.35)'; g.beginPath(); g.arc(cx, cy, dot / 2 + 1.2, 0, Math.PI * 2); g.fill(); // a thin bloom, as a bright dot has
    g.fillStyle = 'rgb(255, 36, 28)'; g.beginPath(); g.arc(cx, cy, Math.max(0.6, dot / 2), 0, Math.PI * 2); g.fill();
  }

  // The mil-dot reticle: fine crosshair, dots every 3.44 MOA, heavy posts outside.
  function drawMilDot(g, size, k, cx, cy) {
    const dot = sight.reticle.dotSpacingMoa * k;
    g.strokeStyle = '#111'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, cy); g.lineTo(size, cy); g.moveTo(cx, 0); g.lineTo(cx, size); g.stroke();
    g.fillStyle = '#111';
    for (let i = 1; i <= 5; i++) for (const [x, y] of [[cx + i * dot, cy], [cx - i * dot, cy], [cx, cy + i * dot], [cx, cy - i * dot]]) { g.beginPath(); g.arc(x, y, Math.max(1.2, 0.2 * k), 0, 7); g.fill(); }
    g.lineWidth = Math.max(3, 1.0 * k);
    const post = 5.5 * dot;
    g.beginPath(); g.moveTo(0, cy); g.lineTo(cx - post, cy); g.moveTo(cx + post, cy); g.lineTo(size, cy); g.moveTo(cx, 0); g.lineTo(cx, cy - post); g.moveTo(cx, cy + post); g.lineTo(cx, size); g.stroke();
  }

  // The ACSS drop reticle (the 3x prism sight): drawn from data/sights.json
  // and only what the manual's text supports: a chevron whose tip is the
  // zero point (50 yards), its base the 200-yard hold, then a hold mark at
  // each distance the manual names, each at its derived angle below the
  // tip; the chevron's and the marks' widths are the data's figures too. Left out, because the text does not describe them: the ranging
  // ladder, wind holds, numbers beside the marks, the outer crosshair and
  // the illumination. The marks are angles for the manual's load; with the
  // loads in the set the bullet lands where the engine says.
  function drawDropReticle(g, size, k, cx, cy) {
    const marks = sight.reticle.marksMoaBelowZero;
    const base = marks.find((m) => m.yards === sight.reticle.marksYards[0]) || marks[0];
    const baseY = cy + base.moaBelowZero * k;
    const halfW = sight.reticle.chevronHalfWidthMoa * k; // the chevron's half-width at its base (data/sights.json)
    g.strokeStyle = '#111'; g.lineWidth = Math.max(1.2, 0.25 * k); g.lineJoin = 'miter';
    g.beginPath(); g.moveTo(cx - halfW, baseY); g.lineTo(cx, cy); g.lineTo(cx + halfW, baseY); g.stroke();
    // the hold marks below the chevron
    const tick = sight.reticle.markHalfWidthMoa * k;
    for (const m of marks) {
      if (m === base) continue;
      const y = cy + m.moaBelowZero * k;
      g.beginPath(); g.moveTo(cx - tick, y); g.lineTo(cx + tick, y); g.stroke();
    }
  }

  // Iron sights with a ring: the rear aperture's circle, dark and soft around it; the front post rising to the center.
  function drawRingAndPost(g, size, k, cx, cy) {
    const r = (sight.apertureMoa * k) / 2;
    // the aperture's disc: the ring is right at the eye, so its edge is a soft dark fade, its inner edge faintly paler where the sky reaches the metal
    const ring = g.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.25);
    ring.addColorStop(0, 'rgba(0,0,0,0)'); ring.addColorStop(0.3, 'rgba(25,26,28,0.55)'); ring.addColorStop(1, 'rgba(8,8,8,0.97)');
    g.fillStyle = ring; g.fillRect(0, 0, size, size);
    const w = sight.frontPostMoa * k;
    const lit = sunOnRight();
    g.save();
    if ('filter' in g) g.filter = `blur(${(size * 0.0016).toFixed(2)}px)`;
    const gr = g.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0); gr.addColorStop(0, lit ? '#0b0b0b' : '#30302d'); gr.addColorStop(0.5, '#141413'); gr.addColorStop(1, lit ? '#30302d' : '#0b0b0b');
    g.fillStyle = gr; g.fillRect(cx - w / 2, cy, w, size);
    g.fillStyle = 'rgba(150,150,145,0.5)'; g.fillRect(cx - w / 2, cy, w, Math.max(0.6, size * 0.0015));
    g.restore();
    // the post's protective wings, blurred by nearness to the eye
    g.save();
    if ('filter' in g) g.filter = `blur(${(size * 0.008).toFixed(1)}px)`;
    g.fillStyle = 'rgba(20,20,20,0.4)';
    g.fillRect(cx - w * 2.6, cy - w * 0.4, w * 0.5, size); g.fillRect(cx + w * 2.1, cy - w * 0.4, w * 0.5, size);
    g.restore();
  }

  // --- the shot -----------------------------------------------------------------------------
  // fire(): the player's shot, from where the reticle points now. The tests'
  // door, fire(seed), takes the aim from the hold alone (no wander, no
  // breathing, no recoil) and a seeded draw, so two shots can be compared;
  // the bullet still flies through the engine exactly as the player's does
  // (the gusts are read at the clock's zero, so the wind is the same too).
  // The box. When it is empty the screen says so and stays: "Open another box" goes on with the same day; nothing moves by itself.
  const boxEmpty = () => Boolean(day.endedAt) || day.box.left <= 0;
  const rounds = () => { $('rounds').textContent = RD.roundsText(day); $('fire').classList.toggle('spent', boxEmpty()); $('another-box-row').hidden = !boxEmpty(); };
  function fire(seed) {
    if (pending.length > 2) return;
    if (boxEmpty()) { $('result').textContent = `The box of ${day.box.size} is empty. Open another box to go on, or pack up; the day's page has every shot.`; return; }
    if (!RD.takeRounds(day, 1)) { rounds(); return; }
    rounds();
    const p = plate(), load = d.loads[loadId];
    // Everything the row and the book record is read now, at the trigger pull, never after.
    const call = windCall();
    const shown = RD.showConditions();
    const setAt = { ...setting };
    const zeroAt = RD.getZero(rifleId, sightId, loadId);
    const first = day.shots.length === 0 && pending.length === 0;
    // Where the reticle points, in MOA from the plate's center, at the trigger pull.
    const aim = seed == null ? center() : { up: hold.up, right: hold.right };
    const aimUp = aim.up, aimRight = aim.right;
    const r = E.shoot({
      rand: seed == null ? undefined : E.seeded(seed),
      load, drag: d.physics.dragTables, powder: d.physics.powderTemperature,
      rifle: { sightHeightIn: rifle.sightHeightIn[sightId], boreOffsetMoa: { up: rifle.boreOffsetMoa.up + leafMoa(), right: rifle.boreOffsetMoa.right } },
      sight: { clickMoa: sight.clickMoa, windageClickMoa: sight.windageClickMoa, elevationClicks: setting.elevationClicks, windageClicks: setting.windageClicks },
      targetYards: p.yards, targetRiseFt: riseOf(p), conditions: RD.conditionsOf(weather), wind: weather.wind, t0: seed == null ? now : 0,
    });
    lastShotInput = { targetYards: p.yards, targetRiseFt: riseOf(p), sightHeightIn: rifle.sightHeightIn[sightId], muzzleFps: r.muzzleFps, tempF: weather.tempF };
    RD.shotSound(1);
    flash = 0.9;
    recoil.up += 14 * rifle.recoilFactor * (0.8 + Math.random() * 0.4); recoil.right += 4 * rifle.recoilFactor * (0.5 + Math.random());
    lastShotAt = now;
    const ipm = inchPerMoa(p.yards);
    const entry = { n: log.length + 1, yards: p.yards, target: p.kind, el: setAt.elevationClicks, wd: setAt.windageClicks, leaf: leaf ? leaf.settingsMeters[setAt.leafIx || 0] : undefined, zoom: mag, heldUp: Math.round(aimUp * 10) / 10, heldRight: Math.round(aimRight * 10) / 10, day: day.id, tempF: weather.tempF, call: call.from == null ? null : { from: call.from, mph: call.from === 'none' ? 0 : call.mph }, conditionsShown: shown };
    // The shot's number in the day is given now, at the trigger pull, so two bullets in the air keep the order they were fired in.
    const shot = { n: day.shots.length + pending.length + 1, place: 'line', yards: p.yards, target: p.kind, sight: sightId, elevationClicks: setAt.elevationClicks, windageClicks: setAt.windageClicks, elevationMoa: Math.round((setAt.elevationClicks * sight.clickMoa + leafMoa()) * 100) / 100, windageMoa: Math.round(setAt.windageClicks * sight.windageClickMoa * 100) / 100, leaf: entry.leaf ?? null, zero: zeroAt && zeroAt !== RD.store.FAILED ? { zeroYards: zeroAt.zeroYards, elevationClicks: zeroAt.elevationClicks, windageClicks: zeroAt.windageClicks, leafIx: leaf ? (zeroAt.leafIx || 0) : null, leaf: leaf ? leaf.settingsMeters[zeroAt.leafIx || 0] : null, elevationMoa: Math.round((zeroAt.elevationClicks * sight.clickMoa + (leaf ? leaf.moaAbove100[zeroAt.leafIx || 0].moaAbove100 : 0)) * 100) / 100 } : null, heldUpMoa: entry.heldUp, heldRightMoa: entry.heldRight, windCall: entry.call, conditionsShown: shown, first };
    $('cold-line').hidden = true;
    if (!r.reached) {
      entry.where = `into the ground before the ${p.kind === 'paper' ? 'paper' : 'plate'}`; entry.hit = false;
      pending.push({ at: now + r.timeS, entry, shot, t: p, rightMoa: aimRight, upMoa: -(p.heightIn / ipm) * 2, yards: p.yards, hit: false, dist: p.yards });
    } else {
      // The bullet lands where the reticle pointed plus the engine's offset.
      const upIn = r.hit.upIn + aimUp * ipm, rightIn = r.hit.rightIn + aimRight * ipm;
      // On steel, a hit is on the plate; on paper, `hit` means on the sheet (the same rectangle test).
      const hit = Math.abs(upIn) <= p.heightIn / 2 && Math.abs(rightIn) <= p.widthIn / 2;
      const near = p.kind === 'paper' ? RD.nearestMark(upIn, rightIn, P) : null;
      entry.hit = hit;
      entry.where = p.kind === 'paper' ? (hit ? `on paper (${RD.offText(near.upIn, near.rightIn, near.mark)})` : `miss: off the paper, ${RD.whereText(upIn, rightIn)}`) : hit ? `hit (${RD.offText(upIn, rightIn)})` : `miss: ${RD.whereText(upIn, rightIn)}`;
      entry.upIn = upIn; entry.rightIn = rightIn; // full precision: the hit test and the tests use these; the words above are what the screen shows
      pending.push({ at: now + r.timeS, entry, shot, t: p, near, rightMoa: rightIn / ipm, upMoa: upIn / ipm, yards: p.yards, hit, upIn, rightIn, dist: p.yards, mach: r.mach });
    }
    $('result').textContent = `Shot ${entry.n} away at ${p.yards} yards…${day.box.left === 0 ? ' That was the last round in the box.' : ''}`;
  }
  function land(s) {
    const soundBack = (s.dist * 3) / E.speedOfSound(weather.tempF);
    const paper = s.t.kind === 'paper';
    // A hit on steel marks the plate and rings; a bullet through paper makes no ring, only the thud of the bank behind it.
    if (s.hit && !paper) { if (scene) scene.strike(s.t.steelIx, s.upIn, s.rightIn); RD.ringSound(soundBack, Math.max(0.15, 1 - s.dist / 1300)); }
    else if (s.hit) RD.thudSound(soundBack, 0.08);
    else { dust.push({ t: s.t, rightMoa: s.rightMoa, upMoa: s.upMoa, bornAt: now, yards: s.yards }); RD.thudSound(soundBack, Math.max(0.05, 0.5 - s.dist / 2500)); }
    log.push(s.entry);
    if (!RD.setLog(rifleId, sightId, loadId, log)) $('zero-note').textContent = 'Shot log not saved on this device (storage is off); it holds for this page only.';
    // The day's record of the shot, the book line for a hit, the cold-bore line for the day's first shot at a plate.
    const shot = { ...s.shot, hit: Boolean(s.hit), reached: s.upIn != null, upIn: s.upIn != null ? Math.round(s.upIn * 100) / 100 : null, rightIn: s.rightIn != null ? Math.round(s.rightIn * 100) / 100 : null, book: false, coldBore: false };
    const n = s.shot.n;
    const id = `${day.id}:${n}`;
    const base = { id, day: day.id, n, at: new Date().toISOString(), on: day.date, course: courseId, yards: shot.yards, ...(paper ? { target: 'paper' } : {}), elevationClicks: shot.elevationClicks, windageClicks: shot.windageClicks, leaf: shot.leaf, windCall: shot.windCall, tempF: weather.tempF, upIn: shot.upIn, rightIn: shot.rightIn };
    let notes = [];
    // The book holds hits on steel: a shot on paper writes no line there.
    if (shot.hit && !paper && !shot.conditionsShown) {
      shot.book = RD.addBookLine(rifleId, sightId, loadId, { ...base, sight: undefined, elevationMoa: shot.elevationMoa, windageMoa: shot.windageMoa, zero: shot.zero, heldUpMoa: shot.heldUpMoa, heldRightMoa: shot.heldRightMoa });
      notes.push(shot.book ? 'Written in the book.' : 'Not written in the book: the browser refused its storage.');
    } else if (shot.hit && !paper) notes.push('Not in the book: the conditions were shown.');
    if (shot.first && !shot.conditionsShown) {
      shot.coldBore = RD.addColdBore(rifleId, loadId, { ...base, sight: sightId, load: loadId, hit: shot.hit });
      notes.push(shot.coldBore ? 'The day\'s first shot: in the cold-bore record.' : 'Not in the cold-bore record: the browser refused its storage.');
    } else if (shot.first) notes.push('The day\'s first shot, but the conditions were shown: not in the cold-bore record.');
    delete shot.first;
    const rec = RD.recordShot(day, shot);
    if (paper && scene) scene.setPaper(s.t.paperIx, holesOf(s.t));
    if (!rec.saved) notes.push('The day is not saved on this device (the browser refused its storage).');
    if (day.box.left <= 0 && !pending.length) notes.push(`The box of ${day.box.size} is empty: open another box to go on, or pack up.`);
    rounds(); bookLine();
    const sub = s.mach != null && s.mach < 1.2 ? ` The bullet arrived at Mach ${s.mach.toFixed(2)}${s.mach < 1 ? ', below the speed of sound' : ', nearly down to the speed of sound'}.` : '';
    $('result').innerHTML = (paper && s.hit ? `<strong>On paper</strong> at ${s.dist} yards, ${RD.esc(RD.offText(s.near.upIn, s.near.rightIn, s.near.mark))}.${sub}` : s.hit ? `<strong>Hit</strong> at ${s.dist} yards, ${RD.esc(RD.offText(s.upIn, s.rightIn))}. The ring comes back ${soundBack.toFixed(1)} s later.${sub}` : `<strong>Miss</strong> at ${s.dist} yards: ${RD.esc(s.entry.where.replace('miss: ', ''))}. Watch the dust.${sub}`) + (notes.length ? ` ${RD.esc(notes.join(' '))}` : '');
    renderLog();
  }
  // A shot in flight is already decided (the engine flew it at the trigger
  // pull; the flight is the wait for the result), so leaving the screen
  // lands every shot still in the air first: nothing fired is lost to Pack
  // up, a tap on another page, or the app being closed.
  function landAll() {
    pending.sort((a, b) => a.at - b.at);
    while (pending.length) land(pending.shift());
  }
  window.addEventListener('pagehide', landAll);
  // The book for the plate now chosen: the newest unstruck line for this
  // rifle, sight and load at that distance, or what the nearest distances
  // with lines are. It only shows his own hits; it never turns a knob.
  function bookLine() {
    const y = plate().yards;
    if (plate().kind === 'paper') { $('book-line').innerHTML = `<a href="/book${RD.params(c)}">Book</a>: paper is read on the sheet; the book holds hits on steel.`; return; }
    const href = `/book${RD.params(c)}&yards=${y}`;
    if (RD.bookReadFailed(rifleId, sightId, loadId)) { $('book-line').innerHTML = `<a href="${href}">Book</a>: not saved on this device (the browser refused its storage).`; return; }
    const lines = RD.bookAt(rifleId, sightId, loadId, y).slice(0, 1); // the newest line only; the rest stay in the book
    if (!lines.length) {
      const n = RD.bookNeighbours(rifleId, sightId, loadId, y);
      const near = [n.below != null ? `${n.below} yards below` : null, n.above != null ? `${n.above} yards above` : null].filter(Boolean);
      $('book-line').innerHTML = `<a href="${href}">Book</a>: nothing in the book at ${y} yards yet${near.length ? `; the nearest lines are at ${near.join(' and ')}` : ''}.`;
      return;
    }
    const one = (l) => `${RD.sign(l.elevationClicks)}/${RD.sign(l.windageClicks)} clicks${l.leaf != null ? `, leaf ${l.leaf / 100}` : ''}, held ${RD.heldText(l.heldUpMoa, l.heldRightMoa)}, wind ${RD.windCallText(l.windCall)}, ${l.tempF} F, ${RD.dateText(l.on)}`;
    $('book-line').innerHTML = `<a href="${href}">Book, ${y} yards</a>: ${lines.map((l) => RD.esc(one(l))).join(' · ')}`;
  }
  // Before the day's first shot at a plate: it goes in the cold-bore record.
  function coldLine() {
    const first = day.shots.length === 0 && pending.length === 0 && !day.endedAt;
    $('cold-line').hidden = !first;
    if (first) $('cold-line').textContent = RD.showConditions() ? 'The day\'s first shot is next. With "Show the conditions" on it will not go in the cold-bore record.' : 'The day\'s first shot is next: it goes in the cold-bore record.';
  }
  function renderLog() {
    const body = $('log').querySelector('tbody');
    body.innerHTML = log.slice().reverse().map((e) => `<tr class="${e.hit ? 'hit' : 'miss'}"><td>${e.n}</td><td>${e.yards}${e.target === 'paper' ? ' paper' : ''}</td><td>${RD.sign(e.el)}</td><td>${RD.sign(e.wd)}${e.leaf != null ? ` · leaf ${e.leaf / 100}` : ''}</td><td>${e.zoom}×</td><td>${RD.heldText(e.heldUp, e.heldRight)}</td><td>${e.call === undefined ? '' : RD.esc(RD.windCallText(e.call))}</td><td>${RD.esc(e.where)}${e.conditionsShown ? ' (conditions shown)' : ''}</td></tr>`).join('');
  }

  // --- the setting: Show the conditions -----------------------------------------------------------
  function conditions() {
    const on = RD.showConditions();
    $('show-conditions').checked = on;
    if (!on) { $('conditions').textContent = ''; return; }
    const p = plate(), load = d.loads[loadId];
    const base = { load, drag: d.physics.dragTables, powder: d.physics.powderTemperature, sightHeightIn: rifle.sightHeightIn[sightId], elevationMoa: setting.elevationClicks * sight.clickMoa + rifle.boreOffsetMoa.up + leafMoa(), windageMoa: setting.windageClicks * sight.windageClickMoa + rifle.boreOffsetMoa.right, targetYards: p.yards, targetRiseFt: riseOf(p), conditions: RD.conditionsOf(weather), t0: now };
    const still = E.fly({ ...base, wind: [] }), windy = E.fly({ ...base, wind: weather.wind });
    const lines = [
      `Air: ${weather.tempF} F, ${weather.pressureInHg} inHg at ${weather.altitudeFt} ft, humidity ${Math.round(weather.humidity * 100)}%${weather.santaAna ? ', a Santa Ana day' : ''}. Muzzle speed today ${still.muzzleFps.toFixed(0)} fps (the load's ${load.muzzleFps} at ${d.physics.powderTemperature.referenceTempF} F).`,
      ...weather.wind.map((w, i) => `Wind, ${['near', 'middle', 'far'][i]} stretch (${Math.round(w.fromYards)}–${Math.min(Math.round(w.toYards), course.steelTo)} yd): ${w.speedMph} mph ${RD.windWord(w.fromDegrees)}, gusting ${w.gustMph} mph every ${w.periodS} s.`),
      still.reached ? `Engine, ${p.yards} yd, this sight setting, no spread: ${RD.whereText(still.hit.upIn, still.hit.rightIn)} of the aim with no wind; with the wind ${RD.whereText(windy.hit.upIn, windy.hit.rightIn)} (drift ${(windy.hit.rightIn - still.hit.rightIn).toFixed(1)} in). Flight ${still.timeS.toFixed(2)} s, ${still.speedFps.toFixed(0)} fps at the plate (Mach ${still.mach.toFixed(2)}).` : `Engine: with this sight setting the bullet does not reach ${p.yards} yards.`,
      `${p.kind === 'paper' ? 'Paper' : 'Plate'} ${p.yards} yd sits ${riseOf(p).toFixed(0)} ft above the line (${((losAngle(p) * 180) / Math.PI).toFixed(1)}°); 1 MOA there is ${inchPerMoa(p.yards).toFixed(1)} in.`,
    ];
    $('conditions').textContent = lines.join('\n');
  }

  // --- controls -----------------------------------------------------------------------------------------
  // The leaf's angle above its 100 m setting, which the bore takes like any click: through the engine, as part of the elevation.
  const leafMoa = () => (leaf ? leaf.moaAbove100[setting.leafIx || 0].moaAbove100 : 0);
  function showSetting() {
    $('el-text').textContent = RD.clicksText(setting.elevationClicks, sight.clickMoa, 'up', 'down');
    $('wd-text').textContent = RD.clicksText(setting.windageClicks, sight.windageClickMoa, 'right', 'left');
    const extra = leaf ? `Leaf ${RD.leafText(leaf, setting.leafIx || 0)}` : magnifier ? (magnifierIn() ? `Magnifier in (${magnifier.magnification}×)` : 'Magnifier out (1×)') : '';
    $('setting-line').textContent = RD.settingLine(setting, sight, extra);
    if (magnifier) $('magnifier').textContent = magnifierIn() ? `Magnifier is in (${magnifier.magnification}×): flip it out` : 'Magnifier is out (1×): flip it in';
    if (leaf) $('leaf-text').textContent = RD.leafText(leaf, setting.leafIx || 0);
    conditions();
  }
  const storeSetting = () => { if (!RD.setSight(rifleId, sightId, setting)) $('zero-note').textContent = 'Sight setting not saved on this device: the browser refused to store it. It holds while this page is open.'; };
  if (leaf) {
    $('leafrow').hidden = false; $('leaf-words').hidden = false;
    const moveLeaf = (delta) => {
      const ix = (setting.leafIx || 0) + delta;
      if (ix < 0 || ix >= leaf.settingsMeters.length) { $('result').textContent = `The leaf is at the end of its slide (${leaf.settingsMeters[ix < 0 ? 0 : leaf.settingsMeters.length - 1]} m).`; return; }
      setting = { ...setting, leafIx: ix }; RD.clickSound(); showSetting(); zeroNote(); storeSetting();
    };
    $('leaf-up').addEventListener('click', () => moveLeaf(1));
    $('leaf-down').addEventListener('click', () => moveLeaf(-1));
  }
  if (magnifier) {
    $('magrow').hidden = false;
    $('magnifier').addEventListener('click', () => { setting = { ...setting, magnifier: !magnifierIn() }; RD.clickSound(); showSetting(); storeSetting(); });
  }
  // The knobs: a press is one click, holding repeats, the coarse pair moves a whole MOA; the limits stop them.
  RD.wireKnobs(document, sight, () => setting, (which, next) => {
    setting = { ...setting, [which]: next };
    RD.clickSound(); showSetting(); zeroNote(); storeSetting();
  }, (text) => { $('result').textContent = text; });
  $('plate').addEventListener('change', (e) => { target = targets.find((t) => t.key === e.target.value) || target; hold.up = 0; hold.right = 0; conditions(); bookLine(); paperRow(); });
  // "Hang a fresh paper" (range-day-ten): shown only when a paper is chosen, a short scroll below. It clears the holes shown on that
  // sheet from now on (a marker in the open day; no shot is deleted); the message that confirms it offers to put the old paper back.
  function paperRow(message) {
    const t = plate();
    $('paper-row').hidden = t.kind !== 'paper';
    $('paper-note').innerHTML = message || '';
    if (t.kind === 'paper') $('fresh-paper').textContent = `Hang a fresh paper at ${t.yards} yards`;
  }
  $('fresh-paper').addEventListener('click', () => {
    const t = plate(), shown = RD.paperHoles(day, t).length;
    const r = RD.hangFreshPaper(day, t.yards);
    if (scene) scene.setPaper(t.paperIx, holesOf(t));
    paperRow(`${r.saved ? `A fresh paper hangs at ${t.yards} yards; the old one had ${shown} hole${shown === 1 ? '' : 's'}, and every shot stays in the day.` : 'The fresh paper is not saved on this device (the browser refused its storage); it holds while this page is open.'} <button id="old-paper" type="button" class="btn inline secondary">Put the old paper back</button>`);
    $('old-paper').addEventListener('click', () => {
      const saved = RD.putOldPaperBack(day, t.yards, r.before);
      if (scene) scene.setPaper(t.paperIx, holesOf(t));
      const n = RD.paperHoles(day, t).length;
      paperRow(saved ? `The old paper is back at ${t.yards} yards, with its ${n} hole${n === 1 ? '' : 's'}.` : 'The old paper is back while this page is open, but not saved on this device (the browser refused its storage).');
    });
  });
  $('pack-up').addEventListener('click', () => { landAll(); const packed = RD.packUp(); location.href = packed ? `/day?id=${encodeURIComponent(packed.id)}` : '/'; });
  $('another-box').addEventListener('click', () => {
    if (!RD.openAnotherBox(day)) { $('result').textContent = 'The box could not be saved on this device (the browser refused its storage).'; return; }
    rounds(); $('result').textContent = `Box ${RD.boxesOpened(day)} of ${d.loads[loadId].name} opened: ${day.box.left} rounds. The day goes on.`;
  });
  $('use-zero').addEventListener('click', () => { const z = RD.getZero(rifleId, sightId, loadId); if (!z || z === RD.store.FAILED) return; setting = { ...setting, elevationClicks: z.elevationClicks, windageClicks: z.windageClicks, ...(leaf && z.leafIx != null ? { leafIx: z.leafIx } : {}) }; RD.clickSound(); showSetting(); zeroNote(); if (!RD.setSight(rifleId, sightId, setting)) $('zero-note').textContent = 'Sight setting not saved on this device: the browser refused to store it. It holds while this page is open.'; });
  $('zoom').addEventListener('input', (e) => { mag = Number(e.target.value); zoomText(); });
  $('show-conditions').addEventListener('change', (e) => { RD.setShowConditions(e.target.checked); conditions(); coldLine(); });
  $('clear-log').addEventListener('click', () => { log = []; RD.setLog(rifleId, sightId, loadId, log); renderLog(); });
  // Steady is held with one finger while another presses Fire. On a phone
  // the second finger gets no "click" (the browser gives clicks to the first
  // finger only), so both buttons work from the press itself; the keyboard
  // still fires with Enter or the space bar. Neither press selects text or
  // opens a menu.
  const steadyOn = () => { steady = true; $('steady').classList.add('on'); };
  const steadyOff = () => { steady = false; $('steady').classList.remove('on'); };
  let steadyPointer = null;
  $('steady').addEventListener('pointerdown', (e) => { e.preventDefault(); steadyPointer = e.pointerId; steadyOn(); try { $('steady').setPointerCapture(e.pointerId); } catch {} });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) $('steady').addEventListener(ev, (e) => { if (steadyPointer == null || e.pointerId === steadyPointer) { steadyPointer = null; steadyOff(); } });
  $('fire').addEventListener('pointerdown', (e) => { if (e.button !== 0 && e.pointerType === 'mouse') return; e.preventDefault(); RD.audio(); fire(); });
  $('fire').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); RD.audio(); fire(); } });
  for (const id of ['steady', 'fire']) $(id).addEventListener('contextmenu', (e) => e.preventDefault());
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
    for (let i = dust.length - 1; i >= 0; i--) if (now - dust[i].bornAt > d.physics.dust.lifeS) dust.splice(i, 1);
    draw();
    requestAnimationFrame(frame);
  }
  // Where the last shot went and the book's line each hold two lines of text in a slot of fixed height; a longer text is
  // marked and opens on a tap over what is below it, so nothing under the thumb moves. New text closes it again.
  for (const id of ['result', 'book-line']) {
    const el = $(id);
    const measure = () => { const open = el.classList.contains('open'); el.classList.remove('open'); el.classList.toggle('long', el.scrollHeight > el.clientHeight + 1); if (open && el.classList.contains('long')) el.classList.add('open'); };
    new MutationObserver(() => { el.classList.remove('open'); measure(); }).observe(el, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', measure);
    el.addEventListener('click', (e) => { if (e.target.closest('a')) return; if (el.classList.contains('open')) el.classList.remove('open'); else if (el.classList.contains('long')) el.classList.add('open'); });
    measure();
  }
  applyZero(); renderLog(); conditions(); rounds(); bookLine(); coldLine(); paperRow();
  fitScene(); choosePicture();
  requestAnimationFrame(frame);
  // For the screenshot run and tests: a way to read the state without guessing.
  window.RangeDayLine = { fire, landAll, get log() { return log; }, get pending() { return pending.length; }, get setting() { return setting; }, setHold(up, right) { hold.up = up; hold.right = right; }, setZoom(m) { mag = m; $('zoom').value = m; zoomText(); }, get plate() { return plate(); }, get day() { return day; }, get weather() { return weather; }, get windCall() { return windCall(); },
    // Each plate's angle from the firing line (sideways and upward, in MOA) and the height the drawing uses; the last shot's inputs to the engine.
    get plateAngles() { return plates.map((p) => ({ yards: p.yards, riseFt: riseOf(p), lateralYd: p.lateralYd, upMoa: toMoa(losAngle(p)), rightMoa: toMoa(sideAngle(p)) })); },
    get lastShotInput() { return lastShotInput; },
    get fovMoa() { return fovMoa(); },
    // The picture in force, the scene (or null), and for a plate: where the plain drawing puts its centre and where the scene does, from the same aim at the same instant.
    get picture() { return scene ? scene.quality : 'plain'; }, get scene() { return scene; }, get sceneLoading() { return sceneLoading; }, get sceneFailed() { return sceneFailed; },
    // range-day-ten: every target (near first, then the plates), the one chosen, and where any target's centre is drawn under both pictures.
    get targets() { return targets.map((t) => ({ key: t.key, kind: t.kind, yards: t.yards, widthIn: t.widthIn, heightIn: t.heightIn, riseFt: t.riseFt, lateralYd: t.lateralYd, steelIx: t.steelIx ?? null, paperIx: t.paperIx ?? null })); },
    get target() { return { key: target.key, kind: target.kind, yards: target.yards }; },
    setTarget(key) { $('plate').value = key; $('plate').dispatchEvent(new Event('change')); },
    holes(key) { const t = targets.find((x) => x.key === key); return t && t.kind === 'paper' ? holesOf(t) : []; },
    steelMarks(key) { const t = targets.find((x) => x.key === key); return t && t.kind === 'steel' ? RD.steelMarks(day, t) : []; },
    targetOnScreen(key) { const t = targets.find((x) => x.key === key), at = plateAt(t); const plain = toScreen(at.right, at.up); if (!scene) return { plain, scene: null }; syncScene(); const w = t.kind === 'paper' ? scene.paperWorld(t.paperIx) : scene.plateWorld(t.steelIx); return { plain, scene: scene.project(w.x, w.y, w.z) }; },
    plateOnScreen(ix) { const p = plates[ix], at = plateAt(p); const plain = toScreen(at.right, at.up); if (!scene) return { plain, scene: null }; syncScene(); const w = scene.plateWorld(ix); return { plain, scene: scene.project(w.x, w.y, w.z) }; },
    setPicture(v) { picture = v; measuring = null; if (v === 'plain') showPlain(''); else return startScene(v); },
    // The drawn geometry, in pixels at the view's scale: what the tests compare with the data's angles.
    get geometry() {
      const k = pxPerMoa();
      return { pxPerMoa: k, viewPx: view.size, dotPx: sight.kind === 'dot' ? sight.dotMoa * k : null, notchDepthPx: sight.notchDepthMoa ? sight.notchDepthMoa * k : null,
        marksPx: sight.reticle && sight.reticle.marksMoaBelowZero ? sight.reticle.marksMoaBelowZero.map((m) => ({ yards: m.yards, px: m.moaBelowZero * k })) : null,
        leafMoa: leaf ? leafMoa() : null, magnifierIn: magnifierIn() };
    } };
}());
