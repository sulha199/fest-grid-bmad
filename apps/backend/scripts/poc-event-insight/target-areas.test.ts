import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, SAMPLE_GAZETTEER } from './area-resolver.js';
import { bestRelation, deriveTargetAreas, MAX_TARGET_AREA_MEMBERS, mergeMembers, type DeriveInput, type TargetAreaMember } from './target-areas.js';

const ix = buildIndex(SAMPLE_GAZETTEER);

const member = (key: string, source: TargetAreaMember['sources'][number] = 'stated', extra: Partial<TargetAreaMember> = {}): TargetAreaMember => ({
  key, level: ix.byKey.get(key)?.level ?? 'aggregate', sources: [source], role: 'both', qualifier: 'none', quotes: [], ...extra,
});

const organizer = { type: 'ORGANIZER_VENUE_EVENT' as const, status: 'CONFIRMED' as const, reach: 'local' as const, defaultAreaKeys: [] as string[], audienceAreaKeys: [] as string[] };
const curator = { type: 'CURATOR_GUIDE' as const, status: 'CONFIRMED' as const, reach: 'unknown' as const, defaultAreaKeys: [] as string[], audienceAreaKeys: [] as string[] };
const unclassified = { type: null, status: null, reach: 'unknown' as const, defaultAreaKeys: [] as string[], audienceAreaKeys: [] as string[] };
const base = (over: Partial<DeriveInput> = {}): DeriveInput => ({ geoScope: 'unspecified', stated: [], hashtagKeys: [], account: curator, ...over });
const keys = (r: { members: TargetAreaMember[] }) => r.members.map((m) => m.key).sort();

test('merge: nested members collapse to the widest and keep every quote; disjoint members stay', () => {
  const r = mergeMembers([member('id-yo-sleman', 'stated', { quotes: ['warga Sleman'] }), member('id-yo', 'stated', { quotes: ['se-DIY'] }), member('id-jt')], ix);
  assert.deepEqual(r.map((m) => m.key).sort(), ['id-jt', 'id-yo']);
  assert.deepEqual(r.find((m) => m.key === 'id-yo')!.quotes.sort(), ['se-DIY', 'warga Sleman']);
});

test('merge: more than 8 members compress to the covering aggregate (all of Sumatera -> the Sumatera aggregate), or the common ancestor', () => {
  const sumatera = ['id-ac', 'id-su', 'id-sb', 'id-ri', 'id-kr', 'id-ja', 'id-ss', 'id-bb', 'id-be'].map((k) => member(k));
  assert.equal(sumatera.length > MAX_TARGET_AREA_MEMBERS, true);
  const r = mergeMembers(sumatera, ix);
  assert.equal(r.length, 1);
  assert.equal(r[0].key, 'agg-sumatera');
  assert.equal(r[0].level, 'aggregate');
  const mixed = mergeMembers(['id-ac', 'id-jk', 'id-jb', 'id-bt', 'id-jt', 'id-yo', 'id-ji', 'id-ba', 'id-pa'].map((k) => member(k)), ix);
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].key, 'id', 'no single aggregate covers them: the common ancestor, the country');
});

test('1. a stated audience wins outright: the venue, hashtags and account add nothing', () => {
  const r = deriveTargetAreas(base({
    stated: [member('id-yo', 'stated', { quotes: ['Hallo warga Jogja'] })],
    venue: { keys: ['id-jt-surakarta'], venueClass: 'mall', precision: 'EXACT' }, hashtagKeys: ['id-jk'], account: { ...organizer, defaultAreaKeys: ['id-ji-surabaya'] },
  }), ix);
  assert.deepEqual(keys(r), ['id-yo']);
  assert.equal(r.basis, 'stated');
});

test('2. national stated with a local venue keeps both: the country as participant, the venue as attendee (dual audience)', () => {
  const r = deriveTargetAreas(base({
    stated: [member('id', 'stated', { quotes: ['seluruh Indonesia'] })],
    venue: { keys: ['id-yo-sleman'], venueClass: 'other', precision: 'EXACT' },
  }), ix);
  assert.deepEqual(keys(r), ['id', 'id-yo-sleman']);
  assert.equal(r.members.find((m) => m.key === 'id')!.role, 'participant');
  assert.equal(r.members.find((m) => m.key === 'id-yo-sleman')!.role, 'attendee');
  assert.match(r.flags.join(' '), /dual-audience/);
});

test('3. caption and poster that state disjoint areas are both kept and the conflict is flagged', () => {
  const r = deriveTargetAreas(base({ stated: [member('id-yo', 'stated'), member('id-jt', 'stated_poster')] }), ix);
  assert.deepEqual(keys(r), ['id-jt', 'id-yo']);
  assert.equal(r.conflicts.length, 1);
  assert.match(r.conflicts[0].reason, /caption and poster/);
  const nested = deriveTargetAreas(base({ stated: [member('id-yo-bantul', 'stated'), member('id-yo', 'stated_poster')] }), ix);
  assert.deepEqual(keys(nested), ['id-yo'], 'nested caption and poster resolve to the widest');
  assert.equal(nested.conflicts.length, 0);
});

test('4. a nationwide stated scope gives no area; an online event takes only a local organizer\'s own area', () => {
  assert.deepEqual(deriveTargetAreas(base({ geoScope: 'national', venue: { keys: ['id-yo-sleman'], venueClass: 'other', precision: 'EXACT' } }), ix).members, []);
  assert.equal(deriveTargetAreas(base({ geoScope: 'national' }), ix).basis, 'nationwide');
  const local = deriveTargetAreas(base({ geoScope: 'online', account: { ...organizer, defaultAreaKeys: ['id-yo-sleman'] } }), ix);
  assert.deepEqual(keys(local), ['id-yo-sleman']);
  assert.deepEqual(deriveTargetAreas(base({ geoScope: 'online', account: { ...organizer, reach: 'national', defaultAreaKeys: ['id-jk'] } }), ix).members, []);
  assert.deepEqual(deriveTargetAreas(base({ geoScope: 'online', account: curator }), ix).members, []);
});

