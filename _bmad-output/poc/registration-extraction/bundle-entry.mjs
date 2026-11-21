// Lambda-compat probe: bundled the way CDK's NodejsFunction does (esbuild, node platform, CJS), then run with plain node.
import { readFileSync } from 'node:fs';
import jsQR from 'jsqr';
import { readBarcodes } from 'zxing-wasm/reader';
import { scanRGBABuffer } from '@undecaf/zbar-wasm';
import sharp from 'sharp';
async function main() {
const file = process.argv[2];
const { data, info } = await sharp(file).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const res = {};
res.jsqr = !!jsQR(new Uint8ClampedArray(data), info.width, info.height);
try { res.zxing = (await readBarcodes({ data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: 'srgb' }, { formats: ['QRCode'] })).length; } catch (e) { res.zxing = 'ERR ' + String(e).slice(0, 80); }
try { res.zbar = (await scanRGBABuffer(data.buffer, info.width, info.height)).length; } catch (e) { res.zbar = 'ERR ' + String(e).slice(0, 80); }
console.log(JSON.stringify(res));
}
main();
