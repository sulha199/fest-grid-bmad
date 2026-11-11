import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateRuns,
  buildBaseline,
  buildReport,
  classifyRun,
  compareToBaseline,
  digitsOnly,
  locationMatches,
  MAX_NOISE_BAND,
  matchEvents,
  nameMatches,
  noiseBand,
  normalizeDate,
  normalizeText,
  normalizeTime,
  parseBaseline,
  parseLabelledPost,
  parseRecordedOutputs,
  sampleStdDev,
  scoreRun,
  EXTRACTION_EVAL_FIELDS,
  type Baseline,
  type ExtraEvent,
  type FieldScores,
  type LabelledPost,
  type MissingEvent,
  type RunResult,
  type ScorablePayload,
} from './index.js';

const sched = (d: string, extra: Record<string, unknown> = {}) => ({ eventStartDate: d, ...extra });

// A fully labelled single event used for the perfect-run row and the hand calculation.
const single: LabelledPost = {
  postId: 'single',
  caption: 'Invented caption',
  images: ['a.png'],
  publishedAt: '2026-01-01T00:00:00Z',
  groupingReason: 'single-event',
  events: [
    {
      eventName: 'Contoh Festival',
      location: 'Lapangan Contoh Jakarta',
      ticketPrice: 'Rp 150.000',
      categories: ['MUSIC', 'FOOD'],
      performers: ['Band A', 'Band B'],
      schedules: [{ eventStartDate: '2026-03-01', eventEndDate: '2026-03-02', eventStartTime: '19:00', eventEndTime: '22:00', location: 'Lapangan Contoh' }],
    },
  ],
};
const perfect: ScorablePayload = {
  isEvent: true,
  groupingReason: 'single-event',
  events: [
    {
      eventName: 'Contoh Festival',
      categories: ['MUSIC', 'FOOD'],
      location: 'Lapangan Contoh, Jakarta',
      schedules: [{ ...sched('2026-03-01'), eventEndDate: '2026-03-02', eventStartTime: '19:00:00', eventEndTime: '22.00', ticketPrice: '150000', performers: ['band a', 'Band B'], location: 'Lapangan Contoh' }],
    },
  ],
};
const val = (s: ReturnType<typeof scoreRun>, f: (typeof EXTRACTION_EVAL_FIELDS)[number]) => s.fields[f];

test('normalizers', () => {
  assert.equal(normalizeText(undefined), '');
  assert.equal(normalizeText('Café  Été!'), 'cafe ete');
  assert.equal(normalizeTime('9:05'), '09:05');
  assert.equal(normalizeTime(undefined), '');
  assert.equal(normalizeTime(' Malam '), 'malam');
  assert.equal(normalizeDate('2026-03-01T10:00'), '2026-03-01');
  assert.equal(normalizeDate(undefined), '');
  assert.equal(digitsOnly('Rp 150.000'), '150000');
  assert.equal(digitsOnly(undefined), '');
  assert.ok(locationMatches('Kelapa Gading', 'Mall X, Kelapa Gading, Jakarta'));
  assert.ok(!locationMatches('Sony Center Kelapa Gading', 'Indonesia'));
  assert.ok(!locationMatches('', 'x'));
  assert.ok(!locationMatches('x', undefined));
  assert.ok(nameMatches('Jakarta Fun Run', 'Jakarta Fun Run 2026'));
  assert.ok(!nameMatches('', 'x'));
  assert.ok(!nameMatches('a b', undefined));
  assert.ok(!nameMatches('Alpha', 'Beta'));
});

test('perfect run: every applicable field is 100%', () => {
  const s = scoreRun(single, perfect);
  for (const f of EXTRACTION_EVAL_FIELDS) assert.equal(val(s, f), 1, f);
  assert.equal(s.countMismatch, false);
  assert.deepEqual(s.extras, []);
  assert.deepEqual(s.missing, []);
});

test('fields the label does not ask for are n/a, not zero', () => {
  const bare: LabelledPost = { ...single, groupingReason: undefined, events: [{ eventName: 'Contoh Festival', schedules: [{ eventStartDate: '2026-03-01' }] }] };
  const s = scoreRun(bare, { isEvent: true, events: [{ eventName: 'Contoh Festival', schedules: [sched('2026-03-01')] }] });
  for (const f of ['groupingReason', 'endDate', 'startTime', 'endTime', 'location', 'ticket', 'categoriesPrecision', 'categoriesRecall', 'performers'] as const) {
    assert.equal(val(s, f), null, f);
  }
  assert.equal(val(s, 'startDate'), 1);
});

test('wrong values score 0 per field', () => {
  const s = scoreRun(single, {
    isEvent: true,
    groupingReason: 'roundup',
    events: [
      {
        eventName: 'Contoh Festival',
        categories: ['SPORT'],
        schedules: [{ ...sched('2026-03-01'), eventEndDate: '2026-03-09', eventStartTime: '20:00', eventEndTime: '23:00', ticketPrice: '99000', performers: ['Nobody'], location: 'Indonesia' }],
      },
    ],
  });
  for (const f of ['groupingReason', 'endDate', 'startTime', 'endTime', 'location', 'ticket', 'categoriesPrecision', 'categoriesRecall', 'performers'] as const) {
    assert.equal(val(s, f), 0, f);
  }
  assert.equal(val(s, 'startDate'), 1);
});

