// The things on the range: the red steel plates on their posts, each in
// front of a heaped dirt mound; the white numbered boards in their rows on
// their frames; the shelter's roof over the bench; the chaparral standing
// where the photograph is dark with scrub (low sage, taller chamise-like
// shrubs, dry grass clumps), lit by the sun with a lit side and a shaded
// side, each with its soft shadow on the ground, swaying with the wind;
// grass tufts and stones on the floor. Sizes come from data/look.json and
// data/physics.json; the plates' places from data/courses.json.
import * as THREE from 'three';
import { YD, FT } from './terrain.mjs';

const IN = 0.0254;
const hex = (h) => new THREE.Color(h);
const seeded = (seed) => { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

// A tileable canvas of packed dirt: the mound's and the floor's clods, in colour.
function dirtCanvasTexture(colorHex, size = 256, seed = 5) {
  const rnd = seeded(seed);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const base = hex(colorHex);
  const rgb = (k) => `rgb(${Math.round(base.r * 255 * k)},${Math.round(base.g * 255 * k)},${Math.round(base.b * 255 * k)})`;
  g.fillStyle = rgb(1); g.fillRect(0, 0, size, size);
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * size, y = rnd() * size, r = 1 + rnd() * rnd() * 10, k = 0.75 + rnd() * 0.5;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      const gr = g.createRadialGradient(x + ox - r * 0.3, y + oy - r * 0.3, 0, x + ox, y + oy, r);
      gr.addColorStop(0, rgb(k * 1.15)); gr.addColorStop(0.8, rgb(k)); gr.addColorStop(1, rgb(k * 0.7));
      g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

// --- the plates ----------------------------------------------------------------------------------
// Each plate's centre is exactly where the course data puts it: lateralYd
// right of the line, riseFt above the eye, yards downrange; the same figures
// the engine and the plain picture use. Half-inch steel with its edges and
// back showing bare metal, the red paint worn pale at the edges and around
// old strikes; the post runs to the ground's mesh; a heaped dirt mound behind.
export function buildPlates({ plates, eyeM, look, physics, groundAt, full }) {
  const P = look.palette['cta-piru'], T = look.things;
  const group = new THREE.Group();
  const out = [];
  const steel = new THREE.MeshLambertMaterial({ color: 0x4a4440 });
  const moundTex = dirtCanvasTexture(P.moundDirt);
  plates.forEach((p, i) => {
    const w = p.widthIn * IN, h = p.heightIn * IN;
    const x = p.lateralYd * YD, y = eyeM + p.riseFt * FT, z = -p.yards * YD;
    const rnd = seeded(100 + i);
    // the painted face: a canvas painted red, worn pale at the edges and chipped where bullets struck
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = Math.round((128 * h) / w);
    const g = cv.getContext('2d');
    const wear = [];
    for (let k = 0; k < 40; k++) { const side = Math.floor(rnd() * 4); const t = rnd(); wear.push({ x: side === 0 ? 0 : side === 1 ? cv.width : t * cv.width, y: side === 2 ? 0 : side === 3 ? cv.height : t * cv.height, r: 1.5 + rnd() * 5, rust: rnd() < 0.35 }); }
    const old = []; for (let k = 0; k < 7; k++) old.push({ x: rnd() * cv.width, y: rnd() * cv.height, r: 2 + rnd() * 2.5 });
    const paint = () => {
      g.fillStyle = P.paintRed; g.fillRect(0, 0, cv.width, cv.height);
      const e = g.createLinearGradient(0, 0, 0, cv.height); e.addColorStop(0, 'rgba(255,255,255,0.08)'); e.addColorStop(1, 'rgba(0,0,0,0.10)'); g.fillStyle = e; g.fillRect(0, 0, cv.width, cv.height);
      for (const m of wear) { g.fillStyle = m.rust ? 'rgba(120,70,40,0.7)' : P.strikeMark; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 7); g.fill(); }
      for (const m of old) { g.fillStyle = 'rgba(217,213,204,0.55)'; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 7); g.fill(); g.fillStyle = 'rgba(90,60,45,0.45)'; g.beginPath(); g.arc(m.x + m.r * 0.3, m.y + m.r * 0.3, m.r * 0.5, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(60,40,35,0.35)'; g.lineWidth = 2; g.strokeRect(1, 1, cv.width - 2, cv.height - 2);
    };
    paint();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.MeshLambertMaterial({ map: tex });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, h, T.plateThicknessIn * IN), [steel, steel, steel, steel, face, steel]);
    plate.castShadow = full; plate.receiveShadow = false;
    // the plate hangs from its top edge, so a hit swings it
    const pivot = new THREE.Group();
    pivot.position.set(x, y + h / 2, z);
    plate.position.set(0, -h / 2, 0);
    pivot.add(plate);
    group.add(pivot);
    const ground = groundAt(x, z);
    const postTop = y - h / 2;
    // the post stands behind the plate by the data's stand-off (data/look.json, depth: so the picture tells the two apart at the farthest plate), its nearest face that far behind the plate's back
    const postW = T.postWidthIn * IN;
    const post = new THREE.Mesh(new THREE.BoxGeometry(postW, Math.max(0.05, postTop - ground), postW), steel);
    post.position.set(x, (postTop + ground) / 2, z - (T.plateThicknessIn * IN) / 2 - look.depth.platePostStandOffM - postW / 2);
    post.name = `plate-post-${i}`; plate.name = `plate-${i}`;
    post.castShadow = full;
    group.add(post);
    // the mound of heaped dirt behind the plate: a hemisphere with a broken outline, in the floor's dirt
    const mg = new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
    const pa = mg.attributes.position;
    for (let k = 0; k < pa.count; k++) { const vx = pa.getX(k), vy = pa.getY(k), vz = pa.getZ(k); const bumpK = 1 + (rnd() - 0.5) * 0.22 + 0.08 * Math.sin(vx * 7 + vz * 5) * Math.sin(vy * 9); pa.setXYZ(k, vx * bumpK, vy * (1 + (rnd() - 0.5) * 0.12), vz * bumpK); }
    mg.computeVertexNormals();
    const mt = moundTex.clone(); mt.repeat.set(3, 1.5); mt.needsUpdate = true;
    const mound = new THREE.Mesh(mg, new THREE.MeshLambertMaterial({ map: mt }));
    mound.scale.set((T.moundWidthFt * FT) / 2, T.moundHeightFt * FT, (T.moundWidthFt * FT) / 2.6);
    mound.position.set(x, ground - 0.05, z - (T.moundWidthFt * FT) / 2.6 - 0.2);
    mound.rotation.y = rnd() * 3;
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
// Weathered white boards side by side in their rows, each on a frame of
// two dark posts, with its blue stencilled number at its foot and a paper
// target stapled on, peppered with holes, as scenery: one geometry, one
// atlas; the frames one instanced mesh.
export function buildBoards({ look, groundAt, full }) {
  const T = look.things, P = look.palette['cta-piru'];
  const rows = T.boardRowsYards;
  const per = T.boardsPerRow;
  const labels = [];
  for (const yd of rows) for (let i = 1; i <= per; i++) labels.push(yd === 100 ? String(i).padStart(2, '0') : yd === 200 ? `2·${String(i).padStart(2, '0')}` : `${yd}${i}`.slice(0, 3));
  for (let i = 1; i <= T.nearGroupBoards * 2; i++) labels.push(String(i).padStart(2, '0'));
  const cellW = 96, cellH = 144, cols = 16, rowsA = Math.ceil(labels.length / cols);
  const atlas = document.createElement('canvas'); atlas.width = cellW * cols; atlas.height = cellH * rowsA;
  const g = atlas.getContext('2d');
  g.fillStyle = P.boardWhite; g.fillRect(0, 0, atlas.width, atlas.height);
  labels.forEach((t, k) => {
    const cx = (k % cols) * cellW, cy = Math.floor(k / cols) * cellH;
    const rnd = seeded(k * 31 + 7);
    // weathering: grey streaks down the board, a darker foot, nail heads
    for (let i = 0; i < 9; i++) { const x = cx + rnd() * cellW, w = 1 + rnd() * 4; const gr = g.createLinearGradient(0, cy, 0, cy + cellH); gr.addColorStop(0, 'rgba(120,118,110,0)'); gr.addColorStop(1, `rgba(120,118,110,${0.1 + rnd() * 0.25})`); g.fillStyle = gr; g.fillRect(x, cy, w, cellH); }
    g.fillStyle = 'rgba(100,95,85,0.25)'; g.fillRect(cx, cy + cellH - 10, cellW, 10);
    g.fillStyle = '#5a5650'; for (const [nx, ny] of [[6, 6], [cellW - 6, 6], [6, cellH - 6], [cellW - 6, cellH - 6]]) { g.beginPath(); g.arc(cx + nx, cy + ny, 1.5, 0, 7); g.fill(); }
    // the paper target, curling at one corner, with its rings and bullet holes
    const px = cx + 14 + rnd() * 6, py = cy + 10 + rnd() * 6, pw = 64, ph = 76;
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px + 2, py + 3, pw, ph);
    g.fillStyle = '#f7f5ee'; g.fillRect(px, py, pw, ph);
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 1.2; for (const r of [26, 18, 10, 4]) { g.beginPath(); g.arc(px + pw / 2, py + ph / 2 - 4, r, 0, 7); g.stroke(); }
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(px + pw / 2, py + ph / 2 - 4, 4, 0, 7); g.fill();
    for (let i = 0; i < 5 + Math.floor(rnd() * 8); i++) { const hx = px + 4 + rnd() * (pw - 8), hy = py + 4 + rnd() * (ph - 8); g.fillStyle = '#1e1c1a'; g.beginPath(); g.arc(hx, hy, 1.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(hx - 0.8, hy - 0.8, 0.8, 0, 7); g.fill(); }
    g.fillStyle = '#c9c4b8'; g.beginPath(); g.moveTo(px + pw, py + ph); g.lineTo(px + pw - 10, py + ph); g.lineTo(px + pw, py + ph - 10); g.closePath(); g.fill();
    g.fillStyle = P.boardNumberBlue; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(t, cx + cellW / 2, cy + cellH - 24);
  });
  const tex = new THREE.CanvasTexture(atlas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = full ? 8 : 2;
  const bw = T.boardWidthIn * IN, bh = T.boardHeightIn * IN, gap = T.boardGapIn * IN;
  const pos = [], uv = [], nrm = [], idx = [];
  const frames = [];
  const POST_W = 0.05; // a board's frame post, 5 cm square
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
    // the two posts stand behind the sheet by the data's stand-off (data/look.json, depth), their nearest face that far behind it, so the picture tells post from sheet at the farthest row (half a centimetre behind, they showed through the white in flickering dots)
    const pz = z - look.depth.boardPostStandOffM - POST_W / 2;
    frames.push([x - bw * 0.35, ground, pz, y1 - 0.1 - ground], [x + bw * 0.35, ground, pz, y1 - 0.1 - ground]);
  };
  for (const yd of rows) {
    const z = -yd * YD, drop = 0; // the first line sits in its notch (the terrace is in the ground); the others stand on the ground
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
  mesh.frustumCulled = false; mesh.name = 'boards';
  const group = new THREE.Group();
  group.add(mesh);
  // the frames: two dark posts under each board
  const postGeo = new THREE.BoxGeometry(POST_W, 1, POST_W); postGeo.translate(0, 0.5, 0);
  const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: 0x4a3f36 }), frames.length);
  const m = new THREE.Matrix4();
  frames.forEach(([x, y, z, hgt], i) => { m.makeScale(1, hgt, 1); m.setPosition(x, y, z); posts.setMatrixAt(i, m); });
  posts.castShadow = full; posts.frustumCulled = false; posts.name = 'board-posts';
  group.add(posts);
  return group;
}

// --- the shelter --------------------------------------------------------------------------------
// The roof over the bench and the bench top ahead of the eye: what the view
// sees at the top and bottom at 1x, and the roof's shadow on the first yards.
// A corrugated roof on steel posts, a concrete slab, a green steel bench.
export function buildShelter({ look, full }) {
  const T = look.things, P = look.palette['cta-piru'];
  const group = new THREE.Group();
  const w = T.shelterWidthFt * FT, d = T.shelterDepthFt * FT, hgt = T.shelterRoofFt * FT;
  // corrugations: light and dark stripes running front to back on the roof's underside
  const rc = document.createElement('canvas'); rc.width = 256; rc.height = 16;
  const rg = rc.getContext('2d');
  for (let x = 0; x < 256; x++) { const v = Math.round(118 + 28 * Math.sin((x / 256) * Math.PI * 2 * 16)); rg.fillStyle = `rgb(${v},${v + 2},${v + 5})`; rg.fillRect(x, 0, 1, 16); }
  const roofTex = new THREE.CanvasTexture(rc); roofTex.colorSpace = THREE.SRGBColorSpace; roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping; roofTex.repeat.set(w / 2.4, 1); roofTex.anisotropy = 4;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), new THREE.MeshLambertMaterial({ map: roofTex, side: THREE.DoubleSide }));
  roof.position.set(0, hgt, -d / 2 + 1.2);
  roof.castShadow = full; roof.receiveShadow = full;
  group.add(roof);
  // a purlin under the roof's front edge
  const purlin = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.08), new THREE.MeshLambertMaterial({ color: 0x55585c }));
  purlin.position.set(0, hgt - 0.09, -d + 1.3); purlin.castShadow = full; group.add(purlin);
  for (const x of [-w / 2 + 0.3, -w / 6, w / 6, w / 2 - 0.3]) for (const z of [1.0, -d + 1.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, hgt, 0.1), new THREE.MeshLambertMaterial({ color: 0x5a5c5e }));
    post.position.set(x, hgt / 2, z); post.castShadow = full; group.add(post);
  }
  const benchMat = new THREE.MeshLambertMaterial({ color: hex(P.benchGreen) });
  const bench = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.9), benchMat);
  bench.position.set(0, T.benchHeightFt * FT, -T.benchAheadFt * FT - 0.45);
  bench.castShadow = full; bench.receiveShadow = full;
  group.add(bench);
  for (const x of [-0.5, 0.5]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, T.benchHeightFt * FT, 0.8), benchMat); leg.position.set(x, (T.benchHeightFt * FT) / 2, -T.benchAheadFt * FT - 0.45); group.add(leg); }
  // the concrete slab, speckled
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d'); sg.fillStyle = '#a9a49c'; sg.fillRect(0, 0, 128, 128);
  const rnd = seeded(3); for (let i = 0; i < 1500; i++) { const v = Math.round(140 + rnd() * 60); sg.fillStyle = `rgba(${v},${v - 3},${v - 8},0.5)`; sg.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2); }
  const slabTex = new THREE.CanvasTexture(sc); slabTex.colorSpace = THREE.SRGBColorSpace; slabTex.wrapS = slabTex.wrapT = THREE.RepeatWrapping; slabTex.repeat.set(w / 1.5, d / 1.5);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), new THREE.MeshLambertMaterial({ map: slabTex }));
  slab.position.set(0, 0.02, -d / 2 + 1.2); slab.receiveShadow = full;
  group.add(slab);
  return group;
}

