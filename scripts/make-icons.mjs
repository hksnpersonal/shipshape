/**
 * Renders the app icon to PNG without pulling in an image library.
 *
 * A manifest icon has to be a PNG for an install prompt to appear on Android and for iOS
 * to use it on the home screen, and the mark is simple enough to rasterise by hand: a
 * rounded square in the brand blue with a white T.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../public/icons');
const BRAND = [37, 99, 235]; // #2563eb
const WHITE = [255, 255, 255];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n += 1) {
    c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // no per-row filter
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * @param size pixels square
 * @param bleed true for a maskable icon, where the platform crops to a circle and the
 *   artwork must fill the whole canvas rather than sit inside a rounded square.
 */
function drawIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.1875;
  const inset = maskable ? 0 : 0;

  // The T, proportioned from the 512-unit design and scaled.
  const s = size / 512;
  const pad = maskable ? size * 0.14 : 0;
  const barX0 = 136 * s + pad * 0.5;
  const barX1 = 376 * s - pad * 0.5;
  const barY0 = 168 * s + pad * 0.6;
  const barY1 = 224 * s + pad * 0.6;
  const stemX0 = 228 * s + pad * 0.5;
  const stemX1 = 284 * s - pad * 0.5;
  const stemY1 = 400 * s - pad * 0.6;

  const inRoundedSquare = (x, y) => {
    if (radius === 0) return true;
    const cx = Math.min(Math.max(x, inset + radius), size - inset - radius);
    const cy = Math.min(Math.max(y, inset + radius), size - inset - radius);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      if (!inRoundedSquare(x + 0.5, y + 0.5)) {
        rgba[i + 3] = 0;
        continue;
      }
      const onBar = x >= barX0 && x < barX1 && y >= barY0 && y < barY1;
      const onStem = x >= stemX0 && x < stemX1 && y >= barY0 && y < stemY1;
      const colour = onBar || onStem ? WHITE : BRAND;
      rgba[i] = colour[0];
      rgba[i + 1] = colour[1];
      rgba[i + 2] = colour[2];
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'icon-192.png'), drawIcon(192));
writeFileSync(path.join(OUT, 'icon-512.png'), drawIcon(512));
writeFileSync(path.join(OUT, 'icon-512-maskable.png'), drawIcon(512, { maskable: true }));
writeFileSync(path.resolve(OUT, '../apple-touch-icon.png'), drawIcon(180, { maskable: true }));
console.log('icons: wrote 192, 512, 512-maskable and apple-touch-icon');
