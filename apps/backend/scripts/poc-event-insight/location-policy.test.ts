import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectBestCandidate } from '@festgrid/domain/geolocation';
import { isScrapableAccountType } from '@festgrid/domain';
import {
  acceptGeocode, consensusPlace, effectiveAudienceAreas, mayUseAccountLocation,
  type AccountType, type AccountTypeStatus, type AudienceAreaInputs,
} from './location-policy.js';

const TYPES: AccountType[] = ['ORGANIZER_VENUE_EVENT', 'CURATOR_GUIDE', 'PERSONAL', null];
const STATUSES: AccountTypeStatus[] = ['CONFIRMED', 'AWAITING_APPROVAL', null];

test('mayUseAccountLocation: confirmed organizers and never-classified accounts may lend; curators, personal and awaiting approval may not', () => {
  const expected = (t: AccountType, s: AccountTypeStatus): boolean => s === null || (s === 'CONFIRMED' && t === 'ORGANIZER_VENUE_EVENT');
  for (const t of TYPES) for (const s of STATUSES) assert.equal(mayUseAccountLocation(t, s), expected(t, s), `${t}/${s}`);
  assert.equal(mayUseAccountLocation('ORGANIZER_VENUE_EVENT', 'CONFIRMED'), true);
  assert.equal(mayUseAccountLocation('CURATOR_GUIDE', 'CONFIRMED'), false, 'the curator case');
  assert.equal(mayUseAccountLocation('ORGANIZER_VENUE_EVENT', 'AWAITING_APPROVAL'), false, 'might be a curator');
  assert.equal(mayUseAccountLocation(null, null), true, 'DECISION 2026-10-18: a never-classified account that already has a location is not changed');
});

test('mayUseAccountLocation: a NATIONAL organizer\'s account location is a head office — it does not lend it; unknown reach does', () => {
  assert.equal(mayUseAccountLocation('ORGANIZER_VENUE_EVENT', 'CONFIRMED', 'local'), true);
  assert.equal(mayUseAccountLocation('ORGANIZER_VENUE_EVENT', 'CONFIRMED', 'regional'), true);
  assert.equal(mayUseAccountLocation('ORGANIZER_VENUE_EVENT', 'CONFIRMED', 'unknown'), true);
  assert.equal(mayUseAccountLocation('ORGANIZER_VENUE_EVENT', 'CONFIRMED', 'national'), false);
  assert.equal(mayUseAccountLocation('ORGANIZER_VENUE_EVENT', 'CONFIRMED', 'international'), false);
  assert.equal(mayUseAccountLocation(null, null, 'national'), false, 'reach applies to never-classified accounts too');
});

test('mayUseAccountLocation is strictly narrower than the scrape gate (a curator is scrapable but has no fallback location)', () => {
  for (const t of TYPES) for (const s of STATUSES) {
    if (mayUseAccountLocation(t, s)) assert.ok(isScrapableAccountType(t, s), `${t}/${s}`);
  }
  assert.equal(isScrapableAccountType('CURATOR_GUIDE', 'CONFIRMED'), true);
  assert.equal(mayUseAccountLocation('CURATOR_GUIDE', 'CONFIRMED'), false);
});

// ---- geocode acceptance ----
const my = { countryCode: 'my', confidence: 0.92, label: 'Taman Budaya, Johor' };
const idLow = { countryCode: 'id', confidence: 0.62, label: 'Taman Budaya, Bandung' };
const idHigh = { countryCode: 'id', confidence: 0.81, label: 'Taman Budaya, Yogyakarta' };

test('CHARACTERISATION: today\'s selectBestCandidate takes the highest-confidence candidate whatever its country', () => {
  // This documents current behaviour with the real function; the candidate sets are synthetic.
  const picked = selectBestCandidate([idLow, my] as never[]) as unknown as { countryCode: string };
  assert.equal(picked.countryCode, 'my');
  const lone = selectBestCandidate([{ countryCode: 'my', confidence: 0.12 }] as never[]) as unknown as { countryCode: string };
  assert.equal(lone.countryCode, 'my', 'and there is no floor: a 0.12 foreign candidate is accepted');
});

test('acceptGeocode: a foreign candidate is never eligible, even with the highest confidence', () => {
  const d = acceptGeocode([my, idLow], { allowedCountries: ['id'], minConfidence: 0.5 });
  assert.equal(d.status, 'accepted');
  if (d.status === 'accepted') { assert.equal(d.candidate.label, idLow.label); assert.equal(d.skippedForeign, 1); }
});

