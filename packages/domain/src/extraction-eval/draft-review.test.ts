import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAFT_FLAGS,
  DRAFT_FLAG_HELP,
  MANY_SCHEDULES_ABOVE,
  POSSIBLE_MISS_MIN_IMAGES,
  REVIEW_STATUSES,
  draftFlags,
  nextPending,
  parseDraftMeta,
  parseProgress,
  prepareVerifiedLabel,
  progressSummary,
  setProgress,
  statusOf,
  type DraftMeta,
  type LabelledEvent,
  type LabelledPost,
  type ProgressRecord,
} from './index.js';

// All data below is INVENTED (the repository is public).
const event = (over: Partial<LabelledEvent> = {}): LabelledEvent => ({ eventName: 'Contoh', ticketPrice: '75000', schedules: [{ eventStartDate: '2026-03-01' }], ...over });
const post = (over: Partial<LabelledPost> = {}): LabelledPost => ({
  postId: 'p-0001',
  caption: 'Invented caption',
  images: ['cover.png'],
  publishedAt: '2026-02-20T08:00:00Z',
  groupingReason: 'single-event',
  events: [event()],
  ...over,
});
const images = (n: number): string[] => Array.from({ length: n }, (_, i) => (i === 0 ? 'cover.png' : `slide-${i + 1}.png`));

// ---- draft.json ----------------------------------------------------------------------------------------------------------

test('parseDraftMeta: a complete draft.json is read as it is', () => {
  const raw = { stratum: 'cursor-chain', sourcePostId: 'abc', postUrl: 'https://example.invalid/p/abc', extractedEventCount: 16, extractionAuditRows: 4, imagesAvailable: 12, imagesFetched: 12, extractedBeforeCursorPath: false, rescrape: { at: '2026-11-11' }, status: 'draft', extra: 'ignored' };
  const { meta, warnings } = parseDraftMeta(raw);
  assert.deepEqual(warnings, []);
  assert.deepEqual(meta, { stratum: 'cursor-chain', sourcePostId: 'abc', postUrl: 'https://example.invalid/p/abc', extractedEventCount: 16, extractionAuditRows: 4, imagesAvailable: 12, imagesFetched: 12, extractedBeforeCursorPath: false, rescrape: { at: '2026-11-11' }, status: 'draft' });
});

test('parseDraftMeta: missing fields are fine; wrong types are ignored with a warning that names the field, never the value', () => {
  assert.deepEqual(parseDraftMeta({}), { meta: {}, warnings: [] });
  const { meta, warnings } = parseDraftMeta({ stratum: 7, extractionAuditRows: -1, imagesFetched: Number.POSITIVE_INFINITY, extractedBeforeCursorPath: 'yes', postUrl: 'https://secret.invalid/x', status: 'draft' });
  // postUrl is a valid string, so it is kept; the three wrong ones are dropped.
  assert.deepEqual(meta, { postUrl: 'https://secret.invalid/x', status: 'draft' });
  assert.deepEqual(warnings, [
    'draft.json: stratum should be a string; ignored',
    'draft.json: extractionAuditRows should be a non-negative number; ignored',
    'draft.json: imagesFetched should be a non-negative number; ignored',
    'draft.json: extractedBeforeCursorPath should be a boolean; ignored',
  ]);
  assert.ok(warnings.every((w) => !w.includes('secret')));
});

test('parseDraftMeta: a file that is not an object gives an empty record and one warning', () => {
  for (const raw of [null, 'text', 5, [1, 2], undefined]) {
    const { meta, warnings } = parseDraftMeta(raw);
    assert.deepEqual(meta, {});
    assert.equal(warnings.length, 1);
  }
});

// ---- flags ---------------------------------------------------------------------------------------------------------------

