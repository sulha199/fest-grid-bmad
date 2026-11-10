import { assignExtractionOrdinals } from "../events/assign-extraction-ordinals.js";
import type { ExtractedEventMessage } from "../events/types.js";
import type { PostGroupingReason } from "./types.js";

/**
 * Cursor-based sequential extraction (AD-46..AD-51), the pure part: the cursor's shape, the continue decision
 * (`continue-rules.md`), the request bound, window sizing and splitting, ordinal ranges and the dedupe key. No I/O,
 * no clock: the step handler (a later slice) feeds these functions and persists what they return.
 */

export const EXTRACTION_CURSOR_VERSION = 1;

/** About this many events per call, enforced in code on every request (AD-46 Rule 5). */
export const PER_CALL_EVENT_CAP = 25;
/** The first step window, in slides, before any density is observed. */
export const FIRST_STEP_WINDOW = 2;
export const MAX_STEP_WINDOW = 4;
/** Empty steps allowed while nothing has been found yet (a text-free cover is not a stop signal). */
export const MAX_EMPTY_STEPS = 2;
/** A lineup or dependent-stages post gets one follow-up with up to this many images in total (cover included). */
export const FOLLOW_UP_MAX_IMAGES = 10;
/** Share of the output cap at which a response counts as at risk (kept in step with the Gemini client signals). */
export const OUTPUT_AT_RISK_RATIO = 0.9;
/**
 * Event ordinals stay below this (the re-extract Apply parks moved events at and above it; keep in step with
 * `PARKED_ORDINAL_BASE` in apps/backend/src/lib/events/set-event-primary-post.ts).
 */
export const EXTRACTION_ORDINAL_CEILING = 30_000;

/** The one cursor type (AD-47 Rule 1): carried in the step message and persisted on the post. Never holds a caption. */
export interface ExtractionCursor {
  version: typeof EXTRACTION_CURSOR_VERSION;
  postId: string;
  /** Compare-and-set pair for the single writer and its lease (AD-47 Rule 4). */
  stepCount: number;
  leaseNonce: string;
  /** Index of the next unread image (0 is the cover). */
  nextSlide: number;
  totalImages: number;
  /** Images beyond the first request's window when the loop started; the request bound derives from it (AD-51). */
  unreadAtStart: number;
  /** The links of the unread images, in order; the only part a re-scrape replaces. */
  unreadImageUrls: string[];
  /** The next free extraction ordinal (AD-48). */
  nextOrdinal: number;
  /** Dedupe keys of the events found by committed steps. */
  foundKeys: string[];
  /** The first request's label decides the path; later labels never redirect the loop (AD-46 Rule 5a). */
  groupingReason: PostGroupingReason | null;
  followUpMade: boolean;
  emptySteps: number;
  windowSize: number;
  /** Requests after the first, counted before each call (AD-51 Rule 1). */
  requestsMade: number;
  resumeAttempts: number;
  rescrapeCount: number;
  lastRescrapeAt: string | null;
  itemsPerSlide: number | null;
  claimedItemCount: number | null;
}

/** Name plus first start date, normalized: the dedupe key across steps (AD-46 Rule 4, AD-48 Rule 2). */
export function eventDedupeKey(eventName: string, startDate: string | undefined): string {
  const name = eventName.trim().toLowerCase().replace(/\s+/g, " ");
  return `${name}|${startDate ?? ""}`;
}

/** The minimal shape the dedupe key needs: a model payload event and a built ingestion message both fit. */
export interface KeyableEvent {
  eventName: string;
  schedules?: ReadonlyArray<{ eventStartDate: string }>;
}

function earliestStartDate(event: KeyableEvent): string | undefined {
  let earliest: string | undefined;
  for (const schedule of event.schedules ?? []) {
    if (earliest === undefined || schedule.eventStartDate < earliest) {
      earliest = schedule.eventStartDate;
    }
  }
  return earliest;
}

