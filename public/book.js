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
  // The sights the rifle carries, then (range-day-twelve) any sight it no longer offers whose book lines this device still holds,
  // so an old page stays readable: a sight that took another's place without carrying its records leaves them under the old name.
  const kept = () => { const keys = RD.store.keys(); return keys === RD.store.FAILED ? [] : keys; };
  const oldSights = () => [...new Set(kept().map((k) => k.split(':')).filter((p) => p[0] === 'book' && p.length === 4 && p[1] === c.rifleId).map((p) => p[2]))]
    .filter((x) => d.sights[x] && !rifle().sights.includes(x) && RD.sightNow(d, c.rifleId, x) === x && RD.getBook(c.rifleId, x, c.loadId).length);
  const sightsOf = () => [...rifle().sights.filter((s) => d.sights[s].kind !== 'magnifier'), ...oldSights()];
  if (q.sight && q.sight !== c.sightId && oldSights().includes(q.sight)) c = { ...c, sightId: q.sight };
  const yardsAsked = Number(q.yards) || null;

  function header() {
    const s = d.sights[c.sightId];
    $('intro').textContent = `${rifle().name}, ${s.name}, ${d.loads[c.loadId].name}. One click of elevation is ${s.clickMoa} MOA.`;
    $('sight').innerHTML = sightsOf().map((x) => `<option value="${x}"${x === c.sightId ? ' selected' : ''}>${RD.esc(d.sights[x].name)}${rifle().sights.includes(x) ? '' : ' (no longer on this rifle)'}</option>`).join('');
    $('load').innerHTML = rifle().loads.map((l) => `<option value="${l}"${l === c.loadId ? ' selected' : ''}>${RD.esc(d.loads[l].name)}</option>`).join('');
    $('to-line').href = `/line${RD.params(c)}`;
  }

  function renderCold() {
    const lines = RD.getColdBore(c.rifleId, c.loadId).slice().sort(RD.newestFirst);
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
      const group = byYards.get(y).slice().sort(RD.newestFirst);
      const live = group.filter((l) => !l.struck);
      const ups = live.map((l) => RD.comeUpMoa(l, s.clickMoa));
      const temps = live.map((l) => l.tempF);
      const span = live.length
        ? `${live.length} hit${live.length === 1 ? '' : 's'}: ${Math.min(...ups) === Math.max(...ups) ? `${Math.round(Math.min(...ups) * 100) / 100}` : `${Math.round(Math.min(...ups) * 100) / 100} to ${Math.round(Math.max(...ups) * 100) / 100}`} minutes ${Math.max(...ups) >= 0 ? 'up' : 'down'}${live.every((l) => l.zero) ? ` from the ${[...new Set(live.map((l) => l.zero.zeroYards))].join(' or ')}-yard zero` : live.some((l) => l.zero) ? ' (some counted from a zero, some from the middle)' : ' from the middle (no zero saved)'}, ${Math.min(...temps) === Math.max(...temps) ? `${temps[0]} F` : `${Math.min(...temps)} to ${Math.max(...temps)} F`}`
        : `${group.length} line${group.length === 1 ? '' : 's'}, all struck out`;
      return `<h3 class="group" id="yards-${y}">${y} yards</h3><p class="span small">${RD.esc(span)}</p>` + group.map((l) => `<div class="entry${l.struck ? ' struck' : ''}" data-id="${RD.esc(l.id)}">
        <div class="what"><strong>${RD.esc(RD.comeUpText(l, s.clickMoa))}</strong>${l.zero && l.zero.leaf != null ? ` (the zero's leaf at ${l.zero.leaf / 100})` : ''}: elevation ${RD.esc(RD.clicksText(l.elevationClicks, s.clickMoa, 'up', 'down'))}, windage ${RD.esc(RD.clicksText(l.windageClicks, s.windageClickMoa, 'right', 'left'))}${l.leaf != null ? `, leaf ${l.leaf / 100}` : ''}; held ${RD.esc(RD.heldText(l.heldUpMoa, l.heldRightMoa))}; wind ${RD.esc(RD.windCallText(l.windCall))}; ${l.tempF} F; ${RD.esc(RD.dateText(l.on))}, ${RD.esc((d.courses[l.course] ? d.courses[l.course].name : l.course).replace(/ \(modeled on.*\)$/, ''))}; hit ${RD.esc(RD.whereText(l.upIn, l.rightIn))} of center.</div>
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

  // range-day-seventeen: this page beside another version of the same rifle (the rifle as fitted, or another of its builds) with
  // the same sight and load. Each side holds only the player's own unstruck book lines, lined up by distance; a distance where
  // one side has none is blank on that side. Nothing is worked out: each line's come-up is the one the book already shows.
  let compareWith = null;
  function versions() {
    const base = rifle().buildOf || c.rifleId;
    return [base, ...window.RangeDayBuilds.buildsOf(d, base)].filter((id) => id !== c.rifleId && d.rifles[id].sights.includes(c.sightId));
  }
  const versionName = (id) => (d.rifles[id].buildOf ? `Build “${d.rifles[id].build.name}”` : 'As fitted');
  function renderCompare() {
    const others = versions();
    $('compare-box').hidden = !others.length;
    if (!others.length) return;
    if (!others.includes(compareWith)) compareWith = others[0];
    $('compare').innerHTML = others.map((id) => `<option value="${id}"${id === compareWith ? ' selected' : ''}>${RD.esc(versionName(id))}</option>`).join('');
    const s = d.sights[c.sightId];
    const linesOf = (id) => RD.getBook(id, c.sightId, c.loadId).filter((l) => !l.struck);
    const mine = linesOf(c.rifleId), theirs = linesOf(compareWith);
    const yards = [...new Set([...mine, ...theirs].map((l) => l.yards))].sort((a, b) => a - b);
    const cell = (lines, y) => lines.filter((l) => l.yards === y).sort(RD.newestFirst).map((l) => `<div>${RD.esc(RD.comeUpText(l, s.clickMoa))}, ${l.tempF} F</div>`).join('');
    // Short headings, so three columns fit a phone: this page's version, then the one beside it, each named as the picker names it.
    const head = `<thead><tr><th>Yards</th><th>${RD.esc(d.rifles[c.rifleId].buildOf ? 'This build' : 'As fitted')}</th><th>${RD.esc(versionName(compareWith))}</th></tr></thead>`;
    $('compare-table').innerHTML = yards.length
      ? `<div class="tablewrap"><table class="log compare">${head}<tbody>${yards.map((y) => `<tr><td>${y}</td><td>${cell(mine, y)}</td><td>${cell(theirs, y)}</td></tr>`).join('')}</tbody></table></div>`
      : '<p class="muted small">No hits on steel yet with either, with this sight and load. Each hit writes its own line on its own side.</p>';
  }
  $('compare').addEventListener('change', (e) => { compareWith = e.target.value; renderCompare(); });

  // A copy of everything: save, and load.
  $('save-copy').addEventListener('click', () => {
    const copy = RD.makeCopy();
    RD.download(`range-day-copy-${RD.localDate()}.json`, JSON.stringify(copy, null, 1));
    say(`Saved a copy: ${copy.book.length} book line${copy.book.length === 1 ? '' : 's'}, ${copy.cold_bore.length} cold-bore line${copy.cold_bore.length === 1 ? '' : 's'}, ${copy.days.length} day${copy.days.length === 1 ? '' : 's'}, ${copy.zeros.length} zero${copy.zeros.length === 1 ? '' : 's'}${copy.builds.length ? `, ${copy.builds.length} build${copy.builds.length === 1 ? '' : 's'}` : ''}.`);
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
      say(`Loaded: added ${r.added.book} book line${r.added.book === 1 ? '' : 's'}, ${r.added.cold_bore} cold-bore line${r.added.cold_bore === 1 ? '' : 's'}, ${r.added.days} day${r.added.days === 1 ? '' : 's'}, ${r.added.zeros} zero${r.added.zeros === 1 ? '' : 's'}${r.buildsAdded ? `, ${r.buildsAdded} build${r.buildsAdded === 1 ? '' : 's'}` : ''}; nothing already here was changed.${r.failed ? ' Some of it was not saved on this device: the browser refused its storage.' : ''}`);
      renderCold(); renderPages();
    } catch (err) { say(err.message); }
    e.target.value = '';
  });
  // The tests' door: load a copy from text without the file dialog.
  window.RangeDayBook = { loadText(text) { const r = RD.loadCopy(JSON.parse(text)); renderCold(); renderPages(); renderCompare(); return r; }, get copy() { return RD.makeCopy(); } };

  $('sight').addEventListener('change', (e) => { c = { ...c, sightId: e.target.value }; header(); renderCold(); renderPages(); renderCompare(); });
  $('load').addEventListener('change', (e) => { c = { ...c, loadId: e.target.value }; header(); renderCold(); renderPages(); renderCompare(); });
  if (q.beside && d.rifles[q.beside]) compareWith = q.beside;
  header(); renderCold(); renderPages(); renderCompare();
}());
