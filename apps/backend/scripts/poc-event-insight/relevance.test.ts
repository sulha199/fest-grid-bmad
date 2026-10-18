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
const ev = (insightValue?: EventInsight, extra: Partial<RankableWithVenue> = {}): RankableWithVenue => ({ id: 'x', daysUntilNext: 5, insight: insightValue, ...extra });

test('areaTier: every rung of the ladder is ONE merged group — own area, sub-area, containing area, sibling district', () => {
  for (const name of ['Sleman', 'Yogyakarta', 'Bantul']) {
    const r = areaTier(rina, ev(at(name)));
    assert.equal(r.tier, 0, name);
    assert.equal(r.reason, 'local-ladder', name);
  }
  assert.equal(areaTier({ ...rina, areas: ['yogyakarta'] }, ev(at('Sleman'))).tier, 0, 'a district inside the user\'s city-level area');
  assert.equal(areaTier({ ...rina, areas: ['yogyakarta'] }, ev(at('Bantul'))).tier, 0);
});

test('areaTier: onsite events targeted at another area are "other local" (tier 2), including another province', () => {
  for (const name of ['Jakarta', 'Semarang', 'Bali']) assert.equal(areaTier(rina, ev(at(name))).tier, 2, name);
  assert.equal(areaTier(rina, ev(at('Jakarta'))).reason, 'other-local');
});

test('areaTier: national / international / unspecified / country-level / no insight are "anywhere" (tier 1), never other-local', () => {
  assert.equal(areaTier(rina, ev(insight())).tier, 1);
  assert.equal(areaTier(rina, ev(undefined)).tier, 1);
  assert.equal(areaTier(rina, ev(at('Indonesia', { geoScope: 'national' }))).tier, 1);
  assert.equal(areaTier(rina, ev(at('Jakarta', { geoScope: 'national' }))).tier, 1, 'a listed city at national scope is not "other local"');
  assert.equal(areaTier(rina, ev(at('Asia', { geoScope: 'international' }))).tier, 1);
});

test('areaTier: no user, or a user with no location, puts everything in tier 1 (=> pure date order)', () => {
  assert.equal(areaTier(undefined, ev(at('Sleman'))).tier, 1);
  assert.equal(areaTier({ ...rina, areas: [] }, ev(at('Jakarta'))).tier, 1);
});

test('areaTier: the venue\'s geocoded areas count when the post names no audience area, and union with the AI areas', () => {
  assert.equal(areaTier(rina, ev(insight(), { venueAreaKeys: ['sleman'] })).tier, 0);
  assert.equal(areaTier(rina, ev(at('Jakarta'), { venueAreaKeys: ['sleman'] })).tier, 0, 'any matching area wins');
  assert.equal(areaTier(rina, ev(insight(), { venueAreaKeys: ['jakarta'] })).tier, 2);
});

test('online: an online event TARGETED at the user\'s area is local; one that is not targeted is "anywhere", not other-local', () => {
  assert.equal(areaTier(rina, ev(at('Yogyakarta', { geoScope: 'online' }))).tier, 0, 'a Zoom class for Yogyakarta students');
  assert.equal(areaTier(rina, ev(insight({ geoScope: 'online' }))).tier, 1, 'a global Zoom event');
  assert.equal(areaTier(rina, ev(at('Jakarta', { geoScope: 'online' }))).tier, 1, 'a Zoom event for Jakarta is still attendable from Yogyakarta — not "other local"');
  assert.equal(areaTier(rina, ev(insight({ attendance: 'online' }))).reason, 'online');
});

test('hybrid: a hybrid event in another city is attendable remotely, so it is "anywhere"; its venue still matches if it is local', () => {
  assert.equal(areaTier(rina, ev(at('Jakarta', { attendance: 'hybrid' }))).tier, 1);
  assert.equal(areaTier(rina, ev(at('Sleman', { attendance: 'hybrid' }))).tier, 0);
  assert.equal(areaTier(rina, ev(at('Jakarta', { attendance: 'onsite' }))).tier, 2);
});

test('online placement option: after-local (default, tier 1) / with-local (merged into tier 0) / last (tier 3)', () => {
  const zoom = ev(insight({ geoScope: 'online' }));
  assert.equal(areaTier(rina, zoom).tier, 1);
  assert.equal(areaTier(rina, zoom, { onlinePlacement: 'with-local' }).tier, 0);
  assert.equal(areaTier(rina, zoom, { onlinePlacement: 'last' }).tier, 3);
  const jakartaOnsite = ev(at('Jakarta'));
  assert.equal(areaTier(rina, jakartaOnsite, { onlinePlacement: 'last' }).tier, 2, 'the option only moves remote events');
  const targeted = ev(at('Sleman', { geoScope: 'online' }));
  assert.equal(areaTier(rina, targeted, { onlinePlacement: 'last' }).tier, 0, 'an online event targeted at me stays local under every option');
});

