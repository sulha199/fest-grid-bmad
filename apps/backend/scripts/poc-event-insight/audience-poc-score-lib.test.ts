import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReport, isHardStratum, mapsToCategory, prop, score, type Row } from './audience-poc-score-lib.js';
import type { RunRecord } from './audience-poc-lib.js';

const label = (id: string, over: Row = {}): Row => ({
  id, stratum: 'venue', audience_country: 'id', geo_scope: 'city', post_language: 'id', target_area_level: 'none', eligibility: 'unspecified',
  track_count: '0', age_written: 'no', cost_tier: 'unspecified', sensitive: 'none', ...over,
});

interface RunOver {
  country?: string; source?: RunRecord['resolved'] extends infer R ? (R extends { audienceSource: infer S } ? S : never) : never;
  geo?: string; geoRaw?: string; age?: 'yes' | 'no'; lang?: string; sensitive?: string; modelSensitive?: string; listHit?: string | null;
  interests?: string[]; dropped?: number; proposed?: number; eventCountry?: string | null; stated?: string | null;
}
const run = (id: string, n: number, o: RunOver = {}): RunRecord => ({
  id, run: n, ok: true, errors: [], usage: { latencyMs: 1000, rateLimitRetries: 0, inputTokens: 800, outputTokens: 100 },
  claims: { proposed: o.proposed ?? 0, dropped: o.dropped ?? 0, nonVerbatimQuotes: 0, quotes: 0 },
  model: {
    postLanguage: o.lang ?? 'id', statedCountry: o.stated ?? null, statedVerified: Boolean(o.stated), eventCountry: o.eventCountry ?? null,
    geoScope: o.geo ?? 'city', geoScopeRaw: o.geoRaw ?? o.geo ?? 'city', targetAreaLevel: 'none', eligibility: 'unspecified', eligibilityRaw: 'unspecified',
    costTier: 'unspecified', sensitiveTopic: o.modelSensitive ?? 'none', trackCount: 0, ageWritten: o.age ?? 'no', interests: o.interests ?? ['fun run'],
  },
  resolved: {
    audienceCountry: o.country ?? 'id', audienceSource: o.source ?? 'cue', postLanguage: o.lang ?? 'id', postLanguageViaCue: false,
    sensitive: o.sensitive ?? 'none', sensitiveSource: 'none', sensitiveListHit: o.listHit ?? null,
  },
});

test('Wilson interval: 19 of 20 is a pass at 90% on the point estimate but its lower bound is under it', () => {
  const p = prop(19, 20);
  assert.equal(p.pct, 95);
  assert.ok(p.lo > 76 && p.lo < 77, `lo ${p.lo}`);
  assert.ok(Number.isNaN(prop(0, 0).pct));
});

test('the hard strata are the shared-language ones and the foreign-addressed ones', () => {
  assert.equal(isHardStratum(label('a', { stratum: 'malaysia' })), true);
  assert.equal(isHardStratum(label('b', { stratum: 'venue', post_language: 'en' })), true);
  assert.equal(isHardStratum(label('c', { stratum: 'curator', audience_country: 'dk' })), true);
  assert.equal(isHardStratum(label('d', { stratum: 'venue' })), false);
});

