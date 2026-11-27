// POC: picks a stratified set of posts whose images decode to a QR code, writes private/qr-posts.json and a contact sheet (private/qr-sheet.jpg).
import { readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
const read = (f) => readFileSync(f, 'utf8').trim().split('\n').map(JSON.parse);
const rows = read('private/qr-results.jsonl').filter((r) => r.texts?.length && r.lib === 'zxing' && r.variant === 'full');
const host = (t) => { if (/^000201/.test(t)) return 'QRIS'; try { return new URL(t).hostname.replace(/^www\./, ''); } catch { return 'other'; } };
const byHost = {};
for (const r of rows) for (const t of r.texts) { const h = host(t); (byHost[h] ??= []).push(r); }
const want = [['q.me-qr.com', 4], ['bit.ly', 2], ['goers.co', 1], ['forms.gle', 1], ['QRIS', 2], ['maps.app.goo.gl', 1], ['linktr.ee', 1]];
const picks = []; const seen = new Set();
for (const [h, n] of want) for (const r of (byHost[h] ?? [])) { if (picks.filter((p) => p.h === h).length >= n || seen.has(r.pid)) continue; seen.add(r.pid); picks.push({ h, pid: r.pid, file: r.file, i: r.i }); }
writeFileSync('private/qr-posts.json', JSON.stringify(picks, null, 1));
console.log(picks.map((p, k) => `${k + 1}. ${p.h} ${p.pid}-${p.i}`).join('\n'));
const W = 300, H = 400, cols = 4;
const tiles = await Promise.all(picks.map(async (p, k) => {
  const img = await sharp(p.file).rotate().resize(W, H, { fit: 'contain', background: '#222' }).toBuffer();
  const label = Buffer.from(`<svg width="${W}" height="30"><rect width="${W}" height="30" fill="#000"/><text x="8" y="21" font-size="18" fill="#fff" font-family="Arial">${k + 1}  ${p.h}</text></svg>`);
  return sharp({ create: { width: W, height: H + 30, channels: 3, background: '#000' } }).composite([{ input: img, top: 30, left: 0 }, { input: label, top: 0, left: 0 }]).jpeg().toBuffer();
}));
const rowsN = Math.ceil(tiles.length / cols);
await sharp({ create: { width: W * cols, height: (H + 30) * rowsN, channels: 3, background: '#000' } }).composite(tiles.map((t, k) => ({ input: t, left: (k % cols) * W, top: Math.floor(k / cols) * (H + 30) }))).jpeg({ quality: 85 }).toFile('private/qr-sheet.jpg');
