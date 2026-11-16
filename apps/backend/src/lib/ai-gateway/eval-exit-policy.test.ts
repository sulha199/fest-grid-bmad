import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { evalExitCode } from './eval-exit-policy.js';

describe('evalExitCode', () => {
  it('stays green when every fixture matched', () => {
    assert.equal(evalExitCode({ evaluated: 10, driftedFixtures: 0, driftedVariants: 0 }), 0);
  });

  it('stays green on drift, in fixtures or in variants: drift is reported as a warning, not a failure', () => {
    assert.equal(evalExitCode({ evaluated: 7, driftedFixtures: 7, driftedVariants: 0 }), 0);
    assert.equal(evalExitCode({ evaluated: 7, driftedFixtures: 0, driftedVariants: 5 }), 0);
  });

  it('stays green when the run stopped early after answering some fixtures (routine quota/budget stop)', () => {
    assert.equal(
      evalExitCode({ evaluated: 7, driftedFixtures: 7, driftedVariants: 5, stoppedReason: 'the 20-call budget is spent' }),
      0
    );
  });

  it('fails when the run stopped before a single fixture was answered', () => {
    assert.equal(evalExitCode({ evaluated: 0, driftedFixtures: 0, driftedVariants: 0, stoppedReason: 'per-day quota is exhausted' }), 1);
  });

  it('fails on drift only when failOnDrift is set', () => {
    assert.equal(evalExitCode({ evaluated: 7, driftedFixtures: 1, driftedVariants: 0, failOnDrift: true }), 1);
    assert.equal(evalExitCode({ evaluated: 7, driftedFixtures: 0, driftedVariants: 1, failOnDrift: true }), 1);
    assert.equal(evalExitCode({ evaluated: 7, driftedFixtures: 0, driftedVariants: 0, failOnDrift: true }), 0);
  });
});