test('country accuracy is pooled over runs, excludes labelled-unclear posts, and lists the posts that missed', () => {
  const labels = [label('p1'), label('p2'), label('p3', { audience_country: 'unclear' })];
  const records = [
    run('p1', 1), run('p1', 2), run('p1', 3),
    run('p2', 1), run('p2', 2, { country: 'my', source: 'account' }), run('p2', 3),
    run('p3', 1, { country: 'unclear', source: 'none' }),
  ];
  const rep = score(labels, records);
  const v = rep.verdicts.find((x) => x.measure.startsWith('Audience country, exact, all'))!;
  assert.match(v.value, /^83\.3% \(5\/6;/);
  assert.equal(v.status, 'FAIL');
  assert.deepEqual(rep.countryErrors.map((e) => [e.id, e.answered, e.source]), [['p2', 'my', 'account']]);
  assert.match(v.note!, /labelled unclear and left out: 1/);
});

test('run-to-run agreement needs every run of a post to give the same country', () => {
  const rep = score([label('p1'), label('p2')], [run('p1', 1), run('p1', 2), run('p2', 1), run('p2', 2, { country: 'my' })]);
  const v = rep.verdicts.find((x) => x.measure.startsWith('Run-to-run'))!;
  assert.match(v.value, /^50\.0% \(1\/2;/);
  assert.equal(v.status, 'FAIL');
});

test('critical errors: an invented age, a wrong "national", and a wrong country on a stated audience', () => {
  const labels = [label('a'), label('b'), label('c')];
  const rep = score(labels, [
    run('a', 1, { age: 'yes' }),
    run('b', 1, { geo: 'national' }),
    run('c', 1, { country: 'my', source: 'stated', stated: 'my' }),
  ]);
  assert.deepEqual(rep.critical.map((c) => c.kind).sort(), ['invented age', 'wrong country on a stated audience', 'wrongly national']);
  assert.equal(rep.verdicts.find((v) => v.measure.startsWith('Critical'))!.status, 'FAIL');
  const clean = score([label('a')], [run('a', 1)]);
  assert.equal(clean.verdicts.find((v) => v.measure.startsWith('Critical'))!.status, 'PASS');
});

test('abstention counts claims a guard dropped, apart from wrong answers', () => {
  const rep = score([label('a')], [run('a', 1, { proposed: 10, dropped: 2 })]);
  const v = rep.verdicts.find((x) => x.measure.startsWith('Abstention'))!;
  assert.match(v.value, /^20\.0% \(2\/10;/);
  assert.equal(v.status, 'FAIL');
});

test('sensitive recall and precision per variant, with the shipped variant being the bar', () => {
  const labels = [label('s1', { sensitive: 'religion' }), label('s2', { sensitive: 'religion' }), label('n1')];
  const rep = score(labels, [
    run('s1', 1, { modelSensitive: 'religion', sensitive: 'religion' }),
    run('s2', 1, { listHit: 'religion', sensitive: 'religion' }),
    run('n1', 1, { listHit: 'religion', sensitive: 'religion' }),
  ]);
  const [model, list, both] = rep.sensitive;
  assert.equal(model.recall.k, 1); assert.equal(model.precision.k, 1);
  assert.equal(list.recall.k, 1); assert.equal(list.precision.n, 2);
  assert.equal(both.recall.k, 2); assert.equal(both.precision.k, 2); assert.equal(both.precision.n, 3);
  assert.equal(rep.verdicts.find((v) => v.measure.startsWith('Sensitive'))!.status, 'PASS');
});

test('Malay language accuracy is taken on the posts labelled ms only', () => {
  const labels = [label('m1', { post_language: 'ms', stratum: 'malay-my' }), label('m2', { post_language: 'ms', stratum: 'malay-my' }), label('i1')];
  const rep = score(labels, [run('m1', 1, { lang: 'ms' }), run('m2', 1, { lang: 'id' }), run('i1', 1, { lang: 'id' })]);
  const v = rep.verdicts.find((x) => x.measure.startsWith('Post language on the Malay'))!;
  assert.match(v.value, /^50\.0% \(1\/2;/);
  assert.equal(v.status, 'FAIL');
});

test('interest stability: identical tag sets between runs give Jaccard 1, disjoint sets give 0', () => {
  const same = score([label('a')], [run('a', 1, { interests: ['fun run', 'zoo'] }), run('a', 2, { interests: ['zoo', 'fun run'] })]);
  assert.equal(same.interests.meanJaccard, 1);
  const apart = score([label('a')], [run('a', 1, { interests: ['fun run'] }), run('a', 2, { interests: ['batik'] })]);
  assert.equal(apart.interests.meanJaccard, 0);
  assert.equal(mapsToCategory('trail running'), true);
  assert.equal(mapsToCategory('quantum origami'), false);
});

test('a stratum with few posts is flagged as too small, and the report carries no caption field', () => {
  const rep = score([label('a')], [run('a', 1)]);
  assert.equal(rep.byStratum[0].tooSmall, true);
  const text = formatReport(rep, 'T');
  assert.match(text, /too few to claim anything/);
  assert.match(text, /## Plan §5 thresholds/);
});

test('posts without runs are left out of every denominator', () => {
  const rep = score([label('a'), label('b')], [run('a', 1)]);
  assert.equal(rep.postsWithRuns, 1);
  assert.equal(rep.posts, 2);
});
