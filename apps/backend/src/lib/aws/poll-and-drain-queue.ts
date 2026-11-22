import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
  type Message,
} from '@aws-sdk/client-sqs';

// SQS long poll: the receive waits up to this long for a message. Billed Lambda time, so it is only
// spent once the queue-depth gate in pollAndDrainQueue says there is work.
const LONG_POLL_WAIT_SECONDS = 20;

// Follows the exact same reassignable-function/setter test-seam convention already
// established by send-sqs-message.ts's sendSqsMessage/setSendSqsMessage.
// `waitTimeSeconds` 0 is a short poll (returns at once, but samples only a subset of SQS servers, so it can
// come back empty while messages exist); the default is the 20 s long poll. Clamped to an integer 0-20
// (NaN falls back to the long poll).
export let receiveSqsMessages = async (
  queueUrl: string,
  maxMessages = 10,
  waitTimeSeconds = LONG_POLL_WAIT_SECONDS
): Promise<Message[]> => {
  const client = new SQSClient({});
  const result = await client.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: Math.min(10, Math.max(1, Math.floor(maxMessages))),
    WaitTimeSeconds: Number.isNaN(waitTimeSeconds)
      ? LONG_POLL_WAIT_SECONDS
      : Math.min(LONG_POLL_WAIT_SECONDS, Math.max(0, Math.floor(waitTimeSeconds))),
  }));
  return result.Messages ?? [];
};

export function setReceiveSqsMessages(fn: typeof receiveSqsMessages) {
  receiveSqsMessages = fn;
}

const QUEUE_DEPTH_ATTRIBUTES = [
  'ApproximateNumberOfMessages',
  'ApproximateNumberOfMessagesDelayed',
  'ApproximateNumberOfMessagesNotVisible',
] as const;

/**
 * How many messages the queue holds in any state: visible + delayed + in flight (one API call). Delayed
 * and in-flight ones count as work because a step enqueued with a short DelaySeconds (AD-47's 10 s) shows up
 * inside the long poll, and a failed message is invisible until its visibility timeout ends. The counts are
 * approximate and eventually consistent. Returns NaN when an attribute is missing or unparsable, which the
 * caller treats as "there may be work" (fail open): the gate only ever skips the long poll on a clean 0.
 */
export let getQueueDepth = async (queueUrl: string): Promise<number> => {
  const client = new SQSClient({});
  const result = await client.send(new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: [...QUEUE_DEPTH_ATTRIBUTES],
  }));
  let total = 0;
  for (const name of QUEUE_DEPTH_ATTRIBUTES) {
    const count = Number.parseInt(result.Attributes?.[name] ?? '', 10);
    if (Number.isNaN(count)) {
      return Number.NaN;
    }
    total += count;
  }
  return total;
};

export function setGetQueueDepth(fn: typeof getQueueDepth) {
  getQueueDepth = fn;
}

export let deleteSqsMessage = async (queueUrl: string, receiptHandle: string): Promise<void> => {
  const client = new SQSClient({});
  await client.send(new DeleteMessageCommand({
    QueueUrl: queueUrl,
    ReceiptHandle: receiptHandle,
  }));
};

export function setDeleteSqsMessage(fn: typeof deleteSqsMessage) {
  deleteSqsMessage = fn;
}

// Shared job-type type guard for the 3 Lambda handlers (scraper.ts, ai-processor.ts,
// ingestor.ts) that each need to distinguish their poll-and-drain EventBridge trigger (and,
// for scraper.ts, its pre-existing stale-job-sweep trigger) from their normal SQSEvent-batch
// shape. A dedicated type-guard function (rather than an inline `'jobType' in event &&
// event.jobType === '...'` check) is required so TypeScript's control-flow analysis can fully
// narrow `event` back down to its non-job-type member(s) in the code after this guard's
// `return` -- a compound `&&` expression combining an `in` check with a literal-value
// comparison doesn't get the same narrowing guarantee once more than one union member
// declares a `jobType` field. Generic over the literal so all 3 handlers share one
// implementation instead of copy-pasting an identical function per file.
export function hasJobType<T extends string>(event: unknown, jobType: T): event is { jobType: T } {
  return (event as { jobType?: unknown } | null | undefined)?.jobType === jobType;
}

