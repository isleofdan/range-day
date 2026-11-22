'use strict';
// range-day-fourteen: a day of five shots on the firing line for playing back (three on steel, one on paper, one miss) and one at
// the bench, written into the device's open day the way the firing line writes them (docs/RECORDS.md, "The open day"). Its
// weather and course are the open day's own: a test or a screenshot state opens the firing line first, which starts the day.
// Shared by test/playback.test.js and scripts/screenshots.mjs.
const COURSE = 'cta-piru', RIFLE = 'molot-vepr-54r', SIGHT = 'utg-bugbuster-3-9x32', LOAD = 'sb-174-hpbt'; // the course with the 3D picture, so both pictures play it back
const LINE = `/line?course=${COURSE}&rifle=${RIFLE}&sight=${SIGHT}&load=${LOAD}`;
// [n, place, target, key, yards, hit, upIn, rightIn, flightS, seconds after the first]
const SHOTS = [
  [1, 'bench', 'paper', null, 100, true, -1.2, 0.6, null, 0],
  [2, 'line', 'steel', '0', 200, true, 2.1, -1.4, 0.2401349, 60],
  [3, 'line', 'steel', '1', 300, true, -3.2, 2.3, 0.3823077, 95],
  [4, 'line', 'paper', 'near-1', 100, true, 1.3, -0.9, 0.1153448, 130],
  [5, 'line', 'steel', '2', 400, false, 16.5, -14.2, 0.5322413, 170],
  [6, 'line', 'steel', '3', 500, true, 4.4, 3.1, 0.7041021, 210],
];
function seedShots(startMs) {
  return SHOTS.map(([n, place, target, key, yards, hit, upIn, rightIn, flightS, after]) => {
    const at = new Date(startMs + after * 1000).toISOString();
    const base = { n, at, place, yards, sight: SIGHT, elevationClicks: 2, windageClicks: 0, leaf: null, reached: true, upIn, rightIn };
    if (place === 'bench') return base;
    return { ...base, target, targetKey: key, flightS, elevationMoa: 0.83, windageMoa: 0, zero: null, heldUpMoa: 0, heldRightMoa: 0, windCall: null, conditionsShown: false, hit, book: target === 'steel' && hit, coldBore: false };
  });
}
// Runs in the page: writes the shots into the open day and answers its id.
const seedInPage = (shots) => { const k = 'range-day:day:open'; const day = JSON.parse(localStorage.getItem(k)); day.shots = shots; day.firstShotPlace = 'bench'; day.box.left = day.box.size - shots.filter((s) => s.place === 'line').length; localStorage.setItem(k, JSON.stringify(day)); return day.id; };
module.exports = { COURSE, RIFLE, SIGHT, LOAD, LINE, SHOTS, seedShots, seedInPage };
