// POC: offline checks for compose-highlight.mjs (node compose-highlight.test.mjs). No model, no network.
import assert from 'node:assert/strict';
import { composeHighlight, parseAmount } from './compose-highlight.mjs';

const ev = (o) => ({ types: [], schedules: [], prizes: [], promos: [], inclusions: [], isFree: null, ...o });
const t = (name, fn) => { fn(); console.log('ok', name); };

t('parseAmount reads common Indonesian forms', () => {
  assert.equal(parseAmount('Rp 50.000.000'), 50000000);
  assert.equal(parseAmount('50 juta'), 50000000);
  assert.equal(parseAmount('10jt'), 10000000);
  assert.equal(parseAmount('100rb'), 100000);
  assert.equal(parseAmount('Rp1,5 juta'), 1500000);
  assert.equal(parseAmount('hadiah'), null);
});
t('competition: total prize pool wins', () => {
  const h = composeHighlight(ev({ types: ['COMPETITION'], prizes: [{ kind: 'MONEY', value: 'Rp 10.000.000', isTotal: true }, { kind: 'ITEM', value: 'Trofi' }], promos: [{ kind: 'PERCENT_OFF', value: '10%' }] }));
  assert.deepEqual([h.text, h.kind], ['Total hadiah Rp 10.000.000', 'PRIZE']);
});
t('vague prize is never a highlight', () => {
  assert.equal(composeHighlight(ev({ prizes: [{ kind: 'OTHER', value: 'hadiah menarik' }, { kind: 'DOORPRIZE', value: 'Jutaan rupiah' }] })), null);
});
t('performance: performers first, capped at two names plus a count', () => {
  const h = composeHighlight(ev({ types: ['PERFORMANCE'], schedules: [{ performers: ['A', 'B'] }, { performers: ['C'] }], prizes: [{ kind: 'MONEY', value: 'Rp 5.000.000' }] }));
  assert.deepEqual([h.text, h.kind], ['Penampil: A, B +1', 'PERFORMERS']);
});
t('promotion: discount first, keeps the written offer, no doubled word', () => {
  assert.equal(composeHighlight(ev({ types: ['PROMOTION'], promos: [{ kind: 'PERCENT_OFF', value: '50%' }] })).text, 'Diskon 50%');
  assert.equal(composeHighlight(ev({ types: ['PROMOTION'], promos: [{ kind: 'PERCENT_OFF', value: 'Diskon 50%' }] })).text, 'Diskon 50%');
  assert.equal(composeHighlight(ev({ types: ['PROMOTION'], promos: [{ kind: 'BUY_GET', value: 'Beli 1 Gratis 1' }] })).text, 'Beli 1 Gratis 1');
});
t('best promo: percent beats amount off', () => {
  const h = composeHighlight(ev({ types: ['PROMOTION'], promos: [{ kind: 'AMOUNT_OFF', value: 'Rp 25.000' }, { kind: 'PERCENT_OFF', value: '20%' }] }));
  assert.equal(h.text, 'Diskon 20%');
});
t('free is dropped when a ticket price is stated', () => {
  assert.equal(composeHighlight(ev({ isFree: true, schedules: [{ ticketPrice: 'Rp 25.000' }] })), null);
  assert.equal(composeHighlight(ev({ isFree: true, schedules: [{ ticketPrice: 'Gratis' }] })).text, 'Gratis');
  assert.equal(composeHighlight(ev({ isFree: true })).text, 'Gratis');
});
t('free is never composed from a missing flag', () => {
  assert.equal(composeHighlight(ev({ isFree: null })), null);
  assert.equal(composeHighlight(ev({ isFree: false })), null);
});
t('inclusions shrink to fit 40 characters, never cut mid-phrase', () => {
  assert.equal(composeHighlight(ev({ inclusions: ['Jersey', 'Medali', 'Goodie bag'] })).text, 'Termasuk Jersey, Medali, Goodie bag');
  const h = composeHighlight(ev({ inclusions: ['Jersey eksklusif', 'Medali finisher', 'Goodie bag premium'] }));
  assert.ok(h.text.length <= 40, h.text);
  assert.equal(composeHighlight(ev({ inclusions: ['x'.repeat(60)] })), null);
});
t('nothing stated, nothing composed', () => {
  assert.equal(composeHighlight(ev({})), null);
});
console.log('all passed');
