import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { loadBackendEnv } from '../../env.js';
import type { SupabaseJwtPayload } from './verify-jwt.js';

let dbClient: ReturnType<typeof drizzle> | null = null;

function getDb() {
  if (!dbClient) {
    const env = loadBackendEnv();
    if (!env.databaseUrl) {
      throw new Error('DATABASE_URL is not defined in environment variables.');
    }
    const sqlClient = postgres(env.databaseUrl, { max: 1 });
    dbClient = drizzle(sqlClient);
  }
  return dbClient;
}

export async function getOrCreateUser(payload: SupabaseJwtPayload): Promise<{ id: string; role: 'user' | 'moderator' }> {
  const db = getDb();

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
