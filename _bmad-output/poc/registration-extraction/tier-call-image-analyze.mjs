// POC: scores private/tier-call-runs-img.jsonl (tier call with images, live posts). Writes out/tier-call-image-summary.json (aggregates only).
//   node tier-call-image-analyze.mjs [--detail]
// Without labels, "found on the image" is read as: the call returned an amount that is NOT written in the caption. Those posts are the ones to check by eye.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { decideTiers, amountOf } from './tier-options.mjs';

const NL = String.fromCharCode(10);
const detail = process.argv.includes('--detail');
const live = new Map(readFileSync('private/live-posts.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l)).map((r) => [r.id ? r.pid : r.pid, r]));
const rows = readFileSync('private/tier-call-runs-img.jsonl', 'utf8').trim().split(NL).map((l) => JSON.parse(l));
const ok = rows.filter((r) => r.ok && r.parsedOk && r.finish === 'STOP');
const sum = (a) => a.reduce((x, y) => x + y, 0);
const inCaption = (cap, a) => {
  if (a === 0) return new RegExp('(gratis|free|tanpa biaya)', 'i').test(cap);
  const flat = cap.replace(/(?<=\d)[.,](?=\d{3})/g, '');
  return flat.includes(String(a)) || (a % 1000 === 0 && new RegExp('(^|[^0-9])' + a / 1000 + '\\s?(k|rb|ribu)', 'i').test(cap)) || (a % 1000000 === 0 && new RegExp(a / 1000000 + '\\s?(jt|juta)', 'i').test(cap));
};

const items = ok.map((r) => {
  const cap = live.get(r.id)?.content ?? '';
  const d = decideTiers(r.options);
  const imageOnly = d.amounts.filter((a) => !inCaption(cap, a));
  return { r, cap, d, imageOnly };
});
const out = {
  notes: 'aggregates only',
  calls: rows.length, okCalls: ok.length, failed: rows.filter((r) => !r.ok).length, notStop: rows.filter((r) => r.ok && (!r.parsedOk || r.finish !== 'STOP')).length,
  postsWithAnyPricedOption: items.filter((x) => x.d.amounts.length).length,
  postsWithAmountOnlyInImage: items.filter((x) => x.imageOnly.length).length,
  amountsReturned: sum(items.map((x) => x.d.amounts.length)), amountsOnlyInImage: sum(items.map((x) => x.imageOnly.length)),
  optionsWithoutReadablePrice: sum(items.map((x) => x.r.options.filter((o) => amountOf(o.price) === null).length)),
  longestPrice: Math.max(0, ...items.flatMap((x) => x.r.options.map((o) => String(o.price ?? '').length))),
  postsEmittingTiers: items.filter((x) => x.d.emit).length,
  multiEventPosts: items.filter((x) => (x.r.events ?? 1) >= 2).length,
  multiEventPostsEmittingTiers: items.filter((x) => (x.r.events ?? 1) >= 2 && x.d.emit).length,
  audience: items.flatMap((x) => x.r.options).reduce((a, o) => ({ ...a, [o.audience]: (a[o.audience] ?? 0) + 1 }), {}),
  tokens: { promptAvg: Math.round(sum(ok.map((r) => r.usage?.promptTokens ?? 0)) / Math.max(1, ok.length)), outputAvg: Math.round(sum(ok.map((r) => r.usage?.outputTokens ?? 0)) / Math.max(1, ok.length)), secondsAvg: +(sum(ok.map((r) => r.ms)) / Math.max(1, ok.length) / 1000).toFixed(1) },
  imagesAvg: +(sum(ok.map((r) => r.images)) / Math.max(1, ok.length)).toFixed(1),
};
mkdirSync('out', { recursive: true }); writeFileSync('out/tier-call-image-summary.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
if (detail) {
  console.log('posts with an amount only in the image (id events caption-has-price-word | amounts | not in caption):');
  for (const x of items.filter((y) => y.imageOnly.length)) console.log(`  ${x.r.id} ev=${x.r.events} | ${JSON.stringify(x.d.amounts)} | ${JSON.stringify(x.imageOnly)} | ${x.r.options.map((o) => `${o.audience}:${String(o.label).slice(0, 18)}=${o.price ?? '-'}`).join('; ')}`);
  console.log('multi-event posts that emit tiers:');
  for (const x of items.filter((y) => (y.r.events ?? 1) >= 2 && y.d.emit)) console.log(`  ${x.r.id} ev=${x.r.events} ${JSON.stringify(x.d.amounts)} ${x.r.options.map((o) => String(o.label).slice(0, 20)).join(' | ')}`);
}
