import { matchEvents } from './match-events.js';
import { digitsOnly, locationMatches, nameMatches, normalizeDate, normalizeText, normalizeTime } from './normalize.js';
import {
  EXTRACTION_EVAL_FIELDS,
  type ExtractionEvalField,
  type FieldScores,
  type LabelledEvent,
  type LabelledPost,
  type RunScore,
  type ScorableEvent,
  type ScorablePayload,
} from './types.js';

type Samples = Record<ExtractionEvalField, number[]>;

function emptySamples(): Samples {
  return Object.fromEntries(EXTRACTION_EVAL_FIELDS.map((f) => [f, [] as number[]])) as unknown as Samples;
}

const mean = (values: number[]): number | null => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);
const flag = (ok: boolean): number => (ok ? 1 : 0);

function isFree(price: string | undefined): boolean {
  const text = normalizeText(price);
  return text === '' || /\b(free|gratis)\b/.test(text) || digitsOnly(price).replace(/^0+$/, '') === '';
}

function scoreTicket(labelled: LabelledEvent, model: ScorableEvent): number | undefined {
  const prices = (model.schedules ?? []).map((s) => s.ticketPrice);
  if (labelled.free === true) return flag(prices.every(isFree));
  if (labelled.ticketPrice === undefined) return undefined;
  const wanted = digitsOnly(labelled.ticketPrice);
  return flag(prices.some((p) => digitsOnly(p) === wanted));
}

function scoreSchedules(labelled: LabelledEvent, model: ScorableEvent, samples: Samples): void {
  const used = new Set<number>();
  const schedules = model.schedules ?? [];
  for (const want of labelled.schedules) {
    const start = normalizeDate(want.eventStartDate);
    const mi = schedules.findIndex((s, i) => !used.has(i) && normalizeDate(s.eventStartDate) === start);
    samples.startDate.push(flag(mi !== -1));
    if (mi === -1) continue;
    used.add(mi);
    const got = schedules[mi]!;
    if (want.eventEndDate !== undefined) samples.endDate.push(flag(normalizeDate(got.eventEndDate) === normalizeDate(want.eventEndDate)));
    if (want.eventStartTime !== undefined) samples.startTime.push(flag(normalizeTime(got.eventStartTime) === normalizeTime(want.eventStartTime)));
    if (want.eventEndTime !== undefined) samples.endTime.push(flag(normalizeTime(got.eventEndTime) === normalizeTime(want.eventEndTime)));
    if (want.location !== undefined) samples.location.push(flag(locationMatches(want.location, got.location ?? model.location)));
  }
}

function scoreMatchedEvent(labelled: LabelledEvent, model: ScorableEvent, samples: Samples): void {
  samples.eventName.push(flag(nameMatches(labelled.eventName, model.eventName)));
  scoreSchedules(labelled, model, samples);
  if (labelled.location !== undefined) {
    const own = model.location ?? model.schedules?.find((s) => s.location)?.location;
    samples.location.push(flag(locationMatches(labelled.location, own)));
  }
  const ticket = scoreTicket(labelled, model);
  if (ticket !== undefined) samples.ticket.push(ticket);
  if (labelled.categories !== undefined) {
    const got = new Set((model.categories ?? []).map(normalizeText));
    const want = new Set(labelled.categories.map(normalizeText));
    const hits = [...got].filter((c) => want.has(c)).length;
    samples.categoriesPrecision.push(got.size === 0 ? flag(want.size === 0) : hits / got.size);
    if (want.size > 0) samples.categoriesRecall.push(hits / want.size);
  }
  if (labelled.performers !== undefined && labelled.performers.length > 0) {
    const got = new Set((model.schedules ?? []).flatMap((s) => s.performers ?? []).map(normalizeText));
    samples.performers.push(labelled.performers.filter((p) => got.has(normalizeText(p))).length / labelled.performers.length);
  }
}

/**
 * Score one answered run (a validated, normalized payload) against its labelled post.
 *
 * Decision: per-event fields are scored over MATCHED events only. A labelled event the model did not produce
 * counts once, as an `eventName` miss, and is listed in `unmatchedLabelled`; it is not scored as zero on every
 * other field (a fold of 7 events into 1 would otherwise bury the real signal, `count_mismatch`).
 */
export function scoreRun(post: LabelledPost, payload: ScorablePayload): RunScore {
  const modelEvents = payload.isEvent === false ? [] : (payload.events ?? []);
  const samples = emptySamples();
  const matching = matchEvents(post.events, modelEvents);

  if (post.events.length > 0 && post.groupingReason !== undefined) {
    samples.groupingReason.push(flag(payload.groupingReason === post.groupingReason));
  }
  samples.eventCount.push(flag(modelEvents.length === post.events.length));
  for (const m of matching.matches) scoreMatchedEvent(post.events[m.labelled]!, modelEvents[m.model]!, samples);
  for (let i = 0; i < matching.unmatchedLabelled.length; i += 1) samples.eventName.push(0);

  const fields = Object.fromEntries(EXTRACTION_EVAL_FIELDS.map((f) => [f, mean(samples[f])])) as unknown as FieldScores;
  return {
    fields,
    countMismatch: modelEvents.length !== post.events.length,
    extraEvents: matching.extraModel.length,
    unmatchedLabelled: matching.unmatchedLabelled.length,
  };
}
