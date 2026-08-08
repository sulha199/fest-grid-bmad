import test from 'node:test';
import assert from 'node:assert/strict';
import { renderEmailTemplate } from './render-template.js';

test('renderEmailTemplate tests', async (t) => {
  await t.test('renders QUOTA_EXHAUSTION_WARNING correctly', () => {
    const result = renderEmailTemplate('QUOTA_EXHAUSTION_WARNING', {
      userName: 'Maria',
      queuedPostCount: 3,
      queuedDays: 5,
      apiKeyManagementUrl: 'https://festdaily.app/api-keys',
    });

    assert.ok(result.subject.includes('FestDaily'));
    assert.ok(result.html.includes('Maria'));
    assert.ok(result.html.includes('3'));
    assert.ok(result.html.includes('5'));
    assert.ok(result.html.includes('https://festdaily.app/api-keys'));
    assert.ok(result.text.includes('Maria'));
    assert.ok(result.text.includes('3'));
    assert.ok(result.text.includes('5'));
    assert.ok(result.text.includes('https://festdaily.app/api-keys'));
  });

  await t.test('renders INVALID_API_KEY_ALERT correctly', () => {
    const result = renderEmailTemplate('INVALID_API_KEY_ALERT', {
      userName: 'John',
      invalidAttemptCount: 5,
      apiKeyManagementUrl: 'https://festdaily.app/api-keys',
    });

    assert.ok(result.subject.includes('FestDaily'));
    assert.ok(result.html.includes('John'));
    assert.ok(result.html.includes('5'));
    assert.ok(result.html.includes('https://festdaily.app/api-keys'));
    assert.ok(result.text.includes('John'));
    assert.ok(result.text.includes('5'));
    assert.ok(result.text.includes('https://festdaily.app/api-keys'));
  });

  await t.test('renders DANGEROUS_EVENT_MODERATOR_ALERT correctly', () => {
    const result = renderEmailTemplate('DANGEROUS_EVENT_MODERATOR_ALERT', {
      eventName: 'Dangerous Music Festival',
      moderatorReviewUrl: 'https://festdaily.app/moderation',
    });

    assert.ok(result.subject.includes('Dangerous Music Festival'));
    assert.ok(result.html.includes('Dangerous Music Festival'));
    assert.ok(result.html.includes('https://festdaily.app/moderation'));
    assert.ok(result.text.includes('Dangerous Music Festival'));
    assert.ok(result.text.includes('https://festdaily.app/moderation'));
  });

  await t.test('renders SYSTEM_ERROR_ALERT correctly', () => {
    const result = renderEmailTemplate('SYSTEM_ERROR_ALERT', {
      source: 'service-worker',
      message: 'Failed to register SW',
      context: 'Some detailed stack trace',
      timestamp: '2026-08-08T15:10:00Z',
    });

    assert.ok(result.subject.includes('[FestDaily System Alert]'));
    assert.ok(result.subject.includes('service-worker'));
    assert.ok(result.html.includes('service-worker'));
    assert.ok(result.html.includes('Failed to register SW'));
    assert.ok(result.html.includes('Some detailed stack trace'));
    assert.ok(result.html.includes('2026-08-08T15:10:00Z'));
    assert.ok(result.text.includes('service-worker'));
    assert.ok(result.text.includes('Failed to register SW'));
    assert.ok(result.text.includes('Some detailed stack trace'));
    assert.ok(result.text.includes('2026-08-08T15:10:00Z'));
  });

  await t.test('renders DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT correctly', () => {
    const result = renderEmailTemplate('DEFAULT_LOCATION_CHANGE_MODERATOR_ALERT', {
      accountDisplayName: 'Some Influencer',
      previousLocationText: 'Jakarta, Indonesia',
      newLocationText: 'Denpasar, Indonesia',
      moderatorReviewUrl: 'https://festdaily.app/moderator/items',
    });

    assert.ok(result.subject.includes('Some Influencer'));
    assert.ok(result.html.includes('Some Influencer'));
    assert.ok(result.html.includes('Jakarta, Indonesia'));
    assert.ok(result.html.includes('Denpasar, Indonesia'));
    assert.ok(result.html.includes('https://festdaily.app/moderator/items'));
    assert.ok(result.text.includes('Some Influencer'));
    assert.ok(result.text.includes('Jakarta, Indonesia'));
    assert.ok(result.text.includes('Denpasar, Indonesia'));
    assert.ok(result.text.includes('https://festdaily.app/moderator/items'));
  });

  await t.test('throws descriptive error if template is called with missing variable', () => {
    assert.throws(() => {
      // @ts-expect-error - testing missing variables runtime checks
      renderEmailTemplate('QUOTA_EXHAUSTION_WARNING', {
        userName: 'Maria',
        queuedPostCount: 3,
        // queuedDays is missing
        apiKeyManagementUrl: 'https://festdaily.app/api-keys',
      });
    }, /Missing required template variables for "QUOTA_EXHAUSTION_WARNING": queuedDays/);

    assert.throws(() => {
      // @ts-expect-error - testing missing variables runtime checks
      renderEmailTemplate('SYSTEM_ERROR_ALERT', {
        source: 'service-worker',
        message: 'Failed to register SW',
        context: 'Some detailed stack trace',
        // timestamp is missing
      });
    }, /Missing required template variables for "SYSTEM_ERROR_ALERT": timestamp/);
  });

  await t.test('handles multiple occurrences of same placeholder (if any)', () => {
    // Let's verify that DANGEROUS_EVENT_MODERATOR_ALERT renders eventName in both subject and html
    const result = renderEmailTemplate('DANGEROUS_EVENT_MODERATOR_ALERT', {
      eventName: 'My Event',
      moderatorReviewUrl: 'http://test.com',
    });
    
    // We see in DANGEROUS_EVENT_MODERATOR_ALERT that {{eventName}} is in subject, html and text.
    assert.ok(result.subject.includes('My Event'));
    assert.ok(result.html.includes('My Event'));
    assert.ok(result.text.includes('My Event'));
  });
});
