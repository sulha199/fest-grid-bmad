import { EventType, EventCategory } from '@festgrid/shared-types';
import { type ProcessingJobMessage, POST_GROUPING_REASONS, type AiImageInput } from '@festgrid/domain/posts';
import { DayOfWeek } from '@festgrid/domain/events';
import { type GeminiCallRequest } from '../ai-gateway/gemini-client.js';
import { loadBackendEnv } from '../../env.js';
// Story 3.20 (Task 3.6) -- detect-and-blur-faces.ts imports `@tensorflow/tfjs`/
// `tfjs-backend-wasm`/`sharp`/`@vladmandic/face-api` at module top level. Fixed 2026-10-04
// (prod incident): this is deliberately NOT a static import -- see `blurImageForRequest`
// below, which dynamic-imports it instead, only on the branch real callers gate behind
// `options.blurFacesBeforeAi`. A static import here was reachable from `resolvers.ts`'s
// `extractEventDataFromUrl` (apiLambda) even though that resolver never passes the option,
// crashing apiLambda at cold start since it has no sharp native binary.

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

// Story 3.6s — builds the Gemini-facing response schema. Still a function (not a module-level
// constant) for consistency with the rest of this file's env-lazy-loading convention, even
// though the schema itself no longer varies by the roundup cap (see the `events` property's own
// comment below for why `maxExtractedEventsPerPost` is NOT set as a JSON-schema `maxItems` here).
export function buildGeminiExtractionResponseSchema() {
  return {
    type: 'OBJECT',
    properties: {
      isEvent: { type: 'BOOLEAN' },
      // Story 3.6s — nests every per-event field under `events[]`. `maxExtractedEventsPerPost`
      // is still threaded in (used by the system prompt text, see below) and is still the
      // single source of truth the prompt and the code-level truncation (process-ai-job.ts)
      // both read from -- but it is deliberately NOT set as a JSON-schema `maxItems` on this
      // array. Verified live during this story's Task 9.1 fixture capture: adding `maxItems` to
      // this array, combined with `geminiEventResponseSchema`'s nested object/array complexity,
      // makes the real Gemini API reject the ENTIRE request with a 400 INVALID_ARGUMENT (the
      // structured-output constrained decoder appears to unroll a bounded array up to its
      // `maxItems` copies of the item schema internally, and this item schema is too large for
      // that to stay within some internal limit) -- confirmed by bisection: the same `maxItems`
      // value succeeds against a trivial item schema and fails only once the item schema grows
      // to this story's actual per-event shape. The cap is enforced instead via the prompt text
      // (which states the real number) and the code-level truncation backstop in
      // process-ai-job.ts -- the AJV schema already deliberately has no `maxItems` either (see
      // extracted-event.schema.ts), so this keeps both schemas consistent as "soft cap via
      // prompt + hard cap via code", never a JSON-schema array bound on this field.
      events: {
        type: 'ARRAY',
        items: geminiEventResponseSchema
      },
      // Story 3.6s (AD-30 Rule 5) — the post-level grouping decision, made once per post before
      // per-event extraction.
      groupingReason: { type: 'STRING', enum: [...POST_GROUPING_REASONS] },
      // One-sentence model self-explanation of the grouping decision, for debugging only — never
      // persisted (AD-30 Rule 5).
      groupingRationale: { type: 'STRING' },
      // Short post-level headline/title, persisted to posts.title (not required).
      postTitle: { type: 'STRING' },
      // Model's own best-effort count of distinct events it believes the content describes,
      // mirroring minScheduleCount's existing self-report/logging-only pattern.
      minEventCount: { type: 'NUMBER' },
      // Brief human-readable reason per roundup item skipped for missing a readable date or
      // location (e.g. "Jakarta Fun Run — no date stated").
      skippedItems: { type: 'ARRAY', items: { type: 'STRING' } },
      // Story 3.6m (AD-28 Rule 1) — model self-reported, once for the whole post (not per
      // event), pre-filter signal for Story 3.6n's face-detection/blur pass: whether any of the
      // already-provided image(s) show a visible person. Optional, never in `required`,
      // logging-only in this story (processAiJob) — never persisted to posts/EventInfo, never
      // exposed via GraphQL (actual persistence is Story 3.6p, AD-29).
      hasFaceImage: { type: 'BOOLEAN' },
      // Advisory/best-effort count of distinct people visible across the provided image(s) — not
      // required to be exact, especially in dense/crowd scenes. Logging-only, same scope as
      // hasFaceImage above.
      faceImageCount: { type: 'NUMBER' }
    },
    required: ['isEvent', 'events']
  };
}

// Default-cap schema, for callers/tests that only need the shape (not a specific cap value).
// buildGeminiExtractionRequest() below always builds its own copy from the live env value.
export const geminiExtractionResponseSchema = buildGeminiExtractionResponseSchema();

