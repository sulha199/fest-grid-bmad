import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExtractedEventMessage } from "../events/types.js";
import {
  EXTRACTION_ORDINAL_CEILING,
  FOLLOW_UP_MAX_IMAGES,
  FIRST_STEP_WINDOW,
  MAX_EMPTY_STEPS,
  OrdinalRangeExhaustedError,
  PER_CALL_EVENT_CAP,
  canMakeRequest,
  decideNextStep,
  eventDedupeKey,
  isAtRisk,
  newEventsByKey,
  nextWindowSize,
  requestBound,
  reserveOrdinalRange,
  splitWindow,
  type StepState,
} from "./extraction-cursor.js";

const event = (eventName: string, ...dates: string[]): ExtractedEventMessage =>
  ({ eventName, schedules: dates.map((eventStartDate) => ({ eventStartDate })) }) as unknown as ExtractedEventMessage;

const base: StepState = {
  killSwitchOn: true,
  groupingReason: "roundup",
  unreadSlides: 8,
  imagesRead: 6,
  eventsFound: 10,
  lastStepNewEvents: 4,
  emptySteps: 0,
  followUpMade: false,
  requestsMade: 0,
  unreadAtStart: 8,
  itemsPerSlide: 5,
};

describe("decideNextStep: continue-rules.md, row by row", () => {
  it("1. nothing unread: stop, not partial", () => {
    assert.deepEqual(decideNextStep({ ...base, unreadSlides: 0 }), { action: "stop", reason: "no_unread_slides", partial: false });
  });

  it("2. kill switch off: stop and flag partial, before any other rule", () => {
    assert.deepEqual(decideNextStep({ ...base, killSwitchOn: false }), { action: "stop", reason: "kill_switch_off", partial: true });
  });

  it("2. request bound: stop and flag partial once the requests reach twice the unread slides", () => {
    assert.deepEqual(decideNextStep({ ...base, unreadAtStart: 3, requestsMade: 6 }), { action: "stop", reason: "request_bound", partial: true });
    assert.equal(decideNextStep({ ...base, unreadAtStart: 3, requestsMade: 5 }).action, "continue");
  });

  it("1 wins over 2: nothing unread stops cleanly even with the kill switch off", () => {
    assert.equal(decideNextStep({ ...base, unreadSlides: 0, killSwitchOn: false }).action, "stop");
    assert.equal((decideNextStep({ ...base, unreadSlides: 0, killSwitchOn: false }) as { reason: string }).reason, "no_unread_slides");
  });

  it("3. a single-event result with at least one event stops, not partial", () => {
    assert.deepEqual(
      decideNextStep({ ...base, groupingReason: "single-event", eventsFound: 1 }),
      { action: "stop", reason: "single_event_complete", partial: false }
    );
  });

  it("4. a lineup gets ONE follow-up with all remaining slides, up to 10 images in total", () => {
    assert.deepEqual(
      decideNextStep({ ...base, groupingReason: "program-lineup", imagesRead: 6, unreadSlides: 3 }),
      { action: "follow_up", reason: "program_lineup", windowSize: 3 }
    );
    assert.deepEqual(
      decideNextStep({ ...base, groupingReason: "dependent-stages", imagesRead: 6, unreadSlides: 8 }),
      { action: "follow_up", reason: "program_lineup", windowSize: FOLLOW_UP_MAX_IMAGES - 6 }
    );
  });

  it("4. after the follow-up: stop, partial only when slides remain", () => {
    assert.deepEqual(
      decideNextStep({ ...base, groupingReason: "program-lineup", followUpMade: true, unreadSlides: 0 + 2 }),
      { action: "stop", reason: "follow_up_done", partial: true }
    );
  });

  it("4. a lineup already at 10 images has no room for a follow-up: stop, partial", () => {
    assert.deepEqual(
      decideNextStep({ ...base, groupingReason: "program-lineup", imagesRead: 10, unreadSlides: 2 }),
      { action: "stop", reason: "follow_up_done", partial: true }
    );
  });

  it("5. nothing found yet: continue with the next window, a text-free cover is not a stop signal", () => {
    const decision = decideNextStep({ ...base, eventsFound: 0, lastStepNewEvents: 0, emptySteps: 0, itemsPerSlide: null });
    assert.deepEqual(decision, { action: "continue", reason: "nothing_found_yet", windowSize: FIRST_STEP_WINDOW });
    assert.equal(decideNextStep({ ...base, eventsFound: 0, lastStepNewEvents: 0, emptySteps: MAX_EMPTY_STEPS - 1 }).action, "continue");
  });

  it("6. nothing found after the allowed empty steps: stop, not partial", () => {
    assert.deepEqual(
      decideNextStep({ ...base, eventsFound: 0, lastStepNewEvents: 0, emptySteps: MAX_EMPTY_STEPS }),
      { action: "stop", reason: "empty_steps_spent", partial: false }
    );
  });

  it("5. applies to a single-event label with no event too", () => {
    assert.equal(decideNextStep({ ...base, groupingReason: "single-event", eventsFound: 0, emptySteps: 0 }).action, "continue");
  });

  it("7. a roundup or separate-events post continues while the last step added something", () => {
    for (const groupingReason of ["roundup", "separate-events"] as const) {
      const decision = decideNextStep({ ...base, groupingReason, lastStepNewEvents: 1 });
      assert.equal(decision.action, "continue", groupingReason);
    }
  });

  it("7. the window never exceeds the unread slides and follows the observed density", () => {
    const decision = decideNextStep({ ...base, unreadSlides: 1, itemsPerSlide: 5 });
    assert.deepEqual(decision, { action: "continue", reason: "new_events", windowSize: 1 });
    assert.deepEqual(decideNextStep({ ...base, unreadSlides: 8, itemsPerSlide: 5 }), { action: "continue", reason: "new_events", windowSize: 4 });
    assert.deepEqual(decideNextStep({ ...base, unreadSlides: 8, itemsPerSlide: 12 }), { action: "continue", reason: "new_events", windowSize: 2 });
  });

  it("8. content was found earlier but the last step added nothing: stop, not partial", () => {
    assert.deepEqual(
      decideNextStep({ ...base, lastStepNewEvents: 0 }),
      { action: "stop", reason: "no_new_events", partial: false }
    );
  });

  it("9. any other state stops (no first-request label), partial because slides were left unread", () => {
    assert.deepEqual(decideNextStep({ ...base, groupingReason: null }), { action: "stop", reason: "other", partial: true });
  });

  it("a truncated leaf makes every stop partial, including the otherwise clean ones", () => {
    assert.deepEqual(
      decideNextStep({ ...base, leafTruncated: true, lastStepNewEvents: 0 }),
      { action: "stop", reason: "no_new_events", partial: true }
    );
    assert.deepEqual(
      decideNextStep({ ...base, leafTruncated: true, unreadSlides: 0 }),
      { action: "stop", reason: "no_unread_slides", partial: true }
    );
    assert.equal(decideNextStep({ ...base, leafTruncated: true }).action, "continue", "a continue is unaffected");
    assert.deepEqual(decideNextStep({ ...base, leafTruncated: false, unreadSlides: 0 }), { action: "stop", reason: "no_unread_slides", partial: false });
  });

  it("a non-numeric or fractional unread count is treated as nothing to read, never as a window", () => {
    for (const unreadSlides of [Number.NaN, 2.5, -1]) {
      assert.deepEqual(decideNextStep({ ...base, unreadSlides }), { action: "stop", reason: "no_unread_slides", partial: false }, String(unreadSlides));
    }
  });
});

