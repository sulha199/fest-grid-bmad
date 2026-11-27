// Runs the detector over every stored caption of an active event (private/all-captions.jsonl) and compares it with the
// AI's has_private_contact flag. Prints aggregates only. Also builds the HELD-OUT review sheets (masked contexts) in private/.
import { readFileSync, writeFileSync } from 'node:fs';
import { detectRegistrationPhones, normalizeCaption, maskE164 } from './detect-phones.ts';

const all = readFileSync('private/all-captions.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const devIds = new Set(readFileSync('private/sample.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l).post_id));
const LOOSE = /(?:\+?62|\b0)[ .-]?8\d{1,2}[ .-]?\d{3,4}[ .-]?\d{2,5}/;

let n = 0, withNum = 0, nums = 0, multi = 0;
const roleCount: Record<string, number> = { reg: 0, cp: 0 };
const confusion = { flagT_detT: 0, flagT_detF: 0, flagF_detT: 0, flagF_detF: 0 };
const perCaption: number[] = [];
const rows = all.map((r) => {
  const det = detectRegistrationPhones(r.caption);
  const loose = LOOSE.test(normalizeCaption(r.caption));
  n++; if (det.length) withNum++; nums += det.length; perCaption.push(det.length);
  for (const d of det) roleCount[d.role] = (roleCount[d.role] ?? 0) + 1;
  if (det.length > 3) multi++;
  confusion[`flag${r.flag ? 'T' : 'F'}_det${det.length ? 'T' : 'F'}` as keyof typeof confusion]++;
  return { ...r, det, loose, dev: devIds.has(r.post_id) };
});
console.log('captions', n, 'with >=1 detected number', withNum, 'numbers', nums, 'roles', JSON.stringify(roleCount), 'captions with >3 numbers', multi);
console.log('count distribution', JSON.stringify([0, 1, 2, 3, 4].map((k) => perCaption.filter((c) => (k === 4 ? c >= 4 : c === k)).length)));
console.log('vs AI flag (flag = has_private_contact on any event of the post):', JSON.stringify(confusion));
const dets = rows.filter((r) => r.det.length > 0 && !r.dev);
const loosNeg = rows.filter((r) => r.det.length === 0 && r.loose && !r.dev);
console.log('held-out pools: detector-positive', dets.length, '| detector-negative but loose phone-like text', loosNeg.length);

// Held-out review sheets: masked context only (digits -> x), deterministic order by post id hash-ish (sort by id).
const mask = (s: string) => s.replace(/\d/g, 'x');
function ctxAround(text: string, idx: number, len: number) {
  const a = Math.max(0, idx - 90), b = Math.min(text.length, idx + len + 40);
  return mask(text.slice(a, b).replace(/\n+/g, ' ⏎ '));
}
const PH = /(?:\(?\+?[ ]?62\)?[ \-.]?|0)8\d(?:[ \-.()]?\d){6,11}/g;
const pick = <T extends { post_id: string }>(xs: T[], k: number) => [...xs].sort((a, b) => (a.post_id < b.post_id ? -1 : 1)).filter((_, i) => i % Math.max(1, Math.floor(xs.length / k)) === 0).slice(0, k);
const pos = pick(dets, 60).map((r, i) => {
  const t = normalizeCaption(r.caption);
  const hits = [...t.matchAll(PH)].slice(0, 4).map((m) => ctxAround(t, m.index!, m[0].length));
  return { id: 'H' + String(i + 1).padStart(2, '0'), post_id: r.post_id, detected: r.det.map((d) => `${maskE164(d.e164)}:${d.role}:${d.cue}`), contexts: hits };
});
const neg = pick(loosNeg, 40).map((r, i) => {
  const t = normalizeCaption(r.caption);
  const m = t.match(LOOSE)!;
  return { id: 'N' + String(i + 1).padStart(2, '0'), post_id: r.post_id, context: ctxAround(t, m.index!, m[0].length) };
});
writeFileSync('private/heldout-sheet.json', JSON.stringify({ pos, neg }, null, 1));
console.log('held-out sheet written:', pos.length, 'positives,', neg.length, 'loose negatives');
