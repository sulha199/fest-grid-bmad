// POC: downloads the cover image (and, for multi-event posts, the extra slides) of every post whose signed image link is still valid.
// Images are public Instagram CDN files; they go to the gitignored private/img/ folder. Read-only w.r.t. the DB (input is private/live-posts.jsonl).
//   node download-live-images.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

mkdirSync('private/img', { recursive: true });
const rows = readFileSync('private/live-posts.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const jobs = [];
for (const r of rows) {
  let extra = [];
  try { extra = typeof r.addl === 'string' ? JSON.parse(r.addl) : Array.isArray(r.addl) ? r.addl : []; } catch { extra = []; }
  const urls = [r.image, ...(r.n >= 2 || extra.length ? extra : [])].filter(Boolean).slice(0, 10);
  urls.forEach((u, i) => jobs.push({ pid: r.pid, i, u }));
}
console.log('posts', rows.length, 'images to fetch', jobs.length);
const manifest = [];
let next = 0, ok = 0, fail = 0;
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++];
    const file = `private/img/${j.pid}-${j.i}.jpg`;
    if (existsSync(file)) { manifest.push({ pid: j.pid, i: j.i, file }); ok++; continue; }
    try {
      const res = await fetch(j.u, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error(String(res.status));
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      manifest.push({ pid: j.pid, i: j.i, file }); ok++;
    } catch (e) { fail++; }
  }
}
await Promise.all(Array.from({ length: 8 }, worker));
writeFileSync('private/img-manifest.json', JSON.stringify(manifest));
console.log('ok', ok, 'fail', fail);
