/*
 * Pure logic of the draft-label review tool (slice B of IDEA-261111-5cc): turning a DRAFT label (production's extraction written
 * in the runner's label shape, NOT verified) into a hand-verified label.
 *
 * Nothing here does I/O. The tool itself (apps/backend/src/lib/extraction-eval-review/) reads and writes files and talks to S3.
 * Everything handled here may come from REAL posts, so no function below puts a caption, name or id into an error message that
 * could end up in a log: messages name fields and counts, never values.
 */
import { POST_GROUPING_REASONS, isPostGroupingReason } from '../posts/types.js';
import { parseLabelledPost } from './parse-labels.js';
import type { LabelledPost } from './types.js';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

// --------------------------------------------------------------------------------------------------------------------------
// draft.json: provenance of one draft
// --------------------------------------------------------------------------------------------------------------------------

/** What `draft.json` records about a draft. Every field is optional: the file is written by an export, and an odd one must not crash the tool. */
export interface DraftMeta {
  stratum?: string;
  sourcePostId?: string;
  postUrl?: string;
  extractedEventCount?: number;
  /** How many extraction passes the post had in production; above 1 means a stepped (cursor) chain. */
  extractionAuditRows?: number;
  imagesAvailable?: number;
  imagesFetched?: number;
  /** The post was extracted before the stepped path existed: its event list is probably incomplete (capped, first slides only). */
  extractedBeforeCursorPath?: boolean;
  rescrape?: unknown;
  status?: string;
}

const META_FIELDS: ReadonlyArray<readonly [Exclude<keyof DraftMeta, 'rescrape'>, 'string' | 'number' | 'boolean']> = [
  ['stratum', 'string'],
  ['sourcePostId', 'string'],
  ['postUrl', 'string'],
  ['extractedEventCount', 'number'],
  ['extractionAuditRows', 'number'],
  ['imagesAvailable', 'number'],
  ['imagesFetched', 'number'],
  ['extractedBeforeCursorPath', 'boolean'],
  ['status', 'string'],
];

/**
 * Read `draft.json` leniently: a field of the wrong type is ignored with a warning (the warning names the field, never the
 * value), and a file that is not an object gives an empty record. The review still works; the flags that need the field just
 * do not fire.
 */
export function parseDraftMeta(raw: unknown): { meta: DraftMeta; warnings: string[] } {
  if (!isObj(raw)) return { meta: {}, warnings: ['draft.json is not a JSON object; its provenance is unknown'] };
  const meta: Obj = {};
  const warnings: string[] = [];
  for (const [field, kind] of META_FIELDS) {
    const value = raw[field];
    if (value === undefined) continue;
    const ok = kind === 'number' ? typeof value === 'number' && Number.isFinite(value) && value >= 0 : typeof value === kind;
    if (ok) meta[field] = value;
    else warnings.push(`draft.json: ${field} should be a ${kind === 'number' ? 'non-negative number' : kind}; ignored`);
  }
  if (raw.rescrape !== undefined) meta.rescrape = raw.rescrape;
  return { meta: meta as DraftMeta, warnings };
}

// --------------------------------------------------------------------------------------------------------------------------
// flags: where a draft is most likely wrong
// --------------------------------------------------------------------------------------------------------------------------

/** 0 events and at least this many images: a large carousel the extraction read as "not an event" is a possible miss. */
export const POSSIBLE_MISS_MIN_IMAGES = 6;
/** An event with more schedules than this is worth a second look (a schedule per day is easy to get wrong). */
export const MANY_SCHEDULES_ABOVE = 3;

export const DRAFT_FLAGS = ['possible_miss', 'chain', 'before_cursor_path', 'many_schedules', 'price_missing'] as const;
export type DraftFlag = (typeof DRAFT_FLAGS)[number];

export const DRAFT_FLAG_HELP: Record<DraftFlag, string> = {
  possible_miss: `0 events but ${POSSIBLE_MISS_MIN_IMAGES} or more images: the extraction may have missed an event. Check every image.`,
  chain: 'Extracted in several steps in production (a stepped chain). The first-call eval cannot score such a post completely.',
  before_cursor_path: 'Extracted before the stepped path existed: production capped the event list and read only the first slides, so this draft is probably incomplete.',
  many_schedules: `An event with more than ${MANY_SCHEDULES_ABOVE} schedules: check each date.`,
  price_missing: 'An event with no ticket price that is not marked free: set the price, or mark it free if it is.',
};