test('multi-venue: areas are the UNION over schedules — a Jakarta day plus a Sleman day is a local event', () => {
  const festival = ev(insight(), { schedules: [{ daysUntil: 2, areaKeys: ['jakarta'] }, { daysUntil: 30, areaKeys: ['sleman'] }] });
  assert.equal(areaTier(rina, festival).tier, 0);
  assert.equal(areaTier(rina, ev(insight(), { schedules: [{ daysUntil: 2, areaKeys: ['jakarta'] }, { daysUntil: 9, areaKeys: ['bali'] }] })).tier, 2);
});

test('multi-venue: the "sooner" date is the soonest schedule that MATCHES the user, not the event\'s first day', () => {
  const festival: RankableWithVenue = { id: 'festival', daysUntilNext: 2, insight: insight(), schedules: [{ daysUntil: 2, areaKeys: ['jakarta'] }, { daysUntil: 30, areaKeys: ['sleman'] }] };
  const local: RankableWithVenue = { id: 'local', daysUntilNext: 10, insight: at('Sleman') };
  const ranked = rankAreaThenDate([festival, local], rina);
  assert.deepEqual(ranked.map((e) => e.id), ['local', 'festival'], 'for a Sleman user the festival is on day 30, so the day-10 local event comes first');
  assert.equal(ranked[1].sortDays, 30);
  assert.equal(rankAreaThenDate([festival, local], { ...rina, areas: ['jakarta'] })[0].id, 'festival', 'for a Jakarta user the same festival is on day 2');
});

test('rankAreaThenDate: local ladder (by date) first, then anywhere (by date), then other-local (by date)', () => {
  const events: RankableWithVenue[] = [
    { id: 'jkt-1', daysUntilNext: 1, insight: at('Jakarta') }, { id: 'zoom-2', daysUntilNext: 2, insight: insight({ geoScope: 'online' }) },
    { id: 'sleman-9', daysUntilNext: 9, insight: at('Sleman') }, { id: 'diy-5', daysUntilNext: 5, insight: at('Yogyakarta') },
    { id: 'national-3', daysUntilNext: 3, insight: insight({ geoScope: 'national' }) }, { id: 'bantul-20', daysUntilNext: 20, insight: at('Bantul') },
  ];
  assert.deepEqual(rankAreaThenDate(events, rina).map((e) => e.id), ['diy-5', 'sleman-9', 'bantul-20', 'zoom-2', 'national-3', 'jkt-1']);
  assert.deepEqual(rankAreaThenDate(events, rina, { onlinePlacement: 'with-local' }).map((e) => e.id), ['zoom-2', 'diy-5', 'sleman-9', 'bantul-20', 'national-3', 'jkt-1']);
  assert.deepEqual(rankAreaThenDate(events, rina, { onlinePlacement: 'last' }).map((e) => e.id), ['diy-5', 'sleman-9', 'bantul-20', 'national-3', 'jkt-1', 'zoom-2']);
});

test('rankAreaThenDate: with no profile it is exactly chronological, ties by id', () => {
  const events: RankableWithVenue[] = [{ id: 'c', daysUntilNext: 9, insight: at('Jakarta') }, { id: 'a', daysUntilNext: 2, insight: at('Sleman') }, { id: 'b', daysUntilNext: 2, insight: insight() }];
  assert.deepEqual(rankAreaThenDate(events).map((e) => e.id), ['a', 'b', 'c']);
});

test('rankAreaThenDate: strictness trade-off is real — a far-off local event outranks a much sooner "anywhere" one', () => {
  const ids = rankAreaThenDate([{ id: 'soon-national', daysUntilNext: 1, insight: insight({ geoScope: 'national' }) }, { id: 'far-local', daysUntilNext: 60, insight: at('Sleman') }], rina).map((e) => e.id);
  assert.deepEqual(ids, ['far-local', 'soon-national']);
});

test('rankAreaThenDate does not mutate its input', () => {
  const events: RankableWithVenue[] = [{ id: 'a', daysUntilNext: 2, insight: at('Sleman'), schedules: [{ daysUntil: 2, areaKeys: ['sleman'] }] }];
  const copy = JSON.stringify(events);
  rankAreaThenDate(events, rina);
  assert.equal(JSON.stringify(events), copy);
});
