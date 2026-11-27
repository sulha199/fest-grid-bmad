// Lambda-compat probe 2: CJS bundle (as CDK does), fetch disabled to prove nothing is downloaded at runtime.
globalThis.fetch = () => { throw new Error('NETWORK DISABLED'); };
import jsQR from 'jsqr';
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';
import zxingWasm from './node_modules/zxing-wasm/dist/reader/zxing_reader.wasm';
import { scanRGBABuffer } from '@undecaf/zbar-wasm';
import sharp from 'sharp';
async function main() {
  const file = process.argv[2];
  const { data, info } = await sharp(file).rotate().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const res = {};
  res.jsqr = !!jsQR(new Uint8ClampedArray(data), info.width, info.height);
  try { prepareZXingModule({ overrides: { wasmBinary: zxingWasm.buffer.slice(zxingWasm.byteOffset, zxingWasm.byteOffset + zxingWasm.byteLength) }, fireImmediately: true }); res.zxing = (await readBarcodes({ data: new Uint8ClampedArray(data), width: info.width, height: info.height, colorSpace: 'srgb' }, { formats: ['QRCode'] })).length; } catch (e) { res.zxing = 'ERR ' + String(e).slice(0, 100); }
  try { res.zbar = (await scanRGBABuffer(data.buffer, info.width, info.height)).length; } catch (e) { res.zbar = 'ERR ' + String(e).slice(0, 100); }
  console.log(JSON.stringify(res));
}
main();