describe("request bound", () => {
  it("is twice the images unread at the start", () => {
    assert.equal(requestBound(14), 28);
    assert.equal(requestBound(0), 0);
    assert.equal(requestBound(-3), 0);
  });

  it("allows a request only while the count is below the bound", () => {
    assert.equal(canMakeRequest(27, 14), true);
    assert.equal(canMakeRequest(28, 14), false);
  });
});

describe("nextWindowSize", () => {
  it("starts at 2 with no observation and adapts between 1 and 4", () => {
    assert.equal(nextWindowSize(null), 2);
    assert.equal(nextWindowSize(Number.NaN), 2);
    assert.equal(nextWindowSize(0), 2);
    assert.equal(nextWindowSize(3), 4, "floor(25/3) is 8, capped at 4");
    assert.equal(nextWindowSize(8), 3);
    assert.equal(nextWindowSize(20), 1);
    assert.equal(nextWindowSize(40), 1, "never below 1");
    assert.equal(nextWindowSize(Infinity), 1, "unbounded density is the smallest window");
    assert.equal(nextWindowSize(5, 10), 2, "a custom cap");
  });
});

describe("splitWindow", () => {
  it("halves a window, the first half taking the odd slide", () => {
    assert.deepEqual(splitWindow({ start: 6, size: 5 }), [
      { start: 6, size: 3 },
      { start: 9, size: 2 },
    ]);
    assert.deepEqual(splitWindow({ start: 0, size: 2 }), [
      { start: 0, size: 1 },
      { start: 1, size: 1 },
    ]);
  });

  it("cannot split a non-numeric window", () => {
    assert.equal(splitWindow({ start: 0, size: Number.NaN }), null);
    assert.equal(splitWindow({ start: 0, size: Infinity }), null);
  });

  it("cannot split a single slide", () => {
    assert.equal(splitWindow({ start: 3, size: 1 }), null);
    assert.equal(splitWindow({ start: 3, size: 0 }), null);
  });
});

