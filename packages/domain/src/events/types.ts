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
