// The surveyed ground in the browser: reads a 16-bit grayscale PNG of
// heights (written by scripts/terrain/fetch.mjs; metres = pixel × stepM +
// offsetM) with the browser's own inflater, so no height is rounded through
// an 8-bit canvas; samples it; and works out which cells the sun reaches.

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
}

// Which cells the sun reaches: for each cell of a coarser copy of the grid,
// a walk toward the sun along the ground; shaded where the ground rises
// above the ray. Answers a Uint8Array (255 lit, 0 shaded, soft at the edge)
// over the grid at `every` cells per sample, for a sun at elevation and
// azimuth in degrees (azimuth from north through east).
export function sunMask(grid, { elevation, azimuth }, every = 4) {
  const w = Math.floor(grid.width / every), h = Math.floor(grid.height / every);
  const out = new Uint8Array(w * h);
  if (elevation <= 0.5) return { width: w, height: h, data: out };
  const az = (azimuth * Math.PI) / 180, el = (elevation * Math.PI) / 180;
  const dx = Math.sin(az), dy = -Math.cos(az); // toward the sun, in grid steps: columns run east, rows run south
  const rise = Math.tan(el);
  const step = grid.spacingM * every;
  const maxSteps = Math.ceil(Math.max(w, h) * 1.5);
  const hAt = (x, y) => grid.at(Math.round(x * every + every / 2), Math.round(y * every + every / 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const h0 = hAt(x, y);
    let lit = 1;
    for (let s = 1; s < maxSteps; s++) {
      const sx = x + dx * s, sy = y + dy * s;
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) break;
      const ground = hAt(sx, sy), ray = h0 + rise * step * s;
      if (ground > ray + 0.3) { lit = 0; break; }
    }
    out[y * w + x] = lit ? 255 : 0;
  }
  // a little softening, so the edge of a shadow is not a staircase
  const soft = new Uint8Array(out.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0, n = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { sum += out[yy * w + xx]; n++; } }
    soft[y * w + x] = Math.round(sum / n);
  }
  return { width: w, height: h, data: soft };
}
