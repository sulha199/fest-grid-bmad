export interface IcsEventInput {
  eventName: string;
  slug: string;
  description?: string | null;
  location?: string | null;
  url?: string;
}

export interface IcsScheduleInput {
  id: string;
  eventStartDate: string;
  eventEndDate?: string | null;
  eventStartTime?: string | null;
  eventEndTime?: string | null;
  timezone?: string | null;
  location?: string | null;
  locationDetails?: {
    formattedAddress?: string | null;
  } | null;
  title?: string | null;
}
