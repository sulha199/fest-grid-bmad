import { consumeEnqueuedStepCount } from './extraction-chain.js';

/**
 * The AI Lambda's `longPollHint` for `pollAndDrainQueue` (AD-47 Rule 5, AD-52 Rule 5).
 *
 * The drain's queue-depth gate ends a tick when a short poll is empty and the approximate counts read 0. This
 * Lambda is the one consumer that puts messages on its OWN queue while a tick runs: the next step of a stepped
 * extraction (delayed 10 s) and the retries its resume pass re-enqueues just before the drain. Those are sent
 * seconds before the gate looks, so the counts may not show them yet and the tick would end, costing each of them
 * a whole 5-minute tick. The hint makes the receive after such a send the plain long poll, which asks every SQS
 * server and catches them.
 *
 * True when `resumeMayHaveEnqueued` (the first receive only), or when a chain step has been enqueued since the
 * previous call (read and reset on each call). Costs a 20 s poll only on ticks that enqueued something.
 */
export function buildDrainLongPollHint(
  resumeMayHaveEnqueued: boolean,
  consumeStepCount: () => number = consumeEnqueuedStepCount
): () => boolean {
  let resumePending = resumeMayHaveEnqueued;
  return () => {
    const stepsEnqueued = consumeStepCount() > 0;
    const resume = resumePending;
    resumePending = false;
    return resume || stepsEnqueued;
  };
}
