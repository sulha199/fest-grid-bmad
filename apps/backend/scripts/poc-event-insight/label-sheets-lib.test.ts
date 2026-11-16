import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adjudicationRows, cohenKappa, compareSheets, formatComparison, halfOf, makeSheetRows, normalizeLabel, parseCsv, postId, SHEET_COLUMNS, toCsv, validateSheet,
  type SourcePost,
} from './label-sheets-lib.js';

const mk = (url: string, over: Partial<SourcePost> = {}): SourcePost => ({
  url, username: 'acct', datePosted: '2026-10-01T00:00:00.000Z', caption: 'Caption, with "quotes"\nand a new line', hashtags: ['a', 'b'], contentType: 'Post', locationName: 'Mall X', photoCount: 1, account: 'acct', stratum: 'curator', ...over,
});

const full = (id: string, over: Record<string, string> = {}): Record<string, string> => ({
  id, is_event: 'yes', post_kind: 'announcement', audience_country: 'id', geo_scope: 'city', post_language: 'id', target_area_level: 'city', target_area_name: 'Yogyakarta', target_area_source: 'stated', eligibility: 'open_to_public', track_count: '0', age_written: 'no',
  cost_tier: 'free', cost_source: 'caption', sensitive: 'none', unsure: 'no', notes: '', ...over,
});

test('postId is stable and short; halfOf is stable and roughly balanced', () => {
  assert.equal(postId('https://www.instagram.com/p/a/'), postId('https://www.instagram.com/p/a/'));
  assert.equal(postId('x').length, 10);
  let held = 0;
  for (let i = 0; i < 400; i++) { if (halfOf(`https://www.instagram.com/p/${i}/`) === 'heldout') held++; }
  assert.ok(held > 150 && held < 250, `held-out share ${held}/400`);
  assert.equal(halfOf('u'), halfOf('u'));
});

test('CSV round trip keeps commas, quotes and new lines inside a cell', () => {
  const rows = [{ id: '1', caption: 'a, "b"\nc', hashtags: '' }, { id: '2', caption: 'plain', hashtags: 'x y' }];
  const text = toCsv(['id', 'caption', 'hashtags'], rows);
  assert.deepEqual(parseCsv(text), rows);
});

test('parseCsv accepts a spreadsheet export: BOM, CRLF, a trailing blank line', () => {
  const text = '\uFEFFid,notes\r\nabc,"hello\nworld"\r\n\r\n';
  assert.deepEqual(parseCsv(text), [{ id: 'abc', notes: 'hello\nworld' }]);
});

test('makeSheetRows: the held-out half only, blank label cells, caption included, stable order', () => {
  const posts = Array.from({ length: 40 }, (_, i) => mk(`https://www.instagram.com/p/${i}/`));
  const held = makeSheetRows(posts, 'heldout');
  const tuning = makeSheetRows(posts, 'tuning');
  assert.equal(held.length + tuning.length, 40);
  assert.ok(held.every((r) => halfOf(r.url) === 'heldout'));
  assert.ok(held[0].caption.includes('quotes'));
  assert.ok(!('audience_country' in held[0]));
  assert.deepEqual(held.map((r) => r.id), [...held.map((r) => r.id)].sort());
  const csv = toCsv(SHEET_COLUMNS, held);
  const back = parseCsv(csv);
  assert.equal(back.length, held.length);
  assert.equal(back[0].audience_country, '');
  assert.equal(makeSheetRows(posts, 'all').length, 40);
});

test('validateSheet: unknown values, blanks, duplicates, unlabelled rows', () => {
  const rows = [
    full('a'),
    full('b', { geo_scope: 'nationwide', audience_country: 'indonesia' }),
    full('c', { cost_tier: '' }),
    full('a'),
    { id: 'd', audience_country: '', geo_scope: '' },
    full('e', { audience_country: 'unclear', geo_scope: 'unclear', track_count: '3' }),
  ];
  const problems = validateSheet(rows).map((p) => `${p.id}:${p.field}:${p.problem.split(' ')[0]}`);
  assert.ok(problems.includes('b:geo_scope:unknown'));
  assert.ok(problems.includes('b:audience_country:unknown'));
  assert.ok(problems.includes('c:cost_tier:blank'));
  assert.ok(problems.includes('a:id:duplicate'));
  assert.ok(problems.includes('d:(all):not'));
  assert.ok(!problems.some((p) => p.startsWith('e:')));
});

test('normalizeLabel trims and lower-cases', () => {
  assert.equal(normalizeLabel('  ID '), 'id');
  assert.equal(normalizeLabel(undefined), '');
});

