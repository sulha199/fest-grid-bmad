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
  assert.equal(txt(ev({ types: ['COMPETITION'], prizes: [{ kind: 'DOORPRIZE', value: 'Sepeda' }], inclusions: ['Jersey', 'Medali'] })), 'Peserta dapat Jersey, Medali');
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
console.log('all passed');
