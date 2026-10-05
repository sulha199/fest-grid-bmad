import { db } from '../../db/client.js';
import { users, subscriptions, apiKeys } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { setSendSqsMessage, sendSqsMessage } from '../aws/send-sqs-message.js';

/**
 * Test-only seams for exercising `autoEnqueueNewPostForExtraction` against the real DB
 * (Story 3.6z's own tests use the same real-DB + `setSendSqsMessage` seam style).
 */

/**
 * Gives `accountId` one active subscriber holding one valid Gemini key, so
 * `hasAvailableApiKeyForAccount` resolves true. Returns a cleanup function that removes the rows
 * in FK order; call it before deleting the profile.
 */
export async function seedSubscriberWithGeminiKey(accountId: string): Promise<() => Promise<void>> {
  const [user] = await db.insert(users).values({
    email: `auto-enqueue-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
    role: 'user',
  }).returning();
  const [sub] = await db.insert(subscriptions).values({ userId: user.id, accountId }).returning();
  await db.insert(apiKeys).values({
    userId: user.id,
    provider: 'gemini',
    keyEncrypted: 'mock-encrypted-key',
    keyLast4: '4321',
    isValid: true,
    invalidAttempts: 0,
    usageCount: 0,
    usageCycleResetAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
  });

  return async () => {
    await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));
    await db.delete(apiKeys).where(eq(apiKeys.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));
  };
}

/**
 * Replaces the SQS sender with a recorder and points AI_PROCESSING_QUEUE_URL at a fake queue.
 * `restore()` puts back the original sender and env var.
 */
export function captureAiQueueSends(): { bodies: string[]; restore: () => void } {
  const originalSend = sendSqsMessage;
  const originalUrl = process.env.AI_PROCESSING_QUEUE_URL;
  const bodies: string[] = [];
  setSendSqsMessage(async (_queueUrl, body) => {
    bodies.push(body);
  });
  process.env.AI_PROCESSING_QUEUE_URL = 'https://sqs.us-east-1.amazonaws.com/12345/AIProcessingQueue';

  return {
    bodies,
    restore: () => {
      setSendSqsMessage(originalSend);
      if (originalUrl === undefined) {
        delete process.env.AI_PROCESSING_QUEUE_URL;
      } else {
        process.env.AI_PROCESSING_QUEUE_URL = originalUrl;
      }
    },
  };
}
