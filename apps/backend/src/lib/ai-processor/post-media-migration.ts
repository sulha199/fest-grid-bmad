import { extractPostMediaKeyFromUrl, isVersionedPostMediaKey } from '@festgrid/domain/posts';

/**
 * Row classification helper shared by the backfill script's `runSizing`/`runBackfill`
 * modes (`apps/backend/src/backfill-post-media-keys.ts`, Story 3.6q).
 *
 * Kept in its own module with zero DB/Node-runtime-only imports beyond the pure
 * `@festgrid/domain/posts` helpers, so it can be unit tested without pulling in
 * `../../db/client.js` (a module-level singleton that requires a real `DATABASE_URL`/
 * `BACKEND_PORT` at import time).
 */

export interface PostMediaRow {
  id: string;
  durableImageUrl: string | null;
}

/** Returns true if this row's `durableImageUrl` needs migration (set, but not on a versioned key). */
export function needsMigration(row: PostMediaRow, cdnDomain: string): boolean {
  if (!row.durableImageUrl) return false;
  const key = extractPostMediaKeyFromUrl(cdnDomain, row.durableImageUrl);
  if (!key) return false; // doesn't match our CDN domain -- not ours to touch
  return !isVersionedPostMediaKey(key);
}
