import test from 'node:test';
import assert from 'node:assert/strict';
import { runJobEngineSweep } from './run-job-engine-sweep.js';

// Story 10.1a Task 4 -- the 5-minute sweep runs both halves, each in its own try/catch.

test('runJobEngineSweep runs both halves in order', async () => {
  const calls: string[] = [];
  await runJobEngineSweep({
    expireJobs: async () => {
      calls.push('expire');
      return 0;
    },
    retention: async () => {
      calls.push('retention');
    },
  });
  assert.deepEqual(calls, ['expire', 'retention']);
});

test('one half failing does not skip the other and the sweep does not throw', async () => {
  const calls: string[] = [];
  await runJobEngineSweep({
    expireJobs: async () => {
      calls.push('expire');
      throw new Error('db blip');
    },
    retention: async () => {
      calls.push('retention');
    },
  });
  assert.deepEqual(calls, ['expire', 'retention']);

  const calls2: string[] = [];
  await runJobEngineSweep({
    expireJobs: async () => {
      calls2.push('expire');
      return 1;
    },
    retention: async () => {
      calls2.push('retention');
      throw new Error('another blip');
    },
  });
  assert.deepEqual(calls2, ['expire', 'retention']);
});
