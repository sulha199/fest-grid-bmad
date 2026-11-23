// POC: offline checks for compose-highlight.mjs (node compose-highlight.test.mjs). No model, no network.
import assert from 'node:assert/strict';
import { composeHighlight, parseAmount, ruleTypeOf, TYPE_RULES, TYPE_PRECEDENCE } from './compose-highlight.mjs';

const ev = (o) => ({ types: [], schedules: [], prizes: [], promos: [], inclusions: [], isFree: null, ...o });
const t = (name, fn) => { fn(); console.log('ok', name); };
const txt = (e) => composeHighlight(e)?.text ?? null;

t('parseAmount reads common Indonesian forms', () => {
  assert.equal(parseAmount('Rp 50.000.000'), 50000000);
  assert.equal(parseAmount('50 juta'), 50000000);
  assert.equal(parseAmount('10jt'), 10000000);
  assert.equal(parseAmount('100rb'), 100000);
  assert.equal(parseAmount('Rp1,5 juta'), 1500000);
  assert.equal(parseAmount('hadiah'), null);
});
t('every precedence entry has a rule row and a ladder of known candidates', () => {
  for (const ty of TYPE_PRECEDENCE) assert.ok(TYPE_RULES[ty], ty);
  for (const ty of Object.keys(TYPE_RULES)) assert.ok(TYPE_PRECEDENCE.includes(ty), ty);
});
t('type precedence: promotion beats competition beats performance; unknown goes to OTHER', () => {
  assert.equal(ruleTypeOf(['PERFORMANCE', 'PROMOTION']), 'PROMOTION');
  assert.equal(ruleTypeOf(['FESTIVAL', 'COMPETITION']), 'COMPETITION');
  assert.equal(ruleTypeOf(['GATHERING', 'FESTIVAL']), 'FESTIVAL');
  assert.equal(ruleTypeOf([]), 'OTHER');
});

// ---- per type
t('COMPETITION: total prize pool first; doorprize alone does not headline it', () => {
  assert.equal(txt(ev({ types: ['COMPETITION'], prizes: [{ kind: 'MONEY', value: 'Rp 10.000.000', isTotal: true }, { kind: 'ITEM', value: 'Trofi' }], promos: [{ kind: 'PERCENT_OFF', value: '10%' }] })), 'Total hadiah Rp 10.000.000');
  assert.equal(txt(ev({ types: ['COMPETITION'], prizes: [{ kind: 'DOORPRIZE', value: 'Sepeda' }], inclusions: ['Jersey', 'Medali', 'Voucher kuliner'] })), 'Peserta dapat Voucher kuliner');
});
t('COMPETITION: free registration wording, and it beats inclusions', () => {
  assert.equal(txt(ev({ types: ['COMPETITION'], isFree: true, inclusions: ['Jersey'] })), 'Pendaftaran gratis');
});
t('PERFORMANCE: performers first, two names plus a count; a promo comes before free and prizes', () => {
  assert.equal(txt(ev({ types: ['PERFORMANCE'], schedules: [{ performers: ['A', 'B'] }, { performers: ['C'] }], prizes: [{ kind: 'MONEY', value: 'Rp 5.000.000' }] })), 'Penampil: A, B +1');
  assert.equal(txt(ev({ types: ['PERFORMANCE'], promos: [{ kind: 'PERCENT_OFF', value: '20%' }], isFree: true })), 'Diskon 20%');
});
t('FESTIVAL: lineup wording; free entry beats a promo', () => {
  assert.equal(txt(ev({ types: ['FESTIVAL'], schedules: [{ performers: ['A', 'B', 'C', 'D'] }] })), 'Lineup: A, B +2');
  assert.equal(txt(ev({ types: ['FESTIVAL'], isFree: true, promos: [{ kind: 'PERCENT_OFF', value: '20%' }] })), 'Gratis masuk');
});
t('SEMINAR: speakers first; without speakers the take-home (certificate) leads', () => {
  assert.equal(txt(ev({ types: ['SEMINAR'], schedules: [{ performers: ['Dr. Rina'] }] })), 'Pembicara: Dr. Rina');
  assert.equal(txt(ev({ types: ['SEMINAR'], prizes: [{ kind: 'CERTIFICATE', value: 'e-sertifikat' }] })), 'Dapat e-sertifikat');
  assert.equal(txt(ev({ types: ['SEMINAR'], inclusions: ['Seminar kit', 'Snack'] })), 'Dapat Seminar kit, Snack');
});
t('WORKSHOP: what you take home leads; instructor second', () => {
  assert.equal(txt(ev({ types: ['WORKSHOP'], inclusions: ['Bahan', 'Sertifikat'], schedules: [{ performers: ['Mia'] }] })), 'Sudah termasuk Bahan, Sertifikat');
  assert.equal(txt(ev({ types: ['WORKSHOP'], schedules: [{ performers: ['Mia'] }] })), 'Instruktur: Mia');
});
t('PROMOTION: discount first, keeps the written offer, no doubled word', () => {
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'PERCENT_OFF', value: '50%' }] })), 'Diskon 50%');
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'PERCENT_OFF', value: 'Diskon 50%' }] })), 'Diskon 50%');
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'BUY_GET', value: 'Beli 1 Gratis 1' }] })), 'Beli 1 Gratis 1');
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'AMOUNT_OFF', value: 'Rp 25.000' }, { kind: 'PERCENT_OFF', value: '20%' }] })), 'Diskon 20%');
});
t('PROMOTION: performers never headline a promotion', () => {
  assert.equal(txt(ev({ types: ['PROMOTION'], schedules: [{ performers: ['DJ X'] }] })), null);
});
t('MARKET: free entry first, then promo, then a doorprize', () => {
  assert.equal(txt(ev({ types: ['MARKET'], isFree: true, prizes: [{ kind: 'DOORPRIZE', value: 'Sepeda' }] })), 'Gratis masuk');
  assert.equal(txt(ev({ types: ['MARKET'], prizes: [{ kind: 'DOORPRIZE', value: 'Sepeda' }], schedules: [{ performers: ['Band X'] }] })), 'Doorprize Sepeda');
});
t('EXHIBITION and CIVIC and GATHERING: free first, then the people', () => {
  assert.equal(txt(ev({ types: ['EXHIBITION'], isFree: true, schedules: [{ performers: ['Sari'] }] })), 'Gratis masuk');
  assert.equal(txt(ev({ types: ['EXHIBITION'], schedules: [{ performers: ['Sari'] }] })), 'Seniman: Sari');
  assert.equal(txt(ev({ types: ['CIVIC'], schedules: [{ performers: ['Walikota'] }] })), 'Narasumber: Walikota');
  assert.equal(txt(ev({ types: ['GATHERING'], isFree: true })), 'Gratis masuk');
});
t('OTHER and no type use the default ladder', () => {
  assert.equal(txt(ev({ prizes: [{ kind: 'MONEY', value: 'Rp 1.000.000' }] })), 'Hadiah Rp 1.000.000');
  assert.equal(txt(ev({})), null);
});

