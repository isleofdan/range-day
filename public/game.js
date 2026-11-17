'use strict';
/* What the three screens share: the game's data (from /api/data), the
   things kept on this device (the sight settings, saved zeros, the shot
   log, the one setting), the day's weather, the sounds, and small
   helpers. Every bullet still flies through /engine.js; nothing here does
   physics. */
window.RD = (function () {
  const E = window.RangeDayEngine;

  // --- data ------------------------------------------------------------------
  let DATA = null;
  async function data() {
    if (!DATA) DATA = await (await fetch('/api/data', { headers: { accept: 'application/json' } })).json();
    defaultSightOf = (rifle) => (DATA.rifles[rifle] ? DATA.rifles[rifle].defaultSight : null);
    return DATA;
  }

  // --- what lives on this device -------------------------------------------------
  // Every read and write is wrapped: a browser that refuses storage (a
  // private window, a full disk) must not break a screen; it shows
  // "not saved on this device" instead.
  // A read that the browser refuses answers FAILED, never null, so a screen
  // can say "not saved on this device" instead of "no zero saved yet".
  const FAILED = Object.freeze({ failed: true });
  const store = {
    FAILED,
    get(key) { try { const v = localStorage.getItem(`range-day:${key}`); return v ? JSON.parse(v) : null; } catch { return FAILED; } },
    set(key, value) { try { localStorage.setItem(`range-day:${key}`, JSON.stringify(value)); return true; } catch { return false; } },
    remove(key) { try { localStorage.removeItem(`range-day:${key}`); return true; } catch { return false; } },
  };
  // The sight as it is physically set on the rifle (clicks from the middle;
  // on a sight with a sliding leaf, which setting the leaf is at; on the dot
  // with a magnifier behind it, whether the magnifier is flipped in).
  const sightKey = (rifle, sight) => `sight:${rifle}:${sight}`;
  const getSight = (rifle, sight) => { const v = store.get(sightKey(rifle, sight)); return v && v !== FAILED ? { elevationClicks: 0, windageClicks: 0, ...v } : { elevationClicks: 0, windageClicks: 0 }; };
  const sightReadFailed = (rifle, sight) => store.get(sightKey(rifle, sight)) === FAILED;
  const setSight = (rifle, sight, v) => store.set(sightKey(rifle, sight), v);

  // A saved zero belongs to a rifle, a sight and a load (several sights can
  // sit on one rifle); so does the shot log. Before every sight could be
  // chosen (range-day-one) both were kept per rifle and load, the zero
  // recording which sight made it. Those records keep working: when nothing
  // is stored in the new form, the old record is read for the sight it
  // names (a log: for the rifle's sight of that time, defaultSight in
  // data/rifles.json), written forward, and left in place.
  const zeroKey = (rifle, sight, load) => `zero:${rifle}:${sight}:${load}`;
  const oldZeroKey = (rifle, load) => `zero:${rifle}:${load}`;
  const logKey = (rifle, sight, load) => `log:${rifle}:${sight}:${load}`;
  const oldLogKey = (rifle, load) => `log:${rifle}:${load}`;
  let defaultSightOf = () => null; // set once the data is loaded (data() below)
  function getZero(rifle, sight, load) {
    const v = store.get(zeroKey(rifle, sight, load));
    if (v) return v; // a record, or FAILED
    const old = store.get(oldZeroKey(rifle, load));
    if (!old || old === FAILED) return old === FAILED ? FAILED : null;
    const madeWith = old.sight || defaultSightOf(rifle);
    if (madeWith !== sight) return null;
    store.set(zeroKey(rifle, sight, load), old); // forward; the old record stays
    return old;
  }
  const setZero = (rifle, sight, load, v) => store.set(zeroKey(rifle, sight, load), v);
  function getLog(rifle, sight, load) {
    const v = store.get(logKey(rifle, sight, load));
    if (Array.isArray(v)) return v;
    if (v === FAILED) return [];
    if (sight !== defaultSightOf(rifle)) return [];
    const old = store.get(oldLogKey(rifle, load));
    if (!Array.isArray(old)) return [];
    store.set(logKey(rifle, sight, load), old);
    return old;
  }
  const setLog = (rifle, sight, load, v) => store.set(logKey(rifle, sight, load), v);
  // Whether any zero is saved on this device for a rifle (any sight, any load): for the home screen's list.
  function zeroCount(rifle, rifleData) {
    let n = 0;
    for (const sight of rifleData.sights) for (const load of rifleData.loads) { const z = getZero(rifle, sight, load); if (z && z !== FAILED) n++; }
    return n;
  }
  // What was last used on this device: the rifle, and per rifle its sight, load and course.
  const getLast = () => { const v = store.get('last'); return v && v !== FAILED ? v : null; };
  const setLast = (v) => store.set('last', v);
  const getLastFor = (rifle) => { const v = store.get(`last:${rifle}`); return v && v !== FAILED ? v : null; };
  const setLastFor = (rifle, v) => store.set(`last:${rifle}`, v);
  const showConditions = () => store.get('show-conditions') === true;
  const setShowConditions = (on) => store.set('show-conditions', on === true);

  // --- the day ------------------------------------------------------------------------
  // Each visit to a course draws a warm dry day and a light, variable canyon
  // breeze from data/weather.json. The draw is kept for the visit (the
  // browser tab), so the zero bench and the firing line share one day.
  function drawDay(course, weather, rand) {
    const r = rand || Math.random;
    const between = (lo, hi) => lo + (hi - lo) * r();
    const tempF = Math.round(between(weather.tempF.low, weather.tempF.high));
    const humidity = Math.round(between(weather.humidity.low, weather.humidity.high) * 100) / 100;
    const speedMph = Math.round(between(weather.windMph.low, weather.windMph.high) * 10) / 10;
    const [a, b, c, d] = weather.windFromDegrees;
    const fromDegrees = Math.round(r() < 0.5 ? between(a, b) : between(c, d));
    const v = weather.stretchVariation;
    const stretch = (from, to, factor) => ({
      fromYards: from, toYards: to,
      speedMph: Math.round(speedMph * (1 + factor * between(-v, v)) * 10) / 10,
      fromDegrees: Math.round(fromDegrees + between(-25, 25)),
      gustMph: Math.round(between(weather.gustMph.low, weather.gustMph.high) * 10) / 10,
      periodS: Math.round(between(weather.gustPeriodS.low, weather.gustPeriodS.high)),
      phase: between(0, 6.28),
    });
    const far = course.steelTo;
    return {
      course: course.id, tempF, humidity, altitudeFt: course.altitudeFt,
      pressureInHg: Math.round(E.pressureAt(course.altitudeFt) * 100) / 100,
      speedMph, fromDegrees,
      wind: [stretch(0, far / 3, 0.6), stretch(far / 3, (2 * far) / 3, 0.8), stretch((2 * far) / 3, 100000, 1.0)],
    };
  }
  function day(course, weather) {
    const key = `range-day:day:${course.id}`;
    try { const v = sessionStorage.getItem(key); if (v) return JSON.parse(v); } catch {}
    const d = drawDay(course, weather);
    try { sessionStorage.setItem(key, JSON.stringify(d)); } catch {}
    return d;
  }
  function newDay(course, weather) {
    try { sessionStorage.removeItem(`range-day:day:${course.id}`); } catch {}
    return day(course, weather);
  }
  const conditionsOf = (d) => ({ altitudeFt: d.altitudeFt, tempF: d.tempF, pressureInHg: d.pressureInHg, humidity: d.humidity });

  // --- sounds, made in code ---------------------------------------------------------
  let ctx = null;
  function audio() {
    if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function noise(seconds) {
    const c = audio(); if (!c) return null;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf; return src;
  }
  // The shot: a sharp crack (noise, filtered) over a low thump.
  function shotSound(loudness = 1) {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const n = noise(0.5); if (!n) return;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.4);
    const g = c.createGain(); g.gain.setValueAtTime(0.9 * loudness, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    n.connect(f).connect(g).connect(c.destination); n.start(t);
    const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const og = c.createGain(); og.gain.setValueAtTime(0.8 * loudness, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(og).connect(c.destination); o.start(t); o.stop(t + 0.4);
  }
  // Steel ringing: a few inharmonic partials, decaying, faint with distance.
  function ringSound(delayS, loudness = 1) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + Math.max(0, delayS);
    for (const [freq, amp, decay] of [[1180, 0.5, 1.6], [1870, 0.3, 1.2], [2740, 0.2, 0.8], [620, 0.25, 1.8]]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp * loudness, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + decay + 0.05);
    }
  }
  // A dull thud for a miss into the dirt, late by the sound's trip back.
  function thudSound(delayS, loudness = 0.4) {
    const c = audio(); if (!c) return;
    const t = c.currentTime + Math.max(0, delayS);
    const n = noise(0.25); if (!n) return;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
    const g = c.createGain(); g.gain.setValueAtTime(loudness, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    n.connect(f).connect(g).connect(c.destination); n.start(t);
  }
  // A turret click.
  function clickSound() {
    const c = audio(); if (!c) return;
    const t = c.currentTime;
    const n = noise(0.03); if (!n) return;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3000; f.Q.value = 2;
    const g = c.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    n.connect(f).connect(g).connect(c.destination); n.start(t);
  }

  // --- what the address asks for -----------------------------------------------------------
  // course, rifle, sight and load from the address; a missing or unknown
  // piece falls back to the last used on this device, then to the rifle's
  // own default (an address without a sight opens the sight the rifle had
  // before every sight could be chosen, so old links still work).
  function chooseFrom(d, q) {
    const last = getLast();
    const rifleId = d.rifles[q.rifle] ? q.rifle : (last && d.rifles[last.rifle] ? last.rifle : 'molot-vepr-54r');
    const rifle = d.rifles[rifleId];
    const lastFor = getLastFor(rifleId) || {};
    const playableSights = rifle.sights.filter((s) => d.sights[s].kind !== 'magnifier');
    const sightId = playableSights.includes(q.sight) ? q.sight : (q.rifle && !q.sight ? rifle.defaultSight : (playableSights.includes(lastFor.sight) ? lastFor.sight : rifle.defaultSight));
    const loadId = rifle.loads.includes(q.load) ? q.load : (rifle.loads.includes(lastFor.load) ? lastFor.load : rifle.loads[0]);
    const firstCourse = rifleId === 'molot-vepr-54r' ? 'cta-piru' : 'angeles-sylmar';
    const courseId = d.courses[q.course] ? q.course : (d.courses[lastFor.course] ? lastFor.course : firstCourse);
    return { rifleId, sightId, loadId, courseId, magnifierId: rifle.sights.find((s) => d.sights[s].kind === 'magnifier') || null };
  }
  const params = (c) => `?course=${c.courseId}&rifle=${c.rifleId}&sight=${c.sightId}&load=${c.loadId}`;
  // Remember the choice, for next time on this device.
  function remember(c) { setLast({ rifle: c.rifleId }); setLastFor(c.rifleId, { sight: c.sightId, load: c.loadId, course: c.courseId }); }

  // --- a knob: press for one step; press and hold to repeat, speeding up -------------------------------
  // The first step comes on the press (never on the click, so a tap is one
  // step, not two); from 400 ms on it repeats, each repeat a little faster,
  // down to about 20 steps a second. Enter or the space bar step once.
  function holdRepeat(button, step) {
    let timer = null;
    const stop = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const go = (delay) => { timer = setTimeout(() => { step(); go(Math.max(50, delay * 0.8)); }, delay); };
    button.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; e.preventDefault(); stop(); step(); go(400); try { button.setPointerCapture(e.pointerId); } catch {} });
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(ev, stop);
    button.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); step(); } });
    button.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // --- helpers -------------------------------------------------------------------------
  const qs = () => Object.fromEntries(new URLSearchParams(location.search));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sign = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n);
  const moaOf = (clicks, per) => Math.round(clicks * per * 100) / 100;
  // "+12 clicks (3 MOA up)"
  function clicksText(clicks, per, upWord, downWord) {
    if (!clicks) return '0 clicks (middle)';
    return `${sign(clicks)} clicks (${moaOf(Math.abs(clicks), per)} MOA ${clicks > 0 ? upWord : downWord})`;
  }
  // The one line under the view: "Elevation +12 clicks (3 MOA up) · Windage 0 clicks (middle)" plus the leaf or the magnifier.
  function settingLine(setting, sight, extra) {
    const parts = [`Elevation ${clicksText(setting.elevationClicks, sight.clickMoa, 'up', 'down')}`, `Windage ${clicksText(setting.windageClicks, sight.windageClickMoa, 'right', 'left')}`];
    if (extra) parts.push(extra);
    return parts.join(' · ');
  }
  // A leaf setting's name: "3 (300 m)", or "П (300 m, the battle setting)".
  function leafText(leaf, ix) {
    const m = leaf.settingsMeters[ix];
    const battle = leaf.battleSettingMeters === m ? ', the "П" battle setting' : '';
    return `${m / 100} (${m} m${battle})`;
  }
  // "7 in low, 12 in right" from an offset in inches against the aim point
  function whereText(upIn, rightIn) {
    const v = Math.abs(upIn) < 0.5 ? 'level' : `${Math.abs(upIn).toFixed(upIn > 10 ? 0 : 1)} in ${upIn > 0 ? 'high' : 'low'}`;
    const h = Math.abs(rightIn) < 0.5 ? 'centered' : `${Math.abs(rightIn).toFixed(Math.abs(rightIn) > 10 ? 0 : 1)} in ${rightIn > 0 ? 'right' : 'left'}`;
    return `${v}, ${h}`;
  }
  const windWord = (deg) => {
    const d = ((deg % 360) + 360) % 360;
    if (d < 22.5 || d >= 337.5) return 'head-on';
    if (d < 67.5) return 'from the front right';
    if (d < 112.5) return 'from the right';
    if (d < 157.5) return 'from the back right';
    if (d < 202.5) return 'from behind';
    if (d < 247.5) return 'from the back left';
    if (d < 292.5) return 'from the left';
    return 'from the front left';
  };
  // The crosswind part, in mph, positive pushing the bullet right (wind from the left).
  const crosswindMph = (stretch) => -stretch.speedMph * Math.sin((stretch.fromDegrees * Math.PI) / 180);
  // Field of view, in MOA across the view, at a magnification between the sight's low and high.
  function fovMoa(sight, mag) {
    const lo = sight.zoom.low, hi = sight.zoom.high;
    const ft = hi === lo ? sight.fovFtAt100.low : sight.fovFtAt100.low * (lo / mag); // a scope's field shrinks with magnification
    return (ft * 12) / E.inchesPerMoa(100);
  }
  // Fits a square canvas to its container, at the device's pixel ratio.
  function fitCanvas(canvas, maxPx) {
    const w = Math.min(canvas.parentElement.clientWidth, maxPx || 640);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${w}px`; canvas.style.height = `${w}px`;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(w * dpr);
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, size: w };
  }
  // A small seeded random for the drawn terrain, so a course looks the same each visit.
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  return { E, data, store, getSight, sightReadFailed, setSight, getZero, setZero, getLog, setLog, zeroCount, getLast, setLast, getLastFor, setLastFor, chooseFrom, params, remember, holdRepeat, settingLine, leafText, showConditions, setShowConditions, drawDay, day, newDay, conditionsOf, audio, shotSound, ringSound, thudSound, clickSound, qs, esc, sign, moaOf, clicksText, whereText, windWord, crosswindMph, fovMoa, fitCanvas, hash };
}());
