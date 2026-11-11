import { test } from "node:test";
import assert from "node:assert/strict";
import { SubscriptionCapReachedError, evaluateSubscriptionCap } from "./subscription-cap.js";

// Story 10.3 -- the subscription cap (PRD FR122, section 6): active subscriptions plus reserved slots, applied to every non-moderator.

const base = { isModerator: false, alreadyHeld: false, cap: 5 };

test("evaluateSubscriptionCap: below the cap is allowed", () => {
  assert.deepEqual(evaluateSubscriptionCap({ ...base, activeCount: 0, reservedCount: 0 }), { allowed: true });
  assert.deepEqual(evaluateSubscriptionCap({ ...base, activeCount: 4, reservedCount: 0 }), { allowed: true });
  assert.deepEqual(evaluateSubscriptionCap({ ...base, activeCount: 2, reservedCount: 2 }), { allowed: true });
});

test("evaluateSubscriptionCap: at the cap is refused, with the numbers the refusal screen needs", () => {
  assert.deepEqual(evaluateSubscriptionCap({ ...base, activeCount: 5, reservedCount: 0 }), {
    allowed: false,
    activeCount: 5,
    reservedCount: 0,
    cap: 5,
  });
  assert.deepEqual(evaluateSubscriptionCap({ ...base, activeCount: 3, reservedCount: 2 }), {
    allowed: false,
    activeCount: 3,
    reservedCount: 2,
    cap: 5,
  });
});

test("evaluateSubscriptionCap: a user already above the cap keeps what they have and cannot add another", () => {
  assert.equal(evaluateSubscriptionCap({ ...base, activeCount: 8, reservedCount: 0 }).allowed, false);
});

test("evaluateSubscriptionCap: a moderator is exempt", () => {
  assert.deepEqual(evaluateSubscriptionCap({ ...base, isModerator: true, activeCount: 50, reservedCount: 5 }), {
    allowed: true,
  });
});

test("evaluateSubscriptionCap: an account the user already holds uses no extra slot", () => {
  assert.deepEqual(evaluateSubscriptionCap({ ...base, alreadyHeld: true, activeCount: 5, reservedCount: 0 }), {
    allowed: true,
  });
});

test("SubscriptionCapReachedError carries the three numbers and is an Error", () => {
  const error = new SubscriptionCapReachedError({ activeCount: 4, reservedCount: 1, cap: 5 });
  assert.ok(error instanceof Error);
  assert.equal(error.name, "SubscriptionCapReachedError");
  assert.equal(error.activeCount, 4);
  assert.equal(error.reservedCount, 1);
  assert.equal(error.cap, 5);
  assert.match(error.message, /5/);
});
