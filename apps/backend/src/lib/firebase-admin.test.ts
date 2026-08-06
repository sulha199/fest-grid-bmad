import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import { buildPushMessage } from './firebase-admin';

describe('Firebase Admin helper tests', () => {
  test('buildPushMessage correctly shapes the FCM message object with all fields', () => {
    const deviceToken = 'test-token-123';
    const notification = {
      title: 'New FestGrid Event!',
      body: 'Check out the details now.',
    };
    const data = {
      eventId: '456',
      type: 'EXTRACTED',
    };

    const result = buildPushMessage(deviceToken, notification, data);

    assert.deepStrictEqual(result, {
      token: 'test-token-123',
      notification: {
        title: 'New FestGrid Event!',
        body: 'Check out the details now.',
      },
      data: {
        eventId: '456',
        type: 'EXTRACTED',
      },
    });
  });

  test('buildPushMessage omits the data property if not provided or empty', () => {
    const deviceToken = 'test-token-123';
    const notification = {
      title: 'Only Notification',
      body: 'No extra data.',
    };

    const result = buildPushMessage(deviceToken, notification);

    assert.deepStrictEqual(result, {
      token: 'test-token-123',
      notification: {
        title: 'Only Notification',
        body: 'No extra data.',
      },
    });

    const resultWithEmptyData = buildPushMessage(deviceToken, notification, {});
    assert.deepStrictEqual(resultWithEmptyData, {
      token: 'test-token-123',
      notification: {
        title: 'Only Notification',
        body: 'No extra data.',
      },
    });
  });
});
