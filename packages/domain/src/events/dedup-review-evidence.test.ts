import { test } from 'node:test';
import assert from 'node:assert';
import {
  DEDUP_REVIEW_DEFAULT_LIMIT,
  DEDUP_REVIEW_EXPORT_BEGIN,
  DEDUP_REVIEW_EXPORT_END,
  DEDUP_REVIEW_MAX_LIMIT,
  DEDUP_REVIEW_RECENT_LIMIT,
  DEDUP_REVIEW_MAX_SKIP_IDS,
  DedupReviewOptionsError,
  canonicalizeDedupEvidence,
  classifyDedupReviewResolvedBy,
  formatDedupReviewExport,
  parseDedupReviewOptions,
  toDedupReviewAccountType,
  toDedupReviewDayDiff,
  type DedupReviewEventEvidence,
  type DedupReviewExportReport,
  type DedupReviewPairEvidence,
} from './dedup-review-evidence.js';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

function eventEvidence(overrides: Partial<DedupReviewEventEvidence> = {}): DedupReviewEventEvidence {
  return {
    name: 'GembiRun Loka 2026',
    slug: 'ig_p_abc',
    location: 'Gelora Bung Karno',
    links: ['https://example.test/run'],
    detailLevel: 'full',
    categories: ['SPORTS_AND_FITNESS'],
    types: ['COMPETITION'],
    schedules: [
      { isMain: true, startDate: '2026-11-08', endDate: null, startTime: '06:00:00', endTime: null, timezone: 'Asia/Jakarta', title: 'Race day', location: null },
    ],
    sourcePosts: [{ isPrimary: true, accountType: 'ORGANIZER_VENUE_EVENT', publishedAt: '2026-10-01T00:00:00.000Z' }],
    ...overrides,
  };
}

function pairEvidence(overrides: Partial<DedupReviewPairEvidence> = {}): DedupReviewPairEvidence {
  return {
    suggestionId: ID_A,
    status: 'pending',
    storedScore: 0.6,
    signals: {
      tier: 'mid',
      scoredTier: 'mid',
      score: 0.6,
      promotedByRule: false,
      promotionRule: null,
      stubRepeat: false,
      venueMatch: false,
      nameSimilarity: 0.8,
      minDayDiff: 0,
      organizerMatch: true,
      sharedLink: false,
    },
    sameAccount: true,
    undoneMergeCount: 0,
    candidate: eventEvidence(),
    newEvent: eventEvidence({ slug: 'ig_p_def' }),
    ...overrides,
  };
}

test('toDedupReviewAccountType - keeps the three known types and maps anything else to UNCLASSIFIED', () => {
  assert.strictEqual(toDedupReviewAccountType('ORGANIZER_VENUE_EVENT'), 'ORGANIZER_VENUE_EVENT');
  assert.strictEqual(toDedupReviewAccountType('PERSONAL'), 'PERSONAL');
  assert.strictEqual(toDedupReviewAccountType('CURATOR_GUIDE'), 'CURATOR_GUIDE');
  assert.strictEqual(toDedupReviewAccountType(null), 'UNCLASSIFIED');
  assert.strictEqual(toDedupReviewAccountType(undefined), 'UNCLASSIFIED');
  assert.strictEqual(toDedupReviewAccountType('SOMETHING_NEW'), 'UNCLASSIFIED');
});

test('toDedupReviewAccountType - an AI-proposed type awaiting approval is not exported as a fact', () => {
  assert.strictEqual(toDedupReviewAccountType('PERSONAL', 'AWAITING_APPROVAL'), 'UNCLASSIFIED');
  assert.strictEqual(toDedupReviewAccountType('ORGANIZER_VENUE_EVENT', 'AWAITING_APPROVAL'), 'UNCLASSIFIED');
  assert.strictEqual(toDedupReviewAccountType('PERSONAL', 'CONFIRMED'), 'PERSONAL');
  assert.strictEqual(toDedupReviewAccountType('CURATOR_GUIDE', null), 'CURATOR_GUIDE');
  assert.strictEqual(toDedupReviewAccountType(null, 'CONFIRMED'), 'UNCLASSIFIED');
});

test('the recently-resolved cap is larger than the default export limit', () => {
  assert.ok(DEDUP_REVIEW_RECENT_LIMIT > DEDUP_REVIEW_MAX_LIMIT);
});

test('toDedupReviewDayDiff - finite numbers pass through and Infinity becomes null', () => {
  assert.strictEqual(toDedupReviewDayDiff(0), 0);
  assert.strictEqual(toDedupReviewDayDiff(2), 2);
  assert.strictEqual(toDedupReviewDayDiff(Infinity), null);
});

