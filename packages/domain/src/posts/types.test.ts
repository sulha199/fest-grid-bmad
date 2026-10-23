import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isManualExtractionJobTerminal,
  isPostGroupingReason,
  MANUAL_EXTRACTION_JOB_STATUSES,
  POST_GROUPING_REASONS,
  postGroupingReasonToGraphQL,
  PostAlreadyExtractedError,
  PostAlreadyQueuedError,
  PostNotFoundError,
} from './types.js';

test('isPostGroupingReason accepts every known reason and nothing else', () => {
  for (const reason of POST_GROUPING_REASONS) {
    assert.equal(isPostGroupingReason(reason), true);
  }
  assert.equal(isPostGroupingReason('not-a-reason'), false);
  assert.equal(isPostGroupingReason(''), false);
});

for (const [ErrorClass, name, defaultMessage] of [
  [PostNotFoundError, 'PostNotFoundError', 'Post not found'],
  [PostAlreadyExtractedError, 'PostAlreadyExtractedError', 'Post has already been extracted'],
  [PostAlreadyQueuedError, 'PostAlreadyQueuedError', 'Post is already queued for extraction'],
] as const) {
  test(`${name} carries its name and a default message`, () => {
    const error = new ErrorClass();
    assert.ok(error instanceof Error);
    assert.equal(error.name, name);
    assert.equal(error.message, defaultMessage);
  });

  test(`${name} prefers an explicit message`, () => {
    assert.equal(new ErrorClass('custom').message, 'custom');
  });
}

test('isManualExtractionJobTerminal is true only for SUCCEEDED and FAILED', () => {
  const terminal = MANUAL_EXTRACTION_JOB_STATUSES.filter(isManualExtractionJobTerminal);
  assert.deepEqual(terminal, ['SUCCEEDED', 'FAILED']);
});

test('postGroupingReasonToGraphQL maps every reason to its GraphQL enum literal', () => {
  assert.deepEqual(
    POST_GROUPING_REASONS.map(postGroupingReasonToGraphQL),
    ['SINGLE_EVENT', 'PROGRAM_LINEUP', 'DEPENDENT_STAGES', 'SEPARATE_EVENTS', 'ROUNDUP']
  );
});
