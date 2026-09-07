import test from 'node:test';
import * as assert from 'node:assert';
import { buildCorrectionClassificationText } from './build-correction-classification-text.js';
import { EventType, EventCategory } from '@festgrid/shared-types';
import type { ProposedEventCorrection } from './types.js';

function baseData(overrides: Partial<ProposedEventCorrection> = {}): ProposedEventCorrection {
  return {
    eventName: 'Event Name',
    types: [EventType.OTHER],
    categories: [EventCategory.OTHER],
    location: 'Somewhere',
    schedules: [],
    ...overrides,
  };
}

test('buildCorrectionClassificationText', async (t) => {
  await t.test('includes all four source-field kinds: eventName, description, schedule title, schedule location', () => {
    const text = buildCorrectionClassificationText(
      baseData({
        eventName: 'Lomba Tari Anak',
        description: 'A fun event for kids',
        schedules: [
          {
            isMainSchedule: true,
            eventStartDate: '2026-01-01',
            title: 'Opening Ceremony',
            location: 'Sanggar Budaya',
          },
        ],
      })
    );

    assert.match(text, /Lomba Tari Anak/);
    assert.match(text, /A fun event for kids/);
    assert.match(text, /Opening Ceremony/);
    assert.match(text, /Sanggar Budaya/);
  });

  await t.test('concatenates across multiple schedules', () => {
    const text = buildCorrectionClassificationText(
      baseData({
        schedules: [
          { isMainSchedule: true, eventStartDate: '2026-01-01', title: 'Day 1 Title', location: 'Venue A' },
          { isMainSchedule: false, eventStartDate: '2026-01-02', title: 'Day 2 Title', location: 'Venue B' },
        ],
      })
    );

    assert.match(text, /Day 1 Title/);
    assert.match(text, /Venue A/);
    assert.match(text, /Day 2 Title/);
    assert.match(text, /Venue B/);
  });

  await t.test('missing/optional fields do not throw or add literal "undefined"', () => {
    const text = buildCorrectionClassificationText(
      baseData({
        description: undefined,
        schedules: [{ isMainSchedule: true, eventStartDate: '2026-01-01' }],
      })
    );

    assert.doesNotMatch(text, /undefined/);
  });

  await t.test('handles an empty schedules array without throwing', () => {
    const text = buildCorrectionClassificationText(baseData({ schedules: [] }));
    assert.strictEqual(text, 'Event Name');
  });
});
