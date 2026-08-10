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

export async function buildGeminiExtractionRequest(
  message: ProcessingJobMessage
): Promise<GeminiCallRequest> {
  const allowedTypes = Object.values(EventType).join(', ');
  const allowedCategories = Object.values(EventCategory).join(', ');

  const systemInstruction = `You are an expert event information extraction system. Your task is to analyze the social media post caption and/or image (such as an event poster) to:
1. Determine if it describes or advertises a specific event (set isEvent to true if the post/image is indeed an event poster or event advertisement, false otherwise).
2. Extract the eventName (required if isEvent is true).
3. Select appropriate types from this allowed list: ${allowedTypes}.
4. Select appropriate categories from this allowed list: ${allowedCategories}.
5. Extract schedule(s) under schedules. For each schedule, isMainSchedule (boolean) and eventStartDate (YYYY-MM-DD) are required. Extract title, eventEndDate (YYYY-MM-DD), eventStartTime (HH:MM:SS), eventEndTime (HH:MM:SS), performers (array), location, and ticketPrice if available.
6. Extract the top-level location, organizerName, contactInfo, and description if present.
7. Assign a confidenceScore between 0 and 1 indicating your confidence in the extraction.

Strictly adhere to the provided JSON schema. Do not hallucinate or fabricate information. If a field is absent, leave it null or undefined.`;

  let contents: any = message.content;

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
      const base64Data = Buffer.from(arrayBuffer).toString('base64');

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

  return {
    contents,
    systemInstruction,
    responseSchema: geminiExtractionResponseSchema,
    responseMimeType: 'application/json'
  };
}
