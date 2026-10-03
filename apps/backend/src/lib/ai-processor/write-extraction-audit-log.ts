import { db } from '../../db/client.js';
import { extractionAuditLogs } from '@festgrid/database';
import type { ExtractionAuditEventCompleteness } from '@festgrid/domain/events';
import type { PostGroupingReason } from '@festgrid/domain/posts';

export interface WriteExtractionAuditLogParams {
  postId: string;
  geminiModel: string;
  isEvent: boolean;
  hasFaceImage: boolean | null;
  faceImageCount: number | null;
  minEventCount: number | null;
  actualEventCount: number;
  groupingReason: PostGroupingReason | null;
  eventsCompleteness: ExtractionAuditEventCompleteness[];
}

// AD-29 -- one row per extraction attempt. DB-coupled (imports the Drizzle table), so this
// stays in apps/backend, never packages/domain, per project-context.md's Code Organization
// rule. No seam export: tests verify behavior by reading the row back from the real DB
// (this codebase's established integration-test convention), not by mocking this call.
// Returns the inserted row's id (amended 2026-10-03, AskUserQuestion at Story 3.6o's
// creation) so Story 3.6n/3.6o can target this exact row for their own
// actualFaceDetectionCount/faceDetectionSkippedReason backfills without a second query --
// this story itself never writes either of those two columns.
export async function writeExtractionAuditLog(params: WriteExtractionAuditLogParams): Promise<{ id: string }> {
  const [row] = await db.insert(extractionAuditLogs).values(params).returning({ id: extractionAuditLogs.id });
  return row;
}
