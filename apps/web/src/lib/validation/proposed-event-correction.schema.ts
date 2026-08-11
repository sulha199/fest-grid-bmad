import { z } from 'zod';

export const proposedScheduleCorrectionSchema = z.object({
  id: z.string().optional(),
  isMainSchedule: z.boolean(),
  eventStartDate: z.string().min(1, { message: "Start date is required" }),
  eventEndDate: z.string().optional(),
  eventStartTime: z.string().optional(),
  eventEndTime: z.string().optional(),
  title: z.string().optional(),
  performers: z.array(z.string()).optional(),
  location: z.string().optional(),
  ticketPrice: z.string().optional(),
}).superRefine((schedule, ctx) => {
  // Check: eventEndDate must not be earlier than eventStartDate
  if (schedule.eventEndDate && schedule.eventStartDate) {
    const start = new Date(schedule.eventStartDate);
    const end = new Date(schedule.eventEndDate);
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventEndDate'],
        message: 'Event end date must not be earlier than start date',
      });
    }
  }

  // Check: eventEndTime must be later than eventStartTime when dates are same or eventEndDate is absent
  const isSameDate = schedule.eventStartDate && schedule.eventEndDate && schedule.eventStartDate === schedule.eventEndDate;
  const isEndDateAbsent = !schedule.eventEndDate;
  if ((isSameDate || isEndDateAbsent) && schedule.eventStartTime && schedule.eventEndTime) {
    if (schedule.eventEndTime <= schedule.eventStartTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['eventEndTime'],
        message: 'Event end time must be later than start time',
      });
    }
  }
});

export const proposedEventCorrectionSchema = z.object({
  eventName: z.string().min(1, { message: "Event name is required" }),
  types: z.array(z.any()).min(1, { message: "At least one event type is required" }),
  categories: z.array(z.any()).min(1, { message: "At least one category is required" }),
  location: z.string().min(1, { message: "Location is required" }),
  organizerName: z.string().optional(),
  contactInfo: z.string().optional(),
  description: z.string().optional(),
  schedules: z.array(proposedScheduleCorrectionSchema).min(1, { message: "At least one schedule is required" }),
});

export function mapZodIssueToValidationError(issue: z.ZodIssue): { field: string; message: string } {
  const pathParts = issue.path;
  let field = "";
  for (let i = 0; i < pathParts.length; i++) {
    const part = pathParts[i];
    if (typeof part === 'number') {
      field += `[${part}]`;
    } else {
      if (field !== "") {
        // If the previous part was a number, we don't need a dot, because of array style, e.g. schedules[0].eventEndDate
        // Wait, yes, pathParts might be ['schedules', 0, 'eventEndDate'].
        // For i=0, part='schedules' -> field = 'schedules'
        // For i=1, part=0 -> field = 'schedules[0]'
        // For i=2, part='eventEndDate' -> field = 'schedules[0].eventEndDate'
        // So we only add a dot if the previous part was NOT a number. Let's check that.
        const prevPart = pathParts[i - 1];
        if (typeof prevPart === 'number') {
          field += `.${String(part)}`;
        } else {
          field += `.${String(part)}`;
        }
      } else {
        field += String(part);
      }
    }
  }
  return {
    field,
    message: issue.message,
  };
}

export function validateProposedEventCorrection(data: unknown): { field: string; message: string }[] | null {
  const result = proposedEventCorrectionSchema.safeParse(data);
  if (result.success) {
    return null;
  }
  return result.error.issues.map(mapZodIssueToValidationError);
}
