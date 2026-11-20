// The photographed ground surfaces (range-day-eight): one CC0 material scan
// per class of ground (data/terrain.json, surfaces; their ground sizes in
// data/look.json, ground.materials), held as two layered pictures the
// ground's shader reads: colour (sRGB) and relief (red and green: the
// scan's normal, x east and y north; blue: its height). Each layer starts
// neutral (mid grey whose own mean is itself, flat, at mid height), so a
// class whose material has not arrived, or failed, is drawn with its plain
// palette colour; the materials are fetched after the first picture is on
// screen and swapped in when they have all settled.
import * as THREE from 'three';

// The layers, in the order the shader reads them.
export const LAYERS = ['floor', 'dry-grass', 'green-grass', 'scrub-litter', 'rock', 'scree'];
const NEUTRAL = 128;
const toLinear = (() => { const t = new Float32Array(256); for (let i = 0; i < 256; i++) { const c = i / 255; t[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; } return t; })();

function arrayTexture(data, px, srgb, full) {
  const t = new THREE.DataArrayTexture(data, px, px, LAYERS.length);
  t.format = THREE.RGBAFormat; t.type = THREE.UnsignedByteType;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true; t.anisotropy = 1; // trilinear only: anisotropic filtering doubled the ground's cost in the test browser (range-day-eight, item 7)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}
const neutral = (px) => new Uint8Array(px * px * 4 * LAYERS.length).fill(NEUTRAL);

// The uniforms the ground's shader is given, neutral until loadMaterials fills them.
export function materialSlots(full, look) {
  const sizes = look && look.ground && look.ground.materials ? LAYERS.map((id) => look.ground.materials[id].sizeM) : LAYERS.map(() => 2);
  const n = toLinear[NEUTRAL];
  return {
    color: { value: arrayTexture(neutral(1), 1, true, full) },
    relief: { value: arrayTexture(neutral(1), 1, false, full) },
    mean: { value: LAYERS.map(() => new THREE.Vector3(n, n, n)) },
    sizeM: { value: sizes },
    px: { value: 1 },
    state: { loaded: [], failed: [], bytes: 0, settled: false },
  };
}

const loadImage = (url) => new Promise((resolve, reject) => { const im = new Image(); im.decoding = 'async'; im.onload = () => resolve(im); im.onerror = () => reject(new Error(`${url} did not load`)); im.src = url; });

// The pixels of a picture, rows from the bottom (as a picture uploaded with flipY: the picture's up is north).
function pixels(im, px) {
  const c = document.createElement('canvas'); c.width = c.height = px;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.translate(0, px); g.scale(1, -1);
  g.drawImage(im, 0, 0, px, px);
  return g.getImageData(0, 0, px, px).data;
}

// Fetches every layer's two pictures (the Full or the Light set), then swaps them into the slots at once. Resolves with the
// slots' state: which layers loaded, which failed (each failed layer stays neutral), and the bytes the pictures weighed.
export async function loadMaterials(slots, surfaces, full) {
  const state = slots.state;
  if (!surfaces) { state.settled = true; return state; }
  const set = full ? 'full' : 'light';
  const results = await Promise.allSettled(LAYERS.map(async (id) => {
    const r = surfaces[id] && surfaces[id][set];
    if (!r) throw new Error(`${id}: no ${set} record`);
    const [col, rel] = await Promise.all([loadImage(`/${r.color.file}`), loadImage(`/${r.relief.file}`)]);
    return { id, col, rel, bytes: r.color.bytes + r.relief.bytes };
  }));
  const ok = results.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  state.failed = results.map((x, i) => (x.status === 'rejected' ? `${LAYERS[i]}: ${x.reason && x.reason.message}` : null)).filter(Boolean);
  if (ok.length) {
    const px = ok[0].col.naturalWidth;
    const col = neutral(px), rel = neutral(px);
    for (const m of ok) {
      const L = LAYERS.indexOf(m.id), off = L * px * px * 4;
      const cp = pixels(m.col, px), rp = pixels(m.rel, px);
      col.set(cp, off); rel.set(rp, off);
      // the material's own mean colour in linear light, from every fourth pixel: the shader divides it out and the palette's colour stands in its place
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < cp.length; i += 16) { r += toLinear[cp[i]]; g += toLinear[cp[i + 1]]; b += toLinear[cp[i + 2]]; n++; }
      slots.mean.value[L].set(r / n, g / n, b / n);
      state.loaded.push(m.id); state.bytes += m.bytes;
    }
    const oldC = slots.color.value, oldR = slots.relief.value;
    slots.color.value = arrayTexture(col, px, true, full);
    slots.relief.value = arrayTexture(rel, px, false, full);
    slots.px.value = px;
    oldC.dispose(); oldR.dispose();
  }
  state.settled = true;
  return state;
}
