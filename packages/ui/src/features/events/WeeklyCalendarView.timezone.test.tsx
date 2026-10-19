/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WeeklyCalendarView } from './WeeklyCalendarView';
import { ScopedLocaleProvider } from '../../hooks/useScopedLocale';
import { combineDateTime } from './format-event-date';

/**
 * Rendered calendar card (mobile list variant -- the card in the "Ended while not started" report)
 * across app timezones. The format-event-date matrix tests the helpers with an explicit timezone;
 * this one goes through the real component tree: `ScopedLocaleProvider` timezone -> WeeklyCalendarView
 * -> CalendarCard -> EventCardCompact status badge + `computeCalendarSegmentDateBoxContent` date box.
 *
 * Event shape is the exact one from the production report (ig_p_Den3ZP5Bf11): single day, a start
 * time, NO end date and NO end time.
 */
const EVENT_DAY = '2026-10-19'; // a Monday
const SCHEDULE = {
  id: 'sched-prod-1',
  eventSlug: 'ig_p_Den3ZP5Bf11',
  eventName: 'GJLS Berapi-Api Meet & Greet',
  isMainSchedule: true,
  eventStartDate: EVENT_DAY,
  eventEndDate: null,
  eventStartTime: '18:30:00',
  eventEndTime: null,
};

const ZONES = [
  'Pacific/Pago_Pago', // UTC-11
  'America/Los_Angeles', // UTC-7
  'America/New_York', // UTC-4 (the /en/ app-wide timezone)
  'UTC',
  'Europe/Paris', // UTC+2
  'Asia/Jakarta', // UTC+7 (the /id/ app-wide timezone)
  'Pacific/Auckland', // UTC+13
  'Pacific/Kiritimati', // UTC+14
];

const getWeekRange = (date: Date) => ({ start: date, end: date });

function renderAt(now: Date, tz: string, schedule: Record<string, unknown> = SCHEDULE) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  render(
    <ScopedLocaleProvider locale="en-US" timezone={tz}>
      <WeeklyCalendarView
        weekStart={EVENT_DAY}
        schedules={[schedule as typeof SCHEDULE]}
        getWeekRange={getWeekRange}
        onToday={vi.fn()}
        onPrevWeek={vi.fn()}
        onNextWeek={vi.fn()}
        onScheduleClick={vi.fn()}
        status="success"
      />
    </ScopedLocaleProvider>
  );
  const mobile = screen.getByTestId('mobile-calendar-view');
  fireEvent.click(within(mobile).getByRole('tab', { name: /^19 Mon/ }));
  return within(within(mobile).getByTestId('mobile-day-row'));
}

/** The instant the wall clock in `tz` reads `date` `time`. */
const at = (date: string, time: string, tz: string) => combineDateTime(date, time, tz);

describe.each(ZONES)('calendar card, app timezone %s', (tz) => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it.each([
    ['00:30:00', /In \d+ hour/],
    ['07:30:00', /In \d+ hour/],
    ['12:00:00', /In \d+ hour/],
    ['18:00:00', /In \d+ hour/],
    ['18:30:00', /Ends Today/],
    ['20:00:00', /Ends Today/],
    ['23:59:00', /Ends Today/],
  ])('viewed at %s on the event day: %s, never "Ended"', (time, expected) => {
    const row = renderAt(at(EVENT_DAY, time, tz), tz);
    expect(row.getByText(expected)).toBeInTheDocument();
    expect(row.queryByText('Ended')).not.toBeInTheDocument();
  });

  it('viewed the day after: Ended', () => {
    const row = renderAt(at('2026-10-20', '00:30:00', tz), tz);
    expect(row.getByText('Ended')).toBeInTheDocument();
  });

  it('shows the event day (19) in the date box, never the previous day', () => {
    const row = renderAt(at(EVENT_DAY, '12:00:00', tz), tz);
    const card = row.getByRole('button');
    expect(card).toHaveTextContent(/Oct\s*19/);
    expect(card).not.toHaveTextContent(/Oct\s*18/);
  });

  it('the hover tooltip shows the event wall-clock time and day in the app timezone, whatever the device timezone', () => {
    // Previously built from `new Date('2026-10-19T18:30:00')` (the DEVICE's zone) but formatted in
    // the app zone, so every device outside the app timezone saw a shifted time and day.
    renderAt(at(EVENT_DAY, '12:00:00', tz), tz);
    const desktop = within(screen.getByTestId('desktop-calendar-view'));
    fireEvent.pointerEnter(desktop.getByRole('button', { name: SCHEDULE.eventName }), { pointerType: 'mouse' });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Oct 19, 2026');
    expect(tooltip).toHaveTextContent('6:30');
    expect(tooltip).toHaveTextContent('PM');
  });

  it('labels the week and its day tabs with the supplied calendar days (no day shift at UTC+12 and beyond)', () => {
    renderAt(at(EVENT_DAY, '12:00:00', tz), tz);
    expect(screen.getByText('Oct 19 – 25, 2026')).toBeInTheDocument();
    const mobile = within(screen.getByTestId('mobile-calendar-view'));
    expect(mobile.getByRole('tab', { name: /^19 Mon/ })).toBeInTheDocument();
    expect(mobile.getByRole('tab', { name: /^25 Sun/ })).toBeInTheDocument();
  });
});

