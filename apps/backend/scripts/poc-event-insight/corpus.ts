/** Loads the POC corpus (real captions + synthetic + held-out) together with each post's Label. */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  HOLDOUT_LABELS, HOLDOUT_POSTS, REAL_LABELS, SYNTHETIC_LABELS, SYNTHETIC_POSTS, type Label,
} from './labels.js';

const here = dirname(fileURLToPath(import.meta.url));

export interface Case { id: string; source: 'real' | 'synthetic'; caption: string; account?: string; publishedAt: string; label: Label }

// core = real + synthetic set used to design the prompt; holdout = written before the v1 failure
// analysis, for checking a revised prompt on cases it was not tuned on; all = both.
export function loadCases(set: string, only?: string[]): Case[] {
  const real = JSON.parse(readFileSync(resolve(here, 'corpus.real.json'), 'utf8')) as Array<{ id: string; account: string; publishedAt: string; caption: string }>;
  const synth = (posts: typeof SYNTHETIC_POSTS, labels: Record<string, Label>): Case[] =>
    posts.map((s) => ({ id: s.id, source: 'synthetic' as const, caption: s.caption, publishedAt: '2026-10-01T09:00:00.000Z', label: labels[s.id] }));
  const core: Case[] = [
    ...real.map((r) => ({ id: r.id, source: 'real' as const, caption: r.caption, account: r.account, publishedAt: r.publishedAt, label: REAL_LABELS[r.id] })),
    ...synth(SYNTHETIC_POSTS, SYNTHETIC_LABELS),
  ];
  const holdout = synth(HOLDOUT_POSTS, HOLDOUT_LABELS);
  const cases = set === 'holdout' ? holdout : set === 'all' ? [...core, ...holdout] : core;
  const missing = cases.filter((c) => !c.label).map((c) => c.id);
  if (missing.length) throw new Error(`No label for: ${missing.join(', ')}`);
  return only ? cases.filter((c) => only.includes(c.id)) : cases;
}
