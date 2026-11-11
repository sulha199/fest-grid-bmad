import test from 'node:test';
import assert from 'node:assert/strict';
import { runJobEngineSweep, type JobEngineSweepSteps } from './run-job-engine-sweep.js';

// Story 10.1a Task 4 + Story 10.3 Task 6 -- the 5-minute sweep runs every step in order, each in its own try/catch.

const ORDER = ['expire', 'expireQueued', 'settleFollowers', 'readmit', 'promote', 'reinvoke', 'retention'];

function steps(calls: string[], fail: string[] = [], counts: number = 0): JobEngineSweepSteps {
  const counted = (name: string) => async () => {
    calls.push(name);
    if (fail.includes(name)) throw new Error(`${name} blip`);
    return counts;
  };
  return {
    expireJobs: counted('expire'),
    expireQueuedJobs: counted('expireQueued'),
    settleFollowers: counted('settleFollowers'),
    readmitWaitingJobs: counted('readmit'),
    promoteQueuedJobs: counted('promote'),
    reinvokeStranded: counted('reinvoke'),
    retention: async () => {
      calls.push('retention');
      if (fail.includes('retention')) throw new Error('retention blip');
    },
  };
}

test('runJobEngineSweep runs every step in order: expiries, followers, re-admission, promotion, retention', async () => {
  const calls: string[] = [];
  await runJobEngineSweep(steps(calls, [], 2));
  assert.deepEqual(calls, ORDER);
});

test('any one step failing does not skip the others and the sweep does not throw', async () => {
  for (const failing of ORDER) {
    const calls: string[] = [];
    await runJobEngineSweep(steps(calls, [failing]));
    assert.deepEqual(calls, ORDER, `${failing} failing`);
  }
});
