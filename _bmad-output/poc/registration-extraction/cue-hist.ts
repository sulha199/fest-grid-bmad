import { readFileSync } from 'node:fs';
import { detectRegistrationPhones } from './detect-phones.ts';
const all = readFileSync('private/all-captions.jsonl', 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const h: Record<string, number> = {}; let n = 0; const dist = new Set<string>();
const seen = new Set<string>();
for (const r of all) {
  const key = r.caption.slice(0, 200); // collapse duplicate captions (same text posted repeatedly)
  if (seen.has(key)) continue; seen.add(key);
  for (const d of detectRegistrationPhones(r.caption)) { n++; h[d.cue ?? 'none'] = (h[d.cue ?? 'none'] ?? 0) + 1; dist.add(d.e164); }
}
console.log('distinct captions', seen.size, 'numbers (distinct-caption basis)', n, 'distinct numbers', dist.size);
console.log(Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([k, v]) => `${k}:${v}`).join('  '));
