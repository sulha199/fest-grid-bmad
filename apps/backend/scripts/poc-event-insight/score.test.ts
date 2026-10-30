import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventInsight } from './insight-schema.js';
import type { Label } from './labels.js';
import { agreementRate, isVerbatimQuote, scoreInsight, stabilityKey, validateInsight } from './score.js';

const baseInsight = (over: Partial<EventInsight> = {}): EventInsight => ({
  geoScope: 'city', targetAreas: [{ name: 'Daerah Istimewa Yogyakarta', level: 'province' }], eligibility: 'open_to_public',
  segments: ['kids'], genderFocus: 'all', interests: ['Coloring contest'], participationModes: ['compete'],
  costTier: 'low', languages: ['id'], inferredFields: [], evidence: [], confidence: 0.9, ...over,
});

const baseLabel = (over: Partial<Label> = {}): Label => ({
  geoScope: ['city'], areasAll: [['yogyakarta']], eligibility: ['open_to_public'], segmentsAll: [['kids']],
  segmentsForbid: ['seniors'], ageMin: 'absent', ageMax: 'absent', genderFocus: ['all'],
  interestsAll: [['color']], participationAll: [['compete']], costTier: ['low'], ...over,
});

const SOURCE = 'Lomba Mewarnai 🎨 untuk adik-adik di Jogja. Usia 4–9 tahun';

test('a fully matching insight passes every applicable dimension with no critical errors', () => {
  const r = scoreInsight(baseInsight(), baseLabel(), SOURCE);
  assert.deepEqual(r.criticalErrors, []);
  for (const [name, d] of Object.entries(r.dimensions)) assert.ok(d.pass, `${name}: ${d.detail}`);
});

test('area aliases match across naming variants (DIY / Jogja / Special Region)', () => {
  for (const name of ['Jogja', 'DIY', 'Special Region of Yogyakarta']) {
    const r = scoreInsight(baseInsight({ targetAreas: [{ name, level: 'province' }] }), baseLabel(), SOURCE);
    assert.ok(r.dimensions.areas.pass, name);
  }
});

test('a short alias does not match inside an unrelated word', () => {
  const r = scoreInsight(baseInsight({ targetAreas: [{ name: 'Studiyo District', level: 'city' }] }), baseLabel(), SOURCE);
  assert.equal(r.dimensions.areas.pass, false);
});

test('a forbidden area is a critical error (venue-vs-artist-origin confusion)', () => {
  const label = baseLabel({ areasAll: [['jakarta']], areasForbid: ['yogyakarta'] });
  const r = scoreInsight(baseInsight({ targetAreas: [{ name: 'Jakarta', level: 'city' }, { name: 'Yogyakarta', level: 'city' }] }), label, SOURCE);
  assert.equal(r.dimensions.areas.pass, false);
  assert.match(r.criticalErrors.join('\n'), /forbidden area/);
});

test('areas invented for a post with no place are critical', () => {
  const r = scoreInsight(baseInsight(), baseLabel({ areasAll: undefined, noAreas: true }), SOURCE);
  assert.match(r.criticalErrors.join('\n'), /no place/);
});

test('"restricted" on an open event is critical; "restricted" on a restricted event is not', () => {
  const wrong = scoreInsight(baseInsight({ eligibility: 'restricted' }), baseLabel(), SOURCE);
  assert.match(wrong.criticalErrors.join('\n'), /restricted/);
  const right = scoreInsight(baseInsight({ eligibility: 'restricted' }), baseLabel({ eligibility: ['restricted'] }), SOURCE);
  assert.deepEqual(right.criticalErrors, []);
});

test('forbidden segment is critical and fails the segments dimension', () => {
  const r = scoreInsight(baseInsight({ segments: ['kids', 'seniors'] }), baseLabel(), SOURCE);
  assert.equal(r.dimensions.segments.pass, false);
  assert.match(r.criticalErrors.join('\n'), /forbidden segment/);
});

test('a missing required segment fails without being critical', () => {
  const r = scoreInsight(baseInsight({ segments: [] }), baseLabel(), SOURCE);
  assert.equal(r.dimensions.segments.pass, false);
  assert.deepEqual(r.criticalErrors, []);
});

test('age: emitting a number when the label says "absent" is critical; matching a stated number passes', () => {
  const invented = scoreInsight(baseInsight({ ageMin: 4, ageMax: 9 }), baseLabel(), SOURCE);
  assert.equal(invented.dimensions.age.pass, false);
  assert.match(invented.criticalErrors.join('\n'), /age number/);
  const stated = scoreInsight(baseInsight({ ageMin: 7, ageMax: 16 }), baseLabel({ ageMin: [7], ageMax: [16] }), SOURCE);
  assert.ok(stated.dimensions.age.pass);
  const missing = scoreInsight(baseInsight(), baseLabel({ ageMin: [7], ageMax: [16] }), SOURCE);
  assert.equal(missing.dimensions.age.pass, false);
  assert.deepEqual(missing.criticalErrors, []);
});

