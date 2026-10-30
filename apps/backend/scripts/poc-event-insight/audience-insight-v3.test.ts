import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIENCE_INSIGHT_INSTRUCTION_V2, AUDIENCE_INSIGHT_INSTRUCTION_V3, AUDIENCE_INSIGHT_INSTRUCTION_V3_WITH_POSTER, audienceInsightSchemaV3,
  audienceInsightSchema, guardAudienceInsight, hasReportCue, invalidStatedAreaFields, targetAreaLevelOf, targetAreaSourceOf, validateAudienceInsight,
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

test('prompt v3 widens isEvent to reports and asks for postKind; prompt v2 is untouched (IDEA-106)', () => {
  assert.match(AUDIENCE_INSIGHT_INSTRUCTION_V3, /- postKind: what the post does about its event/);
  assert.match(AUDIENCE_INSIGHT_INSTRUCTION_V3, /reports on it \(results, winners, a recap, news, a thank-you\)/);
  assert.match(AUDIENCE_INSIGHT_INSTRUCTION_V3, /lists tomorrow's matches is "mixed"/);
  assert.equal(AUDIENCE_INSIGHT_INSTRUCTION_V3.includes('false if it has no schedule'), false, 'a recap is no longer "not an event"');
  assert.match(AUDIENCE_INSIGHT_INSTRUCTION_V3_WITH_POSTER, /- postKind:/);
  assert.equal(AUDIENCE_INSIGHT_INSTRUCTION_V2.includes('postKind'), false);
  assert.match(AUDIENCE_INSIGHT_INSTRUCTION_V2, /false if it has no schedule: a recap or thank-you after the event/);
});

test('schema v3: postKind is a required four-value enum; schema v2 has none', () => {
  const s = audienceInsightSchemaV3(false) as any;
  assert.deepEqual(s.properties.postKind.enum, ['announcement', 'report', 'mixed', 'none']);
  assert.ok(s.required.includes('postKind'));
  assert.equal((audienceInsightSchema.properties as any).postKind, undefined);
  assert.equal(audienceInsightSchema.required.includes('postKind' as never), false);
});

test('validation: postKind must be one of the four values; an answer without it (prompt v2) stays valid', () => {
  assert.equal(validateAudienceInsight(base([], { postKind: 'report' })).ok, true);
  assert.deepEqual(validateAudienceInsight(base([], { postKind: 'recap' })).errors, ['postKind']);
  assert.equal(validateAudienceInsight(base([])).ok, true);
});

test('guard: postKind follows isEvent, and a report without results wording is flagged log-only, never changed', () => {
  const caption = 'Hylo Open 2026 hari ke-2: juara tunggal putra Jonatan Christie. Besok semifinal jam 10.00';
  const mixed = guardAudienceInsight(base([], { postKind: 'mixed' }), caption);
  assert.equal(mixed.value.postKind, 'mixed');
  assert.equal(mixed.actions.some((a) => a.startsWith('postKind')), false);

  const notEvent = guardAudienceInsight(base([], { isEvent: false, postKind: 'announcement' }), caption);
  assert.equal(notEvent.value.postKind, 'none');
  assert.match(notEvent.actions.join(' '), /postKind announcement -> none/);

  const noneOnEvent = guardAudienceInsight(base([], { postKind: 'none' }), caption);
  assert.equal(noneOnEvent.value.postKind, 'announcement');

  const cueless = guardAudienceInsight(base([], { postKind: 'report' }), 'Hylo Open 2026 hari ke-2 di Taiyuan');
  assert.equal(cueless.value.postKind, 'report', 'kept: the check is log-only');
  assert.match(cueless.actions.join(' '), /postKind report: no results or recap wording/);

  assert.equal(guardAudienceInsight(base([]), caption).value.postKind, undefined, 'a prompt v2 answer has none');
  assert.equal(hasReportCue('Selamat kepada para juara'), true);
  assert.equal(hasReportCue('Pendaftaran dibuka, hadiah menarik'), false);
});

test('the saved record carries postKind, the model\'s own value and whether the caption has results wording; a v2 record has none', () => {
  const rec = evaluateRun({ id: 'p1', run: 1, caption: 'Hasil hari ini, besok lanjut semifinal', rawText: JSON.stringify(base([], { postKind: 'mixed' })), usage: { latencyMs: 1, rateLimitRetries: 0 } });
  assert.equal(rec.ok, true);
  assert.equal(rec.model!.postKind, 'mixed');
  assert.equal(rec.model!.postKindRaw, 'mixed');
  assert.equal(rec.model!.postKindCue, true);
  const v2 = evaluateRun({ id: 'p2', run: 1, caption: 'x', rawText: JSON.stringify({ ...base([]), targetAreas: undefined, targetAreaLevel: 'city' }), usage: { latencyMs: 1, rateLimitRetries: 0 } });
  assert.equal(v2.ok, true);
  assert.equal('postKind' in v2.model!, false);
});
