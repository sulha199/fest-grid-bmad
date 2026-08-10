import { EventType, EventCategory, LocationDetails } from '@festgrid/shared-types';

export interface GeminiSchedulePayload {
  isMainSchedule: boolean;
  eventStartDate: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  title?: string;
  performers?: string[];
  location?: string;
  ticketPrice?: string;
}

export interface GeminiExtractionPayload {
  isEvent: boolean;
  eventName: string;
  types: string[];
  categories: string[];
  schedules: GeminiSchedulePayload[];
  location?: string;
  organizerName?: string;
  contactInfo?: string;
  description?: string;
  confidenceScore: number;
}

export type ScheduleTimezoneStatus = 'RESOLVED' | 'NEEDS_CLARIFICATION';

export interface ScheduleTimezoneResolution {
  timezone?: string;
  timezoneStatus: ScheduleTimezoneStatus;
}

export interface ExtractedScheduleMessage {
  isMainSchedule: boolean;
  eventStartDate: string;
  eventEndDate?: string;
  eventStartTime?: string;
  eventEndTime?: string;
  title?: string;
  performers?: string[];
  location?: string;
  ticketPrice?: string;
  locationDetails?: LocationDetails;
  timezone?: string;
  timezoneStatus?: ScheduleTimezoneStatus;
}

export interface ExtractedEventMessage {
  postId: string;
  sourceSocialMediaAccountId: string;
  eventName: string;
  types: EventType[];
  categories: EventCategory[];
  schedules: ExtractedScheduleMessage[];
  location?: string;
  organizerName?: string;
  contactInfo?: string;
  description?: string;
  confidenceScore: number;
}

export interface EventInsertValues {
  postId: string;
  sourceSocialMediaAccountId: string;
  eventName: string;
  types: string[];
  categories: string[];
  location: string;
  organizerName?: string | null;
  contactInfo?: string | null;
  description?: string | null;
  confidenceScore?: number | null;
}

export interface ScheduleInsertValues {
  eventId?: string; // set after event insert
  isMainSchedule: boolean;
  eventStartDate: string;
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  title?: string | null;
  performers?: string[] | null;
  location?: string | null;
  ticketPrice?: string | null;
  locationDetails?: LocationDetails | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  timezoneStatus?: ScheduleTimezoneStatus | null;
}
