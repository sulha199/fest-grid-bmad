import test from 'node:test';
import assert from 'node:assert/strict';
import {
  postGroupingReasonToGraphQL,
  POST_GROUPING_REASONS,
  MANUAL_EXTRACTION_JOB_STATUSES,
  isManualExtractionJobTerminal,
} from './types.js';

test('postGroupingReasonToGraphQL - maps every DB grouping reason to its GraphQL enum member (Story 3.6u)', () => {
  assert.equal(postGroupingReasonToGraphQL('single-event'), 'SINGLE_EVENT');
  assert.equal(postGroupingReasonToGraphQL('program-lineup'), 'PROGRAM_LINEUP');
  assert.equal(postGroupingReasonToGraphQL('dependent-stages'), 'DEPENDENT_STAGES');
  assert.equal(postGroupingReasonToGraphQL('separate-events'), 'SEPARATE_EVENTS');
  assert.equal(postGroupingReasonToGraphQL('roundup'), 'ROUNDUP');
});

test('postGroupingReasonToGraphQL - covers every member of the closed POST_GROUPING_REASONS vocabulary (no silently-unmapped value)', () => {
  for (const reason of POST_GROUPING_REASONS) {
    const mapped = postGroupingReasonToGraphQL(reason);
    assert.equal(typeof mapped, 'string');
    assert.ok(mapped.length > 0);
  }
});

test('isManualExtractionJobTerminal - only SUCCEEDED and FAILED are terminal (Story 4.2b)', () => {
  const terminal = MANUAL_EXTRACTION_JOB_STATUSES.filter(isManualExtractionJobTerminal);
  assert.deepEqual(terminal, ['SUCCEEDED', 'FAILED']);
  assert.equal(isManualExtractionJobTerminal('PENDING'), false);
  assert.equal(isManualExtractionJobTerminal('PROCESSING'), false);
});
