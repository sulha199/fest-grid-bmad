// POC: draws a stratified sample of stored schedule titles for hand labelling (private/title-sample.json; titles are public event data but may contain names, so never commit it).
// Blind to the rule's output in the printed view: strata only decide which rows are drawn.
import { readFileSync, writeFileSync } from 'node:fs';
import { classifyStage } from './stage-classifier.mjs';
const rows = readFileSync('private/prod-schedule-titles.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 11);
const weak = /(pendaftaran|daftar|regist|tiket|ticket|final|babak|pengumuman|announce|batch|gelombang|deadline|submission|submit|meeting|workshop|talk|seminar|gladi|check|redeem|open|closing|sale|promo|early|presale|seleksi|audisi|kurasi|penyisihan|juara|winner|hasil|result|pengumpulan|racepack|race pack|briefing|bazaar|pre-?event|day \d|hari)/i;
const seen = new Set(); const pool = [];
for (const r of rows) { const k = String(r.t ?? '').trim().toLowerCase(); if (!k || k.length > 120 || seen.has(k)) continue; seen.add(k); pool.push({ ...r, rule: classifyStage(r.t) }); }
const pick = (arr, n) => arr.sort((a, b) => hash(a.t) - hash(b.t)).slice(0, n);
const nonEvent = pool.filter((r) => r.rule !== 'event'), ev = pool.filter((r) => r.rule === 'event');
const out = [...pick(nonEvent, 130), ...pick(ev.filter((r) => weak.test(r.t)), 90), ...pick(ev.filter((r) => !weak.test(r.t)), 40)];
out.sort((a, b) => hash(a.t + 'x') - hash(b.t + 'x'));
writeFileSync('private/title-sample.json', JSON.stringify(out.map((r, i) => ({ i: i + 1, en: r.en, t: r.t, s: r.s, x: r.x, main: r.main, rule: r.rule })), null, 0));
console.log(`pool ${pool.length} unique titles; non-event by rule ${nonEvent.length}; sample ${out.length}`);
