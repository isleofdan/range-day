'use strict';
// Home: pick the rifle, then the sight (only the sights that rifle carries),
// the load, the course, and when (the time of day and the month), each on
// its own. The last choice on this device is already picked when the page
// opens; the rifle list says which rifles have a zero saved on this device;
// the zero line says where this rifle, sight and load stand; the two doors
// carry the whole choice in their addresses. Going through a door starts a
// day (one box of the load; the weather drawn once). While a day with shots
// is open, home shows that day first, with the doors back into it: the
// rifle, load and course are fixed, the sight can be changed.
(async function () {
  const d = await RD.data();
  const q = RD.qs();
  const RIFLE_IDS = RD.rifleIds(d);
  const COURSE_IDS = Object.keys(d.courses).filter((k) => !k.startsWith('_'));
  let c = RD.chooseFrom(d, q);
  const $ = (id) => document.getElementById(id);

  function sightsOf(rifleId) { return d.rifles[rifleId].sights.filter((s) => d.sights[s].kind !== 'magnifier'); }
  function sightLabel(rifleId, sightId) {
    const r = d.rifles[rifleId];
    const mag = r.sights.find((s) => d.sights[s].kind === 'magnifier');
    return d.sights[sightId].name + (mag && d.sights[sightId].kind === 'dot' ? `, with the ${d.sights[mag].name.replace(/ \(.*\)$/, '')} behind it` : '');
  }
  const when = () => `&month=${$('month').value}&time=${$('time').value}`;

  // --- a day is open -------------------------------------------------------------------------
  function renderOpenDay(day) {
    $('open-day').hidden = false; $('no-day').hidden = true;
    const r = d.rifles[day.rifle];
    const sights = sightsOf(day.rifle);
    const lastFor = RD.getLastFor(day.rifle) || {};
    let sightId = sights.includes(c.sightId) && c.rifleId === day.rifle ? c.sightId : (sights.includes(lastFor.sight) ? lastFor.sight : r.defaultSight);
    const hits = day.shots.filter((s) => s.place === 'line' && s.hit).length, atSteel = day.shots.filter((s) => s.place === 'line').length;
    $('day-card').innerHTML = `<strong>${RD.esc(d.courses[day.course].name.replace(/ \(modeled on.*\)$/, ''))}</strong>, ${RD.esc(r.name)}, ${RD.esc(d.loads[day.load].name)}.<br>${RD.esc(RD.dayWords(day.weather, d.weather))} ${RD.esc(RD.roundsText(day))}. ${day.shots.length} shot${day.shots.length === 1 ? '' : 's'} so far${atSteel ? ` (${atSteel} at steel, ${hits} hit)` : ''}.`;
    $('day-sight').innerHTML = sights.map((s) => `<option value="${s}"${s === sightId ? ' selected' : ''}>${RD.esc(sightLabel(day.rifle, s))}</option>`).join('');
    const doors = () => {
      const cc = { rifleId: day.rifle, loadId: day.load, courseId: day.course, sightId };
      $('day-zero').href = `/zero${RD.params(cc)}`; $('day-line').href = `/line${RD.params(cc)}`;
      $('day-book').href = `/book${RD.params(cc)}`; $('day-page').href = `/day?id=${encodeURIComponent(day.id)}`;
      RD.remember(cc);
    };
    doors();
    $('day-sight').addEventListener('change', (e) => { sightId = e.target.value; doors(); });
    $('pack-up').addEventListener('click', () => {
      const packed = RD.packUp();
      if (packed) location.href = `/day?id=${encodeURIComponent(packed.id)}`; else render();
    });
  }

  // --- no day open: the picks ------------------------------------------------------------------
  function renderRifles() {
    $('rifles').innerHTML = RIFLE_IDS.map((id) => {
      const r = d.rifles[id];
      const n = RD.zeroCount(id, r);
      const failed = RD.store.get('last') === RD.store.FAILED;
      const mark = failed ? 'storage refused' : n ? `zeroed (${n} saved)` : 'no zero saved';
      return `<button type="button" class="rifle${id === c.rifleId ? ' picked' : ''}" data-rifle="${id}"><span class="rname">${RD.esc(r.name)}</span><span class="rmark ${n ? 'yes' : 'no'}">${mark}</span></button>`;
    }).join('');
    for (const b of $('rifles').querySelectorAll('button')) b.addEventListener('click', () => { c = RD.chooseFrom(d, { rifle: b.dataset.rifle, remembered: true }); renderPicks(); renderRifles(); });
  }
  function renderPicks() {
    const r = d.rifles[c.rifleId];
    $('sight').innerHTML = sightsOf(c.rifleId).map((s) => `<option value="${s}"${s === c.sightId ? ' selected' : ''}>${RD.esc(sightLabel(c.rifleId, s))}</option>`).join('');
    $('load').innerHTML = r.loads.map((l) => `<option value="${l}"${l === c.loadId ? ' selected' : ''}>${RD.esc(d.loads[l].name)}</option>`).join('');
    $('course').innerHTML = COURSE_IDS.map((k) => `<option value="${k}"${k === c.courseId ? ' selected' : ''}>${RD.esc(d.courses[k].name.replace(/ \(modeled on.*\)$/, ''))}</option>`).join('');
    showZero();
  }
  function showZero() {
    const r = d.rifles[c.rifleId], s = d.sights[c.sightId];
    const z = RD.getZero(c.rifleId, c.sightId, c.loadId);
    const leafTable = RD.leafOf(d, c.rifleId, c.sightId);
    if (z === RD.store.FAILED) {
      $('zero').innerHTML = `<strong>Zero not saved on this device:</strong> the browser refused to read its storage, so no zero can be kept here for the ${RD.esc(r.name)}.`;
    } else if (z) {
      const leaf = z.leafIx != null && leafTable ? ` · leaf ${RD.esc(RD.leafText(leafTable, z.leafIx))}` : '';
      $('zero').innerHTML = `<strong>Zeroed</strong> at ${z.zeroYards} yards with the ${RD.esc(s.name.replace(/ \(.*\)$/, ''))}: elevation ${RD.esc(RD.clicksText(z.elevationClicks, s.clickMoa, 'up', 'down'))}, windage ${RD.esc(RD.clicksText(z.windageClicks, s.windageClickMoa, 'right', 'left'))}${leaf}.`;
    } else {
      $('zero').innerHTML = `<strong>Not zeroed yet</strong> with the ${RD.esc(s.name.replace(/ \(.*\)$/, ''))} and this load. Start at the zero bench.`;
    }
    const p = RD.params(c) + when();
    $('go-zero').href = `/zero${p}`;
    $('go-line').href = `/line${p}`;
    if ($('go-book')) $('go-book').href = `/book${RD.params(c)}`;
    $('course-blurb').textContent = `${d.courses[c.courseId].name}: ${d.courses[c.courseId].blurb || ''}`;
    $('box-blurb').textContent = `A day at the range is one box of ${d.loads[c.loadId].boxCount} rounds of this load; the day ends when the box is empty.`;
    RD.remember(c);
  }
  function renderNoDay() {
    $('open-day').hidden = true; $('no-day').hidden = false;
    $('month').innerHTML = RD.MONTHS.map((m, i) => `<option value="${i + 1}"${i + 1 === RD.thisMonth() ? ' selected' : ''}>${m}</option>`).join('');
    $('time').value = RD.getWhen().timeOfDay;
    renderRifles(); renderPicks();
    const days = RD.finishedDays();
    const packed = RD.packedDayId();
    $('past').innerHTML = (days.length ? `<a href="/day">${days.length} past day${days.length === 1 ? '' : 's'}</a>` : 'No days yet: a day starts when you go through a door.') + (packed ? ` · <a href="/day?id=${encodeURIComponent(packed)}">Packed up early: back to the range</a>` : '') + ` · <a id="go-book" href="/book${RD.params(c)}">The book</a>`;
  }
  $('sight').addEventListener('change', (e) => { c = { ...c, sightId: e.target.value }; showZero(); });
  $('load').addEventListener('change', (e) => { c = { ...c, loadId: e.target.value }; showZero(); });
  $('course').addEventListener('change', (e) => { c = { ...c, courseId: e.target.value }; showZero(); });
  $('time').addEventListener('change', (e) => { RD.setWhen({ timeOfDay: e.target.value }); showZero(); });
  $('month').addEventListener('change', showZero);

  function render() {
    const day = RD.openDay();
    if (day && RD.hasShots(day)) renderOpenDay(day); else renderNoDay();
  }
  render();

  // The whole set, for reference.
  $('set').innerHTML = Object.entries(d.rifles).filter(([k]) => !k.startsWith('_')).map(([k, r]) =>
    `<li><strong>${RD.esc(r.name)}</strong><br><span class="muted">${r.loads.map((l) => `${RD.esc(d.loads[l].name)} (box of ${d.loads[l].boxCount})`).join('; ')}. Sights: ${r.sights.map((s) => RD.esc(d.sights[s].name)).join('; ')}.</span></li>`).join('');
}());