/** The events a step found that are not already known by key; keys are returned in the order found. */
export function newEventsByKey<T extends KeyableEvent>(
  knownKeys: readonly string[],
  events: readonly T[]
): { fresh: T[]; keys: string[] } {
  const known = new Set(knownKeys);
  const fresh: T[] = [];
  for (const event of events) {
    const key = eventDedupeKey(event.eventName, earliestStartDate(event));
    if (!known.has(key)) {
      known.add(key);
      fresh.push(event);
    }
  }
  return { fresh, keys: [...known] };
}

export class OrdinalRangeExhaustedError extends Error {
  constructor(public readonly firstOrdinal: number, public readonly count: number) {
    super(`Cannot reserve ${count} ordinals from ${firstOrdinal}: the range would reach ${EXTRACTION_ORDINAL_CEILING}.`);
    this.name = "OrdinalRangeExhaustedError";
  }
}

/**
 * AD-48 Rule 2: the next ordinal range for a step's new events, in the order (earliest start date, normalized name,
 * original index), which is deterministic for a given result. Returns the events with their ordinals and the cursor's
 * new next-free value.
 */
export function reserveOrdinalRange<T extends ExtractedEventMessage>(
  nextOrdinal: number,
  events: readonly T[]
): { events: Array<T & { extractionOrdinal: number }>; nextOrdinal: number } {
  if (!Number.isInteger(nextOrdinal) || nextOrdinal < 0 || nextOrdinal + events.length > EXTRACTION_ORDINAL_CEILING) {
    throw new OrdinalRangeExhaustedError(nextOrdinal, events.length);
  }
  const ordered = assignExtractionOrdinals([...events]).map((event) => ({
    ...event,
    extractionOrdinal: event.extractionOrdinal + nextOrdinal,
  }));
  return { events: ordered, nextOrdinal: nextOrdinal + events.length };
}

/** AD-51 Rule 1: the requests after the first may not exceed twice the images unread when the loop started. */
export function requestBound(unreadAtStart: number): number {
  return 2 * Math.max(0, unreadAtStart);
}

export function canMakeRequest(requestsMade: number, unreadAtStart: number): boolean {
  return requestsMade < requestBound(unreadAtStart);
}

/** Window size from the last observed density: floor(cap / items per slide), between 1 and 4; 2 before any observation. */
export function nextWindowSize(itemsPerSlide: number | null, perCallCap: number = PER_CALL_EVENT_CAP): number {
  if (itemsPerSlide === Infinity) {
    return 1;
  }
  if (itemsPerSlide === null || !Number.isFinite(itemsPerSlide) || itemsPerSlide <= 0) {
    return FIRST_STEP_WINDOW;
  }
  return Math.min(MAX_STEP_WINDOW, Math.max(1, Math.floor(perCallCap / itemsPerSlide)));
}

export interface SlideWindow {
  /** Index of the first slide of the window. */
  start: number;
  /** Number of slides. */
  size: number;
}

/** AD-49 Rule 3: halve a window (the first half takes the odd slide); a one-slide window cannot be split. */
export function splitWindow(window: SlideWindow): [SlideWindow, SlideWindow] | null {
  if (!Number.isFinite(window.size) || window.size <= 1) {
    return null;
  }
  const first = Math.ceil(window.size / 2);
  return [
    { start: window.start, size: first },
    { start: window.start + first, size: window.size - first },
  ];
}

export interface AtRiskInput {
  /** The Gemini client's at-risk reasons (MAX_TOKENS, output near the limit). */
  outputSignals: readonly string[];
  eventCount: number;
  perCallCap?: number;
  /** The model's own `minEventCount`, and how many items it skipped for lack of date or place. */
  minEventCount?: number | null;
  skippedItemCount?: number;
}

/** AD-49 Rule 2: any one signal means the window may have lost items and should be split and retried. */
export function isAtRisk(input: AtRiskInput): boolean {
  if (input.outputSignals.length > 0) {
    return true;
  }
  if (input.eventCount >= (input.perCallCap ?? PER_CALL_EVENT_CAP)) {
    return true;
  }
  const skipped = Number.isFinite(input.skippedItemCount) ? (input.skippedItemCount as number) : 0;
  return typeof input.minEventCount === "number" && input.minEventCount > input.eventCount + skipped;
}

