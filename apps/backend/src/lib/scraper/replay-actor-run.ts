import { db } from '../../db/client.js';
import { scraperActorRuns, socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { fetchApifyRunOutput, fetchBrightDataRunOutput } from './fetch-vendor-run-output.js';
import { persistScrapedPost } from '../posts/persist-scraped-post.js';
import { mapApifyItemToScrapedPost } from './instagram-adapter.js';
import { compileValidator } from '../../validation/validate.js';
import { scrapedPostSchema } from '../../validation/scraped-post.schema.js';
import type { ScrapedPost } from '@festgrid/domain';

const validateScrapedPost = compileValidator<ScrapedPost>(scrapedPostSchema);

export interface ReplayActorRunResult {
  success: boolean;
  postsPersisted: number;
  message: string;
}

/**
 * Replay an actor run to re-process its output or fetch stored output.
 * If rawOutput is already stored, reuses it directly.
 * If rawOutput is null, fetches the vendor's run fresh by stored run ID.
 * Re-processes through existing post-persistence pipeline (idempotent via postUrl dedup).
 */
export async function replayActorRun(actorRunId: string): Promise<ReplayActorRunResult> {
  try {
    // Load the scraper_actor_runs row
    const [run] = await db
      .select()
      .from(scraperActorRuns)
      .where(eq(scraperActorRuns.id, actorRunId));

    if (!run) {
      return {
        success: false,
        postsPersisted: 0,
        message: `Actor run not found: ${actorRunId}`,
      };
    }

    // Fetch profile for context
    const [profile] = await db
      .select()
      .from(socialMediaAccountProfiles)
      .where(eq(socialMediaAccountProfiles.id, run.profileId));

    if (!profile) {
      return {
        success: false,
        postsPersisted: 0,
        message: `Profile not found for actor run ${actorRunId}`,
      };
    }

    let outputItems: unknown[] = [];

    // Determine output source: stored vs. fetch
    if (run.rawOutput) {
      // Stored output path: reuse directly (no vendor API call)
      outputItems = (run.rawOutput as any[]) || [];
    } else {
      // Missing output path: fetch fresh from vendor
      try {
        const output =
          run.vendor === 'APIFY'
            ? await fetchApifyRunOutput(run.runId)
            : await fetchBrightDataRunOutput(run.runId);

        if (output.status !== 'SUCCEEDED') {
          return {
            success: false,
            postsPersisted: 0,
            message: `Vendor run fetch failed with status: ${output.status}`,
          };
        }

        outputItems = output.items;

        // Persist fetched output back onto the row
        await db
          .update(scraperActorRuns)
          .set({
            rawOutput: outputItems,
            itemCount: outputItems.length,
            status: 'SUCCEEDED',
            updatedAt: new Date(),
          })
          .where(eq(scraperActorRuns.id, actorRunId));
      } catch (error) {
        return {
          success: false,
          postsPersisted: 0,
          message: `Failed to fetch vendor run output: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    }

    // Re-process items through post-persistence pipeline
    let newPostsCount = 0;

    if (run.vendor === 'APIFY') {
      // Process as Apify items
      for (const item of outputItems) {
        try {
          const post = await mapApifyItemToScrapedPost(item);
          if (!post) continue;

          const result = await persistScrapedPost({
            accountId: run.profileId,
            platform: profile.platform,
            postUrl: post.postUrl,
            imageUrl: post.imageUrl || null,
            content: post.content,
            publishedAt: post.publishedAt,
          });

          if (!result.alreadyExisted) {
            newPostsCount++;
          }
        } catch (error) {
          console.error(`Failed to persist replayed Apify post:`, error);
          // Continue processing other items
        }
      }
    } else {
      // Process as Bright Data records
      for (const record of outputItems) {
        try {
          const brightDataRecord = record as Record<string, unknown>;

          const postUrl = brightDataRecord.url as string;
          const imageUrl = brightDataRecord.image_url as string;
          const caption = brightDataRecord.caption as string;
          const datePosted = brightDataRecord.date_posted as string;

          if (!postUrl) continue;

          const publishedAtStr = datePosted
            ? new Date(datePosted).toISOString()
            : new Date().toISOString();

          const candidate: ScrapedPost = {
            content: caption || '',
            postUrl,
            publishedAt: publishedAtStr,
            ...(imageUrl && { imageUrl }),
          };

          if (!validateScrapedPost(candidate)) {
            console.warn(`Replayed Bright Data record failed validation:`, validateScrapedPost.errors);
            continue;
          }

          const result = await persistScrapedPost({
            accountId: run.profileId,
            platform: profile.platform,
            postUrl: candidate.postUrl,
            imageUrl: candidate.imageUrl || null,
            content: candidate.content,
            publishedAt: candidate.publishedAt,
          });

          if (!result.alreadyExisted) {
            newPostsCount++;
          }
        } catch (error) {
          console.error(`Failed to persist replayed Bright Data post:`, error);
          // Continue processing other items
        }
      }
    }

    return {
      success: true,
      postsPersisted: newPostsCount,
      message:
        newPostsCount === 0
          ? 'Replay completed: no new posts (already existed)'
          : `Replay completed: ${newPostsCount} new post(s) persisted`,
    };
  } catch (error) {
    return {
      success: false,
      postsPersisted: 0,
      message: `Replay failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
