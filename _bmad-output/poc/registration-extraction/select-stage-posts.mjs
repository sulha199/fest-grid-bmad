// POC: picks the post sets for the stage/tier replay from private/live-posts.jsonl (posts whose signed image links are still valid).
//   stage   : posts the pipeline stored as dependent-stages, plus captions with a stage word and two or more date mentions
//   tier    : captions with two or more prices, or a batch/category word with a price
//   control : single-event captions with neither signal (the stage and tier fields should stay quiet here)
// Deterministic (hash order). Writes private/stage-posts.json: [{pid, set}] (post ids only).
import { readFileSync, writeFileSync } from 'node:fs';

const rows = readFileSync('private/live-posts.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const stageWord = /(pendaftaran|registrasi|early ?bird|presale|pengumuman|seleksi|penyisihan|kualifikasi|technical meeting|audisi|kurasi|babak|final|semifinal|workshop|gladi|race ?pack|batas|deadline|open call|pengumpulan|closing)/i;
const dates = (s) => (s.match(/\b\d{1,2}\s*(?:[-–&,]\s*\d{1,2}\s*)?(jan|feb|mar|apr|mei|may|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)[a-z]*/gi) || []).length;
const prices = (s) => (s.match(/rp\.?\s?\d[\d.,]*|\d+\s?k\b|idr\s?\d/gi) || []).length;
const tierWord = /(early ?bird|presale|kategori|reguler|regular|vip|batch|gelombang|umum)/i;
const used = new Set();
const take = (list, n, set) => list.sort((a, b) => hash(a.pid) - hash(b.pid)).filter((r) => !used.has(r.pid)).slice(0, n).map((r) => { used.add(r.pid); return { pid: r.pid, set }; });
const withText = rows.filter((r) => (r.content ?? '').length >= 60);

const stagePool = withText.filter((r) => r.reason === 'dependent-stages' || (stageWord.test(r.content) && dates(r.content) >= 2));
const tierPool = withText.filter((r) => prices(r.content) >= 2 || (tierWord.test(r.content) && prices(r.content) >= 1));
const controlPool = withText.filter((r) => r.n === 1 && r.reason === 'single-event' && !stageWord.test(r.content) && prices(r.content) < 2 && dates(r.content) <= 1);

const out = [...take(stagePool, 30, 'stage'), ...take(tierPool, 24, 'tier'), ...take(controlPool, 8, 'control')];
writeFileSync('private/stage-posts.json', JSON.stringify(out));
console.log(`pools: stage ${stagePool.length}, tier ${tierPool.length}, control ${controlPool.length}; picked ${out.length}:`, out.reduce((a, x) => ((a[x.set] = (a[x.set] || 0) + 1), a), {}));
