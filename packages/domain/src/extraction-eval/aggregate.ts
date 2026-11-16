import {
  EXTRACTION_EVAL_FIELDS,
  type Aggregate,
  type Baseline,
  type Comparison,
  type ExtractionEvalField,
  type FieldComparison,
  type FieldScores,
  type PostAggregate,
  type RunResult,
  type TruncatedComparison,
} from './types.js';

const mean = (values: number[]): number | null => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

/** Sample standard deviation; 0 with fewer than two values. */
export function sampleStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - m) ** 2, 0) / (values.length - 1));
}

const perField = <T>(make: (f: ExtractionEvalField) => T) =>
  Object.fromEntries(EXTRACTION_EVAL_FIELDS.map((f) => [f, make(f)])) as Record<ExtractionEvalField, T>;

/** Per post and per field pass-rate over the runs that answered. Truncated and unavailable runs never count. */
export function aggregateRuns(results: RunResult[]): Aggregate {
  const posts: Record<string, PostAggregate> = {};
  for (const r of results) {
    const post = (posts[r.postId] ??= {
      fields: perField(() => null) as FieldScores,
      okRuns: 0,
      truncatedRuns: 0,
      unavailableRuns: 0,
      countMismatchRuns: 0,
      missing: [],
      extras: [],
      runFields: [],
      runIndexes: [],
    });
    if (r.outcome === 'truncated') post.truncatedRuns += 1;
    else if (r.outcome === 'unavailable') post.unavailableRuns += 1;
    else {
      post.okRuns += 1;
      post.runFields.push(r.score!.fields);
      post.runIndexes.push(r.runIndex);
      if (r.score!.countMismatch) post.countMismatchRuns += 1;
      for (const m of r.score!.missing) {
        const tally = post.missing.find((t) => t.index === m.index);
        if (tally) tally.runs += 1;
        else post.missing.push({ ...m, runs: 1 });
      }
      for (const e of r.score!.extras) {
        const tally = post.extras.find((t) => t.name === e.name);
        if (tally) tally.runs += 1;
        else post.extras.push({ ...e, runs: 1 });
      }
    }
  }
  const postList = Object.values(posts);
  for (const post of postList) {
    post.missing.sort((a, b) => a.index - b.index);
    post.extras.sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name));
    post.fields = perField((f) => mean(post.runFields.map((rf) => rf[f]).filter((v): v is number => v !== null))) as FieldScores;
  }
  const fields = perField((f) => mean(postList.map((p) => p.fields[f]).filter((v): v is number => v !== null))) as FieldScores;
  // The noise of a field is how much its cross-post mean moves from one run to the next. Only posts that answered EVERY run
  // index take part: if a post dropped out of some runs (truncated, 429) the mean's composition would change between runs,
  // and that change would be counted as model noise and inflate the band.
  // The same holds per field: a post whose score for the field is missing in some run (nothing matched, say) is left out of
  // that field's series altogether, not only of that run's mean.
  const runIndexes = [...new Set(results.map((r) => r.runIndex))].sort((a, b) => a - b);
  const completePosts = postList.filter((p) => runIndexes.every((i) => p.runIndexes.includes(i)));
  const fieldRunMeans = perField((f) => {
    const steady = completePosts.filter((p) => p.runFields.every((rf) => rf[f] !== null));
    const out: number[] = [];
    for (const runIndex of runIndexes) {
      const m = mean(steady.map((p) => p.runFields[p.runIndexes.indexOf(runIndex)]![f]!));
      if (m !== null) out.push(m);
    }
    return out;
  });
  return {
    posts,
    fields,
    fieldRunMeans,
    runCount: runIndexes.length,
    totals: {
      ok: postList.reduce((a, p) => a + p.okRuns, 0),
      truncated: postList.reduce((a, p) => a + p.truncatedRuns, 0),
      unavailable: postList.reduce((a, p) => a + p.unavailableRuns, 0),
      countMismatch: postList.reduce((a, p) => a + p.countMismatchRuns, 0),
    },
  };
}

export const DEFAULT_NOISE_FLOOR = 0.15;
export const NOISE_BAND_SIGMAS = 2;
/**
 * Upper cap on the noise band (50 points). A field whose repeats swing that widely is unstable, not unmeasurable: the cap
 * keeps a collapse of more than half the pass-rate flaggable. Without it a band above 100 points could never be exceeded,
 * so a field with a noisy series was never checked at all.
 */
