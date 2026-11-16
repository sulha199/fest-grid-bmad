import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateRun, frozenHashOf, mergeRecords, runGate, sha256, type RunRecord } from './audience-poc-lib.js';

const usage = { latencyMs: 900, rateLimitRetries: 0, inputTokens: 700, outputTokens: 120 };
const answer = (over: Record<string, unknown> = {}) => JSON.stringify({
  isEvent: true, postLanguage: 'id', geoScope: 'city', targetAreaLevel: 'none', eligibility: 'unspecified', tracks: [], costTier: 'unspecified',
  sensitiveTopic: 'none', interests: ['fun run'], evidence: [], eventCountry: 'dk', ...over,
});

test('an Indonesian post about an event abroad resolves to Indonesia through the cue, and the record carries no caption', () => {
  const caption = 'Jadwal final Denmark Open 2026 mulai pukul 17.00 WIB. Semangat!';
  const r = evaluateRun({ id: 'a1', run: 1, caption, accountCountry: 'id', rawText: answer({ geoScope: 'unspecified' }), usage });
  assert.equal(r.ok, true);
  assert.equal(r.resolved?.audienceCountry, 'id');
  assert.equal(r.resolved?.audienceSource, 'cue');
  assert.equal(r.model?.eventCountry, 'dk');
  assert.ok(!JSON.stringify(r).includes('Denmark Open'), 'no caption text may be saved');
});

test('a stated audience with an invented quote is dropped, counted, and not saved as a quote', () => {
  const r = evaluateRun({
    id: 'a2', run: 1, caption: 'Konser di Jakarta, tiket Rp 300.000', accountCountry: 'id',
    rawText: answer({ statedAudience: { country: 'sg', quote: 'for Singapore fans' }, evidence: ['for Singapore fans'] }), usage,
  });
  assert.equal(r.model?.statedCountry, 'sg');
  assert.equal(r.model?.statedVerified, false);
  assert.equal(r.claims?.dropped, 1);
  assert.equal(r.claims?.nonVerbatimQuotes, 1);
  assert.equal(r.resolved?.audienceCountry, 'id');
  assert.ok(!JSON.stringify(r).includes('Singapore fans'));
});

test('a model "national" with no nationwide wording is downgraded and both values are kept for the scorer', () => {
  const r = evaluateRun({ id: 'a3', run: 2, caption: 'Pameran di Galeri Nasional, gratis', rawText: answer({ geoScope: 'national' }), usage });
  assert.equal(r.model?.geoScopeRaw, 'national');
  assert.equal(r.model?.geoScope, 'unspecified');
});

test('sensitive: the model flag, the word list, or both', () => {
  const caption = 'Pengajian akbar dan gema sholawat';
  assert.equal(evaluateRun({ id: 'a4', run: 1, caption, rawText: answer({ sensitiveTopic: 'religion' }), usage }).resolved?.sensitiveSource, 'both');
  assert.equal(evaluateRun({ id: 'a4', run: 2, caption, rawText: answer(), usage }).resolved?.sensitiveSource, 'list');
  assert.equal(evaluateRun({ id: 'a4', run: 3, caption: 'Fun run', rawText: answer({ sensitiveTopic: 'religion' }), usage }).resolved?.sensitiveSource, 'model');
  assert.equal(evaluateRun({ id: 'a4', run: 4, caption: 'Fun run', rawText: answer(), usage }).resolved?.sensitive, 'none');
});

test('a malformed answer becomes a failed record with reasons, never an exception', () => {
  assert.equal(evaluateRun({ id: 'b', run: 1, caption: 'x', rawText: 'not json', usage }).ok, false);
  const bad = evaluateRun({ id: 'b', run: 1, caption: 'x', rawText: answer({ geoScope: 'galaxy' }), usage });
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.errors, ['geoScope']);
  assert.equal(evaluateRun({ id: 'b', run: 1, caption: 'x', rawText: '```json\n' + answer() + '\n```', usage }).ok, true, 'a fenced answer is accepted');
});

test('the held-out half runs only against labels that hash to the frozen value', () => {
  const sheet = Buffer.from('id,audience_country\nabc,id\n');
  const good = `${sha256(sheet)}  labels-final.csv\n`;
  assert.deepEqual(runGate('tuning', {}), { allowed: true });
  assert.equal(runGate('heldout', {}).allowed, false);
  assert.deepEqual(runGate('heldout', { sheetContent: sheet, hashFileContent: good }), { allowed: true });
  assert.deepEqual(runGate('all', { sheetContent: sheet, hashFileContent: good }), { allowed: true });
  const edited = Buffer.from('id,audience_country\nabc,my\n');
  const r = runGate('heldout', { sheetContent: edited, hashFileContent: good });
  assert.equal(r.allowed, false);
  assert.match((r as { reason: string }).reason, /changed after they were frozen/);
  assert.equal(frozenHashOf(good), sha256(sheet));
});

test('merging keeps a good record over a later failed one, and sorts by id and run', () => {
  const rec = (id: string, run: number, ok: boolean): RunRecord => ({ id, run, ok, errors: ok ? [] : ['x'], usage });
  const merged = mergeRecords([rec('b', 1, true), rec('a', 2, true)], [rec('b', 1, false), rec('a', 1, true), rec('a', 2, true)]);
  assert.deepEqual(merged.map((r) => `${r.id}#${r.run}:${r.ok}`), ['a#1:true', 'a#2:true', 'b#1:true']);
  const retried = mergeRecords([rec('c', 1, false)], [rec('c', 1, true)]);
  assert.equal(retried[0].ok, true);
});