// 300s Lambda timeout minus a 30s safety margin, so the loop never gets killed mid-receive
// by the platform's own hard timeout.
const DEFAULT_TIME_BUDGET_MS = 270_000;

export interface PollAndDrainQueueOptions {
  timeBudgetMs?: number;
  /**
   * The longest one message can take to handle. When set, each receive asks for only as many messages as
   * fit in what is left of the time budget (at least one on the first receive), so every received
   * message is handled before the budget ends. Without it a batch of 10 slow messages outlasts the
   * queue's visibility timeout and the Lambda's own limit: the unhandled ones are redelivered, each
   * redelivery spending one of the queue's maxReceiveCount without the message having been tried.
   */
  perMessageBudgetMs?: number;
  /**
   * Remaining-time guard, active only when BOTH this and `getRemainingTimeInMillis` are given. The loop
   * returns (leaving the rest of the queue for the next scheduled tick) instead of starting a receive or a
   * message when the Lambda's real remaining time is below this. `timeBudgetMs` is measured from the loop's
   * start and knows nothing about a slow earlier message in an already-received batch, so on its own a
   * message can still start with too little time left for work that has its own time floor (the AI
   * processor's face-blur, which fails closed to text-only and is never retried).
   */
  minRemainingMs?: number;
  getRemainingTimeInMillis?: () => number;
}

/**
 * Repeatedly receives and processes messages from an SQS queue until either a receive
 * call returns zero messages (queue drained) or the time budget is reached, rather than
 * processing a single fixed batch per invocation.
 *
 * Every receive is gated so an idle tick stays well under a second, not the 20 s long poll (billed Lambda time, three
 * Lambdas x 288 ticks/day: the free tier ran out around day 24). The receive first short-polls; only when that
 * is empty does `getQueueDepth` decide: 0 means drained (return), anything else (including an unreadable or
 * failed depth call) earns the 20 s long poll, whose empty result also ends the cycle. A short poll alone cannot
 * be trusted, since it samples a subset of servers and can miss messages that exist. A message is only deleted after
 * `handleMessage` resolves without throwing -- a thrown error is logged and the message is
 * left undeleted so the queue's own maxReceiveCount redrive-to-DLQ policy still applies.
 */
