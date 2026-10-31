import { EventType, EventCategory, LocationDetails } from '@festgrid/shared-types';
import { GeminiEventPayload, ExtractedEventMessage, ExtractedScheduleMessage, ScheduleTimezoneResolution } from './types.js';
import { matchesChildrensDataKeywordFilter } from './matches-childrens-data-keyword-filter.js';
import { sanitizeEventLinks } from './sanitize-event-links.js';

// Story 3.6s — retyped from GeminiExtractionPayload (now the post-level wrapper carrying
// `events[]`) to GeminiEventPayload (one event's worth of fields). The caller
// (process-ai-job.ts) now calls this function once per extracted event, which is what makes
// AC4's "per event" guard requirement (timezone/private-contact/performer-leakage) hold -- this
// function's own logic is otherwise unchanged (see Task 6.2's no-shared-mutable-state test).
export function transformGeminiResponseToEventInfo(
  payload: GeminiEventPayload,
  context: {
    postId: string;
    sourceSocialMediaAccountId: string;
    defaultLocation?: LocationDetails;
    resolvedScheduleLocations: Map<number, LocationDetails>;
    scheduleTimezoneResolutions?: Map<number, ScheduleTimezoneResolution>;
    sourcePostText?: string;
    /**
     * The children's-data keyword filter's verdict for the whole post, when the caller no longer has
     * the caption (the moderator re-extract Apply runs after the caption was blanked, so the preview
     * records the verdict while it still had it). Wins over `sourcePostText` when present.
     */
    childrensDataMatch?: boolean;
  }
): ExtractedEventMessage {
  // 1. Filter valid types and categories, fallback to OTHER if empty
  const validTypes = payload.types.filter((t): t is EventType =>
    Object.values(EventType).includes(t as EventType)
  );
  const types = validTypes.length > 0 ? validTypes : [EventType.OTHER];

  const validCategories = payload.categories.filter((c): c is EventCategory =>
    Object.values(EventCategory).includes(c as EventCategory)
  );
  // Story 0.52 (AD-44 Rule 2), amended by Story 0.54 (AD-44 Rule 2, [AMENDED 2026-10-24]):
  // valid-category filter (above), then dedupe (preserving first occurrence / model order) so a
  // repeated category can never displace a distinct one past the cap below nor silently empty
  // out an all-duplicate-OTHER list, then split into "real" categories and whether OTHER was
  // present, then truncate "real" to the first 6 (in model order) -- OTHER never counts against
  // this safety cap and is never dropped, only appended last when present -- then empty-fallback
  // last. This supersedes the old cap-4/OTHER-exclusive rule: OTHER is now non-exclusive (kept
  // alongside real categories, moved to the end) and the cap is a safety cap of 6, not a forced
  // truncation of ordinary multi-subject posts.
  const categoriesDeduped: EventCategory[] = Array.from(new Set(validCategories));
  const hasOther = categoriesDeduped.includes(EventCategory.OTHER);
  const realCategories = categoriesDeduped.filter((c) => c !== EventCategory.OTHER).slice(0, 6);
  let categories: EventCategory[] = hasOther ? [...realCategories, EventCategory.OTHER] : realCategories;
  if (categories.length === 0) {
    categories = [EventCategory.OTHER];
  }

  // 2. Resolve top-level location
  const location = payload.location || (context.defaultLocation
    ? (context.defaultLocation.formattedAddress ?? context.defaultLocation.placeName)
    : undefined);

  // 3. Map schedules, attaching resolved schedule locations and timezone resolutions.
  // Discard-at-classification enforcement (Story 3.6k, AC1): when the raw scraped
  // post text matches the children's-data keyword filter, performers are suppressed
  // entirely for every schedule of the resulting event -- the pipeline itself never
  // writes individual performer names for a matched post, independent of whatever
  // Gemini extracted.
  const childrensDataMatch = context.childrensDataMatch ?? matchesChildrensDataKeywordFilter(context.sourcePostText);
  const schedules: ExtractedScheduleMessage[] = payload.schedules.map((sch, i) => {
    const locationDetails = context.resolvedScheduleLocations.get(i);
    const timezoneResolution = context.scheduleTimezoneResolutions?.get(i);
    return {
      isMainSchedule: sch.isMainSchedule,
      eventStartDate: sch.eventStartDate,
      eventEndDate: sch.eventEndDate,
      eventStartTime: sch.eventStartTime,
      eventEndTime: sch.eventEndTime,
      title: sch.title,
      performers: childrensDataMatch ? undefined : sch.performers,
      location: sch.location,
      ticketPrice: sch.ticketPrice,
      applicableDaysOfWeek: sch.applicableDaysOfWeek,
      locationDetails,
      timezone: timezoneResolution?.timezone,
      timezoneStatus: timezoneResolution?.timezoneStatus
    };
  });

  // 4. Discard-at-classification enforcement (AC2): a private-contact classification
  // always wins over whatever contactInfo the prompt/schema separation returned --
  // never trust that separation alone, since a model response is not contractually
  // bound to honor it. The raw private value is never passed through.
  const contactInfo = payload.hasPrivateContact === true ? undefined : payload.contactInfo;

  // 5. Sanitize any raw links Gemini extracted (Story 0.37, AC2): drops non-http(s) URLs,
  // trims/discards empty labels, and caps at 10 entries.
  const links = sanitizeEventLinks(payload.links);

  return {
    postId: context.postId,
    sourceSocialMediaAccountId: context.sourceSocialMediaAccountId,
    eventName: payload.eventName,
    types,
    categories,
    schedules,
    location,
    organizerName: payload.organizerName,
    contactInfo,
    hasPrivateContact: payload.hasPrivateContact,
    description: payload.description,
    confidenceScore: payload.confidenceScore,
    links,
    organizerHandle: payload.organizerHandle
  };
}