test('acceptGeocode: no candidate in the allowed countries, or none above the floor, is UNRESOLVED — never a wrong pin', () => {
  assert.deepEqual(acceptGeocode([my], { allowedCountries: ['id'], minConfidence: 0.5 }), { status: 'unresolved', reason: 'no-candidate-in-allowed-country', skippedForeign: 1 });
  assert.deepEqual(acceptGeocode([{ countryCode: 'id', confidence: 0.3 }], { allowedCountries: ['id'], minConfidence: 0.5 }), { status: 'unresolved', reason: 'below-confidence-floor', skippedForeign: 0 });
  assert.deepEqual(acceptGeocode([], { allowedCountries: ['id'], minConfidence: 0.5 }), { status: 'unresolved', reason: 'no-candidates', skippedForeign: 0 });
});

test('acceptGeocode: picks the best ELIGIBLE candidate, supports several allowed countries, treats a missing country or confidence as ineligible/lowest', () => {
  assert.equal((acceptGeocode([idLow, idHigh, my], { allowedCountries: ['ID'], minConfidence: 0.5 }) as { candidate: { label: string } }).candidate.label, idHigh.label, 'case-insensitive country codes');
  assert.equal(acceptGeocode([my, idLow], { allowedCountries: ['id', 'my'], minConfidence: 0.5 }).status, 'accepted');
  assert.equal((acceptGeocode([my, idLow], { allowedCountries: ['id', 'my'], minConfidence: 0.5 }) as { candidate: { label: string } }).candidate.label, my.label);
  assert.equal(acceptGeocode([{ confidence: 0.99 }], { allowedCountries: ['id'], minConfidence: 0.5 }).status, 'unresolved', 'no country code => cannot be shown to be allowed');
  assert.equal(acceptGeocode([{ countryCode: 'id' }], { allowedCountries: ['id'], minConfidence: 0.5 }).status, 'unresolved', 'no confidence => below any floor');
});

// ---- which area is the event FOR ----
const base: AudienceAreaInputs = { geoScope: 'city', statedAreaKeys: [], venueAreaKeys: [], accountAreaKeys: [], accountType: 'ORGANIZER_VENUE_EVENT', accountTypeStatus: 'CONFIRMED' };

test('effectiveAudienceAreas: a stated audience area wins over the venue and the account', () => {
  const r = effectiveAudienceAreas({ ...base, statedAreaKeys: ['bantul'], venueAreaKeys: ['yogyakarta'], accountAreaKeys: ['sleman'] });
  assert.deepEqual(r, { keys: ['bantul'], source: 'stated' });
});

test('effectiveAudienceAreas: a NATIONAL event held at a local venue is not "for" that locality (the discussion\'s core case)', () => {
  const r = effectiveAudienceAreas({ ...base, geoScope: 'national', venueAreaKeys: ['yogyakarta'], accountAreaKeys: ['yogyakarta'] });
  assert.deepEqual(r, { keys: [], source: 'none' });
  assert.deepEqual(effectiveAudienceAreas({ ...base, geoScope: 'international', venueAreaKeys: ['yogyakarta'] }), { keys: [], source: 'none' });
});

test('effectiveAudienceAreas: an online-only event has no venue to fall back to; a stated area still counts', () => {
  assert.deepEqual(effectiveAudienceAreas({ ...base, geoScope: 'online', venueAreaKeys: ['jakarta'], accountAreaKeys: ['yogyakarta'] }), { keys: [], source: 'none' }, 'organizer of UNKNOWN reach: not guessed');
  assert.deepEqual(effectiveAudienceAreas({ ...base, geoScope: 'online', statedAreaKeys: ['yogyakarta'] }), { keys: ['yogyakarta'], source: 'stated' });
});

test('effectiveAudienceAreas: local government vs national company, both posting an online event with no stated audience', () => {
  const online = { ...base, geoScope: 'online' as const, accountAreaKeys: ['sleman'] };
  assert.deepEqual(effectiveAudienceAreas({ ...online, accountReach: 'local' }), { keys: ['sleman'], source: 'account' }, 'a local government\'s Zoom briefing is for its residents');
  assert.deepEqual(effectiveAudienceAreas({ ...online, accountReach: 'regional' }), { keys: ['sleman'], source: 'account' });
  assert.deepEqual(effectiveAudienceAreas({ ...online, accountReach: 'national' }), { keys: [], source: 'none' }, 'a national company\'s webinar is for everyone — its head-office city is not its audience');
  assert.deepEqual(effectiveAudienceAreas({ ...online, accountReach: 'unknown' }), { keys: [], source: 'none' });
  assert.deepEqual(effectiveAudienceAreas({ ...online, accountReach: 'local', accountType: 'CURATOR_GUIDE' }), { keys: [], source: 'none' }, 'never a curator');
  assert.deepEqual(effectiveAudienceAreas({ ...online, accountReach: 'local', accountTypeStatus: null, accountType: null }), { keys: ['sleman'], source: 'account' }, 'a never-classified account with a location and a KNOWN local reach is unchanged');
  assert.deepEqual(effectiveAudienceAreas({ ...online, accountReach: 'unknown', accountTypeStatus: null, accountType: null }), { keys: [], source: 'none' }, 'online still needs a known local reach');
});

