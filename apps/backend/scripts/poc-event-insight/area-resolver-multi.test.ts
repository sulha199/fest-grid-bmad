import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, resolveArea, SAMPLE_GAZETTEER } from './area-resolver.js';

const ix = buildIndex(SAMPLE_GAZETTEER);
const area = (s: string, within?: string) => {
  const r = resolveArea(s, ix, 'widest', within);
  assert.ok(r.ok, `expected "${s}" to resolve`);
  return (r as Extract<typeof r, { ok: true }>).area;
};

test('Kota and Kabupaten markers pick the right sibling; a bare shared name becomes a SET of both, never the province', () => {
  assert.deepEqual(area('Kota Bandung').keys, ['id-jb-bandung-kota']);
  assert.deepEqual(area('Kabupaten Bandung').keys, ['id-jb-bandung']);
  const bare = area('Bandung');
  assert.deepEqual([...bare.keys].sort(), ['id-jb-bandung', 'id-jb-bandung-kota']);
  assert.equal(bare.ambiguous, true);
  assert.deepEqual([...area('Malang').keys].sort(), ['id-ji-malang', 'id-ji-malang-kota']);
  assert.deepEqual(area('Kota Malang').keys, ['id-ji-malang-kota']);
  assert.deepEqual(area('Kab. Malang').keys, ['id-ji-malang']);
});

test('a city/province name still takes the widest level (Yogyakarta, Jogja -> the province), and the Kota stays reachable by its marker', () => {
  assert.deepEqual(area('Yogyakarta').keys, ['id-yo']);
  assert.deepEqual(area('Jogja').keys, ['id-yo']);
  assert.deepEqual(area('Kota Yogyakarta').keys, ['id-yo-yogyakarta']);
  assert.deepEqual(area('Special Region of Yogyakarta').keys, ['id-yo'], 'the geocoder spelling of the province');
});

test('"Depok": Kota Depok on its own, the Sleman kecamatan when resolved WITHIN the geocoder\'s province', () => {
  assert.deepEqual(area('Depok').keys, ['id-jb-depok'], 'no context: the widest level, Kota Depok in West Java');
  const inDiy = area('Depok', 'id-yo');
  assert.deepEqual(inDiy.keys, ['id-yo-sleman-depok']);
  assert.deepEqual(inDiy.paths[0], ['id', 'id-yo', 'id-yo-sleman', 'id-yo-sleman-depok']);
  assert.equal(inDiy.level, 'district');
  assert.deepEqual(area('Mlati', 'id-yo').paths[0].slice(0, 3), ['id', 'id-yo', 'id-yo-sleman']);
  assert.deepEqual(area('Banguntapan', 'id-yo').paths[0].slice(0, 3), ['id', 'id-yo', 'id-yo-bantul']);
});

test('a name that does not exist inside the given province is not-in-gazetteer, so the caller falls back to the province', () => {
  const r = resolveArea('Pisangan', ix, 'widest', 'id-yo');
  assert.equal(r.ok, false);
  const wrongProvince = resolveArea('Mlati', ix, 'widest', 'id-jb');
  assert.equal(wrongProvince.ok, false, 'Mlati is a kecamatan of Sleman, not of West Java');
});

test('the seed table of informal aggregates: every member exists in the gazetteer and the aliases resolve', () => {
  for (const agg of SAMPLE_GAZETTEER.aggregates) {
    assert.ok(agg.members.length > 0, agg.key);
    for (const m of agg.members) assert.ok(ix.byKey.has(m), `${agg.key} member ${m} is not a place in the gazetteer`);
  }
  const keysOf = (s: string) => [...area(s).keys].sort();
  assert.deepEqual(keysOf('Kartamantul'), ['id-yo-bantul', 'id-yo-sleman', 'id-yo-yogyakarta']);
  assert.deepEqual(keysOf('Solo Raya'), ['id-jt-boyolali', 'id-jt-karanganyar', 'id-jt-klaten', 'id-jt-sragen', 'id-jt-sukoharjo', 'id-jt-surakarta', 'id-jt-wonogiri']);
  assert.deepEqual(keysOf('Joglosemar'), ['id-jt-semarang-kota', 'id-jt-surakarta', 'id-yo-yogyakarta']);
  assert.equal(area('Malang Raya').level, 'aggregate');
  assert.ok(SAMPLE_GAZETTEER.aggregates.length >= 10 && SAMPLE_GAZETTEER.aggregates.length <= 15, 'the seed table is about 10-15 entries (owner decision, 2026-10-27)');
});