describe("isAtRisk", () => {
  it("any output signal is at risk", () => {
    assert.equal(isAtRisk({ outputSignals: ["max_tokens"], eventCount: 3 }), true);
  });

  it("events at the per-call cap are at risk", () => {
    assert.equal(isAtRisk({ outputSignals: [], eventCount: PER_CALL_EVENT_CAP }), true);
    assert.equal(isAtRisk({ outputSignals: [], eventCount: PER_CALL_EVENT_CAP - 1 }), false);
    assert.equal(isAtRisk({ outputSignals: [], eventCount: 5, perCallCap: 5 }), true);
  });

  it("the model's own minEventCount above events plus skipped items is at risk", () => {
    assert.equal(isAtRisk({ outputSignals: [], eventCount: 10, minEventCount: 40 }), true);
    assert.equal(isAtRisk({ outputSignals: [], eventCount: 10, minEventCount: 40, skippedItemCount: 30 }), false);
    assert.equal(isAtRisk({ outputSignals: [], eventCount: 10, minEventCount: null }), false);
    assert.equal(isAtRisk({ outputSignals: [], eventCount: 10, minEventCount: 40, skippedItemCount: Number.NaN }), true, "a NaN skip count counts as none");
    assert.equal(isAtRisk({ outputSignals: [], eventCount: 10 }), false);
  });
});

describe("eventDedupeKey and newEventsByKey", () => {
  it("normalizes the name (case, spacing) and keeps the date", () => {
    assert.equal(eventDedupeKey("  Jazz   Night ", "2027-01-05"), "jazz night|2027-01-05");
    assert.equal(eventDedupeKey("Jazz Night", undefined), "jazz night|");
  });

  it("drops events already known by key, including repeats inside one step, and returns the grown key set", () => {
    const known = [eventDedupeKey("Jazz Night", "2027-01-05")];
    const found = [event("JAZZ  night", "2027-01-05", "2027-01-12"), event("Wayang", "2027-02-01"), event("wayang", "2027-02-01"), event("Wayang", "2027-03-01")];
    const { fresh, keys } = newEventsByKey(known, found);
    assert.deepEqual(fresh.map((e) => e.eventName), ["Wayang", "Wayang"], "same name on another date is a different event");
    assert.equal(keys.length, 3);
  });

  it("an event with no schedule dates, or no schedules field at all, is keyed by name alone", () => {
    const { fresh, keys } = newEventsByKey([], [event("No date"), { eventName: "Missing field" } as unknown as ExtractedEventMessage]);
    assert.equal(fresh.length, 2);
    assert.deepEqual(keys, ["no date|", "missing field|"]);
  });
});

describe("reserveOrdinalRange", () => {
  it("numbers a step's events from the next free value in (date, name, index) order and advances it", () => {
    const events = [event("Zeta", "2027-03-01"), event("alpha", "2027-03-01"), event("Early", "2027-01-01")];
    const { events: numbered, nextOrdinal } = reserveOrdinalRange(26, events);
    assert.deepEqual(
      numbered.map((e) => [e.eventName, e.extractionOrdinal]),
      [
        ["Early", 26],
        ["alpha", 27],
        ["Zeta", 28],
      ]
    );
    assert.equal(nextOrdinal, 29);
  });

  it("an empty step reserves nothing", () => {
    assert.deepEqual(reserveOrdinalRange(5, []), { events: [], nextOrdinal: 5 });
  });

  it("is deterministic: the same events in another order get the same ordinals", () => {
    const a = [event("B", "2027-01-02"), event("A", "2027-01-01")];
    const b = [...a].reverse();
    const toMap = (r: ReturnType<typeof reserveOrdinalRange>) => new Map(r.events.map((e) => [e.eventName, e.extractionOrdinal]));
    assert.deepEqual(toMap(reserveOrdinalRange(0, a)), toMap(reserveOrdinalRange(0, b)));
  });

  it("refuses a start that is not a non-negative whole number", () => {
    for (const start of [Number.NaN, -1, 1.5]) {
      assert.throws(() => reserveOrdinalRange(start, [event("A", "2027-01-01")]), OrdinalRangeExhaustedError, String(start));
    }
  });

  it("refuses a range that would reach the ceiling the re-extract Apply parks events at", () => {
    assert.throws(() => reserveOrdinalRange(EXTRACTION_ORDINAL_CEILING - 1, [event("A", "2027-01-01"), event("B", "2027-01-02")]), OrdinalRangeExhaustedError);
    assert.doesNotThrow(() => reserveOrdinalRange(EXTRACTION_ORDINAL_CEILING - 2, [event("A", "2027-01-01"), event("B", "2027-01-02")]));
  });
});
