// Draws the app's two icons in code: a round steel plate, rust-brown with a
// darker rim, and a crosshair over it. No downloaded art. Writes PNGs with
// only what Node ships with (zlib for the deflate step).
//   node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Colours: background a dry-hills tan, the plate a rust-brown steel, the
// crosshair near-black. The mark sits inside the middle 60% (Android's mask).
const BG = [0xd9, 0xc4, 0x9a], RIM = [0x4a, 0x2a, 0x18], PLATE = [0x8c, 0x3b, 0x1e], HAIR = [0x1d, 0x1d, 0x1b], DOT = [0xf2, 0xe6, 0xd0];
const mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t), 255];
const smooth = (edge, d) => Math.max(0, Math.min(1, edge - d + 0.5)); // 1 inside, 0 outside, soft over one pixel

function pixel(size) {
  const c = size / 2, R = size * 0.29, rim = size * 0.025, hair = size * 0.018, gap = size * 0.06, arm = size * 0.42;
  return (x, y) => {
    const dx = x - c, dy = y - c, d = Math.hypot(dx, dy);
    let col = [...BG, 255];
    col = mix(col, [...RIM, 255], smooth(R, d));
    col = mix(col, [...PLATE, 255], smooth(R - rim, d));
    // crosshair: four arms with a gap at the centre, and a small centre dot
    const onArm = (Math.abs(dx) <= hair && Math.abs(dy) >= gap && Math.abs(dy) <= arm) || (Math.abs(dy) <= hair && Math.abs(dx) >= gap && Math.abs(dx) <= arm);
    if (onArm) col = mix(col, [...HAIR, 255], 1);
    col = mix(col, [...DOT, 255], smooth(hair * 1.2, d));
    return col;
  };
}

for (const size of [192, 512]) writeFileSync(join(root, 'public', `icon-${size}.png`), png(size, pixel(size)));
console.log('icons written: public/icon-192.png, public/icon-512.png');
