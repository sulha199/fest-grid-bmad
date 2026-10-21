import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type ProfileText } from './country-signals.js';
import { equivalentZones, inferZone, isValidZone, resolveTimezone, sameClock } from './timezone-signals.js';

const p = (over: Partial<ProfileText> = {}): ProfileText => ({ username: 'acct', displayName: 'Acct', biography: '', captions: [], locationNames: [], ...over });
const zone = (d: ReturnType<typeof inferZone>) => (d.status === 'resolved' ? d.zone : null);

test('an unambiguous abbreviation names the zone: WIB, WITA, WIT, MYT, SGT', () => {
  assert.equal(zone(inferZone(p({ biography: 'Open 10.00-22.00 WIB' }))), 'Asia/Jakarta');
  assert.equal(zone(inferZone(p({ biography: 'Beach yoga Thursday 6am WITA' }))), 'Asia/Makassar');
  assert.equal(zone(inferZone(p({ captions: ['Turnamen Sabtu 14.00 WIT'] }))), 'Asia/Jayapura');
  assert.equal(zone(inferZone(p({ captions: ['Open 10am-10pm MYT'] }))), 'Asia/Kuala_Lumpur');
  assert.equal(zone(inferZone(p({ captions: ['2pm SGT'] }))), 'Asia/Singapore');
});

test('THE COUNTRY DOES NOT DETERMINE THE ZONE: Indonesia and Australia have none by country alone', () => {
  const id = inferZone(p(), { country: 'ID' });
  assert.equal(id.status, 'unresolved'); assert.equal(id.status === 'unresolved' && id.reason, 'multi-zone');
  assert.equal(inferZone(p(), { country: 'AU' }).status, 'unresolved');
  // ... but a country whose zones share one UTC offset is enough
  assert.equal(zone(inferZone(p(), { country: 'SG' })), 'Asia/Singapore');
  assert.equal(zone(inferZone(p(), { country: 'IN' })), 'Asia/Kolkata');
  assert.equal(zone(inferZone(p(), { country: 'MY' })), 'Asia/Kuala_Lumpur');
});

test('a place picks the zone inside a country: Yogyakarta WIB, Canggu WITA, Jayapura WIT', () => {
  assert.equal(zone(inferZone(p({ displayName: 'Info Event Jogja', biography: 'Yogyakarta dan sekitarnya' }))), 'Asia/Jakarta');
  assert.equal(zone(inferZone(p({ displayName: 'Canggu Yoga', locationNames: ['Canggu, Bali'] }))), 'Asia/Makassar');
  assert.equal(zone(inferZone(p({ displayName: 'Komunitas Jayapura', biography: 'Kumpul warga Jayapura' }))), 'Asia/Jayapura');
});

test('one place mention is not enough; a strong abbreviation or two texts are', () => {
  const lone = inferZone(p({ biography: 'Kopi enak di Canggu' }));
  assert.equal(lone.status, 'unresolved'); assert.equal(lone.status === 'unresolved' && lone.reason, 'weak');
  assert.equal(zone(inferZone(p({ displayName: 'Canggu Yoga', biography: 'Canggu, Bali' }))), 'Asia/Makassar');
});

test('an ambiguous abbreviation (AEST, IST) is settled only by a place; alone it is unresolved', () => {
  const alone = inferZone(p({ captions: ['Starts 10am AEST'] }));
  assert.equal(alone.status, 'unresolved'); assert.equal(alone.status === 'unresolved' && alone.reason, 'ambiguous');
  assert.equal(zone(inferZone(p({ captions: ['Piknik 10am AEST di Fitzroy Gardens, Melbourne'], displayName: 'Warga di Melbourne' }))), 'Australia/Melbourne');
  assert.equal(zone(inferZone(p({ captions: ['Batch starts 7am IST in South Delhi'], displayName: 'Delhi Academy' }))), 'Asia/Kolkata');
  assert.equal(inferZone(p({ captions: ['Starts 9am IST'] })).status, 'unresolved');
});

test('MULTI-ZONE: a curator that writes WIB for Java and WITA for Bali has NO default zone', () => {
  const d = inferZone(p({ captions: ['Festival Surabaya Sabtu 19.00 WIB', 'Jazz Ubud Minggu 19.00 WITA', 'Pasar malam Bandung 18.00 WIB', 'Sunset party Canggu 17.00 WITA'] }));
  assert.equal(d.status, 'unresolved'); assert.equal(d.status === 'unresolved' && d.reason, 'multi-zone');
});

test('a national organizer with rounds in Flores, Kupang and Kartasura has no default zone', () => {
  const d = inferZone(p({ captions: ['Babak penyisihan FLORES 1', 'Babak penyisihan KARTASURA', 'Babak penyisihan KUPANG', 'Babak penyisihan FLORES 2'] }));
  assert.equal(d.status, 'unresolved');
});