test('classifyDedupReviewResolvedBy - expiry is the system, and a moderator needs the reviewer id to be told apart', () => {
  assert.strictEqual(classifyDedupReviewResolvedBy({ status: 'expired', resolvedByModeratorId: null, reviewerUserId: null }), 'system');
  assert.strictEqual(classifyDedupReviewResolvedBy({ status: 'expired', resolvedByModeratorId: null, reviewerUserId: ID_A }), 'system');
  assert.strictEqual(classifyDedupReviewResolvedBy({ status: 'accepted', resolvedByModeratorId: null, reviewerUserId: ID_A }), 'unknown');
  assert.strictEqual(classifyDedupReviewResolvedBy({ status: 'accepted', resolvedByModeratorId: ID_A, reviewerUserId: null }), 'unknown');
  assert.strictEqual(classifyDedupReviewResolvedBy({ status: 'accepted', resolvedByModeratorId: ID_A, reviewerUserId: ID_A }), 'reviewer');
  assert.strictEqual(classifyDedupReviewResolvedBy({ status: 'rejected', resolvedByModeratorId: ID_B, reviewerUserId: ID_A }), 'human');
});

test('canonicalizeDedupEvidence - identical evidence gives an identical string', () => {
  assert.strictEqual(canonicalizeDedupEvidence(pairEvidence()), canonicalizeDedupEvidence(pairEvidence()));
});

test('canonicalizeDedupEvidence - key order and array order do not matter', () => {
  const reordered = pairEvidence({
    candidate: eventEvidence({
      links: ['https://b.test', 'https://a.test'],
      categories: ['B', 'A', 'A'],
      schedules: [
        { isMain: false, startDate: '2026-11-09', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null },
        { isMain: true, startDate: '2026-11-08', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null },
      ],
    }),
  });
  const shuffled = JSON.parse(JSON.stringify(reordered)) as DedupReviewPairEvidence;
  shuffled.candidate.links.reverse();
  shuffled.candidate.categories.reverse();
  shuffled.candidate.schedules.reverse();
  const reversedKeys = Object.fromEntries(Object.entries(shuffled).reverse()) as unknown as DedupReviewPairEvidence;

  assert.strictEqual(canonicalizeDedupEvidence(reordered), canonicalizeDedupEvidence(reversedKeys));
});

test('canonicalizeDedupEvidence - every field a reviewer sees changes the string when it changes', () => {
  const base = canonicalizeDedupEvidence(pairEvidence());
  const changed: DedupReviewPairEvidence[] = [
    pairEvidence({ undoneMergeCount: 1 }),
    pairEvidence({ sameAccount: false }),
    pairEvidence({ storedScore: 0.61 }),
    pairEvidence({ signals: { ...pairEvidence().signals, minDayDiff: null } }),
    pairEvidence({ signals: { ...pairEvidence().signals, venueMatch: true } }),
    pairEvidence({ candidate: eventEvidence({ location: 'Elsewhere' }) }),
    pairEvidence({ newEvent: eventEvidence({ slug: 'ig_p_def', detailLevel: 'stub' }) }),
    pairEvidence({ newEvent: eventEvidence({ slug: 'ig_p_def', sourcePosts: [] }) }),
    pairEvidence({ candidate: eventEvidence({ links: [] }) }),
    pairEvidence({ suggestionId: ID_B }),
    pairEvidence({ signals: { ...pairEvidence().signals, scoredTier: 'low' } }),
    pairEvidence({ signals: { ...pairEvidence().signals, promotionRule: 'stub-repeat' } }),
    pairEvidence({ signals: { ...pairEvidence().signals, stubRepeat: true } }),
    pairEvidence({ signals: { ...pairEvidence().signals, nameSimilarity: 0.81 } }),
    pairEvidence({ signals: { ...pairEvidence().signals, organizerMatch: false } }),
    pairEvidence({ signals: { ...pairEvidence().signals, sharedLink: true } }),
    pairEvidence({ candidate: eventEvidence({ name: 'Another name' }) }),
    pairEvidence({ candidate: eventEvidence({ categories: ['MUSIC'] }) }),
    pairEvidence({ candidate: eventEvidence({ types: ['FESTIVAL'] }) }),
    pairEvidence({ candidate: eventEvidence({ schedules: [] }) }),
    pairEvidence({ newEvent: eventEvidence({ slug: 'ig_p_def', sourcePosts: [{ isPrimary: false, accountType: 'PERSONAL', publishedAt: null }] }) }),
  ];
  for (const evidence of changed) {
    assert.notStrictEqual(canonicalizeDedupEvidence(evidence), base);
  }
});

