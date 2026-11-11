import type { Baseline, LabelledPost, RecordedOutputs } from './types.js';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function optionalString(o: Record<string, unknown>, key: string, where: string, errors: string[]): void {
  if (o[key] !== undefined && typeof o[key] !== 'string') errors.push(`${where}.${key} must be a string`);
}
function optionalStrings(o: Record<string, unknown>, key: string, where: string, errors: string[]): void {
  if (o[key] !== undefined && !(Array.isArray(o[key]) && (o[key] as unknown[]).every((x) => typeof x === 'string'))) {
    errors.push(`${where}.${key} must be an array of strings`);
  }
}

function checkSchedule(s: unknown, where: string, errors: string[]): void {
  if (!isObject(s)) return void errors.push(`${where} must be an object`);
  if (typeof s.eventStartDate !== 'string' || !DATE.test(s.eventStartDate)) errors.push(`${where}.eventStartDate must be YYYY-MM-DD`);
  if (s.eventEndDate !== undefined && (typeof s.eventEndDate !== 'string' || !DATE.test(s.eventEndDate))) errors.push(`${where}.eventEndDate must be YYYY-MM-DD`);
  for (const k of ['eventStartTime', 'eventEndTime', 'location']) optionalString(s, k, where, errors);
}

function checkEvent(e: unknown, where: string, errors: string[]): void {
  if (!isObject(e)) return void errors.push(`${where} must be an object`);
  if (typeof e.eventName !== 'string' || e.eventName.trim() === '') errors.push(`${where}.eventName must be a non-empty string`);
  if (!Array.isArray(e.schedules) || e.schedules.length === 0) errors.push(`${where}.schedules must be a non-empty array`);
  else e.schedules.forEach((s, i) => checkSchedule(s, `${where}.schedules[${i}]`, errors));
  for (const k of ['location', 'ticketPrice']) optionalString(e, k, where, errors);
  if (typeof e.ticketPrice === 'string' && !/\d/.test(e.ticketPrice)) errors.push(`${where}.ticketPrice must contain a digit (use free: true for a free event, or leave it out when the price is unknown)`);
  if (e.free !== undefined && typeof e.free !== 'boolean') errors.push(`${where}.free must be a boolean`);
  optionalStrings(e, 'categories', where, errors);
  optionalStrings(e, 'performers', where, errors);
}

/** Validate one labelled post read from JSON; throws one error listing every problem, naming the source. */
export function parseLabelledPost(raw: unknown, source: string): LabelledPost {
  const errors: string[] = [];
  if (!isObject(raw)) throw new Error(`${source}: label must be a JSON object`);
  if (typeof raw.postId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(raw.postId)) errors.push('postId must be a slug of letters, digits, - or _');
  if (typeof raw.caption !== 'string') errors.push('caption must be a string');
  if (!Array.isArray(raw.images) || !raw.images.every((x) => typeof x === 'string' && !x.includes('/') && !x.includes('..'))) {
    errors.push('images must be an array of plain file names (no folders)');
  }
  if (typeof raw.publishedAt !== 'string' || Number.isNaN(Date.parse(raw.publishedAt))) errors.push('publishedAt must be an ISO date-time');
  optionalString(raw, 'ownerUsername', 'post', errors);
  optionalString(raw, 'groupingReason', 'post', errors);
  if (!Array.isArray(raw.events)) errors.push('events must be an array (empty for a non-event post)');
  else raw.events.forEach((e, i) => checkEvent(e, `events[${i}]`, errors));
  if (errors.length > 0) throw new Error(`${source}: invalid label: ${errors.join('; ')}`);
  return raw as unknown as LabelledPost;
}

export function parseRecordedOutputs(raw: unknown, source: string): RecordedOutputs {
  if (!isObject(raw) || typeof raw.model !== 'string' || typeof raw.promptHash !== 'string' || !Array.isArray(raw.runs)) {
    throw new Error(`${source}: recorded outputs need model, promptHash and runs`);
  }
  raw.runs.forEach((r: unknown, i) => {
    if (!isObject(r) || typeof r.postId !== 'string' || typeof r.runIndex !== 'number') {
      throw new Error(`${source}: runs[${i}] needs postId and runIndex`);
    }
  });
  return raw as unknown as RecordedOutputs;
}

export function parseBaseline(raw: unknown, source: string): Baseline {
  if (!isObject(raw) || !isObject(raw.fields) || !isObject(raw.posts) || typeof raw.runs !== 'number') {
    throw new Error(`${source}: baseline needs fields, posts and runs`);
  }
  if (raw.truncatedRate !== undefined && (typeof raw.truncatedRate !== 'number' || raw.truncatedRate < 0 || raw.truncatedRate > 1)) {
    throw new Error(`${source}: baseline truncatedRate must be a number between 0 and 1`);
  }
  return raw as unknown as Baseline;
}
