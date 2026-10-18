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

// ---- area-first ordering ----
import { areaTier, rankAreaThenDate, type RankableWithVenue } from './relevance.js';

const at = (name: string, over: Partial<EventInsight> = {}) => insight({ targetAreas: [{ name, level: 'city' }], ...over });

test('areaTier: own area, a sub-area, and a containing area are all "targeted at me"; elsewhere is not', () => {
  assert.equal(areaTier(rina, at('Sleman')).reason, 'own-area');
  assert.equal(areaTier(rina, at('Yogyakarta')).reason, 'containing-area');
  assert.equal(areaTier({ ...rina, areas: ['yogyakarta'] }, at('Sleman')).reason, 'own-area', 'a sub-area of the user\'s city counts as inside their area');
  assert.equal(areaTier(rina, at('Jakarta')).reason, 'elsewhere');
  assert.equal(areaTier(rina, at('Sleman')).tier, 0);
  assert.equal(areaTier(rina, at('Yogyakarta')).tier, 0);
  assert.equal(areaTier(rina, at('Jakarta')).tier, 2);
});

test('areaTier: a sibling district is "same region", not "own area" (Bantul for a Sleman user), and is not elsewhere', () => {
  assert.equal(areaTier(rina, at('Bantul')).reason, 'same-region');
  assert.equal(areaTier(rina, at('Bantul')).tier, 0);
  assert.equal(areaTier(rina, at('Bantul'), [], 'most-local-first').tier, 1, 'but behind the user\'s own district when ordering most-local-first');
  assert.equal(areaTier({ ...rina, areas: ['yogyakarta'] }, at('Bantul')).reason, 'own-area', 'a district inside the user\'s city-level area is own');
  assert.equal(areaTier(rina, at('Semarang')).reason, 'elsewhere', 'another province is still elsewhere');
});

test('areaTier: national / international / online / unspecified / country-level targets are neutral, never "elsewhere"', () => {
  assert.equal(areaTier(rina, insight()).reason, 'no-specific-area');
  assert.equal(areaTier(rina, insight({ geoScope: 'online' })).reason, 'no-specific-area');
  assert.equal(areaTier(rina, at('Indonesia', { geoScope: 'national' })).reason, 'no-specific-area');
  assert.equal(areaTier(rina, at('Jakarta', { geoScope: 'national' })).reason, 'no-specific-area', 'a listed city at national scope is not "elsewhere"');
  assert.equal(areaTier(rina, at('Asia', { geoScope: 'international' })).reason, 'no-specific-area');
  assert.equal(areaTier(rina, undefined).reason, 'no-specific-area', 'no insight yet => neutral');
});

test('areaTier: no user, or a user with no location, puts everything in the neutral tier (=> pure date order)', () => {
  assert.equal(areaTier(undefined, at('Sleman')).reason, 'no-specific-area');
  assert.equal(areaTier({ ...rina, areas: [] }, at('Jakarta')).reason, 'no-specific-area');
});

test('areaTier: the venue\'s geocoded areas count when the post names no audience area, and union with the AI areas', () => {
  assert.equal(areaTier(rina, insight(), ['sleman']).reason, 'own-area');
  assert.equal(areaTier(rina, at('Jakarta'), ['sleman']).reason, 'own-area', 'any matching area wins');
});

test('areaTier: most-local-first splits the containing area from the own area', () => {
  assert.equal(areaTier(rina, at('Sleman'), [], 'most-local-first').tier, 0);
  assert.equal(areaTier(rina, at('Yogyakarta'), [], 'most-local-first').tier, 1);
  assert.equal(areaTier(rina, insight(), [], 'most-local-first').tier, 2);
  assert.equal(areaTier(rina, at('Jakarta'), [], 'most-local-first').tier, 3);
});

test('rankAreaThenDate: targeted-at-me first (by date), then neutral (by date), then elsewhere (by date)', () => {
  const events: RankableWithVenue[] = [
    evt('jkt-1', 1, at('Jakarta')), evt('neutral-2', 2, insight()), evt('sleman-9', 9, at('Sleman')),
    evt('diy-5', 5, at('Yogyakarta')), evt('national-3', 3, insight({ geoScope: 'national' })), evt('sleman-20', 20, at('Sleman')),
  ];
  assert.deepEqual(rankAreaThenDate(events, rina).map((e) => e.id), ['diy-5', 'sleman-9', 'sleman-20', 'neutral-2', 'national-3', 'jkt-1']);
  assert.deepEqual(rankAreaThenDate(events, rina, 'most-local-first').map((e) => e.id), ['sleman-9', 'sleman-20', 'diy-5', 'neutral-2', 'national-3', 'jkt-1']);
});

test('rankAreaThenDate: with no profile it is exactly chronological, ties by id', () => {
  const events = [evt('c', 9, at('Jakarta')), evt('a', 2, at('Sleman')), evt('b', 2, insight())];
  assert.deepEqual(rankAreaThenDate(events).map((e) => e.id), ['a', 'b', 'c']);
});

test('rankAreaThenDate: strictness trade-off is real — a far-off local event outranks a much sooner neutral one', () => {
  const ids = rankAreaThenDate([evt('soon-national', 1, insight({ geoScope: 'national' })), evt('far-local', 60, at('Sleman'))], rina).map((e) => e.id);
  assert.deepEqual(ids, ['far-local', 'soon-national']);
});
