import test from 'node:test';
import assert from 'node:assert/strict';
import { selectDisplaySchedule, type SelectableSchedule } from './selectDisplaySchedule.js';

const NOW = new Date('2026-06-01T12:00:00Z');

function schedule(id: string, overrides: Partial<SelectableSchedule> = {}): SelectableSchedule {
  return { id, isMainSchedule: false, eventStartDate: '2026-07-01', ...overrides };
}

test('selectDisplaySchedule breaks a same-date tie by start time, with a missing time sorting last', () => {
  const untimed = schedule('untimed');
  const evening = schedule('evening', { eventStartTime: '20:00:00' });
  const morning = schedule('morning', { eventStartTime: '09:00:00' });

  assert.equal(selectDisplaySchedule([untimed, evening], NOW)?.id, 'evening');
  assert.equal(selectDisplaySchedule([evening, untimed], NOW)?.id, 'evening');
  assert.equal(selectDisplaySchedule([evening, morning], NOW)?.id, 'morning');
  assert.equal(selectDisplaySchedule([morning, evening], NOW)?.id, 'morning');
});

test('selectDisplaySchedule treats an undefined start time like a null one', () => {
  const undefinedTime = schedule('undefined-time', { eventStartTime: undefined });
  const nullTime = schedule('null-time', { eventStartTime: null });
  const timed = schedule('timed', { eventStartTime: '10:00:00' });

  assert.equal(selectDisplaySchedule([undefinedTime, timed], NOW)?.id, 'timed');
  assert.equal(selectDisplaySchedule([nullTime, undefinedTime], NOW)?.id, 'null-time');
});

test('selectDisplaySchedule keeps source order for schedules identical in date and time', () => {
  const first = schedule('first', { eventStartTime: '10:00:00' });
  const second = schedule('second', { eventStartTime: '10:00:00' });

  assert.equal(selectDisplaySchedule([first, second], NOW)?.id, 'first');
  assert.equal(selectDisplaySchedule([second, first], NOW)?.id, 'second');
});

test('selectDisplaySchedule falls back to the earliest schedule when every one has ended and none is main', () => {
  const older = schedule('older', { eventStartDate: '2026-01-01' });
  const newer = schedule('newer', { eventStartDate: '2026-03-01' });

  assert.equal(selectDisplaySchedule([newer, older], NOW)?.id, 'older');
});
