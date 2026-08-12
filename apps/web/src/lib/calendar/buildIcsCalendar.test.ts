import { describe, it, expect } from 'vitest';
import { buildIcsCalendar } from './buildIcsCalendar';
import { IcsEventInput, IcsScheduleInput } from './types';

describe('buildIcsCalendar', () => {
  const baseEvent: IcsEventInput = {
    eventName: 'Test Event',
    slug: 'test-event',
    description: 'A test event description',
    url: 'https://festdaily.app/events/test-event',
  };

  const baseSchedule: IcsScheduleInput = {
    id: 'sched-1',
    eventStartDate: '2026-08-10',
    eventEndDate: '2026-08-10',
    eventStartTime: '10:00',
    eventEndTime: '12:00',
    timezone: 'Asia/Jakarta',
    title: 'Morning Session',
    location: 'Main Stage',
  };

  it('generates a single schedule with start and end present', () => {
    const result = buildIcsCalendar(baseEvent, [baseSchedule]);
    
    expect(result).toMatch(/BEGIN:VCALENDAR/);
    expect(result).toMatch(/BEGIN:VEVENT/);
    expect(result).toMatch(/UID:sched-1@festdaily\.app/);
    expect(result).toMatch(/SUMMARY:Test Event: Morning Session/);
    expect(result).toMatch(/DESCRIPTION:A test event description/);
    expect(result).toMatch(/URL:https:\/\/festdaily\.app\/events\/test-event/);
    expect(result).toMatch(/LOCATION:Main Stage/);
    // Asia/Jakarta is UTC+7. Local 10:00 is UTC 03:00.
    expect(result).toMatch(/DTSTART:20260810T030000Z/);
    expect(result).toMatch(/DTEND:20260810T050000Z/);
    expect(result).toMatch(/END:VEVENT/);
    expect(result).toMatch(/END:VCALENDAR/);
  });

  it('generates multiple VEVENTs for multiple schedules', () => {
    const sched2: IcsScheduleInput = {
      ...baseSchedule,
      id: 'sched-2',
      eventStartTime: '14:00',
      eventEndTime: '16:00',
      title: 'Afternoon Session',
    };
    const result = buildIcsCalendar(baseEvent, [baseSchedule, sched2]);
    
    // Check that both UIDs exist
    expect(result).toMatch(/UID:sched-1@festdaily\.app/);
    expect(result).toMatch(/UID:sched-2@festdaily\.app/);
    
    // Check that we have exactly two VEVENTs
    const veventCount = (result.match(/BEGIN:VEVENT/g) || []).length;
    expect(veventCount).toBe(2);
  });

  it('handles start-only by defaulting to a 2-hour duration', () => {
    const noEndSchedule: IcsScheduleInput = {
      ...baseSchedule,
      eventEndDate: null,
      eventEndTime: null,
    };
    const result = buildIcsCalendar(baseEvent, [noEndSchedule]);
    
    // duration defaults to 2 hours
    expect(result).toMatch(/DTSTART:20260810T030000Z/);
    expect(result).toMatch(/DURATION:PT2H/);
  });

  it('handles no-start by creating an all-day event (1 day)', () => {
    const allDaySchedule: IcsScheduleInput = {
      ...baseSchedule,
      eventStartTime: null,
      eventEndTime: null,
      eventEndDate: null,
    };
    const result = buildIcsCalendar(baseEvent, [allDaySchedule]);
    
    // All day events use VALUE=DATE and do not have time components
    expect(result).toMatch(/DTSTART;VALUE=DATE:20260810/);
    expect(result).toMatch(/DTEND;VALUE=DATE:20260811/);
  });

  it('handles no-start by creating an all-day event (multiple days)', () => {
    const allDaySchedule: IcsScheduleInput = {
      ...baseSchedule,
      eventStartDate: '2026-08-10',
      eventEndDate: '2026-08-12',
      eventStartTime: null,
      eventEndTime: null,
    };
    const result = buildIcsCalendar(baseEvent, [allDaySchedule]);
    
    // All day events use VALUE=DATE. End date is exclusive in ICS.
    expect(result).toMatch(/DTSTART;VALUE=DATE:20260810/);
    // End date should be 2026-08-13 (day after the last date)
    expect(result).toMatch(/DTEND;VALUE=DATE:20260813/);
  });

  it('handles missing timezone by using floating format (no Z)', () => {
    const noTzSchedule: IcsScheduleInput = {
      ...baseSchedule,
      timezone: null,
    };
    const result = buildIcsCalendar(baseEvent, [noTzSchedule]);
    
    // Should use the literal wall-clock time
    expect(result).toMatch(/DTSTART:20260810T100000\r\n/);
    expect(result).toMatch(/DTEND:20260810T120000\r\n/);
    expect(result).not.toMatch(/DTSTART:.*Z/);
    expect(result).not.toMatch(/DTEND:.*Z/);
  });

  it('handles invalid timezone by falling back to floating format (no Z)', () => {
    const invalidTzSchedule: IcsScheduleInput = {
      ...baseSchedule,
      timezone: 'Invalid/Timezone',
    };
    const result = buildIcsCalendar(baseEvent, [invalidTzSchedule]);
    
    // Should use the literal wall-clock time
    expect(result).toMatch(/DTSTART:20260810T100000\r\n/);
    expect(result).toMatch(/DTEND:20260810T120000\r\n/);
    expect(result).not.toMatch(/DTSTART:.*Z/);
  });

  it('ensures UID stability across two calls with the same schedule ID', () => {
    const result1 = buildIcsCalendar(baseEvent, [baseSchedule]);
    const result2 = buildIcsCalendar(baseEvent, [baseSchedule]);
    
    const extractUid = (ics: string) => {
      const match = ics.match(/UID:([^\r\n]+)/);
      return match ? match[1] : null;
    };
    
    expect(extractUid(result1)).toBe(extractUid(result2));
    expect(extractUid(result1)).toBe('sched-1@festdaily.app');
  });

  it('escapes special characters correctly in title, description, and location', () => {
    const specialEvent: IcsEventInput = {
      ...baseEvent,
      eventName: 'Test, Event; with\nnewlines',
      description: 'Line 1\nLine 2, and; some symbols',
    };
    const specialSchedule: IcsScheduleInput = {
      ...baseSchedule,
      title: 'Session, morning;',
      location: 'Stage, Main; Area',
    };
    
    const result = buildIcsCalendar(specialEvent, [specialSchedule]);
    
    // ics package automatically escapes commas, semicolons, and newlines
    expect(result).toContain('SUMMARY:Test\\, Event\\; with\\nnewlines: Session\\, morning\\;');
    expect(result).toContain('DESCRIPTION:Line 1\\nLine 2\\, and\\; some symbols');
    expect(result).toContain('LOCATION:Stage\\, Main\\; Area');
  });
  
  it('falls back location properly', () => {
    // 1. locationDetails.formattedAddress
    const sched1: IcsScheduleInput = { ...baseSchedule, location: 'Loc', locationDetails: { formattedAddress: 'Addr' } };
    expect(buildIcsCalendar(baseEvent, [sched1])).toMatch(/LOCATION:Addr/);
    
    // 2. schedule.location
    const sched2: IcsScheduleInput = { ...baseSchedule, location: 'Loc', locationDetails: null };
    expect(buildIcsCalendar(baseEvent, [sched2])).toMatch(/LOCATION:Loc/);
    
    // 3. event.location
    const eventWithLoc: IcsEventInput = { ...baseEvent, location: 'Event Loc' };
    const sched3: IcsScheduleInput = { ...baseSchedule, location: null, locationDetails: null };
    expect(buildIcsCalendar(eventWithLoc, [sched3])).toMatch(/LOCATION:Event Loc/);
  });

  it('handles missing event title in schedule', () => {
    const sched: IcsScheduleInput = { ...baseSchedule, title: null };
    expect(buildIcsCalendar(baseEvent, [sched])).toMatch(/SUMMARY:Test Event\r\n/);
  });
});
