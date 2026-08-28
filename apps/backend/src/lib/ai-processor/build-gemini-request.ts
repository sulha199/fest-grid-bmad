import { EventType, EventCategory } from '@festgrid/shared-types';
import { type ProcessingJobMessage } from '@festgrid/domain/posts';
import { type GeminiCallRequest } from '../ai-gateway/gemini-client.js';

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
    description: { type: 'STRING' },
    confidenceScore: { type: 'NUMBER' }
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
7. Assign a confidenceScore between 0 and 1 indicating your confidence in the extraction.

The social media post was published on ${publishDate}. Use this publish date as an explicit anchor for date and year inference:
- When a schedule's date text (in the caption or image) does not state an explicit year, infer the year using this publish date as the anchor, assuming the event is happening at or after the publish date. Prefer the current or next real-world occurrence over defaulting to any other year, and never infer a year that would place the event further in the past than the publish date itself unless the source text explicitly states a past year.
- If the schedule's source text explicitly states a year, you must respect and use that stated year and do not override it.

Strictly adhere to the provided JSON schema. Do not hallucinate or fabricate information. If a field is absent, leave it null or undefined.`;

  let contents: any = message.content;
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
        { text: message.content },
        {
          inlineData: {
            mimeType: contentType,
            data: base64Data
          }
        }
      ];
    } catch (error) {
      console.error(`Multimodal extraction image-fetch failed for post ${message.postId}:`, error);
      // Fallback to text-only caption extraction
      contents = message.content;
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