test('flags: a non-event post with many images is a possible miss; with few images it is not', () => {
  assert.deepEqual(draftFlags(post({ events: [], images: images(POSSIBLE_MISS_MIN_IMAGES) }), {}), [{ flag: 'possible_miss', detail: `0 events, ${POSSIBLE_MISS_MIN_IMAGES} images` }]);
  assert.deepEqual(draftFlags(post({ events: [], images: images(POSSIBLE_MISS_MIN_IMAGES - 1) }), {}), []);
  // Many images but an event was found: not a miss.
  assert.deepEqual(draftFlags(post({ images: images(10) }), {}), []);
});

test('flags: a chain post (more than one extraction pass) and a post extracted before the cursor path', () => {
  assert.deepEqual(draftFlags(post(), { extractionAuditRows: 3 }), [{ flag: 'chain', detail: '3 extraction passes' }]);
  assert.deepEqual(draftFlags(post(), { extractionAuditRows: 1 }), []);
  assert.deepEqual(draftFlags(post(), {}), []);
  assert.deepEqual(draftFlags(post(), { extractedBeforeCursorPath: true }), [{ flag: 'before_cursor_path' }]);
  assert.deepEqual(draftFlags(post(), { extractedBeforeCursorPath: false }), []);
});

test('flags: more than 3 schedules on one event, reported by event position only', () => {
  const dates = (n: number): LabelledEvent['schedules'] => Array.from({ length: n }, (_, i) => ({ eventStartDate: `2026-03-0${i + 1}` }));
  const hits = draftFlags(post({ events: [event({ schedules: dates(MANY_SCHEDULES_ABOVE) }), event({ schedules: dates(MANY_SCHEDULES_ABOVE + 1) })] }), {});
  assert.deepEqual(hits, [{ flag: 'many_schedules', detail: 'event 2' }]);
});

test('flags: an event with no ticket price that is not marked free; free and priced events are fine', () => {
  const noPrice = { eventName: 'X', schedules: [{ eventStartDate: '2026-03-01' }] };
  assert.deepEqual(draftFlags(post({ events: [event(), { ...noPrice }, { ...noPrice, free: true }, { ...noPrice, free: false }] }), {}), [{ flag: 'price_missing', detail: 'event 2, 4' }]);
});

test('flags: a long list of positions is cut after ten', () => {
  const many = Array.from({ length: 12 }, () => ({ eventName: 'X', schedules: [{ eventStartDate: '2026-03-01' }] }));
  assert.deepEqual(draftFlags(post({ events: many }), {}), [{ flag: 'price_missing', detail: 'event 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 and 2 more' }]);
});

test('flags: every flag has help text, and several can fire together', () => {
  assert.deepEqual(Object.keys(DRAFT_FLAG_HELP).sort(), [...DRAFT_FLAGS].sort());
  const meta: DraftMeta = { extractionAuditRows: 2, extractedBeforeCursorPath: true };
  assert.deepEqual(draftFlags(post({ events: [], images: images(8) }), meta).map((h) => h.flag), ['possible_miss', 'chain', 'before_cursor_path']);
});

// ---- verifying -----------------------------------------------------------------------------------------------------------

test('prepareVerifiedLabel: the input of the extraction always comes from the draft, whatever the edit says', () => {
  const draft = post({ ownerUsername: 'invented_owner' });
  const edited = { postId: 'p-9999', caption: 'CHANGED', images: ['other.png'], publishedAt: '2030-01-01T00:00:00Z', ownerUsername: 'someone_else', groupingReason: 'program-lineup', events: [event({ eventName: 'Corrected name' })] };
  const out = prepareVerifiedLabel(edited, draft, 'test');
  assert.equal(out.postId, 'p-0001');
  assert.equal(out.caption, 'Invented caption');
  assert.deepEqual(out.images, ['cover.png']);
  assert.equal(out.publishedAt, '2026-02-20T08:00:00Z');
  assert.equal(out.ownerUsername, 'invented_owner');
  assert.equal(out.groupingReason, 'program-lineup');
  assert.equal(out.events[0]?.eventName, 'Corrected name');
  // A draft with no owner stays without one.
  assert.equal('ownerUsername' in prepareVerifiedLabel({ events: [event()] }, post(), 'test'), false);
});