test('hand calculation: partial categories and performers', () => {
  const s = scoreRun(single, {
    isEvent: true,
    groupingReason: 'single-event',
    events: [{ eventName: 'Contoh Festival', categories: ['MUSIC', 'SPORT'], location: 'Lapangan Contoh Jakarta', schedules: [{ ...sched('2026-03-01'), performers: ['Band A'] }] }],
  });
  assert.equal(val(s, 'categoriesPrecision'), 0.5);
  assert.equal(val(s, 'categoriesRecall'), 0.5);
  assert.equal(val(s, 'performers'), 0.5);
  assert.equal(val(s, 'ticket'), 0);
});

test('free events, model without categories, and event-level location from a schedule', () => {
  const freePost: LabelledPost = {
    ...single,
    events: [{ eventName: 'Gratis', free: true, categories: [], location: 'Taman Contoh', schedules: [{ eventStartDate: '2026-03-01' }] }],
  };
  const ok = scoreRun(freePost, { isEvent: true, groupingReason: 'single-event', events: [{ eventName: 'Gratis', schedules: [{ ...sched('2026-03-01'), ticketPrice: 'Gratis', location: 'Taman Contoh' }, sched('2026-03-01')] }] });
  assert.equal(val(ok, 'ticket'), 1);
  assert.equal(val(ok, 'categoriesPrecision'), 1);
  assert.equal(val(ok, 'categoriesRecall'), null);
  assert.equal(val(ok, 'location'), 1);
  const priced = scoreRun(freePost, { isEvent: true, events: [{ eventName: 'Gratis', schedules: [{ ...sched('2026-03-01'), ticketPrice: 'Rp 50.000' }] }] });
  assert.equal(val(priced, 'ticket'), 0);
  const zero = scoreRun(freePost, { isEvent: true, events: [{ eventName: 'Gratis', schedules: [{ ...sched('2026-03-01'), ticketPrice: '0' }] }] });
  assert.equal(val(zero, 'ticket'), 1);
  const noCategories = scoreRun({ ...freePost, events: [{ ...freePost.events[0]!, categories: ['MUSIC'] }] }, { isEvent: true, events: [{ eventName: 'Gratis', schedules: [sched('2026-03-01')] }] });
  assert.equal(val(noCategories, 'categoriesPrecision'), 0);
  assert.equal(val(noCategories, 'location'), 0);
});

test('missing model schedule date counts as a start-date miss and skips the other schedule fields', () => {
  const s = scoreRun(single, { isEvent: true, groupingReason: 'single-event', events: [{ eventName: 'Contoh Festival', schedules: [sched('2026-04-01')] }] });
  assert.equal(val(s, 'startDate'), 0);
  assert.equal(val(s, 'endDate'), null);
  const none = scoreRun(single, { isEvent: true, events: [{ eventName: 'Contoh Festival' }] });
  assert.equal(val(none, 'startDate'), 0);
  assert.equal(val(none, 'ticket'), 0);
});

// Matrix row: split vs fold.
const sevenBranches: LabelledPost = {
  postId: 'seven',
  caption: 'Invented tournament at 7 branches',
  images: ['a.png'],
  publishedAt: '2026-01-01T00:00:00Z',
  groupingReason: 'separate-events',
  events: Array.from({ length: 7 }, (_, i) => ({
    eventName: `Turnamen Contoh Cabang ${i + 1}`,
    location: `Mall Contoh ${i + 1}`,
    schedules: [{ eventStartDate: '2026-05-10', location: `Mall Contoh ${i + 1}` }],
  })),
};

test('split vs fold: 7 labelled events vs 1 event with 7 schedules -> count_mismatch, per-event fields not zeroed', () => {
  const folded: ScorablePayload = {
    isEvent: true,
    groupingReason: 'single-event',
    events: [{ eventName: 'Turnamen Contoh', location: 'Indonesia', schedules: Array.from({ length: 7 }, () => sched('2026-05-10')) }],
  };
  const s = scoreRun(sevenBranches, folded);
  assert.equal(s.countMismatch, true);
  assert.equal(val(s, 'eventCount'), 0);
  assert.equal(val(s, 'groupingReason'), 0);
  // count_mismatch detail: the model event took the first branch by start date; the other six are listed as missing, by position and name.
  assert.deepEqual(s.missing.map((m) => m.index), [1, 2, 3, 4, 5, 6]);
  assert.equal(s.missing[0]?.name, 'Turnamen Contoh Cabang 2');
  assert.deepEqual(s.extras, []);
  assert.equal(val(s, 'eventName'), 1 / 7);
  // Only the one matched event is scored on its fields; the other six are not counted as zero.
  assert.equal(val(s, 'startDate'), 1);
  assert.equal(val(s, 'location'), 0);
  const split = scoreRun(sevenBranches, {
    isEvent: true,
    groupingReason: 'separate-events',
    events: sevenBranches.events.map((e) => ({ eventName: e.eventName, location: e.location, schedules: [sched('2026-05-10')] })),
  });
  assert.equal(split.countMismatch, false);
  assert.equal(val(split, 'location'), 1);
});

test('non-event post: no events labelled, model says not an event', () => {
  const none: LabelledPost = { ...single, groupingReason: undefined, events: [] };
  const s = scoreRun(none, { isEvent: false, events: [{ eventName: 'ignored', schedules: [] }] });
  assert.equal(val(s, 'eventCount'), 1);
  assert.equal(val(s, 'groupingReason'), null);
  const s2 = scoreRun(none, {});
  assert.equal(val(s2, 'eventCount'), 1);
  const wrong = scoreRun(none, { isEvent: true, events: [{ eventName: 'x' }] });
  assert.equal(val(wrong, 'eventCount'), 0);
  assert.deepEqual(wrong.extras, [{ name: 'x' }]);
});

