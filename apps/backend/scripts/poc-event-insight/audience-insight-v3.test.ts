import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIENCE_INSIGHT_INSTRUCTION_V2, AUDIENCE_INSIGHT_INSTRUCTION_V3, AUDIENCE_INSIGHT_INSTRUCTION_V3_WITH_POSTER, audienceInsightSchemaV3,
  guardAudienceInsight, invalidStatedAreaFields, targetAreaLevelOf, targetAreaSourceOf, validateAudienceInsight,
  type AudienceInsight, type StatedTargetArea,
} from './audience-insight.js';
import { evaluateRun } from './audience-poc-lib.js';

const area = (over: Partial<StatedTargetArea> = {}): StatedTargetArea => ({
  name: 'Jogja', level: 'province', source: 'stated', qualifier: 'none', role: 'both', quote: 'warga Jogja', ...over,
});
const base = (areas: StatedTargetArea[], over: Partial<AudienceInsight> = {}): AudienceInsight => ({
  isEvent: true, postLanguage: 'id', geoScope: 'city', targetAreas: areas, eligibility: 'unspecified', tracks: [], costTier: 'unspecified',
  sensitiveTopic: 'none', interests: [], evidence: [], ...over,
});

test('prompt v3 asks for stated areas only; the venue, hashtags and account name are no longer the model\'s job', () => {
  assert.equal(AUDIENCE_INSIGHT_INSTRUCTION_V3.includes('targetAreaLevel'), false);
  assert.equal(AUDIENCE_INSIGHT_INSTRUCTION_V3.includes('- targetAreas:'), true);
  assert.match(AUDIENCE_INSIGHT_INSTRUCTION_V3, /Do not use the venue, the hashtags or the posting account's name/);
  assert.match(AUDIENCE_INSIGHT_INSTRUCTION_V3, /sanggar tari se-yogyakarta/);
  assert.match(AUDIENCE_INSIGHT_INSTRUCTION_V3, /people who attend, register or compete/);
  assert.equal(AUDIENCE_INSIGHT_INSTRUCTION_V3.includes('stated_poster'), false, 'the caption-only call has no poster to read');
  assert.equal(AUDIENCE_INSIGHT_INSTRUCTION_V3_WITH_POSTER.includes('stated_poster'), true);
  assert.equal(AUDIENCE_INSIGHT_INSTRUCTION_V2.includes('targetAreaLevel'), true, 'v2 is untouched so earlier results stay reproducible');
  // everything outside the target-area bullet is identical
  assert.equal(AUDIENCE_INSIGHT_INSTRUCTION_V3.split('\n').length >= AUDIENCE_INSIGHT_INSTRUCTION_V2.split('\n').length, true);
});

test('schema v3: targetAreas replaces targetAreaLevel; the poster source exists only in the production variant', () => {
  const s = audienceInsightSchemaV3(false) as any;
  assert.equal(s.properties.targetAreaLevel, undefined);
  assert.ok(s.required.includes('targetAreas') && !s.required.includes('targetAreaLevel'));
  assert.deepEqual(s.properties.targetAreas.items.properties.source.enum, ['stated']);
  assert.deepEqual((audienceInsightSchemaV3(true) as any).properties.targetAreas.items.properties.source.enum, ['stated', 'stated_poster']);
  assert.equal(s.properties.targetAreas.items.properties.level.enum.includes('none'), false, 'an empty list says "none"; an entry never does');
});

test('validation: a v3 answer needs well-formed areas; a v2 answer still needs targetAreaLevel', () => {
  assert.equal(validateAudienceInsight(base([area()])).ok, true);
  assert.equal(validateAudienceInsight(base([])).ok, true, 'an empty list is the correct answer when nothing is stated');
  assert.deepEqual(invalidStatedAreaFields(area({ quote: '' })), ['quote']);
  assert.deepEqual(invalidStatedAreaFields(area({ level: 'none', role: 'host' })), ['level', 'role']);
  assert.deepEqual(validateAudienceInsight(base([area(), area({ source: 'ad' })])).errors, ['targetAreas[1].source']);
  const v2 = { ...base([]), targetAreas: undefined };
  assert.deepEqual(validateAudienceInsight(v2).errors, ['targetAreaLevel']);
  assert.equal(validateAudienceInsight({ ...v2, targetAreaLevel: 'city' }).ok, true);
});

test('guard: a stated area survives only with a verbatim quote that names the area', () => {
  const caption = 'Hallo warga Jogja! Lomba terbuka untuk mahasiswa se-DIY';
  const ok = guardAudienceInsight(base([area(), area({ name: 'DIY', quote: 'mahasiswa se-DIY' })]), caption);
  assert.equal(ok.value.targetAreas!.length, 2);
  assert.equal(ok.claims.dropped, 0);
  const invented = guardAudienceInsight(base([area({ quote: 'seluruh warga Jawa Tengah' })]), caption);
  assert.deepEqual(invented.value.targetAreas, []);
  assert.equal(invented.claims.dropped, 1);
  const notNamed = guardAudienceInsight(base([area({ name: 'Surabaya', quote: 'warga Jogja' })]), caption);
  assert.deepEqual(notNamed.value.targetAreas, [], 'the quote is real but does not name the area the model reported');
});

test('guard: "only" needs residents-only wording; a neighbourhood needs RW/RT/kampung wording', () => {
  const caption = 'Upacara 17 Agustus, khusus warga RW 05 Kelurahan Sidomulyo';
  const good = guardAudienceInsight(base([area({ name: 'RW 05 Kelurahan Sidomulyo', level: 'neighborhood', qualifier: 'only', anchor: 'Sidomulyo', quote: 'khusus warga RW 05 Kelurahan Sidomulyo' })]), caption);
  assert.equal(good.value.targetAreas![0].level, 'neighborhood');
  assert.equal(good.value.targetAreas![0].qualifier, 'only');
  assert.equal(good.value.targetAreas![0].anchor, 'Sidomulyo');

  const open = 'Lomba warga Prawirotaman terbuka untuk warga sekitar';
  const weak = guardAudienceInsight(base([area({ name: 'Prawirotaman', level: 'neighborhood', qualifier: 'only', anchor: 'Brontokusuman', quote: 'warga Prawirotaman' })]), open);
  assert.equal(weak.value.targetAreas![0].qualifier, 'none', 'no khusus/hanya/saja');
  assert.equal(weak.value.targetAreas![0].level, 'city', 'no RW/RT/kampung wording: widened');
  assert.equal(weak.value.targetAreas![0].anchor, undefined);
  assert.equal(weak.claims.dropped, 2);
});

test('guard: a poster-only area cannot be checked against the caption; it is kept, counted, and an over-long quote is dropped', () => {
  const caption = 'Daftar sekarang lewat link di bio';
  const r = guardAudienceInsight(base([area({ source: 'stated_poster', quote: 'khusus warga DIY', name: 'DIY' })]), caption);
  assert.equal(r.value.targetAreas!.length, 1);
  assert.match(r.actions.join(' '), /poster area "DIY": not checkable/);
  const long = guardAudienceInsight(base([area({ source: 'stated_poster', quote: 'x'.repeat(101) })]), caption);
  assert.deepEqual(long.value.targetAreas, []);
});

test('guard: a national scope can rest on nationwide wording that appears only on the poster', () => {
  const caption = 'Final di Yogyakarta, daftar lewat link di bio';
  const posterOnly = base([area({ source: 'stated_poster', name: 'Indonesia', level: 'country', quote: 'peserta seluruh Indonesia' })], { geoScope: 'national' });
  assert.equal(guardAudienceInsight(posterOnly, caption).value.geoScope, 'national');
  assert.equal(guardAudienceInsight(base([], { geoScope: 'national' }), caption).value.geoScope, 'unspecified', 'no wording anywhere');
});

test('derived values: the single level the labellers recorded, and the source', () => {
  assert.equal(targetAreaLevelOf(base([])), 'none');
  assert.equal(targetAreaLevelOf(base([area({ level: 'city' }), area({ level: 'province' })])), 'province');
  assert.equal(targetAreaLevelOf(base([area({ level: 'neighborhood' }), area({ level: 'city' })])), 'city');
  assert.equal(targetAreaLevelOf({ ...base([]), targetAreas: undefined, targetAreaLevel: 'regency' }), 'regency', 'prompt v2 passes through');
  assert.equal(targetAreaSourceOf(base([])), 'none');
  assert.equal(targetAreaSourceOf(base([area()])), 'stated');
  assert.equal(targetAreaSourceOf(base([area({ source: 'stated_poster' })])), 'stated_poster');
  assert.equal(targetAreaSourceOf(base([area({ source: 'stated_poster' }), area()])), 'stated');
  assert.equal(targetAreaSourceOf({ ...base([]), targetAreas: undefined, targetAreaLevel: 'city' }), undefined, 'prompt v2 has no source');
});

test('the saved record keeps the guarded areas WITHOUT their quotes', () => {
  const raw = JSON.stringify({ ...base([area({ quote: 'warga Jogja' })]) });
  const rec = evaluateRun({ id: 'p1', run: 1, caption: 'Hallo warga Jogja!', rawText: raw, usage: { latencyMs: 1, rateLimitRetries: 0 } });
  assert.equal(rec.ok, true);
  assert.equal(rec.model!.targetAreaLevel, 'province');
  assert.equal(rec.model!.targetAreaSource, 'stated');
  assert.deepEqual(rec.model!.targetAreas, [{ name: 'Jogja', level: 'province', source: 'stated', qualifier: 'none', role: 'both' }]);
  assert.equal(JSON.stringify(rec).includes('warga Jogja'), false, 'no third-party text in the saved record');
});
