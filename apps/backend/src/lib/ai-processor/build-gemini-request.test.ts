import test from 'node:test';
import * as assert from 'node:assert';
import { buildGeminiExtractionRequest } from './build-gemini-request.js';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';

test('buildGeminiExtractionRequest unit tests', async (t) => {
  const originalFetch = globalThis.fetch;

  t.afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  await t.test('Case A: image-absent path uses text-only contents', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-1',
      accountId: 'account-1',
      content: 'This is an awesome concert on August 15th!',
      postUrl: 'https://test.com/post1',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.strictEqual(result.request.contents, message.content);
    assert.strictEqual(result.request.responseMimeType, 'application/json');
    assert.ok(result.request.systemInstruction?.includes('PERFORMANCE')); // verify systemInstruction exists and lists types
    assert.strictEqual(result.imageBytes, undefined);
    assert.strictEqual(result.imageContentType, undefined);
  });

  await t.test('Case B: image-present success path uses multi-part contents with base64 data', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-2',
      accountId: 'account-2',
      content: 'Multi-part event caption!',
      imageUrl: 'https://test.com/poster.png',
      postUrl: 'https://test.com/post2',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    // Mock fetch
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      return {
        ok: true,
        headers: {
          get: (name: string) => (name.toLowerCase() === 'content-type' ? 'image/png' : null)
        },
        arrayBuffer: async () => Buffer.from('fake-image-bytes')
      } as any;
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.ok(Array.isArray(result.request.contents));
    assert.strictEqual(result.request.contents.length, 2);
    assert.strictEqual(result.request.contents[0].text, message.content);
    assert.strictEqual(result.request.contents[1].inlineData.mimeType, 'image/png');
    assert.strictEqual(result.request.contents[1].inlineData.data, Buffer.from('fake-image-bytes').toString('base64'));
    assert.deepEqual(result.imageBytes, Buffer.from('fake-image-bytes'));
    assert.strictEqual(result.imageContentType, 'image/png');
  });

  await t.test('Case C: image-fetch-failure path falls back to text-only contents', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-3',
      accountId: 'account-3',
      content: 'Failed fetch image caption!',
      imageUrl: 'https://test.com/broken.png',
      postUrl: 'https://test.com/post3',
      publishedAt: '2026-08-10T12:00:00Z'
    };

    // Mock fetch to return a failure status
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit) => {
      return {
        ok: false,
        status: 404
      } as any;
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.strictEqual(result.request.contents, message.content);
    assert.strictEqual(result.imageBytes, undefined);
    assert.strictEqual(result.imageContentType, undefined);
  });

  await t.test('Case D: systemInstruction contains the publish-date anchor and instructions', async () => {
    const message: ProcessingJobMessage = {
      postId: 'post-4',
      accountId: 'account-4',
      content: 'Get up to 20% off all your beauty faves from 27-30 Aug.',
      postUrl: 'https://test.com/post4',
      publishedAt: '2026-08-27T15:30:00Z'
    };

    const result = await buildGeminiExtractionRequest(message);

    assert.ok(result.request.systemInstruction?.includes('2026-08-27'));
    assert.ok(result.request.systemInstruction?.includes('anchor for date and year inference'));
    assert.ok(result.request.systemInstruction?.includes('never infer a year that would place the event further in the past'));
  });
});
