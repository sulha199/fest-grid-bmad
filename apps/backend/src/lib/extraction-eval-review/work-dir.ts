/*
 * The review tool's local working directory (slice B of IDEA-261111-5cc).
 *
 *   <root>/drafts/<postId>/     a copy of the drafts from the store (label.json, draft.json, images): never edited
 *   <root>/edits/<postId>.json  the reviewer's work in progress on one post
 *   <root>/verified/<postId>/   what was staged and uploaded: label.json and the images (NEVER draft.json)
 *   <root>/progress.json        which posts are verified, skipped or flagged
 *
 * It holds REAL posts, so it must never be inside the git checkout of this public repository: `assertOutsideRepo` refuses that.
 * Error messages name files and fields, never the content of a post.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  draftFlags,
  parseDraftMeta,
  parseLabelledPost,
  parseProgress,
  type DraftFlagHit,
  type DraftMeta,
  type LabelledPost,
  type ProgressRecord,
} from '@festgrid/domain/extraction-eval';
import { assertPostId } from './storage.js';

export const defaultWorkDir = (): string => join(homedir(), '.extraction-eval-review');

/** Refuse a working directory inside the repository checkout: real captions and images must never be one `git add` away. */
export function assertOutsideRepo(workDir: string, repoRoot: string): void {
  const rel = relative(realPathOf(repoRoot), realPathOf(workDir));
  const inside = rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
  if (inside) throw new Error('the working directory is inside the repository checkout; real posts must never be there. Choose a folder outside it (--work-dir).');
}

/** The real path of a folder that may not exist yet: the deepest existing ancestor is resolved (so a symlink into the repo is seen), the rest is appended. */
function realPathOf(path: string): string {
  let existing = resolve(path);
  const rest: string[] = [];
  while (!existsSync(existing) && dirname(existing) !== existing) {
    rest.unshift(existing.slice(dirname(existing).length + 1));
    existing = dirname(existing);
  }
  return join(realpathSync(existing), ...rest);
}

export interface Layout {
  root: string;
  drafts: string;
  edits: string;
  verified: string;
  progress: string;
}

export function layoutOf(root: string): Layout {
  return { root, drafts: join(root, 'drafts'), edits: join(root, 'edits'), verified: join(root, 'verified'), progress: join(root, 'progress.json') };
}

/** Parse a JSON file; a malformed one fails with its name only, never with a snippet of its content. */
function readJson(file: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`${label} is not readable as JSON`);
  }
}

