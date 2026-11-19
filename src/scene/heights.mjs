// The surveyed ground in the browser: reads a 16-bit grayscale PNG of
// heights (written by scripts/terrain/fetch.mjs; metres = pixel × stepM +
// offsetM) with the browser's own inflater, so no height is rounded through
// an 8-bit canvas; samples it; builds the picture of its slopes (a normal
// per cell, for lighting every pixel of a hillside from the survey itself)
// and works out how far the sun's ray clears the ground at each cell.

// --- a 16-bit PNG, decoded exactly -------------------------------------------------------------
export async function loadHeights(url, rec) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let o = 8, width = 0, height = 0;
  const idat = [];
  while (o < buf.length) {
    const len = dv.getUint32(o), type = String.fromCharCode(buf[o + 4], buf[o + 5], buf[o + 6], buf[o + 7]);
    if (type === 'IHDR') { width = dv.getUint32(o + 8); height = dv.getUint32(o + 12); if (buf[o + 16] !== 16 || buf[o + 17] !== 0) throw new Error('heights: not a 16-bit grayscale PNG'); }
    if (type === 'IDAT') idat.push(buf.subarray(o + 8, o + 8 + len));
    o += 12 + len;
  }
  const zipped = new Blob(idat);
  const raw = new Uint8Array(await new Response(zipped.stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
  const rowBytes = width * 2;
  const px = new Uint16Array(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (rowBytes + 1)];
    for (let x = 0; x < width; x++) {
      const i = y * (rowBytes + 1) + 1 + x * 2;
      let v = (raw[i] << 8) | raw[i + 1];
      const a = x ? px[y * width + x - 1] : 0, b = y ? px[(y - 1) * width + x] : 0, c = x && y ? px[(y - 1) * width + x - 1] : 0;
      if (filter === 1) v += a; else if (filter === 2) v += b; else if (filter === 3) v += (a + b) >> 1; else if (filter === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * width + x] = v & 0xffff;
    }
  }
  return new Grid({ width, height, pixels: px, stepM: rec.stepM, offsetM: rec.offsetM, spacingM: rec.spacingM, originE: rec.originE, originN: rec.originN });
}

// A grid of heights with its place on the map (NAD83 / UTM zone 11N, metres).
export class Grid {
  constructor({ width, height, pixels, stepM, offsetM, spacingM, originE, originN }) {
    Object.assign(this, { width, height, pixels, stepM, offsetM, spacingM, originE, originN });
  }
  at(ix, iy) { return this.pixels[Math.min(this.height - 1, Math.max(0, iy)) * this.width + Math.min(this.width - 1, Math.max(0, ix))] * this.stepM + this.offsetM; }
  inside(e, n) { return e >= this.originE && e <= this.originE + this.width * this.spacingM && n <= this.originN && n >= this.originN - this.height * this.spacingM; }
  // The height at a map position, bilinear between the four nearest cells (cell centres at half a spacing in).
  heightAt(e, n) {
    const fx = (e - this.originE) / this.spacingM - 0.5, fy = (this.originN - n) / this.spacingM - 0.5;
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    return (this.at(x0, y0) * (1 - tx) + this.at(x0 + 1, y0) * tx) * (1 - ty) + (this.at(x0, y0 + 1) * (1 - tx) + this.at(x0 + 1, y0 + 1) * tx) * ty;
  }
  // The highest cell, found once.
  get maxM() { if (this._max == null) { let m = 0; for (let i = 0; i < this.pixels.length; i++) if (this.pixels[i] > m) m = this.pixels[i]; this._max = m * this.stepM + this.offsetM; } return this._max; }
}

// The slopes of the ground as a picture, one cell in `every`: for each
// cell a unit normal (east, up, north) from the heights either side, and
// how hollow the ground is there (the mean of the four neighbours `reach`
// cells away, less the cell: positive in a gully or a crease, negative on
// a rib). Packed as RGBA bytes: R = east, G = up, B = north (each 0 to 255
// for −1 to 1; up is never negative), A = hollowness, 128 flat, clamped at
// ±hollowM metres. Used by the terrain's shader to light each pixel from the
// survey instead of from the mesh's corners.
export function normalMap(grid, every = 1, reach = 4, hollowM = 2) {
  const w = Math.floor(grid.width / every), h = Math.floor(grid.height / every);
  const out = new Uint8Array(w * h * 4);
  const sp = grid.spacingM * every;
  const at = (x, y) => grid.at(x * every + (every >> 1), y * every + (every >> 1));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const hc = at(x, y);
    const dzdx = (at(x + 1, y) - at(x - 1, y)) / (2 * sp);
    const dzdn = (at(x, y - 1) - at(x, y + 1)) / (2 * sp); // rows run south: the row above is north
    const l = Math.hypot(dzdx, 1, dzdn);
    const nx = -dzdx / l, ny = 1 / l, nz = -dzdn / l;
    const hollow = (at(x - reach, y) + at(x + reach, y) + at(x, y - reach) + at(x, y + reach)) / 4 - hc;
    const k = (y * w + x) * 4;
    out[k] = Math.round((nx * 0.5 + 0.5) * 255); out[k + 1] = Math.round(ny * 255); out[k + 2] = Math.round((nz * 0.5 + 0.5) * 255);
    out[k + 3] = Math.round(Math.max(0, Math.min(255, 128 + (hollow / hollowM) * 127)));
  }
  return { width: w, height: h, data: out };
}

// How far the sun's ray clears the ground, cell by cell, for a sun at
// elevation and azimuth in degrees (azimuth from north through east): from
// each cell of a coarser copy of the grid (one in `every`), a walk toward
// the sun along the ground; the least gap between the ray and the ground
// along the walk, in metres, is the cell's clearance (negative where the
// ground rises above the ray: shaded). The walk ends once the ray is above
// the highest ground in the grid. Packed as bytes, 128 at zero clearance,
// clamped at ±clampM, so the shader can draw a clean edge between sun and
// shade by where the clearance crosses zero.
export function sunMask(grid, { elevation, azimuth }, every = 4, clampM = 4) {
  const w = Math.floor(grid.width / every), h = Math.floor(grid.height / every);
  const out = new Uint8Array(w * h);
  if (elevation <= 0.5) return { width: w, height: h, data: out };
  const az = (azimuth * Math.PI) / 180, el = (elevation * Math.PI) / 180;
  const dx = Math.sin(az), dy = -Math.cos(az); // toward the sun, in grid steps: columns run east, rows run south
  const step = grid.spacingM * every;
  const rise = Math.tan(el) * step;
  const top = grid.maxM;
  const maxSteps = Math.ceil(Math.max(w, h) * 1.5);
  const hAt = (x, y) => grid.at(Math.round(x * every + every / 2), Math.round(y * every + every / 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const h0 = hAt(x, y);
    let least = clampM;
    for (let s = 1; s < maxSteps; s++) {
      const sx = x + dx * s, sy = y + dy * s;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
      const ray = h0 + rise * s;
      if (ray > top) break;
      const gap = ray - hAt(sx, sy);
      if (gap < least) { least = gap; if (least <= -clampM) break; }
    }
    out[y * w + x] = Math.round(128 + (Math.max(-clampM, Math.min(clampM, least)) / clampM) * 127);
  }
  return { width: w, height: h, data: out };
}
