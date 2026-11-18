// The things on the range: the red steel plates on their posts, each in
// front of a fresh dirt mound; the white numbered boards in their rows; the
// shelter's roof over the bench; the brush standing where the photograph is
// dark with scrub, swaying with the wind. Sizes come from data/look.json
// and data/physics.json; the plates' places from data/courses.json.
import * as THREE from 'three';
import { YD, FT } from './terrain.mjs';

const IN = 0.0254;
const hex = (h) => new THREE.Color(h);

// --- the plates ----------------------------------------------------------------------------------
// Each plate's centre is exactly where the course data puts it: lateralYd
// right of the line, riseFt above the eye, yards downrange; the same figures
// the engine and the plain picture use. The post runs to the ground's mesh.
export function buildPlates({ plates, eyeM, look, physics, groundAt, full }) {
  const P = look.palette['cta-piru'], T = look.things, S = physics.scenery;
  const group = new THREE.Group();
  const out = [];
  plates.forEach((p, i) => {
    const w = p.widthIn * IN, h = p.heightIn * IN;
    const x = p.lateralYd * YD, y = eyeM + p.riseFt * FT, z = -p.yards * YD;
    // the strike marks: a canvas painted red, chipped pale where bullets struck
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = Math.round((64 * h) / w);
    const g = cv.getContext('2d');
    const paint = () => { g.fillStyle = P.paintRed; g.fillRect(0, 0, cv.width, cv.height); const e = g.createLinearGradient(0, 0, 0, cv.height); e.addColorStop(0, 'rgba(255,255,255,0.10)'); e.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = e; g.fillRect(0, 0, cv.width, cv.height); };
    paint();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, T.plateThicknessIn * IN), mat);
    plate.castShadow = full; plate.receiveShadow = false;
    // the plate hangs from its top edge, so a hit swings it
    const pivot = new THREE.Group();
    pivot.position.set(x, y + h / 2, z);
    plate.position.set(0, -h / 2, 0);
    pivot.add(plate);
    group.add(pivot);
    const ground = groundAt(x, z);
    const postTop = y - h / 2;
    const post = new THREE.Mesh(new THREE.BoxGeometry(T.postWidthIn * IN, Math.max(0.05, postTop - ground), T.postWidthIn * IN), new THREE.MeshLambertMaterial({ color: 0x4a4038 }));
    post.position.set(x, (postTop + ground) / 2, z + 0.03);
    post.castShadow = full;
    group.add(post);
    // the mound of fresh dirt behind the plate
    const mound = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: hex(P.moundDirt) }));
    mound.scale.set((T.moundWidthFt * FT) / 2, T.moundHeightFt * FT, (T.moundWidthFt * FT) / 2.6);
    mound.position.set(x, ground - 0.05, z - (T.moundWidthFt * FT) / 2.6 - 0.2);
    mound.castShadow = full; mound.receiveShadow = full;
    group.add(mound);
    out.push({ pivot, plate, canvas: cv, g, tex, w, h, swing: 0, paint, strikes: [] });
  });
  // a strike mark: a pale chip at the hit's place on the plate (inches up and right of the centre)
  const strike = (ix, upIn, rightIn) => {
    const s = out[ix]; if (!s) return;
    s.strikes.push({ upIn, rightIn });
    s.paint();
    s.g.fillStyle = P.strikeMark;
    for (const m of s.strikes) {
      const px = (0.5 + (m.rightIn * IN) / s.w) * s.canvas.width, py = (0.5 - (m.upIn * IN) / s.h) * s.canvas.height;
      const r = (0.45 * IN / s.w) * s.canvas.width; // a chip about 0.9 in across
      s.g.beginPath(); s.g.arc(px, py, Math.max(1.5, r), 0, 7); s.g.fill();
      s.g.fillStyle = 'rgba(80,70,65,0.5)'; s.g.beginPath(); s.g.arc(px + r * 0.3, py + r * 0.3, Math.max(0.8, r * 0.45), 0, 7); s.g.fill(); s.g.fillStyle = P.strikeMark;
    }
    s.tex.needsUpdate = true;
    s.swing = 1;
  };
  const step = (dt) => { for (const s of out) { if (s.swing > 0) { s.swing = Math.max(0, s.swing - dt / 1.4); s.pivot.rotation.x = -0.35 * s.swing * Math.sin((1 - s.swing) * 14) * Math.exp(-(1 - s.swing) * 2); } } };
  return { group, strike, step, plates: out };
}

