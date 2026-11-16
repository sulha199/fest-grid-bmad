/*
 * Where the draft-label review tool reads drafts from and writes verified labels to (slice B of IDEA-261111-5cc).
 *
 * Two implementations behind one small interface:
 * - AwsCliStorage: the maintainer's own AWS credentials, through the `aws` CLI (the same tool the eval workflow uses). This
 *   code never reads, stores or prints a credential, and it adds no SDK dependency.
 * - DirectoryStorage: a plain local directory laid out like the bucket. It exists so the tool can be tested and rehearsed with
 *   synthetic data and no AWS at all.
 *
 * Layout (the same under a bucket and under a directory):
 *   extraction-eval-drafts/<postId>/   drafts: label.json (UNVERIFIED), draft.json (provenance) and the images
 *   extraction-eval/<postId>/          verified posts: label.json and the images ONLY (this is what the eval workflow reads)
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const DRAFTS_PREFIX = 'extraction-eval-drafts';
export const VERIFIED_PREFIX = 'extraction-eval';

const POST_ID = /^[A-Za-z0-9_-]+$/;
// S3 bucket naming rules: 3-63 characters, lower-case letters, digits, dots and hyphens, starting and ending with a letter or digit.
const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export function assertPostId(postId: string): void {
  if (!POST_ID.test(postId)) throw new Error('not a valid post id (letters, digits, - and _ only)');
}

export interface DraftStorage {
  /** One line for the console: where this reads and writes (a bucket name or a directory; shown to the maintainer only). */
  describe(): string;
  /** Copy every draft folder into `intoDir`. */
  downloadDrafts(intoDir: string): Promise<void>;
  /** Does a verified label for this post already exist? Used to refuse a silent overwrite. */
  verifiedExists(postId: string): Promise<boolean>;
  /** Copy a staged folder (label.json and images) to the verified prefix of this post. */
  uploadVerified(postId: string, fromDir: string): Promise<void>;
}

// --------------------------------------------------------------------------------------------------------------------------

/** A directory laid out like the bucket: for tests and dry runs. */
export class DirectoryStorage implements DraftStorage {
  constructor(private readonly root: string) {}

  describe(): string {
    return `local directory ${this.root}`;
  }

  async downloadDrafts(intoDir: string): Promise<void> {
    const source = join(this.root, DRAFTS_PREFIX);
    if (!existsSync(source)) throw new Error(`no "${DRAFTS_PREFIX}" folder in the local directory`);
    mkdirSync(intoDir, { recursive: true });
    cpSync(source, intoDir, { recursive: true });
  }

  async verifiedExists(postId: string): Promise<boolean> {
    assertPostId(postId);
    return existsSync(join(this.root, VERIFIED_PREFIX, postId, 'label.json'));
  }

  async uploadVerified(postId: string, fromDir: string): Promise<void> {
    assertPostId(postId);
    const target = join(this.root, VERIFIED_PREFIX, postId);
    mkdirSync(target, { recursive: true });
    cpSync(fromDir, target, { recursive: true });
  }
}

// --------------------------------------------------------------------------------------------------------------------------

export interface AwsResult {
  code: number;
  stdout: string;
  stderr: string;
}
export type AwsRunner = (args: string[]) => Promise<AwsResult>;

/** Runs the `aws` CLI with the caller's own credentials (profile, SSO or environment). No shell is involved. */
export function awsCliRunner(env: NodeJS.ProcessEnv = process.env): AwsRunner {
  return (args) =>
    new Promise((resolve, reject) => {
      const child = spawn('aws', args, { stdio: ['ignore', 'pipe', 'pipe'], env });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      child.on('error', (err: NodeJS.ErrnoException) =>
        reject(new Error(err.code === 'ENOENT' ? 'the aws CLI was not found: install it and sign in first (aws sso login, or set AWS_PROFILE)' : `could not run the aws CLI: ${err.message}`))
      );
      child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
    });
}

const firstLine = (text: string): string => text.trim().split('\n')[0] ?? '';

export class AwsCliStorage implements DraftStorage {
  constructor(
    private readonly bucket: string,
    private readonly run: AwsRunner = awsCliRunner()
  ) {
    if (!BUCKET_NAME.test(bucket)) throw new Error('that is not a valid S3 bucket name');
  }

  describe(): string {
    return `s3://${this.bucket}`;
  }

  async downloadDrafts(intoDir: string): Promise<void> {
    const result = await this.run(['s3', 'sync', `s3://${this.bucket}/${DRAFTS_PREFIX}/`, intoDir, '--only-show-errors']);
    if (result.code !== 0) throw new Error(`aws s3 sync (download) failed with exit code ${result.code}: ${firstLine(result.stderr)}`);
  }

  async verifiedExists(postId: string): Promise<boolean> {
    assertPostId(postId);
    const result = await this.run(['s3api', 'head-object', '--bucket', this.bucket, '--key', `${VERIFIED_PREFIX}/${postId}/label.json`]);
    if (result.code === 0) return true;
    // A missing object is a 404; anything else (no permission, expired sign-in, no network) must not read as "does not exist":
    // that would let a verified label be overwritten without asking.
    if (/\(404\)|Not Found/i.test(result.stderr)) return false;
    throw new Error(`could not check for an existing verified label (exit code ${result.code}): ${firstLine(result.stderr)}`);
  }

  async uploadVerified(postId: string, fromDir: string): Promise<void> {
    assertPostId(postId);
    // The images first, label.json last: the existence check looks for label.json, so a failed upload can never leave a
    // label without its images that then reads as "already verified".
    const target = `s3://${this.bucket}/${VERIFIED_PREFIX}/${postId}/`;
    const images = await this.run(['s3', 'sync', fromDir, target, '--exclude', 'label.json', '--only-show-errors']);
    if (images.code !== 0) throw new Error(`aws s3 sync (upload) failed with exit code ${images.code}: ${firstLine(images.stderr)}`);
    const label = await this.run(['s3', 'cp', join(fromDir, 'label.json'), `${target}label.json`, '--only-show-errors']);
    if (label.code !== 0) throw new Error(`aws s3 cp (upload of label.json) failed with exit code ${label.code}: ${firstLine(label.stderr)}`);
  }
}