export interface DraftFlagHit {
  flag: DraftFlag;
  /** Counts and event positions only (1-based), never names. */
  detail?: string;
}

const listPositions = (positions: number[]): string => {
  const shown = positions.slice(0, 10).join(', ');
  return positions.length > 10 ? `${shown} and ${positions.length - 10} more` : shown;
};

export function draftFlags(post: LabelledPost, meta: DraftMeta): DraftFlagHit[] {
  const hits: DraftFlagHit[] = [];
  if (post.events.length === 0 && post.images.length >= POSSIBLE_MISS_MIN_IMAGES) {
    hits.push({ flag: 'possible_miss', detail: `0 events, ${post.images.length} images` });
  }
  if ((meta.extractionAuditRows ?? 0) > 1) hits.push({ flag: 'chain', detail: `${meta.extractionAuditRows} extraction passes` });
  if (meta.extractedBeforeCursorPath === true) hits.push({ flag: 'before_cursor_path' });
  const many = post.events.flatMap((e, i) => (e.schedules.length > MANY_SCHEDULES_ABOVE ? [i + 1] : []));
  if (many.length > 0) hits.push({ flag: 'many_schedules', detail: `event ${listPositions(many)}` });
  const noPrice = post.events.flatMap((e, i) => (e.ticketPrice === undefined && e.free !== true ? [i + 1] : []));
  if (noPrice.length > 0) hits.push({ flag: 'price_missing', detail: `event ${listPositions(noPrice)}` });
  return hits;
}

// --------------------------------------------------------------------------------------------------------------------------
// verifying: an edited label becomes the verified label
// --------------------------------------------------------------------------------------------------------------------------

const trimmed = (v: unknown): unknown => (typeof v === 'string' ? v.trim() : v);

/** Drop an optional text field the reviewer left empty: an empty string is "not stated", not a value to score. */
const dropEmpty = (o: Obj, keys: string[]): void => {
  for (const key of keys) if (o[key] === '') delete o[key];
};

const cleanList = (v: unknown): unknown => (Array.isArray(v) ? v.map(trimmed).filter((x) => x !== '') : v);

function cleanSchedule(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const s: Obj = {};
  for (const [k, v] of Object.entries(raw)) s[k] = trimmed(v);
  dropEmpty(s, ['eventEndDate', 'eventStartTime', 'eventEndTime', 'location']);
  return s;
}

function cleanEvent(raw: unknown): unknown {
  if (!isObj(raw)) return raw;
  const e: Obj = {};
  for (const [k, v] of Object.entries(raw)) e[k] = trimmed(v);
  dropEmpty(e, ['location', 'ticketPrice']);
  if ('categories' in e) e.categories = cleanList(e.categories);
  if ('performers' in e) e.performers = cleanList(e.performers);
  if (Array.isArray(e.schedules)) e.schedules = e.schedules.map(cleanSchedule);
  return e;
}

export interface PrepareOptions {
  /** The category values that exist in production; a label that names another can never match and is rejected. */
  categories?: readonly string[];
}

/**
 * Turn what the reviewer edited into a label that is safe to write to the verified prefix.
 *
 * The INPUT of the extraction is fixed: `postId`, `caption`, `images`, `publishedAt` and `ownerUsername` always come from the
 * draft, whatever the edit says, because the eval must send the model exactly what production saw. The reviewer edits the
 * EXPECTED answer: `groupingReason` and `events`. The result is re-checked with `parseLabelledPost`, the same parser the runner
 * uses, so a label that is written is a label that loads. Throws one error listing every problem (field names only).
 */
