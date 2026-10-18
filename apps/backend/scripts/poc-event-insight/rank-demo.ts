/**
 * Demo: feed the insights Gemini ACTUALLY extracted (a results-*.json from run.ts) through the
 * prototype relevance function for a handful of personas, to show that one event pool yields a
 * different Discovery order per user — and the chronological order for an anonymous visitor.
 *
 *   npx tsx scripts/poc-event-insight/rank-demo.ts --results <results.json> [--top 6] [--md <out.md>]
 *
 * `daysUntilNext` below is ILLUSTRATIVE (spread over six weeks, deliberately not correlated with
 * relevance); the real posts' dates are in the past relative to when the POC ran. What this shows
 * is the ordering mechanism on real model output, not production data.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { loadCases } from './corpus.js';
import { applyGuards } from './guards.js';
import type { EventInsight } from './insight-schema.js';
import { rankDiscovery, type RankableEvent, type UserProfile } from './relevance.js';

const DAYS: Record<string, number> = {
  'shopfest': 3, 'uss-market': 5, 'tropical-playland': 7, 'swasana-budaya': 9, 'gowes-merdeka': 11, 'cald-conference': 13,
  'porseni-stikes': 15, 'volunteer-sosling': 17, 'volunteer-pulangkesinii': 19, 'futsal-mfc': 21, 'lomba-mewarnai': 23,
  'apecx-talkshow': 25, 'rsih-run': 27, 'erafone-run': 29, 'fixture-sleman-city-hall': 31, 'fixture-drum-contest': 33,
  'fixture-vifation': 35, 'syn-women-tech': 4, 'syn-senam-lansia': 6, 'syn-webinar-nasional': 8, 'syn-open-house-internal': 10,
  'syn-konser-jakarta': 12, 'syn-pameran-origin': 14, 'syn-expat-bali': 16, 'syn-family-day': 18, 'syn-gala-dinner': 20, 'syn-kota-lama': 22,
};

// Events each persona would plausibly care about, chosen by hand for the demo's rank-lift table.
// (The first prototype's geo weighting was revised after this demo exposed it; the weights were not
// otherwise fitted to these lists.)
const WANTED: Record<string, string[]> = {
  rina: ['rsih-run', 'erafone-run', 'gowes-merdeka'],
  budi: ['fixture-vifation', 'futsal-mfc', 'porseni-stikes'],
  maya: ['lomba-mewarnai', 'syn-family-day', 'tropical-playland'],
  tom: ['syn-expat-bali'],
};

export const PERSONAS: Array<UserProfile & { blurb: string }> = [
  { id: 'rina', blurb: 'runner living in Sleman, Indonesian UI', locale: 'id', areas: ['sleman', 'yogyakarta'], interests: { running: 1, cycling: 0.6, trail: 0.5 } },
  { id: 'budi', blurb: 'student in Yogyakarta who follows futsal/esports (declared: student)', locale: 'id', areas: ['yogyakarta'], interests: { futsal: 1, esport: 0.8, billiard: 0.5, basket: 0.4 }, declaredSegments: ['students'] },
  { id: 'maya', blurb: 'parent in Sleman, kids\' activities (declared: families)', locale: 'id', areas: ['sleman', 'yogyakarta'], interests: { coloring: 0.8, science: 0.6, puppet: 0.5, pet: 0.5 }, declaredSegments: ['families', 'adults'] },
  { id: 'tom', blurb: 'expat in Canggu, English UI (declared: expat)', locale: 'en', areas: ['canggu', 'bali'], interests: { yoga: 1, community: 0.6 }, declaredSegments: ['tourists_expats'] },
];

function arg(name: string): string | undefined { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; }

const resultsPath = arg('results');
if (!resultsPath) throw new Error('--results <results-*.json> is required');
const top = parseInt(arg('top') ?? '6', 10);
const data = JSON.parse(readFileSync(resultsPath, 'utf8')) as { model: string; records: Array<{ caseId: string; variant: string; model: string; run: number; insight?: EventInsight }> };

const captions = new Map(loadCases('all').map((c) => [c.id, c.caption]));
const events: RankableEvent[] = [];
for (const [id, days] of Object.entries(DAYS)) {
  const rec = data.records.find((r) => r.caseId === id && r.variant === 'standalone' && r.model === data.model && r.run === 1 && r.insight);
  // Guarded, as it would be persisted: the model proposes, deterministic checks verify.
  events.push({ id, daysUntilNext: days, insight: rec?.insight ? applyGuards(rec.insight, captions.get(id)!).insight : undefined });
}
const withInsight = events.filter((e) => e.insight).length;

const out: string[] = [`Event pool: ${events.length} posts, ${withInsight} with an extracted + guarded insight (model ${data.model}, run 1). Days-until-next are illustrative.`, ''];
const chrono = rankDiscovery(events).slice(0, top);
out.push(`### Anonymous / no profile — chronological (today's behaviour)`, '', '| # | event | in (days) |', '|--:|---|--:|', ...chrono.map((e, i) => `| ${i + 1} | ${e.id} | ${e.daysUntilNext} |`), '');
const tops = new Map<string, string[]>();
for (const p of PERSONAS) {
  const ranked = rankDiscovery(events, p);
  tops.set(p.id, ranked.slice(0, top).map((e) => e.id));
  out.push(`### ${p.id} — ${p.blurb}`, '', '| # | event | in (days) | relevance | why |', '|--:|---|--:|--:|---|',
    ...ranked.slice(0, top).map((e, i) => `| ${i + 1} | ${e.id} | ${e.daysUntilNext} | ${e.score.toFixed(2)} | ${e.reasons.join(', ') || '—'} |`), '');
}
out.push(`### Rank of the events each user would plausibly care about (1 = top of ${events.length}; chronological → personalised)`, '', '| user | event | chronological | personalised |', '|---|---|--:|--:|');
const rankOf = (list: Array<{ id: string }>, id: string) => list.findIndex((e) => e.id === id) + 1;
const chronoAll = rankDiscovery(events);
for (const p of PERSONAS) {
  const mine = rankDiscovery(events, p);
  for (const id of WANTED[p.id] ?? []) out.push(`| ${p.id} | ${id} | ${rankOf(chronoAll, id)} | ${rankOf(mine, id)} |`);
}
out.push('');
const jaccard = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size; };
const names = [...tops.keys()];
out.push(`### Top-${top} overlap between users (Jaccard; 1.00 = identical page)`, '', '| | ' + names.join(' | ') + ' | anonymous |', '|---|' + names.map(() => '--:').join('|') + '|--:|');
const anon = chrono.map((e) => e.id);
for (const a of names) out.push(`| ${a} | ${names.map((b) => jaccard(tops.get(a)!, tops.get(b)!).toFixed(2)).join(' | ')} | ${jaccard(tops.get(a)!, anon).toFixed(2)} |`);

const text = out.join('\n');
console.log(text);
const md = arg('md');
if (md) writeFileSync(md, `# Ranking demo (generated)\n\n${text}\n`);
