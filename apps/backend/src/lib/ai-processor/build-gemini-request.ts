import { EventType, EventCategory } from '@festgrid/shared-types';
import { type ProcessingJobMessage, POST_GROUPING_REASONS } from '@festgrid/domain/posts';
import { DayOfWeek } from '@festgrid/domain/events';
import { type GeminiCallRequest } from '../ai-gateway/gemini-client.js';
import { loadBackendEnv } from '../../env.js';

// Story 3.6s — per-event object nested under the post-level `events` array. Everything that
// used to be flat on the response schema (pre-3.6s) now lives here, plus the new
// `organizerHandle`/`applicableDaysOfWeek` fields (AD-30 Rule 5, BUG-026).
const geminiEventResponseSchema = {
  type: 'OBJECT',
  properties: {
    eventName: { type: 'STRING' },
    types: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: Object.values(EventType) }
    },
    categories: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: Object.values(EventCategory) }
    },
    schedules: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          isMainSchedule: { type: 'BOOLEAN' },
          eventStartDate: { type: 'STRING' },
          eventEndDate: { type: 'STRING' },
          eventStartTime: { type: 'STRING' },
          eventEndTime: { type: 'STRING' },
          title: { type: 'STRING' },
          performers: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          location: { type: 'STRING' },
          ticketPrice: { type: 'STRING' },
          // Story 3.6s (BUG-026) — populated only when the source text states the schedule
          // recurs on specific weekdays within a date span (Story 1.3k, PRD §4.4).
          applicableDaysOfWeek: {
            type: 'ARRAY',
            items: { type: 'STRING', enum: Object.values(DayOfWeek) }
          }
        },
        required: ['isMainSchedule', 'eventStartDate']
      }
    },
    location: { type: 'STRING' },
    organizerName: { type: 'STRING' },
    contactInfo: { type: 'STRING' },
    hasPrivateContact: { type: 'BOOLEAN' },
    description: { type: 'STRING' },
    // Story 0.37 — any explicit additional links mentioned in the post (ticketing/RSVP/
    // merch/linktree/etc.), with an optional short label when the source text names them.
    links: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          url: { type: 'STRING' },
          label: { type: 'STRING' }
        },
        required: ['url']
      }
    },
    confidenceScore: { type: 'NUMBER' },
    // Model-self-reported completeness signal (Story 3.6l). Optional — never in `required`,
    // never persisted anywhere. `minScheduleCount` is a best-effort count of distinct
    // schedules/events the caption + all provided images appear to describe; the producer of
    // the request only logs when the parsed schedules fall short of it.
    minScheduleCount: { type: 'NUMBER' },
    expectedScheduleNames: { type: 'ARRAY', items: { type: 'STRING' } },
    // Story 3.6s (AD-30 Rule 5) — the @handle tagged for this specific item, captured at
    // extraction time since a CURATOR_GUIDE post's caption is nulled after extraction (3.4o).
    organizerHandle: { type: 'STRING' }
  },
  required: ['eventName', 'types', 'categories', 'schedules', 'confidenceScore']
};

