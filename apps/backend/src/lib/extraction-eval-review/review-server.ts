/*
 * The local web server of the draft-label review tool (slice B of IDEA-261111-5cc).
 *
 * It serves real posts to ONE person on ONE machine, so it is deliberately narrow:
 * - listens on 127.0.0.1 only; every URL starts with a random token (`/<token>/...`), anything else is a 404;
 * - checks the Host header (DNS-rebinding) and, for writes, the Origin header and a JSON content type (cross-site requests);
 * - sends a Content-Security-Policy that allows the page's own script and style by hash and nothing from any other origin,
 *   and `no-store`, so nothing is cached;
 * - makes no outbound request and calls no AI service: it reads and writes local files and, on verify, uses the storage object;
 * - serves an image only if the draft's own label.json names it (no path from the URL is ever used to read a file);
 * - error messages name fields and files, never the content of a post.
 */
import { createHash, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join } from 'node:path';
import {
  DRAFT_FLAG_HELP,
  nextPending,
  prepareVerifiedLabel,
  progressSummary,
  setProgress,
  statusOf,
  type LabelledPost,
  type ProgressRecord,
  type ReviewStatus,
} from '@festgrid/domain/extraction-eval';
import { POST_GROUPING_REASONS } from '@festgrid/domain/posts';
import { PAGE_SCRIPT, PAGE_STYLE, renderReviewPage } from './review-page.js';
import { assertPostId, type DraftStorage } from './storage.js';
import {
  clearEdited,
  listDraftIds,
  loadEntry,
  loadProgress,
  safeFlags,
  saveProgress,
  stageVerified,
  writeEdited,
  type DraftEntry,
  type Layout,
} from './work-dir.js';

export interface ReviewOptions {
  layout: Layout;
  storage: DraftStorage;
  /** The category values that exist in production; a label naming another is refused on verify. */
  categories: readonly string[];
  /** The secret first path segment; random by default (tests pass a fixed one). */
  token?: string;
  now?: () => Date;
}

const MAX_BODY_BYTES = 1_000_000;
const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const sha256 = (text: string): string => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