/** Atomic write: a crash half way must not leave a half-written progress or edit file. */
function writeJson(file: string, value: unknown): void {
  mkdirSync(join(file, '..'), { recursive: true });
  const temporary = `${file}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(temporary, file);
}

// --------------------------------------------------------------------------------------------------------------------------

/** Folder names under drafts/ that hold a label.json, sorted. */
export function listDraftIds(draftsDir: string): string[] {
  if (!existsSync(draftsDir)) return [];
  return readdirSync(draftsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^[A-Za-z0-9_-]+$/.test(d.name) && existsSync(join(draftsDir, d.name, 'label.json')))
    .map((d) => d.name)
    .sort();
}

export interface LoadedDraft {
  postId: string;
  /** The draft exactly as exported. */
  label: LabelledPost;
  meta: DraftMeta;
  /** Problems with draft.json or with the image files, as messages that name files and fields only. */
  warnings: string[];
}

/** Load one draft: its label is validated with the runner's own parser, so a draft that loads here loads in the eval. */
export function loadDraft(draftsDir: string, postId: string): LoadedDraft {
  assertPostId(postId);
  const dir = join(draftsDir, postId);
  const label = parseLabelledPost(readJson(join(dir, 'label.json'), 'label.json'), 'label.json');
  if (label.postId !== postId) throw new Error('label.json: postId does not match its folder name');
  const warnings: string[] = [];
  let meta: DraftMeta = {};
  if (existsSync(join(dir, 'draft.json'))) {
    try {
      const parsed = parseDraftMeta(readJson(join(dir, 'draft.json'), 'draft.json'));
      meta = parsed.meta;
      warnings.push(...parsed.warnings);
    } catch (err) {
      warnings.push((err as Error).message);
    }
  } else {
    warnings.push('draft.json is missing; the provenance is unknown');
  }
  const missing = label.images.filter((image) => !existsSync(join(dir, image))).length;
  if (missing > 0) warnings.push(`${missing} image file(s) named in label.json are missing from the folder`);
  return { postId, label, meta, warnings };
}

export interface DraftEntry {
  postId: string;
  ok: true;
  draft: LoadedDraft;
  /** The label the reviewer is working on (their saved edit if there is one, else the draft). */
  current: LabelledPost;
  edited: boolean;
  flags: DraftFlagHit[];
}
export interface BrokenEntry {
  postId: string;
  ok: false;
  problem: string;
}

/** Load a draft together with any saved edit, never throwing: one unreadable post must not hide the others. */
export function loadEntry(layout: Layout, postId: string): DraftEntry | BrokenEntry {
  try {
    const draft = loadDraft(layout.drafts, postId);
    let raw: unknown;
    let draftShown = draft;
    try {
      raw = readEdited(layout, postId);
    } catch {
      // A damaged edit file must not lock the post: it is ignored (Reset to the draft then clears it) and the reviewer is told.
      draftShown = { ...draft, warnings: [...draft.warnings, 'the saved edit is damaged and was ignored; saving or resetting replaces it'] };
    }
    let current = draftShown.label;
    let edited = false;
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      // A saved edit may be half finished and not valid yet; the editor still opens it. It is only validated on verify.
      // Anything that is not even an object (a damaged file) is ignored and the draft is shown.
      current = raw as LabelledPost;
      edited = true;
    }
    return { postId, ok: true, draft: draftShown, current, edited, flags: safeFlags(current, draftShown) };
  } catch (err) {
    return { postId, ok: false, problem: (err as Error).message };
  }
}

/** Flags of the working label; a half-edited label that is not even shaped like one just has no flags. */
export function safeFlags(current: LabelledPost, draft: LoadedDraft): DraftFlagHit[] {
  try {
    // an empty price box in the editor means "not stated", exactly as it does when the label is verified
    const events = (current.events ?? []).map((e) => (e.ticketPrice === '' ? { ...e, ticketPrice: undefined } : e));
    return draftFlags({ ...draft.label, events }, draft.meta);
  } catch {
    return [];
  }
}

// ---- edits ---------------------------------------------------------------------------------------------------------------

export function readEdited(layout: Layout, postId: string): unknown | undefined {
  assertPostId(postId);
  const file = join(layout.edits, `${postId}.json`);
  return existsSync(file) ? readJson(file, 'the saved edit') : undefined;
}

export function writeEdited(layout: Layout, postId: string, value: unknown): void {
  assertPostId(postId);
  writeJson(join(layout.edits, `${postId}.json`), value);
}

export function clearEdited(layout: Layout, postId: string): void {
  assertPostId(postId);
  rmSync(join(layout.edits, `${postId}.json`), { force: true });
}

// ---- progress ------------------------------------------------------------------------------------------------------------

export function loadProgress(layout: Layout): { record: ProgressRecord; warnings: string[] } {
  if (!existsSync(layout.progress)) return { record: {}, warnings: [] };
  try {
    const parsed = parseProgress(readJson(layout.progress, 'progress.json'));
    return parsed.warnings.length > 0 ? { record: parsed.record, warnings: parsed.warnings.map((w) => `${w}; the original is kept as a .bak copy when the next change is saved`) } : parsed;
  } catch (err) {
    return { record: {}, warnings: [`${(err as Error).message}; starting with an empty record, the damaged file is kept as a .bak copy when the next change is saved`] };
  }
}

/** Save the record. A damaged or partly invalid file is copied to progress.json.bak-<time> first, so a hand edit is never lost silently. */
export function saveProgress(layout: Layout, record: ProgressRecord, now: () => Date = () => new Date()): void {
  if (existsSync(layout.progress)) {
    let intact = false;
    try {
      intact = parseProgress(readJson(layout.progress, 'progress.json')).warnings.length === 0;
    } catch {
      intact = false;
    }
    if (!intact) copyFileSync(layout.progress, `${layout.progress}.bak-${now().toISOString().replace(/[:.]/g, '-')}`);
  }
  writeJson(layout.progress, record);
}

// ---- staging a verified post ---------------------------------------------------------------------------------------------

/**
 * Write the verified label and copy the images to `verified/<postId>/`, and return that folder for the upload. It holds
 * label.json and the images only: `draft.json` (the real post URL and id) is never part of what the eval reads.
 */
export function stageVerified(layout: Layout, label: LabelledPost): string {
  assertPostId(label.postId);
  const target = join(layout.verified, label.postId);
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const image of label.images) {
    const from = join(layout.drafts, label.postId, image);
    if (!existsSync(from) || !statSync(from).isFile()) throw new Error(`an image named in the label is missing from the draft folder (${image})`);
    copyFileSync(from, join(target, image));
  }
  writeFileSync(join(target, 'label.json'), `${JSON.stringify(label, null, 2)}\n`);
  return target;
}