test('5. the mosque kajian: a Sleman venue + a curator whose bio says Jogja -> nested -> the widest, the province, with both sources', () => {
  const r = deriveTargetAreas(base({
    venue: { keys: ['id-yo-sleman-depok'], venueClass: 'other', precision: 'AREA' },
    account: { ...curator, audienceAreaKeys: ['id-yo'], audienceFromBio: true },
  }), ix);
  assert.deepEqual(keys(r), ['id-yo']);
  assert.deepEqual(r.members[0].sources, ['venue', 'account_bio']);
});

test('6. a venue and a hashtag that DISAGREE are not merged: the venue stays, the hashtag is dropped and the conflict reported', () => {
  const r = deriveTargetAreas(base({ venue: { keys: ['id-yo-sleman'], venueClass: 'other', precision: 'EXACT' }, hashtagKeys: ['id-jk'] }), ix);
  assert.deepEqual(keys(r), ['id-yo-sleman']);
  assert.equal(r.conflicts.length, 1);
  assert.match(r.conflicts[0].reason, /hashtag/);
  const agree = deriveTargetAreas(base({ venue: { keys: ['id-yo-sleman'], venueClass: 'other', precision: 'EXACT' }, hashtagKeys: ['id-yo'] }), ix);
  assert.deepEqual(keys(agree), ['id-yo'], 'a nested hashtag widens it to the province');
});

test('7. hashtags are used only when nothing else gives an area; a country-level tag is dropped once anything exists', () => {
  assert.deepEqual(keys(deriveTargetAreas(base({ hashtagKeys: ['id-yo'] }), ix)), ['id-yo']);
  assert.equal(deriveTargetAreas(base({ hashtagKeys: ['id-yo'] }), ix).basis, 'hashtag');
  const withVenue = deriveTargetAreas(base({ venue: { keys: ['id-yo-sleman'], venueClass: 'other', precision: 'EXACT' }, hashtagKeys: ['id'] }), ix);
  assert.deepEqual(keys(withVenue), ['id-yo-sleman']);
  assert.equal(withVenue.conflicts.length, 0);
});

test('8. accounts: a confirmed local organizer lends its default area; a curator and an UNCLASSIFIED account lend none, but their bio-stated audience area counts', () => {
  const org = deriveTargetAreas(base({ account: { ...organizer, defaultAreaKeys: ['id-yo-sleman'] } }), ix);
  assert.deepEqual(keys(org), ['id-yo-sleman']);
  assert.equal(org.basis, 'account');
  assert.deepEqual(deriveTargetAreas(base({ account: { ...curator, defaultAreaKeys: ['id-jk'] } }), ix).members, [], 'a curator never lends its location');
  assert.deepEqual(deriveTargetAreas(base({ account: { ...unclassified, defaultAreaKeys: ['id-jk'] } }), ix).members, [], 'unclassified = curator (2026-10-27)');
  const bio = deriveTargetAreas(base({ account: { ...unclassified, audienceAreaKeys: ['id-yo'], audienceFromBio: true } }), ix);
  assert.deepEqual(keys(bio), ['id-yo']);
  assert.equal(bio.basis, 'account_bio');
});

test('9. nothing at all -> unknown (an empty set, basis none)', () => {
  const r = deriveTargetAreas(base(), ix);
  assert.deepEqual(r, { members: [], conflicts: [], basis: 'none', flags: [] });
});

test('10. the venue area passes through the level policy: a mall in DIY -> the province; a mall in Bandung -> the city', () => {
  assert.deepEqual(keys(deriveTargetAreas(base({ venue: { keys: ['id-yo-sleman-depok'], venueClass: 'mall', precision: 'EXACT' } }), ix)), ['id-yo']);
  assert.deepEqual(keys(deriveTargetAreas(base({ venue: { keys: ['id-jb-bandung-kota'], venueClass: 'mall', precision: 'EXACT' } }), ix)), ['id-jb-bandung-kota']);
});

test('11. a neighbourhood is stated, not derived: it nests under its anchor and is absorbed by a wider stated area', () => {
  const nbh = member('id-ba-badung-canggu', 'stated', { level: 'neighborhood', anchor: 'id-ba-badung-canggu', label: 'RW 05', qualifier: 'only', quotes: ['khusus warga RW 05'] });
  const alone = deriveTargetAreas(base({ stated: [nbh] }), ix);
  assert.equal(alone.members[0].level, 'neighborhood');
  assert.equal(alone.members[0].qualifier, 'only');
  const wider = deriveTargetAreas(base({ stated: [nbh, member('id-ba', 'stated')] }), ix);
  assert.deepEqual(keys(wider), ['id-ba']);
});

test('ranking: the relation is the best over the event set x the user set', () => {
  const event = [member('id-yo-bantul'), member('id-jt-surakarta')];
  assert.equal(bestRelation(event, ['id-yo-bantul'], ix), 'same');
  assert.equal(bestRelation(event, ['id-yo-sleman'], ix), 'neighbour');
  assert.equal(bestRelation([member('id-yo')], ['id-yo-sleman'], ix), 'covers');
  assert.equal(bestRelation([member('id-yo-sleman-depok')], ['id-yo'], ix), 'inside');
  assert.equal(bestRelation(event, ['id-yo-sleman', 'id-jt-surakarta'], ix), 'same', 'the user has two saved places; the best one counts');
  assert.equal(bestRelation(event, ['id-ba-badung'], ix), 'other');
});
