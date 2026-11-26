/* Range Day's tilt reading (range-day-sixteen): how far, in degrees right and
   degrees up, the phone now points from where it pointed when it was last
   centered. The pointing direction is the line straight out of the back of
   the phone, the way a scope looks when the screen faces the eye.

   It works from the orientation as a whole rotation, never from one angle
   alone: the browser's `deviceorientation` event gives alpha, beta and gamma,
   the turns about Z, then X, then Y (MDN, "Window: deviceorientation event"),
   which together make one rotation R = Rz(alpha) Rx(beta) Ry(gamma) from the
   phone's own axes (x to the screen's right, y to its top, z out of the
   screen toward the eye) to the room's. The back of the phone is -z. At a
   centering the rotation is kept as R0; afterwards the back's direction is
   read in the centered phone's own axes, v = R0ᵀ R (0, 0, -1), and the
   degrees right and up are atan2(v.x, -v.z) and atan2(v.y, -v.z). Nothing
   here swings when the phone is upright (beta near 90°), where beta and
   gamma alone do, and the reading means the same on a table, in the hand or
   on a stand. Right and up are the screen's: a screen turned by the browser
   (screen.orientation.angle) turns them with it, and a change of that angle
   re-centers.

   Smoothing: one-pole low-pass on the two angles, time constant TAU_S
   (50 ms), stepped by each reading's own time; at a slow sweep it lags the
   phone by about 50 ms. While Steady is held the firing line passes
   TAU_STEADY_S (400 ms) instead (range-day-sixteen, Dan on his phone: Steady
   did nothing he could see in tilt mode): a hand's tremor and the jolt of
   pressing the button are soaked up, a slow deliberate move still arrives,
   about 0.4 s behind. The hold is the smoothed figure either way, so the shot
   goes where the sight shows.

   Plain JavaScript that loads in a page (window.RangeDayTilt) and in Node
   (require), so the tests can drive the maths with made-up readings. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RangeDayTilt = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const RAD = Math.PI / 180;
  const TAU_S = 0.05;
  const TAU_STEADY_S = 0.4;

  // The rotation matrix from the phone's axes to the room's, rows first.
  function rotation(alpha, beta, gamma) {
    const a = alpha * RAD, b = beta * RAD, g = gamma * RAD;
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
    // Rz(a) · Rx(b) · Ry(g)
    return [
      [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
      [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
      [-cb * sg, sb, cb * cg],
    ];
  }
  // The back of the phone (0, 0, -1) in the room: minus R's third column.
  const back = (R) => [-R[0][2], -R[1][2], -R[2][2]];
  // Degrees right and up of the present back direction, in the centered phone's own axes, turned to the screen's.
  function offset(R0, R, screenDeg) {
    const w = back(R);
    // R0ᵀ w
    const v = [R0[0][0] * w[0] + R0[1][0] * w[1] + R0[2][0] * w[2], R0[0][1] * w[0] + R0[1][1] * w[1] + R0[2][1] * w[2], R0[0][2] * w[0] + R0[1][2] * w[1] + R0[2][2] * w[2]];
    const s = (screenDeg || 0) * RAD;
    const x = v[0] * Math.cos(s) - v[1] * Math.sin(s), y = v[0] * Math.sin(s) + v[1] * Math.cos(s);
    return { right: Math.atan2(x, -v[2]) / RAD, up: Math.atan2(y, -v[2]) / RAD };
  }

  // A reader: feed it readings ({alpha, beta, gamma, t} with t in seconds, the screen's angle, and the smoothing time in seconds,
  // TAU_S when left out); it answers the smoothed degrees right and up from the last centering. center() makes the next reading the new zero.
  function reader() {
    let R0 = null, screen = null, sm = null, lastT = null, readings = 0, wantCenter = true;
    return {
      feed(r, screenDeg, tauS) {
        if (r == null || ![r.alpha, r.beta, r.gamma].every((x) => typeof x === 'number' && Number.isFinite(x))) return null;
        const R = rotation(r.alpha, r.beta, r.gamma);
        readings++;
        if (wantCenter || screen !== (screenDeg || 0)) { R0 = R; screen = screenDeg || 0; sm = { right: 0, up: 0 }; lastT = r.t; wantCenter = false; return { ...sm, centered: true }; }
        const raw = offset(R0, R, screen);
        const dt = lastT == null || r.t == null ? 1 / 60 : Math.max(0, r.t - lastT);
        lastT = r.t;
        const k = 1 - Math.exp(-dt / (tauS > 0 ? tauS : TAU_S));
        sm = { right: sm.right + (raw.right - sm.right) * k, up: sm.up + (raw.up - sm.up) * k };
        return { ...sm, centered: false };
      },
      center() { wantCenter = true; },
      get readings() { return readings; },
      get now() { return sm ? { ...sm } : { right: 0, up: 0 }; },
    };
  }

  // The extreme spread of a run of points (the largest distance between any two), in the points' own units.
  function spread(points) {
    let best = 0;
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) best = Math.max(best, Math.hypot(points[i].right - points[j].right, points[i].up - points[j].up));
    return best;
  }

  return { TAU_S, TAU_STEADY_S, rotation, back, offset, reader, spread };
}));