/**
 * The schedule's OWN timezone (RESOLVED) wins over the app timezone: a poster's "18:30" is venue
 * time, and a date with no time is 00:00 in the venue's zone. Whatever the app timezone is, the
 * card must read the same.
 */
describe.each(ZONES)('calendar card of a RESOLVED Asia/Jakarta event, app timezone %s', (appTz) => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });
  const JAKARTA = 'Asia/Jakarta';
  const jakarta = { ...SCHEDULE, timezone: JAKARTA, timezoneStatus: 'RESOLVED' };
  const noTime = { ...jakarta, eventStartTime: null };

  it.each([
    ['00:30:00', /In \d+ hour/],
    ['12:00:00', /In \d+ hour/],
    ['18:29:00', /In \d+ hour/],
    ['18:30:00', /Ends Today/],
    ['23:59:00', /Ends Today/],
  ])('Jakarta wall clock %s on the event day: %s', (time, expected) => {
    const row = renderAt(at(EVENT_DAY, time, JAKARTA), appTz, jakarta);
    expect(row.getByText(expected)).toBeInTheDocument();
    expect(row.queryByText('Ended')).not.toBeInTheDocument();
  });

  it('Jakarta wall clock the day after: Ended', () => {
    const row = renderAt(at('2026-10-20', '00:30:00', JAKARTA), appTz, jakarta);
    expect(row.getByText('Ended')).toBeInTheDocument();
  });

  it('a date with NO time is 00:00 in the event zone: not started at 23:30 the evening before ...', () => {
    const row = renderAt(at('2026-10-18', '23:30:00', JAKARTA), appTz, noTime);
    // The card lives on the 19th's tab; on 18 23:30 Jakarta it has not begun.
    expect(row.queryByText('Ended')).not.toBeInTheDocument();
    expect(row.queryByText('Ends Today')).not.toBeInTheDocument();
  });

  it('... started at 00:30 on the day, ends today, and is Ended once the day is over', () => {
    expect(renderAt(at(EVENT_DAY, '00:30:00', JAKARTA), appTz, noTime).getByText('Ends Today')).toBeInTheDocument();
    cleanup();
    vi.useRealTimers();
    expect(renderAt(at('2026-10-20', '00:30:00', JAKARTA), appTz, noTime).getByText('Ended')).toBeInTheDocument();
  });

  it('the hover tooltip shows the venue time (6:30 PM, Oct 19) whatever the app timezone', () => {
    renderAt(at(EVENT_DAY, '12:00:00', JAKARTA), appTz, jakarta);
    const desktop = within(screen.getByTestId('desktop-calendar-view'));
    fireEvent.pointerEnter(desktop.getByRole('button', { name: SCHEDULE.eventName }), { pointerType: 'mouse' });
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip).toHaveTextContent('Oct 19, 2026');
    expect(tooltip).toHaveTextContent('6:30');
    expect(tooltip).toHaveTextContent('PM');
  });

  it('an unconfirmed timezone (NEEDS_CLARIFICATION) is ignored: the app timezone still applies', () => {
    const guess = { ...SCHEDULE, timezone: 'Pacific/Kiritimati', timezoneStatus: 'NEEDS_CLARIFICATION' };
    const row = renderAt(at(EVENT_DAY, '12:00:00', appTz), appTz, guess);
    expect(row.getByText(/In \d+ hour/)).toBeInTheDocument();
  });
});