test('effectiveAudienceAreas: an area-less ONSITE post from a national organizer does not take its head-office city', () => {
  assert.deepEqual(effectiveAudienceAreas({ ...base, geoScope: 'unspecified', accountAreaKeys: ['jakarta'], accountReach: 'national' }), { keys: [], source: 'none' });
  assert.deepEqual(effectiveAudienceAreas({ ...base, geoScope: 'unspecified', accountAreaKeys: ['sleman'], accountReach: 'local' }), { keys: ['sleman'], source: 'account' });
  assert.deepEqual(effectiveAudienceAreas({ ...base, geoScope: 'unspecified', accountAreaKeys: ['sleman'], accountReach: 'national', venueAreaKeys: ['sleman'] }), { keys: ['sleman'], source: 'venue' }, 'a national company\'s Yogyakarta store event still has its venue');
});

test('effectiveAudienceAreas: a venue in Jakarta with a stated Surabaya audience is for Surabaya', () => {
  assert.deepEqual(effectiveAudienceAreas({ ...base, statedAreaKeys: ['surabaya'], venueAreaKeys: ['jakarta'] }), { keys: ['surabaya'], source: 'stated' });
});

test('effectiveAudienceAreas: a plain local promotion is for its venue\'s locality', () => {
  assert.deepEqual(effectiveAudienceAreas({ ...base, venueAreaKeys: ['sleman'] }), { keys: ['sleman'], source: 'venue' });
});

test('effectiveAudienceAreas: the account\'s location is a last resort for organizers/venues only — never for a curator', () => {
  assert.deepEqual(effectiveAudienceAreas({ ...base, accountAreaKeys: ['sleman'] }), { keys: ['sleman'], source: 'account' });
  const curator = effectiveAudienceAreas({ ...base, accountType: 'CURATOR_GUIDE', accountAreaKeys: ['sleman'] });
  assert.deepEqual(curator, { keys: [], source: 'none' });
  assert.deepEqual(effectiveAudienceAreas({ ...base, accountTypeStatus: 'AWAITING_APPROVAL', accountAreaKeys: ['sleman'] }), { keys: [], source: 'none' });
});

test('effectiveAudienceAreas: a curator\'s own post still uses the venue it names — only the account fallback is removed', () => {
  assert.deepEqual(effectiveAudienceAreas({ ...base, accountType: 'CURATOR_GUIDE', venueAreaKeys: ['bantul'], accountAreaKeys: ['sleman'] }), { keys: ['bantul'], source: 'venue' });
});

test('effectiveAudienceAreas: nothing anywhere is "for anyone", and keys are de-duplicated', () => {
  assert.deepEqual(effectiveAudienceAreas(base), { keys: [], source: 'none' });
  assert.deepEqual(effectiveAudienceAreas({ ...base, statedAreaKeys: ['sleman', 'sleman'] }).keys, ['sleman']);
});

// ---- consensus: the real strings from the live probe (probe-default-location.generated.txt) ----
const VENUE_ACCOUNT = ['Plaza Ambarrukmo, Yogyakarta', 'Plaza Ambarrukmo, Yogyakarta', 'Plaza Ambarrukmo, Hall Lantai 2', 'Ground Floor, Plaza Ambarrukmo, Yogyakarta'];
const CURATOR_ACCOUNT = [
  'Plaza Ambarrukmo', 'Royal Ambarrukmo, Yogyakarta', 'Sport Academy Yogyakarta and Lapangan Funminton, Yogyakarta', 'omah noto plankton',
  'Jogja', 'DIY & Jawa Tengah', 'Montero Jogja, Jln. Purworejo, Tanen, Pakem, Sleman Yogyakarta',
  'Auditorium SGLC, Faculty of Engineering, Universitas Gadjah Mada', 'Yogyakarta', 'Museum Gunungapi Merapi, Yogyakarta',
  'Hotel Kotta Go Yogyakarta', 'DIY (Daerah Istimewa Yogyakarta) and Sleman, Indonesia',
];

