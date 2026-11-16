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

// ---- area-first ordering (by AUDIENCE area, never the venue) ----
import { areaTier, rankAreaThenDate, type RankableWithAudience } from './relevance.js';
import { effectiveAudienceAreas, type EffectiveAudienceAreas } from './location-policy.js';

const aud = (...keys: string[]): EffectiveAudienceAreas => ({ keys, source: keys.length ? 'stated' : 'none' });
const ev = (over: Partial<RankableWithAudience> = {}): RankableWithAudience => ({ id: 'x', daysUntilNext: 5, ...over });

test('areaTier: every rung of the ladder is ONE merged group — own area, sub-area, containing area, sibling district', () => {
  for (const key of ['sleman', 'yogyakarta', 'bantul']) {
    const r = areaTier(rina, ev({ audience: aud(key) }));
    assert.equal(r.tier, 0, key);
    assert.equal(r.reason, 'local-ladder', key);
  }
  assert.equal(areaTier({ ...rina, areas: ['yogyakarta'] }, ev({ audience: aud('sleman') })).tier, 0, 'a district inside the user\'s city-level area');
  assert.equal(areaTier({ ...rina, areas: ['yogyakarta'] }, ev({ audience: aud('bantul') })).tier, 0);
});

test('areaTier: onsite events aimed at another area are "other local" (tier 2), including another province', () => {
  for (const key of ['jakarta', 'semarang', 'bali']) assert.equal(areaTier(rina, ev({ audience: aud(key) })).tier, 2, key);
  assert.equal(areaTier(rina, ev({ audience: aud('jakarta') })).reason, 'other-local');
});

test('areaTier: no audience area, national / international, or a country-level audience is "anywhere" (tier 1), never other-local', () => {
  assert.equal(areaTier(rina, ev()).tier, 1);
  assert.equal(areaTier(rina, ev({ audience: aud() })).tier, 1);
  assert.equal(areaTier(rina, ev({ audience: aud('indonesia'), geoScope: 'national' })).tier, 1);
  assert.equal(areaTier(rina, ev({ audience: aud('jakarta'), geoScope: 'national' })).tier, 1, 'a listed city at national scope is not "other local"');
  assert.equal(areaTier(rina, ev({ audience: aud('asia'), geoScope: 'international' })).tier, 1);
});

test('areaTier: no user, or a user with no location, puts everything in tier 1 (=> pure date order)', () => {
  assert.equal(areaTier(undefined, ev({ audience: aud('sleman') })).tier, 1);
  assert.equal(areaTier({ ...rina, areas: [] }, ev({ audience: aud('jakarta') })).tier, 1);
});

test('THE POINT OF THIS REVISION: the venue is never an input — a national event held on a local campus is not local', () => {
  // effectiveAudienceAreas() (location-policy.ts) turns "national, venue = Yogyakarta" into no audience area…
  const nationalAtCampus = effectiveAudienceAreas({
    geoScope: 'national', statedAreaKeys: [], venueAreaKeys: ['yogyakarta'], accountAreaKeys: ['yogyakarta'], accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED',
  });
  assert.deepEqual(nationalAtCampus, { keys: [], source: 'none' });
  // …and the ordering, which only reads that, puts it in "anywhere" for a Yogyakarta user.
  assert.equal(areaTier(rina, ev({ audience: nationalAtCampus, geoScope: 'national' })).tier, 1);
  // The reverse case: a Jakarta venue with a stated Surabaya audience is a Surabaya event.
  const busToJakarta = effectiveAudienceAreas({
    geoScope: 'region', statedAreaKeys: ['surabaya'], venueAreaKeys: ['jakarta'], accountAreaKeys: [], accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED',
  });
  assert.equal(areaTier({ ...rina, areas: ['surabaya'] }, ev({ audience: busToJakarta })).tier, 0);
  assert.equal(areaTier({ ...rina, areas: ['jakarta'] }, ev({ audience: busToJakarta })).tier, 2, 'a Jakarta user is not the audience');
});

