import assert from 'node:assert/strict';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { AwsCliStorage, awsCliRunner, DirectoryStorage, assertPostId, type AwsResult, type AwsRunner } from './storage.js';
import { buildFakeBucket, DRAFT_IDS, tempDir } from './review-test-support.js';

const fakeAws = (results: AwsResult[], calls: string[][]): AwsRunner => async (args) => {
  calls.push(args);
  return results.shift() ?? { code: 0, stdout: '', stderr: '' };
};

test('assertPostId accepts the post id alphabet and nothing that could climb out of a folder', () => {
  assert.doesNotThrow(() => assertPostId('p-0a1b2c3d'));
  for (const bad of ['', '..', 'a/b', 'a b', '../x', 'a\\b']) assert.throws(() => assertPostId(bad), /not a valid post id/);
});

test('DirectoryStorage downloads the drafts, reports existing verified posts and uploads a staged folder', async () => {
  const bucket = buildFakeBucket();
  const storage = new DirectoryStorage(bucket);
  assert.match(storage.describe(), /local directory/);
  const into = join(tempDir('review-dl'), 'drafts');
  await storage.downloadDrafts(into);
  assert.ok(existsSync(join(into, DRAFT_IDS.single, 'label.json')));
  assert.ok(existsSync(join(into, DRAFT_IDS.single, 'draft.json')));

  assert.equal(await storage.verifiedExists(DRAFT_IDS.single), false);
  const staged = tempDir('review-stage');
  writeFileSync(join(staged, 'label.json'), '{}');
  await storage.uploadVerified(DRAFT_IDS.single, staged);
  assert.equal(await storage.verifiedExists(DRAFT_IDS.single), true);
  assert.equal(readFileSync(join(bucket, 'extraction-eval', DRAFT_IDS.single, 'label.json'), 'utf8'), '{}');
  await assert.rejects(() => storage.verifiedExists('../x'), /not a valid post id/);
  await assert.rejects(() => storage.uploadVerified('../x', staged), /not a valid post id/);
});

test('DirectoryStorage without a drafts folder says so', async () => {
  await assert.rejects(() => new DirectoryStorage(tempDir('review-empty')).downloadDrafts(tempDir('review-dl')), /no "extraction-eval-drafts" folder/);
});

test('AwsCliStorage builds the expected aws commands', async () => {
  const calls: string[][] = [];
  const storage = new AwsCliStorage('my-private-bucket', fakeAws([{ code: 0, stdout: '', stderr: '' }, { code: 0, stdout: '{}', stderr: '' }, { code: 0, stdout: '', stderr: '' }, { code: 0, stdout: '', stderr: '' }], calls));
  assert.equal(storage.describe(), 's3://my-private-bucket');
  await storage.downloadDrafts('/work/drafts');
  assert.equal(await storage.verifiedExists('p-1'), true);
  await storage.uploadVerified('p-1', '/work/verified/p-1');
  assert.deepEqual(calls, [
    ['s3', 'sync', 's3://my-private-bucket/extraction-eval-drafts/', '/work/drafts', '--only-show-errors'],
    ['s3api', 'head-object', '--bucket', 'my-private-bucket', '--key', 'extraction-eval/p-1/label.json'],
    ['s3', 'sync', '/work/verified/p-1', 's3://my-private-bucket/extraction-eval/p-1/', '--exclude', 'label.json', '--only-show-errors'],
    ['s3', 'cp', '/work/verified/p-1/label.json', 's3://my-private-bucket/extraction-eval/p-1/label.json', '--only-show-errors'],
  ]);
});

test('AwsCliStorage: only a real 404 means "not there yet"; any other failure is an error, never a silent overwrite', async () => {
  const notFound = new AwsCliStorage('my-private-bucket', fakeAws([{ code: 254, stdout: '', stderr: 'An error occurred (404) when calling the HeadObject operation: Not Found' }], []));
  assert.equal(await notFound.verifiedExists('p-1'), false);
  const denied = new AwsCliStorage('my-private-bucket', fakeAws([{ code: 254, stdout: '', stderr: 'An error occurred (403) when calling the HeadObject operation: Forbidden\nmore' }], []));
  await assert.rejects(() => denied.verifiedExists('p-1'), /could not check for an existing verified label \(exit code 254\): An error occurred \(403\)/);
});

test('AwsCliStorage: sync failures name the exit code and the first line of the error', async () => {
  const failing = new AwsCliStorage('my-private-bucket', fakeAws([{ code: 1, stdout: '', stderr: 'expired token\nsecond line' }, { code: 1, stdout: '', stderr: 'boom' }], []));
  await assert.rejects(() => failing.downloadDrafts('/w'), /download\) failed with exit code 1: expired token$/);
  await assert.rejects(() => failing.uploadVerified('p-1', '/w'), /upload\) failed with exit code 1: boom$/);
  // label.json goes last: if the images fail it is never sent, so no label is left without its images
  const calls: string[][] = [];
  const imagesFail = new AwsCliStorage('my-private-bucket', fakeAws([{ code: 1, stdout: '', stderr: 'no space' }], calls));
  await assert.rejects(() => imagesFail.uploadVerified('p-1', '/w'), /exit code 1: no space$/);
  assert.equal(calls.length, 1);
  const labelFails = new AwsCliStorage('my-private-bucket', fakeAws([{ code: 0, stdout: '', stderr: '' }, { code: 2, stdout: '', stderr: 'denied' }], []));
  await assert.rejects(() => labelFails.uploadVerified('p-1', '/w'), /aws s3 cp \(upload of label.json\) failed with exit code 2: denied$/);
});

test('AwsCliStorage refuses a name that is not an S3 bucket name and a post id that is not a post id', async () => {
  for (const bad of ['', 'AB', 'has space', '-lead', 'trail-', 'a'.repeat(64)]) assert.throws(() => new AwsCliStorage(bad, fakeAws([], [])), /not a valid S3 bucket name/);
  await assert.rejects(() => new AwsCliStorage('my-private-bucket', fakeAws([], [])).verifiedExists('../x'), /not a valid post id/);
  await assert.rejects(() => new AwsCliStorage('my-private-bucket', fakeAws([], [])).uploadVerified('../x', '/w'), /not a valid post id/);
});

test('awsCliRunner runs the aws binary without a shell and returns its output; a missing binary has a friendly message', async () => {
  const bin = tempDir('review-bin');
  const script = join(bin, 'aws');
  writeFileSync(script, '#!/bin/sh\necho "args:$*"\necho "problem" 1>&2\nexit 3\n');
  chmodSync(script, 0o755);
  const result = await awsCliRunner({ ...process.env, PATH: `${bin}:/usr/bin:/bin` })(['s3', 'ls', 'a b; echo hacked']);
  assert.equal(result.code, 3);
  assert.equal(result.stdout.trim(), 'args:s3 ls a b; echo hacked');
  assert.equal(result.stderr.trim(), 'problem');

  const empty = tempDir('review-nobin');
  await assert.rejects(() => awsCliRunner({ PATH: empty })(['s3', 'ls']), /the aws CLI was not found/);
});