// Story 3.6s — builds the Gemini-facing response schema with `events.maxItems` sourced from
// the configured roundup cap (env.maxExtractedEventsPerPost), so the prompt/schema hint and the
// enforced code-level truncation (process-ai-job.ts) can never drift. Built per-call (not a
// module-level constant) so env.ts's dotenv load always happens inside a function body, matching
// every other call site in this codebase (never at module-eval time).
export function buildGeminiExtractionResponseSchema(maxExtractedEventsPerPost: number) {
  return {
    type: 'OBJECT',
    properties: {
      isEvent: { type: 'BOOLEAN' },
      // Story 3.6s — nests every per-event field under `events[]`. `maxItems` here is a
      // model-facing hint only (reduces output size, helps AC7's response-size cap) — it is
      // deliberately NOT mirrored as a hard cap in the AJV validation schema (see
      // extracted-event.schema.ts for why a strict rejection would be worse than a code-level
      // truncation in process-ai-job.ts).
      events: {
        type: 'ARRAY',
        items: geminiEventResponseSchema,
        maxItems: maxExtractedEventsPerPost
      },
      // Story 3.6s (AD-30 Rule 5) — the post-level grouping decision, made once per post before
      // per-event extraction.
      groupingReason: { type: 'STRING', enum: [...POST_GROUPING_REASONS] },
      // One-sentence model self-explanation of the grouping decision, for debugging only — never
      // persisted (AD-30 Rule 5).
      groupingRationale: { type: 'STRING' },
      // Model's own best-effort count of distinct events it believes the content describes,
      // mirroring minScheduleCount's existing self-report/logging-only pattern.
      minEventCount: { type: 'NUMBER' },
      // Brief human-readable reason per roundup item skipped for missing a readable date or
      // location (e.g. "Jakarta Fun Run — no date stated").
      skippedItems: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: ['isEvent', 'events']
  };
}

// Default-cap schema, for callers/tests that only need the shape (not a specific cap value).
// buildGeminiExtractionRequest() below always builds its own copy from the live env value.
export const geminiExtractionResponseSchema = buildGeminiExtractionResponseSchema(10);

export interface BuildGeminiExtractionRequestResult {
  request: GeminiCallRequest;
  imageBytes?: Buffer;
  imageContentType?: string;
}

export async function buildGeminiExtractionRequest(
  message: ProcessingJobMessage
): Promise<BuildGeminiExtractionRequestResult> {
  const env = loadBackendEnv();
  const allowedTypes = Object.values(EventType).join(', ');
  const allowedCategories = Object.values(EventCategory).join(', ');

  const publishDate = message.publishedAt.substring(0, 10);

  const allowedGroupingReasons = POST_GROUPING_REASONS.join(', ');
  const allowedDaysOfWeek = Object.values(DayOfWeek).join(', ');
  const maxEvents = env.maxExtractedEventsPerPost;

  const systemInstruction = `You are an expert event information extraction system. Your task is to analyze the social media post caption and/or image (such as an event poster) to determine whether it describes or advertises one or more specific events, and to extract structured information for each one.

0. GROUPING DECISION (do this once per post, before extracting any individual event). Decide whether the post describes a single event or several distinct events, using these rules in order:
   a. Strong signals that the post covers SEPARATE events: different event names with no shared umbrella title, different venues/locations for items that are not stages of one program, or explicitly distinct ticket/registration links per item.
   b. Two or more weak signals together (e.g. different dates more than ~7 days apart AND different performers/lineups) also indicate SEPARATE events, even without a strong signal.
   c. Items within about 7 days of each other sharing one title/venue/umbrella program stay as ONE event with multiple schedules (groupingReason: "program-lineup").
   d. Dependent stages of one process (e.g. qualifying round then final, or a registration/sign-up window followed by the event itself) stay as ONE event -- the registration or sign-up window becomes one of its schedules, not a separate event (groupingReason: "dependent-stages").
   e. A "roundup" post that lists several unrelated events from a curator/aggregator account is its own case (see ROUNDUP HANDLING below; groupingReason: "roundup").
   f. Otherwise, treat the post as describing ONE event (groupingReason: "single-event").
   Set the top-level isEvent to true if the post/image is indeed an event poster or event advertisement for at least one event, false otherwise. When isEvent is true, put one entry per identified event into the events array (at least one entry); when isEvent is false, events must be an empty array.

ROUNDUP HANDLING: when the post is a roundup/aggregator listing (groupingReason: "roundup"), extract an item into events only when it has BOTH a readable date AND a readable location. If an item is missing either, do NOT guess -- instead add a short entry to the top-level skippedItems array describing the item and why it was skipped (e.g. "Jakarta Fun Run -- no date stated"). Do not extract more than ${maxEvents} events total for the post, even if more items are present in the source content.

For EACH identified event in the events array, extract:
1. eventName (required).
2. types: select appropriate values from this allowed list: ${allowedTypes}.
3. categories: select appropriate values from this allowed list: ${allowedCategories}.
4. schedules: for each schedule, isMainSchedule (boolean) and eventStartDate (YYYY-MM-DD) are required. Extract title, eventEndDate (YYYY-MM-DD), eventStartTime (HH:MM:SS), eventEndTime (HH:MM:SS), performers (array), location, ticketPrice, and applicableDaysOfWeek if available.
   4a. Set a schedule's applicableDaysOfWeek only when the source text states that schedule recurs only on specific weekdays within a date span (e.g. "every Friday and Saturday, Oct 1-31") -- use values from this allowed list: ${allowedDaysOfWeek}. Leave it absent when the schedule is a single occurrence or the text does not state specific recurring weekdays.
5. location, organizerName, contactInfo, and description for this specific event, if present.
5a. Classify any contact information found: if it is business/official (a role-based email such as info@venue.com, or an official venue/PT office phone number), populate contactInfo as normal. If it is private/individual (a personal phone number, a personal email address, or a wa.me/<number> WhatsApp link), do NOT populate contactInfo with it -- instead set hasPrivateContact to true and leave contactInfo absent/empty for that value. Treat a wa.me link exactly like a raw personal phone number for this classification -- never describe it merely as "a link" or minimize it, since it directly encodes a reachable personal phone number. If no contact information is present at all, leave both contactInfo and hasPrivateContact absent.
5b. Extract any explicit additional links mentioned in the caption or visible in the image for this event under links (ticketing, RSVP, merch, linktree, or similar) as an array of {url, label}, where label is an optional short label taken directly from the source text when it names the link (e.g. "Tickets:", "RSVP here"). If no such links are present, leave links absent.
6. confidenceScore between 0 and 1 indicating your confidence in this event's extraction.
7. Use the provided account name metadata (if present) to help disambiguate ambiguous location or venue references in the post text for this event.
8. A performer's name must still be extracted normally into that schedule's performers array. However, any personal contact detail belonging to a specific performer (a phone number, an email address, or a booking/management link, including a wa.me link) or any photo/image reference or URL associated with a specific performer -- wherever it appears in the caption text or the image -- must never be copied into description, contactInfo, organizerName, or any schedule field (title, location, performers). If such a detail is present in the source, omit it entirely from the extraction rather than including it in any field.
9. When more than one image is provided alongside the caption, the images are sequential slides (pages) of one social media post in their given order -- not independent posts. Schedule information for one event may be split across multiple slides (for example, one slide may list dates while another lists details). Extract schedule information from across all provided images, and merge/attribute schedule entries that describe the same event into one combined entry in that event's schedules array rather than treating each image as a separate or competing event (this is about schedules within one event -- it is independent of the post-level grouping decision above, which may still split the images' content into several distinct events).
10. organizerHandle: the @-handle specifically associated with this item -- the account that posted it, or an explicitly @-tagged organizer in the caption for this item -- even when the post's own account is a curator/aggregator. Capture this now; it will not be re-derivable from the caption later.
11. Self-report this event's extraction completeness: set minScheduleCount to the best-effort count of distinct schedules this event's caption/image content appears to describe (whether or not every field was extractable). Set expectedScheduleNames to an array of the name/title text of the schedules you can identify for this event, even when some of their other fields could not be extracted. Report a single number/count and names you are reasonably confident about; these are advisory only and are never required to be perfectly exhaustive.

Also report, once for the whole post (not per event):
- groupingReason: the exact value from this allowed list matching the rule you applied in the GROUPING DECISION above: ${allowedGroupingReasons}.
- groupingRationale: one sentence explaining your grouping decision, for debugging only.
- minEventCount: your own best-effort count of distinct events you believe the content describes overall (mirrors minScheduleCount's self-report pattern, advisory only).

The social media post was published on ${publishDate}. Use this publish date as an explicit anchor for date and year inference, for every event:
- When a schedule's date text (in the caption or image) does not state an explicit year, infer the year using this publish date as the anchor, assuming the event is happening at or after the publish date. Prefer the current or next real-world occurrence over defaulting to any other year, and never infer a year that would place the event further in the past than the publish date itself unless the source text explicitly states a past year.
- If the schedule's source text explicitly states a year, you must respect and use that stated year and do not override it.

Strictly adhere to the provided JSON schema. Do not hallucinate or fabricate information. If a field is absent, leave it null or undefined.`;

  const accountName = message.ownerDisplayName?.trim() || message.ownerUsername?.trim() || '';
  const captionWithAccountContext = accountName
    ? `Account Name Metadata: "${accountName}"\nPost Content:\n"${message.content}"`
    : message.content;

  let contents: any = captionWithAccountContext;
  let imageBytes: Buffer | undefined;
  let imageContentType: string | undefined;

  if (message.imageUrl) {
    try {
      const response = await fetch(message.imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: Status ${response.status}`);
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Fetch response content-type is not an image: ${contentType}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');

      imageBytes = buffer;
      imageContentType = contentType;

      contents = [
        { text: captionWithAccountContext },
        {
          inlineData: {
            mimeType: contentType,
            data: base64Data
          }
        }
      ];

      // Story 3.6l: batch any additional carousel (Sidecar) slide images into the SAME request,
      // in slide order, stopping at MAX_CAROUSEL_IMAGES. AD-13: batched not sequential — a carousel
      // post still costs exactly one Gemini call. Each slide is fetched inside its OWN try/catch so
      // a single slide failure can never trigger the outer cover-failure fallback below (which would
      // otherwise wipe out the already-succeeded cover image and switch to text-only).
      if (message.additionalImageUrls?.length) {
        const slidesToFetch = message.additionalImageUrls.slice(0, env.maxCarouselImages);
        for (const slideUrl of slidesToFetch) {
          try {
            const slideResponse = await fetch(slideUrl);
            if (!slideResponse.ok) {
              console.error(`Carousel slide-fetch failed for post ${message.postId} (status ${slideResponse.status}); skipping slide`, slideUrl);
              continue;
            }
            const slideContentType = slideResponse.headers.get('content-type') || 'image/jpeg';
            if (!slideContentType.startsWith('image/')) {
              console.error(`Carousel slide content-type is not an image: ${slideContentType}; skipping slide for post ${message.postId}`, slideUrl);
              continue;
            }
            const slideArrayBuffer = await slideResponse.arrayBuffer();
            const slideBuffer = Buffer.from(slideArrayBuffer);
            contents.push({
              inlineData: {
                mimeType: slideContentType,
                data: slideBuffer.toString('base64')
              }
            });
          } catch (error) {
            // Best-effort: skip only this slide; the cover and all other successfully-fetched
            // slides remain in the request (AC2).
            console.error(`Carousel slide-fetch threw for post ${message.postId}; skipping slide`, slideUrl, error);
          }
        }
      }
    } catch (error) {
      console.error(`Multimodal extraction image-fetch failed for post ${message.postId}:`, error);
      // Fallback to text-only caption extraction
      contents = captionWithAccountContext;
    }
  }

  const request: GeminiCallRequest = {
    contents,
    systemInstruction,
    // Story 3.6s — built per-call from the live env value so the prompt text's stated cap
    // (maxEvents above) and the schema's maxItems hint can never drift from each other.
    responseSchema: buildGeminiExtractionResponseSchema(maxEvents),
    responseMimeType: 'application/json',
    // Story 3.6s (AC3/AC7) — explicit response-size cap, a minimal inline stand-in for the
    // not-yet-built guarded vendor-call wrapper (0.i2a-0.i2c).
    maxOutputTokens: env.geminiMaxOutputTokens,
    timeoutMs: env.geminiExtractionTimeoutMs
  };

  return {
    request,
    imageBytes,
    imageContentType
  };
}