test('event match: renamed event matches by earliest start date; extras are reported not scored', () => {
  const m = matchEvents(
    [{ eventName: 'Alpha Fest', schedules: [{ eventStartDate: '2026-02-01' }, { eventStartDate: '2026-01-05' }] }, { eventName: 'Beta', schedules: [{ eventStartDate: '2026-09-09' }] }, { eventName: 'Gamma', schedules: [{ eventStartDate: '' }] }, { eventName: 'Delta', schedules: [{ eventStartDate: '2026-07-07' }] }],
    [
      { eventName: 'Totally Renamed', schedules: [{ eventStartDate: '2026-01-05' }, { eventStartDate: '2026-03-01' }] },
      { eventName: 'beta!', schedules: [] },
      { eventName: 'Extra', schedules: [{ eventStartDate: '2026-12-12' }] },
      { eventName: 'No dates' },
    ]
  );
  assert.deepEqual(m.matches.map((x) => [x.labelled, x.model]).sort(), [[0, 0], [1, 1]]);
  assert.deepEqual(m.unmatchedLabelled, [2, 3]);
  assert.deepEqual(m.extraModel, [2, 3]);
  const s = scoreRun(
    { ...single, events: [{ eventName: 'Alpha Fest', schedules: [{ eventStartDate: '2026-01-05' }] }] },
    { isEvent: true, groupingReason: 'single-event', events: [{ eventName: 'Totally Renamed', schedules: [sched('2026-01-05')] }, { eventName: 'Surprise', schedules: [sched('2027-01-01')] }] }
  );
  assert.equal(val(s, 'eventName'), 0);
  assert.equal(val(s, 'startDate'), 1);
  assert.deepEqual(s.extras, [{ name: 'Surprise' }]);
  assert.equal(val(s, 'eventCount'), 0);
});

const parseJson = (text: string): ScorablePayload | undefined => {
  try {
    return JSON.parse(text) as ScorablePayload;
  } catch {
    return undefined;
  }
};

test('classifyRun: truncated and unavailable are their own outcomes and are never scored', () => {
  const ok = classifyRun(single, { postId: 'single', runIndex: 0, text: JSON.stringify(perfect), finishReason: 'STOP' }, parseJson);
  assert.equal(ok.outcome, 'ok');
  assert.equal(ok.score?.fields.eventName, 1);
  assert.equal(classifyRun(single, { postId: 'single', runIndex: 1, text: '{"isEvent": tr', finishReason: 'MAX_TOKENS' }, parseJson).outcome, 'truncated');
  assert.equal(classifyRun(single, { postId: 'single', runIndex: 2, text: '{"cut', finishReason: 'STOP' }, parseJson).outcome, 'truncated');
  assert.equal(classifyRun(single, { postId: 'single', runIndex: 3, unavailable: true }, parseJson).outcome, 'unavailable');
  assert.equal(classifyRun(single, { postId: 'single', runIndex: 4 }, parseJson).outcome, 'unavailable');
});

const field = (all: number | null, over: Partial<FieldScores> = {}): FieldScores =>
  ({ ...Object.fromEntries(EXTRACTION_EVAL_FIELDS.map((f) => [f, all])), ...over }) as unknown as FieldScores;
const okRun = (postId: string, runIndex: number, over: Partial<FieldScores>, mismatch = false, detail: { missing?: MissingEvent[]; extras?: ExtraEvent[] } = {}): RunResult => ({
  postId,
  runIndex,
  outcome: 'ok',
  score: { fields: field(1, over), countMismatch: mismatch, missing: detail.missing ?? [], extras: detail.extras ?? [] },
});

test('aggregate: truncated and unavailable runs never lower a pass-rate', () => {
  const agg = aggregateRuns([
    okRun('p1', 0, { eventName: 1 }),
    okRun('p1', 1, { eventName: 0 }, true),
    { postId: 'p1', runIndex: 2, outcome: 'truncated' },
    { postId: 'p1', runIndex: 3, outcome: 'unavailable' },
    okRun('p2', 0, { eventName: 1, performers: null }),
  ]);
  assert.equal(agg.posts.p1!.fields.eventName, 0.5);
  assert.equal(agg.posts.p1!.okRuns, 2);
  assert.equal(agg.posts.p1!.truncatedRuns, 1);
  assert.equal(agg.posts.p1!.unavailableRuns, 1);
  assert.equal(agg.posts.p1!.countMismatchRuns, 1);
  assert.equal(agg.posts.p2!.fields.performers, null);
  assert.equal(agg.fields.eventName, 0.75);
  assert.equal(agg.fields.performers, 1);
  assert.deepEqual(agg.totals, { ok: 3, truncated: 1, unavailable: 1, countMismatch: 1 });
  // Run indexes 0-3 exist but no post answered all four, so there is no series that is free of who-answered artefacts.
  assert.deepEqual(agg.fieldRunMeans.eventName, []);
  const empty = aggregateRuns([{ postId: 'x', runIndex: 0, outcome: 'truncated' }]);
  assert.equal(empty.fields.eventName, null);
  assert.deepEqual(empty.fieldRunMeans.eventName, []);
  assert.equal(aggregateRuns([]).totals.ok, 0);
});

