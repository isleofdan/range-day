'use strict';
// Home: pick the rifle, then the sight (only the sights that rifle carries),
// the load and the course, each on its own. The last choice on this device is
// already picked when the page opens; the rifle list says which rifles have a
// zero saved on this device; the zero line says where this rifle, sight and
// load stand; the two doors carry the whole choice in their addresses.
(async function () {
  const d = await RD.data();
  const q = RD.qs();
  const RIFLE_IDS = Object.keys(d.rifles).filter((k) => !k.startsWith('_') && d.rifles[k].playable);
  const COURSE_IDS = Object.keys(d.courses).filter((k) => !k.startsWith('_'));
  const BLURB = {
    'cta-piru': 'Steel every 100 yards from 200 to 1,000, the far plates up the canyon slope.',
    'angeles-sylmar': 'Steel every 100 yards from 100 to 600, up a gentle rise.',
  };
  let c = RD.chooseFrom(d, q);
  const $ = (id) => document.getElementById(id);

  function sightsOf(rifleId) { return d.rifles[rifleId].sights.filter((s) => d.sights[s].kind !== 'magnifier'); }
  function sightLabel(rifleId, sightId) {
    const r = d.rifles[rifleId];
    const mag = r.sights.find((s) => d.sights[s].kind === 'magnifier');
    return d.sights[sightId].name + (mag && d.sights[sightId].kind === 'dot' ? `, with the ${d.sights[mag].name.replace(/ \(.*\)$/, '')} behind it` : '');
  }

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
    if (z === RD.store.FAILED) {
      $('zero').innerHTML = `<strong>Zero not saved on this device:</strong> the browser refused to read its storage, so no zero can be kept here for the ${RD.esc(r.name)}.`;
    } else if (z) {
      const leaf = z.leafIx != null && s.kind === 'iron' && (c.rifleId === 'ak-545' ? s.leaf545 : s.leaf) ? ` · leaf ${RD.esc(RD.leafText(c.rifleId === 'ak-545' ? s.leaf545 : s.leaf, z.leafIx))}` : '';
      $('zero').innerHTML = `<strong>Zeroed</strong> at ${z.zeroYards} yards with the ${RD.esc(s.name.replace(/ \(.*\)$/, ''))}: elevation ${RD.esc(RD.clicksText(z.elevationClicks, s.clickMoa, 'up', 'down'))}, windage ${RD.esc(RD.clicksText(z.windageClicks, s.windageClickMoa, 'right', 'left'))}${leaf}.`;
    } else {
      $('zero').innerHTML = `<strong>Not zeroed yet</strong> with the ${RD.esc(s.name.replace(/ \(.*\)$/, ''))} and this load. Start at the zero bench.`;
    }
    const p = RD.params(c);
    $('go-zero').href = `/zero${p}`;
    $('go-line').href = `/line${p}`;
    $('course-blurb').textContent = `${d.courses[c.courseId].name}: ${BLURB[c.courseId] || ''}`;
    RD.remember(c);
  }
  $('sight').addEventListener('change', (e) => { c = { ...c, sightId: e.target.value }; showZero(); });
  $('load').addEventListener('change', (e) => { c = { ...c, loadId: e.target.value }; showZero(); });
  $('course').addEventListener('change', (e) => { c = { ...c, courseId: e.target.value }; showZero(); });
  renderRifles(); renderPicks();

  // The whole set, for reference.
  $('set').innerHTML = Object.entries(d.rifles).filter(([k]) => !k.startsWith('_')).map(([k, r]) =>
    `<li><strong>${RD.esc(r.name)}</strong><br><span class="muted">${r.loads.map((l) => RD.esc(d.loads[l].name)).join('; ')}. Sights: ${r.sights.map((s) => RD.esc(d.sights[s].name)).join('; ')}.</span></li>`).join('');
}());