// --- the boards ----------------------------------------------------------------------------------
// White boards side by side in their rows, each with its blue stencilled
// number at its foot, as scenery: one geometry, one number atlas.
export function buildBoards({ look, groundAt, full }) {
  const T = look.things, P = look.palette['cta-piru'];
  const rows = T.boardRowsYards;
  const per = T.boardsPerRow;
  const labels = [];
  for (const yd of rows) for (let i = 1; i <= per; i++) labels.push(yd === 100 ? String(i).padStart(2, '0') : yd === 200 ? `2·${String(i).padStart(2, '0')}` : `${yd}${i}`.slice(0, 3));
  for (let i = 1; i <= T.nearGroupBoards * 2; i++) labels.push(String(i).padStart(2, '0'));
  const cellW = 64, cellH = 96, cols = 16, rowsA = Math.ceil(labels.length / cols);
  const atlas = document.createElement('canvas'); atlas.width = cellW * cols; atlas.height = cellH * rowsA;
  const g = atlas.getContext('2d');
  g.fillStyle = P.boardWhite; g.fillRect(0, 0, atlas.width, atlas.height);
  labels.forEach((t, k) => {
    const cx = (k % cols) * cellW, cy = Math.floor(k / cols) * cellH;
    // a few paper targets and bullet holes
    g.fillStyle = '#f7f6f2'; g.fillRect(cx + 10, cy + 8, 44, 50);
    g.strokeStyle = '#333'; g.lineWidth = 1; g.beginPath(); g.arc(cx + 32, cy + 33, 11, 0, 7); g.stroke(); g.beginPath(); g.arc(cx + 32, cy + 33, 4, 0, 7); g.stroke();
    let s = k * 31 + 7; const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    g.fillStyle = '#2a2622'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(cx + 12 + r() * 40, cy + 10 + r() * 46, 1.3, 0, 7); g.fill(); }
    g.fillStyle = P.boardNumberBlue; g.font = 'bold 22px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, cx + cellW / 2, cy + cellH - 16);
  });
  const tex = new THREE.CanvasTexture(atlas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = full ? 8 : 2;
  const bw = T.boardWidthIn * IN, bh = T.boardHeightIn * IN, gap = T.boardGapIn * IN;
  const pos = [], uv = [], nrm = [], idx = [];
  let k = 0, label = 0;
  const addBoard = (x, z, dropM) => {
    const ground = groundAt(x, z) - dropM;
    const y0 = ground + 0.15, y1 = y0 + bh;
    const u0 = ((label % cols) * cellW) / atlas.width, u1 = u0 + cellW / atlas.width;
    const v1 = 1 - (Math.floor(label / cols) * cellH) / atlas.height, v0 = v1 - cellH / atlas.height;
    label++;
    const quad = [[x - bw / 2, y0, z], [x + bw / 2, y0, z], [x + bw / 2, y1, z], [x - bw / 2, y1, z]];
    for (const q of quad) { pos.push(...q); nrm.push(0, 0, 1); }
    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    idx.push(k, k + 1, k + 2, k, k + 2, k + 3); k += 4;
  };
  for (const yd of rows) {
    const z = -yd * YD, drop = yd === rows[0] ? 0 : 0; // the first line sits in its notch (the terrace is in the ground); the others stand on the ground
    const total = per * bw + (per - 1) * gap;
    for (let i = 0; i < per; i++) addBoard(-total / 2 + bw / 2 + i * (bw + gap), z, drop);
  }
  // the two nearer groups of four, on low mounds, left and right
  for (const side of [-1, 1]) for (let i = 0; i < T.nearGroupBoards; i++) addBoard(side * 9 * YD + (i - 1.5) * (bw + gap), -T.nearGroupYards * YD, -0.4);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
  mesh.castShadow = full;
  mesh.frustumCulled = false;
  // short frames (dark posts) under each board are left to the shadow of the board itself: too thin to see past 100 yards
  return mesh;
}

// --- the shelter --------------------------------------------------------------------------------
// The roof over the bench and the bench top ahead of the eye: what the view
// sees at the top and bottom at 1x, and the roof's shadow on the first yards.
export function buildShelter({ look, full }) {
  const T = look.things, P = look.palette['cta-piru'];
  const group = new THREE.Group();
  const w = T.shelterWidthFt * FT, d = T.shelterDepthFt * FT, hgt = T.shelterRoofFt * FT;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), new THREE.MeshLambertMaterial({ color: 0x8c8f93, side: THREE.DoubleSide }));
  roof.position.set(0, hgt, -d / 2 + 1.2);
  roof.castShadow = full; roof.receiveShadow = full;
  group.add(roof);
  for (const x of [-w / 2 + 0.3, -w / 6, w / 6, w / 2 - 0.3]) for (const z of [1.0, -d + 1.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, hgt, 0.1), new THREE.MeshLambertMaterial({ color: 0x5a5c5e }));
    post.position.set(x, hgt / 2, z); post.castShadow = full; group.add(post);
  }
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.9), new THREE.MeshLambertMaterial({ color: hex(P.benchGreen) }));
  bench.position.set(0, T.benchHeightFt * FT, -T.benchAheadFt * FT - 0.45);
  bench.castShadow = full; bench.receiveShadow = full;
  group.add(bench);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), new THREE.MeshLambertMaterial({ color: 0xa9a49c }));
  slab.position.set(0, 0.02, -d / 2 + 1.2); slab.receiveShadow = full;
  group.add(slab);
  return group;
}

