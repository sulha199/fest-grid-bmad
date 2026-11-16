/*
 * Start-up logic of the draft-label review tool (slice B of IDEA-261111-5cc): choose the storage, prepare the local working
 * directory, fetch the drafts, start the local server. The script `scripts/review-extraction-drafts.ts` only calls this.
 * Everything printed here names counts and folders, never the content of a post.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { assertOutsideRepo, defaultWorkDir, layoutOf, listDraftIds, type Layout } from './work-dir.js';
import { startReviewServer, type RunningReview } from './review-server.js';
import { AwsCliStorage, DirectoryStorage, type AwsRunner, type DraftStorage } from './storage.js';

export interface ReviewArgs {
  /** The private S3 bucket (never written in this repository: pass it, or set EXTRACTION_EVAL_REVIEW_BUCKET). */
  bucket?: string;
  /** A local directory laid out like the bucket: for rehearsing with synthetic data and no AWS. */
  localBucket?: string;
  workDir?: string;
  port?: number;
  /** Download the drafts again even if the working directory already holds some. */
  refresh?: boolean;
}

export const REVIEW_BUCKET_ENV = 'EXTRACTION_EVAL_REVIEW_BUCKET';

export function chooseStorage(args: ReviewArgs, env: Record<string, string | undefined>, run?: AwsRunner): DraftStorage {
  if (args.bucket !== undefined && args.localBucket !== undefined) throw new Error('use --bucket or --local-bucket, not both');
  if (args.localBucket !== undefined) return new DirectoryStorage(resolve(args.localBucket));
  const bucket = args.bucket ?? env[REVIEW_BUCKET_ENV];
  if (bucket === undefined || bucket === '') throw new Error(`say where the drafts are: --bucket <bucket> or ${REVIEW_BUCKET_ENV}=<bucket> (or --local-bucket <dir> to rehearse with synthetic data)`);
  return new AwsCliStorage(bucket, run);
}

export interface StartedReview {
  layout: Layout;
  review: RunningReview;
  downloaded: boolean;
  draftCount: number;
}

export async function startReview(args: ReviewArgs, env: Record<string, string | undefined>, options: { repoRoot: string; categories: readonly string[]; run?: AwsRunner }): Promise<StartedReview> {
  const storage = chooseStorage(args, env, options.run);
  const root = resolve(args.workDir ?? defaultWorkDir());
  assertOutsideRepo(root, options.repoRoot);
  const layout = layoutOf(root);
  mkdirSync(layout.drafts, { recursive: true });
  // The marker is written only after a download finished, so an interrupted first download is never mistaken for the full set.
  const marker = join(layout.root, 'drafts.complete');
  const downloaded = args.refresh === true || !existsSync(marker);
  if (downloaded) {
    await storage.downloadDrafts(layout.drafts);
    writeFileSync(marker, `${new Date().toISOString()}\n`);
  }
  const draftCount = listDraftIds(layout.drafts).length;
  if (draftCount === 0) throw new Error('there are no drafts to review (no <postId>/label.json found in the working directory)');
  const review = await startReviewServer({ layout, storage, categories: options.categories }, args.port ?? 0);
  return { layout, review, downloaded, draftCount };
}