export interface BuildGeminiExtractionRequestResult {
  request: GeminiCallRequest;
  // Always the ORIGINAL, unblurred cover bytes (AC4) -- Story 3.6e's re-host reads this
  // unconditionally, regardless of whether blurFacesBeforeAiOptions below ran.
  imageBytes?: Buffer;
  imageContentType?: string;
  // Story 3.20 (AC5) -- additive, optional fields populated only when the cover was actually
  // routed through detectAndBlurFacesSeam (i.e. blurFacesBeforeAi was on and the owner was not
  // opted in), regardless of whether a face was found (detectAndBlurFaces already returns the
  // original bytes with faceCount: 0 when none is found -- these fields are still meaningful).
  // Never required/consumed by this story's own callers -- Story 3.21 reuses them to avoid a
  // second detection for the Story 3.6n thumbnail stage.
  blurredCoverImageBytes?: Buffer;
  coverFaceCount?: number;
  // Story 3.21 (AC1/AC3) -- always set, every branch: which image shape the AI actually
  // received for this attempt. See this function's own derivation logic below for the exact
  // precedence (no image sent; cover fetch failed; mode off; owner opted in; cover blur
  // failed closed; cover blurred successfully).
  aiImageInput: AiImageInput;
  // Story 3.21 (AC3, AD-29 Rule 7) -- present ONLY when aiImageInput === 'blurred'. The sum of
  // detectAndBlurFacesSeam's own faceCount across every image actually sent (cover + every
  // surviving slide) -- never just the cover alone, and never 0 when detection didn't run.
  totalFaceDetectionCount?: number;
}

export interface BuildGeminiExtractionRequestOptions {
  // Story 3.20 (AC1/AC2) -- when present and isOwnerOptedIn is false, every image sent to
  // Gemini (cover + each carousel slide) is blurred before being inlined into the request.
  // Absent, or isOwnerOptedIn: true, leaves every one of this function's four call sites'
  // existing byte-for-byte behavior completely unchanged (AC4) -- this is a structural property
  // of the signature (an optional second argument no other caller passes), not a runtime branch
  // that could drift.
  blurFacesBeforeAi?: {
    isOwnerOptedIn: boolean;
    // Lambda Context's getRemainingTimeInMillis, threaded through from the same
    // ProcessAiJobDeps.getRemainingTimeInMillis Story 3.6n already added to processAiJob -- no
    // second Lambda-context plumbing path. Absent (e.g. no Lambda context, as in a script/test)
    // is treated as unlimited remaining time (Infinity), never as "time's up".
    getRemainingTimeInMillis?: () => number;
  };
}

