// Image helpers for the terrain scripts, with nothing beyond what Node
// ships: a reader for the float TIFF the elevation service sends (strips
// or tiles; uncompressed, LZW or deflate; horizontal predictor), a writer
// for 16-bit grayscale PNG (the heights, compact), and a reader of a JPEG's
// size. Runs on GitHub's runner only.
import { deflateSync, inflateSync } from 'node:zlib';

// --- TIFF --------------------------------------------------------------------------------------
export function readTiff(b) {
  const le = b[0] === 0x49;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o) => dv.getUint16(o, le), u32 = (o) => dv.getUint32(o, le);
  if (u16(2) !== 42) throw new Error(`not a classic TIFF (magic ${u16(2)})`);
  const ifd = u32(4);
  const n = u16(ifd);
  const tags = {};
  const SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
  for (let i = 0; i < n; i++) {
    const o = ifd + 2 + i * 12;
    const tag = u16(o), type = u16(o + 2), count = u32(o + 4);
    const size = SIZE[type] || 1;
    const at = count * size <= 4 ? o + 8 : u32(o + 8);
    const vals = new Array(count);
    for (let k = 0; k < count; k++) vals[k] = type === 3 ? u16(at + k * 2) : type === 4 ? u32(at + k * 4) : type === 11 ? dv.getFloat32(at + k * 4, le) : type === 12 ? dv.getFloat64(at + k * 8, le) : type === 16 ? Number(dv.getBigUint64(at + k * 8, le)) : b[at + k];
    tags[tag] = vals;
  }
  const width = tags[256][0], height = tags[257][0];
  const bits = tags[258] ? tags[258][0] : 8, format = tags[339] ? tags[339][0] : 1, samples = tags[277] ? tags[277][0] : 1;
  const compression = tags[259] ? tags[259][0] : 1, predictor = tags[317] ? tags[317][0] : 1;
  if (samples !== 1) throw new Error(`${samples} samples per pixel; one expected`);
  const bytesPer = bits / 8;
  const out = new Float32Array(width * height);
  const readSample = (buf, o) => {
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (format === 3 && bits === 32) return v.getFloat32(o, le);
    if (format === 3 && bits === 64) return v.getFloat64(o, le);
    if (bits === 16) return format === 2 ? v.getInt16(o, le) : v.getUint16(o, le);
    if (bits === 32) return format === 2 ? v.getInt32(o, le) : v.getUint32(o, le);
    if (bits === 8) return format === 2 ? v.getInt8(o) : v.getUint8(o);
    throw new Error(`sample format ${format} with ${bits} bits`);
  };
  const decode = (raw, rowBytes, rows) => {
    let data = raw;
    if (compression === 5) data = lzw(raw);
    else if (compression === 8 || compression === 32946) data = inflateSync(raw);
    else if (compression !== 1) throw new Error(`TIFF compression ${compression} is not handled`);
    if (predictor === 2) for (let r = 0; r < rows; r++) for (let x = 1; x < rowBytes / bytesPer; x++) { /* horizontal differencing on integers only */
      const o = r * rowBytes + x * bytesPer, p = o - bytesPer;
      if (bits === 16) { const v = new DataView(data.buffer, data.byteOffset); v.setUint16(o, (v.getUint16(o, le) + v.getUint16(p, le)) & 0xffff, le); }
      else if (bits === 8) data[o] = (data[o] + data[p]) & 0xff;
      else throw new Error('predictor 2 with this bit depth is not handled');
    }
    if (predictor === 3) throw new Error('floating-point predictor is not handled');
    return data;
  };
  if (tags[322]) { // tiles
    const tw = tags[322][0], th = tags[323][0];
    const across = Math.ceil(width / tw);
    tags[324].forEach((off, t) => {
      if (off + tags[325][t] > b.length) throw new Error(`tile ${t} of ${tags[324].length} at ${off} + ${tags[325][t]} bytes lies past the file's end (${b.length} bytes): the download is short`);
      if (tags[325][t] < tw * th * bytesPer && compression === 1) throw new Error(`tile ${t} holds ${tags[325][t]} bytes, fewer than ${tw}×${th}×${bytesPer}`);
      const raw = b.subarray(off, off + tags[325][t]);
      const data = decode(raw, tw * bytesPer, th);
      const tx = (t % across) * tw, ty = Math.floor(t / across) * th;
      for (let y = 0; y < th && ty + y < height; y++) for (let x = 0; x < tw && tx + x < width; x++) out[(ty + y) * width + tx + x] = readSample(data, (y * tw + x) * bytesPer);
    });
  } else {
    const rps = tags[278] ? tags[278][0] : height;
    tags[273].forEach((off, s) => {
      if (off + tags[279][s] > b.length) throw new Error(`strip ${s} lies past the file's end (${b.length} bytes): the download is short`);
      const rows = Math.min(rps, height - s * rps);
      const raw = b.subarray(off, off + tags[279][s]);
      const data = decode(raw, width * bytesPer, rows);
      for (let y = 0; y < rows; y++) for (let x = 0; x < width; x++) out[(s * rps + y) * width + x] = readSample(data, (y * width + x) * bytesPer);
    });
  }
  const noData = tags[42113] ? parseFloat(Buffer.from(tags[42113]).toString('ascii').replace(/\0.*$/, '')) : null;
  // GeoTIFF: pixel scale and the tie point (the top-left corner's map position).
  const scale = tags[33550] || null, tie = tags[33922] || null;
  return { width, height, data: out, noData, scale, tie, compression, predictor, bits, format };
}

