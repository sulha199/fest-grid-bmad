import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, SAMPLE_GAZETTEER } from './area-resolver.js';
import { placesFromHashtags } from './hashtag-places.js';

const ix = buildIndex(SAMPLE_GAZETTEER);

test('plain place tags and place + generic word tags count', () => {
  assert.deepEqual(placesFromHashtags(['#jogja'], ix).keys, ['id-yo']);
  assert.deepEqual(placesFromHashtags(['#eventjogja'], ix).keys, ['id-yo']);
  assert.deepEqual(placesFromHashtags(['#kulinerjogja'], ix).keys, ['id-yo']);
  assert.deepEqual(placesFromHashtags(['#jogjaevent'], ix).keys, ['id-yo']);
  assert.deepEqual(placesFromHashtags(['#Sleman'], ix).keys, ['id-yo-sleman']);
  assert.deepEqual(placesFromHashtags(['#kulonprogo'], ix).keys, ['id-yo-kulonprogo']);
  assert.deepEqual(placesFromHashtags(['#eventsoloraya'], ix).keys.length, 7, 'an aggregate yields its members');
});

test('brand and origin compounds are ignored: the two real prod cases', () => {
  const r = placesFromHashtags(['#bandungcheesecuit', '#sanubarimalang', '#galeriajogja'], ix);
  assert.deepEqual(r.keys, []);
  assert.deepEqual(r.ignored, ['#bandungcheesecuit', '#sanubarimalang', '#galeriajogja']);
});

test('a name shared by a Kota and a Kabupaten yields both; tags without a place are ignored', () => {
  assert.deepEqual([...placesFromHashtags(['#bandung'], ix).keys].sort(), ['id-jb-bandung', 'id-jb-bandung-kota']);
  const r = placesFromHashtags(['#event', '#seru', '#fyp', '#'], ix);
  assert.deepEqual(r.keys, []);
});

test('several tags merge without duplicates and report which were used', () => {
  const r = placesFromHashtags(['#jogja', '#eventjogja', '#sleman', '#komunitaslari'], ix);
  assert.deepEqual(r.keys, ['id-yo', 'id-yo-sleman']);
  assert.deepEqual(r.used, ['#jogja', '#eventjogja', '#sleman']);
  assert.deepEqual(r.ignored, ['#komunitaslari']);
});

test('a country-level tag resolves (the caller drops it when anything else exists)', () => {
  assert.deepEqual(placesFromHashtags(['#indonesia'], ix).keys, ['id']);
});