test('an invented gender restriction is critical', () => {
  const r = scoreInsight(baseInsight({ genderFocus: 'women' }), baseLabel(), SOURCE);
  assert.match(r.criticalErrors.join('\n'), /gender/);
});

test('language dimension is not applicable without a label, and checked case-insensitively with one', () => {
  assert.equal(scoreInsight(baseInsight(), baseLabel(), SOURCE).dimensions.language.applicable, false);
  assert.ok(scoreInsight(baseInsight({ languages: ['ID'] }), baseLabel({ languages: ['id'] }), SOURCE).dimensions.language.pass);
});

test('verbatim quote check ignores punctuation, emoji and decorative unicode but rejects invented text', () => {
  assert.ok(isVerbatimQuote('lomba mewarnai untuk adik adik di jogja', SOURCE));
  assert.ok(isVerbatimQuote('𝐕𝐈𝐅𝐀𝐓𝐈𝐎𝐍 𝐗 𝐏𝐈𝐀𝐋𝐀', 'Presenting VIFATION X PIALA GUBERNUR DIY'));
  assert.equal(isVerbatimQuote('khusus perempuan', SOURCE), false);
  assert.equal(isVerbatimQuote('ab', 'ab'), false, 'too-short quotes are not accepted as evidence');
});

test('a non-verbatim evidence quote is critical', () => {
  const r = scoreInsight(baseInsight({ evidence: ['khusus perempuan'] }), baseLabel(), SOURCE);
  assert.equal(r.dimensions.evidence.pass, false);
  assert.match(r.criticalErrors.join('\n'), /evidence not found/);
});

test('validateInsight rejects out-of-vocabulary enums and malformed arrays, accepts a good object', () => {
  assert.equal(validateInsight(baseInsight()).ok, true);
  assert.equal(validateInsight({ ...baseInsight(), geoScope: 'galaxy' }).ok, false);
  assert.equal(validateInsight({ ...baseInsight(), segments: ['kids', 'martians'] }).ok, false);
  assert.equal(validateInsight({ ...baseInsight(), targetAreas: [{ name: 'X' }] }).ok, false);
  assert.equal(validateInsight({ ...baseInsight(), ageMin: 'seven' }).ok, false);
  assert.equal(validateInsight(null).ok, false);
});

test('stabilityKey is order-insensitive for sets, and agreementRate reports the modal share', () => {
  const a = baseInsight({ segments: ['kids', 'teens'] });
  const b = baseInsight({ segments: ['teens', 'kids'] });
  assert.equal(stabilityKey(a), stabilityKey(b));
  assert.notEqual(stabilityKey(a), stabilityKey(baseInsight({ costTier: 'high' })));
  assert.equal(agreementRate([stabilityKey(a), stabilityKey(b), stabilityKey(baseInsight({ costTier: 'high' }))]), 2 / 3);
  assert.equal(agreementRate([]), 1);
});

test('abstained is set when the insight makes no claim where the label expects one, and never when it is wrong', () => {
  const abst = scoreInsight(baseInsight({ eligibility: 'unspecified', costTier: 'unspecified', geoScope: 'unspecified', targetAreas: [], segments: [] }), baseLabel({ costTier: ['low'] }), SOURCE);
  for (const d of ['eligibility', 'cost', 'geoScope', 'areas', 'segments'] as const) {
    assert.equal(abst.dimensions[d].pass, false, d);
    assert.equal(abst.dimensions[d].abstained, true, d);
  }
  const wrong = scoreInsight(baseInsight({ eligibility: 'restricted', costTier: 'high', geoScope: 'national', segments: ['seniors'] }), baseLabel(), SOURCE);
  for (const d of ['eligibility', 'cost', 'geoScope', 'segments'] as const) {
    assert.equal(wrong.dimensions[d].abstained, false, d);
  }
  const ok = scoreInsight(baseInsight(), baseLabel(), SOURCE);
  assert.ok(Object.values(ok.dimensions).every((x) => !x.abstained), 'a passing dimension is never abstained');
});

test('age: dropping a stated number is an abstention; emitting a wrong number is not', () => {
  const label = baseLabel({ ageMin: [7], ageMax: [16] });
  assert.equal(scoreInsight(baseInsight(), label, SOURCE).dimensions.age.abstained, true);
  assert.equal(scoreInsight(baseInsight({ ageMin: 7, ageMax: 99 }), label, SOURCE).dimensions.age.abstained, false);
});
