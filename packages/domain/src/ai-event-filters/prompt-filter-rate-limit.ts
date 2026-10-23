// Story 9.8 -- per-user request-volume guard for resolvePromptToEventFilter. Pure,
// dependency-free logic (no DB/ORM/Node-only import) -- the DB-coupled store
// (apps/backend/src/lib/ai-event-filters/prompt-filter-rate-limit-store.ts) is a thin
// read-evaluate-write wrapper around this module with no business logic of its own.
//
// isRateLimitWindowElapsed deliberately mirrors packages/domain/src/ai-gateway/usage-cycle.ts's
// isCycleElapsed shape (start-time + duration vs. `now`) but takes `windowMinutes` rather than
// `cycleDays`: reusing isCycleElapsed by passing a fractional-day value computed backwards from
// minutes would be a confusing units misuse, not a code savings -- see this story's Dev Notes
// decision 1.

export interface PromptFilterRateLimitState {
  requestCount: number;
  windowStartAt: string; // ISO-8601
}

export interface PromptFilterRateLimitDecision {
  allowed: boolean;
  // Always the row the caller should persist when `allowed` is true. When `allowed` is false,
  // equals the input state unchanged -- the caller must NOT write anything on a denial (no
  // "wasted" increment for a request that was never allowed to proceed).
  nextState: PromptFilterRateLimitState;
}

export function isRateLimitWindowElapsed(windowStartAt: string, windowMinutes: number, now: Date): boolean {
  const startMs = new Date(windowStartAt).getTime();
  // A window shorter than a minute would be "always elapsed", i.e. no limit at all (Epic 9 review
  // P12) -- the configuration layer rejects it, and this clamps it for any other caller.
  const windowMs = Math.max(1, windowMinutes) * 60 * 1000;
  return now.getTime() - startMs >= windowMs;
}

export function evaluatePromptFilterRateLimit(
  state: PromptFilterRateLimitState | null,
  maxRequests: number,
  windowMinutes: number,
  now: Date
): PromptFilterRateLimitDecision {
  if (maxRequests < 1) {
    // "Allow nothing" must mean nothing, including the first request of a fresh window.
    return { allowed: false, nextState: state ?? { requestCount: 0, windowStartAt: now.toISOString() } };
  }
  if (state === null || isRateLimitWindowElapsed(state.windowStartAt, windowMinutes, now)) {
    return { allowed: true, nextState: { requestCount: 1, windowStartAt: now.toISOString() } };
  }
  if (state.requestCount >= maxRequests) {
    return { allowed: false, nextState: state };
  }
  return { allowed: true, nextState: { requestCount: state.requestCount + 1, windowStartAt: state.windowStartAt } };
}