export type StepStopReason =
  | "no_unread_slides"
  | "kill_switch_off"
  | "request_bound"
  | "single_event_complete"
  | "follow_up_done"
  | "empty_steps_spent"
  | "no_new_events"
  | "other";

export interface StepState {
  killSwitchOn: boolean;
  /** The first request's label. */
  groupingReason: PostGroupingReason | null;
  unreadSlides: number;
  /** Images read so far, cover included. */
  imagesRead: number;
  /** Events found so far, including the step that just ended. */
  eventsFound: number;
  /** New events the step that just ended added. */
  lastStepNewEvents: number;
  emptySteps: number;
  followUpMade: boolean;
  requestsMade: number;
  unreadAtStart: number;
  itemsPerSlide: number | null;
  /** A one-slide window still truncated (the leaf cannot be split): whatever stops the loop, the post is partial. */
  leafTruncated?: boolean;
}

export type NextStepDecision =
  | { action: "stop"; reason: StepStopReason; partial: boolean }
  | { action: "continue"; reason: "new_events" | "nothing_found_yet"; windowSize: number }
  | { action: "follow_up"; reason: "program_lineup"; windowSize: number };

const stop = (reason: StepStopReason, partial: boolean): NextStepDecision => ({ action: "stop", reason, partial });

/**
 * The continue decision, evaluated after the first request and after every step, top to bottom, first match wins
 * (`_bmad-output/specs/spec-cursor-extraction/continue-rules.md`). `partial` says whether the post is left flagged
 * partial (slides were left unread for a reason other than the evidence saying the result is complete).
 */
export function decideNextStep(state: StepState): NextStepDecision {
  const decision = decideByRows(state);
  // A truncated leaf lost items that no later step can recover, so any stop leaves the post partial.
  return decision.action === "stop" && state.leafTruncated === true ? { ...decision, partial: true } : decision;
}

function decideByRows(state: StepState): NextStepDecision {
  // 1. Nothing left to read (a missing or non-numeric count counts as nothing).
  if (!(state.unreadSlides > 0) || !Number.isInteger(state.unreadSlides)) {
    return stop("no_unread_slides", false);
  }
  // 2. The kill switch and the request bound (AD-51): do not start or continue, flag partial.
  if (!state.killSwitchOn) {
    return stop("kill_switch_off", true);
  }
  if (!canMakeRequest(state.requestsMade, state.unreadAtStart)) {
    return stop("request_bound", true);
  }
  // 3. A complete single-event result stops.
  if (state.groupingReason === "single-event" && state.eventsFound >= 1) {
    return stop("single_event_complete", false);
  }
  // 4. A lineup or dependent stages: one follow-up with all remaining slides, up to 10 images in total.
  if (state.groupingReason === "program-lineup" || state.groupingReason === "dependent-stages") {
    if (!state.followUpMade) {
      const room = Math.max(0, FOLLOW_UP_MAX_IMAGES - state.imagesRead);
      const windowSize = Math.min(state.unreadSlides, room);
      return windowSize > 0
        ? { action: "follow_up", reason: "program_lineup", windowSize }
        : stop("follow_up_done", true);
    }
    return stop("follow_up_done", state.unreadSlides > 0);
  }
  // 5-6. Nothing found yet: a text-free cover is not a stop signal, but only a couple of empty steps are allowed.
  if (state.eventsFound === 0) {
    return state.emptySteps < MAX_EMPTY_STEPS
      ? { action: "continue", reason: "nothing_found_yet", windowSize: Math.min(state.unreadSlides, nextWindowSize(state.itemsPerSlide)) }
      : stop("empty_steps_spent", false);
  }
  // 7-8. Roundups and separate events keep going while each step adds something new.
  if (state.groupingReason === "roundup" || state.groupingReason === "separate-events") {
    return state.lastStepNewEvents >= 1
      ? { action: "continue", reason: "new_events", windowSize: Math.min(state.unreadSlides, nextWindowSize(state.itemsPerSlide)) }
      : stop("no_new_events", false);
  }
  // 9. Any other state (no first-request label): stop, and say so when slides were left unread.
  return stop("other", true);
}
