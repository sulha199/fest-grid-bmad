import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaCanon, areaNamesAgree } from './area-name-agreement.js';

test('different wordings of one area agree: Jogja = DIY = Daerah Istimewa Yogyakarta = warga Jogja', () => {
  assert.equal(areaNamesAgree('Jogja', ['DIY']), true);
  assert.equal(areaNamesAgree('warga Jogja', ['Daerah Istimewa Yogyakarta']), true);
  assert.equal(areaNamesAgree('Special Region of Yogyakarta', ['Yogya']), true);
});

test('a nested pair collapses to the container, so listing Sleman next to DIY changes nothing', () => {
  assert.equal(areaCanon(['Sleman', 'DIY']), areaCanon(['DIY']));
  assert.equal(areaNamesAgree('DIY', ['Sleman', 'DIY']), true);
});

test('different areas disagree, and a missing area is not the same as a stated one', () => {
  assert.equal(areaNamesAgree('Jogja', ['Surabaya']), false);
  assert.equal(areaNamesAgree('Jogja', []), false);
  assert.equal(areaNamesAgree('none', []), true);
  assert.equal(areaNamesAgree('', ['none']), true);
});

test('several areas written in one label are split; the order does not matter', () => {
  assert.equal(areaNamesAgree('DIY dan Jawa Tengah', ['Jateng', 'DIY']), true);
  assert.equal(areaNamesAgree('DIY; Jawa Tengah', ['Jawa Tengah']), false);
});

test('a name the gazetteer does not know falls back to its normalised text', () => {
  assert.equal(areaNamesAgree('Kuala Lumpur', ['kuala lumpur']), true);
  assert.equal(areaNamesAgree('Kuala Lumpur', ['Johor Bahru']), false);
});

test('a bare name shared by a Kota and a Kabupaten is the SET of both, and an aggregate is its members', () => {
  assert.equal(areaNamesAgree('Bandung', ['Kota Bandung', 'Kabupaten Bandung']), true);
  assert.equal(areaNamesAgree('Bandung', ['Kota Bandung']), false);
  assert.equal(areaNamesAgree('Kartamantul', ['Kota Yogyakarta', 'Sleman', 'Bantul']), true);
});
