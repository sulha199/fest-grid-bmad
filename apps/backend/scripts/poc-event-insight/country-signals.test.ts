import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUBSCRIBER_MIN, collectSignals, countryOfUser, inferCountryFromSignals, subscriberMajority, type ProfileText } from './country-signals.js';

const p = (over: Partial<ProfileText> = {}): ProfileText => ({ username: 'acct', displayName: 'Acct', biography: '', captions: [], locationNames: [], ...over });
const kinds = (t: ProfileText, country: string) => collectSignals(t).filter((s) => s.country === country).map((s) => s.kind).sort();

test('strong signals: time zone, currency with an amount, phone, address abbreviation, country-code domain', () => {
  assert.deepEqual(kinds(p({ biography: 'Open hours: 10.00-22.00 WIB' }), 'ID'), ['timezone']);
  assert.deepEqual(kinds(p({ captions: ['Tiket Rp 50.000'] }), 'ID'), ['currency']);
  assert.deepEqual(kinds(p({ biography: 'Hubungi 0812-3456-7890' }), 'ID'), ['phone']);
  assert.deepEqual(kinds(p({ biography: 'WA +62 812 3456 7890' }), 'ID'), ['phone']);
  assert.deepEqual(kinds(p({ biography: 'Jl. Laksda Adisucipto No. 5' }), 'ID'), ['address']);
  assert.deepEqual(kinds(p({ externalUrl: 'https://tiket.example.co.id/acara' }), 'ID'), ['domain']);
  assert.deepEqual(kinds(p({ biography: 'WhatsApp +60 12-345 6789', captions: ['Admission RM25'] }), 'MY'), ['currency', 'phone']);
  assert.deepEqual(kinds(p({ captions: ['Tickets S$20 · 7pm SGT'] }), 'SG'), ['currency', 'timezone']);
  assert.deepEqual(kinds(p({ captions: ['Entry A$15, 6pm AEST'] }), 'AU'), ['currency', 'timezone']);
  assert.deepEqual(kinds(p({ captions: ['Fee ₹500'] }), 'IN'), ['currency']);
});

test('language is NOT a signal: Indonesian prose with no marker yields nothing (the Melbourne / Johor trap)', () => {
  const text = p({ biography: 'Komunitas pecinta kopi. Buka setiap hari!', captions: ['Yuk kumpul bareng akhir pekan ini, gratis untuk semua!'] });
  assert.deepEqual(collectSignals(text), []);
  assert.deepEqual(inferCountryFromSignals(text), { status: 'unresolved', reason: 'no-signal', signals: [] });
});

test('a currency symbol without an amount, a bare "Jalan", and a bare "IST" are not strong signals', () => {
  assert.deepEqual(kinds(p({ captions: ['Harga dalam Rp, hubungi kami'] }), 'ID'), []);
  assert.deepEqual(kinds(p({ biography: 'Jalan Tun Razak' }), 'ID'), [], '"Jalan" is also Malay');
  const ist = inferCountryFromSignals(p({ captions: ['Starts 9am IST'] }));
  assert.equal(ist.status, 'unresolved');
  assert.equal(ist.status === 'unresolved' && ist.reason, 'weak');
});

test('lower-case "wit" and an ordinary ".id" tail of a word do not count', () => {
  assert.deepEqual(collectSignals(p({ biography: 'quick wit and a bid for fun, paid in full' })), []);
  assert.deepEqual(kinds(p({ biography: 'mail us: hello@studio.id' }), 'ID'), ['domain']);
});

test('each KIND counts once per country: twelve captions with "Rp" are one currency signal', () => {
  const t = p({ captions: Array.from({ length: 12 }, (_, i) => `Tiket Rp ${i + 1}0.000`) });
  assert.equal(collectSignals(t).filter((s) => s.kind === 'currency').length, 1);
});

test('resolved: one strong signal, or two weak kinds (a place plus the country name)', () => {
  const tz = inferCountryFromSignals(p({ biography: 'Open 10-22 WIB' }));
  assert.equal(tz.status, 'resolved'); assert.equal(tz.status === 'resolved' && tz.country, 'ID');
  const weak2 = inferCountryFromSignals(p({ biography: 'Yoga in Canggu, Indonesia' }));
  assert.equal(weak2.status === 'resolved' && weak2.country, 'ID');
  const lone = inferCountryFromSignals(p({ biography: 'Yoga in Canggu' }));
  assert.equal(lone.status === 'unresolved' && lone.reason, 'weak', 'one place name alone is not enough');
});

