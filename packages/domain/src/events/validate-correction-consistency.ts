import { ProposedEventCorrection } from './types.js';

export interface CorrectionConsistencyError {
  field: string;
  message: string;
}

export function isScheduleLocationConsistent(eventLocation: string, scheduleLocation: string): boolean {
  if (!eventLocation || !scheduleLocation) {
    return true;
  }
  return scheduleLocation.toLowerCase().includes(eventLocation.toLowerCase());
}

export function validateCorrectionConsistency(data: ProposedEventCorrection): CorrectionConsistencyError[] {
  const errors: CorrectionConsistencyError[] = [];

  // Check (c) exactly one schedule must have isMainSchedule: true
  const mainSchedulesCount = data.schedules.filter((s) => s.isMainSchedule).length;
  if (mainSchedulesCount !== 1) {
    errors.push({
      field: 'schedules',
      message: 'Exactly one schedule must be marked as the main schedule',
    });
  }

  data.schedules.forEach((schedule, index) => {
    // Check (a) eventEndDate must not be earlier than eventStartDate
    if (schedule.eventEndDate && schedule.eventStartDate) {
      const start = new Date(schedule.eventStartDate);
      const end = new Date(schedule.eventEndDate);
      if (end < start) {
        errors.push({
          field: `schedules[${index}].eventEndDate`,
          message: 'Event end date must not be earlier than start date',
        });
      }
    }

    // Check (b) eventEndTime must be later than eventStartTime when dates are same or eventEndDate is absent
    const isSameDate = schedule.eventStartDate && schedule.eventEndDate && schedule.eventStartDate === schedule.eventEndDate;
    const isEndDateAbsent = !schedule.eventEndDate;
    if ((isSameDate || isEndDateAbsent) && schedule.eventStartTime && schedule.eventEndTime) {
      if (schedule.eventEndTime <= schedule.eventStartTime) {
        errors.push({
          field: `schedules[${index}].eventEndTime`,
          message: 'Event end time must be later than start time',
        });
      }
    }

    // Check (d) location consistency
    if (schedule.location && data.location) {
      if (!isScheduleLocationConsistent(data.location, schedule.location)) {
        errors.push({
          field: `schedules[${index}].location`,
          message: `Schedule location "${schedule.location}" must contain event location "${data.location}" (case-insensitive)`,
        });
      }
    }
  });

  return errors;
}