// --- the brush ----------------------------------------------------------------------------------
// Chaparral where the photograph is dark with scrub, at the heights
// data/physics.json gives: three kinds (low rounded sage, taller open
// chamise-like shrubs, dry grass clumps), each a few crossed leafy quads
// whose normals point out from the bush's middle, so the sun lights one
// side and leaves the other in shade; coloured within the season's measured
// scrub and grass colours; each with a soft shadow on the ground under it,
// stretched away from the sun; swaying with the wind of its stretch. On the
// floor inside 150 yards, grass tufts and stones. One instanced mesh per
// kind.
export function buildBrush({ look, physics, photoImage, photo, frame, groundAt, month, full, sunDir, seed = 11 }) {
  const T = look.things, S = physics.scenery, P = look.palette['cta-piru'], B = look.brush;
  const count = full ? T.brushCountFull : T.brushCountLight;
  // sample the photograph on a small canvas
  const sz = 512;
  const cv = document.createElement('canvas'); cv.width = cv.height = sz;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(photoImage, 0, 0, sz, sz);
  const px = g.getImageData(0, 0, sz, sz).data;
  const side = photo.width * photo.spacingM;
  const photoAt = (e, n) => { const ix = Math.floor(((e - photo.originE) / side) * sz), iy = Math.floor(((photo.originN - n) / side) * sz); if (ix < 0 || iy < 0 || ix >= sz || iy >= sz) return null; const k = (iy * sz + ix) * 4; const L = (0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2]) / 255; const gr = (px[k + 1] - (px[k] + px[k + 2]) / 2) / 255; return { L, gr, dark: Math.max(0, 1 - L / 0.42) + Math.max(0, gr * 2) }; };
  const rnd = seeded(seed);
  const green = look.greenByMonth[String(month)];
  const scrubCol = hex(P.green.scrub).lerp(hex(P.dry.scrub), 1 - green);
  const grassCol = hex(P.green.weeds).lerp(hex(P.dry.sunlitSlope), 1 - green);
  const kinds = {
    sage: { col: scrubCol.clone().multiplyScalar(B.sageBrightness), hFt: [S.brushHeightFt.low, S.brushHeightFt.low + (S.brushHeightFt.high - S.brushHeightFt.low) * 0.5], wide: 1.5, leaf: leafTexture(rnd, 'sage'), shadow: true },
    chamise: { col: scrubCol.clone().multiplyScalar(B.chamiseBrightness), hFt: [S.brushHeightFt.low + (S.brushHeightFt.high - S.brushHeightFt.low) * 0.4, S.brushHeightFt.high], wide: 0.9, leaf: leafTexture(rnd, 'chamise'), shadow: true },
    grass: { col: grassCol.clone(), hFt: [B.grassClumpFt.low, B.grassClumpFt.high], wide: 1.3, leaf: leafTexture(rnd, 'grass'), shadow: false },
  };
  const halfAngle = (look.mesh.halfAngleDeg * Math.PI) / 180;
  const farM = T.brushFarYards * YD, nearM = S.brushNearestYd * YD;
  const uniforms = { time: { value: 0 }, wind: { value: 0 } };
  const group = new THREE.Group();
  // the shadow on the ground under a bush: a soft dark disc, multiplied onto the ground, stretched away from the sun
  const shC = document.createElement('canvas'); shC.width = shC.height = 64;
  const shG = shC.getContext('2d'); const shGr = shG.createRadialGradient(32, 32, 2, 32, 32, 32); shGr.addColorStop(0, `rgb(${Math.round((1 - B.shadowDarkness) * 255)},${Math.round((1 - B.shadowDarkness) * 255)},${Math.round((1 - B.shadowDarkness) * 255)})`); shGr.addColorStop(1, 'rgb(255,255,255)');
  shG.fillStyle = 'rgb(255,255,255)'; shG.fillRect(0, 0, 64, 64); shG.fillStyle = shGr; shG.beginPath(); shG.arc(32, 32, 32, 0, 7); shG.fill();
  const shadowTex = new THREE.CanvasTexture(shC); shadowTex.colorSpace = THREE.NoColorSpace;
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const sunFlat = new THREE.Vector3(sunDir.x, 0, sunDir.z); const sunLen = sunFlat.length(); if (sunLen > 0.001) sunFlat.divideScalar(sunLen);
  const stretch = Math.min(3, Math.max(0.4, sunLen / Math.max(0.15, sunDir.y)));
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const shadows = [];
  let placedAll = 0;
  const kindCounts = { sage: Math.round(count * B.share.sage), chamise: Math.round(count * B.share.chamise), grass: Math.round(count * B.share.grass) };
  for (const [name, kind] of Object.entries(kinds)) {
    const n = kindCounts[name];
    const geo = bushGeometry(kind.wide);
    const mat = new THREE.MeshLambertMaterial({ map: kind.leaf, color: kind.col, alphaTest: full ? 0.3 : 0.5, alphaToCoverage: full, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float time, wind; attribute float phase;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nfloat sway = sin(time * (1.4 + phase * 0.3) + phase * 6.0) * wind * 0.012 * uv.y; transformed.x += sway; transformed.z += sway * 0.4;');
    };
    mat.customProgramCacheKey = () => 'range-day-brush-6';
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const phases = new Float32Array(n);
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 40) {
      tries++;
      let x, z, d;
      if (name === 'grass' && rnd() < B.floorTuftShare) {
        // a tuft on the floor inside the first boards, sparse
        d = 8 + rnd() * (B.floorReachYd * YD - 8); x = (rnd() - 0.5) * 60; z = -d;
        if (Math.abs(x) < 1.5) continue;
      } else {
        d = nearM + Math.sqrt(rnd()) * ((name === 'grass' ? B.grassFarYd * YD : farM) - nearM);
        const a = (rnd() * 2 - 1) * halfAngle * 0.6;
        x = d * Math.sin(a); z = -d * Math.cos(a);
        const mp = frame.toMap(x, z);
        const ph = photoAt(mp.e, mp.n);
        if (!ph) continue;
        if (name === 'grass') { if (ph.dark > 0.5 || ph.L > 0.5 || rnd() > 0.6) continue; }
        else if (rnd() > ph.dark * 0.9 + 0.03) continue;
        // not on the range floor between the line and the first boards, which is cleared
        if (Math.abs(x) < 40 && d < 110) continue;
      }
      const hgt = (kind.hFt[0] + rnd() * (kind.hFt[1] - kind.hFt[0])) * FT;
      v.set(x, groundAt(x, z) - 0.05, z);
      q.setFromAxisAngle(up, rnd() * Math.PI);
      const wd = hgt * kind.wide * (0.85 + rnd() * 0.4);
      sc.set(wd, hgt, wd);
      m.compose(v, q, sc);
      mesh.setMatrixAt(placed, m);
      phases[placed] = rnd();
      if (kind.shadow) shadows.push([x, v.y + 0.04, z, wd]);
      placed++;
    }
    mesh.count = placed;
    geo.setAttribute('phase', new THREE.InstancedBufferAttribute(phases, 1));
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    mesh.name = `brush-${name}`;
    group.add(mesh);
    placedAll += placed;
  }
  // the shadows, one flat disc per bush
  const discGeo = new THREE.PlaneGeometry(1, 1); discGeo.rotateX(-Math.PI / 2);
  const discs = new THREE.InstancedMesh(discGeo, shadowMat, Math.max(1, shadows.length));
  shadows.forEach(([x, y, z, wd], i) => {
    const along = new THREE.Vector3(-sunFlat.x, 0, -sunFlat.z);
    const ang = Math.atan2(along.x, along.z);
    v.set(x + along.x * wd * 0.25 * stretch, y, z + along.z * wd * 0.25 * stretch);
    q.setFromAxisAngle(up, ang);
    sc.set(wd * 1.1, 1, wd * (0.7 + 0.5 * stretch));
    m.compose(v, q, sc); discs.setMatrixAt(i, m);
  });
  discs.count = shadows.length; discs.frustumCulled = false; discs.renderOrder = 1; discs.name = 'brush-shadows';
  group.add(discs);
  // stones on the floor inside the first boards
  const stones = buildStones({ look, groundAt, rnd, full });
  group.add(stones);
  return { mesh: group, uniforms, placed: placedAll };
}

