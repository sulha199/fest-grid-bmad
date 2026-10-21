import { canHavePromptVariant } from './generate-prompt-variants.js';
import type { GoldenPromptFixture } from './golden-prompt-fixtures.js';

/**
 * Windowing for the nightly live eval (`apps/backend/scripts/run-golden-prompt-live-eval.ts`): a
 * free-tier Gemini key allows only ~20 requests/day, far fewer than one call per fixture plus one
 * per metamorphic variant, so each run evaluates a budget-sized window of the fixture suite and
 * the rest stay pending for later runs. Pure -- the script owns the Gemini calls and the ledger file.
 *
 * Priority, highest first:
 *  1. `never-evaluated`: no baseline yet (a fixture added since the last run), so a regression
 *     it pins would otherwise go unseen.
 *  2. `drift-recheck`: drifted on its last evaluation -- tells a one-night wobble from a real
 *     regression. Capped at a quarter of the budget, so a fixture that stays drifted cannot starve
 *     the rest of the suite.
 *  3. `stalest`: everything else, longest since evaluated first -- a fair rotation, so every fixture
 *     is re-checked every ceil(suite cost / budget) runs.
 * Ties (the whole suite on a first run, or every fixture one run evaluated together) rotate across
 * categories rather than draining one category at a time.
 */
export interface GoldenEvalLedgerEntry {
  /** ISO timestamp of the run that last evaluated this fixture's base prompt. */
  lastEvaluatedAt: string;
  /** Whether that evaluation (the base prompt or its variant) drifted. */
  drifted: boolean;
}

/** Fixture id -> its last evaluation. A fixture with no entry has never been evaluated. */
export type GoldenEvalLedger = Record<string, GoldenEvalLedgerEntry>;

export type GoldenEvalWindowReason = 'never-evaluated' | 'drift-recheck' | 'stalest';

export interface GoldenEvalWindowItem {
  fixture: GoldenPromptFixture;
  /** Position in the `fixtures` array passed to the planner (feeds `pickPromptVariant`'s rotation). */
  index: number;
  reason: GoldenEvalWindowReason;
  /** Whether this window slot also affords the fixture's metamorphic variant (one extra call). */
  withVariant: boolean;
}

export interface PlanGoldenEvalWindowOptions {
  /** Most Gemini calls the run may make; `Infinity` plans the whole suite. A non-positive value plans nothing. */
  budget: number;
  /** Whether each variant-eligible fixture also spends one call on a metamorphic variant. */
  withVariants: boolean;
}

const DRIFT_RECHECK_BUDGET_SHARE = 0.25;

interface Candidate {
  fixture: GoldenPromptFixture;
  index: number;
  entry: GoldenEvalLedgerEntry | undefined;
  categoryIndex: number;
  categoryRank: number;
  cost: number;
}

function evaluatedAtMs(candidate: Candidate): number {
  return candidate.entry ? Date.parse(candidate.entry.lastEvaluatedAt) : Number.NEGATIVE_INFINITY;
}

function byPriority(a: Candidate, b: Candidate): number {
  const aMs = evaluatedAtMs(a);
  const bMs = evaluatedAtMs(b);
  if (aMs !== bMs) {
    return aMs < bMs ? -1 : 1;
  }
  // Two distinct fixtures never tie on both: equal ranks mean different categories.
  return a.categoryRank - b.categoryRank || a.categoryIndex - b.categoryIndex;
}

/**
 * Picks the fixtures (and which of them also get a variant) to evaluate in this run, in the order
 * to evaluate them -- so a run cut short by a spent quota has still done the highest-priority work.
 * `ledger` must come from `parseGoldenEvalLedger` (its timestamps are valid dates).
 */
export function planGoldenEvalWindow(
  fixtures: readonly GoldenPromptFixture[],
  ledger: GoldenEvalLedger,
  options: PlanGoldenEvalWindowOptions
): GoldenEvalWindowItem[] {
  if (!(options.budget > 0)) {
    return [];
  }

  const categoryIndexes = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const candidates: Candidate[] = fixtures.map((fixture, index) => {
    const categoryIndex = categoryIndexes.get(fixture.category) ?? categoryIndexes.size;
    categoryIndexes.set(fixture.category, categoryIndex);
    const categoryRank = categoryCounts.get(fixture.category) ?? 0;
    categoryCounts.set(fixture.category, categoryRank + 1);
    return {
      fixture,
      index,
      entry: ledger[fixture.id],
      categoryIndex,
      categoryRank,
      cost: options.withVariants && canHavePromptVariant(fixture) ? 2 : 1,
    };
  });

  const neverEvaluated = candidates.filter((candidate) => !candidate.entry).sort(byPriority);

  const rechecks: Candidate[] = [];
  const recheckBudget = Math.floor(options.budget * DRIFT_RECHECK_BUDGET_SHARE);
  let recheckSpent = 0;
  for (const candidate of candidates.filter((c) => c.entry?.drifted).sort(byPriority)) {
    if (recheckSpent + candidate.cost <= recheckBudget) {
      rechecks.push(candidate);
      recheckSpent += candidate.cost;
    }
  }

  const prioritized = new Set([...neverEvaluated, ...rechecks]);
  const stalest = candidates.filter((candidate) => !prioritized.has(candidate)).sort(byPriority);

  const ordered: Array<{ candidate: Candidate; reason: GoldenEvalWindowReason }> = [
    ...neverEvaluated.map((candidate) => ({ candidate, reason: 'never-evaluated' as const })),
    ...rechecks.map((candidate) => ({ candidate, reason: 'drift-recheck' as const })),
    ...stalest.map((candidate) => ({ candidate, reason: 'stalest' as const })),
  ];

  const window: GoldenEvalWindowItem[] = [];
  let remaining = options.budget;
  for (const { candidate, reason } of ordered) {
    if (remaining < 1) {
      break;
    }
    // The base prompt always comes first; its variant rides along only if a whole extra call is left.
    const withVariant = candidate.cost === 2 && remaining >= 2;
    window.push({ fixture: candidate.fixture, index: candidate.index, reason, withVariant });
    remaining -= withVariant ? 2 : 1;
  }
  return window;
}

function isLedgerEntry(value: unknown): value is GoldenEvalLedgerEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { lastEvaluatedAt, drifted } = value as Record<string, unknown>;
  return typeof lastEvaluatedAt === 'string' && !Number.isNaN(Date.parse(lastEvaluatedAt)) && typeof drifted === 'boolean';
}

/**
 * Validates a ledger read back from disk (a CI cache, so it may be stale, truncated or from an older
 * format). Keeps only well-formed entries of fixtures that still exist -- a bad or missing entry just
 * makes that fixture `never-evaluated` again -- so a corrupt cache can never fail the nightly run.
 */
export function parseGoldenEvalLedger(raw: unknown, knownFixtureIds: readonly string[]): GoldenEvalLedger {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return {};
  }
  const ledger: GoldenEvalLedger = {};
  for (const id of knownFixtureIds) {
    const entry = (raw as Record<string, unknown>)[id];
    if (isLedgerEntry(entry)) {
      ledger[id] = { lastEvaluatedAt: entry.lastEvaluatedAt, drifted: entry.drifted };
    }
  }
  return ledger;
}
