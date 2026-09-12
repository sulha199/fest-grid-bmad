import { EventType, EventCategory } from '@festgrid/shared-types';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { type GeminiCallRequest } from '../ai-gateway/gemini-client.js';
import { loadBackendEnv } from '../../env.js';

export const geminiExtractionResponseSchema = {
  type: 'OBJECT',
  properties: {
    isEvent: { type: 'BOOLEAN' },
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
          ticketPrice: { type: 'STRING' }
        },
        required: ['isMainSchedule', 'eventStartDate']
      }
    },
    location: { type: 'STRING' },
    organizerName: { type: 'STRING' },
    contactInfo: { type: 'STRING' },
    hasPrivateContact: { type: 'BOOLEAN' },
    description: { type: 'STRING' },
    confidenceScore: { type: 'NUMBER' },
    // Model-self-reported completeness signal (Story 3.6l). Optional — never in `required`,
    // never persisted anywhere. `minScheduleCount` is a best-effort count of distinct
    // schedules/events the caption + all provided images appear to describe; the producer of
    // the request only logs when the parsed schedules fall short of it.
    minScheduleCount: { type: 'NUMBER' },
    expectedScheduleNames: { type: 'ARRAY', items: { type: 'STRING' } }
  },
  required: ['isEvent', 'eventName', 'types', 'categories', 'schedules', 'confidenceScore']
};

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

  const systemInstruction = `You are an expert event information extraction system. Your task is to analyze the social media post caption and/or image (such as an event poster) to:
1. Determine if it describes or advertises a specific event (set isEvent to true if the post/image is indeed an event poster or event advertisement, false otherwise).
2. Extract the eventName (required if isEvent is true).
3. Select appropriate types from this allowed list: ${allowedTypes}.
4. Select appropriate categories from this allowed list: ${allowedCategories}.
5. Extract schedule(s) under schedules. For each schedule, isMainSchedule (boolean) and eventStartDate (YYYY-MM-DD) are required. Extract title, eventEndDate (YYYY-MM-DD), eventStartTime (HH:MM:SS), eventEndTime (HH:MM:SS), performers (array), location, and ticketPrice if available.
6. Extract the top-level location, organizerName, contactInfo, and description if present.
6a. Classify any contact information found: if it is business/official (a role-based email such as info@venue.com, or an official venue/PT office phone number), populate contactInfo as normal. If it is private/individual (a personal phone number, a personal email address, or a wa.me/<number> WhatsApp link), do NOT populate contactInfo with it -- instead set hasPrivateContact to true and leave contactInfo absent/empty for that value. Treat a wa.me link exactly like a raw personal phone number for this classification -- never describe it merely as "a link" or minimize it, since it directly encodes a reachable personal phone number. If no contact information is present at all, leave both contactInfo and hasPrivateContact absent.
7. Assign a confidenceScore between 0 and 1 indicating your confidence in the extraction.
8. Use the provided account name metadata (if present) to help disambiguate ambiguous location or venue references in the post text.
9. A performer's name must still be extracted normally into that schedule's performers array. However, any personal contact detail belonging to a specific performer (a phone number, an email address, or a booking/management link, including a wa.me link) or any photo/image reference or URL associated with a specific performer -- wherever it appears in the caption text or the image -- must never be copied into description, contactInfo, organizerName, or any schedule field (title, location, performers). If such a detail is present in the source, omit it entirely from the extraction rather than including it in any field.
10. When more than one image is provided alongside the caption, the images are sequential slides (pages) of one social media post in their given order -- not independent posts. Schedule information may be split across multiple slides (for example, one slide may list dates while another lists details). Extract schedule information from across all provided images, and merge/attribute schedule entries that describe the same event into one combined entry in the schedules array rather than treating each image as a separate or competing event.
11. Self-report your extraction completeness: set minScheduleCount to the best-effort count of distinct schedules/events the caption and all provided images together appear to describe (whether or not every field was extractable, and for the single-image case just the events apparent from the single image and caption). Set expectedScheduleNames to an array of the name/title text of the schedules you can identify, even when some of their other fields could not be extracted. Report a single number/count and names you are reasonably confident about; these are advisory only and are never required to be perfectly exhaustive.

The social media post was published on ${publishDate}. Use this publish date as an explicit anchor for date and year inference:
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
    responseSchema: geminiExtractionResponseSchema,
    responseMimeType: 'application/json'
  };

  return {
    request,
    imageBytes,
    imageContentType
  };
}