test('prepareVerifiedLabel: text is trimmed, empty optional text is "not stated", empty lists are kept or cleaned as they should be', () => {
  const edited = {
    groupingReason: '  program-lineup ',
    events: [
      {
        eventName: '  Pasar Contoh  ',
        location: '   ',
        ticketPrice: '',
        free: false,
        categories: [' MUSIC ', '', 'FOOD_AND_DRINK'],
        performers: [],
        schedules: [{ eventStartDate: ' 2026-03-01 ', eventEndDate: '', eventStartTime: ' 19:00 ', eventEndTime: '', location: '' }],
      },
    ],
  };
  const e = prepareVerifiedLabel(edited, post(), 'test').events[0]!;
  assert.equal(e.eventName, 'Pasar Contoh');
  assert.equal('location' in e, false);
  assert.equal('ticketPrice' in e, false);
  assert.equal(e.free, false);
  assert.deepEqual(e.categories, ['MUSIC', 'FOOD_AND_DRINK']);
  assert.deepEqual(e.performers, []);
  assert.deepEqual(e.schedules, [{ eventStartDate: '2026-03-01', eventStartTime: '19:00' }]);
  assert.equal(prepareVerifiedLabel({ groupingReason: '  ', events: [] }, post(), 'test').groupingReason, undefined);
  assert.equal(prepareVerifiedLabel({ groupingReason: 5, events: [] }, post(), 'test').groupingReason, undefined);
});

test('prepareVerifiedLabel: what the runner would reject is rejected here, naming fields and never values', () => {
  const draft = post();
  assert.throws(() => prepareVerifiedLabel('nope', draft, 'f'), /f: the edited label must be a JSON object/);
  assert.throws(() => prepareVerifiedLabel({ groupingReason: 'secret-value', events: [event()] }, draft, 'f'), (err: Error) => /groupingReason must be one of single-event, program-lineup/.test(err.message) && !err.message.includes('secret-value'));
  assert.throws(() => prepareVerifiedLabel({ events: 'x' }, draft, 'f'), /events must be an array/);
  assert.throws(() => prepareVerifiedLabel({ events: [event({ ticketPrice: 'TBA' })] }, draft, 'f'), /events\[0\]\.ticketPrice must contain a digit/);
  assert.throws(() => prepareVerifiedLabel({ events: [event({ schedules: [{ eventStartDate: '1/3' }] })] }, draft, 'f'), /eventStartDate must be YYYY-MM-DD/);
  assert.throws(() => prepareVerifiedLabel({ events: [7, { eventName: 'X', schedules: [3] }, { eventName: 'Y', schedules: [], categories: 'MUSIC' }] }, draft, 'f'), /events\[0\] must be an object.*schedules\[0\] must be an object.*non-empty array.*categories/);
});

test('prepareVerifiedLabel: with the list of production categories, an unknown category is rejected (it could never match)', () => {
  const categories = ['MUSIC', 'FOOD_AND_DRINK'];
  assert.equal(prepareVerifiedLabel({ events: [event({ categories: ['MUSIC'] })] }, post(), 'f', { categories }).events[0]?.categories?.[0], 'MUSIC');
  assert.throws(() => prepareVerifiedLabel({ events: [event({ categories: ['MUSIC', 'MUSIK', 'PARTY'] })] }, post(), 'f', { categories }), (err: Error) => /events\[0\]\.categories has 2 value\(s\) that are not production categories/.test(err.message) && !err.message.includes('MUSIK'));
  // Events without a category list, and non-event entries, are left to the parser.
  assert.equal(prepareVerifiedLabel({ events: [event()] }, post(), 'f', { categories }).events.length, 1);
  assert.throws(() => prepareVerifiedLabel({ events: [4] }, post(), 'f', { categories }), /events\[0\] must be an object/);
  // A category that is not text is the parser's problem, not counted as unknown.
  assert.throws(() => prepareVerifiedLabel({ events: [event({ categories: [3 as unknown as string] })] }, post(), 'f', { categories }), /categories/);
});

