import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, type Message } from '@aws-sdk/client-sqs';

// Follows the exact same reassignable-function/setter test-seam convention already
// established by send-sqs-message.ts's sendSqsMessage/setSendSqsMessage.
export let receiveSqsMessages = async (queueUrl: string): Promise<Message[]> => {
  const client = new SQSClient({});
  const result = await client.send(new ReceiveMessageCommand({
    QueueUrl: queueUrl,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 20,
  }));
  return result.Messages ?? [];
};

export function setReceiveSqsMessages(fn: typeof receiveSqsMessages) {
  receiveSqsMessages = fn;
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
}

/**
 * Repeatedly receives and processes messages from an SQS queue until either a receive
 * call returns zero messages (queue drained) or the time budget is reached, rather than
 * processing a single fixed batch per invocation. A message is only deleted after
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

  // The first receive always happens regardless of the time budget so a single short-lived
  // invocation still does useful work; the budget only governs whether the loop continues
  // past the batch it is currently processing.
  for (;;) {
    let messages: Message[];
    try {
      messages = await receiveSqsMessages(queueUrl);
    } catch (error) {
      // A transient SQS error (throttling, network) should not fail the whole invocation --
      // log and stop this cycle; the next 5-minute-scheduled tick will retry.
      console.error('pollAndDrainQueue: receiveSqsMessages failed, stopping this cycle', error);
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

      const message = messages[i];
      if (!message.Body || !message.ReceiptHandle) {
        console.warn('pollAndDrainQueue: skipping message with missing Body/ReceiptHandle', message);
        continue;
      }
      try {
        await handleMessage(message.Body);
        await deleteSqsMessage(queueUrl, message.ReceiptHandle);
      } catch (error) {
        console.error('pollAndDrainQueue: failed to process message, leaving it undeleted', error);
      }
    }

    if (Date.now() >= deadline) {
      return;
    }
  }
}
