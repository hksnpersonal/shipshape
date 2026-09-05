/**
 * Renders the app icon to PNG without pulling in an image library.
 *
 * A manifest icon has to be a PNG for an install prompt to appear on Android and for iOS
 * to use it on the home screen, and the mark is simple enough to rasterise by hand: a
 * rounded square in the brand blue with a white S, matching `public/icon.svg`.
 *
 * The S is two 270-degree arcs, stacked and facing opposite ways, with round caps closing
 * the free ends. Unlike the T this replaced, none of its edges are axis-aligned, so every
 * pixel is supersampled - without that the curves crawl badly at 192px.
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

  // The S, proportioned from the 512-unit design. A maskable icon is cropped to a circle
  // by the platform, so the mark shrinks to stay clear of the crop.
  const s = (size / 512) * (maskable ? 0.74 : 1);
  const mid = size / 2;
  const arcR = 55 * s;
  const half = 30 * s; // half the stroke width
  const bowls = [
    // Upper bowl, open at its lower right; lower bowl, open at its upper left.
    { cy: mid - arcR, from: 0, to: 90 },
    { cy: mid + arcR, from: 180, to: 270 },
  ];
  const caps = [
    { x: mid + arcR, y: mid - arcR },
    { x: mid - arcR, y: mid + arcR },
  ];

  const inRoundedSquare = (x, y) => {
    if (radius === 0) return true;
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
  };

  const onMark = (x, y) => {
    for (const bowl of bowls) {
      const dx = x - mid;
      const dy = y - bowl.cy;
      if (Math.abs(Math.hypot(dx, dy) - arcR) > half) continue;
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (angle < 0) angle += 360;
      // The gap in each bowl is what makes it an S rather than a figure eight.
      if (angle > bowl.from && angle < bowl.to) continue;
      return true;
    }
    return caps.some((cap) => (x - cap.x) ** 2 + (y - cap.y) ** 2 <= half * half);
  };

  const STEPS = 4;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let inside = 0;
      let mark = 0;
      for (let sy = 0; sy < STEPS; sy += 1) {
        for (let sx = 0; sx < STEPS; sx += 1) {
          const px = x + (sx + 0.5) / STEPS;
          const py = y + (sy + 0.5) / STEPS;
          if (!inRoundedSquare(px, py)) continue;
          inside += 1;
          if (onMark(px, py)) mark += 1;
        }
      }
      const i = (y * size + x) * 4;
      if (inside === 0) {
        rgba[i + 3] = 0;
        continue;
      }
      const t = mark / inside;
      for (let c = 0; c < 3; c += 1) {
        rgba[i + c] = Math.round(BRAND[c] + (WHITE[c] - BRAND[c]) * t);
      }
      rgba[i + 3] = Math.round((inside / (STEPS * STEPS)) * 255);
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
