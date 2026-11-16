import test from 'node:test';
import assert from 'node:assert';
import { classifyGeminiOutput } from './gemini-output-signals.js';

test('classifyGeminiOutput', async (t) => {
  await t.test('a normal STOP response is not at risk', () => {
    assert.deepStrictEqual(classifyGeminiOutput({ finishReason: 'STOP', outputTokens: 900, maxOutputTokens: 8192 }), []);
  });

  await t.test('MAX_TOKENS is at risk', () => {
    assert.deepStrictEqual(classifyGeminiOutput({ finishReason: 'MAX_TOKENS' }), ['max_tokens']);
  });

  await t.test('output at 90% of the cap is at risk, just below is not', () => {
    assert.deepStrictEqual(classifyGeminiOutput({ finishReason: 'STOP', outputTokens: 7373, maxOutputTokens: 8192 }), ['output_near_limit']);
    assert.deepStrictEqual(classifyGeminiOutput({ finishReason: 'STOP', outputTokens: 7372, maxOutputTokens: 8192 }), []);
  });

  await t.test('MAX_TOKENS at the cap reports both reasons', () => {
    assert.deepStrictEqual(
      classifyGeminiOutput({ finishReason: 'MAX_TOKENS', outputTokens: 8192, maxOutputTokens: 8192 }),
      ['max_tokens', 'output_near_limit']
    );
  });

  await t.test('thinking tokens count toward the cap', () => {
    assert.deepStrictEqual(
      classifyGeminiOutput({ finishReason: 'STOP', outputTokens: 3000, thinkingTokens: 4400, maxOutputTokens: 8192 }),
      ['output_near_limit']
    );
    assert.deepStrictEqual(classifyGeminiOutput({ finishReason: 'STOP', outputTokens: 3000, thinkingTokens: 1000, maxOutputTokens: 8192 }), []);
  });

  await t.test('missing metadata or a missing cap is never at risk', () => {
    assert.deepStrictEqual(classifyGeminiOutput({}), []);
    assert.deepStrictEqual(classifyGeminiOutput({ outputTokens: 8000 }), []);
    assert.deepStrictEqual(classifyGeminiOutput({ outputTokens: 8000, maxOutputTokens: 0 }), []);
  });
});