test('a foreign community writing in Indonesian resolves to the foreign country, not Indonesia', () => {
  const melb = inferCountryFromSignals(p({
    displayName: 'Komunitas Indonesia di Melbourne', biography: 'Kumpul warga Indonesia di Victoria 🇦🇺',
    captions: ['Piknik bareng Minggu 10am AEST di Fitzroy Gardens, Melbourne. Donasi A$5.'],
  }));
  assert.equal(melb.status === 'resolved' && melb.country, 'AU');
  const johor = inferCountryFromSignals(p({ biography: 'Kompleks Sukan Johor Bahru. WhatsApp +60 7-123 4567', captions: ['Yuran penyertaan RM30 sahaja.'] }));
  assert.equal(johor.status === 'resolved' && johor.country, 'MY');
});

test('conflict: strong signals for two countries stay unresolved instead of picking one', () => {
  const d = inferCountryFromSignals(p({ biography: 'Open 10-22 WIB, WhatsApp +60 12-345 6789' }));
  assert.equal(d.status, 'unresolved');
  assert.equal(d.status === 'unresolved' && d.reason, 'conflict');
});

test('a single mention of another country does not outvote a strong local signal', () => {
  const d = inferCountryFromSignals(p({ biography: 'Jl. Kaliurang km 5, Yogyakarta. Rp 25.000', captions: ['Study tour ke Singapore bulan depan'] }));
  assert.equal(d.status === 'resolved' && d.country, 'ID');
});

test('empty input is unresolved with no signals', () => {
  assert.deepEqual(inferCountryFromSignals(p()), { status: 'unresolved', reason: 'no-signal', signals: [] });
});

// ---- subscribers' country: a weak clue ----

test('subscribers: needs at least 3 of them and an 80% majority; a weak signal worth 1', () => {
  assert.equal(subscriberMajority(['ID', 'ID']), undefined, 'too few subscribers');
  assert.equal(SUBSCRIBER_MIN, 3);
  assert.deepEqual(subscriberMajority(['ID', 'ID', 'ID', 'ID', 'AU']), { country: 'ID', count: 4, total: 5 });
  assert.equal(subscriberMajority(['ID', 'ID', 'AU', 'AU']), undefined, 'no 80% majority');
  assert.equal(subscriberMajority(['id', ' ID ', 'ID', 'xx-garbage', '']) ?.country, 'ID', 'normalised; junk ignored');
  assert.deepEqual(kinds(p({ subscriberCountries: ['ID', 'ID', 'ID'] }), 'ID'), ['subscribers']);
});

test('subscribers alone never resolve a country (weak = 1, resolving needs 2)', () => {
  const d = inferCountryFromSignals(p({ subscriberCountries: ['ID', 'ID', 'ID', 'ID', 'ID'] }));
  assert.equal(d.status, 'unresolved'); assert.equal(d.status === 'unresolved' && d.reason, 'weak');
});

test('subscribers break the tie for a quiet profile: one weak place + subscribers resolves', () => {
  const d = inferCountryFromSignals(p({ biography: 'Yoga in Canggu', subscriberCountries: ['ID', 'ID', 'ID'] }));
  assert.equal(d.status === 'resolved' && d.country, 'ID');
});

test('subscribers never outvote a strong foreign marker: Indonesian users following a Melbourne community', () => {
  const d = inferCountryFromSignals(p({
    displayName: 'Komunitas Indonesia di Melbourne', biography: 'Kumpul warga Indonesia di Victoria',
    captions: ['Piknik bareng Minggu 10am AEST di Fitzroy Gardens, Melbourne. Donasi A$5.'],
    subscriberCountries: ['ID', 'ID', 'ID', 'ID', 'ID', 'ID', 'ID', 'ID'],
  }));
  assert.equal(d.status === 'resolved' && d.country, 'AU');
});

test('countryOfUser: saved locations win (the user chose them), else the device time zone, else nothing', () => {
  assert.equal(countryOfUser({ savedLocationCountries: ['au', 'AU', 'id'], timezone: 'Asia/Jakarta' }), 'AU');
  assert.equal(countryOfUser({ timezone: 'Asia/Makassar' }), 'ID');
  assert.equal(countryOfUser({ timezone: 'Australia/Melbourne' }), 'AU');
  assert.equal(countryOfUser({ timezone: 'Europe/Paris' }), undefined, 'unknown zone: no guess');
  assert.equal(countryOfUser({}), undefined);
});
