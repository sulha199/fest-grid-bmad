/*
 * Local review tool for the draft labels of the extraction accuracy eval (slice B of IDEA-261111-5cc).
 * Docs: docs/infrastructure/extraction-accuracy-eval.md ("Reviewing draft labels").
 *
 *   pnpm --filter backend exec tsx scripts/review-extraction-drafts.ts --bucket <bucket> [--work-dir <dir>] [--port N] [--refresh]
 *   pnpm --filter backend exec tsx scripts/review-extraction-drafts.ts --local-bucket <dir>      (rehearsal with synthetic data, no AWS)
 *
 * It runs on YOUR machine with YOUR AWS credentials (the aws CLI; this code never reads them). It starts a server on 127.0.0.1 and
 * prints its address; open that in a browser. The drafts hold real posts: this tool sends nothing to any AI service and makes no
 * request except the aws CLI calls to the bucket you name. The working directory must be outside the git checkout.
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { EventCategory } from '@festgrid/shared-types';
import { startReview } from '../src/lib/extraction-eval-review/review-run.js';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      bucket: { type: 'string' },
      'local-bucket': { type: 'string' },
      'work-dir': { type: 'string' },
      port: { type: 'string' },
      refresh: { type: 'boolean' },
    },
    strict: true,
  });
  const port = values.port === undefined ? undefined : Number(values.port);
  if (port !== undefined && (!Number.isInteger(port) || port < 0 || port > 65535)) throw new Error('--port must be a whole number between 0 and 65535');
  const started = await startReview(
    { bucket: values.bucket, localBucket: values['local-bucket'], workDir: values['work-dir'], port, refresh: values.refresh },
    process.env,
    { repoRoot: resolve(__dirname, '../../..'), categories: Object.values(EventCategory) }
  );
  console.log(`${started.draftCount} drafts in ${started.layout.root}${started.downloaded ? ' (downloaded now)' : ' (already there; --refresh downloads again)'}`);
  console.log(`Open this address in your browser (it is secret to this session; stop with Ctrl+C):\n\n  ${started.review.url}\n`);
  const stop = (): void => {
    void started.review.close().then(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err: unknown) => {
  console.error(`The review tool could not start: ${err instanceof Error ? err.message : 'unexpected error'}`);
  process.exitCode = 1;
});
