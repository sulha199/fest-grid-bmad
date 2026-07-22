/** ISO 8601 date string (e.g. "2024-10-15T14:30:00Z") */
export type DateTimeIso = string & {};
/** ISO 8601 date string without time (e.g. "2024-10-15") */
export type DateOnlyIso = string & {};
/** ISO 8601 time string without date (e.g. "14:30:00") */
export type TimeOnlyIso = string & {}; // e.g. "14:30:00"

export interface User {
  id: string;
  email: string;
  name?: string;
}

export enum EventType {
  EXHIBITION = 'EXHIBITION',         // Art shows, trade shows
  COMPETITION = 'COMPETITION',        // Tournaments, contests
  FESTIVAL = 'FESTIVAL',           // Multi-day cultural or music festivals
  PERFORMANCE = 'PERFORMANCE',        // Concerts, plays, stand-up
  WORKSHOP = 'WORKSHOP',           // Classes, hands-on activities
  SEMINAR = 'SEMINAR',            // Talks, lectures, conferences
  MARKET = 'MARKET',             // Farmers' markets, bazaars
  GATHERING = 'GATHERING',          // Community meetups, parties
  PROMOTION = 'PROMOTION',          // Product launches, sales events
  FUNDRAISER = 'FUNDRAISER',         // Charity events, galas, auctions (New)
  CIVIC = 'CIVIC',              // Town halls, public forums (New)
  OTHER = 'OTHER'
}

export enum EventCategory {
  MUSIC = 'MUSIC',
  ARTS_AND_CULTURE = 'ARTS_AND_CULTURE',
  FOOD_AND_DRINK = 'FOOD_AND_DRINK',
  SPORTS_AND_FITNESS = 'SPORTS_AND_FITNESS',
  FAMILY_AND_KIDS = 'FAMILY_AND_KIDS',
  HOBBIES_AND_INTERESTS = 'HOBBIES_AND_INTERESTS',
  BUSINESS_AND_NETWORKING = 'BUSINESS_AND_NETWORKING',
  HEALTH_AND_WELLNESS = 'HEALTH_AND_WELLNESS',
  HOLIDAY = 'HOLIDAY',
  CHARITY_AND_CAUSES = 'CHARITY_AND_CAUSES',     // Fundraisers, non-profit events (New)
  CIVIC_AND_COMMUNITY = 'CIVIC_AND_COMMUNITY',    // Town halls, local government, volunteering (New)
  OTHER = 'OTHER'
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationDetails {
  coordinates: Coordinates;
  placeName?: string;
  placeId?: string;
  formattedAddress?: string;
  timezone?: string;
}

export interface Schedule {
  id: string;
  isMainSchedule: boolean;
  eventStartDate: DateOnlyIso;
  title?: string;
  eventEndDate?: DateOnlyIso;
  eventStartTime?: TimeOnlyIso;
  eventEndTime?: TimeOnlyIso;
  performers?: string[];
  location?: string;
  ticketPrice?: string;
  locationDetails?: LocationDetails;
}

/**
 * Represents the information extracted from an event poster (as defined in the PRD).
 */
export interface EventInfo {
  id: string;
  isEvent: boolean;
  eventName: string;
  types: EventType[];
  categories: EventCategory[];
  schedules: Schedule[];
  location: string;
  eventOwner?: string;
  contactInfo?: string;
  description?: string;
  confidenceScore?: number;
  sourceSocialMediaAccountId?: string;
  isFavorited?: boolean;
  isAddedToCalendar?: boolean;
}

export interface SocialMediaAccountProfile {
  accountId: string;
  platform: string;
  displayName: string;
  username: string;
  profileImageUrl?: string;
  description?: string;
  isNewlyAdded?: boolean;
  lastPostDate?: string;
}

export interface UserLocationPreference {
  id: string;
  userId: string;
  name: string;
  coordinates: Coordinates;
  radius: number;
}

export interface Post {
  id: string;
  content: string;
  imageUrl?: string;
  postUrl: string;
  isExtracted?: boolean;
}
