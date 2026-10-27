import test from 'node:test';
import assert from 'node:assert';
import { getScheduledCycleTime } from './scheduled-cycle-time.js';

// The shape EventBridge delivers for the `rate(1 day)` ScraperScheduleRule (2026-10-24 03:13 UTC).
const scheduledEvent = {
  version: '0',
  id: 'a1b2c3d4-0000-0000-0000-000000000000',
  'detail-type': 'Scheduled Event',
  source: 'aws.events',
  account: '123456789012',
  time: '2026-10-24T03:13:12Z',
  region: 'ap-southeast-1',
  resources: ['arn:aws:events:ap-southeast-1:123456789012:rule/ScraperScheduleRule'],
  detail: {},
};

test('getScheduledCycleTime', async (t) => {
  await t.test('reads the fire time of a real EventBridge scheduled event', () => {
    assert.strictEqual(getScheduledCycleTime(scheduledEvent)?.toISOString(), '2026-10-24T03:13:12.000Z');
  });

  await t.test('an empty manual invoke is not a scheduled cycle', () => {
    assert.strictEqual(getScheduledCycleTime({}), undefined);
  });

  await t.test('other EventBridge or job payloads are not scheduled cycles', () => {
    assert.strictEqual(getScheduledCycleTime({ ...scheduledEvent, source: 'my.app' }), undefined);
    assert.strictEqual(getScheduledCycleTime({ ...scheduledEvent, 'detail-type': 'Custom' }), undefined);
    assert.strictEqual(getScheduledCycleTime({ jobType: 'stale-job-sweep' }), undefined);
  });

  await t.test('a scheduled-looking event with a missing or unparseable time falls back to manual behaviour', () => {
    const { time: _time, ...noTime } = scheduledEvent;
    assert.strictEqual(getScheduledCycleTime(noTime), undefined);
    assert.strictEqual(getScheduledCycleTime({ ...scheduledEvent, time: 'not-a-date' }), undefined);
    assert.strictEqual(getScheduledCycleTime({ ...scheduledEvent, time: 12345 }), undefined);
  });

  await t.test('non-object input is tolerated', () => {
    assert.strictEqual(getScheduledCycleTime(null), undefined);
    assert.strictEqual(getScheduledCycleTime(undefined), undefined);
    assert.strictEqual(getScheduledCycleTime('aws.events'), undefined);
  });
});
