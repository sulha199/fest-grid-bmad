// POC: offline checks for tier-options.mjs (node tier-options.test.mjs). No model, no network.
import assert from 'node:assert/strict';
import { amountOf, decideTiers, decideTiersPerEvent } from './tier-options.mjs';

const t = (name, fn) => { fn(); console.log('ok', name); };
const o = (price, audience = 'PUBLIC', extra = {}) => ({ label: 'x', kind: 'CATEGORY', audience, price, ...extra });

t('amountOf reads written prices and free words', () => {
  assert.equal(amountOf('Rp 200.000'), 200000);
  assert.equal(amountOf('IDR 99,999 nett/pax'), 99999);
  assert.equal(amountOf('50k'), 50000);
  assert.equal(amountOf('Gratis'), 0);
  assert.equal(amountOf('FREE'), 0);
  assert.equal(amountOf(''), null);
  assert.equal(amountOf(undefined), null);
  assert.equal(amountOf('hubungi panitia'), null);
});
t('one price, or the same price twice, is not a tier', () => {
  assert.equal(decideTiers([o('Rp 100.000')]).emit, false);
  assert.equal(decideTiers([o('Rp 100.000'), o('Rp 100.000', 'STUDENT')]).emit, false);
  assert.deepEqual(decideTiers([o('Rp 100.000')]).tiers, []);
});
t('two distinct prices make tiers', () => {
  const d = decideTiers([o('Rp 140.000'), o('Rp 160.000')]);
  assert.equal(d.emit, true);
  assert.equal(d.tiers.length, 2);
  assert.deepEqual(d.amounts, [140000, 160000]);
});
t('free and paid options are two distinct amounts (audience free, showcase paid)', () => {
  const d = decideTiers([o('Gratis'), o('IDR 35K / group', 'GROUP')]);
  assert.equal(d.emit, true);
  assert.equal(d.freePublic, true);
  assert.equal(d.fromPrice, null); // the only paid option is for groups, not the public
});
t('from price comes from PUBLIC options only', () => {
  const d = decideTiers([o('Rp 50.000'), o('Rp 55.000'), o('Rp 45.000', 'STUDENT')]);
  assert.equal(d.fromPrice, 50000);
  assert.equal(d.emit, true);
});
t('a missing audience counts as PUBLIC; an option with no readable price is ignored', () => {
  const d = decideTiers([{ label: 'a', kind: 'OTHER', price: 'Rp 10.000' }, { label: 'b', kind: 'OTHER', price: 'sesuai kategori' }]);
  assert.equal(d.fromPrice, 10000);
  assert.equal(d.emit, false);
});
t('no options', () => {
  assert.deepEqual(decideTiers([]), { emit: false, tiers: [], amounts: [], fromPrice: null, freePublic: false });
  assert.equal(decideTiers(undefined).emit, false);
});
t('a price string that runs on into other text still gives its leading amount', () => {
  assert.equal(amountOf('Rp 30.000t'), 30000);
  assert.equal(amountOf('Rp20.000peserta'), 20000);
  assert.equal(amountOf('Rp75.000YOWORKSHOP FOTOGRAFI 2'), 75000);
  assert.equal(amountOf('Rp50.000,00outside of the JSON string'), 50000);
  assert.equal(amountOf('IDR 35K / GROUPYON'), 35000);
  assert.equal(amountOf('Rp30.000kids'), 30000);
  assert.equal(amountOf('1,5 juta'), 1500000);
  assert.equal(amountOf(50000), 50000);
});
t('per event: prices of different events are not tiers of one event', () => {
  const opts = [o('Rp 60.000', 'PUBLIC', { event: 'Singing' }), o('Rp 20.000', 'PUBLIC', { event: 'Try Out' }), o('Gratis', 'PUBLIC', { event: 'Parenting' })];
  assert.equal(decideTiers(opts).emit, true); // the post-level rule would emit tiers here
  const r = decideTiersPerEvent(opts, ['Singing', 'Try Out', 'Parenting', 'Mini Expo']);
  assert.deepEqual(r.map((x) => x.emit), [false, false, false, false]);
  assert.deepEqual(r.map((x) => x.fromPrice), [60000, 20000, null, null]);
});
t('per event: two prices of one event make tiers, and a GENERAL price counts for every event', () => {
  const opts = [o('Rp 75.000', 'PUBLIC', { event: 'A' }), o('Rp 100.000', 'STUDENT', { event: 'A' }), o('Rp 50.000', 'PUBLIC', { event: 'GENERAL' })];
  const r = decideTiersPerEvent(opts, ['A', 'B']);
  assert.equal(r[0].emit, true);
  assert.deepEqual(r[0].amounts, [50000, 75000, 100000]);
  assert.equal(r[1].emit, false);
  assert.equal(r[1].fromPrice, 50000);
});
t('per event: an unknown event value is treated as GENERAL', () => {
  const r = decideTiersPerEvent([o('Rp 10.000', 'PUBLIC', { event: 'Typo' })], ['A']);
  assert.equal(r[0].fromPrice, 10000);
});
console.log('all passed');
