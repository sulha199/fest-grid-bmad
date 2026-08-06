import { db } from '../../db/client.js';
import { userSettings } from '@festgrid/database';
import { eq } from 'drizzle-orm';

export async function getOrCreateUserSettings(userId: string) {
  // Try to find the settings first
  const existingSettings = await db.select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (existingSettings.length > 0) {
    return existingSettings[0];
  }

  // Insert if not exists, safely racing concurrent requests
  await db.insert(userSettings)
    .values({
      userId,
    })
    .onConflictDoNothing({ target: userSettings.userId });

  // Re-select to get the final row (whichever request won)
  const finalSettings = await db.select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return finalSettings[0];
}