export function prepareVerifiedLabel(edited: unknown, draft: LabelledPost, source: string, options: PrepareOptions = {}): LabelledPost {
  if (!isObj(edited)) throw new Error(`${source}: the edited label must be a JSON object`);
  const problems: string[] = [];
  const reason = typeof edited.groupingReason === 'string' ? edited.groupingReason.trim() : undefined;
  if (reason !== undefined && reason !== '' && !isPostGroupingReason(reason)) {
    problems.push(`groupingReason must be one of ${POST_GROUPING_REASONS.join(', ')}`);
  }
  const events = Array.isArray(edited.events) ? edited.events.map(cleanEvent) : edited.events;
  if (options.categories !== undefined && Array.isArray(events)) {
    const allowed = new Set(options.categories);
    events.forEach((e, i) => {
      const bad = isObj(e) && Array.isArray(e.categories) ? e.categories.filter((c) => typeof c === 'string' && !allowed.has(c)).length : 0;
      if (bad > 0) problems.push(`events[${i}].categories has ${bad} value(s) that are not production categories`);
    });
  }
  if (problems.length > 0) throw new Error(`${source}: invalid label: ${problems.join('; ')}`);
  const candidate: Obj = {
    postId: draft.postId,
    caption: draft.caption,
    images: draft.images,
    publishedAt: draft.publishedAt,
    ...(draft.ownerUsername !== undefined ? { ownerUsername: draft.ownerUsername } : {}),
    ...(reason !== undefined && reason !== '' ? { groupingReason: reason } : {}),
    events,
  };
  return parseLabelledPost(candidate, source);
}

// --------------------------------------------------------------------------------------------------------------------------
// the reviewer's progress record
// --------------------------------------------------------------------------------------------------------------------------

export const REVIEW_STATUSES = ['pending', 'verified', 'skipped', 'flagged'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface ProgressEntry {
  status: ReviewStatus;
  /** ISO time of the last change. */
  at: string;
  /** The reviewer's own note (local file only; never uploaded). */
  note?: string;
}
export type ProgressRecord = Record<string, ProgressEntry>;

/** Read the progress file; an entry that is not valid is dropped with a warning (a hand-edited file must not stop the tool). */
export function parseProgress(raw: unknown): { record: ProgressRecord; warnings: string[] } {
  if (raw === undefined || raw === null) return { record: {}, warnings: [] };
  if (!isObj(raw)) return { record: {}, warnings: ['progress.json is not a JSON object; starting with an empty record'] };
  const record: ProgressRecord = {};
  let dropped = 0;
  for (const [id, entry] of Object.entries(raw)) {
    const ok = isObj(entry) && (REVIEW_STATUSES as readonly unknown[]).includes(entry.status) && typeof entry.at === 'string';
    if (!ok) {
      dropped += 1;
      continue;
    }
    const e = entry as Obj;
    record[id] = { status: e.status as ReviewStatus, at: e.at as string, ...(typeof e.note === 'string' && e.note !== '' ? { note: e.note } : {}) };
  }
  return { record, warnings: dropped > 0 ? [`progress.json: ${dropped} entr${dropped === 1 ? 'y' : 'ies'} not valid; ignored`] : [] };
}

export function setProgress(record: ProgressRecord, postId: string, status: ReviewStatus, at: string, note?: string): ProgressRecord {
  const entry: ProgressEntry = { status, at, ...(note !== undefined && note.trim() !== '' ? { note: note.trim() } : {}) };
  return { ...record, [postId]: entry };
}

export const statusOf = (record: ProgressRecord, postId: string): ReviewStatus => record[postId]?.status ?? 'pending';

export function progressSummary(ids: readonly string[], record: ProgressRecord): Record<ReviewStatus, number> {
  const counts: Record<ReviewStatus, number> = { pending: 0, verified: 0, skipped: 0, flagged: 0 };
  for (const id of ids) counts[statusOf(record, id)] += 1;
  return counts;
}

/** The next post still pending after `afterId` (wrapping round to the start); undefined when none is pending. */
export function nextPending(ids: readonly string[], record: ProgressRecord, afterId?: string): string | undefined {
  const start = afterId === undefined ? 0 : ids.indexOf(afterId) + 1;
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[(start + i) % ids.length]!;
    if (id !== afterId && statusOf(record, id) === 'pending') return id;
  }
  return undefined;
}