test('curator vs organizer end to end: the same area-less post is local for an organizer\'s followers, "anywhere" for a curator\'s', () => {
  const inputs = { geoScope: 'unspecified' as const, statedAreaKeys: [], venueAreaKeys: [], accountAreaKeys: ['sleman'] };
  const organizer = effectiveAudienceAreas({ ...inputs, accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED' });
  const curator = effectiveAudienceAreas({ ...inputs, accountType: 'CURATOR_GUIDE', accountTypeStatus: 'CONFIRMED' });
  assert.equal(areaTier(rina, ev({ audience: organizer })).tier, 0);
  assert.equal(areaTier(rina, ev({ audience: curator })).tier, 1);
});

test('online is weighed by its audience, exactly like onsite: local govt (Zoom for Sleman) vs national company (Zoom for anyone)', () => {
  assert.equal(areaTier(rina, ev({ audience: aud('sleman'), geoScope: 'city' })).tier, 0, 'local government, Zoom for Sleman residents — local for a Sleman user');
  assert.equal(areaTier({ ...rina, areas: ['jakarta'] }, ev({ audience: aud('sleman'), geoScope: 'city' })).tier, 2, '... and other-local for a Jakarta user, not "attendable so anywhere"');
  assert.equal(areaTier(rina, ev({ geoScope: 'online' })).tier, 1, 'a national company\'s webinar: no audience area, anywhere');
  assert.equal(areaTier(rina, ev({ audience: aud('yogyakarta'), geoScope: 'online' })).tier, 0, 'a Zoom class for DIY students');
  assert.equal(areaTier(rina, ev({ audience: aud('jakarta'), geoScope: 'online' })).tier, 2, 'a Zoom event aimed at Jakarta is other-local for a Sleman user');
});

test('the order has no input about HOW an event is attended: the same audience gives the same tier onsite, online or hybrid', () => {
  for (const user of [rina, { ...rina, areas: ['jakarta'] }, { ...rina, areas: ['bali'] }]) {
    const onsite = areaTier(user, ev({ audience: aud('sleman') })).tier;
    // @ts-expect-error attendance is deliberately not part of the ordering input
    const hybrid = areaTier(user, ev({ audience: aud('sleman'), attendance: 'hybrid' })).tier;
    // @ts-expect-error attendance is deliberately not part of the ordering input
    const online = areaTier(user, ev({ audience: aud('sleman'), attendance: 'online', geoScope: 'city' })).tier;
    assert.equal(hybrid, onsite);
    assert.equal(online, onsite);
  }
});

test('multi-stop: audiences are the UNION over stops — a Jakarta stop plus a Sleman stop is local for a Sleman user', () => {
  const tour = ev({ schedules: [{ daysUntil: 2, areaKeys: ['jakarta'] }, { daysUntil: 30, areaKeys: ['sleman'] }] });
  assert.equal(areaTier(rina, tour).tier, 0);
  assert.equal(areaTier(rina, ev({ schedules: [{ daysUntil: 2, areaKeys: ['jakarta'] }, { daysUntil: 9, areaKeys: ['bali'] }] })).tier, 2);
});

test('multi-stop: "sooner" is the soonest stop that MATCHES the user, not the first stop', () => {
  const tour: RankableWithAudience = { id: 'tour', daysUntilNext: 2, schedules: [{ daysUntil: 2, areaKeys: ['jakarta'] }, { daysUntil: 30, areaKeys: ['sleman'] }] };
  const local: RankableWithAudience = { id: 'local', daysUntilNext: 10, audience: aud('sleman') };
  const ranked = rankAreaThenDate([tour, local], rina);
  assert.deepEqual(ranked.map((e) => e.id), ['local', 'tour'], 'for a Sleman user the tour is on day 30');
  assert.equal(ranked[1].sortDays, 30);
  assert.equal(rankAreaThenDate([tour, local], { ...rina, areas: ['jakarta'] })[0].id, 'tour', 'for a Jakarta user the same tour is on day 2');
});

test('rankAreaThenDate: local ladder (by date) first, then anywhere (by date), then other-local (by date)', () => {
  const events: RankableWithAudience[] = [
    { id: 'jkt-1', daysUntilNext: 1, audience: aud('jakarta') }, { id: 'zoom-2', daysUntilNext: 2, geoScope: 'online' },
    { id: 'sleman-9', daysUntilNext: 9, audience: aud('sleman') }, { id: 'diy-5', daysUntilNext: 5, audience: aud('yogyakarta') },
    { id: 'national-3', daysUntilNext: 3, geoScope: 'national' }, { id: 'bantul-20', daysUntilNext: 20, audience: aud('bantul') },
  ];
  assert.deepEqual(rankAreaThenDate(events, rina).map((e) => e.id), ['diy-5', 'sleman-9', 'bantul-20', 'zoom-2', 'national-3', 'jkt-1']);
});

test('rankAreaThenDate: with no profile it is exactly chronological, ties by id', () => {
  const events: RankableWithAudience[] = [{ id: 'c', daysUntilNext: 9, audience: aud('jakarta') }, { id: 'a', daysUntilNext: 2, audience: aud('sleman') }, { id: 'b', daysUntilNext: 2 }];
  assert.deepEqual(rankAreaThenDate(events).map((e) => e.id), ['a', 'b', 'c']);
});

test('rankAreaThenDate: strictness trade-off is real — a far-off local event outranks a much sooner "anywhere" one', () => {
  const ids = rankAreaThenDate([{ id: 'soon-national', daysUntilNext: 1, geoScope: 'national' }, { id: 'far-local', daysUntilNext: 60, audience: aud('sleman') }], rina).map((e) => e.id);
  assert.deepEqual(ids, ['far-local', 'soon-national']);
});

test('rankAreaThenDate does not mutate its input', () => {
  const events: RankableWithAudience[] = [{ id: 'a', daysUntilNext: 2, audience: aud('sleman'), schedules: [{ daysUntil: 2, areaKeys: ['sleman'] }] }];
  const copy = JSON.stringify(events);
  rankAreaThenDate(events, rina);
  assert.equal(JSON.stringify(events), copy);
});
