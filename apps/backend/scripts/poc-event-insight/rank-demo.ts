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
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCases } from './corpus.js';
import { applyGuards } from './guards.js';
import type { EventInsight } from './insight-schema.js';
import { rankAreaThenDate, rankDiscovery, type RankableEvent, type UserProfile } from './relevance.js';

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

// Attendance mode as extracted by Gemini in the venues experiment (run 1), when that file exists.
const venuesFile = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../_bmad-output/planning-artifacts/event-insight-poc/results/venues-experiment.json');
const attendanceById = new Map<string, EventInsight['attendance']>();
if (existsSync(venuesFile)) {
  for (const r of JSON.parse(readFileSync(venuesFile, 'utf8')).records as Array<{ id: string; run: number; out?: { attendance: EventInsight['attendance'] } }>) {
    if (r.run === 1 && r.out) attendanceById.set(r.id, r.out.attendance);
  }
}
const captions = new Map(loadCases('all').map((c) => [c.id, c.caption]));
const events: RankableEvent[] = [];
for (const [id, days] of Object.entries(DAYS)) {
  const rec = data.records.find((r) => r.caseId === id && r.variant === 'standalone' && r.model === data.model && r.run === 1 && r.insight);
  // Guarded, as it would be persisted: the model proposes, deterministic checks verify.
  const guarded = rec?.insight ? applyGuards(rec.insight, captions.get(id) as string).insight : undefined;
  events.push({ id, daysUntilNext: days, insight: guarded ? { ...guarded, attendance: attendanceById.get(id) ?? guarded.attendance } : undefined });
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
out.push(`### Rank of the events each user would plausibly care about (1 = top of ${events.length})`, '', '| user | event | chronological | area → sooner | bounded relevance discount |', '|---|---|--:|--:|--:|');
const rankOf = (list: Array<{ id: string }>, id: string) => list.findIndex((e) => e.id === id) + 1;
const chronoAll = rankDiscovery(events);
for (const p of PERSONAS) {
  const mine = rankDiscovery(events, p);
  const areaFirst = rankAreaThenDate(events, p);
  for (const id of WANTED[p.id] ?? []) out.push(`| ${p.id} | ${id} | ${rankOf(chronoAll, id)} | ${rankOf(areaFirst, id)} | ${rankOf(mine, id)} |`);
}
out.push('');
out.push(`### Area first, then sooner — top ${top} per user (tier 0 = local ladder, merged · 1 = anywhere: online / national / unspecified · 2 = other local)`, '');
const areaTops = new Map<string, string[]>();
for (const p of PERSONAS) {
  const ranked = rankAreaThenDate(events, p);
  areaTops.set(p.id, ranked.slice(0, top).map((e) => e.id));
  const counts = [0, 1, 2].map((t) => ranked.filter((e) => e.tier === t).length);
  const online = ranked.filter((e) => e.reason === 'online' || e.insight?.attendance === 'online').map((e) => `${e.id}→tier ${e.tier}`);
  out.push(`**${p.id}** — events by tier: ${counts[0]} / ${counts[1]} / ${counts[2]}${online.length ? ` · online: ${online.join(', ')}` : ''}`, '', '| # | event | in (days) | tier | why |', '|--:|---|--:|--:|---|',
    ...ranked.slice(0, top).map((e, i) => `| ${i + 1} | ${e.id} | ${e.daysUntilNext} | ${e.tier} | ${e.reason} |`), '');
}
const moved = (p: UserProfile) => { const a = rankDiscovery(events).map((e) => e.id), b = rankAreaThenDate(events, p).map((e) => e.id); return b.filter((id, i) => a[i] !== id).length; };
out.push('Events whose position differs from the chronological order: ' + PERSONAS.map((p) => `${p.id} ${moved(p)}/${events.length}`).join(' · '), '');
const jaccard = (a: string[], b: string[]) => { const A = new Set(a), B = new Set(b); return [...A].filter((x) => B.has(x)).length / new Set([...A, ...B]).size; };
const names = [...tops.keys()];
out.push(`### Top-${top} overlap between users (Jaccard; 1.00 = identical page)`, '', '| | ' + names.join(' | ') + ' | anonymous |', '|---|' + names.map(() => '--:').join('|') + '|--:|');
const anon = chrono.map((e) => e.id);
for (const a of names) out.push(`| ${a} | ${names.map((b) => jaccard(tops.get(a)!, tops.get(b)!).toFixed(2)).join(' | ')} | ${jaccard(tops.get(a)!, anon).toFixed(2)} |`);

const text = out.join('\n');
console.log(text);
const md = arg('md');
if (md) writeFileSync(md, `# Ranking demo (generated)\n\n${text}\n`);
