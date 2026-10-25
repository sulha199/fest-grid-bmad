import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateStubRepeat, type StubRepeatInput } from './match-scoring.js';

function input(overrides: Partial<StubRepeatInput> = {}): StubRepeatInput {
  return {
    newIsStub: true,
    candidateIsStub: true,
    newEventName: 'Christmas Night Market',
    candidateEventName: 'Christmas Night Market',
    newSchedules: [{ eventStartDate: '2026-12-24' }],
    candidateSchedules: [{ eventStartDate: '2026-12-24' }],
    ...overrides,
  };
}

test('venues that differ by coordinates alone (no text on either side) are different venues', () => {
  assert.equal(
    evaluateStubRepeat(
      input({
        newSchedules: [{ eventStartDate: '2026-12-24', latitude: -6.2, longitude: 106.8 }],
        candidateSchedules: [{ eventStartDate: '2026-12-24', latitude: -7.26, longitude: 112.74 }],
      })
    ),
    'venue-differs'
  );
});

test('venue unknown on one side is reported the same whichever side states it', () => {
  const stated = { eventStartDate: '2026-12-24', location: 'Grand Mall Jakarta' };
  const none = { eventStartDate: '2026-12-24' };
  assert.equal(evaluateStubRepeat(input({ newSchedules: [stated], candidateSchedules: [none] })), 'venue-unknown-one-side');
  assert.equal(evaluateStubRepeat(input({ newSchedules: [none], candidateSchedules: [stated] })), 'venue-unknown-one-side');
});

test('schedules without a start date never pair, so there is no same-date pair', () => {
  assert.equal(
    evaluateStubRepeat(input({ newSchedules: [{ eventStartDate: null, location: 'Hall A' }], candidateSchedules: [{ eventStartDate: null, location: 'Hall A' }] })),
    'no-same-date'
  );
  assert.equal(evaluateStubRepeat(input({ newSchedules: [], candidateSchedules: [] })), 'no-same-date');
});

test('a name that is only a year or symbols never matches', () => {
  assert.equal(evaluateStubRepeat(input({ newEventName: '2026', candidateEventName: '2026' })), 'name-differs');
  assert.equal(evaluateStubRepeat(input({ newEventName: '!!!', candidateEventName: '!!!' })), 'name-differs');
});
