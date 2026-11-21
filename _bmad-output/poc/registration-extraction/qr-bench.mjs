// POC: QR decoding libraries that could ship in our Node 20 / x86_64 AI-processor Lambda (which already has sharp and a WASM runtime).
// Input: private/img-manifest.json (images of posts whose signed links were still valid on 2026-11-21).
// Output: private/qr-results.jsonl (gitignored: holds decoded text, which can contain phone numbers) and a printed aggregate.
//   node qr-bench.mjs [--libs jsqr,zxing,zbar] [--variants full,d1024]
// Images are decoded with sharp (already in the backend) to raw RGBA; each library gets the same pixels.
import { readFileSync, appendFileSync, existsSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { readBarcodes } from 'zxing-wasm/reader';
import { scanRGBABuffer } from '@undecaf/zbar-wasm';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, all) => (x.startsWith('--') ? [...a, [x.slice(2), all[i + 1]]] : a), []));
const libs = (args.libs ?? 'jsqr,zxing,zbar').split(',');
const variants = (args.variants ?? 'full,d1024').split(',');
const OUT = 'private/qr-results.jsonl';
const manifest = JSON.parse(readFileSync('private/img-manifest.json', 'utf8'));
const done = new Set(existsSync(OUT) ? readFileSync(OUT, 'utf8').trim().split('\n').filter(Boolean).map((l) => { const j = JSON.parse(l); return `${j.file}|${j.lib}|${j.variant}`; }) : []);

const DECODERS = {
  jsqr: async ({ data, width, height }) => {
    const r = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height, { inversionAttempts: 'attemptBoth' });
    return r ? [r.data] : [];
  },
  zxing: async ({ data, width, height }) => {
    const res = await readBarcodes({ data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length), width, height, colorSpace: 'srgb' }, { formats: ['QRCode'], tryHarder: true, tryInvert: true, tryRotate: true, tryDownscale: true, maxNumberOfSymbols: 4 });
    return res.filter((x) => x.isValid && x.text).map((x) => x.text);
  },
  zbar: async ({ data, width, height }) => {
    const syms = await scanRGBABuffer(data.buffer.slice(data.byteOffset, data.byteOffset + data.length), width, height);
    return syms.filter((s) => s.typeName === 'ZBAR_QRCODE').map((s) => s.decode());
  },
};

async function pixels(file, variant) {
  let img = sharp(file).rotate();
  const meta = await img.metadata();
  const longest = Math.max(meta.width, meta.height);
  const cap = variant === 'd1024' ? 1024 : 2000;
  if (longest > cap) img = img.resize({ width: meta.width >= meta.height ? cap : undefined, height: meta.height > meta.width ? cap : undefined, fit: 'inside' });
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height, srcW: meta.width, srcH: meta.height };
}

let n = 0;
const t0 = Date.now();
for (const variant of variants) {
  for (const m of manifest) {
    const todo = libs.filter((l) => !done.has(`${m.file}|${l}|${variant}`));
    if (!todo.length) continue;
    let px;
    try { px = await pixels(m.file, variant); } catch (e) { appendFileSync(OUT, JSON.stringify({ file: m.file, pid: m.pid, i: m.i, variant, lib: 'decode', error: String(e).slice(0, 80) }) + '\n'); continue; }
    for (const lib of todo) {
      const s = performance.now();
      let texts = [], error;
      try { texts = await DECODERS[lib](px); } catch (e) { error = String(e).slice(0, 80); }
      appendFileSync(OUT, JSON.stringify({ file: m.file, pid: m.pid, i: m.i, variant, lib, w: px.width, h: px.height, srcW: px.srcW, srcH: px.srcH, ms: Math.round(performance.now() - s), texts, error }) + '\n');
    }
    if (++n % 100 === 0) console.log(`${variant} ${n} images, ${Math.round((Date.now() - t0) / 1000)}s`);
  }
}
console.log('done', n, 'images', Math.round((Date.now() - t0) / 1000), 's');
writeFileSync('private/qr-bench.done', String(Date.now()));