// --- the brush ----------------------------------------------------------------------------------
// Bushes stand where the photograph is dark with scrub, at the heights
// data/physics.json gives, as crossed leafy quads; each sways with the wind
// of its stretch. One instanced mesh.
export function buildBrush({ look, physics, photoImage, photo, frame, groundAt, month, full, seed = 11 }) {
  const T = look.things, S = physics.scenery, P = look.palette['cta-piru'];
  const count = full ? T.brushCountFull : T.brushCountLight;
  // sample the photograph on a small canvas
  const sz = 512;
  const cv = document.createElement('canvas'); cv.width = cv.height = sz;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(photoImage, 0, 0, sz, sz);
  const px = g.getImageData(0, 0, sz, sz).data;
  const side = photo.width * photo.spacingM;
  const darkAt = (e, n) => { const ix = Math.floor(((e - photo.originE) / side) * sz), iy = Math.floor(((photo.originN - n) / side) * sz); if (ix < 0 || iy < 0 || ix >= sz || iy >= sz) return 0; const k = (iy * sz + ix) * 4; const L = (0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]) / 255; const gr = (px[k + 1] - (px[k] + px[k + 2]) / 2) / 255; return Math.max(0, 1 - L / 0.42) + Math.max(0, gr * 2); };
  let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const green = look.greenByMonth[String(month)];
  const col = hex(P.green.scrub).lerp(hex(P.dry.scrub), 1 - green);
  // the leaf picture: a clump of leaves on a transparent ground
  const lc = document.createElement('canvas'); lc.width = lc.height = 128;
  const lg = lc.getContext('2d');
  // leaves as a brightness mask (the palette gives the colour): pale clumps with gaps of sky between them
  for (let i = 0; i < 150; i++) { const dx = (rnd() - 0.5) * 1.6, dy = (rnd() - 0.5) * 1.4; if (dx * dx + dy * dy > 0.7) continue; const x = 64 + dx * 64, y = 72 + dy * 64 - rnd() * 10; const r = 3 + rnd() * 6; const v = Math.round(170 + rnd() * 85); lg.fillStyle = `rgb(${v},${v},${Math.round(v * 0.9)})`; lg.beginPath(); lg.ellipse(x, y, r, r * 0.55, rnd() * 3, 0, 7); lg.fill(); }
  // a few stems
  lg.strokeStyle = 'rgb(140,120,90)'; lg.lineWidth = 2; for (let i = 0; i < 5; i++) { lg.beginPath(); lg.moveTo(64 + (rnd() - 0.5) * 20, 128); lg.lineTo(64 + (rnd() - 0.5) * 70, 60 + rnd() * 30); lg.stroke(); }
  const leaf = new THREE.CanvasTexture(lc); leaf.colorSpace = THREE.SRGBColorSpace;
  // two crossed quads, 1 m tall, 1 m wide, the foot at y = 0
  const quad = (rot) => { const geo = new THREE.PlaneGeometry(1, 1); geo.translate(0, 0.5, 0); geo.rotateY(rot); return geo; };
  const g1 = quad(0), g2 = quad(Math.PI / 2);
  const geo = mergeGeometries([g1, g2]);
  const mat = new THREE.MeshLambertMaterial({ map: leaf, color: col, alphaTest: 0.5, side: THREE.DoubleSide });
  const uniforms = { time: { value: 0 }, wind: { value: 0 } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float time, wind; attribute float phase;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat sway = sin(time * (1.4 + phase * 0.3) + phase * 6.0) * wind * 0.012 * uv.y; transformed.x += sway; transformed.z += sway * 0.4;');
  };
  mat.customProgramCacheKey = () => 'range-day-brush';
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const phases = new Float32Array(count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const farM = T.brushFarYards * YD, nearM = S.brushNearestYd * YD;
  let placed = 0, tries = 0;
  const halfAngle = (look.mesh.halfAngleDeg * Math.PI) / 180;
  while (placed < count && tries < count * 40) {
    tries++;
    const d = nearM + Math.sqrt(rnd()) * (farM - nearM);
    const a = (rnd() * 2 - 1) * halfAngle * 0.6;
    const x = d * Math.sin(a), z = -d * Math.cos(a);
    const mp = frame.toMap(x, z);
    const dark = darkAt(mp.e, mp.n);
    if (rnd() > dark * 0.9 + 0.03) continue;
    // not on the range floor between the line and the first boards, which is cleared
    if (Math.abs(x) < 40 && d < 110) continue;
    const hgt = (S.brushHeightFt.low + rnd() * (S.brushHeightFt.high - S.brushHeightFt.low)) * FT;
    v.set(x, groundAt(x, z) - 0.05, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * Math.PI);
    sc.set(hgt * (1.1 + rnd() * 0.6), hgt, hgt * (1.1 + rnd() * 0.6));
    m.compose(v, q, sc);
    mesh.setMatrixAt(placed, m);
    phases[placed] = rnd();
    placed++;
  }
  mesh.count = placed;
  geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));
  mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return { mesh, uniforms, placed };
}

// A small merge for two plain geometries with position, normal and uv.
function mergeGeometries(list) {
  const pos = [], nrm = [], uv = [], idx = [];
  let base = 0;
  for (const g of list) {
    pos.push(...g.attributes.position.array); nrm.push(...g.attributes.normal.array); uv.push(...g.attributes.uv.array);
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.array[i] + base);
    base += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}