test("cohenKappa: known cases", () => {
  assert.equal(cohenKappa(['y', 'y', 'n', 'n'], ['y', 'n', 'n', 'n']), 0.5);
  assert.equal(cohenKappa(['a', 'b', 'a'], ['a', 'b', 'a']), 1);
  assert.equal(cohenKappa(['a', 'a'], ['a', 'a']), 1); // a single label on both sides: 0/0 defined as 1
  assert.equal(cohenKappa(['a', 'b'], ['b', 'a']), -1);
  assert.ok(Number.isNaN(cohenKappa([], [])));
  assert.ok(Number.isNaN(cohenKappa(['a'], ['a', 'b'])));
});

test('compareSheets: agreement, kappa, unclear counted apart, disagreements by id', () => {
  const a = [full('1'), full('2', { audience_country: 'my' }), full('3', { geo_scope: 'unclear' }), full('4'), full('only-a')];
  const b = [full('1'), full('2', { audience_country: 'id' }), full('3', { geo_scope: 'national' }), full('4', { cost_tier: 'low' }), full('only-b')];
  const c = compareSheets(a, b);
  assert.equal(c.sharedIds, 4);
  assert.equal(c.onlyA, 1);
  assert.equal(c.onlyB, 1);
  const country = c.fields.find((f) => f.field === 'audience_country')!;
  assert.equal(country.compared, 4);
  assert.equal(country.agree, 3);
  assert.equal(country.agreePct, 75);
  const geo = c.fields.find((f) => f.field === 'geo_scope')!;
  assert.equal(geo.compared, 3); // post 3 skipped: unclear
  assert.equal(geo.skippedUnclear, 1);
  assert.equal(c.unclearA, 1);
  assert.deepEqual(c.disagreements.map((d) => `${d.id}:${d.field}`).sort(), ['2:audience_country', '4:cost_tier']);
  const adj = adjudicationRows(c.disagreements);
  assert.deepEqual(Object.keys(adj[0]), ['id', 'field', 'labeller_a', 'labeller_b', 'final']);
  assert.ok(formatComparison(c).includes('disagreements to settle: 2'));
});

test('the comparison report names no caption', () => {
  const a = [full('1', { notes: 'SECRET CAPTION TEXT' })];
  const b = [full('1', { audience_country: 'my', notes: 'SECRET CAPTION TEXT' })];
  const c = compareSheets(a, b);
  const text = formatComparison(c) + JSON.stringify(adjudicationRows(c.disagreements));
  assert.ok(!text.includes('SECRET'));
});

test('the target-area columns: the source is an enum, the name is free text and is not compared by string equality', () => {
  assert.deepEqual(validateSheet([full('a')]), []);
  assert.deepEqual(validateSheet([full('a', { target_area_source: 'venue' })]), [{ id: 'a', field: 'target_area_source', problem: 'unknown value "venue"' }]);
  assert.deepEqual(validateSheet([full('a', { target_area_source: 'stated_poster', target_area_name: 'DIY', target_area_level: 'province' })]), []);
  assert.deepEqual(validateSheet([full('a', { target_area_source: 'none', target_area_name: 'none', target_area_level: 'none' })]), []);
  assert.deepEqual(validateSheet([full('a', { target_area_name: '' })]), [{ id: 'a', field: 'target_area_name', problem: 'blank' }], 'an older sheet without the new columns is flagged until they are filled');
  // two labellers who write the same area differently do not disagree on it here (the scorer resolves the names through the gazetteer)
  const c = compareSheets([full('a', { target_area_name: 'Jogja' })], [full('a', { target_area_name: 'DIY' })]);
  assert.equal(c.fields.some((f) => f.field === 'target_area_name'), false);
  assert.equal(c.disagreements.length, 0);
  assert.equal(c.fields.some((f) => f.field === 'target_area_source'), true);
});

test('post_kind: an enum that follows is_event (none exactly when the post is not about an event)', () => {
  assert.deepEqual(validateSheet([full('a'), full('b', { post_kind: 'report' }), full('c', { post_kind: 'mixed' }), full('d', { post_kind: 'unclear' })]), []);
  assert.deepEqual(validateSheet([full('a', { post_kind: 'news' })]), [{ id: 'a', field: 'post_kind', problem: 'unknown value "news"' }]);
  assert.deepEqual(validateSheet([full('a', { post_kind: '' })]), [{ id: 'a', field: 'post_kind', problem: 'blank' }], 'an older sheet without the column is flagged until it is filled');
  assert.deepEqual(validateSheet([full('a', { is_event: 'no', post_kind: 'none' })]), []);
  assert.deepEqual(validateSheet([full('a', { is_event: 'no', post_kind: 'report' })]), [{ id: 'a', field: 'post_kind', problem: 'is_event is no, so post_kind must be none' }]);
  assert.deepEqual(validateSheet([full('a', { is_event: 'yes', post_kind: 'none' })]), [{ id: 'a', field: 'post_kind', problem: 'is_event is yes, so post_kind is announcement, report or mixed' }]);
  assert.deepEqual(validateSheet([full('a', { is_event: 'no', post_kind: 'unclear' })]), [], 'unclear is always allowed');
});
