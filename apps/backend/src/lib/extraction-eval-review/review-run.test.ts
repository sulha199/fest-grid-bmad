import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { chooseStorage, REVIEW_BUCKET_ENV, startReview } from './review-run.js';
import { buildFakeBucket, DRAFT_IDS, tempDir } from './review-test-support.js';
import { AwsCliStorage, DirectoryStorage, type AwsRunner } from './storage.js';

const repoRoot = tempDir('review-repo');

test('chooseStorage: a local bucket, a --bucket, or the environment variable; nothing named is an error that says what to pass', () => {
  assert.ok(chooseStorage({ localBucket: '/somewhere' }, {}) instanceof DirectoryStorage);
  assert.ok(chooseStorage({ bucket: 'my-private-bucket' }, {}) instanceof AwsCliStorage);
  assert.equal(chooseStorage({}, { [REVIEW_BUCKET_ENV]: 'env-private-bucket' }).describe(), 's3://env-private-bucket');
  assert.equal(chooseStorage({ bucket: 'flag-private-bucket' }, { [REVIEW_BUCKET_ENV]: 'env-private-bucket' }).describe(), 's3://flag-private-bucket');
  assert.throws(() => chooseStorage({}, {}), /--bucket <bucket> or EXTRACTION_EVAL_REVIEW_BUCKET=<bucket>/);
  assert.throws(() => chooseStorage({}, { [REVIEW_BUCKET_ENV]: '' }), /say where the drafts are/);
  assert.throws(() => chooseStorage({ bucket: 'my-private-bucket', localBucket: '/x' }, {}), /not both/);
});

test('startReview downloads the drafts once, serves them, and does not download again unless asked', async () => {
  const bucket = buildFakeBucket();
  const workDir = join(tempDir('review-home'), 'work');
  const first = await startReview({ localBucket: bucket, workDir }, {}, { repoRoot, categories: ['MUSIC'] });
  try {
    assert.equal(first.downloaded, true);
    assert.equal(first.draftCount, 3);
    const list = await (await fetch(`${first.review.url}api/drafts`)).json();
    assert.equal(list.posts.length, 3);
  } finally {
    await first.review.close();
  }
  // a new draft appears in the bucket; without --refresh the working copy is kept as it is
  const second = await startReview({ localBucket: bucket, workDir }, {}, { repoRoot, categories: ['MUSIC'] });
  try {
    assert.equal(second.downloaded, false);
  } finally {
    await second.review.close();
  }
  const third = await startReview({ localBucket: bucket, workDir, refresh: true }, {}, { repoRoot, categories: ['MUSIC'] });
  try {
    assert.equal(third.downloaded, true);
  } finally {
    await third.review.close();
  }
});

test('startReview refuses a working directory inside the repository and a store with no drafts', async () => {
  await assert.rejects(() => startReview({ localBucket: buildFakeBucket(), workDir: join(repoRoot, 'work') }, {}, { repoRoot, categories: [] }), /inside the repository checkout/);
  const empty = tempDir('review-empty-bucket');
  mkdirSync(join(empty, 'extraction-eval-drafts', 'p-nolabel'), { recursive: true });
  writeFileSync(join(empty, 'extraction-eval-drafts', 'p-nolabel', 'draft.json'), '{}');
  await assert.rejects(() => startReview({ localBucket: empty, workDir: join(tempDir('review-home'), 'w') }, {}, { repoRoot, categories: [] }), /there are no drafts to review/);
});

test('startReview with the aws storage runs the sync through the injected runner', async () => {
  const calls: string[][] = [];
  const run: AwsRunner = async (args) => {
    calls.push(args);
    // pretend the sync produced one draft
    const target = args[3]!;
    mkdirSync(join(target, DRAFT_IDS.single), { recursive: true });
    writeFileSync(join(target, DRAFT_IDS.single, 'label.json'), JSON.stringify({ postId: DRAFT_IDS.single, caption: 'c', images: [], publishedAt: '2026-01-01T00:00:00Z', events: [] }));
    return { code: 0, stdout: '', stderr: '' };
  };
  const started = await startReview({ bucket: 'my-private-bucket', workDir: join(tempDir('review-home'), 'w') }, {}, { repoRoot, categories: [], run });
  try {
    assert.deepEqual(calls[0]!.slice(0, 3), ['s3', 'sync', 's3://my-private-bucket/extraction-eval-drafts/']);
    assert.equal(started.draftCount, 1);
  } finally {
    await started.review.close();
  }
});
