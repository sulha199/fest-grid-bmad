#!/usr/bin/env node
// Story 0.38 (AC8, Task 3.1) — one-time rasterization of
// `packages/ui/src/core/app-shell/LogoMark.tsx` (the app's existing icon-only
// mark, a 2x2 grid: three solid squares + one rotated-45 accent diamond) into
// real 192x192/512x512 PNG files, committed under `apps/web/public/icons/`.
//
// No SVG-to-PNG npm library is available in this repo's resolvable dependency
// tree without adding a new dependency (out of scope per this story's
// constraints) — this script instead draws the same mark directly as raster
// pixels and encodes a valid PNG (IHDR/IDAT/IEND chunks, zlib-deflated via
// Node's built-in `zlib`) with no external dependency at all. Colors are
// sourced from `apps/web/src/app/globals.css`'s light-theme CSS variables
// (`--foreground`, `--accent`, `--background`), the same values LogoMark
// itself resolves to via Tailwind's `bg-foreground`/`bg-accent` classes.
//
// Run manually: `node apps/web/scripts/generate-pwa-icons.mjs`

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// apps/web/src/app/globals.css light-theme tokens.
const FOREGROUND = [0x11, 0x18, 0x27]; // #111827
const ACCENT = [0xff, 0x5a, 0x5f]; // #FF5A5F
const BACKGROUND = [0xf9, 0xfa, 0xfb]; // #F9FAFB

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/** Encodes an RGBA pixel buffer (Uint8Array, length = w*h*4) as a PNG file buffer. */
function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0; // filter type: None
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idatData = deflateSync(raw);

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function setPixel(rgba, width, x, y, [r, g, b], alpha = 255) {
  if (x < 0 || y < 0 || x >= width) return;
  const idx = (y * width + x) * 4;
  if (idx < 0 || idx + 3 >= rgba.length) return;
  rgba[idx] = r;
  rgba[idx + 1] = g;
  rgba[idx + 2] = b;
  rgba[idx + 3] = alpha;
}

/** Fills a square with lightly-rounded corners, mirroring LogoMark's `rounded-sm`. */
function fillRoundedSquare(rgba, width, x0, y0, size, color) {
  const radius = Math.max(1, Math.round(size * 0.12));
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const nearLeft = dx < radius;
      const nearRight = dx >= size - radius;
      const nearTop = dy < radius;
      const nearBottom = dy >= size - radius;
      let inside = true;
      if ((nearLeft || nearRight) && (nearTop || nearBottom)) {
        const cx = nearLeft ? radius : size - radius - 1;
        const cy = nearTop ? radius : size - radius - 1;
        const ddx = dx - cx;
        const ddy = dy - cy;
        inside = ddx * ddx + ddy * ddy <= radius * radius;
      }
      if (inside) {
        setPixel(rgba, width, x0 + dx, y0 + dy, color);
      }
    }
  }
}

/** Fills a rotated-45 square (a diamond) scaled to 75% of `size`, matching LogoMark's
 * `rotate-45 transform origin-center scale-75` accent square, via a Manhattan-distance test. */
function fillDiamond(rgba, width, x0, y0, size, color) {
  const cx = x0 + size / 2;
  const cy = y0 + size / 2;
  const halfDiagonal = (size * 0.75) / 2;
  const bound = Math.ceil(size / 2) + 1;
  for (let dy = -bound; dy <= bound; dy++) {
    for (let dx = -bound; dx <= bound; dx++) {
      if (Math.abs(dx) + Math.abs(dy) <= halfDiagonal) {
        setPixel(rgba, width, Math.round(cx + dx), Math.round(cy + dy), color);
      }
    }
  }
}

function generateIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  // Opaque background (Chrome installability prefers a solid, non-transparent
  // icon over a transparent one for the "any" purpose).
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = BACKGROUND[0];
    rgba[i * 4 + 1] = BACKGROUND[1];
    rgba[i * 4 + 2] = BACKGROUND[2];
    rgba[i * 4 + 3] = 255;
  }

  // LogoMark's `grid-cols-2 grid-rows-2 gap-[2px]` mark, centered with margin.
  const margin = Math.round(size * 0.18);
  const content = size - margin * 2;
  const gap = Math.max(2, Math.round(size * (2 / 24)));
  const cell = Math.floor((content - gap) / 2);

  const positions = [
    [margin, margin], // top-left: foreground
    [margin + cell + gap, margin], // top-right: accent diamond
    [margin, margin + cell + gap], // bottom-left: foreground
    [margin + cell + gap, margin + cell + gap], // bottom-right: foreground
  ];

  fillRoundedSquare(rgba, size, positions[0][0], positions[0][1], cell, FOREGROUND);
  fillDiamond(rgba, size, positions[1][0], positions[1][1], cell, ACCENT);
  fillRoundedSquare(rgba, size, positions[2][0], positions[2][1], cell, FOREGROUND);
  fillRoundedSquare(rgba, size, positions[3][0], positions[3][1], cell, FOREGROUND);

  return encodePng(size, size, rgba);
}

for (const size of [192, 512]) {
  const png = generateIcon(size);
  const outPath = path.join(OUT_DIR, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`Wrote ${outPath} (${png.length} bytes)`);
}
