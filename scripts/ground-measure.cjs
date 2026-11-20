'use strict';
// The ground's two measures (range-day-eight), run inside the page on the scene's canvas: scripts/picture-measure.mjs prints
// them and test/scene.test.js holds the picture to them. Each is a plain function a page evaluates from its source text.

// Local contrast over the middle quarter of the view: the mean of |brightness − the mean of its 3-by-3|.
const contrast = () => { const sc = document.getElementById('scene'); const c = document.createElement('canvas'); c.width = sc.width; c.height = sc.height; const g = c.getContext('2d'); g.drawImage(sc, 0, 0); const w = sc.width, h = sc.height, x0 = Math.round(w * 0.375), y0 = Math.round(h * 0.375), n = Math.round(w * 0.25); const d = g.getImageData(x0, y0, n, n).data; const L = new Float32Array(n * n); for (let i = 0; i < n * n; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; let sum = 0, cnt = 0; for (let y = 1; y < n - 1; y++) for (let x = 1; x < n - 1; x++) { let m = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) m += L[(y + dy) * n + x + dx]; sum += Math.abs(L[y * n + x] - m / 9); cnt++; } return sum / cnt; };

// The repeat measure. With the view aimed at a ground point P (metres right of the line and downrange as world x, z) the
// whole view is read as fine texture (each pixel's brightness less the mean of the 13-by-13 around it, so the light's and
// the aerial photograph's broad changes do not count); then the materials alone are slid along the ground by f of their
// widths, east and then north, the camera and everything else unmoved, and the view read again. Each material is laid
// twice (at its own size and at macroScale times it); one copy slides at a time (big: the larger), the other stays put. At f = 1 a material laid
// in a plain grid shows exactly the same picture again; at f = 0.5, 0.75, 1.25 and 1.5 it does not. It answers the
// correlation at one width and the mean of the others, for the direction where their difference is larger. The score the
// tests and picture-measure print is (at one width − the others) / (1 − the others): the share of the material's own fine
// texture that comes back one width on (the boards, the light and the survey's relief match at every step). A plain grid
// scores near 1, a material laid without a visible repeat near 0.
const repeat = (P, sizeM, fovDeg, glass, big) => {
  const s = RangeDayLine.scene, eye = 4 * 0.3048, sc = document.getElementById('scene');
  const g0 = s.groundAt(P[0], P[1]);
  s.setView({ yawDeg: (Math.atan2(P[0], -P[1]) * 180) / Math.PI, pitchDeg: (Math.atan2(g0 - eye, -P[1]) * 180) / Math.PI, fovDeg: fovDeg, glass: Boolean(glass), windMph: 0 });
  const read = (e, n) => {
    s.setMaterialShift(e, n, big); s.render(3);
    const w = sc.width, h = sc.height, m = Math.round(Math.min(w, h) * 0.6), x0 = Math.round((w - m) / 2), y0 = Math.round((h - m) / 2);
    const c = document.createElement('canvas'); c.width = w; c.height = h; const cg = c.getContext('2d'); cg.drawImage(sc, 0, 0);
    const d = cg.getImageData(x0, y0, m, m).data, L = new Float32Array(m * m);
    for (let i = 0; i < m * m; i++) L[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const r = 6, I = new Float64Array((m + 1) * (m + 1));
    for (let y = 0; y < m; y++) { let row = 0; for (let x = 0; x < m; x++) { row += L[y * m + x]; I[(y + 1) * (m + 1) + x + 1] = I[y * (m + 1) + x + 1] + row; } }
    const H = new Float32Array(m * m);
    for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) { const a0 = Math.max(0, x - r), a1 = Math.min(m, x + r + 1), b0 = Math.max(0, y - r), b1 = Math.min(m, y + r + 1); H[y * m + x] = L[y * m + x] - (I[b1 * (m + 1) + a1] - I[b0 * (m + 1) + a1] - I[b1 * (m + 1) + a0] + I[b0 * (m + 1) + a0]) / ((a1 - a0) * (b1 - b0)); }
    return H;
  };
  const corr = (A, B) => { let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; const n = A.length; for (let i = 0; i < n; i++) { sa += A[i]; sb += B[i]; saa += A[i] * A[i]; sbb += B[i] * B[i]; sab += A[i] * B[i]; } const ca = saa / n - (sa / n) ** 2, cb = sbb / n - (sb / n) ** 2; return (sab / n - (sa / n) * (sb / n)) / Math.sqrt(Math.max(1e-9, ca * cb)); };
  const here = read(0, 0);
  const out = [];
  for (const [e, nn] of [[1, 0], [0, 1]]) {
    const at = (f) => corr(here, read(e * sizeM * f, nn * sizeM * f));
    const at1 = at(1), others = [0.5, 0.75, 1.25, 1.5].map(at);
    out.push({ at1, others: others.reduce((a, b) => a + b, 0) / others.length, direction: e ? 'east' : 'north' });
  }
  s.setMaterialShift(0, 0, big);
  out.sort((a, b) => (b.at1 - b.others) - (a.at1 - a.others));
  return out[0];
};

module.exports = { contrast, repeat };
