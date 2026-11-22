'use strict';
// The day's page: plain facts about one day at the range, shown when a day
// ends and reachable for past days. The shots in order (bench groups and
// each shot at steel), which lines went into the book, the cold-bore line if
// there was one. No totals dressed as a score, no comparison with other
// days. A day packed up early offers "Back to the range" until another day
// is started.
(async function () {
  const d = await RD.data();
  const q = RD.qs();
  const $ = (id) => document.getElementById(id);
  const open = RD.openDay();
  const days = RD.finishedDays();
  const short = (s) => s.replace(/ \(modeled on.*\)$/, '');

  // Which day: the address's, else the open day with shots, else the newest finished one.
  let day = (q.id && RD.dayById(q.id)) || (open && RD.hasShots(open) ? open : null) || days[0] || null;

  function fillDays() {
    const all = [...(open && RD.hasShots(open) ? [open] : []), ...days];
    $('days').innerHTML = all.map((x) => `<option value="${RD.esc(x.id)}"${day && x.id === day.id ? ' selected' : ''}>${RD.esc(RD.dateText(x.date))}, ${RD.esc(d.rifles[x.rifle] ? d.rifles[x.rifle].name : x.rifle)}, ${x.shots.length} shot${x.shots.length === 1 ? '' : 's'}${x.endedAt ? '' : ' (open)'}</option>`).join('');
    $('days').hidden = !all.length;
    $('none').textContent = all.length ? '' : 'No days yet on this device. A day starts when you go through a door on home.';
    $('days').addEventListener('change', (e) => { location.href = `/day?id=${encodeURIComponent(e.target.value)}`; });
  }

  function render() {
    fillDays();
    if (!day) {
      $('title').textContent = 'No day to show';
      $('facts').textContent = 'A day starts when you go through a door on home; this page shows it when it ends, and every past day after that.';
      $('acts').innerHTML = '<a class="btn inline" href="/">Home</a>';
      $('cold').textContent = ''; $('shots').querySelector('tbody').innerHTML = '';
      return;
    }
    const rifle = d.rifles[day.rifle], load = d.loads[day.load], course = d.courses[day.course];
    const overBy = !day.endedAt ? 'still open' : day.endedBy === 'empty' ? 'ended when the box was empty' : day.endedBy === 'left' ? 'left open; closed on the next visit' : 'packed up early';
    $('title').textContent = `${RD.dateText(day.date)}: ${rifle ? rifle.name : day.rifle}`;
    const atSteel = day.shots.filter((s) => s.place === 'line'), bench = day.shots.filter((s) => s.place === 'bench');
    const hits = atSteel.filter((s) => s.hit).length;
    $('facts').innerHTML = `${RD.esc(RD.dayWords(day.weather, d.weather))} <strong>${RD.esc(course ? short(course.name) : day.course)}</strong>, ${RD.esc(rifle ? rifle.name : day.rifle)}, ${RD.esc(load ? load.name : day.load)}: ${RD.boxesText(day)} for the steel, ${RD.roundsFired(day)} fired, ${day.box.left} left; ${overBy}. ${bench.length} shot${bench.length === 1 ? '' : 's'} at the bench (from the zeroing supply), ${atSteel.length} at steel${atSteel.length ? ` (${hits} hit)` : ''}.`;
    const sightUsed = [...new Set(day.shots.map((s) => s.sight).filter(Boolean))];
    const bookHref = `/book?course=${day.course}&rifle=${day.rifle}&sight=${sightUsed[sightUsed.length - 1] || (rifle ? rifle.defaultSight : '')}&load=${day.load}`;
    // range-day-fourteen: the day played back through the spotting scope, open or finished
    let acts = `<a id="play-back" class="btn inline" href="/playback?id=${encodeURIComponent(day.id)}">Play this day back</a><a class="btn inline secondary" href="${bookHref}">The book</a>`;
    if (!day.endedAt) acts += `<a class="btn inline" href="/line?course=${day.course}&rifle=${day.rifle}&sight=${sightUsed[sightUsed.length - 1] || (rifle ? rifle.defaultSight : '')}&load=${day.load}">Back to the firing line</a><button id="pack-up" type="button" class="btn inline secondary">Pack up</button>`;
    else if (day.endedBy === 'packed' && RD.packedDayId() === day.id && !open) acts += '<button id="back" type="button" class="btn inline">Back to the range</button>';
    acts += '<a class="btn inline secondary" href="/">Home</a>';
    $('acts').innerHTML = acts;
    if ($('back')) $('back').addEventListener('click', () => {
      const restored = RD.restorePacked();
      if (restored) location.href = `/line?course=${restored.course}&rifle=${restored.rifle}&sight=${sightUsed[sightUsed.length - 1] || (rifle ? rifle.defaultSight : '')}&load=${restored.load}`;
      else { $('note').hidden = false; $('note').textContent = 'The day could not be reopened: another day has been started since, or the browser refused its storage.'; }
    });
    if ($('pack-up')) $('pack-up').addEventListener('click', () => { const packed = RD.packUp(); location.href = packed ? `/day?id=${encodeURIComponent(packed.id)}` : '/'; });
    // The cold-bore line.
    const cold = day.shots.find((s) => s.coldBore);
    if (cold) $('cold').textContent = `${RD.dateText(day.date)}, ${cold.yards} yards, ${d.sights[cold.sight] ? d.sights[cold.sight].name : cold.sight}: elevation ${RD.sign(cold.elevationClicks)} clicks, windage ${RD.sign(cold.windageClicks)} clicks${cold.leaf != null ? `, leaf ${cold.leaf / 100}` : ''}, wind ${RD.windCallText(cold.windCall)}, ${day.weather.tempF} F: ${cold.target === 'paper' ? (cold.hit ? 'on paper' : 'off the paper') : cold.hit ? 'hit' : 'miss'}, ${cold.reached ? RD.whereText(cold.upIn, cold.rightIn) + ' of center' : `into the ground before the ${cold.target === 'paper' ? 'paper' : 'plate'}`} (${cold.target === 'paper' ? 'paper' : 'steel'}).`;
    else if (!day.shots.length) $('cold').textContent = 'No shot yet.';
    else if (day.firstShotPlace === 'bench') $('cold').textContent = 'No cold-bore line: the day began at the bench.';
    else $('cold').textContent = 'No cold-bore line: the day\'s first shot was fired with "Show the conditions" on.';
    // Every shot.
    $('shots').querySelector('tbody').innerHTML = day.shots.map((s) => `<tr class="${s.place === 'line' ? (s.hit ? 'hit' : 'miss') : 'bench'}"><td>${s.n}</td><td>${s.place === 'bench' ? 'bench' : RD.kindOf({ kind: s.target })}</td><td>${s.yards}</td><td>${RD.sign(s.elevationClicks)}</td><td>${RD.sign(s.windageClicks)}${s.leaf != null ? ` · leaf ${s.leaf / 100}` : ''}</td><td>${s.place === 'line' ? RD.heldText(s.heldUpMoa, s.heldRightMoa) : 'rested'}</td><td>${s.place === 'line' ? RD.esc(RD.windCallText(s.windCall)) : ''}</td><td${s.hit ? ' class="hit"' : ''}>${s.place === 'bench' ? (s.reached ? RD.esc(RD.whereText(s.upIn, s.rightIn)) + ' of center' : 'off the paper') : RD.esc(RD.shotWords(s))}${s.conditionsShown ? ' (conditions shown)' : ''}</td><td>${[s.book ? 'book' : '', s.coldBore ? 'cold bore' : ''].filter(Boolean).join(', ')}</td></tr>`).join('');
  }
  render();
}());
