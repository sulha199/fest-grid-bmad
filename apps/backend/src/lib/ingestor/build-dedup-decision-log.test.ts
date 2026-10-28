import test from 'node:test';
import * as assert from 'node:assert';
import { buildDedupDecisionLog, DEDUP_DECISION_LOG_EVENT } from './build-dedup-decision-log.js';
import type { MatchResult } from '../events/match-event-to-existing.js';

function matchResult(overrides: Partial<Omit<MatchResult, 'candidate'>> = {}, signals: Partial<MatchResult['signals']> = {}): MatchResult {
  return {
    candidate: { id: 'candidate-id', eventName: 'A Private Event Name' } as MatchResult['candidate'],
    score: 0.65,
    tier: 'high',
    ...overrides,
    signals: {
      scoredTier: 'mid',
      promotedByRule: true,
      promotionRule: 'mid-to-high',
      stubRepeat: false,
      nameSimilarity: 1,
      minDayDiff: 0,
      organizerMatch: true,
      sharedLink: false,
      venueMatch: false,
      venueConflict: false,
      ...signals,
    },
  };
}

test('buildDedupDecisionLog', async (t) => {
  await t.test('a promoted high is a linked outcome that carries the promotion flag and every signal', () => {
    const log = buildDedupDecisionLog(matchResult(), null, 'post-1');
    assert.deepStrictEqual(log, {
      event: DEDUP_DECISION_LOG_EVENT,
      outcome: 'linked',
      tier: 'high',
      scoredTier: 'mid',
      score: 0.65,
      promotedByRule: true,
      promotionRule: 'mid-to-high',
      nameSimilarity: 1,
      minDayDiff: 0,
      organizerMatch: true,
      sharedLink: false,
      venueMatch: false,
      venueConflict: false,
      candidateEventId: 'candidate-id',
      newEventId: null,
      postId: 'post-1',
    });
  });

  await t.test('a stub repeat is attributed to its own rule, scored low, with the organizer discount visible', () => {
    const log = buildDedupDecisionLog(
      matchResult({ score: 0.4 }, { scoredTier: 'low', promotionRule: 'stub-repeat', stubRepeat: true, organizerMatch: false, venueMatch: true }),
      null,
      'post-1'
    );
    assert.strictEqual(log.outcome, 'linked');
    assert.strictEqual(log.scoredTier, 'low');
    assert.strictEqual(log.promotedByRule, true);
    assert.strictEqual(log.promotionRule, 'stub-repeat');
    assert.strictEqual(log.organizerMatch, false);
  });

  await t.test('a score-only decision carries a null promotion rule', () => {
    const log = buildDedupDecisionLog(matchResult({}, { promotedByRule: false, promotionRule: null }), null, 'p');
    assert.strictEqual(log.promotionRule, null);
    assert.strictEqual(buildDedupDecisionLog(null, 'n', 'p').promotionRule, null);
  });

  await t.test('mid is queued and low is new, both with the inserted event id', () => {
    assert.strictEqual(buildDedupDecisionLog(matchResult({ tier: 'mid' }), 'new-id', 'p').outcome, 'queued');
    const low = buildDedupDecisionLog(matchResult({ tier: 'low' }), 'new-id', 'p');
    assert.strictEqual(low.outcome, 'new');
    assert.strictEqual(low.newEventId, 'new-id');
  });

  await t.test('no candidate logs a null-signal "none" decision so the rate has a denominator', () => {
    const log = buildDedupDecisionLog(null, 'new-id', 'post-1');
    assert.strictEqual(log.outcome, 'new');
    assert.strictEqual(log.tier, 'none');
    assert.strictEqual(log.score, null);
    assert.strictEqual(log.candidateEventId, null);
    assert.strictEqual(log.newEventId, 'new-id');
  });

  await t.test('an unusable date pair (Infinity) is logged as null, not as a non-JSON number', () => {
    const log = buildDedupDecisionLog(matchResult({}, { minDayDiff: Infinity }), null, 'p');
    assert.strictEqual(log.minDayDiff, null);
  });

  await t.test('is a single JSON line that carries no event name or account id', () => {
    const line = JSON.stringify(buildDedupDecisionLog(matchResult(), null, 'post-1'));
    assert.ok(line.startsWith('{"event":"event_dedup_decision"'));
    assert.ok(!line.includes('A Private Event Name'));
    assert.ok(!line.includes('\n'));
  });
});
