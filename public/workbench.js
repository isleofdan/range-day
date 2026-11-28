'use strict';
// The workbench (range-day-seventeen): make a what-if version of one of the
// rifles (a build), see what it changes beside the rifle as fitted, and keep
// the list of builds. Making a build is choosing the rifle, changing one
// thing (the barrel length, or a collection scope's mount) and naming it; the
// rifle as fitted is already chosen in every list. The page shows only what
// a build changes in the rifle (the barrel, each load's muzzle speed from it
// with the rule's basis, each sight's height over the bore), never where a
// shot would land: that is for the bench, the line and the book. The
// arithmetic is public/builds.js; the record is RD's (docs/RECORDS.md, "The
// builds").
(async function () {
  const d = await RD.data();
  const B = window.RangeDayBuilds;
  const $ = (id) => document.getElementById(id);
  const q = RD.qs();
  const IDS = RD.rifleIds(d);
  const fps = (n) => `${Math.round(n).toLocaleString('en-US')} feet per second`;
  const inches = (n) => `${Math.round(n * 1000) / 1000} in`;
  const short = (name) => name.replace(/ \(.*\)$/, '');
  // Names cut to what tells them apart, so the table fits a phone: a sight up to its first comma, a load up to its weight.
  const sightWord = (id) => short(d.sights[id].name).split(',')[0];
  const loadWord = (id) => { const n = d.loads[id].name, m = /^(.*?\d+ gr)\b/.exec(n); return m ? m[1] : short(n); };
  let rifleId = IDS.includes(q.rifle) ? q.rifle : (() => { const c = RD.chooseFrom(d, {}); return d.rifles[c.rifleId].buildOf || c.rifleId; })();
  let named = false; // whether the player has typed a name (else the page suggests one from the change)

  // --- what a build would be, from the choices on the page ------------------------------------
  const base = () => d.rifles[rifleId];
  const spec = () => {
    const mounts = {};
    for (const el of $('mounts').querySelectorAll('select')) if (el.value !== B.fittedMount(d, el.dataset.scope)) mounts[el.dataset.scope] = el.value;
    return { rifle: rifleId, barrelIn: Number($('barrel').value), mounts };
  };
  const preview = (s) => B.rifleOf(d, { id: 'b-preview', name: $('name').value || 'preview', ...s });
  const changed = (s) => s.barrelIn !== base().barrelIn || Object.keys(s.mounts).length > 0;
  // A name from the change, offered until the player types one: "18 in barrel", "Pro Series 34 mm rings, Low".
  function suggestedName(s) {
    const parts = [];
    if (s.barrelIn !== base().barrelIn) parts.push(`${s.barrelIn} in barrel`);
    for (const [scope, mount] of Object.entries(s.mounts)) parts.push(`${sightWord(scope).split(' ').slice(1, 3).join(' ')} in ${mount.replace(/^(Trijicon|Vortex|Leupold) /, '').split(',').slice(0, 2).join(',')}`);
    return parts.join(', ').slice(0, 40);
  }

  // The facts a build changes, beside the rifle as fitted: rows of [what, as fitted, this build, changed?].
  function factRows(r, b) {
    const rows = [['Barrel length', inches(r.barrelIn), inches(b.barrelIn), b.barrelIn !== r.barrelIn]];
    for (const l of r.loads) rows.push([`${loadWord(l)}: muzzle speed`, fps(d.loads[l].muzzleFps), fps(b.loadFps[l]), b.loadFps[l] !== d.loads[l].muzzleFps]);
    for (const s of r.sights.filter((x) => d.sights[x].kind !== 'magnifier')) rows.push([`${sightWord(s)}: height over the bore`, inches(r.sightHeightIn[s]), inches(b.sightHeightIn[s]), b.sightHeightIn[s] !== r.sightHeightIn[s]]);
    return rows;
  }
  function factTable(r, b) {
    const calibers = [...new Set(r.loads.map((l) => d.loads[l].caliber))];
    const rule = b.barrelIn !== r.barrelIn ? `<p class="muted small">Speeds from a ${inches(b.barrelIn)} barrel: each load's speed from the ${inches(r.barrelIn)} barrel, ${calibers.map((c) => RD.esc(`${B.speedRuleWords(d, r.loads.find((l) => d.loads[l].caliber === c))} (${d.workbench.fpsPerInchWords[c]})`)).join('; ')}.</p>` : '';
    const mounts = Object.entries(b.build.mounts).map(([s, m]) => `<p class="muted small">${RD.esc(sightWord(s))}: in the ${RD.esc(m)} instead of the ${RD.esc(B.fittedMount(d, s))}; its height over the bore is the rail's ${inches(r.scopeMount.railHeightOverBoreIn)} plus the mount's.</p>`).join('');
    return `<div class="tablewrap"><table class="log facts"><thead><tr><th></th><th>As fitted</th><th>This build</th></tr></thead><tbody>${factRows(r, b).map(([what, was, now, ch]) => `<tr${ch ? ' class="hit"' : ''}><td>${RD.esc(what)}</td><td>${RD.esc(was)}</td><td>${ch ? `<strong>${RD.esc(now)}</strong>` : RD.esc(now)}</td></tr>`).join('')}</tbody></table></div>${rule}${mounts}`;
  }

  // --- the maker ---------------------------------------------------------------------------------
  function renderMaker() {
    const r = base();
    $('rifle').innerHTML = IDS.map((id) => `<option value="${id}"${id === rifleId ? ' selected' : ''}>${RD.esc(d.rifles[id].name)}</option>`).join('');
    const lengths = B.barrelsOf(d, rifleId);
    $('barrel').innerHTML = lengths.map((l) => `<option value="${l}"${l === r.barrelIn ? ' selected' : ''}>${inches(l)}${l === r.barrelIn ? ' (as fitted)' : ''}</option>`).join('');
    $('barrel').disabled = lengths.length < 2;
    const scopes = B.mountableOf(d, r);
    // The scopes' mounts, folded under one line (the barrel is the change most often made); open when a mount was changed.
    $('mounts').innerHTML = scopes.length ? `<details class="field wide"${$('mounts').querySelector('details[open]') ? ' open' : ''}><summary>Scope mounts (${scopes.length} scope${scopes.length === 1 ? '' : 's'} of the collection fit this rifle)</summary>${scopes.map((s) => `<label for="mount-${s}">${RD.esc(sightWord(s))}</label><select id="mount-${s}" data-scope="${s}">${B.mountsOf(d, s).map((m) => `<option value="${RD.esc(m.name)}"${m.name === B.fittedMount(d, s) ? ' selected' : ''}>${m.centerOverRailIn} in · ${RD.esc(m.short || m.name)}${m.name === B.fittedMount(d, s) ? ' (as it came)' : ''}</option>`).join('')}</select><p class="muted small mount-full" id="mount-full-${s}"></p>`).join('')}</details>` : '';
    // range-day-eighteen: the closed picker shows the height and the mount's short name, so two choices never read the same on a
    // phone; the full name, and that the height is over the rail, stand under it.
    const fullName = (el) => { const m = B.mountsOf(d, el.dataset.scope).find((x) => x.name === el.value); $(`mount-full-${el.dataset.scope}`).textContent = m ? `${m.name}: its center ${m.centerOverRailIn} in over the rail` : ''; };
    for (const el of $('mounts').querySelectorAll('select')) { fullName(el); el.addEventListener('change', () => { fullName(el); renderPreview(); }); }
    const notes = [];
    if (lengths.length < 2) notes.push(`The ${r.name} was sold with one barrel length only, ${inches(r.barrelIn)}.`);
    if (!scopes.length) notes.push(r.scopeMount && r.scopeMount.rail !== 'picatinny' ? `No scope of the collection fits the ${r.name}'s receiver, so there is no mount to change.${r.scopeMount.ownScope ? ` Its own scope, the ${sightWord(r.scopeMount.ownScope.sight)}, stays in its own rings in every build.` : ''}` : 'No scope of the collection fits this rifle, so there is no mount to change.');
    $('no-change').textContent = notes.join(' ');
    renderPreview();
  }
  function renderPreview() {
    const s = spec();
    if (!named) $('name').value = suggestedName(s);
    $('changes').innerHTML = factTable(base(), preview(s));
    const ok = changed(s);
    $('make').disabled = !ok;
    $('make').title = ok ? '' : 'Change the barrel or a mount first: a build the same as the rifle is the rifle.';
    if (!ok) $('changes').innerHTML += '<p class="muted small">Nothing changed yet: this is the rifle as fitted. Change the barrel length or a mount to make a build.</p>';
  }
  $('rifle').addEventListener('change', (e) => { rifleId = e.target.value; named = false; renderMaker(); });
  $('barrel').addEventListener('change', renderPreview);
  $('name').addEventListener('input', () => { named = $('name').value.trim() !== ''; });
  $('make').addEventListener('click', () => {
    const s = spec();
    if (!changed(s)) return;
    const { build, saved } = RD.makeBuild(d, { ...s, name: $('name').value.trim() || suggestedName(s) });
    const c = RD.chooseFrom(d, { rifle: build.id, remembered: true });
    $('made').hidden = false;
    // Said from the record of the effect: saved is the store's own answer.
    $('made').innerHTML = saved
      ? `Made “${RD.esc(build.name)}”. It starts unzeroed, and is under the ${RD.esc(base().name)} on home. <a href="/zero${RD.params(c)}">Zero it at the bench</a>.`
      : `“${RD.esc(build.name)}” is not saved on this device: the browser refused its storage. It can be used while this page is open, and is gone after.`;
    named = false; renderMaker(); renderList();
  });

  // --- the list ----------------------------------------------------------------------------------
  function doors(id) {
    const c = RD.chooseFrom(d, { rifle: id, remembered: true });
    return `<div class="row doors"><a class="btn inline" href="/zero${RD.params(c)}">Zero bench</a><a class="btn inline secondary" href="/line${RD.params(c)}">Firing line</a><a class="btn inline secondary" href="/book${RD.params(c)}">The book</a></div>`;
  }
  function renderList() {
    if (RD.buildsReadFailed()) { $('builds').innerHTML = '<p class="readout">Not saved on this device: the browser refused to read its storage, so no build can be kept here.</p>'; $('removed').innerHTML = ''; return; }
    const live = IDS.map((id) => [id, B.buildsOf(d, id)]).filter(([, bs]) => bs.length);
    $('builds').innerHTML = live.length ? live.map(([id, bs]) => `<h3 class="group">${RD.esc(d.rifles[id].name)}</h3>${bs.map((b) => {
      const r = d.rifles[b], n = RD.zeroCount(b, r);
      return `<div class="entry build" data-build="${b}"><div class="what"><strong>“${RD.esc(r.build.name)}”</strong>: ${RD.esc(suggestedNameOf(r))}. ${n ? `Zeroed (${n} saved).` : 'Not zeroed yet.'}</div>
        <details><summary>What it changes</summary>${factTable(d.rifles[id], r)}</details>${doors(b)}
        <div class="acts"><button type="button" class="btn inline secondary remove">Remove</button></div></div>`;
    }).join('')}`).join('') : '<p class="muted small">No builds yet. Make one above: change one thing and name it.</p>';
    for (const el of $('builds').querySelectorAll('.remove')) el.addEventListener('click', () => {
      const id = el.closest('.entry').dataset.build;
      const done = RD.setBuildRemoved(d, id, true);
      renderList();
      if (!done) say('Not removed: the browser refused to store the change.');
    });
    const gone = Object.keys(d.rifles).filter((k) => d.rifles[k].buildOf && d.rifles[k].build.removed && IDS.includes(d.rifles[k].buildOf));
    $('removed').innerHTML = gone.length ? `<h3 class="group">Removed</h3><p class="muted small">Off every list; its zeros, book and days are kept as they were. Put it back to use it again.</p>${gone.map((b) => `<div class="entry removed" data-build="${b}"><div class="what">${RD.esc(d.rifles[b].name)}</div><div class="acts"><button type="button" class="btn inline secondary restore">Put it back</button></div></div>`).join('')}` : '';
    for (const el of $('removed').querySelectorAll('.restore')) el.addEventListener('click', () => {
      const id = el.closest('.entry').dataset.build;
      const done = RD.setBuildRemoved(d, id, false);
      renderList();
      if (!done) say('Not put back: the browser refused to store the change.');
    });
  }
  // What a made build is, in words: its changes.
  function suggestedNameOf(r) {
    const s = { barrelIn: r.build.barrelIn, mounts: r.build.mounts };
    const was = rifleId; rifleId = r.buildOf;
    const words = suggestedName(s); rifleId = was;
    return words.replace(/^(\d)/, 'a $1');
  }
  const say = (t) => { $('made').hidden = false; $('made').textContent = t; };

  renderMaker(); renderList();
  // The tests' door.
  window.RangeDayWorkbench = { spec, preview: () => preview(spec()), factRows: () => factRows(base(), preview(spec())) };
}());
