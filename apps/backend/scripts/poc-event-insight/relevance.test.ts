import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventInsight } from './insight-schema.js';
import {
  MAX_BOOST_DAYS, MAX_DEMOTE_DAYS, canonicalAreaKey, rankDiscovery, relevance, sortKey, type RankableEvent, type UserProfile,
} from './relevance.js';

const insight = (over: Partial<EventInsight> = {}): EventInsight => ({
  geoScope: 'city', targetAreas: [], eligibility: 'open_to_public', segments: [], genderFocus: 'all', interests: [],
  participationModes: ['attend'], costTier: 'unspecified', languages: [], inferredFields: [], evidence: [], confidence: 0.9, ...over,
});

const rina: UserProfile = { id: 'rina', locale: 'id', areas: ['sleman', 'yogyakarta'], interests: { running: 1, cycling: 0.6 } };

test('canonicalAreaKey resolves naming variants and returns undefined for unknown places', () => {
  assert.equal(canonicalAreaKey('Daerah Istimewa Yogyakarta'), 'yogyakarta');
  assert.equal(canonicalAreaKey('Kabupaten Sleman'), 'sleman');
  assert.equal(canonicalAreaKey('Republic of Indonesia'), 'indonesia');
  assert.equal(canonicalAreaKey('Atlantis'), undefined);
});

test('geo: own area > broader area containing the user > country; unrelated area is the only negative; unspecified and no-location are neutral', () => {
  const at = (name: string) => relevance(rina, insight({ targetAreas: [{ name, level: 'city' }] })).parts.geo;
  assert.equal(at('Sleman'), 0.6);
  assert.equal(at('Yogyakarta'), 0.2);
  assert.equal(at('Indonesia'), 0.05);
  assert.equal(at('Jakarta'), -1);
  assert.equal(relevance(rina, insight()).parts.geo, 0, 'unspecified is neutral, not a penalty');
  assert.equal(relevance({ ...rina, areas: [] }, insight({ targetAreas: [{ name: 'Jakarta', level: 'city' }] })).parts.geo, 0, 'no user location => neutral');
});

test('geo is a weak positive: a plain local match alone moves an event by only a day or two', () => {
  const r = relevance(rina, insight({ targetAreas: [{ name: 'Yogyakarta', level: 'city' }] }));
  assert.ok(r.score * MAX_BOOST_DAYS < 2, `local-only boost ${r.score * MAX_BOOST_DAYS} days`);
});

test('geo: an event in a sub-area of the user\'s city is a partial match, not a miss', () => {
  const cityUser: UserProfile = { ...rina, areas: ['yogyakarta'] };
  const g = relevance(cityUser, insight({ targetAreas: [{ name: 'Sleman', level: 'regency' }] })).parts.geo;
  assert.ok(g > 0 && g < 1);
});

test('geo: online events are location-independent: neutral score, no "elsewhere" demotion', () => {
  const r = relevance(rina, insight({ geoScope: 'online', targetAreas: [] }));
  assert.equal(r.parts.geo, 0);
  assert.ok(!r.reasons.includes('elsewhere'));
  assert.ok(r.reasons.includes('online'));
});

test('a national-scope event in another city is not demoted as "elsewhere"', () => {
  const r = relevance(rina, insight({ geoScope: 'national', targetAreas: [{ name: 'Jakarta', level: 'city' }] }));
  assert.ok(!r.reasons.includes('elsewhere'));
  assert.equal(r.parts.geo, 0, 'neutral score, not just a missing reason');
  assert.equal(relevance(rina, insight({ geoScope: 'city', targetAreas: [{ name: 'Jakarta', level: 'city' }] })).parts.geo, -1, 'same area at city scope IS a mismatch');
});

test('interest: matches are weighted by the user\'s own weights and capped at 1', () => {
  const light = relevance(rina, insight({ interests: ['cycling'] })).parts.interest;
  const heavy = relevance(rina, insight({ interests: ['trail running'] })).parts.interest;
  assert.ok(heavy > light && light > 0);
  assert.equal(relevance(rina, insight({ interests: ['running', 'cycling', 'running club'] })).parts.interest, 1);
  assert.equal(relevance(rina, insight({ interests: ['pottery'] })).parts.interest, 0);
});