// ---- shared guards
t('vague prize is never a highlight', () => {
  assert.equal(txt(ev({ prizes: [{ kind: 'OTHER', value: 'hadiah menarik' }, { kind: 'DOORPRIZE', value: 'Jutaan rupiah' }] })), null);
});
t('free is dropped when a ticket price is stated, and never composed from a missing flag', () => {
  assert.equal(txt(ev({ isFree: true, schedules: [{ ticketPrice: 'Rp 25.000' }] })), null);
  assert.equal(txt(ev({ isFree: true, schedules: [{ ticketPrice: 'Gratis' }] })), 'Gratis');
  assert.equal(txt(ev({ isFree: null })), null);
  assert.equal(txt(ev({ isFree: false })), null);
});
t('a candidate that does not fit 40 characters is skipped, never cut', () => {
  assert.equal(txt(ev({ inclusions: ['Jersey', 'Medali', 'Goodie bag'] })), 'Termasuk Jersey, Medali, Goodie bag');
  assert.ok(txt(ev({ inclusions: ['Jersey eksklusif', 'Medali finisher', 'Goodie bag premium'] })).length <= 40);
  assert.equal(txt(ev({ inclusions: ['x'.repeat(60)] })), null);
  assert.equal(txt(ev({ types: ['PERFORMANCE'], schedules: [{ performers: ['Nama Penampil Yang Sangat Panjang Sekali Dua Tiga'] }] })), null);
});
t('the result says which rule row produced it', () => {
  const h = composeHighlight(ev({ types: ['SEMINAR'], schedules: [{ performers: ['Dr. Rina'] }] }));
  assert.deepEqual([h.kind, h.source, h.type], ['PERFORMERS', 'schedules.performers', 'SEMINAR']);
});

