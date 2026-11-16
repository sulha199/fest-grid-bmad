// Story 10.3 -- the subscription cap (PRD section 6 "Who the Cap Applies To", FR122). Pure: the backend counts the rows
// (`apps/backend/src/lib/subscriptions/subscription-cap.ts`) and asks this function.

export type SubscriptionCapDecision =
  | { allowed: true }
  | { allowed: false; activeCount: number; reservedCount: number; cap: number };

/**
 * A user may hold at most `cap` active subscriptions, counting the slots reserved by accounts still being added
 * (non-terminal jobs of a type that reserves a slot). A moderator is exempt; an account the user already holds uses no
 * extra slot; a user already at or above the cap keeps everything and cannot add another.
 */
export function evaluateSubscriptionCap(input: {
  isModerator: boolean;
  activeCount: number;
  reservedCount: number;
  alreadyHeld: boolean;
  cap: number;
}): SubscriptionCapDecision {
  if (input.isModerator || input.alreadyHeld) {
    return { allowed: true };
  }
  if (input.activeCount + input.reservedCount < input.cap) {
    return { allowed: true };
  }
  return { allowed: false, activeCount: input.activeCount, reservedCount: input.reservedCount, cap: input.cap };
}

/** The typed refusal; the `subscribeToAccount` resolver maps it to the GraphQL error `SUBSCRIPTION_CAP_REACHED` (Story 10.3a shows it). */
export class SubscriptionCapReachedError extends Error {
  readonly activeCount: number;
  readonly reservedCount: number;
  readonly cap: number;

  constructor(input: { activeCount: number; reservedCount: number; cap: number }) {
    super(`The subscription cap of ${input.cap} accounts is reached.`);
    this.name = "SubscriptionCapReachedError";
    this.activeCount = input.activeCount;
    this.reservedCount = input.reservedCount;
    this.cap = input.cap;
  }
}