// A bush: three crossed leafy quads, 1 m tall and `wide` m across at scale
// 1, the foot at y = 0, each vertex's normal pointing out from the bush's
// middle (so the sun lights the near side and the far side stays in shade).
function bushGeometry(wide) {
  const pos = [], nrm = [], uv = [], idx = [];
  let base = 0;
  const centre = new THREE.Vector3(0, 0.55, 0);
  for (const rot of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    const c = Math.cos(rot), s = Math.sin(rot);
    const quad = [[-0.5, 0], [0.5, 0], [0.5, 1], [-0.5, 1]];
    for (const [qx, qy] of quad) {
      const x = qx * wide * c, z = -qx * wide * s, y = qy;
      pos.push(x, y, z);
      const n = new THREE.Vector3(x, y, z).sub(centre); n.y += 0.35; n.normalize();
      nrm.push(n.x, n.y, n.z);
      uv.push(qx + 0.5, qy);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3); base += 4;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.setIndex(idx);
  return out;
}

// The leaf picture of a kind of plant: a brightness mask (the palette gives
// the colour) on a transparent ground; sage as dense small leaves in a
// rounded mass, chamise as open sprays of fine leaves on dark stems, grass
// as a clump of strands fanning up from the foot.
function leafTexture(rnd, kind) {
  const lc = document.createElement('canvas'); lc.width = lc.height = 128;
  const lg = lc.getContext('2d');
  const leaf = (x, y, r, v, ar = 0.55) => { lg.fillStyle = `rgb(${v},${v},${Math.round(v * 0.92)})`; lg.beginPath(); lg.ellipse(x, y, r, r * ar, rnd() * 3, 0, 7); lg.fill(); };
  if (kind === 'sage') {
    for (let i = 0; i < 220; i++) { const dx = (rnd() - 0.5) * 1.7, dy = (rnd() - 0.5) * 1.5; if (dx * dx + dy * dy * 1.3 > 0.72) continue; const x = 64 + dx * 64, y = 70 + dy * 60; leaf(x, y, 2.5 + rnd() * 4.5, Math.round(150 + rnd() * 105)); }
    lg.strokeStyle = 'rgb(120,105,85)'; lg.lineWidth = 2; for (let i = 0; i < 4; i++) { lg.beginPath(); lg.moveTo(64 + (rnd() - 0.5) * 16, 128); lg.lineTo(64 + (rnd() - 0.5) * 60, 70 + rnd() * 30); lg.stroke(); }
  } else if (kind === 'chamise') {
    lg.strokeStyle = 'rgb(95,80,65)'; lg.lineWidth = 2.5;
    for (let i = 0; i < 7; i++) { const tx = 64 + (rnd() - 0.5) * 90, ty = 10 + rnd() * 40; lg.beginPath(); lg.moveTo(64 + (rnd() - 0.5) * 10, 128); lg.quadraticCurveTo(64 + (rnd() - 0.5) * 40, 80, tx, ty); lg.stroke(); for (let k = 0; k < 28; k++) { const t = 0.3 + rnd() * 0.7; const x = 64 + (tx - 64) * t + (rnd() - 0.5) * 16, y = 128 + (ty - 128) * t + (rnd() - 0.5) * 14; leaf(x, y, 1.5 + rnd() * 2.5, Math.round(140 + rnd() * 110), 0.4); } }
  } else {
    for (let i = 0; i < 90; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 1.4, len = 70 + rnd() * 55, v = Math.round(150 + rnd() * 105); lg.strokeStyle = `rgb(${v},${Math.round(v * 0.96)},${Math.round(v * 0.75)})`; lg.lineWidth = 1 + rnd() * 1.5; lg.beginPath(); lg.moveTo(64 + (rnd() - 0.5) * 14, 128); lg.quadraticCurveTo(64 + Math.cos(a) * len * 0.5 + (rnd() - 0.5) * 20, 128 + Math.sin(a) * len * 0.6, 64 + Math.cos(a) * len, 128 + Math.sin(a) * len); lg.stroke(); }
  }
  const t = new THREE.CanvasTexture(lc); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Stones on the floor: small irregular lumps, the colour of bare rock, inside the first boards.
function buildStones({ look, groundAt, rnd, full }) {
  const B = look.brush, P = look.palette['cta-piru'];
  const n = full ? B.stones : Math.round(B.stones / 3);
  const geo = new THREE.IcosahedronGeometry(0.5, 1);
  const pa = geo.attributes.position;
  for (let k = 0; k < pa.count; k++) { const f = 0.8 + rnd() * 0.4; pa.setXYZ(k, pa.getX(k) * f, pa.getY(k) * 0.6 * f, pa.getZ(k) * f); }
  geo.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: hex(P.green.rockSun).multiplyScalar(0.9) }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const d = 6 + rnd() * (B.floorReachYd * YD - 6), x = (rnd() - 0.5) * 70, z = -d;
    const s = (B.stoneSizeIn.low + rnd() * rnd() * (B.stoneSizeIn.high - B.stoneSizeIn.low)) * IN;
    v.set(x, groundAt(x, z) + s * 0.1, z); q.setFromAxisAngle(up, rnd() * 6.3); sc.set(s, s, s);
    m.compose(v, q, sc); mesh.setMatrixAt(i, m);
  }
  mesh.castShadow = false; mesh.frustumCulled = false; mesh.name = 'stones';
  return mesh;
}