// ---- progress ------------------------------------------------------------------------------------------------------------

test('parseProgress: nothing, a bad file, bad entries and good entries', () => {
  assert.deepEqual(parseProgress(undefined), { record: {}, warnings: [] });
  assert.deepEqual(parseProgress(null), { record: {}, warnings: [] });
  assert.equal(parseProgress([1]).warnings.length, 1);
  const raw = {
    'p-0001': { status: 'verified', at: '2026-11-12T08:00:00Z', note: 'checked twice' },
    'p-0002': { status: 'skipped', at: '2026-11-12T08:01:00Z', note: '' },
    'p-0003': { status: 'done', at: 'x' },
    'p-0004': 'text',
    'p-0005': { status: 'flagged', at: 5 },
    'p-0006': { status: 'flagged', at: '2026-11-12T08:02:00Z', note: 3 },
  };
  const { record, warnings } = parseProgress(raw);
  assert.deepEqual(Object.keys(record).sort(), ['p-0001', 'p-0002', 'p-0006']);
  assert.deepEqual(record['p-0001'], { status: 'verified', at: '2026-11-12T08:00:00Z', note: 'checked twice' });
  assert.equal('note' in record['p-0002']!, false);
  assert.equal('note' in record['p-0006']!, false);
  assert.deepEqual(warnings, ['progress.json: 3 entries not valid; ignored']);
  assert.deepEqual(parseProgress({ a: 1 }).warnings, ['progress.json: 1 entry not valid; ignored']);
  // Every entry valid: no warning at all.
  assert.deepEqual(parseProgress({ 'p-0001': { status: 'pending', at: 't' } }), { record: { 'p-0001': { status: 'pending', at: 't' } }, warnings: [] });
});

test('setProgress records a status without touching the old record, and trims or drops the note', () => {
  const before: ProgressRecord = { 'p-0001': { status: 'pending', at: 't0' } };
  const after = setProgress(before, 'p-0001', 'flagged', 't1', '  look again  ');
  assert.deepEqual(after['p-0001'], { status: 'flagged', at: 't1', note: 'look again' });
  assert.deepEqual(before['p-0001'], { status: 'pending', at: 't0' });
  assert.equal('note' in setProgress(before, 'p-0002', 'skipped', 't2', '   ')['p-0002']!, false);
  assert.equal('note' in setProgress(before, 'p-0002', 'skipped', 't2')['p-0002']!, false);
});

test('statusOf, progressSummary and nextPending', () => {
  assert.deepEqual([...REVIEW_STATUSES], ['pending', 'verified', 'skipped', 'flagged']);
  const ids = ['p-1', 'p-2', 'p-3', 'p-4'];
  let record: ProgressRecord = {};
  assert.equal(statusOf(record, 'p-1'), 'pending');
  record = setProgress(setProgress(record, 'p-1', 'verified', 't'), 'p-3', 'flagged', 't');
  assert.deepEqual(progressSummary(ids, record), { pending: 2, verified: 1, skipped: 0, flagged: 1 });
  assert.equal(nextPending(ids, record), 'p-2');
  assert.equal(nextPending(ids, record, 'p-2'), 'p-4');
  assert.equal(nextPending(ids, record, 'p-4'), 'p-2');
  record = setProgress(record, 'p-2', 'skipped', 't');
  // Only the current post is left pending: there is no OTHER pending post.
  assert.equal(nextPending(ids, record, 'p-4'), undefined);
  assert.equal(nextPending(ids, record), 'p-4');
  record = setProgress(record, 'p-4', 'verified', 't');
  assert.equal(nextPending(ids, record), undefined);
  assert.equal(nextPending([], {}), undefined);
});