test('one stray mention of another zone among many does not break a Java curator, two out of ten does', () => {
  const java = (n: number) => Array.from({ length: n }, (_, i) => `Acara Yogyakarta ke-${i} 19.00 WIB`);
  assert.equal(zone(inferZone(p({ captions: [...java(9), 'Trip ke Bali 08.00 WITA'] }))), 'Asia/Jakarta');
  assert.equal(inferZone(p({ captions: [...java(8), 'Trip ke Bali 08.00 WITA', 'Retreat Ubud 08.00 WITA'] })).status, 'unresolved');
});

test('an abbreviation that contradicts the place in the same text counts for both zones, so it cannot resolve', () => {
  const d = inferZone(p({ captions: ['Pertandingan di Makassar 19.00 WIB'] }));
  assert.equal(d.status, 'unresolved');
});

test('lower-case "wit" and "ist" are words, not zones', () => {
  assert.equal(inferZone(p({ biography: 'quick wit, a nihilist, and a florist' })).status, 'unresolved');
});

test('history: a large, uniform record of past events resolves when the text is silent; a conflicting one blocks the text', () => {
  assert.equal(zone(inferZone(p(), { history: [{ zone: 'Asia/Jakarta', events: 28 }, { zone: 'Asia/Makassar', events: 2 }] })), 'Asia/Jakarta');
  assert.equal(inferZone(p(), { history: [{ zone: 'Asia/Jakarta', events: 4 }] }).status, 'unresolved', 'too few events');
  assert.equal(inferZone(p(), { history: [{ zone: 'Asia/Jakarta', events: 6 }, { zone: 'Asia/Makassar', events: 4 }] }).status, 'unresolved', 'not uniform');
  const conflict = inferZone(p({ displayName: 'Info Bali', biography: 'Bali WITA' }), { history: [{ zone: 'Asia/Jakarta', events: 20 }] });
  assert.equal(conflict.status, 'unresolved'); assert.equal(conflict.status === 'unresolved' && conflict.reason, 'conflict');
});

test('a zone from another country than the resolved country is rejected', () => {
  const d = inferZone(p({ biography: 'Open 9am WIB' }), { country: 'MY' });
  assert.equal(d.status, 'unresolved'); assert.equal(d.status === 'unresolved' && d.reason, 'country-mismatch');
});

test('resolveTimezone: reach gates, text anchors, the model fills silence only for a single-region account', () => {
  const none = inferZone(p());
  const wib = inferZone(p({ biography: 'Open 10-22 WIB' }));
  const multi = inferZone(p({ captions: ['Surabaya 19.00 WIB', 'Ubud 19.00 WITA'] }));
  const quoted = (zone: string) => ({ zone, quoted: true });
  assert.deepEqual(resolveTimezone(wib, undefined, 'national'), { status: 'unresolved', reason: 'multi-zone' }, 'national reach: no default whatever the text says');
  assert.deepEqual(resolveTimezone(wib, undefined, 'local'), { status: 'resolved', zone: 'Asia/Jakarta', source: 'text' });
  assert.deepEqual(resolveTimezone(wib, quoted('Asia/Pontianak'), 'local'), { status: 'resolved', zone: 'Asia/Jakarta', source: 'text' }, 'same clock agrees');
  assert.deepEqual(resolveTimezone(wib, quoted('Asia/Makassar'), 'local'), { status: 'unresolved', reason: 'conflict' });
  assert.deepEqual(resolveTimezone(none, quoted('Asia/Jakarta'), 'local'), { status: 'resolved', zone: 'Asia/Jakarta', source: 'model' });
  assert.deepEqual(resolveTimezone(none, { zone: 'Asia/Jakarta', quoted: false }, 'local'), { status: 'unresolved', reason: 'no-evidence' }, 'no quote, no zone');
  assert.deepEqual(resolveTimezone(none, quoted('Not/AZone'), 'local'), { status: 'unresolved', reason: 'no-evidence' });
  assert.deepEqual(resolveTimezone(multi, quoted('Asia/Jakarta'), 'local'), { status: 'unresolved', reason: 'multi-zone' }, 'the model cannot override a multi-zone text');
  assert.deepEqual(resolveTimezone(none, quoted('Asia/Jakarta'), 'regional', 'MY'), { status: 'unresolved', reason: 'country-mismatch' });
});

test('zone helpers: equivalence groups and validity', () => {
  assert.ok(sameClock('Asia/Jakarta', 'Asia/Pontianak'));
  assert.ok(!sameClock('Asia/Jakarta', 'Asia/Makassar'));
  assert.deepEqual(equivalentZones('Asia/Singapore'), ['Asia/Singapore']);
  assert.ok(isValidZone('Asia/Makassar') && isValidZone('Australia/Melbourne'));
  assert.ok(!isValidZone('WITA') && !isValidZone('Not/AZone') && !isValidZone(''));
});