// TIFF LZW (MSB-first codes, the 1986 "early change" convention TIFF uses).
function lzw(src) {
  const out = [];
  let bitPos = 0;
  const total = src.length * 8;
  const read = (n) => { let v = 0; for (let i = 0; i < n; i++) { const byte = src[bitPos >> 3], bit = (byte >> (7 - (bitPos & 7))) & 1; v = (v << 1) | bit; bitPos++; } return v; };
  let table, codeLen, prev = null;
  const reset = () => { table = []; for (let i = 0; i < 256; i++) table.push([i]); table.push(null); table.push(null); codeLen = 9; prev = null; };
  reset();
  while (bitPos + codeLen <= total) {
    const code = read(codeLen);
    if (code === 256) { reset(); continue; }
    if (code === 257) break;
    let entry;
    if (code < table.length && table[code]) entry = table[code];
    else if (prev) entry = [...prev, prev[0]];
    else throw new Error('bad LZW stream');
    for (const v of entry) out.push(v);
    if (prev) table.push([...prev, entry[0]]);
    prev = entry;
    if (table.length + 1 >= 1 << codeLen && codeLen < 12) codeLen++;
  }
  return Uint8Array.from(out);
}

// --- PNG ---------------------------------------------------------------------------------------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = (buf) => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// 16-bit grayscale PNG from a Uint16Array, with the "Up" filter on every
// row (smooth ground compresses well as row differences).
export function png16(width, height, pixels) {
  const rowBytes = width * 2;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (rowBytes + 1)] = 2; // Up
    for (let x = 0; x < width; x++) {
      const v = pixels[y * width + x], up = y ? pixels[(y - 1) * width + x] : 0;
      const d = (v - up) & 0xffff;
      const o = y * (rowBytes + 1) + 1 + x * 2;
      raw[o] = d >> 8; raw[o + 1] = d & 0xff;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 16; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Reads back a 16-bit grayscale PNG written by png16 (for the check that what was written reads true).
export function readPng16(buf) {
  let o = 8; let width = 0, height = 0; const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o), type = buf.toString('ascii', o + 4, o + 8);
    const data = buf.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); if (data[8] !== 16 || data[9] !== 0) throw new Error('not 16-bit grayscale'); }
    if (type === 'IDAT') idat.push(data);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
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
  return { width, height, pixels: px };
}

// A JPEG's width and height, from its start-of-frame marker.
export function jpegSize(b) {
  let o = 2;
  while (o < b.length) {
    if (b[o] !== 0xff) { o++; continue; }
    const m = b[o + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { height: (b[o + 5] << 8) | b[o + 6], width: (b[o + 7] << 8) | b[o + 8] };
    o += 2 + ((b[o + 2] << 8) | b[o + 3]);
  }
  return null;
}
