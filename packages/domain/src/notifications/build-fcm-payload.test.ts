import test from 'node:test';
import * as assert from 'node:assert';
import { buildFcmPayload } from './build-fcm-payload.js';

test('buildFcmPayload unit tests', async (t) => {
  await t.test('Case 1: formats payload correctly with short description', () => {
    const event = {
      id: 'event-123',
      slug: 'awesome-event',
      name: 'Awesome Event',
      description: 'A short description of the awesome event.'
    };
    const tokens = ['token-1', 'token-2'];

    const result = buildFcmPayload(event, tokens);

    assert.deepStrictEqual(result, {
      tokens: ['token-1', 'token-2'],
      notification: {
        title: 'Awesome Event',
        body: 'A short description of the awesome event.'
      },
      data: {
        eventId: 'event-123',
        slug: 'awesome-event',
        type: 'NEW_EVENT'
      }
    });
  });

  await t.test('Case 2: truncates long description safely with ellipsis', () => {
    const longDescription = 'A'.repeat(200);
    const event = {
      id: 'event-123',
      slug: 'awesome-event',
      name: 'Awesome Event',
      description: longDescription
    };
    const tokens = ['token-1'];

    const result = buildFcmPayload(event, tokens);

    assert.strictEqual(result.notification.body.length, 153); // 150 chars + 3 dots
    assert.ok(result.notification.body.endsWith('...'));
    assert.strictEqual(result.notification.body.substring(0, 150), 'A'.repeat(150));
  });

  await t.test('Case 3: handles null or undefined description safely', () => {
    const event = {
      id: 'event-123',
      slug: 'awesome-event',
      name: 'Awesome Event',
      description: undefined
    };
    const tokens = ['token-1'];

    const result = buildFcmPayload(event, tokens);

    assert.strictEqual(result.notification.body, '');
  });
});
