#!/usr/bin/env tsx
/**
 * No-model baseline for the audience-country ladder: what the deterministic steps alone (cue, then the account's country) get right against a labelled
 * sheet, with the model's inputs (a stated audience, the event country, the online rule) left out. It shows how much of the answer the model has to add
 * and where it can only subtract. Reads captions locally; prints counts and post ids only.
 *
 *   cd apps/backend
 *   npx tsx scripts/poc-event-insight/ladder-baseline.ts --labels scripts/poc-event-insight/local/label-sheet-claude-tuning.csv
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { accountCountryOf, resolveAudienceCountry } from './audience-country.js';
import { isHardStratum, prop } from './audience-poc-score-lib.js';
import { parseCsv, postId, type SourcePost } from './label-sheets-lib.js';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (n: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const labelsPath = resolve(arg('labels') ?? (() => { throw new Error('missing --labels <csv>'); })());
const local = join(here, 'local');

const posts = JSON.parse(readFileSync(join(local, 'poc-posts.local.json'), 'utf8')) as SourcePost[];
const acct = (p: SourcePost) => p.account ?? p.username ?? '';
const byAccount = new Map<string, string[]>();
for (const p of posts) byAccount.set(acct(p), [...(byAccount.get(acct(p)) ?? []), p.caption]);
const country = new Map([...byAccount].map(([u, caps]) => [u, accountCountryOf(u, caps)]));
const byId = new Map(posts.map((p) => [postId(p.url), p]));

const rows = parseCsv(readFileSync(labelsPath, 'utf8'));
let k = 0, n = 0, unclearAnswers = 0, wrongAnswers = 0, skipped = 0, hk = 0, hn = 0;
const misses: string[] = [];
const bySource = new Map<string, [number, number]>();
for (const r of rows) {
  const p = byId.get(r.id);
  const truth = (r.audience_country ?? '').trim().toLowerCase();
  if (!p || !truth || truth === 'unclear') { skipped++; continue; }
  const res = resolveAudienceCountry({ caption: p.caption, postLanguage: (r.post_language ?? 'id').toLowerCase(), accountCountry: country.get(acct(p)) });
  const ok = res.country === truth;
  n++; if (ok) k++;
  if (isHardStratum(r)) { hn++; if (ok) hk++; }
  const s = bySource.get(res.source) ?? [0, 0];
  bySource.set(res.source, [s[0] + (ok ? 1 : 0), s[1] + 1]);
  if (res.country === 'unclear') unclearAnswers++; else if (!ok) { wrongAnswers++; misses.push(`${r.id} ${r.stratum}: label ${truth}, ladder ${res.country} (${res.source})`); }
}
const f = (p: ReturnType<typeof prop>) => `${p.pct.toFixed(1)}% (${p.k}/${p.n}, 95% CI ${p.lo.toFixed(0)}–${p.hi.toFixed(0)})`;
console.log(`accounts with a resolved country: ${[...country.values()].filter(Boolean).length} of ${country.size}`);
console.log(`ladder without the model, against ${n} labelled posts (${skipped} skipped: unclear or unknown): exact ${f(prop(k, n))}`);
console.log(`  foreign and shared-language strata: ${f(prop(hk, hn))}`);
console.log(`  of the misses: ${unclearAnswers} answered unclear (an abstention), ${wrongAnswers} answered a wrong country`);
for (const [s, [a, b]] of [...bySource].sort()) console.log(`  decided by ${s}: ${f(prop(a, b))}`);
if (misses.length) { console.log('wrong-country answers:'); for (const m of misses.slice(0, 40)) console.log('  ' + m); }
