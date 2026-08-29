import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import type { SupabaseJwtPayload } from './verify-jwt.js';

export async function getOrCreateUser(payload: SupabaseJwtPayload): Promise<{ id: string; role: 'user' | 'moderator' }> {
  // Try to find the user first
  const existingUser = await db.select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      id: existingUser[0].id,
      role: existingUser[0].role as 'user' | 'moderator',
    };
  }

  const name = payload.user_metadata?.name ?? payload.user_metadata?.full_name ?? null;
  const avatarUrl = payload.user_metadata?.avatar_url ?? null;
  
  if (!payload.email) {
    throw new Error('User email is required from JWT payload');
  }

  // Insert if not exists, safely racing concurrent requests
  await db.insert(users)
    .values({
      id: payload.sub,
      email: payload.email,
      name,
      avatarUrl,
    })
    .onConflictDoNothing({ target: users.id });

  // Re-select to get the final row (whichever request won)
  const finalUser = await db.select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, payload.sub))
    .limit(1);

  return {
    id: finalUser[0].id,
    role: finalUser[0].role as 'user' | 'moderator',
  };
}