test('noise band: spread of the repeats with a floor', () => {
  assert.equal(sampleStdDev([1]), 0);
  assert.ok(Math.abs(sampleStdDev([1, 1, 0]) - 0.57735) < 1e-4);
  assert.equal(noiseBand([1, 1, 1]), 0.15);
  assert.equal(noiseBand([1, 1, 1], 0.3), 0.3);
  // Capped: 2 sd of [1, 0, 1] is 1.15, which no drop could exceed; the cap keeps a collapse of more than half flaggable.
  assert.equal(noiseBand([1, 0, 1]), MAX_NOISE_BAND);
  // A floor set above the cap still wins: the floor is the user's choice.
  assert.equal(noiseBand([1, 0, 1], 0.6), 0.6);
});

test('noise band: posts that missed some runs do not inflate it, and runs line up by their real index', () => {
  // A answers all three runs with ticket 1. B answers only run 0 (ticket 0), run 1 truncated, run 2 unavailable.
  // Lined up by position the cross-post means would be [0.5, 1, 1], an artefact of who answered, not model noise.
  const runs: RunResult[] = [
    okRun('A', 0, {}), okRun('A', 1, {}), okRun('A', 2, {}),
    okRun('B', 0, { ticket: 0 }), { postId: 'B', runIndex: 1, outcome: 'truncated' }, { postId: 'B', runIndex: 2, outcome: 'unavailable' },
  ];
  const agg = aggregateRuns(runs);
  assert.deepEqual(agg.fieldRunMeans.ticket, [1, 1, 1]);
  const base = baselineOf([okRun('A', 0, {})]);
  assert.equal(compareToBaseline(agg, base).fields.find((f) => f.field === 'ticket')?.band, 0.15);
  // Run 1 of post C is missing but its run 2 is not: run 2 is compared with run 2 of the other post, not with its own run 1.
  const gap = aggregateRuns([okRun('D', 0, {}), okRun('D', 1, { ticket: 0 }), okRun('D', 2, {}), okRun('C', 0, {}), { postId: 'C', runIndex: 1, outcome: 'truncated' }, okRun('C', 2, {})]);
  assert.deepEqual(gap.fieldRunMeans.ticket, [1, 0, 1]);
  // No post answered every run: no series, so the band is the floor and the field is simply not flagged on noise.
  const none = aggregateRuns([okRun('X', 0, {}), { postId: 'X', runIndex: 1, outcome: 'truncated' }, { postId: 'Y', runIndex: 0, outcome: 'truncated' }, okRun('Y', 1, {})]);
  assert.deepEqual(none.fieldRunMeans.ticket, []);
  // A field that does not apply to a post (null) is left out of that run's mean.
  const na = aggregateRuns([okRun('N', 0, { endDate: null }), okRun('N', 1, { endDate: null }), okRun('M', 0, { endDate: 1 }), okRun('M', 1, { endDate: 0 })]);
  assert.deepEqual(na.fieldRunMeans.endDate, [1, 0]);
});

test('ticket: a label without a price is not scored, a free label needs a schedule to be free', () => {
  const tba: LabelledPost = { ...single, events: [{ eventName: 'Contoh Festival', ticketPrice: 'TBA', schedules: [{ eventStartDate: '2026-03-01' }] }] };
  assert.equal(val(scoreRun(tba, { isEvent: true, events: [{ eventName: 'Contoh Festival', schedules: [sched('2026-03-01')] }] }), 'ticket'), null);
  const free: LabelledPost = { ...single, events: [{ eventName: 'Gratis', free: true, schedules: [{ eventStartDate: '2026-03-01' }] }] };
  assert.equal(val(scoreRun(free, { isEvent: true, events: [{ eventName: 'Gratis', schedules: [] }] }), 'ticket'), 0);
  assert.equal(val(scoreRun(free, { isEvent: true, events: [{ eventName: 'Gratis' }] }), 'ticket'), 0);
});

const baselineOf = (runs: RunResult[]): Baseline => buildBaseline(aggregateRuns(runs), { model: 'm', promptHash: 'h', date: '2026-11-11', runs: 3 });

test('noise row: a field flipping 2 of 3 at baseline and 1 of 3 now is not flagged', () => {
  const base = baselineOf([okRun('p', 0, { eventName: 1 }), okRun('p', 1, { eventName: 1 }), okRun('p', 2, { eventName: 0 })]);
  const now = aggregateRuns([okRun('p', 0, { eventName: 1 }), okRun('p', 1, { eventName: 0 }), okRun('p', 2, { eventName: 0 })]);
  const cmp = compareToBaseline(now, base);
  const row = cmp.fields.find((f) => f.field === 'eventName')!;
  assert.equal(row.status, 'ok');
  assert.deepEqual(cmp.newPosts, []);
});

test('real drop: flagged with the posts that changed; improvements, new fields and new posts are labelled', () => {
  const base = baselineOf([okRun('p1', 0, { performers: null }), okRun('p1', 1, { performers: null }), okRun('p1', 2, { performers: null }), okRun('p2', 0, { performers: null }), okRun('p2', 1, { performers: null }), okRun('p2', 2, { performers: null })]);
  const now = aggregateRuns([
    okRun('p1', 0, { eventName: 0, startDate: 1 }), okRun('p1', 1, { eventName: 0 }), okRun('p1', 2, { eventName: 0 }),
    okRun('p2', 0, { performers: 1 }), okRun('p2', 1, { performers: 1 }), okRun('p2', 2, { performers: 1 }),
    okRun('p3', 0, {}), okRun('p3', 1, {}), okRun('p3', 2, {}),
  ]);
  const cmp = compareToBaseline(now, base);
  const byField = (f: string) => cmp.fields.find((x) => x.field === f)!;
  assert.equal(byField('eventName').status, 'flagged');
  assert.deepEqual(byField('eventName').changedPosts.map((p) => p.postId), ['p1']);
  assert.equal(byField('performers').status, 'new');
  assert.equal(byField('startDate').status, 'ok');
  assert.deepEqual(cmp.newPosts, ['p3']);
  const better = compareToBaseline(aggregateRuns([okRun('p', 0, {}), okRun('p', 1, {}), okRun('p', 2, {})]), baselineOf([okRun('p', 0, { location: 0 }), okRun('p', 1, { location: 0 }), okRun('p', 2, { location: 0 })]));
  assert.equal(better.fields.find((f) => f.field === 'location')!.status, 'improved');
  const noData = compareToBaseline(aggregateRuns([okRun('p', 0, { location: null })]), base);
  assert.equal(noData.fields.find((f) => f.field === 'location')!.status, 'no_data');
});

