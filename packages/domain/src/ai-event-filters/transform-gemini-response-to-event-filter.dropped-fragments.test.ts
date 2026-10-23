import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { transformGeminiResponseToEventFilter } from './transform-gemini-response-to-event-filter.js';

function run(payload: unknown): { result: ReturnType<typeof transformGeminiResponseToEventFilter>; dropped: string[] } {
  const dropped: string[] = [];
  const result = transformGeminiResponseToEventFilter(payload, (message) => dropped.push(message));
  return { result, dropped };
}

describe('transformGeminiResponseToEventFilter reports what it drops', () => {
  it('reports a weekday string it does not recognise', () => {
    const { result, dropped } = run({ dayOfWeek: 'FUNDAY' });
    assert.equal(result.dayOfWeek, undefined);
    assert.deepEqual(dropped, ['The weekday in your prompt was not recognised and was ignored.']);
  });

  it('reports an isFree value it does not understand, and accepts booleans and "true"/"false"', () => {
    const { result, dropped } = run({ isFree: 'maybe' });
    assert.equal(result.isFree, undefined);
    assert.deepEqual(dropped, ['The free/paid setting in your prompt was not understood and was ignored.']);

    assert.equal(run({ isFree: true }).result.isFree, true);
    assert.equal(run({ isFree: 'false' }).result.isFree, false);
    assert.deepEqual(run({}).dropped, []);
  });
});
