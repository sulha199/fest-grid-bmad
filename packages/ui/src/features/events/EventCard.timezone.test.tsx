/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventCard } from './EventCard';
import { EventListView } from './EventListView';
import { ScopedLocaleProvider } from '../../hooks/useScopedLocale';
import { combineDateTime } from './format-event-date';

/**
 * The rendered masonry card across app timezones, on the exact production event
 * (ig_p_Den3ZP5Bf11): single day, 18:30 start, NO end date and NO end time. Companion to
 * `WeeklyCalendarView.timezone.test.tsx` (the calendar card) -- same data, other surface.
 */
const EVENT_DAY = '2026-10-19';
const ZONES = [
  'Pacific/Pago_Pago',
  'America/Los_Angeles',
  'America/New_York', // the /en/ app-wide timezone
  'UTC',
  'Europe/Paris',
  'Asia/Jakarta', // the /id/ app-wide timezone
  'Pacific/Auckland',
  'Pacific/Kiritimati',
];

const at = (date: string, time: string, tz: string) => combineDateTime(date, time, tz);

function renderAt(now: Date, tz: string) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  return render(
    <ScopedLocaleProvider locale="en-US" timezone={tz}>
      <EventCard
        eventName="GJLS Berapi-Api Meet & Greet"
        startDate={EVENT_DAY}
        startTime="18:30:00"
        variant="masonry"
        prominentPoster
        locale="en-US"
      />
    </ScopedLocaleProvider>
  );
}

describe.each(ZONES)('masonry card, app timezone %s', (tz) => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    ['00:30:00', /In \d+ hour/],
    ['12:00:00', /In \d+ hour/],
    ['18:00:00', /In \d+ hour/],
    ['18:30:00', /Ends Today/],
    ['23:59:00', /Ends Today/],
  ])('viewed at %s on the event day: %s, never "Ended"', (time, expected) => {
    renderAt(at(EVENT_DAY, time, tz), tz);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText('Ended')).not.toBeInTheDocument();
  });

  it('viewed the day before: Tomorrow', () => {
    renderAt(at('2026-10-18', '12:00:00', tz), tz);
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
  });

  it('viewed the day after: Ended', () => {
    renderAt(at('2026-10-20', '00:30:00', tz), tz);
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('shows Oct 19 in the date box', () => {
    const { container } = renderAt(at(EVENT_DAY, '12:00:00', tz), tz);
    expect(container).toHaveTextContent(/Oct\s*19/);
    expect(container).not.toHaveTextContent(/Oct\s*18/);
  });
});

/**
 * The event's own timezone, through the real list path (EventListView -> resolveScheduleTimezone ->
 * EventCard). A RESOLVED schedule timezone makes the card read the same under every app timezone;
 * a date with no time is 00:00 in that zone.
 */
describe.each(ZONES)('masonry card of a RESOLVED Asia/Jakarta event via EventListView, app timezone %s', (appTz) => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const JAKARTA = 'Asia/Jakarta';

  function renderList(now: Date, schedule: Record<string, unknown>) {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    return render(
      <ScopedLocaleProvider locale="en-US" timezone={appTz}>
        <EventListView
          status="success"
          events={[
            {
              id: 'e1',
              slug: 'ig_p_Den3ZP5Bf11',
              eventName: 'GJLS Berapi-Api Meet & Greet',
              schedules: [{ isMainSchedule: true, eventStartDate: EVENT_DAY, ...schedule }],
            },
          ]}
          getCardProps={() => ({ locale: 'en-US', prominentPoster: true })}
        />
      </ScopedLocaleProvider>
    );
  }
  const resolved = { eventStartTime: '18:30:00', timezone: JAKARTA, timezoneStatus: 'RESOLVED' };

  it.each([
    ['12:00:00', /In \d+ hour/],
    ['18:30:00', /Ends Today/],
    ['23:59:00', /Ends Today/],
  ])('Jakarta wall clock %s on the event day: %s, never "Ended"', (time, expected) => {
    renderList(at(EVENT_DAY, time, JAKARTA), resolved);
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.queryByText('Ended')).not.toBeInTheDocument();
  });

  it('Jakarta wall clock the day after: Ended', () => {
    renderList(at('2026-10-20', '00:30:00', JAKARTA), resolved);
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('a date with NO time is 00:00 in the event zone: Tomorrow at 23:30 the evening before, Ends Today from 00:30, Ended the next day', () => {
    const noTime = { timezone: JAKARTA, timezoneStatus: 'RESOLVED' };
    renderList(at('2026-10-18', '23:30:00', JAKARTA), noTime);
    expect(screen.getByText('Tomorrow')).toBeInTheDocument();
    cleanup();
    vi.useRealTimers();
    renderList(at(EVENT_DAY, '00:30:00', JAKARTA), noTime);
    expect(screen.getByText('Ends Today')).toBeInTheDocument();
    cleanup();
    vi.useRealTimers();
    renderList(at('2026-10-20', '00:30:00', JAKARTA), noTime);
    expect(screen.getByText('Ended')).toBeInTheDocument();
  });

  it('an unconfirmed timezone is ignored: the app timezone applies', () => {
    renderList(at(EVENT_DAY, '12:00:00', appTz), { ...resolved, timezone: 'Pacific/Kiritimati', timezoneStatus: 'NEEDS_CLARIFICATION' });
    expect(screen.getByText(/In \d+ hour/)).toBeInTheDocument();
  });
});
