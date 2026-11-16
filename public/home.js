'use strict';
// Home: pick a course and rifle (two choices now), pick the load, see the
// saved zero for that rifle and load or "not zeroed yet".
(async function () {
  const d = await RD.data();
  const RIFLES = Object.entries(d.rifles).filter(([k, r]) => !k.startsWith('_') && r.playable);
  const COURSES = Object.entries(d.courses).filter(([k]) => !k.startsWith('_'));
  // The two pairings playable now (data/courses.json, data/rifles.json).
  const PAIRS = [
    { course: 'cta-piru', rifle: 'molot-vepr-54r', sight: 'utg-2-7x44', blurb: 'Steel every 100 yards from 200 to 1,000, the far plates up the slope. The Vepr in 7.62x54R with the UTG 2-7x scope.' },
    { course: 'angeles-sylmar', rifle: 'bcm-ar15', sight: 'ar-irons', blurb: 'Steel every 100 yards from 100 to 600, level ground. The AR-15 in 5.56 with its iron sights.' },
  ];
  const q = RD.qs();
  let pick = PAIRS.find((p) => p.rifle === q.rifle) || PAIRS[0];
  const choices = document.getElementById('choices');
  const loadSel = document.getElementById('load');
  const zeroLine = document.getElementById('zero');

  function render() {
    choices.innerHTML = PAIRS.map((p) => {
      const c = d.courses[p.course], r = d.rifles[p.rifle], s = d.sights[p.sight];
      return `<button type="button" class="choice${p === pick ? ' picked' : ''}" data-rifle="${p.rifle}">
        <strong>${RD.esc(c.name)}</strong>
        <span>${RD.esc(r.name)} · ${RD.esc(s.name)}</span>
        <span class="muted">${RD.esc(p.blurb)}</span>
      </button>`;
    }).join('');
    for (const b of choices.querySelectorAll('button')) b.addEventListener('click', () => { pick = PAIRS.find((p) => p.rifle === b.dataset.rifle); render(); });
    const r = d.rifles[pick.rifle];
    const current = loadSel.value && r.loads.includes(loadSel.value) ? loadSel.value : (q.load && r.loads.includes(q.load) ? q.load : r.loads[0]);
    loadSel.innerHTML = r.loads.map((l) => `<option value="${l}"${l === current ? ' selected' : ''}>${RD.esc(d.loads[l].name)}</option>`).join('');
    showZero();
  }
  function showZero() {
    const r = d.rifles[pick.rifle], s = d.sights[pick.sight];
    const z = RD.getZero(pick.rifle, loadSel.value);
    if (z === RD.store.FAILED) {
      zeroLine.innerHTML = `<strong>Zero not saved on this device:</strong> the browser refused to read its storage, so no zero can be kept here for the ${RD.esc(r.name)}.`;
    } else if (z) {
      zeroLine.innerHTML = `<strong>Zeroed</strong> at ${z.zeroYards} yards: elevation ${RD.esc(RD.clicksText(z.elevationClicks, s.clickMoa, 'up', 'down'))}, windage ${RD.esc(RD.clicksText(z.windageClicks, s.windageClickMoa, 'right', 'left'))}.`;
    } else {
      zeroLine.innerHTML = `<strong>Not zeroed yet</strong> for the ${RD.esc(r.name)} with this load. Start at the zero bench.`;
    }
    const params = `?course=${pick.course}&rifle=${pick.rifle}&load=${loadSel.value}`;
    document.getElementById('go-zero').href = `/zero${params}`;
    document.getElementById('go-line').href = `/line${params}`;
  }
  loadSel.addEventListener('change', showZero);
  render();

  // The whole set, recorded now.
  document.getElementById('set').innerHTML = Object.entries(d.rifles).filter(([k]) => !k.startsWith('_')).map(([k, r]) =>
    `<li><strong>${RD.esc(r.name)}</strong>${r.playable ? ' — playable now' : ''}<br><span class="muted">${r.loads.map((l) => RD.esc(d.loads[l].name)).join('; ')}. Sights: ${r.sights.map((s) => RD.esc(d.sights[s].name)).join('; ')}.</span></li>`).join('');
  void RIFLES; void COURSES;
}());
