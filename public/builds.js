'use strict';
/* The workbench's arithmetic (range-day-seventeen), in one place for every
   screen and every test: a build is a what-if version of one rifle of the
   set (a different barrel length, a collection scope in a different mount)
   that the player makes on the device. Nothing here flies a bullet: a build
   only changes two of the engine's inputs, and every bullet still flies
   through /engine.js.

   - Muzzle speed: the load's speed from the rifle's barrel (data/loads.json,
     muzzleFps) plus, per inch of barrel added, the caliber's speed per inch
     (data/workbench.json, fpsPerInch), rounded to the whole foot per second.
     A barrel the length the rifle has gives the load's own figure.
   - Sight height over the bore, for a scope of the collection: the rifle's
     rail height over the bore (data/rifles.json, scopeMount) plus the chosen
     mount's center over the rail (data/workbench.json, mounts), the sum
     lib/guns.js makes for the mount the scope came in.
   Everything else about the rifle is the rifle's.

   A build is kept on the device (docs/RECORDS.md, "The builds"): { id, name,
   rifle, barrelIn, mounts: { <scope>: <mount name> }, madeAt, removedAt }.
   withBuilds() adds each to the game's data as a rifle of its own, keyed by
   its id, so every record the game keeps for a rifle (the sight setting, the
   zero, the shot log, the book, the cold-bore record, the zeroing supply, the
   days) is kept for a build under the build's id, in the existing shapes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RangeDayBuilds = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  const ID = /^b-[a-z0-9]+$/;
  const rail = (rifle) => (rifle.scopeMount && typeof rifle.scopeMount.railHeightOverBoreIn === 'number' ? rifle.scopeMount.railHeightOverBoreIn : null);

  // The speed per inch of barrel for a load's caliber, or null when the data has none.
  function perInch(d, loadId) {
    const l = d.loads[loadId], w = d.workbench;
    return l && w && w.fpsPerInch && typeof w.fpsPerInch[l.caliber] === 'number' ? w.fpsPerInch[l.caliber] : null;
  }
  // A load's muzzle speed from a barrel of barrelIn on the rifle `base` (a rifle as fitted).
  function speedFor(d, base, barrelIn, loadId) {
    const l = d.loads[loadId];
    if (barrelIn === base.barrelIn) return l.muzzleFps;
    const per = perInch(d, loadId);
    if (per === null) return l.muzzleFps;
    return Math.round(l.muzzleFps + (barrelIn - base.barrelIn) * per);
  }
  // The barrel lengths a build of the rifle may have (data/workbench.json), shortest first.
  function barrelsOf(d, rifleId) {
    const w = d.workbench, list = (w && w.barrels && w.barrels[rifleId]) || [];
    return list.map((b) => (typeof b === 'number' ? b : b.value)).filter((n) => typeof n === 'number').sort((a, b) => a - b);
  }
  // The mounts a collection scope may sit in (data/workbench.json): [{ name, centerOverRailIn }].
  function mountsOf(d, scopeId) {
    const w = d.workbench;
    return ((w && w.mounts && w.mounts[scopeId]) || []).filter((m) => m && typeof m.name === 'string' && typeof m.centerOverRailIn === 'number');
  }
  // The scopes of the rifle a build can mount differently: its collection scopes that have more than one mount in the data.
  function mountableOf(d, base) {
    return (base.collection || []).filter((s) => rail(base) !== null && mountsOf(d, s).length > 0);
  }
  // A collection scope's height over the bore on the rifle in the named mount, worked out as lib/guns.js works out the scope's own.
  function heightIn(d, base, scopeId, mountName) {
    const m = mountsOf(d, scopeId).find((x) => x.name === mountName);
    if (!m || rail(base) === null) return base.sightHeightIn[scopeId];
    return Math.round((rail(base) + m.centerOverRailIn) * 1000) / 1000;
  }
  // The mount a collection scope came in (data/sights.json, mount.name).
  const fittedMount = (d, scopeId) => (d.sights[scopeId] && d.sights[scopeId].mount ? d.sights[scopeId].mount.name : null);

  // Words for the name a build shows everywhere a rifle's name shows: "BCM AR-15 carbine build “20 in”, 5.56". The rifle's name
  // up to its first comma, then the build's own name, then the rest, so a screen that shortens a name at its first comma still
  // shows which build it is. The typed name loses its commas and quotes on screen (they stay in the record as typed).
  function displayName(base, name) {
    const typed = String(name || '').replace(/[,"“”]/g, ' ').replace(/\s+/g, ' ').trim() || 'unnamed';
    const i = base.name.indexOf(',');
    return i < 0 ? `${base.name} build “${typed}”` : `${base.name.slice(0, i)} build “${typed}”${base.name.slice(i)}`;
  }

  // One build as a rifle entry: the rifle's own entry with the barrel, the sight heights and the loads' speeds the build gives.
  function rifleOf(d, build) {
    const base = d.rifles[build.rifle];
    const sightHeightIn = { ...base.sightHeightIn };
    const mounts = {};
    for (const s of mountableOf(d, base)) {
      const name = build.mounts && build.mounts[s];
      if (name && mountsOf(d, s).some((m) => m.name === name)) { sightHeightIn[s] = heightIn(d, base, s, name); mounts[s] = name; }
    }
    const barrelIn = typeof build.barrelIn === 'number' ? build.barrelIn : base.barrelIn;
    const loadFps = Object.fromEntries(base.loads.map((l) => [l, speedFor(d, base, barrelIn, l)]));
    return {
      ...base, name: displayName(base, build.name), buildOf: build.rifle,
      build: { id: build.id, name: build.name, barrelIn, mounts, removed: Boolean(build.removedAt) },
      barrelIn, sightHeightIn, loadFps,
    };
  }
  // The game's data with the builds added as rifles. A build of a rifle the data no longer has is skipped (its record stays
  // stored). The rifles as fitted are untouched: the same entries, the same figures.
  function withBuilds(d, builds) {
    for (const b of Array.isArray(builds) ? builds : []) {
      if (!b || typeof b.id !== 'string' || !ID.test(b.id) || d.rifles[b.id] || !d.rifles[b.rifle] || d.rifles[b.rifle].buildOf) continue;
      d.rifles[b.id] = rifleOf(d, b);
    }
    return d;
  }
  // The load as the engine takes it from this rifle: for a build, the load with the build's speed; for a rifle as fitted, the
  // load itself, the same object.
  function loadFor(d, rifleId, loadId) {
    const r = d.rifles[rifleId], l = d.loads[loadId];
    if (!r || !r.loadFps || !(loadId in r.loadFps) || r.loadFps[loadId] === l.muzzleFps) return l;
    return { ...l, muzzleFps: r.loadFps[loadId] };
  }
  const isBuild = (d, rifleId) => Boolean(d.rifles[rifleId] && d.rifles[rifleId].buildOf);
  // A rifle's builds, oldest first; removed ones only when asked.
  function buildsOf(d, rifleId, withRemoved) {
    return Object.keys(d.rifles).filter((k) => d.rifles[k].buildOf === rifleId && (withRemoved || !d.rifles[k].build.removed));
  }
  // Plain words for how a build's speed was worked out, from the data's own basis (no figure for a shot not fired).
  function speedRuleWords(d, loadId) {
    const l = d.loads[loadId], per = perInch(d, loadId);
    if (per === null) return `no speed-per-inch figure for ${l.caliber}, so the load's own speed is used`;
    return `${l.caliber}: ${per >= 0 ? `${per} feet per second more` : `${-per} feet per second less`} for each inch of barrel added`;
  }
  const newId = (now, rand) => `b-${(now || Date.now()).toString(36)}${Math.floor((rand || Math.random)() * 1e6).toString(36)}`;

  return { ID, perInch, speedFor, barrelsOf, mountsOf, mountableOf, heightIn, fittedMount, displayName, rifleOf, withBuilds, loadFor, isBuild, buildsOf, speedRuleWords, newId };
}));