test('report: table, outcomes, comparison and JSON', () => {
  const runs = [okRun('p1', 0, { eventName: 0 }, true), okRun('p1', 1, { eventName: 0 }), { postId: 'p1', runIndex: 2, outcome: 'truncated' as const }, { postId: 'p2', runIndex: 0, outcome: 'unavailable' as const }];
  const agg = aggregateRuns(runs);
  const base = baselineOf([okRun('p1', 0, {}), okRun('p1', 1, {}), okRun('p9', 0, {})]);
  const withCmp = buildReport(agg, { model: 'm', promptHash: 'h', runs: 3, mode: 'replay' }, base, compareToBaseline(agg, base));
  assert.match(withCmp.markdown, /\| eventName \| 0% \| 100% \| -100 \|/);
  assert.match(withCmp.markdown, /flagged/);
  assert.match(withCmp.markdown, /count_mismatch 1\/2, truncated 1/);
  assert.match(withCmp.markdown, /`p2`: unavailable 1/);
  assert.match(withCmp.markdown, /\*\*eventName\*\* dropped -100 pts/);
  assert.match(withCmp.markdown, /New posts/);
  assert.equal(withCmp.json.baseline?.date, '2026-11-11');
  assert.equal(withCmp.json.totals.truncated, 1);
  // Clean comparison, and a flagged field with no individually changed post, and no baseline at all.
  const same = aggregateRuns([okRun('p', 0, {}), okRun('p', 1, {})]);
  const sameBase = baselineOf([okRun('p', 0, {})]);
  assert.match(buildReport(same, { model: 'm', promptHash: 'h', runs: 2, mode: 'live' }, sameBase, compareToBaseline(same, sameBase)).markdown, /No field dropped beyond its noise band/);
  const plain = buildReport(same, { model: 'm', promptHash: 'h', runs: 2, mode: 'live' }, null, null);
  assert.match(plain.markdown, /No baseline to compare with/);
  assert.equal(plain.json.comparison, null);
  assert.equal(plain.json.baseline, null);
  assert.match(plain.markdown, /\| eventName \| 100% \|/);
  const none = aggregateRuns([{ postId: 'q', runIndex: 0, outcome: 'unavailable' }]);
  assert.match(buildReport(none, { model: 'm', promptHash: 'h', runs: 1, mode: 'live' }, null, null).markdown, /n\/a/);
});

test('a model event with no name is an extra with an empty name', () => {
  const s = scoreRun(single, { ...perfect, events: [...(perfect.events ?? []), { schedules: [] }] });
  assert.deepEqual(s.extras, [{ name: '' }]);
});

// count_mismatch detail: which labelled events were never matched and what the model added, over the repeats of a post.
const detailRuns = (): RunResult[] => [
  okRun('p', 0, { eventName: 0.5 }, true, { missing: [{ index: 3, name: 'Beta Fest' }, { index: 1, name: 'Alpha Fest' }], extras: [{ name: 'Zed' }, { name: 'Ada' }] }),
  okRun('p', 1, { eventName: 0.5 }, true, { missing: [{ index: 3, name: 'Beta Fest' }], extras: [{ name: 'Zed' }] }),
  okRun('p', 2, {}, false),
  okRun('only-extra', 0, {}, false, { extras: [{ name: 'Surprise' }] }),
];

test('aggregate tallies missing labelled events and extra model events per post, sorted', () => {
  const p = aggregateRuns(detailRuns()).posts.p!;
  assert.deepEqual(p.missing, [{ index: 1, name: 'Alpha Fest', runs: 1 }, { index: 3, name: 'Beta Fest', runs: 2 }]);
  // Most runs first, then by name.
  assert.deepEqual(p.extras, [{ name: 'Zed', runs: 2 }, { name: 'Ada', runs: 1 }]);
  // Equal run counts fall back to the name, so the report order is stable.
  const tie = aggregateRuns([okRun('t', 0, {}, false, { extras: [{ name: 'Zed' }, { name: 'Ada' }] })]).posts.t!;
  assert.deepEqual(tie.extras.map((e) => e.name), ['Ada', 'Zed']);
});

