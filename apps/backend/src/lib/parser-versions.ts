import { db } from '../db/client.js';
import { parserVersionRegistry } from '@festgrid/database';
import { eq } from 'drizzle-orm';

export interface ParserVersion {
  id: string;
  version: string;
  description?: string | null;
  sourceFile?: string | null;
  deployedAt: Date;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Get a parser version by version string
 */
export async function getParserVersion(versionString: string): Promise<ParserVersion | null> {
  const rows = await db
    .select()
    .from(parserVersionRegistry)
    .where(eq(parserVersionRegistry.version, versionString))
    .limit(1);

  return rows[0] || null;
}

/**
 * Get the currently active parser version
 */
export async function getActiveParserVersion(): Promise<ParserVersion | null> {
  const rows = await db
    .select()
    .from(parserVersionRegistry)
    .where(eq(parserVersionRegistry.isActive, true))
    .limit(1);

  return rows[0] || null;
}

/**
 * Get all parser versions, optionally filtered to active only
 */
export async function getAllParserVersions(onlyActive: boolean = false): Promise<ParserVersion[]> {
  const query = onlyActive
    ? db.select().from(parserVersionRegistry).where(eq(parserVersionRegistry.isActive, true))
    : db.select().from(parserVersionRegistry);

  return query;
}