export const MAX_NOISE_BAND = 0.5;

/** Noise band for a series of repeat scores: 2 standard deviations of the repeats, within [floor, MAX_NOISE_BAND]; the floor wins. */
export function noiseBand(repeats: number[], floor: number = DEFAULT_NOISE_FLOOR): number {
  return Math.max(floor, Math.min(MAX_NOISE_BAND, NOISE_BAND_SIGMAS * sampleStdDev(repeats)));
}

/** Share of the runs that gave an answer which were truncated or invalid; null when no run answered. */
export function truncatedRate(totals: Aggregate['totals']): number | null {
  const answered = totals.ok + totals.truncated;
  return answered === 0 ? null : totals.truncated / answered;
}

export function buildBaseline(aggregate: Aggregate, meta: { model: string; promptHash: string; date: string; runs: number }): Baseline {
  const rate = truncatedRate(aggregate.totals);
  return {
    ...meta,
    fields: aggregate.fields,
    posts: Object.fromEntries(Object.entries(aggregate.posts).map(([id, p]) => [id, p.fields])),
    ...(rate === null ? {} : { truncatedRate: rate }),
  };
}

/**
 * Flag a field only when its pass-rate fell by more than the noise band (spread of the repeats, with a floor and a cap).
 *
 * Only posts present in BOTH the run and the baseline are compared: a post added to (or dropped from) the labelled set
 * since the baseline would otherwise move the mean of one side only, and a field would be flagged with no post having
 * changed. Posts on one side only are reported as new / removed, not compared. With a single run per post the spread is 0,
 * so a drop is reported as `single_run`, never `flagged`. The truncated rate is compared too: invalid output leaves every
 * pass-rate (it is not an answer), so a rise in it is the only trace of a prompt change that breaks the output.
 */
export function compareToBaseline(aggregate: Aggregate, baseline: Baseline, floor: number = DEFAULT_NOISE_FLOOR): Comparison {
  const comparedPosts = Object.keys(aggregate.posts).filter((id) => id in baseline.posts);
  const fields: FieldComparison[] = EXTRACTION_EVAL_FIELDS.map((field) => {
    const band = noiseBand(aggregate.fieldRunMeans[field], floor);
    if (aggregate.fields[field] === null) {
      return { field, current: null, baseline: baseline.fields[field] ?? null, delta: null, band, status: 'no_data', changedPosts: [] };
    }
    const pairs = comparedPosts.flatMap((postId) => {
      const now = aggregate.posts[postId]!.fields[field];
      const was = baseline.posts[postId]![field];
      return now !== null && typeof was === 'number' ? [{ postId, now, was }] : [];
    });
    if (pairs.length === 0) return { field, current: aggregate.fields[field], baseline: null, delta: null, band, status: 'new', changedPosts: [] };
    const current = mean(pairs.map((x) => x.now))!;
    const base = mean(pairs.map((x) => x.was))!;
    const delta = current - base;
    const changedPosts = pairs.flatMap(({ postId, now, was }) => {
      const postBand = noiseBand(aggregate.posts[postId]!.runFields.map((rf) => rf[field]).filter((v): v is number => v !== null), floor);
      return was - now > postBand ? [{ postId, baseline: was, current: now }] : [];
    });
    const dropped = delta < -band;
    const status = dropped ? (aggregate.runCount >= 2 ? 'flagged' : 'single_run') : delta > band ? 'improved' : 'ok';
    return { field, current, baseline: base, delta, band, status, changedPosts: status === 'flagged' ? changedPosts : [] };
  });
  const current = truncatedRate(aggregate.totals);
  const base = baseline.truncatedRate ?? null;
  const truncated: TruncatedComparison =
    current === null
      ? { current, baseline: base, delta: null, status: 'no_data' }
      : base === null
        ? { current, baseline: null, delta: null, status: 'no_baseline' }
        : { current, baseline: base, delta: current - base, status: current - base > floor ? 'flagged' : 'ok' };
  return {
    fields,
    newPosts: Object.keys(aggregate.posts).filter((id) => !(id in baseline.posts)),
    removedPosts: Object.keys(baseline.posts).filter((id) => !(id in aggregate.posts)),
    comparedPosts,
    truncatedRate: truncated,
  };
}