const PAGE_CSP = [
  "default-src 'none'",
  `script-src ${sha256(PAGE_SCRIPT)}`,
  `style-src ${sha256(PAGE_STYLE)}`,
  "img-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const BASE_HEADERS = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cross-origin-resource-policy': 'same-origin' };

class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { ...BASE_HEADERS, 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'the request is too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'the request body is not valid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The label the page edits: the input fields always come from the draft, so the page cannot be shown (or save) other input. */
function editable(entry: DraftEntry): Record<string, unknown> {
  const d = entry.draft.label;
  const current = entry.current as unknown as Record<string, unknown>;
  const label: Record<string, unknown> = { ...current, postId: d.postId, caption: d.caption, images: d.images, publishedAt: d.publishedAt };
  if (d.ownerUsername !== undefined) label.ownerUsername = d.ownerUsername;
  if (!Array.isArray(label.events)) label.events = [];
  return label;
}

export function createReviewHandler(options: ReviewOptions): { token: string; handler: (req: IncomingMessage, res: ServerResponse) => void } {
  const { layout, storage, categories } = options;
  const token = options.token ?? randomBytes(16).toString('hex');
  const now = options.now ?? (() => new Date());
  const page = renderReviewPage();

  const ids = (): string[] => listDraftIds(layout.drafts);
  const progress = (): { record: ProgressRecord; warnings: string[] } => loadProgress(layout);
  const entryOf = (postId: string): DraftEntry => {
    try {
      assertPostId(postId);
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }
    if (!ids().includes(postId)) throw new HttpError(404, 'no such draft');
    const entry = loadEntry(layout, postId);
    if (!entry.ok) throw new HttpError(422, `this draft cannot be read: ${entry.problem}`);
    return entry;
  };
  const setStatus = (postId: string, status: ReviewStatus, note?: string): void => {
    saveProgress(layout, setProgress(progress().record, postId, status, now().toISOString(), note));
  };

  function listResponse(): unknown {
    const all = ids();
    const { record, warnings } = progress();
    const posts: unknown[] = [];
    const unreadable: { postId: string; problem: string }[] = [];
    for (const id of all) {
      const entry = loadEntry(layout, id);
      if (!entry.ok) {
        unreadable.push({ postId: id, problem: entry.problem });
        continue;
      }
      posts.push({
        postId: id,
        stratum: entry.draft.meta.stratum ?? null,
        imageCount: entry.draft.label.images.length,
        eventCount: Array.isArray(entry.current.events) ? entry.current.events.length : 0,
        status: statusOf(record, id),
        note: record[id]?.note ?? '',
        flags: entry.flags,
        warnings: entry.draft.warnings,
        edited: entry.edited,
      });
    }
    return { posts, unreadable, warnings, summary: progressSummary(all, record) };
  }

  function postResponse(postId: string): unknown {
    const entry = entryOf(postId);
    const { record } = progress();
    return {
      postId,
      label: editable(entry),
      images: entry.draft.label.images,
      meta: entry.draft.meta,
      warnings: entry.draft.warnings,
      flags: entry.flags,
      status: statusOf(record, postId),
      note: record[postId]?.note ?? '',
      edited: entry.edited,
      next: nextPending(ids(), record, postId) ?? null,
    };
  }

  async function verify(postId: string, body: unknown): Promise<unknown> {
    const entry = entryOf(postId);
    if (!isObject(body)) throw new HttpError(400, 'the request body must be a JSON object');
    let prepared: LabelledPost;
    try {
      prepared = prepareVerifiedLabel(body.label, entry.draft.label, 'label', { categories });
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }
    // Keep the reviewer's work first: whatever happens next, nothing they typed is lost.
    writeEdited(layout, postId, prepared);
    if (body.overwrite !== true && (await storage.verifiedExists(postId))) {
      throw new HttpError(409, 'a verified label for this post already exists in the store');
    }
    let staged: string;
    try {
      staged = stageVerified(layout, prepared);
    } catch (err) {
      throw new HttpError(400, (err as Error).message);
    }
    await storage.uploadVerified(postId, staged);
    setStatus(postId, 'verified', progress().record[postId]?.note);
    return { ok: true };
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET';
    const host = (req.headers.host ?? '').replace(/:\d+$/, '');
    if (host !== '127.0.0.1' && host !== 'localhost') throw new HttpError(403, 'unexpected host');
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const parts = url.pathname.split('/').filter((p) => p !== '');
    if (parts[0] !== token) throw new HttpError(404, 'not found');
    let rest: string[];
    try {
      rest = parts.slice(1).map((p) => decodeURIComponent(p));
    } catch {
      throw new HttpError(400, 'malformed URL');
    }

    if (method !== 'GET') {
      const origin = req.headers.origin;
      if (origin !== undefined && origin !== `http://${req.headers.host}`) throw new HttpError(403, 'cross-origin request refused');
      if (!(req.headers['content-type'] ?? '').startsWith('application/json') && method !== 'DELETE') throw new HttpError(415, 'JSON only');
    }

    if (method === 'GET' && rest.length === 0) {
      res.writeHead(200, { ...BASE_HEADERS, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': PAGE_CSP });
      res.end(page);
      return;
    }
    if (rest[0] === 'api') {
      if (method === 'GET' && rest[1] === 'config' && rest.length === 2) {
        return sendJson(res, 200, { storage: storage.describe(), flagHelp: DRAFT_FLAG_HELP, groupingReasons: POST_GROUPING_REASONS, categories });
      }
      if (method === 'GET' && rest[1] === 'drafts' && rest.length === 2) return sendJson(res, 200, listResponse());
      if (rest[1] === 'post' && rest[2] !== undefined) {
        const postId = rest[2];
        if (method === 'GET' && rest.length === 3) return sendJson(res, 200, postResponse(postId));
        const action = rest[3];
        if (rest.length === 4 && action === 'edit' && method === 'PUT') {
          const body = await readBody(req);
          const entry = entryOf(postId);
          if (!isObject(body) || !isObject(body.label)) throw new HttpError(400, 'the request must hold a label object');
          writeEdited(layout, postId, body.label);
          return sendJson(res, 200, { ok: true, flags: safeFlags(body.label as unknown as LabelledPost, entry.draft) });
        }
        if (rest.length === 4 && action === 'edit' && method === 'DELETE') {
          entryOf(postId);
          clearEdited(layout, postId);
          return sendJson(res, 200, { ok: true });
        }
        if (rest.length === 4 && action === 'status' && method === 'POST') {
          const body = await readBody(req);
          entryOf(postId);
          if (!isObject(body) || (body.status !== 'skipped' && body.status !== 'flagged' && body.status !== 'pending')) {
            throw new HttpError(400, 'status must be skipped, flagged or pending (verified is set by verifying)');
          }
          setStatus(postId, body.status, typeof body.note === 'string' ? body.note : undefined);
          return sendJson(res, 200, { ok: true });
        }
        if (rest.length === 4 && action === 'verify' && method === 'POST') return sendJson(res, 200, await verify(postId, await readBody(req)));
      }
      throw new HttpError(404, 'not found');
    }
    if (method === 'GET' && rest[0] === 'img' && rest.length === 3) {
      const entry = entryOf(rest[1]!);
      const file = rest[2]!;
      // Only a file the draft's own label names is ever read; nothing from the URL becomes a path.
      if (!entry.draft.label.images.includes(file)) throw new HttpError(404, 'not found');
      const path = join(layout.drafts, rest[1]!, file);
      if (!existsSync(path)) throw new HttpError(404, 'image file missing');
      res.writeHead(200, { ...BASE_HEADERS, 'content-type': IMAGE_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream' });
      res.end(readFileSync(path));
      return;
    }
    throw new HttpError(404, 'not found');
  }

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    route(req, res).catch((err: unknown) => {
      if (res.headersSent) return res.end();
      const status = err instanceof HttpError ? err.status : 500;
      sendJson(res, status, { error: err instanceof Error ? err.message : 'unexpected error' });
    });
  };
  return { token, handler };
}

export interface RunningReview {
  url: string;
  token: string;
  server: Server;
  close(): Promise<void>;
}

/** Start the server on 127.0.0.1 (port 0 = any free port). */
export function startReviewServer(options: ReviewOptions, port = 0): Promise<RunningReview> {
  const { token, handler } = createReviewHandler(options);
  const server = createServer(handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const actual = typeof address === 'object' && address !== null ? address.port : port;
      resolve({
        url: `http://127.0.0.1:${actual}/${token}/`,
        token,
        server,
        close: () => new Promise((done) => (server.closeAllConnections(), server.close(() => done()))),
      });
    });
  });
}
