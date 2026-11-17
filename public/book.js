'use strict';
// The data book: one page per rifle, sight and load, built only from the
// player's own hits on steel. Lines grouped by distance, newest first; the
// come-up shown as minutes of angle from the saved zero the sight was
// counted from; one line per distance counting his own unstruck settings
// and temperatures. A line can be struck out and restored, and takes a
// note. The cold-bore record for the rifle and load sits at the top. At the
// foot, a copy of everything on this device can be saved and loaded.
(async function () {
  const E = RD.E;
  const d = await RD.data();
  const q = RD.qs();
  const $ = (id) => document.getElementById(id);
  let c = RD.chooseFrom(d, q);
  const open = RD.openDay();
  // While a day with shots is open, its rifle and load are the page's (the sight can be any the rifle carries).
  if (open && RD.hasShots(open) && !q.rifle) c = { ...c, rifleId: open.rifle, loadId: open.load, sightId: RD.chooseFrom(d, { rifle: open.rifle, remembered: true }).sightId };
  const rifle = () => d.rifles[c.rifleId];
  const sightsOf = () => rifle().sights.filter((s) => d.sights[s].kind !== 'magnifier');
  const yardsAsked = Number(q.yards) || null;

  function header() {
    const s = d.sights[c.sightId];
    $('intro').textContent = `${rifle().name}, ${s.name}, ${d.loads[c.loadId].name}. One click of elevation is ${s.clickMoa} MOA.`;
    $('sight').innerHTML = sightsOf().map((x) => `<option value="${x}"${x === c.sightId ? ' selected' : ''}>${RD.esc(d.sights[x].name)}</option>`).join('');
    $('load').innerHTML = rifle().loads.map((l) => `<option value="${l}"${l === c.loadId ? ' selected' : ''}>${RD.esc(d.loads[l].name)}</option>`).join('');
    $('to-line').href = `/line${RD.params(c)}`;
  }

  function renderCold() {
    const lines = RD.getColdBore(c.rifleId, c.loadId).slice().sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : b.id.localeCompare(a.id)));
    if (!lines.length) { $('cold').innerHTML = `<p class="muted small">No cold-bore line yet for the ${RD.esc(rifle().name)} with this load: the first shot of a day at a plate makes one.</p>`; return; }
    $('cold').innerHTML = `<div class="tablewrap"><table class="log shots"><thead><tr><th>Date</th><th>Course</th><th>Yards</th><th>Sight</th><th>Elev.</th><th>Wind.</th><th>Call</th><th>F</th><th>Landed</th></tr></thead><tbody>${lines.map((l) => `<tr class="${l.hit ? 'hit' : 'miss'}"><td>${RD.esc(RD.dateText(l.on))}</td><td>${RD.esc((d.courses[l.course] ? d.courses[l.course].name : l.course).replace(/ \(modeled on.*\)$/, '').replace(/^(\w+) .*/, '$1'))}</td><td>${l.yards}</td><td>${RD.esc(d.sights[l.sight] ? d.sights[l.sight].name.replace(/ \(.*\)$/, '').split(' ').slice(0, 3).join(' ') : l.sight)}</td><td>${RD.sign(l.elevationClicks)}</td><td>${RD.sign(l.windageClicks)}${l.leaf != null ? ` · leaf ${l.leaf / 100}` : ''}</td><td>${RD.esc(RD.windCallText(l.windCall))}</td><td>${l.tempF}</td><td${l.hit ? ' class="hit"' : ''}>${l.hit ? 'hit' : 'miss'}: ${l.upIn != null ? RD.esc(RD.whereText(l.upIn, l.rightIn)) : 'into the ground before the plate'}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderPages() {
    const s = d.sights[c.sightId];
    if (RD.bookReadFailed(c.rifleId, c.sightId, c.loadId)) { $('pages').innerHTML = '<p class="readout">The book is not saved on this device: the browser refused to read its storage.</p>'; return; }
    const lines = RD.getBook(c.rifleId, c.sightId, c.loadId);
    if (!lines.length) { $('pages').innerHTML = `<p class="muted small">Nothing in this book yet: no hit on steel with the ${RD.esc(rifle().name)}, ${RD.esc(s.name.replace(/ \(.*\)$/, ''))} and this load. A hit writes its own line.</p>`; return; }
    const byYards = new Map();
    for (const l of lines) { if (!byYards.has(l.yards)) byYards.set(l.yards, []); byYards.get(l.yards).push(l); }
    const yards = [...byYards.keys()].sort((a, b) => a - b);
    $('pages').innerHTML = yards.map((y) => {
      const group = byYards.get(y).slice().sort((a, b) => (a.on < b.on ? 1 : a.on > b.on ? -1 : b.id.localeCompare(a.id)));
      const live = group.filter((l) => !l.struck);
      const ups = live.map((l) => (l.zero ? (l.elevationClicks - l.zero.elevationClicks) * s.clickMoa : l.elevationMoa));
      const temps = live.map((l) => l.tempF);
      const span = live.length
        ? `${live.length} hit${live.length === 1 ? '' : 's'}: ${Math.min(...ups) === Math.max(...ups) ? `${Math.round(Math.min(...ups) * 100) / 100}` : `${Math.round(Math.min(...ups) * 100) / 100} to ${Math.round(Math.max(...ups) * 100) / 100}`} minutes ${Math.max(...ups) >= 0 ? 'up' : 'down'}${live.every((l) => l.zero) ? ` from the ${[...new Set(live.map((l) => l.zero.zeroYards))].join(' or ')}-yard zero` : live.some((l) => l.zero) ? ' (some counted from a zero, some from the middle)' : ' from the middle (no zero saved)'}, ${Math.min(...temps) === Math.max(...temps) ? `${temps[0]} F` : `${Math.min(...temps)} to ${Math.max(...temps)} F`}`
        : `${group.length} line${group.length === 1 ? '' : 's'}, all struck out`;
      return `<h3 class="group" id="yards-${y}">${y} yards</h3><p class="span small">${RD.esc(span)}</p>` + group.map((l) => `<div class="entry${l.struck ? ' struck' : ''}" data-id="${RD.esc(l.id)}">
        <div class="what"><strong>${RD.esc(RD.comeUpText(l, s.clickMoa))}</strong>: elevation ${RD.esc(RD.clicksText(l.elevationClicks, s.clickMoa, 'up', 'down'))}, windage ${RD.esc(RD.clicksText(l.windageClicks, s.windageClickMoa, 'right', 'left'))}${l.leaf != null ? `, leaf ${l.leaf / 100}` : ''}; held ${RD.esc(RD.heldText(l.heldUpMoa, l.heldRightMoa))}; wind ${RD.esc(RD.windCallText(l.windCall))}; ${l.tempF} F; ${RD.esc(RD.dateText(l.on))}, ${RD.esc((d.courses[l.course] ? d.courses[l.course].name : l.course).replace(/ \(modeled on.*\)$/, ''))}; hit ${RD.esc(RD.whereText(l.upIn, l.rightIn))} of center.</div>
        <div class="acts"><button type="button" class="btn inline secondary strike">${l.struck ? 'Restore' : 'Strike out'}</button><input type="text" class="note" placeholder="A note of your own" value="${RD.esc(l.note || '')}" maxlength="200"></div>
      </div>`).join('');
    }).join('');
    for (const el of $('pages').querySelectorAll('.entry')) {
      const id = el.dataset.id;
      el.querySelector('.strike').addEventListener('click', () => {
        const line = RD.getBook(c.rifleId, c.sightId, c.loadId).find((x) => x.id === id);
        if (!RD.changeBookLine(c.rifleId, c.sightId, c.loadId, id, { struck: !line.struck })) say('Not saved on this device: the browser refused to store the change.');
        renderPages();
      });
      el.querySelector('.note').addEventListener('change', (e) => {
        if (!RD.changeBookLine(c.rifleId, c.sightId, c.loadId, id, { note: e.target.value.slice(0, 200) })) say('Note not saved on this device: the browser refused to store it.');
      });
    }
    if (yardsAsked && $(`yards-${yardsAsked}`)) $(`yards-${yardsAsked}`).scrollIntoView();
  }
  const say = (t) => { $('copy-note').hidden = false; $('copy-note').textContent = t; };

  // A copy of everything: save, and load.
  $('save-copy').addEventListener('click', () => {
    const copy = RD.makeCopy();
    RD.download(`range-day-copy-${RD.localDate()}.json`, JSON.stringify(copy, null, 1));
    say(`Saved a copy: ${copy.book.length} book line${copy.book.length === 1 ? '' : 's'}, ${copy.cold_bore.length} cold-bore line${copy.cold_bore.length === 1 ? '' : 's'}, ${copy.days.length} day${copy.days.length === 1 ? '' : 's'}, ${copy.zeros.length} zero${copy.zeros.length === 1 ? '' : 's'}.`);
  });
  $('load-copy').addEventListener('click', () => $('copy-file').click());
  $('copy-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let obj;
      try { obj = JSON.parse(text); } catch { throw new Error(`This is not a Range Day copy: the file "${file.name}" is not JSON.`); }
      const r = RD.loadCopy(obj);
      say(`Loaded: added ${r.added.book} book line${r.added.book === 1 ? '' : 's'}, ${r.added.cold_bore} cold-bore line${r.added.cold_bore === 1 ? '' : 's'}, ${r.added.days} day${r.added.days === 1 ? '' : 's'}, ${r.added.zeros} zero${r.added.zeros === 1 ? '' : 's'}; nothing already here was changed.${r.failed ? ' Some of it was not saved on this device: the browser refused its storage.' : ''}`);
      renderCold(); renderPages();
    } catch (err) { say(err.message); }
    e.target.value = '';
  });
  // The tests' door: load a copy from text without the file dialog.
  window.RangeDayBook = { loadText(text) { const r = RD.loadCopy(JSON.parse(text)); renderCold(); renderPages(); return r; }, get copy() { return RD.makeCopy(); } };

  $('sight').addEventListener('change', (e) => { c = { ...c, sightId: e.target.value }; header(); renderCold(); renderPages(); });
  $('load').addEventListener('change', (e) => { c = { ...c, loadId: e.target.value }; header(); renderCold(); renderPages(); });
  header(); renderCold(); renderPages();
}());