export async function buildGeminiExtractionRequest(
  message: ProcessingJobMessage,
  options?: BuildGeminiExtractionRequestOptions
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
   a. Strong signals that the post covers SEPARATE events: different event names with no shared umbrella title, different venues/locations for items that are not stages of one program, explicitly distinct ticket/registration links per item, or -- the most common real-world case -- each item has its OWN independent registration/sign-up-to-outcome pipeline (its own registration window, its own technical meeting, its own match/final day), even when all items are marketed under one overarching tournament/brand name. For example, a tournament poster listing several separate competition categories (e.g. billiard, an esports title, futsal) where EACH category has its own full registration-through-match-day timeline is SEPARATE events (one per category), NOT one event with many schedules -- the shared brand name/poster is marketing packaging, not evidence of a single event. Contrast this with rule d below, which is reserved for a single category/discipline with exactly ONE registration-to-outcome pipeline.
   b. Two or more weak signals together (e.g. different dates more than ~7 days apart AND different performers/lineups) also indicate SEPARATE events, even without a strong signal.
   c. Items within about 7 days of each other sharing one title/venue/umbrella program stay as ONE event with MULTIPLE schedules (groupingReason: "program-lineup"). This applies whenever the post lists two or more distinct sub-items (sub-performances, sub-activities, separately-dated components) under one umbrella title/venue, where those sub-items are facets of the SAME occasion rather than independent competitions each with their own pipeline (see rule a) -- e.g. a multi-day anniversary/festival program listing several named segments (a headline performance on one date, a show on another, a closing event on a third) is "program-lineup", NOT "single-event", precisely because it has more than one schedule entry under the shared umbrella.
   d. Dependent stages of ONE single process for ONE single discipline/category (e.g. one qualifying round then one final for the same competition, or one registration/sign-up window followed by that same event) stay as ONE event -- the registration or sign-up window becomes one of its schedules, not a separate event (groupingReason: "dependent-stages"). Do not use this rule when there are multiple parallel categories/disciplines each running their own such pipeline -- that is rule a (separate events), not this rule.
   e. A "roundup" post that lists several unrelated events from a curator/aggregator account is its own case (see ROUNDUP HANDLING below; groupingReason: "roundup").
   f. Otherwise -- the post describes exactly ONE schedule/occurrence with no sub-items -- use groupingReason: "single-event". Reserve "single-event" strictly for a post whose event ends up with exactly one schedule entry; as soon as an event has two or more schedule entries grouped under one umbrella (rule c) or dependent stages (rule d), use that more specific reason instead, never the generic "single-event" fallback.
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
- postTitle: a short headline/title for the post as a whole (at most about 80 characters), preferring a title the post states itself (e.g. "Weekend Event Roundup in Jakarta"); otherwise write a brief descriptive one. Omit it if no sensible title exists.
- groupingRationale: one sentence explaining your grouping decision, for debugging only.
- minEventCount: your own best-effort count of distinct events you believe the content describes overall (mirrors minScheduleCount's self-report pattern, advisory only).
- hasFaceImage: based on the same image(s) already provided above (the single image or, for a multi-slide carousel, across all provided slides), whether any provided image contains a visible person/people (e.g. a performer, a crowd, or any human figure) as opposed to a text-only flyer/graphic-design poster with no people. Set faceImageCount to your best-effort approximate count of distinct people visible across the provided image(s) -- advisory only, not required to be exact, especially in dense/crowd scenes.

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
  let blurredCoverImageBytes: Buffer | undefined;
  let coverFaceCount: number | undefined;
  // Story 3.21 (AC3) -- defaults to 'no_image_sent' and is only ever advanced forward below,
  // never reset backward by the outer catch: a cover-fetch failure (never reaches past the
  // fetch) leaves this at its default; a cover blur failure (reaches past the fetch, throws
  // inside blurImageForRequest) is tagged 'text_only_fail_closed' BEFORE the throw, so the
  // outer catch's text-only fallback does not need to -- and must not -- touch this value.
  let aiImageInput: AiImageInput = 'no_image_sent';
  let totalFaceDetectionCount: number | undefined;

  // Story 3.20 (AC1/AC2) -- only active when the caller passed the option AND the post's
  // PUBLISHER has not opted in to image storage. Both conditions collapse to false (skip all
  // blur calls, AC4) when options.blurFacesBeforeAi is absent (the three other callers) or
  // isOwnerOptedIn is true.
  const blurGate = options?.blurFacesBeforeAi;
  const shouldBlur = blurGate !== undefined && !blurGate.isOwnerOptedIn;

  // Story 3.20 (Task 3.2/3.3) -- blurs imageBuffer in place of the original before it is
  // base64-inlined. Fails closed: throws (never returns the original) when the remaining-time
  // budget is too low, or when detectAndBlurFacesSeam itself throws -- letting the caller's own
  // try/catch decide what "drop this image" means (text-only fallback for the cover, `continue`
  // for a slide), so the original is NEVER the fallback (AC3).
  async function blurImageForRequest(imageBuffer: Buffer, contentType: string): Promise<{ data: string; blurred: Buffer; faceCount: number }> {
    const remainingMs = blurGate?.getRemainingTimeInMillis?.() ?? Infinity;
    if (remainingMs < env.faceBlurMinRemainingTimeMs) {
      throw new Error(
        `Face-blur time budget too low for post ${message.postId}: ${remainingMs}ms remaining, need at least ${env.faceBlurMinRemainingTimeMs}ms`
      );
    }
    // Dynamic import, deliberately only here (see this file's top-of-file comment) -- only
    // reached when `shouldBlur` is true, i.e. a caller passed `blurFacesBeforeAi` AND the owner
    // isn't opted in. A test that overrides the seam via `setDetectAndBlurFacesSeam` before
    // calling into this file still works: that override mutates the SAME module binding this
    // dynamic import resolves to. This import() runs AFTER the remainingMs budget check above,
    // but that's not a time-budget leak for the one real caller (processAiJob): process-ai-job.ts
    // keeps its OWN import of detect-and-blur-faces.ts static and deliberately so (see that
    // file's top comment) -- by the time processAiJob ever calls into this function, Node has
    // already loaded/cached this exact module at that earlier static import, so this is a cache
    // hit, not fresh module-load cost (raised and verified during this fix's own review).
    const { detectAndBlurFacesSeam } = await import('./detect-and-blur-faces.js');
    // Sequential by construction (AD-28 Rule 10, Task 3.3) -- every call site below awaits this
    // one image at a time, cover first then each slide in order, never concurrently.
    const result = await detectAndBlurFacesSeam(imageBuffer, contentType);
    return { data: result.buffer.toString('base64'), blurred: result.buffer, faceCount: result.faceCount };
  }

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

      // AC4: imageBytes always carries the ORIGINAL, unblurred cover bytes, unconditionally --
      // set here, before any blur attempt, and never reassigned below.
      imageBytes = buffer;
      imageContentType = contentType;

      let coverDataForRequest = buffer.toString('base64');
      if (shouldBlur) {
        // Story 3.21 (AC3, Task 2.2e) -- tentatively tag as the fail-closed outcome BEFORE
        // calling the seam: if blurImageForRequest throws (budget too low, or
        // detectAndBlurFacesSeam itself failing), execution jumps straight to this function's
        // outer catch below (which falls back to text-only and never reaches the carousel loop
        // for the cover's own failure, Task 3.2) -- leaving aiImageInput at this tagged value,
        // never back at the 'no_image_sent' default. Overwritten to 'blurred' only once the
        // seam call below actually returns successfully.
        aiImageInput = 'text_only_fail_closed';
        const blurResult = await blurImageForRequest(buffer, contentType);
        coverDataForRequest = blurResult.data;
        blurredCoverImageBytes = blurResult.blurred;
        coverFaceCount = blurResult.faceCount;
        // Story 3.21 (AC3, Task 2.2f/2.3) -- the cover's own detection succeeded: this attempt's
        // aiImageInput is 'blurred', and the running sum (AD-29 Rule 7: across every image sent)
        // starts from the cover's own count.
        aiImageInput = 'blurred';
        totalFaceDetectionCount = blurResult.faceCount;
      } else {
        // Story 3.21 (AC3, Task 2.2c/2.2d) -- cover fetched OK, no blur attempted: disambiguate
        // "the option was never passed" (mode off) from "passed, but this owner opted in".
        aiImageInput = blurGate === undefined ? 'original_mode_off' : 'original_owner_opted_in';
      }

      contents = [
        { text: captionWithAccountContext },
        {
          inlineData: {
            mimeType: contentType,
            data: coverDataForRequest
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
        for (const [slideIndex, slideUrl] of slidesToFetch.entries()) {
          try {
            const slideResponse = await fetch(slideUrl);
            if (!slideResponse.ok) {
              console.error(`Carousel slide-fetch failed for post ${message.postId} (image index ${slideIndex + 1}, status ${slideResponse.status}); skipping slide`, slideUrl);
              continue;
            }
            const slideContentType = slideResponse.headers.get('content-type') || 'image/jpeg';
            if (!slideContentType.startsWith('image/')) {
              console.error(`Carousel slide content-type is not an image: ${slideContentType}; skipping slide for post ${message.postId} (image index ${slideIndex + 1})`, slideUrl);
              continue;
            }
            const slideArrayBuffer = await slideResponse.arrayBuffer();
            const slideBuffer = Buffer.from(slideArrayBuffer);

            // Story 3.20 (Task 3.3/7.2) -- blurImageForRequest's own time-budget check (above)
            // throws BEFORE ever calling detectAndBlurFacesSeam when the floor isn't met, so the
            // catch below drops this slide without having invoked the seam for it -- the same
            // fail-closed outcome as the seam itself throwing, no separate pre-check needed.
            let slideDataForRequest = slideBuffer.toString('base64');
            if (shouldBlur) {
              const blurResult = await blurImageForRequest(slideBuffer, slideContentType);
              slideDataForRequest = blurResult.data;
              // Story 3.21 (AC3, Task 2.3, AD-29 Rule 7) -- add this slide's own faceCount into
              // the running total. Reached only when the cover already succeeded (a cover
              // failure jumps straight to the outer catch before this loop ever runs), so
              // aiImageInput is already 'blurred' and totalFaceDetectionCount already seeded
              // from the cover by this point.
              totalFaceDetectionCount = (totalFaceDetectionCount ?? 0) + blurResult.faceCount;
            }

            contents.push({
              inlineData: {
                mimeType: slideContentType,
                data: slideDataForRequest
              }
            });
          } catch (error) {
            // Best-effort: skip only this slide (whether the failure was the fetch or the blur);
            // the cover and all other successfully-processed slides remain in the request (AC2/AC3).
            console.error(`Carousel slide-fetch/blur failed for post ${message.postId} (image index ${slideIndex + 1}); skipping slide`, slideUrl, error);
          }
        }
      }
    } catch (error) {
      console.error(`Multimodal extraction image processing failed for post ${message.postId} (image index 0, cover):`, error);
      // Fallback to text-only caption extraction. Never the original, unblurred cover bytes
      // (AC3) -- `contents` is reset to the caption text only.
      contents = captionWithAccountContext;
    }
  }

  const request: GeminiCallRequest = {
    contents,
    systemInstruction,
    responseSchema: buildGeminiExtractionResponseSchema(),
    responseMimeType: 'application/json',
    // Story 3.6s (AC3) — explicit response-size cap.
    maxOutputTokens: env.geminiMaxOutputTokens,
  };

  return {
    request,
    imageBytes,
    imageContentType,
    blurredCoverImageBytes,
    coverFaceCount,
    aiImageInput,
    totalFaceDetectionCount
  };
}
