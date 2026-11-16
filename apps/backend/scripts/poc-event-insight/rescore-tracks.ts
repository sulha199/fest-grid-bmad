/** Offline: re-score tracks-experiment.json with and without the deterministic range repair. */
import { readFileSync } from 'node:fs';
import { loadCases } from './corpus.js';
import { EXISTING_TRACK_LABELS, HOLDOUT_TRACK_POSTS, NEW_TRACK_POSTS, repairAgeRanges, scoreTracks, type TrackedAudience } from './tracks.js';

const file = process.argv[2];
if (!file) throw new Error('usage: rescore-tracks.ts <tracks-experiment.json>');
const known = new Map(loadCases('all').map((c) => [c.id, c.caption]));
const posts = [
  ...Object.entries(EXISTING_TRACK_LABELS).map(([id, label]) => ({ id, label, caption: known.get(id)! })),
  ...NEW_TRACK_POSTS.map((p) => ({ id: p.id, label: p.label, caption: p.caption })),
  ...HOLDOUT_TRACK_POSTS.map((p) => ({ id: p.id, label: p.label, caption: p.caption })),
];
const recs = (JSON.parse(readFileSync(file, 'utf8')).records as Array<{ id: string; run: number; audience?: TrackedAudience }>).filter((r) => r.audience);
let raw = 0, fixed = 0, repairsTotal = 0;
const rows: string[] = ['| post | raw | after range repair | repairs |', '|---|:-:|:-:|---|'];
for (const p of posts) {
  const rs = recs.filter((r) => r.id === p.id);
  if (rs.length === 0) continue;
  const a = rs.filter((r) => scoreTracks(r.audience!, p.label, p.caption).pass).length;
  const reps = rs.map((r) => repairAgeRanges(r.audience!, p.caption));
  const b = rs.filter((r, i) => scoreTracks(reps[i].audience, p.label, p.caption).pass).length;
  raw += a; fixed += b; repairsTotal += reps.reduce((n, r) => n + r.repairs.length, 0);
  rows.push(`| ${p.id} | ${a}/${rs.length} | ${b}/${rs.length} | ${reps[0]?.repairs.join('; ') || '—'} |`);
}
console.log(`runs fully correct: raw ${raw}/${recs.length} -> with range repair ${fixed}/${recs.length} (${repairsTotal} repairs applied)\n`);
console.log(rows.join('\n'));