test('report lists the unmatched labelled events and the extra model events without names by default', () => {
  const md = buildReport(aggregateRuns(detailRuns()), { model: 'm', promptHash: 'h', runs: 3, mode: 'live' }, null, null);
  assert.match(md.markdown, /- `p`: count_mismatch 2\/3\n {2}- Labelled events missing \(runs missed of 3\): #2 1\/3, #4 2\/3\n {2}- Extra model events \(reported, not scored\): 3\n/);
  // A post whose only finding is an extra event is still listed.
  assert.match(md.markdown, /- `only-extra`: unmatched events\n {2}- Extra model events \(reported, not scored\): 1\n/);
  assert.doesNotMatch(md.markdown, /Alpha|Beta|Zed|Surprise/);
  // The JSON report hides names too: it can end up in a public job summary or a log.
  assert.equal(md.json.posts.p?.missing[0]?.name, '(hidden)');
  assert.equal(md.json.posts.p?.extras[0]?.name, '(hidden)');
  assert.equal(md.json.posts.p?.missing[0]?.index, 1);
});

test('report shows names only when asked', () => {
  const named = buildReport(aggregateRuns(detailRuns()), { model: 'm', promptHash: 'h', runs: 3, mode: 'live' }, null, null, { showNames: true });
  assert.match(named.markdown, /#2 "Alpha Fest" 1\/3, #4 "Beta Fest" 2\/3/);
  assert.match(named.markdown, /: 3 \("Zed" in 2 run\(s\), "Ada" in 1 run\(s\)\)/);
  assert.equal(named.json.posts.p?.missing[0]?.name, 'Alpha Fest');
});

test('report shows a positive delta with a plus sign', () => {
  const base = baselineOf([okRun('p', 0, { location: 0 })]);
  const agg = aggregateRuns([okRun('p', 0, {})]);
  assert.match(buildReport(agg, { model: 'm', promptHash: 'h', runs: 1, mode: 'live' }, base, compareToBaseline(agg, base)).markdown, /\| location \| 100% \| 0% \| \+100 \|/);
});

test('report shows an empty delta for a field new to the baseline', () => {
  const base = baselineOf([okRun('p', 0, { performers: null })]);
  const agg = aggregateRuns([okRun('p', 0, {})]);
  assert.match(buildReport(agg, { model: 'm', promptHash: 'h', runs: 1, mode: 'live' }, base, compareToBaseline(agg, base)).markdown, /\| performers \| 100% \| n\/a \| {2}\|/);
});

test('report lists a flagged field even when no single post moved beyond its own band', () => {
  const base = baselineOf([okRun('a', 0, {}), okRun('b', 0, {})]);
  const agg = aggregateRuns([okRun('a', 0, { location: 0.8 }), okRun('b', 0, { location: 0.8 })]);
  const real = compareToBaseline(agg, base);
  const cmp = { ...real, fields: real.fields.map((f) => (f.field === 'location' ? { ...f, status: 'flagged' as const, delta: -0.2, changedPosts: [] } : f)) };
  assert.match(buildReport(agg, { model: 'm', promptHash: 'h', runs: 1, mode: 'live' }, base, cmp).markdown, /none individually beyond their own band/);
});

// Review items 1, 3 and the single-run caveat: what the baseline comparison does and does not say.
const reportOf = (agg: ReturnType<typeof aggregateRuns>, base: Baseline | null, floor?: number): string => {
  const cmp = base ? compareToBaseline(agg, base, floor) : null;
  return buildReport(agg, { model: 'm', promptHash: 'h', runs: 3, mode: 'live' }, base, cmp).markdown;
};
const threeRuns = (postId: string, over: Partial<FieldScores> = {}): RunResult[] => [0, 1, 2].map((i) => okRun(postId, i, over));

test('baseline: a post added since the baseline is reported as new and cannot flag a field', () => {
  const base = baselineOf(threeRuns('a'));
  const now = aggregateRuns([...threeRuns('a'), ...threeRuns('new', { eventName: 0 })]);
  const cmp = compareToBaseline(now, base);
  assert.equal(cmp.fields.find((f) => f.field === 'eventName')?.status, 'ok');
  assert.deepEqual(cmp.newPosts, ['new']);
  assert.deepEqual(cmp.comparedPosts, ['a']);
  assert.deepEqual(cmp.removedPosts, []);
  // The table still shows the whole run's pass-rate; the delta is over the posts present on both sides.
  assert.match(reportOf(now, base), /\| eventName \| 50% \| 100% \| \+0 \|/);
  assert.match(reportOf(now, base), /over the 1 post\(s\) present in both/);
  assert.match(reportOf(now, base), /New posts \(no baseline, not compared\): `new`/);
});

test('baseline: a post removed since the baseline is reported and cannot improve or flag a field', () => {
  const base = baselineOf([...threeRuns('a'), ...threeRuns('b', { eventName: 0 })]);
  const now = aggregateRuns(threeRuns('a'));
  const cmp = compareToBaseline(now, base);
  assert.equal(cmp.fields.find((f) => f.field === 'eventName')?.status, 'ok');
  assert.deepEqual(cmp.removedPosts, ['b']);
  assert.match(reportOf(now, base), /Posts in the baseline but not in this run \(not compared\): `b`/);
});

test('baseline: no post in common compares nothing; a field with no value on the common posts is new', () => {
  const base = baselineOf(threeRuns('a'));
  const apart = compareToBaseline(aggregateRuns(threeRuns('z')), base);
  assert.deepEqual(apart.comparedPosts, []);
  assert.ok(apart.fields.every((f) => f.status === 'new'));
  // The common post has no value for the field now, while a new post does: nothing to pair.
  const mixed = compareToBaseline(aggregateRuns([...threeRuns('a', { performers: null }), ...threeRuns('n', { performers: 1 })]), base);
  assert.equal(mixed.fields.find((f) => f.field === 'performers')?.status, 'new');
});

test('report: a run with no scorable answer says no field had data instead of "nothing dropped"', () => {
  const base = { ...baselineOf(threeRuns('a')), truncatedRate: 0 };
  const allTruncated = aggregateRuns([0, 1, 2].map((i) => ({ postId: 'a', runIndex: i, outcome: 'truncated' as const })));
  const md = reportOf(allTruncated, base);
  assert.match(md, /No field had data/);
  assert.doesNotMatch(md, /No field dropped/);
  // Output that stopped being valid is the one thing that run did show: 100% of the answered runs.
  assert.match(md, /Truncated or invalid answers rose\*\* from 0% to 100%/);
});

test('truncated rate: compared with the baseline, flagged on a rise beyond the floor', () => {
  const base = { ...baselineOf(threeRuns('a')), truncatedRate: 0.1 };
  const mk = (truncated: number): RunResult[] => [...threeRuns('a').slice(0, 3 - truncated), ...Array.from({ length: truncated }, (_, i) => ({ postId: 'a', runIndex: 3 - truncated + i, outcome: 'truncated' as const }))];
  assert.equal(compareToBaseline(aggregateRuns(mk(0)), base).truncatedRate.status, 'ok');
  const rose = compareToBaseline(aggregateRuns(mk(2)), base).truncatedRate;
  assert.equal(rose.status, 'flagged');
  assert.ok(Math.abs(rose.current! - 2 / 3) < 1e-9);
  assert.match(reportOf(aggregateRuns(mk(0)), base), /Truncated or invalid answers: 0% of the answered runs \(baseline 10%\)/);
  // A baseline written before the rate was recorded, and a run nothing answered.
  const old: Baseline = { ...base };
  delete old.truncatedRate;
  assert.equal(compareToBaseline(aggregateRuns(mk(1)), old).truncatedRate.status, 'no_baseline');
  assert.match(reportOf(aggregateRuns(mk(1)), old), /does not record a rate/);
  const none = compareToBaseline(aggregateRuns([{ postId: 'a', runIndex: 0, outcome: 'unavailable' }]), base).truncatedRate;
  assert.deepEqual(none, { current: null, baseline: 0.1, delta: null, status: 'no_data' });
  assert.doesNotMatch(reportOf(aggregateRuns([{ postId: 'a', runIndex: 0, outcome: 'unavailable' }]), base), /Truncated or invalid answers/);
});

test('baseline: a hand-edited baseline with no entry for a field compares as no data, not as a crash', () => {
  const partial = parseBaseline({ fields: {}, posts: {}, runs: 1 }, 'b.json');
  const cmp = compareToBaseline(aggregateRuns([{ postId: 'a', runIndex: 0, outcome: 'unavailable' }]), partial);
  assert.deepEqual(cmp.fields.map((f) => [f.status, f.baseline]), EXTRACTION_EVAL_FIELDS.map(() => ['no_data', null]));
});

test('buildBaseline records the truncated rate, and omits it when no run answered', () => {
  assert.equal(baselineOf([...threeRuns('a'), { postId: 'a', runIndex: 3, outcome: 'truncated' }]).truncatedRate, 0.25);
  assert.equal('truncatedRate' in buildBaseline(aggregateRuns([{ postId: 'a', runIndex: 0, outcome: 'unavailable' }]), { model: 'm', promptHash: 'h', date: 'd', runs: 1 }), false);
  assert.equal(parseBaseline({ fields: {}, posts: {}, runs: 1, truncatedRate: 0.1 }, 'b.json').truncatedRate, 0.1);
  assert.throws(() => parseBaseline({ fields: {}, posts: {}, runs: 1, truncatedRate: 2 }, 'b.json'), /b\.json: baseline truncatedRate must be a number between 0 and 1/);
  assert.throws(() => parseBaseline({ fields: {}, posts: {}, runs: 1, truncatedRate: 'x' }, 'b.json'), /truncatedRate/);
});

test('single run: a drop beyond the floor is not flagged, with a caveat in the report', () => {
  const base = baselineOf([okRun('a', 0, {})]);
  const one = aggregateRuns([okRun('a', 0, { eventName: 0 })]);
  assert.equal(one.runCount, 1);
  assert.equal(compareToBaseline(one, base).fields.find((f) => f.field === 'eventName')?.status, 'single_run');
  assert.match(reportOf(one, base), /Only one run per post, so a drop cannot be told from noise and these fields are not flagged: eventName \(-100 pts\)\. Use `--runs 3` or more\./);
  assert.doesNotMatch(reportOf(one, base), /No field dropped/);
  const three = aggregateRuns(threeRuns('a', { eventName: 0 }));
  assert.equal(three.runCount, 3);
  assert.equal(compareToBaseline(three, baselineOf(threeRuns('a'))).fields.find((f) => f.field === 'eventName')?.status, 'flagged');
});

test('noise series: a post missing a field in some run is left out of that field altogether', () => {
  // A has no start-date score in run 1 (nothing matched). Averaging the runs that did score would let A's 0 swing the mean.
  const runs = [okRun('A', 0, { startDate: 0 }), okRun('A', 1, { startDate: null }), okRun('A', 2, { startDate: 0 }), ...threeRuns('B')];
  assert.deepEqual(aggregateRuns(runs).fieldRunMeans.startDate, [1, 1, 1]);
  // Every post has a gap in some run: the field has no series, so its band is the floor.
  assert.deepEqual(aggregateRuns([okRun('A', 0, { startDate: null }), okRun('A', 1, {})]).fieldRunMeans.startDate, []);
});

test('event match: same-name events are paired by their start date, not by the order the model returns them', () => {
  const twoWorkshops: LabelledPost = { ...single, groupingReason: 'separate-events', events: [
    { eventName: 'Workshop', schedules: [{ eventStartDate: '2026-05-01' }] },
    { eventName: 'Workshop', schedules: [{ eventStartDate: '2026-05-02' }] },
  ] };
  const swapped: ScorablePayload = { isEvent: true, groupingReason: 'separate-events', events: [
    { eventName: 'Workshop', schedules: [sched('2026-05-02')] },
    { eventName: 'Workshop', schedules: [sched('2026-05-01')] },
  ] };
  const s = scoreRun(twoWorkshops, swapped);
  assert.equal(val(s, 'startDate'), 1);
  assert.equal(val(s, 'eventName'), 1);
  assert.deepEqual(matchEvents(twoWorkshops.events, swapped.events!).matches.map((m) => [m.labelled, m.model]).sort(), [[0, 1], [1, 0]]);
  // The model gets one date wrong: the name still pairs them (pass 2), and the date is a miss, not a wrong pairing.
  const wrongDate = scoreRun(twoWorkshops, { ...swapped, events: [{ eventName: 'Workshop', schedules: [sched('2026-05-01')] }, { eventName: 'Workshop', schedules: [sched('2026-06-09')] }] });
  assert.equal(val(wrongDate, 'startDate'), 0.5);
});

test('ticket: only an explicit free word, a zero price or no price at all counts as free', () => {
  const free: LabelledPost = { ...single, events: [{ eventName: 'Gratis', free: true, schedules: [{ eventStartDate: '2026-03-01' }] }] };
  const ticket = (price: string | undefined): number | null => val(scoreRun(free, { isEvent: true, events: [{ eventName: 'Gratis', schedules: [{ ...sched('2026-03-01'), ...(price === undefined ? {} : { ticketPrice: price }) }] }] }), 'ticket');
  for (const price of ['Gratis', 'FREE entry', '0', 'Rp 0', undefined]) assert.equal(ticket(price), 1, String(price));
  for (const price of ['TBA', 'Info via DM', 'Rp 50.000']) assert.equal(ticket(price), 0, price);
});

test('names: whole words only, and names in any script do not collapse to an empty string', () => {
  assert.equal(nameMatches('Fest', 'Festival Jazz Night'), false);
  assert.equal(nameMatches('Festival Jazz', 'Festival Jazz Night'), true);
  assert.notEqual(normalizeText('音楽祭 2026'), '');
  assert.equal(nameMatches('音楽祭', 'ロック祭'), false);
  assert.equal(nameMatches('音楽祭', '音楽祭'), true);
  assert.equal(normalizeText('Café, Jazz!'), 'cafe jazz');
});

test('parseLabelledPost validates at load and names every problem', () => {
  const good = { postId: 'ok_1', caption: 'x', images: ['a.png'], publishedAt: '2026-01-01T00:00:00Z', events: [{ eventName: 'E', schedules: [{ eventStartDate: '2026-01-01' }] }] };
  assert.equal(parseLabelledPost(good, 'f.json').postId, 'ok_1');
  assert.equal(parseLabelledPost({ ...good, events: [] }, 'f.json').events.length, 0);
  assert.equal(parseLabelledPost({ ...good, events: [{ eventName: 'E', schedules: [{ eventStartDate: '2026-01-01', eventEndDate: '2026-01-02' }] }] }, 'f.json').events.length, 1);
  assert.throws(
    () => parseLabelledPost({ ...good, events: [{ eventName: 'E', ticketPrice: 'TBA', schedules: [{ eventStartDate: '2026-01-01' }] }] }, 'f.json'),
    /events\[0\]\.ticketPrice must contain a digit/
  );
  assert.throws(() => parseLabelledPost([], 'f.json'), /f\.json: label must be a JSON object/);
  assert.throws(() => parseLabelledPost({}, 'f.json'), /postId.*caption.*images.*publishedAt.*events/);
  assert.throws(() => parseLabelledPost({ ...good, images: ['../x.png'], publishedAt: 'nope', ownerUsername: 1, groupingReason: 2 }, 'f'), /plain file names.*ISO.*ownerUsername.*groupingReason/);
  assert.throws(() => parseLabelledPost({ ...good, events: [1, { eventName: ' ', schedules: [] }] }, 'f'), /events\[0\] must be an object.*eventName.*non-empty array/);
  assert.throws(
    () =>
      parseLabelledPost(
        { ...good, events: [{ eventName: 'E', schedules: [3, { eventStartDate: '1/1', eventEndDate: 5, eventStartTime: 1 }], location: 1, free: 'y', categories: [1], performers: 'p' }] },
        'f'
      ),
    /schedules\[0\] must be an object.*eventStartDate must be YYYY-MM-DD.*eventEndDate must be YYYY-MM-DD.*eventStartTime must be a string.*location.*free.*categories.*performers/
  );
});

test('parseRecordedOutputs and parseBaseline validate shape', () => {
  const rec = { model: 'm', promptHash: 'h', recordedAt: 'd', runs: [{ postId: 'p', runIndex: 0 }] };
  assert.equal(parseRecordedOutputs(rec, 'r').runs.length, 1);
  assert.throws(() => parseRecordedOutputs({}, 'r.json'), /r\.json: recorded outputs need/);
  assert.throws(() => parseRecordedOutputs({ ...rec, runs: [{ postId: 'p' }] }, 'r.json'), /runs\[0\] needs postId and runIndex/);
  assert.throws(() => parseRecordedOutputs({ ...rec, runs: [null] }, 'r.json'), /runs\[0\]/);
  const base = { fields: {}, posts: {}, runs: 3 };
  assert.equal(parseBaseline(base, 'b').runs, 3);
  assert.throws(() => parseBaseline({}, 'b.json'), /b\.json: baseline needs/);
});