export async function pollAndDrainQueue(
  queueUrl: string,
  handleMessage: (body: string) => Promise<void>,
  opts: PollAndDrainQueueOptions = {}
): Promise<void> {
  const timeBudgetMs = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const deadline = Date.now() + timeBudgetMs;
  const perMessageBudgetMs = opts.perMessageBudgetMs;
  let firstReceive = true;
  const guardMinRemainingMs = opts.minRemainingMs;
  const getRemainingMs = opts.getRemainingTimeInMillis;
  let handled = 0;

  // True (after logging) when the guard says not to start more work. `leftInFlight` is how many already
  // received messages of the current batch are being abandoned: they stay invisible for the queue's
  // visibility timeout and each spent one of its maxReceiveCount. `handled` counts messages whose handler
  // and delete both succeeded.
  const guardTripped = (leftInFlight: number): boolean => {
    if (guardMinRemainingMs === undefined || getRemainingMs === undefined) {
      return false;
    }
    const remaining = getRemainingMs();
    if (remaining >= guardMinRemainingMs) {
      return false;
    }
    console.warn(
      `pollAndDrainQueue: stopping, ${remaining}ms of Lambda time remaining is below the ${guardMinRemainingMs}ms ` +
        `minimum (handled=${handled}, leftInFlight=${leftInFlight})`
    );
    return true;
  };

  // Without the remaining-time guard, the first receive always happens regardless of the time budget so a
  // single short-lived invocation still does useful work; the budget only governs whether the loop
  // continues past the batch it is currently processing. With the guard, nothing starts below its minimum,
  // the first receive included.
  for (;;) {
    let messages: Message[];
    // Only with a per-message budget: how many messages the rest of the time budget can hold.
    let maxMessages: number | undefined;
    if (guardTripped(0)) {
      return;
    }
    if (perMessageBudgetMs !== undefined) {
      const fits = Math.floor((deadline - Date.now()) / perMessageBudgetMs);
      if (fits < 1 && !firstReceive) {
        return;
      }
      maxMessages = Math.max(1, fits);
    }
    firstReceive = false;
    // `maxMessages` is computed once above and used by both polls, so the per-message budget holds for either.
    const receive = (waitTimeSeconds: number) =>
      receiveSqsMessages(queueUrl, maxMessages, waitTimeSeconds);
    let poll = 'short poll';
    try {
      messages = await receive(0);
      if (messages.length === 0) {
        let depth = Number.NaN;
        let depthFailed = false;
        try {
          depth = await getQueueDepth(queueUrl);
        } catch (error) {
          // Unlike a failed receive, a failed depth read says nothing about the queue itself, so stopping would
          // starve consumption for as long as it fails (e.g. a missing permission): long-poll instead.
          depthFailed = true;
          console.error('pollAndDrainQueue: getQueueDepth failed, falling back to the long poll', error);
        }
        if (depth === 0) {
          console.log('pollAndDrainQueue: outcome=gated-empty depth=0');
          return;
        }
        // The depth call took a moment of its own; the long poll below can take up to 20 s.
        if (guardTripped(0)) {
          return;
        }
        poll = 'long poll';
        messages = await receive(LONG_POLL_WAIT_SECONDS);
        // A depth that threw or was unreadable (NaN) is one outcome, so a permission regression on
        // GetQueueAttributes shows up as `depth-failed` whatever the long poll then returned.
        const depthUnknown = depthFailed || Number.isNaN(depth);
        const outcome = depthUnknown ? 'depth-failed' : messages.length > 0 ? 'long-poll-hit' : 'long-poll-miss';
        console.log(
          `pollAndDrainQueue: outcome=${outcome} depth=${depthUnknown ? 'unknown' : depth} messages=${messages.length}`
        );
      }
    } catch (error) {
      // A transient SQS error (throttling, network) should not fail the whole invocation --
      // log and stop this cycle; the next 5-minute-scheduled tick will retry.
      console.error(`pollAndDrainQueue: receiveSqsMessages failed (${poll}), stopping this cycle`, error);
      return;
    }
    if (messages.length === 0) {
      return;
    }

    for (let i = 0; i < messages.length; i++) {
      // Checked before each message after the first in the batch (not just once per batch)
      // so a batch of slow handleMessage calls can't run the invocation past its time budget
      // and into the Lambda's own hard timeout. The first message in a batch is always
      // attempted regardless of the budget -- same "always do at least a little work"
      // guarantee as the first receive above -- but any message beyond it is skipped once
      // the budget is already spent, left unprocessed/undeleted, and picked up on the next
      // scheduled tick.
      if (i > 0 && Date.now() >= deadline) {
        return;
      }
      // Every message, a batch's first included: the receive above can long-poll for up to 20s, and an
      // earlier message in the batch may have run past its budget.
      if (guardTripped(messages.length - i)) {
        return;
      }

      const message = messages[i];
      if (!message.Body || !message.ReceiptHandle) {
        console.warn('pollAndDrainQueue: skipping message with missing Body/ReceiptHandle', message);
        continue;
      }
      try {
        await handleMessage(message.Body);
        await deleteSqsMessage(queueUrl, message.ReceiptHandle);
        handled += 1;
      } catch (error) {
        console.error('pollAndDrainQueue: failed to process message, leaving it undeleted', error);
      }
    }

    if (Date.now() >= deadline) {
      return;
    }
  }
}