// ---- promo guard and free-entry routing (findings 11.3)
t('a bare price is not a promo: batch fee, category fee, group fee', () => {
  assert.equal(txt(ev({ types: ['COMPETITION'], promos: [{ kind: 'AMOUNT_OFF', value: 'Rp55.000,00', evidence: 'Umum (Batch 2): Rp55.000,00' }] })), null);
  assert.equal(txt(ev({ types: ['COMPETITION'], promos: [{ kind: 'OTHER', value: 'Rp160.000', evidence: '5K - Rp160.000' }] })), null);
  assert.equal(txt(ev({ types: ['PERFORMANCE'], promos: [{ kind: 'OTHER', value: 'IDR 35K / GROUP', evidence: 'SHOWCASE REGISTRATION: ONLY IDR 35K / GROUP' }] })), null);
});
t('a real offer keeps its cue: percent, potongan, buy-get, free item', () => {
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'PERCENT_OFF', value: '50%' }] })), 'Diskon 50%');
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'AMOUNT_OFF', value: 'Rp 25.000', evidence: 'Potongan Rp 25.000 untuk pembelian pertama' }] })), 'Potongan Rp 25.000');
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'BUY_GET', value: 'Beli 1 Gratis 1' }] })), 'Beli 1 Gratis 1');
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'FREE_ITEM', value: 'Tumbler' }] })), 'Gratis Tumbler');
});
t('free entry delivered as a promo becomes the free fact, with the type wording', () => {
  assert.equal(txt(ev({ types: ['MARKET'], promos: [{ kind: 'OTHER', value: 'FREE ENTRY for Audience!' }] })), 'Gratis masuk');
  assert.equal(txt(ev({ types: ['EXHIBITION'], promos: [{ kind: 'OTHER', value: 'Masuk gratis' }] })), 'Gratis masuk');
  assert.equal(txt(ev({ types: ['PERFORMANCE'], isFree: false, promos: [{ kind: 'OTHER', value: 'Free entry' }] })), null);
});
t('routed free entry still yields to a stated ticket price', () => {
  assert.equal(txt(ev({ types: ['MARKET'], promos: [{ kind: 'OTHER', value: 'FREE ENTRY' }], schedules: [{ ticketPrice: 'IDR 35K' }] })), null);
});
t('early-bird and limited-quota wording counts as an offer cue', () => {
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'OTHER', value: 'EARLY BIRD IDR 99,999', evidence: 'EARLY BIRD IDR 99,999 nett/pax' }] })), 'EARLY BIRD IDR 99,999');
  assert.equal(txt(ev({ types: ['PROMOTION'], promos: [{ kind: 'AMOUNT_OFF', value: 'HTM 98K', evidence: 'HTM spesial 98K untuk 10 pendaftar pertama' }] })), 'Potongan HTM 98K');
});
t('COMPETITION: what every participant gets (jersey, medal, snack) is not a highlight, but a workshop keeps its take-home items', () => {
  assert.equal(txt(ev({ types: ['COMPETITION'], inclusions: ['Jersey', 'Medali', 'Snack'] })), null);
  assert.equal(txt(ev({ types: ['WORKSHOP'], inclusions: ['Snack', 'Sertifikat'] })), 'Sudah termasuk Snack, Sertifikat');
});
t('a price-style promo with an early-bird cue in the ticket price is worded as early bird, not as a deduction', () => {
  const e = ev({ types: ['PROMOTION'], schedules: [{ ticketPrice: 'IDR 99,999 nett/pax (Early Bird)' }], promos: [{ kind: 'AMOUNT_OFF', value: 'IDR 99,999 nett/pax', conditions: 'Now to December 15th', evidence: 'Only IDR 99,999 nett/pax' }] });
  assert.equal(txt(e), 'Early bird IDR 99,999 nett/pax');
});
t('a PROMOTION-typed post with a stated window and a price-style promo shows it as a promo', () => {
  const e = ev({ types: ['PROMOTION'], promos: [{ kind: 'AMOUNT_OFF', value: 'IDR 99,999 nett/pax', conditions: 'Now to December 15th', evidence: 'Only IDR 99,999 nett/pax' }] });
  assert.equal(txt(e), 'Promo IDR 99,999 nett/pax');
});
t('a bare amount on a non-promotion post is still a price, not an offer', () => {
  assert.equal(txt(ev({ types: ['COMPETITION'], promos: [{ kind: 'AMOUNT_OFF', value: 'Rp175.000', conditions: 'Regular Sale', evidence: 'Rp175.000 untuk kategori 3K' }] })), null);
});
t('isFree from the model needs a free word in the caption when the caption is known', () => {
  const e = ev({ types: ['EXHIBITION'], isFree: true });
  assert.equal(composeHighlight(e, { caption: 'Registration link: https://example.org/register' }), null);
  assert.equal(composeHighlight(e, { caption: 'Masuk gratis untuk umum' })?.text, 'Gratis masuk');
  assert.equal(composeHighlight(e)?.text, 'Gratis masuk'); // no caption passed: behaves as before
});
t('a free-entry promo is its own evidence even when the caption has no free word', () => {
  const e = ev({ types: ['EXHIBITION'], promos: [{ kind: 'OTHER', value: 'Free entry for audience' }] });
  assert.equal(composeHighlight(e, { caption: 'FREE ENTRY' })?.text, 'Gratis masuk');
});
console.log('all passed');