test('parseDedupReviewOptions - defaults when nothing is given', () => {
  assert.deepStrictEqual(parseDedupReviewOptions({}), { limit: DEDUP_REVIEW_DEFAULT_LIMIT, skipIds: [], runTag: null });
  assert.deepStrictEqual(parseDedupReviewOptions({ limit: null, skipIds: null, runTag: null }), {
    limit: DEDUP_REVIEW_DEFAULT_LIMIT,
    skipIds: [],
    runTag: null,
  });
  assert.deepStrictEqual(parseDedupReviewOptions({ limit: '  ', skipIds: ' , ', runTag: ' ' }), { limit: DEDUP_REVIEW_DEFAULT_LIMIT, skipIds: [], runTag: null });
});

test('parseDedupReviewOptions - accepts valid values, lower-cases and de-duplicates ids', () => {
  const parsed = parseDedupReviewOptions({
    limit: '12',
    skipIds: ` ${ID_A.toUpperCase()}, ${ID_B},${ID_A},`,
    runTag: 'daily-2026.10_31',
  });
  assert.deepStrictEqual(parsed, { limit: 12, skipIds: [ID_A, ID_B], runTag: 'daily-2026.10_31' });
  assert.strictEqual(parseDedupReviewOptions({ limit: String(DEDUP_REVIEW_MAX_LIMIT) }).limit, DEDUP_REVIEW_MAX_LIMIT);
  assert.strictEqual(parseDedupReviewOptions({ limit: '1' }).limit, 1);
});

test('parseDedupReviewOptions - rejects a bad limit and names the field without echoing the value', () => {
  for (const limit of ['0', '51', '-3', '2.5', 'abc', '10; rm -rf']) {
    assert.throws(() => parseDedupReviewOptions({ limit }), (err: unknown) => {
      assert.ok(err instanceof DedupReviewOptionsError);
      assert.match((err as Error).message, /^limit must be/);
      // Numeric values can appear in the message by accident ("1 to 50"); the untrusted text must not.
      if (/[a-z]/i.test(limit)) assert.ok(!(err as Error).message.includes(limit));
      return true;
    });
  }
});

test('parseDedupReviewOptions - rejects a bad id or too many ids', () => {
  assert.throws(() => parseDedupReviewOptions({ skipIds: `${ID_A},not-a-uuid` }), /skip_ids must be comma-separated suggestion uuids/);
  const many = Array.from({ length: DEDUP_REVIEW_MAX_SKIP_IDS + 1 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`).join(',');
  assert.throws(() => parseDedupReviewOptions({ skipIds: many }), /skip_ids must hold at most/);
  const exactly = many.split(',').slice(0, DEDUP_REVIEW_MAX_SKIP_IDS).join(',');
  assert.strictEqual(parseDedupReviewOptions({ skipIds: exactly }).skipIds.length, DEDUP_REVIEW_MAX_SKIP_IDS);
});

test('parseDedupReviewOptions - rejects a bad run tag', () => {
  for (const runTag of ['has space', 'semi;colon', 'x'.repeat(65), '$(whoami)', 'new\nline']) {
    assert.throws(() => parseDedupReviewOptions({ runTag }), (err: unknown) => {
      assert.ok(err instanceof DedupReviewOptionsError);
      assert.match((err as Error).message, /^run_tag must be/);
      assert.ok(!(err as Error).message.includes(runTag), 'the untrusted value is not echoed');
      return true;
    });
  }
  assert.strictEqual(parseDedupReviewOptions({ runTag: 'x'.repeat(64) }).runTag, 'x'.repeat(64));
});

test('formatDedupReviewExport - markers around exactly one JSON line, and a name cannot break out of it', () => {
  const report: DedupReviewExportReport = {
    schemaVersion: 1,
    generatedAt: '2026-10-31T00:00:00.000Z',
    runTag: null,
    limit: 30,
    totalPending: 1,
    staleCount: 0,
    skippedCount: 0,
    scanLimited: false,
    pairs: [{ ...pairEvidence({ candidate: eventEvidence({ name: 'Evil\n::set-output name=x::y\nEND' }) }), evidenceHash: 'abc' }],
    recentlyResolved: [],
    recentlyResolvedTruncated: false,
  };

  const lines = formatDedupReviewExport(report);

  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0], DEDUP_REVIEW_EXPORT_BEGIN);
  assert.strictEqual(lines[2], DEDUP_REVIEW_EXPORT_END);
  assert.ok(!lines[1].includes('\n'), 'the JSON is a single line');
  assert.ok(lines[1].startsWith('{'), 'a log line must not start with ::');
  assert.deepStrictEqual(JSON.parse(lines[1]), report);
});