test('audience: no declared segments => no claim either way; declared overlap boosts; declared non-member of a narrow audience is demoted', () => {
  const kidsEvent = insight({ segments: ['kids'] });
  assert.equal(relevance(rina, kidsEvent).parts.audience, 0);
  assert.ok(relevance({ ...rina, declaredSegments: ['families', 'kids'] }, kidsEvent).parts.audience > 0);
  assert.ok(relevance({ ...rina, declaredSegments: ['professionals'] }, kidsEvent).parts.audience < 0);
  assert.equal(relevance({ ...rina, declaredSegments: ['professionals'] }, insight({ segments: ['students'] })).parts.audience, 0, 'only narrow audiences (kids/seniors) are demoted');
});

test('language: matching locale is a small boost, mismatch a small penalty, unknown is neutral', () => {
  assert.ok(relevance(rina, insight({ languages: ['id'] })).parts.language > 0);
  assert.ok(relevance(rina, insight({ languages: ['en'] })).parts.language < 0);
  assert.equal(relevance(rina, insight()).parts.language, 0);
});

test('a missing insight (not yet extracted / legacy event) scores exactly neutral', () => {
  assert.equal(relevance(rina, undefined).score, 0);
});

test('score is clamped to [-1, 1]', () => {
  const best = relevance(rina, insight({ targetAreas: [{ name: 'Sleman', level: 'regency' }], interests: ['running'], languages: ['id'] }));
  assert.ok(best.score <= 1 && best.score > 0.4);
  const worst = relevance({ ...rina, declaredSegments: ['professionals'] }, insight({ targetAreas: [{ name: 'Jakarta', level: 'city' }], segments: ['kids'], languages: ['en'] }));
  assert.ok(worst.score >= -1 && worst.score < 0);
});

test('sortKey: boosts by at most MAX_BOOST_DAYS, demotes by at most MAX_DEMOTE_DAYS, neutral leaves the date alone', () => {
  assert.equal(sortKey(20, 0), 20);
  assert.equal(sortKey(20, 1), 20 - MAX_BOOST_DAYS);
  assert.equal(sortKey(20, -1), 20 + MAX_DEMOTE_DAYS);
});

const evt = (id: string, days: number, i?: EventInsight): RankableEvent => ({ id, daysUntilNext: days, insight: i });

test('anonymous / no profile reproduces the pure chronological order', () => {
  const events = [evt('c', 9), evt('a', 2, insight({ interests: ['running'] })), evt('b', 5)];
  assert.deepEqual(rankDiscovery(events).map((e) => e.id), ['a', 'b', 'c']);
});

test('a relevant event surfaces ahead of an earlier irrelevant one, but not unboundedly ahead', () => {
  const run = insight({ targetAreas: [{ name: 'Sleman', level: 'regency' }], interests: ['running'], languages: ['id'] });
  const other = insight({ interests: ['pottery'] });
  const near = rankDiscovery([evt('other', 3, other), evt('run', 8, run)], rina).map((e) => e.id);
  assert.deepEqual(near, ['run', 'other'], '5 days later but strongly relevant => first');
  const far = rankDiscovery([evt('other', 3, other), evt('run', 60, run)], rina).map((e) => e.id);
  assert.deepEqual(far, ['other', 'run'], 'two months out stays behind: relevance is bounded');
});

test('an event clearly meant for elsewhere sinks behind a slightly later neutral one', () => {
  const jakarta = insight({ targetAreas: [{ name: 'Jakarta', level: 'city' }], languages: ['en'] });
  const ids = rankDiscovery([evt('jkt', 1, jakarta), evt('neutral', 6, insight())], rina).map((e) => e.id);
  assert.deepEqual(ids, ['neutral', 'jkt']);
});

test('equal keys tie-break on id so offset pagination is deterministic', () => {
  const ids = rankDiscovery([evt('b', 4), evt('a', 4), evt('c', 4)]).map((e) => e.id);
  assert.deepEqual(ids, ['a', 'b', 'c']);
});

test('rankDiscovery does not mutate its input and exposes the reasons for the UI', () => {
  const events = [evt('x', 5, insight({ targetAreas: [{ name: 'Sleman', level: 'regency' }], interests: ['running'] }))];
  const copy = JSON.stringify(events);
  const ranked = rankDiscovery(events, rina);
  assert.equal(JSON.stringify(events), copy);
  assert.ok(ranked[0].reasons.includes('near you'));
  assert.ok(ranked[0].reasons.some((r) => r.startsWith('you like')));
});
