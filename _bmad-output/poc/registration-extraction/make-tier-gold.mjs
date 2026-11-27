// POC: derives the gold price amounts for the tier replay from the hand labels (private/labels.json field `tiers`, free text) and writes
// private/tier-gold.json. Prints every derived row so it can be checked by eye; hand corrections live in FIX below.
//   node make-tier-gold.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { amountOf } from './tier-options.mjs';

const L = JSON.parse(readFileSync('private/labels.json', 'utf8'));
// a single-digit "K" is a race distance (3K, 5K), not money
const PRICE = /(?:rp|idr)\s*\.?\s*[\d.,]+(?:\s*(?:k|rb|jt|juta))?|\b\d{1,3}(?:\.\d{3})+\b|\b\d{2,3}\s*k\b/gi;
const FIX = { S29: [7000, 25000] }; // id -> amounts, for labels the pattern cannot read; S29 "Solo/Duo/Trio 7K" is a price but a single-digit K reads as a distance

const gold = {};
for (const [id, v] of Object.entries(L)) {
  if (!v.tiers) continue;
  const text = String(v.tiers);
  const amounts = new Set();
  if (/\b(gratis|free)\b/i.test(text)) amounts.add(0);
  for (const m of text.matchAll(PRICE)) { const a = amountOf(m[0].replace(/\s+/g, ' ')); if (a !== null && a > 0) amounts.add(a); }
  gold[id] = { text, amounts: FIX[id] ?? [...amounts].sort((a, b) => a - b), el: v.el ?? null };
}
writeFileSync('private/tier-gold.json', JSON.stringify(gold, null, 1));
for (const [id, g] of Object.entries(gold)) console.log(id.padEnd(4), String(g.amounts.length >= 2 ? 'MULTI' : g.amounts.length === 1 ? 'one  ' : 'none ').padEnd(6), JSON.stringify(g.amounts).padEnd(40), g.text.slice(0, 80));
