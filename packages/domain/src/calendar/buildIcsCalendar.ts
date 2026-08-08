import { createEvents, EventAttributes, DateArray } from 'ics';
import { fromZonedTime } from 'date-fns-tz';
import { IcsEventInput, IcsScheduleInput } from './types.js';

export function buildIcsCalendar(event: IcsEventInput, schedules: IcsScheduleInput[]): string {
  const events: EventAttributes[] = schedules.map((schedule) => {
    const title = schedule.title ? `${event.eventName}: ${schedule.title}` : event.eventName;
    const description = event.description || undefined;
    const location = schedule.locationDetails?.formattedAddress || schedule.location || event.location || undefined;
    const url = event.url || undefined;
    const uid = `${schedule.id}@festdaily.app`;

    const hasStartTime = Boolean(schedule.eventStartTime);
    const hasEndTime = Boolean(schedule.eventEndTime);

    let start: DateArray;
    let end: DateArray | undefined = undefined;
    let duration: { hours: number } | undefined = undefined;
    let startInputType: 'local' | 'utc' | undefined = undefined;
    let startOutputType: 'local' | 'utc' | undefined = undefined;
    let endInputType: 'local' | 'utc' | undefined = undefined;
    let endOutputType: 'local' | 'utc' | undefined = undefined;

    if (!hasStartTime) {
      // All day event
      const [sy, sm, sd] = schedule.eventStartDate.split('-').map(Number);
      start = [sy, sm, sd];
      if (schedule.eventEndDate) {
        const [ey, em, ed] = schedule.eventEndDate.split('-').map(Number);
        const d = new Date(ey, em - 1, ed);
        d.setDate(d.getDate() + 1);
        end = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
      } else {
        const d = new Date(sy, sm - 1, sd);
        d.setDate(d.getDate() + 1);
        end = [d.getFullYear(), d.getMonth() + 1, d.getDate()];
      }
    } else {
      // Has start time
      const [sy, sm, sd] = schedule.eventStartDate.split('-').map(Number);
      const [sh, smi] = schedule.eventStartTime!.split(':').map(Number);
      const localStartDateStr = `${schedule.eventStartDate}T${schedule.eventStartTime}:00`;
      
      let useTimezone = false;
      if (schedule.timezone) {
        try {
          const tzTest = fromZonedTime(localStartDateStr, schedule.timezone);
          if (!isNaN(tzTest.getTime())) {
            useTimezone = true;
          }
        } catch {
          useTimezone = false;
        }
      }

      if (useTimezone) {
        const utcStartDate = fromZonedTime(localStartDateStr, schedule.timezone!);
        start = [
          utcStartDate.getUTCFullYear(),
          utcStartDate.getUTCMonth() + 1,
          utcStartDate.getUTCDate(),
          utcStartDate.getUTCHours(),
          utcStartDate.getUTCMinutes()
        ];
        startInputType = 'utc';
        startOutputType = 'utc';
      } else {
        start = [sy, sm, sd, sh, smi];
        startInputType = 'local';
        startOutputType = 'local';
      }

      if (hasEndTime) {
        const endDateStr = schedule.eventEndDate || schedule.eventStartDate;
        const localEndDateStr = `${endDateStr}T${schedule.eventEndTime}:00`;
        const [ey, em, ed] = endDateStr.split('-').map(Number);
        const [eh, emi] = schedule.eventEndTime!.split(':').map(Number);

        if (useTimezone) {
          const utcEndDate = fromZonedTime(localEndDateStr, schedule.timezone!);
          end = [
            utcEndDate.getUTCFullYear(),
            utcEndDate.getUTCMonth() + 1,
            utcEndDate.getUTCDate(),
            utcEndDate.getUTCHours(),
            utcEndDate.getUTCMinutes()
          ];
          endInputType = 'utc';
          endOutputType = 'utc';
        } else {
          end = [ey, em, ed, eh, emi];
          endInputType = 'local';
          endOutputType = 'local';
        }
      } else {
        duration = { hours: 2 };
      }
    }

    const base = {
      uid,
      title,
      description,
      location,
      url,
      start,
      ...(startInputType ? { startInputType } : {}),
      ...(startOutputType ? { startOutputType } : {}),
    };

    if (end) {
      return {
        ...base,
        end,
        ...(endInputType ? { endInputType } : {}),
        ...(endOutputType ? { endOutputType } : {}),
      } as EventAttributes;
    } else {
      return {
        ...base,
        duration,
      } as EventAttributes;
    }
  });

  const { error, value } = createEvents(events);
  if (error || !value) {
    console.error('ICS ValidationError:', error);
    throw error || new Error('Failed to generate ICS');
  }

  return value;
}