test('consensusPlace: the real venue account (4 posts) has a base place; the real curator (12 posts, 12 different places) has none', () => {
  assert.match(consensusPlace(VENUE_ACCOUNT) ?? '', /Ambarrukmo/);
  assert.equal(consensusPlace(CURATOR_ACCOUNT), null);
});

test('consensusPlace: needs at least two agreeing posts and a majority; one post is never a consensus', () => {
  assert.equal(consensusPlace(['Plaza Ambarrukmo, Yogyakarta']), null);
  assert.equal(consensusPlace(['Plaza Ambarrukmo', 'Hotel Kotta Go']), null);
  assert.match(consensusPlace(['Plaza Ambarrukmo', 'Plaza Ambarrukmo Yogyakarta', 'Hotel Kotta Go']) ?? '', /Ambarrukmo/);
  assert.equal(consensusPlace(['Plaza Ambarrukmo', 'Plaza Ambarrukmo', 'A B C', 'D E F', 'G H I', 'J K L']), null, 'two of six is not a majority');
  assert.equal(consensusPlace([]), null);
  assert.equal(consensusPlace(['Jogja', 'Yogyakarta']), null, 'filler-only descriptions carry no place to agree on');
});

// ---- decision 2026-10-18: an unresolved country is a preference + the floor, not "no pin" ----
import { DEFAULT_GEOCODE_FLOOR, decideGeocode, geocodePlan } from './location-policy.js';

test('geocodePlan: a known country is a hard filter; an unknown one is a preference for the home country', () => {
  const known = geocodePlan('MY', 'id');
  assert.deepEqual(known, { mode: 'filter', countries: ['my'], providerParam: 'filter=countrycode:my', minConfidence: DEFAULT_GEOCODE_FLOOR });
  const unknown = geocodePlan(undefined, 'ID');
  assert.deepEqual(unknown, { mode: 'bias', homeCountry: 'id', providerParam: 'bias=countrycode:id', minConfidence: DEFAULT_GEOCODE_FLOOR });
  assert.equal(geocodePlan('  ', 'id').mode, 'bias');
  assert.equal(geocodePlan('indonesia', 'id').mode, 'bias', 'only a 2-letter code is a country; anything else is treated as unknown');
  assert.equal(DEFAULT_GEOCODE_FLOOR, 0.5, 'the threshold isLocationTrustworthy already uses; not calibrated');
});

test('decideGeocode, KNOWN country: a foreign candidate is never eligible, whatever its confidence', () => {
  const plan = geocodePlan('id', 'id');
  const d = decideGeocode(plan, [{ countryCode: 'my', confidence: 0.95, label: 'Kuala Lumpur' }, { countryCode: 'id', confidence: 0.62, label: 'Yogyakarta' }]);
  assert.equal(d.status, 'accepted'); if (d.status === 'accepted') assert.equal(d.candidate.label, 'Yogyakarta');
  assert.equal(decideGeocode(plan, [{ countryCode: 'my', confidence: 0.95 }]).status, 'unresolved');
});

test('decideGeocode, UNKNOWN country: any country may win — but only above the floor', () => {
  const plan = geocodePlan(undefined, 'id');
  const foreignHigh = decideGeocode(plan, [{ countryCode: 'my', confidence: 0.9, label: 'KL' }, { countryCode: 'id', confidence: 0.55, label: 'Jogja' }]);
  assert.equal(foreignHigh.status === 'accepted' && foreignHigh.candidate.label, 'KL', 'a preference, not a restriction');
  assert.deepEqual(decideGeocode(plan, [{ countryCode: 'id', confidence: 0.3 }, { countryCode: 'my', confidence: 0.2 }]), { status: 'unresolved', reason: 'below-confidence-floor', skippedForeign: 0 }, 'a guess is stored as text, never as a pin');
  assert.equal(decideGeocode(plan, [{ confidence: 0.8, label: 'no country field' }]).status, 'accepted', 'with no restriction a missing country code does not disqualify');
  assert.equal(decideGeocode(plan, []).status, 'unresolved');
});

test('the floor is a parameter', () => {
  assert.equal(decideGeocode(geocodePlan(undefined, 'id', 0.8), [{ countryCode: 'id', confidence: 0.7 }]).status, 'unresolved');
  assert.equal(decideGeocode(geocodePlan(undefined, 'id', 0.6), [{ countryCode: 'id', confidence: 0.7 }]).status, 'accepted');
});
