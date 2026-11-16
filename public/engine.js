/* Range Day's one physics engine. Every bullet on every screen (the zero
   bench, the firing line, the tests) flies through this file with the same
   inputs. No screen corrects a result.

   It is plain JavaScript that loads two ways: as a script in a page
   (window.RangeDayEngine) and as a Node module (require). It owns no data:
   the drag tables, loads, rifles and sights come in as arguments, from the
   files under data/.

   Units inside: feet, seconds, pounds, degrees Fahrenheit, inches of
   mercury. Angles in radians inside; MOA (minute of angle, 1/60 of a
   degree, about 1.047 inches at 100 yards) at the edges, because sights
   click in MOA.

   How a shot is flown (one method, used everywhere):
   - World axes: x downrange (level), y up, z to the shooter's right.
   - The line of sight runs from the eye to the aim point, which may sit
     above or below the shooter: a target R yards away and h feet higher
     puts the line of sight at the angle atan(h / (3R)) above level. Uphill
     and downhill are pure geometry: gravity always points straight down,
     and the bullet is flown in world axes until it reaches the target's
     distance along the line of sight. There is no "cosine rule" anywhere.
   - The bore starts `sightHeight` inches below the line of sight and
     points `elevation` MOA above it and `windage` MOA to the right of it
     (the sight's setting, plus the rifle's own mechanical offset, plus the
     per-shot spread).
   - Each step: gravity; drag from the G1 or G7 table at the bullet's Mach
     number in the air it is in; wind as the air moving, in up to three
     stretches of the path, changing with time.
   - Integration: fourth-order Runge-Kutta, 1 ms steps (about 1,500 steps
     to 1,000 yards).

   Drag: the ballistic coefficient scales the standard projectile's drag.
   The standard projectile (G1 or G7) weighs 1 lb and is 1 inch across;
   a bullet with coefficient BC decelerates as that projectile would,
   divided by BC. The tables give the drag coefficient Cd against Mach:
     a = (rho * v^2 * Cd(M) * A) / (2 * m * BC), A = pi/4 in^2, m = 1 lb.
   Standard air for coefficients: ICAO sea level, 59 F, 29.92 inHg, dry
   (density 0.0764742 lb/ft^3). This is the convention JBM Ballistics and
   most makers' tables use; the verification in the report checks it.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RangeDayEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const G = 32.17405;                 // ft/s^2
  const MOA = Math.PI / (180 * 60);   // radians per minute of angle
  const STD_DENSITY = 0.0764742;      // lb/ft^3, ICAO sea level, 59 F, dry
  const STD_PRESSURE = 29.92;         // inHg
  const STD_TEMP_F = 59;
  const A_STD = Math.PI / 4 / 144;    // ft^2, a 1-inch circle
  const M_STD = 1;                    // lb
  const DT = 0.001;                   // s

  // --- air -----------------------------------------------------------------

  // Station pressure at a height when none is measured (the ISA formula for
  // the lower atmosphere, which only needs the height in feet).
  function pressureAt(altitudeFt) {
    return STD_PRESSURE * Math.pow(1 - 6.8756e-6 * altitudeFt, 5.2559);
  }

  // Air density in lb/ft^3 from temperature (F), station pressure (inHg)
  // and relative humidity (0 to 1). Water vapour is lighter than dry air,
  // so humid air is thinner: the partial pressure of vapour is taken out
  // of the dry-air term and put back at the vapour's own gas constant.
  function airDensity(tempF, pressureInHg, humidity) {
    const tK = (tempF - 32) * 5 / 9 + 273.15;
    const pPa = pressureInHg * 3386.389;
    // Saturation vapour pressure over water, Pa (Tetens).
    const tC = tK - 273.15;
    const es = 610.78 * Math.exp(17.27 * tC / (tC + 237.3));
    const pv = Math.max(0, Math.min(1, humidity || 0)) * es;
    const pd = pPa - pv;
    const rhoKgM3 = pd / (287.058 * tK) + pv / (461.495 * tK);
    return rhoKgM3 * 0.062428; // kg/m^3 -> lb/ft^3
  }

  // Speed of sound in ft/s from temperature (F). Humidity changes it by
  // well under 1% and is left out.
  function speedOfSound(tempF) {
    const tR = tempF + 459.67;
    return 49.0223 * Math.sqrt(tR);
  }

  // Fills in a conditions object: {altitudeFt, tempF, pressureInHg?, humidity?}.
  function air(conditions) {
    const c = conditions || {};
    const altitudeFt = c.altitudeFt || 0;
    const tempF = c.tempF == null ? STD_TEMP_F : c.tempF;
    const pressureInHg = c.pressureInHg == null ? pressureAt(altitudeFt) : c.pressureInHg;
    const humidity = c.humidity == null ? 0 : c.humidity;
    const density = airDensity(tempF, pressureInHg, humidity);
    return { altitudeFt, tempF, pressureInHg, humidity, density, densityRatio: density / STD_DENSITY, mach1: speedOfSound(tempF) };
  }

  // --- drag ----------------------------------------------------------------

  // A drag table is [[mach, cd], ...] sorted by mach. Linear interpolation
  // between rows; flat beyond the ends.
  function cdAt(table, mach) {
    if (mach <= table[0][0]) return table[0][1];
    const last = table[table.length - 1];
    if (mach >= last[0]) return last[1];
    let lo = 0, hi = table.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (table[mid][0] <= mach) lo = mid; else hi = mid; }
    const [m0, c0] = table[lo], [m1, c1] = table[hi];
    return c0 + (c1 - c0) * (mach - m0) / (m1 - m0);
  }

  // --- wind ----------------------------------------------------------------

  // Wind is given as stretches of the path, each {fromYards, toYards,
  // speedMph, fromDegrees} where fromDegrees is where the wind comes FROM,
  // clockwise from downrange: 0 is a headwind (from the target), 90 is from
  // the right, 180 a tailwind, 270 from the left. A stretch may also carry
  // a gust: {gustMph, periodS, phase} so the speed changes over time.
  // Returns the air's velocity in ft/s in world axes.
  function windAt(stretches, downrangeFt, t) {
    if (!stretches || !stretches.length) return [0, 0, 0];
    const yards = downrangeFt / 3;
    let s = stretches[stretches.length - 1];
    for (const st of stretches) { if (yards >= st.fromYards && yards < st.toYards) { s = st; break; } }
    let mph = s.speedMph || 0;
    if (s.gustMph) mph += s.gustMph * Math.sin(2 * Math.PI * ((t || 0) / (s.periodS || 8)) + (s.phase || 0));
    const fps = mph * 5280 / 3600;
    const from = (s.fromDegrees || 0) * Math.PI / 180;
    // The air moves toward (from + 180). Downrange component and rightward component.
    return [-fps * Math.cos(from), 0, -fps * Math.sin(from)];
  }

  // --- the shot --------------------------------------------------------------

  /* fly(input) flies one bullet and returns where it is at the target.
     input:
       load:  {muzzleFps, bc, dragModel: 'G1'|'G7'}
       drag:  {G1: table, G7: table}
       sightHeightIn: the sight line's height above the bore at the muzzle
       elevationMoa, windageMoa: the bore's angle from the line of sight
                                 (up and right positive), everything included
       targetYards: distance to the target along the line of sight
       targetRiseFt: how much higher (negative: lower) the target is than
                     the muzzle; the line of sight is tilted to reach it
       conditions: {altitudeFt, tempF, pressureInHg, humidity}
       wind: stretches (see windAt); may be empty
       t0: the clock at the shot (s), for the gusts
       maxTimeS: give up after this long (default 6 s)
     returns:
       {hit: {upIn, rightIn}       offsets from the aim point at the target,
                                   in inches, measured square to the line of
                                   sight (up and right positive)
        timeS, speedFps, mach, subsonic, lineOfSightAngle,
        pathDropIn                 how far the bullet is below the bore line
                                   (gravity's work alone),
        trace: [[x,y,z,t], ...]    every 10th step, for drawing}
  */
  function fly(input) {
    const load = input.load;
    const table = input.drag[load.dragModel === 'G7' ? 'G7' : 'G1'];
    const atm = air(input.conditions);
    const bc = load.bc;
    const alpha = Math.atan2(input.targetRiseFt || 0, (input.targetYards || 100) * 3);
    const R = (input.targetYards || 100) * 3;
    // Line of sight L and its perpendicular "up" U in the vertical plane.
    const L = [Math.cos(alpha), Math.sin(alpha), 0];
    const U = [-Math.sin(alpha), Math.cos(alpha), 0];
    const sh = (input.sightHeightIn || 0) / 12;
    const el = (input.elevationMoa || 0) * MOA;
    const wd = (input.windageMoa || 0) * MOA;
    // Bore direction: L rotated up by el (in the vertical plane) and right by wd.
    const inPlane = [Math.cos(el), Math.sin(el)]; // along L, along U
    const dir = [
      (L[0] * inPlane[0] + U[0] * inPlane[1]) * Math.cos(wd),
      (L[1] * inPlane[0] + U[1] * inPlane[1]) * Math.cos(wd),
      Math.sin(wd),
    ];
    let p = [-sh * U[0], -sh * U[1], 0];
    let v = [dir[0] * load.muzzleFps, dir[1] * load.muzzleFps, dir[2] * load.muzzleFps];
    const k = atm.density * A_STD / (2 * M_STD * bc); // a = k * Cd * vrel^2
    const t0 = input.t0 || 0;
    const wind = input.wind || [];

    const accel = (pos, vel, t) => {
      const w = windAt(wind, pos[0], t0 + t);
      const rx = vel[0] - w[0], ry = vel[1] - w[1], rz = vel[2] - w[2];
      const speed = Math.sqrt(rx * rx + ry * ry + rz * rz);
      const cd = cdAt(table, speed / atm.mach1);
      const a = k * cd * speed; // times the unit vector of relative velocity
      return [-a * rx, -a * ry - G, -a * rz];
    };

    const trace = [];
    const maxT = input.maxTimeS || 6;
    let t = 0, step = 0;
    let along = p[0] * L[0] + p[1] * L[1];
    let prevP = p, prevV = v, prevT = 0, prevAlong = along;
    while (along < R && t < maxT) {
      prevP = p; prevV = v; prevT = t; prevAlong = along;
      // RK4
      const a1 = accel(p, v, t);
      const p2 = [p[0] + v[0] * DT / 2, p[1] + v[1] * DT / 2, p[2] + v[2] * DT / 2];
      const v2 = [v[0] + a1[0] * DT / 2, v[1] + a1[1] * DT / 2, v[2] + a1[2] * DT / 2];
      const a2 = accel(p2, v2, t + DT / 2);
      const p3 = [p[0] + v2[0] * DT / 2, p[1] + v2[1] * DT / 2, p[2] + v2[2] * DT / 2];
      const v3 = [v[0] + a2[0] * DT / 2, v[1] + a2[1] * DT / 2, v[2] + a2[2] * DT / 2];
      const a3 = accel(p3, v3, t + DT / 2);
      const p4 = [p[0] + v3[0] * DT, p[1] + v3[1] * DT, p[2] + v3[2] * DT];
      const v4 = [v[0] + a3[0] * DT, v[1] + a3[1] * DT, v[2] + a3[2] * DT];
      const a4 = accel(p4, v4, t + DT);
      p = [
        p[0] + DT / 6 * (v[0] + 2 * v2[0] + 2 * v3[0] + v4[0]),
        p[1] + DT / 6 * (v[1] + 2 * v2[1] + 2 * v3[1] + v4[1]),
        p[2] + DT / 6 * (v[2] + 2 * v2[2] + 2 * v3[2] + v4[2]),
      ];
      v = [
        v[0] + DT / 6 * (a1[0] + 2 * a2[0] + 2 * a3[0] + a4[0]),
        v[1] + DT / 6 * (a1[1] + 2 * a2[1] + 2 * a3[1] + a4[1]),
        v[2] + DT / 6 * (a1[2] + 2 * a2[2] + 2 * a3[2] + a4[2]),
      ];
      t += DT; step++;
      along = p[0] * L[0] + p[1] * L[1];
      if (step % 10 === 0) trace.push([p[0], p[1], p[2], t]);
      if (p[1] < -200) break; // into the ground long before the target
    }
    if (along < R) {
      return { reached: false, timeS: t, trace, lineOfSightAngle: alpha, hit: null };
    }
    // Interpolate the last step to the exact distance along L.
    const f = (R - prevAlong) / (along - prevAlong);
    const pe = [prevP[0] + (p[0] - prevP[0]) * f, prevP[1] + (p[1] - prevP[1]) * f, prevP[2] + (p[2] - prevP[2]) * f];
    const ve = [prevV[0] + (v[0] - prevV[0]) * f, prevV[1] + (v[1] - prevV[1]) * f, prevV[2] + (v[2] - prevV[2]) * f];
    const te = prevT + (t - prevT) * f;
    const aim = [R * L[0], R * L[1], 0];
    const upFt = (pe[0] - aim[0]) * U[0] + (pe[1] - aim[1]) * U[1];
    const speed = Math.sqrt(ve[0] * ve[0] + ve[1] * ve[1] + ve[2] * ve[2]);
    const mach = speed / atm.mach1;
    // Where the bore line would be at this distance (for "drop" in the usual sense).
    const boreUpFt = -sh + R * Math.tan(el);
    return {
      reached: true,
      hit: { upIn: upFt * 12, rightIn: pe[2] * 12 },
      timeS: te,
      speedFps: speed,
      mach,
      subsonic: mach < 1,
      transonic: mach < 1.2,
      pathDropIn: (boreUpFt - upFt) * 12,
      lineOfSightAngle: alpha,
      air: atm,
      trace,
    };
  }

  // --- spread ----------------------------------------------------------------

  /* The load's spread figure is the extreme spread of a five-shot group in
     MOA, which is how groups are usually quoted. For a round normal scatter
     the expected five-shot extreme spread is about 3.06 times the per-axis
     standard deviation (from the distribution of the largest distance
     between five points: a textbook figure, e.g. Taylor & Grubbs, 1975),
     so sigma = spreadMoa / 3.06 per axis.
     Below Mach 1.2 the bullet is losing its steadiness (transonic); below
     Mach 1 it is through the barrier. The extra spread there is an
     estimate: +50% of sigma in the transonic band and +150% once
     subsonic, which is the order long-range shooters report for match
     bullets and is marked an estimate in the data file. */
  function spreadSigmaMoa(spreadMoa, mach) {
    let sigma = (spreadMoa || 0) / 3.06;
    if (mach != null) {
      if (mach < 1) sigma *= 2.5;
      else if (mach < 1.2) sigma *= 1.5;
    }
    return sigma;
  }

  // A normal deviate from a seeded or unseeded source.
  function gaussian(rand) {
    const r = rand || Math.random;
    let u = 0, v = 0;
    while (u === 0) u = r();
    while (v === 0) v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // A small seeded generator (mulberry32) so tests and replays repeat.
  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* shoot(input): one shot as the game fires it. Takes everything fly()
     takes, plus:
       sight: {clickMoa, elevationClicks, windageClicks}  the sight as set
       rifle: {sightHeightIn, boreOffsetMoa: {up, right}}  the rifle's own
              mechanical offset (why a fresh sight needs zeroing)
       load.spreadMoa
       rand: a function returning [0,1), for repeatable tests
     The per-shot spread is drawn first from the load's figure, then the
     shot is flown; if it arrives transonic or subsonic the extra spread is
     applied as a second draw at the target (there is no way to know the
     Mach number at the target before flying). Returns fly()'s result plus
     {spread: {upMoa, rightMoa}}. */
  function shoot(input) {
    const rand = input.rand || Math.random;
    const sigma = spreadSigmaMoa(input.load.spreadMoa, null);
    const spread = { upMoa: gaussian(rand) * sigma, rightMoa: gaussian(rand) * sigma };
    const sight = input.sight || { clickMoa: 0, elevationClicks: 0, windageClicks: 0 };
    const offset = (input.rifle && input.rifle.boreOffsetMoa) || { up: 0, right: 0 };
    const elevationMoa = (sight.elevationClicks || 0) * sight.clickMoa + (offset.up || 0) + spread.upMoa;
    const windageMoa = (sight.windageClicks || 0) * (sight.windageClickMoa || sight.clickMoa) + (offset.right || 0) + spread.rightMoa;
    const r = fly({ ...input, sightHeightIn: input.rifle ? input.rifle.sightHeightIn : input.sightHeightIn, elevationMoa, windageMoa });
    if (r.reached && r.transonic) {
      const extra = spreadSigmaMoa(input.load.spreadMoa, r.mach) - sigma;
      const inchPerMoa = (input.targetYards * 36) * MOA; // 1 MOA at this distance, in inches
      r.hit.upIn += gaussian(rand) * extra * inchPerMoa;
      r.hit.rightIn += gaussian(rand) * extra * inchPerMoa;
    }
    r.spread = spread;
    return r;
  }

  // --- helpers the screens and tests share ---------------------------------------

  // Inches per MOA at a distance in yards (1.0472 at 100 yards).
  function inchesPerMoa(yards) { return yards * 36 * MOA; }

  // The bore angle (MOA above the line of sight) that puts the bullet on
  // the line of sight at `zeroYards`, found by bisection on fly(). Used by
  // tests and the "Show the conditions" reading, never to set a sight for
  // the player.
  function zeroElevationMoa(input, zeroYards) {
    let lo = -60, hi = 120;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const r = fly({ ...input, elevationMoa: mid, windageMoa: 0, targetYards: zeroYards, targetRiseFt: 0, wind: [] });
      if (!r.reached || r.hit.upIn < 0) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  // A table of the path for a sight set at `elevationMoa`: for each
  // distance, where the bullet is against the line of sight.
  function table(input, elevationMoa, yardsList) {
    return yardsList.map((yards) => {
      const r = fly({ ...input, elevationMoa, windageMoa: 0, targetYards: yards });
      return { yards, upIn: r.reached ? r.hit.upIn : null, rightIn: r.reached ? r.hit.rightIn : null, timeS: r.timeS, speedFps: r.speedFps, mach: r.mach };
    });
  }

  // Where, after the first, the bullet crosses the line of sight again
  // (yards), for a given bore angle; null if never within maxYards.
  function secondCrossingYards(input, elevationMoa, maxYards) {
    let prev = null;
    for (let y = 10; y <= (maxYards || 600); y += 2) {
      const r = fly({ ...input, elevationMoa, windageMoa: 0, targetYards: y, targetRiseFt: 0, wind: [] });
      if (!r.reached) return null;
      const up = r.hit.upIn;
      if (prev != null && prev > 0 && up <= 0) {
        // interpolate
        return y - 2 + 2 * prev / (prev - up);
      }
      prev = up;
    }
    return null;
  }

  return { G, MOA, DT, STD_DENSITY, air, airDensity, pressureAt, speedOfSound, cdAt, windAt, fly, shoot, spreadSigmaMoa, gaussian, seeded, inchesPerMoa, zeroElevationMoa, table, secondCrossingYards };
}));
