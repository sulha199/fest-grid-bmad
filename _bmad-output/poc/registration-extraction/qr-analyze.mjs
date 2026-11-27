// POC: aggregates the QR benchmark. Reads private/qr-results.jsonl (+ private/qr-opencv.jsonl when present).
// Prints and writes out/qr-summary.json: counts, timings and payload KINDS / HOSTS only (no URLs, no numbers: aggregates are safe to commit).
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (f) => (existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
const node = read('private/qr-results.jsonl').filter((r) => r.lib !== 'decode');
const cv = read('private/qr-opencv.jsonl');
const manifest = JSON.parse(readFileSync('private/img-manifest.json', 'utf8'));
const images = manifest.length, posts = new Set(manifest.map((m) => m.pid)).size;

function kind(t) {
  if (/^000201/.test(t)) return 'PAYMENT (EMV/QRIS)';
  if (/^https?:\/\//i.test(t)) return 'URL';
  if (/^WIFI:/i.test(t)) return 'WIFI';
  if (/^(mailto|tel|sms):/i.test(t)) return 'MAILTO/TEL';
  if (/^BEGIN:VCARD|^MECARD/i.test(t)) return 'VCARD';
  return 'OTHER TEXT';
}
function host(t) { try { return new URL(t).hostname.replace(/^www\./, ''); } catch { return null; } }

const byKey = new Map(); // `${lib}|${variant}` -> Map(file -> texts)
for (const r of node) {
  const k = `${r.lib}|${r.variant}`;
  if (!byKey.has(k)) byKey.set(k, new Map());
  byKey.get(k).set(r.file, r.texts ?? []);
}
if (cv.length) { const m = new Map(); for (const r of cv) m.set(r.file, r.texts ?? []); byKey.set('opencv|multi', m); }

// union: images where ANY method decoded something
const union = new Map(); // file -> Set(text)
for (const [, m] of byKey) for (const [f, ts] of m) if (ts.length) { if (!union.has(f)) union.set(f, new Set()); ts.forEach((t) => union.get(f).add(t)); }

const out = { images, posts, union: { images: union.size, posts: new Set([...union.keys()].map((f) => manifest.find((m) => m.file === f)?.pid)).size }, libs: {} };
for (const [k, m] of [...byKey].sort()) {
  const dec = [...m].filter(([, ts]) => ts.length).map(([f]) => f);
  const ms = node.filter((r) => `${r.lib}|${r.variant}` === k).map((r) => r.ms).sort((a, b) => a - b);
  const q = (p) => (ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * p))] : null);
  const others = [...byKey].filter(([kk]) => kk !== k);
  const exclusive = dec.filter((f) => !others.some(([, mm]) => (mm.get(f) ?? []).length)).length;
  out.libs[k] = { decoded: dec.length, ofUnion: union.size ? +(dec.length / union.size).toFixed(3) : null, exclusive, msMedian: q(0.5), msP95: q(0.95), errors: node.filter((r) => `${r.lib}|${r.variant}` === k && r.error).length, imagesRun: m.size };
}
const kinds = {}, hosts = {};
for (const [, ts] of union) {
  const seen = new Set();
  for (const t of ts) { const kd = kind(t); if (!seen.has(kd)) { kinds[kd] = (kinds[kd] ?? 0) + 1; seen.add(kd); } const h = kd === 'URL' ? host(t) : null; if (h) hosts[h] = (hosts[h] ?? 0) + 1; }
}
out.payloadKinds = kinds;
out.topHosts = Object.fromEntries(Object.entries(hosts).sort((a, b) => b[1] - a[1]).slice(0, 15));
out.coverVsSlides = { cover: [...union.keys()].filter((f) => /-0\.jpg$/.test(f)).length, slides: [...union.keys()].filter((f) => !/-0\.jpg$/.test(f)).length };
const boxOnly = cv.filter((r) => r.box && !(union.get(r.file)?.size)).length;
out.openCvBoxFoundButUndecoded = cv.length ? boxOnly : null;
const missed = (lib) => [...union.keys()].filter((f) => !(byKey.get(lib)?.get(f) ?? []).length).length;
out.missedByPipeline = { zxing_full: missed('zxing|full'), zxing_d1024: missed('zxing|d1024'), zbar_full: missed('zbar|full'), jsqr_full: missed('jsqr|full') };
// multi-library agreement on the decoded text (sanity: two libs must not disagree on the payload)
let disagree = 0;
for (const [f, set] of union) { const per = [...byKey].map(([, m]) => (m.get(f) ?? [])[0]).filter(Boolean); if (new Set(per).size > 1 && set.size > 1) disagree++; }
out.payloadDisagreements = disagree;
mkdirSync('out', { recursive: true });
writeFileSync('out/qr-summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
