import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, normalizeAreaName, relation, resolveArea, resolveAreas, SAMPLE_GAZETTEER, splitAreas, tierFor } from './area-resolver.js';

const ix = buildIndex(SAMPLE_GAZETTEER);
const ok = (s: string, amb: 'widest' | 'narrowest' | 'all' = 'widest') => {
  const r = resolveArea(s, ix, amb);
  assert.ok(r.ok, `expected "${s}" to resolve`);
  return (r as Extract<typeof r, { ok: true }>).area;
};

test('audience wrappers are stripped: "se-Kabupaten Bantul", "warga Surabaya", "mahasiswa se-DIY"', () => {
  assert.equal(normalizeAreaName('se-Kabupaten Bantul'), 'kabupaten bantul');
  assert.equal(normalizeAreaName('Warga Surabaya'), 'surabaya');
  assert.equal(normalizeAreaName('mahasiswa se-DIY'), 'diy');
});

test('type markers pick the level: "Kabupaten Bantul" is a regency; "Kota Yogyakarta" is the city, not the province', () => {
  assert.equal(ok('se-Kabupaten Bantul').level, 'regency');
  assert.deepEqual(ok('Kota Yogyakarta').keys, ['id-yo-yogyakarta']);
  assert.equal(ok('Kota Yogyakarta').ambiguous, false);
  assert.deepEqual(ok('Daerah Istimewa Yogyakarta').keys, ['id-yo']);
  assert.deepEqual(ok('DIY').keys, ['id-yo']);
});

test('"Yogyakarta" alone is ambiguous (city and province): widest by default, narrowest or both on request, always flagged', () => {
  const w = ok('Yogyakarta');
  assert.equal(w.ambiguous, true);
  assert.deepEqual(w.keys, ['id-yo']);
  assert.deepEqual(ok('Yogyakarta', 'narrowest').keys, ['id-yo-yogyakarta']);
  assert.deepEqual(ok('Yogyakarta', 'all').keys.sort(), ['id-yo', 'id-yo-yogyakarta']);
});

test('an aggregate is not a province: Jabodetabek covers nine members in three provinces; "Jawa" covers six provinces (the model called both a province)', () => {
  const j = ok('Jabodetabek');
  assert.equal(j.level, 'aggregate');
  assert.equal(j.keys.length, 9);
  assert.ok(j.keys.includes('id-jk') && j.keys.includes('id-bt-tangsel') && j.keys.includes('id-jb-depok'));
  const jawa = ok('Jawa');
  assert.equal(jawa.level, 'aggregate');
  assert.equal(jawa.keys.length, 6);
});

test('one place, three spellings (the model labelled them neighbourhood, city and regency): one key, level taken from the gazetteer', () => {
  for (const s of ['Canggu', 'Canggu Bali', 'Canggu Kabupaten Badung']) {
    const a = ok(s);
    assert.deepEqual(a.keys, ['id-ba-badung-canggu'], s);
    assert.equal(a.level, 'locality');
    assert.deepEqual(a.paths[0], ['id', 'id-ba', 'id-ba-badung', 'id-ba-badung-canggu']);
  }
});

test('several areas in one string are split and each resolved', () => {
  assert.deepEqual(splitAreas('DIY & Jawa Tengah'), ['DIY', 'Jawa Tengah']);
  const rs = resolveAreas('DIY & Jawa Tengah', ix);
  assert.deepEqual(rs.map((r) => (r.ok ? r.area.keys[0] : null)), ['id-yo', 'id-jt']);
  const two = resolveAreas('Bantul dan Sleman', ix);
  assert.deepEqual(two.map((r) => (r.ok ? r.area.keys[0] : null)), ['id-yo-bantul', 'id-yo-sleman']);
});

test('names outside the gazetteer are reported, not guessed (they go to the geocoder)', () => {
  const r = resolveArea('Victoria', ix);
  assert.deepEqual(r, { ok: false, input: 'Victoria', reason: 'not-in-gazetteer' });
  assert.deepEqual(resolveArea('  ', ix), { ok: false, input: '  ', reason: 'empty' });
});

test('the ladder: relation of an audience key to a user in Sleman', () => {
  const user = 'id-yo-sleman';
  const rel = (s: string) => relation(ok(s).keys[0], user, ix);
  assert.equal(rel('Sleman'), 'same');
  assert.equal(rel('DIY'), 'covers');
  assert.equal(rel('Bantul'), 'sibling');
  assert.equal(rel('Kota Yogyakarta'), 'sibling');
  assert.equal(rel('Surabaya'), 'other');
  assert.equal(relation('id-ba-badung-canggu', 'id-ba-badung', ix), 'inside', 'a locality event for a user in its regency');
});

test('tiers: DIY, Sleman, Bantul and Java are local for a Sleman user; a national audience is tier 1; Jabodetabek and Bali are someone else\'s', () => {
  const tier = (s: string) => tierFor(ok(s), 'id-yo-sleman', ix);
  assert.equal(tier('DIY'), 0);
  assert.equal(tier('Sleman'), 0);
  assert.equal(tier('Bantul'), 0);
  assert.equal(tier('Jawa'), 0, 'the Java aggregate contains the user\'s province');
  assert.equal(tier('Indonesia'), 1);
  assert.equal(tier('Jabodetabek'), 2);
  assert.equal(tier('Canggu'), 2);
  // the same events for a user in Depok (a Jabodetabek member)
  assert.equal(tierFor(ok('Jabodetabek'), 'id-jb-depok', ix), 0);
  assert.equal(tierFor(ok('DIY'), 'id-jb-depok', ix), 2);
});
